-- Migration: R4 flexible sections — colonnes enrichies + section_overrides
-- Date: 2026-03-09
-- Contexte: Les champs takeaways, synonyms, variants, key_specs, common_questions
-- existent deja dans le service + frontend mais manquent en DB.
-- Ajout de section_overrides pour surcharger les titres de section par page.

-- 1. Colonnes enrichies (deja mappees dans service + frontend)
ALTER TABLE __seo_reference ADD COLUMN IF NOT EXISTS takeaways TEXT[];
ALTER TABLE __seo_reference ADD COLUMN IF NOT EXISTS synonyms TEXT[];
ALTER TABLE __seo_reference ADD COLUMN IF NOT EXISTS variants JSONB;
ALTER TABLE __seo_reference ADD COLUMN IF NOT EXISTS key_specs JSONB;
ALTER TABLE __seo_reference ADD COLUMN IF NOT EXISTS common_questions JSONB;

-- 2. Surcharge titres de section (null = titres par defaut)
-- Format: {"role": "Hierarchie de confiance", "composition": "Les 5 types de pieces"}
ALTER TABLE __seo_reference ADD COLUMN IF NOT EXISTS section_overrides JSONB;

-- 3. Mettre a jour la RPC pour retourner les nouvelles colonnes
DROP FUNCTION IF EXISTS get_seo_reference_by_slug(TEXT);

CREATE FUNCTION get_seo_reference_by_slug(p_slug TEXT)
RETURNS TABLE (
  id INTEGER,
  slug VARCHAR(255),
  title VARCHAR(255),
  meta_description VARCHAR(320),
  definition TEXT,
  role_mecanique TEXT,
  role_negatif TEXT,
  composition TEXT[],
  confusions_courantes TEXT[],
  symptomes_associes TEXT[],
  regles_metier TEXT[],
  scope_limites TEXT,
  content_html TEXT,
  schema_json JSONB,
  pg_id INTEGER,
  gamme_name TEXT,
  gamme_slug TEXT,
  pg_img TEXT,
  related_references INTEGER[],
  blog_slugs TEXT[],
  canonical_url VARCHAR(512),
  is_published BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  -- Nouvelles colonnes
  takeaways TEXT[],
  synonyms TEXT[],
  variants JSONB,
  key_specs JSONB,
  common_questions JSONB,
  section_overrides JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.slug,
    r.title,
    r.meta_description,
    r.definition,
    r.role_mecanique,
    r.role_negatif,
    r.composition,
    r.confusions_courantes,
    r.symptomes_associes,
    r.regles_metier,
    r.scope_limites,
    r.content_html,
    r.schema_json,
    r.pg_id,
    g.pg_name as gamme_name,
    g.pg_alias as gamme_slug,
    g.pg_img,
    r.related_references,
    r.blog_slugs,
    r.canonical_url,
    r.is_published,
    r.created_at,
    r.updated_at,
    r.takeaways,
    r.synonyms,
    r.variants,
    r.key_specs,
    r.common_questions,
    r.section_overrides
  FROM __seo_reference r
  LEFT JOIN pieces_gamme g ON g.pg_id = r.pg_id
  WHERE r.slug = p_slug AND r.is_published = true;
END;
$$ LANGUAGE plpgsql STABLE;
