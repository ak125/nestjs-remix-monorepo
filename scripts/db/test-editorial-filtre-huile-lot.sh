#!/usr/bin/env bash
# =============================================================================
# Banc du lot éditorial filtre à huile (pg_id 7)
#
# Joue RÉELLEMENT les migrations générées par
# docs/audits/editorial-filtre-huile-20261030/tools/build-publication-migration.cjs
# (20261031_editorial_filtre_huile_pg7_{textes,images}[.down].sql, et C-og hors
# dépôt) sur l'état relevé le 2026-10-31 (editorial-filtre-huile-lot-fixture.sql
# et --fixture-data), et vérifie par des contrôles indépendants du SQL généré :
#   - écriture : les 50 cellules texte prennent le sha256 « après » du lot ; H1,
#     title, meta description, section META et colonnes hors lot inchangés ;
#     caches de pg 7 invalidés, pg 8 intact ; aucune violation de scope ;
#   - images : chemins versionnés, objet au md5 du fichier, alt et légendes,
#     LOCATION désélectionnée, lignes hors plan intactes ;
#   - relecture, rejeu sans effet, retour arrière (textes : valeur relevée, ou sa
#     forme accentuée par le trigger ; images : à l'octet), rejeu du retour,
#     nouvelle écriture après le retour ;
#   - refus : restore_french_accents d'avant 20261031_accents_protected_segments,
#     identité SEO-Content absente, règle de scope retirée (contrôle préalable,
#     puis garde en 42501), scope de l'agent changé, cellule ou image modifiée,
#     champ protégé modifié, ligne supprimée, trigger désactivé, fonction
#     modifiée, objet absent, multiple ou non conforme, y compris au rejeu de la
#     montée et de la descente ;
#   - contrôle préalable (--precheck) sans écart sur l'état relevé.
#
# Environnement : conteneur PostgreSQL jetable, sans réseau (même majeure que la
# PROD). Ne touche JAMAIS une base réelle : aucune variable de connexion Supabase
# n'est lue, l'hôte est un conteneur local créé et détruit ici. Préfixe d'URL et
# identifiant d'agent fictifs.
#
# Usage   : bash scripts/db/test-editorial-filtre-huile-lot.sh
# Sortie  : 0 si toutes les assertions passent, 1 si une échoue, 2 si fatal.
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DOSSIER="$ROOT/docs/audits/editorial-filtre-huile-20261030"
GEN="$DOSSIER/tools/build-publication-migration.cjs"
FIXTURE="$ROOT/scripts/db/editorial-filtre-huile-lot-fixture.sql"
ALPHA="$ROOT/backend/supabase/migrations/20261031_accents_protected_segments.sql"
LOT="$ROOT/backend/supabase/migrations/20261031_editorial_filtre_huile_pg7"
IMAGE="${PGIMAGE:-postgres:17-alpine}"
CT="editorial-lot-test-$$"

command -v docker >/dev/null || { echo "FATAL: docker requis"; exit 2; }
command -v node >/dev/null || { echo "FATAL: node requis"; exit 2; }
for f in "$GEN" "$FIXTURE" "$ALPHA" "${LOT}_textes.sql" "${LOT}_textes.down.sql" "${LOT}_images.sql" "${LOT}_images.down.sql"; do
  [[ -f "$f" ]] || { echo "FATAL: fichier absent: $f"; exit 2; }
done

TMP="$(mktemp -d)"
# Only remove the container created by this invocation and its anonymous data.
CT_ID=""
cleanup() { if [[ -n "$CT_ID" ]]; then docker rm -fv "$CT_ID" >/dev/null 2>&1 || true; fi; rm -rf "$TMP"; }
trap cleanup EXIT

pass=0; fail=0
assert() {
  if [[ "$2" == "$3" ]]; then echo "  PASS  $1 → $3"; pass=$((pass+1))
  else echo "  FAIL  $1 → obtenu '$3', attendu '$2'"; fail=$((fail+1)); fi
}
# assert_err <libellé> <fragment attendu du message> <sortie> <code>
assert_err() {
  if [[ "$4" -ne 0 && "$3" == *"$2"* ]]; then echo "  PASS  $1 → refusé ($2)"; pass=$((pass+1))
  else echo "  FAIL  $1 → code $4, sortie '${3:0:300}', attendu un refus contenant '$2'"; fail=$((fail+1)); fi
}
# assert_ok <libellé> <fragment attendu de la sortie> <sortie> <code>
assert_ok() {
  if [[ "$4" -eq 0 && "$3" == *"$2"* ]]; then echo "  PASS  $1 → $2"; pass=$((pass+1))
  else echo "  FAIL  $1 → code $4, sortie '${3:0:300}', attendu un succès contenant '$2'"; fail=$((fail+1)); fi
}

# --- Préparation, sans conteneur ---------------------------------------------
node "$GEN" --check >"$TMP/check.out" 2>&1; GEN_CHECK=$?
node "$GEN" --fixture-data "$TMP" >/dev/null || { echo "FATAL: --fixture-data"; exit 2; }
node "$GEN" --og --out-dir "$TMP" >/dev/null || { echo "FATAL: --og"; exit 2; }
node "$GEN" --precheck "$TMP/precheck.sql" >/dev/null || { echo "FATAL: --precheck"; exit 2; }
OG="$TMP/20261031_editorial_filtre_huile_pg7_og"
[[ -f "$OG.sql" && -f "$OG.down.sql" ]] || { echo "FATAL: C-og non écrit"; exit 2; }

# Les données sont chargées avant les triggers : l'état relevé reste intact.
sed '/^-- @@ triggers$/,$d' "$FIXTURE" >"$TMP/schema.sql"
sed -n '/^-- @@ triggers$/,$p' "$FIXTURE" >"$TMP/triggers.sql"

# Variantes : chacune retire une seule protection de la migration du dépôt.
grep -v -- '-- identité-agent$' "${LOT}_textes.sql" >"$TMP/textes-sans-identite.sql"
grep -v -- '-- identité-agent$' "${LOT}_images.sql" >"$TMP/images-sans-identite.sql"
sed '/-- debut-controle-regles$/,/-- fin-controle-regles$/d' "${LOT}_textes.sql" >"$TMP/textes-sans-controle-regles.sql"
lines() { wc -l <"$1"; }

# Schéma « banc » : références tirées du lot (publication-batch.json,
# assets.json, avant-textes.json, fichiers d'images), sans le SQL du générateur.
DOSSIER="$DOSSIER" node - >"$TMP/banc.sql" <<'NODE' || { echo "FATAL: schéma banc"; exit 2; }
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const D = process.env.DOSSIER;
const json = (f) => JSON.parse(fs.readFileSync(path.join(D, 'integration', f), 'utf8'));
const batch = json('publication-batch.json');
const assets = json('assets.json');
const avant = json('avant-textes.json');
const lit = (s) => (s === null || s === undefined ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const ident = (s) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error(`identifiant inattendu ${s}`);
  return s;
};
const PREFIX = 'https://banc.invalid/storage/v1/object/public/uploads/';
const WHERE = {
  __seo_r1_gamme_slots: () => `r1s_pg_id = '7'`,
  __seo_gamme: () => `sg_pg_id = '7'`,
  __seo_gamme_conseil: (cle) => `sgc_pg_id = '7' AND sgc_id = ${lit(cle.sgc_id)}`,
};
const valueOf = (table, col, cle) => `(SELECT ${ident(col)}::text FROM public.${ident(table)} WHERE ${WHERE[table](cle || {})})`;

const cells = batch.cibles_texte.map((c) => {
  const k = c.table === '__seo_r1_gamme_slots' ? `r1s/${c.colonne}`
    : c.table === '__seo_gamme' ? `sg/${c.colonne}`
    : `sgc/${c.cle.sgc_id}/${c.colonne}`;
  return { k, table: c.table, col: c.colonne, sgc: (c.cle && c.cle.sgc_id) || null, cle: c.cle,
           trig: c.trigger_accents.startsWith('point fixe'), ha: c.avant.sha256, hp: c.apres.sha256 };
});
if (cells.length !== 50) throw new Error(`${cells.length} cellules, 50 attendues`);
const prot = batch.champs_proteges_inchanges;
if (prot.length !== 4) throw new Error(`${prot.length} champs protégés, 4 attendus`);
const r1sCols = cells.filter((c) => c.table === '__seo_r1_gamme_slots').map((c) => c.col);
const sgCols = cells.filter((c) => c.table === '__seo_gamme').map((c) => c.col);
const sgcIds = [...new Set(cells.filter((c) => c.sgc).map((c) => c.sgc))];
const sgcCols = [...new Set(cells.filter((c) => c.sgc).map((c) => c.col))];
const arr = (cols) => `ARRAY[${cols.map((c) => lit(ident(c))).join(', ')}]::text[]`;

const rows = { R1: new Map(avant.images.r1.map((r) => [r.rip_id, r])), R3: new Map(avant.images.r3.map((r) => [r.rip_id, r])) };
const images = assets.visuels.map((v) => {
  const r = rows[v.page].get(v.rip_id);
  if (!r) throw new Error(`rip_id ${v.rip_id} absent du relevé`);
  const tbl = v.page === 'R1' ? 'r1' : 'r3';
  const og = (tbl === 'r1' && v.slot === 'OG') || (tbl === 'r3' && v.slot === 'HERO');
  const file = v.fichier ? path.join(D, v.fichier) : null;
  const md5 = file ? crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex') : null;
  return `(${lit(tbl)}, ${v.rip_id}, ${og}, ${file === null}, ${lit(md5)}, ${file ? fs.statSync(file).size : 'NULL'}, ${lit(v.alt)},
   ${'caption' in v}, ${lit('caption' in v ? v.caption : null)}, ${lit(r.chemin)}, ${lit(r.rip_alt_text)}, ${lit(r.rip_caption)})`;
});

const jsonRows = (from, order) => `(SELECT string_agg(to_jsonb(x)::text, E'\\n' ORDER BY ${order}) FROM ${from} x)`;
process.stdout.write(`-- Schéma banc : références du lot et lectures de l'état, hors SQL du générateur.
CREATE SCHEMA banc;
CREATE FUNCTION banc.sha(text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT encode(sha256(convert_to($1, 'UTF8')), 'hex') $$;

CREATE TABLE banc.cellule (k text PRIMARY KEY, tbl text NOT NULL, col text NOT NULL, sgc_id text, trig boolean NOT NULL,
                           h_avant text NOT NULL, h_apres text NOT NULL, h_retour text);
INSERT INTO banc.cellule (k, tbl, col, sgc_id, trig, h_avant, h_apres) VALUES
${cells.map((c) => `  (${lit(c.k)}, ${lit(c.table)}, ${lit(c.col)}, ${lit(c.sgc)}, ${c.trig}, '${c.ha}', '${c.hp}')`).join(',\n')};

CREATE VIEW banc.valeur AS
${cells.map((c) => `SELECT ${lit(c.k)}::text AS k, ${valueOf(c.table, c.col, c.cle)} AS v`).join('\nUNION ALL ')};

CREATE VIEW banc.etat AS
SELECT c.k, CASE WHEN v.v IS NULL THEN 'ABSENT'
                 WHEN banc.sha(v.v) = c.h_apres THEN 'APRES'
                 WHEN banc.sha(v.v) = c.h_avant THEN 'AVANT'
                 WHEN banc.sha(v.v) = c.h_retour THEN 'RETOUR'
                 ELSE 'AUTRE' END AS classe
  FROM banc.cellule c JOIN banc.valeur v ON v.k = c.k;

CREATE FUNCTION banc.resume() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT string_agg(classe || '=' || n, ' ' ORDER BY classe COLLATE "C")
    FROM (SELECT classe, count(*) AS n FROM banc.etat GROUP BY classe) x $$;

-- Après un retour : RETOUR exactement sur les cellules que le trigger d'accents réécrit.
CREATE FUNCTION banc.retour_ecarts() RETURNS bigint LANGUAGE sql STABLE AS $$
  SELECT count(*) FROM banc.etat e JOIN banc.cellule c ON c.k = e.k
   WHERE e.classe NOT IN ('AVANT', 'RETOUR')
      OR (e.classe = 'RETOUR') IS DISTINCT FROM (c.trig AND c.h_retour IS DISTINCT FROM c.h_avant) $$;

CREATE FUNCTION banc.proteges() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT count(*) FILTER (WHERE banc.sha(x.v) = x.sha) || '/' || count(*) FROM (VALUES
${prot.map((p) => `    (${valueOf(p.table, p.colonne, p.cle)}, '${p.sha256}')`).join(',\n')}
  ) x(v, sha) $$;

-- Toutes les colonnes des trois tables, sauf les cellules du lot et r1s_updated_at.
CREATE FUNCTION banc.hors_cible() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT md5(concat_ws(E'\\n',
    (SELECT string_agg((to_jsonb(s) - ${arr([...r1sCols, 'r1s_updated_at'])})::text, E'\\n' ORDER BY s.r1s_pg_id) FROM public.__seo_r1_gamme_slots s),
    (SELECT string_agg((to_jsonb(g) - ${arr(sgCols)})::text, E'\\n' ORDER BY g.sg_id) FROM public.__seo_gamme g),
    (SELECT string_agg(CASE WHEN c.sgc_id IN (${sgcIds.map(lit).join(', ')}) THEN to_jsonb(c) - ${arr(sgcCols)} ELSE to_jsonb(c) END::text,
                       E'\\n' ORDER BY c.sgc_id COLLATE "C") FROM public.__seo_gamme_conseil c))) $$;

CREATE FUNCTION banc.caches() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT string_agg(x, ' ' ORDER BY x COLLATE "C") FROM (
    SELECT 'gpc:' || pg_id || '=' || CASE WHEN stale THEN 't' ELSE 'f' END AS x FROM public.__gamme_page_cache
    UNION ALL
    SELECT 'r1rb:' || pg_id || '=' || CASE WHEN stale THEN 't' ELSE 'f' END FROM public.__seo_r1_related_blocks_cache) c $$;

CREATE FUNCTION banc.objets() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT md5(${jsonRows('storage.objects', 'to_jsonb(x)::text COLLATE "C"')}) $$;

-- Empreinte de tout ce que le lot peut toucher, violations de scope comprises.
CREATE FUNCTION banc.tout() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT md5(concat_ws(E'\\n',
    ${['public.__seo_r1_gamme_slots', 'public.__seo_gamme', 'public.__seo_gamme_conseil', 'public.__seo_r1_image_prompts',
       'public.__seo_r3_image_prompts', 'public.agent_scope_table_rules', 'public.agent_write_scopes',
       'public.__gamme_page_cache', 'public.__seo_r1_related_blocks_cache', 'public.write_scope_violations']
      .map((t) => jsonRows(t, 'to_jsonb(x)::text COLLATE "C"')).join(',\n    ')},
    banc.objets())) $$;

-- Images : ligne entière par md5, relevée sur l'état chargé.
CREATE VIEW banc.ligne_cur AS
SELECT 'r1'::text AS tbl, i.rip_id, md5(to_jsonb(i)::text) AS h FROM public.__seo_r1_image_prompts i
UNION ALL
SELECT 'r3'::text, i.rip_id, md5(to_jsonb(i)::text) FROM public.__seo_r3_image_prompts i;
CREATE TABLE banc.ligne_avant AS SELECT * FROM banc.ligne_cur;
CREATE FUNCTION banc.lignes_changees() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(string_agg(tbl || ':' || rip_id, ',' ORDER BY tbl, rip_id), '')
    FROM banc.ligne_avant a FULL JOIN banc.ligne_cur c USING (tbl, rip_id)
   WHERE a.h IS DISTINCT FROM c.h $$;

CREATE TABLE banc.image_ref (tbl text, rip_id integer, og boolean, deselect boolean, md5 text, taille bigint, alt text,
                             a_legende boolean, legende text, chemin_avant text, alt_avant text, legende_avant text,
                             PRIMARY KEY (tbl, rip_id));
INSERT INTO banc.image_ref VALUES
${images.map((l) => `  ${l}`).join(',\n')};
CREATE VIEW banc.image_cur AS
SELECT 'r1'::text AS tbl, rip_id, rip_image_url AS url, rip_alt_text AS alt, rip_caption AS caption, rip_status AS status, rip_selected AS selected
  FROM public.__seo_r1_image_prompts WHERE rip_pg_id = 7
UNION ALL
SELECT 'r3'::text, rip_id, rip_image_url, rip_alt_text, rip_caption, rip_status, rip_selected
  FROM public.__seo_r3_image_prompts WHERE rip_pg_id = 7;

-- Lignes (og ou non) qui ne sont pas dans l'état écrit attendu ; '' si toutes le sont.
CREATE FUNCTION banc.images_ko(p_og boolean) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(string_agg(r.tbl || ':' || r.rip_id, ',' ORDER BY r.tbl, r.rip_id), '')
    FROM banc.image_ref r LEFT JOIN banc.image_cur c USING (tbl, rip_id)
   WHERE r.og = p_og AND NOT coalesce(CASE WHEN r.deselect THEN
           c.url IS NOT DISTINCT FROM ${lit(PREFIX)} || r.chemin_avant
           AND c.status = 'pending' AND NOT c.selected
           AND c.alt IS NOT DISTINCT FROM r.alt_avant AND c.caption IS NOT DISTINCT FROM r.legende_avant
         ELSE
           c.url LIKE ${lit(PREFIX + '%-v20261031.webp')}
           AND c.url IS DISTINCT FROM ${lit(PREFIX)} || r.chemin_avant
           AND c.status = 'approved' AND c.selected
           AND c.alt = r.alt
           AND c.caption IS NOT DISTINCT FROM CASE WHEN r.a_legende THEN r.legende ELSE r.legende_avant END
           AND (SELECT count(*) FROM storage.objects o
                 WHERE o.bucket_id = 'uploads' AND o.name = substr(c.url, ${PREFIX.length + 1})
                   AND NOT coalesce(o.is_delete_marker, false)
                   AND trim(both '"' from o.metadata->>'eTag') = r.md5
                   AND o.metadata->>'size' = r.taille::text
                   AND o.metadata->>'mimetype' = 'image/webp'
                   AND o.metadata->>'cacheControl' = 'max-age=31536000') = 1
         END, false) $$;

CREATE TABLE banc.ref (k text PRIMARY KEY, v text NOT NULL);
INSERT INTO banc.ref VALUES
  ('r1s_updated_at', (SELECT r1s_updated_at::text FROM public.__seo_r1_gamme_slots WHERE r1s_pg_id = '7')),
  ('sg_updated_at', (SELECT sg_updated_at::text FROM public.__seo_gamme WHERE sg_pg_id = '7')),
  ('hors_cible', banc.hors_cible()),
  ('objets', banc.objets());
`);
NODE

# --- Conteneur ---------------------------------------------------------------
echo "Image     : $IMAGE"
echo "Lot       : ${LOT#"$ROOT"/}_{textes,images}[.down].sql, C-og généré hors dépôt"
CT_ID="$(docker run -d --network none --memory 512m --memory-swap 512m --cpus 1 --pids-limit 128 --name "$CT" -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test "$IMAGE")" || exit 2
# Prêt = le serveur DÉFINITIF répond sur TCP. Le serveur temporaire que l'image
# lance pour son initialisation n'écoute que la socket Unix : sonder la socket
# rend la main pendant l'init, puis le serveur s'arrête sous la fixture.
ready() { docker exec "$CT" pg_isready -h 127.0.0.1 -U postgres -d test >/dev/null 2>&1; }
for _ in $(seq 1 60); do ready && break; sleep 1; done
ready || { echo "FATAL: postgres non prêt"; exit 2; }
echo "PostgreSQL: $(docker exec "$CT" psql -U postgres -d test -tAc 'SHOW server_version')"
echo

# run <base> <fichier> [options psql] : sortie et NOTICE mêlées, code psql rendu.
run() { local db="$1" f="$2"; shift 2; docker exec -i "$CT" psql -U postgres -d "$db" -v ON_ERROR_STOP=1 -q "$@" -f - <"$f" 2>&1; }
qd() { docker exec -i "$CT" psql -U postgres -d "$1" -v ON_ERROR_STOP=1 -qtA -c "$2" 2>&1; }
# Chaque cas part d'une copie de son gabarit (CREATE DATABASE … TEMPLATE).
clone() { qd postgres "CREATE DATABASE $1 TEMPLATE $2" >/dev/null || { echo "FATAL: copie $2 → $1"; exit 2; }; }
tout() { qd "$1" "SELECT banc.tout()"; }

cat "$TMP/schema.sql" "$TMP/donnees.sql" "$TMP/banc.sql" "$TMP/triggers.sql" >"$TMP/gabarit.sql"
qd postgres "CREATE DATABASE tpl" >/dev/null || { echo "FATAL: base tpl"; exit 2; }
out=$(run tpl "$TMP/gabarit.sql" -1) || { echo "FATAL: gabarit : ${out:0:2000}"; exit 2; }

echo "1. Préparation"
assert "générateur --check : migrations du dépôt à jour" 0 "$GEN_CHECK"
assert "fixture : 14 triggers relevés" 14 "$(grep -c '^CREATE TRIGGER ' "$TMP/triggers.sql")"
assert "variante sans identité (textes) : 1 ligne retirée" 1 "$(( $(lines "${LOT}_textes.sql") - $(lines "$TMP/textes-sans-identite.sql") ))"
assert "variante sans identité (images) : 1 ligne retirée" 1 "$(( $(lines "${LOT}_images.sql") - $(lines "$TMP/images-sans-identite.sql") ))"
assert "variante sans contrôle des règles : bloc retiré" 1 "$(( $(lines "${LOT}_textes.sql") - $(lines "$TMP/textes-sans-controle-regles.sql") > 5 ))"
for f in "${LOT}_textes.down.sql" "${LOT}_images.down.sql" "$OG.down.sql"; do
  assert "${f##*/} auto-transactionnel (BEGIN|COMMIT|SET LOCAL)" "1|1|3" \
    "$(grep -c '^BEGIN;$' "$f")|$(grep -c '^COMMIT;$' "$f")|$(grep -c '^SET LOCAL ' "$f")"
done
for f in "${LOT}_textes.sql" "${LOT}_images.sql" "$OG.sql"; do
  assert "${f##*/} sans BEGIN ni COMMIT (moteur en transaction)" "0|0" "$(grep -c '^BEGIN;$' "$f")|$(grep -c '^COMMIT;$' "$f")"
done
assert "gabarit : 50 cellules à la valeur relevée" "AVANT=50" "$(qd tpl "SELECT banc.resume()")"
assert "gabarit : champs protégés au sha256 du lot" "4/4" "$(qd tpl "SELECT banc.proteges()")"
assert "gabarit : caches frais" "gpc:7=f gpc:8=f r1rb:7=f r1rb:8=f" "$(qd tpl "SELECT banc.caches()")"

echo
echo "2. Textes sans la version α de restore_french_accents"
clone t1 tpl
avant=$(tout t1)
out=$(run t1 "${LOT}_textes.sql" -1); rc=$?
assert_err "textes avant α" "n'est pas la version de 20261031_accents_protected_segments" "$out" "$rc"
assert "état inchangé" "$avant" "$(tout t1)"

clone tpl_alpha tpl
out=$(run tpl_alpha "$ALPHA" -1) || { echo "FATAL: α : ${out:0:2000}"; exit 2; }
assert "α appliquée : 50 cellules toujours à la valeur relevée" "AVANT=50" "$(qd tpl_alpha "SELECT banc.resume()")"
# Forme que le trigger d'accents (α) donnerait à chaque valeur relevée : état RETOUR.
qd tpl_alpha "UPDATE banc.cellule c SET h_retour = banc.sha(restore_french_accents(v.v)) FROM banc.valeur v WHERE v.k = c.k AND c.trig" >/dev/null \
  || { echo "FATAL: h_retour"; exit 2; }
echo "  info  cellules dont la valeur relevée n'est pas un point fixe du trigger : $(qd tpl_alpha "SELECT count(*) FROM banc.cellule WHERE trig AND h_retour <> h_avant")"

echo
echo "3. Contrôle préalable (--precheck) sur l'état relevé"
avant=$(tout tpl_alpha)
out=$(run tpl_alpha "$TMP/precheck.sql" -tA); rc=$?
assert "contrôle préalable exécuté" 0 "$rc$( [[ $rc -ne 0 ]] && grep -m1 ERROR <<<"$out" | sed 's/^/ : /')"
assert "aucun écart (KO, ABSENT, INATTENDU, absent, multiple, non conforme)" 0 \
  "$(grep -cE '\|(KO|ABSENT|INATTENDU|ancienne)|absent|multiple|non conforme' <<<"$out")"
assert "restore_french_accents = α" 1 "$(grep -c '^pin|restore_french_accents(text)|alpha$' <<<"$out")"
assert "50 cellules AVANT" 50 "$(grep -c '^cellule|.*|AVANT$' <<<"$out")"
assert "8 images AVANT" 8 "$(grep -c '^image|.*|AVANT$' <<<"$out")"
assert "lecture seule : état inchangé" "$avant" "$(tout tpl_alpha)"

echo
echo "4. Textes : écriture, relecture, rejeu, retour, rejeu du retour, nouvelle écriture"
clone c_textes tpl_alpha
out=$(run c_textes "${LOT}_textes.sql" -1); rc=$?
assert_ok "montée" "50 cellules écrites et relues" "$out" "$rc"
assert "50 cellules au sha256 « après » du lot" "APRES=50" "$(qd c_textes "SELECT banc.resume()")"
assert "champs protégés inchangés (H1, title, meta, META)" "4/4" "$(qd c_textes "SELECT banc.proteges()")"
assert "colonnes hors lot inchangées" t "$(qd c_textes "SELECT banc.hors_cible() = v FROM banc.ref WHERE k = 'hors_cible'")"
assert "sg_updated_at non touché" t "$(qd c_textes "SELECT sg_updated_at::text = (SELECT v FROM banc.ref WHERE k = 'sg_updated_at') FROM __seo_gamme")"
assert "r1s_updated_at avancé par son trigger" t "$(qd c_textes "SELECT r1s_updated_at > (SELECT v::timestamptz FROM banc.ref WHERE k = 'r1s_updated_at') FROM __seo_r1_gamme_slots")"
assert "caches de pg 7 invalidés, pg 8 intact" "gpc:7=t gpc:8=f r1rb:7=t r1rb:8=f" "$(qd c_textes "SELECT banc.caches()")"
assert "images et objets intacts" "|true" "$(qd c_textes "SELECT banc.lignes_changees() || '|' || (banc.objets() = (SELECT v FROM banc.ref WHERE k = 'objets'))")"
assert "aucune violation de scope" 0 "$(qd c_textes "SELECT count(*) FROM write_scope_violations")"
avant=$(tout c_textes)
out=$(run c_textes "${LOT}_textes.sql" -1); rc=$?
assert_ok "rejeu de la montée" "déjà écrit, rejeu sans effet" "$out" "$rc"
assert "rejeu : état inchangé" "$avant" "$(tout c_textes)"
out=$(run c_textes "${LOT}_textes.down.sql"); rc=$?
assert_ok "descente" "cellules remises à la valeur relevée" "$out" "$rc"
assert "chaque cellule à sa valeur relevée, ou à sa forme accentuée si le trigger la réécrit" 0 "$(qd c_textes "SELECT banc.retour_ecarts()")"
echo "  info  cellules en RETOUR : $(qd c_textes "SELECT coalesce(string_agg(k, ', ' ORDER BY k COLLATE \"C\"), '-') FROM banc.etat WHERE classe = 'RETOUR'")"
assert "descente : champs protégés inchangés" "4/4" "$(qd c_textes "SELECT banc.proteges()")"
assert "descente : colonnes hors lot inchangées" t "$(qd c_textes "SELECT banc.hors_cible() = v FROM banc.ref WHERE k = 'hors_cible'")"
assert "descente : r1s_updated_at non restauré (trigger)" t "$(qd c_textes "SELECT r1s_updated_at > (SELECT v::timestamptz FROM banc.ref WHERE k = 'r1s_updated_at') FROM __seo_r1_gamme_slots")"
assert "descente : aucune violation de scope" 0 "$(qd c_textes "SELECT count(*) FROM write_scope_violations")"
avant=$(tout c_textes)
out=$(run c_textes "${LOT}_textes.down.sql"); rc=$?
assert_ok "rejeu de la descente" "aucune cellule écrite par le lot, sans effet" "$out" "$rc"
assert "rejeu de la descente : état inchangé" "$avant" "$(tout c_textes)"
out=$(run c_textes "${LOT}_textes.sql" -1); rc=$?
assert_ok "nouvelle montée après la descente (états RETOUR admis)" "50 cellules écrites et relues" "$out" "$rc"
assert "nouvelle montée : 50 cellules « après »" "APRES=50" "$(qd c_textes "SELECT banc.resume()")"

echo
echo "5. Textes : refus, sans aucune écriture"
clone t3 tpl_alpha
avant=$(tout t3)
out=$(run t3 "$TMP/textes-sans-identite.sql" -1); rc=$?
assert_err "sans en-tête x-agent-id" "identité SEO-Content non résolue" "$out" "$rc"
assert "état inchangé" "$avant" "$(tout t3)"

clone t4 tpl_alpha
qd t4 "DELETE FROM agent_scope_table_rules WHERE table_pattern = '__seo_gamme_conseil'" >/dev/null
avant=$(tout t4)
out=$(run t4 "$TMP/textes-sans-controle-regles.sql" -1); rc=$?
assert_err "règle retirée, contrôle préalable ôté : la garde refuse sous l'identité" "write_scope_violation" "$out" "$rc"
assert "état inchangé (deux UPDATE déjà faits annulés)" "$avant" "$(tout t4)"
out=$(qd t4 "BEGIN; UPDATE __seo_gamme_conseil SET sgc_order = sgc_order WHERE sgc_pg_id = '7'; ROLLBACK;"); rc=$?
assert "constat, garde inchangée : sans x-agent-id, UPDATE admis sans règle (fail-open)" 0 "$rc"

clone t5 tpl_alpha
qd t5 "DELETE FROM agent_scope_table_rules WHERE table_pattern = '__seo_gamme_conseil'" >/dev/null
avant=$(tout t5)
out=$(run t5 "${LOT}_textes.sql" -1); rc=$?
assert_err "règle de scope retirée" "n'autorise pas UPDATE sur __seo_gamme_conseil" "$out" "$rc"
assert "état inchangé" "$avant" "$(tout t5)"

clone t6 tpl_alpha
qd t6 "UPDATE agent_write_scopes SET write_scope = 'qa_tables' WHERE agent_name = 'SEO-Content'" >/dev/null
avant=$(tout t6)
out=$(run t6 "${LOT}_textes.sql" -1); rc=$?
assert_err "scope de l'agent changé" "agent SEO-Content : 1 ligne(s), scope qa_tables" "$out" "$rc"
assert "état inchangé" "$avant" "$(tout t6)"

SGC1=$(qd tpl "SELECT min(sgc_id) FROM banc.cellule WHERE sgc_id IS NOT NULL")
clone t7 tpl_alpha
qd t7 "UPDATE __seo_gamme_conseil SET sgc_sources = 'modifié hors lot' WHERE sgc_pg_id = '7' AND sgc_id = '$SGC1'" >/dev/null
avant=$(tout t7)
out=$(run t7 "${LOT}_textes.sql" -1); rc=$?
assert_err "cellule modifiée depuis le relevé" "cellule(s) modifiée(s) depuis le relevé : sgc/$SGC1/sgc_sources DERIVE" "$out" "$rc"
assert "état inchangé" "$avant" "$(tout t7)"

clone t8 c_textes
qd t8 "UPDATE __seo_gamme_conseil SET sgc_sources = 'modifié après le lot' WHERE sgc_pg_id = '7' AND sgc_id = '$SGC1'" >/dev/null
avant=$(tout t8)
out=$(run t8 "${LOT}_textes.down.sql"); rc=$?
assert_err "descente sur une cellule modifiée après le lot" "cellule(s) modifiée(s) depuis l'écriture du lot : sgc/$SGC1/sgc_sources DERIVE" "$out" "$rc"
assert "état inchangé" "$avant" "$(tout t8)"

clone t9 tpl_alpha
qd t9 "UPDATE __seo_r1_gamme_slots SET r1s_h1_override = r1s_h1_override || ' (modifié)' WHERE r1s_pg_id = '7'" >/dev/null
avant=$(tout t9)
out=$(run t9 "${LOT}_textes.sql" -1); rc=$?
assert_err "H1 modifié" "champ(s) protégé(s) différent(s) du relevé ou réécrit(s) par le trigger d'accents : r1s_h1_override" "$out" "$rc"
assert "état inchangé" "$avant" "$(tout t9)"

clone t10 tpl_alpha
qd t10 "DELETE FROM __seo_gamme_conseil WHERE sgc_pg_id = '7' AND sgc_id = '$SGC1'" >/dev/null
avant=$(tout t10)
out=$(run t10 "${LOT}_textes.sql" -1); rc=$?
assert_err "section R3 supprimée" "ligne(s) __seo_gamme_conseil pg 7, 12 attendues" "$out" "$rc"
assert "état inchangé" "$avant" "$(tout t10)"

clone t11 tpl_alpha
qd t11 "ALTER TABLE __seo_gamme_conseil DISABLE TRIGGER USER" >/dev/null
avant=$(tout t11)
out=$(run t11 "${LOT}_textes.sql" -1); rc=$?
assert_err "triggers désactivés" "triggers de pg 7 (textes) différents du relevé" "$out" "$rc"
assert "état inchangé" "$avant" "$(tout t11)"

clone t12 tpl_alpha
qd t12 "ALTER FUNCTION invalidate_r1_caches(integer, text, text) SECURITY INVOKER" >/dev/null
avant=$(tout t12)
out=$(run t12 "${LOT}_textes.sql" -1); rc=$?
assert_err "fonction d'invalidation modifiée" "différente(s) du relevé du 2026-10-31 : public.invalidate_r1_caches(integer,text,text)" "$out" "$rc"
assert "état inchangé" "$avant" "$(tout t12)"

echo
echo "6. Images (C) : écriture, relecture, rejeu, retour à l'octet, rejeu du retour, nouvelle écriture"
clone c_img tpl_alpha
out=$(run c_img "${LOT}_images.sql" -1); rc=$?
assert_ok "montée" "6 ligne(s) écrites et relues" "$out" "$rc"
assert "6 lignes dans l'état écrit attendu (chemin versionné, objet au md5 du fichier, alt, légende, LOCATION désélectionnée)" "" "$(qd c_img "SELECT banc.images_ko(false)")"
assert "seules les 6 lignes du plan ont changé" "r1:31,r1:32,r1:33,r1:34,r3:13,r3:14" "$(qd c_img "SELECT banc.lignes_changees()")"
assert "cache de page pg 7 invalidé, pg 8 et blocs liés intacts" "gpc:7=t gpc:8=f r1rb:7=f r1rb:8=f" "$(qd c_img "SELECT banc.caches()")"
assert "textes et objets intacts" "AVANT=50|true" "$(qd c_img "SELECT banc.resume() || '|' || (banc.objets() = (SELECT v FROM banc.ref WHERE k = 'objets'))")"
assert "aucune violation de scope" 0 "$(qd c_img "SELECT count(*) FROM write_scope_violations")"
avant=$(tout c_img)
out=$(run c_img "${LOT}_images.sql" -1); rc=$?
assert_ok "rejeu de la montée" "déjà écrit, sans effet" "$out" "$rc"
assert "rejeu : état inchangé" "$avant" "$(tout c_img)"
out=$(run c_img "${LOT}_images.down.sql"); rc=$?
assert_ok "descente" "6 ligne(s) remises et relues" "$out" "$rc"
assert "descente : lignes identiques à l'octet au relevé" "" "$(qd c_img "SELECT banc.lignes_changees()")"
avant=$(tout c_img)
out=$(run c_img "${LOT}_images.down.sql"); rc=$?
assert_ok "rejeu de la descente" "aucune ligne écrite par le lot, sans effet" "$out" "$rc"
assert "rejeu de la descente : état inchangé" "$avant" "$(tout c_img)"
out=$(run c_img "${LOT}_images.sql" -1); rc=$?
assert_ok "nouvelle montée après la descente" "6 ligne(s) écrites et relues" "$out" "$rc"
assert "nouvelle montée : état écrit attendu" "" "$(qd c_img "SELECT banc.images_ko(false)")"

echo
echo "7. Images og (C-og, accord séparé) : écriture, retour à l'octet"
clone c_og tpl_alpha
out=$(run c_og "$OG.sql" -1); rc=$?
assert_ok "montée" "2 ligne(s) écrites et relues" "$out" "$rc"
assert "R1 OG et R3 HERO dans l'état écrit attendu" "" "$(qd c_og "SELECT banc.images_ko(true)")"
assert "seules les 2 lignes og ont changé" "r1:35,r3:12" "$(qd c_og "SELECT banc.lignes_changees()")"
out=$(run c_og "$OG.down.sql"); rc=$?
assert_ok "descente" "2 ligne(s) remises et relues" "$out" "$rc"
assert "descente : lignes identiques à l'octet au relevé" "" "$(qd c_og "SELECT banc.lignes_changees()")"

echo
echo "8. Lot complet A, C, C-og, puis retours dans l'ordre inverse"
clone c_lot tpl_alpha
out=$(run c_lot "${LOT}_textes.sql" -1); rc=$?; assert_ok "A" "50 cellules écrites et relues" "$out" "$rc"
out=$(run c_lot "${LOT}_images.sql" -1); rc=$?; assert_ok "C" "6 ligne(s) écrites et relues" "$out" "$rc"
out=$(run c_lot "$OG.sql" -1); rc=$?;            assert_ok "C-og" "2 ligne(s) écrites et relues" "$out" "$rc"
assert "lot écrit : textes, images, og" "APRES=50|||4/4" \
  "$(qd c_lot "SELECT banc.resume() || '|' || banc.images_ko(false) || '|' || banc.images_ko(true) || '|' || banc.proteges()")"
assert "lot écrit : caches de pg 7 invalidés, pg 8 intact" "gpc:7=t gpc:8=f r1rb:7=t r1rb:8=f" "$(qd c_lot "SELECT banc.caches()")"
out=$(run c_lot "$OG.down.sql"); rc=$?;                 assert_ok "retour C-og" "2 ligne(s) remises et relues" "$out" "$rc"
out=$(run c_lot "${LOT}_images.down.sql"); rc=$?;       assert_ok "retour C" "6 ligne(s) remises et relues" "$out" "$rc"
out=$(run c_lot "${LOT}_textes.down.sql"); rc=$?;       assert_ok "retour A" "cellules remises à la valeur relevée" "$out" "$rc"
assert "retours : images à l'octet, textes AVANT ou RETOUR, protégés et hors lot intacts" "|0|4/4|true" \
  "$(qd c_lot "SELECT banc.lignes_changees() || '|' || banc.retour_ecarts() || '|' || banc.proteges() || '|' || (banc.hors_cible() = (SELECT v FROM banc.ref WHERE k = 'hors_cible'))")"
assert "aucune violation de scope sur tout le cycle" 0 "$(qd c_lot "SELECT count(*) FROM write_scope_violations")"

echo
echo "9. Images : refus, sans aucune écriture"
img_refus() { # <base> <préparation SQL> <fichier> <fragment attendu> <libellé> [gabarit]
  clone "$1" "${6:-tpl_alpha}"
  [[ -z "$2" ]] || qd "$1" "$2" >/dev/null
  local a o r
  a=$(tout "$1")
  if [[ "$3" == *.down.sql ]]; then o=$(run "$1" "$3"); else o=$(run "$1" "$3" -1); fi; r=$?
  assert_err "$5" "$4" "$o" "$r"
  assert "état inchangé" "$a" "$(tout "$1")"
}
img_refus i1 "DELETE FROM storage.objects WHERE name LIKE '%-v20261031.webp'" "${LOT}_images.sql" \
  "objet(s) à déposer avant l'application" "nouveaux objets non déposés"
img_refus i2 "UPDATE storage.objects SET metadata = jsonb_set(metadata, '{eTag}', '\"00000000000000000000000000000000\"') WHERE name = 'articles/gammes-produits/r1/filtre-a-huile-v20261031.webp'" \
  "${LOT}_images.sql" "articles/gammes-produits/r1/filtre-a-huile-v20261031.webp non conforme" "objet déposé au mauvais md5"
img_refus i3 "INSERT INTO storage.objects (bucket_id, name, metadata) SELECT bucket_id, name, metadata FROM storage.objects WHERE name = 'articles/gammes-produits/r3/filtre-a-huile-s2-v20261031.webp'" \
  "${LOT}_images.sql" "articles/gammes-produits/r3/filtre-a-huile-s2-v20261031.webp multiple" "objet en double"
img_refus i4 "DELETE FROM storage.objects WHERE name = 'articles/gammes-produits/r1/filtre-a-huile.webp'" "${LOT}_images.sql" \
  "retour arrière impossible : articles/gammes-produits/r1/filtre-a-huile.webp absent" "ancien objet R1 absent"
img_refus i5 "UPDATE __seo_r1_image_prompts SET rip_alt_text = 'modifié hors lot' WHERE rip_id = 32" "${LOT}_images.sql" \
  "ligne(s) image modifiée(s) depuis le relevé : r1:32 DERIVE" "ligne modifiée depuis le relevé"
img_refus i6 "" "$TMP/images-sans-identite.sql" "identité SEO-Content non résolue" "sans en-tête x-agent-id"
img_refus i7 "UPDATE __seo_r3_image_prompts SET rip_caption = 'modifiée après le lot' WHERE rip_id = 13" "${LOT}_images.down.sql" \
  "ligne(s) image modifiée(s) depuis l'écriture du lot : r3:13 DERIVE" "descente sur une ligne modifiée après le lot" c_img
img_refus i8 "DELETE FROM storage.objects WHERE name = 'articles/gammes-produits/r1/filtre-a-huile-2.webp'" "${LOT}_images.down.sql" \
  "ancien(s) objet(s) R1 absent(s) ou modifié(s) : articles/gammes-produits/r1/filtre-a-huile-2.webp absent" "descente sans l'ancien objet" c_img
img_refus i9 "DELETE FROM storage.objects WHERE name = 'articles/gammes-produits/r1/filtre-a-huile-v20261031.webp'" "${LOT}_images.sql" \
  "objet(s) à déposer avant l'application : articles/gammes-produits/r1/filtre-a-huile-v20261031.webp absent" "rejeu de la montée sans un objet servi" c_img
img_refus i10 "DELETE FROM storage.objects WHERE name = 'articles/gammes-produits/r1/filtre-a-huile-2.webp'" "${LOT}_images.down.sql" \
  "ancien(s) objet(s) R1 absent(s) ou modifié(s) : articles/gammes-produits/r1/filtre-a-huile-2.webp absent" "rejeu de la descente sans un objet servi"

echo
echo "Résultat : $pass PASS, $fail FAIL"
[[ $fail -eq 0 ]] || exit 1
