-- INV-045: seo-keyword-type-mapping-fk
-- Domain: D3-seo
-- Severity: low
-- Description: __seo_keyword_type_mapping must reference valid keyword types (if data present)
-- Tables: __seo_keyword_type_mapping, __seo_keywords
-- Returns 0 rows when invariant holds.

SELECT sktm.id FROM __seo_keyword_type_mapping sktm LEFT JOIN __seo_keywords sk ON sktm.keyword_id = sk.id WHERE sktm.keyword_id IS NOT NULL AND sk.id IS NULL;
