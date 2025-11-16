-- ========================================
-- PHASE 2: VUE MATÉRIALISÉE + CRON
-- ========================================
-- Cache haute performance pour optimisation long terme
-- Performance: 1-2s → 5-10ms par requête (200x amélioration)
-- Taille: 50-100 MB vs 12 GB table originale (99% réduction)
-- Maintenance: Refresh automatique nocturne via pg_cron
-- ========================================

-- 1. Activer l'extension pg_cron si pas déjà fait
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Créer la vue matérialisée pré-calculée
-- Agrège les 146M lignes en ~500K lignes (type_id, pg_id, nombre pièces)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_vehicle_compatible_gammes AS
SELECT 
  rtp_type_id as type_id,
  rtp_pg_id as pg_id,
  COUNT(DISTINCT rtp_piece_id) as pieces_count,
  NOW() as last_updated
FROM pieces_relation_type
WHERE rtp_pg_id IS NOT NULL  -- Exclure les relations invalides
GROUP BY rtp_type_id, rtp_pg_id;

-- 3. Créer l'index unique pour REFRESH CONCURRENTLY (CRITIQUE)
-- Sans cet index, REFRESH CONCURRENTLY échoue et lock la table
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_vehicle_gammes_pk 
ON mv_vehicle_compatible_gammes (type_id, pg_id);

-- 4. Créer un index secondaire pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_mv_vehicle_gammes_type 
ON mv_vehicle_compatible_gammes (type_id) 
INCLUDE (pg_id, pieces_count);

-- 5. Créer la table de logs pour monitoring
CREATE TABLE IF NOT EXISTS mv_refresh_log (
  id SERIAL PRIMARY KEY,
  view_name VARCHAR(255) NOT NULL,
  refresh_started_at TIMESTAMP DEFAULT NOW(),
  refresh_completed_at TIMESTAMP,
  rows_affected INTEGER,
  duration_seconds INTEGER,
  status VARCHAR(50), -- 'SUCCESS', 'FAILED', 'IN_PROGRESS'
  error_message TEXT
);

-- 6. Créer la fonction de refresh avec logging
CREATE OR REPLACE FUNCTION refresh_vehicle_compatible_gammes()
RETURNS void AS $$
DECLARE
  v_start_time TIMESTAMP;
  v_end_time TIMESTAMP;
  v_rows_count INTEGER;
  v_log_id INTEGER;
BEGIN
  -- Démarrer le log
  INSERT INTO mv_refresh_log (view_name, status)
  VALUES ('mv_vehicle_compatible_gammes', 'IN_PROGRESS')
  RETURNING id INTO v_log_id;

  v_start_time := clock_timestamp();

  -- Refresh CONCURRENTLY pour ne pas bloquer les lectures
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_vehicle_compatible_gammes;

  v_end_time := clock_timestamp();

  -- Compter les lignes
  SELECT COUNT(*) INTO v_rows_count FROM mv_vehicle_compatible_gammes;

  -- Mettre à jour le log avec succès
  UPDATE mv_refresh_log 
  SET 
    refresh_completed_at = v_end_time,
    rows_affected = v_rows_count,
    duration_seconds = EXTRACT(EPOCH FROM (v_end_time - v_start_time))::INTEGER,
    status = 'SUCCESS'
  WHERE id = v_log_id;

  RAISE NOTICE 'Vue matérialisée refreshed: % lignes en % secondes', 
    v_rows_count, 
    EXTRACT(EPOCH FROM (v_end_time - v_start_time))::INTEGER;

EXCEPTION WHEN OTHERS THEN
  -- Logger l'erreur
  UPDATE mv_refresh_log 
  SET 
    refresh_completed_at = clock_timestamp(),
    status = 'FAILED',
    error_message = SQLERRM
  WHERE id = v_log_id;

  RAISE WARNING 'Erreur refresh vue matérialisée: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- 7. Planifier le refresh automatique chaque nuit à 2h du matin
-- IMPORTANT: Vérifier que pg_cron est configuré dans Supabase
SELECT cron.schedule(
  'refresh-vehicle-gammes',  -- Job name
  '0 2 * * *',               -- Cron expression: tous les jours à 2h
  $$ SELECT refresh_vehicle_compatible_gammes(); $$
);

-- 8. Vérifier les jobs CRON configurés
SELECT * FROM cron.job WHERE jobname = 'refresh-vehicle-gammes';

-- 9. Vérifier la taille de la vue
SELECT 
    schemaname,
    matviewname,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) as total_size,
    (SELECT COUNT(*) FROM mv_vehicle_compatible_gammes) as row_count,
    (SELECT last_updated FROM mv_vehicle_compatible_gammes LIMIT 1) as last_refresh
FROM pg_matviews 
WHERE matviewname = 'mv_vehicle_compatible_gammes';

-- 10. Test de performance (remplacer 30764 par un type_id réel)
EXPLAIN ANALYZE
SELECT pg_id, pieces_count
FROM mv_vehicle_compatible_gammes
WHERE type_id = 30764;

-- Résultat attendu:
-- Execution Time: 5-10 ms (vs 1000-2000 ms avec index seul)
-- Planning Time: < 1 ms
-- Index Scan using idx_mv_vehicle_gammes_pk

-- 11. Voir l'historique des refreshs
SELECT 
  view_name,
  refresh_started_at,
  refresh_completed_at,
  duration_seconds,
  rows_affected,
  status,
  error_message
FROM mv_refresh_log
ORDER BY refresh_started_at DESC
LIMIT 10;

-- ========================================
-- NOTES IMPORTANTES
-- ========================================
-- 1. Le premier refresh peut prendre 20-30 minutes sur 146M lignes
--    Lancer manuellement: SELECT refresh_vehicle_compatible_gammes();
--
-- 2. REFRESH CONCURRENTLY nécessite l'index unique idx_mv_vehicle_gammes_pk
--    Sinon erreur: "cannot refresh materialized view concurrently"
--
-- 3. Données potentiellement stales (délai max 24h jusqu'au prochain refresh)
--    Solution: Logique fallback backend vers table originale si données > 24h
--
-- 4. Si pg_cron non disponible sur Supabase, utiliser externe:
--    - Supabase Edge Function déclenchée par cron externe
--    - GitHub Actions avec schedule
--    - Vercel Cron Jobs
--
-- 5. Monitoring recommandé:
--    - Alertes si status='FAILED' dans mv_refresh_log
--    - Alertes si last_updated > 24h
--    - Dashboard Grafana pour visualiser duration_seconds
-- ========================================
