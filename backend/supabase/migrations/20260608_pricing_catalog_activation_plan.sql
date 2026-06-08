-- =====================================================
-- catalog_activation_plan — passe d'activation catalogue (T1, READ-ONLY / dry-run)
-- Date: 2026-06-08
--
-- ROLE: classifieur read-only de la « passe d'activation » du pipeline tarif (design
--   audit/orphan-price-and-universal-section-design-2026-06-08.md §5bis). Pour un
--   batch tarif (= marque `pieces.piece_pm_id`), classe les pièces PRIX-VENDABLE
--   (pieces_price : pri_dispo IN '1','2','3' AND pri_vente_ttc>0) en :
--     already_visible / display_gated / accessory / gamme_inactive /
--     orphan_with_oem / orphan_no_source
--   et propose des `universal_candidates` (gammes orphelines sans OEM = candidates
--   « section universelle », à confirmer par l'owner — construction au fur et à mesure).
--
-- AUCUNE écriture (STABLE). Émet seulement un PLAN. Les mutations (activation display,
--   tag universel, fitment) sont des étapes SÉPARÉES owner-gated (T2-T4). Casts/guards
--   alignés sur get_listing_products_extended (live) + validés sur marque réelle.
--
-- ⚠️ NON appliquée automatiquement — owner-gated. Read-only, donc apply sans risque
--   data ; à appliquer pour exposer l'endpoint /api/admin/pricing/activation/plan.
-- =====================================================

set lock_timeout = '2s';
set statement_timeout = '60s';

CREATE OR REPLACE FUNCTION catalog_activation_plan(p_brand_pm_id integer)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  WITH brand_pieces AS (
    SELECT p.piece_id, p.piece_pg_id, p.piece_pg_pid, p.piece_has_oem, p.piece_display
    FROM pieces p
    WHERE NULLIF(p.piece_pm_id::text, '')::int = p_brand_pm_id
  ),
  sellable AS (
    SELECT bp.*
    FROM brand_pieces bp
    WHERE EXISTS (
      SELECT 1 FROM pieces_price pr
      WHERE NULLIF(pr.pri_piece_id, '')::int = bp.piece_id
        AND pr.pri_dispo IN ('1', '2', '3')
        AND NULLIF(TRIM(pr.pri_vente_ttc), '')::numeric > 0
    )
  ),
  classified AS (
    SELECT s.piece_id, s.piece_pg_id, s.piece_pg_pid, s.piece_has_oem, s.piece_display,
           EXISTS (SELECT 1 FROM pieces_relation_type r WHERE r.rtp_piece_id = s.piece_id) AS has_link,
           g.pg_display AS gd
    FROM sellable s
    LEFT JOIN pieces_gamme g ON g.pg_id = s.piece_pg_id
  ),
  cand AS (
    SELECT c.piece_pg_id, gg.pg_name, count(*) AS n
    FROM classified c
    LEFT JOIN pieces_gamme gg ON gg.pg_id = c.piece_pg_id
    WHERE NOT c.has_link AND NOT c.piece_has_oem
    GROUP BY c.piece_pg_id, gg.pg_name
    ORDER BY count(*) DESC
    LIMIT 50
  )
  SELECT jsonb_build_object(
    'brand_pm_id', p_brand_pm_id,
    'sellable_priced', (SELECT count(*) FROM classified),
    'categories', jsonb_build_object(
      'already_visible',   (SELECT count(*) FROM classified WHERE has_link AND piece_display AND gd = '1'),
      'display_gated',     (SELECT count(*) FROM classified WHERE has_link AND NOT piece_display),
      'accessory',         (SELECT count(*) FROM classified WHERE piece_pg_pid IS NOT NULL AND piece_pg_pid <> 0 AND piece_pg_pid <> piece_pg_id),
      'gamme_inactive',    (SELECT count(*) FROM classified WHERE has_link AND gd IS DISTINCT FROM '1'),
      'orphan_with_oem',   (SELECT count(*) FROM classified WHERE NOT has_link AND piece_has_oem),
      'orphan_no_source',  (SELECT count(*) FROM classified WHERE NOT has_link AND NOT piece_has_oem)
    ),
    'orphan_no_source_by_gamme', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('pg_id', piece_pg_id, 'pg_name', pg_name, 'pieces', n)) FROM cand),
      '[]'::jsonb
    )
  );
$$;

COMMENT ON FUNCTION catalog_activation_plan(integer) IS
  'READ-ONLY (STABLE) activation/orphan-recovery classifier for a brand batch (pieces.piece_pm_id). Classes sellable-priced pieces into already_visible/display_gated/accessory/gamme_inactive/orphan_with_oem/orphan_no_source + proposes universal_candidates (orphan + no-OEM gammes). NO writes — emits a dry-run plan only. Feeds the governed activation pipeline (T1). Mutations are separate owner-gated steps.';
