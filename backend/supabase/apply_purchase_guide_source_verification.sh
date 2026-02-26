#!/usr/bin/env bash
set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${BACKEND_DIR}/.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}"
  exit 1
fi

# shellcheck disable=SC1090
source "${ENV_FILE}"

if [[ -z "${SUPABASE_DB_HOST:-}" || -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
  echo "Missing SUPABASE_DB_HOST or SUPABASE_DB_PASSWORD in backend/.env"
  exit 1
fi

DB_PORT="${SUPABASE_DB_PORT:-6543}"

if [[ -n "${SUPABASE_DB_USER:-}" ]]; then
  DB_USER="${SUPABASE_DB_USER}"
elif [[ -n "${SUPABASE_URL:-}" ]]; then
  PROJECT_REF="$(printf "%s" "${SUPABASE_URL}" | sed -E "s#https?://([^.]+)\..*#\1#")"
  DB_USER="postgres.${PROJECT_REF}"
else
  DB_USER="postgres"
fi

MIGRATIONS=(
  "${BACKEND_DIR}/supabase/migrations/20260213_add_purchase_guide_source_provenance.sql"
  "${BACKEND_DIR}/supabase/migrations/20260213_backfill_purchase_guide_source_type.sql"
  "${BACKEND_DIR}/supabase/migrations/20260214_add_purchase_guide_source_verification.sql"
  "${BACKEND_DIR}/supabase/migrations/20260213_set_disque_frein_source_provenance.sql"
  "${BACKEND_DIR}/supabase/migrations/20260214_verify_disque_frein_source.sql"
  "${BACKEND_DIR}/supabase/migrations/20260213_update_disque_frein_content.sql"
)

if [[ "${1:-}" == "--dry-run" ]]; then
  echo "Dry run only. Would execute with:"
  echo "  host=${SUPABASE_DB_HOST}"
  echo "  port=${DB_PORT}"
  echo "  user=${DB_USER}"
  for file in "${MIGRATIONS[@]}"; do
    echo "  - ${file}"
  done
  exit 0
fi

echo "Applying purchase-guide provenance migrations..."
echo "Host: ${SUPABASE_DB_HOST}"
echo "Port: ${DB_PORT}"
echo "User: ${DB_USER}"

for file in "${MIGRATIONS[@]}"; do
  if [[ ! -f "${file}" ]]; then
    echo "Missing migration file: ${file}"
    exit 1
  fi

  echo "-> $(basename "${file}")"
  PGPASSWORD="${SUPABASE_DB_PASSWORD}" psql \
    -h "${SUPABASE_DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "postgres" \
    -v ON_ERROR_STOP=1 \
    -f "${file}"
done

echo "Verification (pg_id=82):"
PGPASSWORD="${SUPABASE_DB_PASSWORD}" psql \
  -h "${SUPABASE_DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "postgres" \
  -v ON_ERROR_STOP=1 \
  -c "SELECT sgpg_pg_id, sgpg_source_type, sgpg_source_uri, sgpg_source_ref, sgpg_source_verified, sgpg_source_verified_by, sgpg_source_verified_at FROM __seo_gamme_purchase_guide WHERE sgpg_pg_id = '82';"

echo "Done."
