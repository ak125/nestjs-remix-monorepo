-- =====================================================
-- SITEMAP V10 ENTERPRISE - SCHEMA MERGED & IMPROVED
-- Date: 2026-01-22
-- =====================================================
--
-- EXISTING TABLES (KEPT):
--   __seo_indexation_status  ✅ (13 cols) - index status
--   __seo_quality_log        ✅ (12 cols) - rule violations
--   __sitemap_p_link         ✅ (10 cols) - piece URLs
--   gamme_seo_metrics        ✅ (26 cols) - gamme scores
--   crawl_budget_metrics     ✅ (12 cols) - crawl metrics
--
-- NEW TABLES (ADDED):
--   __seo_entity             - Groupe logique (gamme, vehicule, guide...)
--   __seo_page               - URLs réelles avec metadata
--   __seo_internal_link      - Graph maillage interne
--   __seo_crawl_log          - Logs crawl Googlebot
--   __seo_entity_score_v10   - Scoring + bucket température
--   __seo_sitemap_file       - Audit fichiers sitemap générés
--   __seo_crawl_hub          - Audit hubs crawl générés
--   __seo_generation_log     - Logs génération sitemap
-- =====================================================

-- 1) ENTITES (groupe logique: gamme, véhicule, guide, diagnostic, etc.)
CREATE TABLE IF NOT EXISTS __seo_entity (
    id               BIGSERIAL PRIMARY KEY,
    entity_type      TEXT NOT NULL CHECK (entity_type IN (
        'gamme', 'vehicule', 'guide', 'diagnostic',
        'brand', 'model', 'category', 'blog', 'page', 'other'
    )),
    slug             TEXT NOT NULL,
    title            TEXT NOT NULL,
    canonical_url    TEXT NOT NULL,

    -- Metadata enrichie
    meta_description TEXT,
    h1               TEXT,
    parent_entity_id BIGINT REFERENCES __seo_entity(id) ON DELETE SET NULL,

    -- Status
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    is_indexable     BOOLEAN NOT NULL DEFAULT TRUE,

    -- Timestamps
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(entity_type, slug),
    UNIQUE(canonical_url)
);

CREATE INDEX IF NOT EXISTS idx_seo_entity_type_active ON __seo_entity(entity_type, is_active);
CREATE INDEX IF NOT EXISTS idx_seo_entity_canonical ON __seo_entity(canonical_url);
CREATE INDEX IF NOT EXISTS idx_seo_entity_parent ON __seo_entity(parent_entity_id);

COMMENT ON TABLE __seo_entity IS 'Entités SEO logiques (gammes, véhicules, guides, etc.)';

-- 2) PAGES (URLs réelles avec metadata SEO complète)
CREATE TABLE IF NOT EXISTS __seo_page (
    id               BIGSERIAL PRIMARY KEY,
    entity_id        BIGINT REFERENCES __seo_entity(id) ON DELETE SET NULL,

    -- URL data
    url              TEXT NOT NULL UNIQUE,
    page_type        TEXT NOT NULL CHECK (page_type IN (
        'canonical', 'variant', 'filter', 'longtail',
        'hub', 'listing', 'product', 'category', 'other'
    )),

    -- SEO metadata
    title            TEXT,
    h1               TEXT,
    meta_description TEXT,
    meta_robots      TEXT DEFAULT 'index,follow',
    canonical_url    TEXT,  -- rel=canonical (si différent de url)

    -- Status
    status_target    INT NOT NULL DEFAULT 200,
    is_indexable_hint BOOLEAN NOT NULL DEFAULT TRUE,

    -- Scoring (liaison avec __seo_entity_score_v10)
    temperature      TEXT CHECK (temperature IN ('hot', 'new', 'stable', 'cold', 'exclude')),
    priority         NUMERIC(2,1) DEFAULT 0.5,
    changefreq       TEXT DEFAULT 'weekly',

    -- Timestamps
    last_published_at TIMESTAMPTZ,
    last_modified_at  TIMESTAMPTZ DEFAULT NOW(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seo_page_entity ON __seo_page(entity_id);
CREATE INDEX IF NOT EXISTS idx_seo_page_type ON __seo_page(page_type);
CREATE INDEX IF NOT EXISTS idx_seo_page_temperature ON __seo_page(temperature) WHERE is_indexable_hint = TRUE;
CREATE INDEX IF NOT EXISTS idx_seo_page_published ON __seo_page(last_published_at DESC);

COMMENT ON TABLE __seo_page IS 'Pages individuelles avec metadata SEO pour sitemap';

-- 3) LIENS INTERNES (graph maillage interne)
CREATE TABLE IF NOT EXISTS __seo_internal_link (
    id            BIGSERIAL PRIMARY KEY,
    from_url      TEXT NOT NULL,
    to_url        TEXT NOT NULL,
    link_type     TEXT NOT NULL CHECK (link_type IN (
        'nav', 'context', 'hub', 'breadcrumb',
        'footer', 'sidebar', 'related', 'temporary', 'other'
    )),
    anchor_text   TEXT,  -- Texte du lien (important pour SEO)
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    is_nofollow   BOOLEAN NOT NULL DEFAULT FALSE,

    -- Tracking
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(from_url, to_url, link_type)
);

CREATE INDEX IF NOT EXISTS idx_internal_link_to ON __seo_internal_link(to_url);
CREATE INDEX IF NOT EXISTS idx_internal_link_from ON __seo_internal_link(from_url);
CREATE INDEX IF NOT EXISTS idx_internal_link_type ON __seo_internal_link(link_type, is_active);

COMMENT ON TABLE __seo_internal_link IS 'Graph de maillage interne du site';

-- 4) LOGS CRAWL (Googlebot & autres bots)
CREATE TABLE IF NOT EXISTS __seo_crawl_log (
    id            BIGSERIAL PRIMARY KEY,
    url           TEXT NOT NULL,
    user_agent    TEXT NOT NULL,
    bot_name      TEXT,  -- 'googlebot', 'bingbot', 'other'
    is_googlebot  BOOLEAN NOT NULL DEFAULT FALSE,

    -- Response data
    status_code   INT,
    response_ms   INT,
    bytes_sent    INT,
    content_type  TEXT,

    -- Request data
    referer       TEXT,
    request_method TEXT DEFAULT 'GET',

    -- Timestamps
    crawled_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partition par mois pour performance (table peut devenir très grande)
CREATE INDEX IF NOT EXISTS idx_crawl_url_time ON __seo_crawl_log(url, crawled_at DESC);
CREATE INDEX IF NOT EXISTS idx_crawl_googlebot_time ON __seo_crawl_log(is_googlebot, crawled_at DESC);
CREATE INDEX IF NOT EXISTS idx_crawl_status ON __seo_crawl_log(status_code, crawled_at DESC);

COMMENT ON TABLE __seo_crawl_log IS 'Logs des crawls Googlebot et autres bots';

-- 5) SCORE ENTITE V10 (scoring multi-dimensionnel + température)
CREATE TABLE IF NOT EXISTS __seo_entity_score_v10 (
    id               BIGSERIAL PRIMARY KEY,
    entity_id        BIGINT REFERENCES __seo_entity(id) ON DELETE CASCADE,
    url              TEXT UNIQUE,  -- Alternative si pas d'entity_id

    -- Scores individuels (0-100)
    score_traffic    INT NOT NULL DEFAULT 0 CHECK (score_traffic BETWEEN 0 AND 100),
    score_conversion INT NOT NULL DEFAULT 0 CHECK (score_conversion BETWEEN 0 AND 100),
    score_revenue    INT NOT NULL DEFAULT 0 CHECK (score_revenue BETWEEN 0 AND 100),
    score_freshness  INT NOT NULL DEFAULT 0 CHECK (score_freshness BETWEEN 0 AND 100),
    score_backlinks  INT NOT NULL DEFAULT 0 CHECK (score_backlinks BETWEEN 0 AND 100),
    score_internal   INT NOT NULL DEFAULT 0 CHECK (score_internal BETWEEN 0 AND 100),

    -- Score total (weighted average) - Calculated
    score_total      NUMERIC(5,2) GENERATED ALWAYS AS (
        (score_traffic * 0.25) +
        (score_conversion * 0.20) +
        (score_revenue * 0.20) +
        (score_freshness * 0.15) +
        (score_backlinks * 0.10) +
        (score_internal * 0.10)
    ) STORED,

    -- Classification température - Calculated
    bucket           TEXT GENERATED ALWAYS AS (
        CASE
            WHEN (score_traffic * 0.25 + score_conversion * 0.20 + score_revenue * 0.20 +
                  score_freshness * 0.15 + score_backlinks * 0.10 + score_internal * 0.10) >= 70 THEN 'hot'
            WHEN (score_traffic * 0.25 + score_conversion * 0.20 + score_revenue * 0.20 +
                  score_freshness * 0.15 + score_backlinks * 0.10 + score_internal * 0.10) >= 50 THEN 'new'
            WHEN (score_traffic * 0.25 + score_conversion * 0.20 + score_revenue * 0.20 +
                  score_freshness * 0.15 + score_backlinks * 0.10 + score_internal * 0.10) >= 30 THEN 'stable'
            ELSE 'cold'
        END
    ) STORED,

    -- Métriques cluster
    cluster_size     INT NOT NULL DEFAULT 0,
    inbound_links    INT NOT NULL DEFAULT 0,
    outbound_links   INT NOT NULL DEFAULT 0,

    -- Risques (0-100)
    duplication_risk INT NOT NULL DEFAULT 0,
    orphan_risk      INT NOT NULL DEFAULT 0,
    confusion_risk   INT NOT NULL DEFAULT 0,
    cannibalization_risk INT NOT NULL DEFAULT 0,

    -- Business metrics
    demand_score     INT NOT NULL DEFAULT 0,
    business_score   INT NOT NULL DEFAULT 0,
    content_score    INT NOT NULL DEFAULT 0,

    -- Timestamps
    last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entity_score_bucket ON __seo_entity_score_v10(bucket);
CREATE INDEX IF NOT EXISTS idx_entity_score_total ON __seo_entity_score_v10(score_total DESC);
CREATE INDEX IF NOT EXISTS idx_entity_score_entity ON __seo_entity_score_v10(entity_id);

COMMENT ON TABLE __seo_entity_score_v10 IS 'Scoring multi-dimensionnel des entités avec classification température';

-- 6) FILES SITEMAP générés (audit)
CREATE TABLE IF NOT EXISTS __seo_sitemap_file (
    id           BIGSERIAL PRIMARY KEY,
    path         TEXT NOT NULL UNIQUE,  -- ex: /sitemaps/hot/sitemap-hot-1.xml
    bucket       TEXT NOT NULL CHECK (bucket IN ('hot', 'new', 'stable', 'cold', 'index')),

    -- Metrics
    urls_count   INT NOT NULL,
    file_size_bytes BIGINT,
    compressed_size_bytes BIGINT,

    -- Content hash (pour détecter changements)
    content_hash TEXT,

    -- Timestamps
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at   TIMESTAMPTZ  -- Pour invalidation cache
);

CREATE INDEX IF NOT EXISTS idx_sitemap_file_bucket ON __seo_sitemap_file(bucket);
CREATE INDEX IF NOT EXISTS idx_sitemap_file_generated ON __seo_sitemap_file(generated_at DESC);

COMMENT ON TABLE __seo_sitemap_file IS 'Audit des fichiers sitemap générés';

-- 7) HUBS CRAWL générés (audit)
CREATE TABLE IF NOT EXISTS __seo_crawl_hub (
    id           BIGSERIAL PRIMARY KEY,
    path         TEXT NOT NULL UNIQUE,  -- ex: /__crawl__/hot/gammes.html
    bucket       TEXT NOT NULL CHECK (bucket IN ('hot', 'new', 'stable', 'cold')),
    hub_type     TEXT NOT NULL CHECK (hub_type IN (
        'money', 'gammes', 'vehicules', 'clusters',
        'brands', 'categories', 'new', 'other'
    )),

    -- Metrics
    urls_count   INT NOT NULL,
    depth        INT DEFAULT 1,  -- Profondeur dans la hiérarchie

    -- Timestamps
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crawl_hub_bucket ON __seo_crawl_hub(bucket);
CREATE INDEX IF NOT EXISTS idx_crawl_hub_type ON __seo_crawl_hub(hub_type);

COMMENT ON TABLE __seo_crawl_hub IS 'Audit des hubs de crawl générés';

-- 8) LOGS GENERATION SITEMAP
CREATE TABLE IF NOT EXISTS __seo_generation_log (
    id               BIGSERIAL PRIMARY KEY,
    run_id           UUID DEFAULT gen_random_uuid(),
    generation_type  TEXT NOT NULL CHECK (generation_type IN ('sitemap', 'hub', 'full', 'incremental')),
    bucket           TEXT CHECK (bucket IN ('hot', 'new', 'stable', 'cold', 'all')),

    -- Timing
    started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at     TIMESTAMPTZ,
    duration_ms      INT,

    -- Metrics
    urls_total       INT DEFAULT 0,
    urls_added       INT DEFAULT 0,
    urls_removed     INT DEFAULT 0,
    urls_updated     INT DEFAULT 0,
    files_generated  INT DEFAULT 0,
    total_size_bytes BIGINT DEFAULT 0,
    compressed_size_bytes BIGINT DEFAULT 0,

    -- Status
    status           TEXT DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed', 'cancelled')),
    error_message    TEXT,

    -- Metadata
    metadata         JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_generation_log_status ON __seo_generation_log(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_log_bucket ON __seo_generation_log(bucket, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_log_type ON __seo_generation_log(generation_type);

COMMENT ON TABLE __seo_generation_log IS 'Logs des générations sitemap et hubs';

-- =====================================================
-- VIEWS (Vues analytiques)
-- =====================================================

-- Vue: Dernier crawl Googlebot par URL
CREATE OR REPLACE VIEW v_seo_last_googlebot_crawl AS
SELECT
    url,
    MAX(crawled_at) AS last_googlebot_crawl_at,
    (ARRAY_AGG(status_code ORDER BY crawled_at DESC))[1] AS last_status_code,
    (ARRAY_AGG(response_ms ORDER BY crawled_at DESC))[1] AS last_response_ms
FROM __seo_crawl_log
WHERE is_googlebot = TRUE
GROUP BY url;

-- Vue: Santé URL (index + crawl + violations)
CREATE OR REPLACE VIEW v_seo_url_health AS
SELECT
    p.url,
    p.page_type,
    p.entity_id,
    p.temperature,
    p.priority,
    p.is_indexable_hint,
    -- Index status
    COALESCE(i.sis_index_status, 'unknown') AS index_status,
    i.sis_score AS index_score,
    i.sis_has_blocker AS has_blocker,
    -- Crawl status
    g.last_googlebot_crawl_at,
    g.last_status_code AS last_crawl_status,
    -- Violations (30 jours)
    (SELECT COUNT(*) FROM __seo_quality_log v
     WHERE v.sql_record_id = p.url
       AND v.sql_created_at > NOW() - INTERVAL '30 days') AS violations_30d,
    -- Scores
    s.score_total,
    s.bucket
FROM __seo_page p
LEFT JOIN __seo_indexation_status i ON i.sis_entity_id = p.url
LEFT JOIN v_seo_last_googlebot_crawl g ON g.url = p.url
LEFT JOIN __seo_entity_score_v10 s ON s.url = p.url;

-- Vue: Stats par température (pour dashboard)
CREATE OR REPLACE VIEW v_seo_temperature_stats AS
SELECT
    bucket AS temperature,
    COUNT(*) AS url_count,
    ROUND(AVG(score_total), 2) AS avg_score,
    SUM(inbound_links) AS total_inbound_links,
    ROUND(AVG(duplication_risk), 2) AS avg_duplication_risk,
    ROUND(AVG(orphan_risk), 2) AS avg_orphan_risk
FROM __seo_entity_score_v10
GROUP BY bucket;

-- Vue: Maillage interne stats
CREATE OR REPLACE VIEW v_seo_internal_link_stats AS
SELECT
    to_url AS url,
    COUNT(*) AS inbound_count,
    COUNT(DISTINCT from_url) AS unique_sources,
    ARRAY_AGG(DISTINCT link_type) AS link_types
FROM __seo_internal_link
WHERE is_active = TRUE
GROUP BY to_url;

-- =====================================================
-- RPC FUNCTIONS
-- =====================================================

-- Fonction: Récupérer URLs par température avec pagination
CREATE OR REPLACE FUNCTION get_sitemap_urls_by_temperature(
    p_temperature TEXT,
    p_limit INT DEFAULT 50000,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    url TEXT,
    page_type TEXT,
    changefreq TEXT,
    priority NUMERIC(2,1),
    last_modified_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.url,
        p.page_type,
        COALESCE(p.changefreq,
            CASE p_temperature
                WHEN 'hot' THEN 'daily'
                WHEN 'new' THEN 'daily'
                WHEN 'stable' THEN 'weekly'
                ELSE 'monthly'
            END
        ),
        COALESCE(p.priority,
            CASE p_temperature
                WHEN 'hot' THEN 1.0
                WHEN 'new' THEN 0.8
                WHEN 'stable' THEN 0.6
                ELSE 0.4
            END
        ),
        p.last_modified_at
    FROM __seo_page p
    LEFT JOIN __seo_entity_score_v10 s ON s.url = p.url
    WHERE COALESCE(s.bucket, p.temperature, 'stable') = p_temperature
      AND p.is_indexable_hint = TRUE
    ORDER BY COALESCE(s.score_total, 50) DESC, p.last_modified_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Fonction: Compter URLs par température
CREATE OR REPLACE FUNCTION count_sitemap_urls_by_temperature(p_temperature TEXT)
RETURNS BIGINT AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM __seo_page p
        LEFT JOIN __seo_entity_score_v10 s ON s.url = p.url
        WHERE COALESCE(s.bucket, p.temperature, 'stable') = p_temperature
          AND p.is_indexable_hint = TRUE
    );
END;
$$ LANGUAGE plpgsql;

-- Fonction: Sync pieces depuis __sitemap_p_link vers __seo_page
CREATE OR REPLACE FUNCTION sync_sitemap_p_link_to_seo_page()
RETURNS INTEGER AS $$
DECLARE
    synced_count INTEGER;
BEGIN
    INSERT INTO __seo_page (url, page_type, temperature, last_modified_at)
    SELECT
        '/pieces/' || map_pg_alias || '-' || map_pg_id || '/' ||
        map_marque_alias || '-' || map_marque_id || '/' ||
        map_modele_alias || '-' || map_modele_id || '/' ||
        map_type_alias || '-' || map_type_id || '.html' AS url,
        'product' AS page_type,
        'stable' AS temperature,  -- Default, will be updated by scoring
        NOW() AS last_modified_at
    FROM __sitemap_p_link
    WHERE map_has_item > 5
    ON CONFLICT (url) DO UPDATE SET
        last_modified_at = NOW(),
        updated_at = NOW();

    GET DIAGNOSTICS synced_count = ROW_COUNT;
    RETURN synced_count;
END;
$$ LANGUAGE plpgsql;

-- Fonction: Log génération sitemap
CREATE OR REPLACE FUNCTION log_sitemap_generation(
    p_run_id UUID,
    p_bucket TEXT,
    p_status TEXT,
    p_urls_total INT DEFAULT 0,
    p_files_generated INT DEFAULT 0,
    p_duration_ms INT DEFAULT 0,
    p_error TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO __seo_generation_log (
        run_id, generation_type, bucket, status,
        urls_total, files_generated, duration_ms,
        error_message, completed_at
    )
    VALUES (
        p_run_id, 'sitemap', p_bucket, p_status,
        p_urls_total, p_files_generated, p_duration_ms,
        p_error, NOW()
    )
    ON CONFLICT (run_id) DO UPDATE SET
        status = p_status,
        urls_total = p_urls_total,
        files_generated = p_files_generated,
        duration_ms = p_duration_ms,
        error_message = p_error,
        completed_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Fonction: Refresh température scores basé sur métriques
CREATE OR REPLACE FUNCTION refresh_temperature_scores()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Update temperature in __seo_page based on __seo_entity_score_v10
    UPDATE __seo_page p
    SET
        temperature = s.bucket,
        priority = CASE s.bucket
            WHEN 'hot' THEN 1.0
            WHEN 'new' THEN 0.8
            WHEN 'stable' THEN 0.6
            ELSE 0.4
        END,
        changefreq = CASE s.bucket
            WHEN 'hot' THEN 'daily'
            WHEN 'new' THEN 'daily'
            WHEN 'stable' THEN 'weekly'
            ELSE 'monthly'
        END,
        updated_at = NOW()
    FROM __seo_entity_score_v10 s
    WHERE p.url = s.url;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- INITIAL DATA MIGRATION (optional - run manually)
-- =====================================================

-- Uncomment to run initial sync from existing __sitemap_p_link
-- SELECT sync_sitemap_p_link_to_seo_page();

-- =====================================================
-- GRANTS (adjust as needed)
-- =====================================================

-- Grant select to anon for public sitemaps
-- GRANT SELECT ON __seo_page TO anon;
-- GRANT SELECT ON __seo_sitemap_file TO anon;
-- GRANT EXECUTE ON FUNCTION get_sitemap_urls_by_temperature TO anon;
