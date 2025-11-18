---
title: "Constitution du Projet - Principes et Standards"
status: approved
version: 1.0.0
authors: [Architecture Team]
created: 2025-11-18
updated: 2025-11-18
tags: [constitution, architecture, standards, best-practices, monorepo]
priority: critical
---

# 🏛️ Constitution du Projet

> **Principes fondamentaux, règles d'architecture et standards de qualité du monorepo NestJS-Remix.**

Cette constitution définit les règles immuables et les principes directeurs qui gouvernent le développement, l'architecture et la qualité du projet.

---

## 📜 Table des matières

1. [Principes Fondamentaux](#principes-fondamentaux)
2. [Architecture Monorepo](#architecture-monorepo)
3. [Standards de Code](#standards-de-code)
4. [Qualité et Tests](#qualité-et-tests)
5. [Performance](#performance)
6. [Sécurité](#sécurité)
7. [UX et Accessibilité](#ux-et-accessibilité)
8. [Documentation](#documentation)
9. [Processus de Développement](#processus-de-développement)
10. [Règles de Décision](#règles-de-décision)

---

## 🎯 Principes Fondamentaux

### 1. Spec-Driven Development

**Règle absolue** : Le code suit toujours la spec, jamais l'inverse.

```
Spec → Plan → Implémentation → Tests → Validation
```

- ✅ **Toute feature** commence par une spec dans `.spec/features/`
- ✅ **Toute décision d'architecture** est documentée dans `.spec/architecture/decisions/`
- ✅ **Toute API** est définie dans `.spec/api/` avant implémentation
- ✅ **Les specs sont validées** automatiquement en CI/CD

### 2. TypeScript Strict

**Règle absolue** : TypeScript en mode strict partout, zéro `any` non justifié.

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true
  }
}
```

**Exceptions autorisées** :
- `any` explicite avec commentaire `// @ts-expect-error` et justification
- Types tiers non typés : créer des déclarations `.d.ts`

### 3. Convention over Configuration

**Règle absolue** : Préférer les conventions standardisées aux configurations complexes.

- ✅ Structure de dossiers prédictible et cohérente
- ✅ Naming conventions strictes (voir section Standards)
- ✅ Patterns architecturaux réutilisables
- ❌ Configuration ad-hoc par développeur

### 4. Fail Fast

**Règle absolue** : Échouer rapidement et bruyamment plutôt que silencieusement.

```typescript
// ✅ BON : Validation stricte dès l'entrée
export class CreateOrderDto {
  @IsUUID()
  userId: string;

  @IsArray()
  @ValidateNested({ each: true })
  items: OrderItemDto[];

  @IsPositive()
  totalAmount: number;
}

// ❌ MAUVAIS : Validation laxiste ou tardive
function createOrder(data: any) {
  // Risque de propager des données invalides
}
```

### 5. Single Source of Truth

**Règle absolue** : Une et une seule source de vérité par domaine.

- **Base de données** : Supabase PostgreSQL = source of truth pour les données
- **Spécifications** : `.spec/` = source of truth pour les exigences
- **Configuration** : Variables d'environnement + fichiers `.env`
- **Documentation** : `.spec/` + `docs/` (pas de docs isolées)

---

## 🏗️ Architecture Monorepo

### Structure Obligatoire

```
nestjs-remix-monorepo/
├── backend/              # NestJS API (port 3000)
│   ├── src/
│   │   ├── modules/     # Modules métier par domaine
│   │   ├── database/    # Services data layer
│   │   ├── common/      # Shared utilities
│   │   └── main.ts
│   └── test/
├── frontend/            # Remix SSR (servi par backend)
│   ├── app/
│   │   ├── routes/     # File-based routing
│   │   ├── components/ # React components
│   │   └── utils/      # Frontend utilities
│   └── public/
├── packages/           # Shared packages (@fafa/*)
│   ├── shared-types/  # Types TypeScript partagés
│   ├── design-tokens/ # Design system tokens
│   └── config/        # Configuration partagée
├── .spec/             # Spécifications (Spec Kit)
│   ├── constitution.md    # Ce fichier
│   ├── features/          # Feature specs
│   ├── architecture/      # ADRs
│   ├── api/              # OpenAPI specs
│   └── types/            # Type schemas
├── docs/              # Documentation technique
├── scripts/           # Automation scripts
└── turbo.json         # Turbo monorepo config
```

### Règles d'Organisation

#### 1. Modules NestJS (Backend)

**Règle** : Un module = un domaine métier cohérent.

```typescript
// backend/src/modules/cart/cart.module.ts
@Module({
  imports: [
    // Dépendances externes
  ],
  controllers: [CartController],
  providers: [
    CartService,        // Business logic
    CartDataService,    // Data access
  ],
  exports: [CartService], // Export uniquement ce qui est nécessaire
})
export class CartModule {}
```

**Organisation d'un module** :
```
cart/
├── cart.module.ts          # Module definition
├── cart.controller.ts      # REST endpoints
├── cart.service.ts         # Business logic
├── cart-data.service.ts    # Data access (Supabase)
├── dto/                    # Data Transfer Objects
│   ├── create-cart.dto.ts
│   └── update-cart.dto.ts
├── entities/               # Domain entities
│   └── cart.entity.ts
└── tests/
    ├── cart.controller.spec.ts
    └── cart.service.spec.ts
```

**Interdictions** :
- ❌ Modules "fourre-tout" (utils, common, shared)
- ❌ Dépendances circulaires entre modules
- ❌ Import direct d'un service depuis un autre module (passer par l'export du module)

#### 2. Routes Remix (Frontend)

**Règle** : File-based routing strict, pas de routing manuel.

```
frontend/app/routes/
├── _index.tsx              # Homepage (/)
├── products.$id.tsx        # Product detail (/products/:id)
├── cart.tsx               # Cart page (/cart)
├── checkout/
│   ├── _layout.tsx        # Checkout layout
│   ├── shipping.tsx       # /checkout/shipping
│   └── payment.tsx        # /checkout/payment
└── admin/
    ├── _layout.tsx        # Admin layout (protected)
    └── dashboard.tsx      # /admin/dashboard
```

**Conventions** :
- `_index.tsx` = route par défaut du dossier
- `_layout.tsx` = layout partagé (nested routes)
- `$param.tsx` = paramètre dynamique
- `_protected.tsx` = route protégée (auth requise)

#### 3. Packages Partagés

**Règle** : Packages scoped `@fafa/*` pour partage backend ↔ frontend.

```json
// packages/shared-types/package.json
{
  "name": "@fafa/shared-types",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./cart": "./dist/cart/index.js",
    "./payment": "./dist/payment/index.js"
  }
}
```

**Contenu autorisé** :
- ✅ Types TypeScript (interfaces, types, enums)
- ✅ Schémas Zod de validation
- ✅ Constantes et configurations
- ✅ Utilities pures (pas de dépendances Node.js ou Browser)

**Interdictions** :
- ❌ Logique métier complexe
- ❌ Dépendances à Node.js ou Browser APIs
- ❌ État global mutable

### Turbo Pipelines

**Règle** : Utiliser Turbo pour orchestrer les builds, tests et lints.

```json
// turbo.json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "build/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "cache": false
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

---

## 💻 Standards de Code

### Naming Conventions

#### Backend (NestJS)

**Controllers** :
```typescript
// ✅ BON : PascalCase + "Controller" suffix
export class CartController {}
export class PaymentWebhookController {}

// ❌ MAUVAIS
export class cart {}
export class Payments {}
```

**Services** :
```typescript
// ✅ BON : PascalCase + "Service" suffix
export class CartService {}           // Business logic
export class CartDataService {}       // Data access

// ❌ MAUVAIS
export class CartManager {}
export class cart_service {}
```

**DTOs** :
```typescript
// ✅ BON : PascalCase + descriptif + "Dto" suffix
export class CreateCartItemDto {}
export class UpdateCartDto {}
export class CartResponseDto {}

// ❌ MAUVAIS
export class CartDto {}  // Trop générique
export class Input {}     // Pas de contexte
```

**Fichiers** :
```
// ✅ BON : kebab-case
cart.controller.ts
payment-webhook.controller.ts
cart-data.service.ts

// ❌ MAUVAIS
CartController.ts
payment_webhook.controller.ts
cartDataService.ts
```

#### Frontend (Remix)

**Composants React** :
```typescript
// ✅ BON : PascalCase, fichier .tsx
export function ProductCard({ product }: Props) {}
export default function CheckoutPage() {}

// ❌ MAUVAIS
export function productCard() {}
export default function checkout_page() {}
```

**Hooks personnalisés** :
```typescript
// ✅ BON : camelCase, préfixe "use"
export function useCart() {}
export function useAuthentication() {}

// ❌ MAUVAIS
export function cart() {}
export function UseAuth() {}
```

**Fichiers de routes** :
```
// ✅ BON : kebab-case ou special Remix syntax
_index.tsx
products.$id.tsx
checkout.payment.tsx

// ❌ MAUVAIS
Products.tsx
checkout_payment.tsx
```

### Code Style

**Règle** : Prettier + ESLint automatiques, pas de discussion.

```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

**Format avant commit** :
```bash
# Hook Git pre-commit automatique
npm run format
npm run lint
```

### Imports Organization

**Règle** : Ordre strict des imports.

```typescript
// 1. External dependencies
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

// 2. Internal packages
import { CartDto } from '@fafa/shared-types';

// 3. Relative imports (parents en premier)
import { SupabaseBaseService } from '../../database/services';
import { CartEntity } from './entities/cart.entity';

// 4. Types only (séparés)
import type { User } from '@fafa/shared-types';
```

### Error Handling

**Règle** : Exceptions typées et contextualisées.

```typescript
// ✅ BON : Custom exceptions avec contexte
export class CartNotFoundException extends NotFoundException {
  constructor(cartId: string) {
    super(`Cart with ID ${cartId} not found`);
  }
}

export class CartService {
  async getCart(id: string): Promise<Cart> {
    const cart = await this.cartDataService.findById(id);
    if (!cart) {
      throw new CartNotFoundException(id);
    }
    return cart;
  }
}

// ❌ MAUVAIS : Exceptions génériques
throw new Error('Cart not found');  // Pas de contexte
return null;  // Erreur silencieuse
```

---

## ✅ Qualité et Tests

### Couverture de Tests

**Règles obligatoires** :

| Type | Couverture Minimale | Priorité |
|------|---------------------|----------|
| **Services métier** | 80% | Critique |
| **Controllers** | 60% | Haute |
| **Data services** | 50% | Moyenne |
| **Utilities** | 90% | Haute |
| **Composants React critiques** | 70% | Haute |

**Commande** :
```bash
npm run test:cov
```

### Types de Tests

#### 1. Unit Tests

**Règle** : Tester chaque service et fonction de manière isolée.

```typescript
// cart.service.spec.ts
describe('CartService', () => {
  let service: CartService;
  let dataService: jest.Mocked<CartDataService>;

  beforeEach(() => {
    dataService = {
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    } as any;

    service = new CartService(dataService);
  });

  it('should add item to cart', async () => {
    // Arrange
    const cart = { id: '1', items: [] };
    dataService.findById.mockResolvedValue(cart);
    dataService.update.mockResolvedValue({ ...cart, items: [{ productId: 'p1' }] });

    // Act
    const result = await service.addItem('1', { productId: 'p1', quantity: 1 });

    // Assert
    expect(result.items).toHaveLength(1);
    expect(dataService.update).toHaveBeenCalled();
  });
});
```

#### 2. Integration Tests

**Règle** : Tester les interactions entre modules.

```typescript
// cart.integration.spec.ts
describe('CartController (Integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [CartModule, DatabaseModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  it('POST /cart should create a cart', async () => {
    return request(app.getHttpServer())
      .post('/cart')
      .send({ userId: 'user-123' })
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('id');
        expect(res.body.userId).toBe('user-123');
      });
  });
});
```

#### 3. E2E Tests

**Règle** : Tester les flows utilisateurs critiques end-to-end.

```typescript
// checkout.e2e.spec.ts
describe('Checkout Flow (E2E)', () => {
  it('should complete full checkout process', async () => {
    // 1. Add product to cart
    const cart = await request(app).post('/cart').send({ userId: 'user-1' });
    
    // 2. Add items
    await request(app)
      .post(`/cart/${cart.body.id}/items`)
      .send({ productId: 'p1', quantity: 2 });
    
    // 3. Create order
    const order = await request(app)
      .post('/orders')
      .send({ cartId: cart.body.id });
    
    // 4. Process payment
    const payment = await request(app)
      .post('/payments')
      .send({ orderId: order.body.id, method: 'card' });
    
    expect(payment.body.status).toBe('success');
  });
});
```

### Test Guidelines

**Arrange-Act-Assert (AAA)** :
```typescript
it('should calculate cart total correctly', () => {
  // Arrange
  const cart = new Cart({ items: [
    { price: 10, quantity: 2 },
    { price: 5, quantity: 3 },
  ]});

  // Act
  const total = cart.calculateTotal();

  // Assert
  expect(total).toBe(35);
});
```

**Mocking Guidelines** :
- ✅ Mocker les dépendances externes (DB, APIs, etc.)
- ✅ Mocker les services dans les tests de contrôleurs
- ❌ Ne pas mocker ce qu'on teste
- ❌ Éviter les mocks trop complexes (indicateur de mauvais design)

---

## ⚡ Performance

### Règles de Performance

#### 1. Cache Strategy

**Règle** : Cache multi-niveaux obligatoire.

```typescript
// Levels de cache
1. Memory (Node.js) : < 1MB, TTL < 1min
2. Redis : < 100MB, TTL 1min - 1h
3. CDN (Cloudflare) : Assets statiques, TTL 7d
```

**Implémentation** :
```typescript
@Injectable()
export class ProductService {
  constructor(
    private dataService: ProductDataService,
    @Inject(CACHE_MANAGER) private cache: Cache
  ) {}

  async getProduct(id: string): Promise<Product> {
    // 1. Check memory cache
    const cached = await this.cache.get<Product>(`product:${id}`);
    if (cached) return cached;

    // 2. Fetch from DB
    const product = await this.dataService.findById(id);

    // 3. Store in cache (TTL 15min)
    await this.cache.set(`product:${id}`, product, 900);

    return product;
  }
}
```

#### 2. Database Queries

**Règle** : Optimisation obligatoire des requêtes N+1.

```typescript
// ❌ MAUVAIS : N+1 queries
async getCartsWithItems(userId: string) {
  const carts = await this.supabase
    .from('carts')
    .select('*')
    .eq('user_id', userId);

  for (const cart of carts) {
    cart.items = await this.supabase  // N queries supplémentaires !
      .from('cart_items')
      .select('*')
      .eq('cart_id', cart.id);
  }
  
  return carts;
}

// ✅ BON : Single query with join
async getCartsWithItems(userId: string) {
  return this.supabase
    .from('carts')
    .select(`
      *,
      items:cart_items(*)
    `)
    .eq('user_id', userId);
}
```

#### 3. Lazy Loading

**Règle** : Code splitting et lazy loading pour le frontend.

```typescript
// ✅ BON : Lazy loading des routes
import { lazy } from 'react';

const AdminDashboard = lazy(() => import('./routes/admin/dashboard'));
const CheckoutPage = lazy(() => import('./routes/checkout'));

// ❌ MAUVAIS : Import synchrone de tout
import AdminDashboard from './routes/admin/dashboard';
import CheckoutPage from './routes/checkout';
```

### Performance Budgets

**Règles obligatoires** :

| Métrique | Objectif | Maximum |
|----------|----------|---------|
| **Time to First Byte (TTFB)** | < 200ms | < 500ms |
| **First Contentful Paint (FCP)** | < 1.5s | < 2.5s |
| **Largest Contentful Paint (LCP)** | < 2.5s | < 4s |
| **Time to Interactive (TTI)** | < 3.5s | < 5s |
| **Bundle Size (initial)** | < 200KB | < 350KB |
| **API Response Time (P95)** | < 100ms | < 300ms |

**Monitoring** :
```bash
# Lighthouse CI en production
npm run lighthouse:ci
```

---

## 🔒 Sécurité

### Règles de Sécurité

#### 1. Authentication & Authorization

**Règle** : JWT + Guards NestJS partout.

```typescript
// ✅ BON : Route protégée avec guard
@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  @Get()
  async getCart(@CurrentUser() user: User) {
    return this.cartService.getCart(user.id);
  }
}

// ❌ MAUVAIS : Pas de protection
@Controller('cart')
export class CartController {
  @Get()
  async getCart(@Query('userId') userId: string) {  // VULNERABLE !
    return this.cartService.getCart(userId);
  }
}
```

#### 2. Input Validation

**Règle** : Validation stricte avec Zod + class-validator.

```typescript
// ✅ BON : DTO validé
export class CreateCartItemDto {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  @Max(999)
  quantity: number;

  @IsOptional()
  @IsObject()
  options?: Record<string, any>;
}

// ❌ MAUVAIS : Pas de validation
export class CreateCartItemDto {
  productId: any;
  quantity: any;
  options: any;
}
```

#### 3. SQL Injection Prevention

**Règle** : Parameterized queries uniquement.

```typescript
// ✅ BON : Parameterized query (Supabase)
await this.supabase
  .from('products')
  .select('*')
  .eq('id', productId);  // Safe, paramétrisé

// ❌ MAUVAIS : String interpolation
await this.supabase.rpc('raw_query', {
  query: `SELECT * FROM products WHERE id = '${productId}'`  // VULNERABLE !
});
```

#### 4. Secrets Management

**Règle** : Variables d'environnement sécurisées, jamais hardcodées.

```typescript
// ✅ BON : Variables d'environnement
const apiKey = process.env.PAYMENT_API_KEY;

// ❌ MAUVAIS : Hardcoded
const apiKey = 'sk_live_1234567890';  // JAMAIS !
```

**Fichiers sensibles** :
```gitignore
# .gitignore
.env
.env.local
.env.production
*.key
*.pem
```

### Security Checklist

**Avant chaque release** :
- [ ] Audit dépendances : `npm audit`
- [ ] Scan vulnérabilités : `npm run security:scan`
- [ ] Review secrets hardcodés : `npm run security:secrets`
- [ ] HTTPS partout (pas de HTTP en production)
- [ ] CORS configuré strictement
- [ ] Rate limiting actif sur toutes les routes
- [ ] Logs sans données sensibles

---

## 🎨 UX et Accessibilité

### Règles UX

#### 1. Mobile-First

**Règle** : Design et développement mobile-first obligatoire.

```css
/* ✅ BON : Mobile-first */
.button {
  padding: 0.5rem;  /* Mobile par défaut */
}

@media (min-width: 768px) {
  .button {
    padding: 1rem;  /* Desktop en override */
  }
}

/* ❌ MAUVAIS : Desktop-first */
.button {
  padding: 1rem;
}

@media (max-width: 767px) {
  .button {
    padding: 0.5rem;
  }
}
```

#### 2. Loading States

**Règle** : Feedback visuel obligatoire pour toute action asynchrone.

```typescript
// ✅ BON : Loading state explicite
export default function ProductList() {
  const { data, isLoading, error } = useProducts();

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorMessage error={error} />;

  return <ProductGrid products={data} />;
}

// ❌ MAUVAIS : Pas de feedback
export default function ProductList() {
  const { data } = useProducts();
  return <ProductGrid products={data} />;  // Blank screen pendant le chargement !
}
```

#### 3. Error Messages

**Règle** : Messages d'erreur clairs et actionnables.

```typescript
// ✅ BON : Message explicite avec action
throw new BadRequestException({
  message: 'Le produit est en rupture de stock',
  action: 'Ajoutez-le à votre liste de souhaits pour être notifié',
  code: 'PRODUCT_OUT_OF_STOCK',
});

// ❌ MAUVAIS : Message cryptique
throw new BadRequestException('Invalid request');
```

### Règles Accessibilité (a11y)

#### 1. Sémantique HTML

**Règle** : HTML sémantique obligatoire.

```tsx
// ✅ BON : HTML sémantique
<nav aria-label="Main navigation">
  <ul>
    <li><a href="/products">Produits</a></li>
    <li><a href="/cart">Panier</a></li>
  </ul>
</nav>

<main>
  <h1>Catalogue Produits</h1>
  <article>
    <h2>Produit 1</h2>
    <p>Description...</p>
  </article>
</main>

// ❌ MAUVAIS : Divs génériques
<div className="navigation">
  <div><a href="/products">Produits</a></div>
  <div><a href="/cart">Panier</a></div>
</div>

<div>
  <div className="title">Catalogue Produits</div>
  <div>
    <div className="subtitle">Produit 1</div>
    <div>Description...</div>
  </div>
</div>
```

#### 2. ARIA Labels

**Règle** : ARIA labels pour éléments interactifs.

```tsx
// ✅ BON : ARIA labels
<button
  aria-label="Ajouter au panier"
  aria-describedby="product-price"
  onClick={handleAddToCart}
>
  <CartIcon />
</button>

// ❌ MAUVAIS : Pas de label
<button onClick={handleAddToCart}>
  <CartIcon />
</button>
```

#### 3. Keyboard Navigation

**Règle** : Navigation clavier complète.

```tsx
// ✅ BON : Keyboard accessible
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}
>
  Action
</div>

// ❌ MAUVAIS : Click only
<div onClick={handleClick}>Action</div>
```

### Accessibility Checklist

**Tests obligatoires** :
- [ ] Test navigation clavier (Tab, Shift+Tab, Enter, Espace)
- [ ] Test lecteur d'écran (NVDA/JAWS)
- [ ] Contraste couleurs minimum 4.5:1 (WCAG AA)
- [ ] Focus visible sur tous les éléments interactifs
- [ ] Pas de contenu clignote > 3x par seconde
- [ ] Textes redimensionnables jusqu'à 200%

**Outils** :
```bash
# Lighthouse accessibility audit
npm run lighthouse:a11y

# axe-core automated testing
npm run test:a11y
```

---

## 📚 Documentation

### Règles de Documentation

#### 1. Code Documentation

**Règle** : JSDoc pour toutes les fonctions/classes publiques.

```typescript
/**
 * Service de gestion du panier utilisateur.
 * 
 * Gère les opérations CRUD sur les paniers et leurs items,
 * avec validation métier et calculs de totaux.
 * 
 * @example
 * ```typescript
 * const cart = await cartService.addItem(userId, {
 *   productId: 'p-123',
 *   quantity: 2
 * });
 * ```
 */
@Injectable()
export class CartService {
  /**
   * Ajoute un produit au panier de l'utilisateur.
   * 
   * Si le produit existe déjà dans le panier, incrémente la quantité.
   * Valide la disponibilité du stock avant ajout.
   * 
   * @param userId - Identifiant unique de l'utilisateur
   * @param item - Item à ajouter au panier
   * @returns Panier mis à jour avec le nouvel item
   * @throws {ProductNotFoundException} Si le produit n'existe pas
   * @throws {OutOfStockException} Si stock insuffisant
   */
  async addItem(userId: string, item: AddCartItemDto): Promise<Cart> {
    // Implementation...
  }
}
```

#### 2. Spec Documentation

**Règle** : Specs à jour = source of truth.

Voir [.spec/README.md](.spec/README.md) pour le workflow complet.

#### 3. ADR (Architecture Decision Records)

**Règle** : Toute décision d'architecture majeure = ADR.

Format obligatoire :
```markdown
# ADR-XXX: Titre de la décision

## Status
[draft | review | accepted | rejected | superseded]

## Context
Quel problème résolvons-nous ?

## Decision
Quelle solution choisissons-nous ?

## Rationale
Pourquoi ce choix ?

## Consequences
Impacts positifs et négatifs.

## Alternatives Considered
Autres options évaluées et rejetées.
```

---

## 🔄 Processus de Développement

### Git Workflow

**Règle** : Git Flow simplifié.

```
main (production)
  ↑
  merge ← develop (staging)
           ↑
           merge ← feature/xxx (dev)
```

**Branches** :
- `main` : Production, protected, releases uniquement
- `develop` : Intégration, staging, protected
- `feature/*` : Features individuelles
- `fix/*` : Bug fixes
- `hotfix/*` : Fixes urgents production

**Commit Messages** :
```
type(scope): description courte

Corps du message optionnel.

Fixes #123
```

**Types** :
- `feat`: Nouvelle feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting, pas de changement code
- `refactor`: Refactoring sans changement fonctionnel
- `test`: Ajout/modification tests
- `chore`: Maintenance (deps, config, etc.)

### Pull Request Workflow

**Règle** : PR template obligatoire.

```markdown
## Description
[Description claire du changement]

## Type de changement
- [ ] Feature
- [ ] Bug fix
- [ ] Breaking change
- [ ] Documentation

## Checklist
- [ ] Tests ajoutés/mis à jour
- [ ] Documentation mise à jour
- [ ] Spec mise à jour (si applicable)
- [ ] Pas de régression (tests passent)
- [ ] Code reviewed par 1+ personne
- [ ] Lighthouse score maintenu

## Liens
- Spec: `.spec/features/xxx.md`
- Issue: #123
```

**Reviews** :
- Minimum 1 reviewer
- CI/CD doit passer
- Pas de merge si conflits
- Squash commits à preference

### Release Process

**Règle** : Semantic versioning.

```
MAJOR.MINOR.PATCH

MAJOR : Breaking changes
MINOR : Nouvelles features (backward-compatible)
PATCH : Bug fixes
```

**Exemple** :
```bash
# Release 1.2.3
npm version 1.2.3
git tag v1.2.3
git push --tags
npm run deploy:production
```

---

## 🗳️ Règles de Décision

### Quand créer un ADR ?

**Créer un ADR si** :
- ✅ Choix technologique majeur (framework, database, architecture)
- ✅ Pattern architectural nouveau
- ✅ Trade-off significatif (performance vs complexité, etc.)
- ✅ Impact sur plusieurs équipes/modules
- ✅ Coût de changement élevé

**Pas besoin d'ADR si** :
- ❌ Détail d'implémentation local
- ❌ Choice évidente sans alternative
- ❌ Changement facilement réversible

### Processus de Décision

```
1. Problème identifié
   ↓
2. ADR draft créé
   ↓
3. Alternatives évaluées
   ↓
4. Discussion équipe
   ↓
5. Décision consensuelle ou vote
   ↓
6. ADR approved
   ↓
7. Implémentation
```

### Voting

**Règle** : Consensus préféré, vote si nécessaire.

**Système de vote** :
- 👍 : D'accord
- 👎 : Pas d'accord (bloquant)
- 🤔 : Réservé (non bloquant)

**Approbation** : 
- Consensus : Tous 👍 ou 🤔
- Vote : Majorité 👍 et 0 👎

---

## 🚀 Évolution de cette Constitution

### Modifications

**Règle** : Changements majeurs nécessitent consensus.

**Processus** :
1. Ouvrir issue "Constitution Amendment"
2. Discussion équipe (minimum 3 jours)
3. Vote si nécessaire
4. Merge PR avec approbation unanime

### Versioning

Cette constitution suit semantic versioning :
- **MAJOR** : Changement de principe fondamental
- **MINOR** : Ajout de nouvelle règle
- **PATCH** : Clarification, correction

---

## 📝 Change Log

### Version 1.0.0 (2025-11-18)

- ✅ Création initiale de la constitution
- ✅ Définition des principes fondamentaux
- ✅ Standards d'architecture monorepo
- ✅ Règles de qualité et tests
- ✅ Guidelines performance et sécurité
- ✅ Standards UX et accessibilité
- ✅ Processus de développement

---

## 📚 Références

- [Spec-Driven Development](https://github.com/github/spec-kit)
- [NestJS Best Practices](https://docs.nestjs.com/)
- [Remix Documentation](https://remix.run/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Conventional Commits](https://www.conventionalcommits.org/)

---

**Note** : Cette constitution est un document vivant, maintenu par l'équipe et évolue avec le projet.
