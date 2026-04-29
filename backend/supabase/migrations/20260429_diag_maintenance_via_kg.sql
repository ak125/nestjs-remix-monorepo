-- =============================================================================
-- ADR-032 — Diagnostic & Maintenance Unification (Phase 1 PR-1)
-- Migration : kg_* canon for maintenance + DTC view + RPCs (pas de DROP, audit
--             empirique a confirmé que __diag_safety_rule reste canon distinct)
-- =============================================================================
-- Related: ADR-032 (governance vault PR ak125/governance-vault#107)
--
-- Scope (référence ADR-032 §"Implications par phase" — Phase 1 PR-1) :
--   1. Backfill 6 nouveaux MaintenanceInterval dans kg_nodes (D7).
--   2. Ajout colonne kg_nodes.maintenance_priority (D7) + backfill 19 nodes.
--   3. Extension kg_get_smart_maintenance_schedule(p_type_id, p_fuel_type) (D2, D3).
--   4. RPC dérivée kg_get_maintenance_alerts_by_milestone() (D7).
--   5. Vue v_dtc_lookup + RPC kg_get_dtc_lookup() (D1).
--
-- Cleanup TS types orphelins (__diag_context_questions/safe_phrases/wizard_steps,
-- __diag_maintenance_operation/symptom_link) : regen database.types.ts
-- post-migration (commit séparé même PR).
--
-- NB : `__diag_safety_rule` reste canon diagnostic interactif (audit empirique
-- 2026-04-29 : 21 rules consommées par risk-safety.engine.ts via RULE_CAUSE_MAP
-- + isRuleRelevant() — sémantique cause-by-cause distincte de
-- kg_check_safety_gate(observable_ids[]) qui retourne 1 row aggregate).
-- Voir mémoire `diag-safety-rule-canonical-distinct.md` + ADR-032 amendement D1.
--
-- Safe to apply: OUI (pas de DROP destructif, juste backfill kg_nodes + RPCs).
-- =============================================================================

BEGIN;

-- =============================================================================
-- SECTION 1 — Backfill 6 MaintenanceInterval missing
-- =============================================================================
-- Ces 6 slugs sont identifiés en pré-task 2 ADR-032 comme manquants ou en drift
-- vs frontend hardcoded calendrier-entretien.tsx :
--   - filtre-huile (missing)
--   - batterie (missing)
--   - amortisseur (missing)
--   - pneu (missing)
--   - remplacement-plaquettes-frein-avant (split du controle-freinage existant)
--   - remplacement-disques-frein-avant (split du controle-freinage existant)
--
-- Source des intervalles : éditorial automecanik (alignement frontend snapshot
-- 2026-04-29 + manuels OEM standards). Validable DRI Fafa avant merge.

INSERT INTO public.kg_nodes (
  node_id, node_type, node_label, node_alias,
  km_interval, month_interval, interval_type,
  confidence, validation_status, status, is_active,
  source_type, created_at, updated_at, created_by
) VALUES
  (gen_random_uuid(), 'MaintenanceInterval', 'Remplacement filtre à huile',
   'filtre-huile', 15000, 12, 'fixed',
   0.90, 'validated', 'active', TRUE,
   'editorial', NOW(), NOW(), 'adr-032-pr-1'),

  (gen_random_uuid(), 'MaintenanceInterval', 'Remplacement batterie',
   'batterie', NULL, 60, 'time_based',
   0.85, 'validated', 'active', TRUE,
   'editorial', NOW(), NOW(), 'adr-032-pr-1'),

  (gen_random_uuid(), 'MaintenanceInterval', 'Remplacement amortisseurs',
   'amortisseur', 90000, 72, 'fixed',
   0.85, 'validated', 'active', TRUE,
   'editorial', NOW(), NOW(), 'adr-032-pr-1'),

  (gen_random_uuid(), 'MaintenanceInterval', 'Remplacement pneus',
   'pneu', 45000, 60, 'fixed',
   0.85, 'validated', 'active', TRUE,
   'editorial', NOW(), NOW(), 'adr-032-pr-1'),

  (gen_random_uuid(), 'MaintenanceInterval', 'Remplacement plaquettes de frein avant',
   'remplacement-plaquettes-frein-avant', 40000, NULL, 'fixed',
   0.90, 'validated', 'active', TRUE,
   'editorial', NOW(), NOW(), 'adr-032-pr-1'),

  (gen_random_uuid(), 'MaintenanceInterval', 'Remplacement disques de frein avant',
   'remplacement-disques-frein-avant', 70000, NULL, 'fixed',
   0.90, 'validated', 'active', TRUE,
   'editorial', NOW(), NOW(), 'adr-032-pr-1')
ON CONFLICT (node_alias) DO NOTHING;

-- Validation gate post-insert : 19 MaintenanceInterval attendus (13 actuels + 6).
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.kg_nodes
  WHERE node_type = 'MaintenanceInterval' AND is_active = TRUE;

  IF v_count < 19 THEN
    RAISE EXCEPTION
      'ADR-032 PR-1 backfill failed: kg_nodes MaintenanceInterval count = %, expected >= 19',
      v_count;
  END IF;
END $$;

-- =============================================================================
-- SECTION 2 — Colonne maintenance_priority + backfill 19 nodes
-- =============================================================================
-- Aligne sur les 3 niveaux frontend hardcoded actuels (calendrier-entretien.tsx
-- field "importance"). Conforme ADR-032 D7.

ALTER TABLE public.kg_nodes
  ADD COLUMN IF NOT EXISTS maintenance_priority TEXT
    CHECK (maintenance_priority IN ('critique', 'important', 'normal'));

COMMENT ON COLUMN public.kg_nodes.maintenance_priority IS
  'ADR-032 D7: priorité maintenance (critique|important|normal) alignée sur '
  'le frontend calendrier-entretien.tsx. NULL pour nodes non-maintenance.';

-- Backfill éditorial des 19 MaintenanceInterval. Mapping basé sur
-- frontend snapshot 2026-04-29 :
UPDATE public.kg_nodes SET maintenance_priority = CASE node_alias
  -- critique (sécurité / casse moteur si négligé)
  WHEN 'vidange-essence'                    THEN 'critique'
  WHEN 'vidange-diesel'                     THEN 'critique'
  WHEN 'filtre-huile'                       THEN 'critique'
  WHEN 'liquide-frein'                      THEN 'critique'
  WHEN 'remplacement-plaquettes-frein-avant' THEN 'critique'
  WHEN 'remplacement-disques-frein-avant'   THEN 'critique'
  WHEN 'distribution'                       THEN 'critique'
  WHEN 'controle-freinage'                  THEN 'critique'
  WHEN 'pneu'                               THEN 'critique'
  -- important (impact performance/longévité, pas immédiatement critique)
  WHEN 'filtre-air'                         THEN 'important'
  WHEN 'bougies-essence'                    THEN 'important'
  WHEN 'bougies-prechauffage'               THEN 'important'
  WHEN 'liquide-refroidissement'            THEN 'important'
  WHEN 'batterie'                           THEN 'important'
  WHEN 'amortisseur'                        THEN 'important'
  WHEN 'vidange-bvm'                        THEN 'important'
  WHEN 'vidange-bva'                        THEN 'important'
  -- normal (confort, hygiène)
  WHEN 'filtre-habitacle'                   THEN 'normal'
  WHEN 'recharge-clim'                      THEN 'normal'
  ELSE NULL
END
WHERE node_type = 'MaintenanceInterval';

-- Validation gate : tous les 19 doivent avoir maintenance_priority NOT NULL.
DO $$
DECLARE
  v_unset INT;
BEGIN
  SELECT COUNT(*) INTO v_unset
  FROM public.kg_nodes
  WHERE node_type = 'MaintenanceInterval'
    AND is_active = TRUE
    AND maintenance_priority IS NULL;

  IF v_unset > 0 THEN
    RAISE EXCEPTION
      'ADR-032 PR-1 maintenance_priority backfill incomplete: % nodes sans priority',
      v_unset;
  END IF;
END $$;

-- =============================================================================
-- SECTION 3 — Extension kg_get_smart_maintenance_schedule (D2, D3)
-- =============================================================================
-- Ajout p_type_id (résout fuel via auto_type.type_fuel) + p_fuel_type explicite.
-- Pas de mapping engine_family_code (coverage 0% confirmé pré-task 1 ADR-032).
-- API existante (p_engine_family_code) reste compatible.

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
    n.maintenance_priority,
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
      WHEN 'critique' THEN 1
      WHEN 'important' THEN 2
      WHEN 'normal' THEN 3
      ELSE 4
    END,
    n.node_label;
END;
$$;

COMMENT ON FUNCTION public.kg_get_smart_maintenance_schedule(
  TEXT, INT, UUID, JSONB, INT, TEXT
) IS
  'ADR-032 D2/D3: schedule entretien par véhicule. p_type_id résout fuel_type '
  'via auto_type.type_fuel. p_fuel_type explicite override. Pas de mapping '
  'engine_family_code (coverage 0%). API legacy p_engine_family_code restera '
  'présente mais NO-OP en attendant refactor consumers.';

-- =============================================================================
-- SECTION 4 — RPC dérivée kg_get_maintenance_alerts_by_milestone (D7)
-- =============================================================================
-- Regroupe les MaintenanceInterval par palier kilométrique. Zéro hardcode des
-- paliers (10k/30k/60k/100k/150k passables en argument).

CREATE OR REPLACE FUNCTION public.kg_get_maintenance_alerts_by_milestone(
  p_milestones INT[] DEFAULT ARRAY[10000, 30000, 60000, 100000, 150000],
  p_fuel_type  TEXT  DEFAULT NULL
)
RETURNS TABLE (
  milestone_km INT,
  actions      JSONB
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_fuel_type TEXT;
BEGIN
  v_fuel_type := lower(p_fuel_type);

  RETURN QUERY
  SELECT
    m.milestone_km,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'rule_alias',           n.node_alias,
          'rule_label',           n.node_label,
          'maintenance_priority', n.maintenance_priority,
          'km_interval',          n.km_interval
        )
        ORDER BY
          CASE n.maintenance_priority
            WHEN 'critique' THEN 1
            WHEN 'important' THEN 2
            WHEN 'normal' THEN 3
            ELSE 4
          END,
          n.node_label
      ) FILTER (WHERE n.node_id IS NOT NULL),
      '[]'::jsonb
    ) AS actions
  FROM unnest(p_milestones) WITH ORDINALITY AS m(milestone_km, ord)
  LEFT JOIN public.kg_nodes n
    ON n.node_type = 'MaintenanceInterval'
    AND n.is_active = TRUE
    AND n.km_interval IS NOT NULL
    AND n.km_interval <= m.milestone_km
    AND (
      v_fuel_type IS NULL
      OR n.node_alias NOT LIKE '%-essence%' AND n.node_alias NOT LIKE '%-diesel%'
         AND n.node_alias <> 'bougies-prechauffage'
      OR (v_fuel_type LIKE '%essence%' AND
          (n.node_alias LIKE '%-essence%' OR n.node_alias = 'bougies-essence'))
      OR (v_fuel_type LIKE '%diesel%' AND
          (n.node_alias LIKE '%-diesel%' OR n.node_alias = 'bougies-prechauffage'))
    )
  GROUP BY m.milestone_km, m.ord
  ORDER BY m.ord;
END;
$$;

COMMENT ON FUNCTION public.kg_get_maintenance_alerts_by_milestone(INT[], TEXT) IS
  'ADR-032 D7: alertes paliers km dérivées de kg_nodes. Remplace ALERTES_KM '
  'hardcoded dans calendrier-entretien.tsx. Modifier un MaintenanceInterval '
  'recalcule automatiquement les paliers.';

-- =============================================================================
-- SECTION 5 — Vue v_dtc_lookup + RPC kg_get_dtc_lookup (D1)
-- =============================================================================
-- Consolide kg_nodes.dtc_code + __seo_observable.dtc_codes[] avec colonne
-- source ENUM. DISTINCT ON privilégie kg.

CREATE OR REPLACE VIEW public.v_dtc_lookup AS
WITH kg_dtc AS (
  SELECT
    n.dtc_code      AS code,
    n.node_label    AS description,
    n.node_category AS system,
    n.urgency       AS severity,
    n.node_id       AS kg_node_id,
    'kg'::TEXT      AS source
  FROM public.kg_nodes n
  WHERE n.dtc_code IS NOT NULL
    AND n.dtc_code <> ''
    AND n.is_active = TRUE
),
seo_dtc AS (
  SELECT
    UPPER(TRIM(dtc_unnested))::TEXT AS code,
    NULL::TEXT                       AS description,
    NULL::TEXT                       AS system,
    NULL::TEXT                       AS severity,
    NULL::UUID                       AS kg_node_id,
    'seo_only'::TEXT                 AS source
  FROM public.__seo_observable o
  CROSS JOIN LATERAL unnest(o.dtc_codes) AS dtc_unnested
  WHERE o.dtc_codes IS NOT NULL
    AND array_length(o.dtc_codes, 1) > 0
),
merged AS (
  SELECT * FROM kg_dtc
  UNION ALL
  SELECT s.* FROM seo_dtc s
  WHERE NOT EXISTS (
    SELECT 1 FROM kg_dtc k WHERE k.code = s.code
  )
)
SELECT DISTINCT ON (code) code, description, system, severity, kg_node_id, source
FROM merged
ORDER BY code,
  CASE source WHEN 'kg' THEN 1 WHEN 'seo_only' THEN 2 ELSE 3 END;

COMMENT ON VIEW public.v_dtc_lookup IS
  'ADR-032 D1: vue consolidée DTC. kg_nodes.dtc_code prioritaire, __seo_observable.dtc_codes[] '
  'orphelins inclus avec source=seo_only pour traçabilité.';

CREATE OR REPLACE FUNCTION public.kg_get_dtc_lookup(p_code TEXT)
RETURNS TABLE (
  code        TEXT,
  description TEXT,
  system      TEXT,
  severity    TEXT,
  kg_node_id  UUID,
  source      TEXT
)
LANGUAGE sql
STABLE
AS $$
  SELECT v.code, v.description, v.system, v.severity, v.kg_node_id, v.source
  FROM public.v_dtc_lookup v
  WHERE v.code = UPPER(TRIM(p_code))
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.kg_get_dtc_lookup(TEXT) IS
  'ADR-032 D1: lookup single point pour codes DTC consolidés. Retourne 0 ou 1 row.';

-- =============================================================================
-- SECTION 6 — RETIRÉE (audit empirique 2026-04-29)
-- =============================================================================
-- ADR-032 V1 prévoyait DROP __diag_safety_rule + backfill 21 rows vers
-- kg_safety_triggers. Audit empirique a révélé que :
--   - __diag_safety_rule = 21 règles texte consommées par
--     backend/src/modules/diagnostic-engine/engines/risk-safety.engine.ts
--     avec RULE_CAUSE_MAP (8 mappings cause-by-cause hardcodés).
--   - kg_check_safety_gate(p_observable_ids uuid[]) retourne 1 row aggregate
--     basé sur observable UUIDs — sémantique distincte.
-- Ce sont 2 canons COMPLÉMENTAIRES (interactif vs KG observable), pas
-- redondants. Pas de DROP, pas de backfill.
-- Voir mémoire `diag-safety-rule-canonical-distinct.md`.
-- =============================================================================

COMMIT;

-- =============================================================================
-- ANCIEN backfill V1 (commenté, conservé pour traçabilité du mapping
-- éditorial proposé en cas de besoin futur d'export observable-pattern). NE PAS
-- DÉCOMMENTER sans nouvelle ADR.
-- =============================================================================

/* DÉSACTIVÉ — voir SECTION 6 RETIRÉE ci-dessus.

INSERT INTO public.kg_safety_triggers (
  trigger_id, observable_label_pattern, safety_gate,
  safety_message_fr, recommended_action_fr,
  block_sales, priority, is_active, created_at, updated_at
) VALUES
  (gen_random_uuid(), '%plaquette%métal%',
   'stop_immediate',
   'Plaquettes usées jusqu''au métal — freinage dégradé',
   'SECURITE: freinage dégradé si plaquettes métal sur métal. Remplacement immédiat requis.',
   TRUE, 80, TRUE, NOW(), NOW()),

  (gen_random_uuid(), '%plaquette%retard%',
   'stop_immediate',
   'Retard de remplacement plaquettes — risque d''endommagement disques',
   'AGGRAVATION: disques endommagés si remplacement retardé.',
   TRUE, 80, TRUE, NOW(), NOW()),

  (gen_random_uuid(), '%symptôme%frein%',
   'warning',
   'Symptôme freinage actif — contrôle recommandé avant longs trajets',
   'ROULAGE: contrôle recommandé avant longs trajets.',
   FALSE, 50, TRUE, NOW(), NOW()),

  (gen_random_uuid(), '%liquide%frein%bas%',
   'stop_immediate',
   'Niveau liquide de frein bas — risque de perte de freinage',
   'CRITIQUE: perte de freinage possible si niveau liquide bas. Vérification immédiate.',
   TRUE, 80, TRUE, NOW(), NOW()),

  (gen_random_uuid(), '%batterie%lâche%',
   'stop_soon',
   'Batterie peut lâcher sans préavis — risque d''immobilisation',
   'IMMOBILISATION: batterie défaillante = véhicule immobilisé sans préavis. Test/remplacement à planifier.',
   FALSE, 80, TRUE, NOW(), NOW()),

  (gen_random_uuid(), '%alternateur%',
   'stop_immediate',
   'Alternateur défaillant = batterie se vide en roulant',
   'SECURITE: alternateur HS = perte progressive de tous les systèmes électriques en roulant.',
   TRUE, 80, TRUE, NOW(), NOW()),

  (gen_random_uuid(), '%fumée%démarreur%',
   'stop_immediate',
   'Fumée ou odeur de brûlé au démarreur = arrêt immédiat',
   'CRITIQUE: fumée au démarreur = risque d''incendie, ne pas insister au démarrage.',
   TRUE, 80, TRUE, NOW(), NOW()),

  (gen_random_uuid(), '%diesel%froid%préchauffage%',
   'warning',
   'Diesel par temps froid — préchauffage essentiel',
   'CONSEIL: attendre extinction voyant préchauffage avant de tourner la clé.',
   FALSE, 20, TRUE, NOW(), NOW()),

  (gen_random_uuid(), '%voyant%température%rouge%',
   'stop_immediate',
   'Voyant température rouge allumé',
   'CRITIQUE: surchauffe moteur = risque casse joint de culasse, déformation culasse, grippage moteur. Arrêt immédiat.',
   TRUE, 80, TRUE, NOW(), NOW()),

  (gen_random_uuid(), '%fuite%liquide%refroidissement%',
   'stop_soon',
   'Fuite de liquide visible',
   'SECURITE: ne pas rouler avec un niveau de liquide bas — risque de surchauffe brutale.',
   FALSE, 80, TRUE, NOW(), NOW()),

  (gen_random_uuid(), '%température%instable%',
   'warning',
   'Température instable',
   'VIGILANCE: vérifier niveau de liquide et thermostat — risque d''aggravation.',
   FALSE, 50, TRUE, NOW(), NOW()),

  (gen_random_uuid(), '%courroie%distribution%délai%',
   'stop_immediate',
   'Courroie de distribution au-delà de la préconisation constructeur : risque de casse moteur irréversible',
   'CRITIQUE: risque casse moteur si courroie lâche.',
   TRUE, 80, TRUE, NOW(), NOW()),

  (gen_random_uuid(), '%embrayage%patine%',
   'warning',
   'Patinage embrayage en côte ou sous charge : risque d''immobilisation en situation dangereuse',
   'ATTENTION: patinage peut empêcher le démarrage en côte.',
   FALSE, 50, TRUE, NOW(), NOW()),

  (gen_random_uuid(), '%amortisseur%hs%',
   'stop_immediate',
   'Amortisseurs HS : allongement distances de freinage et perte de contrôle en virage',
   'SECURITE: tenue de route dégradée, distances de freinage allongées.',
   TRUE, 80, TRUE, NOW(), NOW()),

  (gen_random_uuid(), '%ressort%suspension%cassé%',
   'stop_soon',
   'Ressort de suspension cassé : risque de contact pneu/carrosserie et instabilité',
   'ATTENTION: véhicule affaissé, risque contact pneu.',
   FALSE, 80, TRUE, NOW(), NOW()),

  (gen_random_uuid(), '%direction%assistée%perte%',
   'stop_immediate',
   'Perte de direction assistée ou jeu excessif : risque d''accident par perte de contrôle directionnel',
   'CRITIQUE: perte de contrôle directionnel possible.',
   TRUE, 80, TRUE, NOW(), NOW()),

  (gen_random_uuid(), '%gaz%échappement%habitacle%',
   'stop_immediate',
   'Odeur de gaz d''échappement dans l''habitacle : risque d''intoxication au monoxyde de carbone',
   'CRITIQUE: risque intoxication CO dans habitacle.',
   TRUE, 80, TRUE, NOW(), NOW()),

  (gen_random_uuid(), '%fuite%carburant%',
   'stop_immediate',
   'Fuite d''injecteur ou de carburant : risque d''incendie moteur',
   'CRITIQUE: risque incendie si fuite carburant.',
   TRUE, 80, TRUE, NOW(), NOW()),

  (gen_random_uuid(), '%cardan%soufflet%',
   'warning',
   'Soufflet déchiré + cardan grippé : risque de casse cardan et immobilisation',
   'ATTENTION: cardan sans graisse risque de casser.',
   FALSE, 50, TRUE, NOW(), NOW()),

  (gen_random_uuid(), '%phare%hs%',
   'stop_soon',
   'Phare(s) HS : conduite de nuit dangereuse, non-conformité CT',
   'SECURITE: éclairage insuffisant, danger de nuit.',
   FALSE, 80, TRUE, NOW(), NOW()),

  (gen_random_uuid(), '%voyant%pression%huile%',
   'stop_immediate',
   'Voyant pression huile allumé : risque casse moteur si circulation sans pression d''huile suffisante',
   'CRITIQUE: risque casse moteur sans pression huile.',
   TRUE, 80, TRUE, NOW(), NOW())
;

-- Validation gate transactionnelle V1 (désactivée avec le backfill) :
-- DO $$ ... kg_safety_triggers count >= 45 ... END $$;
-- DROP TABLE IF EXISTS public.__diag_safety_rule;

*/ -- fin du bloc commenté V1 backfill safety

-- =============================================================================
-- POST-MIGRATION : regen TS types + grep verification
-- =============================================================================
-- À exécuter manuellement post-merge :
--
--   1. Regen types TS depuis Supabase :
--        npx supabase gen types typescript --project-id cxpojprgwgubzjyqzmoq \
--          > backend/src/database/types/database.types.ts
--
--   2. Cleanup imports orphelins (suppression types __diag_context_questions /
--      __diag_safe_phrases / __diag_wizard_steps / __diag_maintenance_operation /
--      __diag_maintenance_symptom_link) :
--        grep -rnE "__diag_(context_questions|safe_phrases|wizard_steps|maintenance_operation|maintenance_symptom_link)" backend/ frontend/
--      (Note : __diag_safety_rule conservé canon — voir mémoire
--       diag-safety-rule-canonical-distinct.md.)
-- =============================================================================
