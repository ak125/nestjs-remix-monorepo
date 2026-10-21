-- Rollback: 20261003_drop_pieces_price_pri_type_qte_cond_indexes
-- Recrée les 2 index retirés, définitions relevées par `pg_get_indexdef` le 2026-10-03
-- à 07:23Z, avant le retrait. L'engine est forward-only : ce fichier se lance à la
-- main, hors transaction (CONCURRENTLY), une instruction à la fois.
-- CONCURRENTLY : pas de verrou bloquant les écritures sur `pieces_price`, au prix de
-- deux balayages de la table par index (476 086 lignes). Timeouts à 0 : un GUC omis
-- hérite des 60 s du rôle `postgres` (incident 20260529, PR #1395).
-- Un build interrompu laisse un index INVALIDE que `IF NOT EXISTS` sauterait en
-- silence : dans ce cas, `DROP INDEX CONCURRENTLY IF EXISTS` puis relancer. Le contrôle
-- final liste les index recréés absents ou invalides.
SET lock_timeout = 0;
SET statement_timeout = 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_price_pri_type
  ON public.pieces_price USING btree (pri_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_price_pri_qte_cond
  ON public.pieces_price USING btree (pri_qte_cond);

-- Contrôle (lecture seule) : 0 ligne attendue.
SELECT n AS index_absent_ou_invalide
  FROM unnest(ARRAY['idx_pieces_price_pri_type', 'idx_pieces_price_pri_qte_cond']) AS x(n)
 WHERE NOT EXISTS (
   SELECT 1 FROM pg_index i
    WHERE i.indexrelid = to_regclass('public.' || x.n)
      AND i.indisvalid AND i.indisready
 );
