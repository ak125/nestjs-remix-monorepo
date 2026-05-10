-- =====================================================
-- SEO Observability — Time-series tables (Phase 1)
-- Date: 2026-04-25
-- Refs: ADR-025-seo-department-architecture
--       packages/seo-types/src/observability.ts (Zod mirror)
-- =====================================================
--
-- 4 tables time-series partitionnées par mois pour les sources Google :
--   - __seo_gsc_daily       : Search Analytics (clicks, impressions, ctr, position)
--   - __seo_ga4_daily       : GA4 Data API (sessions, conversions, bounce)
--   - __seo_cwv_daily       : Core Web Vitals (LCP, CLS, INP, TTFB)
--   - __seo_gsc_links_weekly: Backlinks GSC (gratuit, top ~1000)
--
-- Volumes attendus (50k pages × 30j) :
--   gsc_daily   : ~30M rows/mois → partition mensuelle obligatoire
--   ga4_daily   : ~1.5M rows/mois
--   cwv_daily   : ~30k rows/mois (sample top 1k pages)
--   links_weekly: ~52k rows/an
--
-- Partition strategy : RANGE BY DATE, 1 partition par mois.
-- Cleanup : DROP PARTITION >18 mois en cron (à ajouter Phase 4).
-- =====================================================

-- =====================================================
-- TABLE 1 : __seo_gsc_daily
-- =====================================================

CREATE TABLE IF NOT EXISTS __seo_gsc_daily (
    date DATE NOT NULL,
    page TEXT NOT NULL,
    query TEXT NOT NULL,
    device TEXT NOT NULL DEFAULT 'all' CHECK (device IN ('all','mobile','desktop','tablet')),
    clicks INT NOT NULL DEFAULT 0 CHECK (clicks >= 0),
    impressions INT NOT NULL DEFAULT 0 CHECK (impressions >= 0),
    ctr REAL NOT NULL DEFAULT 0 CHECK (ctr >= 0 AND ctr <= 1),
    position REAL NOT NULL DEFAULT 0 CHECK (position >= 0),
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (date, page, query, device)
) PARTITION BY RANGE (date);

CREATE INDEX IF NOT EXISTS idx_gsc_daily_page_date ON __seo_gsc_daily (page, date DESC);
CREATE INDEX IF NOT EXISTS idx_gsc_daily_query_date ON __seo_gsc_daily (query, date DESC);

COMMENT ON TABLE __seo_gsc_daily IS 'GSC Search Analytics daily — partitionné mensuel, ~30M rows/mois';

-- Partitions initiales : 2026-04, 2026-05, 2026-06 (créées à l'avance pour éviter l'insert miss)
CREATE TABLE IF NOT EXISTS __seo_gsc_daily_2026_04 PARTITION OF __seo_gsc_daily
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE IF NOT EXISTS __seo_gsc_daily_2026_05 PARTITION OF __seo_gsc_daily
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS __seo_gsc_daily_2026_06 PARTITION OF __seo_gsc_daily
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- =====================================================
-- TABLE 2 : __seo_ga4_daily
-- =====================================================

CREATE TABLE IF NOT EXISTS __seo_ga4_daily (
    date DATE NOT NULL,
    page TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'organic',
    sessions INT NOT NULL DEFAULT 0 CHECK (sessions >= 0),
    conversions INT NOT NULL DEFAULT 0 CHECK (conversions >= 0),
    bounce_rate REAL CHECK (bounce_rate IS NULL OR (bounce_rate >= 0 AND bounce_rate <= 1)),
    avg_session_duration REAL CHECK (avg_session_duration IS NULL OR avg_session_duration >= 0),
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (date, page, channel)
) PARTITION BY RANGE (date);

CREATE INDEX IF NOT EXISTS idx_ga4_daily_page_date ON __seo_ga4_daily (page, date DESC);
CREATE INDEX IF NOT EXISTS idx_ga4_daily_channel_date ON __seo_ga4_daily (channel, date DESC);

COMMENT ON TABLE __seo_ga4_daily IS 'GA4 Data API daily — partitionné mensuel, ~1.5M rows/mois';

CREATE TABLE IF NOT EXISTS __seo_ga4_daily_2026_04 PARTITION OF __seo_ga4_daily
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE IF NOT EXISTS __seo_ga4_daily_2026_05 PARTITION OF __seo_ga4_daily
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS __seo_ga4_daily_2026_06 PARTITION OF __seo_ga4_daily
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- =====================================================
-- TABLE 3 : __seo_cwv_daily
-- =====================================================
-- Note : sample top 1k pages, pas 50k (PageSpeed quota 25k/jour, sample raisonnable)

CREATE TABLE IF NOT EXISTS __seo_cwv_daily (
    date DATE NOT NULL,
    page TEXT NOT NULL,
    lcp REAL CHECK (lcp IS NULL OR lcp >= 0),                    -- Largest Contentful Paint (ms)
    fid REAL CHECK (fid IS NULL OR fid >= 0),                    -- First Input Delay (ms) — deprecated mar 2024
    cls REAL CHECK (cls IS NULL OR cls >= 0),                    -- Cumulative Layout Shift (unitless)
    inp REAL CHECK (inp IS NULL OR inp >= 0),                    -- Interaction to Next Paint (ms) — replaces FID
    ttfb REAL CHECK (ttfb IS NULL OR ttfb >= 0),                 -- Time to First Byte (ms)
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (date, page)
) PARTITION BY RANGE (date);

CREATE INDEX IF NOT EXISTS idx_cwv_daily_page_date ON __seo_cwv_daily (page, date DESC);

COMMENT ON TABLE __seo_cwv_daily IS 'Core Web Vitals daily (sample top 1k pages) — partitionné mensuel';

CREATE TABLE IF NOT EXISTS __seo_cwv_daily_2026_04 PARTITION OF __seo_cwv_daily
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE IF NOT EXISTS __seo_cwv_daily_2026_05 PARTITION OF __seo_cwv_daily
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS __seo_cwv_daily_2026_06 PARTITION OF __seo_cwv_daily
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- =====================================================
-- TABLE 4 : __seo_gsc_links_weekly
-- =====================================================
-- GSC links endpoint = top ~1000 backlinks (gratuit)
-- Snapshot hebdo (la donnée bouge lentement)
-- Pas de partition (volume modeste, ~52k rows/an)

CREATE TABLE IF NOT EXISTS __seo_gsc_links_weekly (
    snapshot_date DATE NOT NULL,
    source_domain TEXT NOT NULL,
    source_url TEXT NOT NULL,
    target_url TEXT NOT NULL,
    anchor_text TEXT,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (snapshot_date, source_url, target_url)
);

CREATE INDEX IF NOT EXISTS idx_gsc_links_target_date ON __seo_gsc_links_weekly (target_url, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_gsc_links_source_domain_date ON __seo_gsc_links_weekly (source_domain, snapshot_date DESC);

COMMENT ON TABLE __seo_gsc_links_weekly IS 'Backlinks GSC (gratuit, ~1000 top liens) snapshot hebdo';
