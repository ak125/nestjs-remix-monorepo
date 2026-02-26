-- ============================================================================
-- Purchase Guide v2: backfill source_type from source_uri scheme
-- ============================================================================
-- Objectif:
--   Normaliser sgpg_source_type pour les lignes déjà peuplées via sgpg_source_uri.
--   Cas supportés: pdf, oem, catalog, manual, tech, bulletin, scraping(http/https).
--
-- Date: 2026-02-13
-- ============================================================================

-- pdf://...
UPDATE __seo_gamme_purchase_guide
SET sgpg_source_type = 'pdf'
WHERE (sgpg_source_type IS NULL OR sgpg_source_type = '' OR sgpg_source_type = 'db_manual')
  AND sgpg_source_uri ILIKE 'pdf://%';

-- oem://...
UPDATE __seo_gamme_purchase_guide
SET sgpg_source_type = 'oem'
WHERE (sgpg_source_type IS NULL OR sgpg_source_type = '' OR sgpg_source_type = 'db_manual')
  AND sgpg_source_uri ILIKE 'oem://%';

-- catalog://...
UPDATE __seo_gamme_purchase_guide
SET sgpg_source_type = 'catalog'
WHERE (sgpg_source_type IS NULL OR sgpg_source_type = '' OR sgpg_source_type = 'db_manual')
  AND sgpg_source_uri ILIKE 'catalog://%';

-- manual://...
UPDATE __seo_gamme_purchase_guide
SET sgpg_source_type = 'manual'
WHERE (sgpg_source_type IS NULL OR sgpg_source_type = '' OR sgpg_source_type = 'db_manual')
  AND sgpg_source_uri ILIKE 'manual://%';

-- tech://...
UPDATE __seo_gamme_purchase_guide
SET sgpg_source_type = 'tech'
WHERE (sgpg_source_type IS NULL OR sgpg_source_type = '' OR sgpg_source_type = 'db_manual')
  AND sgpg_source_uri ILIKE 'tech://%';

-- bulletin://...
UPDATE __seo_gamme_purchase_guide
SET sgpg_source_type = 'bulletin'
WHERE (sgpg_source_type IS NULL OR sgpg_source_type = '' OR sgpg_source_type = 'db_manual')
  AND sgpg_source_uri ILIKE 'bulletin://%';

-- scraping URL (http/https)
UPDATE __seo_gamme_purchase_guide
SET sgpg_source_type = 'scraping'
WHERE (sgpg_source_type IS NULL OR sgpg_source_type = '' OR sgpg_source_type = 'db_manual')
  AND (
    sgpg_source_uri ILIKE 'http://%'
    OR sgpg_source_uri ILIKE 'https://%'
    OR sgpg_source_uri ILIKE 'scraping://%'
  );
