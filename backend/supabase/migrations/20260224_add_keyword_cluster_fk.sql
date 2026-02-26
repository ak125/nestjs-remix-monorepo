-- FK: __seo_page_brief.keyword_cluster_id → __seo_keyword_cluster.id
-- Idempotent, ON DELETE SET NULL (pas de cascade destructive)
-- Date: 2026-02-24

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_page_brief_keyword_cluster'
  ) THEN
    ALTER TABLE __seo_page_brief
      ADD CONSTRAINT fk_page_brief_keyword_cluster
      FOREIGN KEY (keyword_cluster_id) REFERENCES __seo_keyword_cluster(id)
      ON DELETE SET NULL;
  END IF;
END $$;
