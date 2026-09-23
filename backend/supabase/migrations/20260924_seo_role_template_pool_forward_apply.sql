-- =====================================================================
-- Migration forward : exécute enfin le contenu de
-- 20260509_seo_role_template_pool_with_r8_meta_seed.
--
-- Pourquoi : 20260509 est inscrite au ledger infra.schema_migrations avec
-- runner = baseline-2026-05-16 et execution_ms = 0 (inscription par
-- baseline, sans exécution). Lecture seule du catalogue au 2026-09-23
-- 22:05 UTC : to_regclass('public.__seo_role_template_pool') IS NULL,
-- aucune colonne variant_signature sur public.__seo_r8_pages, aucune
-- policy ni index du pool. Politique forward-only
-- (backend/supabase/migrations/README.md) : on ne modifie pas 20260509,
-- on livre une nouvelle migration.
--
-- Idempotente : chaque instruction est un no-op si l'objet existe déjà
-- (IF NOT EXISTS, policy créée seulement si absente de pg_policies,
-- seed en ON CONFLICT DO NOTHING). Aucune suppression d'objet.
--
-- Écarts assumés vs 20260509 (squawk 2.52.1 sur 20260509 : 6 issues) :
--   * pas de BEGIN/COMMIT : le moteur fournit la transaction
--     (transaction-nesting) ;
--   * timeouts explicites, sinon hérités du rôle (require-timeout-settings) ;
--     SET LOCAL : portée transaction (le moteur exécute le fichier dans
--     une transaction), rien ne fuit dans la session du runner ;
--   * srtp_order / srtp_max_length en bigint (prefer-bigint-over-int) ;
--   * IF NOT EXISTS sur table / index / colonne ;
--   * policy créée par un bloc DO conditionnel sur pg_policies (au lieu
--     d'un CREATE POLICY nu, qui échouerait si la policy existait).
-- Texte du seed : identique octet pour octet à 20260509.
-- =====================================================================

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- =====================================================================
-- 1) Table __seo_role_template_pool
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.__seo_role_template_pool (
  srtp_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  srtp_role         text NOT NULL,
  srtp_slot         text NOT NULL,
  srtp_template     text NOT NULL,
  srtp_lang         text NOT NULL DEFAULT 'fr',
  srtp_status       text NOT NULL DEFAULT 'active',
  srtp_order        bigint NOT NULL,
  srtp_weight       numeric NOT NULL DEFAULT 1.0,
  srtp_max_length   bigint,
  srtp_created_at   timestamptz NOT NULL DEFAULT now(),
  srtp_updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_srtp_status CHECK (srtp_status IN ('active', 'retired', 'draft'))
);

-- INDEX: uq_srtp_role_slot_lang_order (repris de 20260509)
-- Table: public.__seo_role_template_pool (18 lignes après seed)
-- Pattern: arbitre de ON CONFLICT (srtp_role, srtp_slot, srtp_lang, srtp_order)
--          du seed ci-dessous ; garantit un srtp_order unique par slot, dont
--          dépend l'index sha256 reproductible du selector.
-- Gain attendu: intégrité (unicité), pas de gain de lecture à 18 lignes.
-- RPC concernees: aucune RPC ; SeoRoleTemplateSelector via
--          SeoSwitchSelector.fetchVariants() (supabase.from, client backend).
CREATE UNIQUE INDEX IF NOT EXISTS uq_srtp_role_slot_lang_order
  ON public.__seo_role_template_pool (srtp_role, srtp_slot, srtp_lang, srtp_order);

-- INDEX: idx_srtp_active_lookup (repris de 20260509)
-- Table: public.__seo_role_template_pool (18 lignes après seed)
-- Pattern: WHERE srtp_role = $1 AND srtp_slot = $2 AND srtp_lang = $3
--          AND srtp_status = 'active' ORDER BY srtp_order
-- Gain attendu: négligeable à 18 lignes (Seq Scan probable) ; conservé pour
--          la parité de schéma avec 20260509, dont il fait partie.
-- RPC concernees: aucune RPC ; SeoRoleTemplateSelector.pick() (R8 meta).
CREATE INDEX IF NOT EXISTS idx_srtp_active_lookup
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
--    Les privilèges par défaut du schéma public accordent tout à anon et
--    authenticated sur une table neuve : le REVOKE est obligatoire.
-- =====================================================================

ALTER TABLE public.__seo_role_template_pool ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.__seo_role_template_pool FROM anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = '__seo_role_template_pool'
      AND policyname = '__seo_role_template_pool_service_role_all'
  ) THEN
    CREATE POLICY __seo_role_template_pool_service_role_all
      ON public.__seo_role_template_pool
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

-- =====================================================================
-- 3) Colonne variant_signature sur __seo_r8_pages
--    DEFAULT constant non volatile : sur PostgreSQL >= 11 la valeur est
--    stockée dans le catalogue, sans réécriture de la table (verrou
--    ACCESS EXCLUSIVE bref, borné par lock_timeout ci-dessus).
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
