-- Migration: Création de la table quantity_discounts
-- Description: Système de remises progressives selon la quantité achetée
-- Date: 2025-11-24
-- Author: Optimisation tables hardcodées

-- ============================================================================
-- CRÉATION DE LA TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS quantity_discounts (
  id SERIAL PRIMARY KEY,
  
  -- Relation avec le produit
  product_id INTEGER NOT NULL,
  
  -- Palier de quantité minimum pour appliquer la remise
  min_quantity INTEGER NOT NULL CHECK (min_quantity > 0),
  
  -- Type de remise (un seul des deux doit être renseigné)
  discount_percent DECIMAL(5,2) CHECK (discount_percent BETWEEN 0 AND 100),
  discount_amount DECIMAL(10,2) CHECK (discount_amount >= 0),
  
  -- Activation de la règle
  is_active BOOLEAN DEFAULT true NOT NULL,
  
  -- Métadonnées
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  
  -- Contraintes
  
  -- Un seul discount par palier/produit
  CONSTRAINT uq_product_quantity UNIQUE (product_id, min_quantity),
  
  -- discount_percent OU discount_amount, pas les deux
  CONSTRAINT chk_discount_type CHECK (
    (discount_percent IS NOT NULL AND discount_amount IS NULL) OR
    (discount_percent IS NULL AND discount_amount IS NOT NULL)
  )
);

-- ============================================================================
-- INDEX POUR PERFORMANCE
-- ============================================================================

-- Index principal : recherche par produit actif
CREATE INDEX IF NOT EXISTS idx_qty_discount_product_active 
  ON quantity_discounts(product_id) 
  WHERE is_active = true;

-- Index secondaire : tri par quantité
CREATE INDEX IF NOT EXISTS idx_qty_discount_quantity 
  ON quantity_discounts(min_quantity);

-- Index composé : recherche optimisée
CREATE INDEX IF NOT EXISTS idx_qty_discount_lookup 
  ON quantity_discounts(product_id, min_quantity, is_active);

-- ============================================================================
-- TRIGGER AUTO-UPDATE updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_quantity_discounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_quantity_discounts_updated_at
  BEFORE UPDATE ON quantity_discounts
  FOR EACH ROW
  EXECUTE FUNCTION update_quantity_discounts_updated_at();

-- ============================================================================
-- COMMENTAIRES
-- ============================================================================

COMMENT ON TABLE quantity_discounts IS 
  'Remises progressives appliquées selon la quantité achetée';

COMMENT ON COLUMN quantity_discounts.product_id IS 
  'ID du produit (référence vers ___xtr_product.prd_id ou pieces.pm_id)';

COMMENT ON COLUMN quantity_discounts.min_quantity IS 
  'Quantité minimum pour bénéficier de cette remise';

COMMENT ON COLUMN quantity_discounts.discount_percent IS 
  'Remise en pourcentage (ex: 10.00 pour 10%)';

COMMENT ON COLUMN quantity_discounts.discount_amount IS 
  'Remise en montant fixe (ex: 5.50 pour -5.50€)';

COMMENT ON COLUMN quantity_discounts.is_active IS 
  'Permet de désactiver temporairement une règle sans la supprimer';

-- ============================================================================
-- DONNÉES DE TEST (Optionnel - À commenter en production)
-- ============================================================================

-- TODO: Décommenter après avoir identifié les vrais product_id à utiliser

-- -- Exemple: Produit 1234 avec remises progressives
-- INSERT INTO quantity_discounts (product_id, min_quantity, discount_percent, is_active) VALUES
--   (1234, 10, 5.00, true),   -- 10+ unités = -5%
--   (1234, 50, 10.00, true),  -- 50+ unités = -10%
--   (1234, 100, 15.00, true), -- 100+ unités = -15%
--   (1234, 200, 20.00, true)  -- 200+ unités = -20%
-- ON CONFLICT (product_id, min_quantity) DO NOTHING;

-- -- Exemple: Produit 5678 avec remise en montant fixe
-- INSERT INTO quantity_discounts (product_id, min_quantity, discount_amount, is_active) VALUES
--   (5678, 20, 3.00, true),   -- 20+ unités = -3€
--   (5678, 100, 15.00, true)  -- 100+ unités = -15€
-- ON CONFLICT (product_id, min_quantity) DO NOTHING;

-- ============================================================================
-- ROLLBACK (Pour annuler la migration)
-- ============================================================================

-- DROP TRIGGER IF EXISTS trg_quantity_discounts_updated_at ON quantity_discounts;
-- DROP FUNCTION IF EXISTS update_quantity_discounts_updated_at();
-- DROP INDEX IF EXISTS idx_qty_discount_product_active;
-- DROP INDEX IF EXISTS idx_qty_discount_quantity;
-- DROP INDEX IF EXISTS idx_qty_discount_lookup;
-- DROP TABLE IF EXISTS quantity_discounts;
