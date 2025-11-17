# Corrections des timeouts Supabase

**Date:** 10 novembre 2025  
**Branche:** `feat/performance-optimization`

## Problème identifié

Erreurs de timeout lors des connexions à Supabase depuis le dev container :

```
FetchError: request to https://cxpojprgwgubzjyqzmoq.supabase.co/rest/v1/___xtr_msg failed
reason: ETIMEDOUT
```

### Cause
- Problème de connectivité réseau depuis GitHub Codespace vers Supabase
- Timeouts infinis bloquant l'application
- Absence de retry automatique
- Logs excessifs en ERROR pour des problèmes non critiques

## Solutions implémentées

### 1. Timeout de 10 secondes (`supabase-base.service.ts`)

```typescript
global: {
  fetch: (url, options = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    return fetch(url, { ...options, signal: controller.signal })
      .finally(() => clearTimeout(timeout));
  },
}
```

### 2. Gestion étendue des erreurs réseau

Ajout de la détection pour :
- `ETIMEDOUT` - Timeout de connexion
- `ECONNRESET` - Connexion réinitialisée
- `ENOTFOUND` - DNS non résolu
- `FetchError` - Erreurs génériques de fetch
- Erreurs Cloudflare 500

### 3. Retry avec exponential backoff

```typescript
protected async executeWithRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries = 3,
): Promise<T | null>
```

- 3 tentatives par défaut
- Délais : 1s, 2s, 4s (max 5s)
- Circuit breaker après 5 échecs consécutifs

### 4. Circuit breaker

États :
- **CLOSED** : Fonctionnement normal
- **OPEN** : Trop d'échecs, requêtes bloquées pendant 1 minute
- **HALF-OPEN** : Test de récupération (3 tentatives)

### 5. Optimisations RedirectService

**Fire-and-forget pour les compteurs** :
```typescript
// Avant : await this.incrementHitCount(ruleId);
// Après : this.incrementHitCount(ruleId).catch(() => {});
```

**Logs moins verbeux** :
- `ERROR` → `WARN` pour les timeouts
- `ERROR` → `DEBUG` pour les erreurs de parsing

**Graceful degradation** :
```typescript
catch (error) {
  this.logger.warn('Service de redirection non disponible');
  // L'application continue sans redirections
}
```

### 6. Fix nodemon (`package.json`)

```json
// Avant
"dev:watch": "nodemon --delay 2000ms --watch dist dist/main.js"

// Après  
"dev:watch": "nodemon --delay 2000ms --watch dist --exec 'node dist/main.js'"
```

## Résultats

✅ **Le serveur démarre correctement** même avec timeout Supabase  
✅ **Retry automatique** pour les erreurs temporaires  
✅ **Circuit breaker** évite la surcharge  
✅ **Logs propres** (WARN au lieu de ERROR pour problèmes non critiques)  
✅ **L'application continue** de fonctionner sans les redirections

## Tests de validation

```bash
# Compilation
cd backend && npm run build

# Test de démarrage
node dist/main.js

# Logs attendus
# ✅ Redis connecté
# ✅ Nest application successfully started
# ⚠️ (optionnel) Avertissements Supabase en WARN
```

## Configuration réseau

Variables vérifiées dans `.env` :
- `SUPABASE_URL` : ✅ Configuré
- `SUPABASE_ANON_KEY` : ✅ Configuré  
- `SUPABASE_SERVICE_ROLE_KEY` : ✅ Configuré

Connectivité testée :
```bash
curl --max-time 10 https://cxpojprgwgubzjyqzmoq.supabase.co/rest/v1/
# Résultat: Timeout (problème réseau Codespace)
```

## Recommandations futures

1. **Environnement de production** : Vérifier que Supabase est accessible
2. **Monitoring** : Surveiller l'état du circuit breaker
3. **Fallback local** : Envisager un cache persistant pour les redirections critiques
4. **Healthcheck** : Ajouter un endpoint `/health` exposant l'état Supabase

## Fichiers modifiés

- `backend/src/database/services/supabase-base.service.ts`
- `backend/src/modules/errors/services/redirect.service.ts`
- `backend/package.json`
- `backend/diagnose-supabase.sh` (nouveau)
