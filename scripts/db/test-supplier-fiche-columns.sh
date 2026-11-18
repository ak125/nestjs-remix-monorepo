#!/usr/bin/env bash
# =============================================================================
# Test de rejeu de 20261118_xtr_supplier_fiche_columns.sql et de
# 20261118_supplier_price_profiles_default_pct.sql (+ leurs .down.sql), mandat CH.
#
# Prouve, sur les VRAIES migrations du dépôt :
#   1. Additif : les 23 + 2 colonnes existent, NULLABLES, sans DEFAULT ; les
#      lignes existantes sont intactes (empreinte md5 avant/après) et toutes
#      les nouvelles colonnes y valent NULL.
#   2. Contraintes : chaque CHECK refuse une valeur hors liste ou hors format
#      (statut « dormant » de l'ancien modèle, pays en minuscules, valeur de
#      secret collée à la place d'un nom, URL non http, montant négatif,
#      pourcentage hors 0–100, validation de localisation sans auteur) et
#      accepte une fiche complète valide.
#   3. Droits inchangés : RLS toujours active, politiques identiques, aucun
#      droit pour anon ni authenticated sur les tables et les nouvelles colonnes.
#   4. Rejeu idempotent (second passage sans effet ni erreur).
#   5. Down : retire les colonnes, rend les tables à leur forme d'avant
#      (empreinte md5 des lignes historiques), puis la migration se rejoue.
#
# Fixture : scripts/db/supplier-fiche-columns-fixture.sql (forme relevée en
# lecture seule le 2026-11-18, données synthétiques).
#
# Environnement : conteneur PostgreSQL jetable, sans réseau ni écoute TCP,
# données sur tmpfs (--rm). Ne lit aucune variable de connexion Supabase, ne
# touche aucune base.
#
# Usage : bash scripts/db/test-supplier-fiche-columns.sh
# Sortie : 0 si toutes les assertions passent ; 1 assertion fausse ; 2 environnement.
#
# Test de mutation (le test doit ÉCHOUER sur une migration affaiblie) :
#   sed "s/'occasionnel', 'a_confirmer'/'occasionnel', 'dormant', 'a_confirmer'/" \
#     backend/supabase/migrations/20261118_xtr_supplier_fiche_columns.sql > /tmp/mut.sql
#   MIGRATION_UNDER_TEST=/tmp/mut.sql bash scripts/db/test-supplier-fiche-columns.sh
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIG="backend/supabase/migrations"
FIXTURE="scripts/db/supplier-fiche-columns-fixture.sql"
SPL_DOWN="$MIG/20261118_xtr_supplier_fiche_columns.down.sql"
PCT_UP="$MIG/20261118_supplier_price_profiles_default_pct.sql"
PCT_DOWN="$MIG/20261118_supplier_price_profiles_default_pct.down.sql"
MIGRATION="${MIGRATION_UNDER_TEST:-$ROOT/$MIG/20261118_xtr_supplier_fiche_columns.sql}"
IMAGE="${PGIMAGE:-postgres:17-alpine}"

command -v docker >/dev/null || { echo "FATAL: docker requis"; exit 2; }
for f in "$ROOT/$FIXTURE" "$ROOT/$SPL_DOWN" "$ROOT/$PCT_UP" "$ROOT/$PCT_DOWN" "$MIGRATION"; do
  [[ -f "$f" ]] || { echo "FATAL: fichier absent: $f"; exit 2; }
done
MIGRATION="$(cd "$(dirname "$MIGRATION")" && pwd)/$(basename "$MIGRATION")"

echo "Image : $IMAGE"
echo "Migration : $MIGRATION"
exec timeout 300 docker run --rm -i --network none --user postgres \
  --tmpfs /tmp:rw,size=256m \
  -v "$ROOT":/repo:ro -v "$MIGRATION":/t/migration.sql:ro \
  -e FIXTURE="/repo/$FIXTURE" -e SPL_DOWN="/repo/$SPL_DOWN" \
  -e PCT_UP="/repo/$PCT_UP" -e PCT_DOWN="/repo/$PCT_DOWN" \
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
apply() { # apply <fichier> <libelle> — transaction unique, comme le runner
  P -1 -f "$1" || fail "$2 en échec"
  echo "  ok  $2"
}
manual() { # manual <fichier> <libelle> — un .down.sql porte son BEGIN/COMMIT
  P -f "$1" || fail "$2 en échec"
  echo "  ok  $2"
}
eq() { [[ "$1" == "$2" ]] || fail "$3 : obtenu « $1 », attendu « $2 »"; echo "  ok  $3"; }
reject() { # reject <sql> <libelle> — doit échouer sur une violation de CHECK
  local out
  if out=$(q "BEGIN; $1; ROLLBACK;" 2>&1); then fail "accepté à tort : $2"; fi
  [[ "$out" == *"violates check constraint"* ]] || fail "$2 : erreur inattendue : $out"
  echo "  ok  refusé : $2"
}
accept() { q "BEGIN; $1; ROLLBACK;" >/dev/null || fail "refusé à tort : $2"; echo "  ok  accepté : $2"; }

SPL_COLS="spl_type spl_status spl_contact_name spl_email spl_phone spl_website spl_address \
spl_postcode spl_city spl_country spl_supply_mode spl_location_validated_at \
spl_location_validated_by spl_payment_terms spl_franco_ht_cents spl_delivery_delay_days \
spl_order_mode spl_portal_url spl_secret_name spl_access_state spl_access_checked_at \
spl_updated_at spl_updated_by"
in_list() { local s=""; for c in $1; do s="$s,'$c'"; done; echo "${s#,}"; }
FP_SPL="SELECT md5(string_agg(concat_ws('|',spl_id,spl_name,spl_alias,spl_display,spl_sort), ';' ORDER BY spl_id)) FROM ___xtr_supplier"
FP_SPP="SELECT md5(string_agg(concat_ws('|',id,supplier_id,scope_level,price_basis,derivation,column_mapping,version,active), ';' ORDER BY id)) FROM supplier_price_profiles"
SHAPE="SELECT md5(string_agg(table_name||'.'||column_name||':'||data_type||':'||is_nullable||':'||coalesce(column_default,''), ',' ORDER BY table_name, ordinal_position)) FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('___xtr_supplier','supplier_price_profiles')"
RIGHTS="SELECT md5(coalesce(string_agg(grantee||':'||table_name||':'||privilege_type, ',' ORDER BY grantee, table_name, privilege_type), '')) FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee IN ('anon','authenticated','service_role','PUBLIC')"
POLICIES="SELECT md5(string_agg(tablename||':'||policyname||':'||array_to_string(roles,'+')||':'||cmd, ',' ORDER BY tablename, policyname)) FROM pg_policies WHERE schemaname='public'"

echo "PostgreSQL : $(q 'SHOW server_version')"
echo
P -f "$FIXTURE" || { echo "FATAL: fixture"; exit 2; }
fp_spl0=$(q "$FP_SPL"); fp_spp0=$(q "$FP_SPP"); shape0=$(q "$SHAPE")
rights0=$(q "$RIGHTS"); policies0=$(q "$POLICIES")

echo "Application"
apply /t/migration.sql "fiche fournisseur, 1er passage"
apply "$PCT_UP" "default_remise_pct / default_marge_pct, 1er passage"
apply /t/migration.sql "fiche fournisseur, 2e passage (idempotence)"
apply "$PCT_UP" "default_remise_pct / default_marge_pct, 2e passage (idempotence)"

echo
echo "1. Additif"
eq "$(q "SELECT count(*) FROM information_schema.columns WHERE table_name='___xtr_supplier' AND column_name IN ($(in_list "$SPL_COLS"))")" "23" "23 colonnes de fiche présentes"
eq "$(q "SELECT count(*) FROM information_schema.columns WHERE table_name='___xtr_supplier' AND column_name IN ($(in_list "$SPL_COLS")) AND (is_nullable <> 'YES' OR column_default IS NOT NULL)")" "0" "toutes nullables, aucune valeur par défaut"
eq "$(q "SELECT count(*) FROM information_schema.columns WHERE table_name='supplier_price_profiles' AND column_name IN ('default_remise_pct','default_marge_pct') AND is_nullable='YES' AND column_default IS NULL AND data_type='numeric'")" "2" "2 colonnes de profil, numeric, nullables, sans défaut"
eq "$(q "SELECT count(*) FROM information_schema.columns WHERE table_name='___xtr_supplier' AND column_name IN ('spl_id','spl_name','spl_alias','spl_display','spl_sort') AND data_type='text'")" "5" "colonnes historiques toujours text"
eq "$(q "$FP_SPL")" "$fp_spl0" "lignes historiques de ___xtr_supplier intactes"
eq "$(q "$FP_SPP")" "$fp_spp0" "profils existants intacts"
nn=""; for c in $SPL_COLS; do nn="$nn + count($c)"; done
eq "$(q "SELECT 0 $nn FROM ___xtr_supplier")" "0" "aucune valeur écrite dans les nouvelles colonnes"
eq "$(q "SELECT count(default_remise_pct) + count(default_marge_pct) FROM supplier_price_profiles")" "0" "aucune remise ni marge écrite"

echo
echo "2. Contraintes"
U="UPDATE ___xtr_supplier SET"
reject "$U spl_type = 'grossiste' WHERE spl_id='1'" "spl_type hors liste"
reject "$U spl_status = 'dormant' WHERE spl_id='1'" "spl_status 'dormant' (ancien modèle)"
reject "$U spl_status = 'vide' WHERE spl_id='1'" "spl_status 'vide' (ancien modèle)"
reject "$U spl_country = 'fr' WHERE spl_id='1'" "pays en minuscules"
reject "$U spl_country = 'FRA' WHERE spl_id='1'" "pays sur 3 lettres"
reject "$U spl_supply_mode = 'express' WHERE spl_id='1'" "mode d'approvisionnement hors liste"
reject "$U spl_order_mode = 'fax' WHERE spl_id='1'" "mode de commande hors liste"
reject "$U spl_access_state = 'ok' WHERE spl_id='1'" "état d'accès hors liste"
reject "$U spl_secret_name = 'S3cr3t-Pa55!' WHERE spl_id='1'" "valeur de secret à la place d'un nom"
reject "$U spl_secret_name = 'cal_user' WHERE spl_id='1'" "nom de secret en minuscules"
reject "$U spl_secret_name = 'CAL USER' WHERE spl_id='1'" "nom de secret avec espace"
reject "$U spl_website = 'javascript:alert(1)' WHERE spl_id='1'" "site non http(s)"
reject "$U spl_portal_url = 'ftp://portail' WHERE spl_id='1'" "portail non http(s)"
reject "$U spl_franco_ht_cents = -1 WHERE spl_id='1'" "franco négatif"
reject "$U spl_delivery_delay_days = -1 WHERE spl_id='1'" "délai négatif"
reject "$U spl_location_validated_at = now() WHERE spl_id='1'" "validation de localisation sans auteur"
reject "$U spl_location_validated_by = 'admin' WHERE spl_id='1'" "auteur de validation sans date"
reject "UPDATE supplier_price_profiles SET default_remise_pct = 100.01" "remise > 100"
reject "UPDATE supplier_price_profiles SET default_remise_pct = -0.5" "remise < 0"
reject "UPDATE supplier_price_profiles SET default_marge_pct = 101" "marge > 100"
accept "$U spl_type='plateforme', spl_status='a_confirmer', spl_contact_name='Contact', \
  spl_email='contact@example.invalid', spl_phone='+33 1 00 00 00 00', spl_website='https://example.invalid', \
  spl_address='1 rue X', spl_postcode='92230', spl_city='Gennevilliers', spl_country='FR', \
  spl_supply_mode='flux_tendu', spl_location_validated_at=now(), spl_location_validated_by='admin', \
  spl_payment_terms='30 jours fin de mois', spl_franco_ht_cents=15000, spl_delivery_delay_days=1, \
  spl_order_mode='portail', spl_portal_url='https://portail.example.invalid', spl_secret_name='CAL_', \
  spl_access_state='non_configure', spl_updated_at=now(), spl_updated_by='admin' WHERE spl_id='1'" "fiche complète valide"
for s in actif occasionnel a_confirmer archive; do accept "$U spl_status='$s' WHERE spl_id='1'" "spl_status '$s'"; done
for m in flux_tendu livraison_france import; do accept "$U spl_supply_mode='$m' WHERE spl_id='1'" "spl_supply_mode '$m'"; done
accept "UPDATE supplier_price_profiles SET default_remise_pct = 0, default_marge_pct = 100" "remise 0 et marge 100 (bornes)"
accept "INSERT INTO ___xtr_supplier (spl_id, spl_name) VALUES ('72', 'NOUVEAU')" "insertion sans colonne de fiche (toutes nullables)"

echo
echo "3. Droits"
eq "$(q "SELECT count(*) FROM pg_class WHERE relname IN ('___xtr_supplier','___xtr_supplier_link_pm','supplier_price_profiles') AND relrowsecurity")" "3" "RLS toujours active sur les 3 tables"
eq "$(q "$POLICIES")" "$policies0" "politiques inchangées"
eq "$(q "$RIGHTS")" "$rights0" "droits de table inchangés"
priv=$(q "SELECT count(*) FROM information_schema.columns c, (VALUES ('anon'),('authenticated')) r(role)
          WHERE c.table_name IN ('___xtr_supplier','supplier_price_profiles')
            AND has_column_privilege(r.role, 'public.'||c.table_name, c.column_name, 'SELECT,INSERT,UPDATE')")
eq "$priv" "0" "aucun droit de colonne pour anon ni authenticated"
eq "$(q "SELECT count(*) FROM pg_views WHERE schemaname='public'")" "0" "aucune vue créée"
eq "$(q "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'")" "0" "aucune fonction créée"

echo
echo "4-5. Down puis rejeu"
manual "$PCT_DOWN" "down default_pct"
manual "$SPL_DOWN" "down fiche fournisseur"
q "DELETE FROM ___xtr_supplier WHERE spl_id='72'" >/dev/null
eq "$(q "$SHAPE")" "$shape0" "forme des tables identique à l'avant-migration"
eq "$(q "$FP_SPL")" "$fp_spl0" "lignes historiques intactes après down"
eq "$(q "SELECT count(*) FROM pg_constraint WHERE conname LIKE '___xtr_supplier_spl_%'")" "0" "contraintes de fiche retirées"
apply /t/migration.sql "fiche fournisseur rejouée après down"
apply "$PCT_UP" "default_pct rejouée après down"

echo
echo "OK — toutes les assertions passent."
INNER
