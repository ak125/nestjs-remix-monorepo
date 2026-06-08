-- =====================================================
-- catalog_universal_gammes — set des gammes UNIVERSELLES (T2a, READ-ONLY)
-- Date: 2026-06-08
--
-- ROLE: source de la « section Produits universels ». Retourne les gammes
--   universelles = SANS aucun fitment véhicule (`pieces_relation_type` vide) + ayant
--   des pièces VENDABLES (prix+dispo) + de NATURE consommable/visserie/fluide/joint.
--   Ce sont des produits vendus SANS véhicule (≈86 gammes, ≈3 531 pièces vendables
--   aujourd'hui invisibles). Les gammes sans fitment mais véhicule-spécifiques
--   (capteur, rotor, électrovanne… = avec OEM, à fitter) sont EXCLUES.
--
-- AUCUNE écriture (STABLE). « Curation au fur et à mesure » = la règle classe
--   automatiquement à chaque appel ; un futur override owner (table/flag, quand le
--   glob ownership sera ouvert) viendra raffiner les exceptions et SUPERSEDER cette
--   heuristique de nom (V1 documentée — PAS un magic-constant runtime définitif).
--
-- ⚠️ NON appliquée automatiquement — owner-gated. Read-only → apply data-safe.
-- =====================================================

set lock_timeout = '2s';
set statement_timeout = '60s';

CREATE OR REPLACE FUNCTION catalog_universal_gammes()
RETURNS TABLE(pg_id integer, pg_name text, pg_alias text, pg_display text, sellable_pieces bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT g.pg_id, g.pg_name, g.pg_alias, g.pg_display,
    count(p.piece_id) FILTER (
      WHERE EXISTS (SELECT 1 FROM pieces_price pr
        WHERE NULLIF(pr.pri_piece_id, '')::int = p.piece_id
          AND pr.pri_dispo IN ('1','2','3') AND NULLIF(TRIM(pr.pri_vente_ttc), '')::numeric > 0)
    ) AS sellable_pieces
  FROM pieces_gamme g
  JOIN pieces p ON p.piece_pg_id = g.pg_id
  WHERE NOT EXISTS (SELECT 1 FROM pieces_relation_type r WHERE r.rtp_pg_id = g.pg_id)
    -- nature consommable / visserie / fluide / joint (V1 seed heuristic, owner-overridable)
    AND LOWER(g.pg_name) ~ '(liquide|antigel|additif|nettoyant|graisse|lubrifiant|spray|entretien|substance|[ée]tanch|colle|silicone|fluide|bague|joint|vis|[eé]crou|rondelle|collier|clip|rivet|ressort|fusible|cosse|douille|manchon|raccord|bouchon|capuchon|connecteur|fiche|relais|goupille|circlip|durite|tuyau|gaine|assortiment|patte|attache)'
  GROUP BY g.pg_id, g.pg_name, g.pg_alias, g.pg_display
  HAVING count(p.piece_id) FILTER (
      WHERE EXISTS (SELECT 1 FROM pieces_price pr
        WHERE NULLIF(pr.pri_piece_id, '')::int = p.piece_id
          AND pr.pri_dispo IN ('1','2','3') AND NULLIF(TRIM(pr.pri_vente_ttc), '')::numeric > 0)
    ) > 0
  ORDER BY sellable_pieces DESC;
$$;

COMMENT ON FUNCTION catalog_universal_gammes() IS
  'READ-ONLY (STABLE) set of UNIVERSAL gammes for the "Produits universels" section: no vehicle fitment + sellable pieces (prix+dispo) + consumable/hardware/fluid nature. Sold without a vehicle. V1 seed heuristic (name-based), owner-overridable later (no fabricated fitment). Feeds the universal section + the governed activation pipeline.';