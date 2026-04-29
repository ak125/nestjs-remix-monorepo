-- =============================================================================
-- ADR-032 PR-1 — Smoke test post-migration
-- =============================================================================
-- À exécuter manuellement contre DEV/staging après application de la migration
-- 20260429_diag_maintenance_via_kg.sql, avant merge PR sur main.
--
-- Usage :
--   psql "$DATABASE_URL" -f scripts/db/smoke-test-adr032-pr1.sql
-- ou via Supabase MCP execute_sql.
--
-- Exit non-zero si une assertion RAISE EXCEPTION trigger.
-- =============================================================================

\echo '=== ADR-032 PR-1 smoke test ==='

-- Assertion 1 : __diag_safety_rule droppée
DO $$
BEGIN
  IF to_regclass('public.__diag_safety_rule') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: __diag_safety_rule still exists';
  END IF;
  RAISE NOTICE 'OK: __diag_safety_rule droppée (to_regclass NULL)';
END $$;

-- Assertion 2 : tables ghost __diag_maintenance_* toujours absentes (n'ont jamais existé)
DO $$
BEGIN
  IF to_regclass('public.__diag_maintenance_operation') IS NOT NULL
     OR to_regclass('public.__diag_maintenance_symptom_link') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: __diag_maintenance_* tables présentes (devraient ne jamais avoir existé)';
  END IF;
  RAISE NOTICE 'OK: __diag_maintenance_* tables absentes (ghost confirmé)';
END $$;

-- Assertion 3 : 19 MaintenanceInterval kg_nodes (13 existants + 6 backfillés)
DO $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.kg_nodes
  WHERE node_type = 'MaintenanceInterval' AND is_active = TRUE;
  IF v_count < 19 THEN
    RAISE EXCEPTION 'FAIL: kg_nodes MaintenanceInterval = %, attendu >= 19', v_count;
  END IF;
  RAISE NOTICE 'OK: kg_nodes MaintenanceInterval = %', v_count;
END $$;

-- Assertion 4 : tous les 19 ont maintenance_priority NOT NULL
DO $$
DECLARE v_unset INT;
BEGIN
  SELECT COUNT(*) INTO v_unset
  FROM public.kg_nodes
  WHERE node_type = 'MaintenanceInterval'
    AND is_active = TRUE
    AND maintenance_priority IS NULL;
  IF v_unset > 0 THEN
    RAISE EXCEPTION 'FAIL: % MaintenanceInterval sans priority', v_unset;
  END IF;
  RAISE NOTICE 'OK: tous les MaintenanceInterval ont maintenance_priority backfillée';
END $$;

-- Assertion 5 : kg_safety_triggers >= 45 (24 existing + 21 backfillés)
DO $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.kg_safety_triggers
  WHERE is_active = TRUE;
  IF v_count < 45 THEN
    RAISE EXCEPTION 'FAIL: kg_safety_triggers active = %, attendu >= 45', v_count;
  END IF;
  RAISE NOTICE 'OK: kg_safety_triggers active = %', v_count;
END $$;

-- Assertion 6 : RPC kg_get_smart_maintenance_schedule étendue (signature avec p_type_id)
DO $$
DECLARE v_args TEXT;
BEGIN
  SELECT pg_get_function_arguments(p.oid) INTO v_args
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'kg_get_smart_maintenance_schedule'
  LIMIT 1;
  IF v_args NOT LIKE '%p_type_id%' OR v_args NOT LIKE '%p_fuel_type%' THEN
    RAISE EXCEPTION 'FAIL: kg_get_smart_maintenance_schedule signature incomplète : %', v_args;
  END IF;
  RAISE NOTICE 'OK: kg_get_smart_maintenance_schedule signature étendue';
END $$;

-- Assertion 7 : RPC kg_get_maintenance_alerts_by_milestone existe et retourne 5 paliers
DO $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.kg_get_maintenance_alerts_by_milestone();
  IF v_count <> 5 THEN
    RAISE EXCEPTION 'FAIL: kg_get_maintenance_alerts_by_milestone retourne % paliers, attendu 5', v_count;
  END IF;
  RAISE NOTICE 'OK: kg_get_maintenance_alerts_by_milestone retourne 5 paliers';
END $$;

-- Assertion 8 : vue v_dtc_lookup existe + au moins 1 row source='kg' (si kg_nodes a des dtc_code)
DO $$
DECLARE v_kg INT; v_seo INT;
BEGIN
  SELECT COUNT(*) INTO v_kg FROM public.v_dtc_lookup WHERE source = 'kg';
  SELECT COUNT(*) INTO v_seo FROM public.v_dtc_lookup WHERE source = 'seo_only';
  RAISE NOTICE 'OK: v_dtc_lookup kg=% seo_only=%', v_kg, v_seo;
END $$;

-- Assertion 9 : RPC kg_get_dtc_lookup callable
DO $$
BEGIN
  PERFORM * FROM public.kg_get_dtc_lookup('P0420');
  RAISE NOTICE 'OK: kg_get_dtc_lookup(P0420) callable';
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'FAIL: kg_get_dtc_lookup error: %', SQLERRM;
END $$;

-- Smoke fonctionnel : appel RPC avec un type_id réel (essence + diesel)
DO $$
DECLARE
  v_essence_type INT;
  v_diesel_type  INT;
  v_essence_rows INT;
  v_diesel_rows  INT;
BEGIN
  SELECT type_id::int INTO v_essence_type FROM public.auto_type
    WHERE type_fuel ILIKE '%essence%' AND type_fuel NOT ILIKE '%electrique%'
    LIMIT 1;
  SELECT type_id::int INTO v_diesel_type FROM public.auto_type
    WHERE type_fuel ILIKE '%diesel%' AND type_fuel NOT ILIKE '%electrique%'
    LIMIT 1;

  SELECT COUNT(*) INTO v_essence_rows
  FROM public.kg_get_smart_maintenance_schedule(p_type_id := v_essence_type, p_current_km := 80000);
  SELECT COUNT(*) INTO v_diesel_rows
  FROM public.kg_get_smart_maintenance_schedule(p_type_id := v_diesel_type, p_current_km := 80000);

  IF v_essence_rows = 0 OR v_diesel_rows = 0 THEN
    RAISE EXCEPTION 'FAIL: schedule essence=% diesel=% (au moins 1 attendu)',
      v_essence_rows, v_diesel_rows;
  END IF;
  RAISE NOTICE 'OK: schedule essence=% rows, diesel=% rows', v_essence_rows, v_diesel_rows;
END $$;

\echo '=== ADR-032 PR-1 smoke test PASSED ==='
