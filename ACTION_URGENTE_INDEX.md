# ⚡ FIX URGENT - Page pièces timeout

**Problème**: Page `pieces/plaquette-de-frein-402/audi-22/...` timeout après 8 secondes

**Cause**: Requête SQL sur `pieces_relation_type` trop lente (pas d'index)

---

## 🚀 SOLUTION EN 2 MINUTES

### 1. Ouvrir Supabase SQL Editor
```
https://supabase.com/dashboard/project/[VOTRE_PROJECT]/sql
```

### 2. Copier-coller ce SQL
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_relation_type_type_id_composite
ON pieces_relation_type (rtp_type_id, rtp_pg_id);

ANALYZE pieces_relation_type;
```

### 3. Cliquer "Run" (▶️)

**Temps d'exécution**: ~1-2 minutes (CONCURRENTLY = pas de blocage des autres requêtes)

---

## ✅ RÉSULTAT ATTENDU

**Avant**: 
```
SELECT ... FROM pieces_relation_type WHERE rtp_type_id = 59247
→ 8+ secondes → TIMEOUT ❌
```

**Après**:
```
SELECT ... FROM pieces_relation_type WHERE rtp_type_id = 59247
→ <100ms → SUCCESS ✅
```

---

## 🧪 TEST APRÈS CRÉATION

1. **Recharger la page** :
   ```
   pieces/plaquette-de-frein-402/audi-22/a3-ii-sportback-22035/1-2-tfsi-59247-59247.html
   ```

2. **La page devrait charger en <2 secondes** au lieu de timeout

3. **Le bouton "Ajouter au panier" sera visible et fonctionnel**

---

## 📊 VÉRIFICATION

Dans Supabase SQL Editor :
```sql
-- Vérifier que l'index existe
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'pieces_relation_type' 
  AND indexname LIKE '%type_id%';

-- Tester la vitesse
EXPLAIN ANALYZE 
SELECT rtp_pg_id, rtp_piece_id, rtp_pm_id 
FROM pieces_relation_type 
WHERE rtp_type_id = 59247
LIMIT 10000;
```

Vous devriez voir :
```
Execution Time: 50-100 ms  ← Au lieu de 8000+ ms
Index Scan using idx_pieces_relation_type_type_id_composite
```

---

## 🎯 PRIORITÉ

**CRITIQUE** - Sans cet index, TOUTES les pages de pièces sont inutilisables.

**Fichier SQL prêt**: `backend/fix-timeout-index.sql`

---

**Action immédiate**: Ouvrir Supabase et exécuter le SQL
