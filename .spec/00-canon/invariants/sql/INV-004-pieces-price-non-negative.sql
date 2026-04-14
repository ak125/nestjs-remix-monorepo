-- INV-004: pieces-price-non-negative
-- Domain: D1-catalog
-- Severity: critical
-- Description: All numeric price columns in pieces_price must be >= 0. Shadow columns are named with _n suffix
-- Tables: pieces_price
-- Returns 0 rows when invariant holds.

SELECT pp_id FROM pieces_price WHERE pp_prix_public_n < 0 OR pp_prix_brut_n < 0 OR pp_remise_n < 0;
