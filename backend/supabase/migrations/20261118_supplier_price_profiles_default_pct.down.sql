-- Rollback: 20261118_supplier_price_profiles_default_pct
-- Retire la fonction supplier_price_condition_put, l'index unique de ligne
-- active, les CHECK de nature, de portée, de période et de retrait, remet
-- NOT NULL sur les quatre paramètres d'import, puis retire profile_kind,
-- brand_pm_id, default_remise_pct, default_marge_pct, retired_at et retired_by.
-- REFUSE de s'exécuter tant qu'une ligne 'condition' existe (active ou non) :
-- elle n'a pas de paramètre d'import et perdrait sa nature. Marwane décide
-- d'abord de son export ou de sa suppression ; ce fichier n'en supprime aucune.
-- L'engine est forward-only : ce fichier se lance à la main.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_temp;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.supplier_price_profiles WHERE profile_kind = 'condition'
  ) THEN
    RAISE EXCEPTION 'rollback refusé : des lignes condition existent dans supplier_price_profiles (exporter puis décider avant de relancer)';
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.supplier_price_condition_put(
  text, text, text, text, timestamptz, timestamptz, numeric, numeric, text, text
);

DROP INDEX IF EXISTS public.supplier_price_profiles_active_rule_uniq;

ALTER TABLE public.supplier_price_profiles
  DROP CONSTRAINT IF EXISTS supplier_price_profiles_kind_shape_check,
  DROP CONSTRAINT IF EXISTS supplier_price_profiles_retired_check,
  DROP CONSTRAINT IF EXISTS supplier_price_profiles_scope_shape_check,
  DROP CONSTRAINT IF EXISTS supplier_price_profiles_period_check;

ALTER TABLE public.supplier_price_profiles
  ALTER COLUMN price_basis SET NOT NULL,
  ALTER COLUMN derivation SET NOT NULL,
  ALTER COLUMN column_mapping SET NOT NULL,
  ALTER COLUMN key_field SET NOT NULL;

ALTER TABLE public.supplier_price_profiles
  DROP COLUMN IF EXISTS profile_kind,
  DROP COLUMN IF EXISTS retired_at,
  DROP COLUMN IF EXISTS retired_by,
  DROP COLUMN IF EXISTS brand_pm_id,
  DROP COLUMN IF EXISTS default_remise_pct,
  DROP COLUMN IF EXISTS default_marge_pct;

COMMIT;
