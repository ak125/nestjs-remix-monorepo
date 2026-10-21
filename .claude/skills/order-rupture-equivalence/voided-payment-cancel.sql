-- Annulation en base d'une commande payée dont le paiement a été annulé dans l'espace Paybox
-- AVANT encaissement — skill order-rupture-equivalence, §8.
--
-- MODÈLE : le copier en scratchpad, renseigner les constantes, ne jamais committer la copie
-- remplie (données client).
--   c_apply = false : contrôles seuls, aucune écriture (passe dans une session READ ONLY) ;
--   c_apply = true  : annulation, sur GO nominatif de l'owner (zone STOP commande).
--
-- À lancer seulement quand l'owner a confirmé, dans l'espace Paybox, que la transaction est
-- ANNULÉE, pas encaissée. Une commande encaissée puis remboursée n'a pas ce chemin : elle reste
-- « payée » en base (§Trous).
--
-- Passe par cancel_order_payment_voided_atomic : statut '2', date et motif d'annulation, et
-- événement ORDER_CANCELLED journalisé avec l'attestation, en une transaction. Les champs de
-- paiement (ord_is_pay, ord_date_pay, payment_confirmed) et les retours Paybox restent tels
-- quels : la trace du paiement d'origine reste entière. Aucun mail ne part : les mails sont émis
-- par le code applicatif, pas par la base.
--
-- La fonction n'est exécutable que par le propriétaire de la base (postgres) : execute_sql du MCP
-- Supabase ou éditeur SQL Supabase, jamais l'application.
-- Jamais la route admin POST /api/admin/orders/:id/cancel (bouton « Annuler ») à la place : elle
-- envoie au client un mail d'annulation automatique, non validé.

DO $voided$
DECLARE
  c_apply       CONSTANT boolean := false;
  c_order       CONSTANT text    := '';  -- commande payée dont le paiement est annulé (ORD-…)
  c_attested_by CONSTANT text    := '';  -- qui a vu l'annulation dans l'espace Paybox, et quand
  c_reason      CONSTANT text    := 'Rupture fournisseur : paiement annulé dans Paybox avant encaissement';
  v_order       public.___xtr_order%ROWTYPE;
  v_n           integer;
BEGIN
  IF c_order !~ '^ORD-[0-9]+-[0-9]{3}$' THEN
    RAISE EXCEPTION 'ABORT: constante c_order non renseignée ou mal formée';
  END IF;
  IF c_attested_by !~ '[^[:space:]]' OR c_reason !~ '[^[:space:]]' THEN
    RAISE EXCEPTION 'ABORT: attestation ou motif non renseigné';
  END IF;
  IF to_regprocedure('public.cancel_order_payment_voided_atomic(text, text, text, uuid)') IS NULL THEN
    RAISE EXCEPTION 'ABORT: cancel_order_payment_voided_atomic absente (migration non appliquée) — la commande reste « payée », l''owner la retient';
  END IF;

  SELECT * INTO v_order FROM public.___xtr_order WHERE ord_id = c_order;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ABORT: commande % introuvable', c_order;
  END IF;
  IF v_order.ord_ords_id = '2' THEN
    RAISE EXCEPTION 'ABORT: % est déjà annulée', c_order;
  END IF;
  -- Même prédicat « payée » que la fonction : sinon, c'est le cas de cancel_order_atomic.
  IF NOT (coalesce(v_order.ord_is_pay, '') = '1'
          OR coalesce(v_order.ord_date_pay, '') ~ '[^[:space:]]') THEN
    RAISE EXCEPTION 'ABORT: % n''est pas payée — ce n''est pas ce script', c_order;
  END IF;
  IF v_order.ord_ords_id IS NULL OR v_order.ord_ords_id NOT IN ('1', '3', '4') THEN
    RAISE EXCEPTION 'ABORT: % au statut % — seuls 1, 3 et 4 passent à « annulée »',
      c_order, coalesce(v_order.ord_ords_id, 'NULL');
  END IF;
  IF v_order.ord_cancel_date IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT: % porte déjà une date d''annulation (%) — owner', c_order, v_order.ord_cancel_date;
  END IF;
  SELECT count(*) INTO v_n FROM public.___xtr_order
   WHERE ord_parent = c_order AND ord_ords_id IS DISTINCT FROM '2';
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'ABORT: % supplément(s) non annulé(s) pour % — les annuler d''abord (supplement-cancel.sql)', v_n, c_order;
  END IF;

  IF NOT c_apply THEN
    RAISE NOTICE 'CONTRÔLES OK, rien n''est écrit : % (statut %, ord_is_pay %, payée le %) annulable',
      c_order, v_order.ord_ords_id, v_order.ord_is_pay, v_order.ord_date_pay;
    RETURN;
  END IF;

  PERFORM public.cancel_order_payment_voided_atomic(c_order, c_reason, c_attested_by, gen_random_uuid());

  SELECT count(*) INTO v_n FROM public.___xtr_order
   WHERE ord_id = c_order AND ord_ords_id = '2' AND ord_cancel_date IS NOT NULL
     AND ord_is_pay IS NOT DISTINCT FROM v_order.ord_is_pay
     AND ord_date_pay IS NOT DISTINCT FROM v_order.ord_date_pay;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ABORT: % non annulée, ou champs de paiement modifiés, après l''appel', c_order;
  END IF;
  SELECT count(*) INTO v_n FROM public.___xtr_order_history
   WHERE ord_id = c_order AND event_type = 'ORDER_CANCELLED' AND source = 'owner_attestation';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ABORT: % événement(s) ORDER_CANCELLED d''attestation pour %, attendu 1', v_n, c_order;
  END IF;
  RAISE NOTICE 'OK : % annulée, paiement d''origine conservé', c_order;
END
$voided$;
