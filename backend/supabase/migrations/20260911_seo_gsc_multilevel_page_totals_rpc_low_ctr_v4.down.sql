-- =====================================================
-- ROLLBACK MANUEL de 20260911_seo_gsc_multilevel_page_totals_rpc_low_ctr_v4.sql
-- (ignoré par le runner — forward-only). Le Command Center retombe sur v3
-- (repli journalisé). À appliquer AVANT le rollback de la table page_totals.
-- =====================================================

set lock_timeout = '5s';
set statement_timeout = '60s';

DROP FUNCTION IF EXISTS public.rpc_seo_low_ctr_v4(integer, timestamptz, integer, numeric, integer, numeric, date);
