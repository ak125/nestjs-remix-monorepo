-- 2026-04-23: extract_vehicle_keywords — matching modeles avec romain OU arabe
-- ----------------------------------------------------------------------------
-- Contexte :
--   auto_modele stocke les noms en chiffres romains ("clio iii", "megane ii",
--   "scenic iii"...) mais les utilisateurs Google tapent en chiffres arabes
--   ("clio 3", "megane 2"). Avant ce patch, "tambour clio 3" ne matchait
--   aucun modele -> model=NULL -> exclu du V-Level.
--
-- Fix :
--   Dans la CTE active_modeles, on genere pour chaque modele au nom contenant
--   des chiffres romains une variante avec chiffres arabes (en plus de la
--   forme originale). Le match LIKE + regex word-boundary utilise les deux
--   formes comme candidats, mais `matched_model` retourne toujours la forme
--   canonique DB (celle du modele_name tel que stocke).
--
-- Impact :
--   1482 modeles actifs avec romains -> couverts par arabe
--   Exemple tambour-de-frein (pg_id=123) : 55 -> 96 vehicle KW tagges
--     (+74%), dont 10 nouveaux clio i/ii/iii/iv
--
-- Rationale additional : le mapping romain->arabe est ordonne du plus long
-- vers le plus court (x, ix, viii, vii, vi, iv, v, iii, ii, i) car sinon
-- "iii" serait transforme en "1ii" par le remplacement precoce de "i\y".

CREATE OR REPLACE FUNCTION public.extract_vehicle_keywords(p_pg_id integer)
 RETURNS TABLE(kw_id bigint, kw text, matched_model text, matched_energy text, was_updated boolean)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  WITH
  -- Base : restriction aux modeles avec types actifs
  base_modeles AS (
    SELECT DISTINCT lower(m.modele_name) AS original_name
    FROM auto_modele m
    WHERE EXISTS (
      SELECT 1 FROM auto_type t
      WHERE t.type_modele_id::text = m.modele_id::text AND t.type_display='1'
    )
    AND length(m.modele_name) >= 3
  ),
  -- Generation variantes : original + forme arabe (si contient des romains)
  active_modeles AS (
    SELECT original_name AS canonical, original_name AS match_form, length(original_name) AS len
    FROM base_modeles
    UNION
    SELECT
      b.original_name AS canonical,
      regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
        b.original_name,
        '\yx\y',    '10', 'g'),
        '\yix\y',   '9',  'g'),
        '\yviii\y', '8',  'g'),
        '\yvii\y',  '7',  'g'),
        '\yvi\y',   '6',  'g'),
        '\yiv\y',   '4',  'g'),
        '\yv\y',    '5',  'g'),
        '\yiii\y',  '3',  'g'),
        '\yii\y',   '2',  'g'),
        '\yi\y',    '1',  'g'
      ) AS match_form,
      length(b.original_name) AS len
    FROM base_modeles b
    WHERE b.original_name ~ '\y(i{1,3}|iv|v|vi{0,3}|ix|x)\y'
      AND b.original_name <> regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
          b.original_name,
          '\yx\y',    '10', 'g'),
          '\yix\y',   '9',  'g'),
          '\yviii\y', '8',  'g'),
          '\yvii\y',  '7',  'g'),
          '\yvi\y',   '6',  'g'),
          '\yiv\y',   '4',  'g'),
          '\yv\y',    '5',  'g'),
          '\yiii\y',  '3',  'g'),
          '\yii\y',   '2',  'g'),
          '\yi\y',    '1',  'g')
  ),
  kw_pool AS (
    SELECT sk.id AS sk_id, sk.keyword AS sk_kw, lower(sk.keyword_normalized) AS k_norm
    FROM __seo_keywords sk WHERE sk.pg_id = p_pg_id
  ),
  candidates AS (
    SELECT kp.sk_id, kp.sk_kw, kp.k_norm, am.canonical AS name_lower, am.match_form, am.len
    FROM kw_pool kp
    JOIN active_modeles am ON kp.k_norm LIKE '%' || am.match_form || '%'
  ),
  matches AS (
    SELECT DISTINCT ON (c.sk_id)
      c.sk_id, c.sk_kw, c.name_lower AS model_matched, c.k_norm
    FROM candidates c
    WHERE c.k_norm ~ ('\y' || c.match_form || '\y')
    ORDER BY c.sk_id, c.len DESC
  ),
  with_energy AS (
    SELECT
      mm.sk_id, mm.sk_kw, mm.model_matched,
      CASE
        WHEN mm.k_norm ~ '\y(hdi|tdi|multijet|jtd|cdi|dci|diesel)\y' THEN 'diesel'
        WHEN mm.k_norm ~ '\y(tce|thp|gti|essence|vti)\y' THEN 'essence'
        ELSE NULL
      END AS energy_detected
    FROM matches mm
  ),
  upd AS (
    UPDATE __seo_keywords s
    SET
      type = 'vehicle',
      model = we.model_matched,
      energy = COALESCE(we.energy_detected, s.energy)
    FROM with_energy we
    WHERE s.id = we.sk_id
      AND (s.model IS DISTINCT FROM we.model_matched OR s.type IS DISTINCT FROM 'vehicle')
    RETURNING s.id AS upd_id
  )
  SELECT
    we.sk_id, we.sk_kw, we.model_matched, we.energy_detected,
    (we.sk_id IN (SELECT upd_id FROM upd)) AS was_updated
  FROM with_energy we;
END;
$function$;

COMMENT ON FUNCTION public.extract_vehicle_keywords(integer) IS
  'V1.1 (2026-04-23): matches modeles both in original form (clio iii) and arabic form (clio 3). Covers 1482 roman-numeral modeles. Returns canonical name in matched_model (always the original modele_name form from DB, never arabic).';
