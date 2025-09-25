-- 🎯 FONCTION PostgreSQL - Reproduction EXACTE de votre requête PHP
-- Cette fonction reproduit votre SELECT avec tous les JOINs et conditions

CREATE OR REPLACE FUNCTION get_vehicle_catalog_filtered(p_type_id INTEGER)
RETURNS TABLE(
    mf_id INTEGER,
    mf_name TEXT,
    mf_name_system TEXT,
    mf_description TEXT,
    mf_pic TEXT,
    mf_sort INTEGER
) AS $$
BEGIN
    -- 🚀 REPRODUCTION EXACTE DE VOTRE REQUÊTE PHP :
    -- SELECT DISTINCT MF_ID, IF(MF_NAME_SYSTEM IS NULL, MF_NAME, MF_NAME_SYSTEM) AS MF_NAME, 
    --     MF_DESCRIPTION, MF_PIC 
    -- FROM PIECES_RELATION_TYPE
    -- JOIN PIECES ON PIECE_ID = RTP_PIECE_ID AND PIECE_PG_ID = RTP_PG_ID
    -- JOIN PIECES_GAMME ON PG_ID = PIECE_PG_ID
    -- JOIN CATALOG_GAMME ON MC_PG_ID = PG_ID
    -- JOIN CATALOG_FAMILY ON MF_ID = MC_MF_ID
    -- WHERE RTP_TYPE_ID = $type_id 
    -- AND PIECE_DISPLAY = 1 AND PG_DISPLAY = 1 AND PG_LEVEL IN (1,2) AND MF_DISPLAY = 1
    -- ORDER BY MF_SORT
    
    RETURN QUERY
    SELECT DISTINCT 
        cf.mf_id,
        COALESCE(cf.mf_name_system, cf.mf_name) as mf_name,
        cf.mf_name_system,
        cf.mf_description,
        cf.mf_pic,
        cf.mf_sort
    FROM pieces_relation_type prt
    JOIN pieces p ON p.piece_id = prt.rtp_piece_id 
        AND p.piece_pg_id = prt.rtp_pg_id
    JOIN pieces_gamme pg ON pg.pg_id = p.piece_pg_id
    JOIN catalog_gamme cg ON cg.mc_pg_id = pg.pg_id
    JOIN catalog_family cf ON cf.mf_id = cg.mc_mf_id
    WHERE prt.rtp_type_id = p_type_id
        AND p.piece_display = 1
        AND pg.pg_display = 1
        AND pg.pg_level IN (1, 2)
        AND cf.mf_display = 1
    ORDER BY cf.mf_sort;
END;
$$ LANGUAGE plpgsql;

-- 🚀 INDEX pour optimiser la requête sur pieces_relation_type
-- Cet index est CRITIQUE pour éviter le full table scan sur 145M+ lignes
CREATE INDEX IF NOT EXISTS idx_pieces_relation_type_type_id 
ON pieces_relation_type(rtp_type_id);

-- 🚀 INDEX composé pour optimiser les JOINs
CREATE INDEX IF NOT EXISTS idx_pieces_relation_type_composite
ON pieces_relation_type(rtp_type_id, rtp_piece_id, rtp_pg_id);

-- 🚀 INDEX sur pieces pour optimiser le JOIN
CREATE INDEX IF NOT EXISTS idx_pieces_composite
ON pieces(piece_id, piece_pg_id) WHERE piece_display = 1;

-- ✅ Fonction créée avec succès
-- Test avec : SELECT * FROM get_vehicle_catalog_filtered(8408);