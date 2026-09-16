#!/usr/bin/env bash
# sweep-psql.sh — lecture seule sur la base, sans jamais exposer le mot de passe.
#
# Le mot de passe passe par l'environnement : une ligne de commande est lisible de toute la machine
# via `ps`, un DSN en argument fuiterait a chaque appel.
#
# Usage :
#   ./sweep-psql.sh -c "select 1"
#   ./sweep-psql.sh -f references/../scripts/baseline.sql
set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/automecanik/app/backend/.env}"
PROJECT_REF="${PROJECT_REF:-cxpojprgwgubzjyqzmoq}"
PORT="${PGPORT:-6543}"   # 6543 = pooler en mode transaction

[[ -r "$ENV_FILE" ]] || { echo "introuvable ou illisible : $ENV_FILE" >&2; exit 1; }

PGPASSWORD=$(grep -m1 '^SUPABASE_DB_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)
HOST=$(grep -m1 '^SUPABASE_DB_HOST=' "$ENV_FILE" | cut -d= -f2-)
[[ -n "${PGPASSWORD:-}" && -n "${HOST:-}" ]] || { echo "SUPABASE_DB_PASSWORD ou SUPABASE_DB_HOST absent de $ENV_FILE" >&2; exit 1; }
export PGPASSWORD

# La lecture seule est imposee par le SERVEUR, pas par une convention de nommage.
#
# Mesure du 2026-09-16 : PGOPTIONS ne traverse PAS le pooler Supabase, ni en mode transaction
# (6543) ni en mode session (5432) — `default_transaction_read_only` revient `off` et un
# CREATE TABLE passe. Le seul verrou qui tient a travers le pooler est une transaction unique
# ouverte en lecture seule : un CREATE TABLE y echoue avec
#   ERROR: cannot execute CREATE TABLE in a read-only transaction
#
# Consequence : le SQL passe ici ne doit pas gerer ses propres BEGIN/COMMIT.
exec psql -h "$HOST" -p "$PORT" -U "postgres.${PROJECT_REF}" -d postgres -v ON_ERROR_STOP=1 \
     --single-transaction \
     -c "set transaction read only" \
     -c "set local statement_timeout = ${STATEMENT_TIMEOUT_MS:-60000}" \
     "$@"
