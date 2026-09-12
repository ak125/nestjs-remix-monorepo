-- =====================================================
-- ROLLBACK MANUEL de 20260911_seo_gsc_multilevel_page_totals.sql
-- (ignoré par le runner — forward-only ; intervention opérateur uniquement)
-- =====================================================
-- Ordre : appliquer d'abord 20260911_seo_gsc_multilevel_page_totals_rpc_low_ctr_v4.down.sql
-- (la fonction v4 lit les objets retirés ici). Revenir aussi le code du fetcher :
-- il lit `commit_version` et écrit `__seo_gsc_daily_page_totals`.
-- Perte : lignes du grain page fidèle (re-fetchables depuis GSC, rétention 16 mois)
-- et marqueurs de commit (les jours seront simplement ré-ingérés).
-- =====================================================

set lock_timeout = '5s';
set statement_timeout = '60s';

-- Fonction partitions : liste d'origine (6 tables), search_path épinglé conservé.
CREATE OR REPLACE FUNCTION __seo_ensure_monthly_partitions(p_months_ahead INT DEFAULT 3)
RETURNS INT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_tables TEXT[] := ARRAY[
        '__seo_gsc_daily',
        '__seo_ga4_daily',
        '__seo_cwv_daily',
        '__seo_gsc_daily_property_total',
        '__seo_gsc_daily_totals',
        '__seo_gsc_daily_pages'
    ];
    v_tbl TEXT;
    v_i INT;
    v_start DATE;
    v_end DATE;
    v_pname TEXT;
    v_created INT := 0;
BEGIN
    FOREACH v_tbl IN ARRAY v_tables LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_partitioned_table pt
            JOIN pg_class c ON c.oid = pt.partrelid
            WHERE c.relname = v_tbl
        ) THEN
            CONTINUE;
        END IF;
        FOR v_i IN 0..p_months_ahead LOOP
            v_start := date_trunc('month', CURRENT_DATE)::DATE + (v_i || ' month')::INTERVAL;
            v_end := (v_start + INTERVAL '1 month')::DATE;
            v_pname := v_tbl || '_' || to_char(v_start, 'YYYY_MM');
            IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = v_pname) THEN
                EXECUTE format(
                    'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
                    v_pname, v_tbl, v_start, v_end
                );
                v_created := v_created + 1;
            END IF;
        END LOOP;
    END LOOP;
    RETURN v_created;
END;
$$;

COMMENT ON TABLE __seo_gsc_daily_pages IS
  'GSC Search Analytics — performance par URL (date+page+country+device, sans query). Source des réactions/opportunités par page. Partitionné mensuel.';

DROP TABLE IF EXISTS __seo_gsc_daily_page_totals CASCADE;

ALTER TABLE __seo_gsc_daily_property_total DROP COLUMN IF EXISTS commit_version;
