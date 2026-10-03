-- Migration : le calendrier d'entretien ne donne plus d'opérations essence aux
-- hybrides diesel.
--
-- PROBLÈME (lu en lecture seule sur la base live le 2026-09-30) :
--   kg_get_smart_maintenance_schedule (corps de 20260429_diag_maintenance_via_kg,
--   md5(prosrc) = 4a56e0a246598a51e7e847861ba69d9b) ramène tout carburant
--   « essence…électrique » OU « diesel…électrique » au jeton unique 'hybride',
--   puis la branche 'hybride' ne retient que les nœuds '%-essence%'.
--   Pour un type diesel-électrique, le calendrier liste donc vidange-essence et
--   bougies-essence (applies_to_fuel = 'essence') et omet vidange-diesel et
--   bougies-prechauffage. Types concernés dans auto_type :
--     'Diesel-Électrique' 338 + 'Diesel-Electrique' 191 = 529 types.
--   La RPC sœur kg_get_maintenance_alerts_by_milestone, appelée par le même
--   endpoint /api/diagnostic-engine/calendar, applique le même filtre SANS ce
--   repli : pour fuel_type = 'diesel-électrique', l'une répond essence, l'autre
--   diesel.
--
-- CAUSE RACINE :
--   Le repli annonce « essence-électrique → essence-hybride » mais capture aussi
--   les hybrides diesel et efface le carburant thermique que porte le libellé
--   type_fuel lui-même. Sans lui, les branches existantes LIKE '%essence%' et
--   LIKE '%diesel%' classent déjà correctement chaque libellé hybride. La
--   substitution é → e ne servait qu'au test du repli : les motifs restants ne
--   contiennent aucune lettre accentuée.
--
-- DÉCISION :
--   Retirer le repli et la branche 'hybride'. Le filtre carburant devient celui
--   de kg_get_maintenance_alerts_by_milestone, à l'identique : une règle, deux
--   RPC. Aucune applicabilité n'est ajoutée ni inventée : le carburant
--   thermique est lu dans type_fuel, comme pour tous les autres libellés.
--
-- EFFET MESURÉ (live, 2026-09-30 : 22 valeurs distinctes de lower(type_fuel),
-- 19 nœuds MaintenanceInterval actifs ; nœuds liés au carburant affichés) :
--   types  carburant                     avant                             après
--   338    diesel-électrique             bougies-essence,vidange-essence   bougies-prechauffage,vidange-diesel
--   191    diesel-electrique             bougies-essence,vidange-essence   bougies-prechauffage,vidange-diesel
--   Les 20 autres valeurs (dont essence-électrique 1314, essence-electrique 726,
--   essence-électrique-éthanol 11) : résultat identique, 17 ou 15 lignes.
--   p_fuel_type = 'hybride' explicite (carburant thermique inconnu) : passe des
--   2 opérations essence aux seules opérations génériques (15 lignes), comme
--   kg_get_maintenance_alerts_by_milestone. Aucun appelant interne ne transmet
--   cette valeur : MaintenanceCalculatorService relaie le fuel_type de la
--   requête, et aucun lien de frontend/app ni de backend/src n'en construit.
--
-- CE QUI N'EST PAS TOUCHÉ :
--   - Signature, colonnes retournées, STABLE, SECURITY INVOKER, search_path.
--   - Résolution p_fuel_type > p_type_id > NULL, CASE applies_to_fuel, statuts,
--     tri. p_engine_family_code, p_profile_id, p_last_maintenance_records
--     restent sans effet, comme avant.
--   - CREATE OR REPLACE conserve le commentaire et les droits EXECUTE existants.
--   - kg_get_maintenance_alerts_by_milestone, kg_nodes : inchangés.
--
-- VERROUS : CREATE OR REPLACE FUNCTION ne modifie que le catalogue : aucun
--   verrou de table, aucune réécriture. lock_timeout court : en cas d'attente,
--   l'application échoue proprement au lieu de bloquer.
--
-- ROLLBACK : 20260930_kg_maintenance_schedule_fuel_filter_aligned.down.sql
-- (documentation ; le runner l'ignore, politique forward-only).
--
-- Test de comportement (PostgreSQL 17 jetable, sans réseau) :
--   bash scripts/db/test-kg-maintenance-schedule-fuel-filter.sh
--
-- Le runner (scripts/ci/apply-supabase-migration.py) wrappe le fichier dans une
-- transaction (squawk: assume_in_transaction).

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE OR REPLACE FUNCTION public.kg_get_smart_maintenance_schedule(
  p_engine_family_code TEXT DEFAULT NULL,
  p_current_km         INT  DEFAULT 0,
  p_profile_id         UUID DEFAULT NULL,
  p_last_maintenance_records JSONB DEFAULT '[]'::jsonb,
  p_type_id            INT  DEFAULT NULL,
  p_fuel_type          TEXT DEFAULT NULL
)
RETURNS TABLE (
  rule_alias              TEXT,
  rule_label              TEXT,
  km_interval             INT,
  month_interval          INT,
  maintenance_priority    TEXT,
  applies_to_fuel         TEXT,
  km_remaining            INT,
  status                  TEXT
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
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
$$;
