-- INV-056: pieces-price-shadow-cols-sync
-- Domain: D5-structural
-- Severity: high
-- Description: pieces_price: shadow _n columns must not be null where TEXT original is non-null
-- Tables: pieces_price
-- Returns 0 rows when invariant holds.

SELECT pp_id FROM pieces_price WHERE (pp_prix_public IS NOT NULL AND pp_prix_public_n IS NULL) OR (pp_prix_brut IS NOT NULL AND pp_prix_brut_n IS NULL) OR (pp_remise IS NOT NULL AND pp_remise_n IS NULL);
