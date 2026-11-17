-- =============================================================================
-- Migration : lecture des mails Paybox de contact@ vers l'état d'encaissement
--             (mandat BT, 2026-11-17, suite du mandat BM)
-- Scope     : 1 table nouvelle ; contrainte CHECK de
--             __order_capture_state.ocs_source élargie à 'paybox_mail'.
--             La migration BM (20261117_order_billing_capture_invoice.sql)
--             n'est pas modifiée ; elle doit être appliquée avant celle-ci.
-- Statut    : PRÉPARÉE, NON APPLIQUÉE. Application = workflow manuel
--             « Apply Supabase migrations (manual) », par l'owner.
-- Rejouable : IF NOT EXISTS / DROP CONSTRAINT IF EXISTS.
-- Retour arrière : .down.sql voisin.
-- =============================================================================
--
-- AUCUNE DONNÉE CLIENT : ni corps de message, ni adresse du client, ni numéro
-- de carte (masqué ou non). Une ligne par message Paybox lu : id Gmail, nature,
-- et seulement les champs utiles au rapprochement (référence de commande,
-- montant, numéro d'autorisation, date, acceptation ; totaux de remise).
-- L'id unique empêche de relire ou de recompter un message.
--
-- DROITS : RLS active, aucune politique pour anon/authenticated (service_role
-- seul, comme __order_capture_state).
--
-- CONTRAINTE : __order_capture_state est créée par BM et ne contient que des
-- lignes 'manual' ; la nouvelle liste contient l'ancienne, aucune ligne
-- existante ne peut la violer. Elle est posée NOT VALID (contrôle des lignes
-- écrites dès l'application, sans balayage sous verrou). Une validation dans la
-- même transaction bloquerait les lectures (squawk constraint-missing-not-valid) :
-- si l'owner veut convalidated = true, un VALIDATE CONSTRAINT séparé suffit.
--
-- assume_in_transaction (squawk) : pas de BEGIN/COMMIT explicite.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

-- 1. Messages Paybox lus -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.__paybox_mail_message (
  pmm_message_id text PRIMARY KEY,
  pmm_kind text NOT NULL CHECK (pmm_kind IN ('ticket', 'telecollecte', 'unrecognized')),
  pmm_received_at timestamptz NOT NULL,
  pmm_read_at timestamptz NOT NULL DEFAULT now(),
  pmm_unrecognized_reason text NULL CHECK (char_length(pmm_unrecognized_reason) <= 200),
  -- ticket
  pmm_ticket_accepted boolean NULL,
  pmm_ord_ref text NULL CHECK (pmm_ord_ref ~ '^ORD-[0-9]{13}-[0-9]{3}$'),
  pmm_amount_cents bigint NULL CHECK (pmm_amount_cents > 0),
  pmm_auth_number text NULL CHECK (pmm_auth_number ~ '^[0-9]{6}$'),
  pmm_authorized_at timestamptz NULL,
  -- télécollecte
  pmm_remise_number text NULL CHECK (pmm_remise_number ~ '^[0-9]{1,12}$'),
  pmm_file_number text NULL CHECK (pmm_file_number ~ '^[0-9]{1,12}$'),
  pmm_purchase_count bigint NULL CHECK (pmm_purchase_count >= 0),
  pmm_purchase_cents bigint NULL CHECK (pmm_purchase_cents >= 0),
  pmm_refund_count bigint NULL CHECK (pmm_refund_count >= 0),
  pmm_refund_cents bigint NULL CHECK (pmm_refund_cents >= 0),
  pmm_cancel_count bigint NULL CHECK (pmm_cancel_count >= 0),
  pmm_cancel_cents bigint NULL CHECK (pmm_cancel_cents >= 0),
  pmm_collected_at timestamptz NULL,
  CONSTRAINT __paybox_mail_message_ticket_chk CHECK (
    pmm_kind <> 'ticket' OR (pmm_ticket_accepted IS NOT NULL AND pmm_authorized_at IS NOT NULL)
  ),
  CONSTRAINT __paybox_mail_message_ticket_accepted_chk CHECK (
    pmm_ticket_accepted IS NOT TRUE
    OR (pmm_ord_ref IS NOT NULL AND pmm_amount_cents IS NOT NULL AND pmm_auth_number IS NOT NULL)
  ),
  CONSTRAINT __paybox_mail_message_telecollecte_chk CHECK (
    pmm_kind <> 'telecollecte' OR (
      pmm_remise_number IS NOT NULL AND pmm_purchase_count IS NOT NULL
      AND pmm_purchase_cents IS NOT NULL AND pmm_refund_count IS NOT NULL
      AND pmm_refund_cents IS NOT NULL AND pmm_cancel_count IS NOT NULL
      AND pmm_cancel_cents IS NOT NULL AND pmm_collected_at IS NOT NULL
    )
  ),
  CONSTRAINT __paybox_mail_message_unrecognized_chk CHECK (
    (pmm_kind = 'unrecognized') = (pmm_unrecognized_reason IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS __paybox_mail_message_ord_ref_idx
  ON public.__paybox_mail_message (pmm_ord_ref);
CREATE INDEX IF NOT EXISTS __paybox_mail_message_authorized_idx
  ON public.__paybox_mail_message (pmm_authorized_at);
CREATE INDEX IF NOT EXISTS __paybox_mail_message_collected_idx
  ON public.__paybox_mail_message (pmm_collected_at);
ALTER TABLE public.__paybox_mail_message ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.__paybox_mail_message FROM anon, authenticated;
COMMENT ON TABLE public.__paybox_mail_message IS
  'Mandat BT : messages Paybox lus sur contact@ (ticket, télécollecte, non reconnu). Ni corps, ni adresse client, ni carte.';

-- 2. Source 'paybox_mail' de l'état d'encaissement ---------------------------
ALTER TABLE public.__order_capture_state
  DROP CONSTRAINT IF EXISTS __order_capture_state_ocs_source_check;
ALTER TABLE public.__order_capture_state
  ADD CONSTRAINT __order_capture_state_ocs_source_check
  CHECK (ocs_source IN ('manual', 'paybox_direct', 'paybox_mail')) NOT VALID;
COMMENT ON COLUMN public.__order_capture_state.ocs_source IS
  'manual : saisi par l''owner ; paybox_direct : réservé (non branché) ; paybox_mail : lu dans les mails Paybox de contact@ (mandat BT).';
