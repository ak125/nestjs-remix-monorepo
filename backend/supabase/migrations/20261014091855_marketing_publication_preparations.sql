-- Preparation evidence only. No account authorization, asset verification or publication.
-- Depends on 20261014010000_marketing_social_reviews.sql. Candidate, not deployed.
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

CREATE TABLE public.__marketing_publication_preparations (
  request_id uuid PRIMARY KEY,
  post_id bigint NOT NULL REFERENCES public.__marketing_social_posts(id),
  channel text NOT NULL CHECK (channel IN ('instagram','facebook','youtube')),
  content_revision bigint NOT NULL CHECK (content_revision > 0),
  review_version bigint NOT NULL CHECK (review_version >= 0),
  account jsonb NOT NULL,
  media jsonb NOT NULL,
  actor text NOT NULL,
  editorial_snapshot jsonb NOT NULL,
  approval_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX marketing_publication_preparations_post_idx
  ON public.__marketing_publication_preparations(post_id, created_at DESC, request_id DESC);
ALTER TABLE public.__marketing_publication_preparations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.__marketing_publication_preparations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.__marketing_publication_preparations TO service_role;
-- Snapshot and timestamp columns cannot be supplied by the API role.
GRANT INSERT(request_id,post_id,channel,content_revision,review_version,account,media,actor)
  ON public.__marketing_publication_preparations TO service_role;
CREATE POLICY marketing_preparation_service_read ON public.__marketing_publication_preparations
  FOR SELECT TO service_role USING (true);
CREATE POLICY marketing_preparation_service_insert ON public.__marketing_publication_preparations
  FOR INSERT TO service_role WITH CHECK (true);

CREATE FUNCTION public.marketing_preparation_snapshot_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE post public.__marketing_social_posts; item jsonb; seen text[] := ARRAY[]::text[]; object_ref text;
BEGIN
  -- This also protects direct service-role INSERTs, not just the RPC.
  SELECT * INTO post FROM public.__marketing_social_posts WHERE id=NEW.post_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='Post not found'; END IF;
  IF post.content_revision IS DISTINCT FROM NEW.content_revision OR post.review_version IS DISTINCT FROM NEW.review_version THEN
    RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='Content or review changed';
  END IF;
  IF NEW.channel IS NULL OR NEW.channel NOT IN ('instagram','facebook','youtube')
    OR post.status IN ('published','archived')
    OR coalesce(to_jsonb(post.channels_list) ? NEW.channel,false) = false
    OR jsonb_typeof(post.channels->NEW.channel) IS DISTINCT FROM 'object'
    OR coalesce(post.channel_reviews->NEW.channel->>'state','') <> 'approved'
    OR post.channel_reviews->NEW.channel->'content_revision' IS DISTINCT FROM to_jsonb(NEW.content_revision)
    OR nullif(btrim(post.channel_reviews->NEW.channel->>'actor'),'') IS NULL
    OR nullif(btrim(post.channel_reviews->NEW.channel->>'decided_at'),'') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Current channel approval required';
  END IF;
  IF nullif(btrim(NEW.actor),'') IS NULL OR length(NEW.actor) > 200
    OR jsonb_typeof(NEW.account) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Invalid declared account or actor';
  END IF;
  IF NEW.account - ARRAY['external_id','label'] <> '{}'::jsonb
    OR jsonb_typeof(NEW.account->'external_id') IS DISTINCT FROM 'string'
    OR coalesce(NEW.account->>'external_id','') !~ '^[a-zA-Z0-9_.:@-]{1,200}$'
    OR jsonb_typeof(NEW.account->'label') IS DISTINCT FROM 'string'
    OR nullif(btrim(NEW.account->>'label'),'') IS NULL OR length(NEW.account->>'label') > 200 THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Invalid declared account';
  END IF;
  IF jsonb_typeof(NEW.media) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Media references must be an array';
  END IF;
  IF jsonb_array_length(NEW.media) > 20 THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Too many media references';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(NEW.media) LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Invalid media reference';
    END IF;
    IF item - ARRAY['bucket','path','sha256','role'] <> '{}'::jsonb
      OR jsonb_typeof(item->'bucket') IS DISTINCT FROM 'string'
      OR coalesce(item->>'bucket','') !~ '^[a-z0-9][a-z0-9_-]{0,99}$'
      OR jsonb_typeof(item->'path') IS DISTINCT FROM 'string'
      OR coalesce(item->>'path','') !~ '^[a-zA-Z0-9_-][a-zA-Z0-9_./-]*$'
      OR length(item->>'path') > 512
      OR EXISTS (SELECT 1 FROM unnest(string_to_array(item->>'path','/')) part WHERE part IN ('','.','..'))
      OR jsonb_typeof(item->'sha256') IS DISTINCT FROM 'string'
      OR coalesce(item->>'sha256','') !~ '^[a-f0-9]{64}$'
      OR jsonb_typeof(item->'role') IS DISTINCT FROM 'string'
      OR coalesce(item->>'role','') NOT IN ('image','video','thumbnail','subtitles') THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Invalid media reference';
    END IF;
    object_ref := (item->>'bucket') || '/' || (item->>'path');
    IF object_ref = ANY(seen) THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Duplicate media object';
    END IF;
    seen := array_append(seen,object_ref);
  END LOOP;
  NEW.editorial_snapshot := public.marketing_social_editorial(to_jsonb(post));
  NEW.approval_snapshot := post.channel_reviews->NEW.channel;
  NEW.created_at := clock_timestamp();
  RETURN NEW;
END $$;
CREATE TRIGGER marketing_preparation_snapshot_guard BEFORE INSERT ON public.__marketing_publication_preparations
  FOR EACH ROW EXECUTE FUNCTION public.marketing_preparation_snapshot_guard();
CREATE TRIGGER marketing_preparation_immutable BEFORE UPDATE OR DELETE ON public.__marketing_publication_preparations
  FOR EACH ROW EXECUTE FUNCTION public.marketing_social_history_immutable();

CREATE FUNCTION public.prepare_marketing_publication(
  p_post_id bigint, p_request_id uuid, p_channel text, p_content_revision bigint,
  p_review_version bigint, p_account jsonb, p_media jsonb, p_actor text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE post public.__marketing_social_posts; saved public.__marketing_publication_preparations;
BEGIN
  -- Lock before replay lookup: edits and reviews serialize on the same post.
  SELECT * INTO post FROM public.__marketing_social_posts WHERE id=p_post_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='Post not found'; END IF;
  IF post.content_revision IS DISTINCT FROM p_content_revision OR post.review_version IS DISTINCT FROM p_review_version THEN
    RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='Content or review changed';
  END IF;
  IF post.status IN ('published','archived') OR coalesce(post.channel_reviews->p_channel->>'state','') <> 'approved' THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Current channel approval required';
  END IF;
  SELECT * INTO saved FROM public.__marketing_publication_preparations WHERE request_id=p_request_id;
  IF FOUND THEN
    IF saved.post_id IS DISTINCT FROM p_post_id OR saved.channel IS DISTINCT FROM p_channel
      OR saved.content_revision IS DISTINCT FROM p_content_revision OR saved.review_version IS DISTINCT FROM p_review_version
      OR saved.account IS DISTINCT FROM p_account OR saved.media IS DISTINCT FROM p_media OR saved.actor IS DISTINCT FROM p_actor THEN
      RAISE EXCEPTION USING ERRCODE='23505', MESSAGE='Request ID already used for another preparation';
    END IF;
    RETURN to_jsonb(saved);
  END IF;
  INSERT INTO public.__marketing_publication_preparations(request_id,post_id,channel,content_revision,review_version,account,media,actor)
  VALUES(p_request_id,p_post_id,p_channel,p_content_revision,p_review_version,p_account,p_media,p_actor)
  RETURNING * INTO saved;
  RETURN to_jsonb(saved);
END $$;
REVOKE ALL ON FUNCTION public.prepare_marketing_publication(bigint,uuid,text,bigint,bigint,jsonb,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_marketing_publication(bigint,uuid,text,bigint,bigint,jsonb,jsonb,text) TO service_role;
REVOKE ALL ON FUNCTION public.marketing_preparation_snapshot_guard() FROM PUBLIC,anon,authenticated;
