---
name: canon-write-review
description: Pre-canon review of DB writes to __seo_*, __rag_*, __pieces_*, __diag_*, __blog_* tables. Zero-LLM (deterministic checks). Returns canonical Verdict JSON.
---

# canon-write-review

Use when an advisor agent picks up a `pre_canon_review` approval with `payload.scope == "canon_db_write"`.

## Inputs
- `payload`: full approval payload as documented in spec § 3.4.

## Outputs
- `Verdict` object (see `scripts/advisor/verdict_schema.py`) — serialise as JSON in the approval comment body.

## Checks (each maps to one finding axis)
1. **Table prefix** — must start with `__seo_`, `__rag_`, `__pieces_`, `__diag_`, `__blog_`. Else BLOCK.
2. **Op** — must be `insert | update | delete`. Else BLOCK.
3. **sql_or_rpc** — non-empty. Else BLOCK (evidence=0).
4. **rollback_plan** — non-empty. Else BLOCK (reversibility=0).
5. **DELETE rule** — DELETE op always requires non-empty rollback_plan, no exceptions.
6. **Batch threshold** — `row_count > 1000` requires `body.batch_flag = true`. Else REVISE.
7. **Traceability** — `context` must have at least one of `task_id`, `issue_id`, `session_id`. Else REVISE.

## Mapping to recommendation
Delegated to `verdict_schema.map_recommendation(verdict, axes, findings)`.

## Implementation
`scripts/advisor/canon_write_review.py::review_canon_write(payload) → Verdict`

## Tests
`tests/advisor/test_canon_write_review.py`
