-- Rollback de 20261019_customer_marketing_consent.sql — documentation seule,
-- ignoré par le runner (forward-only, voir README). Intervention opérateur
-- uniquement.
--
-- ⚠ Supprimer ces colonnes efface les preuves de consentement recueillies.
-- Avant toute exécution, exporter les lignes consentantes :
--   SELECT cst_id, cst_marketing_consent_at, cst_marketing_consent_source
--   FROM public.___xtr_customer WHERE cst_marketing_consent_at IS NOT NULL;

SET LOCAL lock_timeout      = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE public.___xtr_customer
  DROP CONSTRAINT IF EXISTS ___xtr_customer_marketing_consent_pair_check,
  DROP CONSTRAINT IF EXISTS ___xtr_customer_marketing_consent_source_check,
  DROP COLUMN IF EXISTS cst_marketing_consent_source,
  DROP COLUMN IF EXISTS cst_marketing_consent_at;
