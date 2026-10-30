-- Rollback: 20261029_seo_r2_v2_r8_publish_snapshot_text_type_id
-- Rend à __seo_r8_publish_snapshot sa définition de 20260517 (comparaison
-- `type_id = p_type_id`, TEXT contre BIGINT). Ce retour rétablit le défaut :
-- chaque appel échoue de nouveau (42883) et ne publie rien. À n'utiliser que si
-- la version corrigée doit être retirée ; arrêter d'abord le seed R8
-- (POST /api/admin/seo/r2/r8-seed/run) et la file r8-enrichment.
-- L'engine est forward-only : ce fichier se lance à la main, sur GO owner.
-- Auto-transactionnel : BEGIN / COMMIT portés par le fichier, SET LOCAL bornés à lui.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE OR REPLACE FUNCTION public.__seo_r8_publish_snapshot(
  p_type_id                  BIGINT,
  p_version_sha              TEXT,
  p_disambiguation_signature JSONB,
  p_enrichment_status        TEXT,
  p_source_lineage           JSONB,
  p_event_reason             TEXT
) RETURNS TABLE (
  snapshot_id            BIGINT,
  inserted               BOOLEAN,
  pages_pointer_updated  BOOLEAN,
  outbox_event_id        BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot_id      BIGINT;
  v_inserted         BOOLEAN := false;
  v_pages_updated    BOOLEAN := false;
  v_event_id         BIGINT;
BEGIN
  -- 1) Snapshot INSERT — idempotent on UNIQUE(version_sha).
  INSERT INTO public.__seo_r8_snapshot_store (
    type_id,
    version_sha,
    disambiguation_signature,
    enrichment_status,
    source_lineage
  ) VALUES (
    p_type_id,
    p_version_sha,
    p_disambiguation_signature,
    p_enrichment_status,
    p_source_lineage
  )
  ON CONFLICT (version_sha) DO NOTHING
  RETURNING id INTO v_snapshot_id;

  IF v_snapshot_id IS NOT NULL THEN
    v_inserted := true;
  ELSE
    SELECT id INTO v_snapshot_id
    FROM public.__seo_r8_snapshot_store
    WHERE version_sha = p_version_sha;
  END IF;

  IF v_snapshot_id IS NULL THEN
    RAISE EXCEPTION
      'r8_publish_snapshot_lookup_failed for version_sha=%', p_version_sha;
  END IF;

  -- 2) Pages pointer UPDATE — INSERT if row missing (idempotent).
  --    We avoid ON CONFLICT here because __seo_r8_pages may have a different
  --    UNIQUE shape across environments; rely on the type_id check instead.
  WITH updated AS (
    UPDATE public.__seo_r8_pages
    SET current_snapshot_id = v_snapshot_id
    WHERE type_id = p_type_id
      AND (current_snapshot_id IS DISTINCT FROM v_snapshot_id)
    RETURNING id
  )
  SELECT EXISTS (SELECT 1 FROM updated) INTO v_pages_updated;

  -- 3) Outbox event INSERT. We always emit, even on idempotent snapshot
  --    re-runs, so downstream consumers can observe the trigger source.
  INSERT INTO public.__seo_outbox_event (
    aggregate_type,
    aggregate_id,
    event_type,
    payload,
    occurred_at
  ) VALUES (
    'R8VehicleSnapshot',
    p_type_id::TEXT,
    'R8SnapshotUpdated',
    jsonb_build_object(
      'typeId', p_type_id,
      'versionSha', p_version_sha,
      'enrichmentStatus', p_enrichment_status,
      'reason', p_event_reason,
      'snapshotInserted', v_inserted,
      'pagesPointerUpdated', v_pages_updated
    ),
    NOW()
  )
  RETURNING id INTO v_event_id;

  RETURN QUERY SELECT v_snapshot_id, v_inserted, v_pages_updated, v_event_id;
END;
$$;

COMMENT ON FUNCTION public.__seo_r8_publish_snapshot IS
  'ADR-072 PR 2D-2 — atomic publish of a R8 snapshot version : INSERT __seo_r8_snapshot_store ON CONFLICT(version_sha) DO NOTHING, repoint __seo_r8_pages.current_snapshot_id, INSERT __seo_outbox_event R8SnapshotUpdated. SECURITY DEFINER so service_role calls inherit table privileges without granting INSERT on outbox to broader roles.';

REVOKE ALL ON FUNCTION public.__seo_r8_publish_snapshot(
  BIGINT, TEXT, JSONB, TEXT, JSONB, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.__seo_r8_publish_snapshot(
  BIGINT, TEXT, JSONB, TEXT, JSONB, TEXT
) TO service_role;
COMMIT;
