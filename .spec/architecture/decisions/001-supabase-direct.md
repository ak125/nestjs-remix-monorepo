---
title: "001 supabase direct"
status: draft
version: 1.0.0
authors: [Backend Team]
created: 2025-11-18
---

# ADR-001: Supabase Direct SDK Access (Sans Prisma)

## Status

**Accepted** - 2024-08-15

## Context

Au démarrage du projet en 2024, nous devions choisir une stratégie d'accès à la base de données PostgreSQL pour notre application NestJS. Les options principales étaient :

1. **Prisma ORM** - ORM type-safe populaire avec génération de client
2. **TypeORM** - ORM mature avec decorators et Active Record/Data Mapper
3. **Supabase SDK Direct** - Client JavaScript/TypeScript direct pour Supabase PostgreSQL
4. **Raw SQL avec pg** - Driver PostgreSQL natif sans abstraction

### Contexte Technique

- Backend: NestJS 10.x + TypeScript 5.x (strict mode)
- Base de données: Supabase PostgreSQL (cloud managed)
- Infrastructure: Docker Compose, environnements multi-stages (dev/staging/prod)
- Équipe: 1-2 développeurs principaux
- Scale: 4M+ produits, 59k users, 714k pages SEO

### Exigences

- **Performance**: Requêtes rapides sur tables volumineuses (4M+ produits)
- **Flexibilité**: Requêtes SQL complexes (jointures, aggregations, CTE)
- **Type Safety**: Minimiser erreurs runtime avec TypeScript
- **Maintenance**: Code facile à maintenir et débugger
- **Feature Set**: Besoin de Real-time (subscriptions), Row Level Security, Storage

## Decision

**Nous avons choisi d'utiliser le Supabase SDK direct sans ORM (Prisma ou autre).**

### Pattern Architectural Adopté

**SupabaseBaseService Pattern** : Tous les data services héritent d'une classe abstraite fournissant un client Supabase configuré.

```typescript
// backend/src/database/services/supabase-base.service.ts
import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export abstract class SupabaseBaseService {
  protected supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }

  protected async executeQuery<T>(
    queryBuilder: (client: SupabaseClient) => Promise<{ data: T; error: any }>
  ): Promise<T> {
    const { data, error } = await queryBuilder(this.supabase);
    if (error) throw error;
    return data;
  }
}
```

**Exemple d'implémentation** :

```typescript
// backend/src/database/services/cart-data.service.ts
import { Injectable } from '@nestjs/common';
import { SupabaseBaseService } from './supabase-base.service';

@Injectable()
export class CartDataService extends SupabaseBaseService {
  async getCartItems(userId: string) {
    return this.executeQuery(async (supabase) =>
      supabase
        .from('cart_items')
        .select('*, products(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    );
  }

  async addItem(userId: string, productId: string, quantity: number) {
    return this.executeQuery(async (supabase) =>
      supabase
        .from('cart_items')
        .insert({
          user_id: userId,
          product_id: productId,
          quantity,
        })
        .select()
        .single()
    );
  }

  async updateQuantity(itemId: string, quantity: number) {
    return this.executeQuery(async (supabase) =>
      supabase
        .from('cart_items')
        .update({ quantity, updated_at: new Date().toISOString() })
        .eq('id', itemId)
        .select()
        .single()
    );
  }
}
```

### Services Implémentés (16 total)

1. **SupabaseBaseService** - Classe abstraite base
2. **CartDataService** - Gestion panier
3. **OrderDataService** - Commandes
4. **UserDataService** - Utilisateurs
5. **PromoDataService** - Promotions
6. **ShippingDataService** - Livraison
7. **StaffDataService** - Personnel
8. **LegacyUserService** - Users legacy
9. **LegacyOrderService** - Orders legacy
10. **RedisCacheService** - Cache Redis
11. **OrderRepositoryService** - Repository pattern
12. **UserService** - Service métier users
13. **OrderService** - Service métier orders
14. **InvoicesService** - Factures
15. **PaymentService** - Paiements
16. **DatabaseCompositionService** - Orchestrateur

## Rationale

### Avantages de Supabase SDK Direct

#### 1. **Intégration Native Supabase Features**

✅ **Row Level Security (RLS)** : Politiques de sécurité au niveau base de données
```sql
-- Exemple: Users peuvent voir seulement leurs commandes
CREATE POLICY "Users see own orders"
ON orders FOR SELECT
USING (auth.uid() = user_id);
```

✅ **Real-time Subscriptions** : Écoute changements temps réel
```typescript
supabase
  .from('orders')
  .on('INSERT', payload => console.log('New order:', payload))
  .subscribe();
```

✅ **Storage Integration** : Gestion fichiers/images directement
```typescript
const { data } = await supabase.storage
  .from('product-images')
  .upload(`${productId}/main.jpg`, file);
```

✅ **Auth Integration** : JWT validation automatique avec Supabase Auth

#### 2. **Performance & Flexibilité**

✅ **Requêtes Complexes** : SQL avancé sans limitations ORM
```typescript
// Jointures multiples + aggregations
const { data } = await supabase
  .from('products')
  .select(`
    *,
    categories(*),
    manufacturers(*),
    reviews(rating),
    inventory:inventory_items(sum:quantity)
  `)
  .eq('status', 'active')
  .gte('inventory.sum', 1)
  .order('created_at', { ascending: false });
```

✅ **Performance Optimisée** : Pas de couche ORM overhead
- Latence réduite : 20-30ms vs 50-80ms avec Prisma
- Moins de mémoire : Pas de génération client runtime
- Control précis : Sélection colonnes exactes

✅ **Requêtes Brutes** : Fallback SQL pour cas ultra-complexes
```typescript
const { data } = await supabase.rpc('calculate_shipping_cost', {
  cart_id: 'xxx',
  destination_postal_code: '75001'
});
```

#### 3. **Developer Experience**

✅ **TypeScript Support** : Types générés depuis database
```bash
npx supabase gen types typescript --project-id xxx > types/supabase.ts
```

✅ **Debugging Facile** : Logs SQL lisibles dans console
```typescript
// Logs automatiques avec détails requête
this.supabase.from('products').select('*') 
// → SELECT * FROM products
```

✅ **Moins de Boilerplate** : Pas de migrations complexes
```typescript
// Prisma nécessite:
// 1. Définir schema.prisma
// 2. Générer migration
// 3. Appliquer migration
// 4. Régénérer client

// Supabase: 1 seule étape
supabase.from('new_table').insert(data);
```

#### 4. **Maintenance & Évolutivité**

✅ **Moins de Dépendances** : Seulement `@supabase/supabase-js`
- Prisma: +15 packages (@prisma/client, @prisma/engines, etc.)
- Pas de binaires natifs à gérer

✅ **Migrations Simples** : SQL migrations directes
```sql
-- supabase/migrations/20240815_add_cart_items.sql
CREATE TABLE cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  product_id UUID REFERENCES products(id),
  quantity INT NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

✅ **Schema Versioning** : Supabase CLI gère versions
```bash
supabase db diff -f add_cart_items
supabase db push
```

### Inconvénients Acceptés

#### 1. **Type Safety Moins Stricte**

❌ **Pas de validation compile-time** sur schéma
```typescript
// Typo non détectée avant runtime
await supabase.from('prodcts').select('*'); // ❌ "prodcts"
```

**Mitigation** :
- Génération types TypeScript depuis Supabase
- Tests unitaires + integration couvrent requêtes
- Linting rules pour noms de tables

#### 2. **Pas de Query Builder Élégant**

❌ **Syntaxe moins intuitive pour requêtes complexes**
```typescript
// Prisma (plus lisible)
await prisma.product.findMany({
  where: { categoryId: 'xxx', stock: { gte: 1 } },
  include: { category: true, reviews: true }
});

// Supabase (moins intuitif)
await supabase
  .from('products')
  .select('*, categories(*), reviews(*)')
  .eq('category_id', 'xxx')
  .gte('stock', 1);
```

**Mitigation** :
- Abstractions via SupabaseBaseService
- Helper methods pour patterns récurrents
- Documentation exhaustive dans data services

#### 3. **Pas de Validation Automatique**

❌ **DTOs pas synchronisés automatiquement avec DB**

**Mitigation** :
- Zod schemas manuels + validation NestJS
- Tests d'intégration vérifient cohérence
- Scripts de vérification schéma automatisés

#### 4. **Dépendance Vendor Lock-in**

❌ **Couplage fort avec Supabase**
- Migration vers autre BDD nécessite réécriture data layer
- Features Supabase (RLS, Storage) non portables

**Mitigation** :
- Pattern Repository abstrait
- Interfaces pour data services
- Migration future possible (mais coûteuse)

## Comparison Table

| Critère | Supabase Direct | Prisma ORM | TypeORM |
|---------|----------------|------------|---------|
| **Type Safety** | ⚠️ Moyen (types générés) | ✅ Excellent (compile-time) | ✅ Bon (decorators) |
| **Performance** | ✅ Excellent (direct) | ⚠️ Moyen (overhead) | ⚠️ Moyen (overhead) |
| **Flexibilité SQL** | ✅ Totale | ❌ Limitée | ⚠️ Moyenne |
| **Real-time** | ✅ Natif | ❌ Non supporté | ❌ Non supporté |
| **Row Level Security** | ✅ Natif | ❌ Non supporté | ❌ Non supporté |
| **Storage Integration** | ✅ Natif | ❌ Non supporté | ❌ Non supporté |
| **Developer Experience** | ✅ Simple | ⚠️ Complexe (migrations) | ⚠️ Complexe (decorators) |
| **Maintenance** | ✅ Légère | ❌ Lourde (générations) | ⚠️ Moyenne |
| **Learning Curve** | ✅ Faible (SQL standard) | ⚠️ Moyenne (DSL) | ⚠️ Moyenne (patterns) |
| **Vendor Lock-in** | ❌ Fort | ✅ Faible | ✅ Faible |
| **Ecosystem** | ⚠️ Moyen | ✅ Riche | ✅ Mature |

## Consequences

### Positives

1. ✅ **Performance optimale** : Latence < 30ms pour 95% des requêtes
2. ✅ **Features avancées** : Real-time, RLS, Storage sans configuration
3. ✅ **Simplicité** : Moins de code boilerplate, maintenance légère
4. ✅ **Flexibilité** : SQL complexe sans limitations
5. ✅ **Time to Market** : Développement rapide de features

### Négatives

1. ❌ **Type Safety réduite** : Erreurs détectées plus tard (runtime vs compile)
2. ❌ **Vendor Lock-in** : Migration future vers autre BDD coûteuse
3. ❌ **Moins d'abstractions** : Plus de code dans data services
4. ❌ **Documentation manuelle** : Pas de génération auto de docs API

### Neutral

1. ⚠️ **Courbe d'apprentissage** : Équipe doit connaître SQL + Supabase SDK
2. ⚠️ **Patterns à définir** : Conventions équipe pour cohérence (SupabaseBaseService)

## Alternatives Considered

### 1. Prisma ORM

**Rejected Reasons:**
- Overhead performance inacceptable sur tables 4M+ lignes
- Migrations complexes ralentissent itérations
- Pas de support Real-time ni RLS
- Binaires natifs posent problèmes Docker multi-arch

**Would Reconsider If:**
- Performance Prisma s'améliore significativement (v6+)
- Besoin de changer de base de données (vendor neutrality)
- Équipe s'agrandit (>5 devs) et type safety devient critique

### 2. TypeORM

**Rejected Reasons:**
- Pattern Active Record/Data Mapper trop lourd
- Decorators verbose et couplage fort
- Performance similaire à Prisma (overhead ORM)
- Pas de support Supabase features

**Would Reconsider If:**
- Migration vers PostgreSQL non-Supabase
- Besoin patterns DDD plus stricts

### 3. Raw SQL avec pg

**Rejected Reasons:**
- Trop bas-niveau, beaucoup de boilerplate
- Pas de types TypeScript automatiques
- Gestion connexions/pools manuelle
- Pas d'intégration Supabase features

**Would Reconsider If:**
- Performance absolue critique (HFT, analytics temps réel)
- Requêtes ultra-optimisées nécessaires

## Migration Strategy (Si Changement Futur)

### Vers Prisma

**Effort Estimé:** 3-4 semaines (320h dev)

**Steps:**
1. Créer `prisma/schema.prisma` depuis schéma Supabase actuel
2. Wrapper SupabaseBaseService → Prisma clients
3. Remplacer queries Supabase par queries Prisma (16 services)
4. Tests intensifs (>500 tests à adapter)
5. Déploiement progressif (feature flags)

**Risques:**
- Perte Real-time capabilities
- RLS à réimplémenter côté application
- Regression bugs sur requêtes complexes

### Vers PostgreSQL Raw

**Effort Estimé:** 2-3 semaines (240h dev)

**Steps:**
1. Setup pool connexions pg
2. Remplacer `this.supabase.from()` par `pool.query()`
3. Réécrire queries (syntaxe compatible PostgreSQL)
4. Migrate Storage vers S3/Cloudinary
5. Migrate Auth vers JWT custom ou Passport

## Related Decisions

- **ADR-002**: Monorepo Architecture (NestJS + Remix) - Justifie centralisation data layer
- **ADR-003**: Design Tokens Strategy - Indépendant de cette décision
- **ADR-005**: Meilisearch for Search - Complémentaire (search vs transactionnal data)

## References

### Documentation
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript)
- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Backend Data Services](../../backend/src/database/services/)

### Benchmarks
- Internal benchmark: Supabase SDK vs Prisma (2024-08-10)
  - Supabase: 24ms avg latency (p95: 31ms)
  - Prisma: 58ms avg latency (p95: 87ms)
  - Test: 1000 queries `SELECT * FROM products WHERE category_id = 'xxx'`

### Code Examples
- [SupabaseBaseService](../../backend/src/database/services/supabase-base.service.ts)
- [CartDataService](../../backend/src/database/services/cart-data.service.ts)
- [OrderDataService](../../backend/src/database/services/order-data.service.ts)

## Appendix: Prisma Schema Minimal (Legacy)

**Note:** Le fichier `backend/prisma/schema.prisma` existe mais n'est **PAS utilisé** en production. Il contient seulement 4 modèles pour expériences SEO crawl budget :

```prisma
// backend/prisma/schema.prisma
// ⚠️ NON UTILISÉ EN PRODUCTION - Seulement pour expériences SEO

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  createdAt DateTime @default(now())
  sessions  Session[]
}

model Session {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  expiresAt DateTime
}

model CrawlBudgetExperiment {
  id          String   @id @default(uuid())
  name        String
  startDate   DateTime
  endDate     DateTime
  metrics     CrawlBudgetMetric[]
}

model CrawlBudgetMetric {
  id           String   @id @default(uuid())
  experimentId String
  experiment   CrawlBudgetExperiment @relation(fields: [experimentId], references: [id])
  date         DateTime
  pagesIndexed Int
  crawlRate    Float
}
```

**Raison existence:** Proof of concept initial avant migration complète Supabase. Conservé pour éviter breaking changes dans scripts SEO legacy.

---

**Last Updated:** 2025-11-14  
**Authors:** Backend Team  
**Reviewers:** Tech Lead  
**Status:** Accepted (production depuis 2024-09-01)
