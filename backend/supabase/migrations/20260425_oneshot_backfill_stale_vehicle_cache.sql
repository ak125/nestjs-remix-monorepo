-- Migration : backfill one-shot des rows stale dans __vehicle_page_cache
--
-- INC-2026-007 — Étape 2 du plan
--
-- Contexte : 28 252 rows sur 28 505 sont marquées stale=true depuis le 23/04
-- (script catalog_gamme_dedup_20260423) sans qu'aucun cron de refresh ne soit schedulé.
-- Ce backfill rattrape la dette en deux jobs auto-déprogrammés :
--   - vehicle_cache_oneshot_backfill : rebuild 200 rows par minute via refresh_stale_vehicle_cache
--   - vehicle_cache_oneshot_watcher : surveille stale_count et unschedule les deux jobs à 0
--
-- Estimation durée : avec p50=405ms par rebuild post-Étape 1 (mesuré stress test 50 types),
--   200 rows × 0.4s = 80s par batch. Schedule chaque minute → batch ne déborde pas.
--   28252 / 200 = 141 ticks de 60s = ~2h20 total.
--
-- Ce job est éphémère : auto-déprogrammé dès que stale_count = 0. Pas un cron permanent
-- (qui serait du bricolage). Le pattern long-terme = trigger auto_type Étape 3 + garde-fou
-- mark_stale_with_followup_rebuild Étape 4.

-- 1. Job principal : rebuild incremental
SELECT cron.schedule(
  'vehicle_cache_oneshot_backfill',
  '* * * * *',
  $$SELECT public.refresh_stale_vehicle_cache(200)$$
);

-- 2. Watcher : auto-unschedule des deux jobs quand stale_count = 0
SELECT cron.schedule(
  'vehicle_cache_oneshot_watcher',
  '*/2 * * * *',
  $watcher$
  DO $$
  BEGIN
    IF (SELECT COUNT(*) FROM public.__vehicle_page_cache WHERE stale=true) = 0 THEN
      PERFORM cron.unschedule('vehicle_cache_oneshot_backfill');
      PERFORM cron.unschedule('vehicle_cache_oneshot_watcher');
      RAISE NOTICE 'INC-2026-007: vehicle cache backfill complete, jobs unscheduled';
    END IF;
  END $$;
  $watcher$
);

-- Vérification : les 2 jobs sont bien créés
DO $$
DECLARE
  n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM cron.job WHERE jobname IN ('vehicle_cache_oneshot_backfill', 'vehicle_cache_oneshot_watcher');
  IF n != 2 THEN
    RAISE EXCEPTION 'Expected 2 cron jobs created, got %', n;
  END IF;
  RAISE NOTICE 'INC-2026-007: 2 cron jobs scheduled, will auto-unschedule on stale_count=0';
END $$;
