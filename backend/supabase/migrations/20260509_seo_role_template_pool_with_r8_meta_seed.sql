-- =====================================================================
-- Migration: SEO role × slot template pool + R8 meta seed (atomique)
--
-- PR-1 plan seo-v9 R8 meta diversification.
--
-- Cause GSC: meta_title / h1 / meta_description hardcodés en string
-- templates dans r8-vehicle-enricher.service.ts:247-264 → 18 frères Clio III
-- ne diffèrent que par 4 variables → quasi-clones structurels.
--
-- Cible : pool DB-backed consommé via SeoSwitchSelector du chain seo-v9
-- (sha256 seed canonique surfaceKey:pgId:vehicleId:alias, résistant aux
-- renumérotations TecDoc V2). Une seule famille `ROLE_TEMPLATE_POOL`
-- ajoutée au SeoVariantFamilyRegistry, slot-based (pas alias-based).
--
-- Atomicité : DDL + seed dans la MÊME transaction. Si un INSERT plante
-- (typo template), toute la migration roll-back — on n'aura pas une table
-- vide forçant le fallback partout.
--
-- Pattern RLS aligné sur 20260422_enable_rls_internal_tables.sql.
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1) Table __seo_role_template_pool
-- =====================================================================

CREATE TABLE public.__seo_role_template_pool (
  srtp_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  srtp_role         text NOT NULL,
  srtp_slot         text NOT NULL,
  srtp_template     text NOT NULL,
  srtp_lang         text NOT NULL DEFAULT 'fr',
  srtp_status       text NOT NULL DEFAULT 'active',
  srtp_order        int  NOT NULL,
  srtp_weight       numeric NOT NULL DEFAULT 1.0,
  srtp_max_length   int,
  srtp_created_at   timestamptz NOT NULL DEFAULT now(),
  srtp_updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_srtp_status CHECK (srtp_status IN ('active', 'retired', 'draft'))
);

CREATE UNIQUE INDEX uq_srtp_role_slot_lang_order
  ON public.__seo_role_template_pool (srtp_role, srtp_slot, srtp_lang, srtp_order);

CREATE INDEX idx_srtp_active_lookup
  ON public.__seo_role_template_pool (srtp_role, srtp_slot, srtp_lang)
  WHERE srtp_status = 'active';

COMMENT ON TABLE public.__seo_role_template_pool IS
  'DB-backed deterministic SEO template pool by role x slot x lang. PR-1: used by R8 meta layer.';

COMMENT ON COLUMN public.__seo_role_template_pool.srtp_order IS
  'Ordre stable consomme par SeoSwitchSelector.fetchVariants() pour rendre l''idx sha256 reproductible.';

COMMENT ON COLUMN public.__seo_role_template_pool.srtp_weight IS
  'Reserve - non consomme par le selector courant. Hook futur pour weighted selection.';

COMMENT ON COLUMN public.__seo_role_template_pool.srtp_max_length IS
  'Cap dur applique apres render. Doit matcher les caps Zod du contrat (75/120/170 pour R8 meta).';

-- =====================================================================
-- 2) RLS / sécurité (pattern 20260422_enable_rls_internal_tables.sql)
-- =====================================================================

ALTER TABLE public.__seo_role_template_pool ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.__seo_role_template_pool FROM anon, authenticated;

CREATE POLICY __seo_role_template_pool_service_role_all
  ON public.__seo_role_template_pool
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================================
-- 3) Colonne variant_signature sur __seo_r8_pages
-- =====================================================================

ALTER TABLE public.__seo_r8_pages
  ADD COLUMN IF NOT EXISTS variant_signature jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.__seo_r8_pages.variant_signature IS
  'Map slot->srtp_id (uuid) du template pool selectionne. PR-1: meta_title/h1/meta_description.';

-- =====================================================================
-- 4) Seed R8 meta : 18 templates (7 meta_title + 11 meta_description)
--    Convention placeholders {brand} {model} {type} {power} (alignee TS).
--    Pas d'allegations stock/livraison/origine non garanties.
--    ON CONFLICT DO NOTHING : idempotent (re-run safe).
--
--    H1 NON inclus : buildR8H1() (r8-keyword-plan.constants.ts:854) produit
--    deja un format optimise avec plage d'annees → pas de pool h1 en PR-1.
-- =====================================================================

INSERT INTO public.__seo_role_template_pool
  (srtp_role, srtp_slot, srtp_template, srtp_lang, srtp_status, srtp_order, srtp_max_length)
VALUES
  -- meta_title (7 templates, <=75 chars apres substitution)
  ('R8_VEHICLE', 'meta_title', 'Pièces {brand} {model} {type} {power}ch — Catalogue compatible',          'fr', 'active', 1, 75),
  ('R8_VEHICLE', 'meta_title', '{brand} {model} {type} {power}ch : pièces compatibles par véhicule',     'fr', 'active', 2, 75),
  ('R8_VEHICLE', 'meta_title', 'Catalogue pièces {brand} {model} {type} {power}ch | AutoMecanik',        'fr', 'active', 3, 75),
  ('R8_VEHICLE', 'meta_title', 'Pièces auto compatibles {brand} {model} {type} {power}ch',               'fr', 'active', 4, 75),
  ('R8_VEHICLE', 'meta_title', '{brand} {model} {type} {power}ch — Sélection pièces par véhicule',       'fr', 'active', 5, 75),
  ('R8_VEHICLE', 'meta_title', 'Pièces détachées {brand} {model} {type} {power}ch | AutoMecanik',        'fr', 'active', 6, 75),
  ('R8_VEHICLE', 'meta_title', 'Trouvez les pièces compatibles {brand} {model} {type} {power}ch',        'fr', 'active', 7, 75),

  -- meta_description (11 templates, <=170 chars)
  ('R8_VEHICLE', 'meta_description', 'Découvrez les familles de pièces compatibles {brand} {model} {type} {power}ch. Sélection par véhicule et aide compatibilité.',  'fr', 'active', 1, 170),
  ('R8_VEHICLE', 'meta_description', 'Catalogue de pièces compatibles {brand} {model} {type} {power}ch : sélection guidée par véhicule.',                              'fr', 'active', 2, 170),
  ('R8_VEHICLE', 'meta_description', 'Pièces détachées {brand} {model} {type} {power}ch — sélection par véhicule, références adaptées.',                               'fr', 'active', 3, 170),
  ('R8_VEHICLE', 'meta_description', 'Toutes les familles de pièces compatibles {brand} {model} {type} {power}ch, classées par usage et par véhicule.',                'fr', 'active', 4, 170),
  ('R8_VEHICLE', 'meta_description', 'Compatibilité {brand} {model} {type} {power}ch : trouvez les pièces correspondant exactement à votre véhicule.',                  'fr', 'active', 5, 170),
  ('R8_VEHICLE', 'meta_description', 'Pièces auto pour {brand} {model} {type} {power}ch : familles couvertes, anti-erreur de référence, sélection véhicule.',           'fr', 'active', 6, 170),
  ('R8_VEHICLE', 'meta_description', 'Catalogue {brand} {model} {type} {power}ch : familles de pièces compatibles, aide à la compatibilité véhicule.',                  'fr', 'active', 7, 170),
  ('R8_VEHICLE', 'meta_description', 'Sélection guidée des pièces {brand} {model} {type} {power}ch : compatibilité par motorisation et par véhicule.',                  'fr', 'active', 8, 170),
  ('R8_VEHICLE', 'meta_description', 'Vos pièces pour {brand} {model} {type} {power}ch : catalogue par véhicule, aide compatibilité, FAQ dédiée.',                       'fr', 'active', 9, 170),
  ('R8_VEHICLE', 'meta_description', 'Pièces détachées {brand} {model} {type} {power}ch : familles indexées, aide au choix par véhicule, anti-confusion références.',   'fr', 'active', 10, 170),
  ('R8_VEHICLE', 'meta_description', 'Page véhicule {brand} {model} {type} {power}ch : familles de pièces compatibles, référencement par véhicule, FAQ technique.',     'fr', 'active', 11, 170)
ON CONFLICT (srtp_role, srtp_slot, srtp_lang, srtp_order) DO NOTHING;

COMMIT;
