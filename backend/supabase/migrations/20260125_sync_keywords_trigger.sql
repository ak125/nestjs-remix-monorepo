-- ============================================================================
-- MIGRATION: Centralisation SEO - Trigger Sync Keywords
-- ============================================================================
-- Phase 2: Créer trigger pour synchroniser __seo_keywords vers gamme_aggregates
-- - Déclenché sur INSERT/UPDATE/DELETE de __seo_keywords
-- - Met à jour v2_count, v3_count, v4_count, v5_count, keyword_total
--
-- Date: 2026-01-25
-- ============================================================================

-- 1. Fonction de synchronisation
CREATE OR REPLACE FUNCTION sync_keywords_to_gamme_aggregates()
RETURNS TRIGGER AS $$
DECLARE
  v_gamme TEXT;
  v_pg_id INTEGER;
  v_v2 INTEGER;
  v_v3 INTEGER;
  v_v4 INTEGER;
  v_v5 INTEGER;
  v_total INTEGER;
BEGIN
  -- Déterminer la gamme affectée
  IF TG_OP = 'DELETE' THEN
    v_gamme := OLD.gamme;
  ELSE
    v_gamme := NEW.gamme;
  END IF;

  -- Skip si gamme est NULL
  IF v_gamme IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Trouver pg_id correspondant (par nom ou alias)
  SELECT pg_id INTO v_pg_id
  FROM pieces_gamme
  WHERE pg_name = v_gamme OR pg_alias = v_gamme
  LIMIT 1;

  -- Skip si gamme non trouvée dans pieces_gamme
  IF v_pg_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Calculer les counts V-Level
  SELECT
    COUNT(*) FILTER (WHERE v_level = 'V2'),
    COUNT(*) FILTER (WHERE v_level = 'V3'),
    COUNT(*) FILTER (WHERE v_level = 'V4'),
    COUNT(*) FILTER (WHERE v_level = 'V5'),
    COUNT(*)
  INTO v_v2, v_v3, v_v4, v_v5, v_total
  FROM __seo_keywords
  WHERE gamme = v_gamme;

  -- Mettre à jour gamme_aggregates
  UPDATE gamme_aggregates
  SET
    v2_count = COALESCE(v_v2, 0),
    v3_count = COALESCE(v_v3, 0),
    v4_count = COALESCE(v_v4, 0),
    v5_count = COALESCE(v_v5, 0),
    keyword_total = COALESCE(v_total, 0),
    computed_at = NOW()
  WHERE ga_pg_id = v_pg_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 2. Créer le trigger (supprimer s'il existe)
DROP TRIGGER IF EXISTS trg_sync_keywords_aggregates ON __seo_keywords;

CREATE TRIGGER trg_sync_keywords_aggregates
  AFTER INSERT OR UPDATE OR DELETE ON __seo_keywords
  FOR EACH ROW
  EXECUTE FUNCTION sync_keywords_to_gamme_aggregates();

-- 3. Grant permissions
GRANT EXECUTE ON FUNCTION sync_keywords_to_gamme_aggregates() TO service_role;

-- 4. Commentaires
COMMENT ON FUNCTION sync_keywords_to_gamme_aggregates() IS
  'Synchronise automatiquement les counts V-Level de __seo_keywords vers gamme_aggregates';

-- Vérification
DO $$
DECLARE
  trigger_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_sync_keywords_aggregates'
  ) INTO trigger_exists;

  IF trigger_exists THEN
    RAISE NOTICE '✅ Migration 20260125_sync_keywords_trigger: Trigger créé avec succès';
  ELSE
    RAISE WARNING '⚠️ Trigger trg_sync_keywords_aggregates non trouvé';
  END IF;
END $$;
