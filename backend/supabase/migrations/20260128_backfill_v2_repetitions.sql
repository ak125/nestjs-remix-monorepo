-- Migration: Backfill v2_repetitions + Trigger automatique
-- Date: 2026-01-28
-- Appliquee: Oui (via Supabase MCP)
-- Objectif: Peupler v2_repetitions pour afficher le badge x{n} dans l'UI V-Level

-- ============================================
-- PHASE 1: Backfill des donnees existantes
-- ============================================

UPDATE __seo_keywords k
SET v2_repetitions = subq.cnt
FROM (
  SELECT
    model,
    variant,
    energy,
    COUNT(DISTINCT pg_id) as cnt
  FROM __seo_keywords
  WHERE v_level = 'V2'
    AND type = 'vehicle'
  GROUP BY model, variant, energy
) subq
WHERE k.model = subq.model
  AND k.variant = subq.variant
  AND k.energy = subq.energy
  AND k.type = 'vehicle'
  AND k.v_level IS NOT NULL;

-- ============================================
-- PHASE 2: Trigger pour maintenance automatique
-- ============================================

-- Fonction de recalcul pour INSERT/UPDATE
CREATE OR REPLACE FUNCTION update_v2_repetitions_on_change()
RETURNS TRIGGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT pg_id) INTO v_count
  FROM __seo_keywords
  WHERE model = NEW.model
    AND variant = NEW.variant
    AND energy = NEW.energy
    AND v_level = 'V2'
    AND type = 'vehicle';

  UPDATE __seo_keywords
  SET v2_repetitions = v_count
  WHERE model = NEW.model
    AND variant = NEW.variant
    AND energy = NEW.energy
    AND type = 'vehicle';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fonction de recalcul pour DELETE
CREATE OR REPLACE FUNCTION update_v2_repetitions_on_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT pg_id) INTO v_count
  FROM __seo_keywords
  WHERE model = OLD.model
    AND variant = OLD.variant
    AND energy = OLD.energy
    AND v_level = 'V2'
    AND type = 'vehicle';

  UPDATE __seo_keywords
  SET v2_repetitions = v_count
  WHERE model = OLD.model
    AND variant = OLD.variant
    AND energy = OLD.energy
    AND type = 'vehicle';

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Supprimer les anciens triggers
DROP TRIGGER IF EXISTS trg_update_v2_repetitions ON __seo_keywords;
DROP TRIGGER IF EXISTS trg_update_v2_repetitions_insert ON __seo_keywords;
DROP TRIGGER IF EXISTS trg_update_v2_repetitions_delete ON __seo_keywords;

-- Trigger pour INSERT/UPDATE
CREATE TRIGGER trg_update_v2_repetitions_insert
AFTER INSERT OR UPDATE OF v_level ON __seo_keywords
FOR EACH ROW
WHEN (NEW.type = 'vehicle')
EXECUTE FUNCTION update_v2_repetitions_on_change();

-- Trigger pour DELETE
CREATE TRIGGER trg_update_v2_repetitions_delete
AFTER DELETE ON __seo_keywords
FOR EACH ROW
WHEN (OLD.type = 'vehicle')
EXECUTE FUNCTION update_v2_repetitions_on_delete();

-- ============================================
-- RESULTATS POST-MIGRATION
-- ============================================
-- Total keywords: 1087
-- Avec v2_repetitions > 0: 294 (27%)
-- Multi-gamme (v2_reps > 1): 80
-- Max v2_repetitions: 2 (car seulement 2 gammes en DB)
