-- =============================================================================
-- Migration : fiche fournisseur, colonnes additives sur ___xtr_supplier
-- Date      : 2026-11-18 (mandat CH ; décision 19 et décisions de Marwane du
--             18/11/2026 13:29, 13:35, 14:30, 14:35)
-- Base      : modele-fiche.md (mandat CD) §a, complété par le mandat CH :
--             type plateforme / marque directe, localisation et sa validation,
--             mode d'approvisionnement, statut actif/occasionnel/a_confirmer/archive.
-- Scope     : public.___xtr_supplier, ADD COLUMN uniquement. Toutes les colonnes
--             sont NULLABLES, sans DEFAULT. Aucune ligne écrite, aucune colonne
--             existante retypée (spl_id, spl_name, spl_alias, spl_display,
--             spl_sort restent text), aucune RLS ni aucun GRANT modifié.
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- =============================================================================
--
-- ÉTAT RELEVÉ (lecture seule, 2026-11-18, base partagée) : 70 lignes,
-- spl_id text PK, RLS active, une seule politique
-- ___xtr_supplier_service_role_all (service_role), GRANT au seul service_role,
-- aucune vue ni fonction ne lit la table. Un ADD COLUMN hérite des droits de la
-- table : anon et authenticated n'obtiennent rien.
--
-- SECRETS : la fiche ne porte JAMAIS une valeur. spl_secret_name ne porte que le
-- nom (ou le préfixe) d'une variable d'environnement du serveur ; le CHECK de
-- format refuse tout ce qui n'a pas la forme d'un nom de variable (minuscules,
-- espaces, ponctuation), ce qui écarte un mot de passe collé par erreur dans la
-- plupart des cas. spl_access_state est écrit par le connecteur, jamais à la main
-- (aucun écran ne l'expose en écriture).
--
-- LOCALISATION : spl_location_validated_at / _by = validation de Marwane, posée
-- par une action explicite de l'écran, jamais par une migration ni un calcul.
-- Le CHECK de paire interdit une date sans auteur et inversement.
--
-- Entiers : bigint et non integer (squawk prefer-bigint-over-int, .squawk.toml).
--
-- APPLICATION : réservée à Marwane, workflow « Apply Supabase migrations
-- (manual) », à blanc puis réel. Le code de la PR qui écrit ces colonnes échoue
-- explicitement (colonne inconnue) tant que la migration n'est pas appliquée.
-- =============================================================================

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_temp;

-- Identité et type --------------------------------------------------------------
ALTER TABLE public.___xtr_supplier
  ADD COLUMN IF NOT EXISTS spl_type text
    CONSTRAINT ___xtr_supplier_spl_type_check
    CHECK (spl_type IN ('plateforme', 'marque_directe'));

ALTER TABLE public.___xtr_supplier
  ADD COLUMN IF NOT EXISTS spl_status text
    CONSTRAINT ___xtr_supplier_spl_status_check
    CHECK (spl_status IN ('actif', 'occasionnel', 'a_confirmer', 'archive'));

-- Contacts ----------------------------------------------------------------------
ALTER TABLE public.___xtr_supplier
  ADD COLUMN IF NOT EXISTS spl_contact_name text;

ALTER TABLE public.___xtr_supplier
  ADD COLUMN IF NOT EXISTS spl_email text;

ALTER TABLE public.___xtr_supplier
  ADD COLUMN IF NOT EXISTS spl_phone text;

ALTER TABLE public.___xtr_supplier
  ADD COLUMN IF NOT EXISTS spl_website text
    CONSTRAINT ___xtr_supplier_spl_website_check
    CHECK (spl_website ~ '^https?://');

-- Localisation et mode d'approvisionnement -----------------------------------
ALTER TABLE public.___xtr_supplier
  ADD COLUMN IF NOT EXISTS spl_address text;

ALTER TABLE public.___xtr_supplier
  ADD COLUMN IF NOT EXISTS spl_postcode text;

ALTER TABLE public.___xtr_supplier
  ADD COLUMN IF NOT EXISTS spl_city text;

ALTER TABLE public.___xtr_supplier
  ADD COLUMN IF NOT EXISTS spl_country text
    CONSTRAINT ___xtr_supplier_spl_country_check
    CHECK (spl_country ~ '^[A-Z]{2}$');

ALTER TABLE public.___xtr_supplier
  ADD COLUMN IF NOT EXISTS spl_supply_mode text
    CONSTRAINT ___xtr_supplier_spl_supply_mode_check
    CHECK (spl_supply_mode IN ('flux_tendu', 'livraison_france', 'import'));

ALTER TABLE public.___xtr_supplier
  ADD COLUMN IF NOT EXISTS spl_location_validated_at timestamptz;

ALTER TABLE public.___xtr_supplier
  ADD COLUMN IF NOT EXISTS spl_location_validated_by text;

-- Conditions --------------------------------------------------------------------
ALTER TABLE public.___xtr_supplier
  ADD COLUMN IF NOT EXISTS spl_payment_terms text;

ALTER TABLE public.___xtr_supplier
  ADD COLUMN IF NOT EXISTS spl_franco_ht_cents bigint
    CONSTRAINT ___xtr_supplier_spl_franco_ht_cents_check
    CHECK (spl_franco_ht_cents >= 0);

ALTER TABLE public.___xtr_supplier
  ADD COLUMN IF NOT EXISTS spl_delivery_delay_days bigint
    CONSTRAINT ___xtr_supplier_spl_delivery_delay_days_check
    CHECK (spl_delivery_delay_days >= 0);

ALTER TABLE public.___xtr_supplier
  ADD COLUMN IF NOT EXISTS spl_order_mode text
    CONSTRAINT ___xtr_supplier_spl_order_mode_check
    CHECK (spl_order_mode IN ('portail', 'email', 'telephone', 'edi', 'api'));

-- Accès (nom du secret et état, jamais la valeur) ------------------------------
ALTER TABLE public.___xtr_supplier
  ADD COLUMN IF NOT EXISTS spl_portal_url text
    CONSTRAINT ___xtr_supplier_spl_portal_url_check
    CHECK (spl_portal_url ~ '^https?://');

ALTER TABLE public.___xtr_supplier
  ADD COLUMN IF NOT EXISTS spl_secret_name text
    CONSTRAINT ___xtr_supplier_spl_secret_name_check
    CHECK (spl_secret_name ~ '^[A-Z][A-Z0-9_]{0,63}$');

ALTER TABLE public.___xtr_supplier
  ADD COLUMN IF NOT EXISTS spl_access_state text
    CONSTRAINT ___xtr_supplier_spl_access_state_check
    CHECK (spl_access_state IN (
      'non_configure', 'configure_non_verifie', 'verifie', 'echec', 'revoque'));

ALTER TABLE public.___xtr_supplier
  ADD COLUMN IF NOT EXISTS spl_access_checked_at timestamptz;

-- Traçabilité -------------------------------------------------------------------
ALTER TABLE public.___xtr_supplier
  ADD COLUMN IF NOT EXISTS spl_updated_at timestamptz;

ALTER TABLE public.___xtr_supplier
  ADD COLUMN IF NOT EXISTS spl_updated_by text;

-- Paire validation de localisation : date et auteur ensemble ou aucun des deux.
-- NOT VALID (squawk constraint-missing-not-valid) : les deux colonnes viennent
-- d'être ajoutées et sont NULL sur toutes les lignes, la contrainte est donc
-- vraie pour l'existant ; les nouvelles écritures sont contrôlées dès le COMMIT.
ALTER TABLE public.___xtr_supplier
  DROP CONSTRAINT IF EXISTS ___xtr_supplier_spl_location_validation_pair;
ALTER TABLE public.___xtr_supplier
  ADD CONSTRAINT ___xtr_supplier_spl_location_validation_pair
  CHECK ((spl_location_validated_at IS NULL) = (spl_location_validated_by IS NULL))
  NOT VALID;

COMMENT ON COLUMN public.___xtr_supplier.spl_type IS
  'plateforme (distribue plusieurs marques) ou marque_directe. Mandat CH, décision du 18/11/2026 14:30.';
COMMENT ON COLUMN public.___xtr_supplier.spl_status IS
  'actif, occasionnel, a_confirmer, archive. Retrait = archive + spl_display = 0, sans DELETE.';
COMMENT ON COLUMN public.___xtr_supplier.spl_country IS
  'Code pays ISO 3166-1 alpha-2.';
COMMENT ON COLUMN public.___xtr_supplier.spl_supply_mode IS
  'flux_tendu (Gennevilliers), livraison_france, import. Délais de livraison et de paiement différents.';
COMMENT ON COLUMN public.___xtr_supplier.spl_location_validated_at IS
  'Validation de la localisation par Marwane (action explicite de l''écran), jamais automatique.';
COMMENT ON COLUMN public.___xtr_supplier.spl_franco_ht_cents IS
  'Franco de port HT, en centimes.';
COMMENT ON COLUMN public.___xtr_supplier.spl_secret_name IS
  'Nom ou préfixe de la variable d''environnement du serveur. JAMAIS une valeur de secret.';
COMMENT ON COLUMN public.___xtr_supplier.spl_access_state IS
  'Écrit par le connecteur selon le résultat d''une connexion, jamais à la main.';
