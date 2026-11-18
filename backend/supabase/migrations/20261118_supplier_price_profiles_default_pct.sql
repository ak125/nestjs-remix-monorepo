-- =============================================================================
-- Migration : conditions commerciales (remise, marge) à côté des profils d'import
-- Date      : 2026-11-18 (mandat CH, compléments CH-2 et CH-3 ; modele-fiche.md §b)
-- Scope     : public.supplier_price_profiles :
--               - ADD COLUMN profile_kind ('import' | 'condition', défaut 'import')
--               - ADD COLUMN default_remise_pct, default_marge_pct (numeric 0–100)
--               - ADD COLUMN brand_pm_id (text, pm_id numérique, nullable)
--               - ADD COLUMN retired_at, retired_by (auteur et date du retrait)
--               - DROP NOT NULL sur price_basis, derivation, column_mapping,
--                 key_field (une condition ne les porte pas ; le CHECK de nature
--                 les exige toujours sur une ligne 'import')
--               - CHECK de nature, de portée, de période et de retrait
--               - index unique de la ligne active
--               - fonction supplier_price_condition_put (remplacement atomique)
--             Aucune ligne écrite, aucune RLS ni aucun GRANT de table modifié.
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- squawk-ignore-file require-concurrent-index-creation
--   Justification : table de 1 ligne (relevé du 18/11) ; l'index reste dans la
--   transaction de la migration pour garder l'atomicité (CONCURRENTLY interdit
--   en transaction), le verrou dure le temps de lire une ligne.
-- squawk-ignore-file ban-drop-not-null
--   Justification : price_basis, derivation, column_mapping et key_field
--   restent exigés sur toute ligne 'import' par le CHECK de nature ; le seul
--   client qui les lit (PricingRepository.fetchProfiles) ne lit plus que les
--   lignes 'import' (même PR). Une condition ne les porte pas : aucune recopie.
-- =============================================================================
--
-- DEUX NATURES DE LIGNE (décision de Marwane, 18/11 19:08, complément CH-3) :
--   - 'import' : le profil de lecture du fichier tarif. Porte price_basis,
--     derivation, column_mapping, key_field ; ni marque, ni remise, ni marge.
--     Seule nature lue par le moteur (PricingRepository.fetchProfiles filtre
--     profile_kind = 'import'). La ligne existante de DCA prend le défaut.
--   - 'condition' : une condition commerciale. Porte marque, portée, remise
--     et/ou marge, période ; aucun paramètre d'import (aucune recopie).
--
-- PORTÉE d'une condition :
--   scope_level | scope_code                         | brand_pm_id
--   ------------+------------------------------------+-------------
--   SUPPLIER    | NULL                               | NULL
--   BRAND       | NULL                               | obligatoire
--   FAMILY      | code famille, pri_code_fam_nu       | facultatif
--               | (ex. NU17)                         |
--   SUBFAMILY   | code sous-famille, pri_code_sfam_nu | facultatif
--               | (ex. 1738)                         |
-- brand_pm_id = pieces_marque.pm_id, même forme texte que
-- ___xtr_supplier_link_pm.slpm_pm_id et pieces_price.pri_pm_id. Un profil
-- d'import de niveau BRAND reste sans marque (forme lue par le moteur).
--
-- Ex. : SEIM chez CAL sur la famille câbles = supplier_id CAL, profile_kind
-- condition, brand_pm_id de SEIM, scope_level FAMILY, scope_code = code famille.
--
-- Une promotion = une ligne datée (effective_from inclus, effective_to exclu).
-- Une ligne active est unique par (fournisseur, nature, marque, niveau, code,
-- période). Un changement = nouvelle version, l'ancienne passe active = false.
--
-- REMPLACEMENT ATOMIQUE : supplier_price_condition_put fait, dans la
-- transaction de l'appel, retrait de l'ancienne version (retired_at, retired_by)
-- et insertion de la nouvelle : aucune autre transaction ne voit d'instant sans
-- condition active. Verrou consultatif par fournisseur : deux écritures du même
-- fournisseur passent l'une après l'autre.
--
-- RETRAIT : active = false avec retired_at et retired_by, obligatoires ensemble
-- et seulement sur une ligne inactive. Jamais de DELETE.
--
-- RÉSOLUTION (fonction pure suppliers/supplier-price-rule.ts, testée) : la
-- portée la plus précise gagne : marque × sous-famille, marque × famille,
-- marque, sous-famille, famille, fournisseur ; une promo datée prime sur la
-- condition de même niveau pendant sa période.
--
-- NON BRANCHÉ : le calcul des prix ne lit ni brand_pm_id ni les deux
-- pourcentages à la date de la migration. Leur lecture est un mandat séparé,
-- après la fusion ; l'invariant de non-vente à perte (P36) reste porté par
-- PricingModule.
--
-- ÉTAT RELEVÉ (lecture seule, 2026-11-18) : 1 ligne (fournisseur 71, SUPPLIER,
-- scope_code NULL, sans date, active, paramètres d'import renseignés), conforme
-- aux CHECK ; RLS active, politique supplier_price_profiles_service_role_all,
-- GRANT au seul service_role. Les CHECK de table sont posés NOT VALID (règle
-- squawk) : ils s'appliquent à toute écriture nouvelle ; la ligne existante y
-- est conforme.
--
-- APPLICATION : réservée à Marwane, workflow « Apply Supabase migrations
-- (manual) », à blanc puis réel.
-- =============================================================================

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_temp;

ALTER TABLE public.supplier_price_profiles
  ADD COLUMN IF NOT EXISTS profile_kind text NOT NULL DEFAULT 'import'
    CONSTRAINT supplier_price_profiles_profile_kind_check
    CHECK (profile_kind IN ('import', 'condition'));

COMMENT ON COLUMN public.supplier_price_profiles.profile_kind IS
  'import : profil de lecture du tarif (price_basis, derivation, column_mapping, key_field), seul lu par le moteur. condition : remise et/ou marge par portée et période, sans paramètre d''import.';

ALTER TABLE public.supplier_price_profiles
  ALTER COLUMN price_basis DROP NOT NULL,
  ALTER COLUMN derivation DROP NOT NULL,
  ALTER COLUMN column_mapping DROP NOT NULL,
  ALTER COLUMN key_field DROP NOT NULL;

ALTER TABLE public.supplier_price_profiles
  ADD COLUMN IF NOT EXISTS default_remise_pct numeric
    CONSTRAINT supplier_price_profiles_default_remise_pct_check
    CHECK (default_remise_pct >= 0 AND default_remise_pct <= 100);

ALTER TABLE public.supplier_price_profiles
  ADD COLUMN IF NOT EXISTS default_marge_pct numeric
    CONSTRAINT supplier_price_profiles_default_marge_pct_check
    CHECK (default_marge_pct >= 0 AND default_marge_pct <= 100);

COMMENT ON COLUMN public.supplier_price_profiles.default_remise_pct IS
  'Remise fournisseur négociée, en %, 0 à 100, sur une ligne condition. Non lue par le calcul des prix à la date de la migration.';
COMMENT ON COLUMN public.supplier_price_profiles.default_marge_pct IS
  'Marge appliquée par défaut, en %, 0 à 100, sur une ligne condition. Non lue par le calcul des prix à la date de la migration.';

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
      WHEN 'BRAND' THEN scope_code IS NULL
        AND (brand_pm_id IS NOT NULL OR profile_kind = 'import')
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

ALTER TABLE public.supplier_price_profiles
  DROP CONSTRAINT IF EXISTS supplier_price_profiles_kind_shape_check;
ALTER TABLE public.supplier_price_profiles
  ADD CONSTRAINT supplier_price_profiles_kind_shape_check
  CHECK (
    CASE profile_kind
      WHEN 'import' THEN price_basis IS NOT NULL
        AND derivation IS NOT NULL
        AND column_mapping IS NOT NULL
        AND key_field IS NOT NULL
        AND brand_pm_id IS NULL
        AND default_remise_pct IS NULL
        AND default_marge_pct IS NULL
      WHEN 'condition' THEN price_basis IS NULL
        AND derivation IS NULL
        AND column_mapping IS NULL
        AND key_field IS NULL
        AND (default_remise_pct IS NOT NULL OR default_marge_pct IS NOT NULL)
      ELSE false
    END
  ) NOT VALID;

ALTER TABLE public.supplier_price_profiles
  ADD COLUMN IF NOT EXISTS retired_at timestamptz;
ALTER TABLE public.supplier_price_profiles
  ADD COLUMN IF NOT EXISTS retired_by text;

ALTER TABLE public.supplier_price_profiles
  DROP CONSTRAINT IF EXISTS supplier_price_profiles_retired_check;
ALTER TABLE public.supplier_price_profiles
  ADD CONSTRAINT supplier_price_profiles_retired_check
  CHECK (
    (retired_at IS NULL AND retired_by IS NULL)
    OR (
      retired_at IS NOT NULL
      AND retired_by IS NOT NULL
      AND btrim(retired_by) <> ''
      AND NOT active
    )
  ) NOT VALID;

COMMENT ON COLUMN public.supplier_price_profiles.retired_at IS
  'Date du retrait ou du remplacement de la ligne (active = false). NULL tant que la ligne n''a pas été retirée par la fiche fournisseur.';
COMMENT ON COLUMN public.supplier_price_profiles.retired_by IS
  'Auteur du retrait ou du remplacement. Obligatoire avec retired_at.';

CREATE UNIQUE INDEX IF NOT EXISTS supplier_price_profiles_active_rule_uniq
  ON public.supplier_price_profiles
    (supplier_id, profile_kind, brand_pm_id, scope_level, scope_code,
     effective_from, effective_to)
  NULLS NOT DISTINCT
  WHERE active;

COMMENT ON COLUMN public.supplier_price_profiles.brand_pm_id IS
  'Marque de la règle (pieces_marque.pm_id en texte). Condition : obligatoire en BRAND, facultative en FAMILY/SUBFAMILY, NULL en SUPPLIER. Import : toujours NULL. Non lue par le calcul des prix à la date de la migration.';
COMMENT ON COLUMN public.supplier_price_profiles.scope_code IS
  'SUPPLIER/BRAND : NULL. FAMILY : code famille (pri_code_fam_nu, ex. NU17). SUBFAMILY : code sous-famille (pri_code_sfam_nu, ex. 1738).';

CREATE OR REPLACE FUNCTION public.supplier_price_condition_put(
  p_supplier_id    text,
  p_brand_pm_id    text,
  p_scope_level    text,
  p_scope_code     text,
  p_effective_from timestamptz,
  p_effective_to   timestamptz,
  p_remise_pct     numeric,
  p_marge_pct      numeric,
  p_change_reason  text,
  p_by             text
) RETURNS TABLE (rule_id bigint, rule_version bigint, replaced_id bigint)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_id  bigint;
  v_version bigint;
  v_id      bigint;
BEGIN
  IF p_supplier_id IS NULL OR p_by IS NULL OR btrim(p_by) = '' THEN
    RAISE EXCEPTION 'supplier_price_condition_put: fournisseur et auteur requis'
      USING ERRCODE = '22023';
  END IF;

  -- Écritures d'un même fournisseur l'une après l'autre (libéré en fin de tx).
  PERFORM pg_advisory_xact_lock(
    hashtextextended('supplier_price_condition|' || p_supplier_id, 0)
  );

  SELECT p.id INTO v_old_id
  FROM public.supplier_price_profiles p
  WHERE p.supplier_id = p_supplier_id
    AND p.profile_kind = 'condition'
    AND p.active
    AND p.brand_pm_id IS NOT DISTINCT FROM p_brand_pm_id
    AND p.scope_level = p_scope_level
    AND p.scope_code IS NOT DISTINCT FROM p_scope_code
    AND p.effective_from IS NOT DISTINCT FROM p_effective_from
    AND p.effective_to IS NOT DISTINCT FROM p_effective_to
  FOR UPDATE;

  SELECT coalesce(max(p.version), 0) + 1 INTO v_version
  FROM public.supplier_price_profiles p
  WHERE p.supplier_id = p_supplier_id
    AND p.profile_kind = 'condition'
    AND p.brand_pm_id IS NOT DISTINCT FROM p_brand_pm_id
    AND p.scope_level = p_scope_level
    AND p.scope_code IS NOT DISTINCT FROM p_scope_code
    AND p.effective_from IS NOT DISTINCT FROM p_effective_from
    AND p.effective_to IS NOT DISTINCT FROM p_effective_to;

  IF v_old_id IS NOT NULL THEN
    UPDATE public.supplier_price_profiles
    SET active = false, retired_at = now(), retired_by = p_by
    WHERE id = v_old_id;
  END IF;

  INSERT INTO public.supplier_price_profiles (
    supplier_id, profile_kind, scope_level, scope_code, brand_pm_id,
    default_remise_pct, default_marge_pct, effective_from, effective_to,
    version, active, created_by, change_reason
  ) VALUES (
    p_supplier_id, 'condition', p_scope_level, p_scope_code, p_brand_pm_id,
    p_remise_pct, p_marge_pct, p_effective_from, p_effective_to,
    v_version, true, p_by, p_change_reason
  )
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, v_version, v_old_id;
END;
$$;

REVOKE ALL ON FUNCTION public.supplier_price_condition_put(
  text, text, text, text, timestamptz, timestamptz, numeric, numeric, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supplier_price_condition_put(
  text, text, text, text, timestamptz, timestamptz, numeric, numeric, text, text
) TO service_role;

COMMENT ON FUNCTION public.supplier_price_condition_put(
  text, text, text, text, timestamptz, timestamptz, numeric, numeric, text, text
) IS
  'Pose ou remplace une condition commerciale (profile_kind condition) en une transaction : retire la version active de même clé (retired_at, retired_by) et insère la suivante. Jamais d''instant sans condition active. SECURITY INVOKER, appelée par le backend (service_role) depuis la fiche fournisseur.';
