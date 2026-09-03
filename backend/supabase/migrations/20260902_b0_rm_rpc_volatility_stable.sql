-- Migration: 20260902_b0_rm_rpc_volatility_stable
-- Slice B0 du plan massdoc (2026-09-02) — hygiène de métadonnée, SANS promesse
-- de gain de performance.
--
-- Constat (pg_proc, PROD, lecture seule, 2026-09-02) :
--   rm_get_page_complete_v2(integer, bigint, integer)
--     plpgsql, SECURITY DEFINER, VOLATILE / PARALLEL UNSAFE, 12 767 caractères,
--     0 INSERT/UPDATE/DELETE/TRUNCATE ; callee unique :
--     get_listing_products_extended_filtered (sql, STABLE).
--   get_pieces_for_type_gamme_v3(integer, integer)
--     plpgsql, SECURITY DEFINER, VOLATILE / PARALLEL UNSAFE, 18 757 caractères,
--     0 écriture ; callee unique : process_seo_template (plpgsql, STABLE).
--   Aucun des deux corps ne contient TEMP / nextval / setval / pg_advisory_* /
--   NOTIFY (les hazards d'une transaction READ ONLY PostgREST).
--   Leur moteur interne get_listing_products_extended est déjà STABLE
--   PARALLEL SAFE : la métadonnée des wrappers est fausse par omission.
--
-- Pourquoi STABLE : déclarer la volatilité réelle est un prérequis à tout
-- inlining / réécriture ultérieure (B6) et rend cohérent le couple wrapper /
-- moteur. Garde-fou déjà armé : __gov_m7_stable_function_volatility (incident
-- 2026-05-22, get_vehicle_page_data_cached déclarée STABLE alors qu'elle
-- écrivait → 5xx sous transaction read-only PostgREST). La condition causale
-- est ici mesurée absente (0 écriture dans les corps ET dans les callees).
--
-- Pourquoi PAS PARALLEL SAFE : plpgsql + `SELECT … INTO` (limite de lignes
-- SPI) désactive les plans parallèles quelle que soit la déclaration. Aucun
-- gain à attendre, aucune promesse faite (plan massdoc, NO-GO 6b).
--
-- Pourquoi ALTER FUNCTION et non CREATE OR REPLACE : seule la métadonnée
-- change ; recopier 31 k caractères de corps serait un risque de dérive pour
-- zéro valeur. Idempotent (ALTER vers la volatilité déjà en place = no-op),
-- transactionnel, réversible (.down.sql : VOLATILE).
--
-- Vérification attendue APRÈS apply (owner) :
--   1. pg_proc.provolatile = 's' pour les deux fonctions ;
--   2. SELECT * FROM __gov_m7_stable_function_volatility() → aucune ligne
--      writes = true pour ces deux noms ;
--   3. EXPLAIN (ANALYZE, BUFFERS) IDENTIQUE avant/après — référence du
--      2026-09-02 (un run, cache tiède) : v2(402, 57414, 200) = 277,9 ms,
--      16 229 hit / 638 read ; v3(57414, 402) = 153,4 ms, 11 552 hit / 171
--      read. Toute apparition d'un nœud Gather serait une surprise à
--      documenter, pas un objectif.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER FUNCTION public.rm_get_page_complete_v2(integer, bigint, integer) STABLE;
ALTER FUNCTION public.get_pieces_for_type_gamme_v3(integer, integer) STABLE;
