-- =============================================================================
-- Rollback DOCUMENTAIRE de 20261001_move_pg_trgm_unaccent_to_extensions_schema
-- Le moteur ignore les .down.sql (politique forward-only, README du dossier) :
-- à n'exécuter qu'à la main, en cas d'urgence, par l'opérateur.
--
-- Remet pg_trgm et unaccent dans `public`, leur schéma d'avant la migration, et
-- rend aux 8 fonctions leur search_path d'avant (`public`). Les 4 index trigram
-- suivent par OID, comme à l'aller. Le même mécanisme supautils exécute les
-- ALTER EXTENSION sous `supabase_admin`. Une seule transaction : aucune session
-- ne voit les fonctions sans les extensions qu'elles appellent.
-- =============================================================================

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER EXTENSION pg_trgm SET SCHEMA public;
ALTER EXTENSION unaccent SET SCHEMA public;

ALTER FUNCTION public.calculate_text_similarity(text, text)
  SET search_path = public;
ALTER FUNCTION public.check_confusion_pairs(text, character varying)
  SET search_path = public;
ALTER FUNCTION public.create_index_async(text, text, text, text)
  SET search_path = public;
ALTER FUNCTION public.evaluate_rule_condition(jsonb, text, character varying, integer, character varying, jsonb)
  SET search_path = public;
ALTER FUNCTION public.immutable_unaccent(text)
  SET search_path = public;
ALTER FUNCTION public.resolve_gamme_alias(text)
  SET search_path = public;
ALTER FUNCTION public.search_references_trigram(text, text, integer, integer)
  SET search_path = public;
ALTER FUNCTION public.suggest_references(text)
  SET search_path = public;
