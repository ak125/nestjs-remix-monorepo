-- Migration: RPCs pour alternatives quand 0 produits sur une combinaison gamme+véhicule
-- Contexte: Page utile 200+noindex au lieu de 404 (SEO GSC fix)

-- RPC 1: Autres gammes disponibles pour un véhicule donné
CREATE OR REPLACE FUNCTION get_alternative_gammes_for_vehicle(
  p_type_id INTEGER,
  p_exclude_gamme_id INTEGER,
  p_limit INTEGER DEFAULT 12
)
RETURNS TABLE (
  pg_id INTEGER,
  pg_name TEXT,
  pg_alias TEXT,
  pg_pic TEXT
)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT pg.pg_id, pg.pg_name::TEXT, pg.pg_alias::TEXT, pg.pg_pic::TEXT
  FROM pieces_relation_type rtp
  JOIN pieces_gamme pg ON pg.pg_id = rtp.rtp_pg_id
  WHERE rtp.rtp_type_id = p_type_id
    AND rtp.rtp_pg_id != p_exclude_gamme_id
    AND pg.pg_display = '1'
  ORDER BY pg.pg_name
  LIMIT p_limit;
$$;

-- RPC 2: Autres véhicules disponibles pour une gamme donnée
CREATE OR REPLACE FUNCTION get_alternative_vehicles_for_gamme(
  p_gamme_id INTEGER,
  p_exclude_type_id INTEGER,
  p_limit INTEGER DEFAULT 6
)
RETURNS TABLE (
  type_id TEXT,
  type_name TEXT,
  type_alias TEXT,
  modele_name TEXT,
  modele_alias TEXT,
  modele_id INTEGER,
  marque_name TEXT,
  marque_alias TEXT,
  marque_id INTEGER
)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT
    at.type_id,
    at.type_name::TEXT,
    at.type_alias::TEXT,
    am.modele_name::TEXT,
    am.modele_alias::TEXT,
    am.modele_id::INTEGER,
    amq.marque_name::TEXT,
    amq.marque_alias::TEXT,
    amq.marque_id::INTEGER
  FROM pieces_relation_type rtp
  JOIN auto_type at ON at.type_id = rtp.rtp_type_id::TEXT
  JOIN auto_modele am ON am.modele_id = at.type_modele_id::INTEGER
  JOIN auto_marque amq ON amq.marque_id = at.type_marque_id::INTEGER
  WHERE rtp.rtp_pg_id = p_gamme_id
    AND rtp.rtp_type_id != p_exclude_type_id
  LIMIT p_limit;
$$;
