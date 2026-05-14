-- =====================================================
-- SEO CrUX Field Monitoring — DOWN migration
-- Date : 2026-05-14
-- Refs : ADR-063-cwv-monitoring-prod-crux-api
-- =====================================================
--
-- Rollback de `20260514_seo_crux_field_history.sql`.
-- Idempotent : peut être appliqué plusieurs fois sans erreur.
--
-- Note sur l'ENUM `seo_event_type` : PostgreSQL ne permet pas de DROP
-- une valeur d'ENUM existante. La valeur `crux_fetch_run` reste dans le
-- type après rollback — c'est sans impact car aucune ligne ne la
-- référence (toutes supprimées par le DROP TABLE event_log si jamais
-- effectué — mais __seo_event_log appartient à ADR-045 et n'est pas
-- touché par ce rollback). Si une suppression stricte est requise,
-- recréer le type avec un script séparé.
-- =====================================================

-- Drop policies (idempotent via IF EXISTS)
DROP POLICY IF EXISTS crux_field_history_select ON __seo_crux_field_history;
DROP POLICY IF EXISTS crux_field_history_write ON __seo_crux_field_history;
DROP POLICY IF EXISTS crux_alert_state_select ON __seo_crux_alert_state;
DROP POLICY IF EXISTS crux_alert_state_write ON __seo_crux_alert_state;

-- Drop partitions (CASCADE car les partitions sont attachées au parent)
DROP TABLE IF EXISTS __seo_crux_field_history_2026_05 CASCADE;
DROP TABLE IF EXISTS __seo_crux_field_history_2026_06 CASCADE;
DROP TABLE IF EXISTS __seo_crux_field_history_2026_07 CASCADE;

-- Drop tables (partition parent + alert state)
DROP TABLE IF EXISTS __seo_crux_field_history CASCADE;
DROP TABLE IF EXISTS __seo_crux_alert_state CASCADE;

-- ENUM value `crux_fetch_run` non supprimable (PG limitation).
-- Pas d'action requise — valeur orpheline sans ligne référencée.
