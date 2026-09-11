-- Rollback — seo.runtime.cwv_beacon_rejected event type extension.
--
-- PostgreSQL ne permet PAS de DROP une valeur d'ENUM en production (le seul
-- moyen propre est de recréer le type, ce qui impacte toutes les colonnes
-- typées). On documente le rollback comme no-op — la valeur ajoutée est inerte
-- si aucun consumer ne l'écrit. Pattern aligné sur
-- 20260625_seo_event_placeholder_unresolved_enum.down.sql.

-- Intentionnellement vide.
SELECT 1;
