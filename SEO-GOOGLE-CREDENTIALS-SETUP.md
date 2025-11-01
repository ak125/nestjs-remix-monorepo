# 🔑 Configuration Google Search Console + Google Analytics 4

## ✅ Vérifications effectuées

- ✅ Google Search Console: `automecanik.seo@gmail.com` (Propriétaire)
- ✅ Google Analytics 4: Flux `Automecanik - GA4`
- ✅ Site vérifié: `https://www.automecanik.com/`

## 🔧 Étapes de configuration

### 1. Créer un Service Account Google Cloud

**Option A: Via Console Google Cloud** (recommandé)

1. Aller sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créer un nouveau projet ou sélectionner un projet existant
3. Activer les APIs:
   - Google Search Console API
   - Google Analytics Data API

4. Créer un Service Account:
   - Menu → IAM & Admin → Service Accounts
   - Cliquer "Create Service Account"
   - Nom: `seo-crawl-budget-service`
   - Rôle: `Viewer` (pour GSC + GA4)
   - Créer et télécharger la clé JSON

5. Récupérer les informations du JSON:
```json
{
  "client_email": "seo-crawl-budget@your-project.iam.gserviceaccount.com",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
}
```

**Option B: Via gcloud CLI**

```bash
# Créer service account
gcloud iam service-accounts create seo-crawl-budget \
  --description="Service account for SEO A/B testing" \
  --display-name="SEO Crawl Budget Service"

# Créer clé
gcloud iam service-accounts keys create credentials.json \
  --iam-account=seo-crawl-budget@your-project.iam.gserviceaccount.com

# Activer APIs
gcloud services enable searchconsole.googleapis.com
gcloud services enable analyticsdata.googleapis.com
```

### 2. Donner accès au Service Account

#### A. Google Search Console

1. Ouvrir [Google Search Console](https://search.google.com/search-console)
2. Sélectionner la propriété `https://www.automecanik.com/`
3. Paramètres → Utilisateurs et autorisations
4. Ajouter un utilisateur:
   - Email: `seo-crawl-budget@your-project.iam.gserviceaccount.com`
   - Autorisation: **Propriétaire** ou **Utilisateur complet**

#### B. Google Analytics 4

1. Ouvrir [Google Analytics](https://analytics.google.com/)
2. Admin → Accès aux comptes (ou Accès à la propriété)
3. Ajouter des utilisateurs:
   - Email: `seo-crawl-budget@your-project.iam.gserviceaccount.com`
   - Rôles: **Lecteur** minimum

### 3. Récupérer l'ID de propriété GA4

1. Google Analytics → Admin
2. Informations de la propriété
3. Copier **ID de la propriété** (format: `123456789`)

### 4. Configurer les variables d'environnement

```bash
# backend/.env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Google Search Console
GSC_SITE_URL=https://www.automecanik.com
GSC_CLIENT_EMAIL=seo-crawl-budget@your-project.iam.gserviceaccount.com
GSC_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgk...\n-----END PRIVATE KEY-----\n"

# Google Analytics 4
GA4_PROPERTY_ID=123456789
GA4_CLIENT_EMAIL=seo-crawl-budget@your-project.iam.gserviceaccount.com
GA4_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgk...\n-----END PRIVATE KEY-----\n"
```

⚠️ **Important**: La clé privée doit contenir les `\n` (newlines) littéraux

### 5. Tester la connexion

```bash
# Test GSC
curl http://localhost:3000/seo-logs/crawl-budget/test/gsc

# Test GA4
curl http://localhost:3000/seo-logs/crawl-budget/test/ga4
```

## 🔍 Trouver les informations existantes

### A. ID de propriété GA4

**Via l'interface**:
1. Google Analytics → Admin
2. Propriété: "Automecanik - GA4"
3. Informations de la propriété → **ID de la propriété**

**Via l'URL**:
```
https://analytics.google.com/analytics/web/#/p123456789/reports/...
                                              ^^^^^^^^^^
                                              Votre Property ID
```

### B. URL du site GSC

Déjà connu: `https://www.automecanik.com/`

### C. Vérifier les flux de données GA4

1. Google Analytics → Admin
2. Flux de données
3. Copier l'**ID de flux** (optionnel, pour filtres avancés)

## 🧪 Test rapide sans Service Account (pour développement)

Si vous voulez tester rapidement sans Service Account, vous pouvez utiliser l'**API Explorer** de Google:

1. [Google Search Console API Explorer](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)
2. [Google Analytics Data API Explorer](https://ga-dev-tools.google/ga4/query-explorer/)

Ou utiliser les **mock data** déjà présents dans le code pour tester le workflow complet.

## 📊 Exemple de requête GSC

```javascript
const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GSC_CLIENT_EMAIL,
    private_key: process.env.GSC_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
});

const searchconsole = google.searchconsole({
  version: 'v1',
  auth,
});

const response = await searchconsole.searchanalytics.query({
  siteUrl: process.env.GSC_SITE_URL,
  requestBody: {
    startDate: '2025-10-01',
    endDate: '2025-10-27',
    dimensions: ['page'],
    rowLimit: 1000,
  },
});
```

## 📈 Exemple de requête GA4

```javascript
const { BetaAnalyticsDataClient } = require('@google-analytics/data');

const analyticsDataClient = new BetaAnalyticsDataClient({
  credentials: {
    client_email: process.env.GA4_CLIENT_EMAIL,
    private_key: process.env.GA4_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
});

const [response] = await analyticsDataClient.runReport({
  property: `properties/${process.env.GA4_PROPERTY_ID}`,
  dateRanges: [
    {
      startDate: '2025-10-01',
      endDate: '2025-10-27',
    },
  ],
  dimensions: [{ name: 'sessionSource' }],
  metrics: [{ name: 'sessions' }],
  dimensionFilter: {
    filter: {
      fieldName: 'sessionSource',
      stringFilter: { value: 'google' },
    },
  },
});
```

## 🔐 Sécurité

- ✅ **Ne jamais commit** les credentials dans Git
- ✅ Ajouter `.env` à `.gitignore`
- ✅ Utiliser variables d'environnement en production
- ✅ Limiter les permissions du Service Account au minimum
- ✅ Rotate les clés régulièrement (tous les 90 jours)

## 📝 Checklist finale

- [ ] Service Account créé dans Google Cloud
- [ ] APIs activées (Search Console + Analytics Data)
- [ ] Clé JSON téléchargée
- [ ] Service Account ajouté dans GSC (Utilisateur complet)
- [ ] Service Account ajouté dans GA4 (Lecteur)
- [ ] ID de propriété GA4 récupéré
- [ ] Variables `.env` configurées
- [ ] Dépendances installées (`googleapis`, `@google-analytics/data`)
- [ ] Test de connexion réussi

## 🚀 Prochaine étape

Une fois configuré, vous pourrez:
1. Créer une expérience A/B
2. Collecter automatiquement les métriques de crawl (GSC)
3. Collecter automatiquement le trafic organique (GA4)
4. Recevoir des recommandations basées sur les données réelles

Le système basculera automatiquement des **mock data** aux **vraies données** dès que les credentials seront configurés ! 🎉
