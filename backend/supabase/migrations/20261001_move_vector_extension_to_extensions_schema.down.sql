-- =============================================================================
-- Rollback DOCUMENTAIRE de 20261001_move_vector_extension_to_extensions_schema
-- Le moteur ignore les .down.sql (politique forward-only, README du dossier) :
-- à n'exécuter qu'à la main, en cas d'urgence, par l'opérateur.
--
-- Remet l'extension vector dans `public`, son schéma d'avant la migration. La
-- colonne public.__seo_r2_embeddings.embedding et l'index ivfflat
-- idx_r2_embeddings_cosine suivent par OID, comme à l'aller. Le même mécanisme
-- supautils exécute l'ALTER sous `supabase_admin`.
-- =============================================================================

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER EXTENSION vector SET SCHEMA public;
