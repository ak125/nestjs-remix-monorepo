-- 20260522160000_order_line_website_url_attribution.sql
-- F1 attribution add-to-cart par-ligne : persiste la source d'ajout (orl_website_url)
-- via create_order_atomic. ADDITIF UNIQUEMENT — ajoute orl_website_url à l'INSERT ligne ;
-- aucune colonne/comportement existant changé. La colonne orl_website_url existe déjà
-- (text) dans ___xtr_order_line (71% peuplée historiquement, 0 code l'écrivait).
-- Idempotent (CREATE OR REPLACE). Pour les appelants qui n'envoient pas la clé,
-- (v_line->>'orl_website_url') = NULL → strictement rétro-compatible.
-- Ref : governance-vault ledger/audit-trail/2026-05-22-commerce-runtime-truth-audit.md (F1).

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE OR REPLACE FUNCTION public.create_order_atomic(p_order jsonb, p_lines jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_ord_id TEXT;
  v_line JSONB;
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
    NULL,
    p_order->>'ord_amount_ttc',
    p_order->>'ord_deposit_ttc',
    p_order->>'ord_shipping_fee_ttc',
    p_order->>'ord_total_ttc',
    COALESCE(p_order->>'ord_info', ''),
    COALESCE(p_order->>'ord_ords_id', '1'),
    p_order->>'ord_cba_id',
    p_order->>'ord_cda_id',
    (p_order->'ord_billing_snapshot')::JSONB,
    (p_order->'ord_shipping_snapshot')::JSONB
  );

  -- INSERT all lines (same transaction).
  -- orl_website_url AJOUTÉ (F1) : source d'ajout par-ligne ; NULL si absent (rétro-compat).
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    INSERT INTO "___xtr_order_line" (
      orl_id, orl_ord_id, orl_pg_name, orl_pg_id, orl_pm_name,
      orl_art_ref, orl_art_quantity, orl_art_price_sell_unit_ttc,
      orl_art_price_sell_ttc, orl_art_deposit_unit_ttc, orl_art_deposit_ttc,
      orl_website_url
    ) VALUES (
      v_line->>'orl_id',
      v_line->>'orl_ord_id',
      v_line->>'orl_pg_name',
      v_line->>'orl_pg_id',
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
