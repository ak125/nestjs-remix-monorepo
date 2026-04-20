-- =============================================================================
-- ADR-016 — Vehicle Page Cache (hotfix découvert au smoke test 2026-04-20)
-- =============================================================================
-- Related: INC-2026-005, ADR-016
--
-- Bug préexistant dans `get_vehicle_page_data_optimized` :
--   Pour un `type_id` inexistant, la RPC retourne
--   `{"success": true, "vehicle": null, ...}` au lieu de `{"success": false, ...}`.
--   Raison : le check `v_result->'vehicle' IS NULL` rate le cas JSONB null
--   (distinct de SQL NULL). On patche côté `build_vehicle_page_payload` pour
--   ne pas stocker ces payloads invalides dans `__vehicle_page_cache`.
--
-- Safe to apply: OUI. Aucune modification de schéma, CREATE OR REPLACE sur
-- une fonction non encore utilisée par le path de lecture (flag OFF).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.build_vehicle_page_payload(p_type_id INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $fn$
DECLARE
  v_result JSONB;
BEGIN
  v_result := get_vehicle_page_data_optimized(p_type_id)::JSONB;

  -- Rejet explicite des payloads invalides :
  --   - v_result NULL (ne devrait pas arriver)
  --   - success = false
  --   - vehicle = JSONB null (bug legacy)
  --   - vehicle = SQL NULL (sécurité)
  IF v_result IS NULL
     OR COALESCE((v_result->>'success')::BOOLEAN, FALSE) = FALSE
     OR jsonb_typeof(v_result->'vehicle') = 'null'
     OR v_result->'vehicle' IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN v_result;
END;
$fn$;

COMMENT ON FUNCTION public.build_vehicle_page_payload(INTEGER) IS
  'ADR-016: construit le payload page vehicule sans cache. Rejette les payloads invalides (vehicle null) pour pallier un bug legacy de get_vehicle_page_data_optimized.';
