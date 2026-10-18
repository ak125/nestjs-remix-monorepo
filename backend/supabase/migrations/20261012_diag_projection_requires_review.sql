-- =============================================================================
-- Migration : seule une relation relue est projetée (provenance diagnostic)
-- Date      : 2026-10-12
-- Severity  : LOW (2 contraintes CHECK sur des tables vides ; aucune ligne
--             écrite, aucune fonction modifiée)
-- Scope     : public.__diag_projection_conflicts (raison `not_reviewed`),
--             public.__diag_link_provenance (CHECK (reviewed))
-- Refs      : ADR-115 D1, D3 (governance-vault), qui amende ADR-035 D2 et D7 ;
--             migration 20261010_diag_link_provenance.sql.
-- =============================================================================
--
-- Risk before this migration
-- --------------------------
-- Une relation dont toutes les sources sont prouvées dans RAW est projetée même
-- si aucun humain ne l'a relue (`evidence.reviewed: false`) : le lien passe pour
-- documenté sur la seule foi de la machine. Mesure de D6.1 (ADR-115 D2), WIKI
-- 88017732 : 2 relations de filtre-a-huile (liens 112 et 152) dans ce cas.
--
-- Backend impact
-- --------------
-- Le resolver (DiagnosticProjectionModule) classe désormais une relation
-- prouvée mais non relue en conflit `not_reviewed`, évalué en dernier : cette
-- raison doit être admise par le CHECK de __diag_projection_conflicts, sinon
-- l'apply échoue en base. Le writer ne modifie jamais `reviewed` (ADR-035 D2).
-- Drapeau DIAGNOSTIC_PROJECTION_ENABLED OFF : aucun run n'écrit ces tables.
--
-- Strategy
-- --------
-- ADR-115 D3 : l'interdiction de projeter une relation non relue est portée par
-- la base, pas par une convention. CHECK (reviewed) sur __diag_link_provenance :
-- __diag_projection_apply recopie `reviewed` tel quel, donc un payload qui
-- contournerait le resolver fait échouer le run entier (atomique).
--
-- Aucune exemption squawk (2.52.1, .squawk.toml de la CI) :
--   * ADD CONSTRAINT sans NOT VALID : constraint-missing-not-valid, « By default
--     new constraints require a table scan and block writes to the table while
--     that scan occurs » ;
--   * NOT VALID puis VALIDATE CONSTRAINT dans ce fichier : constraint-missing-not-
--     valid, « Using NOT VALID and VALIDATE CONSTRAINT in the same transaction
--     will block all reads while the constraint is validated ».
-- D'où la convention du dépôt (20260528_xtr_msg_crm_v0,
-- 20260523_001_create_order_history, 20260520_order_landing_attribution) :
-- DROP CONSTRAINT IF EXISTS puis ADD CONSTRAINT ... NOT VALID. Les nouvelles
-- écritures sont contrôlées dès le COMMIT ; les lignes déjà présentes ne le sont
-- pas par PostgreSQL. La garde finale les contrôle à la place de VALIDATE.
--
-- Garde finale ($postcheck$), fail-closed : la migration échoue, donc rien n'est
-- appliqué, si
--   * la colonne `reason` ou la colonne `reviewed` porte un autre CHECK que celui
--     posé ici (un DROP IF EXISTS sur un nom faux laisserait l'ancien en place) ;
--   * une ligne existante viole l'une des deux contraintes (un retrait doux
--     réécrit la ligne : il échouerait au premier run).
-- Les deux ADD CONSTRAINT tiennent un verrou ACCESS EXCLUSIVE jusqu'au COMMIT :
-- aucune écriture concurrente ne peut s'intercaler avant la garde.
--
-- Timeouts explicites, jamais hérités du rôle (60 s pour `postgres`) ; les deux
-- tables sont vides au 2026-10-12 (lecture seule).
-- =============================================================================

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- ── 1. Raison `not_reviewed` (ADR-115 D1), dernière évaluée par le resolver ──
-- Même ordre que 20261010, `not_reviewed` en fin.

ALTER TABLE public.__diag_projection_conflicts
  DROP CONSTRAINT IF EXISTS __diag_projection_conflicts_reason_check;
ALTER TABLE public.__diag_projection_conflicts
  ADD CONSTRAINT __diag_projection_conflicts_reason_check CHECK (reason IN (
    'schema_invalid', 'not_a_cause_relation', 'unknown_symptom',
    'system_mismatch', 'no_matching_link', 'ambiguous_cause',
    'duplicate_relation', 'source_not_raw_proven',
    'cause_slug_mismatch', 'vehicle_scope_unsupported',
    'not_reviewed')) NOT VALID;

-- ── 2. Seule une relation relue a une ligne de provenance (ADR-115 D3) ──────

ALTER TABLE public.__diag_link_provenance
  DROP CONSTRAINT IF EXISTS __diag_link_provenance_reviewed;
ALTER TABLE public.__diag_link_provenance
  ADD CONSTRAINT __diag_link_provenance_reviewed CHECK (reviewed) NOT VALID;

-- ── 3. Garde finale ─────────────────────────────────────────────────────────

DO $postcheck$
DECLARE
  v_reasons constant text[] := ARRAY[
    'schema_invalid', 'not_a_cause_relation', 'unknown_symptom',
    'system_mismatch', 'no_matching_link', 'ambiguous_cause',
    'duplicate_relation', 'source_not_raw_proven',
    'cause_slug_mismatch', 'vehicle_scope_unsupported',
    'not_reviewed'];
  v_expected text;
  v_found    text[];
BEGIN
  -- CHECK de la colonne `reason` : exactement celui posé en 1.
  SELECT 'CHECK ((reason = ANY (ARRAY['
         || string_agg(quote_literal(r) || '::text', ', ' ORDER BY i)
         || ']))) NOT VALID'
    INTO v_expected
    FROM unnest(v_reasons) WITH ORDINALITY AS t (r, i);
  SELECT array_agg(c.conname || ' ' || pg_catalog.pg_get_constraintdef(c.oid) ORDER BY c.conname)
    INTO v_found
    FROM pg_catalog.pg_constraint c
    JOIN pg_catalog.pg_attribute a
      ON a.attrelid = c.conrelid AND a.attname = 'reason'
   WHERE c.conrelid = 'public.__diag_projection_conflicts'::regclass
     AND c.contype = 'c'
     AND a.attnum = ANY (c.conkey);
  IF v_found IS DISTINCT FROM ARRAY['__diag_projection_conflicts_reason_check ' || v_expected] THEN
    RAISE EXCEPTION '20261012 : CHECK de __diag_projection_conflicts.reason inattendu(s) : %', v_found;
  END IF;

  -- CHECK de la colonne `reviewed` : exactement celui posé en 2.
  SELECT array_agg(c.conname || ' ' || pg_catalog.pg_get_constraintdef(c.oid) ORDER BY c.conname)
    INTO v_found
    FROM pg_catalog.pg_constraint c
    JOIN pg_catalog.pg_attribute a
      ON a.attrelid = c.conrelid AND a.attname = 'reviewed'
   WHERE c.conrelid = 'public.__diag_link_provenance'::regclass
     AND c.contype = 'c'
     AND a.attnum = ANY (c.conkey);
  IF v_found IS DISTINCT FROM ARRAY['__diag_link_provenance_reviewed CHECK (reviewed) NOT VALID'] THEN
    RAISE EXCEPTION '20261012 : CHECK de __diag_link_provenance.reviewed inattendu(s) : %', v_found;
  END IF;

  -- Lignes existantes : contrôlées ici, à la place de VALIDATE CONSTRAINT.
  IF EXISTS (SELECT 1 FROM public.__diag_link_provenance WHERE NOT reviewed) THEN
    RAISE EXCEPTION '20261012 : __diag_link_provenance porte des lignes reviewed = false (ADR-115 D1)';
  END IF;
  IF EXISTS (SELECT 1 FROM public.__diag_projection_conflicts WHERE NOT (reason = ANY (v_reasons))) THEN
    RAISE EXCEPTION '20261012 : __diag_projection_conflicts porte une raison hors vocabulaire';
  END IF;
END
$postcheck$;
