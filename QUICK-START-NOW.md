# 🎯 Actions immédiates - Par ordre de priorité

## ✅ Étape 1: Configuration Supabase (5 minutes)

### A. Créer les tables

1. **Ouvrir** : https://supabase.com/dashboard
2. **Sélectionner votre projet**
3. **SQL Editor** (menu gauche) → **New query**
4. **Copier-coller** ce SQL :

```sql
-- Table des expériences
CREATE TABLE IF NOT EXISTS crawl_budget_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  action TEXT NOT NULL CHECK (action IN ('exclude', 'include', 'reduce')),
  target_families TEXT[] NOT NULL,
  reduction_percent INTEGER CHECK (reduction_percent >= 0 AND reduction_percent <= 100),
  duration_days INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed')),
  baseline JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table des métriques
CREATE TABLE IF NOT EXISTS crawl_budget_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES crawl_budget_experiments(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_crawled_urls INTEGER NOT NULL DEFAULT 0,
  crawl_requests_count INTEGER NOT NULL DEFAULT 0,
  avg_crawl_rate DECIMAL(10, 2) NOT NULL DEFAULT 0,
  indexed_urls INTEGER NOT NULL DEFAULT 0,
  indexation_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
  organic_sessions INTEGER,
  organic_conversions INTEGER,
  family_metrics JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(experiment_id, date)
);

-- Index
CREATE INDEX idx_experiments_status ON crawl_budget_experiments(status);
CREATE INDEX idx_experiments_created_at ON crawl_budget_experiments(created_at DESC);
CREATE INDEX idx_metrics_experiment_id ON crawl_budget_metrics(experiment_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_crawl_budget_experiments_updated_at
  BEFORE UPDATE ON crawl_budget_experiments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE crawl_budget_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawl_budget_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for service role" ON crawl_budget_experiments FOR ALL TO service_role USING (true);
CREATE POLICY "Allow all for service role metrics" ON crawl_budget_metrics FOR ALL TO service_role USING (true);
```

5. **Exécuter** : Cliquer sur "Run" ou `Ctrl+Enter`
6. **Vérifier** : Devrait afficher "Success. No rows returned"

### B. Récupérer les credentials

1. **Settings** → **API**
2. **Copier** :
   - `URL` (ex: `https://abcdefgh.supabase.co`)
   - `service_role` key (section "Project API keys")

### C. Ajouter dans .env

```bash
cd /workspaces/nestjs-remix-monorepo/backend
nano .env
```

Ajouter:
```bash
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## ✅ Étape 2: Tester sans Google Cloud (OPTIONNEL)

Vous pouvez **déjà tester** le système avec des **mock data** :

```bash
# Redémarrer backend
cd /workspaces/nestjs-remix-monorepo/backend
npm run dev

# Dans un autre terminal
bash /workspaces/nestjs-remix-monorepo/scripts/test-crawl-budget.sh
```

Le système fonctionnera avec des données simulées ! ✅

---

## ⏳ Étape 3: Configuration Google Cloud (15 minutes)

### Pourquoi c'est optionnel pour l'instant ?
- Le système utilise des **mock data** par défaut
- Vous pouvez tester tout le workflow
- Les vraies données Google viendront plus tard

### Quand configurer Google Cloud ?
- Quand vous voulez des **vraies métriques** (crawl rate, trafic)
- Avant de lancer une **vraie expérience** en production

### Guide rapide

**A. Créer Service Account**
1. https://console.cloud.google.com/iam-admin/serviceaccounts
2. "Create Service Account"
3. Nom: `seo-crawl-budget`
4. Create & Continue → Done
5. Cliquer sur le service account → Keys → Add Key → Create new key (JSON)

**B. Activer APIs**
1. https://console.cloud.google.com/apis/library
2. Chercher "Search Console API" → Enable
3. Chercher "Analytics Data API" → Enable

**C. Donner accès**

Search Console:
- https://search.google.com/search-console
- Paramètres → Utilisateurs → Ajouter
- Email: `seo-crawl-budget@...`
- Rôle: Utilisateur complet

Analytics:
- https://analytics.google.com/
- Admin → Accès propriété → Ajouter
- Email: `seo-crawl-budget@...`
- Rôle: Lecteur

**D. Ajouter dans .env**
```bash
GSC_SITE_URL=https://www.automecanik.com
GSC_CLIENT_EMAIL=seo-crawl-budget@...iam.gserviceaccount.com
GSC_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

GA4_PROPERTY_ID=123456789
GA4_CLIENT_EMAIL=seo-crawl-budget@...iam.gserviceaccount.com
GA4_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

---

## 🚀 Test final

```bash
# Avec Supabase seulement (mock data Google)
bash /workspaces/nestjs-remix-monorepo/scripts/test-crawl-budget.sh

# Résultat attendu:
# ✅ Stats endpoint OK
# ✅ Expérience créée
# ✅ Expérience récupérée
# ✅ Sitemap généré
# ✅ Expérience activée
# ✅ Recommandations récupérées
```

---

## 📊 Ordre de priorité

1. **URGENT** : Créer tables Supabase (5 min) → Système fonctionne
2. **IMPORTANT** : Tester avec mock data (2 min) → Valider workflow
3. **OPTIONNEL** : Google Cloud credentials (15 min) → Vraies données

---

## 🎯 Quick Start (version minimale)

```bash
# 1. Créer tables Supabase (via dashboard)
# 2. Ajouter SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY dans .env
# 3. Tester:
bash scripts/test-crawl-budget.sh
```

**C'est tout** ! Le système fonctionne avec mock data. Google Cloud peut attendre. 🚀
