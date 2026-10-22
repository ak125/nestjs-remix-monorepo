-- =============================================================================
-- Migration : ___xtr_customer — consentement marketing (ADR-036) + parcours d'origine
-- Date      : 2026-10-19
-- Severity  : LOW (additif pur, colonnes NULLABLE sans DEFAULT)
-- Canon     : ADR-036 (governance-vault) — `marketing_consent_at` canonique
-- =============================================================================
--
-- PURPOSE
-- -------
-- 20260430_marketing_layer_phase1 déclare cst_marketing_consent_at mais n'a
-- jamais été exécutée sur cette base : le ledger la porte `applied` avec le
-- runner `baseline-2026-05-16` (adoption du moteur : fichiers marqués appliqués
-- sans exécution) et la colonne est absente (vérifié le 2026-10-19). Forward-
-- only : la correction est cette migration, limitée au consentement — les deux
-- tables marketing de phase1 restent hors périmètre.
--
--   * cst_marketing_consent_at     instant du consentement explicite ;
--                                  NULL = aucun consentement.
--   * cst_marketing_consent_source parcours où il a été donné :
--                                  'register' (case de l'inscription) ou
--                                  'account_settings' (page Paramètres).
--                                  Le libellé affiché à cette date est
--                                  versionné dans le code de ce parcours.
--   Les deux sont posées ou retirées ensemble (contrainte de cohérence).
--   Backfill = NULL : le consentement n'est pas rétroactif.
--
-- Pas d'index : les lectures prévues passent par cst_id. L'index partiel
-- d'ADR-036 (requêtes de segment) viendra avec la première requête de segment,
-- en CREATE INDEX CONCURRENTLY dans un fichier @non_transactional.
--
-- IDEMPOTENCE / SÛRETÉ
-- --------------------
--   * ADD COLUMN IF NOT EXISTS ; contraintes recréées (DROP IF EXISTS + ADD) —
--     ré-exécution = no-op. Bloc $precheck$ : refuse un état antérieur partiel,
--     d'un autre type ou avec des lignes hors contrat.
--   * Colonnes NULLABLE sans DEFAULT → métadonnée pure, pas de réécriture.
--   * Contraintes posées NOT VALID, sans VALIDATE : elles s'appliquent à
--     tout INSERT/UPDATE, et les lignes existantes valent (NULL, NULL) par
--     construction (colonnes créées ici), ce qui les satisfait. Un VALIDATE
--     dans la même transaction que l'ADD COLUMN (ACCESS EXCLUSIVE tenu jusqu'au
--     COMMIT) bloquerait les lectures pendant le parcours (squawk
--     constraint-missing-not-valid) sans rien prouver de plus.
--   * Transaction gérée par le runner (.squawk.toml : assume_in_transaction).
--   * Grants table-level existants (service_role, postgres) : couvrent les
--     nouvelles colonnes, aucun GRANT ajouté.
--
-- ROLLBACK (documentation seule — NON exécuté) : 20261019_customer_marketing_consent.down.sql
-- =============================================================================

SET LOCAL lock_timeout      = '5s';
SET LOCAL statement_timeout = '60s';

-- Pré-condition (lecture seule, rejouée par apply-migration.sh avant le moteur).
-- ADD COLUMN IF NOT EXISTS ignorerait sans bruit une colonne déjà là sous une
-- autre forme, et les CHECK NOT VALID ne relisent pas l'existant : on refuse
-- donc tout état antérieur qui ne serait pas exactement celui que pose ce fichier.
DO $precheck$
DECLARE
  n_cols   int;
  bad_type text;
  bad_rows bigint;
BEGIN
  SELECT count(*),
         string_agg(column_name || ' ' || data_type, ', ')
           FILTER (WHERE (column_name = 'cst_marketing_consent_at'
                          AND data_type <> 'timestamp with time zone')
                      OR (column_name = 'cst_marketing_consent_source'
                          AND data_type <> 'text'))
    INTO n_cols, bad_type
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name   = '___xtr_customer'
     AND column_name IN ('cst_marketing_consent_at', 'cst_marketing_consent_source');

  IF n_cols = 1 THEN
    RAISE EXCEPTION 'ABORT: une seule des deux colonnes de consentement existe (état partiel)';
  END IF;
  IF bad_type IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT: colonne de consentement déjà présente avec un autre type (%)', bad_type;
  END IF;
  IF n_cols = 2 THEN
    EXECUTE $q$
      SELECT count(*) FROM public.___xtr_customer
       WHERE (cst_marketing_consent_at IS NULL) <> (cst_marketing_consent_source IS NULL)
          OR cst_marketing_consent_source NOT IN ('register', 'account_settings')
    $q$ INTO bad_rows;
    IF bad_rows > 0 THEN
      RAISE EXCEPTION 'ABORT: % ligne(s) de consentement hors contrat (paire ou source)', bad_rows;
    END IF;
  END IF;
END
$precheck$;

ALTER TABLE public.___xtr_customer
  ADD COLUMN IF NOT EXISTS cst_marketing_consent_at     timestamptz NULL,
  ADD COLUMN IF NOT EXISTS cst_marketing_consent_source text        NULL;

ALTER TABLE public.___xtr_customer
  DROP CONSTRAINT IF EXISTS ___xtr_customer_marketing_consent_source_check;
ALTER TABLE public.___xtr_customer
  ADD CONSTRAINT ___xtr_customer_marketing_consent_source_check
  CHECK (cst_marketing_consent_source IN ('register', 'account_settings'))
  NOT VALID;

ALTER TABLE public.___xtr_customer
  DROP CONSTRAINT IF EXISTS ___xtr_customer_marketing_consent_pair_check;
ALTER TABLE public.___xtr_customer
  ADD CONSTRAINT ___xtr_customer_marketing_consent_pair_check
  CHECK ((cst_marketing_consent_at IS NULL) = (cst_marketing_consent_source IS NULL))
  NOT VALID;

COMMENT ON COLUMN public.___xtr_customer.cst_marketing_consent_at IS
  'ADR-036 — instant du consentement marketing explicite. NULL = aucun consentement : '
  'exclu de toute relance et de tout segment marketing. Non rétroactif (backfill NULL).';
COMMENT ON COLUMN public.___xtr_customer.cst_marketing_consent_source IS
  'Parcours où le consentement a été donné (register | account_settings). '
  'Posé et retiré avec cst_marketing_consent_at.';

-- =============================================================================
-- End of migration.
-- =============================================================================
