-- Backfill R3_guide → R6 (PR-B prerequisite, R3 Canon Hardening)
--
-- Context:
--   - @repo/seo-roles canon marks R3_GUIDE deprecated as output (canonical.ts:12).
--   - scripts/seo/build-keyword-clusters.ts becomes a thin consumer of canon
--     in PR-B and stops writing R3_guide buckets/values.
--   - Existing legacy rows must be canonicalised to R6 BEFORE the script change
--     ships, otherwise readers see a mix of legacy and canonical keys.
--
-- Soft deprecation per feedback_deprecate_before_rename_before_drop.md :
--   - This migration RENAMES values; constraint relaxation is deferred (T+30j).
--   - __seo_page_brief CHECK constraint (allows R3_guide) is intentionally
--     left UNTOUCHED here — drop scheduled in a follow-up after observation.
--
-- Footprint (audited 2026-05-07):
--   - __seo_keyword_cluster : 3 rows have role_keywords->'R3_guide' key
--   - __seo_page_brief      : 10 rows have page_role='R3_guide'
--
-- Reversibility:
--   - Forward: deterministic JSONB merge (no data loss; secondary lists are
--     concatenated and deduplicated, primary kept by max volume).
--   - Backward: irreversible by design (legacy R3_guide bucket is sunset).
--     Snapshot taken via supabase MCP audit query before apply (see PR desc).

BEGIN;

-- ── 1. __seo_keyword_cluster.role_keywords : merge R3_guide → R6 ─────────────
--
-- Shape per row:
--   role_keywords = {
--     R1: { primary, primary_volume, secondary[] },
--     R3_guide: { primary, primary_volume, secondary[] },  -- legacy
--     R3_conseils: { ... },
--     R4: { ... },
--     R5: { ... },
--     R6: { primary, primary_volume, secondary[] }         -- canonical
--   }
--
-- Merge strategy (deterministic):
--   - If R6 exists with non-zero primary_volume → keep R6, append R3_guide.secondary[].
--   - Else if R3_guide exists → promote R3_guide to R6 slot.
--   - Then drop R3_guide key.

UPDATE public.__seo_keyword_cluster
SET role_keywords = (
  -- Step A : compute merged R6 entry
  WITH src AS (
    SELECT
      role_keywords->'R3_guide' AS guide,
      role_keywords->'R6' AS r6
  ),
  merged AS (
    SELECT jsonb_build_object(
      'primary',
        CASE
          WHEN COALESCE((r6->>'primary_volume')::int, 0) >= COALESCE((guide->>'primary_volume')::int, 0)
            THEN r6->'primary'
          ELSE guide->'primary'
        END,
      'primary_volume',
        GREATEST(
          COALESCE((r6->>'primary_volume')::int, 0),
          COALESCE((guide->>'primary_volume')::int, 0)
        ),
      'secondary',
        COALESCE(
          (
            SELECT jsonb_agg(DISTINCT v ORDER BY v)
            FROM jsonb_array_elements_text(
              COALESCE(r6->'secondary', '[]'::jsonb) || COALESCE(guide->'secondary', '[]'::jsonb)
            ) AS v
          ),
          '[]'::jsonb
        )
    ) AS new_r6
    FROM src
  )
  -- Step B : substitute R6 + drop R3_guide
  SELECT (role_keywords - 'R3_guide') || jsonb_build_object('R6', new_r6)
  FROM merged
)
WHERE role_keywords ? 'R3_guide';

-- ── 2. __seo_page_brief.page_role : R3_guide → R6 ────────────────────────────
--
-- CHECK constraint currently allows R3_guide ; we KEEP it permissive (deprecate
-- in-place 30 days). New writes will use R6 (PR-B). Constraint tightening
-- migration scheduled separately when seo_r3_canon_violation_total = 0 / 7d.

UPDATE public.__seo_page_brief
SET page_role = 'R6'
WHERE page_role = 'R3_guide';

-- ── 3. Audit log row (provenance trail) ──────────────────────────────────────
--
-- Optional : if __seo_audit_log exists, log the backfill. We don't fail the
-- migration if the table is absent — keeps the migration portable across
-- environments (local dev DB may not have audit_log).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = '__seo_audit_log'
  ) THEN
    EXECUTE $log$
      INSERT INTO public.__seo_audit_log (event_type, source, details, created_at)
      VALUES (
        'canonicalize_r3_guide',
        'migration_20260507',
        jsonb_build_object(
          'description', 'Backfill R3_guide → R6 in keyword_cluster + page_brief',
          'cluster_rows_updated', (SELECT count(*) FROM public.__seo_keyword_cluster WHERE role_keywords ? 'R6' AND NOT (role_keywords ? 'R3_guide')),
          'brief_rows_updated', (SELECT count(*) FROM public.__seo_page_brief WHERE page_role = 'R6')
        ),
        now()
      )
    $log$;
  END IF;
END $$;

COMMIT;

-- ── Post-apply verification (run separately after migration) ────────────────
-- SELECT count(*) FROM public.__seo_keyword_cluster WHERE role_keywords ? 'R3_guide';
-- -- expected: 0
-- SELECT count(*) FROM public.__seo_page_brief WHERE page_role = 'R3_guide';
-- -- expected: 0
