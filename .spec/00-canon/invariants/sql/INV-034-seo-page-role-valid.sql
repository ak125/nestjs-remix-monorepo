-- INV-034: seo-page-role-valid
-- Domain: D3-seo
-- Severity: high
-- Description: __seo_page.role must be in allowed set {R0,R1,R2,R3,R4,R5,R6,R7,R8}
-- Tables: __seo_page
-- Returns 0 rows when invariant holds.

SELECT id, slug, role FROM __seo_page WHERE role NOT IN ('R0','R1','R2','R3','R4','R5','R6','R7','R8');
