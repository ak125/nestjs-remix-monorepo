-- =====================================================
-- DOWN — V1A.0 Intent Resolution canonical event
-- =====================================================
-- ENUM values cannot be removed in PostgreSQL without recreating the type.
-- This down migration is a no-op : the unused value is harmless if rollback nécessaire.
-- En cas de rollback strict requis : recréer seo_event_type sans 'diagnostic_resolution_outcome'
-- (impacte toutes les colonnes l'utilisant — opération risquée, à faire manuellement).
-- =====================================================

SELECT 'no-op down: enum values cannot be removed without recreate' AS rollback_note;
