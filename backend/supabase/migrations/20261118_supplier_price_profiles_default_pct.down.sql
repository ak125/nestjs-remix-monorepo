-- Rollback: 20261118_supplier_price_profiles_default_pct
-- Retire default_remise_pct et default_marge_pct. DÉTRUIT les valeurs saisies :
-- à ne lancer que tant qu'aucune n'est saisie, ou après export.
-- L'engine est forward-only : ce fichier se lance à la main.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_temp;

ALTER TABLE public.supplier_price_profiles
  DROP COLUMN IF EXISTS default_remise_pct,
  DROP COLUMN IF EXISTS default_marge_pct;

COMMIT;
