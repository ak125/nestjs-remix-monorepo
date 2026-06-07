-- =====================================================
-- Catalog model — catalog_accessory_link (accessory gamme -> main gamme, commercial link)
-- Date: 2026-06-07
-- Refs: 20260607_pricing_catalog_gamme_display_activate.sql (#886 — governance calque:
--         dry-run/commit/journal/rollback, owner-gated),
--       audit/accessories-under-main-gamme-model-2026-06-07.md (the design this implements),
--       reference: étape B1 NO-GO — accessory gammes (level-4/5) are HIDDEN BY DESIGN and must
--         NEVER become standalone hubs. This is the GOVERNED alternative: surface their products
--         in the CONTEXT of the main hub via a runtime block (PR-2), driven by this internal link.
--
-- WHY (define the "accessories under main gamme" model — DATA layer only, PR-1):
--   An accessory/secondary gamme (level-4/5, e.g. 1330 "Déflecteur disque de frein", HIDDEN) is
--   commercially a sub-item of a MAIN gamme (e.g. 82 "Disque de frein", level-1). We record that
--   link in pieces_gamme.pg_parent_gamme_id (an EXISTING but 100%-empty INTEGER column) so a future
--   runtime block (PR-2, flag-gated) can list the accessory's PRODUCTS under the main hub —
--   WITHOUT promoting the accessory to a visible/indexable hub and WITHOUT changing any URL.
--
-- COLUMN SEMANTICS (documented, must never be confused):
--   - pg_parent_gamme_id  = NEW: accessory -> main COMMERCIAL link (this migration). Level-4/5 only.
--   - pg_parent (TEXT)    = legacy catalog GROUPING (family hierarchy, used by catalog-hierarchy).
--   The two are DISTINCT. This migration only writes pg_parent_gamme_id, never pg_parent.
--
-- MANDATORY GUARDS (owner, enforced in the RPC):
--   - ACCESSORY must STAY HIDDEN: pg_level IN ('4','5') AND pg_display='0' AND pg_relfollow='0'
--     AND pg_sitemap='0'. A non-hidden / non-accessory ref is REJECTED (never linked).
--   - PARENT must be a VALID VISIBLE STRATEGIC HUB: pg_level IN ('1','2') AND pg_display='1'
--     AND pg_relfollow='1'. Otherwise the call HARD-FAILS (prevents linking an accessory to a
--     hidden sub-gamme or a non-strategic gamme).
--
-- SCOPE. Writes EXACTLY pieces_gamme.pg_parent_gamme_id (+ the append-only journal). NEVER touches
--   pg_display / pg_relfollow / pg_sitemap / pg_parent / pg_name* / piece_ga_id / rtp_pg_id / any
--   URL / any product. The accessory stays HIDDEN; nothing becomes indexable; no URL changes.
--
-- ADDITIF. Idempotent (CREATE OR REPLACE / IF NOT EXISTS; re-link of an already-linked accessory
--   is a no-op). Forward-only. NOT applied here — apply is owner-gated. No explicit BEGIN/COMMIT
--   (squawk assume_in_transaction=true). SECURITY INVOKER.
--
-- REVERSIBILITY. Each link is journaled in pieces_gamme_link_history (old_parent -> new_parent).
--   catalog_accessory_link_rollback_batch(batch_id) restores the prior pg_parent_gamme_id for the
--   batch, with an anti-conflict guard (only where the current value still equals what the batch
--   wrote). UNIQUE(batch_id, accessory_pg_id) prevents double-counting.
--
-- RLS: pieces_gamme_link_history is RLS-disabled, mirroring its sibling governed audit tables
--   (pieces_gamme_display_history, pieces_display_history). Service-role-only internal journal.
-- =====================================================

-- squawk-ignore-file prefer-bigint-over-int
--   accessory_pg_id / old_parent / new_parent INTENTIONALLY mirror pieces_gamme.pg_id, which is
--   integer (int4) in the live schema. Matching int4 keeps the rollback join aligned with the
--   pieces_gamme int4 PK; promoting to bigint would diverge from the source column type.

set lock_timeout = '2s';
set statement_timeout = '120s';

-- Document the column semantics directly on the schema (anti-confusion with pg_parent).
COMMENT ON COLUMN pieces_gamme.pg_parent_gamme_id IS
  'Commercial link: accessory/secondary gamme (level-4/5) -> its MAIN gamme (level-1/2). Distinct from pg_parent (legacy catalog family grouping). Written ONLY by catalog_accessory_link_activate (governed). NULL = unlinked. Never gates indexation; the accessory stays hidden.';

-- ── Rollback journal (per accessory, per batch) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS pieces_gamme_link_history (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  batch_id        UUID        NOT NULL,
  accessory_pg_id INTEGER     NOT NULL,   -- the level-4/5 accessory gamme
  old_parent      INTEGER,                -- prior pg_parent_gamme_id (usually NULL) => NULLABLE
  new_parent      INTEGER     NOT NULL,   -- the main gamme (e.g. 82)
  operator        TEXT,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pieces_gamme_link_history_batch_acc
  ON pieces_gamme_link_history (batch_id, accessory_pg_id);

COMMENT ON TABLE pieces_gamme_link_history IS
  'Rollback journal for catalog_accessory_link_activate: per-accessory old/new pg_parent_gamme_id, keyed by governed batch_id. Service-role-only (RLS-off like pieces_gamme_display_history).';

-- NOTE: the read-path index on pieces_gamme(pg_parent_gamme_id) — used to look up "accessories
-- of a main gamme" — is DEFERRED to PR-2 (the runtime block that actually reads it). On the
-- existing pieces_gamme table it must be created CONCURRENTLY (require-concurrent-index-creation),
-- which cannot run inside this transactional migration; PR-2 adds it out-of-band (small table,
-- ~9.7k rows). PR-1 only WRITES pg_parent_gamme_id (UPDATE by pg_id PK), so no index is needed here.

-- ── Link: pg_parent_gamme_id <- main, set-based, guarded, dry-run-capable, gated ────
CREATE OR REPLACE FUNCTION catalog_accessory_link_activate(
  p_batch_id        UUID,           -- governed batch (service-generated); required for commit
  p_main_pg_id      INTEGER,        -- the MAIN gamme (must be a valid visible strategic hub)
  p_accessory_pg_ids INTEGER[],     -- the accessory gammes to link (level-4/5, hidden)
  p_operator        TEXT,
  p_dry_run         BOOLEAN DEFAULT true
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_eligible BIGINT := 0;
  v_linked   BIGINT := 0;
  v_elig     JSONB;
  v_rejected JSONB;
BEGIN
  IF p_main_pg_id IS NULL THEN
    RAISE EXCEPTION 'catalog_accessory_link_activate: p_main_pg_id is required';
  END IF;
  IF p_accessory_pg_ids IS NULL OR array_length(p_accessory_pg_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'catalog_accessory_link_activate: p_accessory_pg_ids must be a non-empty array';
  END IF;
  IF NOT p_dry_run AND p_batch_id IS NULL THEN
    RAISE EXCEPTION 'catalog_accessory_link_activate: p_batch_id is required for a commit';
  END IF;

  PERFORM set_config('statement_timeout', '120s', true);
  PERFORM set_config('lock_timeout', '5s', true);
  PERFORM pg_advisory_xact_lock(hashtext('catalog-accessory-link'));

  -- PARENT GUARD (hard-fail): main must be a valid VISIBLE STRATEGIC hub.
  IF NOT EXISTS (
    SELECT 1 FROM pieces_gamme
    WHERE pg_id = p_main_pg_id
      AND pg_level IN ('1', '2')
      AND pg_display = '1'
      AND pg_relfollow = '1'
  ) THEN
    RAISE EXCEPTION
      'catalog_accessory_link_activate: parent gamme % is not a valid visible strategic hub (require pg_level IN (1,2) AND pg_display=1 AND pg_relfollow=1)',
      p_main_pg_id;
  END IF;

  -- ELIGIBLE accessories (single source for dry-run + commit). ACCESSORY GUARD: level-4/5 AND
  -- fully hidden, and not already linked to this main (idempotent).
  CREATE TEMP TABLE _acc_eligible ON COMMIT DROP AS
    SELECT g.pg_id, g.pg_parent_gamme_id AS old_parent
    FROM pieces_gamme g
    WHERE g.pg_id = ANY(p_accessory_pg_ids)
      AND g.pg_level IN ('4', '5')
      AND g.pg_display = '0'
      AND coalesce(g.pg_relfollow, '0') = '0'
      AND coalesce(g.pg_sitemap, '0') = '0'
      AND g.pg_parent_gamme_id IS DISTINCT FROM p_main_pg_id;

  SELECT count(*) INTO v_eligible FROM _acc_eligible;

  SELECT coalesce(jsonb_agg(jsonb_build_object('pg_id', e.pg_id, 'pg_name', g.pg_name) ORDER BY e.pg_id), '[]'::jsonb)
    INTO v_elig
    FROM _acc_eligible e JOIN pieces_gamme g ON g.pg_id = e.pg_id;

  -- REJECTED requested ids (not eligible), with a precise reason for observability.
  SELECT coalesce(jsonb_agg(jsonb_build_object('pg_id', r.pg_id, 'reason', r.reason) ORDER BY r.pg_id), '[]'::jsonb)
    INTO v_rejected
    FROM (
      SELECT req.pg_id,
        CASE
          WHEN g.pg_id IS NULL THEN 'not_found'
          WHEN g.pg_level NOT IN ('4', '5') THEN 'not_level_4_5'
          WHEN g.pg_display <> '0' OR coalesce(g.pg_relfollow, '0') <> '0'
               OR coalesce(g.pg_sitemap, '0') <> '0' THEN 'not_hidden'
          WHEN g.pg_parent_gamme_id = p_main_pg_id THEN 'already_linked'
          ELSE 'other'
        END AS reason
      FROM unnest(p_accessory_pg_ids) AS req(pg_id)
      LEFT JOIN pieces_gamme g ON g.pg_id = req.pg_id
      WHERE NOT EXISTS (SELECT 1 FROM _acc_eligible e WHERE e.pg_id = req.pg_id)
    ) r;

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true, 'main_pg_id', p_main_pg_id,
      'eligible_count', v_eligible, 'eligible', v_elig,
      'rejected_count', jsonb_array_length(v_rejected), 'rejected', v_rejected
    );
  END IF;

  -- Journal (old_parent -> new_parent=main) so rollback restores the prior value.
  INSERT INTO pieces_gamme_link_history (batch_id, accessory_pg_id, old_parent, new_parent, operator)
  SELECT p_batch_id, pg_id, old_parent, p_main_pg_id, p_operator
  FROM _acc_eligible;

  -- Link: pg_parent_gamme_id ONLY. Never touches display/relfollow/sitemap/pg_parent/URL/product.
  UPDATE pieces_gamme SET pg_parent_gamme_id = p_main_pg_id
  WHERE pg_id IN (SELECT pg_id FROM _acc_eligible);
  GET DIAGNOSTICS v_linked = ROW_COUNT;

  RETURN jsonb_build_object(
    'dry_run', false, 'batch_id', p_batch_id, 'main_pg_id', p_main_pg_id,
    'linked', v_linked, 'eligible_count', v_eligible,
    'rejected_count', jsonb_array_length(v_rejected), 'rejected', v_rejected
  );
END;
$$;

COMMENT ON FUNCTION catalog_accessory_link_activate(UUID, INTEGER, INTEGER[], TEXT, BOOLEAN) IS
  'Governed accessory->main commercial link (data layer). Writes pieces_gamme.pg_parent_gamme_id for hidden level-4/5 accessories under a valid visible strategic main hub. HARD GUARDS: parent must be pg_level IN (1,2) AND pg_display=1 AND pg_relfollow=1; accessory must be level-4/5 AND pg_display=0 AND pg_relfollow=0 AND pg_sitemap=0 (else rejected). Idempotent. p_dry_run=true (default) projects eligible/rejected without writing. Never touches display/sitemap/URL/product — the accessory stays hidden. Journals to pieces_gamme_link_history; reverse with catalog_accessory_link_rollback_batch. Owner-gated.';

-- ── Rollback: restore prior pg_parent_gamme_id for a batch, with anti-conflict guard ─
CREATE OR REPLACE FUNCTION catalog_accessory_link_rollback_batch(
  p_batch_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_rolled_back     BIGINT := 0;
  v_skipped_changed BIGINT := 0;
  v_skipped_missing BIGINT := 0;
BEGIN
  IF p_batch_id IS NULL THEN
    RAISE EXCEPTION 'catalog_accessory_link_rollback_batch: p_batch_id is required';
  END IF;

  PERFORM set_config('statement_timeout', '120s', true);
  PERFORM set_config('lock_timeout', '5s', true);
  PERFORM pg_advisory_xact_lock(hashtext('catalog-accessory-link'));

  -- Classify BEFORE restoring (explicit LEFT JOIN, never by subtraction).
  SELECT
    count(*) FILTER (WHERE g.pg_id IS NOT NULL AND g.pg_parent_gamme_id IS DISTINCT FROM h.new_parent),
    count(*) FILTER (WHERE g.pg_id IS NULL)
  INTO v_skipped_changed, v_skipped_missing
  FROM pieces_gamme_link_history h
  LEFT JOIN pieces_gamme g ON g.pg_id = h.accessory_pg_id
  WHERE h.batch_id = p_batch_id;

  -- Restore ONLY where the current value still equals what this batch wrote (anti-conflict).
  UPDATE pieces_gamme g SET pg_parent_gamme_id = h.old_parent
  FROM pieces_gamme_link_history h
  WHERE h.batch_id = p_batch_id
    AND g.pg_id = h.accessory_pg_id
    AND g.pg_parent_gamme_id IS NOT DISTINCT FROM h.new_parent;
  GET DIAGNOSTICS v_rolled_back = ROW_COUNT;

  RETURN jsonb_build_object(
    'rolled_back', v_rolled_back,
    'skipped_value_changed', v_skipped_changed,
    'skipped_missing_gamme', v_skipped_missing,
    'batch_id', p_batch_id
  );
END;
$$;

COMMENT ON FUNCTION catalog_accessory_link_rollback_batch(UUID) IS
  'Reverses catalog_accessory_link_activate: restores pieces_gamme.pg_parent_gamme_id to its journaled old value for the batch, ONLY where the current value still equals what the batch wrote (anti-conflict guard). Returns rolled_back + skipped_value_changed + skipped_missing_gamme.';
