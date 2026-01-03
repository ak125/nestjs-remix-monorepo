-- ============================================================================
-- MIGRATION: Consolidation SEO & V-Level (Version Complète)
-- ============================================================================
-- Basé sur la documentation G/V Classification
-- Date: 2026-01-03
-- Cible: 235 gammes principales (pg_level > 0)
-- ============================================================================

-- ============================================================================
-- PARTIE 1: Table gamme_seo_audit (remplace l'usage incorrect de ___xtr_msg)
-- ============================================================================

CREATE TABLE IF NOT EXISTS gamme_seo_audit (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER,
  admin_email TEXT,
  action_type TEXT NOT NULL,  -- 'UPDATE_G_LEVEL', 'UPDATE_V_LEVEL', 'BULK_UPDATE', etc.
  entity_type TEXT DEFAULT 'gamme',  -- 'gamme', 'vehicle', 'model'
  entity_ids INTEGER[],
  old_values JSONB,
  new_values JSONB,
  metadata JSONB,  -- Informations supplémentaires (IP, user-agent, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gamme_seo_audit_date ON gamme_seo_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gamme_seo_audit_admin ON gamme_seo_audit(admin_email);
CREATE INDEX IF NOT EXISTS idx_gamme_seo_audit_action ON gamme_seo_audit(action_type);

COMMENT ON TABLE gamme_seo_audit IS 'Audit trail pour les modifications SEO (G-Level, V-Level)';

-- ============================================================================
-- PARTIE 2: Ajouter G-Level à pieces_gamme
-- ============================================================================

DO $$
BEGIN
  -- Colonne pg_g_level pour classification G1/G2/G3/G4
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'pieces_gamme' AND column_name = 'pg_g_level') THEN
    ALTER TABLE pieces_gamme ADD COLUMN pg_g_level VARCHAR(5);
    RAISE NOTICE 'Colonne pg_g_level ajoutée';
  END IF;

  -- Colonne pour parent (G3 = enfant d'une G1/G2)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'pieces_gamme' AND column_name = 'pg_parent_gamme_id') THEN
    ALTER TABLE pieces_gamme ADD COLUMN pg_parent_gamme_id INTEGER;
    RAISE NOTICE 'Colonne pg_parent_gamme_id ajoutée';
  END IF;
END $$;

-- Index pour requêtes SEO
CREATE INDEX IF NOT EXISTS idx_pg_g_level ON pieces_gamme(pg_g_level);
CREATE INDEX IF NOT EXISTS idx_pg_display_level ON pieces_gamme(pg_display, pg_level);
CREATE INDEX IF NOT EXISTS idx_pg_parent ON pieces_gamme(pg_parent_gamme_id);

-- Mapper pg_level existant vers pg_g_level (UNIQUEMENT pour les 235 gammes principales)
UPDATE pieces_gamme SET pg_g_level = CASE
  WHEN pg_level = '1' THEN 'G1'  -- Prioritaires (114 gammes)
  WHEN pg_level = '2' THEN 'G2'  -- Secondaires (118 gammes)
  WHEN pg_level IN ('3', '4') THEN 'G3'  -- Enfants (1 gamme)
  WHEN pg_level = '5' THEN 'G4'  -- Catalogue-only (2 gammes)
  ELSE NULL  -- Ne pas toucher aux gammes level=0
END
WHERE pg_g_level IS NULL
  AND pg_display = '1'
  AND pg_level::INTEGER > 0;  -- Seulement les 235 gammes principales

-- ============================================================================
-- PARTIE 3: Ajouter colonnes manquantes à gamme_seo_metrics
-- ============================================================================

DO $$
BEGIN
  -- Colonne bloc pour distinguer Bloc A (gamme→véhicule) et Bloc B (véhicule→pièce)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'gamme_seo_metrics' AND column_name = 'bloc') THEN
    ALTER TABLE gamme_seo_metrics ADD COLUMN bloc VARCHAR(5) DEFAULT 'A';
    RAISE NOTICE 'Colonne bloc ajoutée';
  END IF;

  -- Colonne model_id pour lien avec auto_modele
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'gamme_seo_metrics' AND column_name = 'model_id') THEN
    ALTER TABLE gamme_seo_metrics ADD COLUMN model_id INTEGER;
    RAISE NOTICE 'Colonne model_id ajoutée';
  END IF;

  -- Colonne variant_id pour lien avec auto_type
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'gamme_seo_metrics' AND column_name = 'variant_id') THEN
    ALTER TABLE gamme_seo_metrics ADD COLUMN variant_id INTEGER;
    RAISE NOTICE 'Colonne variant_id ajoutée';
  END IF;

  -- Colonne is_v1 pour marquer le V1 global du modèle
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'gamme_seo_metrics' AND column_name = 'is_v1') THEN
    ALTER TABLE gamme_seo_metrics ADD COLUMN is_v1 BOOLEAN DEFAULT FALSE;
    RAISE NOTICE 'Colonne is_v1 ajoutée';
  END IF;

  -- Colonne v2_count pour calcul V1 (nombre de fois V2)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'gamme_seo_metrics' AND column_name = 'v2_count') THEN
    ALTER TABLE gamme_seo_metrics ADD COLUMN v2_count INTEGER DEFAULT 0;
    RAISE NOTICE 'Colonne v2_count ajoutée';
  END IF;
END $$;

-- Index pour requêtes V-Level
CREATE INDEX IF NOT EXISTS idx_gsm_bloc ON gamme_seo_metrics(bloc);
CREATE INDEX IF NOT EXISTS idx_gsm_model ON gamme_seo_metrics(model_id);
CREATE INDEX IF NOT EXISTS idx_gsm_is_v1 ON gamme_seo_metrics(is_v1) WHERE is_v1 = TRUE;

-- ============================================================================
-- PARTIE 4: Insérer les 17 gammes manquantes (parmi les 235 principales)
-- ============================================================================

INSERT INTO gamme_seo_metrics (pg_id, gamme_name, v_level, rank, score, search_volume, bloc, updated_at)
SELECT
  pg.pg_id::INTEGER,
  pg.pg_name,
  'V5' AS v_level,  -- Défaut: Bloc B
  999 AS rank,
  0 AS score,
  0 AS search_volume,
  'B' AS bloc,  -- Bloc B par défaut pour les nouvelles
  NOW() AS updated_at
FROM pieces_gamme pg
WHERE pg.pg_display = '1'
  AND pg.pg_level::INTEGER > 0  -- Seulement les 235 gammes principales
  AND NOT EXISTS (
    SELECT 1 FROM gamme_seo_metrics gsm WHERE gsm.pg_id = pg.pg_id::INTEGER
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- PARTIE 5: Supprimer tables vides inutilisées
-- ============================================================================

DO $$
DECLARE
  tbl TEXT;
  cnt INTEGER;
  tables_to_check TEXT[] := ARRAY[
    'v_level', 'vlevel', 'v_level_status', 'vlevel_status',
    'pieces_gamme_vlevel', 'gamme_vlevel', 'gamme_seo_config',
    'seo_config', 'seo_settings', 'admin_seo_config'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_to_check
  LOOP
    BEGIN
      EXECUTE format('SELECT COUNT(*) FROM %I', tbl) INTO cnt;
      IF cnt = 0 THEN
        EXECUTE format('DROP TABLE IF EXISTS %I CASCADE', tbl);
        RAISE NOTICE 'Table % supprimée (était vide)', tbl;
      ELSE
        RAISE NOTICE 'Table % conservée (% rows)', tbl, cnt;
      END IF;
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE 'Table % n''existe pas (OK)', tbl;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- PARTIE 6: Statistiques finales
-- ============================================================================

DO $$
DECLARE
  gammes_principales INTEGER;
  gammes_seo INTEGER;
  v2_count INTEGER;
  v5_count INTEGER;
  g1_count INTEGER;
  g2_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO gammes_principales FROM pieces_gamme WHERE pg_display = '1' AND pg_level::INTEGER > 0;
  SELECT COUNT(DISTINCT pg_id) INTO gammes_seo FROM gamme_seo_metrics;
  SELECT COUNT(*) INTO v2_count FROM gamme_seo_metrics WHERE v_level = 'V2';
  SELECT COUNT(*) INTO v5_count FROM gamme_seo_metrics WHERE v_level = 'V5';
  SELECT COUNT(*) INTO g1_count FROM pieces_gamme WHERE pg_g_level = 'G1';
  SELECT COUNT(*) INTO g2_count FROM pieces_gamme WHERE pg_g_level = 'G2';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Consolidation SEO & V-Level terminée:';
  RAISE NOTICE '  Gammes principales (level>0): %', gammes_principales;
  RAISE NOTICE '  Gammes avec métriques SEO: %', gammes_seo;
  RAISE NOTICE '  G1 (prioritaires): %', g1_count;
  RAISE NOTICE '  G2 (secondaires): %', g2_count;
  RAISE NOTICE '  V2 (champions): %', v2_count;
  RAISE NOTICE '  V5 (bloc B): %', v5_count;
  RAISE NOTICE '========================================';
END $$;
