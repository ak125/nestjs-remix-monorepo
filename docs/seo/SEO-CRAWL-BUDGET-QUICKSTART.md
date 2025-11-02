# 🚀 Guide de démarrage rapide - A/B Testing Crawl Budget

## 📋 Prérequis

1. **Supabase** configuré avec les tables créées
2. **Google Cloud Project** avec:
   - Search Console API activée
   - Analytics Data API activée
   - Service Account créé avec les permissions
3. **Variables d'environnement** configurées

## 🛠️ Installation

### 1. Créer les tables Supabase

```sql
-- Exécuter le script SQL
psql -h your-project.supabase.co -U postgres -d postgres -f backend/supabase/migrations/20251027_crawl_budget_experiments.sql
```

Ou via le dashboard Supabase:
- Aller dans SQL Editor
- Copier/coller le contenu de `20251027_crawl_budget_experiments.sql`
- Exécuter

### 2. Installer les dépendances

```bash
cd backend
npm install @supabase/supabase-js
npm install googleapis @google-analytics/data
```

### 3. Configurer les variables d'environnement

```bash
cp .env.crawl-budget.example .env
# Éditer .env avec vos credentials
```

### 4. Configurer Google Cloud Service Account

1. Créer un Service Account dans Google Cloud Console
2. Activer les APIs:
   - Google Search Console API
   - Google Analytics Data API
3. Télécharger le fichier JSON des credentials
4. Extraire `client_email` et `private_key`
5. Ajouter le Service Account comme utilisateur dans:
   - Google Search Console (automecanik.com)
   - Google Analytics 4 (propriété)

## 🧪 Créer votre première expérience

### 1. Créer une expérience

```bash
curl -X POST http://localhost:3000/seo-logs/crawl-budget/experiments \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test exclusion pneus anciens",
    "description": "Exclure 10k URLs de pneus d'occasion pour améliorer l'indexation",
    "action": "exclude",
    "targetFamilies": ["PNEU_VIEUX", "PNEU_OCCASION"],
    "durationDays": 30
  }'
```

Réponse:
```json
{
  "success": true,
  "message": "Expérience créée avec succès",
  "data": {
    "id": "abc123-def456",
    "name": "Test exclusion pneus anciens",
    "status": "draft",
    "baseline": {
      "period": "30d",
      "crawl": {
        "totalCrawledUrls": 1200,
        "indexationRate": 85
      }
    }
  }
}
```

### 2. Télécharger le sitemap filtré

```bash
curl http://localhost:3000/seo-logs/crawl-budget/experiments/abc123-def456/sitemap.xml \
  > sitemap-experiment.xml
```

### 3. Soumettre à Google Search Console

**Méthode 1: Via le dashboard GSC**
- Ouvrir https://search.google.com/search-console
- Sélectionner `automecanik.com`
- Aller dans **Sitemaps**
- Ajouter le sitemap: `https://automecanik.com/sitemap-experiment.xml`

**Méthode 2: Via API** (TODO: implémenter l'endpoint automatique)

### 4. Activer l'expérience

```bash
curl -X PATCH http://localhost:3000/seo-logs/crawl-budget/experiments/abc123-def456/status \
  -H "Content-Type: application/json" \
  -d '{"status": "running"}'
```

### 5. Collecter les métriques quotidiennes

**Automatique** (via cron ou BullMQ):
```bash
# Ajouter un job quotidien pour collecter métriques
```

**Manuel**:
```bash
curl -X POST http://localhost:3000/seo-logs/crawl-budget/experiments/abc123-def456/collect-metrics
```

### 6. Voir les métriques

```bash
curl http://localhost:3000/seo-logs/crawl-budget/experiments/abc123-def456/metrics?period=7d | jq
```

### 7. Obtenir les recommandations

```bash
curl http://localhost:3000/seo-logs/crawl-budget/experiments/abc123-def456/recommendations | jq
```

Réponse:
```json
{
  "success": true,
  "data": [
    {
      "action": "KEEP_EXCLUSION",
      "reason": "L'indexation s'est améliorée de +8.5%",
      "confidence": 0.9
    }
  ]
}
```

## 📊 Endpoints disponibles

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/experiments` | Créer expérience |
| GET | `/experiments` | Liste expériences |
| GET | `/experiments/:id` | Détails expérience |
| GET | `/experiments/:id/metrics` | Métriques |
| PATCH | `/experiments/:id/status` | Changer statut |
| GET | `/experiments/:id/sitemap.xml` | Sitemap filtré |
| GET | `/experiments/:id/recommendations` | Recommandations |
| POST | `/experiments/:id/collect-metrics` | Collecter métriques |
| GET | `/stats` | Stats globales |

## 🔍 Vérifications

### Vérifier les tables Supabase

```sql
SELECT * FROM crawl_budget_experiments ORDER BY created_at DESC LIMIT 5;
SELECT * FROM crawl_budget_metrics ORDER BY date DESC LIMIT 10;
```

### Vérifier les logs backend

```bash
# Chercher les logs de collecte baseline
grep "Expérience créée" logs/backend.log

# Chercher les logs GSC/GA4
grep "GSC API\|GA4 API" logs/backend.log
```

### Tester GSC API

```bash
# TODO: Endpoint de test
curl http://localhost:3000/seo-logs/crawl-budget/test/gsc
```

### Tester GA4 API

```bash
# TODO: Endpoint de test
curl http://localhost:3000/seo-logs/crawl-budget/test/ga4
```

## 🐛 Troubleshooting

### Erreur: "SUPABASE_URL not set"
```bash
# Vérifier .env
cat backend/.env | grep SUPABASE
```

### Erreur: "GSC API: unauthorized"
```bash
# Vérifier que le Service Account est ajouté dans GSC
# Vérifier que la clé privée est correcte (avec \n)
```

### Erreur: "No metrics collected"
```bash
# Vérifier que l'expérience est en statut "running"
curl http://localhost:3000/seo-logs/crawl-budget/experiments/YOUR_ID | jq '.data.status'

# Collecter manuellement
curl -X POST http://localhost:3000/seo-logs/crawl-budget/experiments/YOUR_ID/collect-metrics
```

## 📚 Prochaines étapes

1. Implémenter vraie intégration GSC API (remplacer mock data)
2. Implémenter vraie intégration GA4 API (remplacer mock data)
3. Ajouter collecte automatique quotidienne (BullMQ)
4. Créer dashboard Grafana pour visualiser résultats
5. Ajouter alertes (email/Slack) sur changements significatifs
6. Implémenter soumission automatique sitemap via GSC API
