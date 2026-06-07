-- =====================================================
-- Catalog Visibility Control Plane — catalog_gamme_display_activate (étape B1: gamme hub)
-- Date: 2026-06-07
-- Refs: 20260607_pricing_catalog_display_activate.sql (#880 — the piece_display sibling this
--         mirrors at the GAMME level: same governance, dry-run, journal, owner gate),
--       audit/nk-etape-b-vehicle-deferral-2026-06-07.md (B2 vehicle deferral),
--       seo-indexability-policy.service.ts (runtime indexability authority — NOT duplicated),
--       sitemap-v10-*.service.ts (all filter pg_relfollow='1' — proof pg_display alone is
--         out-of-sitemap).
--
-- WHY (étape B1 — surface the masked level-4 hub gamme holding already-visible sellable refs):
--   Étape A made the 6 431 sellable NK refs piece_display=true. A small tail stays invisible
--   on its gamme hub because the GAMME is masked (pg_display != '1') even though the piece is
--   visible & sellable. This flips pg_display '0'/NULL -> '1' for the LEVEL-4 hub gammes that
--   already contain >=1 brand ref visible & sellable — the gamme-blocked subset of the tail.
--
-- SCOPE CORRECTION (verified read-only 2026-06-07, owner-gated):
--   For NK ('3410') the eligibility predicate below returns EXACTLY one gamme:
--     pg_id 1330 'Déflecteur disque de frein' (level 4), 11 NK visible+sellable refs, and
--     0 collateral (its 3 407 other-brand pieces are ALL piece_display=false, so activating
--     the gamme exposes only the 11 NK refs — distinct_brands_exposed = 1).
--   The pg_level='4' filter is LOAD-BEARING: without it the predicate returns 23 gammes /
--     1 460 refs (22 level-5 sub-gammes included). Level-5 extension is DEFERRED (NO-GO) until
--     the hub-vs-listing visibility model is clarified. Gamme 2513 is NOT in scope (0 NK refs).
--   OWNER GATE (enforced at apply, from the dry-run output — NOT hardcoded here to keep the
--     function generic): commit ONLY if eligible == 1 AND gamme_ids == {1330} AND refs == 11.
--     Any other result => STOP + analyse, no commit. The function stays brand-generic; the
--     gate is the owner's dry-run check.
--
-- SCOPE. Writes EXACTLY pieces_gamme.pg_display. NEVER touches pg_relfollow, pg_sitemap,
--   auto_type.type_display, pieces.piece_display, prices, or pri_dispo. pg_relfollow/pg_sitemap
--   stay '0' => the gamme is VISIBLE (hub renders) but OUT of the sitemap (sitemap-v10-* filter
--   pg_relfollow='1') => zero indexation push. A thin hub renders noindex,follow via the runtime
--   policy (seo-indexability-policy.service.ts) — expected/correct, not duplicated as a pre-gate.
--
-- SAFETY INVARIANTS:
--   - brand-locked by p_supplier on the piece existence check; the gamme set is derived from it;
--   - level-4 ONLY (hub level) — set-based scope fully derived from the governed DB signal;
--   - idempotent: only flips pg_display -> '1' for currently-masked gammes; re-run is a no-op;
--   - pg_relfollow/pg_sitemap/type_display/piece_display/price NEVER mutated (the journal even
--     snapshots old_relfollow/old_sitemap as proof they are untouched);
--   - dry-run (p_dry_run=true, DEFAULT) computes the projection with ZERO writes, same predicate
--     as the commit (within a call). Cross-call re-evaluation is by-design (same note as #880).
--
-- REVERSIBILITY. Each flip is journaled in pieces_gamme_display_history (old_display ->
--   new_display='1', + control snapshot). catalog_gamme_display_rollback_batch restores
--   pg_display to old_display for the batch, WITH AN ANTI-CONFLICT GUARD (only restores a gamme
--   whose current pg_display still equals what this batch wrote — never clobbers a later change).
--
-- ADDITIF. Idempotent (CREATE OR REPLACE / ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT
-- EXISTS). Forward-only. NOT applied here — apply is owner-gated. No explicit BEGIN/COMMIT
-- (squawk assume_in_transaction=true). SECURITY INVOKER (service-role caller bypasses RLS).
--
-- RLS: pieces_gamme_display_history is RLS-disabled, mirroring its sibling governed audit
-- tables (pieces_display_history, pieces_price_history, price_import_batches are all RLS-off).
-- Service-role-only internal rollback journal; no anon/frontend read path.
-- =====================================================

-- squawk-ignore-file prefer-bigint-over-int
--   pieces_gamme_display_history.pg_id INTENTIONALLY mirrors pieces_gamme.pg_id, which is
--   integer (int4) in the live schema. Matching int4 keeps the rollback join
--   (pieces_gamme g JOIN pieces_gamme_display_history h ON g.pg_id = h.pg_id) aligned with the
--   pieces_gamme int4 PK. Promoting to bigint would diverge from the source column type.

set lock_timeout = '2s';
set statement_timeout = '120s';

-- ── Self-describing operation marker on the shared batch table (additive, nullable) ─────
--   Legacy rows = NULL (zero backfill). The B1 batch carries operation='GAMME_DISPLAY_ACTIVATION'
--   so audits distinguish it from the piece_display / dispo activations (same supplier, same
--   cycle, same price_import_batches table). The dedicated journal already distinguishes by
--   table; this column distinguishes inside the shared batch table.
ALTER TABLE price_import_batches ADD COLUMN IF NOT EXISTS operation TEXT;

COMMENT ON COLUMN price_import_batches.operation IS
  'Self-describing op kind for a governed batch (e.g. GAMME_DISPLAY_ACTIVATION). NULL = legacy / unspecified. Additive marker; never drives logic, only audit/observability.';

-- ── Rollback journal (per gamme, per batch; + control snapshot of relfollow/sitemap) ────
CREATE TABLE IF NOT EXISTS pieces_gamme_display_history (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  batch_id      UUID        NOT NULL,
  pg_id         INTEGER     NOT NULL,   -- mirrors pieces_gamme.pg_id (int4) — see squawk note
  pm_id         TEXT        NOT NULL,   -- brand (p_supplier), e.g. '3410' (NK)
  old_display   TEXT,                   -- pg_display can be NULL (not only '0') => NULLABLE
  new_display   TEXT        NOT NULL,
  old_relfollow TEXT,                   -- control snapshot (NOT modified) — proof of non-touch
  old_sitemap   TEXT,                   -- control snapshot (NOT modified) — proof of non-touch
  operator      TEXT,
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- UNIQUE on (batch_id, pg_id): exactly one journal row per gamme per batch. Prevents a
-- reused batch_id from double-journaling (which would corrupt the rollback skipped-count).
-- Also serves batch_id lookups via the leftmost-prefix, so no separate batch index is needed.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pieces_gamme_display_history_batch_pg
  ON pieces_gamme_display_history (batch_id, pg_id);

COMMENT ON TABLE pieces_gamme_display_history IS
  'Rollback journal for catalog_gamme_display_activate: per-gamme old/new pg_display (+ control snapshot of pg_relfollow/pg_sitemap proving they are untouched), keyed by governed batch_id. Service-role-only (RLS-off like pieces_display_history).';

-- ── Gamme visibility activation: pg_display -> '1', set-based, level-4, dry-run, gated ──
CREATE OR REPLACE FUNCTION catalog_gamme_display_activate(
  p_batch_id  UUID,          -- governed batch (price_import_batches); required for commit
  p_supplier  TEXT,          -- pieces.piece_pm_id (brand), e.g. '3410' (NK). Brand-lock.
  p_operator  TEXT,
  p_dry_run   BOOLEAN DEFAULT true   -- safe default: project, do not write
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_eligible  BIGINT := 0;     -- number of GAMMES in scope (the gate's eligible)
  v_refs      BIGINT := 0;     -- NK visible+sellable refs inside those gammes (gate cross-check)
  v_displayed BIGINT := 0;     -- gammes actually flipped
  v_gamme_ids INTEGER[];
BEGIN
  IF p_supplier IS NULL OR p_supplier = '' THEN
    RAISE EXCEPTION 'catalog_gamme_display_activate: p_supplier (brand pm_id) is required';
  END IF;
  IF NOT p_dry_run AND p_batch_id IS NULL THEN
    RAISE EXCEPTION 'catalog_gamme_display_activate: p_batch_id is required for a commit';
  END IF;

  PERFORM set_config('statement_timeout', '120s', true);
  PERFORM set_config('lock_timeout', '5s', true);
  -- DISTINCT lock namespace from étape A piece_display (hashtext(supplier)) so gamme-display and
  -- piece-display ops on the SAME supplier never block each other.
  PERFORM pg_advisory_xact_lock(hashtext(p_supplier || ':gamme-display'));

  -- ELIGIBLE GAMMES (single source for dry-run + commit). A masked level-4 hub gamme that
  -- already contains >=1 brand ref visible & sellable (storefront isSellable: dispo IN
  -- '1','2','3' AND vente_ttc > 0).
  CREATE TEMP TABLE _gamme_disp_eligible ON COMMIT DROP AS
    SELECT g.pg_id,
           g.pg_display   AS old_display,
           g.pg_relfollow AS old_relfollow,
           g.pg_sitemap   AS old_sitemap
    FROM pieces_gamme g
    WHERE g.pg_display IS DISTINCT FROM '1'   -- masked (robust vs NULL, not only '0')
      AND g.pg_level = '4'                     -- indexable hub level ONLY (B1 scope; load-bearing)
      AND EXISTS (
        SELECT 1 FROM pieces p
        WHERE p.piece_ga_id = g.pg_id
          AND p.piece_pm_id::text = p_supplier
          AND p.piece_display = true
          AND EXISTS (
            SELECT 1 FROM pieces_price pp
            WHERE pp.pri_piece_id_i = p.piece_id
              AND pp.pri_pm_id = p_supplier
              AND pp.pri_dispo IN ('1', '2', '3')
              AND pp.pri_vente_ttc_n > 0
          )
      );

  SELECT count(*), array_agg(pg_id ORDER BY pg_id)
    INTO v_eligible, v_gamme_ids
    FROM _gamme_disp_eligible;

  -- Ref cross-check: NK visible+sellable pieces inside the eligible gammes (lets the owner
  -- gate on refs == 11 in addition to eligible == 1). eligible counts GAMMES, refs counts PIECES.
  SELECT count(*)
    INTO v_refs
    FROM pieces p
    JOIN _gamme_disp_eligible e ON e.pg_id = p.piece_ga_id
    WHERE p.piece_pm_id::text = p_supplier
      AND p.piece_display = true
      AND EXISTS (
        SELECT 1 FROM pieces_price pp
        WHERE pp.pri_piece_id_i = p.piece_id
          AND pp.pri_pm_id = p_supplier
          AND pp.pri_dispo IN ('1', '2', '3')
          AND pp.pri_vente_ttc_n > 0
      );

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true, 'supplier', p_supplier,
      'eligible', v_eligible, 'refs', v_refs, 'gamme_ids', coalesce(v_gamme_ids, '{}')
    );
  END IF;

  -- Journal (pg_display old -> '1') + control snapshot of relfollow/sitemap (NOT modified).
  INSERT INTO pieces_gamme_display_history
    (batch_id, pg_id, pm_id, old_display, new_display, old_relfollow, old_sitemap, operator)
  SELECT p_batch_id, pg_id, p_supplier, old_display, '1', old_relfollow, old_sitemap, p_operator
  FROM _gamme_disp_eligible;

  -- Activation: pg_display ONLY. Never touches relfollow/sitemap/type_display/piece_display/price.
  UPDATE pieces_gamme SET pg_display = '1'
  WHERE pg_id IN (SELECT pg_id FROM _gamme_disp_eligible);
  GET DIAGNOSTICS v_displayed = ROW_COUNT;

  RETURN jsonb_build_object(
    'dry_run', false, 'supplier', p_supplier, 'batch_id', p_batch_id,
    'eligible', v_eligible, 'refs', v_refs, 'displayed', v_displayed,
    'gamme_ids', coalesce(v_gamme_ids, '{}')
  );
END;
$$;

COMMENT ON FUNCTION catalog_gamme_display_activate(UUID, TEXT, TEXT, BOOLEAN) IS
  'Catalog GAMME visibility activation (étape B1): flips pieces_gamme.pg_display -> ''1'' for masked LEVEL-4 hub gammes that already contain >=1 brand ref visible & sellable. Set-based + idempotent. pg_relfollow/pg_sitemap NEVER touched (gamme stays out of sitemap). p_dry_run=true (default) projects without writing; returns eligible(gammes)/refs(pieces)/gamme_ids for the owner gate (NK expected: eligible=1, gamme_ids={1330}, refs=11). Journals to pieces_gamme_display_history; reverse with catalog_gamme_display_rollback_batch. Owner-gated.';

-- ── Rollback: restore prior pg_display for a batch, with anti-conflict guard ─────────────
CREATE OR REPLACE FUNCTION catalog_gamme_display_rollback_batch(
  p_batch_id UUID,
  p_supplier TEXT
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_rolled_back           BIGINT := 0;
  v_skipped_value_changed BIGINT := 0;   -- gamme still exists but pg_display was changed since
  v_skipped_missing_gamme BIGINT := 0;   -- journaled gamme no longer exists (deleted upstream)
BEGIN
  IF p_batch_id IS NULL OR p_supplier IS NULL THEN
    RAISE EXCEPTION 'catalog_gamme_display_rollback_batch: p_batch_id and p_supplier are required';
  END IF;

  PERFORM set_config('statement_timeout', '120s', true);
  PERFORM set_config('lock_timeout', '5s', true);
  PERFORM pg_advisory_xact_lock(hashtext(p_supplier || ':gamme-display'));

  -- Classify the journaled rows BEFORE restoring (so just-restored rows are never mislabelled),
  -- by EXPLICIT LEFT JOIN — NOT by (total - rolled_back) subtraction, which conflated a deleted
  -- gamme with a value-conflict and mis-counted on a reused batch_id.
  SELECT
    count(*) FILTER (WHERE g.pg_id IS NOT NULL AND g.pg_display IS DISTINCT FROM h.new_display),
    count(*) FILTER (WHERE g.pg_id IS NULL)
  INTO v_skipped_value_changed, v_skipped_missing_gamme
  FROM pieces_gamme_display_history h
  LEFT JOIN pieces_gamme g ON g.pg_id = h.pg_id
  WHERE h.batch_id = p_batch_id AND h.pm_id = p_supplier;

  -- Restore ONLY gammes whose CURRENT pg_display still equals what this batch wrote
  -- (new_display). If a later human/process changed it, skip — never clobber a newer state.
  UPDATE pieces_gamme g SET pg_display = h.old_display
  FROM pieces_gamme_display_history h
  WHERE h.batch_id   = p_batch_id
    AND h.pm_id      = p_supplier
    AND g.pg_id      = h.pg_id
    AND g.pg_display IS NOT DISTINCT FROM h.new_display;   -- anti-conflict guard
  GET DIAGNOSTICS v_rolled_back = ROW_COUNT;

  RETURN jsonb_build_object(
    'rolled_back', v_rolled_back,
    'skipped_value_changed', v_skipped_value_changed,
    'skipped_missing_gamme', v_skipped_missing_gamme,
    'batch_id', p_batch_id
  );
END;
$$;

COMMENT ON FUNCTION catalog_gamme_display_rollback_batch(UUID, TEXT) IS
  'Reverses catalog_gamme_display_activate: restores pieces_gamme.pg_display to its journaled old value for the batch, brand-locked, ONLY where the current pg_display still equals what the batch wrote (anti-conflict guard — never clobbers a later change). Returns rolled_back + skipped_value_changed (a later writer changed it) + skipped_missing_gamme (gamme deleted upstream), classified by explicit LEFT JOIN (not subtraction); UNIQUE(batch_id,pg_id) prevents double-counting.';
