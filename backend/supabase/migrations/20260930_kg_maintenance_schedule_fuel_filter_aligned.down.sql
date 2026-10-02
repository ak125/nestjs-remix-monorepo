-- Rollback : 20260930_kg_maintenance_schedule_fuel_filter_aligned
-- (documentation d'intervention manuelle ; le runner ignore les .down.sql,
-- politique forward-only).
--
-- Restaure le corps de kg_get_smart_maintenance_schedule tel qu'il est servi par
-- la base live le 2026-09-30 (pg_get_functiondef, lecture seule), VERBATIM :
-- md5(prosrc) = 4a56e0a246598a51e7e847861ba69d9b. C'est le corps de
-- 20260429_diag_maintenance_via_kg.sql. CREATE OR REPLACE conserve le
-- commentaire et les droits EXECUTE.
--
-- EFFET DU ROLLBACK — à lire avant de l'appliquer : les 529 types
-- diesel-électrique reçoivent de nouveau vidange-essence et bougies-essence à la
-- place de vidange-diesel et bougies-prechauffage, et le calendrier contredit de
-- nouveau kg_get_maintenance_alerts_by_milestone. C'est précisément le défaut
-- que 20260930 corrige.

CREATE OR REPLACE FUNCTION public.kg_get_smart_maintenance_schedule(p_engine_family_code text DEFAULT NULL::text, p_current_km integer DEFAULT 0, p_profile_id uuid DEFAULT NULL::uuid, p_last_maintenance_records jsonb DEFAULT '[]'::jsonb, p_type_id integer DEFAULT NULL::integer, p_fuel_type text DEFAULT NULL::text)
 RETURNS TABLE(rule_alias text, rule_label text, km_interval integer, month_interval integer, maintenance_priority text, applies_to_fuel text, km_remaining integer, status text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fuel_type TEXT;
BEGIN
  -- Résolution fuel_type : explicite > dérivé du type_id > NULL (pas de filtre)
  IF p_fuel_type IS NOT NULL THEN
    v_fuel_type := lower(p_fuel_type);
  ELSIF p_type_id IS NOT NULL THEN
    SELECT lower(at.type_fuel) INTO v_fuel_type
    FROM public.auto_type at
    WHERE at.type_id = p_type_id::text
    LIMIT 1;
  ELSE
    v_fuel_type := NULL;
  END IF;

  -- Normalisation fuel : "essence-électrique"/"essence-electrique" → "essence-hybride"
  IF v_fuel_type IS NOT NULL THEN
    v_fuel_type := regexp_replace(v_fuel_type, 'é', 'e', 'g');
    IF v_fuel_type LIKE '%essence%electrique%'
       OR v_fuel_type LIKE '%diesel%electrique%' THEN
      v_fuel_type := 'hybride';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    n.node_alias::TEXT AS rule_alias,
    n.node_label::TEXT AS rule_label,
    n.km_interval,
    n.month_interval,
    -- maintenance_priority : mapping canon anglais (kg_v3_maintenance) → contrat
    -- TS/frontend français 3 niveaux (recommended+optional collapse → normal).
    CASE n.maintenance_priority
      WHEN 'critical'    THEN 'critique'
      WHEN 'important'   THEN 'important'
      WHEN 'recommended' THEN 'normal'
      WHEN 'optional'    THEN 'normal'
      ELSE NULL
    END AS maintenance_priority,
    -- détecte fuel-aware nodes par convention de nommage
    CASE
      WHEN n.node_alias LIKE '%-essence%' THEN 'essence'
      WHEN n.node_alias LIKE '%-diesel%' THEN 'diesel'
      WHEN n.node_alias LIKE 'bougies-prechauffage' THEN 'diesel'
      ELSE NULL
    END AS applies_to_fuel,
    GREATEST(n.km_interval - p_current_km, 0) AS km_remaining,
    CASE
      WHEN n.km_interval IS NULL THEN 'time_only'
      WHEN p_current_km >= n.km_interval THEN 'overdue'
      WHEN p_current_km >= (n.km_interval * 0.9) THEN 'due_soon'
      ELSE 'ok'
    END AS status
  FROM public.kg_nodes n
  WHERE n.node_type = 'MaintenanceInterval'
    AND n.is_active = TRUE
    AND (
      v_fuel_type IS NULL
      OR n.node_alias NOT LIKE '%-essence%' AND n.node_alias NOT LIKE '%-diesel%'
         AND n.node_alias <> 'bougies-prechauffage'
      OR (v_fuel_type LIKE '%essence%' AND
          (n.node_alias LIKE '%-essence%' OR n.node_alias = 'bougies-essence'))
      OR (v_fuel_type LIKE '%diesel%' AND
          (n.node_alias LIKE '%-diesel%' OR n.node_alias = 'bougies-prechauffage'))
      OR (v_fuel_type = 'hybride' AND n.node_alias LIKE '%-essence%')
    )
  ORDER BY
    CASE n.maintenance_priority
      WHEN 'critical'    THEN 1
      WHEN 'important'   THEN 2
      WHEN 'recommended' THEN 3
      WHEN 'optional'    THEN 4
      ELSE 5
    END,
    n.node_label;
END;
$function$;
