-- =============================================================================
-- Migration : remise et marge négociées, portée fournisseur × marque × famille
-- Date      : 2026-11-18 (mandat CH + complément CH-2 ; modele-fiche.md §b, mandat CD)
-- Scope     : public.supplier_price_profiles :
--               - ADD COLUMN default_remise_pct, default_marge_pct (numeric 0–100)
--               - ADD COLUMN brand_pm_id (text, pm_id numérique, nullable)
--               - CHECK de forme de la portée et CHECK d'ordre de la période
--               - index unique de la règle active
--             Aucune ligne écrite, aucune RLS ni aucun GRANT modifié.
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- squawk-ignore-file require-concurrent-index-creation
--   Justification : table de 1 ligne (relevé du 18/11) ; l'index reste dans la
--   transaction de la migration pour garder l'atomicité (CONCURRENTLY interdit
--   en transaction), le verrou dure le temps de lire une ligne.
-- =============================================================================
--
-- MODÈLE (décision de Marwane, 18/11 17:01) : une ligne porte une règle de
-- remise (et/ou de marge) pour une portée. La portée combine :
--   - brand_pm_id : la marque (pieces_marque.pm_id, même forme texte que
--     ___xtr_supplier_link_pm.slpm_pm_id et pieces_price.pri_pm_id), ou NULL ;
--   - scope_level + scope_code, au sens FIXÉ ci-dessous.
--
--   scope_level | scope_code                         | brand_pm_id
--   ------------+------------------------------------+-------------
--   SUPPLIER    | NULL                               | NULL
--   BRAND       | NULL                               | obligatoire
--   FAMILY      | code famille, pri_code_fam_nu       | facultatif
--               | (ex. NU17)                         |
--   SUBFAMILY   | code sous-famille, pri_code_sfam_nu | facultatif
--               | (ex. 1738)                         |
--
-- Ex. : SEIM chez CAL sur la famille câbles = supplier_id CAL, brand_pm_id de
-- SEIM, scope_level FAMILY, scope_code = code de la famille.
--
-- Une promotion = une ligne datée (effective_from inclus, effective_to exclu).
-- Une règle active est unique par (fournisseur, marque, niveau, code, période) ;
-- un changement = nouvelle version, l'ancienne passe active = false.
--
-- RÉSOLUTION (fonction pure suppliers/supplier-price-rule.ts, testée) : la
-- portée la plus précise gagne : marque × sous-famille, marque × famille,
-- marque, sous-famille, famille, fournisseur ; une promo datée prime sur la
-- règle de même niveau pendant sa période.
--
-- NON BRANCHÉ : le moteur (SupplierProfileService.resolveProfile, PricingModule)
-- ne lit ni brand_pm_id ni les deux pourcentages à la date de la migration. Leur
-- lecture par le calcul des prix est un mandat séparé, après la fusion ;
-- l'invariant de non-vente à perte (P36) reste porté par ce module.
--
-- ÉTAT RELEVÉ (lecture seule, 2026-11-18) : 1 ligne (fournisseur 71, SUPPLIER,
-- scope_code NULL, sans date, active), conforme aux deux CHECK ; RLS active,
-- politique supplier_price_profiles_service_role_all, GRANT au seul service_role.
-- Les CHECK sont posés NOT VALID (règle squawk) : ils s'appliquent à toute
-- écriture nouvelle ; la ligne existante y est conforme.
--
-- APPLICATION : réservée à Marwane, workflow « Apply Supabase migrations
-- (manual) », à blanc puis réel.
-- =============================================================================

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_temp;

ALTER TABLE public.supplier_price_profiles
  ADD COLUMN IF NOT EXISTS default_remise_pct numeric
    CONSTRAINT supplier_price_profiles_default_remise_pct_check
    CHECK (default_remise_pct >= 0 AND default_remise_pct <= 100);

ALTER TABLE public.supplier_price_profiles
  ADD COLUMN IF NOT EXISTS default_marge_pct numeric
    CONSTRAINT supplier_price_profiles_default_marge_pct_check
    CHECK (default_marge_pct >= 0 AND default_marge_pct <= 100);

COMMENT ON COLUMN public.supplier_price_profiles.default_remise_pct IS
  'Remise fournisseur négociée, en %, 0 à 100. Non lue par resolveProfile à la date de la migration.';
COMMENT ON COLUMN public.supplier_price_profiles.default_marge_pct IS
  'Marge appliquée par défaut, en %, 0 à 100. Non lue par resolveProfile à la date de la migration.';

ALTER TABLE public.supplier_price_profiles
  ADD COLUMN IF NOT EXISTS brand_pm_id text
    CONSTRAINT supplier_price_profiles_brand_pm_id_check
    CHECK (brand_pm_id ~ '^[0-9]{1,10}$');

ALTER TABLE public.supplier_price_profiles
  DROP CONSTRAINT IF EXISTS supplier_price_profiles_scope_shape_check;
ALTER TABLE public.supplier_price_profiles
  ADD CONSTRAINT supplier_price_profiles_scope_shape_check
  CHECK (
    CASE scope_level
      WHEN 'SUPPLIER' THEN scope_code IS NULL AND brand_pm_id IS NULL
      WHEN 'BRAND' THEN scope_code IS NULL AND brand_pm_id IS NOT NULL
      ELSE scope_code IS NOT NULL
        AND scope_code = btrim(scope_code)
        AND scope_code <> ''
    END
  ) NOT VALID;

ALTER TABLE public.supplier_price_profiles
  DROP CONSTRAINT IF EXISTS supplier_price_profiles_period_check;
ALTER TABLE public.supplier_price_profiles
  ADD CONSTRAINT supplier_price_profiles_period_check
  CHECK (
    effective_from IS NULL OR effective_to IS NULL OR effective_to > effective_from
  ) NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS supplier_price_profiles_active_rule_uniq
  ON public.supplier_price_profiles
    (supplier_id, brand_pm_id, scope_level, scope_code, effective_from, effective_to)
  NULLS NOT DISTINCT
  WHERE active;

COMMENT ON COLUMN public.supplier_price_profiles.brand_pm_id IS
  'Marque de la règle (pieces_marque.pm_id en texte). Obligatoire en BRAND, facultative en FAMILY/SUBFAMILY, NULL en SUPPLIER. Non lue par resolveProfile à la date de la migration.';
COMMENT ON COLUMN public.supplier_price_profiles.scope_code IS
  'SUPPLIER/BRAND : NULL. FAMILY : code famille (pri_code_fam_nu, ex. NU17). SUBFAMILY : code sous-famille (pri_code_sfam_nu, ex. 1738).';
