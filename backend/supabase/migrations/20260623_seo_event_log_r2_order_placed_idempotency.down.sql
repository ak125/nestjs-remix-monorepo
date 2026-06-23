-- Rollback: idempotency guard for server-side r2_order_placed funnel emission.
-- Additive index → fully reversible, no data loss.

DROP INDEX IF EXISTS public.uq_seo_event_log_r2_order_placed_order_id;
