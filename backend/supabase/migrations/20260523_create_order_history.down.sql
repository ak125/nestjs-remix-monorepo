-- Reversal of 20260523_create_order_history.sql
DROP FUNCTION IF EXISTS public.append_order_event(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, UUID, BIGINT);
DROP INDEX IF EXISTS public.idx_order_history_correlation;
DROP INDEX IF EXISTS public.idx_order_history_event_type_created;
DROP INDEX IF EXISTS public.idx_order_history_ord_id_created;
DROP TABLE IF EXISTS public.___xtr_order_history;
