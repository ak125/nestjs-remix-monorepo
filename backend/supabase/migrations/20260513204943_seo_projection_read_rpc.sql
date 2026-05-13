-- ============================================================================
-- ADR-059 SEO Runtime Projection — Phase B PR-7a (read RPC)
--
-- RPC unique pour lecture publique de la projection active.
-- - SECURITY DEFINER : bypass RLS interne sur __seo_* tables (read-only)
-- - Lit les 2 materialized views (mv_seo_entity_facts_current +
--   mv_seo_content_blocks_current) + __seo_entity_sources
-- - Returns JSONB shape compatible avec exports-seo.schema.json
--
-- Garde-fous SQL :
-- - Validation pattern entity_id (singulier sans support)
-- - EXCEPTION sur entity_id invalide
-- - STABLE function (cacheable per Postgres)
-- - Pas d'INSERT/UPDATE/DELETE
-- - GRANT EXECUTE explicite (anon + authenticated + service_role)
--
-- Refs : ADR-059 vault PR #260, PR-6a tables, PR-6b workers.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION get_active_seo_projection(
  p_entity_id text,
  p_role text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_facts jsonb;
  v_blocks jsonb;
  v_sources jsonb;
BEGIN
  -- Validation pattern entity_id (singulier ADR-031, support exclu)
  IF p_entity_id !~ '^(gamme|vehicle|constructeur|diagnostic):[a-z0-9][a-z0-9-]*[a-z0-9]$' THEN
    RAISE EXCEPTION 'invalid entity_id pattern: %', p_entity_id
      USING ERRCODE = '22023', HINT = 'expected <entity_type>:<slug-singular>, entity_type in {gamme,vehicle,constructeur,diagnostic}';
  END IF;

  -- Optional role filter validation
  IF p_role IS NOT NULL AND p_role !~ '^R[0-9]_[A-Z_]+$' THEN
    RAISE EXCEPTION 'invalid role pattern: %', p_role
      USING ERRCODE = '22023', HINT = 'expected R<digit>_<UPPER_NAME>';
  END IF;

  -- Facts (key/value) depuis MV
  SELECT COALESCE(jsonb_object_agg(fact_key, fact_value), '{}'::jsonb)
  INTO v_facts
  FROM mv_seo_entity_facts_current
  WHERE entity_id = p_entity_id;

  -- Blocks (role-aware) depuis MV
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'role', role,
        'section', section,
        'content_md', content_md,
        'content_hash', content_hash
      )
      ORDER BY role, COALESCE(section, '')
    ),
    '[]'::jsonb
  )
  INTO v_blocks
  FROM mv_seo_content_blocks_current
  WHERE entity_id = p_entity_id
    AND (p_role IS NULL OR role = p_role);

  -- Sources (provenance)
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', source_id,
        'type', source_type,
        'confidence_base', confidence_base,
        'url', url
      )
    ),
    '[]'::jsonb
  )
  INTO v_sources
  FROM __seo_entity_sources
  WHERE entity_id = p_entity_id;

  RETURN jsonb_build_object(
    'entity_id', p_entity_id,
    'entity_type', split_part(p_entity_id, ':', 1),
    'slug', split_part(p_entity_id, ':', 2),
    'projection_contract_version', '1.0.0',
    'facts', v_facts,
    'blocks', v_blocks,
    'sources', v_sources,
    'fetched_at', to_jsonb(now() AT TIME ZONE 'UTC')
  );
END;
$$;

COMMENT ON FUNCTION get_active_seo_projection(text, text) IS
  'ADR-059 PR-7a read RPC. SECURITY DEFINER bypass RLS interne. STABLE = cacheable. Returns JSONB shape compatible exports-seo.schema.json. Lit MVs (transitional acceleration). 0 INSERT/UPDATE/DELETE.';

-- Permissions explicites (feedback_supabase_grant_explicit)
REVOKE ALL ON FUNCTION get_active_seo_projection(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_active_seo_projection(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION get_active_seo_projection(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_seo_projection(text, text) TO anon;

COMMIT;
