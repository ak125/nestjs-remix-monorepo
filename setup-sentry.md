# 🔍 SETUP SENTRY - MONITORING PRODUCTION

## 1. Installation des packages

```bash
# Backend
cd backend
npm install @sentry/node @sentry/profiling-node

# Frontend 
cd ../frontend
npm install @sentry/remix
```

## 2. Configuration Backend (NestJS)

### backend/src/sentry.config.ts
```typescript
import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';

export function initSentry() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    integrations: [
      new ProfilingIntegration(),
    ],
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  });
}
```

### backend/src/main.ts - Ajouter au début
```typescript
import { initSentry } from './sentry.config';

// Initialiser Sentry en premier
if (process.env.NODE_ENV === 'production') {
  initSentry();
}
```

## 3. Configuration Frontend (Remix)

### frontend/app/entry.client.tsx
```typescript
import * as Sentry from '@sentry/remix';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
```

## 4. Variables d'environnement
```bash
# .env
SENTRY_DSN=https://your-dsn@sentry.io/project-id
```

## 5. Test rapide
```bash
# Backend test
curl http://localhost:3000/api/test-sentry-error

# Vérifier sur Sentry dashboard
```

## ⚠️ ACTIONS REQUISES
1. Créer compte Sentry (gratuit jusqu'à 5k erreurs/mois)
2. Obtenir DSN du projet  
3. Appliquer les configs ci-dessus
4. Tester avec une erreur volontaire
5. Configurer alertes Slack/Email

**Durée estimée : 2h**
**Impact : Visibilité totale erreurs production**
