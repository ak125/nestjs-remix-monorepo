#!/usr/bin/env bash
# =============================================================================
# Test de rejeu de 20261119_xtr_supplier_link_pm_sources.sql (+ .down.sql),
# mandat DQ : sources d'achat ordonnées par marque.
#
# Prouve, sur les VRAIES migrations du dépôt (CH appliquée d'abord, comme en base) :
#   1. Additif : 6 colonnes sur ___xtr_supplier_link_pm et spl_fallback_mode sur
#      ___xtr_supplier, NULLABLES sans DEFAULT ; les lignes existantes sont
#      intactes (empreinte md5) et leurs nouvelles colonnes restent NULL.
#   2. Contraintes : rang < 1, nature hors liste, surcoût négatif, source classée
#      sans nature ou sans surcoût, lien non classé portant un surcoût, point de
#      livraison égal à la source ou inconnu (clé étrangère), auteur sans date,
#      repli hors liste, deux sources au même rang d'une marque : refusés.
#   3. Fonction supplier_brand_sources_put, trois cas du mandat :
#        CEVAM        : EXADIS rang 1 stock (lien créé), CEVAM rang 2 commande ;
#        MEAT & DORIA : OTTOGO rang 1 (lien créé), M&D rang 2 livré chez CS + 300 c ;
#        SASIC        : SASIC en direct, stock chez BG (rang 1) et chez DCA (rang 2).
#      Remplacement (lien déclassé gardé, rang NULL), liste vide, auteur et date
#      écrits ; refus : source archivée, à confirmer ou sans statut, point de
#      livraison archivé, marque ou fournisseur inconnu, lien d'une autre marque,
#      même lien deux fois, lien masqué, surcoût négatif, nature inconnue,
#      auteur vide. Un appel refusé laisse l'état précédent intact.
#   4. Droits : RLS toujours active, politiques et droits de table identiques ;
#      la fonction n'est exécutable que par service_role.
#   5. Rejeu idempotent (second passage sans effet ni erreur, rangs conservés).
#   6. Down : retire fonction, index, contraintes et colonnes ; forme des tables
#      et lignes historiques identiques à l'état d'avant ; puis la migration se
#      rejoue.
#
# Fixtures : scripts/db/supplier-fiche-columns-fixture.sql (CH) puis
# scripts/db/supplier-brand-sources-fixture.sql (données synthétiques).
#
# Environnement : conteneur PostgreSQL jetable, sans réseau ni écoute TCP,
# données sur tmpfs (--rm). Ne lit aucune variable de connexion Supabase, ne
# touche aucune base.
#
# Usage : bash scripts/db/test-supplier-brand-sources.sh
# Sortie : 0 si toutes les assertions passent ; 1 assertion fausse ; 2 environnement.
#
# Test de mutation (le test doit ÉCHOUER sur une migration affaiblie) :
#   sed '/CREATE UNIQUE INDEX/,/WHERE slpm_rank IS NOT NULL;/d' \
#     backend/supabase/migrations/20261119_xtr_supplier_link_pm_sources.sql > /tmp/mut.sql
#   MIGRATION_UNDER_TEST=/tmp/mut.sql bash scripts/db/test-supplier-brand-sources.sh
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIG="backend/supabase/migrations"
CH_FIXTURE="scripts/db/supplier-fiche-columns-fixture.sql"
CH_UP="$MIG/20261118_xtr_supplier_fiche_columns.sql"
FIXTURE="scripts/db/supplier-brand-sources-fixture.sql"
DOWN="$MIG/20261119_xtr_supplier_link_pm_sources.down.sql"
MIGRATION="${MIGRATION_UNDER_TEST:-$ROOT/$MIG/20261119_xtr_supplier_link_pm_sources.sql}"
IMAGE="${PGIMAGE:-postgres:17-alpine}"

command -v docker >/dev/null || { echo "FATAL: docker requis"; exit 2; }
for f in "$ROOT/$CH_FIXTURE" "$ROOT/$CH_UP" "$ROOT/$FIXTURE" "$ROOT/$DOWN" "$MIGRATION"; do
  [[ -f "$f" ]] || { echo "FATAL: fichier absent: $f"; exit 2; }
done
MIGRATION="$(cd "$(dirname "$MIGRATION")" && pwd)/$(basename "$MIGRATION")"

echo "Image : $IMAGE"
echo "Migration : $MIGRATION"
exec timeout 300 docker run --rm -i --network none --user postgres \
  --tmpfs /tmp:rw,size=256m \
  -v "$ROOT":/repo:ro -v "$MIGRATION":/t/migration.sql:ro \
  -e CH_FIXTURE="/repo/$CH_FIXTURE" -e CH_UP="/repo/$CH_UP" \
  -e FIXTURE="/repo/$FIXTURE" -e DOWN="/repo/$DOWN" \
  "$IMAGE" bash -s <<'INNER'
set -uo pipefail
fail() { echo "  FAIL  $*"; exit 1; }
export PGDATA=/tmp/pgdata
initdb -D "$PGDATA" -U postgres --auth=trust --no-locale -E UTF8 >/tmp/initdb.log 2>&1 \
  || { cat /tmp/initdb.log; echo "FATAL: initdb"; exit 2; }
pg_ctl -D "$PGDATA" -w -o "-c listen_addresses=''" -l /tmp/pg.log start >/dev/null \
  || { echo "FATAL: postgres non démarré"; exit 2; }
export PGOPTIONS='--client-min-messages=warning'
P() { psql -X -q -tA -o /dev/null -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }
q() { psql -X -q -U postgres -d postgres -v ON_ERROR_STOP=1 -tA -c "$1"; }
apply() { P -1 -f "$1" || fail "$2 en échec"; echo "  ok  $2"; }
manual() { P -f "$1" || fail "$2 en échec"; echo "  ok  $2"; }
eq() { [[ "$1" == "$2" ]] || fail "$3 : obtenu « $1 », attendu « $2 »"; echo "  ok  $3"; }
violates() { # violates <sql> <motif d'erreur> <libelle>
  local out
  if out=$(q "BEGIN; $1; ROLLBACK;" 2>&1); then fail "accepté à tort : $3"; fi
  [[ "$out" == *"$2"* ]] || fail "$3 : erreur inattendue : $out"
  echo "  ok  refusé : $3"
}
reject() { violates "$1" "violates check constraint" "$2"; }
refused() { # refused <sql> <motif attendu> <libelle> — erreur attendue, état inchangé
  local out before after
  before=$(q "$FP_SOURCES")
  if out=$(q "$1" 2>&1); then fail "accepté à tort : $3"; fi
  [[ "$out" == *"$2"* ]] || fail "$3 : erreur inattendue : $out"
  after=$(q "$FP_SOURCES")
  [[ "$before" == "$after" ]] || fail "$3 : l'état a changé malgré le refus"
  echo "  ok  refusé, état intact : $3"
}
put() { # put <pm> <json> <auteur> — appel comme le backend (rôle service_role)
  q "SET ROLE service_role; SELECT string_agg(link_id||':'||source_rank||':'||created, ',' ORDER BY source_rank) FROM public.supplier_brand_sources_put('$1', '$2'::jsonb, '$3');"
}
src() { # src <pm> : liste ordonnée « spl@livraison/nature/surcoût »
  q "SELECT coalesce(string_agg(slpm_rank||'='||slpm_spl_id||'@'||coalesce(slpm_delivery_spl_id,'-')||'/'||slpm_stock_kind||'/'||slpm_surcharge_cents, ' ' ORDER BY slpm_rank), '') FROM ___xtr_supplier_link_pm WHERE slpm_pm_id = '$1' AND slpm_rank IS NOT NULL"
}

FP_LINK="SELECT md5(string_agg(concat_ws('|',slpm_id,slpm_pm_id,slpm_spl_id,slpm_display), ';' ORDER BY slpm_id)) FROM ___xtr_supplier_link_pm"
FP_LINK_FIX="SELECT md5(string_agg(concat_ws('|',slpm_id,slpm_pm_id,slpm_spl_id,slpm_display), ';' ORDER BY slpm_id)) FROM ___xtr_supplier_link_pm WHERE slpm_id IN ('1','2','40','73','74','75','80','81','97')"
FP_SPL="SELECT md5(string_agg(concat_ws('|',spl_id,spl_name,spl_alias,spl_display,spl_sort,spl_status,spl_type,spl_supply_mode), ';' ORDER BY spl_id)) FROM ___xtr_supplier"
FP_SOURCES="SELECT md5(coalesce(string_agg(concat_ws('|',slpm_id,slpm_pm_id,slpm_spl_id,slpm_display,slpm_rank,slpm_delivery_spl_id,slpm_stock_kind,slpm_surcharge_cents,slpm_updated_by), ';' ORDER BY slpm_id), '')) FROM ___xtr_supplier_link_pm"
FN="public.supplier_brand_sources_put(text,jsonb,text)"
FNC="public.supplier_brand_sources_put"
SHAPE="SELECT md5(string_agg(table_name||'.'||column_name||':'||data_type||':'||is_nullable||':'||coalesce(column_default,''), ',' ORDER BY table_name, ordinal_position)) FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('___xtr_supplier','___xtr_supplier_link_pm')"
RIGHTS="SELECT md5(coalesce(string_agg(grantee||':'||table_name||':'||privilege_type, ',' ORDER BY grantee, table_name, privilege_type), '')) FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee IN ('anon','authenticated','service_role','PUBLIC')"
POLICIES="SELECT md5(string_agg(tablename||':'||policyname||':'||array_to_string(roles,'+')||':'||cmd, ',' ORDER BY tablename, policyname)) FROM pg_policies WHERE schemaname='public'"
NEW_COLS="'slpm_rank','slpm_delivery_spl_id','slpm_stock_kind','slpm_surcharge_cents','slpm_updated_at','slpm_updated_by','spl_fallback_mode'"

echo "PostgreSQL : $(q 'SHOW server_version')"
echo
P -f "$CH_FIXTURE" || { echo "FATAL: fixture CH"; exit 2; }
P -1 -f "$CH_UP" || { echo "FATAL: migration CH"; exit 2; }
P -f "$FIXTURE" || { echo "FATAL: fixture DQ"; exit 2; }
fp_link0=$(q "$FP_LINK"); fp_spl0=$(q "$FP_SPL"); shape0=$(q "$SHAPE")
rights0=$(q "$RIGHTS"); policies0=$(q "$POLICIES")

echo "Application"
apply /t/migration.sql "sources d'achat, 1er passage"

echo
echo "1. Additif"
eq "$(q "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND column_name IN ($NEW_COLS)")" "7" "7 colonnes ajoutées"
eq "$(q "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND column_name IN ($NEW_COLS) AND (is_nullable <> 'YES' OR column_default IS NOT NULL)")" "0" "toutes NULLABLES sans DEFAULT"
eq "$(q "SELECT string_agg(column_name||':'||data_type, ',' ORDER BY column_name) FROM information_schema.columns WHERE table_schema='public' AND column_name IN ('slpm_rank','slpm_surcharge_cents')")" "slpm_rank:bigint,slpm_surcharge_cents:bigint" "entiers en bigint"
eq "$(q "$FP_LINK")" "$fp_link0" "liens existants intacts (empreinte md5)"
eq "$(q "$FP_SPL")" "$fp_spl0" "fiches existantes intactes (empreinte md5)"
eq "$(q "SELECT count(*) FROM ___xtr_supplier_link_pm WHERE slpm_rank IS NOT NULL OR slpm_delivery_spl_id IS NOT NULL OR slpm_stock_kind IS NOT NULL OR slpm_surcharge_cents IS NOT NULL OR slpm_updated_at IS NOT NULL OR slpm_updated_by IS NOT NULL")" "0" "aucune valeur écrite sur les liens"
eq "$(q "SELECT count(*) FROM ___xtr_supplier WHERE spl_fallback_mode IS NOT NULL")" "0" "aucun repli écrit sur les fiches"

echo
echo "2. Contraintes"
OK_SRC="slpm_rank=1, slpm_stock_kind='stock', slpm_surcharge_cents=0"
reject "UPDATE ___xtr_supplier_link_pm SET slpm_rank=0, slpm_stock_kind='stock', slpm_surcharge_cents=0 WHERE slpm_id='40'" "rang 0"
reject "UPDATE ___xtr_supplier_link_pm SET slpm_rank=1, slpm_stock_kind='depot', slpm_surcharge_cents=0 WHERE slpm_id='40'" "nature « depot »"
reject "UPDATE ___xtr_supplier_link_pm SET slpm_rank=1, slpm_stock_kind='stock', slpm_surcharge_cents=-1 WHERE slpm_id='40'" "surcoût -1"
reject "UPDATE ___xtr_supplier_link_pm SET slpm_rank=1, slpm_surcharge_cents=0 WHERE slpm_id='40'" "source classée sans nature"
reject "UPDATE ___xtr_supplier_link_pm SET slpm_rank=1, slpm_stock_kind='stock' WHERE slpm_id='40'" "source classée sans surcoût"
reject "UPDATE ___xtr_supplier_link_pm SET slpm_surcharge_cents=300 WHERE slpm_id='40'" "lien non classé portant un surcoût"
reject "UPDATE ___xtr_supplier_link_pm SET $OK_SRC, slpm_delivery_spl_id='20' WHERE slpm_id='40'" "point de livraison égal à la source"
violates "UPDATE ___xtr_supplier_link_pm SET $OK_SRC, slpm_delivery_spl_id='999' WHERE slpm_id='40'" "violates foreign key constraint" "point de livraison inconnu (clé étrangère)"
reject "UPDATE ___xtr_supplier_link_pm SET slpm_updated_by='admin:1' WHERE slpm_id='40'" "auteur sans date"
reject "UPDATE ___xtr_supplier SET spl_fallback_mode='camion' WHERE spl_id='20'" "repli « camion »"
violates "UPDATE ___xtr_supplier_link_pm SET $OK_SRC WHERE slpm_id IN ('73','74')" "___xtr_supplier_link_pm_brand_rank_uniq" "deux sources au rang 1 de la même marque"
q "BEGIN; UPDATE ___xtr_supplier SET spl_fallback_mode='transporteur' WHERE spl_id='20'; UPDATE ___xtr_supplier_link_pm SET $OK_SRC, slpm_delivery_spl_id='21', slpm_updated_at=now(), slpm_updated_by='admin:1' WHERE slpm_id='40'; ROLLBACK;" >/dev/null \
  || fail "refusé à tort : source complète et repli transporteur"
echo "  ok  accepté : source complète et repli transporteur"

echo
echo "3. Fonction supplier_brand_sources_put"
eq "$(put 1080 '[{"spl_id":"72","stock_kind":"stock","surcharge_cents":0},{"spl_id":"20","stock_kind":"commande","surcharge_cents":0}]' 'admin:7')" "98:1:true,40:2:false" "CEVAM : EXADIS créé rang 1, lien CEVAM repris rang 2"
eq "$(src 1080)" "1=72@-/stock/0 2=20@-/commande/0" "CEVAM : EXADIS stock chez lui, CEVAM commande livrée selon sa fiche"
eq "$(put 3030 '[{"spl_id":"52","stock_kind":"stock","surcharge_cents":0},{"spl_id":"45","delivery_spl_id":"21","stock_kind":"commande","surcharge_cents":300}]' 'admin:7')" "99:1:true,97:2:false" "MEAT & DORIA : OTTOGO créé rang 1, lien M&D repris rang 2"
eq "$(src 3030)" "1=52@-/stock/0 2=45@21/commande/300" "MEAT & DORIA : rang 2 livré chez CS + 300 c"
eq "$(put 4120 '[{"spl_id":"59","delivery_spl_id":"15","stock_kind":"stock","surcharge_cents":0},{"spl_id":"59","delivery_spl_id":"73","stock_kind":"stock","surcharge_cents":0}]' 'admin:7')" "75:1:false,100:2:true" "SASIC : lien direct repris rang 1, second lien direct créé rang 2"
eq "$(src 4120)" "1=59@15/stock/0 2=59@73/stock/0" "SASIC : direct, stock chez BG et chez DCA"
eq "$(q "SELECT count(*) FROM ___xtr_supplier_link_pm WHERE slpm_id IN ('73','74') AND slpm_rank IS NULL")" "2" "SASIC : liens BG et DCA de la marque gardés, non classés"
eq "$(q "SELECT count(*) FROM ___xtr_supplier_link_pm WHERE slpm_rank IS NOT NULL AND (slpm_updated_by <> 'admin:7' OR slpm_updated_at IS NULL)")" "0" "auteur et date écrits sur chaque source"
eq "$(q "SELECT slpm_display FROM ___xtr_supplier_link_pm WHERE slpm_id='98'")" "1" "lien créé affiché"
eq "$(put 1080 '[{"spl_id":"20","link_id":"40","stock_kind":"commande","surcharge_cents":0}]' 'admin:8')" "40:1:false" "remplacement CEVAM : une seule source"
eq "$(src 1080)" "1=20@-/commande/0" "remplacement : CEVAM rang 1"
eq "$(q "SELECT concat_ws('|', slpm_rank, slpm_stock_kind, slpm_updated_by) FROM ___xtr_supplier_link_pm WHERE slpm_id='98'")" "admin:8" "lien EXADIS déclassé, gardé, auteur du déclassement"
eq "$(put 1080 '[]' 'admin:8')" "" "liste vide acceptée"
eq "$(src 1080)" "" "liste vide : CEVAM sans source classée"
eq "$(q "SELECT count(*) FROM ___xtr_supplier_link_pm")" "12" "aucune ligne supprimée (9 + 3 créées)"
put 1080 '[{"spl_id":"72","stock_kind":"stock","surcharge_cents":0},{"spl_id":"20","stock_kind":"commande","surcharge_cents":0}]' 'admin:7' >/dev/null
eq "$(src 1080)" "1=72@-/stock/0 2=20@-/commande/0" "CEVAM reposé : lien EXADIS repris, pas recréé"
eq "$(q "SELECT count(*) FROM ___xtr_supplier_link_pm")" "12" "aucun doublon créé au second passage"

SET_ROLE="SET ROLE service_role;"
refused "$SET_ROLE SELECT * FROM $FNC('3030', '[{\"spl_id\":\"90\",\"stock_kind\":\"stock\"}]', 'admin:7')" "non actif (archive)" "source archivée"
refused "$SET_ROLE SELECT * FROM $FNC('3030', '[{\"spl_id\":\"91\",\"stock_kind\":\"stock\"}]', 'admin:7')" "non actif (a_confirmer)" "source à confirmer"
refused "$SET_ROLE SELECT * FROM $FNC('3030', '[{\"spl_id\":\"92\",\"stock_kind\":\"stock\"}]', 'admin:7')" "non actif (non renseigné)" "source sans statut"
refused "$SET_ROLE SELECT * FROM $FNC('3030', '[{\"spl_id\":\"45\",\"delivery_spl_id\":\"90\",\"stock_kind\":\"stock\"}]', 'admin:7')" "point de livraison 90 non actif" "point de livraison archivé"
refused "$SET_ROLE SELECT * FROM $FNC('3030', '[{\"spl_id\":\"45\",\"delivery_spl_id\":\"999\",\"stock_kind\":\"stock\"}]', 'admin:7')" "point de livraison 999 inconnu" "point de livraison inconnu"
refused "$SET_ROLE SELECT * FROM $FNC('9999', '[]', 'admin:7')" "marque 9999 inconnue" "marque inconnue"
refused "$SET_ROLE SELECT * FROM $FNC('30x', '[]', 'admin:7')" "marque et auteur requis" "id de marque mal formé"
refused "$SET_ROLE SELECT * FROM $FNC('3030', '[{\"spl_id\":\"999\",\"stock_kind\":\"stock\"}]', 'admin:7')" "fournisseur 999 inconnu" "fournisseur inconnu"
refused "$SET_ROLE SELECT * FROM $FNC('3030', '[{\"spl_id\":\"20\",\"link_id\":\"40\",\"stock_kind\":\"stock\"}]', 'admin:7')" "ne relie pas la marque 3030" "lien d'une autre marque"
refused "$SET_ROLE SELECT * FROM $FNC('3030', '[{\"spl_id\":\"45\",\"link_id\":\"97\",\"stock_kind\":\"stock\"},{\"spl_id\":\"45\",\"link_id\":\"97\",\"stock_kind\":\"stock\"}]', 'admin:7')" "déjà classé" "même lien deux fois"
refused "$SET_ROLE SELECT * FROM $FNC('5000', '[{\"spl_id\":\"52\",\"stock_kind\":\"stock\"}]', 'admin:7')" "est masqué" "lien masqué (pas de doublon créé)"
refused "$SET_ROLE SELECT * FROM $FNC('3030', '[{\"spl_id\":\"45\",\"stock_kind\":\"stock\",\"surcharge_cents\":-1}]', 'admin:7')" "surcoût entier >= 0" "surcoût négatif"
refused "$SET_ROLE SELECT * FROM $FNC('3030', '[{\"spl_id\":\"45\",\"stock_kind\":\"stock\",\"surcharge_cents\":2.5}]', 'admin:7')" "surcoût entier >= 0" "surcoût non entier"
refused "$SET_ROLE SELECT * FROM $FNC('3030', '[{\"spl_id\":\"45\",\"stock_kind\":\"depot\"}]', 'admin:7')" "nature stock ou commande" "nature inconnue"
refused "$SET_ROLE SELECT * FROM $FNC('3030', '[]', ' ')" "marque et auteur requis" "auteur vide"
refused "$SET_ROLE SELECT * FROM $FNC('3030', '{\"spl_id\":\"45\"}', 'admin:7')" "liste de sources attendue" "objet au lieu d'une liste"
refused "$SET_ROLE SELECT * FROM $FNC('3030', '[{\"spl_id\":\"52\",\"stock_kind\":\"stock\"},{\"spl_id\":\"90\",\"stock_kind\":\"stock\"}]', 'admin:7')" "non actif (archive)" "erreur au rang 2 : rang 1 non écrit"

echo
echo "4. Droits"
eq "$(q "SELECT bool_and(relrowsecurity) FROM pg_class WHERE relname IN ('___xtr_supplier','___xtr_supplier_link_pm')")" "t" "RLS toujours active"
eq "$(q "$POLICIES")" "$policies0" "politiques identiques"
eq "$(q "$RIGHTS")" "$rights0" "droits de table identiques"
eq "$(q "SELECT has_function_privilege('anon','$FN','EXECUTE')||','||has_function_privilege('authenticated','$FN','EXECUTE')||','||has_function_privilege('service_role','$FN','EXECUTE')")" "false,false,true" "fonction exécutable par service_role seul"
eq "$(q "SELECT prosecdef FROM pg_proc WHERE oid='$FN'::regprocedure")" "f" "fonction SECURITY INVOKER"

echo
echo "5. Rejeu"
fp_mid=$(q "$FP_SOURCES")
apply /t/migration.sql "sources d'achat, 2e passage (idempotence)"
eq "$(q "$FP_SOURCES")" "$fp_mid" "rangs et sources conservés"

echo
echo "6. Down"
manual "$DOWN" "down"
eq "$(q "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND column_name IN ($NEW_COLS)")" "0" "colonnes retirées"
eq "$(q "SELECT count(*) FROM pg_proc WHERE proname='supplier_brand_sources_put'")" "0" "fonction retirée"
eq "$(q "SELECT count(*) FROM pg_indexes WHERE indexname='___xtr_supplier_link_pm_brand_rank_uniq'")" "0" "index retiré"
eq "$(q "SELECT count(*) FROM pg_constraint WHERE conname IN ('___xtr_supplier_link_pm_slpm_rank_check','___xtr_supplier_link_pm_slpm_stock_kind_check','___xtr_supplier_link_pm_slpm_surcharge_cents_check','___xtr_supplier_link_pm_source_shape','___xtr_supplier_link_pm_updated_pair','___xtr_supplier_link_pm_delivery_spl_fkey','___xtr_supplier_spl_fallback_mode_check')")" "0" "contraintes retirées"
eq "$(q "$SHAPE")" "$shape0" "forme des tables identique à l'état d'avant"
eq "$(q "$FP_LINK_FIX")" "$(echo "$fp_link0")" "liens historiques identiques"
eq "$(q "SELECT string_agg(slpm_id||':'||slpm_pm_id||':'||slpm_spl_id, ',' ORDER BY slpm_id::int) FROM ___xtr_supplier_link_pm WHERE slpm_id IN ('98','99','100')")" "98:1080:72,99:3030:52,100:4120:59" "liens créés gardés (documenté dans le down)"
eq "$(q "$RIGHTS")" "$rights0" "droits de table identiques après down"
apply /t/migration.sql "migration rejouée après down"

echo
echo "RÉSULTAT : toutes les assertions passent."
INNER
