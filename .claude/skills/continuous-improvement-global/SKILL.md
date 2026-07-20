---
name: continuous-improvement-global
description: Use when reviewing any AutoMecanik PR, audit, script, pipeline, owner-action or code change as the priority operational filter — checks whether the action improves a real measured problem with evidence, controlled risk, tests, and a clear next action. Non-blocking by default; proportional to risk. Triggers — "review PR", "audit this change", "validate before merge", "should I add this layer", "this looks ready", "ready to ship", "ouvrir une PR", or any request that touches code/archi/DB/contenu/SEO/conversion/pipeline. Advisory only, never default-blocking (ADR-082, amendment Voie 3).
type: technique
status: stable
owners: ['@ak125']
domain: D15
runtime_class: read-only
llm_safe: true
last_verified: '2026-07-04'
---

# Skill : continuous-improvement-global

> **Advisory only, never default-blocking** — ce skill est un *filtre conseil*, jamais un gate
> bloquant automatique (ADR-082, amendement Voie 3). Toute promotion en gate bloquant = décision
> owner explicite + amendement vault séparé.

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

## Post-fix simplification closeout

When this skill is already in use and the fix has passed its `Test`, run one final advisory,
read-only closeout before handoff :

- What new mechanism did the fix add ?
- Could an existing mechanism absorb or replace it ?
- What old workaround, path, flag, scanner, resolver, projection, or dependency became obsolete ?
- Did the change create a second representation of the same concept or an accidental source of truth ?
- What can now be deleted, reused, merged, or explicitly kept ?

Keep the output compact :

    Post-fix simplification
    DELETE     — <candidate or none>
    REUSE      — <candidate or none>
    MERGE      — <candidate or none>
    KEEP       — <item + real boundary / compatibility reason>
    SOT IMPACT — NONE | GOVERNED_CHANGE (<authority>) | ACCIDENTAL_DUPLICATION

`ACCIDENTAL_DUPLICATION` is incompatible with `GO` or `GO_WITH_WATCH` : use the existing
`FIX_AND_RETEST` or `OWNER_DECISION` verdict according to scope and authority.

This closeout grants no mutation authority and is never a gate. Any accepted follow-up returns to
PATCH → VERIFY → this closeout again before handoff (a deletion can itself make something else
obsolete) and remains governed by the existing frozen scope, ownership, danger-zone, and autonomy
rules.

Simplicity never overrides correctness, business truth, security, validation, tests, observability,
architectural boundaries, ownership, reversibility, compatibility windows, or proofs.

## Notes

- This skill is intentionally short.
- Historical schema `.spec/00-canon/improvement-report.schema.json` is kept for prior `audit/*.verdict.json` files; it is not required for new Improvement Checks.
- PR template `.github/PULL_REQUEST_TEMPLATE.md` exposes the same lightweight `Improvement Check` block.
