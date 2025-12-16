-- ============================================================================
-- Migration 013: Create __model_content_v1 table
-- Description: Table for V1 content (encyclopedic model content 800-1200 words)
-- Author: Claude Code
-- Date: 2025-12-16
-- ============================================================================

-- Drop table if exists (for dev/test environments)
-- DROP TABLE IF EXISTS __model_content_v1;

-- Create main table
CREATE TABLE IF NOT EXISTS __model_content_v1 (
  mc_id SERIAL PRIMARY KEY,

  -- Vehicle identifiers
  mc_marque_id INT,                         -- auto_marque.marque_id
  mc_modele_id INT,                         -- auto_modele.modele_id
  mc_generation VARCHAR(50),                -- ex: "Clio 3", "Phase 2"
  mc_marque_alias VARCHAR(50) NOT NULL,     -- URL slug marque
  mc_modele_alias VARCHAR(100) NOT NULL,    -- URL slug modele
  mc_type_id INT,                           -- auto_type.type_id (optional)

  -- V1 Content - SEO Meta
  mc_title VARCHAR(200),                    -- Title tag
  mc_meta_description VARCHAR(320),         -- Meta description
  mc_h1 VARCHAR(200),                       -- H1 heading

  -- V1 Content - Structured Sections (800-1200 words total)
  mc_intro TEXT,                            -- 150-200 words (overview)
  mc_histoire TEXT,                         -- 200-300 words (history)
  mc_diesel_section TEXT,                   -- 150-200 words (diesel engines)
  mc_essence_section TEXT,                  -- 150-200 words (petrol engines)
  mc_motorisations JSONB,                   -- Motorizations table data
  mc_entretien TEXT,                        -- 100-150 words (maintenance tips)
  mc_conclusion TEXT,                       -- 100 words (conclusion)

  -- V1 Content - Additional sections (optional)
  mc_fiabilite TEXT,                        -- Reliability section
  mc_points_forts TEXT,                     -- Strengths
  mc_points_faibles TEXT,                   -- Weaknesses
  mc_conseils_achat TEXT,                   -- Purchase advice

  -- SEO and Meta
  mc_keywords TEXT[],                       -- Array of keywords
  mc_image_url VARCHAR(500),                -- Main image URL
  mc_canonical_url VARCHAR(500),            -- Canonical URL
  mc_schema_json JSONB,                     -- JSON-LD schema data

  -- Stats and timestamps
  mc_published_at TIMESTAMP DEFAULT NOW(),
  mc_updated_at TIMESTAMP DEFAULT NOW(),
  mc_views INT DEFAULT 0,
  mc_is_active BOOLEAN DEFAULT true,

  -- Constraints
  UNIQUE(mc_marque_alias, mc_modele_alias, mc_generation)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_model_content_v1_marque_id
  ON __model_content_v1(mc_marque_id);

CREATE INDEX IF NOT EXISTS idx_model_content_v1_modele_id
  ON __model_content_v1(mc_modele_id);

CREATE INDEX IF NOT EXISTS idx_model_content_v1_aliases
  ON __model_content_v1(mc_marque_alias, mc_modele_alias);

CREATE INDEX IF NOT EXISTS idx_model_content_v1_active
  ON __model_content_v1(mc_is_active)
  WHERE mc_is_active = true;

CREATE INDEX IF NOT EXISTS idx_model_content_v1_views
  ON __model_content_v1(mc_views DESC);

-- Comment on table
COMMENT ON TABLE __model_content_v1 IS 'V1 encyclopedic content for vehicle models (800-1200 words)';
COMMENT ON COLUMN __model_content_v1.mc_motorisations IS 'JSONB array: [{variante, puissance, niveau_v, energie}]';

-- ============================================================================
-- Sample data for testing (commented out for production)
-- ============================================================================
/*
INSERT INTO __model_content_v1 (
  mc_marque_alias, mc_modele_alias, mc_generation,
  mc_title, mc_meta_description, mc_h1,
  mc_intro, mc_histoire,
  mc_diesel_section, mc_essence_section,
  mc_motorisations,
  mc_entretien, mc_conclusion,
  mc_keywords
) VALUES (
  'renault', 'clio-3', 'III',
  'Renault Clio 3 : Guide complet des pièces auto',
  'Découvrez tout sur la Renault Clio 3 : motorisations, entretien, pièces détachées. Guide complet pour propriétaires.',
  'Renault Clio 3 - Guide d''achat et entretien',
  'La Renault Clio 3, produite de 2005 à 2014, représente la troisième génération de cette citadine emblématique française...',
  'Lancée en septembre 2005, la Clio 3 a marqué un tournant dans l''histoire de Renault avec son design moderne...',
  'Les motorisations diesel de la Clio 3 comprennent principalement les blocs 1.5 dCi disponibles en 65, 70, 85 et 105 cv...',
  'Côté essence, la Clio 3 propose une gamme variée allant du 1.2 16v 75 cv jusqu''au 2.0 RS de 200 cv...',
  '[{"variante": "1.5 dCi 85cv", "puissance": "85cv", "niveau_v": "V1", "energie": "Diesel"},
    {"variante": "1.5 dCi 105cv", "puissance": "105cv", "niveau_v": "V2", "energie": "Diesel"},
    {"variante": "1.2 16v 75cv", "puissance": "75cv", "niveau_v": "V1", "energie": "Essence"}]'::jsonb,
  'L''entretien régulier de votre Clio 3 est essentiel pour garantir sa longévité...',
  'La Renault Clio 3 reste une valeur sûre sur le marché de l''occasion...',
  ARRAY['clio 3', 'renault clio', 'pièces clio 3', 'entretien clio 3']
);
*/

-- ============================================================================
-- RPC Function: Get model content V1 by aliases
-- ============================================================================
CREATE OR REPLACE FUNCTION get_model_content_v1(
  p_marque_alias VARCHAR,
  p_modele_alias VARCHAR
)
RETURNS SETOF __model_content_v1
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM __model_content_v1
  WHERE mc_marque_alias = p_marque_alias
    AND mc_modele_alias = p_modele_alias
    AND mc_is_active = true
  ORDER BY mc_generation DESC
  LIMIT 1;
$$;

-- ============================================================================
-- RPC Function: Increment views
-- ============================================================================
CREATE OR REPLACE FUNCTION increment_model_content_v1_views(
  p_mc_id INT
)
RETURNS VOID
LANGUAGE sql
AS $$
  UPDATE __model_content_v1
  SET mc_views = mc_views + 1,
      mc_updated_at = NOW()
  WHERE mc_id = p_mc_id;
$$;

-- Grant permissions (adjust as needed)
-- GRANT SELECT ON __model_content_v1 TO anon;
-- GRANT SELECT ON __model_content_v1 TO authenticated;
-- GRANT ALL ON __model_content_v1 TO service_role;
