#!/usr/bin/env bash
#
# PREPROD .env renderer — print, on stdout, the .env the PREPROD container
# boots with.
#
# WHY THIS EXISTS (2026-10-01)
# ----------------------------
# The PREPROD .env used to be an inline heredoc of the `🧪 Deploy to PREPROD`
# step (ci.yml). A backend that cannot boot with it is only discovered after
# merge, when that step restarts the container. The PR-time boot smoke
# (backend-boot-smoke.sh) boots `backend/dist` with this same file, so the two
# can never drift: one renderer, two consumers.
#
# CONTRACT
# --------
#   Input  : SUPABASE_URL, SUPABASE_ANON_KEY, SESSION_SECRET, JWT_SECRET must be
#            set in the environment (empty is passed through); CRUX_API_KEY is
#            optional (ADR-063, blank-allowed).
#   Output : the .env body on stdout, nothing else.
#   Values are NOT validated here: `scripts/ci/preflight-env-contract.ts`
#   (Zod SoT backend/src/contract/env-contract/preprod.schema.ts) is the only
#   validator, run by both consumers on what this script printed.
#
set -euo pipefail

cat <<EOF
NODE_ENV=preprod
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
SESSION_SECRET=${SESSION_SECRET}
# JWT_SECRET — required since PR #606 VehicleContextService.getOrThrow.
# See env block comment above for rationale.
JWT_SECRET=${JWT_SECRET}
READ_ONLY=true
# ADR-055 shadow activation: collect real preprod evidence before any
# mode=on decision. Literal on remains blocked by backend boot guard.
SEO_CHAIN_R7_MODE=shadow
SEO_CHAIN_R8_MODE=shadow
SEO_CHAIN_RM_MODE=shadow
REDIS_URL=redis://redis-preprod:6379
APP_URL=http://localhost:3200
# RAG service disabled in preprod (4 rag-proxy services use
# configService.getOrThrow<string>('RAG_SERVICE_URL') and 'RAG_API_KEY'
# at constructor — both crash without sentinel values).
# Default URL documented in
# backend/src/config/env-validation.ts::OPTIONAL_ENV_VARS_WITH_DEFAULTS.
# Sentinel API key is intentionally non-functional ; rag-proxy services
# cannot reach a real RAG instance from preprod read-only mode anyway.
RAG_SERVICE_URL=http://disabled:8000
RAG_API_KEY=disabled-preprod-readonly
# ADR-063 — CrUX API key (optional, blank-allowed = graceful degrade)
CRUX_API_KEY=${CRUX_API_KEY:-}
# (Phase 0.6) Sitemap OIDC validation invariants are hardcoded in
# GithubOidcService (cf. docs/superpowers/specs/2026-05-16-sitemap-regen-auth-design.md
# Components > GithubOidcService — class static readonly constants).
# Preprod heredoc has no OIDC config to propagate — preprod is an
# ephemeral CI container with no automatic Bearer-token caller.
EOF
