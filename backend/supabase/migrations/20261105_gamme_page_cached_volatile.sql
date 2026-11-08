-- =============================================================================
-- Migration : get_gamme_page_data_cached déclarée VOLATILE (au lieu de STABLE)
-- Date      : 2026-11-05
-- Scope     : UNE métadonnée de fonction (volatilité) et son commentaire.
--             Corps, signature, propriétaire, search_path et droits inchangés.
--             Aucune table, aucune donnée touchée par la migration elle-même.
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- =============================================================================
--
-- CAUSE (journal du backend DEV, 2026-11-05, gamme 7853) :
--   SupabaseRpcError: cannot execute INSERT in a read-only transaction (25006)
--     at GammeRpcService.fetchRpcWithTimeout → get_gamme_page_data_cached
--
-- get_gamme_page_data_cached() est déclarée STABLE, mais sur un cache absent
-- ou périmé elle appelle rebuild_gamme_page_cache(), qui ÉCRIT dans
-- __gamme_page_cache (INSERT/UPDATE, ou DELETE pour une gamme hors catalogue).
-- PostgREST exécute une fonction STABLE dans une transaction en lecture seule :
-- l'écriture échoue. Le contrôleur rend alors 503, le frontend se rabat sur
-- /api/gamme-rest-optimized/:id/page-data (sans données de page), et le loader
-- de pieces.$slug.tsx répond 404 « Gamme not found ».
--
-- Même défaut, même correctif que 20260522_vehicle_page_cached_volatile.sql
-- pour la jumelle R8 get_vehicle_page_data_cached (VOLATILE en base depuis).
--
-- PÉRIMÈTRE MESURÉ (2026-11-05, base réelle, transaction en lecture seule) :
--   * __gamme_page_cache : 238 lignes (226 construites le 2026-04-27, 12 le
--     2026-10-04), toutes non périmées. Les 232 gammes affichées de niveau 1/2
--     sont toutes en cache : leurs pages ne passent pas par l'écriture.
--   * 5 058 gammes éligibles (alias renseigné) de niveau 4 ou 5, dont 5 055
--     non affichées, n'ont pas de ligne : leur page répond 404 depuis le
--     passage au cache (#197, 2026-04-27). 5 seulement ont des produits affichés.
--   * Après correctif : la page d'une gamme sans produit répond 410 Gone
--     (statut de substitution, en-têtes noindex) ; une gamme de niveau ≠ 1 est
--     servie en « noindex, nofollow » (gamme-response-builder.service.ts).
--   * build_gamme_page_payload(7170) rend page_info (alias, niveau 4) en
--     lecture seule : seule l'écriture du cache manquait.
--   * Une seule fonction STABLE/IMMUTABLE de public appelle une fonction qui
--     écrit : celle-ci. __gov_m7_stable_function_volatility() ne la signale
--     pas, car il ne lit que les écritures DIRECTES du corps.
--
-- EFFET DE BORD ASSUMÉ : chaque gamme éligible visitée pour la première fois
-- ajoute une ligne à __gamme_page_cache (≈ 15 kB par ligne, 238 lignes =
-- 3,5 MB) ; au plus ≈ 5 300 lignes, soit ≈ 80 MB. Le DELETE d'une gamme hors
-- catalogue sans ligne ne fait rien. L'appel imbriqué s'exécute sous le
-- propriétaire postgres (SECURITY DEFINER) : rebuild_gamme_page_cache reste
-- fermée aux rôles API, comme le décrit 20260917_definer_rpc_anon_lockdown.sql.
--
-- Pourquoi ALTER FUNCTION et non CREATE OR REPLACE : seule la volatilité
-- change ; recopier le corps serait un risque de dérive pour zéro valeur
-- (même choix que 20260902_b0_rm_rpc_volatility_stable.sql). Idempotent.
--
-- assume_in_transaction (squawk) : pas de BEGIN/COMMIT explicite. Timeouts requis
-- (squawk require-timeout-settings) avant ALTER FUNCTION.
--
-- RETOUR ARRIÈRE : 20261105_gamme_page_cached_volatile.down.sql (rétablit
-- STABLE, et donc le 503 → 404 décrit ci-dessus).

SET lock_timeout = '5s';
SET statement_timeout = '30s';

-- Garde d'entrée : la fonction doit être celle que décrit ce fichier.
DO $precheck$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.oid = to_regprocedure('public.get_gamme_page_data_cached(integer)')
       AND p.prosecdef
       AND pg_get_userbyid(p.proowner) = 'postgres'
       AND p.prosrc ~ '\mrebuild_gamme_page_cache\s*\('
  ) THEN
    RAISE EXCEPTION 'ABORT: public.get_gamme_page_data_cached(integer) absente, non SECURITY DEFINER, d''un autre propriétaire, ou sans appel à rebuild_gamme_page_cache';
  END IF;
END
$precheck$;

ALTER FUNCTION public.get_gamme_page_data_cached(integer) VOLATILE;

COMMENT ON FUNCTION public.get_gamme_page_data_cached(integer) IS
  'ADR-024 : getter cache-first de la page gamme R1. VOLATILE (pas STABLE) : sur cache absent ou périmé, il écrit __gamme_page_cache via rebuild_gamme_page_cache ; PostgREST doit donc l''exécuter en lecture-écriture. Voir 20261105_gamme_page_cached_volatile.sql.';

-- Garde de fin : la migration échoue (et rien n'est appliqué) si la fonction
-- n'est pas VOLATILE SECURITY DEFINER, propriétaire postgres, search_path public.
DO $postcheck$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.oid = to_regprocedure('public.get_gamme_page_data_cached(integer)')
       AND p.provolatile = 'v'
       AND p.prosecdef
       AND pg_get_userbyid(p.proowner) = 'postgres'
       AND p.proconfig = ARRAY['search_path=public']
  ) THEN
    RAISE EXCEPTION 'ABORT: état de get_gamme_page_data_cached inattendu (VOLATILE SECURITY DEFINER, propriétaire postgres, search_path public)';
  END IF;
END
$postcheck$;

-- =============================================================================
-- Vérification post-migration (lecture seule, à jouer après apply)
-- =============================================================================
--   SELECT p.provolatile, p.prosecdef, p.proconfig
--     FROM pg_proc p
--    WHERE p.oid = 'public.get_gamme_page_data_cached(integer)'::regprocedure;
--   -- attendu : v, true, {search_path=public}
--
-- Puis, sur le backend :
--   GET /api/gamme-rest/7170/page-data-rpc-v2          → 200 (était 503)
--   GET /pieces/kit-de-cylindres-cle-a-choc-7170.html  → 410 (était 404)
--   GET /pieces/plaquette-de-frein-402.html            → 200 (inchangé)
-- =============================================================================
