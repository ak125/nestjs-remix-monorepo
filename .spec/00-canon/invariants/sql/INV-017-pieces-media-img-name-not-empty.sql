-- INV-017: pieces-media-img-name-not-empty
-- Domain: D1-catalog
-- Severity: medium
-- Description: pieces_media_img.pmi_name must not be empty (part of composite PK)
-- Tables: pieces_media_img
-- Returns 0 rows when invariant holds.

SELECT pmi_id FROM pieces_media_img WHERE pmi_name IS NULL OR pmi_name = '';
