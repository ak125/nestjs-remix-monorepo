-- =====================================================
-- SEO CrUX Field Monitoring — History timeseries + Alert state machine
-- Date : 2026-05-14
-- Refs : ADR-063-cwv-monitoring-prod-crux-api (Accepted 2026-05-14)
--        ADR-045-seo-monitoring-cron-v0 (amends — volet CWV)
--        ADR-028-preprod-supabase-isolation (Option D READ_ONLY gate)
--        packages/seo-types/src/crux.ts (Zod mirror)
-- =====================================================
--
-- 2 tables pour le pipeline CrUX :
--   - __seo_crux_field_history : timeseries hebdo p75 LCP/INP/CLS/TTFB/FCP
--                                (CrUX History API renvoie 40 périodes hebdo
--                                 par fetch — `collectionPeriodCount: 40`)
--   - __seo_crux_alert_state   : state machine OPEN → STILL_OPEN → RESOLVED
--                                (fire-once, anti-spam quotidien)
--
-- Volume attendu :
--   field_history : origin × 2 form_factors × 52 + Top-100 URLs × 52
--                 ≈ 37k lignes/an (négligeable vs 30M/mois GSC)
--   alert_state   : ≤ qq centaines de lignes actives à tout moment
--
-- PK strategy (CRITIQUE) :
--   PostgreSQL refuse les expressions dans la PK d'une table partitionnée.
--   `url_key` est une colonne GENERATED ALWAYS STORED contenant
--   `COALESCE(url, '')` — origin-level (url=NULL) devient url_key='', donc
--   PK reste unique sans duplication possible entre origin et URL.
--
-- Partition strategy : RANGE BY collection_period_end_date, mensuel.
-- Cleanup : DROP PARTITION > 18 mois (cron à ajouter Phase 2).
-- =====================================================

-- =====================================================
-- TABLE 1 : __seo_crux_field_history
-- =====================================================
-- Stocke ce que CrUX renvoie réellement : périodes hebdomadaires avec
-- p75 sur fenêtre rolling 28j. `source_api='history'` réservé V1
-- (queryHistoryRecord) ; `source_api='record'` réservé V2 si besoin
-- de granularité intra-semaine (queryRecord snapshot 28j daily).

CREATE TABLE IF NOT EXISTS __seo_crux_field_history (
    origin TEXT NOT NULL,
    url TEXT NULL,
    url_key TEXT GENERATED ALWAYS AS (COALESCE(url, '')) STORED,
    form_factor TEXT NOT NULL CHECK (form_factor IN ('PHONE','DESKTOP','TABLET','ALL_FORM_FACTORS')),
    collection_period_start_date DATE NOT NULL,
    collection_period_end_date DATE NOT NULL,
    p75_lcp_ms INT CHECK (p75_lcp_ms IS NULL OR p75_lcp_ms >= 0),       -- Largest Contentful Paint (ms)
    p75_inp_ms INT CHECK (p75_inp_ms IS NULL OR p75_inp_ms >= 0),       -- Interaction to Next Paint (ms)
    p75_cls NUMERIC CHECK (p75_cls IS NULL OR p75_cls >= 0),            -- Cumulative Layout Shift (unitless)
    p75_ttfb_ms INT CHECK (p75_ttfb_ms IS NULL OR p75_ttfb_ms >= 0),    -- Time to First Byte (ms)
    p75_fcp_ms INT CHECK (p75_fcp_ms IS NULL OR p75_fcp_ms >= 0),       -- First Contentful Paint (ms)
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_api TEXT NOT NULL DEFAULT 'history'
        CHECK (source_api IN ('history','record')),
    PRIMARY KEY (origin, url_key, form_factor, collection_period_end_date)
) PARTITION BY RANGE (collection_period_end_date);

CREATE INDEX IF NOT EXISTS idx_crux_history_origin_period
    ON __seo_crux_field_history (origin, collection_period_end_date DESC);
CREATE INDEX IF NOT EXISTS idx_crux_history_url_period
    ON __seo_crux_field_history (url_key, collection_period_end_date DESC)
    WHERE url_key <> '';
CREATE INDEX IF NOT EXISTS idx_crux_history_form_factor
    ON __seo_crux_field_history (form_factor, collection_period_end_date DESC);

COMMENT ON TABLE __seo_crux_field_history IS
    'CrUX field timeseries hebdo (queryHistoryRecord, 40 périodes par fetch, rolling 28j).
     PK utilise url_key GENERATED COALESCE(url, '''') car PG refuse expressions dans PK partitionnée.
     ADR-063 (Accepted 2026-05-14).';

COMMENT ON COLUMN __seo_crux_field_history.url_key IS
    'Generated column COALESCE(url, '''') — requise pour PK sur table partitionnée
     (PG interdit expressions dans PK). Origin-level rows ont url_key='''' donc PK unique.';

COMMENT ON COLUMN __seo_crux_field_history.source_api IS
    'V1 = "history" (queryHistoryRecord, weekly periods, fenêtre rolling 28j).
     V2 réservé "record" (queryRecord, snapshot 28j daily) si granularité requise.';

-- Partitions initiales : 2026-05, 2026-06, 2026-07 (créées à l'avance)
CREATE TABLE IF NOT EXISTS __seo_crux_field_history_2026_05 PARTITION OF __seo_crux_field_history
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS __seo_crux_field_history_2026_06 PARTITION OF __seo_crux_field_history
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS __seo_crux_field_history_2026_07 PARTITION OF __seo_crux_field_history
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

-- =====================================================
-- TABLE 2 : __seo_crux_alert_state
-- =====================================================
-- State machine OPEN → STILL_OPEN → RESOLVED pour fire-once anti-spam.
-- Une ligne par cible alertable (origin, url_key, form_factor, metric).
-- Volume très modeste : ≤ qq centaines de lignes actives à tout moment
-- → pas de partition.

CREATE TABLE IF NOT EXISTS __seo_crux_alert_state (
    origin TEXT NOT NULL,
    url TEXT NULL,
    url_key TEXT GENERATED ALWAYS AS (COALESCE(url, '')) STORED,
    form_factor TEXT NOT NULL CHECK (form_factor IN ('PHONE','DESKTOP','TABLET','ALL_FORM_FACTORS')),
    metric TEXT NOT NULL CHECK (metric IN ('lcp','inp','cls','ttfb','fcp')),
    state TEXT NOT NULL CHECK (state IN ('OPEN','STILL_OPEN','RESOLVED')),
    severity TEXT NOT NULL CHECK (severity IN ('WARN','CRIT')),
    detector TEXT NOT NULL CHECK (detector IN ('absolute','delta')),
    opened_at TIMESTAMPTZ NOT NULL,
    last_emitted_at TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ NULL,
    last_observed_value NUMERIC NULL,
    last_baseline_median NUMERIC NULL,
    last_delta_pct NUMERIC NULL,
    PRIMARY KEY (origin, url_key, form_factor, metric)
);

CREATE INDEX IF NOT EXISTS idx_crux_alert_state_open
    ON __seo_crux_alert_state (state, last_emitted_at DESC)
    WHERE state <> 'RESOLVED';

COMMENT ON TABLE __seo_crux_alert_state IS
    'State machine alertes CrUX (OPEN → STILL_OPEN J+7 → RESOLVED). Fire-once anti-spam.
     PK utilise url_key GENERATED idem __seo_crux_field_history.
     ADR-063 (Accepted 2026-05-14).';

COMMENT ON COLUMN __seo_crux_alert_state.detector IS
    '"absolute" = seuils Google standards (LCP/INP/CLS WARN/CRIT) ;
     "delta" = Δ% vs median(trailing 4 periods), V1 origin-level uniquement.';

-- =====================================================
-- RLS : SELECT authenticated, INSERT/UPDATE service_role only
-- =====================================================
-- Conforme ADR-028 Option D + canon `feedback_no_overclaim_security_words` :
-- 2 couches sécurité (RLS Supabase + IsAdminGuard NestJS au niveau controller).

ALTER TABLE __seo_crux_field_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE __seo_crux_alert_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crux_field_history_select ON __seo_crux_field_history; -- APPROVED: idempotent re-apply pattern (DROP-then-CREATE, table just created in same migration)
CREATE POLICY crux_field_history_select ON __seo_crux_field_history
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS crux_field_history_write ON __seo_crux_field_history; -- APPROVED: idempotent re-apply pattern (DROP-then-CREATE, table just created in same migration)
CREATE POLICY crux_field_history_write ON __seo_crux_field_history
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS crux_alert_state_select ON __seo_crux_alert_state; -- APPROVED: idempotent re-apply pattern (DROP-then-CREATE, table just created in same migration)
CREATE POLICY crux_alert_state_select ON __seo_crux_alert_state
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS crux_alert_state_write ON __seo_crux_alert_state; -- APPROVED: idempotent re-apply pattern (DROP-then-CREATE, table just created in same migration)
CREATE POLICY crux_alert_state_write ON __seo_crux_alert_state
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- Audit : seo_event_type ENUM extension pour `crux_fetch_run`
-- =====================================================
-- Pattern ADR-045 — pas de schema change __seo_event_log, juste extend ENUM.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'crux_fetch_run'
          AND enumtypid = 'seo_event_type'::regtype
    ) THEN
        ALTER TYPE seo_event_type ADD VALUE 'crux_fetch_run';
    END IF;
END $$;
