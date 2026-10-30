-- =============================================================================
-- Migration : lectures SECURITY DEFINER pour l'API véhicules du sélecteur
--             (marques, années, modèles d'une marque, motorisations d'un modèle)
-- Date      : 2026-10-26
-- Scope     : QUATRE fonctions créées, en lecture seule. Aucune table modifiée,
--             aucun droit de table touché, aucune donnée écrite, aucune autre
--             fonction touchée.
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- =============================================================================
--
-- CONTEXTE
-- --------
-- 20260423_drop_public_using_true_catalog.sql retire à anon et authenticated toute
-- lecture de auto_marque, auto_modele et auto_type (REVOKE l. 242-249, politiques
-- publiques supprimées l. 100-107). Aucune migration ultérieure ne la rouvre.
--
-- Le container PREPROD tourne en `anon` (READ_ONLY, ADR-028 Option D) et la base
-- a `row_security=off` : une lecture directe de ces tables y est refusée (42501).
-- Or les quatre lectures du sélecteur de véhicules lisent ces tables en direct
-- (`.from()`) :
--   * VehicleBrandsService.getBrands        → /api/vehicles/brands
--   * VehicleBrandsService.getYearsByBrand  → /api/vehicles/brands/:id/years
--   * VehicleModelsService.getModelsByBrand → /api/vehicles/brands/:id/models
--   * VehicleTypesService.getTypesByModel   → /api/vehicles/models/:id/types
-- Le sélecteur de PREPROD doit donc être en erreur. Ce n'est pas observé en
-- direct (aucun test PREPROD ne vérifie ces routes) : le refus 42501 est reproduit
-- sur le banc local décrit plus bas, avec les droits que posent les migrations.
-- Le parcours navigateur qui doit prouver en PREPROD la route R2 servie par le
-- service Rust (vehicle-models-rs) passe par ces quatre lectures : il ne pourra
-- pas passer sans cette migration. PROD et DEV
-- (service_role) lisent les tables et ne sont pas touchés.
--
-- Même défaut, même remède que get_homepage_families (20260621, PR #1072) et
-- get_r6_guide_link_snapshot (20261001, PR #1689) : des fonctions SECURITY
-- DEFINER font les lectures. Les services les appelleront par callRpc au lieu des
-- `.from()` directs (PR de code séparée, fusionnée APRÈS l'application de cette
-- migration). Les filtres, tris, pages et comptes restent posés par l'appelant,
-- comme aujourd'hui sur la table : PostgREST les applique au résultat de la
-- fonction.
--
-- CE QUE RENVOIENT LES FONCTIONS
-- ------------------------------
--   get_vehicle_api_brands()
--       toutes les lignes de auto_marque, toutes colonnes (lecture de getBrands ;
--       le filtre marque_display reste posé par l'appelant, qui l'omet pour
--       includeAll=true, paramètre public de /api/vehicles/brands).
--   get_vehicle_api_brand_models(p_marque_id)
--       les lignes de auto_modele dont modele_marque_id = p_marque_id, toutes
--       colonnes (étape 1 et requête principale de getModelsByBrand, étape 1 de
--       getYearsByBrand). Le paramètre a le type de la colonne (smallint) : un
--       identifiant hors plage lève 22003 comme le filtre `eq` sur la table.
--   get_vehicle_api_types_by_models(p_modele_ids)
--       pour les modèles donnés, les seules colonnes que lisent l'étape 2 de
--       getModelsByBrand et de getYearsByBrand : type_id, type_modele_id,
--       type_year_from, type_year_to, type_fuel, type_display. Tous les types,
--       affichés ou non, comme la lecture actuelle de getModelsByBrand (qui
--       compte les motorisations sans filtre d'affichage) ; getYearsByBrand garde
--       son filtre type_display = '1' côté appelant.
--   get_vehicle_api_model_types(p_modele_id)
--       les lignes de auto_type du modèle dont type_display = '1', toutes
--       colonnes : exactement les lignes que filtre getTypesByModel.
--
-- ÉQUIVALENCE VÉRIFIÉE le 2026-10-26, hors base partagée, sur une base PostgreSQL
-- et un PostgREST jetables, données synthétiques (colonnes et ordre repris des
-- réponses PostgREST enregistrées) :
--   * par HTTP (scripts/db/test-vehicle-api-definer-reads.sh) : chaque requête
--     des services, sur la table en service_role puis sur la fonction en anon et
--     en service_role, rend le même statut, le même Content-Range et le même
--     corps, octet pour octet ; retour arrière, ré-application et garde comprises ;
--   * par les services eux-mêmes (pilote local, 32 appels de getBrands,
--     getYearsByBrand, getModelsByBrand et getTypesByModel) : le code de `main`
--     en service_role et celui de la PR de code, en anon puis en service_role,
--     rendent les mêmes résultats, les mêmes erreurs et les mêmes journaux.
-- La même comparaison sur les données réelles reste à faire après application,
-- par l'API.
--
-- SÛRETÉ
-- ------
--   * lecture seule (STABLE, aucun INSERT/UPDATE/DELETE) ;
--   * search_path = public, pg_temp (pg_temp en dernier) ; toutes les relations
--     du corps sont qualifiées `public.` ;
--   * EXECUTE retiré à PUBLIC, anon et authenticated (privilèges par défaut
--     Supabase), puis accordé à anon (container PREPROD READ_ONLY, cf. CONTEXTE)
--     et à service_role (PROD, DEV) ;
--   * dev_readonly ne reçoit rien : ce n'est pas un rôle API (PostgREST ne bascule
--     que vers anon/authenticated/service_role, cf. 20260907_tecdoc_api_surface
--     _lockdown.sql l. 89) et le chemin DEV_KILL_SWITCH est éteint ;
--   * PAS d'entrée dans scripts/lint/definer-anon-allowlist.txt : le REVOKE écrit
--     ci-dessous satisfait la règle 1 de check-definer-anon-surface.sh, comme pour
--     20261001_get_r6_guide_link_snapshot_definer_rpc.sql.
--
-- SURFACE OUVERTE À ANON, ASSUMÉE
-- -------------------------------
-- La clé anon est publique. Ces fonctions la laissent lire, sans passer par le
-- backend ni par son limiteur, ce que l'API véhicules publique sert déjà : les
-- marques et les modèles d'une marque (includeAll=true compris), les motorisations
-- affichées d'un modèle. En plus de l'API : pour les types non affichés, leurs
-- seuls identifiant, modèle, années, carburant et indicateur d'affichage (l'API
-- en publie déjà le compte et les carburants dans motorisationsCount et
-- modele_fuel_types). Les autres colonnes des types non affichés et les autres
-- tables auto_* restent fermées à anon.
--
-- TRI : les fonctions SETOF table rendent le type ligne de la table, donc la
-- collation de ses colonnes ; order('marque_name'), order('modele_name') et
-- order('type_name') trient comme sur la table. get_vehicle_api_types_by_models
-- n'est jamais triée par l'appelant : sans tri, l'ordre des lignes n'est garanti
-- ni sur la table ni ici. Cet ordre fixe celui de modele_fuel_types ; il est
-- comparé sur les données réelles, par l'API, après application.
--
-- assume_in_transaction (squawk) : pas de BEGIN/COMMIT explicite. Timeouts requis
-- (squawk require-timeout-settings) avant CREATE FUNCTION.
--
-- RETOUR ARRIÈRE : 20261026_vehicle_api_definer_reads.down.sql, à ne lancer
-- qu'APRÈS le retrait du code qui appelle les fonctions.
SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE OR REPLACE FUNCTION public.get_vehicle_api_brands()
RETURNS SETOF public.auto_marque
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT m.* FROM public.auto_marque m
$$;

CREATE OR REPLACE FUNCTION public.get_vehicle_api_brand_models(
  p_marque_id public.auto_modele.modele_marque_id%TYPE
)
RETURNS SETOF public.auto_modele
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT m.* FROM public.auto_modele m WHERE m.modele_marque_id = p_marque_id
$$;

CREATE OR REPLACE FUNCTION public.get_vehicle_api_types_by_models(
  p_modele_ids text[]
)
RETURNS TABLE (
  type_id        public.auto_type.type_id%TYPE,
  type_modele_id public.auto_type.type_modele_id%TYPE,
  type_year_from public.auto_type.type_year_from%TYPE,
  type_year_to   public.auto_type.type_year_to%TYPE,
  type_fuel      public.auto_type.type_fuel%TYPE,
  type_display   public.auto_type.type_display%TYPE
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT t.type_id, t.type_modele_id, t.type_year_from, t.type_year_to,
         t.type_fuel, t.type_display
  FROM public.auto_type t
  WHERE t.type_modele_id = ANY (p_modele_ids)
$$;

CREATE OR REPLACE FUNCTION public.get_vehicle_api_model_types(
  p_modele_id public.auto_type.type_modele_id%TYPE
)
RETURNS SETOF public.auto_type
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT t.* FROM public.auto_type t
  WHERE t.type_modele_id = p_modele_id AND t.type_display = '1'
$$;

REVOKE ALL ON FUNCTION public.get_vehicle_api_brands() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_vehicle_api_brand_models(smallint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_vehicle_api_types_by_models(text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_vehicle_api_model_types(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_vehicle_api_brands() TO anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_vehicle_api_brand_models(smallint) TO anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_vehicle_api_types_by_models(text[]) TO anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_vehicle_api_model_types(text) TO anon, service_role;

-- Garde finale, fail-closed : la migration échoue, donc rien n'est appliqué, si
-- une signature ne correspond pas aux types attendus (un %TYPE résolu autrement
-- qu'à l'écriture de cette migration), si une fonction n'est pas STABLE SECURITY
-- DEFINER avec ce search_path, ou si les droits EXECUTE diffèrent de anon et
-- service_role (authenticated et PUBLIC exclus).
DO $postcheck$
DECLARE
  v_sig text;
  v_oid oid;
BEGIN
  FOREACH v_sig IN ARRAY ARRAY[
    'public.get_vehicle_api_brands()',
    'public.get_vehicle_api_brand_models(smallint)',
    'public.get_vehicle_api_types_by_models(text[])',
    'public.get_vehicle_api_model_types(text)'
  ] LOOP
    v_oid := to_regprocedure(v_sig);
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'ABORT: % absente (signature inattendue)', v_sig;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
       WHERE p.oid = v_oid
         AND p.prosecdef
         AND p.provolatile = 's'
         AND p.proretset
         AND pg_get_userbyid(p.proowner) = 'postgres'
         AND p.proconfig = ARRAY['search_path=public, pg_temp']
    ) THEN
      RAISE EXCEPTION 'ABORT: état de % inattendu (STABLE SECURITY DEFINER SETOF, propriétaire postgres, search_path)', v_sig;
    END IF;

    IF NOT has_function_privilege('anon', v_oid, 'EXECUTE')
       OR has_function_privilege('authenticated', v_oid, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'ABORT: droits EXECUTE inattendus sur % (attendu : anon et service_role côté API)', v_sig;
    END IF;
  END LOOP;
END
$postcheck$;

-- =============================================================================
-- Vérification post-migration (lecture seule, à jouer après apply)
-- =============================================================================
--   SELECT p.oid::regprocedure, p.provolatile, p.prosecdef, p.proconfig, p.proacl
--     FROM pg_proc p
--    WHERE p.proname LIKE 'get\_vehicle\_api\_%';
--   -- attendu : 4 lignes, s, true, {"search_path=public, pg_temp"},
--   --           {postgres=X/postgres,anon=X/postgres,service_role=X/postgres}
--
--   BEGIN; SET LOCAL ROLE anon;
--     SELECT count(*) FROM public.get_vehicle_api_brands();             -- > 0
--     SELECT count(*) FROM public.auto_marque;                          -- 42501
--   ROLLBACK;
-- =============================================================================
