# Module Blog Metadata - Spécification Technique

## 1. Vue d'ensemble

### Description
Module léger pour gestion des métadonnées SEO des pages blog (title, description, keywords, H1, breadcrumbs ariane) depuis table unique `__blog_meta_tags_ariane`. Système de fallback avec métadonnées par défaut, cache Redis 1h TTL, API REST pour récupération et invalidation cache.

### Objectifs
- **Métadonnées SEO centralisées** : Une table unique pour toutes les pages blog
- **Cache performant** : Redis 1h TTL pour réduire requêtes DB
- **Fallback intelligent** : Métadonnées par défaut si alias non trouvé
- **API REST simple** : GET metadata, DELETE cache
- **Exportable** : Service utilisable par autres modules (products, catalog, etc.)

### Contexte technique
- **Architecture** : NestJS + Supabase PostgreSQL (1 table)
- **Cache** : Redis TTL 3600s (1 heure)
- **Format** : Interface TypeScript `BlogMetadata`
- **Normalisation** : `relfollow` (1/0 → index,follow/noindex,nofollow)

---

## 2. Objectifs détaillés

### Fonctionnels
1. **Récupération métadonnées par alias**
   - Lookup table `__blog_meta_tags_ariane` par `mta_alias`
   - Cache Redis 1h TTL
   - Fallback si alias non trouvé

2. **Liste toutes métadonnées**
   - Utile pour génération sitemap
   - Tri alphabétique par alias
   - Cache global

3. **Liste alias disponibles**
   - Récupérer tous `mta_alias` uniques
   - Utile pour validation frontend

4. **Invalidation cache**
   - DELETE par alias spécifique
   - DELETE global (tous alias)
   - Logging invalidations

5. **Normalisation données**
   - `relfollow`: "1"/"0" → "index, follow"/"noindex, nofollow"
   - Trimming espaces
   - HTML entities décodage (optionnel)

### Non-fonctionnels
- **Performance** :
  - GET metadata: p50 <50ms (cache hit), p95 <200ms (cache miss)
  - Cache hit ratio: >90%
- **Disponibilité** : 99.9%
- **Cache TTL** : 3600s (1 heure)
- **Monitoring** : Logs INFO (get, cache hits/misses)

---

## 3. Hors périmètre

- ❌ **Création/édition métadonnées via API** → Gestion directe dans Supabase
- ❌ **Versioning métadonnées** → Pas de draft/published
- ❌ **Multilingue (i18n)** → Français uniquement
- ❌ **A/B testing meta tags** → Future phase
- ❌ **Analytics meta tags** → Séparé (Google Analytics, etc.)
- ❌ **Schema.org JSON-LD** → Future phase

---

## 4. Architecture

### Structure du module

```
backend/src/modules/blog-metadata/
├── blog-metadata.module.ts          # Configuration module
├── blog-metadata.controller.ts      # API REST (GET, DELETE)
└── blog-metadata.service.ts         # Logique métier + cache
```

### Configuration module

```typescript
@Module({
  controllers: [BlogMetadataController],
  providers: [BlogMetadataService],
  exports: [BlogMetadataService],  // Exporté pour autres modules
})
export class BlogMetadataModule {}
```

**Dépendances:**
- `CACHE_MANAGER` : Redis cache
- `SUPABASE_CLIENT` : Supabase PostgreSQL client

---

## 5. Modèle de données

### Table SQL

#### `__blog_meta_tags_ariane` - Métadonnées SEO pages blog
```sql
mta_id INTEGER PRIMARY KEY
mta_alias VARCHAR(255) UNIQUE NOT NULL    -- Clé unique page (ex: 'constructeurs', 'advice', 'home')
mta_title VARCHAR(255)                    -- Meta title SEO
mta_descrip TEXT                          -- Meta description
mta_keywords VARCHAR(500)                 -- Keywords CSV
mta_h1 VARCHAR(255)                       -- H1 page
mta_ariane TEXT                           -- Breadcrumbs fil d'ariane (ex: 'Accueil > Constructeurs')
mta_content TEXT                          -- Contenu additionnel (optionnel)
mta_relfollow VARCHAR(20)                 -- Robots meta ("1" = index, "0" = noindex)

CREATE UNIQUE INDEX idx_meta_alias ON __blog_meta_tags_ariane(mta_alias);
```

**Exemples de données:**
```sql
-- Homepage blog
INSERT INTO __blog_meta_tags_ariane VALUES (
  1,
  'home',
  'Automecanik - Pièces détachées automobiles',
  'Découvrez notre catalogue complet de pièces auto.',
  'pièces auto, accessoires, automecanik',
  'Bienvenue sur Automecanik',
  'Accueil',
  NULL,
  '1'
);

-- Page constructeurs
INSERT INTO __blog_meta_tags_ariane VALUES (
  2,
  'constructeurs',
  'Catalogue Technique Auto - Toutes les marques',
  'Pièces détachées pour toutes les marques automobiles.',
  'constructeurs, marques auto, catalogue',
  'Catalogue des Constructeurs Automobiles',
  'Accueil > Constructeurs',
  NULL,
  '1'
);

-- Page conseils
INSERT INTO __blog_meta_tags_ariane VALUES (
  3,
  'advice',
  'Conseils & Guides Auto | Automecanik',
  'Tous nos conseils pour l\'entretien de votre véhicule.',
  'conseils auto, guides, entretien',
  'Conseils & Guides',
  'Accueil > Conseils',
  NULL,
  '1'
);
```

### Cache Redis

```typescript
// Key: blog-meta:{alias}
// Value: BlogMetadata (JSON)
// TTL: 3600s (1 heure)

// Exemple:
{
  "title": "Catalogue Technique Auto - Toutes les marques",
  "description": "Pièces détachées pour toutes les marques automobiles.",
  "keywords": "constructeurs, marques auto, catalogue",
  "h1": "Catalogue des Constructeurs Automobiles",
  "ariane": "Accueil > Constructeurs",
  "content": null,
  "relfollow": "index, follow"
}
```

**Clés cache:**
- `blog-meta:{alias}` : Métadonnées spécifiques (ex: `blog-meta:constructeurs`)
- `blog-meta:all` : Toutes métadonnées (liste complète)
- `blog-meta:aliases` : Liste tous alias disponibles

### Interface TypeScript

```typescript
// blog-metadata.service.ts
export interface BlogMetadata {
  title: string;
  description: string;
  keywords: string;
  h1: string;
  ariane: string;              // Breadcrumbs fil d'ariane
  content: string | null;      // Contenu additionnel (optionnel)
  relfollow: string;           // "index, follow" | "noindex, nofollow"
}
```

---

## 6. API Endpoints

### 6.1 Récupérer métadonnées par alias

#### GET `/api/blog/metadata/:alias`
Récupérer métadonnées SEO d'une page spécifique.

**Params:**
- `alias` (required): Clé unique page (ex: 'constructeurs', 'advice', 'home')

**Response 200:**
```json
{
  "success": true,
  "alias": "constructeurs",
  "message": "Métadonnées récupérées pour \"constructeurs\"",
  "data": {
    "title": "Catalogue Technique Auto - Toutes les marques",
    "description": "Pièces détachées pour toutes les marques automobiles.",
    "keywords": "constructeurs, marques auto, catalogue",
    "h1": "Catalogue des Constructeurs Automobiles",
    "ariane": "Accueil > Constructeurs",
    "content": null,
    "relfollow": "index, follow"
  }
}
```

**Comportement:**
1. Lookup cache Redis `blog-meta:{alias}`
2. Si cache hit → retourner immédiatement
3. Si cache miss → query Supabase `__blog_meta_tags_ariane`
4. Si DB hit → mettre en cache (TTL 3600s) + retourner
5. Si DB miss → retourner fallback par défaut

**Fallback par défaut (si alias non trouvé):**
```json
{
  "title": "Automecanik - Pièces Auto",
  "description": "Pièces détachées automobiles de qualité",
  "keywords": "pièces auto",
  "h1": "Automecanik",
  "ariane": "Accueil",
  "content": null,
  "relfollow": "index, follow"
}
```

**Fallbacks spécifiques:**
- `home` : "Automecanik - Pièces détachées automobiles"
- `constructeurs` : "Catalogue Technique Auto - Toutes les marques"
- `advice` : "Conseils & Guides Auto | Automecanik"
- `article` : "Article | Automecanik"
- `guide` : "Guides Techniques | Automecanik"

**Performance:** p50: <50ms (cache hit), p95: <200ms (cache miss)

**Code exemple:**
```typescript
// blog-metadata.controller.ts
@Get(':alias')
async getMetadata(@Param('alias') alias: string) {
  this.logger.log(`GET /api/blog/metadata/${alias}`);

  const metadata = await this.metadataService.getMetadata(alias);

  return {
    success: true,
    data: metadata,
    alias,
    message: `Métadonnées récupérées pour "${alias}"`,
  };
}
```

---

### 6.2 Récupérer toutes métadonnées

#### GET `/api/blog/metadata`
Récupérer toutes les métadonnées disponibles.

**Response 200:**
```json
{
  "success": true,
  "total": 5,
  "message": "5 métadonnées récupérées",
  "data": [
    {
      "title": "Conseils & Guides Auto | Automecanik",
      "description": "Tous nos conseils pour l'entretien de votre véhicule.",
      "keywords": "conseils auto, guides, entretien",
      "h1": "Conseils & Guides",
      "ariane": "Accueil > Conseils",
      "content": null,
      "relfollow": "index, follow"
    },
    {
      "title": "Catalogue Technique Auto - Toutes les marques",
      "description": "Pièces détachées pour toutes les marques automobiles.",
      "keywords": "constructeurs, marques auto, catalogue",
      "h1": "Catalogue des Constructeurs Automobiles",
      "ariane": "Accueil > Constructeurs",
      "content": null,
      "relfollow": "index, follow"
    }
  ]
}
```

**Utilisation:**
- Génération sitemap XML
- Index pages blog
- SEO audit

**Cache:** `blog-meta:all` (TTL 3600s)

**Performance:** p50: <50ms (cache hit), p95: <300ms (cache miss, multiple rows)

---

### 6.3 Lister alias disponibles

#### GET `/api/blog/metadata/aliases/list`
Récupérer la liste de tous les alias disponibles.

**Response 200:**
```json
{
  "success": true,
  "total": 5,
  "message": "5 alias disponibles",
  "data": [
    "advice",
    "article",
    "constructeurs",
    "guide",
    "home"
  ]
}
```

**Utilisation:**
- Validation alias frontend
- Génération routes dynamiques

**Cache:** `blog-meta:aliases` (TTL 3600s)

---

### 6.4 Invalider cache spécifique

#### DELETE `/api/blog/metadata/cache/:alias`
Invalider le cache d'un alias spécifique.

**Params:**
- `alias` (required): Alias à invalider

**Response 204 No Content:**
```json
{
  "success": true,
  "message": "Cache invalidé pour \"constructeurs\""
}
```

**Comportement:**
1. Supprimer clé Redis `blog-meta:{alias}`
2. Logger invalidation
3. Retourner confirmation

**Utilisation:**
- Après mise à jour métadonnées dans Supabase
- Forcer refresh cache

**Code exemple:**
```typescript
// blog-metadata.controller.ts
@Delete('cache/:alias')
@HttpCode(HttpStatus.NO_CONTENT)
async invalidateCache(@Param('alias') alias: string) {
  this.logger.log(`DELETE /api/blog/metadata/cache/${alias}`);

  await this.metadataService.invalidateCache(alias);

  return {
    success: true,
    message: `Cache invalidé pour "${alias}"`,
  };
}
```

---

### 6.5 Invalider tout le cache

#### DELETE `/api/blog/metadata/cache`
Invalider tout le cache des métadonnées.

**Response 204 No Content:**
```json
{
  "success": true,
  "message": "Tout le cache des métadonnées invalidé"
}
```

**Comportement:**
1. Récupérer tous alias depuis `getAvailableAliases()`
2. Supprimer chaque clé `blog-meta:{alias}`
3. Supprimer clés globales (`blog-meta:all`, `blog-meta:aliases`)
4. Logger invalidation globale

**Utilisation:**
- Après migration DB
- Maintenance cache

**Code exemple:**
```typescript
// blog-metadata.service.ts
async invalidateAllCache(): Promise<void> {
  // Récupérer tous les alias
  const aliases = await this.getAvailableAliases();

  // Invalider chaque alias
  for (const alias of aliases) {
    await this.invalidateCache(alias);
  }

  // Invalider caches globaux
  await this.cacheManager.del('blog-meta:all');
  await this.cacheManager.del('blog-meta:aliases');

  this.logger.log('🗑️ Tout le cache des métadonnées invalidé');
}
```

---

## 7. Sécurité

### Authentification
- **Endpoints publics** : GET metadata (pas d'authentification requise)
- **Endpoints admin** : DELETE cache → `IsAdminGuard` (niveau ≥ 7) **NON IMPLÉMENTÉ**

**⚠️ Note sécurité actuelle:**
DELETE cache endpoints sont publics! Recommandation: Ajouter `IsAdminGuard` en production.

```typescript
// À ajouter (future):
@Delete('cache/:alias')
@UseGuards(AuthenticatedGuard, IsAdminGuard)  // Admin seulement
@HttpCode(HttpStatus.NO_CONTENT)
async invalidateCache(@Param('alias') alias: string) {
  // ...
}
```

### Validation entrées
```typescript
// Validation alias (alphanumeric + tirets)
const isValidAlias = (alias: string): boolean => {
  return /^[a-z0-9-]+$/.test(alias);
};
```

### Normalisation relfollow
```typescript
// blog-metadata.service.ts
private normalizeRelFollow(value: string | null | undefined): string {
  if (!value) return 'index, follow';

  // Format numérique legacy
  if (value === '1') return 'index, follow';
  if (value === '0') return 'noindex, nofollow';

  // Format texte standard
  if (value === 'index, follow' || value === 'index,follow') {
    return 'index, follow';
  }
  if (value === 'noindex, nofollow' || value === 'noindex,nofollow') {
    return 'noindex, nofollow';
  }

  // Par défaut: index
  return 'index, follow';
}
```

---

## 8. Performance

### Objectifs de performance

| Opération | p50 | p95 | p99 | Notes |
|-----------|-----|-----|-----|-------|
| GET metadata (cache hit) | <50ms | <100ms | <200ms | Redis lookup |
| GET metadata (cache miss) | <150ms | <300ms | <500ms | Supabase query + cache set |
| GET all metadata (cache hit) | <50ms | <100ms | <200ms | Redis lookup |
| GET all metadata (cache miss) | <200ms | <400ms | <800ms | Multiple rows |
| DELETE cache | <30ms | <80ms | <150ms | Redis delete |

### Cache stratégies

#### Cache individuel (par alias)
```typescript
// TTL: 3600s (1 heure)
const cacheKey = `blog-meta:${alias}`;
await this.cacheManager.set(cacheKey, metadata, 3600);
```

#### Cache global (toutes métadonnées)
```typescript
// TTL: 3600s
const cacheKey = 'blog-meta:all';
await this.cacheManager.set(cacheKey, allMetadata, 3600);
```

#### Cache aliases
```typescript
// TTL: 3600s
const cacheKey = 'blog-meta:aliases';
await this.cacheManager.set(cacheKey, aliases, 3600);
```

### Optimisations

1. **Cache-first strategy** : Toujours vérifier cache avant DB
2. **Fallback léger** : Pas de DB query pour fallbacks
3. **Batch invalidation** : Invalider tous alias en une boucle
4. **Logging minimal** : INFO seulement (pas DEBUG en production)

---

## 9. Tests

### Tests unitaires

```typescript
// blog-metadata.service.spec.ts
describe('BlogMetadataService', () => {
  let service: BlogMetadataService;
  let cacheManager: Cache;
  let supabaseClient: SupabaseClient;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BlogMetadataService,
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
        {
          provide: 'SUPABASE_CLIENT',
          useValue: {
            from: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockReturnThis(),
              single: jest.fn(),
            }),
          },
        },
      ],
    }).compile();

    service = module.get<BlogMetadataService>(BlogMetadataService);
    cacheManager = module.get<Cache>(CACHE_MANAGER);
    supabaseClient = module.get('SUPABASE_CLIENT');
  });

  describe('getMetadata', () => {
    it('devrait retourner métadonnées depuis cache', async () => {
      const mockMetadata: BlogMetadata = {
        title: 'Test Title',
        description: 'Test Description',
        keywords: 'test, keywords',
        h1: 'Test H1',
        ariane: 'Test > Ariane',
        content: null,
        relfollow: 'index, follow',
      };

      jest.spyOn(cacheManager, 'get').mockResolvedValue(mockMetadata);

      const result = await service.getMetadata('test-alias');

      expect(result).toEqual(mockMetadata);
      expect(cacheManager.get).toHaveBeenCalledWith('blog-meta:test-alias');
    });

    it('devrait récupérer métadonnées depuis DB si cache miss', async () => {
      const mockDbData = {
        mta_title: 'DB Title',
        mta_descrip: 'DB Description',
        mta_keywords: 'db, keywords',
        mta_h1: 'DB H1',
        mta_ariane: 'DB > Ariane',
        mta_content: null,
        mta_relfollow: '1',
      };

      jest.spyOn(cacheManager, 'get').mockResolvedValue(null);
      jest.spyOn(supabaseClient, 'from').mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockDbData, error: null }),
      } as any);

      const result = await service.getMetadata('test-alias');

      expect(result.title).toBe('DB Title');
      expect(result.relfollow).toBe('index, follow');  // Normalized
      expect(cacheManager.set).toHaveBeenCalledWith(
        'blog-meta:test-alias',
        expect.any(Object),
        3600,
      );
    });

    it('devrait retourner fallback si alias non trouvé', async () => {
      jest.spyOn(cacheManager, 'get').mockResolvedValue(null);
      jest.spyOn(supabaseClient, 'from').mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      } as any);

      const result = await service.getMetadata('inexistant');

      expect(result.title).toBe('Automecanik - Pièces Auto');
      expect(result.relfollow).toBe('index, follow');
    });

    it('devrait utiliser fallback spécifique pour alias connus', async () => {
      jest.spyOn(cacheManager, 'get').mockResolvedValue(null);
      jest.spyOn(supabaseClient, 'from').mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      } as any);

      const result = await service.getMetadata('constructeurs');

      expect(result.title).toBe('Catalogue Technique Auto - Toutes les marques');
      expect(result.h1).toBe('Catalogue des Constructeurs Automobiles');
    });
  });

  describe('normalizeRelFollow', () => {
    it('devrait normaliser "1" → "index, follow"', () => {
      const result = (service as any).normalizeRelFollow('1');
      expect(result).toBe('index, follow');
    });

    it('devrait normaliser "0" → "noindex, nofollow"', () => {
      const result = (service as any).normalizeRelFollow('0');
      expect(result).toBe('noindex, nofollow');
    });

    it('devrait retourner "index, follow" par défaut', () => {
      const result = (service as any).normalizeRelFollow(null);
      expect(result).toBe('index, follow');
    });
  });

  describe('invalidateCache', () => {
    it('devrait supprimer la clé cache', async () => {
      await service.invalidateCache('test-alias');

      expect(cacheManager.del).toHaveBeenCalledWith('blog-meta:test-alias');
    });
  });

  describe('invalidateAllCache', () => {
    it('devrait invalider tous les caches', async () => {
      const mockAliases = ['home', 'constructeurs', 'advice'];

      jest.spyOn(service, 'getAvailableAliases').mockResolvedValue(mockAliases);

      await service.invalidateAllCache();

      expect(cacheManager.del).toHaveBeenCalledTimes(5);  // 3 alias + 2 globaux
      expect(cacheManager.del).toHaveBeenCalledWith('blog-meta:home');
      expect(cacheManager.del).toHaveBeenCalledWith('blog-meta:constructeurs');
      expect(cacheManager.del).toHaveBeenCalledWith('blog-meta:advice');
      expect(cacheManager.del).toHaveBeenCalledWith('blog-meta:all');
      expect(cacheManager.del).toHaveBeenCalledWith('blog-meta:aliases');
    });
  });
});
```

### Tests d'intégration

```typescript
// blog-metadata.controller.spec.ts (e2e)
describe('BlogMetadataController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [BlogMetadataModule, CacheModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  describe('GET /api/blog/metadata/:alias', () => {
    it('devrait retourner métadonnées', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/blog/metadata/constructeurs')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBeDefined();
      expect(response.body.data.relfollow).toBe('index, follow');
    });

    it('devrait retourner fallback pour alias inexistant', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/blog/metadata/alias-inexistant')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Automecanik - Pièces Auto');
    });
  });

  describe('GET /api/blog/metadata', () => {
    it('devrait retourner toutes métadonnées', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/blog/metadata')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.total).toBeGreaterThan(0);
    });
  });

  describe('DELETE /api/blog/metadata/cache/:alias', () => {
    it('devrait invalider cache', async () => {
      const response = await request(app.getHttpServer())
        .delete('/api/blog/metadata/cache/constructeurs')
        .expect(204);

      expect(response.body.success).toBe(true);
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
```

---

## 10. Dépendances

### Modules NestJS internes
```typescript
@Module({
  imports: [CacheModule],  // Redis cache
  // ...
})
```

### Packages npm
```json
{
  "dependencies": {
    "@nestjs/common": "^10.3.0",
    "@nestjs/cache-manager": "^2.1.1",
    "cache-manager": "^5.2.4",
    "@supabase/supabase-js": "^2.38.4"
  }
}
```

### Services externes
- **Supabase PostgreSQL** : Table `__blog_meta_tags_ariane`
- **Redis** : Cache 1h TTL

### Variables d'environnement
```bash
# .env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
REDIS_URL=redis://localhost:6379
```

---

## 11. Critères d'acceptation

### Fonctionnels
- ✅ **GET metadata/:alias** retourne métadonnées si existant
- ✅ **GET metadata/:alias** retourne fallback si alias non trouvé
- ✅ **GET metadata** retourne toutes métadonnées (liste complète)
- ✅ **GET aliases/list** retourne tous alias disponibles
- ✅ **DELETE cache/:alias** invalide cache spécifique
- ✅ **DELETE cache** invalide tout le cache
- ✅ **Normalisation relfollow** : "1"/"0" → "index, follow"/"noindex, nofollow"
- ✅ **Fallback spécifiques** : home, constructeurs, advice, article, guide

### Non-fonctionnels
- ✅ **Performance** :
  - GET (cache hit): p50 <50ms
  - GET (cache miss): p50 <150ms
- ✅ **Cache** :
  - TTL: 3600s (1 heure)
  - Hit ratio: >90%
- ✅ **Logging** : INFO level (get, cache hits/misses, invalidations)
- ✅ **Tests** :
  - Couverture >80%
  - Tests e2e endpoints

---

## 12. Déploiement

### Configuration production

```bash
# .env.production
SUPABASE_URL=https://prod.supabase.co
SUPABASE_SERVICE_ROLE_KEY=prod-key
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=prod-redis-password
NODE_ENV=production
```

### Health check

```bash
# Vérifier métadonnées
curl https://api.example.com/api/blog/metadata/constructeurs

# Vérifier cache
redis-cli
> KEYS blog-meta:*
> GET blog-meta:constructeurs
> TTL blog-meta:constructeurs  # Doit retourner ~3600
```

---

## 13. Documentation associée

- [Blog Module](./blog-module.md) - Utilise BlogMetadataService
- [Cache Module](../../cache/CACHE.md) - Redis strategies
- [Database Module](../../database/DATABASE.md) - Supabase client
- [SEO Strategy](../../seo/SEO-STRATEGY.md) - Métadonnées SEO globales

---

## 14. Problèmes connus

### 1. DELETE cache endpoints publics (pas d'auth)
**Impact:** Élevé (production)  
**Workaround:** Ajouter `IsAdminGuard` (niveau ≥ 7)

### 2. Pas de validation alias format
**Impact:** Faible  
**Workaround:** Ajouter regex validation `^[a-z0-9-]+$`

### 3. Fallbacks hardcodés dans service
**Impact:** Faible  
**Workaround:** Externaliser dans fichier config JSON

### 4. Pas de logging cache hits/misses
**Impact:** Faible  
**Workaround:** Ajouter metrics Prometheus

---

## 15. Améliorations futures

### Phase 2 - Q1 2026
- [ ] **Authentification DELETE** : `IsAdminGuard` sur endpoints cache
- [ ] **Validation alias** : Regex `^[a-z0-9-]+$`
- [ ] **Metrics cache** : Hit ratio, miss rate, TTL stats
- [ ] **Fallbacks externes** : Config JSON au lieu de hardcodé

### Phase 3 - Q2 2026
- [ ] **Multilingue (i18n)** : Table `__blog_meta_tags_ariane_i18n`
- [ ] **Versioning métadonnées** : Draft/published workflow
- [ ] **A/B testing** : Variants meta tags
- [ ] **Schema.org JSON-LD** : Rich snippets automatiques

### Optimisations techniques
- [ ] **Cache warming** : Pré-charger alias populaires au démarrage
- [ ] **Batch invalidation** : API invalidate multiple alias
- [ ] **TTL adaptatif** : Hot/warm/cold selon popularité
- [ ** **Prometheus metrics** : Grafana dashboard cache

---

**Dernière mise à jour:** 2025-11-18  
**Version:** 1.0.0  
**Auteur:** Équipe Backend  
**Statut:** ✅ Production  
**Table:** `__blog_meta_tags_ariane` (unique)
