-- ========================================
-- PHASE 2: VUE MATÉRIALISÉE + CRON
-- ========================================
-- Cache haute performance (5-10ms par requête)
-- Compression: 12 GB → 50-100 MB
-- Refresh: CRON nocturne à 2h du matin
-- Nécessite: Index Phase 1 déjà créé
-- ========================================

-- 1. Créer la vue matérialisée
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_vehicle_compatible_gammes AS
SELECT 
  rtp_type_id as type_id,
  rtp_pg_id as pg_id,
  COUNT(DISTINCT rtp_piece_id) as pieces_count,
  NOW() as last_updated
FROM pieces_relation_type
WHERE rtp_pg_id IS NOT NULL
GROUP BY rtp_type_id, rtp_pg_id;

-- 2. Créer l'index unique (OBLIGATOIRE pour REFRESH CONCURRENTLY)
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_vehicle_gammes_pk 
ON mv_vehicle_compatible_gammes (type_id, pg_id);

-- 3. Créer l'index sur la date de mise à jour (pour monitoring)
CREATE INDEX IF NOT EXISTS idx_mv_vehicle_gammes_updated
ON mv_vehicle_compatible_gammes (last_updated);

-- 4. Activer l'extension pg_cron si pas déjà fait
-- NOTE: Sur Supabase, pg_cron est déjà activé par défaut
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 5. Configurer le refresh automatique nocturne (2h du matin UTC)
-- CONCURRENTLY = pas de lock, lecture continue pendant le refresh
SELECT cron.schedule(
  'refresh-vehicle-compatible-gammes',
  '0 2 * * *', -- Tous les jours à 2h du matin
  $$ REFRESH MATERIALIZED VIEW CONCURRENTLY mv_vehicle_compatible_gammes $$
);

-- 6. Créer une table de logs pour monitoring (optionnel mais recommandé)
CREATE TABLE IF NOT EXISTS mv_refresh_log (
  id SERIAL PRIMARY KEY,
  view_name VARCHAR(255) NOT NULL,
  refresh_started_at TIMESTAMPTZ DEFAULT NOW(),
  refresh_completed_at TIMESTAMPTZ,
  rows_affected INTEGER,
  success BOOLEAN,
  error_message TEXT
);

-- 7. Fonction de refresh avec logs (alternative au CRON simple)
CREATE OR REPLACE FUNCTION refresh_vehicle_gammes_with_log()
RETURNS VOID AS $$
DECLARE
  v_start_time TIMESTAMPTZ;
  v_rows_affected INTEGER;
BEGIN
  v_start_time := NOW();
  
  -- Insérer le log de démarrage
  INSERT INTO mv_refresh_log (view_name, refresh_started_at, success)
  VALUES ('mv_vehicle_compatible_gammes', v_start_time, FALSE);
  
  -- Refresh la vue
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_vehicle_compatible_gammes;
  
  -- Compter les lignes
  SELECT COUNT(*) INTO v_rows_affected FROM mv_vehicle_compatible_gammes;
  
  -- Mettre à jour le log de succès
  UPDATE mv_refresh_log
  SET refresh_completed_at = NOW(),
      rows_affected = v_rows_affected,
      success = TRUE
  WHERE view_name = 'mv_vehicle_compatible_gammes'
  AND refresh_started_at = v_start_time;
  
EXCEPTION WHEN OTHERS THEN
  -- Logger l'erreur
  UPDATE mv_refresh_log
  SET refresh_completed_at = NOW(),
      success = FALSE,
      error_message = SQLERRM
  WHERE view_name = 'mv_vehicle_compatible_gammes'
  AND refresh_started_at = v_start_time;
  
  RAISE;
END;
$$ LANGUAGE plpgsql;

-- 8. Remplacer le CRON simple par la version avec logs (optionnel)
-- SELECT cron.unschedule('refresh-vehicle-compatible-gammes');
-- SELECT cron.schedule(
--   'refresh-vehicle-compatible-gammes-logged',
--   '0 2 * * *',
--   $$ SELECT refresh_vehicle_gammes_with_log() $$
-- );

-- ========================================
-- VÉRIFICATIONS ET TESTS
-- ========================================

-- Vérifier la taille de la vue
SELECT 
  pg_size_pretty(pg_total_relation_size('mv_vehicle_compatible_gammes')) as total_size,
  pg_size_pretty(pg_relation_size('mv_vehicle_compatible_gammes')) as data_size,
  pg_size_pretty(pg_indexes_size('mv_vehicle_compatible_gammes')) as indexes_size;

-- Compter les lignes (devrait être ~500K au lieu de 146M)
SELECT COUNT(*) as total_rows FROM mv_vehicle_compatible_gammes;

-- Vérifier la fraîcheur des données
SELECT 
  MAX(last_updated) as derniere_maj,
  NOW() - MAX(last_updated) as anciennete
FROM mv_vehicle_compatible_gammes;

-- Test de performance (remplacer 30764 par un type_id réel)
EXPLAIN ANALYZE
SELECT pg_id, pieces_count
FROM mv_vehicle_compatible_gammes
WHERE type_id = 30764;

-- Résultat attendu:
-- Execution Time: 5-10 ms (vs 1000-2000 ms avec index simple)
-- Index Scan using idx_mv_vehicle_gammes_pk

-- Vérifier les jobs CRON configurés
SELECT * FROM cron.job WHERE jobname LIKE '%vehicle%';

-- Vérifier l'historique des refresh (si fonction avec logs utilisée)
SELECT * FROM mv_refresh_log 
WHERE view_name = 'mv_vehicle_compatible_gammes'
ORDER BY refresh_started_at DESC
LIMIT 10;

-- ========================================
-- ROLLBACK (si nécessaire)
-- ========================================

-- Désactiver le CRON
-- SELECT cron.unschedule('refresh-vehicle-compatible-gammes');

-- Supprimer la vue et ses index
-- DROP MATERIALIZED VIEW IF EXISTS mv_vehicle_compatible_gammes CASCADE;

-- Supprimer la table de logs
-- DROP TABLE IF EXISTS mv_refresh_log CASCADE;

-- Supprimer la fonction
-- DROP FUNCTION IF EXISTS refresh_vehicle_gammes_with_log() CASCADE;
