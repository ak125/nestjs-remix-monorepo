-- Rollback: 20261118_xtr_supplier_fiche_columns
-- Retire les colonnes de fiche ajoutées à ___xtr_supplier. DÉTRUIT les données
-- saisies dans ces colonnes : à ne lancer que tant qu'aucune fiche n'est saisie
-- (modele-fiche.md §e.1), ou après export. Colonnes historiques intactes.
-- L'engine est forward-only : ce fichier se lance à la main.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_temp;

ALTER TABLE public.___xtr_supplier
  DROP CONSTRAINT IF EXISTS ___xtr_supplier_spl_location_validation_pair;

ALTER TABLE public.___xtr_supplier
  DROP COLUMN IF EXISTS spl_type,
  DROP COLUMN IF EXISTS spl_status,
  DROP COLUMN IF EXISTS spl_contact_name,
  DROP COLUMN IF EXISTS spl_email,
  DROP COLUMN IF EXISTS spl_phone,
  DROP COLUMN IF EXISTS spl_website,
  DROP COLUMN IF EXISTS spl_address,
  DROP COLUMN IF EXISTS spl_postcode,
  DROP COLUMN IF EXISTS spl_city,
  DROP COLUMN IF EXISTS spl_country,
  DROP COLUMN IF EXISTS spl_supply_mode,
  DROP COLUMN IF EXISTS spl_location_validated_at,
  DROP COLUMN IF EXISTS spl_location_validated_by,
  DROP COLUMN IF EXISTS spl_payment_terms,
  DROP COLUMN IF EXISTS spl_franco_ht_cents,
  DROP COLUMN IF EXISTS spl_delivery_delay_days,
  DROP COLUMN IF EXISTS spl_order_mode,
  DROP COLUMN IF EXISTS spl_portal_url,
  DROP COLUMN IF EXISTS spl_secret_name,
  DROP COLUMN IF EXISTS spl_access_state,
  DROP COLUMN IF EXISTS spl_access_checked_at,
  DROP COLUMN IF EXISTS spl_updated_at,
  DROP COLUMN IF EXISTS spl_updated_by;

COMMIT;
