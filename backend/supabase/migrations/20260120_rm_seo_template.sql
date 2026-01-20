-- ============================================================================
-- MIGRATION: RM SEO Template Processor
-- ============================================================================
-- Main SEO template processing function for RM V2.
-- Depends on: process_seo_switch, process_prix_pas_cher (20260120_rm_seo_helpers.sql)
--
-- Date: 2026-01-20
-- ============================================================================

CREATE OR REPLACE FUNCTION public.process_seo_template(
    p_template text,
    p_type_id integer,
    p_pg_id integer,
    p_mf_id integer,
    p_marque_name text,
    p_marque_alias text,
    p_marque_id integer,
    p_modele_name text,
    p_modele_alias text,
    p_modele_id integer,
    p_type_name text,
    p_type_alias text,
    p_type_power_ps text
)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $function$
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
  -- STEP 0: Replace vehicle variables (#VMarque#, #VModele#, etc.)
  -- ═══════════════════════════════════════════════════════════════════════════

  -- Get gamme name
  SELECT pg_name, pg_alias INTO v_gamme_name, v_gamme_alias
  FROM pieces_gamme WHERE pg_id = p_pg_id;

  -- Vehicle variables
  v_result := REPLACE(v_result, '#VMarque#', COALESCE(p_marque_name, ''));
  v_result := REPLACE(v_result, '#VModele#', COALESCE(p_modele_name, ''));
  v_result := REPLACE(v_result, '#VType#', COALESCE(p_type_name, ''));
  v_result := REPLACE(v_result, '#VNbCh#', COALESCE(p_type_power_ps, ''));
  v_result := REPLACE(v_result, '#VAnnee#', '');
  v_result := REPLACE(v_result, '#VCarosserie#', '');
  v_result := REPLACE(v_result, '#VMotorisation#', '');
  v_result := REPLACE(v_result, '#VCodeMoteur#', '');

  -- Gamme variables
  v_result := REPLACE(v_result, '#Gamme#', COALESCE(v_gamme_name, ''));
  v_result := REPLACE(v_result, '#GammeAlias#', COALESCE(v_gamme_alias, ''));

  -- Generic variables
  v_result := REPLACE(v_result, '#VousPropose#', 'vous propose');
  v_result := REPLACE(v_result, '#MinPrice#', '');

  -- Vehicle link variables
  v_result := REPLACE(v_result, '#LinkCarAll#',
    TRIM(COALESCE(p_marque_name, '') || ' ' || COALESCE(p_modele_name, '') || ' ' ||
         COALESCE(p_type_name, '') || ' ' || COALESCE(p_type_power_ps, '') || ' ch'));
  v_result := REPLACE(v_result, '#LinkCar#',
    TRIM(COALESCE(p_marque_name, '') || ' ' || COALESCE(p_modele_name, '') || ' ' ||
         COALESCE(p_type_name, '') || ' ' || COALESCE(p_type_power_ps, '') || ' ch'));

  -- ═══════════════════════════════════════════════════════════════════════════
  -- STEP 1: Process #CompSwitch# (generic switches, alias=3, pg_id=0)
  -- ═══════════════════════════════════════════════════════════════════════════
  IF v_result LIKE '%#CompSwitch#%' THEN
    SELECT jsonb_agg(jsonb_build_object('content', sis_content))
    INTO v_switches
    FROM __seo_item_switch
    WHERE sis_pg_id = '0' AND sis_alias = '3';

    v_result := process_seo_switch(v_result, '#CompSwitch#', COALESCE(v_switches, '[]'::jsonb), p_type_id, 0);
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- STEP 2: Process #CompSwitch_X# (current gamme)
  -- ═══════════════════════════════════════════════════════════════════════════
  FOR v_match IN
    SELECT regexp_matches(v_result, '#CompSwitch_(\d+)#', 'g')
  LOOP
    v_alias := v_match[1]::INTEGER;
    v_marker := '#CompSwitch_' || v_alias || '#';

    IF v_result NOT LIKE '%' || v_marker || '%' THEN
      CONTINUE;
    END IF;

    -- Search in __seo_gamme_car_switch for current gamme
    SELECT jsonb_agg(jsonb_build_object('content', sgcs_content))
    INTO v_switches
    FROM __seo_gamme_car_switch
    WHERE sgcs_pg_id = p_pg_id::TEXT AND sgcs_alias = v_alias::TEXT;

    -- Fallback: search in __seo_item_switch if nothing found
    IF v_switches IS NULL OR jsonb_array_length(v_switches) = 0 THEN
      SELECT jsonb_agg(jsonb_build_object('content', sis_content))
      INTO v_switches
      FROM __seo_item_switch
      WHERE sis_pg_id = p_pg_id::TEXT AND sis_alias = v_alias::TEXT;
    END IF;

    -- Global fallback alias 3 if still nothing
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
  -- STEP 3: Process #CompSwitch_X_Y# (cross-gamme and family)
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

    -- Alias 11-16: family switches
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
      -- Cross-gamme: search in target gamme
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
  -- STEP 4: Process #LinkGammeCar_Y# (links with vehicle)
  -- ═══════════════════════════════════════════════════════════════════════════
  FOR v_match IN
    SELECT regexp_matches(v_result, '#LinkGammeCar_(\d+)#', 'g')
  LOOP
    v_target_pg_id := v_match[1]::INTEGER;
    v_marker := '#LinkGammeCar_' || v_target_pg_id || '#';

    IF v_result NOT LIKE '%' || v_marker || '%' THEN
      CONTINUE;
    END IF;

    -- Get target gamme info
    SELECT pg_name, pg_alias INTO v_gamme
    FROM pieces_gamme
    WHERE pg_id = v_target_pg_id;

    IF v_gamme IS NULL THEN
      v_result := REPLACE(v_result, v_marker, '');
      CONTINUE;
    END IF;

    -- Get switches alias 1 and 2 to build anchor
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
  -- STEP 5: Process #LinkGamme_Y# (simple links)
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
  -- STEP 6: Process #PrixPasCher#
  -- ═══════════════════════════════════════════════════════════════════════════
  v_result := process_prix_pas_cher(v_result, p_type_id);

  -- ═══════════════════════════════════════════════════════════════════════════
  -- STEP 7: Clean unresolved markers
  -- ═══════════════════════════════════════════════════════════════════════════
  v_result := regexp_replace(v_result, '#CompSwitch[^#]*#', '', 'g');
  v_result := regexp_replace(v_result, '#LinkGammeCar_\d+#', '', 'g');
  v_result := regexp_replace(v_result, '#LinkGamme_\d+#', '', 'g');
  v_result := regexp_replace(v_result, '#PrixPasCher#', '', 'g');
  v_result := regexp_replace(v_result, '#FamilySwitch_\d+#', '', 'g');
  v_result := regexp_replace(v_result, '#[A-Za-z]+#', '', 'g');

  -- ═══════════════════════════════════════════════════════════════════════════
  -- STEP 8: Clean orphan phrases (after switch removal)
  -- ═══════════════════════════════════════════════════════════════════════════
  -- Remove "de ," or "de  ," → "de"
  v_result := regexp_replace(v_result, '\bde\s*,\s*', 'de ', 'gi');
  -- Remove ", ," → ","
  v_result := regexp_replace(v_result, ',\s*,', ',', 'g');
  -- Remove ". ." → "."
  v_result := regexp_replace(v_result, '\.\s*\.', '.', 'g');
  -- Remove "et ." or "et ," → "."
  v_result := regexp_replace(v_result, '\bet\s*[,.]', '.', 'gi');
  -- Remove spaces before punctuation
  v_result := regexp_replace(v_result, '\s+([.,!?;:])', '\1', 'g');
  -- Remove multiple spaces
  v_result := regexp_replace(v_result, '\s{2,}', ' ', 'g');
  -- Remove empty phrases like "De , neuve" → "neuve"
  v_result := regexp_replace(v_result, '\bDe\s*,\s*', '', 'gi');
  -- Trim
  v_result := TRIM(v_result);

  RETURN v_result;
END;
$function$;

-- ============================================================================
-- Permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION process_seo_template TO service_role;

-- ============================================================================
-- Documentation
-- ============================================================================
COMMENT ON FUNCTION process_seo_template IS 'Main SEO template processor for RM V2 - handles vehicle variables, switches, and internal links';
