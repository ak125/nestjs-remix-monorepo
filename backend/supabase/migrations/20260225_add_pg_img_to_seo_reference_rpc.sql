-- Migration: Ajouter pg_img au RPC get_seo_reference_by_slug
-- Date: 2026-02-25
-- Contexte: Visual Intent System Phase 3 — exposer l'image gamme dans la reponse reference
-- Le JOIN avec pieces_gamme existait deja, on ajoute simplement g.pg_img au SELECT

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
  updated_at TIMESTAMPTZ
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
    r.updated_at
  FROM __seo_reference r
  LEFT JOIN pieces_gamme g ON g.pg_id = r.pg_id
  WHERE r.slug = p_slug AND r.is_published = true;
END;
$$ LANGUAGE plpgsql STABLE;
