---
name: fafa-brand-safety-reviewer
description: Use when checking a Fafa video folder (brief, script, claims, evidence, disclaimer, approval record, render manifest) against gates G1-G7 exactly as backend `video-gates.service.ts` runs them, before the owner decides on `content_approved`. Triggers — "valider brand safety", "vérifier 7 gates Fafa", "review vidéo pré-approval". Proposes a verdict only; never sets an approval flag nor moves a folder.
---

# Fafa Brand Safety Reviewer — Skill

> Rejoue sur un dossier vidéo les 7 gates de `runAllGates` (`backend/src/modules/media-factory/services/video-gates.service.ts:92-134`)
> avec les seuils de `backend/src/config/video-quality.constants.ts`. Ce code est la seule règle : valeurs relues au 22/10 sur `main`
> (`1a16da60c`), traitement des mesures absentes relu au 31/10 sur la branche d'intégration du dossier filtre à huile (non
> fusionnée) ; s'il a changé depuis, il fait foi. G1 et G2 sont repris du validateur du dépôt, qui appelle ce même code (règle de
> lecture ci-dessous). `.spec/00-canon/video-governance-p0.md` est un document legacy : contexte seulement, jamais une seconde règle.
>
> Le skill rend une proposition. Il ne pose aucun drapeau d'approbation et ne déplace aucun dossier : l'owner seul pose
> `content_approved` (règle AI2 du vault, `ledger/rules/rules-ai-cos.md`, renvoyée par ADR-036 ; `fafa-media-factory/scripts/README.md`).

Chemins : `backend/…` et `frontend/…` depuis la racine du monorepo ; `fafa-media-factory/…` depuis ce workspace.

## Quand invoquer

- Dossier `DRAFT_ONLY` complet : brief, script, claims, evidence, disclaimer, approval record
- Après rendu, pour G4 (durée mesurée) et G6 (relevé des visuels)
- Après correction d'un FAIL

## Entrées : du dossier aux champs du code

`runAllGates` reçoit un `VideoGateInput` (`video-gates.service.ts:534-552`). Lecture d'un dossier
`fafa-media-factory/scripts/<statut>/<video_id>/` :

| Entrée du code | Lue dans |
|---|---|
| `brief` | `brief.json` |
| `claims` | `claims.json` → `claims` |
| `evidencePack` | `evidence.json` → `evidence` |
| `disclaimerPlan` | `disclaimer.json` |
| `approvalRecord` | `approval.json` |
| `scriptText` | `script.json` : chaque texte dit ou affiché, un par ligne (dans le pilote : `hook`, `hook_variants`, `script_voice`, `problem_text`, `compatibility_factors`, `screen_text`, `advice`, `cta`, `disclaimer`) ; ni `notes` ni métadonnées |
| `actualDurationSec` | durée mesurée par ffprobe, consignée dans `fafa-media-factory/manifests/renders/<video_id>.json` (`visualControls.technicalChecks`) ; seulement après rendu |
| `visualRoleViolations` | relevé du relecteur sur les visuels du rendu (`render-payload.json` et la vidéo) : chaque visuel utilisé comme preuve, au format `{assetKey, visualType, usedAs}` |
| `similarityScore` | aucun producteur au 22/10 |

Règle de lecture :

- G1 et G2 : verdicts de `claimGates` dans la sortie de `node scripts/marketing/fafa-pilot-governance.cjs <dossier>` (racine du
  monorepo ; lecture seule, sans base, fournisseur ni écriture ; hors connexion WIKI par défaut, `--wiki-authority` relevant de la
  configuration de l'opérateur, `fafa-media-factory/README.md`). Ce validateur (#1830) contrôle le dossier contre les schémas de
  `fafa-media-factory/governance/`, ne garde que les preuves admissibles (`SupportingEvidence` de `evidence-pack.schema.json`,
  extrait catalogue vérifié par empreinte, référence WIKI admise), puis appelle `runClaimGates` (`video-gates.service.ts:171-176`)
  avec sa correspondance des champs du dossier vers ceux du code (`scripts/marketing/fafa-pilot-governance.cjs:193-205`) :
  `claim_id` → `id`, `source_status` → `status`, première preuve admissible de `evidence_refs` → `evidenceId`,
  `human_validated_by` → `validatedBy` si `human_validated`, `sequence_index` → `sectionKey`, `sourceRef` toujours nul. Le skill
  recopie ces deux verdicts, avec `readiness` et `wikiAdmission`, sans les recalculer. Sortie 0 : `CLAIMS_ONLY`, qui ne valide ni
  le rendu ni les autres gates ; sortie 2 : `NOT_READY`, par une gate FAIL ou une preuve WIKI dont l'admission n'est pas résolue
  (`reason` recopié) ; sortie 1 : erreur recopiée, G1 et G2 UNKNOWN.
- G3 à G7 : champs lus sous les noms du code (`backend/src/modules/media-factory/types/video.types.ts:38-135`). Un nom absent vaut
  absent, comme dans le code : un `brief` sans `type` n'a aucune plage de durée. Les étapes d'approbation sont celles que le code
  dérive des trois approbations du dossier (`approvalStagesOf`, `video-gates.service.ts`).
- Seule correspondance de valeurs admise pour ces gates : `brief.mode` `SOCLE`, `SHORT` ou `GAMME` lu en minuscules, valeurs de
  `VideoMode` (`video-quality.constants.ts:18`). Le rapport la mentionne. Aucune autre traduction : les écarts de champs entre
  `fafa-media-factory/governance/*.schema.json` et les types du code sont relevés dans le dossier marketing (`README.md`, lot L11)
  et se corrigent là.

## Étape 1 — Artefacts

Comme `checkArtefacts` (`video-gates.service.ts:140-167`), avant toute gate : `brief` présent ; `claims` tableau non vide ;
`evidencePack` tableau, vide accepté ; `disclaimerPlan.disclaimers` tableau ; `approvalRecord` lisible par `approvalStagesOf` :
les trois approbations du schéma (`approval`) ou un tableau `stages` (forme de `__video_productions`), pas les deux. Le
validateur rend ce contrôle dans `artefactCheck`, avec les noms du code.

S'il manque un artefact, s'arrêter sur `MISSING_ARTEFACTS` avec la liste (`video_brief`, `claim_table`, `evidence_pack`,
`disclaimer_plan`, `approval_record`), sans évaluer G3 à G7, comme les deux appelants du code
(`backend/src/modules/media-factory/controllers/video-gate-check.controller.ts:36-48`,
`backend/src/workers/processors/video-execution.processor.ts:163-198`). G1 et G2 restent ceux du validateur : le rapport les
donne avec l'arrêt. Le pilote `fafa-plaquettes-frein-001` passe cette étape (`artefactCheck.canProceed` vrai) ; le validateur
y rend G1 FAIL (4 claims non soutenus) et G2 WARN, sortie 2 (`NOT_READY`). Les écarts de champs vus au passage se signalent à
titre d'information, sans verdict de gate.

## Étape 2 — Les 7 gates

Verdict du code, gate par gate, seuils cités par leur clé de `VIDEO_GATE_THRESHOLDS` (`video-quality.constants.ts:68-81`).
`thresholdVerdict` (`video-gates.service.ts:462-472`) rend FAIL si la mesure atteint le seuil fail, WARN si elle est non nulle et
atteint le seuil warn, PASS sinon : une mesure nulle n'est jamais un WARN. G1 et G2 sont recopiés du validateur (règle de lecture) ; leurs sections disent ce que le code y compte.

Le skill n'ajoute qu'un nom au code : **UNKNOWN**, pour le WARN que le code rend à `measured` nul faute d'entrée (`notMeasured`,
l.483-492), avec le drapeau `NOT_MEASURED:<gate>`. Une entrée présente mais invalide rend FAIL à `measured` nul
(`invalidMeasure`, l.494-503) : le skill recopie ce FAIL.
UNKNOWN n'est pas un PASS : tant qu'une mesure manque, `canPublish` reste faux, même avec une publication finale approuvée.

| Gate (nom du code) | Mesure | Seuils (clé) | Verdict du code | UNKNOWN si |
|---|---|---|---|---|
| G1 `truth` | claims factuels non soutenus | `truth_attribution` : warn 1, fail 1 | ≥ 1 → FAIL ; table vide → FAIL (et arrêt à l'étape 1) | sortie 1 du validateur |
| G2 `safety` | claims `procedure` / `safety` sans `validatedBy` | `safety_unvalidated` : warn 0, fail 1 | 0 → PASS ; ≥ 1 → FAIL | sortie 1 du validateur |
| G3 `brand` | motifs interdits par ligne + appel à l'action | `brand_violations` : warn 1, fail 3 | 0 PASS ; 1-2 WARN ; ≥ 3 FAIL | pas de `scriptText` |
| G4 `platform` | écart à la plage de durée | `platform_duration_tolerance` : 0.1 | PASS dans la plage ; FAIL hors plage, durée nulle ou invalide, `brief.type` sans plage | pas de durée mesurée ou pas de `brief` |
| G5 `reuse_risk` | `similarityScore` | `reuse_similarity` : warn 0.5, fail 0.7 | selon le score ; FAIL hors de 0 à 1 | pas de score, soit toujours au 22/10 |
| G6 `visual_role` | visuels utilisés comme preuve | `visual_role_violations` : warn 0, fail 1 | 0 → PASS ; ≥ 1 → FAIL ; relevé qui n'est pas une liste → FAIL | pas de relevé des visuels |
| G7 `final_qa` | artefacts manquants + approbation `script_text` | — (PASS à 0, FAIL sinon) | PASS ou FAIL | — |

### G1 `truth` (`video-gates.service.ts:178-217`)

- Ne compte que les claims hors `procedure` et `safety`, qui relèvent de G2.
- Non soutenu : `status` différent de `verified`, ou ni `sourceRef` non vide ni `evidenceId` présent parmi les `docId` de
  `evidencePack`. Le validateur passe `sourceRef` nul : seule une preuve admissible soutient un claim.
- `trigger_items` : `claim:<id>`, soit le `claim_id` du dossier.

### G2 `safety` (l.221-247)

- Claims `procedure` ou `safety` sans `validatedBy` non vide ; le code ne lit ni `requiresHumanValidation` ni `validatedAt`.
- À 0, le code rend PASS : seul un claim non validé compte (test « passes when there are no safety claims »,
  `backend/tests/unit/video-gates.service.test.ts:446-452`).
- `trigger_items` : `claim:<sectionKey>`, car le code localise par `sectionKey`, pas par `id` ; le validateur y met le
  `sequence_index` du claim, vide sans lui.

### G3 `brand` (l.251-299)

- Mode : `brief.mode`, `socle` par défaut. `FORBIDDEN_PATTERNS_SHORT` en mode `short`, `FORBIDDEN_PATTERNS_SOCLE` sinon
  (`video-quality.constants.ts:227-246`), testés ligne par ligne : chaque couple motif-ligne qui correspond compte une violation.
- Une violation de plus si le texte contient `cliquez`, `inscrivez`, `abonnez` ou `téléchargez` : aucun mode n'autorise l'appel à
  l'action (`MODE_CONSTRAINTS`, l.109-134).
- Au 22/10, `FORBIDDEN_PATTERNS_SHORT` ne reconnaît ni « Dépêchez-vous » (motif `depêchez`, l.243) ni « Dernière chance » (motif
  `dernier(e|s)?`, l.245) : le rapport compte ce que le code compte et signale ces formes à part, hors mesure.
- Sans `scriptText` : UNKNOWN (le code rend WARN non mesuré, « No script text to check », `video-gates.service.ts:255-257`).
- `trigger_items` : `line:<n>` du `scriptText` construit, suivi du champ de `script.json` d'où vient la ligne ; `script` pour
  l'appel à l'action (l.284-287).

### G4 `platform` (l.303-351)

- Plage `VIDEO_DURATION_RANGES[brief.type]` (`film_socle` 420-540 s, `film_gamme` 180-360 s, `short` 15-60 s ;
  `video-quality.constants.ts:87-94`), élargie de 10 % de chaque côté. Dans la plage : PASS, mesure 0 ; hors plage : FAIL, mesure
  = écart relatif.
- Durée mesurée sur le rendu, jamais `duration_estimate_sec` ni `target_duration_sec`.
- UNKNOWN sans durée mesurée ou sans `brief` (le code rend WARN non mesuré, « No duration data », l.307-309).
- Avec une durée, FAIL si elle n'est pas un nombre fini positif, si elle vaut 0, ou si `brief.type` (`VideoType`) ne désigne
  aucune plage (« Unknown video type », l.311-324). `governance/video-brief.schema.json` ne porte pas ce champ au 22/10 : un
  dossier rendu y échoue tant que l'écart de champs du lot L11 n'est pas réglé.

### G5 `reuse_risk` (l.355-385)

- Le code ne lit que `similarityScore` : absent, WARN non mesuré (l.359-366) ; hors de 0 à 1, FAIL (l.367-374). Aucun
  producteur de ce score au 22/10, ni dans le code ni dans ce workspace : UNKNOWN, jamais un score estimé par le relecteur.
- La signature « inspiré du pattern X » d'un brief dérivé n'est contrôlée par aucune gate (`fafa-media-factory/inspiration/README.md`) :
  la signaler à part si elle manque.

### G6 `visual_role` (l.389-427)

- Compte les entrées de `visualRoleViolations` : visuels utilisés comme preuve, rôle attendu `illustration`. Types de visuels :
  `VisualType` (`video-quality.constants.ts:32-38`) ; seul `photo_reelle` exige une validation pour servir de preuve
  (`VISUAL_REQUIRES_VALIDATION`, l.219-221).
- Sans relevé : UNKNOWN (le code rend WARN non mesuré, « No visual role check recorded », l.393-400). Relevé qui n'est pas une
  liste : FAIL (l.401-408). Relevé vide : PASS, « All visuals used as illustration (correct) » (l.418-419).
- `trigger_items` : `assetKey`.

### G7 `final_qa` (l.431-458)

- Reprend les manques de l'étape 1, plus `script_text_approval` si aucune étape `script_text` n'est `approved` ; pour un
  dossier, `script_text` vient de `content_approved` avec son auteur. PASS sans manque, FAIL sinon. Après une étape 1 réussie,
  seul `script_text_approval` peut manquer.
- Approuver le contenu (`content_approved`) est une décision humaine consignée : le skill ne la pose pas.

## Étape 3 — Verdict d'ensemble et rapport

- `verdict_overall` : `MISSING_ARTEFACTS` si l'étape 1 a échoué ; sinon FAIL si une gate est FAIL, puis UNKNOWN, puis WARN, puis
  PASS. Le code ne rend que `canPublish`, faux si une gate est FAIL, si une mesure manque (`NOT_MEASURED`) ou si un WARN mesuré
  n'a pas d'étape `final_publish` approuvée et signée (`REVIEW_REQUIRED`, l.103-127). Même vrai, ce n'est pas une approbation.
- Le rapport va à l'owner. Dans `approval.json`, le skill ajoute au plus une entrée `history` (`timestamp` date-time, `actor`
  `skill:fafa-brand-safety-reviewer`, `action` `gates_evaluated`, `comment` de 500 caractères au plus : verdict d'ensemble, gates
  UNKNOWN, manques) sans modifier les entrées précédentes. Il ne remplace `gate_results` que si les 7 gates ont un verdict du code,
  au format `GateResult` sans `code_name` : le schéma n'admet ni UNKNOWN, ni `measured` nul, ni champ supplémentaire
  (`governance/approval-record.schema.json:111-149`, entrée `history` l.151-154).
- Il ne touche à aucun drapeau (`content_approved`, `render_approved`, `publish_approved`) ni au manifeste de rendu. Le passage à
  `scripts/review-ready/` (statut 5, `fafa-media-factory/scripts/README.md`) est un changement de fichiers revu, proposé quand
  aucune gate n'est FAIL ; les gates UNKNOWN y restent listées pour la relecture de l'owner.

Relecture de style du `script_voice` (facultative, distincte des 7 gates) : suivre `.claude/prompts/_shared/editorial-review.md` (racine monorepo ; depuis ce workspace : `../../.claude/prompts/_shared/editorial-review.md`). Elle rend une proposition sans modifier le script, ne change aucune mesure ni aucun seuil de gate, et la version retenue repasse les 7 gates.

## Hors gates : interdits de la persona

`fafa-media-factory/personas/fafa.md:26-34` (§ Interdits absolus) liste des interdits que les motifs du code ne couvrent pas tous :
promesse absolue (« diagnostic certain », « réparation garantie »), urgence artificielle, Fafa présenté comme humain, concurrents
nommés, pièces d'occasion, imitation d'une personne réelle. Le skill les relit à part et les consigne dans `persona_findings`, sans
les compter dans la mesure de G3 ni changer un verdict.

## Sortie

Exemple sur une vidéo fictive, avant rendu. En cas d'arrêt à l'étape 1 : `verdict_overall` `MISSING_ARTEFACTS`, `artefacts.missing`
renseigné et `gate_results` réduit à G1 et G2 du validateur.

```json
{
  "skill": "fafa-brand-safety-reviewer",
  "video_id": "fafa-exemple-001",
  "code_ref": "SHA de main relu",
  "claim_gates": { "source": "scripts/marketing/fafa-pilot-governance.cjs", "exit": 0, "readiness": "CLAIMS_ONLY", "wiki_admission": { "status": "NOT_REFERENCED", "unresolvedEvidenceIds": [], "blockingClaimIds": [], "reason": null } },
  "artefacts": { "can_proceed": true, "missing": [] },
  "reading_notes": ["brief.mode SHORT lu short"],
  "verdict_overall": "UNKNOWN",
  "gate_results": [
    { "gate": "G1", "code_name": "truth", "verdict": "PASS", "measured": 0, "warn_threshold": 1, "fail_threshold": 1, "strict": false, "details": "0 claim factuel non soutenu", "trigger_items": [] },
    { "gate": "G2", "code_name": "safety", "verdict": "PASS", "measured": 0, "warn_threshold": 0, "fail_threshold": 1, "strict": true, "details": "aucun claim procedure/safety", "trigger_items": [] },
    { "gate": "G3", "code_name": "brand", "verdict": "PASS", "measured": 0, "warn_threshold": 1, "fail_threshold": 3, "strict": false, "details": "motifs short, 6 lignes lues", "trigger_items": [] },
    { "gate": "G4", "code_name": "platform", "verdict": "UNKNOWN", "measured": null, "warn_threshold": 0, "fail_threshold": 0.1, "strict": false, "details": "pas de durée mesurée (vidéo non rendue)", "trigger_items": [] },
    { "gate": "G5", "code_name": "reuse_risk", "verdict": "UNKNOWN", "measured": null, "warn_threshold": 0.5, "fail_threshold": 0.7, "strict": false, "details": "aucun producteur de similarityScore", "trigger_items": [] },
    { "gate": "G6", "code_name": "visual_role", "verdict": "UNKNOWN", "measured": null, "warn_threshold": 0, "fail_threshold": 1, "strict": true, "details": "pas de relevé des visuels (vidéo non rendue)", "trigger_items": [] },
    { "gate": "G7", "code_name": "final_qa", "verdict": "PASS", "measured": 0, "warn_threshold": 0, "fail_threshold": 1, "strict": false, "details": "étape script_text approuvée", "trigger_items": [] }
  ],
  "persona_findings": [],
  "outside_measure": []
}
```

## Voir aussi

- `[[fafa-persona-canon]]`
- `[[fafa-script-generator]]`
- `[[creative-pattern-extractor]]`
- `backend/src/modules/media-factory/services/video-gates.service.ts`, `backend/src/config/video-quality.constants.ts`,
  `backend/tests/unit/video-gates.service.test.ts`
- `scripts/marketing/fafa-pilot-governance.cjs` et `scripts/marketing/fafa-pilot-governance.test.cjs` : validateur du dossier,
  source de G1 et G2 (#1830)
- `workspaces/marketing/fafa-media-factory/governance/approval-record.schema.json`
- `.spec/00-canon/video-governance-p0.md` (legacy, contexte)
- Règles vault `rules-fafa-persona-canon-v1.md` et `rules-video-disclaimer-safety.md` : introuvables au 22/10 (`main` du vault,
  `684e734`).


## D18/D19 — circuit humain en fichiers seuls

Choix opérationnel confirmé le 19/10/2026, détaillé dans `fafa-media-factory/scripts/README.md` : backend éteint ; contenu exact
approuvé humainement avant un rendu autorisé en `REVIEW_READY`. Après inspection technique et visionnage humain du MP4 exact,
les approbations distinctes du contenu et du rendu permettent `APPROVED`. La publication nécessite encore son approbation propre.
Les règles de lecture et de restitution des gates ci-dessus restent applicables ; aucun verdict du skill ne pose de drapeau.

Le nom de l'auteur d'une PR et les champs `*_approved_by` ne prouvent pas cet acte. La preuve humaine doit être reliée au commit,
à la révision et au SHA-256 du MP4 exacts ; le validateur local ne l'authentifie pas. Sans elle, conserver l'approbation manquante.
Si une entrée déterminante change, préparer une nouvelle révision et invalider les approbations via le flux de correction existant,
sans écraser l'historique. Ce choix ne transforme pas un contrôle technique en approbation humaine.
