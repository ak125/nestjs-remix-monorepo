-- Migration: Rename legacy PageType R3_guide_achat → R3_guide_howto
-- R3 = "agir / how-to", NOT "guide d'achat" (which is R6).
-- Applied manually 2026-03-13.

-- 1. Drop old CHECK constraint
ALTER TABLE __rag_content_refresh_log DROP CONSTRAINT IF EXISTS chk_valid_page_type;

-- 2. Backfill data
UPDATE __rag_content_refresh_log
SET page_type = 'R3_guide_howto'
WHERE page_type = 'R3_guide_achat';

-- 3. Recreate CHECK with new value
ALTER TABLE __rag_content_refresh_log ADD CONSTRAINT chk_valid_page_type
  CHECK (page_type IN ('R1_pieces', 'R3_guide_howto', 'R3_conseils', 'R4_reference', 'R5_diagnostic'));
