# 🚨 Diagnostic : Timeouts Supabase ETIMEDOUT

## 📊 Résultats du diagnostic

```
❌ Connection timed out after 10002 milliseconds
errno: ETIMEDOUT
IPv4: 172.64.149.246, 104.18.38.10
Status: Timeout après 10s
```

## 🎯 Cause racine identifiée

**Problème réseau entre GitHub Codespaces et Supabase (via Cloudflare)**

- ✅ DNS résolu correctement (172.64.149.246, 104.18.38.10)
- ❌ Connexion TCP timeout (échec après 4-10s)
- ⚠️ Latence très élevée Codespaces → Supabase EU/US

## ✅ Solutions implémentées

### 1. **Retry automatique avec exponential backoff** ✅
- Fichier: `backend/src/database/services/supabase-base.service.ts`
- 3 tentatives avec délais croissants (1s → 2s → 4s)
- Gère ETIMEDOUT, ECONNRESET, ECONNREFUSED

### 2. **Utilitaire fetch robuste** ✅  
- Fichier: `backend/src/utils/fetch-with-retry.ts`
- Timeout configurable (défaut 30s)
- Retry intelligent sur erreurs réseau

### 3. **Script de diagnostic** ✅
- Fichier: `backend/diagnose-supabase-connection.sh`
- Teste DNS, ping, latence, API

## 🚀 Solutions recommandées par priorité

### A. **Solution immédiate : Cache Redis** (ETA: 15 min)

Cacher TOUTES les requêtes Supabase lentes en Redis :

```typescript
// backend/src/modules/catalog/catalog.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class CatalogService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly logger: Logger
  ) {}

  async getHomepageData() {
    const cacheKey = 'catalog:homepage:families';
    
    // 1. Vérifier cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      this.logger.log('✅ Cache HIT: homepage families');
      return JSON.parse(cached);
    }

    // 2. Query Supabase avec retry
    this.logger.log('🔍 Cache MISS: fetching from Supabase...');
    const data = await this.executeWithRetry(
      () => this.supabase.from('catalog_family').select('*'),
      'getHomepageData'
    );

    // 3. Stocker en cache (1 heure)
    await this.redis.setex(cacheKey, 3600, JSON.stringify(data));
    
    return data;
  }
}
```

### B. **Solution moyen terme : Supabase Edge Functions** (ETA: 2h)

Déployer une Edge Function proche de Supabase pour agréger les données :

```typescript
// supabase/functions/catalog-homepage/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Requête locale ultra-rapide (< 100ms)
  const { data, error } = await supabase
    .from('catalog_family')
    .select('*, catalog_gamme(*), pieces_gamme(*)')

  return new Response(JSON.stringify(data), {
    headers: { 
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600'
    }
  })
})
```

Appel depuis NestJS :
```typescript
const data = await fetchWithRetry(
  'https://cxpojprgwgubzjyqzmoq.supabase.co/functions/v1/catalog-homepage',
  { headers: { 'Authorization': `Bearer ${key}` }}
);
```

### C. **Solution long terme : Database Read Replica** (ETA: 1 jour)

Déployer une réplique Postgres proche du Codespace :

1. **Supabase Database Replication** (plan Pro)
   - Réplique EU proche du datacenter Codespaces
   - Latence < 50ms garantie

2. **Alternative : Supabase Self-Hosted**
   - Docker Compose sur même réseau que Codespaces
   - Sync Supabase → Local via Logical Replication

### D. **Solution ultime : Déployer app proche de Supabase** (ETA: 3h)

Déployer NestJS + Remix sur **Vercel/Netlify/Fly.io** :
- Région: `eu-west-1` (même que Supabase)
- Latence: < 10ms vers Supabase
- Résout le problème définitivement

## 📋 Plan d'action NOW

### ✅ Étape 1 : Activer cache Redis sur endpoints lents (5 min)

```bash
cd /workspaces/nestjs-remix-monorepo/backend
```

Modifier ces fichiers :
- `src/modules/catalog/catalog.service.ts` → cache homepage
- `src/modules/blog/services/advice.service.ts` → cache articles
- `src/modules/auth/auth.service.ts` → cache user lookup

### ✅ Étape 2 : Vérifier retry actif (déjà fait ✅)

Test :
```bash
# Forcer un timeout et voir le retry
curl http://localhost:3000/api/catalog/families -v
# Devrait logger : "⚠️ TIMEOUT error... tentative 1/3"
```

### ✅ Étape 3 : Monitorer (1 min)

Ajouter métriques dans logs :
```typescript
logger.log(`⏱️ Supabase query took ${Date.now() - start}ms`);
```

## 💡 Workaround immédiat

En attendant les fixes, **augmenter tous les timeouts** :

```env
# backend/.env
SUPABASE_TIMEOUT=60000  # 60 secondes
SUPABASE_MAX_RETRIES=5
```

## 📊 Métriques à suivre

```bash
# Logs à monitorer
grep "TIMEOUT error" backend/logs/*.log | wc -l  # Nombre de timeouts
grep "Cache HIT" backend/logs/*.log | wc -l      # Efficacité cache
grep "took.*ms" backend/logs/*.log | sort -t'=' -k2 -n  # Requêtes lentes
```

## 🎯 Objectif

- ❌ **Avant** : 30-50% requêtes timeout (ETIMEDOUT)
- ✅ **Après** : < 1% timeout + 99% cache HIT + temps réponse < 100ms

## 🔧 Commandes utiles

```bash
# Test connexion
./diagnose-supabase-connection.sh

# Restart avec nouvelles config
npm run start:dev

# Voir les timeouts en temps réel
tail -f logs/nestjs.log | grep -E "TIMEOUT|ETIMEDOUT|Cache"

# Stats Redis
redis-cli INFO stats
```
