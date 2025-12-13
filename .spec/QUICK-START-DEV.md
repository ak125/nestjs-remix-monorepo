---
title: "Quick Start Guide - Développeurs"
status: stable
version: 1.0.0
---

# 🚀 Quick Start Guide - Développeurs

> **Guide d'onboarding rapide** - De zéro à productif en 30 minutes

**Version:** 1.0.0
**Dernière mise à jour:** 2025-11-18
**Prérequis:** Node.js 20+, Docker, Git

---

## 📋 Table des matières

- [Setup Initial (10min)](#-setup-initial-10min)
- [Architecture Overview (5min)](#-architecture-overview-5min)
- [Premier Feature (10min)](#-premier-feature-10min)
- [Workflows Communs (5min)](#-workflows-communs-5min)
- [Debugging & Troubleshooting](#-debugging--troubleshooting)
- [Ressources & Next Steps](#-ressources--next-steps)

---

## ⚡ Setup Initial (10min)

### 1. Clone & Install

```bash
# Clone repository
git clone https://github.com/your-org/nestjs-remix-monorepo.git
cd nestjs-remix-monorepo

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Éditer .env avec vos credentials
```

### 2. Start Services (Docker)

```bash
# Start all services (PostgreSQL, Redis, Meilisearch)
docker-compose -f docker-compose.dev.yml up -d

# Vérifier que tout tourne
docker ps
# Doit afficher: postgres, redis, meilisearch
```

### 3. Start Backend

```bash
# Development mode (hot reload)
npm run dev

# Backend should start on http://localhost:3000
# API docs: http://localhost:3000/api
```

### 4. Verify Setup

```bash
# Health check
curl http://localhost:3000/health
# Expected: {"status":"ok","uptime":123}

# Database connection
curl http://localhost:3000/api/catalog/hierarchy | jq
# Expected: JSON avec familles et gammes

# Redis cache
curl http://localhost:3000/api/blog/homepage | jq
# Expected: Blog homepage data
```

**✅ Setup complet!** Backend tourne, services OK, prêt à développer.

---

## 🏗️ Architecture Overview (5min)

### Structure Monorepo

```
nestjs-remix-monorepo/
├── backend/               # NestJS API (notre focus)
│   ├── src/
│   │   ├── modules/      # 37 modules fonctionnels
│   │   │   ├── auth/
│   │   │   ├── admin/
│   │   │   ├── products/
│   │   │   ├── cart/
│   │   │   └── ...
│   │   ├── shared/       # Services partagés
│   │   │   ├── cache/
│   │   │   ├── database/
│   │   │   └── guards/
│   │   └── main.ts       # Entry point
│   └── test/
├── frontend/             # Remix frontend
├── .spec/                # Documentation (37 specs)
│   ├── features/         # Specs par module
│   ├── README.md         # Navigation
│   └── API-ENDPOINTS-INDEX.md
└── docker-compose.*.yml
```

### Modules Principaux

| Module | Path | Description | Endpoints |
|--------|------|-------------|-----------|
| **Auth** | `src/modules/auth/` | Sessions, JWT, RBAC | 6 |
| **Admin** | `src/modules/admin/` | Stock, users, reporting | 39 |
| **Products** | `src/modules/products/` | Catalog, search, prices | 26 |
| **Cart** | `src/modules/cart/` | Shopping cart, promo | 18 |
| **Orders** | `src/modules/orders/` | Order workflow, invoices | 17 |
| **Blog** | `src/modules/blog/` | CMS, 85+ articles | 20+ |

**Documentation complète:** [.spec/README.md](./.spec/README.md)

---

## 🎯 Premier Feature (10min)

### Scénario: Ajouter un endpoint GET /api/products/:pg_id/specifications

**Objectif:** Retourner les spécifications techniques d'un produit.

#### 1. Lire la spec existante

```bash
# Ouvrir la spec du module Products
code .spec/features/products.md

# Chercher la section "6. 🔌 API Endpoints"
# Identifier la structure des endpoints existants
```

#### 2. Ajouter le controller endpoint

```typescript
// backend/src/modules/products/products.controller.ts

@Get(':pg_id/specifications')
@UseGuards(OptionalAuthGuard) // Public + authenticated
@ApiOperation({ summary: 'Get product specifications' })
@ApiResponse({ status: 200, description: 'Product specifications' })
async getSpecifications(
  @Param('pg_id') pg_id: string
): Promise<ProductSpecificationsDto> {
  return this.productsService.getSpecifications(pg_id);
}
```

#### 3. Implémenter la logique service

```typescript
// backend/src/modules/products/products.service.ts

async getSpecifications(pg_id: string): Promise<ProductSpecificationsDto> {
  // 1. Check cache
  const cacheKey = `products:specs:${pg_id}`;
  const cached = await this.cacheService.get(cacheKey);
  if (cached) return cached;

  // 2. Query database
  const { data, error } = await this.supabaseClient
    .from('___pieces_gamme')
    .select('pg_id, pg_dimension, pg_poids, pg_materiau, pg_garantie')
    .eq('pg_id', pg_id)
    .single();

  if (error || !data) {
    throw new NotFoundException(`Product ${pg_id} not found`);
  }

  // 3. Transform to DTO
  const specs: ProductSpecificationsDto = {
    pg_id: data.pg_id,
    dimensions: data.pg_dimension,
    weight: data.pg_poids,
    material: data.pg_materiau,
    warranty: data.pg_garantie,
  };

  // 4. Cache result (10 minutes)
  await this.cacheService.set(cacheKey, specs, 600);

  return specs;
}
```

#### 4. Créer le DTO

```typescript
// backend/src/modules/products/dto/product-specifications.dto.ts

import { ApiProperty } from '@nestjs/swagger';

export class ProductSpecificationsDto {
  @ApiProperty({ example: 'PG12345' })
  pg_id: string;

  @ApiProperty({ example: '60x40x20 cm' })
  dimensions: string;

  @ApiProperty({ example: '5.2 kg' })
  weight: string;

  @ApiProperty({ example: 'Acier inoxydable' })
  material: string;

  @ApiProperty({ example: '2 ans' })
  warranty: string;
}
```

#### 5. Tester l'endpoint

```bash
# Start backend (si pas déjà fait)
npm run dev

# Test endpoint
curl http://localhost:3000/api/products/PG12345/specifications | jq

# Expected response:
# {
#   "pg_id": "PG12345",
#   "dimensions": "60x40x20 cm",
#   "weight": "5.2 kg",
#   "material": "Acier inoxydable",
#   "warranty": "2 ans"
# }
```

#### 6. Écrire les tests

```typescript
// backend/src/modules/products/products.service.spec.ts

describe('ProductsService', () => {
  describe('getSpecifications', () => {
    it('should return specifications for valid product', async () => {
      const pg_id = 'PG12345';
      const result = await service.getSpecifications(pg_id);

      expect(result).toBeDefined();
      expect(result.pg_id).toBe(pg_id);
      expect(result.dimensions).toBeDefined();
    });

    it('should throw NotFoundException for invalid product', async () => {
      await expect(
        service.getSpecifications('INVALID')
      ).rejects.toThrow(NotFoundException);
    });

    it('should use cache on second call', async () => {
      const pg_id = 'PG12345';
      
      // First call - database
      await service.getSpecifications(pg_id);
      
      // Second call - cache (should be faster)
      const start = Date.now();
      await service.getSpecifications(pg_id);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(50); // <50ms from cache
    });
  });
});
```

**✅ Feature complete!** Endpoint implémenté, testé, documenté.

---

## 🔧 Workflows Communs (5min)

### Créer un Nouveau Module

```bash
# Utiliser NestJS CLI
nest generate module modules/my-feature
nest generate controller modules/my-feature
nest generate service modules/my-feature

# Structure créée:
# src/modules/my-feature/
# ├── my-feature.module.ts
# ├── my-feature.controller.ts
# ├── my-feature.service.ts
# └── my-feature.controller.spec.ts
```

**Ensuite:**
1. Implémenter la logique dans le service
2. Ajouter les endpoints dans le controller
3. Créer les DTOs dans `dto/`
4. Écrire les tests
5. Documenter dans `.spec/features/my-feature.md`

---

### Ajouter une Guard

```typescript
// src/shared/guards/my-custom.guard.ts

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class MyCustomGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Custom logic
    return user?.someCondition === true;
  }
}
```

**Utilisation:**

```typescript
@UseGuards(AuthenticatedGuard, MyCustomGuard)
@Get('protected-route')
async protectedEndpoint() {
  // Only accessible if both guards pass
}
```

---

### Ajouter un Cache Redis

```typescript
// Inject CacheService
constructor(private cacheService: CacheService) {}

// Set cache (key, value, TTL seconds)
await this.cacheService.set('my:key', data, 300); // 5min

// Get cache
const cached = await this.cacheService.get('my:key');

// Delete cache
await this.cacheService.del('my:key');

// Pattern delete (all keys matching pattern)
await this.cacheService.delPattern('products:*');
```

---

### Requêtes Supabase

```typescript
// Simple query
const { data, error } = await this.supabaseClient
  .from('table_name')
  .select('*')
  .eq('id', value)
  .single();

// With relations (join)
const { data } = await this.supabaseClient
  .from('products')
  .select(`
    *,
    gamme:gamme_id (name, description),
    famille:famille_id (name)
  `)
  .eq('pg_id', pg_id)
  .single();

// Pagination
const { data, count } = await this.supabaseClient
  .from('products')
  .select('*', { count: 'exact' })
  .range(0, 19) // First 20 items
  .order('created_at', { ascending: false });
```

---

### Recherche Meilisearch

```typescript
// Inject MeilisearchService
constructor(private searchService: MeilisearchService) {}

// Search
const results = await this.searchService.search('products', {
  q: 'batterie voiture',
  limit: 20,
  filter: ['famille_id = 1', 'disponible = true'],
  sort: ['price:asc']
});

// Index document
await this.searchService.index('products', {
  id: 'PG123',
  name: 'Batterie 12V',
  description: '...',
  price: 89.90
});
```

---

## 🐛 Debugging & Troubleshooting

### Logs Structurés

```typescript
// Inject Logger
constructor(private logger: Logger) {}

// Log levels
this.logger.log('Info message');
this.logger.debug('Debug details');
this.logger.warn('Warning message');
this.logger.error('Error occurred', stackTrace);

// Contextual logging
this.logger.log('Product created', { pg_id, user_id });
```

**Voir les logs:**

```bash
# En développement (console)
npm run dev

# En production (fichiers)
tail -f logs/backend.log
```

---

### Common Errors & Solutions

#### 1. **Database Connection Failed**

```bash
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**
```bash
# Vérifier que PostgreSQL tourne
docker ps | grep postgres

# Restart service
docker-compose -f docker-compose.dev.yml restart postgres

# Check .env credentials
cat .env | grep SUPABASE
```

---

#### 2. **Redis Connection Timeout**

```bash
Error: Redis connection timeout
```

**Solution:**
```bash
# Vérifier Redis
docker ps | grep redis

# Test connection
redis-cli -h localhost -p 6379 ping
# Expected: PONG

# Restart Redis
docker-compose restart redis
```

---

#### 3. **Cache Miss Performance Issue**

```typescript
// Problem: Slow endpoint (>1000ms)
@Get('slow-endpoint')
async slowEndpoint() {
  // Multiple sequential queries = slow
  const products = await this.getProducts();
  const categories = await this.getCategories();
  const brands = await this.getBrands();
  return { products, categories, brands };
}
```

**Solution: Paralléliser avec Promise.all**

```typescript
@Get('fast-endpoint')
async fastEndpoint() {
  // Parallel queries = fast
  const [products, categories, brands] = await Promise.all([
    this.getProducts(),
    this.getCategories(),
    this.getBrands()
  ]);
  return { products, categories, brands };
}
```

---

#### 4. **N+1 Query Problem**

```typescript
// Problem: N+1 queries
async getProductsWithCategories() {
  const products = await this.getProducts(); // 1 query
  
  for (const product of products) {
    product.category = await this.getCategory(product.category_id); // N queries
  }
  return products;
}
```

**Solution: Eager loading**

```typescript
async getProductsWithCategories() {
  // Single query with join
  const { data } = await this.supabaseClient
    .from('products')
    .select(`
      *,
      category:category_id (*)
    `);
  return data;
}
```

---

### Debug Tools

#### 1. **NestJS DevTools**

```bash
# Install
npm install --save-dev @nestjs/devtools-integration

# Enable in main.ts
import { DevtoolsModule } from '@nestjs/devtools-integration';

@Module({
  imports: [
    DevtoolsModule.register({
      http: process.env.NODE_ENV !== 'production',
    }),
    // ...
  ],
})
```

**Access:** http://localhost:8000

---

#### 2. **Swagger API Docs**

```bash
# Already configured in main.ts
# Access: http://localhost:3000/api

# Test endpoints directly in browser
# See all DTOs, schemas, examples
```

---

#### 3. **Redis CLI**

```bash
# Connect to Redis
docker exec -it redis redis-cli

# List all keys
KEYS *

# Get value
GET blog:popular

# Check TTL
TTL blog:article:conseil-batterie

# Delete key
DEL products:PG123

# Flush all cache (⚠️ use carefully)
FLUSHALL
```

---

#### 4. **PostgreSQL Client**

```bash
# Connect to Supabase
psql -h localhost -U postgres -d your_database

# List tables
\dt

# Describe table
\d ___pieces_gamme

# Query
SELECT pg_id, pg_nom, stock_total FROM ___pieces_gamme LIMIT 10;

# Exit
\q
```

---

## 🔍 Recherche Rapide

### Trouver un Endpoint

```bash
# Chercher dans les specs
grep -r "POST /api/products" .spec/features/

# Chercher dans le code
grep -r "@Post('products')" backend/src/

# Voir tous les endpoints d'un module
cat .spec/features/products.md | grep "| Method |"
```

---

### Trouver une Table PostgreSQL

```bash
# Chercher usage d'une table
grep -r "___pieces_gamme" backend/src/

# Voir le schéma dans la spec
grep -A 20 "## 📊 Modèle de données" .spec/features/products.md
```

---

### Trouver un Service

```bash
# Lister tous les services
find backend/src -name "*.service.ts"

# Chercher un service spécifique
grep -r "export class CacheService" backend/src/
```

---

## 📚 Ressources & Next Steps

### Documentation Interne

| Document | Description | Quand l'utiliser |
|----------|-------------|------------------|
| [README.md](./.spec/README.md) | Navigation principale | Vue d'ensemble, modules |
| [API-ENDPOINTS-INDEX.md](./.spec/API-ENDPOINTS-INDEX.md) | Référence API complète | Chercher un endpoint |
| [ARCHITECTURE-DIAGRAMS.md](./.spec/ARCHITECTURE-DIAGRAMS.md) | Diagrammes Mermaid | Comprendre les flux |
| [CRITICAL-MODULES-REPORT.md](./.spec/features/CRITICAL-MODULES-REPORT.md) | Rapport coverage | Voir progression |

**Specs par Module (37 specs):**
- Auth: `.spec/features/auth-module.md`
- Products: `.spec/features/products.md`
- Cart: `.spec/features/cart.md`
- Orders: `.spec/features/orders.md`
- Blog: `.spec/features/blog-module.md`
- ... (34 autres modules)

---

### Documentation Externe

- **NestJS:** https://docs.nestjs.com/
- **Supabase:** https://supabase.com/docs
- **Meilisearch:** https://www.meilisearch.com/docs
- **Redis:** https://redis.io/docs

---

### Commandes Utiles

```bash
# Development
npm run dev              # Start backend (hot reload)
npm run build            # Build production
npm run start:prod       # Start production

# Testing
npm run test             # Run unit tests
npm run test:watch       # Watch mode
npm run test:cov         # Coverage report
npm run test:e2e         # End-to-end tests

# Linting & Formatting
npm run lint             # ESLint
npm run format           # Prettier

# Database
npm run migration:run    # Run migrations
npm run migration:revert # Revert last migration
npm run seed             # Seed database

# Docker
docker-compose -f docker-compose.dev.yml up -d    # Start services
docker-compose -f docker-compose.dev.yml down     # Stop services
docker-compose logs -f backend                    # View logs
```

---

### Prochaines Étapes

**Après avoir terminé ce guide:**

1. **Lire 3 specs complètes** (Products, Cart, Auth) pour comprendre la structure
2. **Implémenter un petit feature** (nouveau endpoint, amélioration)
3. **Explorer les diagrammes** dans ARCHITECTURE-DIAGRAMS.md
4. **Contribuer à la doc** (ajouter exemples, corriger typos)

**Features suggérées pour débutants:**
- Ajouter un filtre de recherche produits
- Implémenter un endpoint de statistiques
- Créer un middleware de logging
- Améliorer les tests d'un module

---

## 💡 Tips & Best Practices

### Code Style

```typescript
// ✅ GOOD: Clear, typed, documented
@Get(':id')
@ApiOperation({ summary: 'Get product by ID' })
@ApiResponse({ status: 200, type: ProductDto })
@UseGuards(OptionalAuthGuard)
async getProduct(@Param('id') id: string): Promise<ProductDto> {
  return this.productsService.findById(id);
}

// ❌ BAD: No types, no docs, no guards
@Get(':id')
async getProduct(@Param('id') id) {
  return this.productsService.findById(id);
}
```

---

### Error Handling

```typescript
// ✅ GOOD: Specific errors with context
if (!product) {
  throw new NotFoundException(`Product ${pg_id} not found`);
}

if (stock < quantity) {
  throw new UnprocessableEntityException(
    `Insufficient stock: available ${stock}, requested ${quantity}`
  );
}

// ❌ BAD: Generic errors
if (!product) {
  throw new Error('Not found');
}
```

---

### Cache Strategy

```typescript
// ✅ GOOD: Check cache → Query → Cache result
const cached = await this.cache.get(key);
if (cached) return cached;

const data = await this.database.query();
await this.cache.set(key, data, ttl);
return data;

// ❌ BAD: Always query database
const data = await this.database.query();
return data;
```

---

### Testing

```typescript
// ✅ GOOD: Descriptive, isolated, fast
describe('ProductsService', () => {
  describe('findById', () => {
    it('should return product when id exists', async () => {
      const result = await service.findById('PG123');
      expect(result.pg_id).toBe('PG123');
    });

    it('should throw NotFoundException when id not exists', async () => {
      await expect(service.findById('INVALID')).rejects.toThrow(
        NotFoundException
      );
    });
  });
});

// ❌ BAD: Vague, coupled, slow
it('should work', async () => {
  const result = await service.someMethod();
  expect(result).toBeTruthy();
});
```

---

## 🎉 Félicitations!

Vous êtes maintenant prêt à contribuer au backend NestJS!

**Questions?**
- Consulter les specs dans `.spec/features/`
- Chercher dans le code source
- Demander à l'équipe (Slack, GitHub Discussions)

**Bon développement! 🚀**

---

**Made with ❤️ by Backend Team**  
**Quick Start Guide v1.0.0 - 2025-11-18**
