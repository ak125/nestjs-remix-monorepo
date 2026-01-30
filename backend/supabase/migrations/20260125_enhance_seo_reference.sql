-- ============================================
-- PHASE 3.7: Enrichissement Pages Référence (R4)
-- Migration: 20260125_enhance_seo_reference
-- ============================================
--
-- Objectif: Ajouter 3 colonnes manquantes au template R4
-- - role_negatif: "Ce que la pièce NE SERT PAS À faire"
-- - regles_metier: Règles anti-erreur métier
-- - scope_limites: Transparence sur les variantes/limitations

-- 1. Ajouter colonne "ne sert pas à" (rôle négatif)
ALTER TABLE __seo_reference
ADD COLUMN IF NOT EXISTS role_negatif TEXT;

COMMENT ON COLUMN __seo_reference.role_negatif IS
  'Ce que la pièce NE SERT PAS À faire (désambiguïsation)';

-- 2. Ajouter colonne "règles métier" (anti-erreur)
ALTER TABLE __seo_reference
ADD COLUMN IF NOT EXISTS regles_metier TEXT[];

COMMENT ON COLUMN __seo_reference.regles_metier IS
  'Règles métier anti-erreur: "Si X → alors vérifier Y avant Z"';

-- 3. Ajouter colonne "scope et limites"
ALTER TABLE __seo_reference
ADD COLUMN IF NOT EXISTS scope_limites TEXT;

COMMENT ON COLUMN __seo_reference.scope_limites IS
  'Transparence sur les variantes et limitations de la définition';

-- 4. Supprimer l'ancienne fonction RPC (obligatoire car changement de signature)
DROP FUNCTION IF EXISTS get_seo_reference_by_slug(TEXT);

-- 5. Recréer la fonction RPC avec les 3 nouveaux champs
CREATE FUNCTION get_seo_reference_by_slug(p_slug TEXT)
RETURNS TABLE (
  id INTEGER,
  slug VARCHAR(255),
  title VARCHAR(255),
  meta_description VARCHAR(320),
  definition TEXT,
  role_mecanique TEXT,
  role_negatif TEXT,           -- NOUVEAU
  composition TEXT[],
  confusions_courantes TEXT[],
  symptomes_associes TEXT[],
  regles_metier TEXT[],        -- NOUVEAU
  scope_limites TEXT,          -- NOUVEAU
  content_html TEXT,
  schema_json JSONB,
  pg_id INTEGER,
  gamme_name TEXT,
  gamme_slug TEXT,
  related_references INTEGER[],
  blog_slugs TEXT[],
  canonical_url VARCHAR(512),
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
    r.role_negatif,              -- NOUVEAU
    r.composition,
    r.confusions_courantes,
    r.symptomes_associes,
    r.regles_metier,             -- NOUVEAU
    r.scope_limites,             -- NOUVEAU
    r.content_html,
    r.schema_json,
    r.pg_id,
    pg.pg_label::TEXT as gamme_name,
    pg.pg_slug::TEXT as gamme_slug,
    r.related_references,
    r.blog_slugs,
    r.canonical_url,
    r.created_at,
    r.updated_at
  FROM __seo_reference r
  LEFT JOIN __products_gammes pg ON r.pg_id = pg.pg_id
  WHERE r.slug = p_slug AND r.is_published = true;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. Mettre à jour le contenu pilote "kit-embrayage" avec les nouveaux champs
UPDATE __seo_reference SET
  title = 'Kit d''embrayage : définition, rôle, composants, confusions et règles métier',

  role_negatif = 'Le kit d''embrayage NE SERT PAS À :
• Amortir les vibrations comme le ferait un volant moteur bi-masse
• Corriger des problèmes de boîte de vitesses
• Compenser un défaut de commande hydraulique/câble',

  regles_metier = ARRAY[
    'Si patinage confirmé → vérifier joint spi avant remplacement',
    'Si bruit pédale enfoncée → suspecter butée, vérifier commande',
    'Si vitesses dures + pédale anormale → vérifier commande avant embrayage'
  ],

  scope_limites = 'Les variantes (motorisations, années, volant bimasse, commande hydraulique/câble) modifient les références. La sélection par véhicule reste la méthode fiable.'
WHERE slug = 'kit-embrayage';
