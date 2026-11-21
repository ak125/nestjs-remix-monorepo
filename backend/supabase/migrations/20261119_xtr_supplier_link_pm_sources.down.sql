-- =============================================================================
-- Rollback : 20261119_xtr_supplier_link_pm_sources.sql (mandat DQ)
-- Retire la fonction, l'index, les contraintes et les colonnes ajoutées.
-- PERTE DE DONNÉES : rangs, points de livraison, natures, surcoûts et auteurs
-- saisis depuis l'application, ainsi que spl_fallback_mode. Les liens CRÉÉS par
-- supplier_brand_sources_put (lignes ajoutées à ___xtr_supplier_link_pm) restent
-- en place : ce sont des liens marque × fournisseur ordinaires, lisibles par les
-- lecteurs historiques. Les lister avant rollback :
--   SELECT slpm_id FROM ___xtr_supplier_link_pm WHERE slpm_updated_by IS NOT NULL;
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_temp;

DROP FUNCTION IF EXISTS public.supplier_brand_sources_put(text, jsonb, text);

DROP INDEX IF EXISTS public.___xtr_supplier_link_pm_brand_rank_uniq;

ALTER TABLE public.___xtr_supplier_link_pm
  DROP CONSTRAINT IF EXISTS ___xtr_supplier_link_pm_delivery_spl_fkey,
  DROP CONSTRAINT IF EXISTS ___xtr_supplier_link_pm_updated_pair,
  DROP CONSTRAINT IF EXISTS ___xtr_supplier_link_pm_source_shape;

ALTER TABLE public.___xtr_supplier_link_pm
  DROP COLUMN IF EXISTS slpm_updated_by,
  DROP COLUMN IF EXISTS slpm_updated_at,
  DROP COLUMN IF EXISTS slpm_surcharge_cents,
  DROP COLUMN IF EXISTS slpm_stock_kind,
  DROP COLUMN IF EXISTS slpm_delivery_spl_id,
  DROP COLUMN IF EXISTS slpm_rank;

ALTER TABLE public.___xtr_supplier
  DROP COLUMN IF EXISTS spl_fallback_mode;

COMMIT;
