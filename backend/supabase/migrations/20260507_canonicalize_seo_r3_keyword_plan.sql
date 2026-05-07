-- R3 Canon Hardening — DB layer (PR-D, R3 Canon Hardening)
--
-- Defense-in-depth :
--   - Layer 1 : @repo/seo-roles canon (PR-A, mergée)
--   - Layer 2 : script asserts + ESLint (PR-B, mergée)
--   - Layer 3 : ConseilEnricherService 2-gate (PR-C, en revue)
--   - Layer 4 : DB trigger (THIS MIGRATION) — catches bypass of layers 1-3
--
-- Pre-flight audit (2026-05-07, supabase MCP) :
--   - __seo_r3_keyword_plan : 23 columns, schema matches database.types.ts
--   - Case 2 of plan §A : ALTER TABLE ADD COLUMN IF NOT EXISTS only
--   - Provenance partielle : skp_built_by + skp_built_at existent
--
-- Sequence forcée (Plan §iii pre-req) :
--   1. Cette migration : tables + columns + trigger DISABLED
--   2. Script export `scripts/seo/export-canon-forbidden.ts` populate
--      `__seo_role_canon_forbidden` depuis @repo/seo-roles@>=0.5.0
--   3. UPDATE __seo_canon_runtime_flags SET enabled=TRUE pour activer le
--      trigger (manuel ou en CI step)
--
-- Réversibilité :
--   - ADD COLUMN IF NOT EXISTS : idempotent
--   - DROP TRIGGER + DROP FUNCTION : reversible via prochaine migration
--   - Tables ajoutées : DROP TABLE en migration de revert si nécessaire

BEGIN;

-- ── 1. Provenance columns sur __seo_r3_keyword_plan ──────────────────────────

ALTER TABLE public.__seo_r3_keyword_plan
  ADD COLUMN IF NOT EXISTS skp_source TEXT,                 -- 'script' | 'agent' | 'manual'
  ADD COLUMN IF NOT EXISTS skp_source_version TEXT,         -- commit SHA + script name
  ADD COLUMN IF NOT EXISTS skp_validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS skp_validated_by TEXT;

-- Backfill provenance pour rows existantes (origine inconnue → 'legacy').
UPDATE public.__seo_r3_keyword_plan
SET skp_source = COALESCE(skp_source, 'legacy'),
    skp_source_version = COALESCE(
      skp_source_version,
      'pre-canon-' || COALESCE(skp_built_by, 'unknown')
    )
WHERE skp_source IS NULL OR skp_source_version IS NULL;

-- ── 2. Kill-switch table (Plan §ii) ──────────────────────────────────────────
--
-- Audit trail explicite (table) plutôt que ENV var. Disable runbook au vault.

CREATE TABLE IF NOT EXISTS public.__seo_canon_runtime_flags (
  flag        TEXT PRIMARY KEY,
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  TEXT
);

COMMENT ON TABLE public.__seo_canon_runtime_flags IS
  'Runtime kill-switch flags for canon enforcement triggers. Disable rules '
  'documented in vault runbook (vault-seo-canon-runtime-flags.md). '
  'Audit trail : updated_at + updated_by per flag.';

INSERT INTO public.__seo_canon_runtime_flags (flag, enabled, updated_by)
VALUES ('skp_canon_trigger', FALSE, 'migration_20260507')
ON CONFLICT (flag) DO NOTHING;

-- ── 3. Canon export table (cache, NOT SoT) ───────────────────────────────────
--
-- Populated by scripts/seo/export-canon-forbidden.ts from @repo/seo-roles@>=0.5.0
-- canon. Source of truth lives in TS package — this table is a derived cache.
-- Manual SQL edits prohibited (RLS service_role-only) ; CI guard verifies hash.

CREATE TABLE IF NOT EXISTS public.__seo_role_canon_forbidden (
  role_id  TEXT NOT NULL,
  term     TEXT NOT NULL,
  PRIMARY KEY (role_id, term)
);

COMMENT ON TABLE public.__seo_role_canon_forbidden IS
  'CACHE/EXPORT-ONLY. Source of truth = @repo/seo-roles@>=0.5.0 (canon). '
  'Populated by scripts/seo/export-canon-forbidden.ts in CI. '
  'Manual SQL edits forbidden — RLS service_role-only. '
  'See ADR-PR-D (vault) for invariants.';

ALTER TABLE public.__seo_role_canon_forbidden ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS canon_forbidden_readonly ON public.__seo_role_canon_forbidden;
CREATE POLICY canon_forbidden_readonly ON public.__seo_role_canon_forbidden
  FOR SELECT TO authenticated, anon USING (true);

-- No INSERT/UPDATE/DELETE policy → only service_role bypasses RLS for writes.

-- ── 4. Canon check function ──────────────────────────────────────────────────
--
-- Scans ONLY injectable fields :
--   - skp_section_terms.<section>.include_terms
--   - skp_section_terms.<section>.micro_phrases
--   - skp_heading_plan (all H2 values)
--
-- NEVER scans skp_section_terms.<section>.forbidden_overlap (that field LISTS
-- forbidden terms by design — scanning it = systematic false positives).
--
-- Performance :
--   - Trigger only on UPDATE OF the relevant columns (not on metadata-only updates)
--   - WHEN (NEW.skp_status IN ('validated', 'active')) — drafts skip cost
--   - Kill-switch check first (returns NEW immediately if disabled)

CREATE OR REPLACE FUNCTION public.fn_skp_canon_check() RETURNS TRIGGER AS $$
DECLARE
  killswitch_enabled BOOLEAN;
  banned             TEXT;
  injectable_text    TEXT := '';
  section_obj        JSONB;
BEGIN
  -- 4a. Kill-switch — short-circuit if globally disabled
  SELECT enabled INTO killswitch_enabled
  FROM public.__seo_canon_runtime_flags
  WHERE flag = 'skp_canon_trigger';

  IF killswitch_enabled IS NULL OR NOT killswitch_enabled THEN
    RETURN NEW;
  END IF;

  -- 4b. Concaténer UNIQUEMENT include_terms + micro_phrases de chaque section
  IF NEW.skp_section_terms IS NOT NULL THEN
    FOR section_obj IN SELECT value FROM jsonb_each(NEW.skp_section_terms)
    LOOP
      injectable_text := injectable_text || ' ' ||
        COALESCE(
          (SELECT string_agg(value, ' ')
           FROM jsonb_array_elements_text(section_obj->'include_terms')),
          ''
        ) || ' ' ||
        COALESCE(
          (SELECT string_agg(value, ' ')
           FROM jsonb_array_elements_text(section_obj->'micro_phrases')),
          ''
        );
    END LOOP;
  END IF;

  -- 4c. Concaténer aussi tous les H2 de skp_heading_plan (injectables au render)
  IF NEW.skp_heading_plan IS NOT NULL THEN
    injectable_text := injectable_text || ' ' ||
      COALESCE(
        (SELECT string_agg(value, ' ') FROM jsonb_each_text(NEW.skp_heading_plan)),
        ''
      );
  END IF;

  -- 4d. Match contre la blacklist canon (jamais sur forbidden_overlap)
  FOR banned IN
    SELECT term FROM public.__seo_role_canon_forbidden WHERE role_id = 'R3_CONSEILS'
  LOOP
    IF lower(injectable_text) LIKE '%' || lower(banned) || '%' THEN
      RAISE EXCEPTION
        'CANON_VIOLATION: forbidden term "%" detected in injectable fields '
        '(include_terms / micro_phrases / heading_plan) for skp_pg_id=%. '
        'Source canon : @repo/seo-roles getForbiddenOverlap(R3_CONSEILS). '
        'To bypass : disable __seo_canon_runtime_flags.skp_canon_trigger '
        '(audit trail required, see vault runbook).',
        banned, NEW.skp_pg_id
        USING ERRCODE = '23514'; -- check_violation
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 5. Trigger (initially disabled via runtime flag) ─────────────────────────

DROP TRIGGER IF EXISTS tg_skp_canon_check ON public.__seo_r3_keyword_plan;

CREATE TRIGGER tg_skp_canon_check
  BEFORE INSERT OR UPDATE OF skp_section_terms, skp_heading_plan, skp_status
  ON public.__seo_r3_keyword_plan
  FOR EACH ROW
  WHEN (NEW.skp_status IN ('validated', 'active'))
  EXECUTE FUNCTION public.fn_skp_canon_check();

-- ── 6. Conditional GIN index (>10k rows) ─────────────────────────────────────

DO $idx$
DECLARE
  row_count INT;
BEGIN
  SELECT count(*) INTO row_count FROM public.__seo_r3_keyword_plan;
  IF row_count > 10000 THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_skp_section_terms_gin '
            'ON public.__seo_r3_keyword_plan USING GIN (skp_section_terms)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_skp_heading_plan_gin '
            'ON public.__seo_r3_keyword_plan USING GIN (skp_heading_plan)';
    RAISE NOTICE 'GIN indexes created (% rows)', row_count;
  ELSE
    RAISE NOTICE 'GIN indexes skipped (% rows < 10000 threshold)', row_count;
  END IF;
END $idx$;

COMMIT;

-- ── Activation post-migration (séparée, après population canon) ──────────────
--   1. Run scripts/seo/export-canon-forbidden.ts to populate
--      __seo_role_canon_forbidden from @repo/seo-roles canon
--   2. Verify : SELECT count(*) FROM __seo_role_canon_forbidden;
--      Expected ≥ 50 (R3_CONSEILS alone has 25+ terms)
--   3. Activate trigger :
--      UPDATE __seo_canon_runtime_flags
--      SET enabled = TRUE, updated_at = now(), updated_by = 'ops:activate-pr-d'
--      WHERE flag = 'skp_canon_trigger';
--   4. Smoke test : try INSERT with forbidden term in include_terms → expect
--      exception ERRCODE=23514 message "CANON_VIOLATION:..."
