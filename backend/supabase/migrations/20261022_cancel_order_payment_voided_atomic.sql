-- Migration : cancel_order_payment_voided_atomic — annuler en base une commande
-- payée dont le paiement a été annulé dans l'espace Paybox AVANT encaissement.
--
-- PROBLÈME
--   Quand une commande payée ne peut pas être livrée (rupture fournisseur),
--   l'owner annule la transaction dans l'espace Paybox tant qu'elle n'est pas
--   encaissée : le client n'est jamais prélevé. En base, rien ne le dit : la
--   commande reste « payée » (statut '3'), l'admin la montre à expédier et le
--   KPI « Ventes — paiements gardés » la compte comme une vente gardée.
--   cancel_order_atomic refuse toute commande payée (20260924), à raison : elle
--   ne sait pas si l'argent a été rendu. Aucun chemin gouverné ne couvre ce cas ;
--   le seul autre chemin, la route admin d'annulation, envoie au client un mail
--   automatique non validé (skill order-rupture-equivalence, §Trous).
--
-- POURQUOI LE REFUS DE 20260924 NE S'APPLIQUE PAS ICI
--   Annuler une commande payée en gardant l'argent crée un litige client et un
--   écart comptable (packages/domain-commerce/src/order-status.ts). Ici aucun
--   argent n'a été encaissé. La base ne peut pas le constater : l'annulation
--   Paybox ne renvoie aucun retour au site. La fonction exige donc une
--   attestation explicite (p_attested_by) et l'inscrit dans le journal. Elle ne
--   sert PAS pour une commande encaissée puis remboursée : un remboursement n'a
--   pas de chemin gouverné, la commande reste « payée ».
--
-- CHANGEMENT (un seul objet créé : cancel_order_payment_voided_atomic)
--   Décision prise sur la ligne verrouillée (FOR UPDATE), contrôles dans l'ordre
--   de cancel_order_atomic :
--     1. déjà annulée ('2') → refus « already cancelled » ;
--     2. NON payée → refus : c'est le cas de cancel_order_atomic. Prédicat
--        « payée » identique au sien (ord_is_pay='1' OU ord_date_pay contenant
--        un caractère non blanc). Pour une commande au statut 1, 3 ou 4, l'une
--        des deux fonctions accepte, jamais les deux ;
--     3. transition hors canon → refus : seuls 1|3|4 -> 2 (@repo/domain-commerce).
--        Le statut '5' (en préparation) reste terminal, '6' et l'absence de
--        statut sont refusés.
--   Puis, dans la même transaction, la même écriture que cancel_order_atomic
--   (statut '2', date et motif d'annulation, ord_updated_at) et l'événement
--   ORDER_CANCELLED via append_order_event. Son payload porte le motif,
--   payment_voided_before_capture = true, l'auteur de l'attestation et l'état
--   de paiement lu sous verrou.
--   Les champs de paiement (ord_is_pay, ord_date_pay, payment_confirmed) et les
--   retours Paybox (ic_postback) ne sont PAS touchés : la trace du paiement
--   d'origine reste entière. Le KPI classe alors la commande « annulée après
--   paiement » (classifyOrderPayment, command-center-kpi.service.ts).
--
-- CE QUI N'EST PAS TOUCHÉ
--   cancel_order_atomic, append_order_event, mark_order_paid_atomic, le module
--   payments/ et l'application : aucun appelant ajouté. Aucun mail : ils partent
--   de l'application, jamais de la base (aucun trigger sur ___xtr_order,
--   vérifié le 2026-10-22). Aucune donnée modifiée par la migration elle-même.
--
-- DROITS
--   Exécutable par son propriétaire seul (postgres), le rôle des opérations
--   manuelles. Les privilèges par défaut de Supabase accordent EXECUTE aux rôles
--   d'API sur toute fonction nouvelle : ils sont révoqués ci-dessous, service_role
--   compris, car aucun code de l'application ne doit pouvoir appeler cette
--   fonction (garde scripts/lint/check-definer-anon-surface.sh).
--
-- VERROUS
--   CREATE FUNCTION ne verrouille aucune table. Timeouts explicites ci-dessous.
--
-- ROLLBACK
--   20261022_cancel_order_payment_voided_atomic.down.sql supprime la fonction.
--   Les commandes déjà annulées par elle restent annulées, leurs événements
--   restent au journal.
--
-- PREUVE
--   scripts/db/test-cancel-order-payment-voided-atomic.sh : PostgreSQL 17
--   jetable, vraies migrations du domaine commande, matrice de décision,
--   partition avec cancel_order_atomic, course « deux annulations simultanées »,
--   droits, idempotence, rollback.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Pré-condition, en lecture seule (apply-migration.sh la joue avant le moteur).
DO $precheck$
DECLARE
  v_missing text;
BEGIN
  IF to_regprocedure('public.append_order_event(text, text, text, text, jsonb, text, uuid, bigint)') IS NULL THEN
    RAISE EXCEPTION 'precheck: public.append_order_event(text, text, text, text, jsonb, text, uuid, bigint) absente';
  END IF;

  SELECT string_agg(c, ', ') INTO v_missing
  FROM unnest(ARRAY['ord_id', 'ord_ords_id', 'ord_is_pay', 'ord_date_pay',
                    'ord_cancel_date', 'ord_cancel_reason', 'ord_updated_at']) AS c
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = '___xtr_order' AND column_name = c
  );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'precheck: colonnes absentes de public.___xtr_order : %', v_missing;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.___xtr_order_status WHERE ords_id = '2') THEN
    RAISE EXCEPTION 'precheck: statut ''2'' absent de public.___xtr_order_status';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.___xtr_order_history'::regclass
      AND conname = 'chk_order_history_event_type'
      AND pg_get_constraintdef(oid) LIKE '%''ORDER_CANCELLED''%'
  ) THEN
    RAISE EXCEPTION 'precheck: ORDER_CANCELLED non admis par chk_order_history_event_type';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname = 'cancel_order_payment_voided_atomic'
      AND pg_get_function_identity_arguments(oid)
          <> 'p_ord_id text, p_reason text, p_attested_by text, p_correlation_id uuid'
  ) THEN
    RAISE EXCEPTION 'precheck: une autre surcharge de cancel_order_payment_voided_atomic existe';
  END IF;
END
$precheck$;

CREATE OR REPLACE FUNCTION public.cancel_order_payment_voided_atomic(
  p_ord_id         TEXT,
  p_reason         TEXT,
  p_attested_by    TEXT,
  p_correlation_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_from_status TEXT;
  v_is_pay      TEXT;
  v_date_pay    TEXT;
  v_payload     JSONB;
BEGIN
  IF p_ord_id IS NULL OR p_ord_id = '' THEN
    RAISE EXCEPTION 'cancel_order_payment_voided_atomic: p_ord_id is required';
  END IF;

  IF p_correlation_id IS NULL THEN
    RAISE EXCEPTION 'cancel_order_payment_voided_atomic: p_correlation_id is required';
  END IF;

  IF COALESCE(p_reason, '') !~ '[^[:space:]]' THEN
    RAISE EXCEPTION 'cancel_order_payment_voided_atomic: p_reason is required';
  END IF;

  IF COALESCE(p_attested_by, '') !~ '[^[:space:]]' THEN
    RAISE EXCEPTION 'cancel_order_payment_voided_atomic: p_attested_by is required (who saw the payment voided in Paybox)';
  END IF;

  -- Lock the row, then decide on the locked values only.
  SELECT ord_ords_id, ord_is_pay, ord_date_pay
    INTO v_from_status, v_is_pay, v_date_pay
  FROM public.___xtr_order
  WHERE ord_id = p_ord_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cancel_order_payment_voided_atomic: order % not found', p_ord_id;
  END IF;

  IF v_from_status = '2' THEN
    RAISE EXCEPTION 'cancel_order_payment_voided_atomic: order % already cancelled (status 2)', p_ord_id;
  END IF;

  -- Paid = same predicate as cancel_order_atomic and getCustomerCancelRefusal.
  -- NULL-safe: a NULL ord_is_pay without a payment date is unpaid, as there.
  IF NOT (COALESCE(v_is_pay, '') = '1' OR COALESCE(v_date_pay, '') ~ '[^[:space:]]') THEN
    RAISE EXCEPTION 'cancel_order_payment_voided_atomic: order % is not paid — use cancel_order_atomic', p_ord_id;
  END IF;

  -- Canon transitions to CANCELLED: 1|3|4 -> 2 (@repo/domain-commerce).
  IF v_from_status IS NULL OR v_from_status NOT IN ('1', '3', '4') THEN
    RAISE EXCEPTION 'cancel_order_payment_voided_atomic: order % status % invalid transition to cancelled (canon 1|3|4 -> 2)',
      p_ord_id, COALESCE(v_from_status, 'NULL');
  END IF;

  -- Payment fields stay as they are: the original payment remains traceable.
  UPDATE public.___xtr_order
  SET ord_ords_id       = '2',
      ord_cancel_date   = now(),
      ord_cancel_reason = p_reason,
      ord_updated_at    = now()
  WHERE ord_id = p_ord_id;

  v_payload := jsonb_build_object(
    'reason', p_reason,
    'payment_voided_before_capture', true,
    'attested_by', p_attested_by,
    'ord_is_pay', v_is_pay,
    'ord_date_pay', v_date_pay
  );

  -- Audit event in the same transaction (rollback if this fails).
  PERFORM public.append_order_event(
    p_ord_id, 'ORDER_CANCELLED', v_from_status, '2',
    v_payload, 'owner_attestation',
    p_correlation_id, NULL
  );
END;
$function$;

COMMENT ON FUNCTION public.cancel_order_payment_voided_atomic(TEXT, TEXT, TEXT, UUID) IS
  'Cancels a PAID order whose payment was voided in Paybox before capture, on an explicit attestation (p_attested_by). Decides on the locked row: refuses status 2, unpaid orders (cancel_order_atomic covers them, same paid predicate) and non-canon transitions (canon 1|3|4 -> 2). Sets status 2 + cancel date/reason, keeps every payment field, appends ORDER_CANCELLED (payload payment_voided_before_capture=true) in the same transaction. Not for refunded orders. Owner-only (postgres): no application caller. Procedure: skill order-rupture-equivalence §8.';

REVOKE EXECUTE ON FUNCTION public.cancel_order_payment_voided_atomic(p_ord_id text, p_reason text, p_attested_by text, p_correlation_id uuid) FROM PUBLIC, anon, authenticated, service_role;
