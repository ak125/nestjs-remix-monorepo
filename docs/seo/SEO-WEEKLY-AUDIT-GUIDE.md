# 🔍 SEO Weekly Audit - Guide complet

## Vue d'ensemble

Le système d'audit SEO hebdomadaire valide automatiquement la qualité du sitemap et détecte les incohérences SEO critiques.

**Exécution:** Chaque lundi à 3h00 AM (configurable via cron)  
**Durée:** ~15-30 minutes selon la taille du sitemap  
**Sortie:** Rapports JSON + fichiers détaillés

---

## 🎯 Validations effectuées

### 1. Validation XSD du sitemap ✅

Vérifie que le sitemap XML respecte le schéma officiel de sitemaps.org.

**Critères validés:**
- Structure XML valide
- Namespaces corrects
- Balises obligatoires présentes (`<urlset>`, `<url>`, `<loc>`)
- Format des dates `<lastmod>` (ISO 8601)
- Valeurs `<changefreq>` valides
- Valeurs `<priority>` entre 0.0 et 1.0

**Erreurs détectées:**
```xml
❌ Element 'urlset': No matching global declaration available
❌ Element 'lastmod': '2025-13-45' is not a valid date
❌ Element 'priority': '1.5' exceeds maximum value 1.0
```

---

### 2. URLs avec noindex dans sitemap 🚫

Détecte les pages avec meta robots noindex présentes dans le sitemap.

**Problème:**  
Une URL ne devrait PAS être dans le sitemap si elle a `<meta name="robots" content="noindex">`.

**Détection:**
```bash
# Échantillon de 100 URLs testé
curl -s https://example.com/page | grep -i "noindex"
```

**Exemples trouvés:**
```
❌ /admin/dashboard (noindex, nofollow)
❌ /search?q=test (noindex)
❌ /cart (noindex, noarchive)
```

**Action corrective:**
1. Retirer les URLs du sitemap OU
2. Supprimer la directive noindex

---

### 3. URLs retournant 4xx/5xx 🔴

Identifie les URLs cassées présentes dans le sitemap.

**Sources de données:**
1. **Loki** (prioritaire): Analyse les logs Caddy des 7 derniers jours
2. **Fallback**: Test HTTP direct sur échantillon

**Erreurs typiques:**
```
❌ 404 /pieces/freins/renault/laguna-2/1-9-dci (85 hits)
❌ 500 /api/products/12345 (12 hits)
❌ 503 /checkout (3 hits)
```

**Requête Loki utilisée:**
```logql
count by (path, status) (
  count_over_time({job="caddy-access"} | json | status >= 400 [7d])
)
```

**Action corrective:**
- 404: Retirer du sitemap ou créer redirection 301
- 500/503: Débugger l'erreur serveur avant resoumission

---

### 4. Hreflang non réciproques 🌍

Valide que les annotations hreflang sont bidirectionnelles.

**Règle:**  
Si page FR pointe vers page EN, alors page EN DOIT pointer vers page FR.

**Exemple d'erreur:**
```
⚠️  /fr/pieces/freins -> /en/parts/brakes (en-GB) NON RÉCIPROQUE
    /en/parts/brakes ne pointe PAS vers /fr/pieces/freins
```

**Bon exemple:**
```html
<!-- /fr/pieces/freins -->
<link rel="alternate" hreflang="en-GB" href="/en/parts/brakes" />
<link rel="alternate" hreflang="fr-FR" href="/fr/pieces/freins" />

<!-- /en/parts/brakes -->
<link rel="alternate" hreflang="fr-FR" href="/fr/pieces/freins" />
<link rel="alternate" hreflang="en-GB" href="/en/parts/brakes" />
```

**Impact SEO:**  
Google ignore les hreflang mal configurés → contenu dupliqué possible.

---

### 5. Canoniques divergents 🔗

Détecte les URLs dont le canonical pointe ailleurs.

**Scénario normal (OK):**
```html
<!-- URL: /pieces/freins/renault/clio -->
<link rel="canonical" href="https://automecanik.fr/pieces/freins/renault/clio" />
```

**Scénario divergent (⚠️ WARNING):**
```html
<!-- URL: /pieces/freins/renault/clio?page=2 -->
<link rel="canonical" href="https://automecanik.fr/pieces/freins/renault/clio" />
```

**Note:**  
Les canoniques divergents ne sont PAS forcément des erreurs :
- Pagination → canonical vers page 1 (intentionnel)
- Variantes produits → canonical vers produit principal
- URLs avec paramètres → canonical vers URL propre

**Action:**  
Vérifier manuellement si c'est intentionnel ou erreur.

---

## 📊 Format du rapport

### Rapport JSON principal

```json
{
  "audit_date": "2025-10-26T03:00:12+00:00",
  "sitemap_url": "https://automecanik.fr/sitemap.xml",
  "total_urls": 5420,
  "sample_size": 100,
  "results": {
    "xsd_validation": "valid",
    "noindex_urls": 0,
    "http_errors": 3,
    "hreflang_errors": 2,
    "canonical_divergent": 15
  },
  "summary": {
    "total_errors": 3,
    "total_warnings": 17,
    "status": "FAIL"
  },
  "output_dir": "/tmp/seo-audit-20251026"
}
```

### Fichiers détaillés générés

| Fichier | Contenu |
|---------|---------|
| `audit-report.json` | Rapport principal (JSON) |
| `sitemap.xml` | Sitemap téléchargé |
| `sitemap-urls.txt` | Liste de toutes les URLs (1 par ligne) |
| `noindex-urls.txt` | URLs avec noindex détectées |
| `error-urls.txt` | URLs 4xx/5xx avec code HTTP |
| `hreflang-errors.txt` | Hreflang non réciproques |
| `canonical-errors.txt` | Canoniques divergents |
| `xsd-validation.log` | Sortie complète de xmllint |

---

## 🚀 Utilisation

### 1. Exécution manuelle

```bash
# Exécution simple
./scripts/seo-audit-weekly.sh

# Avec variables custom
SITEMAP_URL=https://mysite.com/sitemap.xml \
LOKI_URL=http://loki:3100 \
./scripts/seo-audit-weekly.sh
```

### 2. Via API NestJS

```bash
# Lancer un audit
curl -X POST http://localhost:3001/seo-logs/audit/run

# Récupérer le dernier rapport
curl http://localhost:3001/seo-logs/audit/latest

# Historique
curl http://localhost:3001/seo-logs/audit/history?limit=10

# Tendances sur 30 jours
curl http://localhost:3001/seo-logs/audit/trends?period=30
```

### 3. Configuration cron (automatique)

```bash
# Éditer la crontab
crontab -e

# Ajouter (tous les lundis à 3h00)
0 3 * * 1 /workspaces/nestjs-remix-monorepo/scripts/seo-audit-weekly.sh >> /var/log/seo-audit.log 2>&1

# Avec notification Slack
0 3 * * 1 SEO_AUDIT_WEBHOOK_URL=https://hooks.slack.com/services/XXX /path/to/seo-audit-weekly.sh
```

---

## 🔔 Notifications webhook

### Configuration Slack

1. Créer un webhook Slack:  
   https://api.slack.com/messaging/webhooks

2. Définir la variable:
```bash
export SEO_AUDIT_WEBHOOK_URL="https://hooks.slack.com/services/T00/B00/XXXXX"
```

3. Le script enverra automatiquement un résumé:

![Slack notification example](https://via.placeholder.com/600x200/4A154B/FFFFFF?text=SEO+Audit+Notification)

**Format du message:**
```
✅ SEO Weekly Audit - 2025-10-26

Status: PASS ✅
Total URLs: 5420
Errors: 0
Warnings: 2

Noindex URLs: 0
HTTP Errors: 0
Hreflang Issues: 2
Canonical Divergent: 0
```

### Configuration Microsoft Teams

```bash
export SEO_AUDIT_WEBHOOK_URL="https://outlook.office.com/webhook/xxx"
```

Le payload JSON est compatible Slack/Teams.

---

## 📈 Cas d'usage avancés

### 1. Alerting automatique

Intégrer avec PagerDuty, Opsgenie, ou email :

```bash
#!/bin/bash
./scripts/seo-audit-weekly.sh

EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  # Envoi email d'alerte
  echo "SEO Audit FAILED" | mail -s "SEO ALERT" admin@example.com
  
  # Incident PagerDuty
  curl -X POST https://events.pagerduty.com/v2/enqueue \
    -d '{"routing_key":"xxx", "event_action":"trigger", "payload": {...}}'
fi
```

### 2. Intégration CI/CD

Bloquer un déploiement si l'audit échoue :

```yaml
# .github/workflows/deploy.yml
- name: SEO Audit
  run: |
    ./scripts/seo-audit-weekly.sh
  env:
    SITEMAP_URL: ${{ secrets.SITEMAP_URL }}
    
- name: Deploy
  if: success()  # Ne déploie que si audit PASS
  run: ./deploy.sh
```

### 3. Comparaison avant/après changement

```bash
# Baseline avant refonte
./scripts/seo-audit-weekly.sh
cp /tmp/seo-audit-*/audit-report.json baseline.json

# Après refonte (1 semaine plus tard)
./scripts/seo-audit-weekly.sh
cp /tmp/seo-audit-*/audit-report.json after.json

# Comparer
diff baseline.json after.json
```

---

## 🐛 Troubleshooting

### Erreur: "xmllint command not found"

**Solution:**
```bash
# Ubuntu/Debian
apt-get install libxml2-utils

# Alpine
apk add libxml2-utils

# macOS
brew install libxml2
```

### Erreur: "curl: Failed to connect to loki"

**Causes possibles:**
1. Loki n'est pas démarré
2. URL Loki incorrecte
3. Réseau Docker isolé

**Debug:**
```bash
# Vérifier Loki
docker ps | grep loki
curl http://localhost:3100/ready

# Tester depuis le container Vector
docker exec vector-seo-pipeline curl http://loki:3100/ready
```

### Performance lente (>1h d'exécution)

**Optimisations:**
1. Réduire la taille de l'échantillon:
```bash
# Dans le script, modifier:
SAMPLE_SIZE=50  # au lieu de 100
```

2. Désactiver certains checks:
```bash
# Commenter les sections non critiques
# Section 4: VALIDATION HREFLANG (lente)
```

3. Paralléliser les requêtes:
```bash
# Utiliser xargs avec -P
cat sample-urls.txt | xargs -P 10 -I {} curl -s {}
```

---

## 📋 Checklist maintenance

- [ ] Vérifier les logs cron hebdomadairement: `tail -f /var/log/seo-audit.log`
- [ ] Nettoyer les anciens rapports (>90j): `find /tmp -name 'seo-audit-*' -mtime +90 -delete`
- [ ] Tester le webhook: `curl -X POST $SEO_AUDIT_WEBHOOK_URL -d '{"text":"test"}'`
- [ ] Valider que Loki reçoit les logs: `curl $LOKI_URL/loki/api/v1/labels`
- [ ] Mettre à jour le schéma XSD si nécessaire (rare)

---

## 🎯 Métriques de succès

### Objectifs SEO

| Métrique | Target | Action si non atteint |
|----------|--------|----------------------|
| **XSD Validation** | 100% valid | Fix XML structure immédiatement |
| **Noindex URLs** | 0 | Retirer du sitemap ou enlever noindex |
| **HTTP Errors** | <1% | Fix 404s, debug 5xx |
| **Hreflang Errors** | <5% | Corriger réciprocité |
| **Canonical Divergent** | <10% | Valider intentionnalité |

### Dashboard recommandé

Créer un dashboard Grafana avec :

1. **Gauge:** Status actuel (PASS/FAIL)
2. **Time series:** Évolution erreurs sur 90j
3. **Table:** Top 10 erreurs récurrentes
4. **Heatmap:** Distribution erreurs par jour de semaine

---

## 🔮 Roadmap futures améliorations

- [ ] **Validation structured data**: Vérifier JSON-LD, microdata
- [ ] **Mobile-friendliness check**: Via Google PageSpeed API
- [ ] **Core Web Vitals**: LCP, FID, CLS par URL
- [ ] **Duplicate content detection**: Hash MD5 du contenu
- [ ] **Internal links broken**: Crawler internal links
- [ ] **Image alt text validation**: SEO images
- [ ] **Meta descriptions**: Length check (120-160 chars)
- [ ] **H1 uniqueness**: One H1 per page
- [ ] **Sitemap image/video extensions**: Validate media sitemaps

---

## 📚 Références

- [Sitemaps.org Protocol](https://www.sitemaps.org/protocol.html)
- [Google Search Central - Hreflang](https://developers.google.com/search/docs/advanced/crawling/localized-versions)
- [Canonical URLs Best Practices](https://developers.google.com/search/docs/advanced/crawling/consolidate-duplicate-urls)
- [HTTP Status Codes](https://httpstatuses.com/)
- [XSD Sitemap Schema](https://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd)
