#!/usr/bin/env bash
# Mandat EH, 6.4 : rejoue en local les étapes du job « 🗄️ Migration Safety » de
# .github/workflows/ci.yml sur les migrations des mandats EE et EH.
# Usage : bash 16-migration-safety.sh <racine du dépôt> <binaire squawk 2.52.1>
set -uo pipefail
R=$(cd "$1" && pwd); SQ=$2; cd "$R"
ALL="backend/supabase/migrations/20261120_auto_type_name_meta_corrections_mandat_ee.sql backend/supabase/migrations/20261120_auto_type_name_meta_corrections_mandat_ee.down.sql backend/supabase/migrations/20261120_auto_type_name_origine_corrections_mandat_eh.sql backend/supabase/migrations/20261120_auto_type_name_origine_corrections_mandat_eh.down.sql"
FILES=$(printf '%s\n' $ALL | grep -v '\.down\.sql$' | tr '\n' ' ')
echo "== $(date -u +%FT%TZ) Migration Safety (étapes de ci.yml rejouées en local), HEAD $(git rev-parse --short=9 HEAD)"
echo "-- 1. squawk $("$SQ" --version | awk '{print $2}') (les .down.sql sont exclus, comme en CI)"
"$SQ" --config .squawk.toml $FILES; echo "exit=$?"
echo "-- 2. marqueurs @non_transactional"
python3 scripts/ci/apply-supabase-migration.py --lint-markers $FILES; echo "exit=$?"
echo "-- 3. compilation PL/pgSQL des blocs DO (PostgreSQL 17 jetable)"
C=pg17-mig-safety-$$
docker run -d --rm --name "$C" -e POSTGRES_PASSWORD=ci-ephemeral postgres:17 >/dev/null
trap 'docker rm -f "$C" >/dev/null 2>&1 || true' EXIT
until docker exec "$C" psql -U postgres -tAc 'select 1' >/dev/null 2>&1; do sleep 1; done
echo "serveur : $(docker exec "$C" psql -U postgres -tAc 'show server_version')"
psql_ci() { docker exec -i "$C" psql -U postgres -X -q -v ON_ERROR_STOP=1; }
python3 scripts/ci/check-plpgsql-compile.test.py; echo "auto-test exit=$?"
T=$(mktemp); printf 'DO $t$ BEGIN IF 1 IS DISTINCT FROM CASE 1 WHEN 1 THEN 1 ELSE 2 END THEN NULL; END IF; END $t$;\n' > "$T"
if python3 scripts/ci/check-plpgsql-compile.py "$T" | psql_ci >/dev/null 2>&1; then echo "témoin négatif : NON détecté (échec)"; else echo "témoin négatif : détecté (attendu)"; fi; rm -f "$T"
python3 scripts/ci/check-plpgsql-compile.py $ALL | psql_ci; echo "compilation migrations + retours exit=${PIPESTATUS[1]}"
echo "-- 4. surface DEFINER/anon"
bash scripts/lint/check-definer-anon-surface.test.sh >/dev/null 2>&1; echo "auto-test exit=$?"
bash scripts/lint/check-definer-anon-surface.sh; echo "exit=$?"
