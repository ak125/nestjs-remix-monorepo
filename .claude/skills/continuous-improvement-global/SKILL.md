---
name: continuous-improvement-global
description: Use as the priority operational filter for AutoMecanik PRs, audits, scripts, pipelines, owner-actions and code changes. It checks whether the action improves a real measured problem with evidence, controlled risk, tests, and a clear next action. Non-blocking by default; proportional to risk. Triggers — "review PR", "audit this change", "validate before merge", "should I add this layer", "this looks ready", "ready to ship", "ouvrir une PR", or any request that touches code/archi/DB/contenu/SEO/conversion/pipeline.
type: technique
status: active
owners: ['@ak125']
domain: D15
runtime_class: read-only
llm_safe: true
last_verified: '2026-05-28'
---

# Skill : continuous-improvement-global

## Purpose

This skill is the priority operational filter for AutoMecanik decisions.

- It does not create a governance layer.
- It does not block automatically.
- It helps decide whether an action is useful, measured, safe, and actionable.

## Use when

Use for:

- PR review
- Audit review
- Pipeline decision
- Owner action
- Code change
- SEO / content / conversion change
- CI / config change
- Runtime or production decision

Apply implicitly when the user signals an implicit decision point ("est-ce que je peux merger ?", "ça a l'air prêt", "j'ajoute X ?") — these are improvement-check moments even without the word "validate".

## Default output : Improvement Check

For normal changes, use this lightweight format:

- **Problem:**
- **Evidence before:**
- **Expected gain:**
- **Risk:**
- **Test:**
- **Evidence after:**
- **Verdict:**
- **Next action:**

For trivial changes (typo, doc), fill only `Problem`, `Test`, `Verdict`, `Next action`.

For critical changes (payment, prod runtime, destructive migration, bulk SEO, RLS, auth), include stronger `Evidence before/after` and explicit rollback notes inside `Risk` and `Next action`.

## Verdicts

Use one of these simple verdicts:

| Verdict | When |
|---|---|
| `GO` | useful, measured, low risk, tests pass → proceed |
| `GO_WITH_WATCH` | proceed but monitor a specific signal post-merge |
| `FIX_AND_RETEST` | small correction needed, then re-run the check |
| `OWNER_DECISION` | non-trivial trade-off — owner must arbitrate before action |
| `STOP_LOW_VALUE` | gain marginal vs cost → backlog or drop |
| `STOP_TOO_COMPLEX` | cost / complexity > envelope → simplify scope or abandon |
| `ROLLBACK_REQUIRED` | regression detected → revert before continuing |

## Risk modes

The check scales with risk. Pick one mode per change:

| Mode | Surface | What to fill |
|---|---|---|
| **Lite** | doc, plan, audit, small reversible config | Problem, Test, Verdict, Next action |
| **Standard** | product feature, SEO, conversion, CI / workflow change | full 8 fields |
| **Full** | DB, auth, RLS, payment, production runtime, bulk SEO, destructive migration | full 8 fields + explicit rollback + owner GO when in doubt |

## Rules

- Prefer **action over documentation** — a small shipped fix beats a written plan.
- Prefer **extending existing mechanisms** over new layers (cf. anti-bricolage rules).
- **No new workflow** unless repeated manual use has proven value (≥3 real PRs).
- **No blocking gate** unless the owner explicitly promotes it.
- A failed pilot must create a **fix-and-retest loop**, not just a write-up.
- The `Next action` must be **concrete** (owner, file, command, or decision — not "to be defined").
- "Improvement" that breaks existing surface = `ROLLBACK_REQUIRED`, never silently pivot to another topic.

## Anti-patterns

- **Pivot to dodge a blocker** — if X fails, do not silently switch to Y to inflate the win rate.
- **Over-loop without convergence** — more than 3 cycles without a result ⇒ `OWNER_DECISION` or `STOP_TOO_COMPLEX`.
- **Scale before a working pilot** — bulk / mass-automation / ratchet CI / large SEO publication require ≥1 proven pilot.
- **Adding a layer when a simpler path exists** — re-read the rules above; extension > creation.

## Notes

- This skill is intentionally short.
- Historical schema `.spec/00-canon/improvement-report.schema.json` is kept for prior `audit/*.verdict.json` files; it is not required for new Improvement Checks.
- PR template `.github/PULL_REQUEST_TEMPLATE.md` exposes the same lightweight `Improvement Check` block.
