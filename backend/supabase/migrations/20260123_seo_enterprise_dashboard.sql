-- =====================================================
-- SEO ENTERPRISE DASHBOARD - CRAWL/INDEX/RISK MONITORING
-- Date: 2026-01-23
-- Objectif: Voir AVANT Google ce qui va être désindexé
-- =====================================================

-- =====================================================
-- TABLE 1: Index Status (tracking indexation)
-- =====================================================
CREATE TABLE IF NOT EXISTS __seo_index_status (
    url TEXT PRIMARY KEY,
    is_indexed BOOLEAN NOT NULL DEFAULT FALSE,
    first_seen_at TIMESTAMPTZ,           -- Première fois indexé
    last_seen_at TIMESTAMPTZ,            -- Dernière confirmation indexé
    last_crawl_at TIMESTAMPTZ,           -- Dernier crawl Googlebot
    crawl_count_30d INT DEFAULT 0,       -- Nombre de crawls sur 30 jours
    status_source TEXT DEFAULT 'inferred' CHECK (status_source IN ('gsc', 'inferred', 'manual')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seo_index_status_indexed ON __seo_index_status(is_indexed);
CREATE INDEX IF NOT EXISTS idx_seo_index_status_last_crawl ON __seo_index_status(last_crawl_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_index_status_first_seen ON __seo_index_status(first_seen_at DESC);

COMMENT ON TABLE __seo_index_status IS 'Tracking du statut d''indexation par URL';

-- =====================================================
-- TABLE 2: Entity Health (risk assessment)
-- =====================================================
CREATE TABLE IF NOT EXISTS __seo_entity_health (
    id BIGSERIAL PRIMARY KEY,
    entity_id BIGINT REFERENCES __seo_entity(id) ON DELETE CASCADE,
    url TEXT UNIQUE,

    -- Scores
    entity_score NUMERIC(5,2) DEFAULT 0,
    cluster_size INT DEFAULT 0,

    -- Crawl metrics
    crawl_frequency NUMERIC(5,2) DEFAULT 0,  -- crawls per week
    index_stability INT DEFAULT 0,            -- days indexed continuously

    -- Risk assessment
    risk_flag TEXT CHECK (risk_flag IN ('ORPHAN', 'DUPLICATE', 'WEAK_CLUSTER', 'LOW_CRAWL', 'CONFUSION')),
    risk_level INT DEFAULT 0 CHECK (risk_level BETWEEN 0 AND 100),

    -- Source metrics (for calculation)
    inbound_links INT DEFAULT 0,
    duplication_risk INT DEFAULT 0,
    confusion_risk INT DEFAULT 0,

    -- Timestamps
    last_evaluated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seo_entity_health_risk ON __seo_entity_health(risk_flag) WHERE risk_flag IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_seo_entity_health_level ON __seo_entity_health(risk_level DESC);
CREATE INDEX IF NOT EXISTS idx_seo_entity_health_entity ON __seo_entity_health(entity_id);
CREATE INDEX IF NOT EXISTS idx_seo_entity_health_crawl ON __seo_entity_health(crawl_frequency);

COMMENT ON TABLE __seo_entity_health IS 'Santé des entités SEO avec risk flags';

-- =====================================================
-- VIEW: URLs at Risk (dashboard principal)
-- =====================================================
CREATE OR REPLACE VIEW v_seo_urls_at_risk AS
SELECT
    h.url,
    h.risk_flag,
    h.risk_level,
    h.crawl_frequency,
    h.index_stability,
    h.cluster_size,
    h.inbound_links,
    i.is_indexed,
    i.last_crawl_at,
    i.first_seen_at,
    -- Urgency score: plus c'est haut, plus c'est urgent
    CASE
        WHEN h.risk_flag = 'CONFUSION' THEN 100
        WHEN h.risk_flag = 'ORPHAN' THEN 90
        WHEN i.last_crawl_at < NOW() - INTERVAL '14 days' AND i.is_indexed THEN 85
        WHEN h.risk_flag = 'LOW_CRAWL' THEN 70
        WHEN h.risk_flag = 'WEAK_CLUSTER' THEN 60
        WHEN h.risk_flag = 'DUPLICATE' THEN 50
        WHEN i.first_seen_at > NOW() - INTERVAL '7 days' THEN 40  -- Nouveau, fragile
        ELSE COALESCE(h.risk_level, 0)
    END AS urgency_score,
    -- Alert type
    CASE
        WHEN h.risk_flag = 'CONFUSION' THEN 'BLOQUANT'
        WHEN h.risk_flag = 'ORPHAN' THEN 'DANGER'
        WHEN i.last_crawl_at < NOW() - INTERVAL '14 days' THEN 'DESINDEXATION_PROBABLE'
        WHEN h.risk_flag IN ('LOW_CRAWL', 'WEAK_CLUSTER') THEN 'RISQUE'
        WHEN h.risk_flag = 'DUPLICATE' THEN 'INSTABLE'
        WHEN i.first_seen_at > NOW() - INTERVAL '7 days' THEN 'FRAGILE'
        ELSE 'SURVEILLANCE'
    END AS alert_type
FROM __seo_entity_health h
LEFT JOIN __seo_index_status i ON i.url = h.url
WHERE h.risk_flag IS NOT NULL
   OR (i.last_crawl_at < NOW() - INTERVAL '14 days' AND i.is_indexed = TRUE)
   OR (i.first_seen_at > NOW() - INTERVAL '7 days')
ORDER BY urgency_score DESC;

COMMENT ON VIEW v_seo_urls_at_risk IS 'URLs à risque triées par urgence';

-- =====================================================
-- VIEW: Dashboard Stats
-- =====================================================
CREATE OR REPLACE VIEW v_seo_dashboard_stats AS
SELECT
    -- Total URLs
    (SELECT COUNT(*) FROM __seo_index_status) AS total_urls,
    (SELECT COUNT(*) FROM __seo_index_status WHERE is_indexed = TRUE) AS indexed_urls,

    -- At risk
    (SELECT COUNT(*) FROM __seo_entity_health WHERE risk_flag IS NOT NULL) AS urls_at_risk,

    -- Risk breakdown
    (SELECT COUNT(*) FROM __seo_entity_health WHERE risk_flag = 'CONFUSION') AS risk_confusion,
    (SELECT COUNT(*) FROM __seo_entity_health WHERE risk_flag = 'ORPHAN') AS risk_orphan,
    (SELECT COUNT(*) FROM __seo_entity_health WHERE risk_flag = 'DUPLICATE') AS risk_duplicate,
    (SELECT COUNT(*) FROM __seo_entity_health WHERE risk_flag = 'WEAK_CLUSTER') AS risk_weak_cluster,
    (SELECT COUNT(*) FROM __seo_entity_health WHERE risk_flag = 'LOW_CRAWL') AS risk_low_crawl,

    -- Crawl health
    (SELECT COUNT(*) FROM __seo_crawl_log
     WHERE is_googlebot = TRUE AND crawled_at > NOW() - INTERVAL '24 hours') AS crawls_24h,
    (SELECT COUNT(*) FROM __seo_crawl_log
     WHERE is_googlebot = TRUE AND crawled_at > NOW() - INTERVAL '7 days') AS crawls_7d,
    (SELECT COUNT(*) FROM __seo_index_status
     WHERE last_crawl_at < NOW() - INTERVAL '14 days' AND is_indexed = TRUE) AS googlebot_absent_14d;

COMMENT ON VIEW v_seo_dashboard_stats IS 'Statistiques globales pour dashboard SEO';

-- =====================================================
-- VIEW: Crawl Activity (30 derniers jours)
-- =====================================================
CREATE OR REPLACE VIEW v_seo_crawl_activity AS
SELECT
    DATE(crawled_at) AS crawl_date,
    COUNT(*) AS total_crawls,
    COUNT(*) FILTER (WHERE is_googlebot = TRUE) AS googlebot_crawls,
    COUNT(DISTINCT url) AS unique_urls,
    AVG(response_ms) FILTER (WHERE response_ms IS NOT NULL) AS avg_response_ms,
    COUNT(*) FILTER (WHERE status_code >= 400) AS errors
FROM __seo_crawl_log
WHERE crawled_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(crawled_at)
ORDER BY crawl_date DESC;

COMMENT ON VIEW v_seo_crawl_activity IS 'Activité de crawl par jour (30 derniers jours)';

-- =====================================================
-- RPC: Update crawl stats from crawl_log
-- =====================================================
CREATE OR REPLACE FUNCTION update_index_status_from_crawl_log()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER := 0;
BEGIN
    -- Insert or update index_status from crawl_log
    INSERT INTO __seo_index_status (url, last_crawl_at, crawl_count_30d, updated_at)
    SELECT
        url,
        MAX(crawled_at) AS last_crawl_at,
        COUNT(*) FILTER (WHERE crawled_at > NOW() - INTERVAL '30 days') AS crawl_count_30d,
        NOW()
    FROM __seo_crawl_log
    WHERE is_googlebot = TRUE
    GROUP BY url
    ON CONFLICT (url) DO UPDATE SET
        last_crawl_at = EXCLUDED.last_crawl_at,
        crawl_count_30d = EXCLUDED.crawl_count_30d,
        updated_at = NOW();

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_index_status_from_crawl_log IS 'Met à jour index_status depuis crawl_log';

-- =====================================================
-- RPC: Calculate risk flags for all entities
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_risk_flags()
RETURNS TABLE (
    updated INTEGER,
    orphan_count INTEGER,
    duplicate_count INTEGER,
    weak_cluster_count INTEGER,
    low_crawl_count INTEGER,
    confusion_count INTEGER
) AS $$
DECLARE
    v_updated INTEGER := 0;
    v_orphan INTEGER := 0;
    v_duplicate INTEGER := 0;
    v_weak_cluster INTEGER := 0;
    v_low_crawl INTEGER := 0;
    v_confusion INTEGER := 0;
BEGIN
    -- Update risk flags based on metrics
    UPDATE __seo_entity_health h
    SET
        risk_flag = CASE
            WHEN h.confusion_risk >= 50 THEN 'CONFUSION'
            WHEN h.inbound_links = 0 THEN 'ORPHAN'
            WHEN h.duplication_risk > 50 THEN 'DUPLICATE'
            WHEN h.cluster_size < 3 THEN 'WEAK_CLUSTER'
            WHEN h.crawl_frequency < 0.5 THEN 'LOW_CRAWL'
            ELSE NULL
        END,
        risk_level = CASE
            WHEN h.confusion_risk >= 50 THEN 100
            WHEN h.inbound_links = 0 THEN 90
            WHEN h.duplication_risk > 50 THEN 50 + (h.duplication_risk / 2)
            WHEN h.cluster_size < 3 THEN 60 - (h.cluster_size * 10)
            WHEN h.crawl_frequency < 0.5 THEN 70 - (h.crawl_frequency * 100)::INT
            ELSE 0
        END,
        last_evaluated = NOW(),
        updated_at = NOW();

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    -- Count by flag
    SELECT COUNT(*) INTO v_orphan FROM __seo_entity_health WHERE risk_flag = 'ORPHAN';
    SELECT COUNT(*) INTO v_duplicate FROM __seo_entity_health WHERE risk_flag = 'DUPLICATE';
    SELECT COUNT(*) INTO v_weak_cluster FROM __seo_entity_health WHERE risk_flag = 'WEAK_CLUSTER';
    SELECT COUNT(*) INTO v_low_crawl FROM __seo_entity_health WHERE risk_flag = 'LOW_CRAWL';
    SELECT COUNT(*) INTO v_confusion FROM __seo_entity_health WHERE risk_flag = 'CONFUSION';

    RETURN QUERY SELECT v_updated, v_orphan, v_duplicate, v_weak_cluster, v_low_crawl, v_confusion;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_risk_flags IS 'Recalcule les risk flags pour toutes les entités';

-- =====================================================
-- RPC: Sync entity_health from entity_score_v10
-- =====================================================
CREATE OR REPLACE FUNCTION sync_entity_health_from_scores()
RETURNS INTEGER AS $$
DECLARE
    synced_count INTEGER := 0;
BEGIN
    -- Insert/update entity_health from entity_score_v10
    INSERT INTO __seo_entity_health (
        entity_id, url, entity_score, cluster_size,
        inbound_links, duplication_risk, confusion_risk
    )
    SELECT
        s.entity_id,
        s.url,
        s.score_total,
        s.cluster_size,
        s.inbound_links,
        s.duplication_risk,
        s.confusion_risk
    FROM __seo_entity_score_v10 s
    WHERE s.url IS NOT NULL
    ON CONFLICT (url) DO UPDATE SET
        entity_id = EXCLUDED.entity_id,
        entity_score = EXCLUDED.entity_score,
        cluster_size = EXCLUDED.cluster_size,
        inbound_links = EXCLUDED.inbound_links,
        duplication_risk = EXCLUDED.duplication_risk,
        confusion_risk = EXCLUDED.confusion_risk,
        updated_at = NOW();

    GET DIAGNOSTICS synced_count = ROW_COUNT;
    RETURN synced_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_entity_health_from_scores IS 'Synchronise entity_health depuis entity_score_v10';

-- =====================================================
-- RPC: Get URLs at risk with pagination
-- =====================================================
CREATE OR REPLACE FUNCTION get_urls_at_risk(
    p_limit INT DEFAULT 100,
    p_offset INT DEFAULT 0,
    p_risk_flag TEXT DEFAULT NULL
)
RETURNS TABLE (
    url TEXT,
    risk_flag TEXT,
    urgency_score INT,
    alert_type TEXT,
    crawl_frequency NUMERIC,
    index_stability INT,
    cluster_size INT,
    is_indexed BOOLEAN,
    last_crawl_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        v.url,
        v.risk_flag,
        v.urgency_score::INT,
        v.alert_type,
        v.crawl_frequency,
        v.index_stability,
        v.cluster_size,
        v.is_indexed,
        v.last_crawl_at
    FROM v_seo_urls_at_risk v
    WHERE (p_risk_flag IS NULL OR v.risk_flag = p_risk_flag)
    ORDER BY v.urgency_score DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_urls_at_risk IS 'Récupère les URLs à risque avec pagination';

-- =====================================================
-- ENTITY-CENTRIC: Satellite Page Tracking
-- =====================================================
-- Option A: Minimal - Ajouter colonnes à __seo_page existante

-- Marquer explicitement les pages satellites
ALTER TABLE __seo_page ADD COLUMN IF NOT EXISTS is_satellite BOOLEAN DEFAULT FALSE;

-- Lier la page satellite à son entité canonique parente
ALTER TABLE __seo_page ADD COLUMN IF NOT EXISTS canonical_entity_id BIGINT REFERENCES __seo_entity(id) ON DELETE SET NULL;

-- Type de satellite (pour analyse fine)
ALTER TABLE __seo_page ADD COLUMN IF NOT EXISTS satellite_type TEXT CHECK (satellite_type IN ('filter', 'variant', 'longtail', 'regional', 'mobile'));

-- Index pour requêtes satellites
CREATE INDEX IF NOT EXISTS idx_seo_page_satellite ON __seo_page(is_satellite) WHERE is_satellite = TRUE;
CREATE INDEX IF NOT EXISTS idx_seo_page_canonical_entity ON __seo_page(canonical_entity_id) WHERE canonical_entity_id IS NOT NULL;

COMMENT ON COLUMN __seo_page.is_satellite IS 'TRUE si page satellite (jamais indexée seule)';
COMMENT ON COLUMN __seo_page.canonical_entity_id IS 'Entité canonique parente de cette page satellite';
COMMENT ON COLUMN __seo_page.satellite_type IS 'Type de satellite: filter, variant, longtail, regional, mobile';

-- =====================================================
-- RPC: Auto-detect satellites (pages où canonical_url != url)
-- =====================================================
CREATE OR REPLACE FUNCTION detect_satellite_pages()
RETURNS INTEGER AS $$
DECLARE
    detected_count INTEGER := 0;
BEGIN
    -- Pages avec canonical_url différent de url = satellites
    UPDATE __seo_page
    SET
        is_satellite = TRUE,
        satellite_type = CASE
            WHEN page_type = 'filter' THEN 'filter'
            WHEN page_type = 'variant' THEN 'variant'
            WHEN page_type = 'longtail' THEN 'longtail'
            ELSE 'variant'
        END,
        updated_at = NOW()
    WHERE canonical_url IS NOT NULL
      AND canonical_url != url
      AND is_satellite IS NOT TRUE;

    GET DIAGNOSTICS detected_count = ROW_COUNT;
    RETURN detected_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION detect_satellite_pages IS 'Détecte automatiquement les pages satellites (canonical_url != url)';

-- =====================================================
-- RPC: Link satellites to their canonical entity
-- =====================================================
CREATE OR REPLACE FUNCTION link_satellites_to_entities()
RETURNS INTEGER AS $$
DECLARE
    linked_count INTEGER := 0;
BEGIN
    -- Lier satellite à entité via canonical_url
    UPDATE __seo_page p
    SET
        canonical_entity_id = e.id,
        updated_at = NOW()
    FROM __seo_entity e
    WHERE p.is_satellite = TRUE
      AND p.canonical_url = e.canonical_url
      AND p.canonical_entity_id IS NULL;

    GET DIAGNOSTICS linked_count = ROW_COUNT;
    RETURN linked_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION link_satellites_to_entities IS 'Lie les pages satellites à leur entité canonique parente';

-- =====================================================
-- VIEW: Entity with satellite count
-- =====================================================
CREATE OR REPLACE VIEW v_seo_entity_cluster AS
SELECT
    e.id AS entity_id,
    e.entity_type,
    e.slug,
    e.title,
    e.canonical_url,
    e.is_indexable,
    -- Page canonique
    cp.id AS canonical_page_id,
    cp.page_type AS canonical_page_type,
    -- Satellites
    COUNT(sp.id) AS satellite_count,
    ARRAY_AGG(DISTINCT sp.satellite_type) FILTER (WHERE sp.satellite_type IS NOT NULL) AS satellite_types
FROM __seo_entity e
LEFT JOIN __seo_page cp ON cp.url = e.canonical_url AND cp.page_type = 'canonical'
LEFT JOIN __seo_page sp ON sp.canonical_entity_id = e.id AND sp.is_satellite = TRUE
GROUP BY e.id, cp.id, cp.page_type;

COMMENT ON VIEW v_seo_entity_cluster IS 'Vue entité avec comptage des pages satellites';
