---
title: "cache module"
status: draft
version: 1.0.0
---

# Feature Spec: Cache Module

**Phase**: 3 Extended (Feature 13/18)  
**Coverage**: +1 module → 75% (25/37 modules)  
**Endpoints**: 6 total (clear, stats, warmup, health, invalidate, list keys)  
**Architecture**: CacheService + CacheController  
**Lines**: ~170 (service) + ~150 (controller)

---

## 1. Objectif Métier

Module centralisé de **gestion cache Redis** pour optimisation performance. Fournit API unifiée pour invalidation cache, monitoring, warmup automatique, health checks.

**Business Value**:
- 🚀 Performance (réduction 80% temps réponse APIs fréquentes)
- 📊 Monitoring temps réel (hit rate, memory usage, key count)
- 🧹 Invalidation intelligente (par pattern, par tag, globale)
- 🔥 Warmup automatique (preload données critiques)
- 🏥 Health checks (détection pannes Redis)
- 🎯 TTL intelligent (adapté par type données)

**Use Cases**:
- Admin: clear cache après update config/produits
- DevOps: monitoring Redis (alerts sur memory/hit rate)
- Developers: invalidation ciblée (par module/feature)
- System: warmup au démarrage (données populaires)

---

## 2. Endpoints (6 Total)

### 2.1 GET /api/cache/stats

**Description**: Statistiques globales cache Redis  
**Controller**: `CacheController.getStats()`  
**Service**: `CacheService.getStats()`

**Query Params**: Aucun

**Response Example**:
```json
{
  "success": true,
  "data": {
    "memory": "24.3M",
    "keyCount": 1542,
    "hitRate": "87.3%",
    "uptime": "3d 5h 23m",
    "connected": true,
    "version": "7.0.12"
  },
  "timestamp": "2025-11-15T12:30:45.123Z"
}
```

**Business Logic**:
- Memory: `INFO memory` → `used_memory_human`
- Key count: `DBSIZE` command
- Hit rate: Calculé via `INFO stats` (hits/total requests)
- Uptime: Temps depuis démarrage Redis
- Connected: Status connexion Redis

---

### 2.2 POST /api/cache/clear

**Description**: Clear cache (global ou par pattern)  
**Controller**: `CacheController.clearCache()`  
**Service**: `CacheService.clearByPattern()`

**Body**:
```typescript
{
  pattern?: string;  // Redis pattern (ex: "users:*", "products:*")
  confirm?: boolean; // Required for global clear
}
```

**Response Example** (avec pattern):
```json
{
  "success": true,
  "message": "Cache cleared for pattern: users:*",
  "stats": {
    "keysDeleted": 47,
    "duration": "12ms"
  },
  "timestamp": "2025-11-15T12:31:00.000Z"
}
```

**Response Example** (global clear):
```json
{
  "success": true,
  "message": "Full cache cleared",
  "stats": {
    "keysDeleted": 1542,
    "duration": "156ms"
  },
  "timestamp": "2025-11-15T12:31:00.000Z"
}
```

**Business Logic**:
- Pattern clear: `KEYS pattern` → `DEL keys[]`
- Global clear: `FLUSHDB` (requires `confirm: true`)
- Security: Admin-only endpoint
- Audit log: Log all clear operations

---

### 2.3 POST /api/cache/warmup

**Description**: Warmup cache (preload données critiques)  
**Controller**: `CacheController.warmupCache()`  
**Service**: `CacheService.warmup()`

**Body**:
```typescript
{
  modules?: string[];  // ["products", "users", "vehicles"]
  force?: boolean;     // Force même si cache existe
}
```

**Response Example**:
```json
{
  "success": true,
  "message": "Cache warmup completed",
  "stats": {
    "modulesWarmed": ["products", "users", "vehicles"],
    "keysCreated": 234,
    "duration": "3.2s",
    "errors": 0
  },
  "timestamp": "2025-11-15T12:32:00.000Z"
}
```

**Business Logic**:
- Products: Top 100 produits populaires
- Users: Stats globales (count actifs, count admins)
- Vehicles: Top 20 marques + modèles populaires
- Config: Toutes configs actives
- SEO: Meta-tags homepage + pages principales

---

### 2.4 GET /api/cache/health

**Description**: Health check Redis  
**Controller**: `CacheController.healthCheck()`  
**Service**: `CacheService.healthCheck()`

**Query Params**: Aucun

**Response Example** (healthy):
```json
{
  "status": "healthy",
  "redis": {
    "connected": true,
    "latency": "2ms",
    "memoryUsage": "24.3M",
    "maxMemory": "512M",
    "usagePercent": 4.7
  },
  "timestamp": "2025-11-15T12:33:00.000Z"
}
```

**Response Example** (unhealthy):
```json
{
  "status": "unhealthy",
  "redis": {
    "connected": false,
    "error": "Connection timeout",
    "lastSeen": "2025-11-15T12:25:00.000Z"
  },
  "timestamp": "2025-11-15T12:33:00.000Z"
}
```

**Business Logic**:
- Ping: `PING` command (latency measure)
- Memory: `INFO memory` → usage vs max
- Alert si: latency > 100ms OU memory > 90%
- Status: healthy/degraded/unhealthy

---

### 2.5 DELETE /api/cache/invalidate

**Description**: Invalidation ciblée par key ou pattern  
**Controller**: `CacheController.invalidateCache()`  
**Service**: `CacheService.invalidate()`

**Body**:
```typescript
{
  keys?: string[];      // ["user:123", "product:456"]
  patterns?: string[];  // ["users:*", "products:category:*"]
  tags?: string[];      // ["user-data", "product-catalog"]
}
```

**Response Example**:
```json
{
  "success": true,
  "message": "Cache invalidated",
  "stats": {
    "keysInvalidated": 23,
    "patternsProcessed": 2,
    "tagsProcessed": 1,
    "duration": "45ms"
  },
  "details": {
    "keys": ["user:123", "product:456"],
    "patterns": {
      "users:*": 15,
      "products:category:*": 6
    },
    "tags": {
      "user-data": 2
    }
  },
  "timestamp": "2025-11-15T12:34:00.000Z"
}
```

**Business Logic**:
- Keys: Direct delete (multi `DEL`)
- Patterns: `KEYS pattern` → batch delete
- Tags: Tag-based invalidation (stored in Redis Set)
- Batch operations: Max 1000 keys per call
- Atomic: Transaction pour patterns

---

### 2.6 GET /api/cache/keys

**Description**: Liste clés cache (paginated, avec pattern)  
**Controller**: `CacheController.listKeys()`  
**Service**: `CacheService.listKeys()`

**Query Params**:
- `pattern` (string, default: `*`): Redis pattern
- `limit` (number, default: `100`): Max keys
- `cursor` (string, optional): Pagination cursor

**Response Example**:
```json
{
  "success": true,
  "data": {
    "keys": [
      {
        "key": "users:active:count",
        "type": "string",
        "ttl": 580,
        "size": "12B"
      },
      {
        "key": "products:popular:list",
        "type": "list",
        "ttl": 3545,
        "size": "4.2K"
      }
    ],
    "pagination": {
      "total": 1542,
      "returned": 100,
      "nextCursor": "1234567890",
      "hasMore": true
    }
  },
  "timestamp": "2025-11-15T12:35:00.000Z"
}
```

**Business Logic**:
- SCAN cursor-based (avoid `KEYS *` sur prod)
- Type detection: `TYPE key`
- TTL: `TTL key` (seconds remaining)
- Size estimation: `MEMORY USAGE key` (Redis 4+)
- Pagination: 100 keys per page max

---

## 3. Architecture Service

### 3.1 CacheService - 170 lignes

**Location**: `/backend/src/modules/cache/cache.service.ts`  
**Current Lines**: ~170 lignes

**Méthodes Existantes**:

#### Core Operations
```typescript
async get<T>(key: string): Promise<T | null>
// Récupère valeur cache (JSON parse)
// Log: HIT/MISS

async set<T>(key: string, value: T, ttl?: number): Promise<void>
// Set avec TTL intelligent (JSON stringify)
// TTL auto selon préfixe key

async del(key: string): Promise<void>
// Delete key unique

async delete(key: string): Promise<void>
// Alias de del()
```

#### Pattern Operations
```typescript
async clearByPattern(pattern: string): Promise<void>
// Clear multiple keys by pattern
// Ex: clearByPattern("users:*")

async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T>
// Cache-aside pattern helper
// Get from cache OR fetch + cache
```

#### Stats & Monitoring
```typescript
async getStats(): Promise<{
  memory: string;
  keyCount: number;
  hitRate: string;
}>
// Redis memory info + dbsize

private getSmartTTL(key: string): number
// TTL intelligent selon préfixe:
// - dashboard:stats → 300s (5min)
// - stock:available → 60s (1min)
// - suppliers:list → 1800s (30min)
// - seo:stats → 3600s (1h)
// - default → 300s (5min)

private extractMemoryUsed(info: string): string
// Parse INFO memory response
```

---

### 3.2 Méthodes à Ajouter (Future)

#### Warmup
```typescript
async warmup(modules?: string[]): Promise<WarmupResult>
// Preload critical data
// Modules: products, users, vehicles, config, seo

async warmupProducts(): Promise<void>
// Top 100 produits populaires

async warmupUsers(): Promise<void>
// Stats users (counts, roles)

async warmupVehicles(): Promise<void>
// Top 20 marques + modèles

async warmupConfig(): Promise<void>
// Toutes configs actives

async warmupSeo(): Promise<void>
// Meta-tags homepage + main pages
```

#### Health Check
```typescript
async healthCheck(): Promise<HealthStatus>
// Ping + latency + memory check
// Status: healthy/degraded/unhealthy

async ping(): Promise<number>
// PING command + latency measure (ms)

async getMemoryInfo(): Promise<MemoryInfo>
// Memory usage, max, percent, fragmentation

async checkConnection(): Promise<boolean>
// Test connexion Redis
```

#### Invalidation Avancée
```typescript
async invalidate(options: InvalidateOptions): Promise<InvalidateResult>
// Multi invalidation: keys[], patterns[], tags[]

async invalidateByTag(tag: string): Promise<number>
// Invalidation par tag (stored in Redis Set)

async addTagToKey(key: string, tag: string): Promise<void>
// Associate tag to key (for invalidation)

async getKeysByTag(tag: string): Promise<string[]>
// Get all keys with specific tag
```

#### Key Management
```typescript
async listKeys(pattern: string, cursor?: string, limit?: number): Promise<KeyListResult>
// SCAN cursor-based pagination

async getKeyInfo(key: string): Promise<KeyInfo>
// Type, TTL, size, value (if small)

async deleteMultiple(keys: string[]): Promise<number>
// Batch delete (multi DEL)

async exists(key: string): Promise<boolean>
// Check key existence

async expire(key: string, ttl: number): Promise<boolean>
// Update TTL on existing key
```

---

### 3.3 Redis Client

**Configuration**:
```typescript
constructor(private configService: ConfigService) {
  this.redis = new Redis({
    host: this.configService.get<string>('REDIS_HOST', 'localhost'),
    port: parseInt(this.configService.get<string>('REDIS_PORT', '6379'), 10),
    password: this.configService.get<string>('REDIS_PASSWORD'),
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 50, 2000),
    enableReadyCheck: true,
    lazyConnect: false
  });

  this.redis.on('connect', () => this.logger.log('✅ Connected to Redis'));
  this.redis.on('error', (error) => this.logger.error('❌ Redis error:', error));
  this.redis.on('close', () => this.logger.warn('⚠️ Redis connection closed'));
  this.redis.on('reconnecting', () => this.logger.warn('🔄 Redis reconnecting...'));
}
```

**Events Handled**:
- `connect`: Initial connexion success
- `ready`: Redis ready to accept commands
- `error`: Connection/command errors
- `close`: Connection closed
- `reconnecting`: Automatic reconnect attempt
- `end`: Connection definitively closed

---

## 4. Database Schema

### 4.1 Redis Data Types

**Strings** (simple values):
```redis
SET users:active:count "1234" EX 600
GET users:active:count
```

**Hashes** (objects):
```redis
HSET product:123 name "Plaquettes" price "49.99" stock "15"
HGET product:123 name
HGETALL product:123
```

**Lists** (ordered collections):
```redis
LPUSH products:popular:list 123 456 789
LRANGE products:popular:list 0 9
```

**Sets** (unique collections):
```redis
SADD tags:user-data "user:123" "user:stats:123"
SMEMBERS tags:user-data
```

**Sorted Sets** (ranked collections):
```redis
ZADD products:bestsellers 100 "prod:123" 95 "prod:456"
ZRANGE products:bestsellers 0 9 WITHSCORES
```

---

### 4.2 Key Naming Convention

**Pattern**: `{module}:{entity}:{id}:{attribute}`

**Examples**:
```
users:active:count              → Stats users actifs
users:123:profile               → Profil user 123
products:popular:list           → Liste produits populaires
products:category:brake:count   → Nombre produits catégorie brake
vehicles:brands:top20           → Top 20 marques véhicules
vehicles:brand:9:models         → Modèles marque 9
config:main:all                 → Config principale
seo:homepage:metatags           → Meta-tags homepage
cache:tags:user-data            → Tag user-data (Set)
cache:warmup:status             → Status warmup
```

**Prefixes Standards**:
- `users:*` → User data
- `products:*` → Product catalog
- `vehicles:*` → Vehicle compatibility
- `config:*` → Configuration
- `seo:*` → SEO metadata
- `cache:*` → Cache management (tags, warmup)
- `dashboard:*` → Dashboard stats
- `stock:*` → Stock availability
- `suppliers:*` → Suppliers data

---

### 4.3 TTL Strategy

**TTL par Type**:
```typescript
const TTL_STRATEGY = {
  // Real-time data (< 5 min)
  'stock:available': 60,           // 1 min
  'dashboard:realtime': 120,       // 2 min
  'orders:recent': 180,            // 3 min
  'dashboard:stats': 300,          // 5 min
  
  // Frequent updates (5-30 min)
  'users:count': 600,              // 10 min
  'products:popular': 900,         // 15 min
  'blog:articles': 1800,           // 30 min
  'suppliers:list': 1800,          // 30 min
  
  // Stable data (30 min - 1h)
  'seo:stats': 3600,               // 1h
  'manufacturers:list': 3600,      // 1h
  'vehicles:brands': 3600,         // 1h
  'config:main': 3600,             // 1h
  
  // Very stable (> 1h)
  'static:content': 7200,          // 2h
  'legal:terms': 14400,            // 4h
  
  // Default
  '*': 300                         // 5 min
};
```

---

## 5. Frontend Integration

### 5.1 Admin Dashboard - Cache Monitor

**Location**: `/frontend/app/routes/admin.cache.tsx`  
**Features**:
- Real-time stats (memory, keys, hit rate)
- Clear cache buttons (global, par pattern)
- Key browser (search, inspect, delete)
- Warmup trigger
- Health status indicator

**API Calls**:
```typescript
// Stats refresh every 5s
const { data: stats } = useSWR('/api/cache/stats', {
  refreshInterval: 5000
});

// Clear cache
const clearCache = async (pattern?: string) => {
  await fetch('/api/cache/clear', {
    method: 'POST',
    body: JSON.stringify({ pattern, confirm: true })
  });
};

// Warmup
const warmup = async (modules: string[]) => {
  await fetch('/api/cache/warmup', {
    method: 'POST',
    body: JSON.stringify({ modules, force: true })
  });
};

// Health check
const { data: health } = useSWR('/api/cache/health', {
  refreshInterval: 10000
});
```

**UI Components**:
```tsx
<CacheStatsCard stats={stats} />
<CacheHealthIndicator health={health} />
<CacheClearForm onClear={clearCache} />
<CacheKeyBrowser keys={keys} onDelete={deleteKey} />
<CacheWarmupPanel modules={modules} onWarmup={warmup} />
```

---

### 5.2 DevTools Panel

**Location**: `/frontend/app/components/dev/CacheDevTools.tsx`  
**Features** (dev mode only):
- Cache inspector (view values)
- Clear by module
- Force warmup
- Performance metrics

---

## 6. Business Rules

### 6.1 TTL Intelligent

**Automatic TTL Selection**:
- Analyse préfixe key
- Lookup TTL strategy map
- Fallback 300s (5 min) si inconnu

**TTL Override**:
- Méthode `set()` accepte TTL custom
- Admin peut forcer TTL via API
- Config permet ajuster TTL globaux

---

### 6.2 Cache Invalidation

**Stratégies**:
1. **Time-based**: Expiration automatique (TTL)
2. **Event-based**: Invalidation sur update data
3. **Manual**: Clear admin via dashboard
4. **Pattern-based**: Clear multiple keys (users:*)
5. **Tag-based**: Clear par tag logique

**Triggers Invalidation**:
- Product update → `products:*`
- User profile update → `user:{id}:*`
- Config change → `config:*`
- Stock update → `stock:*`
- SEO update → `seo:*`

---

### 6.3 Warmup Strategy

**Automatic Warmup** (démarrage app):
1. Config: All active configs
2. Vehicles: Top 20 brands
3. Products: Top 100 popular

**Manual Warmup** (admin trigger):
- Sélection modules custom
- Force mode (overwrite existing)
- Progress tracking

**Warmup Priority**:
1. Critical data (config, vehicles brands)
2. Popular data (top products, users stats)
3. SEO data (homepage meta, main pages)

---

### 6.4 Security

**Admin-Only Endpoints**:
- `POST /cache/clear` (global)
- `POST /cache/warmup`
- `DELETE /cache/invalidate` (patterns)

**Public Endpoints**:
- `GET /cache/health` (monitoring)

**Audit Log**:
- Log all clear operations (who, when, pattern)
- Log warmup operations
- Log invalidations (keys, patterns, tags)

---

## 7. Integration Modules

### 7.1 Products Module

**Cache Keys**:
```
products:popular:list          → Top 100 popular
products:category:{id}:list    → Products by category
products:{id}:details          → Product details
products:search:{query}        → Search results
```

**Invalidation**:
```typescript
// After product update
await this.cacheService.clearByPattern(`products:${productId}:*`);
await this.cacheService.del('products:popular:list');
```

---

### 7.2 Users Module

**Cache Keys**:
```
users:active:count             → Active users count
users:{id}:profile             → User profile
users:{id}:stats               → User stats
users:{id}:dashboard           → User dashboard data
```

**Invalidation**:
```typescript
// After user update
await this.cacheService.clearByPattern(`users:${userId}:*`);
await this.cacheService.del('users:active:count');
```

---

### 7.3 Vehicles Module

**Cache Keys**:
```
vehicles:brands:top20          → Top 20 brands
vehicles:brand:{id}:models     → Models by brand
vehicles:model:{id}:types      → Types by model
vehicles:search:{query}        → Search results
```

**Invalidation**:
```typescript
// After vehicle update
await this.cacheService.clearByPattern(`vehicles:brand:${brandId}:*`);
```

---

### 7.4 Config Module

**Cache Keys**:
```
config:main:all                → All configs
config:{key}                   → Specific config
config:environment:{env}       → Configs by env
```

**Invalidation**:
```typescript
// After config update
await this.cacheService.del(`config:${key}`);
await this.cacheService.del('config:main:all');
```

---

### 7.5 SEO Module

**Cache Keys**:
```
seo:homepage:metatags          → Homepage meta-tags
seo:page:{slug}:metatags       → Page meta-tags
seo:sitemap:cache              → Sitemap cache
seo:stats                      → SEO stats
```

**Invalidation**:
```typescript
// After SEO update
await this.cacheService.del(`seo:page:${slug}:metatags`);
await this.cacheService.del('seo:sitemap:cache');
```

---

## 8. Error Handling

### 8.1 Redis Connection Errors

**Scenario**: Redis down ou inaccessible

**Handling**:
```typescript
try {
  const value = await this.cacheService.get(key);
  if (value) return value;
} catch (error) {
  this.logger.error('Cache error, fallback to DB:', error);
  // Fallback to database
  return await this.fetchFromDatabase(key);
}
```

**Auto-reconnect**: ioredis automatic retry (3x)

---

### 8.2 Memory Full

**Scenario**: Redis maxmemory reached

**Policies**:
- `volatile-lru`: Evict keys with TTL (LRU)
- `allkeys-lru`: Evict any key (LRU)
- `volatile-ttl`: Evict shortest TTL first
- `noeviction`: Return error (not recommended)

**Monitoring**:
```typescript
const { memory, maxMemory, usagePercent } = await this.cacheService.getMemoryInfo();
if (usagePercent > 90) {
  this.logger.warn('⚠️ Redis memory > 90%, consider clearing cache');
  await this.cacheService.clearByPattern('old:*');
}
```

---

### 8.3 Large Values

**Scenario**: Value > 1MB (Redis limit ~512MB)

**Solutions**:
1. Compression (gzip/lz4)
2. Chunking (split en multiple keys)
3. Référence externe (store ailleurs, cache référence)

**Example Compression**:
```typescript
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

async setLarge(key: string, value: any): Promise<void> {
  const json = JSON.stringify(value);
  if (json.length > 100_000) { // > 100KB
    const compressed = await gzipAsync(json);
    await this.redis.set(`${key}:gz`, compressed);
  } else {
    await this.set(key, value);
  }
}
```

---

### 8.4 Cache Stampede

**Scenario**: Clé expire, 1000 requests simultanés → 1000 DB queries

**Solution**: Lock pattern
```typescript
async getOrSetWithLock<T>(
  key: string, 
  fetcher: () => Promise<T>,
  ttl: number = 300
): Promise<T> {
  // Try cache
  const cached = await this.get<T>(key);
  if (cached) return cached;

  // Acquire lock
  const lockKey = `lock:${key}`;
  const lockAcquired = await this.redis.set(lockKey, '1', 'EX', 10, 'NX');
  
  if (lockAcquired) {
    try {
      // Fetch fresh
      const fresh = await fetcher();
      await this.set(key, fresh, ttl);
      return fresh;
    } finally {
      await this.redis.del(lockKey);
    }
  } else {
    // Wait for lock holder to populate cache
    await this.sleep(100);
    return this.getOrSetWithLock(key, fetcher, ttl);
  }
}
```

---

## 9. Performance

### 9.1 Redis Optimization

**Configuration**:
```conf
# redis.conf optimizations
maxmemory 512mb
maxmemory-policy volatile-lru
save ""  # Disable RDB persistence (if cache-only)
appendonly no  # Disable AOF (if cache-only)
tcp-backlog 511
timeout 0
tcp-keepalive 300
```

**Connection Pooling**:
```typescript
this.redis = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: 3,
  enableOfflineQueue: true,
  lazyConnect: false,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});
```

---

### 9.2 Batch Operations

**Multi Command**:
```typescript
async batchSet(items: Array<{key: string, value: any, ttl: number}>): Promise<void> {
  const pipeline = this.redis.pipeline();
  
  for (const item of items) {
    pipeline.setex(item.key, item.ttl, JSON.stringify(item.value));
  }
  
  await pipeline.exec();
  this.logger.debug(`Batch SET ${items.length} keys`);
}

async batchGet(keys: string[]): Promise<Record<string, any>> {
  const pipeline = this.redis.pipeline();
  
  for (const key of keys) {
    pipeline.get(key);
  }
  
  const results = await pipeline.exec();
  
  return keys.reduce((acc, key, index) => {
    const [err, value] = results[index];
    if (!err && value) {
      acc[key] = JSON.parse(value as string);
    }
    return acc;
  }, {} as Record<string, any>);
}
```

---

### 9.3 SCAN vs KEYS

**❌ Never use KEYS in production**:
```typescript
// BAD: Blocks Redis for large keyspaces
const keys = await this.redis.keys('users:*');
```

**✅ Use SCAN for iteration**:
```typescript
async scanKeys(pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = '0';
  
  do {
    const [newCursor, matchedKeys] = await this.redis.scan(
      cursor,
      'MATCH', pattern,
      'COUNT', 100
    );
    
    cursor = newCursor;
    keys.push(...matchedKeys);
  } while (cursor !== '0');
  
  return keys;
}
```

---

### 9.4 Monitoring Metrics

**Key Metrics**:
- Hit rate: `(hits / (hits + misses)) * 100`
- Memory usage: `used_memory / maxmemory`
- Key count: `DBSIZE`
- Evicted keys: `INFO stats` → `evicted_keys`
- Connection count: `INFO clients` → `connected_clients`
- Operations/sec: `INFO stats` → `instantaneous_ops_per_sec`

**Alerts**:
- Hit rate < 70% → Increase TTL or review caching strategy
- Memory > 90% → Clear old cache or increase maxmemory
- Latency > 100ms → Check network or Redis load
- Evicted keys > 1000/min → Increase maxmemory

---

## 10. Testing

### 10.1 Endpoint Tests

**Stats**:
```bash
curl http://localhost:3000/api/cache/stats
# Expected: { success: true, data: { memory, keyCount, hitRate, ... } }
```

**Clear Cache**:
```bash
curl -X POST http://localhost:3000/api/cache/clear \
  -H "Content-Type: application/json" \
  -d '{"pattern": "users:*"}'
# Expected: { success: true, stats: { keysDeleted: 47 } }
```

**Warmup**:
```bash
curl -X POST http://localhost:3000/api/cache/warmup \
  -H "Content-Type: application/json" \
  -d '{"modules": ["products", "users"], "force": true}'
# Expected: { success: true, stats: { keysCreated: 234 } }
```

**Health**:
```bash
curl http://localhost:3000/api/cache/health
# Expected: { status: "healthy", redis: { connected: true, ... } }
```

---

### 10.2 Service Tests

**Unit Tests**:
```typescript
describe('CacheService', () => {
  test('should set and get value', async () => {
    await cacheService.set('test:key', { value: 123 });
    const result = await cacheService.get('test:key');
    expect(result).toEqual({ value: 123 });
  });

  test('should return null for missing key', async () => {
    const result = await cacheService.get('missing:key');
    expect(result).toBeNull();
  });

  test('should clear by pattern', async () => {
    await cacheService.set('users:1', { id: 1 });
    await cacheService.set('users:2', { id: 2 });
    await cacheService.clearByPattern('users:*');
    
    const result1 = await cacheService.get('users:1');
    const result2 = await cacheService.get('users:2');
    expect(result1).toBeNull();
    expect(result2).toBeNull();
  });

  test('should use smart TTL', () => {
    const ttl1 = cacheService['getSmartTTL']('stock:available');
    expect(ttl1).toBe(60); // 1 min
    
    const ttl2 = cacheService['getSmartTTL']('unknown:key');
    expect(ttl2).toBe(300); // 5 min default
  });
});
```

---

## 11. Migration Notes

### 11.1 Modules avec Cache Existant

**Modules à Centraliser**:
- ✅ Vehicles: VehicleCacheService → Migrate to CacheService
- ✅ Search: SearchCacheService → Migrate to CacheService
- ✅ Products: In-memory cache → Migrate to Redis
- ✅ Config: CacheService usage → Standardize keys
- ✅ SEO: Custom cache → Migrate to CacheService

**Migration Pattern**:
```typescript
// BEFORE (custom cache)
private cache = new Map<string, any>();

async getData(id: string): Promise<Data> {
  if (this.cache.has(id)) {
    return this.cache.get(id);
  }
  const data = await this.fetch(id);
  this.cache.set(id, data);
  return data;
}

// AFTER (CacheService)
constructor(private cacheService: CacheService) {}

async getData(id: string): Promise<Data> {
  return this.cacheService.getOrSet(
    `data:${id}`,
    () => this.fetch(id),
    3600
  );
}
```

---

### 11.2 Endpoints Cache Dispersés

**Current State**: Cache endpoints dans ~15 modules différents

**Examples**:
- `/api/catalog/invalidate-cache` → CatalogController
- `/api/manufacturers/cache/clear` → ManufacturersController
- `/api/blog/refresh-cache` → BlogController
- `/api/products/cache/clear` → ProductsController
- etc.

**Recommended Migration**:
1. Create centralized `CacheController`
2. Keep module-specific endpoints as aliases (backwards compat)
3. Update frontend to use `/api/cache/*`
4. Deprecate old endpoints (v2)

**Alias Example**:
```typescript
// CatalogController (backwards compat)
@Get('invalidate-cache')
async invalidateCache() {
  // Redirect to CacheController
  return this.httpService.post('/api/cache/clear', {
    pattern: 'catalog:*'
  });
}
```

---

### 11.3 Global vs Module Cache

**Recommendation**: Global CacheModule `@Global()`

**Current**:
```typescript
@Module({
  imports: [ConfigModule],
  providers: [CacheService],
  exports: [CacheService]
})
export class CacheModule {}
```

**After**:
```typescript
@Global()
@Module({
  imports: [ConfigModule],
  providers: [CacheService],
  exports: [CacheService]
})
export class CacheModule {}
```

**Benefit**: Injection CacheService partout sans importer module

---

## 12. Summary

**Module Cache**: Infrastructure centralisée gestion cache Redis pour performance globale.

**Endpoints**: 6 total
- GET /stats (monitoring)
- POST /clear (invalidation global/pattern)
- POST /warmup (preload données)
- GET /health (health check Redis)
- DELETE /invalidate (invalidation ciblée)
- GET /keys (list keys pagination)

**Architecture**:
- CacheService (170 lignes actuelles + ~150 extensions)
- CacheController (~150 lignes nouvelles)
- Total: ~470 lignes

**Database**: Redis
- Multiple data types (strings, hashes, lists, sets, sorted sets)
- Key naming convention: `{module}:{entity}:{id}:{attribute}`
- TTL intelligent (60s - 7200s selon type)
- Tag-based invalidation (Redis Sets)

**Business Rules**:
- TTL adaptatif par préfixe key
- Invalidation: time-based, event-based, manual, pattern, tags
- Warmup: automatic (startup) + manual (admin)
- Security: admin-only pour clear/warmup

**Integration**:
- Products: popular lists, search results
- Users: profiles, stats, dashboard
- Vehicles: brands, models, search
- Config: all configs by env
- SEO: meta-tags, sitemap

**Performance**:
- Redis optimizations (maxmemory, eviction policy)
- Batch operations (pipeline)
- SCAN vs KEYS (pagination)
- Lock pattern (cache stampede prevention)
- Compression (large values)

**Monitoring**:
- Real-time stats (memory, keys, hit rate)
- Health checks (ping, latency, memory)
- Alerts (memory > 90%, hit rate < 70%)
- Admin dashboard (clear, warmup, key browser)

**Migration**:
- Centraliser cache dispersé (15+ modules)
- Standardiser key naming convention
- Global CacheModule injection
- Backwards compat aliases

**Business Value**:
- 80% reduction response time (cached endpoints)
- Memory-efficient (512MB Redis ~ 10K+ cached values)
- Auto-healing (reconnect, retry, fallback)
- Admin control (clear, warmup, monitor)
- Developer DX (cache-aside pattern simple)
