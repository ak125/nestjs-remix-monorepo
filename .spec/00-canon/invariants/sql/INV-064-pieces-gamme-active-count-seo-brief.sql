-- INV-064: pieces-gamme-active-count-seo-brief
-- Domain: D6-consistency
-- Severity: medium
-- Description: Active gammes with pg_alias must have at least one SEO brief (R3 or R6) in __seo_page_brief
-- Tables: pieces_gamme, __seo_page_brief
-- Returns 0 rows when invariant holds.

SELECT pg.pg_id, pg.pg_alias FROM pieces_gamme pg WHERE pg.pg_status = 'active' AND pg.pg_alias IS NOT NULL AND NOT EXISTS ( SELECT 1 FROM __seo_page_brief spb WHERE spb.pg_alias = pg.pg_alias AND spb.role IN ('R3','R6') );
