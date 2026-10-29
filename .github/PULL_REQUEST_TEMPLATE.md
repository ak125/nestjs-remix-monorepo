<!-- Template PR AutoMecanik — lightweight Improvement Check (see .claude/skills/continuous-improvement-global/SKILL.md). Non-blocking, proportional to risk. -->

## Summary

<!-- 1-3 lignes : que change cette PR et pourquoi -->

## Test plan

<!-- Checklist markdown : commandes/contrôles à exécuter pour valider la PR -->

- [ ]
- [ ]
- [ ]

## Changes

<!-- Liste courte des fichiers/modules touchés et leur rôle dans la PR -->

---

## Improvement Check

<!-- Lightweight operational filter (see .claude/skills/continuous-improvement-global/SKILL.md).
     For trivial changes (typo, doc) fill only: Problem, Test, Verdict, Next action.
     For critical changes (DB / auth / RLS / payment / prod runtime / bulk SEO / destructive migration)
     include stronger Evidence before/after and explicit rollback notes. -->

- **Problem:**
- **Evidence before:**
- **Expected gain:**
- **Risk:**
- **Test:**
- **Evidence after:**
- **Verdict:** <!-- GO / GO_WITH_WATCH / FIX_AND_RETEST / OWNER_DECISION / STOP_LOW_VALUE / STOP_TOO_COMPLEX / ROLLBACK_REQUIRED -->
- **Next action:**

---

## Runtime verification

<!-- Preuve MINCE que le changement a été exécuté et le comportement observé (pas seulement CI-vert).
     Router la surface du diff vers le vérificateur EXISTANT — voir .claude/knowledge/agent-method-patterns.md §9.
     SKIP uniquement si aucune surface runtime (doc / test-only). Surfaces critiques
     (paiement / prix / stock / panier / RLS / prod / SEO indexé) = owner gate + env sûr ou read-only.
     Un PASS pré-merge ou hors env-cible ne clôt PAS GATE 2 (vérif LIVE post-tag en env cible) —
     cf. mémoire feedback-runtime-verification-mandatory (matrice par type de changement). -->

- **Surface:** <!-- frontend / backend / seo / projection / edge / pipeline / commerce -->
- **Environment:** <!-- DEV:3000 · Docker isolé · read-only · PROD post-tag (env cible GATE 2) -->
- **Verdict:** <!-- PASS / FAIL / BLOCKED / SKIP (effet partiel = FAIL, jamais PASS) -->
- **Evidence:** <!-- lien : artefact Playwright, log smoke, trace curl/HTTP, capture -->
- **GATE 2 (post-merge, env cible) dû:** <!-- no · ou yes + env cible (ex. PROD après tag v*) -->
- **Owner gate required:** <!-- yes / no -->

---

## Definition of Done — auto-évaluation

<!-- Règle vault rules-engineering-definition-of-done ; lue par scripts/ci/pr-dod-gate.mjs.
     Une ligne par item, cochée [x] ou marquée N/A avec la raison. DoD2 est lu sur l'état GitHub
     (assignee + ≥ 1 approbation humaine), jamais sur la case. DoD1 : cocher après lecture de la CI. -->

- [ ] DoD1 — Tests verts: CI green, no flaky, no .only/.skip added
- [ ] DoD2 — Ownership: assignee + ≥1 human approval
- [ ] DoD3 — Rollback: <plan link>, reversibility=<instant/staged/forward-only>
- [ ] DoD4 — Observabilité: <log/metric/event log added or N/A>
- [ ] DoD5 — Drift zéro: registry-fresh green, migrations atomic
- [ ] DoD6 — Docs: <files updated or "no doc needed">
- [ ] DoD7 — Monitoring: watcher=@<user>, window=T+<duration>, abort=<criteria>
- [ ] DoD8 — No TODO unresolved: <count, all linked>
- [ ] DoD9 — No silent skip: confirmed

Work type (per planning-worktype.yml): <runtime-critical | governance | seo-runtime | observability | cleanup | migration | debt | experiment | emergency>

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
