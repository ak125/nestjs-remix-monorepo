-- Migration : __seo_cwv_raw + self-rotation atomique.
--
-- Plan bloc 3 (CWV Runtime Observability). Table de landing des beacons
-- web-vitals émis depuis le frontend (`navigator.sendBeacon` POST
-- `/api/seo/cwv/beacon`). Aggregation hourly + daily livrée bloc 4.
--
-- Anti-régression PR #697 (partitions épuisées) : la fonction de rotation
-- ET son job pg_cron sont déclarés DANS LA MÊME MIGRATION (pattern atomique).
--
-- TTL court (48h) : la landing n'est jamais consommée en SLO, uniquement par
-- l'agg horaire/journalière. Après agg, raw devient redondant.
--
-- Le runner (scripts/ci/apply-supabase-migration.py) wrappe chaque fichier dans
-- une transaction (squawk: assume_in_transaction).

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- =============================================================================
-- 0. ENUM seo_event_type extension — AVANT toute écriture
-- =============================================================================
-- `CwvBeaconService.recordBot()` écrit ce event_type dans __seo_event_log dès
-- le déploiement de bloc 3. Owner-flagged : "ENUM doit arriver AVANT l'usage
-- en DB live". L'ajout est dans cette migration (pas bloc 5) pour atomicité
-- code↔schema. Idempotent via DO bloc.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'seo.runtime.bot_cwv_beacon'
          AND enumtypid = 'seo_event_type'::regtype
    ) THEN
        ALTER TYPE seo_event_type ADD VALUE 'seo.runtime.bot_cwv_beacon';
    END IF;
END $$;

-- =============================================================================
-- Table __seo_cwv_raw — landing beacons CWV, partitions daily, TTL 48h
-- =============================================================================

CREATE TABLE IF NOT EXISTS __seo_cwv_raw (
  -- Réception
  received_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Session (anon, no PII — sessionStorage côté client)
  session_id            TEXT NOT NULL CHECK (char_length(session_id) BETWEEN 8 AND 64),

  -- Taxonomie (CHECK IN alignés sur @repo/cwv-taxonomy)
  surface               TEXT NOT NULL CHECK (surface IN (
    'R2_PRODUCT', 'R2_GAMME_VEHICLE', 'R3_GUIDE', 'R5_DIAGNOSTIC',
    'R8_VEHICLE', 'SEARCH', 'HOME', 'CART', 'CHECKOUT', 'PAYMENT',
    'ACCOUNT', 'OTHER'
  )),
  route_group           TEXT NOT NULL CHECK (route_group IN (
    'pieces_product', 'pieces_gamme_vehicle', 'r3_guide', 'r5_diagnostic',
    'r8_vehicle', 'marques_listing', 'search', 'cart', 'checkout',
    'payment', 'account', 'home', 'other'
  )),
  priority_tier         TEXT NOT NULL CHECK (priority_tier IN ('CWV_P0', 'CWV_P1', 'CWV_P2')),

  -- Funnel (journey reconstruction)
  funnel_step           TEXT NOT NULL CHECK (funnel_step IN (
    'landing', 'view_listing', 'view_product', 'view_guide',
    'view_diagnostic', 'view_vehicle', 'view_search', 'view_account',
    'view_other', 'add_cart', 'checkout_entry', 'checkout_step',
    'payment', 'completed'
  )),
  previous_funnel_step  TEXT CHECK (previous_funnel_step IS NULL OR previous_funnel_step IN (
    'landing', 'view_listing', 'view_product', 'view_guide',
    'view_diagnostic', 'view_vehicle', 'view_search', 'view_account',
    'view_other', 'add_cart', 'checkout_entry', 'checkout_step',
    'payment', 'completed'
  )),

  -- Debug only (jamais utilisé en agg — risque PII si pas sanitized)
  url                   TEXT NOT NULL CHECK (char_length(url) <= 2000),

  -- Web Vital
  metric                TEXT NOT NULL CHECK (metric IN ('LCP', 'INP', 'CLS', 'FCP', 'TTFB')),
  value                 REAL NOT NULL CHECK (value >= 0 AND value <= 60000),

  -- Device + UA classification (serveur side après classifyUserAgent)
  device                TEXT NOT NULL CHECK (device IN ('mobile', 'desktop', 'tablet', 'unknown')),
  ua_class              TEXT NOT NULL CHECK (ua_class IN ('human', 'bot_search', 'bot_ai', 'bot_other')),

  -- Attribution sanitized JSONB (selector CSS structure only, no #id)
  attribution           JSONB,

  -- Navigation context
  nav_type              TEXT NOT NULL CHECK (nav_type IN (
    'navigate', 'reload', 'back_forward', 'prerender', 'restore', 'unknown'
  ))
) PARTITION BY RANGE (received_at);

COMMENT ON TABLE __seo_cwv_raw IS
  'Bloc 3 — landing beacons Core Web Vitals. Partitions daily, TTL 48h via maintain_cwv_raw_partitions(). NE PAS consommer en SLO direct — utiliser __seo_cwv_hourly/daily (bloc 4). Bots écrits dans __seo_event_log (jamais ici).';

COMMENT ON COLUMN __seo_cwv_raw.url IS
  'Debug only — JAMAIS utilisé en aggregation (PII potentiel). Pour segmenter, utiliser surface/route_group.';

COMMENT ON COLUMN __seo_cwv_raw.attribution IS
  'JSONB sanitized — selectors CSS structure only (#id strippé client-side avant send). Pour INP/LCP/CLS uniquement.';

-- Index pour agrégations bloc 4
CREATE INDEX IF NOT EXISTS idx_seo_cwv_raw_recv_surf_tier
  ON __seo_cwv_raw (received_at, surface, priority_tier);
CREATE INDEX IF NOT EXISTS idx_seo_cwv_raw_session
  ON __seo_cwv_raw (session_id, received_at)
  WHERE ua_class = 'human';

-- RLS — service_role only via JWT bypass (backend insert)
ALTER TABLE __seo_cwv_raw ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Fonction de rotation : premake D+lookahead + drop >retention (atomique)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.maintain_cwv_raw_partitions(
  p_lookahead_days INT DEFAULT 3,
  p_retention_days INT DEFAULT 2     -- TTL 48h ≈ 2 jours
)
RETURNS TABLE(action TEXT, partition_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent TEXT := '__seo_cwv_raw';
  v_day    DATE;
  v_next   DATE;
  v_last   DATE;
  v_part   TEXT;
  v_child  RECORD;
  v_cutoff DATE := (CURRENT_DATE - make_interval(days => p_retention_days))::date;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = v_parent AND n.nspname = 'public' AND c.relkind = 'p'
  ) THEN
    RETURN;
  END IF;

  v_day  := CURRENT_DATE;
  v_last := CURRENT_DATE + make_interval(days => p_lookahead_days);
  WHILE v_day <= v_last LOOP
    v_next := (v_day + INTERVAL '1 day')::date;
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

  FOR v_child IN
    SELECT c.relname
    FROM pg_inherits i
    JOIN pg_class p     ON p.oid = i.inhparent
    JOIN pg_class c     ON c.oid = i.inhrelid
    JOIN pg_namespace n ON n.oid = p.relnamespace
    WHERE p.relname = v_parent AND n.nspname = 'public'
      AND c.relname ~ ('^' || v_parent || '_p\d{8}$')
  LOOP
    IF to_date(right(v_child.relname, 8), 'YYYYMMDD') < v_cutoff THEN
      EXECUTE format('DROP TABLE IF EXISTS public.%I', v_child.relname);
      action := 'dropped'; partition_name := v_child.relname; RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.maintain_cwv_raw_partitions(INT, INT) IS
  'Bloc 3 — premake D+lookahead & drop >retention days pour __seo_cwv_raw. Idempotent. TTL 48h. Cron : cwv-raw-rotation quotidien 02:50 UTC.';

GRANT EXECUTE ON FUNCTION public.maintain_cwv_raw_partitions(INT, INT) TO service_role;

-- =============================================================================
-- Backfill + cron job (idempotent, atomique)
-- =============================================================================

SELECT public.maintain_cwv_raw_partitions();

-- Cron quotidien @ 02:55 UTC (après quality-history 02:50).
SELECT cron.schedule(
  'cwv-raw-rotation',
  '55 2 * * *',
  $cron$SELECT public.maintain_cwv_raw_partitions();$cron$
)
WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cwv-raw-rotation'
);
