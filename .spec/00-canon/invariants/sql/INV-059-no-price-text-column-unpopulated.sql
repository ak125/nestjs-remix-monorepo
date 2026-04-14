-- INV-059: no-price-text-column-unpopulated
-- Domain: D5-structural
-- Severity: medium
-- Description: pieces_price: TEXT price columns should be castable to numeric (no unconvertible values)
-- Tables: pieces_price
-- Returns 0 rows when invariant holds.

SELECT pp_id, pp_prix_public FROM pieces_price WHERE pp_prix_public IS NOT NULL AND pp_prix_public !~ '^-?[0-9]+(\.[0-9]+)?$';
