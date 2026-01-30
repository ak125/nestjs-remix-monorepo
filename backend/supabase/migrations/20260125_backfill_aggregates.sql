-- ============================================================================
-- MIGRATION: Centralisation SEO - Backfill Données Existantes
-- ============================================================================
-- Phase 3: Remplir les nouvelles colonnes avec les données existantes
-- - V-Level counts depuis __seo_keywords
-- - G-Level calculé depuis pg_top/pg_level
-- - Smart Action primaire basé sur seuils
-- - seo_score = priority_score
--
-- Date: 2026-01-25
-- ============================================================================

-- 1. Backfill V-Level counts depuis __seo_keywords
-- Note: Le trigger ne s'exécute que sur INSERT/UPDATE/DELETE futurs,
-- donc on doit peupler les données existantes manuellement

UPDATE gamme_aggregates ga
SET
  v2_count = COALESCE(kw.v2_count, 0),
  v3_count = COALESCE(kw.v3_count, 0),
  v4_count = COALESCE(kw.v4_count, 0),
  v5_count = COALESCE(kw.v5_count, 0),
  keyword_total = COALESCE(kw.total, 0)
FROM (
  SELECT
    pg.pg_id,
    COUNT(*) FILTER (WHERE k.v_level = 'V2') as v2_count,
    COUNT(*) FILTER (WHERE k.v_level = 'V3') as v3_count,
    COUNT(*) FILTER (WHERE k.v_level = 'V4') as v4_count,
    COUNT(*) FILTER (WHERE k.v_level = 'V5') as v5_count,
    COUNT(*) as total
  FROM __seo_keywords k
  JOIN pieces_gamme pg ON (pg.pg_name = k.gamme OR pg.pg_alias = k.gamme)
  GROUP BY pg.pg_id
) kw
WHERE kw.pg_id = ga.ga_pg_id;

-- 2. Calculer G-Level initial basé sur pg_top et pg_level
UPDATE gamme_aggregates
SET g_level = CASE
  WHEN pg_top = '1' THEN 'G1'   -- Gammes prioritaires (top)
  WHEN pg_level = '1' THEN 'G2' -- Gammes principales (niveau 1)
  ELSE 'G3'                     -- Autres gammes
END
WHERE g_level IS NULL OR g_level = 'G3';

-- 3. Initialiser seo_score depuis priority_score existant
UPDATE gamme_aggregates
SET seo_score = COALESCE(priority_score, 0)
WHERE seo_score = 0 OR seo_score IS NULL;

-- 4. Calculer Smart Action primaire (basé sur seuils par défaut)
-- Matrice de décision:
-- | trends_index | seo_score | Action           |
-- |--------------|-----------|------------------|
-- | >= 50        | >= 75     | INDEX_G1         |
-- | >= 50        | >= 45     | INDEX            |
-- | >= 50        | < 45      | INVESTIGUER      |
-- | >= 20        | >= 75     | OBSERVER         |
-- | < 20         | >= 75     | PARENT           |
-- | >= 20        | >= 45     | EVALUER          |
-- | < 20         | < 45      | NOINDEX          |

UPDATE gamme_aggregates
SET smart_action_primary = CASE
  -- Haute tendance + bon score = INDEX prioritaire
  WHEN trends_index >= 50 AND seo_score >= 75 THEN 'INDEX_G1'
  -- Haute tendance + score moyen = INDEX standard
  WHEN trends_index >= 50 AND seo_score >= 45 THEN 'INDEX'
  -- Haute tendance + faible score = Investiguer pourquoi
  WHEN trends_index >= 50 AND seo_score < 45 THEN 'INVESTIGUER'
  -- Tendance moyenne + bon score = Observer l'évolution
  WHEN trends_index >= 20 AND seo_score >= 75 THEN 'OBSERVER'
  -- Faible tendance + bon score = Utiliser comme parent/hub
  WHEN trends_index < 20 AND seo_score >= 75 THEN 'PARENT'
  -- Tendance moyenne + score moyen = Évaluer le potentiel
  WHEN trends_index >= 20 AND seo_score >= 45 THEN 'EVALUER'
  -- Sinon NOINDEX par défaut
  ELSE 'NOINDEX'
END
WHERE smart_action_primary IS NULL;

-- 5. Vérification et rapport
DO $$
DECLARE
  total_updated INTEGER;
  with_keywords INTEGER;
  g1_count INTEGER;
  g2_count INTEGER;
  g3_count INTEGER;
BEGIN
  -- Compter les mises à jour
  SELECT COUNT(*) INTO total_updated FROM gamme_aggregates WHERE keyword_total > 0;
  SELECT COUNT(*) INTO with_keywords FROM gamme_aggregates WHERE v2_count > 0 OR v3_count > 0 OR v4_count > 0;

  -- Distribution G-Level
  SELECT COUNT(*) INTO g1_count FROM gamme_aggregates WHERE g_level = 'G1';
  SELECT COUNT(*) INTO g2_count FROM gamme_aggregates WHERE g_level = 'G2';
  SELECT COUNT(*) INTO g3_count FROM gamme_aggregates WHERE g_level = 'G3';

  RAISE NOTICE '✅ Migration 20260125_backfill_aggregates complète';
  RAISE NOTICE '   - Gammes avec keywords: %', total_updated;
  RAISE NOTICE '   - Gammes avec V-Level counts: %', with_keywords;
  RAISE NOTICE '   - G-Level distribution: G1=%, G2=%, G3=%', g1_count, g2_count, g3_count;
END $$;

-- 6. Créer index sur nouvelles colonnes si manquants
CREATE INDEX IF NOT EXISTS idx_ga_seo_score ON gamme_aggregates(seo_score DESC);
