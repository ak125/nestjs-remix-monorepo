-- ============================================================================
-- RPC Function: get_pieces_for_type_gamme V3 - VERSION AVEC SEO INTÉGRÉ
-- ============================================================================
-- Évolution de V2: Traitement des switches SEO directement en PostgreSQL
-- Plus de traitement JS côté serveur NestJS = performance optimale
--
-- ⚡ AVANTAGES PAR RAPPORT À V2:
--   - SEO traité en DB (0 requête JS supplémentaire)
--   - Retourne h1, title, description, content DÉJÀ PROCESSÉS
--   - Temps cible: <500ms au lieu de 1500-2500ms
--
-- SWITCHES SUPPORTÉS:
--   - #CompSwitch# : Switch générique (alias 3, pg_id=0)
--   - #CompSwitch_X# : Switch par alias pour gamme courante
--   - #CompSwitch_X_Y# : Switch cross-gamme (alias X, pg_id Y)
--   - #LinkGammeCar_Y# : Lien vers gamme Y avec véhicule
--   - #LinkGamme_Y# : Lien simple vers gamme Y
--   - #PrixPasCher# : Variations marketing prix
--
-- Usage depuis NestJS:
--   const { data } = await this.supabase.rpc('get_pieces_for_type_gamme_v3', { 
--     p_type_id: 9045, 
--     p_pg_id: 4 
--   });
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTION: process_seo_switch
-- Sélectionne un switch par rotation et remplace le marqueur
-- ============================================================================
CREATE OR REPLACE FUNCTION process_seo_switch(
  p_text TEXT,
  p_marker TEXT,
  p_switches JSONB,
  p_type_id INTEGER,
  p_offset INTEGER DEFAULT 0
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_count INTEGER;
  v_index INTEGER;
  v_content TEXT;
BEGIN
  IF p_text IS NULL OR p_marker IS NULL THEN
    RETURN COALESCE(p_text, '');
  END IF;
  
  IF p_text NOT LIKE '%' || p_marker || '%' THEN
    RETURN p_text;
  END IF;
  
  v_count := jsonb_array_length(p_switches);
  IF v_count = 0 THEN
    RETURN REPLACE(p_text, p_marker, '');
  END IF;
  
  -- Formule PHP: (type_id + offset) % count
  v_index := (p_type_id + p_offset) % v_count;
  v_content := p_switches->v_index->>'content';
  
  IF v_content IS NULL THEN
    RETURN REPLACE(p_text, p_marker, '');
  END IF;
  
  RETURN REPLACE(p_text, p_marker, v_content);
END;
$$;

-- ============================================================================
-- HELPER FUNCTION: process_prix_pas_cher
-- Remplace #PrixPasCher# par une variation marketing
-- ============================================================================
CREATE OR REPLACE FUNCTION process_prix_pas_cher(
  p_text TEXT,
  p_type_id INTEGER
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_variations TEXT[] := ARRAY[
    'à prix pas cher',
    'pas cher',
    'à petit prix',
    'bon marché',
    'à prix discount',
    'à prix réduit',
    'économique'
  ];
  v_index INTEGER;
BEGIN
  IF p_text IS NULL OR p_text NOT LIKE '%#PrixPasCher#%' THEN
    RETURN COALESCE(p_text, '');
  END IF;
  
  v_index := (p_type_id % array_length(v_variations, 1)) + 1;
  RETURN REPLACE(p_text, '#PrixPasCher#', v_variations[v_index]);
END;
$$;

-- ============================================================================
-- HELPER FUNCTION: process_seo_template
-- Traite TOUS les switches dans un template SEO
-- ============================================================================
CREATE OR REPLACE FUNCTION process_seo_template(
  p_template TEXT,
  p_type_id INTEGER,
  p_pg_id INTEGER,
  p_mf_id INTEGER,
  p_marque_name TEXT,
  p_marque_alias TEXT,
  p_marque_id INTEGER,
  p_modele_name TEXT,
  p_modele_alias TEXT,
  p_modele_id INTEGER,
  p_type_name TEXT,
  p_type_alias TEXT,
  p_type_power_ps TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_result TEXT := p_template;
  v_marker TEXT;
  v_match TEXT[];
  v_alias INTEGER;
  v_target_pg_id INTEGER;
  v_switches JSONB;
  v_gamme RECORD;
  v_link_html TEXT;
  v_counter INTEGER := 0;
  v_gamme_name TEXT;
  v_gamme_alias TEXT;
BEGIN
  IF v_result IS NULL OR v_result = '' THEN
    RETURN '';
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- ÉTAPE 0: Remplacer les variables véhicule (#VMarque#, #VModele#, etc.)
  -- ═══════════════════════════════════════════════════════════════════════════
  
  -- Récupérer le nom de la gamme
  SELECT pg_name, pg_alias INTO v_gamme_name, v_gamme_alias
  FROM pieces_gamme WHERE pg_id = p_pg_id;
  
  -- Variables véhicule
  v_result := REPLACE(v_result, '#VMarque#', COALESCE(p_marque_name, ''));
  v_result := REPLACE(v_result, '#VModele#', COALESCE(p_modele_name, ''));
  v_result := REPLACE(v_result, '#VType#', COALESCE(p_type_name, ''));
  v_result := REPLACE(v_result, '#VNbCh#', COALESCE(p_type_power_ps, ''));
  v_result := REPLACE(v_result, '#VAnnee#', ''); -- Non disponible dans ce contexte
  v_result := REPLACE(v_result, '#VCarosserie#', '');
  v_result := REPLACE(v_result, '#VMotorisation#', '');
  v_result := REPLACE(v_result, '#VCodeMoteur#', '');
  
  -- Variables gamme
  v_result := REPLACE(v_result, '#Gamme#', COALESCE(v_gamme_name, ''));
  v_result := REPLACE(v_result, '#GammeAlias#', COALESCE(v_gamme_alias, ''));
  
  -- Variables génériques
  v_result := REPLACE(v_result, '#VousPropose#', 'vous propose');
  v_result := REPLACE(v_result, '#MinPrice#', '');
  
  -- Variables liens véhicule
  v_result := REPLACE(v_result, '#LinkCarAll#', 
    TRIM(COALESCE(p_marque_name, '') || ' ' || COALESCE(p_modele_name, '') || ' ' || 
         COALESCE(p_type_name, '') || ' ' || COALESCE(p_type_power_ps, '') || ' ch'));
  v_result := REPLACE(v_result, '#LinkCar#', 
    TRIM(COALESCE(p_marque_name, '') || ' ' || COALESCE(p_modele_name, '') || ' ' || 
         COALESCE(p_type_name, '') || ' ' || COALESCE(p_type_power_ps, '') || ' ch'));

  -- ═══════════════════════════════════════════════════════════════════════════
  -- ÉTAPE 1: Traiter #CompSwitch# (switches génériques, alias=3, pg_id=0)
  -- ═══════════════════════════════════════════════════════════════════════════
  IF v_result LIKE '%#CompSwitch#%' THEN
    SELECT jsonb_agg(jsonb_build_object('content', sis_content))
    INTO v_switches
    FROM __seo_item_switch
    WHERE sis_pg_id = '0' AND sis_alias = '3';
    
    v_result := process_seo_switch(v_result, '#CompSwitch#', COALESCE(v_switches, '[]'::jsonb), p_type_id, 0);
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- ÉTAPE 2: Traiter #CompSwitch_X# (gamme courante)
  -- ═══════════════════════════════════════════════════════════════════════════
  FOR v_match IN 
    SELECT regexp_matches(v_result, '#CompSwitch_(\d+)#', 'g')
  LOOP
    v_alias := v_match[1]::INTEGER;
    v_marker := '#CompSwitch_' || v_alias || '#';
    
    IF v_result NOT LIKE '%' || v_marker || '%' THEN
      CONTINUE;
    END IF;
    
    -- Chercher dans __seo_gamme_car_switch pour la gamme courante
    SELECT jsonb_agg(jsonb_build_object('content', sgcs_content))
    INTO v_switches
    FROM __seo_gamme_car_switch
    WHERE sgcs_pg_id = p_pg_id::TEXT AND sgcs_alias = v_alias::TEXT;
    
    -- Fallback: chercher dans __seo_item_switch si rien trouvé
    IF v_switches IS NULL OR jsonb_array_length(v_switches) = 0 THEN
      SELECT jsonb_agg(jsonb_build_object('content', sis_content))
      INTO v_switches
      FROM __seo_item_switch
      WHERE sis_pg_id = p_pg_id::TEXT AND sis_alias = v_alias::TEXT;
    END IF;
    
    -- Fallback global alias 3 si toujours rien
    IF (v_switches IS NULL OR jsonb_array_length(v_switches) = 0) AND v_alias = p_pg_id THEN
      SELECT jsonb_agg(jsonb_build_object('content', sis_content))
      INTO v_switches
      FROM __seo_item_switch
      WHERE sis_pg_id = '0' AND sis_alias = '3';
    END IF;
    
    v_result := process_seo_switch(
      v_result, 
      v_marker, 
      COALESCE(v_switches, '[]'::jsonb), 
      p_type_id, 
      CASE WHEN v_alias = 3 THEN p_pg_id ELSE 0 END
    );
  END LOOP;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- ÉTAPE 3: Traiter #CompSwitch_X_Y# (cross-gamme et famille)
  -- ═══════════════════════════════════════════════════════════════════════════
  v_counter := 0;
  FOR v_match IN 
    SELECT regexp_matches(v_result, '#CompSwitch_(\d+)_(\d+)#', 'g')
  LOOP
    v_alias := v_match[1]::INTEGER;
    v_target_pg_id := v_match[2]::INTEGER;
    v_marker := '#CompSwitch_' || v_alias || '_' || v_target_pg_id || '#';
    
    IF v_result NOT LIKE '%' || v_marker || '%' THEN
      CONTINUE;
    END IF;
    
    -- Alias 11-16: switches famille
    IF v_alias >= 11 AND v_alias <= 16 AND p_mf_id IS NOT NULL THEN
      SELECT jsonb_agg(jsonb_build_object('content', sfgcs_content))
      INTO v_switches
      FROM __seo_family_gamme_car_switch
      WHERE sfgcs_mf_id = p_mf_id::TEXT 
        AND sfgcs_alias = v_alias::TEXT
        AND (sfgcs_pg_id = '0' OR sfgcs_pg_id = v_target_pg_id::TEXT);
      
      v_result := process_seo_switch(
        v_result, 
        v_marker, 
        COALESCE(v_switches, '[]'::jsonb), 
        p_type_id + p_pg_id + v_alias, 
        0
      );
    ELSE
      -- Cross-gamme: chercher dans gamme cible
      SELECT jsonb_agg(jsonb_build_object('content', sgcs_content))
      INTO v_switches
      FROM __seo_gamme_car_switch
      WHERE sgcs_pg_id = v_target_pg_id::TEXT AND sgcs_alias = v_alias::TEXT;
      
      -- Fallback alias 3 global
      IF (v_switches IS NULL OR jsonb_array_length(v_switches) = 0) AND v_alias = 3 THEN
        SELECT jsonb_agg(jsonb_build_object('content', sis_content))
        INTO v_switches
        FROM __seo_item_switch
        WHERE sis_pg_id = '0' AND sis_alias = '3';
      END IF;
      
      v_result := process_seo_switch(
        v_result, 
        v_marker, 
        COALESCE(v_switches, '[]'::jsonb), 
        p_type_id, 
        v_target_pg_id + v_counter + v_alias
      );
      v_counter := v_counter + 1;
    END IF;
  END LOOP;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- ÉTAPE 4: Traiter #LinkGammeCar_Y# (liens avec véhicule)
  -- ═══════════════════════════════════════════════════════════════════════════
  FOR v_match IN 
    SELECT regexp_matches(v_result, '#LinkGammeCar_(\d+)#', 'g')
  LOOP
    v_target_pg_id := v_match[1]::INTEGER;
    v_marker := '#LinkGammeCar_' || v_target_pg_id || '#';
    
    IF v_result NOT LIKE '%' || v_marker || '%' THEN
      CONTINUE;
    END IF;
    
    -- Récupérer info gamme cible
    SELECT pg_name, pg_alias INTO v_gamme
    FROM pieces_gamme
    WHERE pg_id = v_target_pg_id;
    
    IF v_gamme IS NULL THEN
      v_result := REPLACE(v_result, v_marker, '');
      CONTINUE;
    END IF;
    
    -- Récupérer switches alias 1 et 2 pour construire l'ancre
    DECLARE
      v_switches1 JSONB;
      v_switches2 JSONB;
      v_content1 TEXT;
      v_content2 TEXT;
      v_anchor TEXT;
      v_url TEXT;
    BEGIN
      SELECT jsonb_agg(jsonb_build_object('content', sgcs_content))
      INTO v_switches1
      FROM __seo_gamme_car_switch
      WHERE sgcs_pg_id = v_target_pg_id::TEXT AND sgcs_alias = '1';
      
      SELECT jsonb_agg(jsonb_build_object('content', sgcs_content))
      INTO v_switches2
      FROM __seo_gamme_car_switch
      WHERE sgcs_pg_id = v_target_pg_id::TEXT AND sgcs_alias = '2';
      
      IF v_switches1 IS NOT NULL AND jsonb_array_length(v_switches1) > 0 
         AND v_switches2 IS NOT NULL AND jsonb_array_length(v_switches2) > 0 THEN
        v_content1 := v_switches1->((p_type_id + v_target_pg_id + 2) % jsonb_array_length(v_switches1))->>'content';
        v_content2 := v_switches2->((p_type_id + v_target_pg_id + 3) % jsonb_array_length(v_switches2))->>'content';
        
        v_anchor := v_content1 || ' les ' || v_gamme.pg_name || ' ' || 
                    p_marque_name || ' ' || p_modele_name || ' ' || 
                    p_type_name || ' ' || p_type_power_ps || ' ch et ' || v_content2;
        
        v_url := '/pieces/' || v_gamme.pg_alias || '-' || v_target_pg_id || '/' ||
                 p_marque_alias || '-' || p_marque_id || '/' ||
                 p_modele_alias || '-' || p_modele_id || '/' ||
                 p_type_alias || '-' || p_type_id || '.html';
        
        v_link_html := '<a href="' || v_url || '" class="seo-internal-link" data-link-type="LinkGammeCar" data-target-gamme="' || v_target_pg_id || '">' || v_anchor || '</a>';
        v_result := REPLACE(v_result, v_marker, v_link_html);
      ELSE
        v_result := REPLACE(v_result, v_marker, '');
      END IF;
    END;
  END LOOP;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- ÉTAPE 5: Traiter #LinkGamme_Y# (liens simples)
  -- ═══════════════════════════════════════════════════════════════════════════
  FOR v_match IN 
    SELECT regexp_matches(v_result, '#LinkGamme_(\d+)#', 'g')
  LOOP
    v_target_pg_id := v_match[1]::INTEGER;
    v_marker := '#LinkGamme_' || v_target_pg_id || '#';
    
    IF v_result NOT LIKE '%' || v_marker || '%' THEN
      CONTINUE;
    END IF;
    
    SELECT pg_name, pg_alias INTO v_gamme
    FROM pieces_gamme
    WHERE pg_id = v_target_pg_id;
    
    IF v_gamme IS NOT NULL THEN
      v_link_html := '<a href="/pieces/' || v_gamme.pg_alias || '-' || v_target_pg_id || '.html" class="seo-internal-link" data-link-type="LinkGamme" data-target-gamme="' || v_target_pg_id || '"><b>' || v_gamme.pg_name || '</b></a>';
      v_result := REPLACE(v_result, v_marker, v_link_html);
    ELSE
      v_result := REPLACE(v_result, v_marker, '');
    END IF;
  END LOOP;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- ÉTAPE 6: Traiter #PrixPasCher#
  -- ═══════════════════════════════════════════════════════════════════════════
  v_result := process_prix_pas_cher(v_result, p_type_id);

  -- ═══════════════════════════════════════════════════════════════════════════
  -- ÉTAPE 7: Nettoyer les marqueurs non résolus
  -- ═══════════════════════════════════════════════════════════════════════════
  v_result := regexp_replace(v_result, '#CompSwitch[^#]*#', '', 'g');
  v_result := regexp_replace(v_result, '#LinkGammeCar_\d+#', '', 'g');
  v_result := regexp_replace(v_result, '#LinkGamme_\d+#', '', 'g');
  v_result := regexp_replace(v_result, '#PrixPasCher#', '', 'g');

  RETURN v_result;
END;
$$;

-- ============================================================================
-- MAIN FUNCTION: get_pieces_for_type_gamme_v3
-- Version avec SEO intégré - traitement complet côté PostgreSQL
-- ============================================================================
CREATE OR REPLACE FUNCTION get_pieces_for_type_gamme_v3(
  p_type_id INTEGER,
  p_pg_id INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_start_time TIMESTAMPTZ := clock_timestamp();
  v_duration_ms INTEGER;
  v_marque_name TEXT;
  v_marque_alias TEXT;
  v_marque_id INTEGER;
  v_modele_name TEXT;
  v_modele_alias TEXT;
  v_modele_id INTEGER;
  v_type_name TEXT;
  v_type_alias TEXT;
  v_type_power_ps TEXT;
  v_mf_id INTEGER;
  v_seo_h1 TEXT;
  v_seo_title TEXT;
  v_seo_description TEXT;
  v_seo_content TEXT;
  v_seo_preview TEXT;
  -- CDN Supabase Storage
  v_cdn_base TEXT := 'https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public';
BEGIN

  -- ═══════════════════════════════════════════════════════════════════════════
  -- PARTIE 0: RÉCUPÉRER LES INFOS VÉHICULE ET GAMME (pour SEO)
  -- ═══════════════════════════════════════════════════════════════════════════
  SELECT 
    amarq.marque_name,
    amarq.marque_alias,
    amarq.marque_id,
    am.modele_name,
    am.modele_alias,
    am.modele_id,
    at.type_name,
    at.type_alias,
    at.type_power_ps
  INTO 
    v_marque_name,
    v_marque_alias,
    v_marque_id,
    v_modele_name,
    v_modele_alias,
    v_modele_id,
    v_type_name,
    v_type_alias,
    v_type_power_ps
  FROM auto_type at
  JOIN auto_modele am ON am.modele_id = at.type_modele_id::INTEGER
  JOIN auto_marque amarq ON amarq.marque_id = am.modele_marque_id
  WHERE at.type_id::INTEGER = p_type_id
    AND at.type_display = '1'
  LIMIT 1;

  -- Récupérer mf_id pour les switches famille
  SELECT COALESCE(cg.mc_mf_prime, '')::INTEGER
  INTO v_mf_id
  FROM pieces_gamme pg
  LEFT JOIN catalog_gamme cg ON cg.mc_pg_id::INTEGER = pg.pg_id
  WHERE pg.pg_id = p_pg_id;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- PARTIE 1: TRAITER LES TEMPLATES SEO
  -- ═══════════════════════════════════════════════════════════════════════════
  SELECT 
    process_seo_template(
      COALESCE(sgc_h1, ''),
      p_type_id, p_pg_id, v_mf_id,
      v_marque_name, v_marque_alias, v_marque_id,
      v_modele_name, v_modele_alias, v_modele_id,
      v_type_name, v_type_alias, v_type_power_ps
    ),
    process_seo_template(
      COALESCE(sgc_title, ''),
      p_type_id, p_pg_id, v_mf_id,
      v_marque_name, v_marque_alias, v_marque_id,
      v_modele_name, v_modele_alias, v_modele_id,
      v_type_name, v_type_alias, v_type_power_ps
    ),
    process_seo_template(
      COALESCE(sgc_descrip, ''),
      p_type_id, p_pg_id, v_mf_id,
      v_marque_name, v_marque_alias, v_marque_id,
      v_modele_name, v_modele_alias, v_modele_id,
      v_type_name, v_type_alias, v_type_power_ps
    ),
    process_seo_template(
      COALESCE(sgc_content, ''),
      p_type_id, p_pg_id, v_mf_id,
      v_marque_name, v_marque_alias, v_marque_id,
      v_modele_name, v_modele_alias, v_modele_id,
      v_type_name, v_type_alias, v_type_power_ps
    ),
    process_seo_template(
      COALESCE(sgc_preview, ''),
      p_type_id, p_pg_id, v_mf_id,
      v_marque_name, v_marque_alias, v_marque_id,
      v_modele_name, v_modele_alias, v_modele_id,
      v_type_name, v_type_alias, v_type_power_ps
    )
  INTO v_seo_h1, v_seo_title, v_seo_description, v_seo_content, v_seo_preview
  FROM __seo_gamme_car
  WHERE sgc_pg_id::INTEGER = p_pg_id
  LIMIT 1;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- PARTIE 2: DONNÉES UNIFIÉES (comme V2)
  -- ═══════════════════════════════════════════════════════════════════════════
  
  WITH 
  -- 🚗 VEHICLE INFO
  vehicle_info AS (
    SELECT 
      at.type_id,
      at.type_name,
      at.type_alias,
      at.type_power_ps,
      at.type_power_kw,
      at.type_year_from,
      at.type_year_to,
      at.type_body,
      at.type_fuel,
      at.type_engine,
      at.type_liter,
      am.modele_id,
      am.modele_name,
      am.modele_alias,
      am.modele_pic,
      amarq.marque_id,
      amarq.marque_name,
      amarq.marque_alias,
      amarq.marque_logo
    FROM auto_type at
    JOIN auto_modele am ON am.modele_id = at.type_modele_id::INTEGER
    JOIN auto_marque amarq ON amarq.marque_id = am.modele_marque_id
    WHERE at.type_id::INTEGER = p_type_id
      AND at.type_display = '1'
    LIMIT 1
  ),
  
  -- 🔧 MOTOR CODES
  motor_codes AS (
    SELECT COALESCE(STRING_AGG(tmc_code, ', '), '') as codes
    FROM auto_type_motor_code
    WHERE tmc_type_id::INTEGER = p_type_id
  ),
  
  -- 📦 GAMME INFO
  gamme_info AS (
    SELECT 
      pg.pg_id,
      pg.pg_name,
      pg.pg_alias,
      pg.pg_pic,
      COALESCE(cg.mc_mf_prime, '') as mf_id
    FROM pieces_gamme pg
    LEFT JOIN catalog_gamme cg ON cg.mc_pg_id::INTEGER = pg.pg_id
    WHERE pg.pg_id = p_pg_id
    LIMIT 1
  ),
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- PARTIE 3: PIÈCES (code V2)
  -- ═══════════════════════════════════════════════════════════════════════════
  
  relations AS (
    SELECT DISTINCT 
      rtp_piece_id::INTEGER as rtp_piece_id,
      rtp_psf_id::INTEGER as rtp_psf_id,
      rtp_pm_id::INTEGER as rtp_pm_id
    FROM pieces_relation_type
    WHERE rtp_type_id::INTEGER = p_type_id
      AND rtp_pg_id::INTEGER = p_pg_id
    LIMIT 500
  ),
  
  root_gamme AS (
    SELECT pg_id, pg_name, pg_parent
    FROM pieces_gamme
    WHERE pg_id = p_pg_id
    LIMIT 1
  ),
  
  active_pieces AS (
    SELECT 
      p.piece_id,
      p.piece_name,
      p.piece_ref,
      p.piece_ref_clean,
      p.piece_des,
      p.piece_has_img,
      p.piece_has_oem,
      p.piece_qty_sale,
      p.piece_qty_pack,
      p.piece_name_side,
      p.piece_name_comp,
      p.piece_fil_id,
      p.piece_fil_name,
      p.piece_pm_id,
      r.rtp_psf_id,
      r.rtp_pm_id,
      CASE 
        WHEN LOWER(p.piece_fil_name) LIKE LOWER(RTRIM(SPLIT_PART(rg.pg_name, ' ', 1), 's')) || '%' THEN false
        ELSE true
      END as is_accessory
    FROM pieces p
    INNER JOIN relations r ON p.piece_id = r.rtp_piece_id
    CROSS JOIN root_gamme rg
    WHERE p.piece_display = true
  ),
  
  best_prices AS (
    SELECT DISTINCT ON (pri_piece_id)
      pri_piece_id,
      pri_vente_ttc,
      pri_consigne_ttc,
      pri_type,
      pri_dispo
    FROM pieces_price
    WHERE pri_piece_id IN (SELECT piece_id::TEXT FROM active_pieces)
      AND pri_dispo = '1'
    ORDER BY pri_piece_id, NULLIF(pri_type, '')::INTEGER DESC NULLS LAST
  ),
  
  first_images AS (
    SELECT DISTINCT ON (pmi_piece_id)
      pmi_piece_id as piece_id_text,
      pmi_folder,
      pmi_name,
      CASE 
        WHEN pmi_name ~* '\.(webp|jpg|jpeg|png|gif)$' THEN pmi_name
        ELSE pmi_name || '.webp'
      END as pmi_name_with_ext
    FROM pieces_media_img
    WHERE pmi_piece_id IN (SELECT piece_id::TEXT FROM active_pieces)
      AND pmi_display = '1'
    ORDER BY pmi_piece_id, pmi_sort ASC
  ),
  
  all_images AS (
    SELECT 
      pmi_piece_id as piece_id_text,
      jsonb_agg(
        jsonb_build_object(
          'url', v_cdn_base || '/rack-images/' || pmi_folder || '/' || 
            CASE 
              WHEN pmi_name ~* '\.(webp|jpg|jpeg|png|gif)$' THEN pmi_name
              ELSE pmi_name || '.webp'
            END,
          'alt', pmi_name,
          'sort', pmi_sort
        ) ORDER BY pmi_sort ASC
      ) as images
    FROM pieces_media_img
    WHERE pmi_piece_id IN (SELECT piece_id::TEXT FROM active_pieces)
      AND pmi_display = '1'
    GROUP BY pmi_piece_id
  ),
  
  piece_brands AS (
    SELECT 
      pm_id,
      pm_name,
      pm_logo,
      pm_nb_stars
    FROM pieces_marque
    WHERE pm_id IN (SELECT DISTINCT COALESCE(rtp_pm_id, piece_pm_id::INTEGER) FROM active_pieces)
  ),
  
  side_positions AS (
    SELECT 
      psf_id,
      psf_side
    FROM pieces_side_filtre
    WHERE psf_id IN (SELECT DISTINCT rtp_psf_id FROM active_pieces WHERE rtp_psf_id IS NOT NULL)
  ),
  
  criteria_positions AS (
    SELECT DISTINCT ON (pc_piece_id::INTEGER)
      pc_piece_id::INTEGER as piece_id,
      CASE 
        WHEN LOWER(pc_cri_value) LIKE '%essieu avant%' OR LOWER(pc_cri_value) = 'avant' THEN 'Avant'
        WHEN LOWER(pc_cri_value) LIKE '%essieu arrière%' OR LOWER(pc_cri_value) = 'arrière' THEN 'Arrière'
        WHEN LOWER(pc_cri_value) LIKE '%gauche%' OR LOWER(pc_cri_value) LIKE '%conducteur%' THEN 'Gauche'
        WHEN LOWER(pc_cri_value) LIKE '%droit%' OR LOWER(pc_cri_value) LIKE '%passager%' THEN 'Droite'
        ELSE NULL
      END as detected_position
    FROM pieces_criteria
    WHERE pc_piece_id::INTEGER IN (SELECT piece_id FROM active_pieces)
      AND pc_cri_id::TEXT = '100'
      AND pc_cri_value IS NOT NULL 
      AND pc_cri_value != ''
    ORDER BY pc_piece_id::INTEGER
  ),
  
  relation_criteria_positions AS (
    SELECT DISTINCT ON (piece_id)
      rcp_piece_id::INTEGER as piece_id,
      CASE 
        WHEN LOWER(rcp_cri_value) LIKE '%essieu avant%' OR LOWER(rcp_cri_value) = 'avant' THEN 'Avant'
        WHEN LOWER(rcp_cri_value) LIKE '%essieu arrière%' OR LOWER(rcp_cri_value) = 'arrière' THEN 'Arrière'
        WHEN rcp_cri_value LIKE '%+L%' OR LOWER(rcp_cri_value) LIKE '%gauche%' THEN 'Gauche'
        WHEN rcp_cri_value LIKE '%+R%' OR LOWER(rcp_cri_value) LIKE '%droit%' THEN 'Droite'
        ELSE NULL
      END as detected_position
    FROM pieces_relation_criteria
    WHERE rcp_type_id::INTEGER = p_type_id
      AND rcp_pg_id::INTEGER = p_pg_id
      AND rcp_piece_id::INTEGER IN (SELECT piece_id FROM active_pieces)
      AND rcp_cri_value IS NOT NULL 
      AND rcp_cri_value != ''
    ORDER BY piece_id
  ),
  
  assembled_pieces AS (
    SELECT 
      ap.piece_id as id,
      TRIM(CONCAT_WS(' ', ap.piece_name, 
        CASE WHEN COALESCE(sp.psf_side, ap.piece_name_side) IS NOT NULL 
          AND POSITION(LOWER(COALESCE(sp.psf_side, ap.piece_name_side)) IN LOWER(COALESCE(ap.piece_name, ''))) = 0
          THEN COALESCE(sp.psf_side, ap.piece_name_side) ELSE NULL END,
        CASE WHEN ap.piece_name_comp IS NOT NULL 
          AND POSITION(LOWER(ap.piece_name_comp) IN LOWER(COALESCE(ap.piece_name, ''))) = 0
          THEN ap.piece_name_comp ELSE NULL END
      )) as nom,
      ap.piece_ref as reference,
      ap.piece_ref_clean as reference_clean,
      ap.piece_des as description,
      COALESCE(ap.piece_qty_sale, 1)::NUMERIC as quantite_vente,
      ap.piece_has_img as has_image,
      ap.piece_has_oem as has_oem,
      ap.piece_fil_name as filtre_gamme,
      ap.is_accessory,
      COALESCE(pm.pm_name, 'Marque inconnue') as marque,
      pm.pm_id as marque_id,
      pm.pm_logo as marque_logo,
      COALESCE(NULLIF(pm.pm_nb_stars, '')::INTEGER, 0) as nb_stars,
      COALESCE(NULLIF(bp.pri_vente_ttc, '')::NUMERIC, 0) as prix_unitaire,
      (COALESCE(NULLIF(bp.pri_vente_ttc, '')::NUMERIC, 0) * COALESCE(ap.piece_qty_sale, 1))::NUMERIC as prix_ttc,
      (COALESCE(NULLIF(bp.pri_consigne_ttc, '')::NUMERIC, 0) * COALESCE(ap.piece_qty_sale, 1))::NUMERIC as prix_consigne,
      COALESCE(bp.pri_dispo, '0') = '1' as dispo,
      CASE WHEN fi.pmi_folder IS NOT NULL AND fi.pmi_name IS NOT NULL
        THEN v_cdn_base || '/rack-images/' || fi.pmi_folder || '/' || fi.pmi_name_with_ext
        ELSE v_cdn_base || '/uploads/articles/no.png'
      END as image,
      COALESCE(ai.images, '[]'::jsonb) as images,
      CASE 
        WHEN COALESCE(NULLIF(pm.pm_nb_stars, '')::INTEGER, 0) >= 4 THEN 'Premium'
        WHEN COALESCE(NULLIF(pm.pm_nb_stars, '')::INTEGER, 0) >= 3 THEN 'Qualité'
        ELSE 'Économique'
      END as qualite,
      COALESCE(rcp.detected_position, cp.detected_position, sp.psf_side, ap.piece_name_side) as filtre_side
    FROM active_pieces ap
    LEFT JOIN best_prices bp ON bp.pri_piece_id = ap.piece_id::TEXT
    LEFT JOIN first_images fi ON fi.piece_id_text = ap.piece_id::TEXT
    LEFT JOIN all_images ai ON ai.piece_id_text = ap.piece_id::TEXT
    LEFT JOIN piece_brands pm ON pm.pm_id = COALESCE(ap.rtp_pm_id, ap.piece_pm_id::INTEGER)
    LEFT JOIN side_positions sp ON sp.psf_id = ap.rtp_psf_id
    LEFT JOIN criteria_positions cp ON cp.piece_id = ap.piece_id
    LEFT JOIN relation_criteria_positions rcp ON rcp.piece_id = ap.piece_id
  ),
  
  sorted_pieces AS (
    SELECT * FROM assembled_pieces
    ORDER BY 
      CASE WHEN is_accessory THEN 1 ELSE 0 END,
      CASE filtre_side
        WHEN 'Avant' THEN 1
        WHEN 'Arrière' THEN 2
        WHEN 'Gauche' THEN 3
        WHEN 'Droite' THEN 4
        ELSE 5
      END,
      prix_unitaire ASC NULLS LAST
  ),
  
  -- 🏭 Brand OEM pour filtrer par constructeur
  oem_brand AS (
    SELECT prb.prb_id
    FROM pieces_ref_brand prb
    INNER JOIN vehicle_info vi ON UPPER(prb.prb_name) = UPPER(vi.marque_name)
    LIMIT 1
  ),
  
  -- 🔧 OEM refs avec position (filtre_side) de la pièce source
  -- Normalisation ULTRA-STRICTE: supprime TOUS les espaces, tirets, et préfixes
  oem_refs_with_position AS (
    SELECT 
      prs.prs_ref as ref,
      -- Normalisation STRICTE: tout en majuscules, sans espaces/tirets, sans préfixe lettre isolée
      -- Ex: "1K0 698 151 D" -> "1K0698151D"
      -- Ex: "1K0 698 151D" -> "1K0698151D" (même résultat)
      -- Ex: "L1K0698151D" -> "1K0698151D" (préfixe L supprimé)
      REGEXP_REPLACE(
        UPPER(REPLACE(REPLACE(REPLACE(prs.prs_ref, ' ', ''), '-', ''), '.', '')),
        '^[A-Z](?=[0-9])',  -- Supprime une lettre isolée au début suivie d'un chiffre
        ''
      ) as ref_normalized,
      sp.filtre_gamme,
      sp.filtre_side,
      sp.is_accessory,
      -- Priorité pour le tri: Avant=1, Arrière=2, autres=3, puis accessoires en dernier
      CASE 
        WHEN sp.is_accessory THEN 100
        WHEN sp.filtre_side = 'Avant' THEN 1
        WHEN sp.filtre_side = 'Arrière' THEN 2
        WHEN sp.filtre_side = 'Gauche' THEN 3
        WHEN sp.filtre_side = 'Droite' THEN 4
        ELSE 10
      END as group_priority,
      -- Score de "lisibilité": refs avec espaces bien placés sont préférées
      -- Format idéal: "XXX XXX XXX X" (3 espaces) ou "XXX XXX XXX XX" 
      CASE 
        WHEN prs.prs_ref ~ '^[A-Z0-9]{2,3} [0-9]{3} [0-9]{3} [A-Z0-9]{1,2}$' THEN 1  -- Format parfait avec espaces
        WHEN prs.prs_ref ~ '^[A-Z0-9]{2,3} [0-9]{3} [0-9]{3}[A-Z0-9]{1,2}$' THEN 2  -- Presque parfait (pas d'espace avant suffixe)
        WHEN prs.prs_ref ~ ' ' THEN 3  -- Au moins des espaces
        ELSE 10  -- Sans espaces
      END as format_score
    FROM pieces_ref_search prs
    INNER JOIN sorted_pieces sp ON prs.prs_piece_id = sp.id::TEXT
    INNER JOIN oem_brand ob ON prs.prs_prb_id = ob.prb_id
    WHERE prs.prs_kind = '3'
  ),
  
  -- 🎯 ÉTAPE 1: Dédoublonnage GLOBAL STRICT (une ref normalisée = UNE SEULE occurrence globale)
  -- Chaque ref n'apparaît QU'UNE SEULE fois, assignée au groupe prioritaire (Avant > Arrière > autres)
  -- Préfère le format avec espaces bien placés pour la lisibilité
  oem_refs_unique_global AS (
    SELECT DISTINCT ON (ref_normalized)
      ref,
      ref_normalized,
      filtre_gamme,
      filtre_side,
      is_accessory
    FROM oem_refs_with_position
    ORDER BY 
      ref_normalized,           -- Grouper par ref normalisée
      group_priority ASC,       -- Priorité: Avant > Arrière > autres > accessoires
      format_score ASC,         -- Préfère format avec espaces bien placés
      LENGTH(ref) DESC          -- En cas d'égalité, préfère le plus long
  ),
  
  -- 📊 Agrégation des OEM refs par groupe
  -- Chaque ref n'apparaît que dans UN SEUL groupe (celui prioritaire)
  oem_refs_by_group AS (
    SELECT 
      filtre_gamme,
      filtre_side,
      is_accessory,
      jsonb_agg(ref ORDER BY ref) as oem_refs,
      COUNT(*)::INTEGER as oem_refs_count
    FROM oem_refs_unique_global
    GROUP BY filtre_gamme, filtre_side, is_accessory
  ),
  
  grouped AS (
    SELECT 
      sp.filtre_gamme as group_gamme,
      sp.filtre_side as group_side,
      sp.is_accessory,
      CASE 
        WHEN sp.filtre_side IS NOT NULL AND sp.filtre_side != '' 
          THEN sp.filtre_gamme || ' - ' || sp.filtre_side
        ELSE sp.filtre_gamme
      END as title_h2,
      jsonb_agg(
        jsonb_build_object(
          'id', sp.id, 'nom', sp.nom, 'reference', sp.reference,
          'marque', sp.marque, 'marque_id', sp.marque_id, 'marque_logo', sp.marque_logo,
          'prix_unitaire', sp.prix_unitaire, 'prix_ttc', sp.prix_ttc,
          'image', sp.image, 'images', sp.images, 'dispo', sp.dispo, 'qualite', sp.qualite
        ) ORDER BY sp.prix_unitaire ASC NULLS LAST
      ) as pieces,
      -- 🆕 OEM refs intégrées directement dans le groupe
      COALESCE(og.oem_refs, '[]'::jsonb) as oem_refs,
      COALESCE(og.oem_refs_count, 0) as oem_refs_count
    FROM sorted_pieces sp
    LEFT JOIN oem_refs_by_group og 
      ON og.filtre_gamme IS NOT DISTINCT FROM sp.filtre_gamme
      AND og.filtre_side IS NOT DISTINCT FROM sp.filtre_side
      AND og.is_accessory = sp.is_accessory
    GROUP BY sp.filtre_gamme, sp.filtre_side, sp.is_accessory, og.oem_refs, og.oem_refs_count
  ),
  
  side_filter_agg AS (
    SELECT jsonb_build_object(
      'id', 'side', 'name', 'Position', 'type', 'checkbox',
      'options', COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
        'value', filtre_side, 'label', filtre_side, 'count', 1
      )) FILTER (WHERE filtre_side IS NOT NULL AND filtre_side != ''), '[]'::jsonb)
    ) as filter_data FROM sorted_pieces
  ),
  quality_filter_agg AS (
    SELECT jsonb_build_object(
      'id', 'quality', 'name', 'Qualité', 'type', 'checkbox',
      'options', COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
        'value', qualite, 'label', qualite, 'count', 1
      )), '[]'::jsonb)
    ) as filter_data FROM sorted_pieces
  ),
  brand_filter_agg AS (
    SELECT jsonb_build_object(
      'id', 'brand', 'name', 'Marque', 'type', 'checkbox',
      'options', COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
        'value', marque_id::TEXT, 'label', marque, 'count', 1
      )) FILTER (WHERE marque_id IS NOT NULL), '[]'::jsonb)
    ) as filter_data FROM sorted_pieces
  ),
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- PARTIE 4: OEM REFS GLOBAL (pour compatibilité - liste dédupliquée globale)
  -- ═══════════════════════════════════════════════════════════════════════════
  oem_refs_global AS (
    SELECT DISTINCT ON (ref_normalized)
      ref
    FROM oem_refs_unique_global
    ORDER BY ref_normalized, LENGTH(ref) DESC
    LIMIT 50
  )
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- RÉSULTAT FINAL V3 - AVEC SEO PROCESSÉ ET OEM PAR GROUPE
  -- ═══════════════════════════════════════════════════════════════════════════
  SELECT jsonb_build_object(
    -- 🚗 DONNÉES VÉHICULE
    'vehicle_info', (
      SELECT jsonb_build_object(
        'type_id', type_id,
        'type_name', type_name,
        'type_alias', type_alias,
        'type_power_ps', type_power_ps,
        'type_power_kw', type_power_kw,
        'type_year_from', type_year_from,
        'type_year_to', type_year_to,
        'type_body', type_body,
        'type_fuel', type_fuel,
        'type_engine', type_engine,
        'type_liter', type_liter,
        'modele_id', modele_id,
        'modele_name', modele_name,
        'modele_alias', modele_alias,
        'modele_pic', modele_pic,
        'marque_id', marque_id,
        'marque_name', marque_name,
        'marque_alias', marque_alias,
        'marque_logo', marque_logo,
        'motor_codes', (SELECT codes FROM motor_codes)
      )
      FROM vehicle_info
    ),
    'gamme_info', (
      SELECT jsonb_build_object(
        'pg_id', pg_id,
        'pg_name', pg_name,
        'pg_alias', pg_alias,
        'pg_pic', pg_pic,
        'mf_id', mf_id
      )
      FROM gamme_info
    ),
    
    -- 🎯 SEO PROCESSÉ (nouveauté V3!)
    'seo', jsonb_build_object(
      'h1', COALESCE(v_seo_h1, ''),
      'title', COALESCE(v_seo_title, ''),
      'description', COALESCE(v_seo_description, ''),
      'content', COALESCE(v_seo_content, ''),
      'preview', COALESCE(v_seo_preview, '')
    ),
    
    -- Templates bruts pour debug (optionnel)
    'seo_templates', (
      SELECT jsonb_build_object(
        'h1', COALESCE(sgc_h1, ''),
        'content', COALESCE(sgc_content, ''),
        'title', COALESCE(sgc_title, ''),
        'description', COALESCE(sgc_descrip, ''),
        'preview', COALESCE(sgc_preview, '')
      )
      FROM __seo_gamme_car
      WHERE sgc_pg_id::INTEGER = p_pg_id
      LIMIT 1
    ),
    
    'oem_refs', COALESCE((SELECT jsonb_agg(ref) FROM oem_refs_global), '[]'::jsonb),
    
    -- 📦 DONNÉES PIÈCES
    'pieces', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id, 'nom', nom, 'reference', reference, 'reference_clean', reference_clean,
          'description', description, 'marque', marque, 'marque_id', marque_id,
          'marque_logo', marque_logo, 'nb_stars', nb_stars,
          'prix_unitaire', prix_unitaire, 'prix_ttc', prix_ttc,
          'prix_consigne', prix_consigne, 'quantite_vente', quantite_vente,
          'dispo', dispo, 'image', image, 'images', images,
          'qualite', qualite, 'filtre_gamme', filtre_gamme, 'filtre_side', filtre_side,
          'has_image', has_image, 'has_oem', has_oem
        )
      )
      FROM sorted_pieces
    ), '[]'::jsonb),
    'grouped_pieces', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'filtre_gamme', group_gamme,
          'filtre_side', group_side,
          'title_h2', title_h2,
          'pieces', pieces,
          'oemRefs', oem_refs,
          'oemRefsCount', oem_refs_count
        )
        ORDER BY 
          CASE WHEN is_accessory THEN 1 ELSE 0 END,
          CASE group_side WHEN 'Avant' THEN 1 WHEN 'Arrière' THEN 2 
            WHEN 'Gauche' THEN 3 WHEN 'Droite' THEN 4 ELSE 5 END
      )
      FROM grouped
    ), '[]'::jsonb),
    'blocs', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'filtre_gamme', group_gamme, 'filtre_side', group_side,
          'title_h2', title_h2, 'pieces', pieces,
          'oemRefs', oem_refs,
          'oemRefsCount', oem_refs_count
        )
        ORDER BY 
          CASE WHEN is_accessory THEN 1 ELSE 0 END,
          CASE group_side WHEN 'Avant' THEN 1 WHEN 'Arrière' THEN 2 
            WHEN 'Gauche' THEN 3 WHEN 'Droite' THEN 4 ELSE 5 END
      )
      FROM grouped
    ), '[]'::jsonb),
    'filters', jsonb_build_object(
      'success', true,
      'data', jsonb_build_object(
        'filters', COALESCE((
          SELECT jsonb_agg(f.filter_data) 
          FROM (
            SELECT filter_data FROM side_filter_agg WHERE (filter_data->>'options')::jsonb != '[]'::jsonb
            UNION ALL
            SELECT filter_data FROM quality_filter_agg WHERE (filter_data->>'options')::jsonb != '[]'::jsonb
            UNION ALL
            SELECT filter_data FROM brand_filter_agg WHERE (filter_data->>'options')::jsonb != '[]'::jsonb
          ) f
        ), '[]'::jsonb),
        'summary', jsonb_build_object(
          'total_pieces', (SELECT COUNT(*)::INTEGER FROM sorted_pieces),
          'unique_brands', (SELECT COUNT(DISTINCT marque_id)::INTEGER FROM sorted_pieces WHERE marque_id IS NOT NULL),
          'unique_sides', (SELECT COUNT(DISTINCT filtre_side)::INTEGER FROM sorted_pieces WHERE filtre_side IS NOT NULL AND filtre_side != '')
        )
      )
    ),
    'count', (SELECT COUNT(*)::INTEGER FROM sorted_pieces),
    'minPrice', (SELECT MIN(prix_unitaire) FROM sorted_pieces WHERE prix_unitaire > 0),
    'relations_found', (SELECT COUNT(*)::INTEGER FROM relations),
    'success', true,
    'version', 'RPC_V3_SEO_INTEGRATED'
  ) INTO v_result;

  -- Ajouter la durée d'exécution
  v_duration_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INTEGER;
  v_result := v_result || jsonb_build_object('duration', v_duration_ms || 'ms');
  
  RETURN v_result;
END;
$$;

-- ============================================================================
-- Permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION process_seo_switch(TEXT, TEXT, JSONB, INTEGER, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION process_seo_switch(TEXT, TEXT, JSONB, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION process_seo_switch(TEXT, TEXT, JSONB, INTEGER, INTEGER) TO service_role;

GRANT EXECUTE ON FUNCTION process_prix_pas_cher(TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION process_prix_pas_cher(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION process_prix_pas_cher(TEXT, INTEGER) TO service_role;

GRANT EXECUTE ON FUNCTION process_seo_template(TEXT, INTEGER, INTEGER, INTEGER, TEXT, TEXT, INTEGER, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION process_seo_template(TEXT, INTEGER, INTEGER, INTEGER, TEXT, TEXT, INTEGER, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION process_seo_template(TEXT, INTEGER, INTEGER, INTEGER, TEXT, TEXT, INTEGER, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION get_pieces_for_type_gamme_v3(INTEGER, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_pieces_for_type_gamme_v3(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_pieces_for_type_gamme_v3(INTEGER, INTEGER) TO service_role;

-- ============================================================================
-- Documentation
-- ============================================================================
COMMENT ON FUNCTION get_pieces_for_type_gamme_v3 IS 
'⚡ RPC V3 - VERSION AVEC SEO INTÉGRÉ

ÉVOLUTION PAR RAPPORT À V2:
- Traitement des switches SEO directement en PostgreSQL
- Retourne h1, title, description, content DÉJÀ PROCESSÉS
- Zéro traitement JS côté NestJS pour le SEO

SWITCHES SUPPORTÉS:
- #CompSwitch# : Switch générique
- #CompSwitch_X# : Switch par alias
- #CompSwitch_X_Y# : Switch cross-gamme
- #LinkGammeCar_Y# : Lien vers gamme avec véhicule
- #LinkGamme_Y# : Lien simple vers gamme
- #PrixPasCher# : Variations marketing

PERFORMANCE: ~300-500ms au lieu de 1500-2500ms

Usage: supabase.rpc("get_pieces_for_type_gamme_v3", { p_type_id: 9045, p_pg_id: 4 })';

-- ============================================================================
-- Test
-- ============================================================================
-- SELECT get_pieces_for_type_gamme_v3(9045, 4);
-- SELECT get_pieces_for_type_gamme_v3(17398, 479);
