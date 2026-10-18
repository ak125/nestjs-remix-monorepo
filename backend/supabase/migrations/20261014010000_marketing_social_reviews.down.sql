-- Empty-schema rollback only, after publication_proofs.down.sql.
-- Existing legacy snapshots, decisions and publications must never be discarded.
-- The scoped anon/authenticated write revocation is intentionally retained.
-- Do not restore legacy write/TRUNCATE privileges during application rollback.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
LOCK TABLE public.__marketing_social_posts, public.__marketing_social_post_history IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.__marketing_social_posts'::regclass AND attname='publications' AND NOT attisdropped) THEN
   RAISE EXCEPTION 'Rollback publication proof migration first';
 END IF;
 IF EXISTS (SELECT 1 FROM public.__marketing_social_posts)
    OR EXISTS (SELECT 1 FROM public.__marketing_social_post_history) THEN
   RAISE EXCEPTION 'Rollback refused: retain social posts and history; prepare a forward repair';
 END IF;
END $$;
DROP TRIGGER marketing_social_revision_guard ON public.__marketing_social_posts;
DROP TRIGGER marketing_social_record_history ON public.__marketing_social_posts;
DROP FUNCTION public.review_marketing_social_post(bigint,text,bigint,bigint,text,text,jsonb);
DROP FUNCTION public.marketing_social_revision_guard();
DROP FUNCTION public.marketing_social_record_history();
DROP FUNCTION public.marketing_social_editorial(jsonb);
DROP TABLE public.__marketing_social_post_history;
DROP FUNCTION public.marketing_social_history_immutable();
ALTER TABLE public.__marketing_social_posts DROP COLUMN content_revision, DROP COLUMN review_version, DROP COLUMN channel_reviews;
