# 🔄 Migration Monitoring SEO vers BullMQ

## 📋 Résumé

Au lieu d'utiliser un **cron job shell basique**, nous avons migré vers **BullMQ + Redis** pour le monitoring SEO, conformément à l'architecture existante.

---

## ✅ Avantages de BullMQ vs Cron

| Critère | Cron Shell | BullMQ + Redis |
|---------|------------|----------------|
| **Fiabilité** | Dépend du système | ✅ Persistant (Redis) |
| **Retry automatique** | ❌ Manuel | ✅ Configurable |
| **Monitoring** | ❌ Logs fichiers | ✅ Dashboard + API |
| **Scalabilité** | ❌ 1 serveur | ✅ Multi-workers |
| **Progression** | ❌ Pas de tracking | ✅ job.progress() |
| **Jobs manuels** | ❌ Complexe | ✅ API dédiée |
| **Priorité** | ❌ Non | ✅ Configurable |
| **Architecture** | ❌ Séparé | ✅ Intégré (déjà utilisé) |

---

## 🏗️ Architecture Implémentée

### 1. Processor BullMQ

**Fichier:** `backend/src/workers/processors/seo-monitor.processor.ts`

```typescript
@Processor('seo-monitor')
export class SeoMonitorProcessor {
  @Process('check-pages')
  async handleMonitoring(job: Job<SeoMonitorJobData>): Promise<MonitoringResult>
}
```

**Fonctionnalités:**
- ✅ Vérification URLs critiques (toutes les 30min)
- ✅ Vérification échantillon aléatoire (toutes les 6h)
- ✅ Alerte si 0 pièce trouvée
- ✅ Logs structurés pour Vector
- ✅ Progression en temps réel

---

### 2. Scheduler Service

**Fichier:** `backend/src/workers/services/seo-monitor-scheduler.service.ts`

```typescript
@Injectable()
export class SeoMonitorSchedulerService implements OnModuleInit {
  async onModuleInit() {
    await this.setupCriticalUrlsMonitoring(); // Toutes les 30min
    await this.setupRandomSampleMonitoring(); // Toutes les 6h
  }
}
```

**Jobs répétitifs:**
- 🔍 **URLs critiques**: `*/30 * * * *` (toutes les 30 minutes)
- 🎲 **Échantillon aléatoire**: `0 */6 * * *` (toutes les 6 heures)

---

### 3. API Controller

**Fichier:** `backend/src/modules/seo/controllers/seo-monitor.controller.ts`

**Endpoints disponibles:**

#### 📊 Stats de la queue
```bash
GET /api/seo/monitor/stats
```

Retourne:
```json
{
  "success": true,
  "data": {
    "waiting": 0,
    "active": 1,
    "completed": 42,
    "failed": 0,
    "delayed": 0,
    "total": 43
  }
}
```

#### 📋 Jobs récents
```bash
GET /api/seo/monitor/jobs/recent?limit=20
```

#### 🔍 Résultat d'un job
```bash
GET /api/seo/monitor/jobs/:jobId
```

#### 🚀 Déclencher monitoring manuel
```bash
POST /api/seo/monitor/trigger?taskType=check-critical-urls
POST /api/seo/monitor/trigger?taskType=check-random-sample
```

Retourne:
```json
{
  "success": true,
  "message": "Job de monitoring lancé",
  "data": {
    "jobId": "12345",
    "taskType": "check-critical-urls",
    "status": "queued"
  }
}
```

---

## 🔧 Configuration

### URLs Critiques Surveillées

**Fichier:** `backend/src/workers/processors/seo-monitor.processor.ts`

```typescript
private readonly CRITICAL_URLS = [
  // Filtres à huile populaires
  {
    url: '/pieces/filtre-a-huile-7/renault-140/clio-iii-140004/1-5-dci-19052.html',
    typeId: 19052,
    gammeId: 7,
  },
  // ... ajouter vos URLs critiques ici
];
```

**⚠️ TODO:** Ajouter URLs critiques basées sur Google Analytics (top 20 pages trafic organique).

---

### Configuration Redis

**Fichier:** `backend/src/workers/worker.module.ts`

```typescript
BullModule.forRootAsync({
  useFactory: (configService: ConfigService) => ({
    redis: {
      host: configService.get('REDIS_HOST', 'redis'),
      port: configService.get('REDIS_PORT', 6379),
      password: configService.get('REDIS_PASSWORD'),
      db: configService.get('REDIS_DB', 0),
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  }),
}),
```

**Variables d'environnement requises:**
```bash
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD= # Optionnel
REDIS_DB=0
```

---

## 📊 Résultats de Monitoring

### Format de Résultat

```typescript
interface MonitoringResult {
  totalChecked: number;
  okCount: number;
  warningCount: number;
  errorCount: number;
  alerts: UrlCheckResult[];
  timestamp: string;
}

interface UrlCheckResult {
  url: string;
  typeId: number;
  gammeId: number;
  piecesCount: number;
  status: 'ok' | 'warning' | 'error';
  message?: string;
  checkedAt: string;
}
```

### Exemple de Résultat

```json
{
  "totalChecked": 7,
  "okCount": 6,
  "warningCount": 1,
  "errorCount": 0,
  "alerts": [
    {
      "url": "/pieces/filtre-a-huile-7/peugeot-118/208-118001/1-6-bluehdi-75-18781.html",
      "typeId": 18781,
      "gammeId": 7,
      "piecesCount": 3,
      "status": "warning",
      "message": "⚠️ Peu de pièces disponibles (3)",
      "checkedAt": "2025-10-27T18:15:00.000Z"
    }
  ],
  "timestamp": "2025-10-27T18:15:00.000Z"
}
```

---

## 🚨 Alertes

### Log Structuré pour Vector

```json
{
  "event": "seo_page_no_results",
  "severity": "critical",
  "url": "/pieces/...",
  "typeId": 19052,
  "gammeId": 7,
  "piecesCount": 0,
  "message": "🚨 RISQUE DÉSINDEXATION: 0 pièce trouvée",
  "risk": "désindexation SEO",
  "timestamp": "2025-10-27T18:15:00.000Z"
}
```

### Intégration Future

**TODO:**
- [ ] Slack webhook pour alertes critiques
- [ ] Email pour erreurs persistantes
- [ ] Dashboard Grafana pour visualisation

---

## 🧪 Tests & Validation

### Test Manuel

```bash
# Déclencher un monitoring immédiat
curl -X POST http://localhost:3000/api/seo/monitor/trigger?taskType=check-critical-urls

# Vérifier les stats
curl http://localhost:3000/api/seo/monitor/stats | jq

# Voir les jobs récents
curl http://localhost:3000/api/seo/monitor/jobs/recent | jq
```

### Logs

```bash
# Logs du processor
docker-compose logs -f backend | grep SeoMonitorProcessor

# Logs du scheduler
docker-compose logs -f backend | grep SeoMonitorSchedulerService

# Logs Redis BullMQ
docker-compose logs -f redis
```

---

## 📈 Métriques de Succès

| Métrique | Valeur Actuelle |
|----------|-----------------|
| URLs critiques surveillées | 7 |
| Fréquence surveillance critiques | 30 minutes |
| Fréquence échantillon aléatoire | 6 heures |
| Retry automatique | 3 tentatives |
| Backoff exponentiel | 5s, 10s, 20s |
| Jobs conservés (success) | 100 derniers |
| Jobs conservés (failed) | 500 derniers |

---

## 🔄 Migration depuis Cron

### Avant (Cron Shell)

```bash
# crontab
*/30 * * * * /workspaces/nestjs-remix-monorepo/scripts/monitor-pages-no-results.sh >> /var/log/seo-monitor.log 2>&1
```

**Problèmes:**
- ❌ Pas de retry si échec
- ❌ Pas de dashboard
- ❌ Logs difficiles à parser
- ❌ Impossible de lancer manuellement via API
- ❌ Pas de progression visible

### Après (BullMQ)

```typescript
// Automatique au démarrage de l'app
@Injectable()
export class SeoMonitorSchedulerService implements OnModuleInit {
  async onModuleInit() {
    await this.setupCriticalUrlsMonitoring(); // Auto-configure
  }
}
```

**Avantages:**
- ✅ Retry automatique (3x avec backoff)
- ✅ Dashboard API complet
- ✅ Logs JSON structurés
- ✅ API trigger manuel
- ✅ Progression temps réel (job.progress())

---

## 🎯 KPI Dashboard SEO

### Intégration Future

Ajouter au dashboard SEO (`admin.seo.tsx`):

```typescript
{
  id: 6,
  label: 'Pages sans articles',
  value: 0, // Récupéré de l'API monitoring
  target: 0,
  status: 'ok',
  tooltip: 'Pages affichant 0 pièce (risque désindexation)',
}
```

**Endpoint à créer:**
```bash
GET /api/seo/monitor/pages-no-results/count
```

---

## 📦 Dépendances

### Packages Installés

```json
{
  "@nestjs/bull": "^10.2.3", // ⬇️ Downgraded from 11.x (conflict fix)
  "bull": "^4.x",
  "ioredis": "^5.x"
}
```

### Services Requis

- ✅ **Redis**: `docker-compose.redis.yml` (déjà actif)
- ✅ **Supabase**: Pour requêtes `pieces_gamme_vehicule`
- ⚠️ **Vector**: Optionnel (logs structurés)

---

## 🐛 Troubleshooting

### Erreur: "Can't resolve dependencies of BullExplorer"

**Solution:** Downgrade `@nestjs/bull` vers version 10.x

```bash
npm install @nestjs/bull@^10.2.1 --save
```

### Erreur: "CacheProcessor needs IORedisModuleConnectionToken"

**Solution:** Désactiver processors inutilisés temporairement

```typescript
// worker.module.ts
// import { CacheProcessor } from './processors/cache.processor'; // ❌ DÉSACTIVÉ
```

### Redis non accessible

**Vérifier:**
```bash
docker-compose ps | grep redis
docker-compose logs redis

# Test connexion
redis-cli -h localhost -p 6379 ping
```

---

## 🚀 Prochaines Étapes

### Immédiat
- [x] Créer `SeoMonitorProcessor`
- [x] Créer `SeoMonitorSchedulerService`
- [x] Créer API controller
- [x] Configurer jobs répétitifs
- [x] Tester monitoring manuel
- [ ] Ajouter URLs critiques (top 20 Google Analytics)

### Court Terme
- [ ] Intégrer KPI "Pages sans articles" au dashboard
- [ ] Configurer alertes Slack webhook
- [ ] Ajouter fonction SQL `get_random_vehicle_gamme_combinations()`
- [ ] Tests unitaires pour processor
- [ ] Tests E2E pour API

### Moyen Terme
- [ ] Dashboard Grafana pour visualisation
- [ ] Rapports hebdomadaires automatiques
- [ ] Machine Learning pour prédire problèmes
- [ ] A/B testing fréquence monitoring

---

## 📚 Documentation Liée

- `SEO-PROTECTION-ANTI-DESINDEXATION.md` - Protection 8 niveaux
- `FIX-URL-PIECES-NO-RESULTS.md` - Fix parsing URL
- `CICD-WORKER-GUIDE.md` - Guide déploiement workers
- `SEO-V7-ULTIMATE-RECAP.md` - Architecture SEO globale

---

## ✅ Checklist Déploiement

### Pre-Déploiement
- [x] WorkerModule créé et configuré
- [x] SeoMonitorProcessor testé localement
- [x] API endpoints fonctionnels
- [x] Jobs répétitifs configurés
- [ ] URLs critiques définies (top 20 GA)
- [ ] Variables env production validées

### Déploiement
- [ ] Redis accessible depuis workers
- [ ] WorkerModule importé dans AppModule
- [ ] ENV vars configurées (REDIS_HOST, etc.)
- [ ] Docker Compose workers démarré
- [ ] Logs Vector configurés

### Post-Déploiement
- [ ] Vérifier jobs s'exécutent (toutes les 30min)
- [ ] Tester API `/api/seo/monitor/stats`
- [ ] Surveiller Redis memory usage
- [ ] Valider alertes envoyées si 0 articles
- [ ] Monitoring 48h sans erreurs

---

**Date:** 27 Octobre 2025  
**Status:** ✅ Implémenté et testé localement  
**Prêt pour:** Production (après ajout URLs critiques)
