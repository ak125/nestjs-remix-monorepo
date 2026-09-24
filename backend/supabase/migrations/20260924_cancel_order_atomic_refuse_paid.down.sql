-- Rollback : 20260924_cancel_order_atomic_refuse_paid (documentation
-- d'intervention manuelle ; le runner ignore les .down.sql, politique
-- forward-only).
--
-- Restaure le corps de cancel_order_atomic tel que livré par
-- 20260523_002_cancel_order_atomic.sql (extrait À L'IDENTIQUE de ce fichier,
-- lignes 24-87, puis le COMMENT des lignes 89-90). Empreinte attendue après
-- rollback : md5(prosrc) = ea565836042a13929d8e1e35370bda57, la valeur relevée
-- sur la base live le 2026-09-24 avant 20260924.
--
-- EFFET DU ROLLBACK — à lire avant de l'appliquer : la RPC redevient capable
-- d'annuler une commande payée dont le statut n'est pas '5'. Le seul rempart
-- redevient le contrôle applicatif, qui lit la commande AVANT l'appel : un
-- paiement confirmé entre les deux n'est plus vu. Ne rouler en arrière que si
-- le nouveau refus bloque un cas légitime, et le documenter.
--
-- Rien n'est supprimé : pas de DROP, create_order_atomic et append_order_event
-- ne sont pas touchées. Les droits sont ré-affirmés à l'identique.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

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

REVOKE EXECUTE ON FUNCTION public.cancel_order_atomic(p_ord_id text, p_reason text, p_user_id bigint, p_correlation_id uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cancel_order_atomic(p_ord_id text, p_reason text, p_user_id bigint, p_correlation_id uuid) TO service_role;
