-- Rollback: 20260623_seo_event_log_r2_order_placed_idempotency
-- Additive index only — dropping it restores the pre-migration state (no data touched).
-- CONCURRENTLY : pas de verrou ACCESS EXCLUSIVE sur __seo_event_log (écritures continues).
DROP INDEX CONCURRENTLY IF EXISTS public.uq_seo_event_log_r2_order_placed_order_id;
