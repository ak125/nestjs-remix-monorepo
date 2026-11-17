-- Retour arrière documentaire de 20261117_order_billing_capture_invoice.sql
-- (ignoré par le moteur ; intervention manuelle d'urgence seulement).
-- ATTENTION : à n'exécuter que si AUCUNE facture n'a été émise par
-- issue_order_invoice_atomic (inv_id LIKE 'F____-%'). Une facture émise ne se
-- supprime pas : la numérotation doit rester continue.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

DROP FUNCTION IF EXISTS public.issue_order_invoice_atomic(jsonb, jsonb);
DROP TABLE IF EXISTS public.__invoice_number_counter;
DROP TABLE IF EXISTS public.__order_capture_state;
DROP TABLE IF EXISTS public.__order_payment_adjustment;
