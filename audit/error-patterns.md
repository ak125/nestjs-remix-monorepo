# Error Patterns — Registre dérivé `failure_map`

> **Statut : DIAGNOSTIC / non-canonique.**
> Ce fichier est un audit dérivé, pas une source de vérité.
> Doctrine canon : [vault ADR-082](https://github.com/ak125/governance-vault/blob/main/ledger/decisions/adr/ADR-082-global-continuous-improvement-doctrine.md).
> Schema de référence : [`.spec/00-canon/improvement-report.schema.json`](../.spec/00-canon/improvement-report.schema.json) (champ `failure_map` lignes 168-186).
> Skill de référence : [`.claude/skills/continuous-improvement-global/SKILL.md`](../.claude/skills/continuous-improvement-global/SKILL.md).

## Rôle

Recenser les `failure_map` qui se répètent dans ≥ 2 verdicts `improvement-report.json` indépendants. Objectif : transformer un signal récurrent en proposition (mémoire `feedback_*`, règle vault, test régressif). **Aucune mutation automatique** — chaque promotion est owner-reviewed.

## Procédure

1. À chaque nouveau verdict `audit/*.verdict.json` produit, examiner ses `failure_map`.
2. Si un `gate` ou `root_cause` réapparaît avec une entrée déjà inscrite ici → mettre à jour l'entrée existante (incrémenter `occurrences`, citer le nouveau verdict).
3. Si un nouveau `failure_map` n'apparaît qu'une seule fois → **ne pas l'inscrire ici**. Il vit dans son verdict source uniquement.
4. Quand une entrée atteint **≥ 3 occurrences** → owner décide : (a) écrire une mémoire `feedback_*`, (b) ouvrir un PR vault (rule ou ADR), (c) écrire un test de régression. Jamais d'auto-promotion.

## Statuts de promotion

- `OBSERVE` — pattern observé ≥ 2× mais pas encore promu. Action = surveiller.
- `PROPOSE_MEMORY` — atteint le seuil (≥ 3) ; mémoire `feedback_*` proposée à l'owner.
- `PROPOSE_RULE` — atteint le seuil ; PR vault (règle ou ADR) proposée à l'owner.
- `OWNER_REVIEWED` — owner a examiné, décision en attente.
- `PROMOTED` — converti en mémoire / règle / test ; entrée gardée ici comme trace historique.
- `RETIRED` — pattern obsolète (cause structurelle corrigée ailleurs).

## Anti-patterns interdits

- Inscrire ici un `failure_map` singleton (1 occurrence) — c'est du bruit.
- Promouvoir une entrée en mémoire/règle sans owner GO — viole CLAUDE.md `[CRITICAL]` "no silent fallback".
- Considérer ce fichier comme canon — il est dérivé, jamais autoritatif.
- Y écrire des prescriptions runtime, des hard-fails, ou des règles SEO/payment. Ces décisions vivent au vault.
- Incrémenter une occurrence sur la base d'un titre similaire sans confirmer que le `root_cause` ou le `gate` est sémantiquement identique.

## Registre

### EP-001 — Promotion canon wiki nécessite review humaine

- **Gate famille :** `wiki_canon_promotion`
- **Statut promotion :** `OBSERVE` (2 occurrences, < seuil 3)
- **Occurrences :**
  - [`audit/pilot-filtre-a-air-2026-05-26.verdict.json`](pilot-filtre-a-air-2026-05-26.verdict.json) `#FM-2` — `wiki/gamme/filtre-a-air.md absent — promotion proposals→wiki/ humain-only per CLAUDE.md wiki §Interdictions absolues + ADR-033 D4`
  - [`audit/session-2026-05-26-doctrine-batch.verdict.json`](session-2026-05-26-doctrine-batch.verdict.json) `#FM-1` — `Canon automecanik-wiki/CLAUDE.md exige validation humaine pour review_status: approved. Agent ne peut écrire reviewed_by: <email humain> (auto-mode classifier blocking correct).`
- **Action déjà gouvernée :** ADR-033 D4 (wiki) + règle wiki `§Interdictions absolues`. Le pattern récurrent **confirme** l'utilité de la règle existante, ne révèle pas un gap.
- **Owner gate si 3e occurrence :** ré-évaluer le carve-out risk-based plutôt que créer une nouvelle règle. Mémoire locale Claude de référence : `feedback_auto_review_read_only_no_auto_approval.md`.

### EP-002 — Capture sources externes S2/S3 OEM bloquée hors agent

- **Gate famille :** `sources_phaseX_capture`
- **Statut promotion :** `OBSERVE` (2 occurrences, < seuil 3)
- **Occurrences :**
  - [`audit/pilot-filtre-a-air-2026-05-26.verdict.json`](pilot-filtre-a-air-2026-05-26.verdict.json) `#FM-3` — `Sources oem_filter_maintenance_general + bosch_fad_2020 = Phase 7 différée (web-clip-template PR2 non livré), bloquent source_policy strict 1_high`
  - [`audit/session-2026-05-26-doctrine-batch.verdict.json`](session-2026-05-26-doctrine-batch.verdict.json) `#FM-3` — `capteur-abs Niveau C safety (family freinage). Sources S2 (Bosch/Continental ABS) + S3 (ECE R13-H) non capturées.`
- **Caractéristique commune :** Sources externes (OEM PDF, normes) non-accessibles via les agents (WAF, login, paywall). Capture humaine via Obsidian Web Clipper requise.
- **Non-actionnable côté agent.**
- **Owner gate si 3e occurrence :** envisager `web-clip-template PR2` ou un workflow capture batch outillé, **pas** un script de scraping (canon WIKI vs RAG). Mémoire locale Claude de référence : `feedback_scraping_vs_rag_bootstrap_terminology.md`.

### EP-003 — Publication SEO bloquée par signal/indexation amont (émergent)

- **Gate famille :** `page_r2_conversion` / `audit_indexation`
- **Statut promotion :** `OBSERVE` (sémantiquement proche mais `root_cause` distincts — à surveiller pour confirmer convergence)
- **Occurrences :**
  - [`audit/pilot-filtre-a-air-2026-05-26.verdict.json`](pilot-filtre-a-air-2026-05-26.verdict.json) `#FM-4` — `Page R2 /pieces/filtre-a-air-8/* LIVE avec 2063 imp / 0 clic sur top URL — signal intent SEO faible`
  - [`audit/session-2026-05-26-doctrine-batch.verdict.json`](session-2026-05-26-doctrine-batch.verdict.json) `#FM-2` — `Vrai INDEXATION_GAP confirmé empiriquement = 1 seul cas (alternateur 107k pieces / Reach~5). Audit indexation R7/R2 alternateur prérequis Phase 5 publication SEO.`
- **Caractéristique commune émergente :** signal de "publication SEO contrainte par un défaut amont" (intent faible OU indexation manquante). Les deux cas reportent la publication / scale jusqu'à correction du défaut amont.
- **Non-promu en RÉCURRENT** car root_causes distincts (intent vs indexation). Si une 3e occurrence en consolide la sémantique, repromouvoir.

## Singletons NON inscrits (justification)

Ces `failure_map` ne sont pas inscrits ici (1 occurrence, pas de récurrence). Ils restent dans leur verdict source uniquement.

| Source `#fm_id` | Raison non-inscription |
|---|---|
| pilot-filtre-a-air `#FM-1` (pg_id divergence DB) | Fixé, `auto_fixable=true`, ponctuel |
| pilot-memory `#FM-1` (MEMORY.md overflow T0) | Intra-verdict (FM-1+FM-2 même cycle), hors-champ inter-verdicts |
| pilot-memory `#FM-2` (MEMORY.md limite stricte T2) | Intra-verdict, hors-champ inter-verdicts |
| session-doctrine `#FM-4` (schema enum `auto_approved` gap) | Owner-gated, déjà tracké (`OWNER-OPTION-3-CANON`) |

## Historique

- 2026-05-28 — Création. Amorçage à partir de 10 `failure_map` / 3 verdicts existants (les 3 fichiers `audit/*.verdict.json` produits entre 2026-05-26 et 2026-05-27). EP-001 + EP-002 récurrents, EP-003 émergent, 4 singletons exclus.

## Liens

- [Skill `continuous-improvement-global`](../.claude/skills/continuous-improvement-global/SKILL.md)
- [Schema de référence `improvement-report.schema.json`](../.spec/00-canon/improvement-report.schema.json)
- [PR template `## Improvement Gate`](../.github/PULL_REQUEST_TEMPLATE.md)
- Mémoire locale Claude : `feedback_pilot_fix_loop_not_documentation.md` — canon ADR-082 v15.3 POINTER
- Mémoire locale Claude : `feedback_no_proof_no_pipeline_doctrine.md` — exit criteria ADR-082
