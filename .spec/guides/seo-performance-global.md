# Guide SEO & Performance: Stratégie Globale

## 🎯 Vue d'ensemble

Ce guide définit les **standards SEO et performance** à appliquer sur **toutes les pages** du site web. L'objectif est d'atteindre:

- 🎯 **Score Lighthouse**: 90+ (Performance, SEO, Accessibility, Best Practices)
- 📱 **Mobile-First**: Approche prioritaire mobile avec progressive enhancement
- ⚡ **Core Web Vitals**: LCP < 2.5s, FID < 100ms, CLS < 0.1
- 🔍 **SEO Technique**: Meta tags uniques, Schema.org, canonicals, sitemaps
- 🚀 **Temps de chargement**: < 3s (3G), < 1s (4G/Wifi)

---

## 📱 Mobile-First: Approche Obligatoire

### Principe Fondamental

**Toujours commencer par le mobile, puis enrichir progressivement pour desktop.**

```
Mobile (Base) → Tablette (md:) → Desktop (lg:) → Large Desktop (xl:)
```

### Breakpoints Tailwind Standard

```typescript
// Utiliser systématiquement ces breakpoints
sm:  640px   // Mobile landscape / Tablette portrait
md:  768px   // Tablette
lg:  1024px  // Desktop
xl:  1280px  // Large desktop
2xl: 1536px  // Très large desktop
```

### Pattern Mobile-First Correct

**✅ BON** - Valeurs croissantes (mobile → desktop):

```tsx
// Spacing - Valeurs qui augmentent
<div className="p-4 md:p-6 lg:p-8">
<div className="gap-2 md:gap-4 lg:gap-6">
<div className="space-y-4 md:space-y-6 lg:space-y-8">

// Typography - Tailles qui augmentent
<h1 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl">
<p className="text-sm md:text-base lg:text-lg">

// Grid - Colonnes qui augmentent
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

// Flex direction - Mobile vertical → Desktop horizontal
<div className="flex flex-col md:flex-row">
<div className="flex-col md:flex-row items-start md:items-center">

// Widths - Full mobile → Restreint desktop
<div className="w-full md:w-3/4 lg:w-1/2">
```

**❌ MAUVAIS** - Desktop-first (valeurs décroissantes):

```tsx
// ❌ Commence par grandes valeurs desktop
<div className="p-8 lg:p-6 md:p-4">
<div className="text-4xl md:text-3xl sm:text-2xl">
<div className="grid-cols-4 lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1">

// ❌ Widths qui décroissent
<div className="w-1/2 md:w-3/4 sm:w-full">
```

### Exception: Double Implémentation Mobile/Desktop

**Acceptable uniquement** pour composants complètement différents (navigation, menus):

```tsx
// ⚠️ CAS SPÉCIAL - Acceptable pour UX différente
<div className="lg:hidden">
  {/* Menu mobile - visible uniquement mobile */}
  <MobileMenu />
</div>

<div className="hidden lg:flex">
  {/* Menu desktop - visible uniquement desktop */}
  <DesktopMenu />
</div>
```

**Pourquoi acceptable?**
- Deux implémentations UX complètement différentes
- Évite de charger du code inutilisé (performance)
- Navigation mobile vs desktop nécessite structures différentes

### Checklist Mobile-First

Avant chaque commit, vérifier:

- [ ] **Sizing**: Valeurs croissantes `text-sm md:text-base lg:text-lg`
- [ ] **Spacing**: Valeurs croissantes `p-4 md:p-6 lg:p-8`
- [ ] **Grid**: Colonnes croissantes `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- [ ] **Flex**: Direction mobile-first `flex-col md:flex-row`
- [ ] **Test visuel**: Vérifier sur 375px (mobile), 768px (tablette), 1280px (desktop)
- [ ] **Touch targets**: Boutons/liens min 44×44px sur mobile

---

## ⚡ Performance: Core Web Vitals

### Objectifs Lighthouse

| Métrique | Objectif | Maximum Acceptable | Signification |
|----------|----------|-------------------|---------------|
| **LCP** (Largest Contentful Paint) | < 2.5s | < 4.0s | Temps d'affichage du plus gros élément visible |
| **FID** (First Input Delay) | < 100ms | < 300ms | Délai avant première interaction utilisateur |
| **CLS** (Cumulative Layout Shift) | < 0.1 | < 0.25 | Stabilité visuelle (éviter décalages layout) |
| **FCP** (First Contentful Paint) | < 1.8s | < 3.0s | Premier pixel visible à l'écran |
| **TTI** (Time To Interactive) | < 3.8s | < 7.3s | Page complètement interactive |
| **TTFB** (Time To First Byte) | < 800ms | < 1.8s | Premier octet reçu du serveur |

### Stratégies d'Optimisation

#### 1. Lazy Loading Images

**Standards obligatoires**:

```tsx
// ✅ BON - Lazy loading natif avec dimensions
<img 
  src={imageUrl}
  alt="Porsche Cayenne 955 - Plaquette de frein avant"
  loading="lazy"
  width={800}
  height={600}
  className="w-full h-auto"
/>

// ✅ BON - WebP avec fallback JPG
<picture>
  <source srcSet="/image.webp" type="image/webp" />
  <source srcSet="/image.jpg" type="image/jpeg" />
  <img 
    src="/image.jpg" 
    alt="..." 
    loading="lazy"
    width={800}
    height={600}
  />
</picture>

// ✅ BON - Responsive images (srcset)
<img 
  src="/image-800w.webp"
  srcSet="/image-400w.webp 400w, /image-800w.webp 800w, /image-1200w.webp 1200w"
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 800px"
  alt="..."
  loading="lazy"
  width={800}
  height={600}
/>
```

**🚨 Règles critiques**:
- ✅ Toujours spécifier `width` et `height` (évite CLS)
- ✅ Utiliser `loading="lazy"` sauf images above-the-fold
- ✅ Format WebP avec fallback JPG/PNG
- ✅ Compression WebP qualité 85%, JPG qualité 80%

**❌ À éviter**:

```tsx
// ❌ Pas de dimensions = CLS garanti
<img src={url} alt="..." />

// ❌ Eager loading sur toutes les images
<img src={url} alt="..." loading="eager" />

// ❌ Images non compressées
<img src="/image-full-quality.png" alt="..." />  // 5 MB!
```

#### 2. Code Splitting & Lazy Components

**Lazy loading des sections non-critiques**:

```tsx
import { lazy, Suspense } from 'react';

// Lazy load composants lourds/non-critiques
const Reviews = lazy(() => import('../components/Reviews'));
const RelatedProducts = lazy(() => import('../components/RelatedProducts'));
const Footer = lazy(() => import('../components/Footer'));

export default function ProductPage() {
  return (
    <>
      {/* ✅ Contenu critique - chargé immédiatement */}
      <Hero />
      <ProductDetails />
      <AddToCartButton />
      
      {/* ✅ Sections non-critiques - lazy loaded avec Suspense */}
      <Suspense fallback={<ReviewsSkeleton />}>
        <Reviews />
      </Suspense>
      
      <Suspense fallback={<ProductsSkeleton />}>
        <RelatedProducts />
      </Suspense>
      
      <Suspense fallback={<FooterSkeleton />}>
        <Footer />
      </Suspense>
    </>
  );
}
```

**Impact estimé**:
- ⚡ -40% temps chargement initial
- 📦 -60% JavaScript initial
- 🚀 +25 points Lighthouse Performance

**Composant LazySection réutilisable**:

```tsx
// components/seo/LazySection.tsx
import { lazy, Suspense, ComponentType } from 'react';

interface LazySection Props {
  loader: () => Promise<{ default: ComponentType<any> }>;
  fallback?: React.ReactNode;
  minHeight?: string;
}

export function LazySection({ loader, fallback, minHeight = '400px' }: LazySectionProps) {
  const Component = lazy(loader);
  
  return (
    <div style={{ minHeight }}>
      <Suspense fallback={fallback || <Skeleton minHeight={minHeight} />}>
        <Component />
      </Suspense>
    </div>
  );
}

// Utilisation
<LazySection 
  loader={() => import('./Reviews')}
  minHeight="500px"
/>
```

#### 3. Prefetch & Preload

**Preload ressources critiques**:

```tsx
// app/root.tsx ou routes/...tsx
export const links: LinksFunction = () => [
  // Preload fonts critiques
  { 
    rel: "preload", 
    href: "/fonts/inter-var.woff2", 
    as: "font", 
    type: "font/woff2", 
    crossOrigin: "anonymous" 
  },
  
  // Preload hero image
  { 
    rel: "preload", 
    href: "/hero-image.webp", 
    as: "image" 
  },
  
  // DNS prefetch pour APIs externes
  { 
    rel: "dns-prefetch", 
    href: "https://api.automecanik.com" 
  },
  
  // Preconnect CDN
  { 
    rel: "preconnect", 
    href: "https://cdn.automecanik.com" 
  },
];
```

**Prefetch navigation (Remix)**:

```tsx
// ✅ Prefetch au survol (intent)
<Link to="/next-page" prefetch="intent">
  Voir plus
</Link>

// ✅ Prefetch au scroll visible (viewport)
<Link to="/category" prefetch="viewport">
  Catégorie
</Link>

// ✅ Prefetch immédiat (render)
<Link to="/important-page" prefetch="render">
  Page importante
</Link>
```

#### 4. Cache Strategy

**Backend - Cache headers optimisés**:

```typescript
// Loader avec cache approprié
export async function loader({ params }: LoaderFunctionArgs) {
  const data = await getProductData(params.id);
  
  return json(data, {
    headers: {
      // Client: 5 min, CDN: 10 min, stale-while-revalidate: 24h
      'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400',
      
      // CDN spécifique (Cloudflare, Fastly, etc.)
      'CDN-Cache-Control': 'public, max-age=3600',
      
      // Vary pour contenus personnalisés
      'Vary': 'Accept-Encoding, Accept-Language',
    }
  });
}
```

**Stratégies par type de contenu**:

| Type | Cache-Control | Justification |
|------|---------------|---------------|
| **Assets statiques** (images, fonts, CSS, JS) | `max-age=31536000, immutable` | 1 an, noms versionnés (hash) |
| **Catalogue produits** | `max-age=300, s-maxage=600, stale-while-revalidate=86400` | 5min client, 10min CDN, stale OK 24h |
| **Pages statiques** (CGU, À propos) | `max-age=3600, s-maxage=86400` | 1h client, 24h CDN |
| **Contenu user** (panier, profil) | `private, no-cache, must-revalidate` | Pas de cache public |
| **API temps réel** (stock, prix) | `no-store` | Aucun cache |

#### 5. Skeleton Screens & Min-Height

**Éviter CLS avec dimensions réservées**:

```tsx
// ✅ BON - Réserver l'espace avec min-height
<div className="min-h-[400px]">
  <Suspense fallback={<Skeleton className="h-[400px]" />}>
    <LazyComponent />
  </Suspense>
</div>

// ✅ BON - Skeleton qui matche le contenu réel
const ProductCardSkeleton = () => (
  <div className="animate-pulse">
    <div className="h-48 bg-gray-200 rounded-lg mb-4" />  {/* Image */}
    <div className="h-6 bg-gray-200 rounded w-3/4 mb-2" />  {/* Titre */}
    <div className="h-4 bg-gray-200 rounded w-full mb-2" />  {/* Prix */}
    <div className="h-10 bg-gray-200 rounded w-full" />  {/* Bouton */}
  </div>
);

// ❌ MAUVAIS - Pas de min-height = CLS
<Suspense fallback={<Spinner />}>
  <LazyComponent />  {/* Contenu apparaît, décale tout */}
</Suspense>
```

**Skeleton réutilisable**:

```tsx
// components/ui/Skeleton.tsx
export function Skeleton({ 
  className, 
  minHeight 
}: { 
  className?: string; 
  minHeight?: string;
}) {
  return (
    <div 
      className={`animate-pulse bg-gray-200 rounded ${className}`}
      style={{ minHeight }}
    />
  );
}
```

#### 6. JavaScript Bundle Optimization

**Vite configuration** (`vite.config.ts`):

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Séparer vendors volumineux
        manualChunks: {
          'react-vendor': ['react', 'react-dom', '@remix-run/react'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', 'lucide-react'],
          'charts': ['recharts', 'd3'],
          'forms': ['react-hook-form', 'zod'],
        }
      }
    },
    
    // Minification aggressive
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,    // Retirer console.log en prod
        drop_debugger: true,
        pure_funcs: ['console.info', 'console.debug'],
      },
      mangle: {
        safari10: true,  // Compatibilité Safari 10
      }
    },
    
    // Chunk size warnings
    chunkSizeWarningLimit: 500,  // KB
  },
  
  // CSS code splitting
  css: {
    devSourcemap: true,
  }
});
```

**Analyser les bundles**:

```bash
# Générer rapport d'analyse
npm run build -- --analyze

# Identifier les plus gros modules
npx vite-bundle-visualizer
```

---

## 🔍 SEO Technique: Standards Globaux

### Meta Tags: Template Obligatoire

**Chaque page DOIT avoir ces meta tags**:

```tsx
// routes/pieces.$slug.tsx
export const meta: MetaFunction<typeof loader> = ({ data, location }) => {
  if (!data || data.status !== 200) {
    return [
      { title: "Page non trouvée" },
      { name: "description", content: "La page demandée n'a pas été trouvée." },
      { name: "robots", content: "noindex, nofollow" },
    ];
  }
  
  const title = `${data.gamme.name} - Pièces ${data.vehicle?.brand} ${data.vehicle?.model} | Automecanik`;
  const description = data.gamme.description.substring(0, 160);  // Max 160 caractères
  const canonicalUrl = `https://www.automecanik.com${location.pathname}`;
  
  return [
    // ✅ Basiques obligatoires
    { title },
    { name: "description", content: description },
    { name: "robots", content: "index, follow" },  // ou "noindex, nofollow" si page test
    { name: "keywords", content: data.keywords?.join(', ') },
    
    // ✅ Canonical obligatoire
    { tagName: "link", rel: "canonical", href: canonicalUrl },
    
    // ✅ Open Graph pour partage social
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: canonicalUrl },
    { property: "og:image", content: data.ogImage || "https://www.automecanik.com/logo-og.webp" },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "Automecanik" },
    
    // ✅ Twitter Card
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: data.ogImage || "https://www.automecanik.com/logo-og.webp" },
    
    // ✅ Additionnels utiles
    { name: "author", content: "Automecanik" },
    { property: "og:locale", content: "fr_FR" },
  ];
};
```

**🚨 Règles critiques**:
- ✅ **Title**: 50-60 caractères max, unique par page
- ✅ **Description**: 150-160 caractères max, unique par page
- ✅ **Canonical**: Toujours défini, même si = URL actuelle
- ✅ **OG Image**: 1200×630px recommandé
- ✅ **Robots**: `index, follow` (ou `noindex, nofollow` si page test)

### Schema.org: Markup Structuré

**WebPage schema - Obligatoire toutes pages**:

```tsx
<script type="application/ld+json">
{JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": pageTitle,
  "description": pageDescription,
  "url": canonicalUrl,
  "inLanguage": "fr-FR",
  "datePublished": publishDate,
  "dateModified": lastModified,
  "breadcrumb": {
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbs.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.label,
      "item": `https://www.automecanik.com${item.href}`
    }))
  }
})}
</script>
```

**Product schema - Pages produit**:

```tsx
<script type="application/ld+json">
{JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Product",
  "name": product.name,
  "description": product.description,
  "image": product.imageUrl,
  "sku": product.sku,
  "mpn": product.mpn,
  "brand": {
    "@type": "Brand",
    "name": product.brand
  },
  "offers": {
    "@type": "Offer",
    "price": product.price,
    "priceCurrency": "EUR",
    "availability": product.inStock 
      ? "https://schema.org/InStock" 
      : "https://schema.org/OutOfStock",
    "url": productUrl,
    "priceValidUntil": priceValidUntil,
    "seller": {
      "@type": "Organization",
      "name": "Automecanik"
    }
  },
  "aggregateRating": product.reviewCount > 0 ? {
    "@type": "AggregateRating",
    "ratingValue": product.averageRating,
    "reviewCount": product.reviewCount,
    "bestRating": 5,
    "worstRating": 1
  } : undefined
})}
</script>
```

**Organization schema - Footer/À propos**:

```tsx
<script type="application/ld+json">
{JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Automecanik",
  "url": "https://www.automecanik.com",
  "logo": "https://www.automecanik.com/logo.webp",
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+33-1-23-45-67-89",
    "contactType": "Customer Service",
    "email": "contact@automecanik.com",
    "areaServed": "FR",
    "availableLanguage": ["French"]
  },
  "sameAs": [
    "https://www.facebook.com/automecanik",
    "https://www.instagram.com/automecanik",
    "https://twitter.com/automecanik"
  ]
})}
</script>
```

### Canonical URLs: Règles & Utilitaire

**Fonction utilitaire** (`utils/seo/canonical.ts`):

```typescript
/**
 * Construit une URL canonique en nettoyant les paramètres non-indexables
 */
export function buildCanonicalUrl(
  pathname: string, 
  searchParams?: URLSearchParams
): string {
  const baseUrl = 'https://www.automecanik.com';
  
  // Paramètres autorisés pour l'indexation
  const indexableParams = [
    'page',      // Pagination
    'sort',      // Tri
    'filter',    // Filtres produits
  ];
  
  // Paramètres à exclure (tracking, session, etc.)
  const excludedParams = [
    'utm_source', 'utm_medium', 'utm_campaign',  // Tracking
    'fbclid', 'gclid',  // Tracking social/ads
    'session_id', 'token',  // Session/auth
    'ref', 'source',  // Référents
  ];
  
  const cleanParams = new URLSearchParams();
  
  if (searchParams) {
    indexableParams.forEach(key => {
      const value = searchParams.get(key);
      if (value && !excludedParams.includes(key)) {
        cleanParams.set(key, value);
      }
    });
  }
  
  const queryString = cleanParams.toString();
  return `${baseUrl}${pathname}${queryString ? `?${queryString}` : ''}`;
}

// Utilisation
export const meta: MetaFunction<typeof loader> = ({ location }) => {
  const searchParams = new URLSearchParams(location.search);
  const canonicalUrl = buildCanonicalUrl(location.pathname, searchParams);
  
  return [
    { tagName: "link", rel: "canonical", href: canonicalUrl },
  ];
};
```

**Règles canonical**:
- ✅ **Toujours** défini, même si = URL actuelle (pas de duplicate)
- ✅ **Absolu**: Inclure domaine complet `https://...`
- ✅ **Nettoyé**: Retirer paramètres tracking (utm_*, fbclid, etc.)
- ✅ **Cohérent**: Même URL = même canonical
- ✅ **Pages paginées**: Inclure `?page=2` dans canonical

### Sitemap.xml: Génération Automatique

**Route dédiée** (`routes/sitemap[.]xml.tsx`):

```tsx
import { LoaderFunctionArgs } from '@remix-run/node';

interface SitemapUrl {
  loc: string;
  lastmod: string;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
}

export async function loader({ request }: LoaderFunctionArgs) {
  // Récupérer toutes les pages indexables depuis la DB
  const pages = await getAllIndexablePages();
  
  const urls: SitemapUrl[] = pages.map(page => ({
    loc: `https://www.automecanik.com${page.url}`,
    lastmod: page.lastModified.toISOString(),
    changefreq: page.changeFreq,
    priority: page.priority
  }));
  
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',  // Cache 1h
    }
  });
}
```

**Fréquences recommandées**:

| Type de page | changefreq | priority | Justification |
|--------------|------------|----------|---------------|
| Homepage | `daily` | `1.0` | Contenu mis à jour quotidiennement |
| Catégories principales | `weekly` | `0.9` | Structure stable, contenu changeant |
| Pages produits | `weekly` | `0.8` | Prix/stock peuvent changer |
| Fiches véhicules | `monthly` | `0.7` | Contenu quasi-statique |
| Articles blog | `monthly` | `0.6` | Contenu daté, rarement modifié |
| Pages légales | `yearly` | `0.3` | Contenu très stable |

**Sitemap index** (si > 50 000 URLs):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://www.automecanik.com/sitemap-products.xml</loc>
    <lastmod>2025-11-16T00:00:00+00:00</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://www.automecanik.com/sitemap-categories.xml</loc>
    <lastmod>2025-11-16T00:00:00+00:00</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://www.automecanik.com/sitemap-blog.xml</loc>
    <lastmod>2025-11-16T00:00:00+00:00</lastmod>
  </sitemap>
</sitemapindex>
```

### Robots.txt: Configuration

**Fichier** (`public/robots.txt`):

```txt
# Automecanik - Robots.txt
User-agent: *
Allow: /

# Pages à ne pas indexer
Disallow: /admin
Disallow: /api
Disallow: /test
Disallow: /_dev
Disallow: /checkout/payment  # Sauf confirmation
Disallow: /account/
Disallow: /cart

# Formats à ne pas indexer
Disallow: /*.json$
Disallow: /*?utm_*
Disallow: /*?fbclid=*

# Bots spécifiques
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

# Crawl rate (optionnel)
Crawl-delay: 1

# Sitemap
Sitemap: https://www.automecanik.com/sitemap.xml
Sitemap: https://www.automecanik.com/sitemap-products.xml
Sitemap: https://www.automecanik.com/sitemap-categories.xml
```

---

## 🎨 Images: Optimisation Globale

### Format & Compression Standards

**Règles obligatoires**:

| Aspect | Standard | Justification |
|--------|----------|---------------|
| **Format** | WebP primary, JPG fallback | WebP = 30% plus léger, support 95%+ navigateurs |
| **Compression** | WebP qualité 85%, JPG qualité 80% | Balance qualité/taille optimale |
| **Dimensions** | Toujours `width` et `height` | Évite CLS (layout shift) |
| **Lazy loading** | Activer sauf above-the-fold | Réduit chargement initial |
| **ALT tags** | Descriptifs avec contexte | SEO + Accessibilité |
| **Responsive** | srcset + sizes | Servir taille adaptée à l'écran |

### Responsive Images Avancé

**Pattern complet avec srcset, sizes, picture**:

```tsx
// ✅ BON - srcset pour densités/résolutions
<img
  src="/product-800w.webp"
  srcSet="
    /product-400w.webp 400w,
    /product-800w.webp 800w,
    /product-1200w.webp 1200w,
    /product-1600w.webp 1600w
  "
  sizes="
    (max-width: 640px) 100vw,
    (max-width: 1024px) 50vw,
    800px
  "
  alt="Plaquette de frein Porsche Cayenne 955"
  loading="lazy"
  width={800}
  height={600}
  className="w-full h-auto object-cover rounded-lg"
/>

// ✅ BON - <picture> pour formats différents par device
<picture>
  {/* Mobile: image verticale */}
  <source 
    media="(max-width: 768px)" 
    srcSet="/hero-mobile.webp" 
    type="image/webp"
    width={768}
    height={1024}
  />
  
  {/* Desktop: image horizontale */}
  <source 
    media="(min-width: 769px)" 
    srcSet="/hero-desktop.webp" 
    type="image/webp"
    width={1920}
    height={1080}
  />
  
  {/* Fallback JPG */}
  <img 
    src="/hero-desktop.jpg" 
    alt="Hero Automecanik"
    loading="eager"  {/* Above-the-fold */}
    width={1920}
    height={1080}
    className="w-full h-auto"
  />
</picture>
```

### ALT Tags SEO-Optimisés

**Format recommandé**:

```tsx
// ✅ BON - ALT descriptif avec contexte complet
alt={`${product.brand} ${product.model} ${product.year} - ${product.category} ${product.name}`}
// Exemple: "Porsche Cayenne 2015 - Plaquette de frein avant Brembo"

// ✅ BON - Images décoratives (vraiment décoratives)
alt=""  // Laisse vide pour que lecteurs d'écran ignorent

// ✅ BON - Logo
alt="Logo Automecanik - Pièces auto pas cher"

// ❌ MAUVAIS - ALT générique
alt="Image produit"
alt="Photo"
alt="img_12345.jpg"

// ❌ MAUVAIS - Keyword stuffing
alt="Plaquette frein Porsche Cayenne 955 plaquette de frein pas cher pièce auto discount"
```

### CDN & Supabase Storage

**Transformation d'images à la volée**:

```typescript
// utils/images.ts
export function getOptimizedImageUrl(
  storagePath: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpg' | 'png';
  } = {}
): string {
  const { width = 800, height = 600, quality = 85, format = 'webp' } = options;
  
  const { data } = supabase.storage
    .from('uploads')
    .getPublicUrl(storagePath, {
      transform: {
        width,
        height,
        resize: 'cover',
        quality,
        format
      }
    });
  
  return data.publicUrl;
}

// Utilisation
const imageUrl = getOptimizedImageUrl(
  'constructeurs-automobiles/marques-concepts/porsche/cayenne-955.webp',
  { width: 800, height: 600, quality: 85, format: 'webp' }
);
```

**Composant d'image optimisée réutilisable**:

```tsx
// components/OptimizedImage.tsx
interface OptimizedImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;  // Above-the-fold = true
  className?: string;
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  priority = false,
  className = ""
}: OptimizedImageProps) {
  const webpSrc = src.replace(/\.(jpg|jpeg|png)$/, '.webp');
  
  return (
    <picture>
      <source srcSet={webpSrc} type="image/webp" />
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className={className}
      />
    </picture>
  );
}
```

---

## 📊 Monitoring & Analytics

### Web Vitals Tracking

**Implémentation client** (`app/entry.client.tsx`):

```tsx
import { reportWebVitals } from './utils/monitoring';

// Reporter les Core Web Vitals à l'API backend
reportWebVitals((metric) => {
  // Envoyer à l'API d'analytics
  fetch('/api/analytics/performance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: metric.name,      // LCP, FID, CLS, FCP, TTFB
      value: metric.value,
      rating: metric.rating,  // 'good', 'needs-improvement', 'poor'
      id: metric.id,
      page: window.location.pathname,
      device: getDeviceType(),
      connection: getConnectionType(),
      timestamp: Date.now()
    }),
    // Utiliser sendBeacon si disponible (plus fiable)
    keepalive: true
  }).catch(console.error);
});

function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

function getConnectionType(): string {
  const nav = navigator as any;
  return nav.connection?.effectiveType || 'unknown';
}
```

**Utilitaire monitoring** (`utils/monitoring.ts`):

```typescript
import { onCLS, onFID, onLCP, onFCP, onTTFB } from 'web-vitals';

export function reportWebVitals(onPerfEntry: (metric: any) => void) {
  if (typeof window === 'undefined') return;
  
  onCLS(onPerfEntry);
  onFID(onPerfEntry);
  onLCP(onPerfEntry);
  onFCP(onPerfEntry);
  onTTFB(onPerfEntry);
}
```

**Backend API** (`backend/src/controllers/analytics.controller.ts`):

```typescript
@Controller('api/analytics')
export class AnalyticsController {
  @Post('performance')
  async trackPerformance(@Body() metrics: PerformanceMetric[]) {
    // Stocker dans DB ou service analytics
    await this.analyticsService.recordMetrics(metrics);
    
    // Alertes si métriques dégradées
    metrics.forEach(metric => {
      if (metric.rating === 'poor') {
        this.logger.warn(
          `⚠️ Poor ${metric.name}: ${metric.value}ms on ${metric.page} (${metric.device})`
        );
        // Envoyer alerte Slack/email si besoin
      }
    });
    
    return { success: true };
  }
}
```

### Lighthouse CI

**Configuration** (`.lighthouserc.json`):

```json
{
  "ci": {
    "collect": {
      "numberOfRuns": 3,
      "url": [
        "https://www.automecanik.com/",
        "https://www.automecanik.com/pieces/plaquette-de-frein-402.html",
        "https://www.automecanik.com/constructeurs/porsche/cayenne/955.html",
        "https://www.automecanik.com/blog/entretien-freins"
      ],
      "settings": {
        "preset": "desktop",
        "throttling": {
          "rttMs": 40,
          "throughputKbps": 10240,
          "cpuSlowdownMultiplier": 1
        }
      }
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", {"minScore": 0.9}],
        "categories:seo": ["error", {"minScore": 0.95}],
        "categories:accessibility": ["error", {"minScore": 0.9}],
        "categories:best-practices": ["error", {"minScore": 0.9}],
        
        "first-contentful-paint": ["warn", {"maxNumericValue": 1800}],
        "largest-contentful-paint": ["error", {"maxNumericValue": 2500}],
        "cumulative-layout-shift": ["error", {"maxNumericValue": 0.1}],
        "total-blocking-time": ["warn", {"maxNumericValue": 300}]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

**GitHub Actions** (`.github/workflows/lighthouse.yml`):

```yaml
name: Lighthouse CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Run Lighthouse CI
        run: |
          npm install -g @lhci/cli
          lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

---

## ✅ Checklist Pré-Production Complète

### SEO Technique

- [ ] **Title tag** unique par page (50-60 caractères)
- [ ] **Meta description** unique par page (150-160 caractères)
- [ ] **Robots meta** défini (`index, follow` ou `noindex, nofollow`)
- [ ] **Canonical URL** définie et correcte (absolu, sans tracking params)
- [ ] **Schema.org markup** présent (WebPage minimum, Product si applicable)
- [ ] **BreadcrumbList schema** avec fil d'Ariane structuré
- [ ] **Open Graph tags** complets (og:title, og:image, og:url, og:description)
- [ ] **Twitter Card tags** définis (twitter:card, twitter:image)
- [ ] **Sitemap.xml** inclut la page (si indexable)
- [ ] **Robots.txt** autorise l'indexation de la page
- [ ] **ALT tags** descriptifs sur toutes les images
- [ ] **H1 unique** et descriptif, hiérarchie H2/H3 logique

### Performance

- [ ] **Images optimisées** WebP avec fallback JPG/PNG
- [ ] **Lazy loading** activé sur images below-the-fold
- [ ] **Dimensions spécifiées** width/height sur toutes les images (éviter CLS)
- [ ] **Code splitting** sections non-critiques lazy loaded (Suspense)
- [ ] **Skeleton screens** avec min-height pour éviter layout shift
- [ ] **Cache headers** appropriés au type de contenu
- [ ] **Preload** ressources critiques (fonts, hero image)
- [ ] **Prefetch** pages liées importantes
- [ ] **Bundle JS** < 500 KB par chunk
- [ ] **Lighthouse score** Performance 90+
- [ ] **LCP** < 2.5s (Largest Contentful Paint)
- [ ] **FID** < 100ms (First Input Delay)
- [ ] **CLS** < 0.1 (Cumulative Layout Shift)

### Mobile-First

- [ ] **Responsive design** testé 375px, 768px, 1280px
- [ ] **Classes Tailwind** mobile-first (valeurs croissantes)
- [ ] **Touch targets** min 44×44px pour boutons/liens
- [ ] **Viewport meta** définie `width=device-width,initial-scale=1`
- [ ] **Fonts lisibles** min 16px sur mobile
- [ ] **Navigation mobile** fonctionnelle et accessible
- [ ] **Formulaires** input types appropriés (tel, email, etc.)
- [ ] **Keyboard navigation** fonctionne sur mobile

### Accessibilité (A11y)

- [ ] **Contraste couleurs** WCAG AA minimum (4.5:1 texte normal, 3:1 gros texte)
- [ ] **Navigation clavier** complète (Tab, Enter, Esc)
- [ ] **ARIA labels** sur éléments interactifs sans texte visible
- [ ] **Focus visible** sur tous les éléments interactifs
- [ ] **Headings hiérarchie** correcte (H1 unique, puis H2, H3...)
- [ ] **Formulaires** labels associés aux inputs
- [ ] **Erreurs** messages explicites et accessibles
- [ ] **Lecteurs d'écran** testés (NVDA/JAWS)

### Duplicate Content

- [ ] **Aucun texte générique** répété sur plus de 10 pages
- [ ] **Contenu unique** spécifique au contexte de la page
- [ ] **Schema.org** privilégié pour données structurées
- [ ] **Test similarité** < 50% entre 3 pages similaires
- [ ] **Canonical** défini si duplicates intentionnels

---

## 🚀 Outils & Ressources

### Outils d'Audit Performance

| Outil | Usage | Gratuit | URL |
|-------|-------|---------|-----|
| **Lighthouse** | Audit complet (Performance, SEO, A11y, Best Practices) | ✅ | Chrome DevTools F12 |
| **PageSpeed Insights** | Real User Metrics + Lab Data, suggestions Google | ✅ | https://pagespeed.web.dev |
| **WebPageTest** | Tests multi-locations, filmstrip, waterfall détaillé | ✅ | https://www.webpagetest.org |
| **GTmetrix** | Analyse performance, monitoring continu | ✅ + 💰 | https://gtmetrix.com |
| **Pingdom** | Monitoring uptime + performance global | 💰 | https://www.pingdom.com |

### Outils SEO

| Outil | Usage | Gratuit | URL |
|-------|-------|---------|-----|
| **Google Search Console** | Indexation, Core Web Vitals, erreurs crawl, rich results | ✅ | https://search.google.com/search-console |
| **Screaming Frog** | Crawl SEO technique (500 URLs gratuit) | ✅ (limité) | https://www.screamingfrogseospider.com |
| **Schema Markup Validator** | Validation Schema.org JSON-LD | ✅ | https://validator.schema.org |
| **Rich Results Test** | Test éligibilité rich snippets Google | ✅ | https://search.google.com/test/rich-results |
| **Ahrefs** | Analyse backlinks, mots-clés, concurrents | 💰 | https://ahrefs.com |
| **Semrush** | Audit SEO complet, suivi positions | 💰 | https://www.semrush.com |

### Outils Images

| Outil | Usage | Gratuit | URL |
|-------|-------|---------|-----|
| **Squoosh** | Compression WebP/JPG en ligne | ✅ | https://squoosh.app |
| **TinyPNG** | Compression PNG/JPG intelligente | ✅ (limité) | https://tinypng.com |
| **ImageOptim** | Compression locale (Mac) | ✅ | https://imageoptim.com |
| **Sharp** | Bibliothèque Node.js transformation images | ✅ | https://sharp.pixelplumbing.com |

### Scripts Utiles

```bash
# Vérifier images manquantes Supabase
npx ts-node scripts/check-missing-vehicle-images.ts

# Détecter duplicate content entre pages
npx ts-node scripts/detect-duplicate-content.ts

# Générer sitemap.xml depuis DB
npx ts-node scripts/generate-sitemap.ts

# Audit Lighthouse local
npx lighthouse https://localhost:3000 --view --preset=desktop

# Audit mobile
npx lighthouse https://localhost:3000 --view --preset=mobile --throttling.cpuSlowdownMultiplier=4

# Analyser bundle JavaScript
npm run build -- --analyze

# Vérifier broken links
npx broken-link-checker https://www.automecanik.com

# Test accessibilité automatique
npx pa11y https://localhost:3000
```

---

## 📚 Documentation Associée

### Guides internes

- [Mobile-First Guide](/workspaces/nestjs-remix-monorepo/MOBILE-FIRST-GUIDE.md)
- [SEO Implementation Complete](/workspaces/nestjs-remix-monorepo/frontend/SEO-IMPLEMENTATION-COMPLETE.md)
- [SEO Phase 2 - Lazy Loading](/workspaces/nestjs-remix-monorepo/frontend/SEO-PHASE2-LAZY-COMPLETE.md)
- [Development Workflow](/workspaces/nestjs-remix-monorepo/.spec/docs/docs/guides/development-workflow.md)

### Ressources externes

- [Core Web Vitals - web.dev](https://web.dev/vitals/)
- [Lighthouse Scoring Calculator](https://googlechrome.github.io/lighthouse/scorecalc/)
- [Schema.org - Product](https://schema.org/Product)
- [Schema.org - WebPage](https://schema.org/WebPage)
- [Open Graph Protocol](https://ogp.me/)
- [Remix Performance Guide](https://remix.run/docs/en/main/guides/performance)
- [Google Search Central](https://developers.google.com/search/docs)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

## 🎯 Résumé Exécutif

### Standards Obligatoires

1. **Mobile-First**: Toujours coder mobile d'abord (valeurs croissantes)
2. **Core Web Vitals**: LCP < 2.5s, FID < 100ms, CLS < 0.1
3. **Meta Tags**: Title/description uniques, canonical, OG tags
4. **Schema.org**: WebPage minimum, Product si applicable
5. **Images**: WebP + dimensions + lazy loading + ALT descriptifs
6. **Performance**: Code splitting, cache, prefetch/preload
7. **Accessibilité**: Contraste WCAG AA, navigation clavier, ARIA

### Objectifs Lighthouse

| Catégorie | Score Minimum | Score Idéal |
|-----------|---------------|-------------|
| Performance | 85 | 95+ |
| SEO | 90 | 100 |
| Accessibility | 85 | 95+ |
| Best Practices | 90 | 100 |

### Impact Estimé

Appliquer ce guide sur toutes les pages:
- 📈 **+40% vitesse chargement** (lazy loading + code splitting)
- 🚀 **+25 points Lighthouse** Performance
- 📱 **100% mobile-friendly** (mobile-first systématique)
- 🔍 **Rich snippets Google** (Schema.org)
- ♿ **Accessibilité AA** (WCAG 2.1)
- 🌐 **SEO technique parfait** (meta tags, canonical, sitemap)

---

**Dernière mise à jour:** 16 novembre 2025  
**Auteur:** Équipe développement  
**Version:** 1.0.0  
**Status:** 📐 Guide de référence global - Obligatoire toutes pages
