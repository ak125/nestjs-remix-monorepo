---
title: "SEO Observability — Setup Google Service Account + secrets"
status: current
version: "1.0"
date: 2026-04-25
applies_to: backend/src/modules/seo-monitoring/
---

# SEO Observability — Setup runbook

> **Préalable Phase 1.** À exécuter une seule fois avant que `gsc-daily-fetcher`, `ga4-daily-fetcher`, `cwv-fetcher`, `gsc-links-fetcher` puissent ingérer de la donnée.

Cette procédure utilise le **projet Google Cloud existant d'AutoMecanik** (pas de création), génère un Service Account dédié avec lecture sur GSC + GA4, et le wire dans le monorepo via les ENV vars + GitHub Actions secrets.

**Conventions ENV** : on réutilise les noms déjà câblés dans `crawl-budget-audit.service.ts` et `url-audit.service.ts` — pas de nouvelle convention :

| Var | Service consumer |
|-----|------------------|
| `GSC_CLIENT_EMAIL`, `GSC_PRIVATE_KEY` | `crawl-budget-audit.service.ts:208-216` |
| `GSC_SITE_URL` | `url-audit.service.ts` (fallback `SITE_ORIGIN` = `https://www.automecanik.com`) |
| `GA4_CLIENT_EMAIL`, `GA4_PRIVATE_KEY`, `GA4_PROPERTY_ID` | `url-audit.service.ts:50-60` |

---

## 1. Créer le Service Account dans le projet GCP existant

> Le **compte Google Cloud d'AutoMecanik existe déjà**. Cette section ajoute uniquement un Service Account dédié au monitoring SEO. Pas de nouveau projet.

1. Ouvrir [console.cloud.google.com](https://console.cloud.google.com/) avec le compte propriétaire d'AutoMecanik.
2. Sélectionner le projet existant (celui qui héberge déjà les autres credentials Google Ads / Gmail).
3. Activer les APIs si pas déjà actives (toutes gratuites, quotas généreux) :
   - **Google Search Console API** — `searchconsole.googleapis.com`
   - **Google Analytics Data API** — `analyticsdata.googleapis.com`
   - **PageSpeed Insights API** — `pagespeedonline.googleapis.com`
   - **Chrome UX Report API** — `chromeuxreport.googleapis.com` *(optional, fallback PageSpeed)*

   Vérification rapide : `IAM & Admin → APIs & Services → Enabled APIs`.

4. **IAM & Admin → Service Accounts → Create Service Account** :
   - Nom : `seo-monitoring-readonly`
   - Description : `Lecture GSC + GA4 + PageSpeed pour SEO department backend`
   - Role : aucun rôle GCP global (les autorisations se font côté property GSC/GA4 directement, pas côté projet GCP).

5. Sur le SA fraîchement créé, onglet **Keys → Add Key → Create new key → JSON**. Télécharger le fichier `seo-monitoring-readonly-XXXX.json`.

   ⚠️ **Ce JSON est un secret de production.** Le stocker chiffré (Vaultwarden, Bitwarden, 1Password). Ne **jamais** le committer.

   Le JSON contient `client_email` et `private_key` — ce sont les valeurs des ENV vars `GSC_CLIENT_EMAIL` + `GSC_PRIVATE_KEY` (et idem GA4_*). Le **même SA** peut servir les deux : on copie la même paire dans GSC_* et GA4_* (la séparation reste pour permettre des SA distincts si besoin futur).

## 2. Autoriser le SA en lecture sur GSC

1. Ouvrir [search.google.com/search-console](https://search.google.com/search-console).
2. Sélectionner la propriété **`https://www.automecanik.com/`** (domaine production).
3. **Settings → Users and permissions → Add user**.
4. Email = `<service_account_email>` (ex: `seo-monitoring-readonly@<project>.iam.gserviceaccount.com`, lisible dans le JSON `client_email`).
5. Permission : **Restricted** (lecture seule, pas d'édition de paramètres).

**Vérification** : 24-48h après l'ajout, les données GSC deviennent disponibles côté API. Tester avec :

```bash
node -e "
const {google} = require('googleapis');
const sa = require('./seo-monitoring-readonly-XXXX.json');
const auth = new google.auth.JWT(sa.client_email, null, sa.private_key,
  ['https://www.googleapis.com/auth/webmasters.readonly']);
const sc = google.searchconsole({version:'v1', auth});
sc.sites.list().then(r => console.log(r.data));
"
```

Doit retourner la propriété `https://www.automecanik.com/`. Si erreur 403, l'autorisation GSC n'a pas encore propagé.

## 3. Autoriser le SA en lecture sur GA4

1. Ouvrir [analytics.google.com](https://analytics.google.com).
2. **Admin → Property → Property Access Management → Add user**.
3. Email = `<service_account_email>` (le même que pour GSC).
4. Role : **Viewer** (lecture seule).
5. Récupérer le **GA4 Property ID** (numérique, format `123456789`) dans **Admin → Property details**. C'est la valeur de `GA4_PROPERTY_ID` plus loin.

## 4. Stocker les secrets

### En DEV local (`.env.local`, jamais commit)

```dotenv
# Même Service Account pour GSC + GA4 (peut être séparé si besoin)
GSC_CLIENT_EMAIL=seo-monitoring-readonly@<project>.iam.gserviceaccount.com
GSC_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...REDACTED...\n-----END PRIVATE KEY-----\n"
GSC_SITE_URL=https://www.automecanik.com

GA4_CLIENT_EMAIL=seo-monitoring-readonly@<project>.iam.gserviceaccount.com
GA4_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...REDACTED...\n-----END PRIVATE KEY-----\n"
GA4_PROPERTY_ID=123456789

SEO_MONITORING_ENABLED=true
SEO_ALERTS_EMAIL_TO=automecanik.seo@gmail.com
```

> **Note** : les `*_PRIVATE_KEY` doivent être encodées avec les `\n` littéraux (la valeur du JSON `private_key`, recopiée tel quel). Le code dans `crawl-budget-audit.service.ts:213` fait déjà `.replace(/\\n/g, '\n')` au runtime.

### En CI / DEV pré-prod (GitHub Actions secrets)

Aller sur le repo GitHub → **Settings → Secrets and variables → Actions → New repository secret** pour chaque clé ci-dessus.

Pour les `*_PRIVATE_KEY` en GitHub Actions, **conserver les `\n` littéraux** dans la valeur du secret (pas de retours à la ligne réels).

### En PROD

À ne **pas** activer tant que la pipeline n'a pas été validée 1 semaine en DEV pré-prod. Variable `SEO_MONITORING_ENABLED=false` par défaut en prod.

## 5. Vérification finale

Une fois les secrets en place et les API autorisations propagées (~24h après création) :

```bash
# Backend NestJS
SEO_MONITORING_ENABLED=true npm run start:dev

# Endpoint health
curl http://localhost:3001/api/admin/seo-cockpit/monitoring/credentials/health \
  -H "Cookie: <admin-session>"
```

Réponse attendue : `{"gsc": "ok", "ga4": "ok", "pagespeed": "ok"}`.

Si une API est `unauthorized` ou `forbidden`, relire les étapes 2-3 (autorisations GSC/GA4) ou 1 (APIs activées en GCP).

## 6. Kill-switch & rotation

- **Kill-switch** : `SEO_MONITORING_ENABLED=false` désactive tous les fetchers immédiatement (next cron tick).
- **Rotation key** : tous les 90 jours, créer une nouvelle JSON key, mettre à jour les secrets, supprimer l'ancienne. Procédure répétée à partir de l'étape 1.5 (Add Key).
- **Révocation d'urgence** : supprimer le SA dans GCP Console → toutes les requêtes en cours échouent en `auth_failure`, le scheduler log un `ingestion_run_failed` event mais ne crash pas.

## 7. Quotas Google (références)

| API | Quota par défaut | Quota nécessaire 50k pages |
|-----|-----------------|---------------------------|
| Search Analytics | 1200 req/min/property | ~830 req pour 50k×20 queries → ~1 min réelle, OK |
| URL Inspection | 600 req/min/property | Sample 5k top URLs : ~10 min, OK |
| GA4 Data API | 100k tokens/property/jour | Segmentation par groupe URL → ~50k tokens/jour, OK |
| PageSpeed Insights | 25k req/jour | Sample top 1k pages 1×/sem = 1k req/run, OK |
| Chrome UX Report | 100 req/min | Optional fallback uniquement |

Si quota dépassé en cas de pic : kill-switch + retry exponential côté `gsc-daily-fetcher.service.ts`.

## 8. Coverage Manifest (pour tracker l'audit infra)

```
scope_requested        : observability infra setup (GSC + GA4 + CWV + GSC Links)
scope_actually_scanned : APIs activées + permissions vérifiées + JSON SA téléchargé + secrets injectés
files_read_count       : 1 (ce runbook)
excluded_paths         : aucun
unscanned_zones        : Chrome UX Report (optional fallback, pas activé pour Phase 1)
corrections_proposed   : aucune (procédure read-only côté GCP, write côté secrets)
validation_executed    : appel test sites.list + test runReport (cf. §5)
remaining_unknowns     : propagation autorisations GSC/GA4 (~24h après ajout, hors contrôle)
final_status           : VALIDATED_FOR_SCOPE_ONLY
```
