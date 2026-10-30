-- Rollback: 20261003_drop_seo_event_log_unread_indexes
-- Recrée les 2 index retirés, définitions relevées par `pg_get_indexdef` le 2026-10-03
-- à 07:45Z, avant le retrait. L'engine est forward-only : ce fichier se lance à la
-- main, hors transaction (CONCURRENTLY), une instruction à la fois.
-- CONCURRENTLY : pas de verrou bloquant les insertions dans `__seo_event_log`, au prix
-- de deux balayages de la table par index (746 814 lignes, 312 Mo de heap). Timeouts à
-- 0 : un GUC omis hérite des 60 s du rôle `postgres` (incident 20260529, PR #1395).
-- Rétablir le GIN revient aussi sur ADR-105 : à faire seulement si un lecteur `@>` le
-- choisit réellement (plan mesuré), sinon l'index ciblé qu'ADR-105 prescrit suffit.
-- Un build interrompu laisse un index INVALIDE que `IF NOT EXISTS` sauterait en
-- silence : dans ce cas, `DROP INDEX CONCURRENTLY IF EXISTS` puis relancer. Le contrôle
-- final liste les index recréés absents ou invalides.
SET lock_timeout = 0;
SET statement_timeout = 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_seo_event_log_payload_gin
  ON public.__seo_event_log USING gin (payload);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_seo_event_log_entity_url
  ON public.__seo_event_log USING btree (entity_url) WHERE (entity_url IS NOT NULL);

-- Contrôle (lecture seule) : 0 ligne attendue.
SELECT n AS index_absent_ou_invalide
  FROM unnest(ARRAY['idx_seo_event_log_payload_gin', 'idx_seo_event_log_entity_url']) AS x(n)
 WHERE NOT EXISTS (
   SELECT 1 FROM pg_index i
    WHERE i.indexrelid = to_regclass('public.' || x.n)
      AND i.indisvalid AND i.indisready
 );
