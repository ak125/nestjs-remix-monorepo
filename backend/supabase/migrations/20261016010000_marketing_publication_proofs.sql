-- Local L4c/d candidate; apply only after ledger review and explicit shared-DB authorization.
-- Extends the preserved 20261014010000 candidate; no RLS policy changes.
-- Runner must wrap both migrations in a transaction for first activation.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
ALTER TABLE public.__marketing_social_posts ADD COLUMN publications jsonb NOT NULL DEFAULT '{}'
 CHECK (jsonb_typeof(publications)='object');
CREATE FUNCTION public.marketing_social_publication_url(p_url text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT coalesce(length(p_url) <= 2048 AND p_url ~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]{1,5})?([/?#][^[:space:]]*)?$',false);
$$;
CREATE OR REPLACE FUNCTION public.marketing_social_editorial(p_row jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
 SELECT p_row - ARRAY['id','content_revision','review_version','channel_reviews','publications',
 'status','brand_gate_level','compliance_gate_level','gate_summary','quality_score',
 'approved_by','approved_at','published_at','created_at','updated_at',
 'performance_score','actual_reach','actual_clicks','actual_engagement_rate',
 'actual_conversions','performance_updated_at'];
$$;

CREATE OR REPLACE FUNCTION public.marketing_social_revision_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE changed boolean; review jsonb; total integer; approved integer; passed integer; failed integer; ch text; proof jsonb; expected_hash text; proofs integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.content_revision := 1;
    NEW.review_version := 0;
    NEW.channel_reviews := '{}';
    NEW.publications := '{}';
    NEW.status := CASE WHEN NEW.status = 'draft' THEN 'draft' ELSE 'generated' END;
    NEW.published_at := NULL;
  ELSE
    changed := public.marketing_social_editorial(to_jsonb(NEW)) IS DISTINCT FROM public.marketing_social_editorial(to_jsonb(OLD));
    IF OLD.publications <> '{}' AND changed THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Published evidence freezes editorial content; create a new post';
    END IF;
    IF OLD.status IN ('published','archived') THEN
      IF changed OR NEW.channel_reviews IS DISTINCT FROM OLD.channel_reviews OR NEW.status IS DISTINCT FROM OLD.status OR NEW.publications IS DISTINCT FROM OLD.publications OR NEW.published_at IS DISTINCT FROM OLD.published_at THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Closed social post requires a new content record';
      END IF;
      NEW.content_revision := OLD.content_revision;
      NEW.review_version := OLD.review_version;
      RETURN NEW;
    END IF;
    IF NEW.published_at IS DISTINCT FROM OLD.published_at
       OR (NEW.status = 'published' AND NEW.publications = OLD.publications) THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Publication evidence workflow required';
    END IF;
    FOR ch, proof IN SELECT * FROM jsonb_each(OLD.publications) LOOP
      IF NEW.publications->ch IS DISTINCT FROM proof OR NEW.channel_reviews->ch IS DISTINCT FROM OLD.channel_reviews->ch THEN
        RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Published channel evidence and approval are immutable';
      END IF;
    END LOOP;
    expected_hash := encode(sha256(convert_to(public.marketing_social_editorial(to_jsonb(OLD))::text,'UTF8')),'hex');
    FOR ch, proof IN SELECT * FROM jsonb_each(NEW.publications) LOOP
      IF NOT (OLD.publications ? ch) THEN
        IF changed OR NOT (coalesce(OLD.channels_list,ARRAY[]::text[]) @> ARRAY[ch])
           OR coalesce(OLD.channel_reviews->ch->>'state','') <> 'approved'
           OR (OLD.channel_reviews->ch->>'content_revision')::bigint IS DISTINCT FROM OLD.content_revision
           OR OLD.channel_reviews->ch->>'approved_content_hash' IS DISTINCT FROM expected_hash
           OR proof->>'content_hash' IS DISTINCT FROM expected_hash
           OR (proof->>'content_revision')::bigint IS DISTINCT FROM OLD.content_revision
           OR nullif(btrim(proof->>'declared_by'),'') IS NULL OR proof->>'declared_at' IS NULL
           OR NOT public.marketing_social_publication_url(proof->>'url')
           OR NEW.channel_reviews IS DISTINCT FROM OLD.channel_reviews THEN
          RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Current channel approval and HTTPS publication evidence required';
        END IF;
      END IF;
    END LOOP;
    NEW.content_revision := OLD.content_revision + CASE WHEN changed THEN 1 ELSE 0 END;
    IF changed THEN NEW.channel_reviews := '{}'; END IF;
    NEW.review_version := OLD.review_version + CASE WHEN changed OR NEW.channel_reviews IS DISTINCT FROM OLD.channel_reviews OR NEW.publications IS DISTINCT FROM OLD.publications THEN 1 ELSE 0 END;
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
  SELECT count(*), count(*) FILTER (WHERE NEW.channel_reviews->declared.channel->>'state' = 'approved'),
    count(*) FILTER (WHERE NEW.channel_reviews->declared.channel->>'state' IN ('approved','gate_passed')),
    count(*) FILTER (WHERE NEW.channel_reviews->declared.channel->>'state' IN ('rejected','gate_failed'))
    INTO total, approved, passed, failed
    FROM jsonb_array_elements_text(to_jsonb(NEW.channels_list)) AS declared(channel);
  IF NEW.status <> 'archived' THEN
    NEW.status := CASE WHEN total > 0 AND approved = total THEN 'approved'
      WHEN passed > 0 THEN 'gate_passed' WHEN failed > 0 THEN 'gate_failed'
      WHEN NEW.status = 'draft' THEN 'draft' ELSE 'generated' END;
  END IF;
  SELECT count(*) INTO proofs FROM unnest(NEW.channels_list) channel WHERE NEW.publications ? channel;
  IF total > 0 AND proofs = total THEN
    NEW.status := 'published'; NEW.published_at := clock_timestamp();
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.review_marketing_social_post(
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
  IF post.status IN ('published','archived') OR post.publications ? p_channel OR NOT (to_jsonb(post.channels_list) ? p_channel)
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
    review := review || jsonb_build_object('state','approved','actor',p_actor,'decided_at',clock_timestamp(),
      'approved_content_hash',encode(sha256(convert_to(public.marketing_social_editorial(to_jsonb(post))::text,'UTF8')),'hex'));
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

-- Idempotency identity is (post, channel, content revision, approved hash, URL).
-- An identical retry returns the original actor/time, even with the old review version.
CREATE FUNCTION public.declare_marketing_social_publication(
 p_post_id bigint, p_channel text, p_content_revision bigint, p_review_version bigint,
 p_content_hash text, p_url text, p_actor text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE post public.__marketing_social_posts; proof jsonb; current_hash text;
BEGIN
 IF p_channel IS NULL OR p_channel NOT IN ('facebook','instagram','youtube')
    OR nullif(btrim(p_actor),'') IS NULL OR NOT public.marketing_social_publication_url(p_url) THEN
   RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Channel, actor and HTTPS publication URL required';
 END IF;
 SELECT * INTO post FROM public.__marketing_social_posts WHERE id=p_post_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='Post not found'; END IF;
 current_hash := encode(sha256(convert_to(public.marketing_social_editorial(to_jsonb(post))::text,'UTF8')),'hex');
 IF post.content_revision IS DISTINCT FROM p_content_revision THEN
   RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='Content changed; reload before declaring publication';
 END IF;
 IF coalesce(post.channel_reviews->p_channel->>'state','') <> 'approved'
    OR (post.channel_reviews->p_channel->>'content_revision')::bigint IS DISTINCT FROM post.content_revision
    OR NOT (coalesce(post.channels_list,ARRAY[]::text[]) @> ARRAY[p_channel])
    OR post.channel_reviews->p_channel->>'approved_content_hash' IS DISTINCT FROM current_hash THEN
   RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Current approval for this channel required';
 END IF;
 IF current_hash IS DISTINCT FROM p_content_hash THEN
   RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='Approved content hash differs';
 END IF;
 proof := post.publications->p_channel;
 IF proof IS NOT NULL THEN
   IF proof->>'url' = p_url AND proof->>'content_hash' = p_content_hash
      AND (proof->>'content_revision')::bigint = p_content_revision THEN RETURN to_jsonb(post); END IF;
   RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='A different publication proof already exists';
 END IF;
 IF post.status IN ('published','archived') THEN
   RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Closed post cannot declare another publication';
 END IF;
 IF post.review_version IS DISTINCT FROM p_review_version THEN
   RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='Review changed; reload before declaring publication';
 END IF;
 proof := jsonb_build_object('url',p_url,'content_revision',p_content_revision,'content_hash',p_content_hash,
   'declared_by',p_actor,'declared_at',clock_timestamp());
 UPDATE public.__marketing_social_posts SET publications=jsonb_set(publications,ARRAY[p_channel],proof)
 WHERE id=p_post_id RETURNING * INTO post;
 RETURN to_jsonb(post);
END $$;
REVOKE ALL ON FUNCTION public.declare_marketing_social_publication(bigint,text,bigint,bigint,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.declare_marketing_social_publication(bigint,text,bigint,bigint,text,text,text) TO service_role;
