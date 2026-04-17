-- Fix: mark_order_paid_atomic type error (boolean > integer)
--
-- Root cause: v_updated was declared BOOLEAN, but GET DIAGNOSTICS ROW_COUNT
-- returns INTEGER. The comparison "v_updated > 0" then fails with:
--   ERROR: 42883 operator does not exist: boolean > integer
--
-- Impact: since commit c1265fbb (2026-03-20 22:52 UTC) introduced this RPC,
-- EVERY call from the Paybox callback handler threw internally. The backend
-- caught the error, logged it, then returned 500 to Paybox. Paybox retried
-- (2-3 times typically), and the ic_postback dedup guard caused the second
-- retry to skip the RPC entirely, making payment_confirmed flip to true WITHOUT
-- ord_is_pay ever reaching '1'. Net effect: 25 days of broken payment tunnel
-- (2026-03-20 to 2026-04-14), 14 orders stuck in ord_is_pay='0' despite
-- customer CBs being debited on Paybox side.
--
-- Fix: declare v_count as INTEGER, matching GET DIAGNOSTICS and the comparison.
-- Preserves the function signature including DEFAULT NULL on p_date_pay.
--
-- This migration was first applied live via MCP on 2026-04-14 ~19:30 UTC
-- (migration name: fix_mark_order_paid_atomic_bool_int_type_error). This file
-- aligns the git repo with the already-deployed DB state so a future redeploy
-- does not reintroduce the bug.
--
-- Validation: 2nd real payment on 2026-04-17 13:14:19 UTC
--   (ORD-1776431567939-431, 13.82 EUR) successfully flipped ord_is_pay='1'
--   AND payment_confirmed=true automatically, E2E without manual intervention.

CREATE OR REPLACE FUNCTION public.mark_order_paid_atomic(
  p_ord_id text,
  p_date_pay text DEFAULT NULL::text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_count INTEGER;
BEGIN
  -- Atomic UPDATE: only succeeds if ord_is_pay = '0'
  -- Second concurrent callback gets 0 rows = already paid (idempotent)
  UPDATE "___xtr_order"
  SET
    ord_is_pay = '1',
    ord_date_pay = COALESCE(p_date_pay, NOW()::TEXT),
    ord_ords_id = '3'
  WHERE ord_id = p_ord_id
    AND ord_is_pay = '0';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$function$;

COMMENT ON FUNCTION public.mark_order_paid_atomic(text, text) IS
  'Marks an order as paid atomically. Returns true if the update succeeded '
  '(order transitioned from unpaid to paid), false if the order was already '
  'paid (idempotent for Paybox retries) or does not exist. '
  'Fixed 2026-04-17: v_count declared as INTEGER (was BOOLEAN, caused type '
  'error since 2026-03-20).';
