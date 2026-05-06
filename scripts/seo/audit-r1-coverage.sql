-- =============================================================================
-- audit-r1-coverage.sql
-- =============================================================================
-- 5 read-only queries to measure R1_ROUTER coverage / quality / drift on
-- __seo_r1_gamme_slots and supporting tables.
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/seo/audit-r1-coverage.sql
--   # or via Supabase MCP execute_sql, one query block at a time
--
-- Output: 5 result sets (one per query). Pipe to file for later analysis:
--   psql "$DATABASE_URL" -f scripts/seo/audit-r1-coverage.sql \
--     > audit-r1-coverage-$(date +%Y%m%d).log 2>&1
--
-- Origin: audit verification plan rev 2 — claim #2 (R1 transactional drift)
-- and claim #11 (R1/R6 split slots non re-enriched). Re-runnable for follow-up
-- snapshots once A1 (#321) and A2 (#325) merge.
--
-- Reference: ~/.claude/plans/verifier-premier-constat-atomic-turtle.md
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Q1 — Coverage R1 globale
--
-- Question: Of all rows in __seo_r1_gamme_slots, how many have each of the
-- 5 R1 sections populated, and how many are missing the gatekeeper score
-- (= seeded at the R1/R6 split on 2026-03-17 but never re-enriched).
-- -----------------------------------------------------------------------------
\echo '=== Q1: Coverage R1 globale ==='
SELECT
  COUNT(*)                                                  AS total_slots,
  COUNT(*) FILTER (WHERE r1s_micro_seo_block IS NOT NULL)        AS has_micro_seo,
  COUNT(*) FILTER (WHERE r1s_compatibilities_intro IS NOT NULL)  AS has_compat,
  COUNT(*) FILTER (WHERE r1s_equipementiers_line IS NOT NULL)    AS has_equip,
  COUNT(*) FILTER (WHERE r1s_safe_table_rows IS NOT NULL)        AS has_safe_table,
  COUNT(*) FILTER (WHERE r1s_family_cross_sell_intro IS NOT NULL) AS has_cross_sell,
  COUNT(*) FILTER (WHERE r1s_gatekeeper_score IS NULL)           AS missing_gatekeeper,
  COUNT(*) FILTER (WHERE r1s_gatekeeper_score < 65)              AS low_score,
  COUNT(*) FILTER (WHERE r1s_gatekeeper_score >= 65)             AS passable
FROM __seo_r1_gamme_slots;

-- -----------------------------------------------------------------------------
-- Q2 — Top 30 R1 weakest (NULL or score < 65)
--
-- Question: Which specific gammes have weak R1 surfaces and why? Use the
-- gatekeeper_flags array to spot recurring issues (transactional drift,
-- short content, missing sections, etc.).
-- -----------------------------------------------------------------------------
\echo ''
\echo '=== Q2: Top 30 R1 faibles (score NULL ou < 65) ==='
SELECT
  r1s_pg_id,
  r1s_gatekeeper_score,
  r1s_gatekeeper_flags,
  LENGTH(COALESCE(r1s_micro_seo_block, ''))        AS micro_len,
  LENGTH(COALESCE(r1s_compatibilities_intro, '')) AS compat_len,
  LENGTH(COALESCE(r1s_equipementiers_line, ''))   AS equip_len,
  jsonb_array_length(COALESCE(r1s_safe_table_rows, '[]'::jsonb)) AS safe_rows
FROM __seo_r1_gamme_slots
WHERE r1s_gatekeeper_score IS NULL
   OR r1s_gatekeeper_score < 65
ORDER BY r1s_gatekeeper_score NULLS FIRST, r1s_pg_id
LIMIT 30;

-- -----------------------------------------------------------------------------
-- Q3 — Contradiction R1 transactionnel
--
-- Question: How many R1 micro_seo_block contents contain vocab forbidden
-- by r1-router-validator.md (prix detailles, panier, stock, promo, livraison,
-- acheter, commander, paiement) ? Total + per-keyword breakdown.
--
-- Note: word boundaries (\b... \b) on `prix` and `stock` to avoid matching
-- `comprix`, `restock`, etc.
-- -----------------------------------------------------------------------------
\echo ''
\echo '=== Q3: Contradiction R1 transactionnel ==='
SELECT
  COUNT(*) AS total_with_forbidden,
  COUNT(*) FILTER (WHERE r1s_micro_seo_block ~* '\yprix\y')      AS has_prix,
  COUNT(*) FILTER (WHERE r1s_micro_seo_block ~* 'promo')           AS has_promo,
  COUNT(*) FILTER (WHERE r1s_micro_seo_block ~* 'panier')          AS has_panier,
  COUNT(*) FILTER (WHERE r1s_micro_seo_block ~* '\ystock\y')      AS has_stock,
  COUNT(*) FILTER (WHERE r1s_micro_seo_block ~* 'acheter')         AS has_acheter,
  COUNT(*) FILTER (WHERE r1s_micro_seo_block ~* 'commander')       AS has_commander,
  COUNT(*) FILTER (WHERE r1s_micro_seo_block ~* 'livraison')       AS has_livraison,
  COUNT(*) FILTER (WHERE r1s_micro_seo_block ~* 'paiement')        AS has_paiement
FROM __seo_r1_gamme_slots
WHERE r1s_micro_seo_block IS NOT NULL
  AND r1s_micro_seo_block ~* '(\yprix\y|promo|panier|\ystock\y|acheter|commander|livraison|paiement)';

-- -----------------------------------------------------------------------------
-- Q4 — R1 trop pauvres
--
-- Question: How many R1 micro_seo_block fail the 700-char minimum from
-- r1-content-batch.md rule "Min 700 chars, max 1500 chars" ?
-- -----------------------------------------------------------------------------
\echo ''
\echo '=== Q4: R1 contenu pauvre ==='
SELECT
  COUNT(*)                                                              AS total,
  COUNT(*) FILTER (WHERE r1s_micro_seo_block IS NULL)                  AS null_micro,
  COUNT(*) FILTER (WHERE LENGTH(r1s_micro_seo_block) < 300)            AS very_short_lt300,
  COUNT(*) FILTER (WHERE LENGTH(r1s_micro_seo_block) BETWEEN 300 AND 699) AS below_min,
  COUNT(*) FILTER (WHERE LENGTH(r1s_micro_seo_block) >= 700)           AS at_or_above_min,
  AVG(LENGTH(r1s_micro_seo_block))::int                                AS avg_micro_len,
  MIN(LENGTH(r1s_micro_seo_block))                                     AS min_micro_len,
  MAX(LENGTH(r1s_micro_seo_block))                                     AS max_micro_len
FROM __seo_r1_gamme_slots;

-- -----------------------------------------------------------------------------
-- Q5 — Maillage R1 → R8 via __cross_gamme_car_new
--
-- Question: Top 30 gammes ranked by vehicle-coverage breadth (distinct
-- motorisations / modèles / marques compatibles). These are R1 priority
-- targets for SERP investment — high modele_count = high cross-link value
-- to R8 vehicle pages.
--
-- Note: pieces_gamme.pg_id is INTEGER, __cross_gamme_car_new.cgc_pg_id is
-- TEXT — cast required (matches pattern in r1-content-batch.md L84).
-- -----------------------------------------------------------------------------
\echo ''
\echo '=== Q5: Maillage R1 → R8 (top 30 par couverture motorisation) ==='
SELECT
  pg.pg_id,
  pg.pg_alias,
  pg.pg_name,
  COUNT(DISTINCT cgc.cgc_modele_id) AS modele_count,
  COUNT(DISTINCT cgc.cgc_marque_id) AS marque_count,
  COUNT(DISTINCT cgc.cgc_type_id)   AS motorisation_count
FROM pieces_gamme pg
LEFT JOIN __cross_gamme_car_new cgc
  ON cgc.cgc_pg_id = pg.pg_id::text
WHERE pg.pg_alias IS NOT NULL
GROUP BY pg.pg_id, pg.pg_alias, pg.pg_name
HAVING COUNT(DISTINCT cgc.cgc_type_id) > 0
ORDER BY motorisation_count DESC NULLS LAST, marque_count DESC
LIMIT 30;

-- =============================================================================
-- End of audit-r1-coverage.sql
-- =============================================================================
