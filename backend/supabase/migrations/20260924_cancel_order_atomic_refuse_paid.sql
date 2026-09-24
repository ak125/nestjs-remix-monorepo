-- Migration : cancel_order_atomic refuse toute commande PAYÉE, quel que soit
-- son statut, et n'accepte plus que les transitions canoniques vers « annulée ».
--
-- PROBLÈME
--   La RPC d'annulation (20260523_002_cancel_order_atomic.sql) ne reconnaît une
--   commande payée QUE par son statut '5'. Elle ne lit jamais les champs de
--   paiement (ord_is_pay, ord_date_pay). Or, en base, la majorité des commandes
--   payées ne sont PAS au statut '5' : le paiement pose ord_is_pay='1' et le
--   statut reste '1', '3' ou '4' (mesure agrégée en lecture seule, 2026-09-24).
--   Pour la RPC, ces commandes payées sont donc annulables.
--
-- CAUSE RACINE
--   Deux prédicats « payée » divergents pour une même décision :
--     - côté applicatif, getCustomerCancelRefusal (orders.service.ts) refuse
--       dès que ord_is_pay='1' OU ord_date_pay est renseignée ;
--     - côté base, la RPC ne regarde que le statut.
--   Le contrôle applicatif lit la commande, PUIS appelle la RPC : entre les deux,
--   un paiement peut être confirmé. La RPC verrouille bien la ligne (FOR UPDATE)
--   mais ne vérifie pas ce qui compte, donc le verrou ne protège rien. La
--   décision doit être prise là où la ligne est verrouillée, avec le même
--   prédicat que l'application.
--
-- CHANGEMENT (un seul objet touché : le corps de cancel_order_atomic)
--   1. La ligne verrouillée fournit aussi ord_is_pay et ord_date_pay.
--   2. Commande payée = ord_is_pay='1' OU ord_date_pay contenant au moins un
--      caractère non blanc : MÊME prédicat que getCustomerCancelRefusal
--      (String(ord_date_pay).trim() !== ''). Refus avec le message « refund
--      workflow required », déjà traduit en HTTP 409 par
--      OrdersService.cancelOrder.
--   3. Seules les transitions canoniques vers '2' sont acceptées : 1|3|4 -> 2
--      (ORDER_STATUS_TRANSITIONS, @repo/domain-commerce). Tout autre statut,
--      y compris l'absence de statut et les valeurs hors canon, est refusé avec
--      « invalid transition ». Avant : un statut absent était signalé comme
--      « commande introuvable », et une valeur hors canon finissait en violation
--      de clé étrangère sur l'historique.
--   4. « Introuvable » ne signifie plus que « aucune ligne » (IF NOT FOUND),
--      et non plus « statut absent ».
--   Ordre des contrôles : déjà annulée ('2') d'abord, puis payée, puis
--   transition canonique. Une commande annulée qui avait été payée reste donc
--   signalée comme « déjà annulée ».
--
-- CE QUI N'EST PAS TOUCHÉ
--   - Signature, type de retour, SECURITY DEFINER, search_path=public : à
--     l'identique. Aucun DROP, aucun appelant à modifier.
--   - Le chemin qui réussit : même UPDATE (statut '2', date et motif
--     d'annulation, ord_updated_at), même événement ORDER_CANCELLED via
--     append_order_event, dans la même transaction.
--   - create_order_atomic, append_order_event, mark_order_paid_atomic : non
--     touchées.
--   - Aucune donnée modifiée par la migration elle-même.
--
-- VERROUS
--   CREATE OR REPLACE FUNCTION ne prend qu'un verrou sur l'entrée pg_proc de la
--   fonction ; aucune table n'est verrouillée. Timeouts explicites ci-dessous.
--
-- DROITS
--   CREATE OR REPLACE conserve les droits existants (postgres + service_role,
--   fermés par 20260617). Ils sont ré-affirmés ci-dessous : les privilèges par
--   défaut de Supabase ne doivent jamais pouvoir rouvrir anon ou authenticated
--   (garde scripts/lint/check-definer-anon-surface.sh).
--
-- ROLLBACK
--   20260924_cancel_order_atomic_refuse_paid.down.sql restaure le corps
--   d'origine, extrait à l'identique de 20260523_002. Le rollback rouvre la
--   fenêtre décrite plus haut.
--
-- PREUVE
--   scripts/db/test-cancel-order-atomic-refuse-paid.sh : PostgreSQL 17 jetable,
--   défaut reproduit avant la migration, matrice de décision après, course
--   « paiement confirmé pendant l'annulation », droits, idempotence, rollback.

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
  v_is_pay      TEXT;
  v_date_pay    TEXT;
  v_payload     JSONB;
BEGIN
  IF p_ord_id IS NULL OR p_ord_id = '' THEN
    RAISE EXCEPTION 'cancel_order_atomic: p_ord_id is required';
  END IF;

  IF p_correlation_id IS NULL THEN
    RAISE EXCEPTION 'cancel_order_atomic: p_correlation_id is required';
  END IF;

  -- Lock the row, then decide on the locked values only.
  SELECT ord_ords_id, ord_is_pay, ord_date_pay
    INTO v_from_status, v_is_pay, v_date_pay
  FROM public.___xtr_order
  WHERE ord_id = p_ord_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cancel_order_atomic: order % not found', p_ord_id;
  END IF;

  IF v_from_status = '2' THEN
    RAISE EXCEPTION 'cancel_order_atomic: order % already cancelled (status 2)', p_ord_id;
  END IF;

  IF v_from_status = '5' THEN
    RAISE EXCEPTION 'cancel_order_atomic: order % is paid (status 5) — refund workflow required, payments/ module is off-limits (feedback_no_payment_module_changes_ever). V1.7+: reopen via Human Override Authority.', p_ord_id;
  END IF;

  -- Paid = same predicate as getCustomerCancelRefusal (orders.service.ts):
  -- ord_is_pay = '1' OR ord_date_pay holding a non-whitespace character
  -- (String(ord_date_pay).trim() !== ''), whatever the status.
  IF v_is_pay = '1' OR COALESCE(v_date_pay, '') ~ '[^[:space:]]' THEN
    RAISE EXCEPTION 'cancel_order_atomic: order % is paid (ord_is_pay=%, status %) — refund workflow required, payments/ module is off-limits.',
      p_ord_id, COALESCE(v_is_pay, 'NULL'), COALESCE(v_from_status, 'NULL');
  END IF;

  -- Canon transitions to CANCELLED: 1|3|4 -> 2 (@repo/domain-commerce).
  IF v_from_status IS NULL OR v_from_status NOT IN ('1', '3', '4') THEN
    RAISE EXCEPTION 'cancel_order_atomic: order % status % invalid transition to cancelled (canon 1|3|4 -> 2)',
      p_ord_id, COALESCE(v_from_status, 'NULL');
  END IF;

  UPDATE public.___xtr_order
  SET ord_ords_id       = '2',
      ord_cancel_date   = now(),
      ord_cancel_reason = p_reason,
      ord_updated_at    = now()
  WHERE ord_id = p_ord_id;

  v_payload := jsonb_build_object(
    'reason', COALESCE(p_reason, ''),
    'cancelled_by_user_id', p_user_id
  );

  -- Audit event in the same transaction (rollback if this fails).
  PERFORM public.append_order_event(
    p_ord_id, 'ORDER_CANCELLED', v_from_status, '2',
    v_payload, 'orders_service',
    p_correlation_id, p_user_id
  );
END;
$function$;

COMMENT ON FUNCTION public.cancel_order_atomic(TEXT, TEXT, BIGINT, UUID) IS
  'Composite RPC: UPDATE ___xtr_order to status=2 + append ORDER_CANCELLED event in same transaction. Decides on the locked row only. Since 20260924: refuses any PAID order whatever its status (ord_is_pay=1 or non-blank ord_date_pay, same predicate as getCustomerCancelRefusal), refuses status 2 (already cancelled) and 5, and accepts only the canon transitions 1|3|4 -> 2 (invalid transition otherwise). Owner: OrdersService.cancelOrder per authority-graph.yaml#rpc_authority.rpcs.cancel_order_atomic.';

REVOKE EXECUTE ON FUNCTION public.cancel_order_atomic(p_ord_id text, p_reason text, p_user_id bigint, p_correlation_id uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cancel_order_atomic(p_ord_id text, p_reason text, p_user_id bigint, p_correlation_id uuid) TO service_role;
