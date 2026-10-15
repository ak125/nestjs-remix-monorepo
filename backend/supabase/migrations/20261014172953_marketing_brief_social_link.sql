-- Local candidate. Requires the existing brief table and social revision migration.
-- No backfill: a legacy FK alone is not evidence of an approved source version.
-- Transaction owned by the migration runner (or an explicit test wrapper).
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $dependencies$
BEGIN
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid='public.__marketing_social_posts'::regclass
      AND NOT attisdropped AND attnotnull
      AND ((attname IN ('content_revision','review_version') AND atttypid='bigint'::regtype)
        OR (attname='channel_reviews' AND atttypid='jsonb'::regtype))) <> 3
     OR to_regclass('public.__marketing_social_post_history') IS NULL
     OR to_regprocedure('public.review_marketing_social_post(bigint,text,bigint,bigint,text,text,jsonb)') IS NULL
     OR (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.__marketing_social_posts'::regclass
         AND NOT tgisinternal AND tgenabled IN ('O','A')
         AND ((tgname='marketing_social_revision_guard' AND tgfoid=to_regprocedure('public.marketing_social_revision_guard()'))
           OR (tgname='marketing_social_record_history' AND tgfoid=to_regprocedure('public.marketing_social_record_history()')))) <> 2 THEN
    RAISE EXCEPTION 'Apply the social review migration and verify its active triggers first';
  END IF;
END;
$dependencies$;
DO $$ BEGIN
  IF has_any_column_privilege('anon','public.__marketing_brief','INSERT,UPDATE')
    OR has_any_column_privilege('authenticated','public.__marketing_brief','INSERT,UPDATE')
    OR has_table_privilege('anon','public.__marketing_brief','DELETE,TRUNCATE')
    OR has_table_privilege('authenticated','public.__marketing_brief','DELETE,TRUNCATE') THEN
    RAISE EXCEPTION 'Reconcile brief write privileges before this migration';
  END IF;
END $$;
ALTER TABLE public.__marketing_social_posts ADD COLUMN source_brief jsonb
  CHECK (source_brief IS NULL OR jsonb_typeof(source_brief) = 'object');
-- Squawk 2.52.1: require-concurrent-index-creation warns that writes are blocked.
-- Keep this index atomic with the association contract on the newly reconciled
-- brief table. lock_timeout=5s and statement_timeout=30s bound the operation;
-- if the table is already busy/large, stop and review a separate concurrent build.
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX idx_marketing_brief_social_post ON public.__marketing_brief(social_post_id) WHERE social_post_id IS NOT NULL;

-- The existing editorial comparison includes this column, increments the content
-- revision and clears channel reviews. The existing history stores the snapshot.
CREATE FUNCTION public.marketing_social_source_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF OLD.source_brief IS NOT NULL AND NEW.source_brief IS DISTINCT FROM OLD.source_brief THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Approved source snapshot is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER marketing_social_source_guard BEFORE UPDATE ON public.__marketing_social_posts
FOR EACH ROW EXECUTE FUNCTION public.marketing_social_source_guard();

CREATE FUNCTION public.link_marketing_brief_social(
 p_brief_id uuid, p_post_id bigint, p_expected_updated_at timestamptz,
 p_content_revision bigint, p_review_version bigint, p_actor text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE brief public.__marketing_brief; post public.__marketing_social_posts; channel text; source jsonb;
BEGIN
  IF p_expected_updated_at IS NULL OR p_content_revision IS NULL OR p_content_revision < 1
    OR p_review_version IS NULL OR p_review_version < 0 OR coalesce(btrim(p_actor),'') = '' THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Explicit source and target versions and actor required';
  END IF;
  -- All association calls lock in the same order. Social reviews lock only post.
  SELECT * INTO brief FROM public.__marketing_brief WHERE id=p_brief_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='Brief not found'; END IF;
  SELECT * INTO post FROM public.__marketing_social_posts WHERE id=p_post_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='Social content not found'; END IF;
  source := post.source_brief;
  -- Exact replay is read-only, including after newer reviews or editorial changes.
  IF brief.social_post_id = p_post_id AND source#>>'{brief,id}' = p_brief_id::text
    AND (source#>>'{brief,updated_at}')::timestamptz = p_expected_updated_at
    AND (source->>'input_content_revision')::bigint = p_content_revision
    AND (source->>'input_review_version')::bigint = p_review_version
    AND source->>'linked_by' = p_actor THEN
    RETURN to_jsonb(post);
  END IF;
  IF source IS NOT NULL OR (brief.social_post_id IS NOT NULL AND brief.social_post_id <> p_post_id)
    OR brief.updated_at IS DISTINCT FROM p_expected_updated_at
    OR post.content_revision IS DISTINCT FROM p_content_revision
    OR post.review_version IS DISTINCT FROM p_review_version
    OR EXISTS (SELECT 1 FROM public.__marketing_brief WHERE social_post_id=p_post_id AND id<>p_brief_id) THEN
    RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='Source, target or association changed; reload before linking';
  END IF;
  channel := CASE brief.channel WHEN 'social_facebook' THEN 'facebook' WHEN 'social_instagram' THEN 'instagram' END;
  IF brief.status <> 'approved' OR coalesce(btrim(brief.reviewed_by),'') = '' OR brief.reviewed_at IS NULL
    OR coalesce(btrim(brief.approved_by),'') = '' OR brief.approved_at IS NULL
    OR coalesce(brief.brand_gate_level,'') NOT IN ('PASS','WARN')
    OR coalesce(brief.compliance_gate_level,'') NOT IN ('PASS','WARN')
    OR brief.gate_summary->'can_approve' IS DISTINCT FROM 'true'::jsonb
    OR brief.gate_summary->'blocking_issues' IS DISTINCT FROM '[]'::jsonb THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Approved brief with recorded review and passing gates required';
  END IF;
  IF channel IS NULL OR NOT coalesce(channel = ANY(post.channels_list),false)
    OR jsonb_typeof(post.channels->channel) IS DISTINCT FROM 'object'
    OR coalesce(btrim(post.channels->channel->>'caption'),'') = ''
    OR post.status IN ('published','archived') THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Open social content for the brief channel required';
  END IF;
  UPDATE public.__marketing_social_posts SET source_brief=jsonb_build_object(
    'brief', to_jsonb(brief), 'linked_by', p_actor, 'linked_at', clock_timestamp(),
    'linked_content_revision', post.content_revision+1,
    'input_content_revision',p_content_revision,'input_review_version',p_review_version
  ) WHERE id=p_post_id RETURNING * INTO post;
  UPDATE public.__marketing_brief SET social_post_id=p_post_id WHERE id=p_brief_id;
  RETURN to_jsonb(post);
END $$;
REVOKE ALL ON FUNCTION public.link_marketing_brief_social(uuid,bigint,timestamptz,bigint,bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.link_marketing_brief_social(uuid,bigint,timestamptz,bigint,bigint,text) TO service_role;
