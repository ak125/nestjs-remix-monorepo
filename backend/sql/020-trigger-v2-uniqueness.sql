-- ============================================================================
-- TRIGGER: V2 Uniqueness Constraint for gamme_seo_metrics
-- ============================================================================
-- Garantit qu'il n'y a qu'UN SEUL V2 par gamme_id + energy
-- Règle métier: V2 = Champion Gamme, UNIQUE par gamme + énergie (Diesel/Essence)
--
-- Table: gamme_seo_metrics
-- Colonnes concernées: gamme_id, energy, v_level
--
-- Usage: Ce trigger est exécuté automatiquement sur INSERT/UPDATE
-- ============================================================================

-- ============================================================================
-- FUNCTION: check_v2_uniqueness
-- Vérifie qu'il n'existe pas déjà un V2 pour la même gamme + énergie
-- ============================================================================
CREATE OR REPLACE FUNCTION check_v2_uniqueness()
RETURNS TRIGGER AS $$
BEGIN
  -- Seulement vérifier si on assigne V2
  IF NEW.v_level = 'V2' THEN
    -- Vérifier s'il existe déjà un V2 pour cette gamme + énergie
    IF EXISTS (
      SELECT 1
      FROM gamme_seo_metrics
      WHERE gamme_id = NEW.gamme_id
        AND LOWER(energy) = LOWER(NEW.energy)
        AND v_level = 'V2'
        AND id != COALESCE(NEW.id, -1)
    ) THEN
      RAISE EXCEPTION 'V2 uniqueness violation: gamme_id=% with energy=% already has a V2. Only one V2 per gamme+energy is allowed.',
        NEW.gamme_id, NEW.energy;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: trg_v2_unique
-- Déclenché AVANT INSERT ou UPDATE sur gamme_seo_metrics
-- ============================================================================
DROP TRIGGER IF EXISTS trg_v2_unique ON gamme_seo_metrics;

CREATE TRIGGER trg_v2_unique
BEFORE INSERT OR UPDATE ON gamme_seo_metrics
FOR EACH ROW
EXECUTE FUNCTION check_v2_uniqueness();

-- ============================================================================
-- COMMENTAIRES
-- ============================================================================
COMMENT ON FUNCTION check_v2_uniqueness() IS
'Vérifie l unicité V2 par gamme_id + energy. V2 = Champion Gamme (UNIQUE).';

COMMENT ON TRIGGER trg_v2_unique ON gamme_seo_metrics IS
'Trigger garantissant qu il n y a qu un seul V2 par gamme + énergie (Diesel/Essence).';

-- ============================================================================
-- TEST (à exécuter manuellement pour vérifier)
-- ============================================================================
/*
-- Test 1: Devrait réussir (premier V2 pour gamme 10 + diesel)
INSERT INTO gamme_seo_metrics (gamme_id, energy, v_level, model_name, brand)
VALUES ('10', 'diesel', 'V2', 'Test Model 1', 'Test Brand');

-- Test 2: Devrait ÉCHOUER (deuxième V2 pour gamme 10 + diesel)
INSERT INTO gamme_seo_metrics (gamme_id, energy, v_level, model_name, brand)
VALUES ('10', 'diesel', 'V2', 'Test Model 2', 'Test Brand');
-- ERROR: V2 uniqueness violation: gamme_id=10 with energy=diesel already has a V2

-- Test 3: Devrait réussir (V2 pour gamme 10 + essence - différente énergie)
INSERT INTO gamme_seo_metrics (gamme_id, energy, v_level, model_name, brand)
VALUES ('10', 'essence', 'V2', 'Test Model 3', 'Test Brand');

-- Cleanup tests
DELETE FROM gamme_seo_metrics WHERE model_name LIKE 'Test Model%';
*/
