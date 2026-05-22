-- Migration : rotation des partitions des tables observability timeseries (mensuelles).
--
-- Contexte : __seo_gsc_daily / __seo_ga4_daily / __seo_cwv_daily sont partitionnées
-- par MOIS (RANGE sur `date`). La migration de création
-- (20260425_seo_observability_timeseries.sql) a hardcodé les partitions jusqu'à
-- 2026-07-01 et notait « Cleanup : DROP PARTITION >18 mois en cron (à ajouter
-- Phase 4) » — jamais implémenté (même classe de dette que la rotation snapshot).
-- Conséquence latente : épuisement des partitions à 2026-07-01 00:00 UTC →
-- INSERT en échec « no partition of relation found for row » sur l'ingestion
-- GSC/GA4/CWV (les fetchers ne créent PAS de partition on-write).
--
-- Cette migration livre le mécanisme manquant, pendant MENSUEL de la rotation
-- snapshot quotidienne (maintain_snapshot_partitions) :
--   - fonction idempotente maintain_observability_partitions() : premake
--     M+lookahead, drop > rétention (18 mois, politique documentée ADR-025) ;
--   - job pg_cron quotidien « observability-partition-rotation » qui l'appelle.
--
-- Patterns réutilisés (pas de nouvelle couche) :
--   - structure de maintain_snapshot_partitions (20260522_seo_snapshot_partition_rotation.sql) ;
--   - cron.schedule(...) WHERE NOT EXISTS (20260420_error_logs_dedicated_table.sql).
--
-- Nommage canonique <parent>_YYYY_MM (convention 20260425). Bornes [mois, mois+1).
-- premake M+3 avec cron quotidien : maintient toujours 3 mois d'avance, survit à
-- des dizaines de runs ratés. Pas de partition DEFAULT (best practice range).
--
-- Le runner wrappe déjà chaque fichier dans une transaction : pas de BEGIN/COMMIT.

CREATE OR REPLACE FUNCTION public.maintain_observability_partitions(
  p_lookahead_months INT DEFAULT 3,
  p_retention_months INT DEFAULT 18
)
RETURNS TABLE(action TEXT, partition_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tables  TEXT[] := ARRAY['__seo_gsc_daily', '__seo_ga4_daily', '__seo_cwv_daily'];
  v_parent  TEXT;
  v_month   DATE;
  v_next    DATE;
  v_last    DATE;
  v_part    TEXT;
  v_child   RECORD;
  v_cutoff  DATE := date_trunc('month', CURRENT_DATE - make_interval(months => p_retention_months))::date;
BEGIN
  FOREACH v_parent IN ARRAY v_tables LOOP
    -- skip silencieux si le parent n'est pas provisionné dans cet env.
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = v_parent AND n.nspname = 'public' AND c.relkind = 'p'
    ) THEN
      CONTINUE;
    END IF;

    -- premake : mois courant .. mois courant + lookahead (idempotent par pg_class)
    v_month := date_trunc('month', CURRENT_DATE)::date;
    v_last  := date_trunc('month', CURRENT_DATE)::date + make_interval(months => p_lookahead_months);
    WHILE v_month <= v_last LOOP
      v_next := (v_month + INTERVAL '1 month')::date;
      v_part := v_parent || '_' || to_char(v_month, 'YYYY_MM');
      IF NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = v_part AND n.nspname = 'public'
      ) THEN
        EXECUTE format(
          'CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES FROM (%L) TO (%L)',
          v_part, v_parent, v_month::text, v_next::text
        );
        action := 'created'; partition_name := v_part; RETURN NEXT;
      END IF;
      v_month := v_next;
    END LOOP;

    -- TTL : drop des partitions strictement plus vieilles que la rétention (18 mois).
    -- Dormant au premier run. Ne cible que les enfants au nom canonique
    -- <parent>_YYYY_MM (jamais une partition au format différent).
    FOR v_child IN
      SELECT c.relname
      FROM pg_inherits i
      JOIN pg_class p     ON p.oid = i.inhparent
      JOIN pg_class c     ON c.oid = i.inhrelid
      JOIN pg_namespace n ON n.oid = p.relnamespace
      WHERE p.relname = v_parent AND n.nspname = 'public'
        AND c.relname ~ ('^' || v_parent || '_\d{4}_\d{2}$')
    LOOP
      IF to_date(right(v_child.relname, 7), 'YYYY_MM') < v_cutoff THEN
        EXECUTE format('DROP TABLE IF EXISTS public.%I', v_child.relname);
        action := 'dropped'; partition_name := v_child.relname; RETURN NEXT;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.maintain_observability_partitions(INT, INT) IS
  'ADR-025 — premake M+lookahead & drop >retention (18 mois) pour les tables observability mensuelles (__seo_gsc/ga4/cwv_daily). Idempotent. Cron: observability-partition-rotation.';

GRANT EXECUTE ON FUNCTION public.maintain_observability_partitions(INT, INT) TO service_role;

-- Backfill immédiat à l'application : crée 2026_07 + 2026_08 (existantes 04/05/06
-- → skip), résorbant la falaise du 2026-07-01. No-op idempotent ensuite.
SELECT public.maintain_observability_partitions();

-- Cron quotidien @ 02:40 UTC (décalé de la rotation snapshot @ 02:20).
-- Enregistrement idempotent (mirror error-logs-retention / snapshot rotation).
SELECT cron.schedule(
  'observability-partition-rotation',
  '40 2 * * *',
  $cron$SELECT public.maintain_observability_partitions();$cron$
)
WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'observability-partition-rotation'
);
