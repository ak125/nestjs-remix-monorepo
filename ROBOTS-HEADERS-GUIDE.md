# 🤖 ROBOTS.TXT & HEADERS SEO - Guide Complet

## 📋 Table des Matières

1. [Architecture](#architecture)
2. [Robots.txt Dynamique](#robots-txt-dynamique)
3. [Headers SEO HTTP](#headers-seo-http)
4. [Configuration](#configuration)
5. [Usage](#usage)
6. [Exemples](#exemples)
7. [Testing](#testing)
8. [Déploiement](#déploiement)

---

## 🏗️ Architecture

### Fichiers Créés

```
backend/src/modules/seo/
├── services/
│   ├── robots-txt.service.ts          # 🤖 Génération robots.txt
│   └── seo-headers.service.ts         # 📄 Génération headers SEO
├── controllers/
│   └── robots-txt.controller.ts       # Route /robots.txt
├── interceptors/
│   └── seo-headers.interceptor.ts     # Injection auto headers
└── seo.module.ts                      # Module (mis à jour)
```

---

## 🤖 Robots.txt Dynamique

### Principe

**2 versions selon environnement :**

- **Production** : Autorise crawl avec directives intelligentes
- **Dev/Staging** : Bloque tout (`Disallow: /`)

### Service `RobotsTxtService`

```typescript
// backend/src/modules/seo/services/robots-txt.service.ts

@Injectable()
export class RobotsTxtService {
  generate(): string {
    if (this.isProduction) {
      return this.generateProduction(); // ✅ Autoriser crawl
    }
    return this.generateDevelopment(); // 🚫 Bloquer tout
  }
}
```

### Robots.txt Production

**Autorise :**
- ✅ Toutes les pages publiques
- ✅ Images `/images/`, `/uploads/`
- ✅ Produits `/pieces/`, `/produits/`
- ✅ Blog `/blog/`, `/conseils/`

**Bloque :**
- 🚫 `/api/` (pas d'indexation API)
- 🚫 `/admin/` (backoffice)
- 🚫 `/checkout/` (tunnel achat)
- 🚫 `/panier/` (panier privé)
- 🚫 `/compte/` (espace client)
- 🚫 `?utm_*`, `?fbclid=`, `?gclid=` (tracking)

**User-agents spécifiques :**

```robotstxt
# Googlebot (prioritaire)
User-agent: Googlebot
Allow: /
Disallow: /api/
Crawl-delay: 0.5

# Googlebot-Shopping (e-commerce)
User-agent: Googlebot-Shopping
Allow: /pieces/
Allow: /produits/
Disallow: /api/

# Bad bots (bloquer)
User-agent: AhrefsBot
Disallow: /
```

**Sitemaps déclarés :**

```robotstxt
# Sitemaps V2 (NestJS)
Sitemap: https://automecanik.com/sitemap.xml
Sitemap: https://automecanik.com/sitemap-v2/index.xml

# Sitemaps Remix
Sitemap: https://automecanik.com/sitemap-blog.xml
Sitemap: https://automecanik.com/sitemap-pages.xml
Sitemap: https://automecanik.com/sitemap-conseils.xml

# Sitemaps multilingues
Sitemap: https://automecanik.com/sitemap-fr.xml
Sitemap: https://be.automecanik.com/sitemap-be.xml
Sitemap: https://uk.automecanik.com/sitemap-uk.xml
```

### Robots.txt Development

**Bloque tout crawl :**

```robotstxt
# Robots.txt Development - DO NOT INDEX

# 🚫 Block all crawlers in development
User-agent: *
Disallow: /
```

### Contrôleur `RobotsTxtController`

```typescript
@Controller()
export class RobotsTxtController {
  @Get('robots.txt')
  @Header('Content-Type', 'text/plain')
  @Header('Cache-Control', 'public, max-age=86400') // 24h
  getRobotsTxt(): string {
    return this.robotsTxtService.generate();
  }
}
```

**Endpoints :**

```bash
# Production
GET https://automecanik.com/robots.txt
# → Retourne robots.txt production

# Dev/Staging
GET https://staging.automecanik.com/robots.txt
# → Retourne robots.txt dev (Disallow: /)
```

---

## 📄 Headers SEO HTTP

### Service `SeoHeadersService`

**8 méthodes pour générer headers selon contexte :**

#### 1. Headers par défaut

```typescript
getDefaultHeaders(): SeoHeaders {
  return {
    'X-Robots-Tag': 'index, follow',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    Vary: 'Accept-Encoding',
  };
}
```

#### 2. Headers produits

```typescript
getProductHeaders(canonical: string): SeoHeaders {
  return {
    'X-Robots-Tag': 'index, follow, max-image-preview:large',
    Link: `<${canonical}>; rel="canonical"`,
  };
}
```

**Exemple :**

```http
GET /pieces/plaquettes-frein-renault-clio-123
X-Robots-Tag: index, follow, max-image-preview:large
Link: <https://automecanik.com/pieces/plaquettes-frein-renault-clio-123>; rel="canonical"
```

#### 3. Headers blog

```typescript
getBlogHeaders(canonical: string): SeoHeaders {
  return {
    'X-Robots-Tag': 'index, follow, max-snippet:320',
    Link: `<${canonical}>; rel="canonical"`,
  };
}
```

#### 4. Headers NO INDEX

```typescript
getNoIndexHeaders(): SeoHeaders {
  return {
    'X-Robots-Tag': 'noindex, nofollow',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  };
}
```

**Usage :** `/admin/`, `/compte/`, `/checkout/`

#### 5. Headers Hreflang

```typescript
getHreflangHeaders(alternates: Array<{ href: string; hreflang: string }>): SeoHeaders {
  const linkHeader = alternates
    .map((alt) => `<${alt.href}>; rel="alternate"; hreflang="${alt.hreflang}"`)
    .join(', ');

  return {
    Link: linkHeader,
    Vary: 'Accept-Language, Accept-Encoding',
  };
}
```

**Exemple :**

```http
GET /pieces/freins
Link: <https://automecanik.com/pieces/freins>; rel="alternate"; hreflang="fr",
      <https://be.automecanik.com/pieces/freins>; rel="alternate"; hreflang="fr-BE",
      <https://uk.automecanik.com/pieces/brakes>; rel="alternate"; hreflang="en-GB"
Vary: Accept-Language, Accept-Encoding
```

#### 6. Headers Pagination

```typescript
getPaginationHeaders(prev?: string, next?: string, canonical?: string): SeoHeaders {
  const links: string[] = [];
  if (canonical) links.push(`<${canonical}>; rel="canonical"`);
  if (prev) links.push(`<${prev}>; rel="prev"`);
  if (next) links.push(`<${next}>; rel="next"`);

  return {
    Link: links.join(', '),
  };
}
```

**Exemple :**

```http
GET /pieces?page=3
Link: <https://automecanik.com/pieces?page=3>; rel="canonical",
      <https://automecanik.com/pieces?page=2>; rel="prev",
      <https://automecanik.com/pieces?page=4>; rel="next"
```

#### 7. Headers Images (CDN)

```typescript
getImageHeaders(): SeoHeaders {
  return {
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Access-Control-Allow-Origin': '*',
  };
}
```

#### 8. Headers API

```typescript
getApiHeaders(): SeoHeaders {
  return {
    'X-Robots-Tag': 'noindex, nofollow',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  };
}
```

---

## 🛡️ Interceptor Headers SEO

### `SeoHeadersInterceptor`

**Injection automatique des headers selon la route :**

```typescript
@Injectable()
export class SeoHeadersInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse<Response>();
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.url;

    let headers = this.seoHeadersService.getDefaultHeaders();

    // Routes API - ne pas indexer
    if (path.startsWith('/api/')) {
      headers = this.seoHeadersService.getApiHeaders();
    }
    // Routes privées
    else if (path.startsWith('/admin/') || path.startsWith('/compte/')) {
      headers = this.seoHeadersService.getNoIndexHeaders();
    }
    // Produits
    else if (path.startsWith('/pieces/')) {
      const canonical = `https://automecanik.com${path.split('?')[0]}`;
      headers = this.seoHeadersService.getProductHeaders(canonical);
    }
    // Blog
    else if (path.startsWith('/blog/')) {
      const canonical = `https://automecanik.com${path.split('?')[0]}`;
      headers = this.seoHeadersService.getBlogHeaders(canonical);
    }

    // Appliquer headers
    Object.entries(headers).forEach(([key, value]) => {
      if (value) response.setHeader(key, value);
    });

    return next.handle();
  }
}
```

### Activer l'interceptor

**Option 1 : Global (tous les contrôleurs)**

```typescript
// backend/src/main.ts
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SeoHeadersInterceptor } from './modules/seo/interceptors/seo-headers.interceptor';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: SeoHeadersInterceptor,
    },
  ],
})
export class AppModule {}
```

**Option 2 : Par contrôleur**

```typescript
@Controller('pieces')
@UseInterceptors(SeoHeadersInterceptor)
export class PiecesController {
  // Headers SEO auto-injectés
}
```

**Option 3 : Par route**

```typescript
@Get(':slug')
@UseInterceptors(SeoHeadersInterceptor)
async getPieceBySlug(@Param('slug') slug: string) {
  // Headers SEO auto-injectés
}
```

---

## ⚙️ Configuration

### Variables d'environnement

```bash
# .env.production
NODE_ENV=production
BASE_URL=https://automecanik.com

# .env.staging
NODE_ENV=staging
BASE_URL=https://staging.automecanik.com

# .env.development
NODE_ENV=development
BASE_URL=http://localhost:3000
```

### ConfigModule

```typescript
// backend/src/modules/seo/services/robots-txt.service.ts
constructor(private configService: ConfigService) {
  this.isProduction = this.configService.get('NODE_ENV') === 'production';
  this.baseUrl = this.configService.get('BASE_URL', 'https://automecanik.com');
}
```

---

## 📘 Usage

### 1. Générer robots.txt

```bash
# Production
curl https://automecanik.com/robots.txt

# Dev
curl http://localhost:3000/robots.txt
```

### 2. Vérifier headers SEO

```bash
# Headers produit
curl -I https://automecanik.com/pieces/plaquettes-frein-123

# Devrait retourner :
# X-Robots-Tag: index, follow, max-image-preview:large
# Link: <https://automecanik.com/pieces/plaquettes-frein-123>; rel="canonical"
```

### 3. Tester no-index (admin)

```bash
curl -I https://automecanik.com/admin/dashboard

# Devrait retourner :
# X-Robots-Tag: noindex, nofollow
# Cache-Control: no-cache, no-store, must-revalidate
```

### 4. Tester hreflang

```typescript
// Dans un contrôleur produit
@Get(':slug')
async getPiece(@Param('slug') slug: string, @Res() res: Response) {
  const alternates = [
    { href: 'https://automecanik.com/pieces/freins', hreflang: 'fr' },
    { href: 'https://be.automecanik.com/pieces/freins', hreflang: 'fr-BE' },
    { href: 'https://uk.automecanik.com/pieces/brakes', hreflang: 'en-GB' },
  ];

  const headers = this.seoHeadersService.getHreflangHeaders(alternates);

  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  return res.json({ piece: 'data' });
}
```

### 5. Générer meta robots tag

```typescript
// Pour meta HTML <meta name="robots" content="...">
const metaTag = this.robotsTxtService.generateMetaRobots({
  index: true,
  follow: true,
  noarchive: false,
  nosnippet: false,
  noimageindex: false,
});

console.log(metaTag);
// → "index, follow"
```

### 6. Vérifier si URL indexable

```typescript
const shouldIndex = this.robotsTxtService.shouldIndex('/pieces/freins');
console.log(shouldIndex); // → true

const shouldNotIndex = this.robotsTxtService.shouldIndex('/api/products');
console.log(shouldNotIndex); // → false
```

---

## 🧪 Testing

### Test robots.txt

```bash
# Test production
curl https://automecanik.com/robots.txt | head -n 20

# Doit contenir :
# User-agent: *
# Allow: /
# Disallow: /api/
# Sitemap: https://automecanik.com/sitemap.xml
```

### Test headers

```bash
# Test headers produit
curl -I https://automecanik.com/pieces/test | grep -i "x-robots"

# Doit retourner :
# X-Robots-Tag: index, follow, max-image-preview:large
```

### Validation Google

**Search Console → Inspection d'URL :**

1. Tester URL live
2. Vérifier "Indexation autorisée ?"
3. Voir "Robots.txt" (doit être "Autorisé")
4. Voir "X-Robots-Tag" (doit être "index, follow")

---

## 🚀 Déploiement

### Checklist

- [ ] Variables d'environnement (`NODE_ENV`, `BASE_URL`)
- [ ] Module SEO activé dans `AppModule`
- [ ] Interceptor activé (global ou par contrôleur)
- [ ] Test `/robots.txt` en production
- [ ] Test headers avec `curl -I`
- [ ] Validation Search Console
- [ ] Vérifier sitemaps déclarés dans robots.txt

### Caddy (reverse proxy)

**Servir robots.txt depuis NestJS :**

```caddyfile
automecanik.com {
    # Robots.txt dynamique (NestJS)
    reverse_proxy /robots.txt localhost:3000

    # Sitemaps (NestJS)
    reverse_proxy /sitemap*.xml localhost:3000

    # Reste (frontend Remix)
    reverse_proxy localhost:3001
}
```

### Docker

**Variables d'environnement :**

```yaml
# docker-compose.prod.yml
services:
  backend:
    environment:
      NODE_ENV: production
      BASE_URL: https://automecanik.com
```

---

## 📊 Monitoring

### Logs NestJS

```bash
# Vérifier initialisation
docker logs backend | grep "RobotsTxtService"

# Devrait afficher :
# [RobotsTxtService] 🤖 RobotsTxtService initialized (PRODUCTION)
```

### Google Search Console

**Statistiques d'exploration :**

1. Paramètres → Statistiques d'exploration
2. Vérifier "Réponses par code d'état"
3. 200 OK pour pages indexables
4. 403/404 pour pages bloquées

### Ahrefs / Semrush

**Robots.txt Analysis :**

1. Site Audit → Crawlability
2. Vérifier "Blocked by robots.txt"
3. S'assurer que seules les routes privées sont bloquées

---

## ✅ Avantages

### Robots.txt Dynamique

- ✅ **Sécurité** : Environnements dev/staging non indexés
- ✅ **Flexibilité** : Génération selon contexte (multi-tenant, A/B testing)
- ✅ **Maintenance** : Une seule source de vérité (service)
- ✅ **Traçabilité** : Logs NestJS pour debug

### Headers SEO HTTP

- ✅ **Performance** : Headers HTTP > meta HTML (moins de parsing)
- ✅ **Canonicalisation** : Link header > meta canonical
- ✅ **Hreflang** : Link header > HTML pour grandes listes
- ✅ **Cache** : CDN peut servir headers (Cloudflare, Fastly)
- ✅ **API-friendly** : Pas besoin de HTML pour API
- ✅ **Middleware** : Injection automatique (interceptor)

---

## 🔗 Ressources

- [Google Robots.txt Tester](https://www.google.com/webmasters/tools/robots-testing-tool)
- [X-Robots-Tag Specification](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)
- [Link Header RFC 5988](https://tools.ietf.org/html/rfc5988)
- [HTTP Caching RFC 7234](https://tools.ietf.org/html/rfc7234)

---

## 📌 Prochaines Étapes

1. ✅ Robots.txt dynamique créé
2. ✅ Headers SEO service créé
3. ✅ Interceptor auto-injection créé
4. ⏳ Activer interceptor global dans `main.ts`
5. ⏳ Tester en production
6. ⏳ Valider Search Console
7. ⏳ Intégrer avec Hreflang service
8. ⏳ Ajouter support AMP (si applicable)

---

**📅 Dernière mise à jour :** ${new Date().toISOString()}  
**🎯 Statut :** Prêt pour production
