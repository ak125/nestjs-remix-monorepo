-- =============================================================================
-- Migration : définition SQL unique de « vendable » (décision 118) et lecture
--             des véhicules d'une gamme qui portent au moins une pièce vendable
--             (décision 48, sitemap gamme × véhicule)
-- Date      : 2026-11-18 (mandat CT)
-- Scope     : TROIS fonctions créées, en lecture seule. Aucune table créée ou
--             modifiée, aucun droit de table touché, aucune donnée écrite,
--             aucune fonction existante touchée (get_pieces_for_type_gamme_v3
--             et get_listing_products_extended_filtered restent inchangées).
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- =============================================================================
--
-- CONTEXTE
-- --------
-- Décision 118 : une pièce est vendable si pri_dispo vaut 1 (en stock),
-- 2 (stock faible) ou 3 (sur commande, délai affiché), si son tarif n'est pas
-- FROZEN et si elle n'est pas masquée ; même définition pour les pages et le
-- panier. Côté application, cette règle n'existe qu'à un endroit :
-- backend/src/database/services/vendable.ts (estVendable). Côté base, elle
-- n'existait nulle part comme fonction : chaque RPC la réécrit, et le sitemap
-- gamme × véhicule lit une table figée (__sitemap_p_link, seuil map_has_item).
--
-- 1. public.est_vendable(dispo, état du tarif, prix TTC, pièce affichée)
--    L'expression unique. Mêmes quatre entrées que estVendable, mêmes sources :
--    pieces_price.pri_dispo, pieces_price.pricing_state,
--    pieces_price.pri_vente_ttc_n, pieces.piece_display. Ne lit aucune
--    relation, ne rend jamais NULL. Un prix NaN ou infini est refusé, comme
--    Number.isFinite côté application.
--    Fonction SQL d'une seule expression, ni STRICT, ni SECURITY DEFINER, sans
--    clause SET : le planificateur la remplace par son expression dans la
--    requête appelante. Elle ne coûte donc pas un appel par ligne. Pas de
--    search_path à fixer : le corps ne nomme aucune relation ni fonction du
--    schéma public.
--
-- 2. public.piece_est_vendable(piece_id)
--    Vrai si au moins une ligne de tarif de la pièce est vendable. Même
--    agrégation que l'application (piece-price-data.service.ts : une pièce est
--    vendable si l'une de ses lignes l'est).
--
-- 3. public.get_sitemap_r2_types_vendables(pg_id, type_min, type_max)
--    Les types affichés (auto_type.type_display = '1') de la plage demandée qui
--    ont, pour la gamme, au moins une pièce compatible vendable. Rend UN
--    tableau trié, pas un jeu de lignes : la réponse échappe au plafond de
--    1 000 lignes de PostgREST. Le générateur du sitemap l'appelle par plages
--    de types ; l'indexabilité de la gamme reste décidée par lui, selon sa
--    règle actuelle (pg_display et pg_relfollow), inchangée.
--    Mesuré le 2026-11-18 sur les données réelles, en lecture seule, corps
--    identique : environ 1 ms par couple gamme × type ; chiffres et requêtes
--    dans docs/audit/mandat-ct-vendable-sitemap-r2-20261118/.
--
-- FRAÎCHEUR (décision 51) — volontairement ABSENTE de ces fonctions
-- ----------------------------------------------------------------
-- La fraîcheur d'un tarif régit la SORTIE de vente d'une pièce : le lot de
-- désactivation, quand la fraîcheur d'un fournisseur est activée, passe
-- pri_dispo à '0'. Ces fonctions en héritent par pri_dispo ; y ajouter une date
-- créerait une seconde règle. La base ne porte d'ailleurs aucune trace de la
-- première mise à jour complète d'un fournisseur : l'activation vit dans le
-- code (backend/src/modules/pricing/config/supplier-sale-rules.ts, toutes les
-- dates à null au 2026-11-16).
--
-- DROITS
-- ------
-- Lecture réservée au rôle de service (le backend). Rien pour PUBLIC, anon ni
-- authenticated : les tables lues ne sont pas ouvertes par ces fonctions, qui
-- restent SECURITY INVOKER.
--
-- assume_in_transaction (squawk) : pas de BEGIN/COMMIT explicite. Timeouts requis
-- (squawk require-timeout-settings) avant CREATE FUNCTION.
--
-- REJOUABLE : CREATE OR REPLACE, REVOKE et GRANT sont idempotents.
--
-- RETOUR ARRIÈRE : 20261118_est_vendable_definition_unique.down.sql, à ne lancer
-- qu'APRÈS avoir remis SITEMAP_R2_SOURCE à sa valeur par défaut (legacy), seul
-- appelant de get_sitemap_r2_types_vendables.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

-- 1. L'expression unique -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.est_vendable(
  p_dispo text,
  p_etat_tarif text,
  p_vente_ttc numeric,
  p_piece_affichee boolean
)
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $function$
  SELECT (p_dispo IS NOT NULL AND p_dispo IN ('1', '2', '3'))
     AND p_etat_tarif IS DISTINCT FROM 'FROZEN'
     AND p_piece_affichee IS TRUE
     AND (p_vente_ttc IS NOT NULL
          AND p_vente_ttc > 0
          AND p_vente_ttc < 'Infinity'::numeric)
$function$;

COMMENT ON FUNCTION public.est_vendable(text, text, numeric, boolean) IS
  'Décision 118 — définition unique de « vendable » : pri_dispo 1, 2 ou 3, tarif non FROZEN, pièce affichée, prix TTC fini et positif. Miroir de backend/src/database/services/vendable.ts (estVendable), tenu identique par scripts/ci/check-vendable-mirror.py.';

-- 2. Une pièce -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.piece_est_vendable(p_piece_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.pieces_price pp
      JOIN public.pieces pc ON pc.piece_id = pp.pri_piece_id_i
     WHERE pp.pri_piece_id_i = p_piece_id
       AND public.est_vendable(
             pp.pri_dispo, pp.pricing_state, pp.pri_vente_ttc_n, pc.piece_display)
  )
$function$;

COMMENT ON FUNCTION public.piece_est_vendable(integer) IS
  'Décision 118 — vrai si au moins une ligne de tarif de la pièce satisfait public.est_vendable. Lecture seule.';

-- 3. Les véhicules d'une gamme qui portent au moins une pièce vendable ---------
CREATE OR REPLACE FUNCTION public.get_sitemap_r2_types_vendables(
  p_pg_id integer,
  p_type_min integer,
  p_type_max integer
)
RETURNS integer[]
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $function$
  SELECT coalesce(array_agg(t.type_id_i ORDER BY t.type_id_i), '{}'::integer[])
    FROM public.auto_type t
   WHERE t.type_display = '1'
     AND t.type_id_i BETWEEN p_type_min AND p_type_max
     AND EXISTS (
           SELECT 1
             FROM public.pieces_relation_type r
             JOIN public.pieces pc ON pc.piece_id = r.rtp_piece_id
             JOIN public.pieces_price pp ON pp.pri_piece_id_i = r.rtp_piece_id
            WHERE r.rtp_pg_id = p_pg_id
              AND r.rtp_type_id = t.type_id_i
              AND public.est_vendable(
                    pp.pri_dispo, pp.pricing_state, pp.pri_vente_ttc_n, pc.piece_display)
         )
$function$;

COMMENT ON FUNCTION public.get_sitemap_r2_types_vendables(integer, integer, integer) IS
  'Décision 48 — types affichés de la plage [p_type_min, p_type_max] ayant, pour la gamme p_pg_id, au moins une pièce compatible vendable (public.est_vendable). Tableau trié, lecture seule. Appelant : générateur du sitemap gamme × véhicule.';

-- Droits : le rôle de service seulement ----------------------------------------
REVOKE EXECUTE ON FUNCTION public.est_vendable(text, text, numeric, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.piece_est_vendable(integer)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_sitemap_r2_types_vendables(integer, integer, integer)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.est_vendable(text, text, numeric, boolean)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.piece_est_vendable(integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.get_sitemap_r2_types_vendables(integer, integer, integer)
  TO service_role;
