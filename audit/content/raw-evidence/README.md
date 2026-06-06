# RAW evidence inventory — `audit/content/raw-evidence/`

Read-only, deterministic diagnostic answering **« le RAW a-t-il le droit de devenir un
wiki/une page ? »** for a gamme subject. It measures per-block **coverage** + **provenance**
of `automecanik-raw/recycled/rag-knowledge/` and emits an evidence artefact. It is the
diagnostic step immediately **upstream** of `scripts/wiki-generators/promote-raw-gammes-to-wiki.py`.

> **Read-only & advisory.** No fact extraction, no LLM, no generation, no DB/wiki/RAG write,
> no URL/canonical/redirect, no publication. The only files written live under this folder.
> Builder + schema live in [`scripts/wiki-generators/`](../../../scripts/wiki-generators/).

## Run

```bash
npx tsx scripts/wiki-generators/raw-evidence-inventory.ts filtre-a-air        # human-readable
npx tsx scripts/wiki-generators/raw-evidence-inventory.ts filtre-a-air --json # machine output (also writes the artefact)
npx tsx scripts/wiki-generators/raw-evidence-inventory.ts --all               # every gamme subject
npx tsx scripts/wiki-generators/raw-evidence-inventory.ts --emit-schema       # regenerate the JSON Schema projection
npx tsx scripts/wiki-generators/raw-evidence-inventory.ts --check             # fail if the committed schema drifted from Zod
npx tsx --test scripts/wiki-generators/__tests__/raw-evidence-inventory.test.ts
```

Source root is `${AUTOMECANIK_RAW_PATH:-/opt/automecanik/automecanik-raw}`.

## Contract

`raw-evidence.schema.ts` (Zod) is the **single source of truth**; `raw-evidence.schema.json`
is a **generated projection — never edit it by hand** (regenerate with `--emit-schema`,
`--check` enforces no drift). Output is **deterministic + idempotent** (sorted keys via the
shared `writeDeterministicJson`, `content_hash` = sha256 of source bytes, **no builder timestamp**).

- `coverage[]` — v4 canon blocks **A.domain / B.selection / C.diagnostic / D.maintenance /
  E.installation** (`PRESENT` / `PARTIAL` / `MISSING`, WARN-gaps in `warnings[]`), plus the
  `schema_version 5.0` superset blocks recensés as `NOT_MAPPED` (never silently dropped), plus
  `compatibility` = `BLOCKED_CATALOG_REQUIRED` (catalogue/DB only, never a RAW blocker).
- `provenance.sources[]` — gamme `.md` + `_raw/evidence/<slug>.yml` (slug-equal) + an explicitly
  mapped guide (`GUIDE_MAP`; guides carry no `pg_id` link, so they are never slug-guessed).
- `next_action` — `SOURCE_FIRST` (no RAW) · `FIX_RAW_FRONTMATTER` (parse error) ·
  `ENRICH_RAW_<BLOCK>` (a block incomplete, deterministic priority) · `PROMOTE_RAW_TO_WIKI`
  (all A–E present). **Owner-gated** — this tool never runs the next step.

## Role-fold annotation (`fold_readiness` / `fold_status`)

`fold_readiness` separates **« RAW coverage OK »** from **« fold R4/R6→R3 authorised in prod »** :

- `R5_to_R3 = READY_ADR_027` — R5 already folded into R3 (`S2_DIAG #diagnostic-rapide`, ADR-027, live).
- `R4_to_R3 = BLOCKED_PENDING_ADR`, `R6_to_R3 = BLOCKED_PENDING_ADR` — the owner-desired R4/R6→R3
  fold is **not canon**; it requires a vault ADR extending ADR-027 + role-matrix v6 + redirect RPCs.
  The `r3_section` field is a **forward-compatible annotation only** — it authorises nothing.

## Downstream (deferred, not in this PR)

The intended next step is to wire this as an **upstream `raw` dimension** of
[`scripts/seo/seo-readiness.ts`](../../../scripts/seo/seo-readiness.ts) (so its worst-case
`NEXT_ACTION` stops presuming the RAW is ready). That wiring, fact/claim extraction, and the
R4/R6→R3 runtime fold all remain **owner-gated follow-ups**.
