-- =============================================================================
-- Rollback DOCUMENTAIRE de 20260929_db_ops_extensions_plpgsql_check_hypopg_pgstattuple
-- Le moteur ignore les .down.sql (politique forward-only, README du dossier) :
-- à n'exécuter qu'à la main, en cas d'urgence, par l'opérateur.
--
-- RESTRICT (défaut) est voulu : si un objet dépend d'une de ces extensions,
-- le DROP échoue au lieu d'emporter cet objet en cascade.
-- plpgsql_check reste chargée par shared_preload_libraries (réglage plateforme,
-- antérieur à cette migration) : ce rollback ne retire que ses fonctions SQL.
-- =============================================================================

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DROP EXTENSION IF EXISTS pgstattuple;
DROP EXTENSION IF EXISTS hypopg;
DROP EXTENSION IF EXISTS plpgsql_check;
