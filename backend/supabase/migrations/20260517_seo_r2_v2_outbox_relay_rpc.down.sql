-- ADR-072 PR 2D-2 — Down migration : drop RPC helpers added in
-- 20260517_seo_r2_v2_outbox_relay_rpc.sql. Tables themselves stay (owned by
-- 20260516_seo_r2_v2_cqrs_snapshot.sql).

DROP FUNCTION IF EXISTS public.__seo_outbox_claim_batch(INTEGER);
DROP FUNCTION IF EXISTS public.__seo_r8_publish_snapshot(
  BIGINT, TEXT, JSONB, TEXT, JSONB, TEXT
);
