-- Reversal of 20260523_cancel_order_atomic.sql
-- IMPORTANT: this rollback restores create_order_atomic to its pre-PR-B signature
-- (without p_correlation_id parameter, without ORDER_CREATED event emission).
-- If PR-C (OrdersService refactor) has been merged AND callers pass p_correlation_id,
-- rolling back THIS migration will break those callers — apply PR-C rollback first.

DROP FUNCTION IF EXISTS public.cancel_order_atomic(TEXT, TEXT, BIGINT, UUID);

-- Restore create_order_atomic to pre-PR-B body (PR #695 baseline + F1 line URL).
CREATE OR REPLACE FUNCTION public.create_order_atomic(p_order JSONB, p_lines JSONB)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_ord_id TEXT;
  v_line   JSONB;
BEGIN
  v_ord_id := p_order->>'ord_id';
  IF v_ord_id IS NULL OR v_ord_id = '' THEN
    RAISE EXCEPTION 'ord_id is required';
  END IF;

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

  RETURN v_ord_id;
END;
$function$;
