-- Migration: Rename legacy PageType R3_guide_achat → R3_guide_howto
-- R3 = "agir / how-to", NOT "guide d'achat" (which is R6).
-- This is a data-only backfill — no schema change.

UPDATE __rag_content_refresh_log
SET page_type = 'R3_guide_howto'
WHERE page_type = 'R3_guide_achat';
