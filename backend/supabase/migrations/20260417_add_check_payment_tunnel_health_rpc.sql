-- PREV-1 — RPC d'agrégation pour monitoring externe du tunnel paiement.
--
-- Contexte : post-incident 2026-04-14 (3 bugs, 25 jours tunnel cassé, 14
-- commandes unpaid, ~2500€ bloqués). Détection externe à J+25 a été la
-- faille critique. Cette RPC alimente PREV-1 — un cron 15min
-- (scripts/monitoring/check-payment-tunnel.sh) qui alerte par email si
-- le tunnel repart cassé.
--
-- Architecture : appelée via Supabase PostgREST + service_role_key,
-- retourne 3 métriques agrégées sur fenêtre glissante. SECURITY DEFINER
-- pour bypasser RLS sur ___xtr_order.
--
-- Return :
--   orders_count : commandes créées dans la fenêtre
--   paid_count   : dont ord_is_pay='1'
--   last_paid_at : timestamp dernière commande payée (tous temps)
--
-- Règle d'alerte (côté script shell) :
--   orders_count >= MIN_ORDERS_THRESHOLD AND paid_count == 0
--   → le tunnel semble rompu, alerte email
--
-- Note : migration appliquée live via MCP 2026-04-17, ce fichier
-- aligne le repo git avec le state DB.

CREATE OR REPLACE FUNCTION public.check_payment_tunnel_health(
  p_window_hours integer DEFAULT 2
)
RETURNS TABLE(
  orders_count bigint,
  paid_count bigint,
  last_paid_at text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*)
       FROM ___xtr_order
      WHERE ord_date::timestamptz >= NOW() - make_interval(hours => p_window_hours)
    )::bigint,
    (SELECT COUNT(*)
       FROM ___xtr_order
      WHERE ord_date::timestamptz >= NOW() - make_interval(hours => p_window_hours)
        AND ord_is_pay = '1'
    )::bigint,
    (SELECT MAX(ord_date_pay)::text
       FROM ___xtr_order
      WHERE ord_is_pay = '1'
    );
$$;

COMMENT ON FUNCTION public.check_payment_tunnel_health(integer) IS
  'Health check du tunnel paiement — agrège orders/paid sur une fenêtre glissante. '
  'Consommé par scripts/monitoring/check-payment-tunnel.sh (PREV-1 alerting). '
  'Added 2026-04-17 post-incident 2026-04-14.';
