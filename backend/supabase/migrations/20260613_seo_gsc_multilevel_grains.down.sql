-- Rollback: 20260613_seo_gsc_multilevel_grains.sql
-- Réversible : les 3 tables sont neuves (aucune donnée applicative perdue à la
-- création). DROP CASCADE retire les partitions mensuelles attachées.
-- Pas de BEGIN/COMMIT explicite (squawk assume_in_transaction=true).

-- Déplanifier le cron (idempotent : ignore si absent).
SELECT cron.unschedule('seo-ensure-monthly-partitions')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'seo-ensure-monthly-partitions');

-- La fonction couvre aussi l'existant ; on la retire (les partitions déjà créées
-- restent — non destructif).
DROP FUNCTION IF EXISTS __seo_ensure_monthly_partitions(INT);

-- Tables neuves de PR1 (CASCADE = partitions enfants).
DROP TABLE IF EXISTS __seo_gsc_daily_pages CASCADE;
DROP TABLE IF EXISTS __seo_gsc_daily_totals CASCADE;
DROP TABLE IF EXISTS __seo_gsc_daily_property_total CASCADE;
