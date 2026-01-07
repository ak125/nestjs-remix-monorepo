-- ============================================================================
-- MIGRATION: Bootstrap V-Level Data from Cross Gamme Car
-- ============================================================================
-- Peuple gamme_seo_metrics avec les données initiales depuis __cross_gamme_car_new
-- Chaque véhicule lié à une gamme reçoit un V-Level initial basé sur son rang
--
-- Date: 2025-12-31
-- ============================================================================

-- 1. Ajouter les colonnes V-Level manquantes si elles n'existent pas
DO $$
BEGIN
  -- Colonnes V-Level nécessaires
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gamme_seo_metrics' AND column_name = 'gamme_name') THEN
    ALTER TABLE gamme_seo_metrics ADD COLUMN gamme_name TEXT;
    RAISE NOTICE 'Colonne gamme_name ajoutée';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gamme_seo_metrics' AND column_name = 'model_name') THEN
    ALTER TABLE gamme_seo_metrics ADD COLUMN model_name TEXT;
    RAISE NOTICE 'Colonne model_name ajoutée';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gamme_seo_metrics' AND column_name = 'brand') THEN
    ALTER TABLE gamme_seo_metrics ADD COLUMN brand TEXT;
    RAISE NOTICE 'Colonne brand ajoutée';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gamme_seo_metrics' AND column_name = 'variant_name') THEN
    ALTER TABLE gamme_seo_metrics ADD COLUMN variant_name TEXT;
    RAISE NOTICE 'Colonne variant_name ajoutée';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gamme_seo_metrics' AND column_name = 'energy') THEN
    ALTER TABLE gamme_seo_metrics ADD COLUMN energy TEXT;
    RAISE NOTICE 'Colonne energy ajoutée';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gamme_seo_metrics' AND column_name = 'v_level') THEN
    ALTER TABLE gamme_seo_metrics ADD COLUMN v_level TEXT DEFAULT 'V5';
    RAISE NOTICE 'Colonne v_level ajoutée';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gamme_seo_metrics' AND column_name = 'rank') THEN
    ALTER TABLE gamme_seo_metrics ADD COLUMN rank INTEGER DEFAULT 999;
    RAISE NOTICE 'Colonne rank ajoutée';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gamme_seo_metrics' AND column_name = 'score') THEN
    ALTER TABLE gamme_seo_metrics ADD COLUMN score INTEGER DEFAULT 0;
    RAISE NOTICE 'Colonne score ajoutée';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gamme_seo_metrics' AND column_name = 'updated_at') THEN
    ALTER TABLE gamme_seo_metrics ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE 'Colonne updated_at ajoutée';
  END IF;

  RAISE NOTICE 'Schema V-Level prêt';
END $$;

-- 2. Créer les index pour les requêtes V-Level
CREATE INDEX IF NOT EXISTS idx_gsm_v_level ON gamme_seo_metrics(v_level);
CREATE INDEX IF NOT EXISTS idx_gsm_energy ON gamme_seo_metrics(energy);
CREATE INDEX IF NOT EXISTS idx_gsm_model ON gamme_seo_metrics(model_name);

-- 3. Insérer les données V-Level depuis __cross_gamme_car_new
-- Grouper par gamme + énergie et assigner les rangs
WITH ranked_vehicles AS (
  SELECT DISTINCT
    cgc.cgc_pg_id AS pg_id,
    pg.pg_name AS gamme_name,
    am.modele_name AS model_name,
    amb.marque_name AS brand,
    at.type_name AS variant_name,
    CASE
      WHEN LOWER(at.type_fuel) LIKE '%diesel%' OR LOWER(at.type_fuel) LIKE '%gasoil%' THEN 'diesel'
      WHEN LOWER(at.type_fuel) LIKE '%essence%' OR LOWER(at.type_fuel) LIKE '%petrol%' OR LOWER(at.type_fuel) LIKE '%benzin%' THEN 'essence'
      WHEN LOWER(at.type_fuel) LIKE '%hybrid%' THEN 'hybride'
      WHEN LOWER(at.type_fuel) LIKE '%electr%' THEN 'electrique'
      ELSE COALESCE(at.type_fuel, 'unknown')
    END AS energy,
    ROW_NUMBER() OVER (
      PARTITION BY cgc.cgc_pg_id,
        CASE
          WHEN LOWER(at.type_fuel) LIKE '%diesel%' OR LOWER(at.type_fuel) LIKE '%gasoil%' THEN 'diesel'
          WHEN LOWER(at.type_fuel) LIKE '%essence%' OR LOWER(at.type_fuel) LIKE '%petrol%' OR LOWER(at.type_fuel) LIKE '%benzin%' THEN 'essence'
          ELSE COALESCE(at.type_fuel, 'unknown')
        END
      ORDER BY at.type_power_ps DESC NULLS LAST, at.type_id
    ) AS energy_rank
  FROM __cross_gamme_car_new cgc
  INNER JOIN auto_type at ON at.type_id::TEXT = cgc.cgc_type_id
  INNER JOIN auto_modele am ON am.modele_id::TEXT = at.type_modele_id
  INNER JOIN auto_marque amb ON amb.marque_id = am.modele_marque_id
  INNER JOIN pieces_gamme pg ON pg.pg_id::TEXT = cgc.cgc_pg_id
  WHERE cgc.cgc_level IN ('1', '2')
    AND at.type_display = '1'
    AND am.modele_display = 1
    AND pg.pg_display = '1'
)
INSERT INTO gamme_seo_metrics (
  pg_id,
  gamme_name,
  model_name,
  brand,
  variant_name,
  energy,
  v_level,
  rank,
  score,
  search_volume,
  updated_at
)
SELECT
  pg_id::INTEGER,
  gamme_name,
  model_name,
  brand,
  variant_name,
  energy,
  CASE
    WHEN energy_rank = 1 THEN 'V2'  -- Champion gamme par énergie
    WHEN energy_rank <= 4 THEN 'V3'  -- Challengers (positions 2-4)
    ELSE 'V5'  -- Bloc B (reste)
  END AS v_level,
  energy_rank AS rank,
  CASE
    WHEN energy_rank = 1 THEN 100
    WHEN energy_rank <= 4 THEN 80 - (energy_rank * 10)
    ELSE 20
  END AS score,
  0 AS search_volume,  -- À peupler via Google Trends
  NOW() AS updated_at
FROM ranked_vehicles
ON CONFLICT DO NOTHING;

-- 4. Afficher les statistiques
DO $$
DECLARE
  v_count INTEGER;
  v2_count INTEGER;
  v3_count INTEGER;
  v5_count INTEGER;
  gammes_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM gamme_seo_metrics WHERE v_level IS NOT NULL;
  SELECT COUNT(*) INTO v2_count FROM gamme_seo_metrics WHERE v_level = 'V2';
  SELECT COUNT(*) INTO v3_count FROM gamme_seo_metrics WHERE v_level = 'V3';
  SELECT COUNT(*) INTO v5_count FROM gamme_seo_metrics WHERE v_level = 'V5';
  SELECT COUNT(DISTINCT pg_id) INTO gammes_count FROM gamme_seo_metrics WHERE v_level IS NOT NULL;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'V-Level Bootstrap Complete:';
  RAISE NOTICE '  Total records: %', v_count;
  RAISE NOTICE '  V2 (Champions): %', v2_count;
  RAISE NOTICE '  V3 (Challengers): %', v3_count;
  RAISE NOTICE '  V5 (Bloc B): %', v5_count;
  RAISE NOTICE '  Gammes couvertes: %', gammes_count;
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- NOTES:
-- - V1 (Global Champions) sera calculé par validateV1Rules() après avoir
--   collecté les search_volume via Google Trends
-- - V4 (Faibles) sera assigné aux variants avec search_volume = 0 après
--   la collecte de données
-- - Pour lancer le recalcul: POST /api/admin/gammes-seo/:pgId/recalculate-vlevel
-- ============================================================================
