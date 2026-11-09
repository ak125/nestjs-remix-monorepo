-- Rollback de 20261022_cancel_order_payment_voided_atomic.sql : supprime la
-- fonction, seul objet créé. Aucun appelant dans l'application.
--
-- Les commandes déjà annulées par la fonction restent annulées et leurs
-- événements ORDER_CANCELLED restent au journal : le rollback retire le chemin,
-- il ne défait aucune annulation.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DROP FUNCTION IF EXISTS public.cancel_order_payment_voided_atomic(text, text, text, uuid);
