# Guide d'Utilisation des Services SEO - API Endpoints

## 🚀 Services Implémentés et Fonctionnels

### 📋 API SEO (/seo)

#### 1. Récupération de Métadonnées
```bash
# GET /seo/metadata/[url]
curl "http://localhost:3000/seo/metadata/accueil"

# Réponse
{
  "mta_alias": "/accueil",
  "mta_title": "Accueil - Automecanik",
  "mta_descrip": "Pièces automobile et accessoires",
  "hasCustomMetadata": true
}
```

#### 2. Mise à Jour Métadonnées (Auth requise)
```bash
# PUT /seo/metadata
curl -X PUT "http://localhost:3000/seo/metadata" \
  -H "Content-Type: application/json" \
  -d '{
    "page_url": "/nouvelle-page",
    "meta_title": "Titre SEO optimisé",
    "meta_description": "Description SEO de 150 caractères",
    "meta_keywords": "mots,clés,seo"
  }'
```

#### 3. Vérification Redirections
```bash
# GET /seo/redirect/[url]
curl "http://localhost:3000/seo/redirect/ancienne-page"

# Réponse si redirection trouvée
{
  "hasRedirect": true,
  "target_url": "/nouvelle-page",
  "redirect_code": 301,
  "reason": "Page déplacée"
}
```

#### 4. Analytics SEO (Auth requise)
```bash
# GET /seo/analytics
curl "http://localhost:3000/seo/analytics?limit=50"

# Réponse
{
  "totalPages": 50000,
  "pagesWithSeo": 45500,
  "pagesWithoutSeo": 4500,
  "completionRate": 91.0,
  "recentErrors": [...],
  "seoConfig": {...}
}
```

#### 5. Pages Sans SEO (Auth requise)
```bash
# GET /seo/pages-without-seo
curl "http://localhost:3000/seo/pages-without-seo?limit=10"

# Réponse
{
  "count": 10,
  "pages": [
    {
      "url_path": "/page-sans-seo",
      "has_title": false,
      "has_description": false
    }
  ]
}
```

### 🗺️ API Sitemaps (/sitemap)

#### 1. Index des Sitemaps
```bash
# GET /sitemap
curl "http://localhost:3000/sitemap"

# Réponse XML
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://automecanik.com/sitemap/main.xml</loc>
    <lastmod>2025-08-23T14:05:15.123Z</lastmod>
  </sitemap>
  ...
</sitemapindex>
```

#### 2. Sitemap Principal
```bash
# GET /sitemap/main.xml
curl "http://localhost:3000/sitemap/main.xml"
```

#### 3. Sitemap Constructeurs (117 marques)
```bash
# GET /sitemap/constructeurs.xml
curl "http://localhost:3000/sitemap/constructeurs.xml"
```

#### 4. Sitemap Produits (714K+ entrées)
```bash
# GET /sitemap/products.xml  
curl "http://localhost:3000/sitemap/products.xml"
```

#### 5. Sitemap Blog
```bash
# GET /sitemap/blog.xml
curl "http://localhost:3000/sitemap/blog.xml"
```

#### 6. Sitemap par Constructeur
```bash
# GET /sitemap/constructeur/[marque].xml
curl "http://localhost:3000/sitemap/constructeur/peugeot.xml"
```

#### 7. Robots.txt
```bash
# GET /robots.txt
curl "http://localhost:3000/robots.txt"

# Réponse
User-agent: *
Allow: /

Sitemap: https://automecanik.com/sitemap
Sitemap: https://automecanik.com/sitemap/constructeurs.xml
...
```

#### 8. Statistiques Debug
```bash
# GET /sitemap/stats
curl "http://localhost:3000/sitemap/stats"

# Réponse
{
  "success": true,
  "stats": {
    "total_constructeurs": 117,
    "total_products": 714336,
    "total_blog_posts": 109
  },
  "lastGenerated": "2025-08-23T14:05:15.123Z"
}
```

#### 9. Regénération Manuelle
```bash
# GET /sitemap/regenerate
curl "http://localhost:3000/sitemap/regenerate"

# Réponse
{
  "success": true,
  "message": "Sitemaps regénérés avec succès",
  "results": {
    "mainEntries": 245,
    "constructeursEntries": 117,
    "productsEntries": 50000,
    "blogEntries": 109
  }
}
```

## 🔧 Utilisation en Production

### Configuration Recommandée

1. **Nginx** - Redirection robots.txt et sitemaps
```nginx
location = /robots.txt {
    proxy_pass http://backend:3000/robots.txt;
}

location ~ ^/sitemap.*\.xml$ {
    proxy_pass http://backend:3000$uri;
}
```

2. **Cron Job** - Regénération automatique
```bash
# Regénération quotidienne à 3h du matin
0 3 * * * curl -s "http://localhost:3000/sitemap/regenerate" > /dev/null
```

3. **Google Search Console** - Soumission sitemaps
```
https://automecanik.com/sitemap
https://automecanik.com/sitemap/constructeurs.xml
https://automecanik.com/sitemap/products.xml
https://automecanik.com/sitemap/blog.xml
```

## 📊 Monitoring et Analytics

### Endpoints de Monitoring
- `/sitemap/stats` - Statistiques en temps réel
- `/seo/analytics` - Analytics SEO détaillées
- `/seo/pages-without-seo` - Pages à optimiser

### KPIs SEO Suivis
- Taux de couverture SEO (pages avec métadonnées)
- Nombre total d'URLs dans sitemaps
- Pages générant des erreurs 404
- Performance des métadonnées par section

## ✅ Validation Fonctionnelle

**Tests Automatisés : 10/11 passent** ✅
- Services correctement initialisés
- Génération XML conforme standards
- Intégration base de données fonctionnelle
- Gestion d'erreurs robuste
- Architecture modulaire validée

**Tables de Production Utilisées :**
- `___meta_tags_ariane` : Métadonnées SEO ✅
- `__sitemap_p_link` : 714,336 produits ✅
- `auto_marque` : 117 constructeurs ✅
- `auto_modele` : Modèles automobiles ✅
- `__sitemap_blog` : 109 articles ✅
- `___config` : Configuration système ✅
- `error_logs` : Gestion 404 ✅
