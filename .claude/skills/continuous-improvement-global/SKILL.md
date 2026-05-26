---
name: continuous-improvement-global
description: Use when validating any PR, pipeline, audit, script, code-change or owner-action for AutoMecanik continuous improvement compliance — produces a `## Improvement Gate` section in the PR and an `improvement-report.json` validated against `.spec/00-canon/improvement-report.schema.json` (JSON Schema 2020-12 Draft, 9 canon verdicts enum). Apply systematically before any merge, deploy, refactor, layer-addition, or owner validation — even when the user doesn't explicitly say "validate" or "improve". Triggers — "review PR", "audit this change", "validate before merge", "should I add this layer", "this looks ready", "ready to ship", "ouvrir une PR", or any request that touches code/archi/DB/contenu/SEO/conversion/pipeline. Doctrine canon = ADR-082 vault (Global Continuous Improvement Doctrine).
type: technique
status: stable
owners: ['@ak125']
domain: D15
runtime_class: read-only
llm_safe: true
last_verified: '2026-05-26'
---

# Skill : continuous-improvement-global

> **Filtre** opérationnel — pas un nouveau système. Doctrine canon = ADR-082 vault.
> Ce skill est court par design (cf v15.2 "doctrine = filtre léger, pas couche").

## Quand utiliser

Dès qu'un changement AutoMecanik est envisagé (PR, pipeline, audit, script, refacto, ajout de couche, validation). Aussi quand le résultat d'un audit doit aboutir à une décision GO / NO-GO.

**Ne pas attendre que l'utilisateur dise "validate"** — beaucoup de demandes ("est-ce que je peux merger ?", "ça a l'air prêt", "j'ajoute X ?") sont des points de décision implicites où ce filtre s'applique.

## Procédure — 7 étapes dans cet ordre

Pour chaque changement, produire **les 7 sorties suivantes** dans l'ordre. Si une étape ne peut pas être complétée honnêtement, c'est un signal — descendre le verdict (ex. PARTIAL_READY au lieu d'OPERATIONAL_READY) plutôt que d'inventer une réponse.

1. **Identifier l'écart mesuré** — état actuel vs état attendu, en 1 phrase + 1 preuve concrète (log, métrique, SQL, screenshot, commande). Pourquoi : sans écart mesuré, il n'y a pas d'amélioration à valider — juste une hypothèse.

2. **Classer la priorité (P1-P6)** — P1 Survie business (cash/paiement) > P2 Acquisition (SEO/ranking) > P3 Conversion (UX/panier) > P4 Stabilité (bugs/perf) > P5 Simplification (dette) > P6 Gouvernance (doc/confort). Pourquoi : un fix SEO qui ne vend rien est moins prioritaire qu'un blocker paiement, même si l'enthousiasme du moment dit le contraire.

3. **Vérifier anti-complexité (6 questions)** — peut-on **étendre** l'existant ? **simplifier** ? **fusionner** avec un mécanisme déjà présent ? **supprimer** une duplication ? **réduire** le nombre de scripts/fichiers ? obtenir le même résultat avec **moins de code** ? Si OUI à une seule question, **ne pas ajouter** une nouvelle couche — appliquer la voie qui simplifie. Pourquoi : la dette technique tue les projets plus vite que les bugs.

4. **Vérifier non-régression** — routes existantes / panier / paiement / SEO indexé / données / pipelines critiques / CI / build / performance / UX. 0 régression introduite. Pourquoi : une "amélioration" qui casse l'existant n'est pas une amélioration — c'est une régression masquée.

5. **Produire evidence before/after** — preuves concrètes, idéalement machine-readable (sortie commande, JSON, ligne de log, capture, query SQL avec résultat). AVANT et APRÈS sont tous les deux nécessaires. Pourquoi : sans before/after comparable, on ne sait pas si le changement a vraiment résolu quelque chose.

6. **Donner le verdict** — exactement un parmi 9 (alignés sur l'enum du JSON Schema canonique, source autoritative unique). Sémantique d'exécution v15.3 : un verdict < OPERATIONAL_READY n'est **pas un stop** — c'est un mode d'exécution prudent.

   | Verdict | Sémantique | Mode exécution | Autorisé | Bloqué |
   |---|---|---|---|---|
   | `PASS` | gates verts, livrable OK | STABLE | tout | — |
   | `FIX_AND_RETEST` | correction à faire mid-cycle | CONTINUE_LIMITED | retour fix-loop | scale, ratchet |
   | `PARTIAL_READY` | test isolé OK + humain-gated explicite | **CONTINUE_LIMITED** | PR, pilot, manual gate, observation, audit, correction | scale, ratchet, automatisation large, mutations irréversibles, promotion masse |
   | `OPERATIONAL_READY` | boucle contrôle complète + 6/6 preuves | STABLE | usage processus stable | scale large sans validation |
   | `SCALE_READY` | OPERATIONAL + observabilité prod + robustesse | SCALE | automatiser/généraliser/ratchet CI/CI bloquant | — |
   | `BLOCKED_OWNER` | décision humaine obligatoire | DIAGNOSTIC | observation, audit | toute action attendant la décision |
   | `STOP_LOW_VALUE` | gain marginal < coût | DIAGNOSTIC | reporter au backlog | itérer |
   | `STOP_TOO_COMPLEX` | coût/complexité > enveloppe | DIAGNOSTIC | simplifier scope ou abandonner | continuer comme avant |
   | `ROLLBACK_REQUIRED` | régression détectée | CONTINUE_LIMITED (rollback) | retour arrière | suite sans rollback |

   **Règle canon v15.3 :** *« PARTIAL_READY = avancer sans scaler. OPERATIONAL_READY = stabiliser. SCALE_READY = généraliser. »* Bloquer tout le système parce qu'un composant est PARTIAL_READY = mauvaise application doctrine.

   Pourquoi : un verdict binaire force la clarté. "À revoir" n'est pas un verdict — c'est une procrastination. Mais PARTIAL_READY n'est pas une procrastination — c'est un mode d'exécution prudent qui permet de continuer à apprendre sans casser.

7. **Donner la next action** — courte, concrète, owner-actionable si bloquant. Format suggéré : `[OWNER-X]` ou `[AUTO]` selon qui doit agir. Pourquoi : sans next action, la boucle s'arrête et le sujet pourrit dans le backlog.

## Output canonique : `improvement-report.json`

Sortie machine-readable obligatoire pour toute application de ce skill sur un sujet réel (pas pour une exploration informelle). Path conventionné : `audit/<sujet>-<date>.verdict.json` ou inline dans la PR description.

**Schema canonique (SoT unique)** : `.spec/00-canon/improvement-report.schema.json`

Tout output DOIT déclarer `"$schema": "improvement-report.schema.json"` pour validation auto via `ajv-cli` (Phase 2) + auto-completion VSCode.

Exemple minimal valide :

```json
{
  "$schema": "improvement-report.schema.json",
  "tested_entity": "filtre-a-air",
  "scope": "global",
  "axis": ["seo", "governance"],
  "regression_risk": "low",
  "anti_complexity_check": "passed",
  "owner_required": false,
  "status": "PASS",
  "decision": "PASS"
}
```

Validation locale (sans wrapper — wrapper Phase 2) :

```bash
npx --yes ajv-cli@5 validate --spec=draft2020 \
  -s /opt/automecanik/app/.spec/00-canon/improvement-report.schema.json \
  -d <path-to-output.json>
```

## Section PR : `## Improvement Gate`

Pour toute PR importante, ajouter cette section dans la description (copier depuis `.github/PULL_REQUEST_TEMPLATE.md`) :

```markdown
<!-- IMPROVEMENT_GATE_BEGIN -->
## Improvement Gate (canon ADR-082)
- Problème mesuré :
- Preuve avant :
- Axe amélioré : (≥ 1 parmi business/seo/ranking/content/conversion/code/architecture/performance/security/simplification/observability/governance)
- Priorité : P_
- Check anti-complexité : passed / simplification_applied / new_layer_justified / failed
- Check non-régression : (énumérer surfaces vérifiées)
- Tests run : (commandes exactes)
- Preuve après :
- Verdict : (un des 9)
- Next action :
<!-- IMPROVEMENT_GATE_END -->
```

Les marqueurs HTML permettent la validation automatique Phase 2 (GitHub Action `improvement-gate.yml` qui grep ces balises). En Phase 1 = section textuelle seule.

## SAFE intégré (dimension du score, pas couche séparée)

Le contrôle SAFE est **inclus dans le score d'amélioration et dans le filtre 6 questions** (étape 5 du filtre : « Est-ce sûr ? »). Il ne crée pas de nouvelle couche, de nouveau workflow, ou de nouvelle checklist lourde.

4 niveaux (champ `safe_level` du `improvement-report.json`) :

| Niveau | Sémantique | Preuve attendue |
|---|---|---|
| `SAFE_0` | aucun risque runtime (doc, plan, mémoire, audit) | aucune preuve runtime requise |
| `SAFE_1` | risque faible, réversible (proposal uncommitted, schema additif, edit `.md` Phase 1) | rollback path explicite (`git checkout`, `rm`) |
| `SAFE_2` | risque moyen, preuve ciblée nécessaire (skill modif, ratchet CI informationnel, migration additive) | non-régression 9/9 + test sur cas réel |
| `SAFE_3` | risque critique, owner decision si rollback/proof insuffisant (payment, prod runtime, migration destructive, bulk SEO) | rollback testé + preuve avant/après + owner GO explicite |

**Une action est ralentie SEULEMENT si** : surface critique touchée AND (risque de casse > gain OR rollback absent OR preuve non-régression insuffisante). Sinon SAFE reste un signal léger non-bloquant.

**Règle canon :** *« SAFE n'est pas un frein. SAFE est le calcul intelligent du risque dans le score d'amélioration. »*

## Filtre 6 questions : soft signal, pas hard gate (clarification v15.5 — owner decision 2026-05-27, review PR #765 finding C5)

> *« Les 6 questions filtre ne sont pas un blocage mécanique. Elles servent à classifier le risque et la valeur. Une action peut continuer avec des NO si la justification, le score, le SAFE level et le coût/gain restent acceptables. »*

Calibration :

| Pattern | Décision |
|---|---|
| 6/6 OUI + score HIGH_VALUE + SAFE_0/1 | go vert clair, PASS ou OPERATIONAL_READY si preuves |
| 4-5/6 OUI + score MEDIUM/HIGH + SAFE_1/2 | go prudent, PARTIAL_READY / CONTINUE_LIMITED |
| 2-3/6 OUI + score LOW + SAFE_2/3 | challenge fort, justification owner ou défer |
| 0-1/6 OUI ou score DANGEROUS_COMPLEXITY ou SAFE_3 sans preuve | STOP_LOW_VALUE / STOP_TOO_COMPLEX / BLOCKED_OWNER |

Le filtre n'est jamais un blocage automatique d'un seul NON. Il informe le verdict (étape 6 de la procédure), il ne le décide pas seul. Cf application empirique Pilot #2 (2 NOs `prioritaire`+`rapproche_business` mais score MEDIUM + SAFE_1 → PARTIAL_READY justifié).

## Anti-patterns à bloquer

- **Pivot pour éviter un blocker** — si filtre-a-air échoue, ne pas dire "essayons capteur-abs"
- **Sur-loop sans gain marginal** — > 3 cycles sans convergence ⇒ verdict `BLOCKED_OWNER` ou `STOP_TOO_COMPLEX`
- **Scale sans pilote `OPERATIONAL_READY`** — bulk, mass-automation, ratchet CI, publication SEO large, génération volume = interdits avant ≥1 pilote prouvé
- **"Improvement" qui casse l'existant** — verdict `ROLLBACK_REQUIRED`
- **Ajout de couche quand simplification possible** — relire les 6 questions anti-complexité
- **Isolation SEO seule** — le ranking est conséquence d'un système global sain, pas d'une machine SEO

## Référence canon

- **ADR-082 vault** `governance-vault/ledger/decisions/adr/ADR-082-global-continuous-improvement-doctrine.md` — loi complète (5 types d'amélioration / 11 effets valides / 6 questions filtre / hiérarchie P1-P6 / formule AVANT/ACTION/APRÈS / 9 critères non-régression / règle d'or "utile, mesurable, bornée — sinon dette")
- **JSON Schema** `.spec/00-canon/improvement-report.schema.json` — format machine canonique (Draft 2020-12, source autoritative pour l'enum 9 verdicts)
- **PR template** `.github/PULL_REQUEST_TEMPLATE.md` — section `## Improvement Gate` à remplir

Ce skill = procédure courte. ADR = loi. Schema = format machine. PR template = enforcement.

**Phase 1 v15.3+v15.4** : ce skill est livré seul (pas de `_scripts/` ni `references/`).

**Phase 2 v15.4 — découpée en micro-ajouts prouvés (owner-gated, jamais en bloc)** :
- **2A** : wrapper `validate-improvement-report.sh` (ajv-cli) — éligible si validation JSON Schema déjà répétée ≥2× manuellement
- **2B** : `references/checklist.md` (lazy-load) — éligible si SKILL.md sature context budget
- **2C** : GitHub Action `improvement-gate.yml` informationnel non-bloquant — éligible après ≥1 PR réelle utilisant Improvement Gate
- **2D conditionnel** : vault policy séparée — éligible si ADR jugée insuffisante

Phase 3 ratchet bloquant nécessite 5 critères cumulatifs (≥3-5 PRs + <10 min friction + 0 false blocker + ≥1 vraie erreur captée + owner GO).

**Phrase canon v15.4** : *« Deux pilots suffisent pour confirmer que la doctrine est non biaisée. Mais ils ne suffisent pas pour rendre le gate bloquant. On peut continuer à l'utiliser. On ne doit pas encore l'imposer. »*
