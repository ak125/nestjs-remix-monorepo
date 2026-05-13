-- ============================================================================
-- ADR-059 SEO Runtime Projection — Phase B PR-6a (MVs)
--
-- 2 materialized views pour accélération lecture pages R0-R8.
--
-- IMPORTANT (ADR-059 §"Known scalability limitation") :
--   Ces MVs sont des STRUCTURES D'ACCÉLÉRATION TRANSITOIRES, **jamais**
--   architecture définitive. Acceptable < ~100k entities. Au-delà,
--   migration vers : tables current-state transactionnelles / incremental
--   refresh / partitions par entity_type / event-driven read models.
--
-- IMPORTANT (ADR-059 §"Découplage write ↔ refresh") :
--   REFRESH MATERIALIZED VIEW CONCURRENTLY ne s'exécute JAMAIS dans la
--   transaction d'écriture du runner. PR-6b implémente 2 queues BullMQ
--   séparées (projection-write-queue + projection-refresh-queue).
--
-- Refs : ADR-059 vault PR #260 (accepted 2026-05-13).
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- mv_seo_entity_facts_current — facts actives par entity
-- ────────────────────────────────────────────────────────────────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_seo_entity_facts_current AS
SELECT
  f.entity_id,
  f.fact_key,
  v.fact_value,
  v.source_id,
  v.source_type,
  v.confidence_base,
  v.content_hash,
  v.valid_from,
  v.valid_to,
  f.updated_at
FROM __seo_entity_facts f
JOIN __seo_entity_fact_versions v
  ON v.version_id = f.active_version_id
WHERE v.status = 'active';

-- UNIQUE index requis par REFRESH ... CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_seo_entity_facts_current
  ON mv_seo_entity_facts_current (entity_id, fact_key);
CREATE INDEX IF NOT EXISTS idx_mv_seo_entity_facts_current_entity
  ON mv_seo_entity_facts_current (entity_id);

COMMENT ON MATERIALIZED VIEW mv_seo_entity_facts_current IS
  'ADR-059 transitional acceleration structure. REFRESH CONCURRENTLY only (never in write txn). Migration future si > 100k entities : current-state tables transactionnelles / incremental refresh / partitions / event-driven.';


-- ────────────────────────────────────────────────────────────────────────────
-- mv_seo_content_blocks_current — blocks actifs par entity
-- ────────────────────────────────────────────────────────────────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_seo_content_blocks_current AS
SELECT
  b.entity_id,
  b.role,
  b.section,
  v.content_md,
  v.content_hash,
  v.valid_from,
  v.valid_to,
  b.updated_at
FROM __seo_content_blocks b
JOIN __seo_content_block_versions v
  ON v.version_id = b.active_version_id
WHERE v.status = 'active';

-- UNIQUE index requis par REFRESH ... CONCURRENTLY (COALESCE pour section nullable)
CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_seo_content_blocks_current
  ON mv_seo_content_blocks_current (entity_id, role, COALESCE(section, ''));
CREATE INDEX IF NOT EXISTS idx_mv_seo_content_blocks_current_entity
  ON mv_seo_content_blocks_current (entity_id);

COMMENT ON MATERIALIZED VIEW mv_seo_content_blocks_current IS
  'ADR-059 transitional acceleration structure. REFRESH CONCURRENTLY only. Refresh worker = PR-6b projection-refresh-queue (debounce 5s, concurrency=1, single-flight).';


-- ────────────────────────────────────────────────────────────────────────────
-- Permissions MVs
-- ────────────────────────────────────────────────────────────────────────────

REVOKE ALL ON mv_seo_entity_facts_current   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON mv_seo_content_blocks_current FROM PUBLIC, anon, authenticated;

-- service_role : SELECT only (les MVs sont consommées via RPC PR-7 SECURITY DEFINER)
GRANT SELECT ON mv_seo_entity_facts_current   TO service_role;
GRANT SELECT ON mv_seo_content_blocks_current TO service_role;

COMMIT;
