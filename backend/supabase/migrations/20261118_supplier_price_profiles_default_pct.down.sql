-- Rollback: 20261118_supplier_price_profiles_default_pct
-- Retire l'index unique de règle active, les CHECK de portée et de période,
-- brand_pm_id, default_remise_pct et default_marge_pct. DÉTRUIT les valeurs
-- saisies : à ne lancer que tant qu'aucune n'est saisie, ou après export. Les
-- lignes de portée marque × famille resteraient alors sans leur marque : les
-- passer d'abord en active = false.
-- L'engine est forward-only : ce fichier se lance à la main.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_temp;

DROP INDEX IF EXISTS public.supplier_price_profiles_active_rule_uniq;

ALTER TABLE public.supplier_price_profiles
  DROP CONSTRAINT IF EXISTS supplier_price_profiles_scope_shape_check,
  DROP CONSTRAINT IF EXISTS supplier_price_profiles_period_check,
  DROP COLUMN IF EXISTS brand_pm_id,
  DROP COLUMN IF EXISTS default_remise_pct,
  DROP COLUMN IF EXISTS default_marge_pct;

COMMIT;
