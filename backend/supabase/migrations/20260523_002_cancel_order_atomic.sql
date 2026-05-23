-- =====================================================
-- cancel_order_atomic + extend create_order_atomic for atomic audit
-- Date: 2026-05-23
-- Refs: plans/utiliser-superpower-p0-modular-brooks.md (PR-B)
--       governance-vault ADR-079 (Commerce Runtime Authority canon)
--       Vault #301 résidus F3 deeper rot (OrdersService.cancelOrder broken)
-- =====================================================
-- Composite RPCs: UPDATE order + append_order_event in same Postgres transaction.
-- Benefit: impossible to have UPDATE without event (atomicity). Rollback on any error.
--
-- V1 status transitions enforced server-side (defense in depth + same canon as
-- @repo/domain-commerce.ORDER_STATUS_TRANSITIONS):
--   - cancel allowed from '1' (PROCESSING), '3' (AWAITING_FEE), '4' (FEE_RECEIVED)
--   - cancel FORBIDDEN from '5' (PAID) → refund workflow required (payments/ off-limits)
--   - cancel FORBIDDEN from '2' (CANCELLED) → already terminal
-- =====================================================

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- =====================================================
-- cancel_order_atomic
-- =====================================================
CREATE OR REPLACE FUNCTION public.cancel_order_atomic(
  p_ord_id         TEXT,
  p_reason         TEXT,
  p_user_id        BIGINT,
  p_correlation_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_from_status TEXT;
  v_payload     JSONB;
BEGIN
  IF p_ord_id IS NULL OR p_ord_id = '' THEN
    RAISE EXCEPTION 'cancel_order_atomic: p_ord_id is required';
  END IF;

  IF p_correlation_id IS NULL THEN
    RAISE EXCEPTION 'cancel_order_atomic: p_correlation_id is required';
  END IF;

  -- Lock the row & capture from_status atomically
  SELECT ord_ords_id INTO v_from_status
  FROM public.___xtr_order
  WHERE ord_id = p_ord_id
  FOR UPDATE;

  IF v_from_status IS NULL THEN
    RAISE EXCEPTION 'cancel_order_atomic: order % not found', p_ord_id;
  END IF;

  -- Canon V1 transition guards (defense in depth — domain-commerce enforces TS-side).
  IF v_from_status = '2' THEN
    RAISE EXCEPTION 'cancel_order_atomic: order % already cancelled (status 2)', p_ord_id;
  END IF;

  IF v_from_status = '5' THEN
    RAISE EXCEPTION 'cancel_order_atomic: order % is paid (status 5) — refund workflow required, payments/ module is off-limits (feedback_no_payment_module_changes_ever). V1.7+: reopen via Human Override Authority.', p_ord_id;
  END IF;

  -- UPDATE order to cancelled status
  UPDATE public.___xtr_order
  SET ord_ords_id     = '2',
      ord_cancel_date = now(),
      ord_cancel_reason = p_reason,
      ord_updated_at  = now()
  WHERE ord_id = p_ord_id;

  -- Build payload with full context for replay / observability
  v_payload := jsonb_build_object(
    'reason', COALESCE(p_reason, ''),
    'cancelled_by_user_id', p_user_id
  );

  -- Append audit event ATOMICALLY (same transaction — rollback if this fails)
  PERFORM public.append_order_event(
    p_ord_id, 'ORDER_CANCELLED', v_from_status, '2',
    v_payload, 'orders_service',
    p_correlation_id, p_user_id
  );
END;
$function$;

COMMENT ON FUNCTION public.cancel_order_atomic(TEXT, TEXT, BIGINT, UUID) IS
  'Composite RPC: UPDATE ___xtr_order to status=2 + append ORDER_CANCELLED event in same transaction. Enforces V1 transition guards (5 → 2 forbidden, refund required). Owner: OrdersService.cancelOrder per authority-graph.yaml#rpc_authority.rpcs.cancel_order_atomic.';

-- =====================================================
-- create_order_atomic — extend non-breaking with correlation_id + atomic audit
-- Adds optional p_correlation_id parameter (DEFAULT gen_random_uuid() for back-compat).
-- Existing callers (no parameter) still work; new callers pass an explicit UUID.
-- After successful order INSERT, atomically appends ORDER_CREATED event.
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_order_atomic(
  p_order          JSONB,
  p_lines          JSONB,
  p_correlation_id UUID DEFAULT gen_random_uuid()
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_ord_id  TEXT;
  v_line    JSONB;
  v_payload JSONB;
BEGIN
  -- Extract order ID
  v_ord_id := p_order->>'ord_id';

  IF v_ord_id IS NULL OR v_ord_id = '' THEN
    RAISE EXCEPTION 'ord_id is required';
  END IF;

  -- INSERT order (single transaction — auto-rollback on any error)
  INSERT INTO "___xtr_order" (
    ord_id, ord_cst_id, ord_date, ord_parent, ord_is_pay, ord_date_pay,
    ord_amount_ttc, ord_deposit_ttc, ord_shipping_fee_ttc, ord_total_ttc,
    ord_info, ord_ords_id, ord_cba_id, ord_cda_id,
    ord_billing_snapshot, ord_shipping_snapshot
  ) VALUES (
    v_ord_id,
    p_order->>'ord_cst_id',
    p_order->>'ord_date',
    COALESCE(p_order->>'ord_parent', '0'),
    COALESCE(p_order->>'ord_is_pay', '0'),
    NULLIF(p_order->>'ord_date_pay', ''),
    p_order->>'ord_amount_ttc',
    p_order->>'ord_deposit_ttc',
    p_order->>'ord_shipping_fee_ttc',
    p_order->>'ord_total_ttc',
    p_order->>'ord_info',
    COALESCE(p_order->>'ord_ords_id', '1'),
    NULLIF(p_order->>'ord_cba_id', ''),
    NULLIF(p_order->>'ord_cda_id', ''),
    (p_order->'ord_billing_snapshot')::jsonb,
    (p_order->'ord_shipping_snapshot')::jsonb
  );

  -- INSERT order lines (loop preserves PR #695 / F1 attribution support)
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    INSERT INTO "___xtr_order_line" (
      orl_id, orl_ord_id, orl_pg_id, orl_pg_name, orl_pm_name, orl_art_ref,
      orl_art_quantity, orl_art_price_sell_unit_ttc, orl_art_price_sell_ttc,
      orl_art_deposit_unit_ttc, orl_art_deposit_ttc, orl_website_url
    ) VALUES (
      v_line->>'orl_id',
      v_ord_id,
      v_line->>'orl_pg_id',
      v_line->>'orl_pg_name',
      v_line->>'orl_pm_name',
      v_line->>'orl_art_ref',
      v_line->>'orl_art_quantity',
      v_line->>'orl_art_price_sell_unit_ttc',
      v_line->>'orl_art_price_sell_ttc',
      v_line->>'orl_art_deposit_unit_ttc',
      v_line->>'orl_art_deposit_ttc',
      v_line->>'orl_website_url'
    );
  END LOOP;

  -- ATOMIC audit: append ORDER_CREATED event in same transaction.
  -- from_status = NULL (creation has no prior state) ; to_status = '1' (PROCESSING canon initial).
  v_payload := jsonb_build_object(
    'lines_count', jsonb_array_length(p_lines),
    'total_ttc',   p_order->>'ord_total_ttc',
    'customer_id', p_order->>'ord_cst_id'
  );

  PERFORM public.append_order_event(
    v_ord_id, 'ORDER_CREATED', NULL, COALESCE(p_order->>'ord_ords_id', '1'),
    v_payload, 'orders_service',
    p_correlation_id, NULL
  );

  RETURN v_ord_id;
END;
$function$;

COMMENT ON FUNCTION public.create_order_atomic(JSONB, JSONB, UUID) IS
  'Composite RPC extended from PR #695: INSERT ___xtr_order + ___xtr_order_line + append ORDER_CREATED event, all in same transaction. p_correlation_id is optional (DEFAULT gen_random_uuid()) for back-compat. Owner: OrdersService.createOrder per authority-graph.yaml#rpc_authority.rpcs.create_order_atomic.';
