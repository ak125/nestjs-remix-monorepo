# 🚀 CI/CD & CRON DEPLOYMENT GUIDE

## 📋 Overview

This guide covers the complete CI/CD setup for automated sitemap generation using:
- ✅ **Turbo Tasks** (monorepo task orchestration)
- ✅ **Cron Jobs** (scheduled generation)
- ✅ **GitHub Actions** (CI/CD automation)
- ✅ **Docker Worker** (isolated cron container)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│              CI/CD ARCHITECTURE                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────┐    ┌──────────────┐             │
│  │ GitHub       │───▶│ GitHub       │             │
│  │ Push/Tag     │    │ Actions      │             │
│  └──────────────┘    └──────┬───────┘             │
│                              │                      │
│                              ▼                      │
│  ┌──────────────────────────────────┐              │
│  │ Turbo Build & Test               │              │
│  │ - Backend build                  │              │
│  │ - Docker services                │              │
│  │ - Generate sitemaps              │              │
│  └──────────────┬───────────────────┘              │
│                 │                                   │
│                 ▼                                   │
│  ┌──────────────────────────────────┐              │
│  │ Deploy to S3/CDN                 │              │
│  │ - Upload .xml.gz files           │              │
│  │ - Invalidate cache               │              │
│  └──────────────────────────────────┘              │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  PRODUCTION CRON                                    │
│                                                     │
│  ┌──────────────┐    ┌──────────────┐             │
│  │ Docker Cron  │───▶│ NestJS API   │             │
│  │ Worker       │    │ /sitemap-v2  │             │
│  └──────────────┘    └──────────────┘             │
│         │                                           │
│         ├─▶ 03:00 Daily (Full generation)          │
│         ├─▶ */6h (Delta updates)                   │
│         └─▶ Weekly (Cleanup)                       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 📦 Turbo Tasks

### Configuration (`turbo.json`)

```json
{
  "pipeline": {
    "sitemap:generate": {
      "cache": false,
      "outputs": ["public/sitemaps/**"]
    },
    "sitemap:delta": {
      "cache": false
    },
    "sitemap:streaming": {
      "cache": false
    },
    "sitemap:validate": {
      "dependsOn": ["sitemap:generate"]
    }
  }
}
```

### Usage

```bash
# Générer tous les sitemaps
pnpm turbo run sitemap:generate

# Générer delta uniquement
pnpm turbo run sitemap:delta

# Valider XML
pnpm turbo run sitemap:validate
```

---

## 🕒 Cron Jobs

### Option 1: System Crontab (Simple)

**Installation:**

```bash
# Copier l'exemple
cp crontab.example /tmp/automecanik-cron

# Éditer si nécessaire
nano /tmp/automecanik-cron

# Installer
crontab /tmp/automecanik-cron

# Vérifier
crontab -l
```

**Crontab configuration:**

```cron
# Génération nightly à 3h
0 3 * * * /path/to/scripts/cron-sitemap-nightly.sh

# Delta toutes les 6h
0 */6 * * * curl -X POST http://localhost:3000/sitemap-v2/delta/generate

# Cleanup hebdomadaire
0 4 * * 0 curl -X POST http://localhost:3000/sitemap-v2/delta/cleanup
```

### Option 2: Docker Cron Worker (Recommandé)

**Avantages:**
- ✅ Isolation complète
- ✅ Logs centralisés
- ✅ Restart automatique
- ✅ Health checks

**Démarrage:**

```bash
# Démarrer le worker
docker-compose -f docker-compose.cron.yml up -d

# Vérifier status
docker-compose -f docker-compose.cron.yml ps

# Voir logs
docker-compose -f docker-compose.cron.yml logs -f cron-worker
```

**Configuration:**

```yaml
# docker-compose.cron.yml
services:
  cron-worker:
    image: node:20-alpine
    restart: unless-stopped
    volumes:
      - ./:/app
      - ./logs/cron:/app/logs/cron
    environment:
      - TZ=Europe/Paris
      - NESTJS_API_URL=http://backend:3000
    command: |
      apk add dcron curl jq &&
      echo '0 3 * * * /app/scripts/cron-sitemap-nightly.sh' | crontab - &&
      crond -f -l 2
```

---

## 🤖 GitHub Actions

### Workflow 1: Nightly Generation

**Fichier:** `.github/workflows/sitemap-nightly.yml`

**Déclencheurs:**
- 🕒 **Schedule:** Tous les jours à 3h UTC
- 🏷️ **Tags:** Sur release (v*.*.*)
- 🖱️ **Manual:** Via workflow_dispatch

**Étapes:**

1. **Setup** (Node.js, pnpm, dependencies)
2. **Build** (Turbo build backend)
3. **Services** (Docker: Redis, Meilisearch)
4. **Generate** (Delta + Streaming sitemaps)
5. **Validate** (XML validation, size checks)
6. **Upload** (S3 sync, CDN invalidation)
7. **Notify** (Slack/Discord)

**Usage manuel:**

```bash
# Via GitHub UI
Actions → Generate Sitemaps (Nightly) → Run workflow

# Via GitHub CLI
gh workflow run sitemap-nightly.yml \
  -f type=all \
  -f includeHreflang=true \
  -f includeImages=true
```

### Workflow 2: Hourly Delta Updates

**Fichier:** `.github/workflows/sitemap-delta-hourly.yml`

**Déclencheurs:**
- 🕒 **Schedule:** Toutes les heures
- 🖱️ **Manual:** Via workflow_dispatch

**Étapes:**

1. Appel API `/sitemap-v2/delta/generate`
2. Récupération statistiques
3. Notification si activité élevée (>1000 changements)

---

## 🔐 Secrets GitHub

### Configuration requise

```bash
# GitHub → Settings → Secrets → Actions

# API Configuration
API_BASE_URL=https://api.automecanik.com
API_TOKEN=your_secret_token

# Database
DATABASE_URL=postgresql://...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key

# AWS S3 (optionnel)
AWS_ACCESS_KEY_ID=AKIAXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxx

# Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

### Ajout via GitHub CLI

```bash
gh secret set API_BASE_URL --body "https://api.automecanik.com"
gh secret set API_TOKEN --body "$(openssl rand -hex 32)"
gh secret set SLACK_WEBHOOK_URL --body "https://hooks.slack.com/..."
```

---

## 📊 Monitoring

### Logs

**Cron logs:**

```bash
# Logs Docker worker
docker-compose -f docker-compose.cron.yml logs -f

# Logs système (si crontab)
tail -f /var/log/cron.log
tail -f logs/cron/sitemap-nightly-*.log
```

**GitHub Actions logs:**

```bash
# Via GitHub CLI
gh run list --workflow=sitemap-nightly.yml
gh run view <run-id> --log
```

### Métriques

**Dashboard à créer:**

- ⏱️ Durée génération (delta/streaming)
- 📦 Nombre fichiers générés
- 💾 Taille totale (avant/après compression)
- 🔄 Changements delta par jour
- ❌ Taux d'erreur

**Intégration Prometheus:**

```typescript
// backend/src/modules/seo/services/sitemap-metrics.service.ts
import { Counter, Histogram } from 'prom-client';

export class SitemapMetricsService {
  private readonly generationCounter = new Counter({
    name: 'sitemap_generation_total',
    help: 'Total sitemap generations',
    labelNames: ['type', 'status'],
  });
  
  private readonly generationDuration = new Histogram({
    name: 'sitemap_generation_duration_seconds',
    help: 'Sitemap generation duration',
    labelNames: ['type'],
    buckets: [1, 5, 10, 30, 60, 120, 300],
  });
}
```

---

## 🚨 Alerting

### Slack Notifications

**Configuration:**

1. Créer Webhook Slack : https://api.slack.com/messaging/webhooks
2. Ajouter secret GitHub : `SLACK_WEBHOOK_URL`
3. Activer dans workflows

**Notifications automatiques:**
- ✅ Génération réussie
- ❌ Génération échouée
- ⚠️ Activité delta élevée (>1000 changes)
- 📊 Rapport quotidien

### Email Alerts

**Configuration crontab:**

```cron
MAILTO=devops@automecanik.com

0 3 * * * /path/to/cron-sitemap-nightly.sh
```

---

## 🔄 Deployment Workflow

### Development

```bash
# Local testing
pnpm turbo run sitemap:generate

# Docker testing
docker-compose -f docker-compose.cron.yml up --build
```

### Staging

```bash
# Deploy to staging
git push origin develop

# GitHub Actions runs automatically
# Generates sitemaps on staging API
```

### Production

```bash
# Create release tag
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# GitHub Actions workflow triggered
# - Build & test
# - Generate sitemaps
# - Upload to S3
# - Invalidate CDN cache
# - Notify Slack
```

---

## 📋 Checklist Deployment

### Initial Setup

- [ ] Copier `crontab.example` → Production server
- [ ] Configurer secrets GitHub
- [ ] Tester workflows manuellement
- [ ] Vérifier logs cron worker
- [ ] Setup Slack webhook
- [ ] Configurer S3 bucket (optionnel)

### Validation

- [ ] Cron jobs s'exécutent à l'heure
- [ ] Fichiers générés dans `/public/sitemaps/`
- [ ] XML valide (xmllint)
- [ ] Compression effective (>80%)
- [ ] Logs sans erreur
- [ ] Notifications Slack fonctionnelles

### Monitoring

- [ ] Dashboard métriques créé
- [ ] Alerting configuré
- [ ] Logs archivés (>7 jours)
- [ ] Backups sitemaps actifs

---

## 🛠️ Troubleshooting

### Cron job ne s'exécute pas

**Diagnostic:**

```bash
# Vérifier crontab installé
crontab -l

# Vérifier logs cron
grep CRON /var/log/syslog

# Tester script manuellement
bash -x /path/to/cron-sitemap-nightly.sh
```

**Solutions:**
- Vérifier permissions (+x sur script)
- Vérifier PATH dans crontab
- Ajouter logs explicites dans script

### GitHub Actions timeout

**Diagnostic:**

- Vérifier timeout workflow (30min par défaut)
- Regarder étape qui bloque

**Solutions:**

```yaml
# Augmenter timeout
jobs:
  generate-sitemaps:
    timeout-minutes: 60  # 1 heure
```

### Sitemaps non générés

**Diagnostic:**

```bash
# Vérifier API NestJS active
curl http://localhost:3000/health

# Tester endpoint génération
curl -X POST http://localhost:3000/sitemap-v2/streaming/generate

# Vérifier Redis connecté
redis-cli ping
```

---

## 📚 Références

- [Turbo Documentation](https://turbo.build/repo/docs)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Cron Expression](https://crontab.guru/)
- [Docker Compose](https://docs.docker.com/compose/)

---

**Created:** October 26, 2025  
**Status:** ✅ Production Ready  
**Maintenance:** Automated via CI/CD
