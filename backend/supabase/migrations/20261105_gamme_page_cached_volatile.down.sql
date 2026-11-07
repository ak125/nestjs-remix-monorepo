-- Retour arrière de 20261105_gamme_page_cached_volatile.sql
--
-- Rétablit get_gamme_page_data_cached() en STABLE, sa volatilité d'avant.
-- ATTENTION : cela rétablit aussi l'erreur « cannot execute INSERT in a
-- read-only transaction » sur cache absent ou périmé, donc le 503 de
-- /api/gamme-rest/:id/page-data-rpc-v2 et le 404 des pages concernées.
-- À ne lancer que si le passage en VOLATILE provoque lui-même une régression.
--
-- Les lignes ajoutées entre-temps à __gamme_page_cache restent : ce sont des
-- données dérivées, reconstruites à l'identique par rebuild_gamme_page_cache.
--
-- L'engine est forward-only : ce fichier se lance à la main.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER FUNCTION public.get_gamme_page_data_cached(integer) STABLE;

COMMENT ON FUNCTION public.get_gamme_page_data_cached(integer) IS
  'ADR-024: drop-in replacement futur pour get_gamme_page_data_optimized. Cache-first, rebuild-on-miss. Phase 1 (non appelée par le backend tant que Phase 5 non livrée).';

COMMIT;
