-- =====================================================
-- Catalog Visibility Control Plane — catalog_display_quarantine (inverse of étape A)
-- Date: 2026-06-07
-- Refs: 20260607_pricing_catalog_display_activate.sql (the SIBLING this mirrors in
--         reverse — same governance, same journal, same generic rollback),
--       frontend/app/utils/stock.utils.ts:43-58 (isSellable gate this predicate is the
--         EXACT inverse of: can_sell = pri_vente_ttc_n > 0 AND pri_dispo IN '1','2','3'),
--       20260118_rm_remove_stock_filter.sql (R2 listing build gates on piece_display=true
--         — piece_display IS the visibility gate; hiding a ref removes it from listings),
--       audit/nk-quarantine-dryrun-2026-06-07.md (the read-only DRY-RUN that scoped this:
--         1 925 NK visible-but-non-vendable refs, overlap=0 with the 6 431 activated).
--
-- WHY (the inverse of catalog_display_activate):
--   catalog_display_activate made the 6 431 sellable NK refs VISIBLE (piece_display
--   false -> true). Post-activation QA surfaced a PRE-EXISTING condition (NOT caused by
--   the activation): NK refs that were ALREADY piece_display = true but are NON-VENDABLE
--   (no price row with a sellable dispo). They render in R2 listings at 0 € /
--   OUT_OF_STOCK — blocked by the storefront buy-gate (isSellable requires
--   pri_vente_ttc_n > 0 AND pri_dispo IN '1','2','3'), so NOT buyable, but visually
--   present (listing-quality / conversion drag). This function HIDES exactly those refs
--   (piece_display true -> false), the mirror-image action of the activation.
--
-- WHY SET-BASED (not a passed list of ids), same as the sibling:
--   The action is uniform (true -> false) and the scope is FULLY derivable from the
--   governed DB signal — a ref is in scope iff it is brand-locked, currently visible, and
--   has NO sellable price for the brand. Deriving the scope from the DB (single source of
--   truth) is idempotent and REPEATABLE: re-running after any future tariff/TecDoc import
--   re-quarantines exactly the refs that became non-vendable again, with no external
--   artifact to drift. Empirically (audit 2026-06-07) the predicate == the 1 925 set.
--
-- SCOPE. Touches EXACTLY pieces.piece_display. NEVER touches pieces_gamme.pg_display,
--   auto_type.type_display, prices, pri_dispo, the sitemap, indexation, or any page row.
--   Gamme/véhicule visibility is out of scope (a separate, SEO-gated concern).
--   p_gamme_ids (optional) only RESTRICTS which pieces are considered (a pieces.piece_ga_id
--   row-filter, for staged per-cohort commits) — it NEVER mutates pg_display or any gamme
--   row; gamme visibility stays out of scope.
--
-- SAFETY INVARIANTS:
--   - brand-locked by p_supplier (pieces.piece_pm_id): never touches a non-brand piece;
--   - DISJOINT FROM THE ACTIVATE DOMAIN BY CONSTRUCTION. The first NOT EXISTS excludes any
--     ref that has a sellable-dispo price row (pri_dispo IN '1','2') — the exact set
--     catalog_display_activate operates on — EVEN IF that ref is mispriced (price 0/NULL).
--     A mispriced-but-sellable-dispo ref is a PRICING fix, never a display quarantine.
--     Result: this function can NEVER hide a ref the activation made (or would make)
--     visible. Verified: with this guard the eligible set is IDENTICAL to the pure
--     storefront predicate (1 925 == 1 925) and overlap with the activate domain = 0 —
--     the structural invariant equals the empirical one, no edge ref exists;
--   - GATE: only ever HIDES a ref that is BOTH currently visible AND non-vendable per the
--     storefront isSellable gate (no priced row with pri_dispo IN '1','2','3'). Priced
--     PREORDER (pri_dispo '3', pri_vente_ttc_n > 0) IS sellable -> excluded, stays visible;
--   - idempotent: only flips piece_display true -> false; already-hidden refs are not
--     re-touched; re-running is a no-op once everything non-vendable is hidden;
--   - prices, dispo, gamme, vehicle are NEVER mutated — display-only;
--   - dry-run (p_dry_run = true, the DEFAULT) computes the projection with ZERO writes,
--     using the EXACT same predicate as the commit — WITHIN a single call there is no
--     dry-run/commit divergence (same as the sibling activate).
--
-- OPERATIONAL NOTE (cross-call re-evaluation, by-design — surfaced by adversarial review):
--   A dry-run and a LATER commit are SEPARATE transactions (the temp table is
--   ON COMMIT DROP, not a frozen id list), so the commit RE-EVALUATES the predicate at
--   commit time. This is intentional and SAFE-by-construction: the commit can never hide
--   a ref that is sellable AT COMMIT TIME. If an NK price/dispo import runs between the
--   dry-run and the commit, the committed count may differ from the preview — the
--   AUTHORITATIVE count is the commit's returned `hidden`, and the journal is always exact.
--   Commit promptly after the dry-run (or pause NK imports for the window) to keep the
--   preview and the commit aligned. Mirrors catalog_display_activate's behaviour exactly.
--
-- REVERSIBILITY. Each flip is journaled in pieces_display_history (old_display = true ->
--   new_display = false) under the run's batch_id. The EXISTING generic
--   catalog_display_rollback_batch(batch_id, supplier) restores the prior piece_display
--   for the whole batch, brand-locked — it restores old_display, so it reverses BOTH
--   directions (activation and quarantine). NO new rollback code is needed.
--
-- ADDITIF. Idempotent (CREATE OR REPLACE). Forward-only. NOT applied to the shared DB
-- here — governed apply step is owner-gated. SECURITY INVOKER (service-role caller
-- bypasses RLS). No explicit BEGIN/COMMIT (squawk assume_in_transaction=true).
--
-- DEPENDENCY. pieces_display_history (the shared journal) and
-- catalog_display_rollback_batch (the shared rollback) are created by the sibling
-- migration 20260607_pricing_catalog_display_activate.sql, which sorts BEFORE this one
-- ("activate" < "quarantine") and therefore runs first. This migration deliberately does
-- NOT redeclare them (no schema duplication) — it only adds the inverse function.
-- =====================================================

set lock_timeout = '2s';
set statement_timeout = '120s';

-- ── Quarantine: piece_display true -> false, set-based, dry-run-capable, gated ───────
CREATE OR REPLACE FUNCTION catalog_display_quarantine(
  p_batch_id  UUID,          -- governed batch (price_import_batches); required for commit
  p_supplier  TEXT,          -- pieces.piece_pm_id (brand), e.g. '3410' (NK). Brand-lock.
  p_operator  TEXT,
  p_dry_run   BOOLEAN DEFAULT true,   -- safe default: project, do not write
  p_gamme_ids INTEGER[] DEFAULT NULL  -- optional cohort scope (pieces.piece_ga_id); NULL = whole brand
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_eligible BIGINT := 0;
  v_hidden   BIGINT := 0;
BEGIN
  IF p_supplier IS NULL OR p_supplier = '' THEN
    RAISE EXCEPTION 'catalog_display_quarantine: p_supplier (brand pm_id) is required';
  END IF;
  IF NOT p_dry_run AND p_batch_id IS NULL THEN
    RAISE EXCEPTION 'catalog_display_quarantine: p_batch_id is required for a commit';
  END IF;

  -- Give this run its own runtime budget, and serialize it against concurrent runs for
  -- the SAME supplier — crucially including catalog_display_activate, which shares this
  -- exact lock key (hashtext(supplier)). Activation and quarantine on the same brand can
  -- never interleave (lock released at tx end).
  PERFORM set_config('statement_timeout', '120s', true);
  PERFORM set_config('lock_timeout', '5s', true);
  PERFORM pg_advisory_xact_lock(hashtext(coalesce(p_supplier, 'catalog-display')));

  -- SINGLE SOURCE OF THE ELIGIBILITY PREDICATE (captured once, used by both dry-run and
  -- commit). Eligible = brand-locked piece, currently VISIBLE, NOT in the activate domain,
  -- and NON-VENDABLE per the storefront gate.
  CREATE TEMP TABLE _disp_quarantine_eligible ON COMMIT DROP AS
    SELECT p.piece_id, p.piece_display AS old_display
    FROM pieces p
    WHERE p.piece_pm_id::text = p_supplier   -- brand-lock
      AND p.piece_display = true             -- only flip visible -> hidden
      -- (1) structural disjointness from catalog_display_activate: exclude ANY ref with a
      --     sellable-dispo price (pri_dispo IN '1','2'), at ANY price. Such a ref belongs
      --     to the activation domain; if mispriced, that is a pricing fix, not a hide.
      AND NOT EXISTS (
        SELECT 1 FROM pieces_price pp
        WHERE pp.pri_piece_id_i = p.piece_id
          AND pp.pri_pm_id = p_supplier
          AND pp.pri_dispo IN ('1', '2')
      )
      -- (2) storefront non-vendable: inverse of isSellable (stock.utils.ts) — no priced row
      --     with a sellable dispo. Priced PREORDER (dispo '3', price > 0) IS sellable and
      --     is therefore EXCLUDED here (stays visible).
      AND NOT EXISTS (
        SELECT 1 FROM pieces_price pp
        WHERE pp.pri_piece_id_i = p.piece_id
          AND pp.pri_pm_id = p_supplier
          AND pp.pri_dispo IN ('1', '2', '3')
          AND pp.pri_vente_ttc_n > 0
      )
      -- (3) optional cohort scope. NULL = the whole brand (all candidate refs). When the
      --     owner passes a gamme-id list (pieces.piece_ga_id), the action is restricted to
      --     those gammes — this only NARROWS the set, so every safety invariant above
      --     (brand-lock, activate-domain disjointness, storefront non-vendability,
      --     reversibility) holds unchanged on the subset. Enables staged commits
      --     (e.g. pure-dead gammes first, then mixed) with clean per-batch rollback.
      AND (p_gamme_ids IS NULL OR p.piece_ga_id = ANY(p_gamme_ids));

  SELECT count(*) INTO v_eligible FROM _disp_quarantine_eligible;

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true, 'supplier', p_supplier, 'eligible', v_eligible,
      'gamme_ids', p_gamme_ids
    );
  END IF;

  -- Journal (true -> false) so the generic rollback restores the prior value.
  INSERT INTO pieces_display_history (batch_id, piece_id, pm_id, old_display, new_display, operator)
  SELECT p_batch_id, piece_id, p_supplier, old_display, false, p_operator
  FROM _disp_quarantine_eligible;

  -- Quarantine: piece_display ONLY. Never touches gamme/vehicle/price/dispo.
  UPDATE pieces SET piece_display = false
  WHERE piece_id IN (SELECT piece_id FROM _disp_quarantine_eligible);
  GET DIAGNOSTICS v_hidden = ROW_COUNT;

  RETURN jsonb_build_object(
    'dry_run', false, 'supplier', p_supplier, 'batch_id', p_batch_id,
    'eligible', v_eligible, 'hidden', v_hidden, 'gamme_ids', p_gamme_ids
  );
END;
$$;

COMMENT ON FUNCTION catalog_display_quarantine(UUID, TEXT, TEXT, BOOLEAN, INTEGER[]) IS
  'Catalog visibility quarantine (inverse of catalog_display_activate): flips pieces.piece_display true -> false for brand-locked refs that are currently visible AND non-vendable per the storefront isSellable gate (no pieces_price row with pri_dispo IN 1,2,3 AND pri_vente_ttc_n > 0). Structurally disjoint from the activate domain (excludes any pri_dispo IN 1,2 ref). Optional p_gamme_ids (pieces.piece_ga_id) narrows the action to a cohort for staged commits (NULL = whole brand). Set-based + idempotent. p_dry_run=true (default) projects without writing. Never touches gamme/vehicle/price/dispo. Journals to pieces_display_history; reverse with catalog_display_rollback_batch. Owner-gated.';
