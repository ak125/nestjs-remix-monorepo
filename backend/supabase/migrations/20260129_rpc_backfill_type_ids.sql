-- RPC: backfill_seo_keywords_type_ids
-- Date: 2026-01-29
-- Description: Backfill batch des type_id manquants dans __seo_keywords
-- Usage: SELECT * FROM backfill_seo_keywords_type_ids(100)

CREATE OR REPLACE FUNCTION backfill_seo_keywords_type_ids(
  p_batch_size int DEFAULT 100
)
RETURNS TABLE(
  processed int,
  matched int,
  unmatched int
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_processed int := 0;
  v_matched int := 0;
  v_unmatched int := 0;
  v_keyword RECORD;
  v_resolved_type_id bigint;
  v_model_clean text;
  v_variant_clean text;
BEGIN
  -- Traiter les keywords vehicule sans type_id
  FOR v_keyword IN
    SELECT id, model, variant, energy
    FROM __seo_keywords
    WHERE type = 'vehicle'
      AND type_id IS NULL
      AND v_level IS NOT NULL
      AND model IS NOT NULL
      AND variant IS NOT NULL
    ORDER BY id
    LIMIT p_batch_size
  LOOP
    v_processed := v_processed + 1;

    -- Nettoyer model et variant
    v_model_clean := LOWER(TRIM(v_keyword.model));
    v_variant_clean := LOWER(TRIM(v_keyword.variant));

    -- Tenter de resoudre le type_id avec scoring
    SELECT t.type_id::bigint INTO v_resolved_type_id
    FROM auto_type t
    JOIN auto_modele mo ON t.type_modele_id::text = mo.modele_id::text
    WHERE
      -- Match modele (fuzzy mais raisonnable)
      (
        LOWER(mo.modele_name) = v_model_clean
        OR LOWER(mo.modele_name) LIKE v_model_clean || '%'
        OR LOWER(mo.modele_alias) = v_model_clean
        OR LOWER(mo.modele_alias) LIKE v_model_clean || '%'
      )
      -- Match variant dans type_name ou type_engine
      AND (
        -- Match exact ou partiel sur type_name
        LOWER(t.type_name) LIKE '%' || REPLACE(v_variant_clean, ' ', '%') || '%'
        -- OU match sur type_engine
        OR (t.type_engine IS NOT NULL AND LOWER(t.type_engine) LIKE '%' || REPLACE(v_variant_clean, ' ', '%') || '%')
      )
      -- Match energy si renseigne
      AND (
        v_keyword.energy IS NULL
        OR v_keyword.energy = 'unknown'
        OR v_keyword.energy = ''
        OR (v_keyword.energy = 'diesel' AND LOWER(COALESCE(t.type_fuel, '')) LIKE '%diesel%')
        OR (v_keyword.energy = 'essence' AND (
          LOWER(COALESCE(t.type_fuel, '')) LIKE '%essence%'
          OR LOWER(COALESCE(t.type_fuel, '')) LIKE '%gasoline%'
          OR LOWER(COALESCE(t.type_fuel, '')) LIKE '%petrol%'
        ))
        OR (v_keyword.energy = 'hybride' AND LOWER(COALESCE(t.type_fuel, '')) LIKE '%hybrid%')
        OR (v_keyword.energy = 'electrique' AND LOWER(COALESCE(t.type_fuel, '')) LIKE '%electr%')
      )
      AND t.type_display = '1'
    ORDER BY
      -- Priorite 1: match exact sur modele
      CASE
        WHEN LOWER(mo.modele_name) = v_model_clean THEN 0
        WHEN LOWER(mo.modele_alias) = v_model_clean THEN 1
        ELSE 2
      END,
      -- Priorite 2: match exact sur variant dans type_name
      CASE
        WHEN LOWER(t.type_name) LIKE '%' || v_variant_clean || '%' THEN 0
        ELSE 1
      END,
      -- Priorite 3: preferer types avec puissance renseignee
      CASE WHEN t.type_power_ps IS NOT NULL AND t.type_power_ps != '' THEN 0 ELSE 1 END,
      -- Priorite 4: preferer types avec annees renseignees
      CASE WHEN t.type_year_from IS NOT NULL AND t.type_year_from != '' THEN 0 ELSE 1 END
    LIMIT 1;

    IF v_resolved_type_id IS NOT NULL THEN
      -- Mettre a jour le keyword avec le type_id trouve
      UPDATE __seo_keywords
      SET type_id = v_resolved_type_id
      WHERE id = v_keyword.id;

      v_matched := v_matched + 1;
    ELSE
      v_unmatched := v_unmatched + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_processed, v_matched, v_unmatched;
END;
$$;

-- Commentaire
COMMENT ON FUNCTION backfill_seo_keywords_type_ids(int) IS 'Backfill automatique des type_id manquants par matching model+variant+energy vers auto_type';

-- Vue helper pour voir les keywords non-matches (debug)
CREATE OR REPLACE VIEW v_seo_keywords_unmatched AS
SELECT
  id,
  gamme,
  keyword,
  model,
  variant,
  energy,
  v_level,
  volume
FROM __seo_keywords
WHERE type = 'vehicle'
  AND type_id IS NULL
  AND v_level IS NOT NULL
ORDER BY volume DESC NULLS LAST, id;

COMMENT ON VIEW v_seo_keywords_unmatched IS 'Keywords V-Level sans type_id resolu - utile pour debug du backfill';
