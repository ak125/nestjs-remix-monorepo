#!/usr/bin/env bash
# Test du hook PreToolUse pretool-supabase-guard.sh (contrat : base en lecture seule
# pour les agents, .claude/skills/amk-supabase-postgres-best-practices/SKILL.md).
# Aucun appel réel : le hook reçoit une enveloppe JSON sur stdin et rend un code de
# sortie ; aucune base, aucun réseau, aucun fichier temporaire.
# SIMULATION : ni Claude Code ni son exécuteur de hooks ne sont exercés ; l'enveloppe est
# celle documentée (code.claude.com/docs/en/hooks).
# Usage : bash scripts/claude-hooks/pretool-supabase-guard.test.sh
#   HOOK_ROOT=<racine> : éprouver une autre version du hook (ex. le commit de base).
set -uo pipefail
HERE="${HOOK_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
HOOK="$HERE/scripts/claude-hooks/pretool-supabase-guard.sh"
FAIL=0; N=0
# La requête passe à jq par stdin (printf est interne au shell) : pas de limite d'argument.
env_of() { printf '%s' "$2" | jq -cRs --arg t "$1" '{tool_name: $t, tool_input: {query: .}}'; }
run() { local rc; printf '%s' "$1" | bash "$HOOK" >/dev/null 2>&1; rc=$?; echo "$rc"; }
check() { N=$((N + 1)); if [[ "$2" == "$3" ]]; then echo "  ok    — $1 ($3)"; else echo "  ÉCHEC — $1 : attendu « $2 », obtenu « $3 »"; FAIL=1; fi; }
sql() { check "$1" "$2" "$(run "$(env_of mcp__claude_ai_Supabase__execute_sql "$3")")"; }
T_MIG=mcp__supabase__apply_migration

echo "== lectures autorisées (exit 0)"
sql "SELECT simple"                        0 "SELECT 1"
sql "SELECT avec jointure et filtre"       0 "select p.piece_id, g.pg_name from pieces p join pieces_gamme g on g.pg_id = p.piece_pg_id where p.piece_id = 12 limit 5"
sql "WITH de lecture"                      0 "WITH t AS (SELECT 1 AS x) SELECT x FROM t"
sql "EXPLAIN ANALYZE d'un SELECT"          0 "EXPLAIN ANALYZE SELECT * FROM pieces WHERE piece_id = 1"
sql "EXPLAIN (ANALYZE, BUFFERS) SELECT"    0 "EXPLAIN (ANALYZE, BUFFERS) SELECT count(*) FROM pieces"
sql "VALUES"                               0 "VALUES (1), (2)"
sql "SHOW"                                 0 "SHOW statement_timeout"
sql "plusieurs SELECT"                     0 "SELECT 1; SELECT 2;"
sql "mot d'écriture dans une chaîne"       0 "SELECT 'DELETE FROM pieces; DROP TABLE x' AS note"
sql "mot d'écriture dans un commentaire"   0 "SELECT 1 -- UPDATE pieces SET x = 1"
sql "mot d'écriture en bloc commentaire"   0 "/* TRUNCATE pieces */ SELECT 1"
sql "identifiant entre guillemets"         0 'SELECT "update" FROM "__seo_gamme_conseil" LIMIT 1'
sql "colonne update_date (mot composé)"    0 "SELECT update_date, created_at FROM ___xtr_order LIMIT 1"
sql "catalogue système"                    0 "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'"

echo "== écritures et DDL refusés (exit 2)"
sql "INSERT"                               2 "INSERT INTO ___xtr_order (ord_id) VALUES (1)"
sql "UPDATE hors liste historique"         2 "UPDATE ___xtr_customer SET cst_mail = 'x' WHERE cst_id = 1"
sql "DELETE"                               2 "DELETE FROM ___xtr_order WHERE ord_id = 1"
sql "delete en minuscules"                 2 "delete   from   pieces where 1=1"
sql "UPSERT"                               2 "INSERT INTO __seo_keyword_results (k) VALUES ('x') ON CONFLICT (k) DO UPDATE SET k = excluded.k"
sql "MERGE"                                2 "MERGE INTO pieces p USING t ON t.id = p.piece_id WHEN MATCHED THEN DELETE"
sql "TRUNCATE"                             2 "TRUNCATE pieces"
sql "DROP TABLE IF EXISTS"                 2 "DROP TABLE IF EXISTS pieces_price CASCADE"
sql "DROP + 'IF EXISTS' en chaîne"         2 "DROP TABLE pieces_price; SELECT 'IF EXISTS'"
sql "ALTER TABLE DROP COLUMN"              2 "ALTER TABLE pieces DROP COLUMN piece_name"
sql "CREATE TABLE avec RLS"                2 "CREATE TABLE t (id int); ALTER TABLE t ENABLE ROW LEVEL SECURITY"
sql "CREATE INDEX"                         2 "CREATE INDEX IF NOT EXISTS i ON pieces (piece_id)"
sql "DROP POLICY"                          2 "DROP POLICY p ON ___xtr_customer"
sql "NO FORCE RLS"                         2 "ALTER TABLE ___xtr_customer NO FORCE ROW LEVEL SECURITY"
sql "DISABLE RLS"                          2 "ALTER TABLE ___xtr_customer DISABLE ROW LEVEL SECURITY"
sql "GRANT"                                2 "GRANT ALL ON ALL TABLES IN SCHEMA public TO anon"
sql "ALTER ROLE"                           2 "ALTER ROLE anon SET statement_timeout = 0"
sql "CREATE FUNCTION"                      2 "CREATE OR REPLACE FUNCTION f() RETURNS int LANGUAGE sql AS \$\$ SELECT 1 \$\$"
sql "DO + EXECUTE dynamique"               2 "DO \$\$ BEGIN EXECUTE \$q\$DELETE FROM ___xtr_order\$q\$; END \$\$"
sql "COPY TO PROGRAM"                      2 "COPY ___xtr_customer TO PROGRAM \$\$curl x\$\$"
sql "CALL"                                 2 "CALL refresh_stuff()"
sql "SET"                                  2 "SET statement_timeout = 0"
sql "BEGIN"                                2 "BEGIN; SELECT 1; COMMIT"
sql "EXPLAIN ANALYZE DELETE"               2 "EXPLAIN ANALYZE DELETE FROM ___xtr_order"
sql "EXPLAIN ANALYZE UPDATE"               2 "EXPLAIN (ANALYZE) UPDATE pieces SET piece_name = 'x'"
sql "SELECT INTO (crée une table)"         2 "SELECT * INTO copie FROM ___xtr_customer"
sql "CTE qui écrit"                        2 "WITH d AS (DELETE FROM ___xtr_order RETURNING *) SELECT count(*) FROM d"
sql "SELECT puis DELETE"                   2 "SELECT 1; DELETE FROM pieces"
sql "SELECT FOR UPDATE"                    2 "SELECT * FROM ___xtr_order WHERE ord_id = 1 FOR UPDATE"
sql "fonction d'administration"            2 "SELECT pg_terminate_backend(123)"
sql "set_config"                           2 "SELECT set_config('role', 'postgres', false)"
sql "nextval"                              2 "SELECT nextval('pieces_piece_id_seq')"
sql "chaîne non fermée (avale la suite)"   2 "DELETE FROM pieces WHERE x = 'abc"
sql "écriture derrière un commentaire"     2 "-- SELECT 1
DELETE FROM pieces"

echo "== contournements lexicaux refusés (revue de sécurité de #2240)"
sql "dollar collé à un identifiant"        2 'SELECT x$a$ FROM t; DROP TABLE y; SELECT 1 AS x$a$'
sql "tag dollar commençant par un chiffre" 2 'SELECT $9$ FROM t; DROP TABLE y; SELECT $9$'
sql "tag dollar non ASCII"                 2 "SELECT \$é\$ ' \$é\$; DROP TABLE y; --'"
sql "E collé à un identifiant"             2 "SELECT some'\\' ; DROP TABLE y; --'"
sql "chaîne collée à un nombre"            2 "SELECT 1e'\\'' ; DROP TABLE y; --'"
sql "fonction entre guillemets"            2 'SELECT "pg_terminate_backend"(123)'
sql "schéma et fonction entre guillemets"  2 "SELECT \"pg_catalog\".\"set_config\"('a', 'b', false)"
sql "identifiant U&"                       2 'SELECT U&"pg\005fterminate_backend"(1)'
sql "query_to_xml (SQL dynamique)"         2 "SELECT query_to_xml('DELETE FROM t', true, true, '')"
sql "commentaire non fermé"                2 "SELECT 1 /* DROP TABLE y"
sql "continuation de chaîne E"             2 "SELECT E''
'\\' x ' ; DROP TABLE y; --'"
sql "continuation E derrière commentaire"  2 "SELECT E'a' -- c
'\\' x ' ; DROP TABLE y; --'"
echo "== lectures légitimes proches (exit 0)"
sql "chaîne E à échappement"               0 "SELECT E'l\\'huile' AS t"
sql "littéral typé collé (date'…')"        0 "SELECT date'2026-11-26' AS d"
sql "chaîne dollar après un espace"        0 'SELECT $q$ DROP $q$ AS t'
sql "guillemets doublés dans un identifiant" 0 'SELECT 1 AS "a""b"'
sql "chaîne E puis saut de ligne sans quote" 0 "SELECT E'a\\'b'
FROM t"
sql "continuation de chaînes standard"     0 "SELECT 'a'
'b' AS t"
echo "== chaîne E suivie de commentaires : verdict en temps borné (10 s)"
# Avant le passage unique de CONT, ces entrées faisaient revenir l'expression en arrière en
# temps exponentiel et le hook dépassait son délai. timeout rend 124 sans verdict à 10 s.
run_t() { local rc; printf '%s' "$1" | timeout 10 bash "$HOOK" >/dev/null 2>&1; rc=$?; echo "$rc"; }
sql_t() { check "$1" "$2" "$(run_t "$(env_of mcp__claude_ai_Supabase__execute_sql "$3")")"; }
DASHES=$(printf '%200s' '' | tr ' ' '-')
BLOCKS=$(printf '/**/%.0s' $(seq 200))
sql_t "E puis ligne de 200 tirets, lecture"        0 "SELECT x FROM t WHERE y = E'a'
-- $DASHES
AND z = 1"
sql_t "E puis 200 blocs de commentaire, lecture"   0 "SELECT E'a' $BLOCKS AS x"
sql_t "E puis commentaires, sans quote ensuite"    0 "SELECT E'a' /* note */ AS x -- fin"
sql_t "E, tirets, continuation qui cache un DROP"  2 "SELECT E'a' -- $DASHES
'\\' x ' ; DROP TABLE y; --'"
sql_t "E, commentaire, autre chaîne plus loin (refus fermé)" 2 "SELECT x FROM t WHERE y = E'a'
-- $DASHES
AND z = 'b'"
echo "== apply_migration toujours refusé (exit 2)"
check "apply_migration CREATE INDEX"       2 "$(run "$(env_of "$T_MIG" "CREATE INDEX CONCURRENTLY i ON pieces (piece_id)")")"
check "apply_migration SELECT seul"        2 "$(run "$(env_of mcp__claude_ai_Supabase__apply_migration "SELECT 1")")"

echo "== enveloppe (échec fermé, exit 2)"
check "JSON illisible"                     2 "$(run 'pas du json')"
check "query absente"                      2 "$(run '{"tool_name":"mcp__supabase__execute_sql","tool_input":{}}')"
check "query vide"                         2 "$(run "$(env_of mcp__supabase__execute_sql "   ")")"
check "deux objets JSON"                   2 "$(run '{"tool_input":{"query":"SELECT 1"}}{"tool_input":{"query":"SELECT 1"}}')"
check "query non textuelle"                2 "$(run '{"tool_name":"mcp__supabase__execute_sql","tool_input":{"query":1}}')"

echo "== grande requête"
BIG="SELECT 1 /* $(head -c 1000000 /dev/zero | tr '\0' 'x') */"
check "SELECT de 1 Mo (commentaire)"       0 "$(run "$(env_of mcp__supabase__execute_sql "$BIG")")"
BIG2="SELECT 1 /* $(head -c 1000000 /dev/zero | tr '\0' 'x') */; DELETE FROM pieces"
check "DELETE derrière 1 Mo"               2 "$(run "$(env_of mcp__supabase__execute_sql "$BIG2")")"

echo
if [[ $FAIL -eq 0 ]]; then echo "VERT — $N cas"; else echo "ROUGE — au moins un cas en échec sur $N"; fi
exit $FAIL
