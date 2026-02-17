# Backend Architecture - Module Marketing

## Structure du module

```
backend/src/modules/marketing/
  marketing.module.ts                        # Module NestJS (imports: DatabaseModule, CacheModule)
  interfaces/
    marketing.interfaces.ts                  # Interfaces TypeScript pour toutes les entites
  controllers/
    marketing-dashboard.controller.ts        # KPIs + stats agregees         [MVP]
    marketing-backlinks.controller.ts        # CRUD + import CSV backlinks   [MVP]
    marketing-content-roadmap.controller.ts  # CRUD + coverage analysis      [MVP]
    marketing-campaigns.controller.ts        # CRUD campaigns                [P1]
    marketing-outreach.controller.ts         # CRUD outreach                 [P2]
    marketing-guest-posts.controller.ts      # CRUD guest posts              [P2]
  services/
    marketing-data.service.ts                # Toutes queries Supabase (extends SupabaseBaseService)
    marketing-dashboard.service.ts           # Agregation KPIs, cross-table  [MVP]
    marketing-backlinks.service.ts           # Logique backlinks             [MVP]
    marketing-content-roadmap.service.ts     # Planification + couverture    [MVP]
    marketing-campaigns.service.ts           # Logique campagnes             [P1]
    marketing-outreach.service.ts            # Logique outreach              [P2]
    marketing-guest-posts.service.ts         # Logique guest posts           [P2]
```

## Pattern 3-tier (identique au blog module)

```
Controller (HTTP + Zod validation + IsAdminGuard)
    |
Service (business logic, transformations)
    |
MarketingDataService (Supabase SDK direct, extends SupabaseBaseService)
    |
Supabase PostgreSQL (__marketing_* tables)
```

## Module registration

```typescript
// marketing.module.ts
@Module({
  imports: [DatabaseModule, CacheModule],
  controllers: [
    MarketingDashboardController,
    MarketingBacklinksController,
    MarketingContentRoadmapController,
  ],
  providers: [
    MarketingDataService,
    MarketingDashboardService,
    MarketingBacklinksService,
    MarketingContentRoadmapService,
  ],
  exports: [MarketingDataService],
})
export class MarketingModule {}

// app.module.ts - ajouter aux imports
import { MarketingModule } from './modules/marketing/marketing.module';
```

## Endpoints API - MVP

Tous sous `/api/admin/marketing/`, proteges par `@UseGuards(IsAdminGuard)`.

### Dashboard

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| `GET` | `/dashboard` | KPIs complets | `{ backlinks: {total, live, da30plus}, outreach: {sent, accepted}, content: {total, published, coverage_pct}, kpi_latest: {...} }` |
| `GET` | `/dashboard/timeline` | KPIs sur 30/90 jours | `{ snapshots: [...] }` |
| `POST` | `/dashboard/snapshot` | Enregistrer snapshot KPI | `{ success: true, id }` |

### Backlinks

| Method | Path | Description | Query params |
|--------|------|-------------|-------------|
| `GET` | `/backlinks` | Liste paginee | `?status=live&min_da=30&domain=...&page=1&limit=20` |
| `GET` | `/backlinks/stats` | Stats agregees | - |
| `GET` | `/backlinks/:id` | Detail | - |
| `POST` | `/backlinks` | Creer | Body: `{ source_url, target_url, anchor_text, ... }` |
| `POST` | `/backlinks/import` | Import CSV | Body: CSV parsed array |
| `PATCH` | `/backlinks/:id` | Update | Body: partial update |
| `DELETE` | `/backlinks/:id` | Supprimer | - |

### Content Roadmap

| Method | Path | Description | Query params |
|--------|------|-------------|-------------|
| `GET` | `/content-roadmap` | Liste paginee | `?content_type=glossary&priority=critical&status=planned&page=1` |
| `GET` | `/content-roadmap/coverage` | Analyse couverture gammes | - |
| `GET` | `/content-roadmap/:id` | Detail | - |
| `POST` | `/content-roadmap` | Creer | Body: `{ title, content_type, priority, pg_id, ... }` |
| `PATCH` | `/content-roadmap/:id` | Update | Body: partial update |
| `DELETE` | `/content-roadmap/:id` | Supprimer | - |

## MarketingDataService - Methodes cles

```typescript
// Extends SupabaseBaseService pour avoir this.client (SupabaseClient)

// --- Dashboard ---
async getDashboardStats(): Promise<MarketingDashboard>
async getKpiTimeline(days: number): Promise<KpiSnapshot[]>
async saveKpiSnapshot(data: Partial<KpiSnapshot>): Promise<KpiSnapshot>

// --- Backlinks ---
async getBacklinks(options: BacklinkFilters): Promise<PaginatedResult<Backlink>>
async getBacklinkStats(): Promise<BacklinkStats>
async getBacklinkById(id: number): Promise<Backlink | null>
async createBacklink(data: CreateBacklink): Promise<Backlink>
async createBacklinks(data: CreateBacklink[]): Promise<number> // bulk import
async updateBacklink(id: number, data: Partial<Backlink>): Promise<Backlink>
async deleteBacklink(id: number): Promise<boolean>

// --- Content Roadmap ---
async getContentRoadmap(options: RoadmapFilters): Promise<PaginatedResult<RoadmapItem>>
async getContentCoverage(): Promise<CoverageAnalysis> // cross-table avec __blog_advice + pieces_gamme
async getRoadmapItemById(id: number): Promise<RoadmapItem | null>
async createRoadmapItem(data: CreateRoadmapItem): Promise<RoadmapItem>
async updateRoadmapItem(id: number, data: Partial<RoadmapItem>): Promise<RoadmapItem>
async deleteRoadmapItem(id: number): Promise<boolean>
```

## Coverage Analysis (feature cle)

La methode `getContentCoverage()` croise :
- `pieces_gamme` (221 gammes, `pg_level = '1'`)
- `__blog_advice` (articles existants via `ba_pg_id`)
- `__seo_reference` (definitions via slug)
- `__seo_observable` (diagnostics via `related_gammes`)
- `__marketing_content_roadmap` (contenu planifie)

Retourne :
```typescript
interface CoverageAnalysis {
  total_gammes: number;          // 221
  gammes_with_advice: number;    // ~85
  gammes_with_reference: number; // ~0 (a construire)
  gammes_with_diagnostic: number;// ~1 (bruit-embrayage)
  gammes_with_roadmap: number;   // contenu planifie
  coverage_pct: number;          // % couverture globale
  gaps: GammeGap[];              // gammes sans contenu, triees par trafic GA4
}

interface GammeGap {
  pg_id: number;
  pg_name: string;
  pg_alias: string;
  family: string;
  has_advice: boolean;
  has_reference: boolean;
  has_diagnostic: boolean;
  has_roadmap: boolean;
  ga4_traffic: number | null;
}
```

## Fichiers de reference a suivre

| Pattern | Fichier existant |
|---------|-----------------|
| Data service (extends SupabaseBaseService) | `backend/src/modules/blog/services/blog-article-data.service.ts` |
| Controller avec guards | `backend/src/modules/seo/controllers/seo-dashboard.controller.ts` |
| Module registration | `backend/src/modules/blog/blog.module.ts` |
| Interfaces | `backend/src/modules/blog/interfaces/blog.interfaces.ts` |
| app.module imports | `backend/src/app.module.ts` |
| TABLES constants | `packages/database-types/src/constants.ts` |
