-- =====================================================
-- SEO GSC — Ingestion multi-niveaux (grains de couverture)
-- Date: 2026-06-13
-- Refs: plan "Fermer la boucle GSC/GA4" (PR1)
--       20260425_seo_observability_timeseries.sql (convention partitions)
--       packages/seo-types/src/observability.ts (Zod mirror)
-- =====================================================
--
-- POURQUOI : `__seo_gsc_daily` interroge GSC par dimension `query` → l'API
-- Google anonymise les requêtes faible-volume → totaux ~4× sous-capturés
-- (vérifié live 2026-06-13). On NE PEUT PAS dériver un total fidèle d'une table
-- au grain page/query. La doc GSC : moins on demande de dimensions, plus le
-- total est complet. D'où une ingestion à 3 grains explicites (1 table/grain
-- → les RPC ne mélangent jamais les grains) :
--
--   __seo_gsc_daily_property_total : date seule        → vérité volume GLOBALE
--   __seo_gsc_daily_totals         : date+country+device → vérité volume segmentée
--   __seo_gsc_daily_pages          : date+page+country+device → actions par URL
--   __seo_gsc_daily (existant)     : date+page+query+device → détail SECONDAIRE
--
-- RLS : volontairement DÉSACTIVÉE pour matcher la famille `__seo_*_daily`
-- existante (observability interne, aucune PII, accès server-side via
-- service_role / fallback ADR-028 ; pas d'exposition client anon attendue).
-- Durcissement RLS = PR transverse séparée sur toute la famille, hors scope ici.
--
-- Additive only · idempotente (IF NOT EXISTS) · réversible (.down.sql).
-- Pas de BEGIN/COMMIT explicite (squawk assume_in_transaction=true).
-- =====================================================

-- Squawk require-timeout-settings : ops métadonnées (CREATE TABLE/FUNCTION + pré-création
-- de partitions sur tables neuves/vides) → timeouts bornés mais généreux.
set lock_timeout = '5s';
set statement_timeout = '60s';

-- =====================================================
-- TABLE 1 : __seo_gsc_daily_property_total  (grain = date)
-- Vérité volume GLOBALE — 1 ligne/jour, aucune dimension demandée à GSC.
-- =====================================================
CREATE TABLE IF NOT EXISTS __seo_gsc_daily_property_total (
    date DATE NOT NULL,
    clicks BIGINT NOT NULL DEFAULT 0 CHECK (clicks >= 0),
    impressions BIGINT NOT NULL DEFAULT 0 CHECK (impressions >= 0),
    ctr REAL NOT NULL DEFAULT 0 CHECK (ctr >= 0 AND ctr <= 1),
    position REAL NOT NULL DEFAULT 0 CHECK (position >= 0),
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (date)
) PARTITION BY RANGE (date);

COMMENT ON TABLE __seo_gsc_daily_property_total IS
  'GSC Search Analytics — total GLOBAL quotidien (date seule, aucune dimension = volume le plus complet). Source de vérité des totaux. Partitionné mensuel.';

-- =====================================================
-- TABLE 2 : __seo_gsc_daily_totals  (grain = date+country+device)
-- Vérité volume SEGMENTÉE (sans page ni query → peu d'anonymisation).
-- =====================================================
CREATE TABLE IF NOT EXISTS __seo_gsc_daily_totals (
    date DATE NOT NULL,
    country TEXT NOT NULL DEFAULT 'zzz',  -- ISO-3166-1 alpha-3 lowercase GSC (ex. 'fra'), 'zzz' = inconnu
    device TEXT NOT NULL DEFAULT 'all' CHECK (device IN ('all','mobile','desktop','tablet')),
    clicks BIGINT NOT NULL DEFAULT 0 CHECK (clicks >= 0),
    impressions BIGINT NOT NULL DEFAULT 0 CHECK (impressions >= 0),
    ctr REAL NOT NULL DEFAULT 0 CHECK (ctr >= 0 AND ctr <= 1),
    position REAL NOT NULL DEFAULT 0 CHECK (position >= 0),
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (date, country, device)
) PARTITION BY RANGE (date);

CREATE INDEX IF NOT EXISTS idx_gsc_totals_cd_date ON __seo_gsc_daily_totals (country, device, date DESC);

COMMENT ON TABLE __seo_gsc_daily_totals IS
  'GSC Search Analytics — totaux segmentés country+device (sans page/query). Vérité volume par géo/device. Partitionné mensuel.';

-- =====================================================
-- TABLE 3 : __seo_gsc_daily_pages  (grain = date+page+country+device)
-- Performance par URL pour les réactions (sans query → moins d'anonymisation
-- que `__seo_gsc_daily`, mais < total : l'écart sert d'invariant de couverture).
-- =====================================================
CREATE TABLE IF NOT EXISTS __seo_gsc_daily_pages (
    date DATE NOT NULL,
    page TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'zzz',
    device TEXT NOT NULL DEFAULT 'all' CHECK (device IN ('all','mobile','desktop','tablet')),
    clicks BIGINT NOT NULL DEFAULT 0 CHECK (clicks >= 0),
    impressions BIGINT NOT NULL DEFAULT 0 CHECK (impressions >= 0),
    ctr REAL NOT NULL DEFAULT 0 CHECK (ctr >= 0 AND ctr <= 1),
    position REAL NOT NULL DEFAULT 0 CHECK (position >= 0),
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (date, page, country, device)
) PARTITION BY RANGE (date);

CREATE INDEX IF NOT EXISTS idx_gsc_pages_page_date ON __seo_gsc_daily_pages (page, date DESC);
CREATE INDEX IF NOT EXISTS idx_gsc_pages_cd_date ON __seo_gsc_daily_pages (country, device, date DESC);

COMMENT ON TABLE __seo_gsc_daily_pages IS
  'GSC Search Analytics — performance par URL (date+page+country+device, sans query). Source des réactions/opportunités par page. Partitionné mensuel.';

-- =====================================================
-- FONCTION : __seo_ensure_monthly_partitions(p_months_ahead)
-- Pré-crée idempotemment les partitions mensuelles current..+N pour TOUTES les
-- tables time-series __seo partitionnées (existantes + nouvelles).
-- Élimine la CAUSE RACINE de l'incident 2026-05-06 (« no partition found » =
-- 116 échecs GSC/GA4 faute de partition du mois courant). Plus de pré-make manuel.
-- =====================================================
CREATE OR REPLACE FUNCTION __seo_ensure_monthly_partitions(p_months_ahead INT DEFAULT 3)
RETURNS INT
LANGUAGE plpgsql
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
        -- ne traite que les tables réellement partitionnées et présentes
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

COMMENT ON FUNCTION __seo_ensure_monthly_partitions(INT) IS
  'Pré-crée idempotemment les partitions mensuelles (current..+N) des tables __seo time-series. Anti-incident 2026-05-06. Planifiée pg_cron mensuel.';

-- Création immédiate : couvre les 3 nouvelles tables + rattrape l'existant
-- (current month .. +6) pour la fin d'année.
SELECT __seo_ensure_monthly_partitions(6);

-- =====================================================
-- PLANIFICATION pg_cron — pré-création automatique le 1er de chaque mois 03:00 UTC
-- (pg_cron confirmé installé). Idempotent : cron.schedule(jobname,...) upsert par nom.
-- =====================================================
SELECT cron.schedule(
    'seo-ensure-monthly-partitions',
    '0 3 1 * *',
    $cron$SELECT __seo_ensure_monthly_partitions(3)$cron$
);
