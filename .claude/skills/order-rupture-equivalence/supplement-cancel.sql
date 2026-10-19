-- Annulation d'une commande de supplément refusée — skill order-rupture-equivalence, §8.
--
-- MODÈLE : le copier en scratchpad, renseigner les constantes, ne jamais committer la copie
-- remplie (données client).
--   c_apply = false : contrôles seuls, aucune écriture (passe dans une session READ ONLY) ;
--   c_apply = true  : annulation, sur GO nominatif de l'owner (zone STOP commande).
--
-- Passe par la fonction du site cancel_order_atomic : statut '2' et événement ORDER_CANCELLED
-- journalisé, en une transaction. Elle refuse une commande payée. Aucun mail ne part : les mails
-- d'annulation sont émis par le code applicatif, pas par la base.
--
-- Ce que l'annulation NE fait PAS : couper le lien de paiement. Le lien ne lit pas le statut, et
-- un paiement reçu remettrait la commande en « payée » (mark_order_paid_atomic). Si cela arrive,
-- elle réapparaît payée dans l'admin : livrer ou rembourser, sur décision de l'owner.
--
-- Jamais de DELETE à la place : ___xtr_order_history référence la commande (clé étrangère
-- RESTRICT) et ce journal ne s'efface pas.
-- Jamais la route admin POST /api/admin/orders/:id/cancel : elle écrit un statut hors canon,
-- contourne cancel_order_atomic et le journal, et envoie au client deux mails d'annulation.

DO $cancel$
DECLARE
  c_apply   CONSTANT boolean := false;
  c_parent  CONSTANT text    := '';  -- commande payée d'origine (ORD-…)
  c_child   CONSTANT text    := '';  -- commande de supplément à annuler (ORD-…)
  c_reason  CONSTANT text    := 'Supplément refusé par le client : équivalence non retenue';
  v_order   public.___xtr_order%ROWTYPE;
  v_n       integer;
BEGIN
  IF c_parent !~ '^ORD-[0-9]+-[0-9]{3}$' OR c_child !~ '^ORD-[0-9]+-[0-9]{3}$' THEN
    RAISE EXCEPTION 'ABORT: constantes non renseignées ou mal formées';
  END IF;

  SELECT * INTO v_order FROM public.___xtr_order WHERE ord_id = c_child;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ABORT: commande % introuvable', c_child;
  END IF;
  IF v_order.ord_parent IS DISTINCT FROM c_parent THEN
    RAISE EXCEPTION 'ABORT: % n''est pas un supplément de % (ord_parent = %)',
      c_child, c_parent, v_order.ord_parent;
  END IF;
  IF v_order.ord_is_pay <> '0' OR v_order.payment_confirmed IS TRUE
     OR coalesce(v_order.ord_date_pay, '') <> '' THEN
    RAISE EXCEPTION 'ABORT: % est payée — ne pas annuler, rembourser depuis l''espace Paybox', c_child;
  END IF;
  SELECT count(*) INTO v_n FROM public.ic_postback WHERE orderid = c_child;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'ABORT: % retour(s) de paiement enregistré(s) pour % — owner', v_n, c_child;
  END IF;
  IF v_order.ord_ords_id = '2' THEN
    RAISE EXCEPTION 'ABORT: % est déjà annulée', c_child;
  END IF;

  IF NOT c_apply THEN
    RAISE NOTICE 'CONTRÔLES OK, rien n''est écrit : % (statut %) annulable', c_child, v_order.ord_ords_id;
    RETURN;
  END IF;

  PERFORM public.cancel_order_atomic(c_child, c_reason, NULL, gen_random_uuid());

  SELECT count(*) INTO v_n FROM public.___xtr_order
   WHERE ord_id = c_child AND ord_ords_id = '2' AND ord_is_pay = '0';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ABORT: % non annulée après l''appel', c_child;
  END IF;
  RAISE NOTICE 'OK : supplément % annulé', c_child;
END
$cancel$;
