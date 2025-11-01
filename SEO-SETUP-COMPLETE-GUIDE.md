# 🚀 Guide de configuration complet - A/B Testing Crawl Budget

## ✅ Checklist de progression

- [ ] Étape 1: Créer tables Supabase
- [ ] Étape 2: Installer dépendances npm
- [ ] Étape 3: Créer Service Account Google Cloud
- [ ] Étape 4: Activer APIs Google
- [ ] Étape 5: Configurer credentials .env
- [ ] Étape 6: Tester première expérience

---

## 📋 Étape 1: Créer les tables Supabase

### Option A: Via le Dashboard Supabase (Recommandé)

1. **Ouvrir Supabase** : https://supabase.com/dashboard/project/YOUR_PROJECT

2. **Aller dans SQL Editor** :
   - Menu latéral → SQL Editor
   - Cliquer sur "+ New query"

3. **Copier-coller le SQL** :
   ```sql
   -- Copier le contenu de:
   backend/supabase/migrations/20251027_crawl_budget_experiments.sql
   ```

4. **Exécuter** : Cliquer sur "Run" ou `Ctrl+Enter`

5. **Vérifier** :
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('crawl_budget_experiments', 'crawl_budget_metrics');
   ```
   Devrait retourner 2 lignes.

### Option B: Via psql (Ligne de commande)

```bash
# Récupérer connection string depuis Supabase Dashboard
# Settings → Database → Connection string → URI

psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  -f /workspaces/nestjs-remix-monorepo/backend/supabase/migrations/20251027_crawl_budget_experiments.sql
```

### Option C: Via Supabase CLI

```bash
# Installer Supabase CLI
npm install -g supabase

# Lier le projet
supabase link --project-ref YOUR_PROJECT_REF

# Appliquer migration
supabase db push
```

### ✅ Vérification

```sql
-- Dans SQL Editor Supabase
SELECT COUNT(*) as experiment_count FROM crawl_budget_experiments;
SELECT COUNT(*) as metrics_count FROM crawl_budget_metrics;
```

---

## 📦 Étape 2: Installer les dépendances npm

```bash
cd /workspaces/nestjs-remix-monorepo/backend

# Installer les packages Google
npm install googleapis @google-analytics/data

# Installer Supabase client
npm install @supabase/supabase-js

# Vérifier l'installation
npm list googleapis @google-analytics/data @supabase/supabase-js
```

---

## 🔑 Étape 3: Créer Service Account Google Cloud

### 3.1 Créer un projet Google Cloud (si nécessaire)

1. Aller sur https://console.cloud.google.com/
2. Cliquer sur le sélecteur de projet (en haut)
3. "Nouveau projet" → Nom: `Automecanik SEO`
4. Créer

### 3.2 Créer le Service Account

1. **Navigation** : IAM & Admin → Service Accounts
2. **Créer** : "Create Service Account"
   - Nom: `seo-crawl-budget`
   - Description: `Service account for SEO A/B testing and crawl budget optimization`
3. **Rôle** : `Viewer` (ou aucun rôle, on donnera les permissions spécifiques après)
4. **Continuer** → **Done**

### 3.3 Créer la clé JSON

1. Cliquer sur le service account créé
2. Onglet "Keys" → "Add Key" → "Create new key"
3. Type: **JSON**
4. Télécharger le fichier `seo-crawl-budget-xxxxx.json`

### 3.4 Extraire les informations

Ouvrir le fichier JSON et copier:
```json
{
  "client_email": "seo-crawl-budget@automecanik-seo-xxxxx.iam.gserviceaccount.com",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQI...\n-----END PRIVATE KEY-----\n"
}
```

⚠️ **Garder ce fichier en sécurité** (ne jamais le commit dans Git)

---

## 🔓 Étape 4: Activer les APIs Google

### 4.1 API Library

1. Aller sur https://console.cloud.google.com/apis/library
2. Chercher et activer:

**A. Google Search Console API**
   - Chercher: "Search Console API"
   - Cliquer sur "Google Search Console API"
   - **Enable**

**B. Google Analytics Data API**
   - Chercher: "Analytics Data API"
   - Cliquer sur "Google Analytics Data API"  
   - **Enable**

### 4.2 Vérifier les APIs activées

```bash
# Via gcloud CLI (optionnel)
gcloud services list --enabled | grep -E "searchconsole|analyticsdata"
```

Devrait afficher:
```
searchconsole.googleapis.com
analyticsdata.googleapis.com
```

---

## 🔐 Étape 5: Donner accès au Service Account

### 5.1 Google Search Console

1. Ouvrir https://search.google.com/search-console
2. Sélectionner `https://www.automecanik.com/`
3. **Paramètres** (⚙️) → **Utilisateurs et autorisations**
4. **Ajouter un utilisateur**:
   - Email: `seo-crawl-budget@automecanik-seo-xxxxx.iam.gserviceaccount.com`
   - Autorisation: **Utilisateur complet** (ou Propriétaire)
5. **Ajouter**

### 5.2 Google Analytics 4

1. Ouvrir https://analytics.google.com/
2. **Admin** (⚙️ en bas à gauche)
3. Colonne **Propriété** → **Accès à la propriété**
4. **Ajouter des utilisateurs** (+)
   - Email: `seo-crawl-budget@automecanik-seo-xxxxx.iam.gserviceaccount.com`
   - Rôles: **Lecteur** ✅
   - Décocher "Notifier ce nouvel utilisateur par e-mail"
5. **Ajouter**

### 5.3 Récupérer l'ID de propriété GA4

1. Google Analytics → **Admin**
2. Colonne **Propriété** → **Informations de la propriété**
3. Copier **ID de la propriété** (ex: `123456789`)

---

## ⚙️ Étape 6: Configurer les credentials dans .env

```bash
cd /workspaces/nestjs-remix-monorepo/backend

# Éditer .env
nano .env
```

### Ajouter ces lignes :

```bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🧪 SEO CRAWL BUDGET A/B TESTING
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ey...

# Google Search Console
GSC_SITE_URL=https://www.automecanik.com
GSC_CLIENT_EMAIL=seo-crawl-budget@automecanik-seo-xxxxx.iam.gserviceaccount.com
GSC_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEF...\n-----END PRIVATE KEY-----\n"

# Google Analytics 4
GA4_PROPERTY_ID=123456789
GA4_CLIENT_EMAIL=seo-crawl-budget@automecanik-seo-xxxxx.iam.gserviceaccount.com
GA4_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEF...\n-----END PRIVATE KEY-----\n"

# Sitemap
SITEMAP_BASE_URL=https://automecanik.com
```

### ⚠️ Important pour PRIVATE_KEY

La clé privée doit contenir les caractères `\n` littéraux (pas de vraies nouvelles lignes).

**Si votre clé a des vraies nouvelles lignes**, remplacez-les :
```bash
# Exemple de transformation
"-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgk...
XYZ123
-----END PRIVATE KEY-----"

# Devient :
"-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgk...\nXYZ123\n-----END PRIVATE KEY-----\n"
```

### 🔍 Trouver SUPABASE_SERVICE_ROLE_KEY

1. Supabase Dashboard → Settings → API
2. Section "Project API keys"
3. Copier **service_role key** (secret)

---

## 🧪 Étape 7: Tester le système

### 7.1 Redémarrer le backend

```bash
cd /workspaces/nestjs-remix-monorepo/backend
npm run dev
```

Vérifier qu'il n'y a pas d'erreurs de connexion Supabase.

### 7.2 Tester l'accès Supabase

```bash
curl http://localhost:3000/seo-logs/crawl-budget/stats | jq
```

**Résultat attendu** :
```json
{
  "success": true,
  "data": {
    "total": 0,
    "running": 0,
    "completed": 0,
    "draft": 0
  }
}
```

### 7.3 Créer votre première expérience

```bash
curl -X POST http://localhost:3000/seo-logs/crawl-budget/experiments \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test exclusion pneus anciens",
    "description": "Exclure 10000 URLs de pneus d'\''occasion pour améliorer le crawl budget",
    "action": "exclude",
    "targetFamilies": ["PNEU_VIEUX", "PNEU_OCCASION"],
    "durationDays": 30
  }' | jq
```

**Résultat attendu** :
```json
{
  "success": true,
  "message": "Expérience créée avec succès",
  "data": {
    "id": "abc-123-def-456",
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

### 7.4 Vérifier dans Supabase

```sql
-- Dans SQL Editor
SELECT * FROM crawl_budget_experiments ORDER BY created_at DESC LIMIT 1;
```

### 7.5 Récupérer l'expérience

```bash
# Remplacer {id} par l'ID retourné
curl http://localhost:3000/seo-logs/crawl-budget/experiments/{id} | jq
```

### 7.6 Télécharger le sitemap filtré

```bash
curl http://localhost:3000/seo-logs/crawl-budget/experiments/{id}/sitemap.xml \
  > /tmp/sitemap-experiment.xml

# Vérifier
head -20 /tmp/sitemap-experiment.xml
```

### 7.7 Activer l'expérience

```bash
curl -X PATCH http://localhost:3000/seo-logs/crawl-budget/experiments/{id}/status \
  -H "Content-Type: application/json" \
  -d '{"status": "running"}' | jq
```

### 7.8 Collecter les métriques (mock data pour l'instant)

```bash
curl -X POST http://localhost:3000/seo-logs/crawl-budget/experiments/{id}/collect-metrics | jq
```

### 7.9 Voir les recommandations

```bash
curl http://localhost:3000/seo-logs/crawl-budget/experiments/{id}/recommendations | jq
```

---

## 🐛 Troubleshooting

### Erreur: "relation does not exist"
```bash
# Les tables ne sont pas créées
# → Retourner à l'Étape 1
```

### Erreur: "SUPABASE_URL not set"
```bash
# Variables .env pas chargées
grep SUPABASE /workspaces/nestjs-remix-monorepo/backend/.env
```

### Erreur: "GSC API: unauthorized"
```bash
# Service Account pas ajouté dans GSC
# → Retourner à l'Étape 5.1
```

### Erreur: "Invalid private key"
```bash
# Vérifier les \n dans la clé
echo $GSC_PRIVATE_KEY | head -c 100
# Devrait afficher: -----BEGIN PRIVATE KEY-----\nMIIE...
```

### Mock data au lieu de vraies données
```bash
# Normal ! Les services utilisent mock data par défaut
# Pour activer les vraies APIs, modifier:
# backend/src/modules/seo-logs/services/crawl-budget-integrations.service.ts
```

---

## ✅ Checklist finale

- [ ] Tables Supabase créées et visibles
- [ ] Dépendances npm installées
- [ ] Service Account créé et clé JSON téléchargée
- [ ] APIs activées (Search Console + Analytics Data)
- [ ] Service Account ajouté dans GSC (Utilisateur complet)
- [ ] Service Account ajouté dans GA4 (Lecteur)
- [ ] ID de propriété GA4 récupéré
- [ ] Variables .env configurées
- [ ] Backend redémarré sans erreurs
- [ ] Endpoint /stats retourne 200
- [ ] Première expérience créée avec succès
- [ ] Expérience visible dans Supabase
- [ ] Sitemap filtré téléchargeable

---

## 🎉 Félicitations !

Votre système d'A/B Testing du Crawl Budget est maintenant **opérationnel** !

### Prochaines étapes

1. **Soumettre le sitemap** à Google Search Console
2. **Attendre 7 jours** pour collecter des données
3. **Analyser les recommandations** automatiques
4. **Décider** : garder l'exclusion ou réintégrer

### Workflow complet

```
Créer expérience → Télécharger sitemap → Soumettre GSC → Activer
    ↓
Collecter métriques quotidiennes (automatique avec BullMQ)
    ↓
Analyser après 30j → Recommandations → Décision finale
```

🚀 **Le système est prêt à optimiser votre crawl budget !**
