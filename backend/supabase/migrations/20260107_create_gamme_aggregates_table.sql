-- ============================================================================
-- MIGRATION: Create gamme_aggregates table
-- ============================================================================
-- Phase 1 du système Badges SEO v2: "Fiabiliser la vérité"
-- Cette table stocke les KPIs agrégés qui reflètent ce que le frontend affiche
-- (pas les compteurs bruts qui créent une incohérence admin ↔ front)
--
-- Date: 2026-01-07
-- ============================================================================

-- 1. Créer la table gamme_aggregates
CREATE TABLE IF NOT EXISTS gamme_aggregates (
  ga_id SERIAL PRIMARY KEY,
  ga_pg_id INTEGER NOT NULL UNIQUE,

  -- ===== Valeurs "vérité" (ce que le frontend voit réellement) =====
  products_total INTEGER DEFAULT 0,           -- Produits accessibles (direct + véhicules + famille)
  vehicles_total INTEGER DEFAULT 0,           -- Véhicules affichables (levels 1,2,3)
  content_words_total INTEGER DEFAULT 0,      -- Mots de contenu agrégé

  -- ===== Valeurs debug (compteurs bruts pour diagnostic) =====
  products_direct INTEGER DEFAULT 0,          -- Produits direct dans pieces.piece_pg_id
  products_via_vehicles INTEGER DEFAULT 0,    -- Produits via pieces_relation_type + cross_gamme_car
  products_via_family INTEGER DEFAULT 0,      -- Produits dans la même famille (catalog_gamme)

  vlevel_counts JSONB DEFAULT '{"V1":0,"V2":0,"V3":0,"V4":0,"V5":0}'::jsonb,  -- Distribution V-Level

  seo_content_raw_words INTEGER DEFAULT 0,    -- Mots dans __seo_gamme.sg_content uniquement
  content_breakdown JSONB DEFAULT '{}'::jsonb, -- Détail: {"seo":x,"info":y,"conseil":z,"purchaseGuide":w,"switches":v}

  -- ===== Classification gamme =====
  pg_level TEXT DEFAULT '0',                  -- Niveau gamme: 1=principale, 2=accessoire
  pg_top TEXT DEFAULT '0',                    -- G-Level: 1=G1 (prioritaire), 0=G2/G3

  -- ===== Fraîcheur =====
  computed_at TIMESTAMPTZ DEFAULT NOW(),      -- Quand les agrégats ont été calculés
  source_updated_at TIMESTAMPTZ,              -- Dernière modif dans les tables sources

  -- ===== Contrainte =====
  CONSTRAINT fk_gamme_aggregates_pg FOREIGN KEY (ga_pg_id) REFERENCES pieces_gamme(pg_id) ON DELETE CASCADE
);

-- 2. Index pour performance
CREATE INDEX IF NOT EXISTS idx_gamme_aggregates_pg_id ON gamme_aggregates(ga_pg_id);
CREATE INDEX IF NOT EXISTS idx_gamme_aggregates_computed_at ON gamme_aggregates(computed_at);
CREATE INDEX IF NOT EXISTS idx_gamme_aggregates_level ON gamme_aggregates(pg_level);
CREATE INDEX IF NOT EXISTS idx_gamme_aggregates_top ON gamme_aggregates(pg_top);

-- 3. Commentaires pour documentation
COMMENT ON TABLE gamme_aggregates IS 'KPIs agrégés des gammes - Phase 1 Badges SEO v2';
COMMENT ON COLUMN gamme_aggregates.products_total IS 'Nombre total de produits accessibles depuis la page gamme (direct + véhicules + famille)';
COMMENT ON COLUMN gamme_aggregates.vehicles_total IS 'Nombre de véhicules affichables (cross_gamme_car levels 1,2,3)';
COMMENT ON COLUMN gamme_aggregates.content_words_total IS 'Total mots de contenu agrégé (SEO + info + conseil + guide + switches)';
COMMENT ON COLUMN gamme_aggregates.vlevel_counts IS 'Distribution des V-Levels: {"V1":n,"V2":n,"V3":n,"V4":n,"V5":n}';
COMMENT ON COLUMN gamme_aggregates.content_breakdown IS 'Détail des sources de contenu: {"seo":n,"info":n,"conseil":n,"purchaseGuide":n,"switches":n}';
COMMENT ON COLUMN gamme_aggregates.pg_level IS 'Niveau de la gamme: 1=principale, 2=accessoire';
COMMENT ON COLUMN gamme_aggregates.pg_top IS 'G-Level: 1=G1 (prioritaire), 0=G2/G3';

-- 4. Grant permissions (si nécessaire pour l'application)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON gamme_aggregates TO service_role;
-- GRANT SELECT ON gamme_aggregates TO anon;

RAISE NOTICE 'Table gamme_aggregates créée avec succès';
