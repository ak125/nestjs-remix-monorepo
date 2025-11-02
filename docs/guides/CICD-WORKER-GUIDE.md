# 🚀 CI/CD - SUPERCRONIC + BULLMQ DEPLOYMENT GUIDE

## 📋 Vue d'ensemble

**Architecture moderne** : Supercronic (Docker) + BullMQ (Redis) + NestJS Workers

### Avantages vs Cron traditionnel

| Feature | Cron | Supercronic + BullMQ |
|---------|------|----------------------|
| Logs | syslog | stdout/stderr natifs |
| Retry | ❌ | ✅ Exponentiel backoff |
| Monitoring | ⚠️ Limité | ✅ Dashboard UI |
| Scalabilité | ❌ 1 serveur | ✅ Horizontale |
| Priorités | ❌ | ✅ Queue prioritaire |
| Déploiement | ⚠️ Complexe | ✅ Docker |

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────┐
│              WORKER CONTAINER                   │
├────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────────────────────────────────┐ │
│  │  SUPERCRONIC (PID 1)                     │ │
│  │  → Déclencheur système fiable            │ │
│  │  → Logs stdout/stderr                    │ │
│  │  → Crash recovery automatique            │ │
│  └──────────────────────────────────────────┘ │
│                                                 │
│  ┌──────────────────────────────────────────┐ │
│  │  BULLMQ WORKER (Background)              │ │
│  │  → Process jobs depuis Redis             │ │
│  │  → Retry automatique + backoff           │ │
│  │  → Concurrency configurable              │ │
│  └──────────────────────────────────────────┘ │
│                                                 │
│  ┌──────────────────────────────────────────┐ │
│  │  HEALTH CHECK API (Port 3001)            │ │
│  │  → /health endpoint                      │ │
│  │  → Monitoring Docker                     │ │
│  └──────────────────────────────────────────┘ │
│                                                 │
└────────────────────────────────────────────────┘
           │
           ↓
  ┌────────────────────┐
  │   REDIS (BullMQ)   │
  │  → Queues          │
  │  → Job tracking    │
  │  → Persistence     │
  └────────────────────┘
```

---

## 📦 Fichiers créés

### 1. Docker

#### `Dockerfile.worker` (Worker container)
- Base: node:20-alpine
- Supercronic v0.2.29 installé
- Multi-stage build optimisé
- Health check intégré
- Port 3001 exposé

#### `docker-compose.worker.yml` (Orchestration)
- Service worker avec Supercronic
- Service Redis 7
- Service Bull Board (Dashboard UI)
- Networks et volumes configurés

#### `scripts/start-worker.sh` (Démarrage)
- Lance Worker BullMQ en background
- Lance Supercronic en foreground
- Gestion graceful shutdown

#### `crontab` (Tâches planifiées)
- Delta sitemap: 3h du matin
- Streaming complet: Dimanche 2h
- Cleanup: Quotidien 4h
- Monitoring: Toutes les heures

### 2. Backend NestJS

#### `backend/src/workers/main.ts` (Bootstrap)
- Point d'entrée worker
- Health check endpoint /health
- Port 3001

#### `backend/src/workers/worker.module.ts` (Module)
- Configuration BullMQ + Redis
- Enregistrement queues (sitemap, cache, email)
- Injection services

#### `backend/src/workers/processors/sitemap.processor.ts`
- Job `generate-streaming`: Génération streaming
- Job `generate-delta`: Delta quotidien
- Job `cleanup-deltas`: Nettoyage expired

#### `backend/src/workers/processors/cache.processor.ts`
- Job `cleanup-expired`: Nettoyage cache Redis
- Job `warmup`: Préchauffage cache

#### `backend/src/workers/processors/email.processor.ts`
- Job `send`: Envoi email individuel
- Job `daily-report`: Rapport quotidien

### 3. CI/CD

#### `.github/workflows/worker-deploy.yml`
- Build Docker image
- Push vers GitHub Container Registry
- Déploiement SSH production
- Health check post-deploy
- Notifications Slack

---

## 🚀 Utilisation

### Démarrage local

```bash
# Installer dépendances
cd backend
npm install

# Démarrer Redis + Worker
docker-compose -f docker-compose.worker.yml up -d

# Vérifier logs
docker-compose -f docker-compose.worker.yml logs -f worker

# Vérifier health
curl http://localhost:3001/health

# Accéder Bull Board Dashboard
open http://localhost:3002
```

### Build Docker

```bash
# Build worker image
docker build -f Dockerfile.worker -t automecanik-worker:latest .

# Run container
docker run -d \
  --name worker \
  -e REDIS_HOST=redis \
  -e REDIS_PORT=6379 \
  -e WORKER_CONCURRENCY=5 \
  --network automecanik-network \
  automecanik-worker:latest
```

### Ajouter un job BullMQ

```typescript
// Dans un controller NestJS
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Controller('api')
export class ApiController {
  constructor(
    @InjectQueue('sitemap') private sitemapQueue: Queue,
  ) {}

  @Post('trigger-sitemap')
  async triggerSitemap() {
    // Ajouter job à la queue
    const job = await this.sitemapQueue.add('generate-streaming', {
      type: 'streaming',
      sitemapType: 'products',
      options: {
        includeImages: true,
        includeHreflang: true,
      },
    }, {
      priority: 1,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });

    return {
      success: true,
      jobId: job.id,
    };
  }
}
```

### Vérifier jobs

```bash
# Via Bull Board
open http://localhost:3002

# Via Redis CLI
redis-cli
> KEYS bull:sitemap:*
> LRANGE bull:sitemap:active 0 -1
```

---

## 📊 Monitoring

### Health Check

```bash
# Vérifier santé worker
curl http://localhost:3001/health

# Réponse:
{
  "status": "healthy",
  "timestamp": "2025-10-26T10:00:00.000Z",
  "uptime": 3600
}
```

### Bull Board Dashboard

```
http://localhost:3002

Fonctionnalités:
- Vue temps réel des queues
- Jobs actifs/completed/failed
- Retry manuel
- Logs par job
- Métriques performance
```

### Logs Docker

```bash
# Logs worker
docker logs -f automecanik-worker

# Logs Supercronic uniquement
docker logs automecanik-worker 2>&1 | grep "supercronic"

# Logs BullMQ uniquement
docker logs automecanik-worker 2>&1 | grep "BullMQ"
```

---

## ⚙️ Configuration

### Variables d'environnement

```bash
# .env
NODE_ENV=production
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-password
REDIS_DB=0
WORKER_CONCURRENCY=5 # Nombre de jobs simultanés
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_KEY=...
```

### Crontab personnalisé

```bash
# Format: minute hour day month weekday command

# Exemple: Générer sitemaps produits tous les jours 3h
0 3 * * * curl -X POST http://localhost:3000/sitemap-v2/streaming/generate?type=products

# Exemple: Backup Redis tous les jours 1h
0 1 * * * redis-cli --rdb /backups/redis-$(date +\%Y\%m\%d).rdb

# Exemple: Nettoyage logs tous les dimanches 23h
0 23 * * 0 find /logs -name "*.log" -mtime +7 -delete
```

### Concurrency BullMQ

```typescript
// worker.module.ts
BullModule.forRootAsync({
  useFactory: () => ({
    redis: { ... },
    defaultJobOptions: {
      attempts: 3, // Nombre de retry
      backoff: {
        type: 'exponential', // exponential ou fixed
        delay: 5000, // Délai initial en ms
      },
      removeOnComplete: 100, // Garder 100 derniers jobs OK
      removeOnFail: 500, // Garder 500 derniers jobs KO
    },
  }),
}),
```

---

## 🔄 CI/CD Pipeline

### Déclenchement

```yaml
on:
  push:
    branches: [main, staging]
    paths:
      - 'backend/src/workers/**'
      - 'Dockerfile.worker'
      - 'crontab'
```

### Étapes

1. **Build**: Docker multi-stage build
2. **Push**: GitHub Container Registry (ghcr.io)
3. **Deploy**: SSH vers serveur production
4. **Health check**: Vérification post-deploy
5. **Notify**: Slack (succès/échec)

### Déploiement manuel

```bash
# Via GitHub UI
Actions → Deploy Worker → Run workflow

# Via gh CLI
gh workflow run worker-deploy.yml
```

---

## 🐛 Troubleshooting

### Worker ne démarre pas

```bash
# Vérifier logs
docker logs automecanik-worker

# Vérifier connexion Redis
docker exec -it automecanik-redis redis-cli ping

# Vérifier health
curl http://localhost:3001/health
```

### Jobs ne s'exécutent pas

```bash
# Vérifier queue dans Redis
redis-cli KEYS "bull:sitemap:*"

# Vérifier Bull Board
open http://localhost:3002

# Forcer retry job
curl -X POST http://localhost:3002/api/queues/sitemap/jobs/123/retry
```

### Supercronic ne lance pas les jobs

```bash
# Vérifier syntaxe crontab
docker exec automecanik-worker supercronic -test /app/crontab

# Vérifier logs Supercronic
docker logs automecanik-worker 2>&1 | grep supercronic
```

### Redis out of memory

```bash
# Vérifier mémoire
redis-cli INFO memory

# Augmenter maxmemory
# docker-compose.worker.yml
command: >
  redis-server
  --maxmemory 1gb
  --maxmemory-policy allkeys-lru
```

---

## 📚 Ressources

- [Supercronic](https://github.com/aptible/supercronic)
- [BullMQ](https://docs.bullmq.io/)
- [Bull Board](https://github.com/felixmosh/bull-board)
- [NestJS Bull](https://docs.nestjs.com/techniques/queues)

---

## ✅ Checklist déploiement

- [ ] Installer dépendances: `@nestjs/bull`, `bull`, `ioredis`
- [ ] Créer Dockerfile.worker
- [ ] Créer crontab avec tâches planifiées
- [ ] Créer workers NestJS (main.ts, processors)
- [ ] Configurer docker-compose.worker.yml
- [ ] Configurer Redis (password, maxmemory)
- [ ] Créer GitHub Actions workflow
- [ ] Configurer secrets GitHub (SSH, Slack)
- [ ] Tester health check
- [ ] Tester Bull Board Dashboard
- [ ] Vérifier logs Supercronic
- [ ] Monitorer premières exécutions

---

**Créé le :** 26 octobre 2025  
**Architecture :** Supercronic + BullMQ + NestJS  
**Status :** ✅ Production Ready
