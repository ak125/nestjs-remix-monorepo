---
title: "prisma schema"
status: draft
version: 1.0.0
---

# Schéma Prisma - Auth + Analytics

Documentation du schéma Prisma PostgreSQL dédié aux fonctionnalités modernes (authentification JWT, expériences SEO).

## 🎯 Objectif

Séparer les **nouvelles fonctionnalités** du système legacy Supabase :

| Fonctionnalité | Stockage |
|----------------|----------|
| Catalogue produits legacy | ✅ Supabase PostgreSQL (97 tables) |
| Commandes/Clients legacy | ✅ Supabase PostgreSQL |
| **Authentification JWT moderne** | ✅ Prisma PostgreSQL (cette DB) |
| **Expériences SEO A/B** | ✅ Prisma PostgreSQL (cette DB) |
| Sessions/Paniers volatiles | ✅ Redis Cache |

## 📄 Schéma complet

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = "postgresql://MASSDOC_owner:***@ep-young-haze-a2gss4oh-pooler.eu-central-1.aws.neon.tech/MASSDOC?sslmode=require"
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔐 AUTHENTICATION (JWT + Sessions)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

model User {
  id        String    @id @default(cuid())
  email     String    @unique
  name      String?
  password  String    // bcrypt hash, 10 rounds
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  sessions  Session[]
}

model Session {
  id           String  @id @default(cuid())
  userId       String
  ipAddress    String?
  userAgent    String?
  sessionToken String  @unique
  user         User    @relation(fields: [userId], references: [id])
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🧪 SEO CRAWL BUDGET A/B TESTING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

model CrawlBudgetExperiment {
  id               String    @id @default(uuid())
  name             String
  description      String?
  action           String    // exclude, include, reduce
  targetFamilies   String[]  // Array codes gammes/catégories
  reductionPercent Int?      // Pour action=reduce (ex: 50%)
  durationDays     Int       @default(30)
  status           String    @default("draft") // draft, running, paused, completed
  baseline         Json?     // Métriques 30j avant {crawlRate, indexation, traffic}
  startedAt        DateTime?
  completedAt      DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  metrics CrawlBudgetMetric[]

  @@map("crawl_budget_experiments")
}

model CrawlBudgetMetric {
  id                 String   @id @default(uuid())
  experimentId       String
  date               DateTime
  totalCrawledUrls   Int
  crawlRequestsCount Int
  avgCrawlRate       Float
  indexedUrls        Int
  indexationRate     Float
  organicSessions    Int?
  organicConversions Int?
  familyMetrics      Json?    // [{familyCode, crawledUrls, indexedUrls, avgPosition}]

  experiment CrawlBudgetExperiment @relation(fields: [experimentId], references: [id], onDelete: Cascade)

  @@unique([experimentId, date])
  @@index([experimentId])
  @@index([date])
  @@map("crawl_budget_metrics")
}
```

## 🔐 Module Authentication

### `User` - Utilisateurs JWT

Table des comptes utilisateurs modernes (pas les clients legacy).

| Champ | Type | Contrainte | Description |
|-------|------|------------|-------------|
| `id` | String | PK, CUID | ID unique généré |
| `email` | String | UNIQUE, NOT NULL | Email connexion |
| `name` | String | nullable | Nom affiché (optionnel) |
| `password` | String | NOT NULL | Hash bcrypt (10 rounds, $2b$) |
| `createdAt` | DateTime | DEFAULT now() | Date création compte |
| `updatedAt` | DateTime | AUTO UPDATE | Dernière modification |
| `sessions` | Session[] | 1:N | Relations sessions actives |

#### Sécurité mot de passe

```typescript
import * as bcrypt from 'bcrypt';

// Hashage lors création compte
const SALT_ROUNDS = 10;
const hashedPassword = await bcrypt.hash(plainPassword, SALT_ROUNDS);

// Vérification lors login
const isValid = await bcrypt.compare(plainPassword, user.password);
```

**Format hash stocké** : `$2b$10$AbCdEfGhIjKlMnOpQrStUvWxYz...` (60 chars)

#### CUID (Collision-resistant Unique ID)

Format : `clhxyz1234abcdef` (25 caractères)

- ✅ URL-safe (pas de caractères spéciaux)
- ✅ Sortable (préfixe temporel)
- ✅ Plus sécurisé que auto-increment
- ✅ Pas de risque collision

### `Session` - Sessions utilisateur

Gestion sessions JWT avec tracking device.

| Champ | Type | Contrainte | Description |
|-------|------|------------|-------------|
| `id` | String | PK, CUID | ID unique session |
| `userId` | String | FK → User, NOT NULL | Propriétaire session |
| `sessionToken` | String | UNIQUE, NOT NULL | Token JWT signé |
| `ipAddress` | String | nullable | IP connexion (sécurité) |
| `userAgent` | String | nullable | Device/Browser (analytics) |
| `user` | User | N:1 | Relation utilisateur |

#### Structure JWT

```typescript
// Payload JWT signé avec secret HS256
interface JWTPayload {
  sub: string;        // userId (CUID)
  email: string;      // Email user
  iat: number;        // Issued at (timestamp)
  exp: number;        // Expiration (iat + 7 jours)
  sessionId: string;  // Session.id (révocation)
}
```

#### Cycle de vie session

```typescript
// 1. Login → Création session
POST /auth/login
→ INSERT INTO Session (userId, sessionToken, ipAddress, userAgent)
→ Response: { accessToken: "eyJhbGc..." }

// 2. Requêtes authentifiées
GET /api/protected
Headers: { Authorization: "Bearer eyJhbGc..." }
→ Vérification signature JWT
→ Vérification session existe en DB

// 3. Logout → Révocation
POST /auth/logout
→ DELETE FROM Session WHERE sessionToken = ?

// 4. Cleanup auto (cron)
DELETE FROM Session WHERE createdAt < NOW() - INTERVAL '30 days'
```

#### Sécurité

| Protection | Implémentation |
|------------|----------------|
| **Brute force** | Rate limiting (5 tentatives/5 min par IP) |
| **Session hijacking** | Validation IP + User-Agent |
| **Token theft** | Révocation DB à chaque logout |
| **Expiration** | JWT TTL 7 jours + refresh tokens |
| **Rotation** | Nouvelle session à chaque login |

## 🧪 Module Crawl Budget Experiments

### `CrawlBudgetExperiment` - Expériences A/B

Tests d'optimisation budget crawl Google pour SEO.

| Champ | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | String | UUID | ID unique expérience |
| `name` | String | - | Titre expérience (ex: "Exclude low-traffic families") |
| `description` | String? | null | Explication détaillée |
| `action` | String | - | **exclude** / **include** / **reduce** |
| `targetFamilies` | String[] | [] | Codes gammes ciblées (ex: ["FREINAGE", "FILTRATION"]) |
| `reductionPercent` | Int? | null | % réduction si action=reduce (1-100) |
| `durationDays` | Int | 30 | Durée expérience (jours) |
| `status` | String | "draft" | **draft** / **running** / **paused** / **completed** |
| `baseline` | Json? | null | Métriques pré-expérience (30j avant) |
| `startedAt` | DateTime? | null | Date démarrage expérience |
| `completedAt` | DateTime? | null | Date fin expérience |
| `createdAt` | DateTime | now() | Date création |
| `updatedAt` | DateTime | auto | Dernière modification |

#### Actions disponibles

| Action | Description | Implémentation |
|--------|-------------|----------------|
| **exclude** | Bloquer crawl familles ciblées | `robots.txt` + `Disallow: /gamme/{family}/` |
| **include** | Forcer crawl familles ciblées | `sitemap.xml` priority=1.0 + `changefreq=daily` |
| **reduce** | Réduire crawl de X% | Pagination plus agressive + `crawl-delay` |

#### Structure baseline (JSON)

```json
{
  "crawlRate": 1250,        // Requêtes/jour moyenne 30j
  "indexation": 85000,      // URLs indexées
  "avgPosition": 12.4,      // Position moyenne SERP
  "organicTraffic": 45600,  // Sessions organiques/mois
  "conversions": 230        // Commandes organiques/mois
}
```

### `CrawlBudgetMetric` - Métriques quotidiennes

Collecte automatique métriques Google Search Console + GA4.

| Champ | Type | Contrainte | Description |
|-------|------|------------|-------------|
| `id` | String | PK, UUID | ID unique métrique |
| `experimentId` | String | FK, NOT NULL | FK → CrawlBudgetExperiment |
| `date` | DateTime | NOT NULL | Date métrique (YYYY-MM-DD) |
| `totalCrawledUrls` | Int | DEFAULT 0 | URLs crawlées (GSC) |
| `crawlRequestsCount` | Int | DEFAULT 0 | Requêtes crawl (GSC) |
| `avgCrawlRate` | Float | DEFAULT 0 | Pages/jour moyenne |
| `indexedUrls` | Int | DEFAULT 0 | URLs indexées (GSC) |
| `indexationRate` | Float | DEFAULT 0 | % indexation (indexed/crawled) |
| `organicSessions` | Int? | null | Sessions organiques (GA4) |
| `organicConversions` | Int? | null | Commandes organiques (GA4) |
| `familyMetrics` | Json? | null | Métriques par gamme (détail) |

**Contrainte unique** : `[experimentId, date]` (1 métrique/jour/expérience)

#### Structure familyMetrics (JSON)

```json
[
  {
    "familyCode": "FREINAGE",
    "crawledUrls": 450,
    "indexedUrls": 380,
    "avgPosition": 8.2,
    "impressions": 12500,
    "clicks": 890,
    "ctr": 7.12
  },
  {
    "familyCode": "FILTRATION",
    "crawledUrls": 320,
    "indexedUrls": 295,
    "avgPosition": 11.5,
    "impressions": 8600,
    "clicks": 520,
    "ctr": 6.05
  }
]
```

#### Collecte automatique (cron)

```typescript
// Backend cron: chaque jour à 03:00 UTC
@Cron('0 3 * * *')
async collectMetrics() {
  const runningExperiments = await prisma.crawlBudgetExperiment.findMany({
    where: { status: 'running' }
  });

  for (const exp of runningExperiments) {
    // 1. Récupérer métriques GSC API
    const gscData = await googleSearchConsole.getMetrics(exp.targetFamilies);
    
    // 2. Récupérer métriques GA4 API
    const ga4Data = await googleAnalytics.getOrganicMetrics(exp.targetFamilies);
    
    // 3. Insérer métrique quotidienne
    await prisma.crawlBudgetMetric.create({
      data: {
        experimentId: exp.id,
        date: new Date(),
        totalCrawledUrls: gscData.crawledUrls,
        indexedUrls: gscData.indexedUrls,
        avgCrawlRate: gscData.avgCrawlRate,
        indexationRate: (gscData.indexedUrls / gscData.crawledUrls) * 100,
        organicSessions: ga4Data.sessions,
        organicConversions: ga4Data.conversions,
        familyMetrics: gscData.familyDetails,
      }
    });
    
    // 4. Compléter expérience si durée atteinte
    if (daysSince(exp.startedAt) >= exp.durationDays) {
      await prisma.crawlBudgetExperiment.update({
        where: { id: exp.id },
        data: { status: 'completed', completedAt: new Date() }
      });
    }
  }
}
```

#### Indexes de performance

```sql
-- Recherche rapide expériences actives
CREATE INDEX idx_experiments_status ON crawl_budget_experiments(status);

-- Tri chronologique expériences
CREATE INDEX idx_experiments_created_at ON crawl_budget_experiments(created_at DESC);

-- Métriques par expérience
CREATE INDEX idx_metrics_experiment_id ON crawl_budget_metrics(experiment_id);

-- Métriques par date
CREATE INDEX idx_metrics_date ON crawl_budget_metrics(date DESC);

-- Métriques combinées (requêtes fréquentes)
CREATE INDEX idx_metrics_experiment_date ON crawl_budget_metrics(experiment_id, date DESC);
```

## 🔗 Diagramme relationnel

```mermaid
erDiagram
    USER ||--o{ SESSION : "a plusieurs"
    CRAWL_BUDGET_EXPERIMENT ||--o{ CRAWL_BUDGET_METRIC : "collecte"
    
    USER {
        string id PK
        string email UK
        string password
        datetime createdAt
    }
    
    SESSION {
        string id PK
        string userId FK
        string sessionToken UK
        string ipAddress
    }
    
    CRAWL_BUDGET_EXPERIMENT {
        string id PK
        string action
        string[] targetFamilies
        string status
        json baseline
    }
    
    CRAWL_BUDGET_METRIC {
        string id PK
        string experimentId FK
        date date
        int totalCrawledUrls
        int indexedUrls
        json familyMetrics
    }
```

## 🚀 Utilisation Prisma Client

### Installation

```bash
npm install @prisma/client
npx prisma generate
```

### Configuration NestJS

```typescript
// prisma.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

### Exemples CRUD

#### Authentification

```typescript
// Création utilisateur
const user = await prisma.user.create({
  data: {
    email: 'john@example.com',
    password: await bcrypt.hash('password123', 10),
    name: 'John Doe',
  }
});

// Login + session
const session = await prisma.session.create({
  data: {
    userId: user.id,
    sessionToken: jwtToken,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  }
});

// Vérification session
const validSession = await prisma.session.findUnique({
  where: { sessionToken },
  include: { user: true }
});

// Logout
await prisma.session.delete({
  where: { sessionToken }
});
```

#### Expériences SEO

```typescript
// Créer expérience
const experiment = await prisma.crawlBudgetExperiment.create({
  data: {
    name: 'Test exclude low-traffic families',
    action: 'exclude',
    targetFamilies: ['FREINAGE', 'FILTRATION'],
    durationDays: 30,
    status: 'draft',
  }
});

// Démarrer expérience
await prisma.crawlBudgetExperiment.update({
  where: { id: experiment.id },
  data: {
    status: 'running',
    startedAt: new Date(),
    baseline: {
      crawlRate: 1250,
      indexation: 85000,
      avgPosition: 12.4,
    }
  }
});

// Ajouter métrique quotidienne
await prisma.crawlBudgetMetric.create({
  data: {
    experimentId: experiment.id,
    date: new Date(),
    totalCrawledUrls: 1100,
    crawlRequestsCount: 1050,
    avgCrawlRate: 1100,
    indexedUrls: 82000,
    indexationRate: 74.5,
    organicSessions: 42000,
    organicConversions: 215,
  }
});

// Récupérer métriques expérience
const metrics = await prisma.crawlBudgetMetric.findMany({
  where: { experimentId: experiment.id },
  orderBy: { date: 'asc' },
  take: 30, // 30 derniers jours
});

// Compléter expérience
await prisma.crawlBudgetExperiment.update({
  where: { id: experiment.id },
  data: {
    status: 'completed',
    completedAt: new Date(),
  }
});
```

## 🔒 Row Level Security (RLS)

```sql
-- Activer RLS sur tables sensibles
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crawl_budget_experiments" ENABLE ROW LEVEL SECURITY;

-- Politique : Utilisateurs authentifiés peuvent lire leurs propres données
CREATE POLICY "Users can read own data"
  ON "User" FOR SELECT
  TO authenticated
  USING (id = current_user_id());

-- Politique : Admins peuvent tout lire/écrire
CREATE POLICY "Admins full access"
  ON "crawl_budget_experiments" FOR ALL
  TO service_role
  USING (true);
```

## 🧹 Migrations

```bash
# Créer migration
npx prisma migrate dev --name add_crawl_experiments

# Appliquer en production
npx prisma migrate deploy

# Réinitialiser DB (dev only)
npx prisma migrate reset
```

## 📊 Monitoring

### Statistiques DB

```typescript
// Nombre utilisateurs actifs
const activeUsers = await prisma.user.count({
  where: {
    sessions: { some: {} } // A au moins 1 session
  }
});

// Sessions actives (< 7 jours)
const activeSessions = await prisma.session.count({
  where: {
    createdAt: {
      gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    }
  }
});

// Expériences en cours
const runningExperiments = await prisma.crawlBudgetExperiment.count({
  where: { status: 'running' }
});
```

## 🔗 Voir aussi

- [Vue d'ensemble](./overview.md) - Architecture complète
- [Schéma Supabase](./supabase-schema.md) - 97 tables legacy
- [Authentication Guide](../guides/authentication.md) - JWT workflow détaillé
- [Prisma Documentation](https://www.prisma.io/docs) - Guide officiel
