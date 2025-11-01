-- =====================================================
-- 🚀 CRÉATION INDEX - ÉTAPE PAR ÉTAPE
-- =====================================================
-- ⚠️ INSTRUCTIONS: Exécuter CHAQUE commande SÉPARÉMENT dans Supabase SQL Editor
-- Ne pas sélectionner tout le script, exécuter ligne par ligne !
-- =====================================================

-- =====================================================
-- ÉTAPE 1: INDEX PRINCIPAL (rtp_type_id, rtp_pg_id)
-- =====================================================
-- ⏱️ Durée estimée: 30-60 secondes
-- 🎯 Impact: Le plus important - validation URLs et sitemap

CREATE INDEX IF NOT EXISTS idx_pieces_relation_type_type_gamme
ON pieces_relation_type (rtp_type_id, rtp_pg_id);

-- ✅ Attendre fin création avant de continuer !
-- Vérifier dans Supabase: "Success. No rows returned"

-- =====================================================
-- ÉTAPE 2: INDEX TYPE_ID SEUL
-- =====================================================
-- ⏱️ Durée estimée: 20-40 secondes
-- 🎯 Impact: Statistiques par type

CREATE INDEX IF NOT EXISTS idx_pieces_relation_type_type_id
ON pieces_relation_type (rtp_type_id);

-- ✅ Attendre fin création avant de continuer !

-- =====================================================
-- ÉTAPE 3: INDEX PG_ID SEUL
-- =====================================================
-- ⏱️ Durée estimée: 20-40 secondes
-- 🎯 Impact: Pages catégories par gamme

CREATE INDEX IF NOT EXISTS idx_pieces_relation_type_pg_id
ON pieces_relation_type (rtp_pg_id);

-- ✅ Attendre fin création avant de continuer !

-- =====================================================
-- ÉTAPE 4: INDEX PM_ID PARTIEL (avec WHERE)
-- =====================================================
-- ⏱️ Durée estimée: 15-30 secondes
-- 🎯 Impact: Calcul qualité données (% avec marque)

CREATE INDEX IF NOT EXISTS idx_pieces_relation_type_pm_id
ON pieces_relation_type (rtp_pm_id) 
WHERE rtp_pm_id IS NOT NULL;

-- ✅ Attendre fin création avant de continuer !

-- =====================================================
-- ÉTAPE 5: INDEX COMPOSITE ÉTENDU (optionnel)
-- =====================================================
-- ⏱️ Durée estimée: 40-80 secondes
-- 🎯 Impact: Requêtes complexes avec piece_id
-- ⚠️ Peut être sauté si timeout - moins critique

CREATE INDEX IF NOT EXISTS idx_pieces_relation_type_composite
ON pieces_relation_type (rtp_type_id, rtp_pg_id, rtp_piece_id);

-- ✅ Attendre fin création avant de continuer !

-- =====================================================
-- ÉTAPE 6: ANALYSER LA TABLE
-- =====================================================
-- ⏱️ Durée estimée: 5-10 secondes
-- 🎯 Met à jour les statistiques PostgreSQL

ANALYZE pieces_relation_type;

-- ✅ Index créés avec succès !

-- =====================================================
-- ÉTAPE 7: VÉRIFICATION
-- =====================================================
-- Afficher tous les index créés avec leur taille

SELECT
  indexrelname AS indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
  idx_scan AS times_used
FROM pg_stat_user_indexes
WHERE relname = 'pieces_relation_type'
ORDER BY pg_relation_size(indexrelid) DESC;

-- ✅ Résultat attendu: 5+ index affichés
-- Les 5 nouveaux index devraient apparaître avec leur taille

-- =====================================================
-- 📊 STATISTIQUES TABLE
-- =====================================================
-- Vérifier l'état de la table après optimisation

SELECT
  schemaname,
  relname AS tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||relname)) AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname) - pg_relation_size(schemaname||'.'||relname)) AS indexes_size,
  n_live_tup AS live_rows
FROM pg_stat_user_tables
WHERE relname = 'pieces_relation_type';

-- =====================================================
-- 🗑️ ROLLBACK (SI NÉCESSAIRE)
-- =====================================================
-- Pour supprimer les index créés (exécuter séparément):

/*
DROP INDEX IF EXISTS idx_pieces_relation_type_type_gamme;
DROP INDEX IF EXISTS idx_pieces_relation_type_type_id;
DROP INDEX IF EXISTS idx_pieces_relation_type_pg_id;
DROP INDEX IF EXISTS idx_pieces_relation_type_pm_id;
DROP INDEX IF EXISTS idx_pieces_relation_type_composite;
*/

-- =====================================================
-- 📝 NOTES IMPORTANTES
-- =====================================================

/*
1. ⚠️ TIMEOUT SUPABASE:
   - Timeout par défaut: 8 secondes dans SQL Editor
   - Timeout statement: 2 minutes pour requêtes normales
   - Si timeout persiste: Contacter support Supabase ou augmenter statement_timeout

2. 🔄 SI TIMEOUT SUR UN INDEX:
   - L'index n'est PAS créé (transaction rollback)
   - Ré-exécuter juste cette commande CREATE INDEX
   - Vérifier avec la requête ÉTAPE 7 si index existe

3. ✅ ORDRE D'IMPORTANCE:
   - CRITIQUE: idx_pieces_relation_type_type_gamme (ÉTAPE 1)
   - IMPORTANT: idx_pieces_relation_type_type_id (ÉTAPE 2)
   - UTILE: idx_pieces_relation_type_pg_id (ÉTAPE 3)
   - BONUS: idx_pieces_relation_type_pm_id (ÉTAPE 4)
   - OPTIONNEL: idx_pieces_relation_type_composite (ÉTAPE 5)

4. 🎯 MINIMUM REQUIS:
   - Au minimum, créer ÉTAPE 1 (idx_pieces_relation_type_type_gamme)
   - Cet index seul apporte 80% des gains de performance

5. 🚀 ALTERNATIVE SI TIMEOUT PERSISTE:
   - Se connecter via psql en direct
   - Utiliser CREATE INDEX CONCURRENTLY
   - Exemple: psql -h HOST -U postgres -d postgres
   - CREATE INDEX CONCURRENTLY idx_pieces_relation_type_type_gamme ON pieces_relation_type (rtp_type_id, rtp_pg_id);

6. 📊 VÉRIFIER UTILISATION APRÈS 1H:
   SELECT indexrelname, idx_scan, idx_tup_read
   FROM pg_stat_user_indexes
   WHERE relname = 'pieces_relation_type'
   ORDER BY idx_scan DESC;
   
   idx_scan > 0 = index utilisé ✅
*/

-- =====================================================
-- ✅ FIN DU SCRIPT
-- =====================================================
