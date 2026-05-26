# Phase 2A schema hardening — backlog différé

> **Status** : `Phase 2A eligibility = CONFIRMED ; activation = OWNER-GATED`
> **Source** : review PR #765 silent-failure-hunter agent (2026-05-26) — 8 gaps schema validés empiriquement via ajv-cli
> **Owner decision** : 2026-05-27 — ne pas auto-activer Phase 2A complète, créer queue claire, attendre signal répétitif owner pour activation
> **Doctrine canon** : ADR-082 + `feedback_pilot_fix_loop_not_documentation` v15.4 — micro-ajouts prouvés, jamais en bloc

## Pourquoi cette queue existe

La review auto de PR #765 a détecté que le JSON Schema canonique (`.spec/00-canon/improvement-report.schema.json`) accepte des verdicts auto-contradictoires :

- `status: PASS` avec zéro evidence valide
- `status: OPERATIONAL_READY` avec `non_regression_9_v10` tous booleans `false` valide
- 3 statuts (`PASS`, `FIX_AND_RETEST`, `STOP_TOO_COMPLEX`) sans aucune `allOf` rule
- `evidence_after: []`, `next_action: ""`, `owner_actions: []` passent silencieusement

C'est-à-dire : la rhétorique de la doctrine ("preuve obligatoire", "no documentation as proof") est plus stricte que l'enforcement du schema. La Phase 2A vise à combler cet écart sans activer Phase 2 complète.

**Garde-fou v15.4** : « Phase 2 n'est pas tout ou rien. Phase 2 doit être découpée en micro-ajouts prouvés. » Activer ces 8 items en bloc = violation. Owner active item par item sur preuve d'usage.

## 8 items queue (ordre de criticité décroissante)

| # | Item | Effort | Criticité | Référence finding |
|---|---|---|---|---|
| 1 | Add `allOf` rule for `PASS` : require `evidence_after.minItems≥1` + `proof_minimal_v7` + `change.minLength≥20` | LOW | CRITICAL | C1 silent-failure-hunter |
| 2 | Add `const: true` constraint on each `non_regression_9_v10` boolean inside `OPERATIONAL_READY`/`SCALE_READY` then-clauses | LOW | CRITICAL | C2 silent-failure-hunter |
| 3 | Add `allOf` rules for the 3 uncovered statuses : `PASS`, `FIX_AND_RETEST` (require `failure_map.minItems≥1` + `next_action`), `STOP_TOO_COMPLEX` (require `filter_6_questions_v12`) | MEDIUM | CRITICAL | C3 silent-failure-hunter |
| 4 | Enforce `status == decision` OR drop `decision` field (current : 2 fields can diverge silently) | LOW | IMPORTANT | I1 silent-failure-hunter |
| 5 | Add `evidence_after.minItems: 1` + `evidence_before.minItems: 1` in `OPERATIONAL_READY`/`SCALE_READY` then-clauses ; `next_action.minLength: 20` in `PARTIAL_READY` then-clause | LOW | IMPORTANT | I4 + I5 silent-failure-hunter |
| 6 | Add `owner_actions.minItems: 1` in `BLOCKED_OWNER` then-clause | LOW | IMPORTANT | S5 silent-failure-hunter |
| 7 | Add `evidence` values enum (`passed|failed|partial|skipped|missing`) + require `evidence_skip_rationale` map when any value = `skipped` | MEDIUM | SUGGESTION | S7 silent-failure-hunter |
| 8 | Add `not_applicable` value to non-regression booleans + require `non_regression_rationale` map when any check = `not_applicable` | MEDIUM | SUGGESTION | I3 silent-failure-hunter |

## Items non inclus (intentionally deferred)

- **Phase 2B references/checklist.md** — éligible seulement si SKILL.md sature context budget
- **Phase 2C workflow improvement-gate.yml** — éligible après ≥1 PR réelle utilisant Improvement Gate
- **Phase 2D vault policy séparée** — éligible seulement si ADR insuffisante
- **Phase 3 ratchet bloquant** — 5 critères cumulatifs non atteints (1 PR < 3-5 requis)
- I2 dangling `owner_action_id` cross-ref validator → script séparé, pas schema rule (Phase 2C territory)
- I7 trivial-PR escape clause structural definition → PR template improvement, pas schema (Phase 2C territory)
- S1-S3-S4-S6 → suggestions polish, defer until Phase 2A items 1-3 prouvent leur valeur

## Conditions d'activation par item

Pour activer 1 item de la queue :

1. **Preuve d'usage** : ≥1 cas réel où l'absence de la règle a permis un verdict.json incoherent en pratique (pas en théorie)
2. **Test local** : ajv-cli valide schema modifié + tous verdict.json existants restent valid
3. **Anti-régression** : 0 verdict.json historique cassé par la nouvelle règle (sinon → migration plan séparé)
4. **Owner GO explicite** : pas auto-activation, pas batch — un item à la fois
5. **Improvement Gate manuel** sur la PR qui active l'item (self-meta)

## Rappel doctrine

> *« Phase 2 doit être découpée en micro-ajouts prouvés. Chaque sous-phase 2A/2B/2C/2D s'active indépendamment, sur preuve d'usage répété. Anti-pattern : activer 2A+2B+2C+2D en bloc parce que "Phase 2 GO". »* (v15.4)

> *« Une review qui trouve des gaps n'oblige pas à activer une nouvelle couche. Elle oblige à classifier : ce qui est fixable maintenant, ce qui relève d'une décision owner, et ce qui devient backlog Phase 2A. »* (owner 2026-05-27)

## Prochaine review trigger

Re-review schema gaps si :
- N=5 verdict.json incoherent passe ajv → forcing function pour items 1-3
- 1 verdict.json incoherent merge en production → STOP_TOO_COMPLEX, escalate immédiat

Sinon : queue dormante, owner décide quand activer.

---

🤖 Generated by Claude Opus 4.7 — review PR #765 silent-failure-hunter agent finding aggregation — 2026-05-27
