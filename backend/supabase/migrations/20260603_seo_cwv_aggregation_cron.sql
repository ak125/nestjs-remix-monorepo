-- Migration : pg_cron pour l'agrégation CWV RUM (raw → hourly → daily_rum).
--
-- PROBLÈME (mesuré 2026-06-03, audit runtime-truth Phase 0) :
--   __seo_cwv_raw afflue en continu (beacon sur PROD), mais __seo_cwv_hourly /
--   __seo_cwv_daily_rum sont FIGÉS depuis 2026-06-01 13:00 → 48 h / 2022
--   échantillons humains non agrégés, à risque de purge (raw TTL ~48 h).
--
-- CAUSE RACINE (architecturale, pas une valeur de flag) :
--   L'agrégation était un job répétable BullMQ dans le PROCESS WORKER
--   (CwvAggregationSchedulerService, workers/worker.module.ts), gardé par
--   SEO_CWV_AGGREGATION_ENABLED — flag à 'true' UNIQUEMENT dans backend/.env
--   (DEV). Le worker DEV est mort + DEV est un poste opérateur, pas un host
--   runtime (deployment.md). Une chaîne de données PROD ne doit pas dépendre
--   du poste DEV. Le bloc 20260527 a déjà mis les rotations de partitions sous
--   pg_cron mais PAS l'agrégation elle-même — ce trou est comblé ici.
--
-- SOLUTION (robuste, découplée de l'app) :
--   Planifier les RPC VOLATILE existantes aggregate_cwv_hourly() /
--   aggregate_cwv_daily_rum() directement via pg_cron, là où vit la donnée.
--   Toujours-actif, survit aux restarts/déploiements, zéro dépendance
--   worker/flag/DEV. Pattern IDENTIQUE aux cron déjà dans 20260527
--   (cwv-hourly-rotation, cwv-daily-rum-rotation) : cron.schedule + WHERE NOT
--   EXISTS idempotent.
--
-- AUTO-HEAL : l'hourly réagrège les 3 dernières heures complètes (pas juste la
--   précédente). Les RPC sont des UPSERT idempotents → réagréger une heure déjà
--   faite est un no-op sûr, et une exécution manquée se rattrape seule au tick
--   suivant tant que le raw n'est pas purgé (TTL 48 h). Robuste contre un tick
--   raté, sans backfill manuel.
--
-- SÉCURITÉ / SCOPE :
--   - Additif pur. Aucune table, aucune RPC modifiée. Réutilise les RPC
--     existantes (20260527) + pg_cron 1.6 déjà actif.
--   - Idempotent : WHERE NOT EXISTS sur cron.job (re-run = no-op).
--   - 100 % réversible (down = cron.unschedule).
--   - Ne touche PAS le worker BullMQ ni le flag SEO_CWV_AGGREGATION_ENABLED.
--     Si un jour le worker tourne sur un vrai runtime, les double-runs restent
--     sûrs (UPSERT idempotent) — mais le SoT d'orchestration devient pg_cron.
--   - N'effectue AUCUN backfill des 48 h déjà en retard : sauvetage = action
--     OWNER séparée (aggregate_cwv_hourly(<h>) sur la fenêtre, avant purge).
--
-- Anti-régression PR #697 : cron ATOMIQUES, idempotents (WHERE NOT EXISTS).
-- Horaires choisis pour NE PAS chevaucher les rotations de partitions
-- (cwv-*-rotation @ 02:55/03:00/03:10) : agrégation à :05 (hourly) et 00:15 (daily).

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- =============================================================================
-- 1. Cron agrégation HORAIRE : toutes les heures à HH:05 UTC.
--    Réagrège les 3 dernières heures complètes (auto-heal d'un tick raté).
--    Exclut l'heure courante (incomplète) : offsets 1, 2, 3 heures.
-- =============================================================================
SELECT cron.schedule(
  'cwv-hourly-aggregation',
  '5 * * * *',
  $cron$
    SELECT public.aggregate_cwv_hourly(date_trunc('hour', now()) - make_interval(hours => h))
    FROM generate_series(1, 3) AS h;
  $cron$
)
WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cwv-hourly-aggregation'
);

-- =============================================================================
-- 2. Cron agrégation JOURNALIÈRE : tous les jours à 00:15 UTC.
--    Réagrège hier + avant-hier (auto-heal). Idempotent (UPSERT).
--    00:15 > toutes les rotations (≤ 03:10) et > l'hourly :05 → l'hourly de la
--    veille a eu le temps de tourner avant le rollup journalier.
-- =============================================================================
SELECT cron.schedule(
  'cwv-daily-rum-aggregation',
  '15 0 * * *',
  $cron$
    SELECT public.aggregate_cwv_daily_rum((now() - make_interval(days => d))::date)
    FROM generate_series(1, 2) AS d;
  $cron$
)
WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cwv-daily-rum-aggregation'
);
