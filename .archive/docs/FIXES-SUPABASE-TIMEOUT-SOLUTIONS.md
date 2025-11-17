# 🔧 Solutions aux Timeouts Supabase

## 🚨 Problème actuel
```
FetchError: request to https://cxpojprgwgubzjyqzmoq.supabase.co/rest/v1/___xtr_customer failed
errno: 'ETIMEDOUT'
code: 'ETIMEDOUT'
```

## ✅ Solutions par priorité

### 1️⃣ **SOLUTION IMMÉDIATE : Augmenter les timeouts**

#### Backend - Modifier `supabase-base.service.ts`
```typescript
// Ajouter dans le constructeur
this.supabase = createClient(this.supabaseUrl, this.supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'x-client-info': 'supabase-js-node',
    },
    fetch: (url, options) => {
      return fetch(url, {
        ...options,
        timeout: 30000, // 30 secondes au lieu de défaut
        agent: new https.Agent({
          keepAlive: true,
          maxSockets: 10,
        }),
      });
    },
  },
});
```

### 2️⃣ **SOLUTION ROBUSTE : Retry avec exponential backoff**

Créer un wrapper de fetch avec retry :

```typescript
// backend/src/utils/fetch-with-retry.ts
import fetch from 'node-fetch';

export async function fetchWithRetry(
  url: string,
  options: any = {},
  maxRetries = 3,
  baseDelay = 1000
): Promise<any> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok && response.status >= 500) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response;
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
        console.log(`⏳ Retry ${attempt + 1}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}
```

### 3️⃣ **SOLUTION CACHE : Redis pour réduire les appels**

Vous avez déjà Redis ! Ajouter un cache sur les requêtes fréquentes :

```typescript
// Dans supabase-base.service.ts
protected async cachedQuery<T>(
  cacheKey: string,
  queryFn: () => Promise<T>,
  ttl = 300 // 5 minutes
): Promise<T> {
  try {
    // Vérifier cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      this.logger.log(`✅ Cache HIT: ${cacheKey}`);
      return JSON.parse(cached);
    }

    // Query Supabase
    this.logger.log(`🔍 Cache MISS: ${cacheKey}`);
    const result = await queryFn();

    // Stocker en cache
    await this.redis.setex(cacheKey, ttl, JSON.stringify(result));
    
    return result;
  } catch (error) {
    this.logger.error(`❌ Query failed for ${cacheKey}:`, error);
    throw error;
  }
}
```

### 4️⃣ **SOLUTION RÉSEAU : Vérifier la connexion Supabase**

```bash
# Test de connectivité
curl -v https://cxpojprgwgubzjyqzmoq.supabase.co/rest/v1/ \
  -H "apikey: YOUR_KEY" \
  -H "Authorization: Bearer YOUR_KEY"

# Test de latence
ping cxpojprgwgubzjyqzmoq.supabase.co

# Test DNS
nslookup cxpojprgwgubzjyqzmoq.supabase.co
```

### 5️⃣ **SOLUTION ARCHITECTURE : Connection pooling**

```typescript
// backend/src/database/supabase-pool.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as https from 'https';

@Injectable()
export class SupabasePoolService {
  private logger = new Logger(SupabasePoolService.name);
  private pool: SupabaseClient[] = [];
  private currentIndex = 0;
  private readonly poolSize = 5;

  // Agent HTTP réutilisable avec keepAlive
  private readonly agent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 10,
    maxFreeSockets: 5,
    timeout: 30000,
  });

  constructor() {
    this.initializePool();
  }

  private initializePool() {
    for (let i = 0; i < this.poolSize; i++) {
      const client = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: { persistSession: false },
          global: {
            fetch: (url, options) => {
              return fetch(url, {
                ...options,
                agent: this.agent,
              });
            },
          },
        }
      );
      this.pool.push(client);
    }
    this.logger.log(`✅ Pool initialized with ${this.poolSize} clients`);
  }

  getClient(): SupabaseClient {
    // Round-robin
    const client = this.pool[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.poolSize;
    return client;
  }
}
```

## 🎯 Plan d'action recommandé

### Phase 1 : Quick fixes (5 min)
1. ✅ Augmenter timeout à 30s
2. ✅ Ajouter retry automatique (3 tentatives)

### Phase 2 : Optimisations (30 min)
3. ✅ Implémenter cache Redis sur endpoints lents
4. ✅ Ajouter connection pooling

### Phase 3 : Monitoring (1h)
5. ✅ Ajouter métriques de latence Supabase
6. ✅ Dashboard Grafana pour suivre timeouts
7. ✅ Alertes si taux timeout > 5%

## 📊 Vérification post-déploiement

```bash
# Tester la connexion
npm run test:supabase-connection

# Surveiller les logs
tail -f logs/supabase-errors.log | grep ETIMEDOUT

# Métriques Redis
redis-cli INFO stats | grep cache_hits
```

## 🔍 Diagnostic réseau approfondi

```bash
# Tracer la route réseau
traceroute cxpojprgwgubzjyqzmoq.supabase.co

# Vérifier les DNS
dig cxpojprgwgubzjyqzmoq.supabase.co

# Test de charge
ab -n 100 -c 10 https://cxpojprgwgubzjyqzmoq.supabase.co/rest/v1/
```

## 💡 Notes importantes

- **ETIMEDOUT** = Le serveur Supabase ne répond pas assez vite
- Peut être causé par :
  - ✅ Réseau lent (Codespaces → Supabase EU/US)
  - ✅ Requêtes lourdes sans index
  - ✅ Rate limiting Supabase
  - ✅ Connexion qui drop

- **Solution temporaire** : Cache tout en Redis
- **Solution permanente** : Déployer l'app proche de Supabase (même région)
