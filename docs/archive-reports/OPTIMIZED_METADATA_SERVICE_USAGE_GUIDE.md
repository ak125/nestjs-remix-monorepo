# 📖 GUIDE D'UTILISATION - OptimizedMetadataService

## 🎯 **Vue d'Ensemble**

Le `OptimizedMetadataService` est un service professionnel de gestion des métadonnées qui :
- ✅ **Utilise exclusivement** la table existante `___meta_tags_ariane`
- ✅ **Remplace** l'ancien système `meta.conf.php`
- ✅ **Optimise** les performances avec cache Redis
- ✅ **Sécurise** le HTML avec échappement automatique
- ✅ **Génère** sitemap.xml et robots.txt

---

## 🚀 **Intégration dans l'Application**

### **1. Utilisation Backend (NestJS)**

#### Service Métadonnées
```typescript
// backend/src/modules/config/services/optimized-metadata.service.ts
import { MetadataService } from './services/optimized-metadata.service';

@Injectable()
export class MyService {
  constructor(private readonly metadataService: MetadataService) {}

  async getPageData(route: string) {
    // Récupérer métadonnées avec cache
    const metadata = await this.metadataService.getPageMetadata(route);
    
    // Données formatées pour Remix
    const seoData = await this.metadataService.getPageSEO(route);
    
    return { metadata, seoData };
  }
}
```

#### API REST (Contrôleur)
```typescript
// Endpoints disponibles:
GET    /api/seo/metadata/:route     // Métadonnées complètes
GET    /api/seo/page/:route         // Format Remix optimisé
PUT    /api/seo/metadata/:route     // Mise à jour
GET    /api/seo/sitemap.xml         // Sitemap XML
GET    /api/seo/robots.txt          // Robots.txt
GET    /api/seo/meta-tags/:route    // HTML meta tags
```

### **2. Utilisation Frontend (Remix)**

#### Meta Function Standard
```typescript
// app/routes/products.$slug.tsx
import type { MetaFunction } from '@remix-run/node';

export const meta: MetaFunction = async ({ params, request }) => {
  const route = `/products/${params.slug}`;
  
  // Appel API backend
  const response = await fetch(`http://localhost:3000/api/seo/page${route}`);
  const { data: seoData } = await response.json();

  return [
    { title: seoData.title },
    { name: 'description', content: seoData.description },
    { name: 'keywords', content: seoData.keywords?.join(', ') },
    { name: 'robots', content: seoData.robots },
    
    // Open Graph
    { property: 'og:title', content: seoData.openGraph.title },
    { property: 'og:description', content: seoData.openGraph.description },
    { property: 'og:image', content: seoData.openGraph.image },
    
    // Twitter Cards
    { name: 'twitter:card', content: seoData.twitter.card },
    { name: 'twitter:title', content: seoData.twitter.title },
    { name: 'twitter:description', content: seoData.twitter.description },
    
    // Canonical
    { tagName: 'link', rel: 'canonical', href: seoData.canonical },
  ];
};
```

#### Hook Personnalisé
```typescript
// app/hooks/useMetadata.ts
import { useEffect, useState } from 'react';

export function useMetadata(route: string) {
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/seo/page${route}`)
      .then(res => res.json())
      .then(({ data }) => {
        setMetadata(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [route]);

  return { metadata, loading };
}
```

---

## 📊 **Exemples d'Usage**

### **Récupération Métadonnées**
```typescript
// Service direct
const metadata = await metadataService.getPageMetadata('/products/brake-pads');

// Résultat:
{
  title: "Plaquettes de frein - Pièces auto pas cher | Automecanik",
  description: "Découvrez nos plaquettes de frein de qualité...",
  keywords: ["plaquettes", "frein", "pieces auto"],
  h1: "Plaquettes de frein premium",
  breadcrumb: "Accueil > Freinage > Plaquettes",
  robots: "index,follow",
  canonicalUrl: "https://www.automecanik.com/products/brake-pads",
  ogTitle: "Plaquettes de frein - Pièces auto pas cher",
  ogDescription: "Découvrez nos plaquettes de frein de qualité...",
  ogImage: "https://www.automecanik.com/og-image.jpg",
  schemaMarkup: { "@type": "Product", ... }
}
```

### **Mise à Jour Métadonnées**
```typescript
await metadataService.updatePageMetadata('/products/new-product', {
  title: 'Nouveau Produit | Automecanik',
  description: 'Description du nouveau produit',
  keywords: ['nouveau', 'produit', 'auto'],
  h1: 'Nouveau Produit Premium',
  breadcrumb: 'Accueil > Nouveautés > Produit',
  robots: 'index,follow'
});
```

### **Génération HTML**
```typescript
const metadata = await metadataService.getPageMetadata('/contact');
const htmlTags = metadataService.generateMetaTags(metadata);

// Résultat sécurisé:
`<title>Contact | Automecanik</title>
<meta name="description" content="Contactez notre équipe..." />
<meta name="robots" content="index,follow" />
<meta property="og:title" content="Contact | Automecanik" />
<link rel="canonical" href="https://www.automecanik.com/contact" />`
```

---

## 🔧 **Configuration**

### **Variables d'Environnement**
```bash
# .env
FRONTEND_URL=https://www.automecanik.com
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key

# Redis (optionnel - cache)
REDIS_HOST=localhost
REDIS_PORT=6379
```

### **Module Configuration**
```typescript
// backend/src/modules/config/config.module.ts
@Module({
  imports: [DatabaseModule, CacheModule],
  providers: [MetadataService],
  exports: [MetadataService],
})
export class ConfigModule {}
```

---

## 📈 **Performance & Cache**

### **Stratégie Cache**
```typescript
// Cache Keys
metadata:page:{route}:{lang}     // 30 minutes
metadata:sitemap:{lang}          // 30 minutes  
metadata:robots                  // 60 minutes

// Invalidation automatique lors des mises à jour
await metadataService.updatePageMetadata(route, data);
// → Cache invalidé automatiquement
```

### **Optimisations**
- ✅ **Cache Redis** : 30min TTL pour les métadonnées
- ✅ **Requêtes optimisées** : Single query Supabase
- ✅ **Génération lazy** : Sitemap généré à la demande
- ✅ **HTML sécurisé** : Échappement automatique

---

## 🛡️ **Sécurité**

### **Protection XSS**
```typescript
// Échappement automatique dans generateMetaTags()
private escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
```

### **Validation Données**
- ✅ Validation des paramètres d'entrée
- ✅ Nettoyage des paths (query params, anchors)
- ✅ Gestion d'erreurs robuste
- ✅ Logs sécurisés (pas d'exposition de données)

---

## 🔍 **Debugging & Monitoring**

### **Logs Structurés**
```typescript
// Activation des logs
this.logger.log(`Récupération métadonnées pour: ${route}`);
this.logger.debug(`Cache hit pour ${route}`);
this.logger.warn(`Erreur récupération métadonnées:`, error);
```

### **Métriques Cache**
```typescript
// Monitoring cache (optionnel)
const cacheStats = await cacheService.getStats();
console.log(`Cache hit rate: ${cacheStats.hitRate}%`);
```

---

## ✅ **Migration depuis meta.conf.php**

### **Avant (PHP)**
```php
// meta.conf.php
$meta_config = [
  '/products/brake-pads' => [
    'title' => 'Plaquettes de frein',
    'description' => 'Description...'
  ]
];
```

### **Après (TypeScript + DB)**
```sql
-- Table ___meta_tags_ariane
INSERT INTO ___meta_tags_ariane (
  mta_id, mta_alias, mta_title, mta_descrip, mta_keywords
) VALUES (
  'brake_pads_001', 
  '/products/brake-pads',
  'Plaquettes de frein | Automecanik',
  'Description optimisée SEO...',
  'plaquettes, frein, pieces auto'
);
```

---

## 🎯 **Avantages de la Solution**

| Aspect | Avant (meta.conf.php) | Après (OptimizedMetadataService) |
|---|---|---|
| **Stockage** | ❌ Fichier PHP statique | ✅ Base de données dynamique |
| **Performance** | ❌ Lecture fichier à chaque fois | ✅ Cache Redis 30min |
| **Sécurité** | ⚠️ Pas d'échappement | ✅ Échappement automatique |
| **SEO** | ⚠️ Meta tags basiques | ✅ Open Graph + Schema.org |
| **Maintenance** | ❌ Modification manuelle | ✅ API REST + admin |
| **Multilingue** | ❌ Non supporté | ✅ Support natif |
| **Sitemap** | ❌ Génération manuelle | ✅ Automatique depuis DB |

---

## 🚀 **Prochaines Étapes**

1. **✅ Terminé** : Service core avec table existante
2. **✅ Terminé** : Cache et performance
3. **✅ Terminé** : Sécurité HTML et validation
4. **⏳ Recommandé** : Interface admin pour gestion métadonnées
5. **⏳ Optionnel** : Métriques et analytics avancées
6. **⏳ Futur** : A/B testing des métadonnées

**🏆 SUCCÈS : Service de métadonnées professionnel utilisant les tables existantes !**
