-- Retour arrière du mandat BT (20261118_paybox_mail_capture_import.sql).
-- Prérequis : aucune ligne __order_capture_state en source 'paybox_mail'.
-- S'il en reste, le bloc DO refuse le retour arrière et la transaction entière
-- est annulée : contrainte et table restent intactes. Supprimer ces lignes ou
-- les repasser en 'manual' est une décision de l'owner, rien n'est fait ici.
-- Le retour arrière opérationnel est PAYBOX_MAIL_IMPORT_MODE=off ; ce fichier
-- ne sert qu'à retirer le schéma.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $$
BEGIN
  IF to_regclass('public.__order_capture_state') IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.__order_capture_state WHERE ocs_source = 'paybox_mail') THEN
    RAISE EXCEPTION 'Retour arrière refusé : des lignes __order_capture_state ont la source paybox_mail';
  END IF;
END $$;

ALTER TABLE public.__order_capture_state
  DROP CONSTRAINT IF EXISTS __order_capture_state_ocs_source_check;
ALTER TABLE public.__order_capture_state
  ADD CONSTRAINT __order_capture_state_ocs_source_check
  CHECK (ocs_source IN ('manual', 'paybox_direct'));
COMMENT ON COLUMN public.__order_capture_state.ocs_source IS NULL;

DROP TABLE IF EXISTS public.__paybox_mail_message;

COMMIT;
