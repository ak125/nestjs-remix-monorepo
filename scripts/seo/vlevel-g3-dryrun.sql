-- ============================================================================
-- vlevel-g3-dryrun.sql — HARNAIS DRY-RUN V-Level (STRICT READ-ONLY)
-- ----------------------------------------------------------------------------
-- BUT : simuler l'impact des corrections G3 (C energy / B V5-root / A V5-union)
--       SANS écrire en DB. Uniquement des SELECT. Aucun UPDATE/INSERT/DELETE,
--       aucune migration, aucun recalcul réel, aucun apply.
--
-- USAGE : remplacer le pg_id (402 = plaquette-de-frein) puis exécuter chaque bloc
--         (psql / Supabase SQL editor / MCP execute_sql). Réutilisable par gamme.
--         Sortie de référence (pg 402) : audit/vlevel-g3-dry-run-plaquette-de-frein-*.
--
-- FIDÉLITÉ : le bloc C reproduit l'ÉLECTION seule. Il matche le v_level persisté à
--            ~85% car `propagate_vlevel_per_typeid` + triggers s'appliquent APRÈS
--            l'élection. Pour une simulation C EXACTE, rejouer le pipeline complet.
--            Les blocs B et A sont EXACTS (hiérarchie auto_modele, indép. élection).
-- ============================================================================

\set pg 402  -- gamme pilote ; à changer pour réutiliser

-- ── BLOC C : impact normalisation energy NULL→'unknown' (ré-élection diff) ──
WITH csv AS (
  SELECT id, keyword, volume, model, energy, type_id, v_level AS persisted
  FROM __seo_keywords
  WHERE pg_id = :pg AND type = 'vehicle' AND v_level IN ('V2','V3','V4')
),
k AS (
  SELECT *,
    lower(coalesce(nullif(model,''),'_no_model'))||'|'||coalesce(nullif(energy,''),'__NULL__')      AS key_before,
    lower(coalesce(nullif(model,''),'_no_model'))||'|'||lower(coalesce(nullif(energy,''),'unknown')) AS key_after
  FROM csv
),
b3 AS (SELECT *, row_number() OVER (PARTITION BY key_before ORDER BY volume DESC, length(keyword) ASC) AS rn_b FROM k),
bc AS (SELECT id, row_number() OVER (ORDER BY volume DESC) AS crank FROM b3 WHERE rn_b = 1),
sb AS (SELECT b3.id, CASE WHEN b3.rn_b=1 AND bc.crank<=10 THEN 'V2' WHEN b3.rn_b=1 THEN 'V3' ELSE 'V4' END AS lvl_before
       FROM b3 LEFT JOIN bc ON bc.id=b3.id),
a3 AS (SELECT *, row_number() OVER (PARTITION BY key_after ORDER BY volume DESC, length(keyword) ASC) AS rn_a FROM k),
ac AS (SELECT id, row_number() OVER (ORDER BY volume DESC) AS crank FROM a3 WHERE rn_a = 1),
sa AS (SELECT a3.id, CASE WHEN a3.rn_a=1 AND ac.crank<=10 THEN 'V2' WHEN a3.rn_a=1 THEN 'V3' ELSE 'V4' END AS lvl_after
       FROM a3 LEFT JOIN ac ON ac.id=a3.id)
SELECT 'C_summary' AS section,
  count(*) AS total_v2v3v4,
  count(*) FILTER (WHERE k.persisted = sb.lvl_before)  AS before_matches_persisted,
  count(*) FILTER (WHERE sb.lvl_before <> sa.lvl_after) AS changed_by_energy_fix
FROM k JOIN sb ON sb.id=k.id JOIN sa ON sa.id=k.id;
-- Détail des lignes changées par C (vide si changed_by_energy_fix=0) :
-- (décommenter pour la liste exacte type_id/keyword/ancien/nouveau)
--   ... même CTE ... SELECT k.type_id, k.keyword, sb.lvl_before, sa.lvl_after
--   FROM k JOIN sb USING(id) JOIN sa USING(id) WHERE sb.lvl_before <> sa.lvl_after;

-- ── BLOC B : V5 sur modèles ROOT (suspects ; REVIEW_OWNER, jamais auto-remove) ──
SELECT 'B_v5_root' AS section,
  k.type_id, t.type_modele_id AS modele_id, m.modele_name, m.modele_parent, k.keyword,
  'REVIEW_OWNER'::text AS simulated_action,
  'root model has no same-parent sibling per rule'::text AS reason
FROM __seo_keywords k
JOIN auto_type   t ON t.type_id::text   = k.type_id::text
JOIN auto_modele m ON m.modele_id::text = t.type_modele_id::text
WHERE k.pg_id = :pg AND k.v_level = 'V5' AND m.modele_parent = 0
ORDER BY m.modele_name, k.type_id;

-- ── BLOC A : V5 UNION = siblings + enfants (candidats nouveaux, action simulée) ──
WITH classified AS (
  SELECT DISTINCT t.type_modele_id::text AS modele_id, k.v_level, k.model
  FROM __seo_keywords k JOIN auto_type t ON t.type_id::text = k.type_id::text
  WHERE k.pg_id = :pg AND k.v_level IN ('V2','V3','V4')
),
parents AS (
  SELECT DISTINCT m.modele_parent FROM auto_modele m
  JOIN classified c ON m.modele_id::text = c.modele_id WHERE m.modele_parent <> 0
),
sibling_models AS (
  SELECT DISTINCT m.modele_id::text AS modele_id FROM auto_modele m
  JOIN parents p ON m.modele_parent = p.modele_parent
  WHERE m.modele_id::text NOT IN (SELECT modele_id FROM classified)
),
child_models AS (
  SELECT DISTINCT m.modele_id::text AS modele_id FROM auto_modele m
  JOIN classified c ON m.modele_parent::text = c.modele_id
),
union_models AS (
  SELECT modele_id, 'sibling'::text AS rel FROM sibling_models
  UNION SELECT modele_id, 'child'::text FROM child_models
),
already AS (SELECT DISTINCT type_id::text AS type_id FROM __seo_keywords WHERE pg_id = :pg AND type_id IS NOT NULL)
SELECT 'A_v5_union' AS section,
  t.type_id::text AS candidate_type_id, mm.modele_name AS candidate_model, min(um.rel) AS relation,
  EXISTS (SELECT 1 FROM __seo_keywords k2 WHERE k2.type_id::text=t.type_id::text AND k2.pg_id=:pg AND k2.v_level IS NOT NULL) AS already_has_v_level,
  CASE WHEN EXISTS (SELECT 1 FROM __seo_keywords k2 WHERE k2.type_id::text=t.type_id::text AND k2.pg_id=:pg AND k2.v_level IS NOT NULL)
       THEN 'skip_existing_level' ELSE 'add_v5' END AS simulated_action
FROM auto_type t
JOIN union_models um ON t.type_modele_id::text = um.modele_id
JOIN auto_modele mm ON mm.modele_id::text = t.type_modele_id::text
WHERE t.type_display = '1' AND t.type_id::text NOT IN (SELECT type_id FROM already)
GROUP BY t.type_id::text, mm.modele_name
ORDER BY relation, candidate_model;
