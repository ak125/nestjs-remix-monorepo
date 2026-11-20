-- Mandat EN — H1 et titres des rôles R1 (gamme), R3 (conseils) et R8
-- (véhicule), pour la cannibalisation. Deux sources : le crawl PROD (servi,
-- 7 jours) et les tables de contenu. Lecture seule.
\pset footer off
\pset format unaligned
\pset fieldsep '\t'
WITH crawl AS (
  SELECT DISTINCT ON (url)
         CASE WHEN url ~ '/pieces/[^/]+\.html$' THEN 'R1'
              WHEN url ~ '/blog-pieces-auto/conseils/[^/]+$' THEN 'R3'
              WHEN url ~ '/constructeurs/[^/]+/[^/]+/[^/]+\.html$' THEN 'R8' END AS role,
         url, h1_text, title_text
    FROM __seo_snapshot_synthetic
   WHERE created_at > now() - interval '7 days' AND http_code = 200
     AND url ~ '^https://www\.automecanik\.com/(pieces/[^/]+\.html|blog-pieces-auto/conseils/[^/]+|constructeurs/[^/]+/[^/]+/[^/]+\.html)$'
   ORDER BY url, created_at DESC)
SELECT role, 'crawl_h1' AS source, regexp_replace(regexp_replace(h1_text, '<[^>]+>', '', 'g'), '[\t\n]+', ' ', 'g') FROM crawl WHERE h1_text IS NOT NULL
UNION ALL SELECT role, 'crawl_titre', regexp_replace(title_text, '[\t\n]+', ' ', 'g') FROM crawl WHERE title_text IS NOT NULL
UNION ALL SELECT 'R1', 'sg_h1', sg_h1 FROM __seo_gamme WHERE coalesce(sg_h1,'') <> ''
UNION ALL SELECT 'R1', 'sg_title', sg_title FROM __seo_gamme WHERE coalesce(sg_title,'') <> ''
UNION ALL SELECT 'R3', 'ba_h1', ba_h1 FROM __blog_advice WHERE coalesce(ba_h1,'') <> ''
UNION ALL SELECT 'R3', 'ba_title', ba_title FROM __blog_advice WHERE coalesce(ba_title,'') <> ''
UNION ALL SELECT 'R8', 'r8_h1', h1 FROM __seo_r8_pages WHERE coalesce(h1,'') <> ''
UNION ALL SELECT 'R8', 'r8_meta_title', meta_title FROM __seo_r8_pages WHERE coalesce(meta_title,'') <> '';
