-- ============================================================================
-- MIGRATION: RM SEO Helper Functions
-- ============================================================================
-- These functions are required by rm_get_page_complete_v2 for SEO processing.
-- They were created manually in production and are now being added to migrations.
--
-- Date: 2026-01-20
-- ============================================================================

-- ============================================================================
-- FUNCTION 1: process_seo_switch
-- ============================================================================
-- Replaces a marker in text with a randomly selected switch content
-- based on type_id for variation in SEO text.

CREATE OR REPLACE FUNCTION public.process_seo_switch(
    p_text text,
    p_marker text,
    p_switches jsonb,
    p_type_id integer,
    p_offset integer DEFAULT 0
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $function$
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

  -- Formula: (type_id + offset) % count for deterministic variation
  v_index := (p_type_id + p_offset) % v_count;
  v_content := p_switches->v_index->>'content';

  IF v_content IS NULL THEN
    RETURN REPLACE(p_text, p_marker, '');
  END IF;

  RETURN REPLACE(p_text, p_marker, v_content);
END;
$function$;

-- ============================================================================
-- FUNCTION 2: process_prix_pas_cher
-- ============================================================================
-- Replaces #PrixPasCher# marker with price-related variations
-- for SEO text diversity.

CREATE OR REPLACE FUNCTION public.process_prix_pas_cher(
    p_text text,
    p_type_id integer
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $function$
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
$function$;

-- ============================================================================
-- Permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION process_seo_switch TO service_role;
GRANT EXECUTE ON FUNCTION process_prix_pas_cher TO service_role;

-- ============================================================================
-- Documentation
-- ============================================================================
COMMENT ON FUNCTION process_seo_switch IS 'Replaces SEO markers with switch content for text variation';
COMMENT ON FUNCTION process_prix_pas_cher IS 'Replaces #PrixPasCher# with price-related variations';
