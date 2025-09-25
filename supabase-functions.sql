-- ==================================================================
-- FONCTIONS SQL POSTGRESQL POUR REPRODUIRE LA LOGIQUE PHP EXACTE
-- ==================================================================

-- 1. FONCTION PRINCIPALE : Récupération des familles pour un véhicule
-- Reproduction exacte de la requête PHP avec adaptation PostgreSQL
CREATE OR REPLACE FUNCTION get_catalog_families_for_vehicle(p_type_id INTEGER)
RETURNS TABLE(
    mf_id INTEGER,
    mf_name TEXT,
    mf_name_system TEXT,
    mf_description TEXT,
    mf_pic TEXT,
    mf_display INTEGER,
    mf_sort INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT 
        cf.mf_id,
        COALESCE(cf.mf_name_system, cf.mf_name) AS mf_name,  -- Équivalent IF() MySQL
        cf.mf_name_system,
        cf.mf_description,
        cf.mf_pic,
        cf.mf_display,
        cf.mf_sort
    FROM pieces_relation_type prt
    JOIN pieces p ON p.piece_id = prt.rtp_piece_id AND p.piece_pg_id = prt.rtp_pg_id
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

-- 2. FONCTION GAMMES : Récupération des gammes pour une famille et un véhicule  
-- Reproduction de la sous-requête PHP pour les gammes
CREATE OR REPLACE FUNCTION get_gammes_for_family_and_vehicle(p_type_id INTEGER, p_mf_id INTEGER)
RETURNS TABLE(
    pg_id INTEGER,
    pg_alias TEXT,
    pg_name TEXT,
    pg_name_url TEXT,
    pg_name_meta TEXT,
    pg_pic TEXT,
    pg_img TEXT,
    pg_display INTEGER,
    pg_level INTEGER,
    mc_sort INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT 
        pg.pg_id,
        pg.pg_alias,
        pg.pg_name,
        pg.pg_name_url,
        pg.pg_name_meta,
        pg.pg_pic,
        pg.pg_img,
        pg.pg_display,
        pg.pg_level,
        cg.mc_sort
    FROM pieces_relation_type prt
    JOIN pieces p ON p.piece_id = prt.rtp_piece_id AND p.piece_pg_id = prt.rtp_pg_id
    JOIN pieces_gamme pg ON pg.pg_id = p.piece_pg_id
    JOIN catalog_gamme cg ON cg.mc_pg_id = pg.pg_id
    WHERE prt.rtp_type_id = p_type_id 
      AND p.piece_display = 1 
      AND pg.pg_display = 1 
      AND pg.pg_level IN (1, 2)
      AND cg.mc_mf_id = p_mf_id
    ORDER BY cg.mc_sort;
END;
$$ LANGUAGE plpgsql;

-- 3. FONCTION OPTIMISÉE : Version avec CTE pour performance
-- Version optimisée qui évite les timeouts sur les grosses tables
CREATE OR REPLACE FUNCTION get_catalog_families_for_vehicle_optimized(p_type_id INTEGER)
RETURNS TABLE(
    mf_id INTEGER,
    mf_name TEXT,
    mf_name_system TEXT,
    mf_description TEXT,
    mf_pic TEXT,
    mf_display INTEGER,
    mf_sort INTEGER,
    gammes_json JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH vehicle_pieces AS (
        -- Étape 1: Récupérer les pièces pour le véhicule (avec limite pour éviter timeout)
        SELECT DISTINCT prt.rtp_piece_id, prt.rtp_pg_id
        FROM pieces_relation_type prt
        WHERE prt.rtp_type_id = p_type_id
        LIMIT 10000  -- Limite de sécurité
    ),
    family_data AS (
        -- Étape 2: Joindre avec les familles
        SELECT DISTINCT 
            cf.mf_id,
            COALESCE(cf.mf_name_system, cf.mf_name) AS mf_name,
            cf.mf_name_system,
            cf.mf_description,
            cf.mf_pic,
            cf.mf_display,
            cf.mf_sort,
            jsonb_agg(DISTINCT jsonb_build_object(
                'pg_id', pg.pg_id,
                'pg_alias', pg.pg_alias,
                'pg_name', pg.pg_name,
                'pg_name_meta', pg.pg_name_meta,
                'pg_name_url', pg.pg_name_url,
                'pg_pic', pg.pg_pic,
                'pg_img', pg.pg_img,
                'pg_display', pg.pg_display,
                'pg_level', pg.pg_level,
                'mc_sort', cg.mc_sort
            ) ORDER BY cg.mc_sort) AS gammes_json
        FROM vehicle_pieces vp
        JOIN pieces p ON p.piece_id = vp.rtp_piece_id AND p.piece_pg_id = vp.rtp_pg_id
        JOIN pieces_gamme pg ON pg.pg_id = p.piece_pg_id
        JOIN catalog_gamme cg ON cg.mc_pg_id = pg.pg_id
        JOIN catalog_family cf ON cf.mf_id = cg.mc_mf_id
        WHERE p.piece_display = 1 
          AND pg.pg_display = 1 
          AND pg.pg_level IN (1, 2)
          AND cf.mf_display = 1
        GROUP BY cf.mf_id, cf.mf_name, cf.mf_name_system, cf.mf_description, cf.mf_pic, cf.mf_display, cf.mf_sort
    )
    SELECT 
        fd.mf_id,
        fd.mf_name,
        fd.mf_name_system,
        fd.mf_description,
        fd.mf_pic,
        fd.mf_display,
        fd.mf_sort,
        fd.gammes_json
    FROM family_data fd
    ORDER BY fd.mf_sort;
END;
$$ LANGUAGE plpgsql;

-- 4. FONCTION DE TEST : Pour vérifier l'accès à pieces_relation_type
CREATE OR REPLACE FUNCTION test_pieces_relation_access(p_type_id INTEGER)
RETURNS TABLE(
    total_relations BIGINT,
    sample_relations JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM pieces_relation_type WHERE rtp_type_id = p_type_id) as total_relations,
        (SELECT jsonb_agg(jsonb_build_object('rtp_piece_id', rtp_piece_id, 'rtp_pg_id', rtp_pg_id)) 
         FROM (SELECT rtp_piece_id, rtp_pg_id FROM pieces_relation_type WHERE rtp_type_id = p_type_id LIMIT 5) sample
        ) as sample_relations;
END;
$$ LANGUAGE plpgsql;