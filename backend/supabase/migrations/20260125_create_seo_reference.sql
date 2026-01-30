-- ============================================
-- PHASE 3: Table des Pages Référence (R4)
-- Migration: 20260125_create_seo_reference
-- ============================================
--
-- Objectif: Stocker les définitions canoniques des pièces auto
-- URL: /reference-auto/{slug}
-- Rôle: R4 (Référence métier)

-- 1. Créer la table principale
CREATE TABLE IF NOT EXISTS __seo_reference (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(255) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  meta_description VARCHAR(320),

  -- Contenu structuré (obligatoire)
  definition TEXT NOT NULL,           -- Définition technique courte (2-3 paragraphes)

  -- Contenu enrichi (optionnel)
  role_mecanique TEXT,                -- Rôle dans le système automobile
  composition TEXT[],                 -- Composants du kit/pièce
  confusions_courantes TEXT[],        -- Ex: ["embrayage ≠ boîte de vitesses"]
  symptomes_associes TEXT[],          -- Slugs des pages R5 Diagnostic liées

  -- Contenu long format
  content_html TEXT,                  -- Contenu HTML complet pour la page

  -- Schema.org DefinedTerm
  schema_json JSONB,                  -- JSON-LD pré-généré

  -- Relations
  pg_id INTEGER,                      -- Lien vers gamme __products_gammes
  related_references INTEGER[],       -- IDs des références liées
  blog_slugs TEXT[],                  -- Slugs des articles R3 liés

  -- SEO
  page_role VARCHAR(2) DEFAULT 'R4' CHECK (page_role = 'R4'),
  canonical_url VARCHAR(512),
  is_published BOOLEAN DEFAULT false,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_seo_reference_slug ON __seo_reference(slug);
CREATE INDEX IF NOT EXISTS idx_seo_reference_pg_id ON __seo_reference(pg_id);
CREATE INDEX IF NOT EXISTS idx_seo_reference_published ON __seo_reference(is_published) WHERE is_published = true;

-- 3. Trigger pour updated_at automatique
CREATE OR REPLACE FUNCTION update_seo_reference_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_seo_reference_updated_at ON __seo_reference;
CREATE TRIGGER trigger_seo_reference_updated_at
  BEFORE UPDATE ON __seo_reference
  FOR EACH ROW
  EXECUTE FUNCTION update_seo_reference_updated_at();

-- 4. Commentaires
COMMENT ON TABLE __seo_reference IS
  'Pages Référence Auto (R4) - Définitions canoniques des pièces automobiles';
COMMENT ON COLUMN __seo_reference.slug IS
  'URL slug: /reference-auto/{slug}';
COMMENT ON COLUMN __seo_reference.definition IS
  'Définition technique courte (2-3 paragraphes), texte pur';
COMMENT ON COLUMN __seo_reference.role_mecanique IS
  'Explication du rôle dans le système automobile';
COMMENT ON COLUMN __seo_reference.confusions_courantes IS
  'Liste des confusions fréquentes à clarifier';
COMMENT ON COLUMN __seo_reference.pg_id IS
  'Référence vers la gamme dans __products_gammes';
COMMENT ON COLUMN __seo_reference.schema_json IS
  'Schema.org DefinedTerm JSON-LD pour SEO';

-- 5. Vue pour lister les références avec infos gamme
CREATE OR REPLACE VIEW v_seo_reference_with_gamme AS
SELECT
  r.*,
  pg.pg_label as gamme_name,
  pg.pg_slug as gamme_slug
FROM __seo_reference r
LEFT JOIN __products_gammes pg ON r.pg_id = pg.pg_id
WHERE r.is_published = true
ORDER BY r.title;

-- 6. Fonction RPC pour récupérer une référence par slug
CREATE OR REPLACE FUNCTION get_seo_reference_by_slug(p_slug TEXT)
RETURNS TABLE (
  id INTEGER,
  slug VARCHAR(255),
  title VARCHAR(255),
  meta_description VARCHAR(320),
  definition TEXT,
  role_mecanique TEXT,
  composition TEXT[],
  confusions_courantes TEXT[],
  symptomes_associes TEXT[],
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
    r.composition,
    r.confusions_courantes,
    r.symptomes_associes,
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

-- 7. Fonction RPC pour lister toutes les références
CREATE OR REPLACE FUNCTION get_all_seo_references()
RETURNS TABLE (
  id INTEGER,
  slug VARCHAR(255),
  title VARCHAR(255),
  meta_description VARCHAR(320),
  definition TEXT,
  pg_id INTEGER,
  gamme_name TEXT,
  gamme_slug TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.slug,
    r.title,
    r.meta_description,
    -- Limiter la définition pour la liste (300 premiers caractères)
    CASE
      WHEN LENGTH(r.definition) > 300 THEN SUBSTRING(r.definition, 1, 300) || '...'
      ELSE r.definition
    END as definition,
    r.pg_id,
    pg.pg_label::TEXT as gamme_name,
    pg.pg_slug::TEXT as gamme_slug
  FROM __seo_reference r
  LEFT JOIN __products_gammes pg ON r.pg_id = pg.pg_id
  WHERE r.is_published = true
  ORDER BY r.title;
END;
$$ LANGUAGE plpgsql STABLE;

-- 8. Insérer le contenu pilote: Kit d'embrayage
INSERT INTO __seo_reference (
  slug,
  title,
  meta_description,
  definition,
  role_mecanique,
  composition,
  confusions_courantes,
  symptomes_associes,
  content_html,
  schema_json,
  pg_id,
  blog_slugs,
  is_published
) VALUES (
  'kit-embrayage',
  'Kit d''embrayage : Définition, rôle et composition',
  'Qu''est-ce qu''un kit d''embrayage ? Découvrez la définition technique, le rôle mécanique et les composants essentiels de cette pièce automobile.',
  'Le kit d''embrayage est un ensemble de pièces mécaniques permettant de transmettre ou d''interrompre le couple moteur vers la boîte de vitesses. Il est composé de plusieurs éléments qui travaillent ensemble pour assurer une transmission fluide de la puissance.

L''embrayage joue un rôle crucial dans le fonctionnement du véhicule : il permet de démarrer en douceur, de changer de rapport et de s''arrêter moteur tournant. C''est une pièce d''usure qui nécessite un remplacement périodique, généralement entre 150 000 et 200 000 km selon le style de conduite.',

  'L''embrayage est situé entre le moteur et la boîte de vitesses. Lorsque la pédale d''embrayage est relâchée, le disque d''embrayage est pressé contre le volant moteur par le mécanisme de pression (diaphragme). Cette friction transmet le couple du moteur à la boîte de vitesses.

Quand le conducteur appuie sur la pédale, la butée d''embrayage pousse sur les doigts du diaphragme, ce qui libère la pression sur le disque. Le moteur et la boîte de vitesses sont alors désolidarisés, permettant de changer de rapport ou de s''arrêter sans caler.',

  ARRAY[
    'Disque d''embrayage : pièce centrale avec garnitures de friction',
    'Mécanisme de pression (plateau presseur) : applique la pression sur le disque',
    'Butée d''embrayage : actionne le mécanisme via la pédale',
    'Volant moteur (optionnel) : certains kits incluent le volant bimasse'
  ],

  ARRAY[
    'Embrayage ≠ Boîte de vitesses : l''embrayage transmet le couple, la boîte démultiplie',
    'Kit complet ≠ Disque seul : toujours remplacer l''ensemble pour éviter les incompatibilités',
    'Volant moteur bimasse : pièce distincte, pas toujours incluse dans le kit'
  ],

  ARRAY['bruit-embrayage', 'embrayage-patine', 'pedale-embrayage-dure'],

  '<article class="prose">
<h2>Qu''est-ce qu''un kit d''embrayage ?</h2>
<p>Le kit d''embrayage est un ensemble de pièces mécaniques permettant de transmettre ou d''interrompre le couple moteur vers la boîte de vitesses. Il est composé de plusieurs éléments qui travaillent ensemble pour assurer une transmission fluide de la puissance.</p>

<p>L''embrayage joue un rôle crucial dans le fonctionnement du véhicule : il permet de démarrer en douceur, de changer de rapport et de s''arrêter moteur tournant. C''est une pièce d''usure qui nécessite un remplacement périodique, généralement entre 150 000 et 200 000 km selon le style de conduite.</p>

<h2>Rôle mécanique</h2>
<p>L''embrayage est situé entre le moteur et la boîte de vitesses. Lorsque la pédale d''embrayage est relâchée, le disque d''embrayage est pressé contre le volant moteur par le mécanisme de pression (diaphragme). Cette friction transmet le couple du moteur à la boîte de vitesses.</p>

<p>Quand le conducteur appuie sur la pédale, la butée d''embrayage pousse sur les doigts du diaphragme, ce qui libère la pression sur le disque. Le moteur et la boîte de vitesses sont alors désolidarisés, permettant de changer de rapport ou de s''arrêter sans caler.</p>

<h2>Composition d''un kit d''embrayage</h2>
<ul>
<li><strong>Disque d''embrayage</strong> : pièce centrale avec garnitures de friction</li>
<li><strong>Mécanisme de pression</strong> (plateau presseur) : applique la pression sur le disque</li>
<li><strong>Butée d''embrayage</strong> : actionne le mécanisme via la pédale</li>
<li><strong>Volant moteur</strong> (optionnel) : certains kits incluent le volant bimasse</li>
</ul>

<h2>Confusions courantes</h2>
<ul>
<li><strong>Embrayage ≠ Boîte de vitesses</strong> : l''embrayage transmet le couple, la boîte démultiplie</li>
<li><strong>Kit complet ≠ Disque seul</strong> : toujours remplacer l''ensemble pour éviter les incompatibilités</li>
<li><strong>Volant moteur bimasse</strong> : pièce distincte, pas toujours incluse dans le kit</li>
</ul>
</article>',

  '{"@context": "https://schema.org", "@type": "DefinedTerm", "name": "Kit d''embrayage", "description": "Ensemble de pièces mécaniques permettant de transmettre ou d''interrompre le couple moteur vers la boîte de vitesses", "inDefinedTermSet": {"@type": "DefinedTermSet", "name": "Référence Auto - Pièces Automobiles"}}'::jsonb,

  479,  -- pg_id pour kit-d-embrayage

  ARRAY['guide-embrayage', 'quand-changer-embrayage'],

  true
) ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  meta_description = EXCLUDED.meta_description,
  definition = EXCLUDED.definition,
  role_mecanique = EXCLUDED.role_mecanique,
  composition = EXCLUDED.composition,
  confusions_courantes = EXCLUDED.confusions_courantes,
  symptomes_associes = EXCLUDED.symptomes_associes,
  content_html = EXCLUDED.content_html,
  schema_json = EXCLUDED.schema_json,
  pg_id = EXCLUDED.pg_id,
  blog_slugs = EXCLUDED.blog_slugs,
  is_published = EXCLUDED.is_published,
  updated_at = NOW();
