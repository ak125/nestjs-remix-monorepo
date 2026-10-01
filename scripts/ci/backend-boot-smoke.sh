#!/usr/bin/env bash
#
# Backend boot smoke — boot the backend that the core build just compiled,
# with the PREPROD .env and the PREPROD compose service, and fail unless it
# turns healthy.
#
# WHY THIS EXISTS (2026-10-01)
# ----------------------------
# build.yml builds the image on refs/heads/main only, so before this smoke the
# first real boot of a PR's backend was `🧪 Deploy to PREPROD`, after merge. A
# provider that throws in its constructor, a DI graph that cannot resolve, or a
# `getOrThrow` on a key the PREPROD .env does not carry (PR #339, PR #606)
# was found there, and blocked every main deploy until reverted. Unit tests do
# not build the whole DI graph; only a boot does.
#
# CONTRACT
# --------
#   Run    : from anywhere, after `npm ci` and the core build
#            (backend/dist/main.js must exist — no build here, no skip).
#   Input  : nothing from the caller's environment. Supabase is a placeholder
#            on a reserved TLD, the two secrets come from `openssl rand`, and
#            the compose network is internal: the boot cannot reach any remote
#            service and must not need one.
#   Steps  : 1. render the .env with render-preprod-env.sh (the deploy step's
#               renderer) into a scratch project dir next to a copy of
#               docker-compose.preprod.yml — the deploy step's layout;
#            2. validate it with preflight-env-contract.ts, as the deploy step
#               does;
#            3. `docker compose up --wait` on docker-compose.preprod.yml plus
#               backend-boot-smoke.compose.yml (read its header).
#   Verdict: exit 0 once the base compose healthcheck (GET /health) reports
#            healthy within WAIT_SECONDS; otherwise exit 1 after printing the
#            container states and the backend log.
#   Effects: compose project `boot-smoke` (two containers, one network),
#            removed on every exit path, and one scratch directory.
#
# Differences with the PREPROD container, accepted on purpose: the tree is the
# full checkout, not the Dockerfile COPY set, on node:24-bookworm instead of
# node:24-alpine; Sentry stays in no-op mode (the deploy step's no-sops path).
# Deploy PREPROD on main still boots the real image.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OVERLAY="$ROOT/scripts/ci/backend-boot-smoke.compose.yml"
PROJECT=boot-smoke
# Same budget as the deploy step's health loop (12 × 10 s).
WAIT_SECONDS=120

if [ ! -f "$ROOT/backend/dist/main.js" ]; then
  echo "::error::backend/dist/main.js is missing — run the core build before the boot smoke."
  exit 1
fi

WORK="$(mktemp -d "${TMPDIR:-/tmp}/backend-boot-smoke.XXXXXX")"

# Compose runs with a scrubbed environment: the base file's bare
# `environment:` entries (DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SENTRY_*…)
# would otherwise inherit whatever the caller's shell holds. They resolve from
# the project .env instead, the same file the deploy step sources.
compose() {
  env -i \
    PATH="$PATH" HOME="$HOME" \
    ${DOCKER_HOST:+DOCKER_HOST="$DOCKER_HOST"} \
    ${DOCKER_CONFIG:+DOCKER_CONFIG="$DOCKER_CONFIG"} \
    ${DOCKER_CONTEXT:+DOCKER_CONTEXT="$DOCKER_CONTEXT"} \
    BOOT_SMOKE_UID="$(id -u)" BOOT_SMOKE_GID="$(id -g)" BOOT_SMOKE_TREE="$ROOT" \
    docker compose -p "$PROJECT" \
    -f "$WORK/docker-compose.preprod.yml" -f "$OVERLAY" "$@"
}

cleanup() {
  compose down -v --remove-orphans --timeout 5 >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

cp "$ROOT/docker-compose.preprod.yml" "$WORK/"
SUPABASE_URL=https://boot-smoke.invalid \
  SUPABASE_ANON_KEY=boot-smoke-placeholder-anon-key \
  SESSION_SECRET="$(openssl rand -hex 32)" \
  JWT_SECRET="$(openssl rand -hex 32)" \
  CRUX_API_KEY='' \
  bash "$ROOT/scripts/ci/render-preprod-env.sh" > "$WORK/.env"

echo "🛡️ Preflight env contract check (rendered .env)..."
(
  set -euo pipefail
  cd "$ROOT"
  set -o allexport
  # shellcheck disable=SC1091
  . "$WORK/.env"
  set +o allexport
  npx --no-install tsx scripts/ci/preflight-env-contract.ts
)

echo "⬇️ Pulling the pinned images..."
compose pull --quiet

echo "⏳ Booting backend/dist (budget ${WAIT_SECONDS}s)..."
if compose up -d --wait --wait-timeout "$WAIT_SECONDS" --pull never; then
  echo "✅ Backend booted healthy with the PREPROD .env and compose service"
  exit 0
fi

echo "::error::backend/dist did not become healthy with the PREPROD .env (container exited, or not healthy after ${WAIT_SECONDS}s) — Deploy PREPROD would fail the same way after merge."
compose ps -a || true
compose logs --no-color --tail 200 monorepo_preprod || true
exit 1
