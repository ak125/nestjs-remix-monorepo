# 🚀 Quick Start - Monitoring SEO BullMQ

## ✅ Status Actuel

Le système de monitoring SEO avec BullMQ est **opérationnel** !

```
✅ Backend: http://localhost:3000
✅ Redis: localhost:6379 (Docker)
✅ BullMQ: Configuré et connecté
✅ Jobs répétitifs: Actifs
```

---

## 🔍 Tester le Monitoring

### 1. Vérifier les Stats de la Queue

```bash
curl http://localhost:3000/api/seo/monitor/stats | jq
```

**Réponse attendue:**
```json
{
  "success": true,
  "data": {
    "waiting": 0,
    "active": 0,
    "completed": 0,
    "failed": 0,
    "delayed": 2,
    "total": 2
  }
}
```

### 2. Déclencher un Monitoring Manuel

```bash
# Vérifier les URLs critiques
curl -X POST http://localhost:3000/api/seo/monitor/trigger?taskType=check-critical-urls | jq

# Vérifier un échantillon aléatoire
curl -X POST http://localhost:3000/api/seo/monitor/trigger?taskType=check-random-sample | jq
```

**Réponse attendue:**
```json
{
  "success": true,
  "message": "Job de monitoring lancé",
  "data": {
    "jobId": "1",
    "taskType": "check-critical-urls",
    "status": "queued"
  }
}
```

### 3. Suivre l'Exécution du Job

```bash
# Remplacer 1 par le jobId reçu
curl http://localhost:3000/api/seo/monitor/jobs/1 | jq
```

**Progression:**
```json
{
  "success": true,
  "data": {
    "id": "1",
    "state": "active",
    "progress": 45,
    "attemptsMade": 0
  }
}
```

**Job terminé:**
```json
{
  "success": true,
  "data": {
    "id": "1",
    "state": "completed",
    "progress": 100,
    "result": {
      "totalChecked": 7,
      "okCount": 6,
      "warningCount": 1,
      "errorCount": 0,
      "alerts": [],
      "timestamp": "2025-10-27T18:20:00.000Z"
    }
  }
}
```

### 4. Voir les Jobs Récents

```bash
curl http://localhost:3000/api/seo/monitor/jobs/recent?limit=10 | jq
```

---

## 📅 Jobs Répétitifs Configurés

### URLs Critiques
- **Fréquence:** Toutes les 30 minutes
- **Cron:** `*/30 * * * *`
- **Job ID:** `critical-urls-monitoring`

### Échantillon Aléatoire
- **Fréquence:** Toutes les 6 heures (00:00, 06:00, 12:00, 18:00)
- **Cron:** `0 */6 * * *`
- **Job ID:** `random-sample-monitoring`

---

## 🎯 URLs Critiques Surveillées (7)

1. **Filtre à huile - Renault Clio III 1.5 dCi**
   - `/pieces/filtre-a-huile-7/renault-140/clio-iii-140004/1-5-dci-19052.html`
   - `typeId: 19052, gammeId: 7`

2. **Filtre à huile - Peugeot 208 1.6 BlueHDi 75**
   - `/pieces/filtre-a-huile-7/peugeot-118/208-118001/1-6-bluehdi-75-18781.html`
   - `typeId: 18781, gammeId: 7`

3. **Filtre à huile - Citroën C4 Picasso 2.0 HDi**
   - `/pieces/filtre-a-huile-7/citroen-46/c4-picasso-46012/2-0-hdi-19053.html`
   - `typeId: 19053, gammeId: 7`

4. **Plaquettes de frein - Volkswagen Golf V 1.9 TDI**
   - `/pieces/plaquettes-de-frein-11/volkswagen-166/golf-v-166005/1-9-tdi-19087.html`
   - `typeId: 19087, gammeId: 11`

5. **Plaquettes de frein - Audi A3 2.0 TDI**
   - `/pieces/plaquettes-de-frein-11/audi-11/a3-11001/2-0-tdi-18782.html`
   - `typeId: 18782, gammeId: 11`

6. **Disque de frein - BMW Série 3 320d**
   - `/pieces/disque-de-frein-10/bmw-24/serie-3-24003/320d-18783.html`
   - `typeId: 18783, gammeId: 10`

7. **Amortisseur - Mercedes Classe C 220 CDI**
   - `/pieces/amortisseur-1/mercedes-107/classe-c-107003/220-cdi-18784.html`
   - `typeId: 18784, gammeId: 1`

**⚠️ TODO:** Ajouter top 20 URLs de Google Analytics.

---

## 🔍 Logs en Temps Réel

### Backend Logs
```bash
# Logs du processor
docker-compose logs -f backend | grep SeoMonitorProcessor

# Logs du scheduler
docker-compose logs -f backend | grep SeoMonitorSchedulerService
```

### Redis Monitoring
```bash
# Connexion Redis CLI
redis-cli -h localhost -p 6379

# Voir les queues BullMQ
redis-cli -h localhost -p 6379 KEYS "bull:seo-monitor:*"

# Voir un job spécifique
redis-cli -h localhost -p 6379 HGETALL "bull:seo-monitor:1"
```

---

## 🚨 Alertes

### Format Log Vector

Quand 0 pièce trouvée:
```json
{
  "level": "error",
  "event": "seo_page_no_results",
  "severity": "critical",
  "url": "/pieces/filtre-a-huile-7/renault-140/clio-iii-140004/1-5-dci-19052.html",
  "typeId": 19052,
  "gammeId": 7,
  "piecesCount": 0,
  "message": "🚨 RISQUE DÉSINDEXATION: 0 pièce trouvée",
  "risk": "désindexation SEO",
  "timestamp": "2025-10-27T18:20:00.000Z"
}
```

### Surveillance Logs

```bash
# Filtrer logs critiques SEO
docker-compose logs backend | grep "seo_page_no_results"

# Compter alertes dernière heure
docker-compose logs --since 1h backend | grep -c "seo_page_no_results"
```

---

## 📊 Scénarios de Test

### Test 1: Vérification URL qui retourne des pièces ✅

```bash
# Déclencher monitoring
curl -X POST http://localhost:3000/api/seo/monitor/trigger?taskType=check-critical-urls

# Attendre 10s puis vérifier résultat
sleep 10
curl http://localhost:3000/api/seo/monitor/jobs/recent?limit=1 | jq '.data[0].result'
```

**Résultat attendu:**
```json
{
  "totalChecked": 7,
  "okCount": 7,
  "warningCount": 0,
  "errorCount": 0,
  "alerts": []
}
```

### Test 2: Simuler URL avec 0 pièces ❌

**Modifier temporairement une URL dans le processor:**
```typescript
{
  url: '/pieces/filtre-a-huile-7/test-999/test-999/test-99999.html',
  typeId: 99999, // ID inexistant
  gammeId: 7,
}
```

**Résultat attendu:**
```json
{
  "totalChecked": 7,
  "okCount": 6,
  "errorCount": 1,
  "alerts": [
    {
      "url": "/pieces/filtre-a-huile-7/test-999/test-999/test-99999.html",
      "piecesCount": 0,
      "status": "error",
      "message": "🚨 RISQUE DÉSINDEXATION: 0 pièce trouvée"
    }
  ]
}
```

---

## 🔧 Configuration

### Modifier Fréquence des Jobs

**Fichier:** `backend/src/workers/services/seo-monitor-scheduler.service.ts`

```typescript
// URLs critiques: toutes les 15 minutes au lieu de 30
await this.seoMonitorQueue.add('check-pages', {...}, {
  repeat: {
    cron: '*/15 * * * *', // Modifié
  },
});

// Échantillon aléatoire: toutes les 3 heures au lieu de 6
await this.seoMonitorQueue.add('check-pages', {...}, {
  repeat: {
    cron: '0 */3 * * *', // Modifié
  },
});
```

### Ajouter des URLs Critiques

**Fichier:** `backend/src/workers/processors/seo-monitor.processor.ts`

```typescript
private readonly CRITICAL_URLS = [
  // ... URLs existantes
  
  // Nouvelle URL
  {
    url: '/pieces/kit-distribution-13/renault-140/megane-iii-140009/1-5-dci-19052.html',
    typeId: 19052,
    gammeId: 13,
  },
];
```

---

## 🎯 Prochaines Étapes

### Immédiat ✅
- [x] BullMQ configuré et opérationnel
- [x] Jobs répétitifs actifs
- [x] API endpoints fonctionnels
- [ ] Ajouter top 20 URLs Google Analytics

### Court Terme (1 semaine)
- [ ] Créer fonction SQL `get_random_vehicle_gamme_combinations()`
- [ ] Intégrer KPI "Pages sans articles" au dashboard
- [ ] Tests unitaires processor
- [ ] Alertes Slack webhook

### Moyen Terme (1 mois)
- [ ] Dashboard Grafana
- [ ] Rapports hebdomadaires
- [ ] ML prédiction problèmes

---

## 🐛 Troubleshooting

### Jobs ne s'exécutent pas

```bash
# Vérifier Redis
redis-cli -h localhost -p 6379 ping

# Vérifier queues
curl http://localhost:3000/api/seo/monitor/stats | jq

# Logs backend
docker-compose logs backend | grep "SeoMonitor"
```

### Erreur "ENOTFOUND redis"

**Cause:** Variables `REDIS_HOST` et `REDIS_PORT` manquantes

**Solution:**
```bash
# backend/.env
REDIS_HOST="localhost"
REDIS_PORT="6379"
```

### Job échoue systématiquement

```bash
# Voir raison échec
curl http://localhost:3000/api/seo/monitor/jobs/:jobId | jq '.data.error'

# Voir logs détaillés
docker-compose logs backend | grep "Job #:jobId"
```

---

## ✅ Checklist Validation

- [x] Backend démarre sans erreur
- [x] Redis accessible
- [x] BullMQ connecté
- [x] Jobs répétitifs créés
- [x] API `/stats` retourne données
- [ ] Job manuel s'exécute avec succès
- [ ] Alertes envoyées si 0 pièce
- [ ] Logs Vector structurés

---

**Date:** 27 Octobre 2025  
**Status:** ✅ Opérationnel  
**Version:** BullMQ v10.2.3 + Redis 7
