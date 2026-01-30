-- ============================================
-- PHASE 0: Système de Rôles de Pages SEO
-- Migration: 20260124_add_page_role
-- ============================================

-- 1. Créer l'enum pour les rôles
DO $$ BEGIN
  CREATE TYPE seo_page_role AS ENUM ('R1', 'R2', 'R3', 'R4', 'R5', 'R6');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Ajouter colonne page_role à __seo_page
ALTER TABLE __seo_page
ADD COLUMN IF NOT EXISTS page_role seo_page_role;

-- 3. Ajouter colonne default_page_role à __seo_entity
ALTER TABLE __seo_entity
ADD COLUMN IF NOT EXISTS default_page_role seo_page_role;

-- 4. Index pour requêtes par rôle
CREATE INDEX IF NOT EXISTS idx_seo_page_role ON __seo_page(page_role);
CREATE INDEX IF NOT EXISTS idx_seo_entity_default_role ON __seo_entity(default_page_role);

-- 5. Commentaires
COMMENT ON COLUMN __seo_page.page_role IS
  'Rôle SEO: R1=Routeur, R2=Produit, R3=Blog/Expert, R4=Référence, R5=Diagnostic, R6=Support';
COMMENT ON COLUMN __seo_entity.default_page_role IS
  'Rôle par défaut pour les pages de cette entité';

-- ============================================
-- Fonction d'assignation automatique du rôle
-- Version étendue avec 155+ patterns analysés
-- ============================================
CREATE OR REPLACE FUNCTION assign_page_role_from_url(p_url TEXT)
RETURNS seo_page_role AS $$
BEGIN
  -- ========== EXCLURE (retourne NULL) ==========
  -- Ces pages sont noindex ou privées - ne pas assigner de rôle
  IF p_url ~ '^/cart$'
     OR p_url ~ '^/checkout'
     OR p_url ~ '^/account'
     OR p_url ~ '^/login$'
     OR p_url ~ '^/register$'
     OR p_url ~ '^/forgot-password'
     OR p_url ~ '^/reset-password'
     OR p_url ~ '^/search/results'
     OR p_url ~ '^/recherche'
     OR p_url ~ '^/commercial/'
     OR p_url ~ '^/admin/' THEN
    RETURN NULL;  -- Exclure du système de rôles
  END IF;

  -- ========== R6 SUPPORT ==========
  IF p_url ~ '^/support'
     OR p_url ~ '^/contact$'
     OR p_url ~ '^/aide$'
     OR p_url ~ '^/mentions-legales'
     OR p_url ~ '^/conditions-generales-de-vente'
     OR p_url ~ '^/politique-'
     OR p_url ~ '^/legal'
     OR p_url ~ '^/tickets'
     OR p_url ~ '^/reviews'
     OR p_url ~ '^/staff$' THEN
    RETURN 'R6';
  END IF;

  -- ========== R4 RÉFÉRENCE AUTO ==========
  IF p_url ~ '^/reference-auto/'
     OR p_url ~ '^/reference-auto$'
     OR p_url ~ '^/blog-pieces-auto/glossaire' THEN
    RETURN 'R4';
  END IF;

  -- ========== R5 DIAGNOSTIC ==========
  IF p_url ~ '^/diagnostic/' THEN
    RETURN 'R5';
  END IF;

  -- ========== R3 BLOG/EXPERT ==========
  IF p_url ~ '^/blog-pieces-auto' THEN
    RETURN 'R3';
  END IF;

  -- ========== R2 PRODUIT ==========
  -- Pattern: /pieces/{gamme}/{marque}/{modele}/{type}.html
  IF p_url ~ '^/pieces/[^/]+/[^/]+/[^/]+/[^/]+\.html$' THEN
    RETURN 'R2';
  END IF;
  -- Legacy products
  IF p_url ~ '^/products/\d+$' THEN
    RETURN 'R2';
  END IF;

  -- ========== R1 ROUTEUR ==========
  -- Gammes: /pieces/{slug}-{id}.html
  IF p_url ~ '^/pieces/[^/]+-\d+\.html$' THEN
    RETURN 'R1';
  END IF;
  -- Catalogue
  IF p_url ~ '^/pieces/catalogue$' THEN
    RETURN 'R1';
  END IF;
  -- Constructeurs/Marques
  IF p_url ~ '^/constructeurs/[^/]+\.html$' THEN
    RETURN 'R1';
  END IF;
  -- Constructeurs/Types
  IF p_url ~ '^/constructeurs/[^/]+/[^/]+/[^/]+\.html$' THEN
    RETURN 'R1';
  END IF;
  -- Marques/Brands
  IF p_url ~ '^/marques$' OR p_url ~ '^/brands' THEN
    RETURN 'R1';
  END IF;
  -- Products ranges/gammes (legacy)
  IF p_url ~ '^/products/ranges' OR p_url ~ '^/products/gammes/' THEN
    RETURN 'R1';
  END IF;
  -- Gammes catch-all
  IF p_url ~ '^/gammes/' THEN
    RETURN 'R1';
  END IF;
  -- Catalogue et vehicles
  IF p_url ~ '^/catalogue$' OR p_url ~ '^/vehicles$' THEN
    RETURN 'R1';
  END IF;

  -- ========== NON CLASSÉ ==========
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- Fonction pour valider qu'un rôle est cohérent
-- ============================================
CREATE OR REPLACE FUNCTION validate_page_role(p_url TEXT, p_role seo_page_role)
RETURNS BOOLEAN AS $$
DECLARE
  v_expected seo_page_role;
BEGIN
  v_expected := assign_page_role_from_url(p_url);
  RETURN v_expected IS NULL OR v_expected = p_role;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- Assigner le rôle à toutes les pages existantes
-- ============================================
UPDATE __seo_page
SET page_role = assign_page_role_from_url(url)
WHERE page_role IS NULL;

-- ============================================
-- Vues d'audit
-- ============================================

-- Vue pour audit des rôles avec exemples
CREATE OR REPLACE VIEW v_seo_page_roles_audit AS
SELECT
  page_role,
  COUNT(*) as count,
  (SELECT ARRAY_AGG(s.url) FROM (SELECT url FROM __seo_page p2 WHERE p2.page_role = p1.page_role ORDER BY url LIMIT 5) s) as examples
FROM __seo_page p1
WHERE page_role IS NOT NULL
GROUP BY page_role
ORDER BY page_role;

-- Vue pour détecter les pages non classées
CREATE OR REPLACE VIEW v_seo_pages_unclassified AS
SELECT url, page_type, temperature
FROM __seo_page
WHERE page_role IS NULL
  AND url NOT LIKE '/admin/%'
  AND url NOT LIKE '/commercial/%'
  AND url NOT LIKE '/account/%'
  AND url NOT LIKE '/api/%'
ORDER BY url;
