-- =============================================================================
-- Migration : facturation à l'expédition — ajustements, état d'encaissement,
--             numérotation continue des factures (mandat BM, 2026-11-17)
-- Scope     : 3 tables nouvelles + 1 fonction nouvelle. Aucune table existante
--             modifiée, aucune donnée existante touchée.
-- Statut    : PRÉPARÉE, NON APPLIQUÉE. Application = workflow manuel
--             « Apply Supabase migrations (manual) », par l'owner.
-- Forward-only. Retour arrière documentaire : .down.sql voisin.
-- =============================================================================
--
-- POURQUOI (décisions D26, D64 amendée, Marwane 2026-11-17) :
--   * la facture part à l'expédition, une fois l'encaissement Verifone réel
--     confirmé, avec les montants réels (moins cher : seul le montant réel est
--     encaissé ; plus cher : supplément payé à part, sur lien) ;
--   * l'ajustement et son motif sont inscrits sur la commande et sur la facture ;
--   * numérotation continue, sans trou.
--
-- MESURÉ (2026-11-17, base réelle, lecture seule) :
--   * ___xtr_invoice : 1 ligne, inv_id = '0' (ligne de remplissage legacy) ;
--     aucune facture n'a jamais été émise par le site. ___xtr_invoice_line : RLS
--     active, politique service_role seule (comme ___xtr_invoice).
--   * Montants de ___xtr_order / ___xtr_order_line : texte « 12.34 » ; HT et TVA
--     vides sur les commandes récentes : le backend calcule le HT.
--
-- NUMÉROTATION SANS TROU : un compteur par année, verrouillé FOR UPDATE dans la
-- même transaction que l'insertion de la facture et de ses lignes. Une erreur
-- annule tout, compteur compris : pas de trou. Pas de SEQUENCE (une séquence
-- n'est pas transactionnelle et laisse des trous). Le verrou sérialise aussi les
-- émissions : le contrôle « une seule facture par commande » se fait sous verrou,
-- sans index ajouté à la table legacy.
-- Format proposé : F<année>-<6 chiffres>, ex. F2026-000001 — à valider par le
-- comptable (docs/facturation/mentions-facture-a-valider.md).
--
-- DROITS : RLS active et aucune politique pour anon/authenticated sur les
-- 3 tables ; la fonction est réservée à service_role (SECURITY DEFINER,
-- search_path fixé), comme les autres RPC de commande.
--
-- assume_in_transaction (squawk) : pas de BEGIN/COMMIT explicite.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

-- 1. Ajustements de paiement d'une commande ---------------------------------
--    reduction  : moins cher (pièce ou port) — seul le montant réel est encaissé ;
--    supplement : plus cher — commande enfant payée sur lien (ord_parent).
CREATE TABLE IF NOT EXISTS public.__order_payment_adjustment (
  opa_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  opa_ord_id text NOT NULL,
  opa_kind text NOT NULL CHECK (opa_kind IN ('reduction', 'supplement')),
  opa_amount_ttc_cents integer NOT NULL CHECK (opa_amount_ttc_cents > 0),
  opa_reason text NOT NULL CHECK (char_length(btrim(opa_reason)) BETWEEN 3 AND 500),
  opa_supplement_ord_id text NULL,
  opa_created_by text NULL,
  opa_created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT __order_payment_adjustment_supplement_child_chk
    CHECK ((opa_kind = 'supplement') = (opa_supplement_ord_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS __order_payment_adjustment_ord_idx
  ON public.__order_payment_adjustment (opa_ord_id);
ALTER TABLE public.__order_payment_adjustment ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.__order_payment_adjustment FROM anon, authenticated;
COMMENT ON TABLE public.__order_payment_adjustment IS
  'Mandat BM : ajustements de paiement (réduction avant encaissement, supplément sur lien) et leur motif.';

-- 2. État d'encaissement d'une commande -------------------------------------
--    source manual        : relevé par l'owner dans le back-office Verifone ;
--    source paybox_direct : réservé à la lecture automatique (Paybox Direct,
--                           type 00017), non branchée — voir le rapport BM.
CREATE TABLE IF NOT EXISTS public.__order_capture_state (
  ocs_ord_id text PRIMARY KEY,
  ocs_state text NOT NULL
    CHECK (ocs_state IN ('authorized', 'captured', 'cancelled', 'refunded')),
  ocs_captured_amount_cents integer NULL CHECK (ocs_captured_amount_cents >= 0),
  ocs_source text NOT NULL CHECK (ocs_source IN ('manual', 'paybox_direct')),
  ocs_checked_at timestamptz NOT NULL DEFAULT now(),
  ocs_updated_by text NULL,
  CONSTRAINT __order_capture_state_captured_amount_chk
    CHECK (ocs_state <> 'captured' OR ocs_captured_amount_cents IS NOT NULL)
);
ALTER TABLE public.__order_capture_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.__order_capture_state FROM anon, authenticated;
COMMENT ON TABLE public.__order_capture_state IS
  'Mandat BM : état d''encaissement Verifone par commande (autorisé, encaissé, annulé, remboursé) et montant encaissé.';

-- 3. Compteur de numérotation des factures ----------------------------------
CREATE TABLE IF NOT EXISTS public.__invoice_number_counter (
  inc_year integer PRIMARY KEY CHECK (inc_year BETWEEN 2026 AND 2999),
  inc_last_number integer NOT NULL CHECK (inc_last_number >= 0)
);
ALTER TABLE public.__invoice_number_counter ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.__invoice_number_counter FROM anon, authenticated;
COMMENT ON TABLE public.__invoice_number_counter IS
  'Mandat BM : dernier numéro de facture émis par année ; modifié seulement par issue_order_invoice_atomic.';

-- 4. Émission atomique d'une facture ----------------------------------------
--    Le backend calcule les montants (OrderBillingService, testé) ; la base
--    attribue le numéro, revérifie les conditions et insère tout d'un bloc.
CREATE OR REPLACE FUNCTION public.issue_order_invoice_atomic(
  p_invoice jsonb,
  p_lines jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ord_id text := p_invoice->>'inv_ord_id';
  v_now timestamp := now() AT TIME ZONE 'Europe/Paris';
  v_year integer := extract(year FROM v_now)::integer;
  v_last integer;
  v_inv_id text;
  v_line jsonb;
  v_index integer := 0;
BEGIN
  IF v_ord_id IS NULL OR btrim(v_ord_id) = '' THEN
    RAISE EXCEPTION 'inv_ord_id requis' USING ERRCODE = '22023';
  END IF;
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array'
     OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'au moins une ligne de facture requise' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.__invoice_number_counter (inc_year, inc_last_number)
  VALUES (v_year, 0)
  ON CONFLICT (inc_year) DO NOTHING;

  SELECT inc_last_number INTO v_last
  FROM public.__invoice_number_counter
  WHERE inc_year = v_year
  FOR UPDATE;

  -- Sous verrou : une seule facture par commande.
  IF EXISTS (SELECT 1 FROM public.___xtr_invoice WHERE inv_ord_id = v_ord_id) THEN
    RAISE EXCEPTION 'facture déjà émise pour la commande %', v_ord_id
      USING ERRCODE = '23505';
  END IF;
  -- Conditions D64 revérifiées en base : payée, expédiée, encaissement confirmé.
  IF NOT EXISTS (
    SELECT 1 FROM public.___xtr_order
    WHERE ord_id = v_ord_id AND ord_is_pay = '1' AND ord_date_ship IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'commande % non payée ou non expédiée', v_ord_id
      USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.__order_capture_state
    WHERE ocs_ord_id = v_ord_id AND ocs_state = 'captured'
  ) THEN
    RAISE EXCEPTION 'encaissement non confirmé pour la commande %', v_ord_id
      USING ERRCODE = 'P0001';
  END IF;

  v_last := v_last + 1;
  v_inv_id := 'F' || v_year::text || '-' || lpad(v_last::text, 6, '0');
  UPDATE public.__invoice_number_counter
  SET inc_last_number = v_last
  WHERE inc_year = v_year;

  INSERT INTO public.___xtr_invoice (
    inv_id, inv_ord_id, inv_cst_id, inv_cba_id, inv_cda_id, inv_date,
    inv_amount_ht, inv_amount_ttc, inv_deposit_ht, inv_deposit_ttc,
    inv_shipping_fee_ht, inv_shipping_fee_ttc, inv_total_ht, inv_total_ttc,
    inv_tva, inv_info
  ) VALUES (
    v_inv_id, v_ord_id, p_invoice->>'inv_cst_id', p_invoice->>'inv_cba_id',
    p_invoice->>'inv_cda_id', to_char(v_now, 'YYYY-MM-DD HH24:MI:SS'),
    p_invoice->>'inv_amount_ht', p_invoice->>'inv_amount_ttc',
    p_invoice->>'inv_deposit_ht', p_invoice->>'inv_deposit_ttc',
    p_invoice->>'inv_shipping_fee_ht', p_invoice->>'inv_shipping_fee_ttc',
    p_invoice->>'inv_total_ht', p_invoice->>'inv_total_ttc',
    p_invoice->>'inv_tva', p_invoice->>'inv_info'
  );

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    v_index := v_index + 1;
    INSERT INTO public.___xtr_invoice_line (
      invl_id, invl_inv_id, invl_pg_id, invl_pg_name, invl_pm_name,
      invl_art_ref, invl_art_quantity,
      invl_art_price_sell_unit_ht, invl_art_price_sell_unit_ttc,
      invl_art_price_sell_ht, invl_art_price_sell_ttc,
      invl_art_deposit_unit_ht, invl_art_deposit_unit_ttc,
      invl_art_deposit_ht, invl_art_deposit_ttc
    ) VALUES (
      v_inv_id || '-L' || lpad(v_index::text, 3, '0'), v_inv_id,
      v_line->>'invl_pg_id', v_line->>'invl_pg_name', v_line->>'invl_pm_name',
      v_line->>'invl_art_ref', v_line->>'invl_art_quantity',
      v_line->>'invl_art_price_sell_unit_ht', v_line->>'invl_art_price_sell_unit_ttc',
      v_line->>'invl_art_price_sell_ht', v_line->>'invl_art_price_sell_ttc',
      v_line->>'invl_art_deposit_unit_ht', v_line->>'invl_art_deposit_unit_ttc',
      v_line->>'invl_art_deposit_ht', v_line->>'invl_art_deposit_ttc'
    );
  END LOOP;

  RETURN v_inv_id;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_order_invoice_atomic(jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_order_invoice_atomic(jsonb, jsonb)
  TO service_role;
COMMENT ON FUNCTION public.issue_order_invoice_atomic(jsonb, jsonb) IS
  'Mandat BM : émet une facture (numéro continu F<année>-NNNNNN) pour une commande payée, expédiée et encaissée ; une seule par commande.';
