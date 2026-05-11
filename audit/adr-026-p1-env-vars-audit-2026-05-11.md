---
type: audit
status: draft
generated: 2026-05-11
related_adr: [ADR-026, ADR-031]
related_vault_pr: [governance-vault#78, governance-vault#89]
verdict: SCOPE_SCANNED
---

# ADR-026 P1 — Env vars refacto audit (2026-05-11)

## Coverage manifest

- scope_requested: backend/ + frontend/ + scripts/ + shared/ + config files
- scope_actually_scanned:
  - backend/src/ (all .ts/.tsx files)
  - backend/.env.example
  - backend/tests/unit/
  - frontend/app/routes/
  - scripts/seo/ (all .py/.ts)
  - scripts/rag/ (all .py)
  - scripts/rag-sync/ (all .py/.sh)
  - scripts/cron/ (all .sh)
  - scripts/wiki/ (all .py/.ts)
  - scripts/wiki-generators/ (all .py)
  - scripts/wiki-exports/
  - scripts/raw-downloaders/
  - scripts/ops/ (all .sh)
  - docker-compose*.yml
  - Dockerfile, Dockerfile.worker
  - .github/workflows/
- files_read_count: ~85 (grep surface; exact count not tracked)
- excluded_paths:
  - node_modules/
  - dist/
  - .git/
  - backend/src/modules/ (read selectively via grep — not full tree read)
- unscanned_zones:
  - workspaces/seo-batch/ (SEO workspace CLAUDE.md scope separate — no env process.env refs expected, TBD)
  - agents/ (AGENTS.md files — no process.env refs per structure)
  - packages/ (@repo/database-types, @monorepo/shared-types — no path env vars expected)
  - secrets/ directory (excluded by design)
  - ssh/ directory (excluded)
  - ai-agents-python/ (not scanned — Python agent layer, may have additional RAG refs TBD)
- corrections_proposed: draft proposals only — JAMAIS appliquees auto
- validation_executed: none — this is a scan-only audit
- remaining_unknowns:
  - ai-agents-python/ RAG path usage (not scanned)
  - workspaces/seo-batch/ env usage (not scanned)
  - Whether `AUTOMECANIK_WIKI_PATH` / `AUTOMECANIK_RAG_PATH` / `AUTOMECANIK_RAW_PATH` appear in VPS provisioning playbooks outside this monorepo
  - Whether `docker-compose.dev.yml` or `docker-compose.worker.yml` need volume mounts added (not found in grep, TBD)
  - Exact count of scripts in `ai-agents-python/` that hardcode RAG paths
- final_status: SCOPE_SCANNED

---

## Critical divergence: ADR-026 superseded by ADR-031

> ⚠️ **ADR-026 is superseded by ADR-031** (merged 2026-04-28, per ADR-026 header commit `cd4702d`).
> ADR-031 renames `automecanik-content` → `automecanik-wiki` and extends to 4 layers.
>
> **Consequence for P1**: ADR-026 proposed env var `AUTOMECANIK_CONTENT_PATH` is **never introduced** in
> the codebase. The codebase instead uses `AUTOMECANIK_WIKI_PATH` (grep-validated, see below).
> This audit records the actual state and proposes a path forward based on grep evidence only.

---

## Existing patterns (grep evidence)

### ENV vars — confirmed in codebase

| Variable | Value/Default | Pattern | Files (representative) | In `.env.example` |
|---|---|---|---|---|
| `RAG_KNOWLEDGE_PATH` | `/opt/automecanik/rag/knowledge` | `process.env.RAG_KNOWLEDGE_PATH \|\| ...` | `backend/src/config/rag.config.ts`, `backend/src/modules/rag-knowledge-bootstrap/rag-knowledge-bootstrap.guard.ts`, `scripts/seo/build-keyword-clusters.ts`, `scripts/seo/batch-r6-keyword-plans.py` | ✅ YES |
| `AUTOMECANIK_RAG_PATH` | `/opt/automecanik/rag` | `os.getenv("AUTOMECANIK_RAG_PATH", ...)` / `${AUTOMECANIK_RAG_PATH:-...}` | `scripts/rag-sync/sync-wiki-exports-to-rag.py`, `scripts/cron/sync-rag-from-wiki.sh`, `scripts/wiki/wiki-readiness-check.py` | ❌ MISSING |
| `AUTOMECANIK_WIKI_PATH` | `/opt/automecanik/automecanik-wiki` | `os.getenv("AUTOMECANIK_WIKI_PATH", ...)` / `${AUTOMECANIK_WIKI_PATH:-...}` | `scripts/rag-sync/sync-wiki-exports-to-rag.py`, `scripts/cron/sync-rag-from-wiki.sh`, `scripts/wiki-generators/brand-fiche-generator.py`, `scripts/wiki-generators/gamme-from-web-corpus-generator.py`, `scripts/wiki/validate-gamme-diagnostic-relations.py`, `scripts/wiki/wiki-readiness-check.py` | ❌ MISSING |
| `AUTOMECANIK_RAW_PATH` | `/opt/automecanik/automecanik-raw` | `os.getenv("AUTOMECANIK_RAW_PATH", ...)` | `scripts/raw-downloaders/download-oem-corpus.py`, `scripts/raw-downloaders/download-brand-oem-corpus.py`, `scripts/wiki-generators/gamme-from-web-corpus-generator.py` | ❌ MISSING |
| `WIKI_REPO_PATH` | `/opt/automecanik/automecanik-wiki` | test mock only | `backend/src/config/diag-canon.schema.test.ts` | ❌ MISSING |
| `RAG_ENABLED` | `'true'` / falsy | `process.env.RAG_ENABLED === 'true'` | `backend/src/app.module.ts`, `backend/src/modules/diagnostic-engine/diagnostic-engine.module.ts` | ❌ MISSING |
| `RAG_SERVICE_URL` | `http://disabled:8000` | operational | `backend/src/modules/rag-proxy/services/rag-ingestion.service.ts` | ✅ YES |
| `RAG_API_KEY` | `disabled` | operational | `backend/src/modules/rag-proxy/services/rag-ingestion.service.ts` | ✅ YES |
| `RAG_PDF_DROP_HOST_ROOT` | `/opt/automecanik/rag/pdfs` | `process.env.RAG_PDF_DROP_HOST_ROOT \|\| ...` | `backend/src/modules/rag-proxy/services/rag-ingestion.service.ts` | ❌ MISSING |
| `RAG_PDF_DROP_CONTAINER_ROOT` | `/app/pdfs` | `process.env.RAG_PDF_DROP_CONTAINER_ROOT \|\| ...` | `backend/src/modules/rag-proxy/services/rag-ingestion.service.ts` | ❌ MISSING |
| `RAG_CONTAINER_NAME` | `rag-api-prod` | `process.env.RAG_CONTAINER_NAME \|\| ...` | `backend/src/modules/rag-proxy/services/rag-ingestion.service.ts` | ❌ MISSING |
| `SKIP_RAG_BOOTSTRAP_GUARD` | `'true'` / falsy | escape hatch CI/dev | `backend/src/modules/rag-knowledge-bootstrap/rag-knowledge-bootstrap.guard.ts`, `backend/tests/unit/rag-knowledge-bootstrap.guard.test.ts` | ❌ MISSING |
| `RAG_L3_GUARD_ENFORCE` | `'true'` / falsy | opt-in prod | `backend/src/modules/rag-knowledge-bootstrap/rag-knowledge-bootstrap.guard.ts`, `backend/tests/unit/rag-knowledge-bootstrap.guard.test.ts` | ❌ MISSING |

**Note on `AUTOMECANIK_CONTENT_PATH`**: This var (proposed in ADR-026 §6) was **never introduced** in the codebase.
ADR-026 is superseded by ADR-031 which renamed the target repo to `automecanik-wiki`. The actual implementation
uses `AUTOMECANIK_WIKI_PATH`. Do NOT introduce `AUTOMECANIK_CONTENT_PATH`.

### Hardcoded paths — no env var, code context (not comments)

These files hardcode `/opt/automecanik/rag/knowledge/<subdir>` as a Python/TS constant or shell path
**without** reading from any env var:

| File | Hardcoded constant | Hardcoded value |
|---|---|---|
| `scripts/rag/ingest-oem-enriched-gammes.py` | `GAMMES_DIR` | `/opt/automecanik/rag/knowledge/gammes` |
| `scripts/validate-gamme-schema.ts` | `GAMMES_DIR` | `/opt/automecanik/rag/knowledge/gammes` |
| `scripts/seo/seo-queries.py` | `RAG_DIR` | `/opt/automecanik/rag/knowledge/gammes` |
| `scripts/seo/rag-check.py` | `RAG_DIR` | `/opt/automecanik/rag/knowledge/gammes` |
| `scripts/seo/generate-content-r1.py` | `RAG_DIR` | `Path('/opt/automecanik/rag/knowledge/gammes')` |
| `scripts/seo/gamme-readiness.py` | `RAG_DIR` | `/opt/automecanik/rag/knowledge/gammes` |
| `scripts/seo/import-gads-kp.py` | `RAG_GAMMES` | `/opt/automecanik/rag/knowledge/gammes` |
| `scripts/seo/rag-enrich-from-db.py` | `RAG_DIR` | `/opt/automecanik/rag/knowledge/gammes` |
| `scripts/seo/rag-upgrade-v4.py` | `RAG_DIR` | `/opt/automecanik/rag/knowledge/gammes` |
| `scripts/seo/rag-cleanup-scrape.py` | `RAG_DIR` | `Path('/opt/automecanik/rag/knowledge/gammes')` |
| `scripts/seo/backfill-r1-safe-table.py` | `RAG_GAMMES_DIR` | `Path("/opt/automecanik/rag/knowledge/gammes")` |
| `scripts/seo/rag-lint.py` | `RAG_DIR` | `Path('/opt/automecanik/rag/knowledge/gammes')` |
| `scripts/seo/curate-r7-batch.py` | `DRAFTS_DIR` | `Path("/opt/automecanik/rag/knowledge/web/brands")` |
| `scripts/runbook-content-refresh-e2e.sh` | inline shell paths | `/opt/automecanik/rag/knowledge/gammes/${SLUG}.md` |

**Comments/tests only** (not functional code, lower priority):

| File | Nature |
|---|---|
| `backend/src/modules/admin/services/r2-enricher.service.ts` | JSDoc comment only |
| `backend/src/modules/diagnostic-engine/validate-phase0.ts` | Block comment only |
| `backend/tests/unit/rag-webhook-completion.test.ts` | Test mock (functional but test-only) |

### Docker volumes — hardcoded host paths

| File | Volume mount |
|---|---|
| `docker-compose.prod.yml` | `/opt/automecanik/rag/knowledge:/opt/automecanik/rag/knowledge:ro` |
| `docker-compose.ci-deploy.yml` | `/opt/automecanik/rag/knowledge:/opt/automecanik/rag/knowledge:ro` |

Neither uses `${RAG_KNOWLEDGE_PATH}` or a substitutable env var. The container path is
also hardcoded (matches `rag-pipeline.service.ts` comment: "Knowledge path inside container is
`/knowledge` (mapped from `/opt/automecanik/rag/knowledge`)").

### CI workflows — hardcoded refs

| File | Usage |
|---|---|
| `.github/workflows/rag-permissions-audit.yml` | `rag/knowledge/` path hardcoded in `git diff --name-only` guard |
| `.github/workflows/wiki-readiness-check.yml` | Uses `AUTOMECANIK_RAG_PATH` env ✅ (correct) |

### Frontend — UI placeholder text only

| File | Nature |
|---|---|
| `frontend/app/routes/admin.rag.ingest.tsx` | UI placeholder text (`/opt/automecanik/rag/pdfs/inbox/`) — not a functional path read |

### git submodule — alternative pattern (ADR-032)

`backend/src/modules/diagnostic-engine/services/diagnostic-content.service.ts` reads from
`backend/content/automecanik-wiki/wiki/{diagnostic,support}/<slug>.md` — a **git submodule**
injected at build time, not an env var path. This is a separate coupling pattern (ADR-032
Phase 4 PR-6) and out of scope for the env vars refacto.

---

## Proposed target shape

**Situation observed**: Incoherent mix — Option 2 from Step 4.

- **Coherent pair established** in Python scripts: (`AUTOMECANIK_WIKI_PATH`, `AUTOMECANIK_RAG_PATH`)
- **Coherent NestJS pattern** established: `RAG_KNOWLEDGE_PATH` (in `.env.example`, used by backend + 2 scripts)
- **~14 scripts** still hardcode `/opt/automecanik/rag/knowledge/<subdir>` without any env var
- **ADR-026 proposed var `AUTOMECANIK_CONTENT_PATH` superseded** — do NOT introduce; use `AUTOMECANIK_WIKI_PATH` (already present)

### Two-step plan

#### Step A — Introduce env var defaults (no behaviour change)

Add missing vars to `backend/.env.example` (already have their defaults in code — making them
visible in the example file brings no code change, zero risk):

```diff
+# RAG / Wiki / Raw paths — filesystem locations of sibling repos
+AUTOMECANIK_WIKI_PATH=/opt/automecanik/automecanik-wiki
+AUTOMECANIK_RAG_PATH=/opt/automecanik/rag
+AUTOMECANIK_RAW_PATH=/opt/automecanik/automecanik-raw
+# RAG guard (opt-in for strict enforcement in production)
+RAG_ENABLED=false
+SKIP_RAG_BOOTSTRAP_GUARD=false
+RAG_L3_GUARD_ENFORCE=false
+# RAG PDF ingestion paths
+RAG_PDF_DROP_HOST_ROOT=/opt/automecanik/rag/pdfs
+RAG_PDF_DROP_CONTAINER_ROOT=/app/pdfs
+RAG_CONTAINER_NAME=rag-api-prod
```

Files: `backend/.env.example` (1 file, documentation-only change)

#### Step B — Migrate hardcoded scripts to use `RAG_KNOWLEDGE_PATH`

For each of the 14 scripts with hardcoded `/opt/automecanik/rag/knowledge/gammes/` (or other
sub-paths), replace the constant definition with an env-var-driven equivalent.

Pattern for Python scripts (consistent with `scripts/seo/batch-r6-keyword-plans.py` and
`scripts/seo/build-keyword-clusters.ts` which already do this correctly):

```python
# BEFORE (hardcoded):
RAG_DIR = "/opt/automecanik/rag/knowledge/gammes"

# AFTER (env-var driven, consistent with batch-r6-keyword-plans.py pattern):
import os
RAG_DIR = os.path.join(
    os.getenv("RAG_KNOWLEDGE_PATH", "/opt/automecanik/rag/knowledge"),
    "gammes"
)
```

Pattern for TypeScript scripts (consistent with `scripts/seo/build-keyword-clusters.ts`):

```typescript
// BEFORE:
const GAMMES_DIR = '/opt/automecanik/rag/knowledge/gammes';

// AFTER (consistent with build-keyword-clusters.ts):
const RAG_KNOWLEDGE_PATH = process.env.RAG_KNOWLEDGE_PATH || '/opt/automecanik/rag/knowledge';
const GAMMES_DIR = path.join(RAG_KNOWLEDGE_PATH, 'gammes');
```

**Special case** `scripts/seo/curate-r7-batch.py` (path is `knowledge/web/brands` — not gammes):

```python
# BEFORE:
DRAFTS_DIR = Path("/opt/automecanik/rag/knowledge/web/brands")

# AFTER:
DRAFTS_DIR = Path(os.getenv("RAG_KNOWLEDGE_PATH", "/opt/automecanik/rag/knowledge")) / "web" / "brands"
```

**Special case** `scripts/runbook-content-refresh-e2e.sh`:

```bash
# Add at top, consistent with scripts/ops/lock-rag-knowledge.sh pattern:
RAG_KNOWLEDGE_PATH="${RAG_KNOWLEDGE_PATH:-/opt/automecanik/rag/knowledge}"
# Then replace all /opt/automecanik/rag/knowledge/gammes/${SLUG}.md
# with ${RAG_KNOWLEDGE_PATH}/gammes/${SLUG}.md
```

**Out of scope for Step B** (comment-only occurrences, no functional impact):
- `backend/src/modules/admin/services/r2-enricher.service.ts` (JSDoc only)
- `backend/src/modules/diagnostic-engine/validate-phase0.ts` (block comment only)

#### Optional Step C — Docker volume parameterization

`docker-compose.prod.yml` and `docker-compose.ci-deploy.yml` hardcode the host-side mount.
Optional improvement (lower priority — VPS provisioning handles this):

```yaml
# docker-compose.prod.yml
volumes:
  - ${RAG_KNOWLEDGE_PATH:-/opt/automecanik/rag/knowledge}:/opt/automecanik/rag/knowledge:ro
```

This requires `RAG_KNOWLEDGE_PATH` to be set in the shell environment at `docker compose up` time,
which it already is if set via the OS env or `.env` file. Files: 2 docker-compose files.

---

## Sizing

- **Files to edit (Step A)**: 1 (`backend/.env.example`)
- **Files to edit (Step B)**: 14 (12 Python scripts + 1 TypeScript + 1 shell script)
- **Files to edit (Step C, optional)**: 2 (`docker-compose.prod.yml`, `docker-compose.ci-deploy.yml`)
- **NestJS services affected**: 0 (backend already uses `RAG_KNOWLEDGE_PATH` via `rag.config.ts` — no code change needed)
- **Remix routes affected**: 0 (UI placeholder only, no functional path reads)
- **Scripts affected (Step B)**: 14
- **Config files**: `backend/.env.example` (Step A)
- **CI workflows affected**: 0 for env var changes; `rag-permissions-audit.yml` has hardcoded `rag/knowledge/` path in diff guard (acceptable — guards the mirror path, not the mount point)
- **Total files (A+B)**: 15
- **Total files (A+B+C)**: 17

**ADR-026 estimate was "~10-20 files" — actual: 14 scripts + 1 .env.example = 15 files. Within estimate.**

---

## Key structural finding

ADR-026 §6 canonical vars were `AUTOMECANIK_CONTENT_PATH` + `AUTOMECANIK_RAG_PATH`. However:

1. ADR-026 is superseded by ADR-031 (2026-04-28) — `automecanik-content` renamed to `automecanik-wiki`
2. The codebase already uses `AUTOMECANIK_WIKI_PATH` (not `AUTOMECANIK_CONTENT_PATH`) in 6 script files
3. `AUTOMECANIK_RAG_PATH` is already used in 3 script/shell files
4. `RAG_KNOWLEDGE_PATH` is the NestJS-layer canonical var (already in `.env.example`)

The P1 work is therefore NOT "introduce `AUTOMECANIK_CONTENT_PATH`" (that var is obsolete) but:
- **Document the existing pairs** in `.env.example`
- **Migrate the 14 hardcoded scripts** to use the already-canonical `RAG_KNOWLEDGE_PATH`

---

## Test plan

- [ ] `grep -rE '"/opt/automecanik/rag/knowledge' scripts/seo/ scripts/rag/ scripts/runbook-content-refresh-e2e.sh scripts/validate-gamme-schema.ts` returns 0 code occurrences (comments OK)
- [ ] `npm run typecheck` PASS (no new TS errors from `scripts/validate-gamme-schema.ts` change)
- [ ] `npm test` PASS (unit tests unaffected — `rag-knowledge-bootstrap.guard.test.ts` already uses `RAG_KNOWLEDGE_PATH` env var correctly)
- [ ] `python -m pytest scripts/seo/` PASS (Python scripts not tested automatically — smoke test manually on DEV)
- [ ] `backend/.env.example` updated (Step A vars present)
- [ ] Smoke test DEV: `python scripts/seo/rag-check.py` reads the expected path without error
- [ ] Smoke test DEV: `python scripts/seo/batch-r6-keyword-plans.py --audit-only` (regression check for already-migrated script)
- [ ] CLAUDE.md does NOT need update — `RAG_KNOWLEDGE_PATH` convention is already implicit in `.env.example`. The new entry for `AUTOMECANIK_WIKI_PATH` should be added to the env var table in `CLAUDE.md` if the team wants visibility (optional, not blocking).

---

## Out of scope

- Actual code edits (this is audit-only — no code modified in this PR)
- P2-P6 phases (see ADR-026 handoff knowledge note `cdb3d0a`)
- ADR-031 compliance beyond env vars (4-layer architecture, wiki export pipeline, blue-green Weaviate)
- `ai-agents-python/` directory (not scanned — to be included in a follow-up audit pass if P1 execution reveals additional hardcoded paths)
- `workspaces/seo-batch/` (separate CLAUDE.md scope — SEO batch agents may have their own hardcoded paths, requires dedicated scan)
- git submodule path (`backend/content/automecanik-wiki/`) — ADR-032 scope, not env vars
- `WIKI_REPO_PATH` standardization (test-only occurrence, low risk; align with `AUTOMECANIK_WIKI_PATH` in a follow-up)
- Docker volume parameterization (Step C, optional)

---

🤖 Generated by remote agent triggered 2026-05-11 per ADR-026 P0 follow-up schedule.
