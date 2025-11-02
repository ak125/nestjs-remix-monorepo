# 🚀 Configuration Production - SEO Audit

## ⚙️ Variables d'environnement à modifier

### Backend `.env`

```bash
# 🔧 PRODUCTION: Remplacer .fr par .com
SITEMAP_URL=https://automecanik.com/sitemap.xml

# Meilisearch (optionnel mais recommandé)
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_API_KEY=your-master-key-here

# Loki (optionnel pour logs centralisés)
LOKI_URL=http://loki:3100
```

### Script `seo-audit-weekly.sh`

**Ligne 11** - Sitemap URL par défaut :
```bash
# 🔧 PRODUCTION: Remplacer .fr par .com lors du déploiement en production
SITEMAP_URL="${SITEMAP_URL:-https://automecanik.com/sitemap.xml}"
```

**Ligne 82** - Remplacement des URLs enfants :
```bash
# 🔧 PRODUCTION: Supprimer cette ligne de remplacement .com → .fr en production
CHILD_SITEMAP_ADJUSTED="${CHILD_SITEMAP/automecanik.com/automecanik.fr}"
```

## 📝 Checklist avant déploiement

- [ ] Remplacer `https://automecanik.fr` par `https://automecanik.com` dans `backend/.env`
- [ ] Supprimer ou commenter la ligne 82 dans `scripts/seo-audit-weekly.sh`
- [ ] Vérifier que `automecanik.com` est accessible
- [ ] Configurer `MEILISEARCH_API_KEY` (si indexation activée)
- [ ] Tester manuellement : `POST /seo-logs/audit/run`
- [ ] Vérifier les logs : aucun message `ENOTFOUND automecanik.com`

## 🧪 Test de validation production

```bash
# 1. Vérifier la résolution DNS
curl -I https://automecanik.com/sitemap.xml

# 2. Tester le script manuellement
cd /workspaces/nestjs-remix-monorepo
SITEMAP_URL=https://automecanik.com/sitemap.xml bash scripts/seo-audit-weekly.sh

# 3. Vérifier le rapport JSON
cat /tmp/seo-audit-$(date +%Y%m%d)/audit-report.json | jq

# 4. Trigger API
curl -X POST http://localhost:3000/seo-logs/audit/run | jq

# 5. Vérifier le statut
curl http://localhost:3000/seo-logs/audit/queue/stats | jq
```

## 📊 Configuration actuelle (DEV)

- **Sitemap** : `https://automecanik.fr/sitemap.xml`
- **Remplacement automatique** : `.com` → `.fr` dans les URLs enfants
- **Raison** : `automecanik.com` pas encore accessible en développement
- **Impact** : Aucun en production si les modifications ci-dessus sont appliquées

## ✅ Validation job réussi

```json
{
  "audit_date": "2025-10-27T10:55:07+00:00",
  "sitemap_url": "https://automecanik.fr/sitemap.xml",
  "total_urls": 12,
  "summary": {
    "total_errors": 0,
    "total_warnings": 0,
    "status": "PASS"
  }
}
```

Job #23 : ✅ **Completed** en 1154ms
