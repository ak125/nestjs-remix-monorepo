-- Historical definition captured read-only; reference rollback, not executed.
CREATE OR REPLACE FUNCTION public.kg_get_vehicle_maintenance_schedule(p_engine_family_code text, p_current_km integer, p_vehicle_age_months integer DEFAULT 36, p_last_maintenance_km integer DEFAULT 0, p_last_maintenance_date date DEFAULT NULL::date)
 RETURNS SETOF kg_maintenance_item
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE v_last_date DATE;
BEGIN
  v_last_date := COALESCE(p_last_maintenance_date, CURRENT_DATE - (p_vehicle_age_months || ' months')::INTERVAL);
  RETURN QUERY
  WITH maintenance_intervals AS (
    SELECT mi.node_id AS maintenance_id, mi.node_label AS label, mi.node_category AS category,
      mi.maintenance_priority AS priority, mi.km_interval, mi.month_interval,
      mi.estimated_cost_min, mi.estimated_cost_max, mi.node_data AS operations_data,
      p_current_km - p_last_maintenance_km AS km_since_last,
      EXTRACT(MONTH FROM AGE(CURRENT_DATE, v_last_date))::INT AS months_since_last,
      COALESCE(mi.km_interval - (p_current_km - p_last_maintenance_km), 999999) AS km_remaining,
      COALESCE(mi.month_interval - EXTRACT(MONTH FROM AGE(CURRENT_DATE, v_last_date))::INT, 999) AS months_remaining
    FROM kg_nodes mi
    LEFT JOIN kg_edges e ON e.source_node_id = mi.node_id AND e.edge_type = 'SCHEDULED_FOR' AND e.status = 'active'
    LEFT JOIN kg_engine_families ef ON ef.family_id = e.target_node_id::UUID
    WHERE mi.node_type = 'MaintenanceInterval' AND mi.status = 'active'
      AND (ef.family_code = p_engine_family_code OR e.edge_id IS NULL)
  ),
  with_status AS (
    SELECT mi.*,
      CASE WHEN mi.km_remaining < 0 OR mi.months_remaining < 0 THEN 'overdue'
        WHEN mi.km_remaining < 3000 OR mi.months_remaining < 1 THEN 'due'
        WHEN mi.km_remaining < 5000 OR mi.months_remaining < 3 THEN 'upcoming'
        ELSE 'ok' END AS status,
      p_last_maintenance_km + COALESCE(mi.km_interval, 999999) AS due_at_km,
      v_last_date + (COALESCE(mi.month_interval, 999) || ' months')::INTERVAL AS due_at_date
    FROM maintenance_intervals mi
  )
  SELECT ws.maintenance_id, ws.label, ws.category, ws.priority, ws.status, ws.km_interval, ws.month_interval,
    ws.km_since_last, ws.months_since_last, GREATEST(0, ws.km_remaining)::INT, GREATEST(0, ws.months_remaining)::INT,
    ws.due_at_km::INT, ws.due_at_date::DATE, ws.estimated_cost_min, ws.estimated_cost_max, ws.operations_data,
    (SELECT JSONB_AGG(JSONB_BUILD_OBJECT('part_id', p.node_id, 'label', p.node_label, 'pg_id', p.node_data->>'pg_id'))
     FROM kg_edges e JOIN kg_nodes p ON p.node_id = e.target_node_id AND p.node_type = 'Part'
     WHERE e.source_node_id = ws.maintenance_id AND e.edge_type = 'REQUIRES_PART' AND e.status = 'active')
  FROM with_status ws
  ORDER BY
    CASE ws.status WHEN 'overdue' THEN 1 WHEN 'due' THEN 2 WHEN 'upcoming' THEN 3 ELSE 4 END,
    CASE ws.priority WHEN 'critical' THEN 1 WHEN 'important' THEN 2 WHEN 'recommended' THEN 3 ELSE 4 END,
    ws.km_remaining;
END;
$function$
;
