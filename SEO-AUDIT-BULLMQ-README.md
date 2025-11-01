# 🔄 SEO Audit Automation avec BullMQ

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      SEO AUDIT SYSTEM                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  📅 Scheduler                  🔄 Queue                📊 Reports│
│  ┌──────────────┐           ┌──────────────┐        ┌──────────┐│
│  │ @Cron        │           │              │        │          ││
│  │ Lundi 3h00   ├──────────►│   BullMQ     │────────► Meili    ││
│  │              │   Job     │   (Redis)    │ Result │ search   ││
│  └──────────────┘           │              │        │          ││
│                             │  ┌────────┐  │        └──────────┘│
│  🚀 Manual Trigger          │  │Worker  │  │        ┌──────────┐│
│  ┌──────────────┐           │  │Process │  │        │          ││
│  │ POST /run    ├──────────►│  └────────┘  │────────► Loki     ││
│  │              │   Job     │              │ Logs   │          ││
│  └──────────────┘           │  Retry: 3x   │        └──────────┘│
│                             │  Backoff:    │                    │
│                             │  Exponential │                    │
│                             └──────────────┘                    │
└─────────────────────────────────────────────────────────────────┘
```

## 🎯 Composants

### 1. **SeoAuditSchedulerService** - Planificateur
- 📅 Cron: Lundi 3h00 (Europe/Paris)
- 🔄 Crée des jobs BullMQ
- 📊 Expose les stats de queue

### 2. **SeoAuditProcessor** - Worker
- 🔄 Traite les jobs en background
- 🔁 Retry: 3 tentatives avec backoff exponentiel
- 📝 Logs chaque étape (active, completed, failed)
- 📊 Envoie vers Meilisearch + Loki

### 3. **SeoAuditController** - API
- `POST /seo-logs/audit/run` - Déclenche audit manuel
- `GET /seo-logs/audit/queue/stats` - Stats de la queue
- `GET /seo-logs/audit/queue/jobs` - Jobs récents
- `GET /seo-logs/audit/latest` - Dernier rapport
- `GET /seo-logs/audit/history` - Historique
- `GET /seo-logs/audit/trends` - Tendances

## 🚀 Utilisation

### Audit automatique (programmé)

```typescript
// Exécution automatique tous les lundis à 3h00
// Aucune action requise, géré par @Cron
```

### Audit manuel (via API)

```bash
# Déclencher un audit
curl -X POST http://localhost:3001/seo-logs/audit/run

# Réponse
{
  "success": true,
  "message": "Audit job créé avec succès",
  "data": {
    "jobId": "42",
    "jobName": "manual-audit",
    "status": "queued"
  }
}
```

### Monitoring

```bash
# Stats de la queue
curl http://localhost:3001/seo-logs/audit/queue/stats

# Réponse
{
  "success": true,
  "data": {
    "waiting": 0,
    "active": 1,
    "completed": 15,
    "failed": 2,
    "delayed": 0,
    "total": 18
  }
}

# Jobs récents
curl http://localhost:3001/seo-logs/audit/queue/jobs?limit=5

# Réponse
{
  "success": true,
  "data": {
    "total": 5,
    "jobs": [
      {
        "id": "42",
        "name": "weekly-audit",
        "state": "completed",
        "progress": 100,
        "attemptsMade": 1,
        "processedOn": 1730082000000,
        "finishedOn": 1730082845000,
        "returnvalue": {
          "summary": {
            "status": "PASS",
            "total_errors": 0
          }
        }
      }
    ]
  }
}
```

## 📊 Flux de données

```
1. Scheduler/API trigger
   ↓
2. BullMQ crée job dans Redis
   ↓
3. Worker pickup job
   ↓
4. Exécution script seo-audit-weekly.sh
   ├─ Validation XSD
   ├─ Check noindex
   ├─ Check 4xx/5xx
   ├─ Check hreflang
   └─ Check canoniques
   ↓
5. Parse résultat JSON
   ↓
6. Envoie vers Meilisearch (indexation)
   ↓
7. Envoie vers Loki (logs)
   ↓
8. Marque job completed
```

## 🔧 Configuration

### Variables d'environnement

```bash
# Redis (BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # optionnel

# Audit
SITEMAP_URL=https://automecanik.fr/sitemap.xml
LOKI_URL=http://loki:3100
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_API_KEY=xxxxx

# Webhook (optionnel)
SEO_AUDIT_WEBHOOK_URL=https://hooks.slack.com/services/XXX
```

### Personnaliser le schedule

```typescript
// src/modules/seo-logs/services/seo-audit-scheduler.service.ts

@Cron('0 3 * * 1', {  // ← Modifier ici
  name: 'weekly-seo-audit',
  timeZone: 'Europe/Paris',
})
```

**Exemples cron:**
- `0 3 * * 1` - Lundi 3h00
- `0 3 * * 0` - Dimanche 3h00
- `0 2 1 * *` - 1er du mois à 2h00
- `0 */6 * * *` - Toutes les 6 heures

### Personnaliser les retries

```typescript
// src/modules/seo-logs/seo-logs.module.ts

BullModule.registerQueue({
  name: 'seo-audit',
  defaultJobOptions: {
    attempts: 5,  // ← Modifier ici (défaut: 3)
    backoff: {
      type: 'exponential',
      delay: 120000,  // ← 2 min (défaut: 1 min)
    },
  },
}),
```

## 🎛️ Dashboard BullMQ (optionnel)

Installer Bull Board pour UI web:

```bash
npm install @bull-board/api @bull-board/nestjs @bull-board/express
```

```typescript
// app.module.ts
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';

@Module({
  imports: [
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature({
      name: 'seo-audit',
      adapter: ExpressAdapter,
    }),
  ],
})
```

Accès: `http://localhost:3001/admin/queues`

## 🐛 Troubleshooting

### Job reste en "waiting"

**Cause:** Worker pas démarré ou crash

**Solution:**
```bash
# Vérifier les logs NestJS
docker logs backend | grep SeoAuditProcessor

# Vérifier Redis
redis-cli PING
redis-cli KEYS "bull:seo-audit:*"
```

### Job fail avec "Script not found"

**Cause:** Chemin script incorrect

**Solution:**
```typescript
// Vérifier le chemin dans processor
private readonly scriptPath = path.join(
  process.cwd(),
  '..',
  'scripts',
  'seo-audit-weekly.sh',
);

// Ou utiliser chemin absolu
private readonly scriptPath = '/workspaces/nestjs-remix-monorepo/scripts/seo-audit-weekly.sh';
```

### Meilisearch/Loki échoue mais job passe

**C'est normal !** Le processor ne fail pas si l'envoi échoue.

**Raison:** L'audit est réussi même si l'indexation échoue.

**Solution:** Vérifier les logs:
```bash
docker logs backend | grep "Failed to send"
```

### Job retry trop souvent

**Cause:** Backoff trop agressif

**Solution:**
```typescript
// Augmenter les délais
backoff: {
  type: 'fixed',  // Au lieu de 'exponential'
  delay: 300000,  // 5 min fixe
}
```

## 📈 Métriques

### KPIs à monitorer

```bash
# Taux de succès
completed / (completed + failed) * 100

# Temps moyen d'exécution
AVG(finishedOn - processedOn)

# Jobs en attente
waiting + delayed

# Taux de retry
SUM(attemptsMade > 1) / total
```

### Alertes recommandées

1. **Job failed > 3 fois** → Alerte critique
2. **Queue > 10 jobs en attente** → Alerte warning
3. **Temps exécution > 30min** → Alerte performance
4. **Aucun job completed depuis 8j** → Alerte scheduler

## 🔮 Prochaines améliorations

- [ ] **Audit incrémental**: Ne tester que les URLs modifiées
- [ ] **Parallel processing**: Split sitemap en chunks
- [ ] **Progressive scan**: 10% sitemap/jour au lieu de 100% hebdo
- [ ] **Smart sampling**: Prioriser URLs à fort trafic
- [ ] **Notification conditionnelle**: Webhook seulement si erreurs
- [ ] **Dashboard Grafana**: Graphiques évolution audits
- [ ] **Audit reports API**: GET /audit/:id/details
- [ ] **Scheduled cleanup**: Auto-delete rapports >90j

## 🎓 Ressources

- [BullMQ Documentation](https://docs.bullmq.io/)
- [NestJS Schedule](https://docs.nestjs.com/techniques/task-scheduling)
- [Cron Expression Generator](https://crontab.guru/)
- [Bull Board UI](https://github.com/felixmosh/bull-board)
