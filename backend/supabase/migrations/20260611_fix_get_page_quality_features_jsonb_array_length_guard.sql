-- Fix: get_page_quality_features() throws 22023 "cannot get array length of a non-array"
--
-- Root cause (vérifié 2026-06-11) : la fonction calcule les colonnes *_count via
--   jsonb_array_length(COALESCE(sgpg_*, '[]'::jsonb))
-- Le COALESCE ne garde que le SQL-NULL — PAS un jsonb dont le type est non-array
-- (object/scalar). Données réelles de __seo_gamme_purchase_guide :
--   sgpg_faq          = 237 array / 2 OBJECT / 2 null
--   sgpg_brands_guide = 11 array / 213 OBJECT / 17 null   (un guide marques = objet, pas liste)
-- → jsonb_array_length() sur les lignes OBJECT lève 22023. Le chemin app (PostgREST,
--   SELECT *) déclenche l'erreur → fetchFeatures() reçoit [] → QualityScoringEngine
--   score 0 page (silencieux depuis ~mars : la table __quality_page_scores est figée).
--   Le `count(*)` SQL masquait (count n'évalue pas les colonnes projetées).
--
-- Fix (robuste, type-guarded — AUCUNE mutation de données) : router chaque
-- jsonb_array_length(x) via un guard jsonb_typeof. La fonction avait été créée
-- HORS migration (non-versionnée) — cette migration la remet sous contrôle de
-- version via un recreate DÉTERMINISTE depuis sa définition courante (pas de
-- transcription manuelle fragile d'une fonction de ~9 100 caractères).
--
-- Squawk : pas de BEGIN/COMMIT explicite (assume_in_transaction).

-- 1) Helper type-guardé : 0 si non-array / null jsonb.
CREATE OR REPLACE FUNCTION public.safe_jsonb_array_length(x jsonb)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT CASE WHEN jsonb_typeof(x) = 'array' THEN jsonb_array_length(x) ELSE 0 END;
$fn$;

COMMENT ON FUNCTION public.safe_jsonb_array_length(jsonb) IS
  'jsonb_array_length type-guardé (ADR-data-integrity) : retourne 0 pour un jsonb non-array/null au lieu de lever 22023. Migration 20260611.';

-- 2) Recreate get_page_quality_features() depuis sa définition COURANTE, en routant
--    chaque appel `jsonb_array_length(` vers le helper guardé. Déterministe (zéro
--    transcription) + idempotent : le guard `[^a-z_]` empêche de ré-emballer
--    `safe_jsonb_array_length` à un second passage.
DO $mig$
DECLARE
  d text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO d
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = 'get_page_quality_features' AND n.nspname = 'public'
  ORDER BY p.oid
  LIMIT 1;

  IF d IS NULL THEN
    RAISE EXCEPTION 'get_page_quality_features() introuvable — migration abandonnée';
  END IF;

  d := regexp_replace(
         d,
         '([^a-z_])jsonb_array_length\(',
         '\1public.safe_jsonb_array_length(',
         'g'
       );

  EXECUTE d;
END
$mig$;
