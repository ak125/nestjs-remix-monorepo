-- Rollback: 20260902_b0_rm_rpc_volatility_stable
-- Restaure la volatilité d'origine (VOLATILE par omission). Métadonnée seule,
-- transactionnel, idempotent.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER FUNCTION public.rm_get_page_complete_v2(integer, bigint, integer) VOLATILE;
ALTER FUNCTION public.get_pieces_for_type_gamme_v3(integer, integer) VOLATILE;
