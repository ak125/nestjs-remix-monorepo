-- 2026-04-23: match_keyword_text_to_vehicle + _batch
-- ----------------------------------------------------------------------------
-- Pure-function (STABLE, no DB write) qui extrait model+energy depuis un texte
-- brut, sans necessiter de row __seo_keywords prealable.
--
-- Contexte :
--   scripts/insert-missing-keywords.ts embarquait des regex hardcodees
--   (clio/megane/scenic/c3/c4/etc) lignes 302-350 qui rataient TOUS les
--   modeles anciens (2cv, c15, c25, espace, xantia, saxo, yaris, etc).
--   Sur pg_id=258 (maitre-cylindre-de-frein) le script TS matchait 0 KW
--   vehicule alors que extract_vehicle_keywords(258) en matchait 59.
--
-- Fix canon :
--   Meme logique que extract_vehicle_keywords (CTE base_modeles avec 3 formes :
--   original, arabic from roman, digit-letter collapsed) mais sans UPDATE DB.
--   Le script TS appelle cette RPC via match_keyword_text_to_vehicle_batch
--   (accepte text[]) pour resoudre model+energy en un seul round-trip.
--
-- Normalisation input :
--   - lowercase + translate accents/apostrophes/hyphens → espaces
--   - collapse whitespace
--
-- 3 match_forms par modele dans auto_modele :
--   1. original : "clio iii", "2 cv", "c15"
--   2. arabic from roman : "clio 3", "espace 4" (si le modele contient i-x)
--   3. digit-letter collapsed : "2cv" pour "2 cv" (si le modele a pattern "\d \w")
--
-- Resultat sur sanity tests :
--   2cv        → "2 cv"       ✅
--   c15        → "c15"        ✅ (inchange)
--   clio 3     → "clio iii"   ✅
--   306 hdi    → "306"/diesel ✅
--   twingo 1   → "twingo i"   ✅
--   espace 4   → "espace iv"  ✅
--   xantia     → "xantia"     ✅
--   saxo       → "saxo"       ✅
--
-- Impact script insert-missing-keywords.ts sur pg_id=258 :
--   AVANT : 0 vehicles detected → V2=0 V3=0 V4=0 V5=0 (v_level=NULL pour 313 KW)
--   APRES : 66 vehicles detected → V2=8 V3=23 V4=15 V5=0 (46 type_ids classifies)
--
-- Idempotent : aucune ecriture DB.

CREATE OR REPLACE FUNCTION public.match_keyword_text_to_vehicle(p_text text)
 RETURNS TABLE(matched_model text, matched_energy text)
 LANGUAGE plpgsql STABLE
AS $function$
DECLARE
  v_norm text;
BEGIN
  v_norm := lower(p_text);
  v_norm := translate(v_norm,
    'àâäéèêëîïôöùûüç''-_',
    'aaaeeeeiioouuuc   '
  );
  v_norm := regexp_replace(v_norm, '\s+', ' ', 'g');
  v_norm := trim(v_norm);

  RETURN QUERY
  WITH
  base_modeles AS (
    SELECT DISTINCT lower(m.modele_name) AS original_name
    FROM auto_modele m
    WHERE EXISTS (
      SELECT 1 FROM auto_type t
      WHERE t.type_modele_id::text = m.modele_id::text AND t.type_display='1'
    )
    AND length(m.modele_name) >= 2
  ),
  active_modeles AS (
    -- Form 1 : original
    SELECT original_name AS canonical, original_name AS match_form, length(original_name) AS len
    FROM base_modeles
    UNION
    -- Form 2 : arabic from roman (clio iii → clio 3)
    SELECT b.original_name,
      regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
        b.original_name,
        '\yx\y', '10', 'g'), '\yix\y', '9', 'g'), '\yviii\y', '8', 'g'),
        '\yvii\y', '7', 'g'), '\yvi\y', '6', 'g'), '\yiv\y', '4', 'g'),
        '\yv\y', '5', 'g'), '\yiii\y', '3', 'g'), '\yii\y', '2', 'g'),
        '\yi\y', '1', 'g'),
      length(b.original_name)
    FROM base_modeles b
    WHERE b.original_name ~ '\y(i{1,3}|iv|v|vi{0,3}|ix|x)\y'
      AND b.original_name <> regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
          b.original_name,
          '\yx\y', '10', 'g'), '\yix\y', '9', 'g'), '\yviii\y', '8', 'g'),
          '\yvii\y', '7', 'g'), '\yvi\y', '6', 'g'), '\yiv\y', '4', 'g'),
          '\yv\y', '5', 'g'), '\yiii\y', '3', 'g'), '\yii\y', '2', 'g'),
          '\yi\y', '1', 'g')
    UNION
    -- Form 3 : digit-letter collapsed (2 cv → 2cv)
    SELECT b.original_name,
      regexp_replace(b.original_name, '(\d)\s+([a-z])', '\1\2', 'g'),
      length(b.original_name)
    FROM base_modeles b
    WHERE b.original_name ~ '\d\s+[a-z]'
  ),
  candidates AS (
    SELECT am.canonical AS name_lower, am.match_form, am.len
    FROM active_modeles am
    WHERE v_norm LIKE '%' || am.match_form || '%'
  ),
  picked AS (
    SELECT c.name_lower AS model_matched
    FROM candidates c
    WHERE v_norm ~ ('\y' || c.match_form || '\y')
    ORDER BY c.len DESC
    LIMIT 1
  )
  SELECT
    (SELECT model_matched FROM picked),
    CASE
      WHEN v_norm ~ '\y(hdi|tdi|multijet|jtd|cdi|dci|diesel)\y' THEN 'diesel'
      WHEN v_norm ~ '\y(tce|thp|gti|essence|vti)\y' THEN 'essence'
      WHEN v_norm ~ '\y(phev|hybrid|hybride)\y' THEN 'hybride'
      WHEN v_norm ~ '\y(electrique|electric|bev|ev)\y' THEN 'electrique'
      WHEN v_norm ~ '\y(gpl|lpg|bifuel)\y' THEN 'gpl'
      ELSE NULL
    END;
END;
$function$;

COMMENT ON FUNCTION public.match_keyword_text_to_vehicle(text) IS
  'Pure-function (STABLE, no DB write) variant of extract_vehicle_keywords. Returns (model, energy) from auto_modele catalog with roman/arabic/collapsed aliases. Canon for scripts/insert-missing-keywords.ts — replaces hardcoded regex.';


-- Batch variant pour appel depuis un script qui a un array de KW
CREATE OR REPLACE FUNCTION public.match_keyword_text_to_vehicle_batch(p_texts text[])
 RETURNS TABLE(input text, matched_model text, matched_energy text)
 LANGUAGE plpgsql STABLE
AS $function$
BEGIN
  RETURN QUERY
  SELECT t.input, mk.matched_model, mk.matched_energy
  FROM unnest(p_texts) AS t(input),
       LATERAL public.match_keyword_text_to_vehicle(t.input) mk;
END;
$function$;

COMMENT ON FUNCTION public.match_keyword_text_to_vehicle_batch(text[]) IS
  'Batch wrapper around match_keyword_text_to_vehicle for TS scripts. Returns (input, model, energy) per input text.';


GRANT EXECUTE ON FUNCTION public.match_keyword_text_to_vehicle(text) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.match_keyword_text_to_vehicle_batch(text[]) TO authenticated, service_role, anon;
