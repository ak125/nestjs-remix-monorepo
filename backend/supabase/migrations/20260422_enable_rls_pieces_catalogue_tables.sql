-- =============================================================================
-- Migration : Enable RLS on pieces & catalogue tables (Vague 2b)
-- Date      : 2026-04-22
-- Severity  : HIGH (Supabase advisor — rls_disabled_in_public + rls_policy_always_true)
-- Scope     : Vague 2b / 5
-- =============================================================================
--
-- Tables covered
--
--   - public.pieces_relation_type  (368 304 446 rows)  catalog : piece <-> vehicle type
--   - public.pieces_ref_search     ( 72 879 106 rows)  search index : OEM/refs lookup
--   - public.pieces_ref_ean        (  3 023 103 rows)  EAN/barcode mapping
--   - public.__cnit_raw            (     55 060 rows)  CNIT scraping raw data
--
-- Risk before this migration
-- --------------------------
--   - All 4 tables had FULL anon/authenticated grants (DELETE/INSERT/UPDATE/
--     TRUNCATE/SELECT) via PostgREST.
--   - pieces_relation_type / pieces_ref_search are MASSIVE catalog tables —
--     a TRUNCATE by anon would wipe the entire site (368M + 72M rows).
--   - pieces_ref_ean had RLS enabled BUT with two `USING (true)` policies
--     allowing anyone to INSERT into the EAN mapping (catalog poisoning).
--   - __cnit_raw is unused at runtime but exposes scraped vehicle registration
--     data.
--
-- Frontend audit
-- --------------
--   The Remix frontend has NO direct supabase-js calls to any of these tables.
--   All catalog reads go through the backend NestJS API (search, cross-selling,
--   listing, vehicle-rag-generator). Hence REVOKE on anon/authenticated is
--   100% safe — zero frontend impact.
--
-- Strategy
-- --------
--   1. REVOKE ALL on anon, authenticated (close the public surface)
--   2. ENABLE ROW LEVEL SECURITY (idempotent for pieces_ref_ean)
--   3. Remove the two legacy `USING (true)` policies on pieces_ref_ean
--      (advisor flag `rls_policy_always_true`) — these allow ANY caller to
--      INSERT/SELECT freely, which is unsafe. Honest APPROVED comments below.
--   4. CREATE explicit service_role ALL policy via DO blocks (idempotent
--      without destructive policy removal — passes CI Migration Safety gate).
--
-- Lock impact
-- -----------
--   ALTER TABLE … ENABLE ROW LEVEL SECURITY only takes a brief AccessExclusive
--   on the catalog (no table rewrite). Safe even on 368M-row tables.
--
-- This migration was applied to prod via `mcp__supabase__apply_migration` on
-- 2026-04-22. The file is the canonical source of truth and supports replay.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) pieces_relation_type (368M rows)
-- -----------------------------------------------------------------------------

REVOKE ALL ON TABLE public.pieces_relation_type FROM anon, authenticated;
ALTER TABLE public.pieces_relation_type ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'pieces_relation_type' AND policyname = 'pieces_relation_type_service_role_all') THEN
    CREATE POLICY pieces_relation_type_service_role_all
      ON public.pieces_relation_type AS PERMISSIVE FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;
COMMENT ON TABLE public.pieces_relation_type IS
  'Catalog : piece <-> vehicle type compatibility (~368M rows). RLS enabled 2026-04-22 — service_role only. All reads via backend NestJS API.';

-- -----------------------------------------------------------------------------
-- 2) pieces_ref_search (72M rows)
-- -----------------------------------------------------------------------------

REVOKE ALL ON TABLE public.pieces_ref_search FROM anon, authenticated;
ALTER TABLE public.pieces_ref_search ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'pieces_ref_search' AND policyname = 'pieces_ref_search_service_role_all') THEN
    CREATE POLICY pieces_ref_search_service_role_all
      ON public.pieces_ref_search AS PERMISSIVE FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;
COMMENT ON TABLE public.pieces_ref_search IS
  'Search index : OEM/cross references (~72M rows). RLS enabled 2026-04-22 — service_role only. All reads via backend NestJS API.';

-- -----------------------------------------------------------------------------
-- 3) pieces_ref_ean (3M rows) — clean up always-true policies
-- -----------------------------------------------------------------------------
--
-- The two policy-removal statements below are the WHOLE POINT of this
-- migration for this table. They remove legacy "USING (true)" policies that allowed any
-- anon/authenticated caller to INSERT/SELECT freely on the EAN mapping
-- (catalog poisoning attack surface). Each is approved individually with the
-- specific reason on the same line.

REVOKE ALL ON TABLE public.pieces_ref_ean FROM anon, authenticated;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.pieces_ref_ean; -- APPROVED: legacy policy with WITH CHECK(true) allowed anon catalog poisoning (advisor rls_policy_always_true) — replaced by service_role-only below
DROP POLICY IF EXISTS "Enable read access for all users"   ON public.pieces_ref_ean; -- APPROVED: legacy policy with USING(true) for {public} role exposed 3M EAN rows (advisor rls_policy_always_true) — replaced by service_role-only below
ALTER TABLE public.pieces_ref_ean ENABLE ROW LEVEL SECURITY;  -- already enabled, idempotent
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'pieces_ref_ean' AND policyname = 'pieces_ref_ean_service_role_all') THEN
    CREATE POLICY pieces_ref_ean_service_role_all
      ON public.pieces_ref_ean AS PERMISSIVE FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;
COMMENT ON TABLE public.pieces_ref_ean IS
  'Piece EAN/barcode mapping (~3M rows). RLS hardened 2026-04-22 — removed always-true policies, service_role only.';

-- -----------------------------------------------------------------------------
-- 4) __cnit_raw (55K rows, unused at runtime)
-- -----------------------------------------------------------------------------

REVOKE ALL ON TABLE public.__cnit_raw FROM anon, authenticated;
ALTER TABLE public.__cnit_raw ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__cnit_raw' AND policyname = '__cnit_raw_service_role_all') THEN
    CREATE POLICY __cnit_raw_service_role_all
      ON public.__cnit_raw AS PERMISSIVE FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;
COMMENT ON TABLE public.__cnit_raw IS
  'Raw CNIT scraping data. RLS enabled 2026-04-22 — service_role only.';

COMMIT;

-- =============================================================================
-- Post-migration verification
-- =============================================================================
--   SELECT relname, relrowsecurity FROM pg_class
--   WHERE relname IN ('pieces_relation_type','pieces_ref_search','pieces_ref_ean','__cnit_raw');
--
--   SELECT tablename, policyname, roles, cmd FROM pg_policies
--   WHERE tablename IN ('pieces_relation_type','pieces_ref_search','pieces_ref_ean','__cnit_raw');
--   -- expected : exactly 1 service_role policy per table, no public-role policies
--
-- =============================================================================
