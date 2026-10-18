-- Local candidate only. Review ledger/privileges before shared deployment.
-- Unapplied candidate reconciled against target metadata captured 2026-10-17.
-- Preserve table/policies. Revoke legacy social write grants only when the
-- existing RLS contract is exactly service_role-only; refuse other drift.
-- Transaction owned by the migration runner (or an explicit test wrapper).
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $$
BEGIN
  IF (SELECT atttypid FROM pg_attribute WHERE attrelid = 'public.__marketing_social_posts'::regclass AND attname = 'channels') IS DISTINCT FROM 'jsonb'::regtype
     OR (SELECT atttypid FROM pg_attribute WHERE attrelid = 'public.__marketing_social_posts'::regclass AND attname = 'channels_list') IS DISTINCT FROM 'text[]'::regtype THEN
    RAISE EXCEPTION 'Reconcile social content column types before this migration';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.__marketing_social_posts'::regclass)
     OR (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = '__marketing_social_posts') <> 1
     OR NOT EXISTS (
       SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = '__marketing_social_posts'
         AND roles = ARRAY['service_role']::name[] AND cmd = 'ALL'
         AND permissive = 'PERMISSIVE' AND qual = 'true' AND with_check = 'true'
     ) THEN
    RAISE EXCEPTION 'Reconcile social post RLS before this migration';
  END IF;
  -- RLS does not protect TRUNCATE. This is an explicit ACL change on one table,
  -- not a policy rewrite or a broad default-privilege change.
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.__marketing_social_posts FROM PUBLIC, anon, authenticated;
  IF has_any_column_privilege('anon', 'public.__marketing_social_posts', 'INSERT,UPDATE')
     OR has_any_column_privilege('authenticated', 'public.__marketing_social_posts', 'INSERT,UPDATE')
     OR has_table_privilege('anon', 'public.__marketing_social_posts', 'DELETE,TRUNCATE')
     OR has_table_privilege('authenticated', 'public.__marketing_social_posts', 'DELETE,TRUNCATE') THEN
    RAISE EXCEPTION 'Reconcile social post write privileges before this migration (residual column or inherited grants)';
  END IF;
END $$;

ALTER TABLE public.__marketing_social_posts
  ADD COLUMN content_revision bigint NOT NULL DEFAULT 1 CHECK (content_revision > 0),
  ADD COLUMN review_version bigint NOT NULL DEFAULT 0 CHECK (review_version >= 0),
  ADD COLUMN channel_reviews jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(channel_reviews) = 'object');

CREATE TABLE public.__marketing_social_post_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id bigint NOT NULL REFERENCES public.__marketing_social_posts(id),
  content_revision bigint NOT NULL,
  review_version bigint NOT NULL,
  snapshot jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (post_id, content_revision, review_version)
);
REVOKE ALL ON public.__marketing_social_post_history FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.__marketing_social_post_history TO service_role;

-- Fail closed for newly added fields: everything except operational metadata is
-- editorial. JSONB comparison ignores object key order, never array order.
CREATE FUNCTION public.marketing_social_editorial(p_row jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
 SELECT p_row - ARRAY['id','content_revision','review_version','channel_reviews',
 'status','brand_gate_level','compliance_gate_level','gate_summary','quality_score',
 'approved_by','approved_at','published_at','created_at','updated_at',
 'performance_score','actual_reach','actual_clicks','actual_engagement_rate',
 'actual_conversions','performance_updated_at'];
$$;

CREATE FUNCTION public.marketing_social_revision_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE changed boolean; review jsonb; total integer; approved integer; passed integer; failed integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.content_revision := 1;
    NEW.review_version := 0;
    NEW.channel_reviews := '{}';
    NEW.status := CASE WHEN NEW.status = 'draft' THEN 'draft' ELSE 'generated' END;
    NEW.published_at := NULL;
  ELSE
    changed := public.marketing_social_editorial(to_jsonb(NEW)) IS DISTINCT FROM public.marketing_social_editorial(to_jsonb(OLD));
    IF OLD.status IN ('published','archived') THEN
      IF changed OR NEW.channel_reviews IS DISTINCT FROM OLD.channel_reviews OR NEW.status IS DISTINCT FROM OLD.status THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Closed social post requires a new content record';
      END IF;
      NEW.content_revision := OLD.content_revision;
      NEW.review_version := OLD.review_version;
      RETURN NEW;
    END IF;
    IF NEW.status = 'published' OR NEW.published_at IS DISTINCT FROM OLD.published_at THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Publication evidence workflow required';
    END IF;
    NEW.content_revision := OLD.content_revision + CASE WHEN changed THEN 1 ELSE 0 END;
    IF changed THEN NEW.channel_reviews := '{}'; END IF;
    NEW.review_version := OLD.review_version + CASE WHEN changed OR NEW.channel_reviews IS DISTINCT FROM OLD.channel_reviews THEN 1 ELSE 0 END;
  END IF;
  -- Legacy summary fields are projections, never approval authority.
  NEW.approved_by := NULL;
  NEW.approved_at := NULL;
  review := NEW.channel_reviews -> NEW.primary_channel;
  NEW.gate_summary := review -> 'gate';
  NEW.brand_gate_level := review #>> '{gate,brand,level}';
  NEW.compliance_gate_level := review #>> '{gate,compliance,level}';
  NEW.quality_score := CASE WHEN review->'gate' IS NULL THEN NULL ELSE (
    CASE review#>>'{gate,brand,level}' WHEN 'PASS' THEN 100 WHEN 'WARN' THEN 70 ELSE 0 END +
    CASE review#>>'{gate,compliance,level}' WHEN 'PASS' THEN 100 WHEN 'WARN' THEN 70 ELSE 0 END
  ) / 2.0 END;
  SELECT count(*), count(*) FILTER (WHERE NEW.channel_reviews->ch->>'state' = 'approved'),
    count(*) FILTER (WHERE NEW.channel_reviews->ch->>'state' IN ('approved','gate_passed')),
    count(*) FILTER (WHERE NEW.channel_reviews->ch->>'state' IN ('rejected','gate_failed'))
    INTO total, approved, passed, failed
    FROM jsonb_array_elements_text(to_jsonb(NEW.channels_list)) ch;
  IF NEW.status <> 'archived' THEN
    NEW.status := CASE WHEN total > 0 AND approved = total THEN 'approved'
      WHEN passed > 0 THEN 'gate_passed' WHEN failed > 0 THEN 'gate_failed'
      WHEN NEW.status = 'draft' THEN 'draft' ELSE 'generated' END;
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END $$;

CREATE FUNCTION public.marketing_social_record_history() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.content_revision <> OLD.content_revision OR NEW.review_version <> OLD.review_version THEN
    INSERT INTO public.__marketing_social_post_history(post_id,content_revision,review_version,snapshot)
    VALUES (NEW.id, NEW.content_revision, NEW.review_version, to_jsonb(NEW));
  END IF;
  RETURN NEW;
END $$;
CREATE FUNCTION public.marketing_social_history_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN RAISE EXCEPTION 'Social history is append-only'; END $$;
CREATE TRIGGER marketing_social_history_immutable BEFORE UPDATE OR DELETE ON public.__marketing_social_post_history
FOR EACH ROW EXECUTE FUNCTION public.marketing_social_history_immutable();

-- Preserve the old claims as evidence, without grandfathering their approval.
INSERT INTO public.__marketing_social_post_history(post_id,content_revision,review_version,snapshot)
SELECT id, content_revision, review_version, to_jsonb(p) FROM public.__marketing_social_posts p;
UPDATE public.__marketing_social_posts SET approved_by = NULL, approved_at = NULL,
  gate_summary = NULL, brand_gate_level = NULL, compliance_gate_level = NULL, quality_score = NULL,
  status = CASE WHEN status IN ('draft','published','archived') THEN status ELSE 'generated' END;

CREATE TRIGGER marketing_social_revision_guard BEFORE INSERT OR UPDATE ON public.__marketing_social_posts
FOR EACH ROW EXECUTE FUNCTION public.marketing_social_revision_guard();
CREATE TRIGGER marketing_social_record_history AFTER INSERT OR UPDATE ON public.__marketing_social_posts
FOR EACH ROW EXECUTE FUNCTION public.marketing_social_record_history();

CREATE FUNCTION public.review_marketing_social_post(
  p_post_id bigint, p_channel text, p_content_revision bigint, p_review_version bigint,
  p_action text, p_actor text, p_gate jsonb DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE post public.__marketing_social_posts; review jsonb; state text;
BEGIN
  IF p_channel IS NULL OR p_channel NOT IN ('instagram','facebook','youtube')
     OR p_action IS NULL OR p_action NOT IN ('gate','approve','reject')
     OR nullif(btrim(p_actor),'') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Invalid social review request';
  END IF;
  SELECT * INTO post FROM public.__marketing_social_posts WHERE id = p_post_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Post not found'; END IF;
  IF post.content_revision IS DISTINCT FROM p_content_revision OR post.review_version IS DISTINCT FROM p_review_version THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Content or review changed; reload before deciding';
  END IF;
  IF post.status IN ('published','archived') OR NOT (to_jsonb(post.channels_list) ? p_channel)
     OR jsonb_typeof(post.channels->p_channel) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Channel unavailable for review';
  END IF;
  review := post.channel_reviews->p_channel;
  IF p_action = 'gate' THEN
    IF p_gate IS NULL OR jsonb_typeof(p_gate->'can_approve') IS DISTINCT FROM 'boolean'
       OR coalesce(p_gate#>>'{brand,level}','') NOT IN ('PASS','WARN','FAIL')
       OR coalesce(p_gate#>>'{compliance,level}','') NOT IN ('PASS','WARN','FAIL')
       OR jsonb_typeof(p_gate->'blocking_issues') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Invalid gate result';
    END IF;
    state := CASE WHEN p_gate->>'can_approve' = 'true'
      AND p_gate#>>'{brand,level}' <> 'FAIL' AND p_gate#>>'{compliance,level}' <> 'FAIL'
      AND jsonb_array_length(p_gate->'blocking_issues') = 0 THEN 'gate_passed' ELSE 'gate_failed' END;
    review := jsonb_build_object('content_revision',p_content_revision,'state',state,'gate',p_gate,'actor',p_actor,'decided_at',clock_timestamp());
  ELSIF p_action = 'approve' THEN
    IF coalesce(review->>'state','') <> 'gate_passed'
       OR (review->>'content_revision')::bigint IS DISTINCT FROM p_content_revision THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Passing gate for this channel and revision required';
    END IF;
    review := review || jsonb_build_object('state','approved','actor',p_actor,'decided_at',clock_timestamp());
  ELSE
    review := jsonb_build_object('content_revision',p_content_revision,'state','rejected','actor',p_actor,'decided_at',clock_timestamp());
  END IF;
  UPDATE public.__marketing_social_posts SET channel_reviews = jsonb_set(channel_reviews, ARRAY[p_channel], review)
  WHERE id = p_post_id RETURNING * INTO post;
  RETURN to_jsonb(post);
END $$;

REVOKE ALL ON FUNCTION public.review_marketing_social_post(bigint,text,bigint,bigint,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_marketing_social_post(bigint,text,bigint,bigint,text,text,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.marketing_social_record_history() FROM PUBLIC, anon, authenticated;
