# ✅ Implémentation Cache Redis - Résolution timeouts ETIMEDOUT

## 🎯 Objectif
Éliminer les timeouts Supabase en cachant les requêtes lentes dans Redis

## 📋 Changements effectués

### 1. **Amélioration RedisCacheService** ✅
**Fichier**: `backend/src/database/services/redis-cache.service.ts`

**Nouvelles méthodes** :
```typescript
// Méthode générique de cache wrapper
async cached<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  ttl: number = 3600,
  namespace: string = 'app',
): Promise<T>

// Statistiques enrichies
async getCacheStats(): Promise<{ hits, misses, hitRate, memory, keyCount }>

// Invalidation par namespace
async invalidateNamespace(namespace: string): Promise<number>
```

**Bénéfices** :
- ✅ Logs détaillés avec timing (Cache HIT/MISS + durée)
- ✅ Namespace pour organisation (catalog:*, blog:*, auth:*)
- ✅ Fallback gracieux si Redis échoue

### 2. **Cache CatalogFamilyService** ✅
**Fichier**: `backend/src/modules/catalog/services/catalog-family.service.ts`

**Avant** (timeout fréquent) :
```typescript
async getCatalogFamiliesPhpLogic(): Promise<CatalogFamiliesResponse> {
  // Requête directe Supabase avec jointures complexes
  const { data, error } = await this.supabase.from('pieces_gamme')...
}
```

**Après** (cache 1h) :
```typescript
async getCatalogFamiliesPhpLogic(): Promise<CatalogFamiliesResponse> {
  return this.cacheService.cached(
    'families:php-logic',
    () => this.fetchCatalogFamiliesPhpLogic(),
    3600, // 1 heure
    'catalog',
  );
}
```

**Clé Redis** : `catalog:families:php-logic`
**TTL** : 3600s (1 heure)

**Bénéfices** :
- ✅ **Première requête** : 10-30s (Supabase lent)
- ✅ **Requêtes suivantes** : < 10ms (Redis cache HIT)
- ✅ **Taux de réussite attendu** : > 99%

### 3. **Amélioration executeWithRetry** ✅
**Fichier**: `backend/src/database/services/supabase-base.service.ts`

**Détection erreurs** :
```typescript
const isTimeoutError =
  error?.code === 'ETIMEDOUT' ||
  error?.errno === 'ETIMEDOUT' ||
  error?.type === 'system' ||
  error?.message?.includes('ETIMEDOUT') ||
  error?.message?.includes('timeout');

const isNetworkError =
  error?.code === 'ECONNRESET' ||
  error?.code === 'ECONNREFUSED' ||
  error?.code === 'ENOTFOUND';
```

**Retry automatique** :
- 3 tentatives avec exponential backoff
- Délais : 1s → 2s → 4s → max 10s
- Logs détaillés : `⚠️ TIMEOUT error... tentative 2/3`

## 🚀 Impact attendu

### Avant
```
❌ ETIMEDOUT après 10-30s
❌ Taux échec : 30-50%
❌ UX dégradée
```

### Après
```
✅ Cache HIT < 10ms (99% des cas)
✅ Cache MISS + retry : succès après 2-3 tentatives
✅ Taux succès : > 99%
```

## 📊 Monitoring

### Logs à surveiller

**Cache HIT** (succès) :
```
✅ Cache HIT: catalog:families:php-logic (8ms)
```

**Cache MISS** (première fois ou après expiration) :
```
🔍 Cache MISS: catalog:families:php-logic
💾 Cached: catalog:families:php-logic (fetch: 15432ms, TTL: 3600s)
```

**Timeout avec retry** :
```
⚠️ TIMEOUT error lors de getCatalogFamilies (tentative 1/3): ETIMEDOUT
⏳ Attente de 1000ms avant nouvelle tentative...
✅ Succès après retry 2
```

### Commandes de diagnostic

```bash
# 1. Voir les logs du backend
tail -f logs/nestjs.log | grep -E "Cache|TIMEOUT"

# 2. Stats Redis
redis-cli INFO stats | grep -E "hits|misses"
redis-cli DBSIZE

# 3. Voir les clés cachées
redis-cli KEYS "catalog:*"
redis-cli KEYS "blog:*"

# 4. Inspecter une clé
redis-cli GET "catalog:families:php-logic"
redis-cli TTL "catalog:families:php-logic"

# 5. Vider le cache d'un namespace
redis-cli KEYS "catalog:*" | xargs redis-cli DEL
```

### API Stats

**Endpoint** : `GET /api/cache/stats`
```json
{
  "connected": true,
  "keyCount": 15,
  "memory": "2.5M",
  "hits": 1523,
  "misses": 24,
  "hitRate": 98.45,
  "timestamp": "2025-11-10T21:30:00Z"
}
```

## 🧪 Tests

### 1. Test Cache CatalogFamilies

```bash
# Terminal 1 : Démarrer backend
cd backend
npm run start:dev

# Terminal 2 : Tester l'endpoint
time curl -s http://localhost:3000/api/catalog/families | jq '.families | length'

# Première fois (Cache MISS) : ~10-30s
# Deuxième fois (Cache HIT) : < 0.5s
```

**Logs attendus** :
```
[CatalogFamilyService] 🔍 Cache MISS: catalog:families:php-logic
[CatalogFamilyService] Récupération des familles de catalogue (logique PHP)...
[CatalogFamilyService] 19 familles trouvées
[CatalogFamilyService] 💾 Cached: catalog:families:php-logic (fetch: 15234ms, TTL: 3600s)

# Requête suivante :
[CatalogFamilyService] ✅ Cache HIT: catalog:families:php-logic (7ms)
```

### 2. Test Invalidation Cache

```bash
# Invalider le cache catalog
curl -X POST http://localhost:3000/api/cache/invalidate/catalog

# Logs attendus :
# 🗑️ 5 clés supprimées pour namespace: catalog
```

### 3. Test Timeout Retry

```bash
# Simuler un timeout en coupant le réseau temporairement
# puis observer les retry automatiques dans les logs

# Logs attendus :
⚠️ TIMEOUT error lors de getCatalogFamilies (tentative 1/3): ETIMEDOUT
⏳ Attente de 1000ms avant nouvelle tentative...
⚠️ TIMEOUT error lors de getCatalogFamilies (tentative 2/3): ETIMEDOUT
⏳ Attente de 2000ms avant nouvelle tentative...
✅ Succès après 3 tentatives
```

## 🎯 Prochaines étapes

### Phase 2 : Cache autres services (30 min)
- [ ] Blog articles : `blog:articles:*` (TTL: 30min)
- [ ] Auth user lookup : `auth:user:*` (TTL: 5min)
- [ ] Équipementiers : `catalog:equipementiers` (TTL: 2h)

### Phase 3 : Optimisations avancées (1h)
- [ ] Cache warming (rafraîchir avant expiration)
- [ ] Compression des valeurs cachées (gzip)
- [ ] Métriques Grafana + alertes
- [ ] Documentation pattern d'invalidation

### Phase 4 : Production (2h)
- [ ] Variables d'environnement Redis
- [ ] Monitoring APM (New Relic/Datadog)
- [ ] Load testing avec Artillery
- [ ] Documentation ops

## 📚 Ressources

- [Documentation Redis](https://redis.io/docs/)
- [NestJS Caching](https://docs.nestjs.com/techniques/caching)
- [Cache Strategies](https://aws.amazon.com/caching/best-practices/)

## 💡 Tips

### Invalider le cache après modification
```typescript
// Après création/modification d'une famille
await this.cacheService.invalidateNamespace('catalog');
```

### Ajuster TTL selon usage
```typescript
// Données statiques (marques, catégories) : 24h
ttl: 86400

// Données dynamiques (stock, prix) : 5min
ttl: 300

// Données ultra-dynamiques (panier, session) : 1min
ttl: 60
```

### Cache par variante
```typescript
// Différencier par langue, devise, etc.
const cacheKey = `families:${lang}:${currency}`;
```

## 🔧 Troubleshooting

### Cache ne fonctionne pas
```bash
# Vérifier Redis
redis-cli PING  # Doit répondre PONG

# Vérifier connexion NestJS
grep "Redis connecté" logs/nestjs.log

# Variables d'environnement
echo $REDIS_HOST $REDIS_PORT
```

### Trop de Cache MISS
```bash
# Vérifier TTL
redis-cli TTL "catalog:families:php-logic"

# Augmenter le TTL si nécessaire
# backend/src/modules/catalog/services/catalog-family.service.ts
ttl: 7200 // 2 heures au lieu de 1h
```

### Mémoire Redis pleine
```bash
# Vérifier l'usage mémoire
redis-cli INFO memory

# Vider le cache si nécessaire
redis-cli FLUSHALL

# Configurer maxmemory et eviction policy
redis-cli CONFIG SET maxmemory 256mb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```
