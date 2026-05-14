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
-- référence (toutes supprimées par la suppression du log event si jamais si jamais
-- effectué — mais __seo_event_log appartient à ADR-045 et n'est pas
-- touché par ce rollback). Si une suppression stricte est requise,
-- recréer le type avec un script séparé.
-- =====================================================

-- Drop policies (idempotent via IF EXISTS)
DROP POLICY IF EXISTS crux_field_history_select ON __seo_crux_field_history; -- APPROVED: rollback of ADR-063 PR-2 (UP creates this policy in same paired migration)
DROP POLICY IF EXISTS crux_field_history_write ON __seo_crux_field_history; -- APPROVED: rollback of ADR-063 PR-2 (UP creates this policy in same paired migration)
DROP POLICY IF EXISTS crux_alert_state_select ON __seo_crux_alert_state; -- APPROVED: rollback of ADR-063 PR-2 (UP creates this policy in same paired migration)
DROP POLICY IF EXISTS crux_alert_state_write ON __seo_crux_alert_state; -- APPROVED: rollback of ADR-063 PR-2 (UP creates this policy in same paired migration)

-- Drop partitions (CASCADE car les partitions sont attachées au parent)
DROP TABLE IF EXISTS __seo_crux_field_history_2026_05 CASCADE; -- APPROVED: rollback partition created by ADR-063 PR-2 UP migration
DROP TABLE IF EXISTS __seo_crux_field_history_2026_06 CASCADE; -- APPROVED: rollback partition created by ADR-063 PR-2 UP migration
DROP TABLE IF EXISTS __seo_crux_field_history_2026_07 CASCADE; -- APPROVED: rollback partition created by ADR-063 PR-2 UP migration

-- Drop tables (partition parent + alert state)
DROP TABLE IF EXISTS __seo_crux_field_history CASCADE; -- APPROVED: rollback of ADR-063 PR-2 (table created in same paired UP migration)
DROP TABLE IF EXISTS __seo_crux_alert_state CASCADE; -- APPROVED: rollback of ADR-063 PR-2 (table created in same paired UP migration)

-- ENUM value `crux_fetch_run` non supprimable (PG limitation).
-- Pas d'action requise — valeur orpheline sans ligne référencée.
