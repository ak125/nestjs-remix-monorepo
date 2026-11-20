-- Mandat EN — H1 et titre R2 réellement servis en PROD (crawl synthétique,
-- 48 dernières heures, dernier relevé par URL, statut 200). Lecture seule.
\pset footer off
\pset format unaligned
\pset fieldsep '\t'
SELECT DISTINCT ON (url)
       regexp_replace(url, '^https://www\.automecanik\.com', '') AS url,
       regexp_replace(regexp_replace(h1_text, '<[^>]+>', '', 'g'), '[\t\n]+', ' ', 'g') AS h1_servi,
       regexp_replace(title_text, '[\t\n]+', ' ', 'g') AS titre_servi,
       created_at AS releve_utc
  FROM __seo_snapshot_synthetic
 WHERE created_at > now() - interval '48 hours'
   AND http_code = 200
   AND url ~ '^https://www\.automecanik\.com/pieces/[^/]+/[^/]+/[^/]+/[^/]+\.html$'
 ORDER BY url, created_at DESC;
