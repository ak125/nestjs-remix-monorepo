-- 20260602_price_competitiveness.sql
-- INBOUND competitor benchmark from Google Merchant Center "Price competitiveness".
--
-- Complement to the OUTBOUND feed (20260519_merchant_center_feed_v1.sql): that one
-- PUSHES our catalog to Google Shopping; this one INGESTS back, per product, the
-- click-weighted competitor benchmark price Google already computes from every
-- retailer selling the same offer. No scraping, no 403 — Google's own auction data.
--
-- Source: Content API for Shopping reports.search / PriceCompetitivenessProductView
--   (country-scoped, FR). Matching key = our offer_id (= g:id of the feed = piece id),
--   gtin stored alongside for cross-check. Benchmark = market AVERAGE (no named
--   competitor). Per docs/pricing/economic-governance-system.md: "concurrence = signal
--   bruité, jamais autorité" — this is an OBSERVE-only signal, it NEVER auto-reprices.
--
-- Layers: table (storage) + upsert RPC (VOLATILE, write) + gap RPC (STABLE, read).

-- ============================================================================
-- STORAGE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.__price_competitiveness (
  pc_id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pc_offer_id          text        NOT NULL,            -- our g:id (= piece id), join key to catalog
  pc_product_rest_id   text,                            -- full GMC REST product id (online:fr:FR:<offer>)
  pc_gtin              text,                             -- EAN if present (cross-check)
  pc_title             text,
  pc_brand             text,
  pc_country           text        NOT NULL DEFAULT 'FR',
  pc_our_price_eur     numeric(12,2) NOT NULL,
  pc_benchmark_price_eur numeric(12,2) NOT NULL,         -- market click-weighted average
  -- positive => we are ABOVE the market (candidate to lower); negative => below.
  pc_gap_pct           numeric(7,2)
                         GENERATED ALWAYS AS (
                           CASE WHEN pc_benchmark_price_eur > 0
                                THEN round((pc_our_price_eur - pc_benchmark_price_eur)
                                            / pc_benchmark_price_eur * 100, 2)
                           END
                         ) STORED,
  pc_report_date       date        NOT NULL,
  pc_fetched_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_price_competitiveness UNIQUE (pc_offer_id, pc_country, pc_report_date)
);

CREATE INDEX IF NOT EXISTS idx_pc_offer    ON public.__price_competitiveness (pc_offer_id);
CREATE INDEX IF NOT EXISTS idx_pc_gap      ON public.__price_competitiveness (pc_country, pc_gap_pct DESC);
CREATE INDEX IF NOT EXISTS idx_pc_date     ON public.__price_competitiveness (pc_report_date DESC);

COMMENT ON TABLE public.__price_competitiveness IS
  'GMC Price competitiveness benchmark per offer (OBSERVE-only competitor signal, never authority). Loaded by price-competitiveness.service.ts via Content API.';

-- ============================================================================
-- WRITE — bulk upsert (VOLATILE; service_role only). Idempotent per (offer,country,date).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.upsert_price_competitiveness_v1(p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  INSERT INTO public.__price_competitiveness AS t (
    pc_offer_id, pc_product_rest_id, pc_gtin, pc_title, pc_brand, pc_country,
    pc_our_price_eur, pc_benchmark_price_eur, pc_report_date
  )
  SELECT
    r->>'offer_id',
    r->>'product_rest_id',
    NULLIF(r->>'gtin',''),
    r->>'title',
    r->>'brand',
    COALESCE(NULLIF(r->>'country',''),'FR'),
    (r->>'our_price_eur')::numeric,
    (r->>'benchmark_price_eur')::numeric,
    (r->>'report_date')::date
  FROM jsonb_array_elements(p_rows) AS r
  WHERE r->>'offer_id' IS NOT NULL
    AND (r->>'benchmark_price_eur') IS NOT NULL
  ON CONFLICT (pc_offer_id, pc_country, pc_report_date) DO UPDATE SET
    pc_product_rest_id     = EXCLUDED.pc_product_rest_id,
    pc_gtin                = EXCLUDED.pc_gtin,
    pc_title               = EXCLUDED.pc_title,
    pc_brand               = EXCLUDED.pc_brand,
    pc_our_price_eur       = EXCLUDED.pc_our_price_eur,
    pc_benchmark_price_eur = EXCLUDED.pc_benchmark_price_eur,
    pc_fetched_at          = now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================================
-- READ — latest benchmark per offer + gap, filterable (STABLE; PostgREST-safe).
-- Positive gap_pct = we are above the market => candidate to lower (down to the
-- break-even floor, never below — that gate stays in pricing-invariants).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_price_competitiveness_gap_v1(
  p_country     text    DEFAULT 'FR',
  p_min_gap_pct numeric DEFAULT NULL,   -- e.g. 5 => only offers >=5% above market
  p_limit       integer DEFAULT 200,
  p_offset      integer DEFAULT 0
)
RETURNS TABLE (
  offer_id            text,
  title               text,
  brand               text,
  our_price_eur       numeric,
  benchmark_price_eur numeric,
  gap_pct             numeric,
  report_date         date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH latest AS (
    SELECT DISTINCT ON (pc_offer_id)
      pc_offer_id, pc_title, pc_brand, pc_our_price_eur,
      pc_benchmark_price_eur, pc_gap_pct, pc_report_date
    FROM public.__price_competitiveness
    WHERE pc_country = p_country
    ORDER BY pc_offer_id, pc_report_date DESC
  )
  SELECT pc_offer_id, pc_title, pc_brand, pc_our_price_eur,
         pc_benchmark_price_eur, pc_gap_pct, pc_report_date
  FROM latest
  WHERE (p_min_gap_pct IS NULL OR pc_gap_pct >= p_min_gap_pct)
  ORDER BY pc_gap_pct DESC NULLS LAST
  LIMIT GREATEST(p_limit, 0) OFFSET GREATEST(p_offset, 0);
$$;

-- ============================================================================
-- GRANTS — service_role only (anon/authenticated have no access; ADR-021).
-- ============================================================================
REVOKE ALL ON public.__price_competitiveness FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.upsert_price_competitiveness_v1(jsonb)    FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.get_price_competitiveness_gap_v1(text, numeric, integer, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_price_competitiveness_v1(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_price_competitiveness_gap_v1(text, numeric, integer, integer) TO service_role;
