# 🚀 CORRECTION DU TIMEOUT POSTGRESQL
**Date**: 30 septembre 2025  
**Problème**: Requêtes SQL sur `pieces_relation_type` qui timeout (8+ secondes)

---

## 🔍 DIAGNOSTIC

### Erreur observée
```
[Nest] 661989 - 09/30/2025, 10:30:02 PM ERROR
❌ [RELATIONS] Erreur type_id 59247: canceling statement due to statement timeout
```

### Cause racine
La requête suivante est trop lente :
```sql
SELECT rtp_pg_id, rtp_piece_id, rtp_pm_id 
FROM pieces_relation_type 
WHERE rtp_type_id = 59247
```

**Problème**: Pas d'index optimisé sur `rtp_type_id`

---

## 🛠️ SOLUTIONS

### Solution 1: Ajouter un index composite (RECOMMANDÉ)
```sql
-- Index composite pour optimiser les requêtes par type_id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_relation_type_type_id_composite
ON pieces_relation_type (rtp_type_id, rtp_pg_id, rtp_piece_id)
WHERE rtp_type_id IS NOT NULL;

-- Analyser la table après création d'index
ANALYZE pieces_relation_type;
```

**Impact attendu**: Requête de 8s → **<100ms**

---

### Solution 2: Limiter les résultats dans le code

Modifier `vehicle-filtered-catalog-v4-hybrid.service.ts` :

```typescript
private async getCompleteRelations(typeId: number): Promise<any[]> {
  try {
    const { data: relationData, error } = await this.supabase
      .from('pieces_relation_type')
      .select('rtp_pg_id, rtp_piece_id, rtp_pm_id')
      .eq('rtp_type_id', typeId)
      .limit(10000)  // 🔥 AJOUT: Limiter à 10k relations max
      .order('rtp_pg_id');  // 🔥 AJOUT: Ordre pour cohérence

    if (error) throw error;
    
    // 🔥 AJOUT: Log si limite atteinte
    if (relationData && relationData.length === 10000) {
      this.logger.warn(`⚠️ [RELATIONS] Limite 10k atteinte pour type_id ${typeId}`);
    }
    
    return relationData || [];
  } catch (error: any) {
    this.logger.error(`❌ [RELATIONS] Erreur type_id ${typeId}: ${error.message}`);
    throw error;
  }
}
```

---

### Solution 3: Augmenter le timeout PostgreSQL (TEMPORAIRE)

Dans Supabase :
```sql
-- Augmenter temporairement le statement_timeout (par session)
SET statement_timeout = '30s';
```

Ou dans le code NestJS :
```typescript
// Dans database.module.ts
const client = await this.supabase.rpc('set_statement_timeout', { timeout_ms: 30000 });
```

⚠️ **Attention**: Ce n'est qu'un pansement, l'index est la vraie solution.

---

## ⚡ ACTIONS IMMÉDIATES

### 1. Créer l'index (5 minutes)
```bash
# Se connecter à Supabase
psql "postgresql://postgres:[password]@[host]:5432/postgres"

# Créer l'index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_relation_type_type_id_composite
ON pieces_relation_type (rtp_type_id, rtp_pg_id);

# Analyser
ANALYZE pieces_relation_type;

# Vérifier
EXPLAIN ANALYZE 
SELECT rtp_pg_id, rtp_piece_id, rtp_pm_id 
FROM pieces_relation_type 
WHERE rtp_type_id = 59247;
```

### 2. Ajouter la limite de sécurité (code)
Voir Solution 2 ci-dessus

### 3. Monitorer les performances
```typescript
// Ajouter des métriques dans le service
this.logger.log(`📊 [RELATIONS] type_id ${typeId}: ${relationData.length} relations en ${Date.now() - start}ms`);
```

---

## 📊 STATISTIQUES DE LA TABLE

Pour vérifier la taille de la table :
```sql
-- Nombre de lignes
SELECT COUNT(*) FROM pieces_relation_type;

-- Taille de la table
SELECT pg_size_pretty(pg_total_relation_size('pieces_relation_type'));

-- Distribution par type_id (top 10)
SELECT rtp_type_id, COUNT(*) as relations_count
FROM pieces_relation_type
GROUP BY rtp_type_id
ORDER BY relations_count DESC
LIMIT 10;

-- Index existants
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'pieces_relation_type';
```

---

## 🎯 RÉSULTAT ATTENDU

**Avant** (sans index):
- 🐌 8+ secondes → Timeout
- ❌ Erreur 500 sur les pages véhicules

**Après** (avec index):
- ⚡ <100ms
- ✅ Pages véhicules fonctionnelles
- 🚀 Cache efficace

---

## 🔒 PRÉVENTION

### Monitoring à mettre en place
1. Alertes sur requêtes >1s
2. Logs des timeouts PostgreSQL
3. Métriques de cache hit/miss

### Best practices
1. Toujours créer des index sur les colonnes WHERE
2. Limiter les résultats (LIMIT)
3. Utiliser le cache agressivement
4. Monitorer les plans d'exécution (EXPLAIN)

---

**Priorité**: 🔥 CRITIQUE  
**Impact**: Pages véhicules inaccessibles  
**Fix estimé**: 10 minutes (index) + 5 minutes (code)
