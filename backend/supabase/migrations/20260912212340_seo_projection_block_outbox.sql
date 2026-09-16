-- @non_transactional
-- squawk-ignore-file ban-concurrent-index-creation-in-transaction
-- The native migration runner honors @non_transactional; concurrent indexes below run in autocommit.
-- Candidate only: exact existing-block transitions, pending owner review before shared DB.
-- Extends ADR-090's outbox; no activation, relay, consumer ACK or source approval here.
-- Callers must verify the accepted WIKI transition, scope and snapshot bytes first.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE public.__rag_change_events
  ADD COLUMN IF NOT EXISTS rce_operation text,
  ADD COLUMN IF NOT EXISTS rce_entity_id text,
  ADD COLUMN IF NOT EXISTS rce_block_id text,
  ADD COLUMN IF NOT EXISTS rce_run_id uuid,
  ADD COLUMN IF NOT EXISTS rce_previous_event_id bigint,
  ADD COLUMN IF NOT EXISTS rce_old_version_id uuid,
  ADD COLUMN IF NOT EXISTS rce_new_version_id uuid,
  ADD COLUMN IF NOT EXISTS rce_request_hash text;

-- Keep legacy rows unchanged; only explicit withdrawals may omit the new hash.
DO $constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
      WHERE conrelid = 'public.__rag_change_events'::regclass
        AND conname = 'rag_change_events_block_transition_check') THEN
    ALTER TABLE public.__rag_change_events ADD CONSTRAINT rag_change_events_block_transition_check
    CHECK (
      (rce_operation IS NULL AND rce_new_hash IS NOT NULL
        AND rce_entity_id IS NULL AND rce_block_id IS NULL AND rce_run_id IS NULL
        AND rce_previous_event_id IS NULL AND rce_old_version_id IS NULL
        AND rce_new_version_id IS NULL AND rce_request_hash IS NULL)
      OR
      (rce_operation IS NOT NULL AND rce_operation IN ('replace', 'withdraw')
        AND rce_entity_id IS NOT NULL AND rce_block_id IS NOT NULL AND rce_run_id IS NOT NULL
        AND rce_request_hash IS NOT NULL AND rce_old_version_id IS NOT NULL
        AND rce_old_hash IS NOT NULL
        AND ((rce_operation = 'replace' AND rce_new_hash IS NOT NULL AND rce_new_version_id IS NOT NULL)
          OR (rce_operation = 'withdraw' AND rce_new_hash IS NULL AND rce_new_version_id IS NULL)))
    ) NOT VALID;
  END IF;
END
$constraints$;
ALTER TABLE public.__rag_change_events VALIDATE CONSTRAINT rag_change_events_block_transition_check;
-- Intentional candidate contract change: the validated CHECK preserves legacy
-- NOT NULL semantics and permits NULL only for explicit withdraw. All external
-- outbox clients must be assessed before owner approval / shared DB application.
-- squawk-ignore ban-drop-not-null
ALTER TABLE public.__rag_change_events ALTER COLUMN rce_new_hash DROP NOT NULL;


-- Preserve the recorded run, identity and versions while a transition refers to them.
DO $constraint$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
      WHERE conrelid = 'public.__rag_change_events'::regclass AND conname = 'rce_run_id_projection_fk') THEN
    ALTER TABLE public.__rag_change_events ADD CONSTRAINT rce_run_id_projection_fk
      FOREIGN KEY (rce_run_id) REFERENCES public.__seo_projection_runs(run_id) NOT VALID;
  END IF;
END
$constraint$;
ALTER TABLE public.__rag_change_events VALIDATE CONSTRAINT rce_run_id_projection_fk;
DO $constraint$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
      WHERE conrelid = 'public.__rag_change_events'::regclass AND conname = 'rce_block_id_projection_fk') THEN
    ALTER TABLE public.__rag_change_events ADD CONSTRAINT rce_block_id_projection_fk
      FOREIGN KEY (rce_block_id) REFERENCES public.__seo_content_blocks(block_id) NOT VALID;
  END IF;
END
$constraint$;
ALTER TABLE public.__rag_change_events VALIDATE CONSTRAINT rce_block_id_projection_fk;
DO $constraint$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
      WHERE conrelid = 'public.__rag_change_events'::regclass AND conname = 'rce_old_version_id_projection_fk') THEN
    ALTER TABLE public.__rag_change_events ADD CONSTRAINT rce_old_version_id_projection_fk
      FOREIGN KEY (rce_old_version_id) REFERENCES public.__seo_content_block_versions(version_id) NOT VALID;
  END IF;
END
$constraint$;
ALTER TABLE public.__rag_change_events VALIDATE CONSTRAINT rce_old_version_id_projection_fk;
DO $constraint$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
      WHERE conrelid = 'public.__rag_change_events'::regclass AND conname = 'rce_new_version_id_projection_fk') THEN
    ALTER TABLE public.__rag_change_events ADD CONSTRAINT rce_new_version_id_projection_fk
      FOREIGN KEY (rce_new_version_id) REFERENCES public.__seo_content_block_versions(version_id) NOT VALID;
  END IF;
END
$constraint$;
ALTER TABLE public.__rag_change_events VALIDATE CONSTRAINT rce_new_version_id_projection_fk;

-- Native migration runner uses autocommit for the marker above. Retrying also
-- repairs an INVALID concurrent index left by an interrupted previous attempt.
DROP INDEX CONCURRENTLY IF EXISTS public.idx_rce_block_run_transition;
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_rce_block_run_transition
  ON public.__rag_change_events (rce_block_id, rce_run_id) WHERE rce_operation IS NOT NULL;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_rce_block_transition_head;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rce_block_transition_head
  ON public.__rag_change_events (rce_block_id, rce_id DESC) WHERE rce_operation IS NOT NULL;

CREATE OR REPLACE FUNCTION public.transition_seo_projection_block(
  p_block_id text, p_entity_id text, p_role text, p_run_id uuid,
  p_expected_version_id uuid, p_expected_event_id bigint,
  p_operation text, p_wiki_source text,
  p_content_hash text, p_content jsonb, p_confidence_base double precision, p_source_type text
) RETURNS TABLE (event_id bigint, active_version_id uuid, replayed boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $function$
DECLARE
  v_block public.__seo_content_blocks%ROWTYPE;
  v_old public.__seo_content_block_versions%ROWTYPE;
  v_event public.__rag_change_events%ROWTYPE;
  v_head bigint;
  v_new uuid;
  v_hash text;
BEGIN
  IF p_operation IS NULL OR p_operation NOT IN ('replace', 'withdraw')
     OR p_expected_version_id IS NULL OR p_run_id IS NULL
     OR p_wiki_source IS NULL OR btrim(p_wiki_source) = ''
     OR p_entity_id IS NULL OR p_role IS NULL THEN
    RAISE EXCEPTION 'INVALID_BLOCK_TRANSITION';
  END IF;
  IF p_operation = 'replace' AND (p_content_hash IS NULL OR btrim(p_content_hash) = ''
     OR p_content IS NULL OR jsonb_typeof(p_content) <> 'object'
     OR (p_confidence_base IS NOT NULL AND NOT (p_confidence_base >= 0 AND p_confidence_base <= 1))) THEN
    RAISE EXCEPTION 'INVALID_REPLACEMENT_CONTENT';
  END IF;
  IF p_operation = 'withdraw' AND (p_content_hash IS NOT NULL OR p_content IS NOT NULL
     OR p_confidence_base IS NOT NULL OR p_source_type IS NOT NULL) THEN
    RAISE EXCEPTION 'WITHDRAWAL_MUST_NOT_SUPPLY_NEW_CONTENT';
  END IF;

  -- Serializes transitions of this exact opaque identity. No title/slug matching.
  SELECT * INTO v_block FROM public.__seo_content_blocks WHERE block_id = p_block_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'UNKNOWN_BLOCK'; END IF;
  IF v_block.entity_id IS DISTINCT FROM p_entity_id OR v_block.role IS DISTINCT FROM p_role THEN
    RAISE EXCEPTION 'BLOCK_SCOPE_MISMATCH';
  END IF;
  v_hash := encode(sha256(convert_to(jsonb_build_array(p_block_id, p_entity_id, p_role,
    p_run_id, p_expected_version_id, p_expected_event_id, p_operation, p_wiki_source,
    p_content_hash, p_content, p_confidence_base, p_source_type)::text, 'UTF8')), 'hex');

  SELECT * INTO v_event FROM public.__rag_change_events
    WHERE rce_block_id = p_block_id AND rce_run_id = p_run_id AND rce_operation IS NOT NULL;
  IF FOUND THEN
    IF v_event.rce_request_hash IS DISTINCT FROM v_hash THEN
      RAISE EXCEPTION 'BLOCK_TRANSITION_REPLAY_MISMATCH';
    END IF;
    -- Returning history never resets the live pointer, including after withdrawal.
    RETURN QUERY SELECT v_event.rce_id::bigint, v_block.active_version_id, true;
    RETURN;
  END IF;

  -- Metadata existence is necessary for traceability, NOT proof of WIKI approval.
  PERFORM 1 FROM public.__seo_projection_runs
    WHERE run_id = p_run_id AND status IN ('running', 'succeeded')
      AND nullif(btrim(exports_snapshot_hash), '') IS NOT NULL
      AND nullif(btrim(exports_snapshot_uri), '') IS NOT NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MISSING_RUN_SNAPSHOT'; END IF;
  SELECT rce_id INTO v_head FROM public.__rag_change_events
    WHERE rce_block_id = p_block_id AND rce_operation IS NOT NULL ORDER BY rce_id DESC LIMIT 1;
  IF v_block.active_version_id IS DISTINCT FROM p_expected_version_id
     OR v_head IS DISTINCT FROM p_expected_event_id THEN
    RAISE EXCEPTION 'STALE_BLOCK_TRANSITION';
  END IF;
  SELECT * INTO v_old FROM public.__seo_content_block_versions
    WHERE version_id = p_expected_version_id AND block_id = p_block_id AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_ACTIVE_BLOCK_VERSION'; END IF;

  IF p_operation = 'replace' THEN
    IF v_old.content_hash = p_content_hash THEN RAISE EXCEPTION 'UNCHANGED_BLOCK_CONTENT'; END IF;
    IF v_old.confidence_base IS NOT NULL AND p_confidence_base IS NOT NULL
       AND p_confidence_base < v_old.confidence_base THEN
      -- This primitive accepts transitions only. The native writer's draft/conflict
      -- path must handle regressions before calling it; never promote one here.
      RAISE EXCEPTION 'BLOCK_TRANSITION_WOULD_REGRESS';
    END IF;
    INSERT INTO public.__seo_content_block_versions
      (block_id, status, source_type, confidence_base, content_hash, content, run_id)
    VALUES (p_block_id, 'active', p_source_type, p_confidence_base, p_content_hash, p_content, p_run_id)
    RETURNING version_id INTO v_new;
  END IF;
  UPDATE public.__seo_content_block_versions SET status = 'deprecated', valid_to = now()
    WHERE version_id = p_expected_version_id;
  UPDATE public.__seo_content_blocks SET active_version_id = v_new, updated_at = now()
    WHERE block_id = p_block_id;
  INSERT INTO public.__rag_change_events
    (rce_rag_source, rce_old_hash, rce_new_hash, rce_diff_sections, rce_impacted_roles,
     rce_operation, rce_entity_id, rce_block_id, rce_run_id, rce_previous_event_id,
     rce_old_version_id, rce_new_version_id, rce_request_hash)
  VALUES (p_wiki_source, v_old.content_hash, p_content_hash, ARRAY[v_block.block_kind], ARRAY[v_block.role],
    p_operation, v_block.entity_id, p_block_id, p_run_id, v_head, p_expected_version_id, v_new, v_hash)
  RETURNING * INTO v_event;
  -- pending means delivery still required, never consumer completion.
  RETURN QUERY SELECT v_event.rce_id::bigint, v_new, false;
END
$function$;
REVOKE ALL ON FUNCTION public.transition_seo_projection_block(text,text,text,uuid,uuid,bigint,text,text,text,jsonb,double precision,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transition_seo_projection_block(text,text,text,uuid,uuid,bigint,text,text,text,jsonb,double precision,text)
  TO service_role;
