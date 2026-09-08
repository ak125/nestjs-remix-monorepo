#!/usr/bin/env bash
# Banc de rejeu fail-closed — cas nominal, idempotence et injections de panne.
#
# HERMETIQUE : monte son propre PostgreSQL 17 jetable, ne lit jamais MassDoc PROD et
# n'exige aucun secret. Executable en CI comme sur le poste DEV.
#
# Regle du banc : une injection qui rendrait 0 est un ECHEC du banc. Le vert ne se
# prouve pas en verifiant que le nominal passe, mais que les pannes ARRETENT le rejeu.
set -uo pipefail
cd "$(dirname "$0")"

ARCHIVE="${TECDOC_ARCHIVE:-/opt/automecanik/app/.github/SQL-CONVERTED.7z}"
SCOPE="${TECDOC_SCOPE:-../audit/massdoc-tecdoc-import-scope-2026-03.json}"
MANIFESTE="${TECDOC_MANIFESTE:-../audit/massdoc-tecdoc-preservation-manifest-2026-03.json}"
CONTENEUR="tecdoc-banc-$$"
PORT="${TECDOC_BANC_PORT:-55433}"
TMP="$(mktemp -d)"
DLNR_TEST=4523          # HIDRIA — 13 057 lignes, shard present, .meta concordant
ok=0; ko=0

nettoyer() { docker rm -f "$CONTENEUR" >/dev/null 2>&1; rm -rf "$TMP"; }
trap nettoyer EXIT

# attendu_code <libelle> <code attendu> <commande...>
cas() {
  local libelle="$1" attendu="$2"; shift 2
  local sortie; sortie="$("$@" 2>&1)"; local code=$?
  if [ "$code" -eq "$attendu" ]; then
    ok=$((ok+1)); printf '  ✓ %-52s (code %s)\n' "$libelle" "$code"
  else
    ko=$((ko+1)); printf '  ✗ %-52s attendu %s, obtenu %s\n' "$libelle" "$attendu" "$code"
    printf '%s\n' "$sortie" | sed 's/^/      /' | head -6
  fi
}

# egal <libelle> <attendu> <obtenu>
egal() {
  if [ "$2" = "$3" ]; then ok=$((ok+1)); printf '  ✓ %-52s (%s)\n' "$1" "$3"
  else ko=$((ko+1)); printf '  ✗ %-52s attendu %s, obtenu %s\n' "$1" "$2" "$3"; fi
}

sql() { docker exec "$CONTENEUR" psql -U postgres -d "$1" -tAc "$2" 2>/dev/null | tr -d ' '; }

if ! command -v docker >/dev/null 2>&1; then
  echo "docker absent — banc de rejeu non executable"; exit 2
fi
if [ ! -f "$ARCHIVE" ]; then
  echo "archive source absente ($ARCHIVE) — banc de rejeu non executable"; exit 2
fi

echo "=== Banc de rejeu fail-closed — PostgreSQL 17 jetable ==="
docker run -d --name "$CONTENEUR" -e POSTGRES_PASSWORD=jetable -e POSTGRES_DB=banc \
  -p "127.0.0.1:${PORT}:5432" --tmpfs /var/lib/postgresql/data:rw,size=4g \
  postgres:17-alpine -c fsync=off -c full_page_writes=off >/dev/null || exit 2
for _ in $(seq 1 60); do
  docker exec "$CONTENEUR" pg_isready -U postgres -d banc >/dev/null 2>&1 && break; sleep 1
done
docker exec -i "$CONTENEUR" psql -U postgres -d banc -q -v ON_ERROR_STOP=1 \
  < tecdoc-replay/schema-jetable.sql >/dev/null || exit 2
docker exec -i "$CONTENEUR" psql -U postgres -d banc -q -v ON_ERROR_STOP=1 \
  < tecdoc-replay/reference-synthetique.sql >/dev/null || exit 2

BANC="postgresql://postgres:jetable@127.0.0.1:${PORT}/banc"
REF="postgresql://postgres:jetable@127.0.0.1:${PORT}/reference"

echo
echo "-- Cas nominal et idempotence --"
cas "rejeu nominal DLNR $DLNR_TEST" 0 \
  python3 tecdoc_replay.py --scope-mode historical --scope-file "$SCOPE" \
    --dlnr "$DLNR_TEST" --table 400 --cible-dsn "$BANC" --workdir "$TMP" --archive "$ARCHIVE"
egal "lignes chargees" "13057" "$(sql banc 'select count(*) from tecdoc_raw.t400')"
egal "numeros de ligne source distincts" "13057" \
  "$(sql banc 'select count(distinct _source_row_no) from tecdoc_raw.t400')"
egal "prefixe contigu 1..13057" "t" \
  "$(sql banc 'select (min(_source_row_no)=1 and max(_source_row_no)=13057) from tecdoc_raw.t400')"
egal "_batch_id renseigne (PROD le laisse NULL)" "13057" \
  "$(sql banc 'select count(_batch_id) from tecdoc_raw.t400')"
egal "_loaded_at renseigne (PROD le laisse NULL)" "13057" \
  "$(sql banc 'select count(_loaded_at) from tecdoc_raw.t400')"
cas "2e rejeu identique refuse (idempotence)" 3 \
  python3 tecdoc_replay.py --scope-mode historical --scope-file "$SCOPE" \
    --dlnr "$DLNR_TEST" --table 400 --cible-dsn "$BANC" --workdir "$TMP" --archive "$ARCHIVE"
egal "base inchangee apres le 2e rejeu" "13057" "$(sql banc 'select count(*) from tecdoc_raw.t400')"
egal "un seul lot en base" "1" "$(sql banc 'select count(distinct _batch_id) from tecdoc_raw.t400')"

echo
echo "-- Injection 1 : perte de lignes (le defaut de mars 2026) --"
docker exec "$CONTENEUR" psql -U postgres -d banc -q -c 'DELETE FROM tecdoc_raw.t400' >/dev/null
rm -f "$TMP"/400.*.csv "$TMP"/400.*.meta
INJECTION_GARDER=5000 cas "chargement tronque refuse" 5 \
  env INJECTION_GARDER=5000 python3 tecdoc_replay.py --scope-mode historical --scope-file "$SCOPE" \
    --dlnr "$DLNR_TEST" --table 400 --cible-dsn "$BANC" --workdir "$TMP" --archive "$ARCHIVE" \
    --parseur tecdoc-replay/parseur-tronqueur.py
egal "AUCUNE ligne committee apres troncature" "0" "$(sql banc 'select count(*) from tecdoc_raw.t400')"

echo
echo "-- Injection 2 : source alteree (CRC32) --"
cp "$SCOPE" "$TMP/scope-ok.json"
rm -f "$TMP"/400.*.sql "$TMP"/400.*.csv "$TMP"/400.*.meta
7z e -y -o"$TMP" "$ARCHIVE" "400.${DLNR_TEST}.sql" >/dev/null 2>&1
printf '\n-- octet injecte --\n' >> "$TMP/400.${DLNR_TEST}.sql"
cas "shard altere refuse avant tout chargement" 3 \
  python3 tecdoc_replay.py --scope-mode historical --scope-file "$SCOPE" \
    --dlnr "$DLNR_TEST" --table 400 --cible-dsn "$BANC" --workdir "$TMP" --archive "$ARCHIVE"
egal "base toujours vide" "0" "$(sql banc 'select count(*) from tecdoc_raw.t400')"
rm -f "$TMP"/400.*.sql

echo
echo "-- Injection 3 : perimetre --"
cas "historical sans --scope-file" 4 \
  python3 tecdoc_replay.py --scope-mode historical \
    --dlnr "$DLNR_TEST" --table 400 --cible-dsn "$BANC" --workdir "$TMP"
cas "DLNR hors du perimetre scelle" 4 \
  python3 tecdoc_replay.py --scope-mode historical --scope-file "$SCOPE" \
    --dlnr 999999 --table 400 --cible-dsn "$BANC" --workdir "$TMP"
cas "mode current refuse (ni nom de shard, ni CRC32)" 4 \
  python3 tecdoc_replay.py --scope-mode current \
    --dlnr "$DLNR_TEST" --table 400 --cible-dsn "$BANC" --workdir "$TMP"
python3 - "$TMP/scope-ok.json" "$TMP/scope-altere.json" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
d["suppliers"][0]["t400_rows"] = -1          # une seule valeur modifiee
json.dump(d, open(sys.argv[2], "w"), ensure_ascii=False)
PY
cas "artefact de perimetre altere (sceau)" 2 \
  python3 tecdoc_replay.py --scope-mode historical --scope-file "$TMP/scope-altere.json" \
    --dlnr "$DLNR_TEST" --table 400 --cible-dsn "$BANC" --workdir "$TMP"

echo
echo "-- Injection 4 : derive d'identite --"
docker exec "$CONTENEUR" psql -U postgres -d banc -q \
  -c "INSERT INTO tecdoc_map.type_id_remap(old_id,new_id) VALUES ('100001','60001'),('100002','99999')" >/dev/null
cas "identite derivee refusee" 6 \
  python3 tecdoc_replay_controls.py --reference-dsn "$REF" --rejeu-dsn "$BANC" \
    --dlnr "$DLNR_TEST" --controles identite
docker exec "$CONTENEUR" psql -U postgres -d banc -q \
  -c "UPDATE tecdoc_map.type_id_remap SET new_id='60002' WHERE old_id='100002'" >/dev/null
cas "identite conforme acceptee" 0 \
  python3 tecdoc_replay_controls.py --reference-dsn "$REF" --rejeu-dsn "$BANC" \
    --dlnr "$DLNR_TEST" --controles identite
docker exec "$CONTENEUR" psql -U postgres -d banc -q \
  -c "INSERT INTO tecdoc_map.type_id_remap(old_id,new_id) VALUES ('100003','60001')" >/dev/null
cas "reemploi d'un identifiant deja attribue refuse" 6 \
  python3 tecdoc_replay_controls.py --reference-dsn "$REF" --rejeu-dsn "$BANC" \
    --dlnr "$DLNR_TEST" --controles identite
docker exec "$CONTENEUR" psql -U postgres -d banc -q -c 'DELETE FROM tecdoc_map.type_id_remap' >/dev/null

echo
echo "-- Injection 5 : conservation rompue --"
cas "manifeste absent : refus de declarer le controle passe" 3 \
  python3 tecdoc_replay_controls.py --reference-dsn "$REF" --rejeu-dsn "$BANC" \
    --controles conservation
docker exec "$CONTENEUR" psql -U postgres -d reference -q \
  -c "DELETE FROM public.auto_type WHERE type_id_i = 60000" >/dev/null
cas "ensemble applicatif modifie refuse" 7 \
  python3 tecdoc_replay_controls.py --reference-dsn "$REF" --rejeu-dsn "$BANC" \
    --manifeste tecdoc-replay/manifeste-synthetique.json --controles conservation
# Restaurer la reference : une injection destructive qui ne se defait pas contamine
# tous les cas suivants, et son echec serait mis au compte du mauvais composant.
docker exec "$CONTENEUR" psql -U postgres -d reference -q \
  -c "INSERT INTO public.auto_type(type_id_i) VALUES (60000) ON CONFLICT DO NOTHING" >/dev/null
cas "reference restauree : conservation a nouveau intacte" 0 \
  python3 tecdoc_replay_controls.py --reference-dsn "$REF" --rejeu-dsn "$BANC" \
    --manifeste tecdoc-replay/manifeste-synthetique.json --controles conservation

echo
echo "-- Injection 6 : inclusion PROD ⊆ REBUILD rompue --"
docker exec "$CONTENEUR" psql -U postgres -d banc -q -c 'DELETE FROM tecdoc_raw.t400' >/dev/null
rm -f "$TMP"/400.*.csv "$TMP"/400.*.meta
python3 tecdoc_replay.py --scope-mode historical --scope-file "$SCOPE" \
  --dlnr "$DLNR_TEST" --table 400 --cible-dsn "$BANC" --workdir "$TMP" --archive "$ARCHIVE" >/dev/null 2>&1
docker exec "$CONTENEUR" psql -U postgres -d reference -q \
  -c "INSERT INTO tecdoc_raw.t400(col_2,_source_row_no,_raw_hash) VALUES ('$DLNR_TEST',999999,'ligne_servie_absente_du_rejeu')" >/dev/null
cas "reference servant une ligne absente du rejeu refusee" 8 \
  python3 tecdoc_replay_controls.py --reference-dsn "$REF" --rejeu-dsn "$BANC" \
    --dlnr "$DLNR_TEST" --controles reconciliation
docker exec "$CONTENEUR" psql -U postgres -d reference -q \
  -c "UPDATE tecdoc_raw.t400 SET _raw_hash='contredit_le_rejeu', _source_row_no=1 WHERE _source_row_no=999999" >/dev/null
cas "contenu servi contredisant le rejeu refuse (CONFLICT)" 8 \
  python3 tecdoc_replay_controls.py --reference-dsn "$REF" --rejeu-dsn "$BANC" \
    --dlnr "$DLNR_TEST" --controles reconciliation

echo
echo "-- Vagues : la preuve survit a la purge, l'echec conserve la matiere --"
docker exec "$CONTENEUR" psql -U postgres -d banc -q -c 'DELETE FROM tecdoc_raw.t400' >/dev/null
docker exec "$CONTENEUR" psql -U postgres -d reference -q -c 'DELETE FROM tecdoc_raw.t400' >/dev/null
rm -f "$TMP"/400.*.csv "$TMP"/400.*.meta "$TMP/registre.json"
cas "vague nominale (LOT 0) puis purge" 0 \
  python3 tecdoc_replay_wave.py --lot 0 --plan tecdoc-replay/plan-lots.json \
    --scope-file "$SCOPE" --cible-dsn "$BANC" --reference-dsn "$REF" \
    --manifeste tecdoc-replay/manifeste-synthetique.json \
    --workdir "$TMP" --registre "$TMP/registre.json" --archive "$ARCHIVE"
egal "matiere purgee apres preuve" "0" "$(sql banc 'select count(*) from tecdoc_raw.t400')"
egal "preuve conservee dans le registre" "13057" \
  "$(python3 -c "import json;print(json.load(open('$TMP/registre.json'))['entrees'][0]['comptabilite']['rows_loaded'])" 2>/dev/null)"
egal "registre scelle" "64" \
  "$(python3 -c "import json;print(len(json.load(open('$TMP/registre.json'))['seal']['sha256']))" 2>/dev/null)"
cas "relance du meme lot : idempotente" 0 \
  python3 tecdoc_replay_wave.py --lot 0 --plan tecdoc-replay/plan-lots.json \
    --scope-file "$SCOPE" --cible-dsn "$BANC" --reference-dsn "$REF" \
    --manifeste tecdoc-replay/manifeste-synthetique.json \
    --workdir "$TMP" --registre "$TMP/registre.json" --archive "$ARCHIVE"

# La reference sert une ligne que le rejeu ne reproduit pas : inclusion rompue.
rm -f "$TMP/registre2.json" "$TMP"/400.*.csv "$TMP"/400.*.meta
docker exec "$CONTENEUR" psql -U postgres -d reference -q \
  -c "INSERT INTO tecdoc_raw.t400(col_2,_source_row_no,_raw_hash) VALUES ('$DLNR_TEST',999999,'servie_mais_absente_du_rejeu')" >/dev/null
cas "inclusion rompue : vague arretee" 8 \
  python3 tecdoc_replay_wave.py --lot 0 --plan tecdoc-replay/plan-lots.json \
    --scope-file "$SCOPE" --cible-dsn "$BANC" --reference-dsn "$REF" \
    --manifeste tecdoc-replay/manifeste-synthetique.json \
    --workdir "$TMP" --registre "$TMP/registre2.json" --archive "$ARCHIVE"
egal "matiere CONSERVEE pour diagnostic sur echec" "13057" \
  "$(sql banc 'select count(*) from tecdoc_raw.t400')"

echo
echo
echo "=== $ok assertions vertes, $ko rouges ==="
[ "$ko" -eq 0 ] || exit 1
