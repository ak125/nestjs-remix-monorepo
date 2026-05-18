-- 20260518120000_soft_404_events.sql
-- Soft-404 R2 telemetry : append-only events + vue agrégée 30j.
-- Owner: seo-platform. ADR: ADR-soft-404-r2-strategy.
-- Rétention: 90j (cron purge dans seo-routines, planifié post-merge).

BEGIN;

CREATE TABLE IF NOT EXISTS __soft_404_events (
  id        bigserial PRIMARY KEY,
  pg_id     integer NOT NULL,
  type_id   integer NOT NULL,
  ts        timestamptz NOT NULL DEFAULT now(),
  referrer  text,
  ua_class  text NOT NULL CHECK (ua_class IN ('bot', 'browser', 'unknown'))
);

CREATE INDEX IF NOT EXISTS idx_soft404_pair_ts
  ON __soft_404_events(pg_id, type_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_soft404_browser_ts
  ON __soft_404_events(ts) WHERE ua_class = 'browser';

CREATE OR REPLACE VIEW v_soft_404_demand_30d AS
SELECT
  pg_id,
  type_id,
  COUNT(*)::int AS hits,
  MAX(ts) AS last_seen
FROM __soft_404_events
WHERE ts > now() - interval '30 days'
  AND ua_class = 'browser'
GROUP BY pg_id, type_id
HAVING COUNT(*) >= 3
ORDER BY hits DESC;

COMMENT ON TABLE __soft_404_events IS
  'Soft-404 R2 telemetry, append-only, 90d retention. Ownership: seo-platform. ADR: ADR-soft-404-r2-strategy.';

COMMIT;
