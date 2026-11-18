-- =============================================================================
-- Migration : remise et marge par défaut d'un profil de prix fournisseur
-- Date      : 2026-11-18 (mandat CH ; modele-fiche.md §b, mandat CD)
-- Scope     : public.supplier_price_profiles, deux ADD COLUMN nullables avec
--             CHECK 0–100. Aucune ligne écrite, aucune RLS ni aucun GRANT modifié.
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- =============================================================================
--
-- MODÈLE (mandat CH) : la remise par fournisseur × marque (× famille,
-- sous-famille) = des lignes de supplier_price_profiles de portée BRAND, FAMILY
-- ou SUBFAMILY ; une promotion = une ligne datée (effective_from / effective_to,
-- change_reason commençant par PROMO). Un profil reste immuable : un changement
-- = nouvelle version, l'ancienne passe active = false.
--
-- NON BRANCHÉ : le moteur (SupplierProfileService.resolveProfile, PricingModule)
-- ne lit pas ces deux colonnes à la date de la migration. Elles portent la
-- condition commerciale négociée ; leur lecture par le calcul des prix est une
-- extension du PricingModule à part (hors mandat CH), et l'invariant de non-vente
-- à perte (P36) reste porté par ce module.
--
-- ÉTAT RELEVÉ (lecture seule, 2026-11-18) : 1 ligne (fournisseur 71, SUPPLIER,
-- active) ; RLS active, politique supplier_price_profiles_service_role_all,
-- GRANT au seul service_role.
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
