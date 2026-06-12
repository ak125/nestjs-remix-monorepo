-- Rollback bloc 5 — runtime event types extension.
--
-- IMPORTANT : PostgreSQL ne permet PAS de DROP une valeur d'ENUM en
-- production (le seul moyen propre est de recréer le type, ce qui
-- impacte toutes les colonnes typées). On documente le rollback comme
-- no-op pour cette migration — les 5 valeurs ajoutées sont inertes si
-- aucun consumer ne les écrit. Pattern aligné sur
-- 20260524_diagnostic_resolution_outcome.down.sql.
--
-- En cas de besoin strict (rollback security), faire un drop+recreate
-- manuel coordonné avec le code de consumer.

-- Intentionnellement vide.
SELECT 1;
