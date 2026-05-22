-- Migration : rotation des partitions des tables snapshot L1 — ADR-064 PR-2A-1.5
--
-- Contexte : __seo_snapshot_synthetic (et __seo_snapshot_cf_rum) sont
-- partitionnées par jour (RANGE created_at). La migration de création
-- (20260514_seo_snapshot_synthetic.sql) ne pré-créait que 8 jours de
-- partitions et déléguait la rotation à « PR-2A-1.5 » — jamais implémenté.
-- Résultat : épuisement des partitions à 2026-05-22 00:00 UTC → INSERT en
-- échec « no partition of relation found for row », rows perdues à chaque run.
--
-- Cette migration livre le mécanisme manquant :
--   - fonction idempotente maintain_snapshot_partitions() : premake J+lookahead,
--     drop > rétention (TTL 90j ADR-064) ;
--   - job pg_cron quotidien « snapshot-partition-rotation » qui l'appelle.
--
-- Patterns réutilisés (pas de nouvelle couche) :
--   - ensure_next_quality_history_partition() (20260507_seo_quality_history.sql)
--     pour la création idempotente de partition via pg_class + format()/EXECUTE ;
--   - cron.schedule(...) WHERE NOT EXISTS (20260420_error_logs_dedicated_table.sql)
--     pour l'enregistrement idempotent du job.
--
-- premake J+14 avec un cron quotidien : survit à 13 runs ratés d'affilée.
-- Pas de partition DEFAULT (best practice range-partitioning : une fois des rows
-- dans DEFAULT, créer la partition réelle de cette plage échoue jusqu'à migration
-- manuelle des rows → on s'appuie sur le premake, pas sur un fourre-tout).
--
-- Le runner (scripts/ci/apply-supabase-migration.py) wrappe déjà chaque fichier
-- dans une transaction (squawk: assume_in_transaction) → pas de BEGIN/COMMIT
-- explicite. Timeouts robustes avant DDL (require-timeout-settings).

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE OR REPLACE FUNCTION public.maintain_snapshot_partitions(
  p_lookahead_days INT DEFAULT 14,
  p_retention_days INT DEFAULT 90
)
RETURNS TABLE(action TEXT, partition_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tables  TEXT[] := ARRAY['__seo_snapshot_synthetic', '__seo_snapshot_cf_rum'];
  v_parent  TEXT;
  v_day     DATE;
  v_next    DATE;
  v_part    TEXT;
  v_child   RECORD;
  v_cutoff  DATE := CURRENT_DATE - p_retention_days;
  v_suffix  DATE;
BEGIN
  FOREACH v_parent IN ARRAY v_tables LOOP
    -- skip silencieux si le parent n'est pas provisionné dans cet env
    -- (ex. __seo_snapshot_cf_analytics dont la migration n'a pas été appliquée).
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = v_parent AND n.nspname = 'public' AND c.relkind = 'p'
    ) THEN
      CONTINUE;
    END IF;

    -- premake : CURRENT_DATE .. CURRENT_DATE + lookahead (idempotent par pg_class)
    v_day := CURRENT_DATE;
    WHILE v_day <= CURRENT_DATE + p_lookahead_days LOOP
      v_next := v_day + 1;
      v_part := v_parent || '_p' || to_char(v_day, 'YYYYMMDD');
      IF NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = v_part AND n.nspname = 'public'
      ) THEN
        EXECUTE format(
          'CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES FROM (%L) TO (%L)',
          v_part, v_parent, v_day::text, v_next::text
        );
        action := 'created'; partition_name := v_part; RETURN NEXT;
      END IF;
      v_day := v_next;
    END LOOP;

    -- TTL : drop des partitions strictement plus vieilles que la rétention.
    -- Dormant au premier run (partition la plus ancienne < 90j). Ne cible que
    -- les enfants au nom canonique <parent>_pYYYYMMDD.
    FOR v_child IN
      SELECT c.relname
      FROM pg_inherits i
      JOIN pg_class p     ON p.oid = i.inhparent
      JOIN pg_class c     ON c.oid = i.inhrelid
      JOIN pg_namespace n ON n.oid = p.relnamespace
      WHERE p.relname = v_parent AND n.nspname = 'public'
        AND c.relname ~ ('^' || v_parent || '_p\d{8}$')
    LOOP
      v_suffix := to_date(right(v_child.relname, 8), 'YYYYMMDD');
      IF v_suffix < v_cutoff THEN
        EXECUTE format('DROP TABLE IF EXISTS public.%I', v_child.relname);
        action := 'dropped'; partition_name := v_child.relname; RETURN NEXT;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.maintain_snapshot_partitions(INT, INT) IS
  'ADR-064 PR-2A-1.5 — premake J+lookahead & drop >retention pour les snapshot tables partitionnées par jour. Idempotent. Cron: snapshot-partition-rotation.';

GRANT EXECUTE ON FUNCTION public.maintain_snapshot_partitions(INT, INT) TO service_role;

-- Backfill immédiat à l'application (no-op idempotent si le hotfix MCP a déjà
-- créé les partitions sur la DB partagée).
SELECT public.maintain_snapshot_partitions();

-- Cron quotidien @ 02:20 UTC. Enregistrement idempotent (mirror error-logs-retention).
SELECT cron.schedule(
  'snapshot-partition-rotation',
  '20 2 * * *',
  $cron$SELECT public.maintain_snapshot_partitions();$cron$
)
WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'snapshot-partition-rotation'
);
