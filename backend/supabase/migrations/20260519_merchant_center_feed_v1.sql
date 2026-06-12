-- =====================================================
-- PR commerce-loop V1 step 5B — Google Merchant Center XML feed RPC
-- Date: 2026-05-19
-- Refs: /home/deploy/.claude/plans/superpower-1-d-abord-proud-cookie.md (step 5B)
--       project_commerce_loop_v1_plan_20260519
-- =====================================================
--
-- get_merchant_center_feed_v1(p_limit, p_offset)
-- ----------------------------------------------
-- Streams piece rows ready for Google Shopping XML feed (g:* namespace).
-- Each row maps 1:1 to a <item> element in the RSS 2.0 output.
--
-- Filters (canonical e-commerce eligibility) :
--   - piece_display = '1'             (visible in catalog)
--   - pmi_display IS DISTINCT FROM '0' (image available)
--   - pri_dispo IN ('1', '3')          (in_stock OR preorder ; '0' excluded)
--   - pri_vente_ttc > 0                (real selling price)
--   - pm_display = '1'                 (brand visible)
--   - pg_display = '1'                 (gamme visible)
--
-- Source canon :
--   - pieces, pieces_price, pieces_gamme, pieces_marque, pieces_media_img
--     (cf canonical.json domain D7 catalog ; URLs via SITE_ORIGIN canon).
--   - R1 URL pattern : /pieces/{pg_alias}-{pg_id}.html (cf pieces.$slug.tsx)
--   - Image URL pattern : https://www.automecanik.com/img/rack-images/{folder}/{name}
--     (cf frontend/app/utils/image-optimizer.ts RACK_IMAGES bucket).
--
-- V1 scope (V1.5+ deferred) :
--   - SHIP_TO_FR + free shipping default → see frontend pieces-schema-commerce.constants
--   - One feed item per piece (no vehicle compatibility split → V1.5+ if needed)
--   - g:link = R1 gamme URL (universal landing) ; V1.5+ deep-link with #piece-{id}
--   - g:gtin from pri_ean when ≥ 8 digits ; else g:mpn = piece_ref
--   - No item_group_id (V1.5+ for variants)
-- =====================================================

set lock_timeout = '2s';
set statement_timeout = '30s';

CREATE OR REPLACE FUNCTION get_merchant_center_feed_v1(
  p_limit INT DEFAULT 1000,
  p_offset INT DEFAULT 0
) RETURNS TABLE (
  id TEXT,
  title TEXT,
  description TEXT,
  link TEXT,
  image_link TEXT,
  availability TEXT,
  price TEXT,
  brand TEXT,
  gtin TEXT,
  mpn TEXT,
  product_type TEXT,
  condition TEXT
) LANGUAGE sql STABLE AS $$
  WITH primary_image AS (
    -- One image per piece (lowest sort = primary)
    SELECT DISTINCT ON (pmi_piece_id_i)
      pmi_piece_id_i AS piece_id_i,
      pmi_folder,
      pmi_name
    FROM public.pieces_media_img
    WHERE COALESCE(pmi_display, '1') <> '0'
      AND pmi_folder IS NOT NULL AND pmi_folder <> ''
      AND pmi_name IS NOT NULL AND pmi_name <> ''
    ORDER BY pmi_piece_id_i, COALESCE(NULLIF(pmi_sort, '')::INT, 999) ASC
  ),
  primary_ean AS (
    -- Pick first valid EAN per piece (length ≥ 8 digits)
    SELECT DISTINCT ON (pri_piece_id_i)
      pri_piece_id_i AS piece_id_i,
      pri_ean,
      pri_vente_ttc::NUMERIC AS price_ttc,
      pri_dispo
    FROM public.pieces_price
    WHERE pri_dispo IN ('1', '3')
      AND pri_vente_ttc IS NOT NULL
      AND pri_vente_ttc <> ''
      AND NULLIF(pri_vente_ttc, '')::NUMERIC > 0
    ORDER BY pri_piece_id_i, pri_vente_ttc::NUMERIC ASC
  )
  SELECT
    p.piece_id::TEXT AS id,
    LEFT(
      g.pg_name || ' ' || COALESCE(m.pm_name, '') || ' ' || COALESCE(p.piece_name, '')
        || COALESCE(' ' || NULLIF(p.piece_name_side, ''), ''),
      150
    ) AS title,
    LEFT(
      COALESCE(p.piece_des, '')
        || ' — ' || g.pg_name || ' '
        || COALESCE(m.pm_name, '') || ' référence ' || p.piece_ref,
      5000
    ) AS description,
    'https://www.automecanik.com/pieces/' || g.pg_alias || '-' || g.pg_id::TEXT || '.html' AS link,
    'https://www.automecanik.com/img/rack-images/'
      || pi.pmi_folder || '/' || pi.pmi_name AS image_link,
    CASE pe.pri_dispo
      WHEN '1' THEN 'in_stock'
      WHEN '3' THEN 'preorder'
      ELSE 'out_of_stock'
    END AS availability,
    ROUND(pe.price_ttc, 2)::TEXT || ' EUR' AS price,
    m.pm_name AS brand,
    CASE
      WHEN pe.pri_ean IS NOT NULL
        AND pe.pri_ean ~ '^[0-9]{8,14}$'
      THEN pe.pri_ean
      ELSE NULL
    END AS gtin,
    p.piece_ref AS mpn,
    g.pg_name AS product_type,
    'new'::TEXT AS condition
  FROM public.pieces p
  INNER JOIN public.pieces_gamme g
    ON g.pg_id = p.piece_pg_id
    AND COALESCE(g.pg_display, '1') = '1'
  INNER JOIN public.pieces_marque m
    ON m.pm_id = p.piece_pm_id
    AND COALESCE(m.pm_display, '1') = '1'
  INNER JOIN primary_image pi
    ON pi.piece_id_i = p.piece_id
  INNER JOIN primary_ean pe
    ON pe.piece_id_i = p.piece_id
  WHERE p.piece_display = true
  ORDER BY p.piece_id
  LIMIT p_limit
  OFFSET p_offset;
$$;

COMMENT ON FUNCTION get_merchant_center_feed_v1(INT, INT) IS
  'PR commerce-loop V1 step 5B — Streams piece rows for Google Shopping XML feed (g:* namespace). 1 row = 1 <item>. Pagination via p_limit/p_offset. STABLE pure read. GRANT EXECUTE TO service_role only.';

REVOKE ALL ON FUNCTION get_merchant_center_feed_v1(INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_merchant_center_feed_v1(INT, INT) TO service_role;
