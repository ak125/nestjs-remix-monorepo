#!/usr/bin/env bash
# =============================================================================
# Test de rejeu de 20261118_xtr_supplier_fiche_columns.sql et de
# 20261118_supplier_price_profiles_default_pct.sql (+ leurs .down.sql), mandat CH
# et compléments CH-2 (portée marque × famille / sous-famille) et CH-3 (nature
# import / condition, remplacement atomique, auteur du retrait).
#
# Prouve, sur les VRAIES migrations du dépôt :
#   1. Additif : les 23 colonnes de fiche et les colonnes de profil existent,
#      NULLABLES sans DEFAULT, sauf profile_kind (NOT NULL, défaut 'import') ;
#      les lignes existantes sont intactes (empreinte md5 avant/après), la ligne
#      de profil existante devient 'import' et aucune autre valeur n'est écrite.
#   2. Contraintes : chaque CHECK refuse une valeur hors liste ou hors format
#      (statut « dormant » de l'ancien modèle, pays en minuscules, valeur de
#      secret collée à la place d'un nom, URL non http, montant négatif,
#      pourcentage hors 0–100, validation de localisation sans auteur, portée
#      mal formée, période inversée, ligne active en double, profil d'import
#      portant une marque ou une remise, condition portant un paramètre d'import
#      ou sans taux, retrait sans auteur ou sur une ligne active) et accepte une
#      fiche complète valide, une condition marque × famille, sa promo datée,
#      une condition à côté du profil d'import et l'historique de versions.
#   2b. Fonction supplier_price_condition_put : pose (version 1), remplacement
#      (version 2, ancienne ligne inactive avec auteur et date), une seule ligne
#      active ; un appel en erreur laisse la condition en place ; pendant un
#      remplacement non validé, une autre session voit toujours une condition
#      active, et un second remplacement concurrent attend puis réussit.
#   3. Droits : RLS toujours active, politiques et droits de table identiques,
#      aucun droit pour anon ni authenticated ; la fonction (seule créée) n'est
#      exécutable que par service_role.
#   4. Rejeu idempotent (second passage sans effet ni erreur).
#   5. Down : refusé tant qu'une condition existe ; sinon retire la fonction, les
#      colonnes, les CHECK et l'index, rend les tables à leur forme d'avant
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
# Tests de mutation (le test doit ÉCHOUER sur une migration affaiblie) :
#   sed "s/'occasionnel', 'a_confirmer'/'occasionnel', 'dormant', 'a_confirmer'/" \
#     backend/supabase/migrations/20261118_xtr_supplier_fiche_columns.sql > /tmp/mut.sql
#   MIGRATION_UNDER_TEST=/tmp/mut.sql bash scripts/db/test-supplier-fiche-columns.sh
#   (profils : PCT_UNDER_TEST=<copie affaiblie> bash scripts/db/test-supplier-fiche-columns.sh)
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIG="backend/supabase/migrations"
FIXTURE="scripts/db/supplier-fiche-columns-fixture.sql"
SPL_DOWN="$MIG/20261118_xtr_supplier_fiche_columns.down.sql"
PCT_UP="${PCT_UNDER_TEST:-$ROOT/$MIG/20261118_supplier_price_profiles_default_pct.sql}"
PCT_DOWN="$MIG/20261118_supplier_price_profiles_default_pct.down.sql"
MIGRATION="${MIGRATION_UNDER_TEST:-$ROOT/$MIG/20261118_xtr_supplier_fiche_columns.sql}"
IMAGE="${PGIMAGE:-postgres:17-alpine}"

command -v docker >/dev/null || { echo "FATAL: docker requis"; exit 2; }
for f in "$ROOT/$FIXTURE" "$ROOT/$SPL_DOWN" "$PCT_UP" "$ROOT/$PCT_DOWN" "$MIGRATION"; do
  [[ -f "$f" ]] || { echo "FATAL: fichier absent: $f"; exit 2; }
done
MIGRATION="$(cd "$(dirname "$MIGRATION")" && pwd)/$(basename "$MIGRATION")"
PCT_UP="$(cd "$(dirname "$PCT_UP")" && pwd)/$(basename "$PCT_UP")"

echo "Image : $IMAGE"
echo "Migration : $MIGRATION"
echo "Profils : $PCT_UP"
exec timeout 300 docker run --rm -i --network none --user postgres \
  --tmpfs /tmp:rw,size=256m \
  -v "$ROOT":/repo:ro -v "$MIGRATION":/t/migration.sql:ro -v "$PCT_UP":/t/pct.sql:ro \
  -e FIXTURE="/repo/$FIXTURE" -e SPL_DOWN="/repo/$SPL_DOWN" \
  -e PCT_UP=/t/pct.sql -e PCT_DOWN="/repo/$PCT_DOWN" \
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
refused() { # refused <sql> <motif attendu> <libelle> — erreur attendue, transaction annulée
  local out
  if out=$(q "$1" 2>&1); then fail "accepté à tort : $3"; fi
  [[ "$out" == *"$2"* ]] || fail "$3 : erreur inattendue : $out"
  echo "  ok  refusé : $3"
}
duplicate() { # duplicate <sql> <libelle> — doit échouer sur l'index unique de règle active
  local out
  if out=$(q "BEGIN; $1; ROLLBACK;" 2>&1); then fail "accepté à tort : $2"; fi
  [[ "$out" == *"supplier_price_profiles_active_rule_uniq"* ]] || fail "$2 : erreur inattendue : $out"
  echo "  ok  refusé (doublon) : $2"
}

SPL_COLS="spl_type spl_status spl_contact_name spl_email spl_phone spl_website spl_address \
spl_postcode spl_city spl_country spl_supply_mode spl_location_validated_at \
spl_location_validated_by spl_payment_terms spl_franco_ht_cents spl_delivery_delay_days \
spl_order_mode spl_portal_url spl_secret_name spl_access_state spl_access_checked_at \
spl_updated_at spl_updated_by"
in_list() { local s=""; for c in $1; do s="$s,'$c'"; done; echo "${s#,}"; }
FP_SPL="SELECT md5(string_agg(concat_ws('|',spl_id,spl_name,spl_alias,spl_display,spl_sort), ';' ORDER BY spl_id)) FROM ___xtr_supplier"
FP_SPP="SELECT md5(string_agg(concat_ws('|',id,supplier_id,scope_level,price_basis,derivation,column_mapping,key_field,version,effective_from,effective_to,active,created_by), ';' ORDER BY id)) FROM supplier_price_profiles WHERE created_by = 'fixture'"
FN="public.supplier_price_condition_put(text,text,text,text,timestamptz,timestamptz,numeric,numeric,text,text)"
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
apply "$PCT_UP" "profils (nature, conditions, retrait, fonction), 1er passage"
apply /t/migration.sql "fiche fournisseur, 2e passage (idempotence)"
apply "$PCT_UP" "profils (nature, conditions, retrait, fonction), 2e passage (idempotence)"

echo
echo "1. Additif"
eq "$(q "SELECT count(*) FROM information_schema.columns WHERE table_name='___xtr_supplier' AND column_name IN ($(in_list "$SPL_COLS"))")" "23" "23 colonnes de fiche présentes"
eq "$(q "SELECT count(*) FROM information_schema.columns WHERE table_name='___xtr_supplier' AND column_name IN ($(in_list "$SPL_COLS")) AND (is_nullable <> 'YES' OR column_default IS NOT NULL)")" "0" "toutes nullables, aucune valeur par défaut"
eq "$(q "SELECT count(*) FROM information_schema.columns WHERE table_name='supplier_price_profiles' AND column_name IN ('default_remise_pct','default_marge_pct') AND is_nullable='YES' AND column_default IS NULL AND data_type='numeric'")" "2" "2 colonnes de profil, numeric, nullables, sans défaut"
eq "$(q "SELECT count(*) FROM information_schema.columns WHERE table_name='supplier_price_profiles' AND column_name='brand_pm_id' AND is_nullable='YES' AND column_default IS NULL AND data_type='text'")" "1" "brand_pm_id : text, nullable, sans défaut"
eq "$(q "SELECT data_type||':'||is_nullable||':'||column_default FROM information_schema.columns WHERE table_name='supplier_price_profiles' AND column_name='profile_kind'")" "text:NO:'import'::text" "profile_kind : text, NOT NULL, défaut 'import'"
eq "$(q "SELECT count(*) FROM information_schema.columns WHERE table_name='supplier_price_profiles' AND column_name IN ('retired_at','retired_by') AND is_nullable='YES' AND column_default IS NULL")" "2" "retired_at, retired_by : nullables, sans défaut"
eq "$(q "SELECT count(*) FROM information_schema.columns WHERE table_name='supplier_price_profiles' AND column_name IN ('price_basis','derivation','column_mapping','key_field') AND is_nullable='YES'")" "4" "paramètres d'import nullables (exigés sur 'import' par CHECK)"
eq "$(q "SELECT string_agg(profile_kind, ',') FROM supplier_price_profiles")" "import" "ligne existante = profil d'import"
eq "$(q "SELECT count(*) FROM pg_indexes WHERE indexname='supplier_price_profiles_active_rule_uniq' AND indexdef LIKE '%(supplier_id, profile_kind, brand_pm_id,%' AND indexdef LIKE '%NULLS NOT DISTINCT%' AND indexdef LIKE '%WHERE active%'")" "1" "index unique de ligne active, nature comprise (NULLS NOT DISTINCT, partiel)"
eq "$(q "SELECT count(*) FROM information_schema.columns WHERE table_name='___xtr_supplier' AND column_name IN ('spl_id','spl_name','spl_alias','spl_display','spl_sort') AND data_type='text'")" "5" "colonnes historiques toujours text"
eq "$(q "$FP_SPL")" "$fp_spl0" "lignes historiques de ___xtr_supplier intactes"
eq "$(q "$FP_SPP")" "$fp_spp0" "profils existants intacts"
nn=""; for c in $SPL_COLS; do nn="$nn + count($c)"; done
eq "$(q "SELECT 0 $nn FROM ___xtr_supplier")" "0" "aucune valeur écrite dans les nouvelles colonnes"
eq "$(q "SELECT count(default_remise_pct) + count(default_marge_pct) + count(brand_pm_id) + count(retired_at) + count(retired_by) FROM supplier_price_profiles")" "0" "aucune remise, marge, marque ni retrait écrit"

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
# Condition : C <niveau> <code> <marque> <de> <à> <actif> [remise] [marge]
C() { echo "INSERT INTO supplier_price_profiles (supplier_id, profile_kind, scope_level, scope_code, \
  brand_pm_id, effective_from, effective_to, active, default_remise_pct, default_marge_pct) \
  VALUES ('71', 'condition', '$1', $2, $3, $4, $5, $6, ${7:-12}, ${8:-NULL})"; }
# Profil d'import : IMP <niveau> <code> [colonnes en plus] [valeurs en plus]
IMP() { echo "INSERT INTO supplier_price_profiles (supplier_id, scope_level, scope_code, \
  price_basis, derivation, column_mapping, key_field${3:+, $3}) \
  VALUES ('71', '$1', $2, 'NET', 'DIRECT_NET', '{}', 'REF'${4:+, $4})"; }
reject "$(C SUPPLIER NULL NULL NULL NULL true 100.01)" "remise > 100"
reject "$(C SUPPLIER NULL NULL NULL NULL true -0.5)" "remise < 0"
reject "$(C SUPPLIER NULL NULL NULL NULL true NULL 101)" "marge > 100"
reject "$(C BRAND NULL NULL NULL NULL true)" "condition marque sans marque"
reject "$(C SUPPLIER NULL "'100'" NULL NULL true)" "portée fournisseur avec une marque"
reject "$(C SUPPLIER "'NU17'" NULL NULL NULL true)" "portée fournisseur avec un code"
reject "$(C BRAND "'NU17'" "'100'" NULL NULL true)" "portée marque avec un code (famille = FAMILY)"
reject "$(C FAMILY NULL "'100'" NULL NULL true)" "famille sans code"
reject "$(C SUBFAMILY "''" NULL NULL NULL true)" "sous-famille au code vide"
reject "$(C FAMILY "' NU17'" "'100'" NULL NULL true)" "code famille non nettoyé"
reject "$(C FAMILY "'NU17'" "'SEIM'" NULL NULL true)" "marque en nom au lieu du pm_id"
reject "$(C FAMILY "'NU17'" "'100'" "'2026-12-31'" "'2026-12-01'" true)" "période inversée"
reject "$(C FAMILY "'NU17'" "'100'" "'2026-12-01'" "'2026-12-01'" true)" "période vide"
# Nature (complément CH-3) : aucune recopie des paramètres d'import
reject "$(C SUPPLIER NULL NULL NULL NULL true NULL NULL)" "condition sans remise ni marge"
reject "UPDATE supplier_price_profiles SET profile_kind = 'condition'" "condition portant les paramètres d'import"
reject "$(C FAMILY "'NU17'" "'100'" NULL NULL true); UPDATE supplier_price_profiles SET price_basis = 'NET' WHERE profile_kind = 'condition'" "condition avec price_basis"
reject "$(C FAMILY "'NU17'" "'100'" NULL NULL true); UPDATE supplier_price_profiles SET column_mapping = '{}' WHERE profile_kind = 'condition'" "condition avec column_mapping"
reject "UPDATE supplier_price_profiles SET default_remise_pct = 12" "profil d'import portant une remise"
reject "UPDATE supplier_price_profiles SET default_marge_pct = 30" "profil d'import portant une marge"
reject "$(IMP FAMILY "'NU17'" brand_pm_id "'100'")" "profil d'import portant une marque"
reject "UPDATE supplier_price_profiles SET key_field = NULL" "profil d'import sans key_field"
reject "UPDATE supplier_price_profiles SET derivation = NULL" "profil d'import sans derivation"
reject "UPDATE supplier_price_profiles SET profile_kind = 'autre'" "nature hors liste"
# Retrait : auteur et date ensemble, sur une ligne inactive
reject "UPDATE supplier_price_profiles SET active = false, retired_at = now()" "retrait sans auteur"
reject "UPDATE supplier_price_profiles SET active = false, retired_by = 'admin'" "auteur de retrait sans date"
reject "UPDATE supplier_price_profiles SET retired_at = now(), retired_by = 'admin'" "retrait sur une ligne active"
reject "UPDATE supplier_price_profiles SET active = false, retired_at = now(), retired_by = ' '" "auteur de retrait vide"
duplicate "$(IMP SUPPLIER NULL)" "2e profil d'import fournisseur actif, sans date"
duplicate "$(C SUPPLIER NULL NULL NULL NULL true); $(C SUPPLIER NULL NULL NULL NULL true)" "2e condition fournisseur active, sans date"
duplicate "$(C FAMILY "'NU17'" "'100'" NULL NULL true); $(C FAMILY "'NU17'" "'100'" NULL NULL true)" "2e condition marque × famille active, même période"
duplicate "$(C FAMILY "'NU17'" "'100'" "'2026-12-01'" "'2027-01-01'" true); $(C FAMILY "'NU17'" "'100'" "'2026-12-01'" "'2027-01-01'" true)" "2e promo marque × famille active, même période"
accept "$(C SUPPLIER NULL NULL NULL NULL true)" "condition fournisseur à côté du profil d'import de même portée"
accept "$(C FAMILY "'NU17'" "'100'" NULL NULL true)" "marque × famille (ex. SEIM chez CAL, câbles)"
accept "$(C SUBFAMILY "'1738'" "'100'" NULL NULL true)" "marque × sous-famille"
accept "$(C BRAND NULL "'100'" NULL NULL true)" "fournisseur × marque"
accept "$(C SUBFAMILY "'1738'" NULL NULL NULL true)" "fournisseur × sous-famille, sans marque"
accept "$(C FAMILY "'NU17'" "'100'" NULL NULL true NULL 30)" "condition de marge seule"
accept "$(C FAMILY "'NU17'" "'100'" NULL NULL true); $(C FAMILY "'NU17'" "'100'" "'2026-12-01'" "'2027-01-01'" true)" "condition et promo datée sur la même portée"
accept "$(C FAMILY "'NU17'" "'100'" NULL NULL true); $(C FAMILY "'NU17'" "'101'" NULL NULL true); $(C FAMILY "'NU19'" "'100'" NULL NULL true)" "même famille pour une autre marque, autre famille pour la même marque"
accept "$(C FAMILY "'NU17'" "'100'" NULL NULL false); $(C FAMILY "'NU17'" "'100'" NULL NULL false); $(C FAMILY "'NU17'" "'100'" NULL NULL true)" "versions inactives conservées à côté de la condition active"
accept "$(IMP BRAND NULL)" "profil d'import BRAND sans marque (forme lue par le moteur)"
accept "$(IMP FAMILY "'NU17'")" "profil d'import famille"
accept "UPDATE supplier_price_profiles SET active = false, retired_at = now(), retired_by = 'admin'" "retrait avec auteur et date"
accept "ALTER TABLE supplier_price_profiles VALIDATE CONSTRAINT supplier_price_profiles_scope_shape_check; \
  ALTER TABLE supplier_price_profiles VALIDATE CONSTRAINT supplier_price_profiles_period_check; \
  ALTER TABLE supplier_price_profiles VALIDATE CONSTRAINT supplier_price_profiles_kind_shape_check; \
  ALTER TABLE supplier_price_profiles VALIDATE CONSTRAINT supplier_price_profiles_retired_check" "ligne existante conforme aux CHECK NOT VALID"
accept "$U spl_type='plateforme', spl_status='a_confirmer', spl_contact_name='Contact', \
  spl_email='contact@example.invalid', spl_phone='+33 1 00 00 00 00', spl_website='https://example.invalid', \
  spl_address='1 rue X', spl_postcode='92230', spl_city='Gennevilliers', spl_country='FR', \
  spl_supply_mode='flux_tendu', spl_location_validated_at=now(), spl_location_validated_by='admin', \
  spl_payment_terms='30 jours fin de mois', spl_franco_ht_cents=15000, spl_delivery_delay_days=1, \
  spl_order_mode='portail', spl_portal_url='https://portail.example.invalid', spl_secret_name='CAL_', \
  spl_access_state='non_configure', spl_updated_at=now(), spl_updated_by='admin' WHERE spl_id='1'" "fiche complète valide"
for s in actif occasionnel a_confirmer archive; do accept "$U spl_status='$s' WHERE spl_id='1'" "spl_status '$s'"; done
for m in flux_tendu livraison_france import; do accept "$U spl_supply_mode='$m' WHERE spl_id='1'" "spl_supply_mode '$m'"; done
accept "$(C SUPPLIER NULL NULL NULL NULL true 0 100)" "remise 0 et marge 100 (bornes)"
accept "INSERT INTO ___xtr_supplier (spl_id, spl_name) VALUES ('72', 'NOUVEAU')" "insertion sans colonne de fiche (toutes nullables)"

echo
echo "2b. Remplacement atomique (supplier_price_condition_put)"
put() { # put <marque> <niveau> <code> <de> <à> <remise> <marge> [auteur]
  echo "SELECT rule_version || '|' || coalesce(replaced_id::text, '-') FROM supplier_price_condition_put('71', $1, '$2', $3, $4, $5, $6, $7, 'test', ${8:-'admin'})"
}
KEY="supplier_id='71' AND profile_kind='condition' AND brand_pm_id='100' AND scope_level='FAMILY' AND scope_code='NU17' AND effective_from IS NULL"
eq "$(q "$(put "'100'" FAMILY "'NU17'" NULL NULL 12 NULL)")" "1|-" "pose : version 1, rien de remplacé"
v1=$(q "SELECT id FROM supplier_price_profiles WHERE $KEY AND active")
eq "$(q "$(put "'100'" FAMILY "'NU17'" NULL NULL 15 NULL)")" "2|$v1" "remplacement : version 2, remplace la version 1"
eq "$(q "SELECT count(*) || '|' || max(default_remise_pct) FROM supplier_price_profiles WHERE $KEY AND active")" "1|15" "une seule condition active, la nouvelle"
eq "$(q "SELECT (NOT active) AND retired_by = 'admin' AND retired_at IS NOT NULL AND default_remise_pct = 12 FROM supplier_price_profiles WHERE id = $v1")" "t" "ancienne version : inactive, auteur et date du retrait, taux conservé"
eq "$(q "SELECT count(*) FROM supplier_price_profiles WHERE profile_kind='condition' AND (price_basis IS NOT NULL OR derivation IS NOT NULL OR column_mapping IS NOT NULL OR key_field IS NOT NULL)")" "0" "aucun paramètre d'import recopié"
refused "$(put "'100'" FAMILY "'NU17'" NULL NULL 150 NULL)" "violates check constraint" "remplacement par une remise de 150 %"
refused "$(put "'100'" FAMILY "'NU17'" NULL NULL 16 NULL "' '")" "auteur requis" "remplacement sans auteur"
refused "$(put "'SEIM'" FAMILY "'NU17'" NULL NULL 16 NULL)" "violates check constraint" "marque en nom"
eq "$(q "SELECT count(*) || '|' || max(default_remise_pct) || '|' || max(version) FROM supplier_price_profiles WHERE $KEY AND active")" "1|15|2" "après les appels en erreur : la condition version 2 reste seule active"
eq "$(q "$(put "'100'" FAMILY "'NU17'" "'2026-12-01'" "'2027-01-01'" 20 NULL)")" "1|-" "promo datée : autre clé, version 1, ne retire pas la condition de base"
eq "$(q "SELECT count(*) FROM supplier_price_profiles WHERE supplier_id='71' AND profile_kind='condition' AND active")" "2" "condition de base et promo actives ensemble"
# Concurrence : A remplace sans valider pendant 2 s ; B lit puis remplace à son tour.
psql -X -q -U postgres -d postgres -v ON_ERROR_STOP=1 -tA >/tmp/a.out 2>&1 <<SQL &
BEGIN;
$(put "'100'" FAMILY "'NU17'" NULL NULL 18 NULL "'session-a'");
SELECT pg_sleep(2);
COMMIT;
SQL
pid_a=$!
sleep 0.7
eq "$(q "SELECT count(*) || '|' || max(default_remise_pct) FROM supplier_price_profiles WHERE $KEY AND active")" "1|15" "pendant le remplacement non validé : une condition active visible (l'ancienne)"
eq "$(q "$(put "'100'" FAMILY "'NU17'" NULL NULL 19 NULL "'session-b'")" | cut -d'|' -f1)" "4" "remplacement concurrent : attend la fin du premier puis passe en version 4"
wait "$pid_a" || { cat /tmp/a.out; fail "session A en échec"; }
eq "$(q "SELECT count(*) || '|' || max(default_remise_pct) || '|' || max(created_by) FROM supplier_price_profiles WHERE $KEY AND active")" "1|19|session-b" "après les deux : une seule condition active, la dernière"
eq "$(q "SELECT string_agg(version || ':' || active || ':' || coalesce(retired_by, '-'), ',' ORDER BY version) FROM supplier_price_profiles WHERE $KEY")" "1:false:admin,2:false:session-a,3:false:session-b,4:true:-" "historique complet : chaque version retirée par l'auteur du remplacement suivant"
eq "$(q "$FP_SPP")" "$fp_spp0" "profil d'import existant intact après les écritures de conditions"
refused "SET ROLE anon; $(put "'100'" FAMILY "'NU17'" NULL NULL 21 NULL)" "permission denied" "appel par anon"
refused "SET ROLE authenticated; $(put "'100'" FAMILY "'NU17'" NULL NULL 21 NULL)" "permission denied" "appel par authenticated"
eq "$(q "SET ROLE service_role; $(put "'100'" FAMILY "'NU17'" NULL NULL 21 NULL "'service'")" | cut -d'|' -f1)" "5" "appel par service_role (backend)"

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
eq "$(q "SELECT string_agg(p.proname || ':' || p.prosecdef, ',') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'")" "supplier_price_condition_put:false" "une seule fonction créée, SECURITY INVOKER"
eq "$(q "SELECT has_function_privilege('anon', '$FN', 'EXECUTE') || '|' || has_function_privilege('authenticated', '$FN', 'EXECUTE') || '|' || has_function_privilege('service_role', '$FN', 'EXECUTE')")" "false|false|true" "fonction exécutable par service_role seul"

echo
echo "4-5. Down puis rejeu"
refused "$(cat "$PCT_DOWN")" "rollback refusé" "down profils tant que des conditions existent"
eq "$(q "SELECT count(*) FROM information_schema.columns WHERE table_name='supplier_price_profiles' AND column_name='profile_kind'")" "1" "down refusé : rien retiré"
q "DELETE FROM supplier_price_profiles WHERE profile_kind = 'condition'" >/dev/null
manual "$PCT_DOWN" "down profils, conditions retirées par le test"
manual "$SPL_DOWN" "down fiche fournisseur"
q "DELETE FROM ___xtr_supplier WHERE spl_id='72'" >/dev/null
eq "$(q "$SHAPE")" "$shape0" "forme des tables identique à l'avant-migration"
eq "$(q "$FP_SPL")" "$fp_spl0" "lignes historiques intactes après down"
eq "$(q "SELECT count(*) FROM pg_constraint WHERE conname LIKE '___xtr_supplier_spl_%'")" "0" "contraintes de fiche retirées"
eq "$(q "SELECT count(*) FROM pg_constraint WHERE conname LIKE 'supplier_price_profiles_%' AND contype='c' AND conname NOT IN ('supplier_price_profiles_scope_level_check','supplier_price_profiles_price_basis_check','supplier_price_profiles_derivation_check','supplier_price_profiles_key_field_check')")" "0" "CHECK de profil ajoutés retirés"
eq "$(q "SELECT count(*) FROM pg_indexes WHERE indexname='supplier_price_profiles_active_rule_uniq'")" "0" "index de ligne active retiré"
eq "$(q "SELECT count(*) FROM pg_proc WHERE proname='supplier_price_condition_put'")" "0" "fonction de remplacement retirée"
eq "$(q "$FP_SPP")" "$fp_spp0" "profil d'import historique intact après down"
apply /t/migration.sql "fiche fournisseur rejouée après down"
apply "$PCT_UP" "profils rejoués après down"

echo
echo "OK — toutes les assertions passent."
INNER
