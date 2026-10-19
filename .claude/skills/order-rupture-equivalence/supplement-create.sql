-- Commande de supplément — skill order-rupture-equivalence, §6.
--
-- MODÈLE : le copier en scratchpad, renseigner les constantes, ne jamais committer la copie
-- remplie (données client). Le bloc refuse de partir tant qu'une constante manque.
--   c_apply = false : pré-contrôles seuls, aucune écriture (passe dans une session READ ONLY) ;
--   c_apply = true  : création, sur GO nominatif de l'owner (zone STOP commande).
--
-- Crée, par la fonction du site create_order_atomic (commande + ligne + événement ORDER_CREATED,
-- en une transaction), une commande ENFANT non payée de la commande d'origine. Son total est le
-- supplément ; c'est lui que lit le lien de paiement. Port et consigne à 0 : le port déjà payé
-- reste acquis. Rien n'est envoyé au client : le mail du site ne part qu'au paiement.
-- Tout est un seul bloc DO : une vérification fausse annule tout.
-- Si le client refuse : supplement-cancel.sql.

DO $supplement$
DECLARE
  -- Constantes relevées aux étapes 1 à 5, identiques aux chiffres du mail.
  c_apply   CONSTANT boolean := false;
  c_parent  CONSTANT text    := '';  -- commande payée d'origine (ORD-…)
  c_line    CONSTANT text    := '';  -- orl_id de la ligne en rupture
  c_piece   CONSTANT integer := 0;   -- piece_id de l'équivalent retenu
  c_qty     CONSTANT integer := 0;   -- nombre de pièces de l'équivalent
  c_vente   CONSTANT numeric := 0;   -- prix TTC unitaire de l'équivalent écrit dans le mail
  c_achat   CONSTANT numeric := 0;   -- prix d'achat HT de l'équivalent confirmé au portail
  c_total   CONSTANT numeric := 0;   -- supplément écrit dans le mail
  v_parent  public.___xtr_order%ROWTYPE;
  v_line    public.___xtr_order_line%ROWTYPE;
  v_piece   record;
  v_n       integer;
  v_lines   numeric;
  v_deps    numeric;
  v_paid    numeric;
  v_total   numeric;
  v_unit    numeric;
  v_ts      text;
  v_child   text;
BEGIN
  -- §0 Constantes renseignées.
  IF c_parent !~ '^ORD-[0-9]+-[0-9]{3}$' OR c_line = '' OR c_piece <= 0 OR c_qty <= 0
     OR c_vente <= 0 OR c_achat <= 0 OR c_total <= 0 THEN
    RAISE EXCEPTION 'ABORT: constantes non renseignées ou mal formées';
  END IF;

  -- §1 Commande d'origine : payée, non annulée, montants cohérents avec ses lignes
  --    (un écart = remise ou retouche sur la commande : hors procédure, owner).
  SELECT * INTO v_parent FROM public.___xtr_order WHERE ord_id = c_parent;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ABORT: commande d''origine % introuvable', c_parent;
  END IF;
  IF v_parent.ord_is_pay <> '1' OR coalesce(v_parent.ord_date_pay, '') = ''
     OR v_parent.ord_ords_id = '2' THEN
    RAISE EXCEPTION 'ABORT: commande d''origine non payée ou annulée (payée=%, date=%, statut=%)',
      v_parent.ord_is_pay, v_parent.ord_date_pay, v_parent.ord_ords_id;
  END IF;
  SELECT sum(coalesce(nullif(orl_art_price_sell_ttc, ''), '0')::numeric),
         sum(coalesce(nullif(orl_art_deposit_ttc, ''), '0')::numeric)
    INTO v_lines, v_deps
    FROM public.___xtr_order_line WHERE orl_ord_id = c_parent;
  IF v_lines IS DISTINCT FROM coalesce(nullif(v_parent.ord_amount_ttc, ''), '0')::numeric
     OR v_deps IS DISTINCT FROM coalesce(nullif(v_parent.ord_deposit_ttc, ''), '0')::numeric THEN
    RAISE EXCEPTION 'ABORT: lignes (pièces %, consigne %) ≠ commande (pièces %, consigne %)',
      v_lines, v_deps, v_parent.ord_amount_ttc, v_parent.ord_deposit_ttc;
  END IF;

  -- §2 Ligne en rupture : dans la commande d'origine ; montant payé pour elle.
  SELECT * INTO v_line FROM public.___xtr_order_line
   WHERE orl_id = c_line AND orl_ord_id = c_parent;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ABORT: ligne % absente de %', c_line, c_parent;
  END IF;
  v_paid := coalesce(nullif(v_line.orl_art_price_sell_ttc, ''), '0')::numeric
          + coalesce(nullif(v_line.orl_art_deposit_ttc, ''), '0')::numeric;
  IF v_paid <= 0 THEN
    RAISE EXCEPTION 'ABORT: montant payé pour la ligne % illisible', c_line;
  END IF;

  -- §3 Aucun supplément déjà rattaché ; id enfant au format du site, préfixe libre
  --    (le lien de paiement résout aussi un id par son préfixe ORD-<horodatage>).
  SELECT count(*) INTO v_n FROM public.___xtr_order WHERE ord_parent = c_parent;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'ABORT: % commande(s) déjà rattachée(s) à % — supplément déjà créé ?', v_n, c_parent;
  END IF;
  v_ts    := floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint::text;
  v_child := 'ORD-' || v_ts || '-' || lpad(floor(random() * 1000)::int::text, 3, '0');
  SELECT count(*) INTO v_n FROM public.___xtr_order WHERE ord_id LIKE 'ORD-' || v_ts || '%';
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'ABORT: préfixe ORD-% déjà pris, relancer', v_ts;
  END IF;

  -- §4 Équivalent : affiché, une seule ligne tarif vendable, au prix du mail, sans consigne,
  --    jamais à perte (achat en base ET achat confirmé au portail).
  SELECT count(*) INTO v_n FROM public.pieces_price
   WHERE pri_piece_id_i = c_piece AND pricing_state = 'ACTIVE' AND pri_dispo = '1';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ABORT: % ligne(s) tarif vendable(s) pour la pièce %, 1 attendue', v_n, c_piece;
  END IF;
  SELECT p.piece_id, p.piece_ref, p.piece_name, pm.pm_name,
         nullif(pp.pri_vente_ttc, '')::numeric                    AS vente_ttc,
         nullif(pp.pri_vente_ht, '')::numeric                     AS vente_ht,
         coalesce(nullif(pp.pri_achat_ht, ''), '0')::numeric      AS achat_ht,
         coalesce(nullif(pp.pri_consigne_ttc, ''), '0')::numeric  AS consigne
    INTO v_piece
    FROM public.pieces p
    JOIN public.pieces_price pp
      ON pp.pri_piece_id_i = p.piece_id AND pp.pricing_state = 'ACTIVE' AND pp.pri_dispo = '1'
    JOIN public.pieces_marque pm ON pm.pm_id = p.piece_pm_id
   WHERE p.piece_id = c_piece AND p.piece_display = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ABORT: pièce % non affichée, ou marque introuvable', c_piece;
  END IF;
  IF v_piece.piece_id::text = v_line.orl_pg_id THEN
    RAISE EXCEPTION 'ABORT: la pièce % est celle en rupture', c_piece;
  END IF;
  IF v_piece.vente_ttc IS DISTINCT FROM c_vente THEN
    RAISE EXCEPTION 'ABORT: prix TTC lu %, % écrit dans le mail', v_piece.vente_ttc, c_vente;
  END IF;
  IF v_piece.consigne <> 0 THEN
    RAISE EXCEPTION 'ABORT: équivalent à consigne (% TTC) — hors procédure, owner', v_piece.consigne;
  END IF;
  IF v_piece.vente_ht IS NULL OR v_piece.vente_ht < greatest(v_piece.achat_ht, c_achat) THEN
    RAISE EXCEPTION 'ABORT: vente à perte (vente HT %, achat HT en base %, achat HT portail %)',
      v_piece.vente_ht, v_piece.achat_ht, c_achat;
  END IF;

  -- §5 Montant = quantité × prix TTC − payé pour la ligne (pièces + consigne).
  v_total := c_qty * c_vente - v_paid;
  v_unit  := round(v_total / c_qty, 2);
  IF v_total <> c_total THEN
    RAISE EXCEPTION 'ABORT: supplément calculé % (% × % − %), % écrit dans le mail',
      v_total, c_qty, c_vente, v_paid, c_total;
  END IF;
  IF v_unit * c_qty <> v_total THEN
    RAISE EXCEPTION 'ABORT: supplément % non divisible au centime par % — owner', v_total, c_qty;
  END IF;

  IF NOT c_apply THEN
    RAISE NOTICE 'PRÉ-CONTRÔLES OK, rien n''est écrit : supplément % € TTC (% × % − %) pour %',
      v_total, c_qty, c_vente, v_paid, c_parent;
    RETURN;
  END IF;

  -- §6 Création par la fonction du site.
  PERFORM public.create_order_atomic(
    jsonb_build_object(
      'ord_id',                v_child,
      'ord_cst_id',            v_parent.ord_cst_id,
      'ord_date',              to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'ord_parent',            c_parent,
      'ord_is_pay',            '0',
      'ord_amount_ttc',        to_char(v_total, 'FM999990.00'),
      'ord_deposit_ttc',       '0.00',
      'ord_shipping_fee_ttc',  '0.00',
      'ord_total_ttc',         to_char(v_total, 'FM999990.00'),
      'ord_info',              format('Supplément de la commande %s : %s × %s %s (%s € TTC) au lieu de %s %s'
                                      ' en rupture fournisseur, moins %s € déjà payés ; port déjà payé'
                                      ' sur la commande d''origine.',
                                      c_parent, c_qty, v_piece.pm_name, v_piece.piece_ref,
                                      to_char(c_vente, 'FM999990.00'), v_line.orl_pm_name,
                                      v_line.orl_art_ref, to_char(v_paid, 'FM999990.00')),
      'ord_ords_id',           '1',
      'ord_cba_id',            coalesce(v_parent.ord_cba_id, ''),
      'ord_cda_id',            coalesce(v_parent.ord_cda_id, ''),
      'ord_billing_snapshot',  v_parent.ord_billing_snapshot,
      'ord_shipping_snapshot', v_parent.ord_shipping_snapshot
    ),
    jsonb_build_array(jsonb_build_object(
      'orl_id',                      v_child || '-L001',
      'orl_pg_id',                   c_piece::text,
      'orl_pg_name',                 format('%s — supplément échange (remplace %s %s)',
                                            v_piece.piece_name, v_line.orl_pm_name, v_line.orl_art_ref),
      'orl_pm_name',                 v_piece.pm_name,
      'orl_art_ref',                 v_piece.piece_ref,
      'orl_art_quantity',            c_qty::text,
      'orl_art_price_sell_unit_ttc', to_char(v_unit, 'FM999990.00'),
      'orl_art_price_sell_ttc',      to_char(v_total, 'FM999990.00')
    )),
    gen_random_uuid()
  );

  -- §7 Contrôle après écriture.
  SELECT count(*) INTO v_n FROM public.___xtr_order
   WHERE ord_id = v_child AND ord_parent = c_parent AND ord_is_pay = '0'
     AND ord_total_ttc = to_char(v_total, 'FM999990.00')
     AND ord_cst_id = v_parent.ord_cst_id AND payment_confirmed IS NOT TRUE;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ABORT: commande de supplément non conforme après création';
  END IF;
  SELECT count(*) INTO v_n FROM public.___xtr_order_line
   WHERE orl_ord_id = v_child AND orl_art_price_sell_ttc = to_char(v_total, 'FM999990.00');
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ABORT: ligne de supplément non conforme après création';
  END IF;

  RAISE NOTICE 'OK : commande % créée (% € TTC, non payée), rattachée à %', v_child, v_total, c_parent;
END
$supplement$;

-- Constat (lecture seule) — remplacer '' par la valeur de c_parent.
SELECT o.ord_id, o.ord_parent, o.ord_total_ttc, o.ord_is_pay, o.ord_ords_id,
       l.orl_pm_name, l.orl_art_ref, l.orl_art_quantity,
       l.orl_art_price_sell_unit_ttc, l.orl_art_price_sell_ttc
  FROM public.___xtr_order o
  JOIN public.___xtr_order_line l ON l.orl_ord_id = o.ord_id
 WHERE o.ord_parent = '';
