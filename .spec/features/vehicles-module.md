---
title: "vehicles module"
status: draft
version: 1.0.0
---

# Feature Spec: Vehicles Module

**Phase**: 3 Extended (Feature 11/18)  
**Coverage**: +1 module → 73% (23/37 modules)  
**Endpoints**: 31 total (18 standard + 5 Zod + 8 migration)  
**Architecture**: VehiclesService (orchestrator) + EnhancedVehicleService + 7 services spécialisés  
**Lines**: ~5.5K (services), ~800 (controllers)

---

## 1. Objectif Métier

Module central de **compatibilité véhicules** pour e-commerce pièces auto. Permet recherche pièces par **marque/modèle/motorisation**, validation compatibilité produit-véhicule, sélecteur intelligent frontend.

**Business Value**:
- 🚗 Recherche pièces par véhicule (40 marques, 5745 modèles, 48918 motorisations)
- ✅ Validation compatibilité produit-véhicule (table `vehicules_pieces`)
- 🔍 Recherche Mine/CNIT (codes immatriculation FR)
- 📊 Catalogues constructeurs avec SEO (meta-tags, URLs canoniques)
- 🔄 Migration URLs (301 redirects anciennes URLs)

---

## 2. Endpoints (31 Total)

### 2.1 Controller Standard (`VehiclesController`) - 13 endpoints

**Base route**: `/api/vehicles`

#### **Marques (Brands)** - 4 endpoints

```typescript
GET /api/vehicles/brands
// Liste marques paginée + search
// Query: { search?, limit?, page? }
// Response: { data: VehicleBrand[], total, page, limit }
// Cache: 5min in-memory

GET /api/vehicles/brands/:brandId
// Détails marque (ID ou alias)
// Response: VehicleBrand | null

GET /api/vehicles/brands/:brandId/models
// Modèles par marque + filtres (year, search)
// Query: { year?, search?, limit?, page? }
// Response: { data: VehicleModel[], total, page, limit }

GET /api/vehicles/brands/:brandId/years
// Années production par marque
// Response: { years: number[], min, max }
```

#### **Modèles (Models)** - 1 endpoint

```typescript
GET /api/vehicles/models/:modelId/types
// Motorisations par modèle + filtrage année
// Query: { year?, limit?, page? }
// Response: { data: VehicleType[], total, page, limit }
// Note: Filtrage intelligent sur type_year_from/to
```

#### **Types (Motorizations)** - 2 endpoints

```typescript
GET /api/vehicles/types/:typeId
// Détails motorisation avec enrichissement
// Response: VehicleType + auto_marque + auto_modele + motor_codes
// Enrichment: cars_engine (tech specs)

GET /api/vehicles/meta-tags/:typeId
// Meta-tags SEO pour motorisation
// Response: { title, description, keywords, canonical }
```

#### **Recherche (Search)** - 4 endpoints

```typescript
GET /api/vehicles/search/advanced?q={query}
// Recherche multi-entités (brands, models, types)
// Response: { brands: [], models: [], types: [], total }
// Algorithm: ILIKE sur name/alias, ranking par pertinence

GET /api/vehicles/search/mine/:code
// Recherche par code Mine (immatriculation FR)
// Response: VehicleType[] compatibles
// Table: auto_type_number_code (tnc_code)

GET /api/vehicles/search/cnit/:code
// Recherche par CNIT (code constructeur)
// Response: VehicleType[] compatibles
// Table: auto_type_number_code (tnc_cnit)

GET /api/vehicles/mines/model/:id
// Liste codes Mine par modèle
// Response: { codes: string[], total }
```

#### **Stats & Utilitaires** - 2 endpoints

```typescript
GET /api/vehicles/stats
// Statistiques globales
// Response: { brands, models, types, lastUpdate }

GET /api/vehicles/test-mines
// Test codes Mine (debug)
// Response: { data: sample 10 codes, total }
```

---

### 2.2 Controller Zod (`VehiclesZodController`) - 5 endpoints

**Base route**: `/api/vehicles-zod`  
**Note**: Validation Zod stricte via `VehicleZodValidationPipe`

```typescript
GET /api/vehicles-zod/brands
// Pipe: BrandQuerySchema { search?, limit?, page? }

GET /api/vehicles-zod/brands/:brandId/models
// Pipe: ModelQuerySchema { search?, year?, limit?, page? }

GET /api/vehicles-zod/models/:modelId/types
// Pipe: TypeQuerySchema { year?, limit?, page? }

GET /api/vehicles-zod/stats
// Pas de validation (pas de query params)

GET /api/vehicles-zod/search
// Pipe: BrandQuerySchema { search, limit? }
```

---

### 2.3 Controller Migration (`VehiclePartUrlMigrationController`) - 8 endpoints

**Base route**: `/api/vehicles/migration`  
**Objectif**: Gestion redirections 301 (anciennes URLs → nouvelle architecture)

```typescript
GET /api/vehicles/migration/test/:legacyUrl
// Test mapping URL sans créer redirection
// Response: { legacy, new, status: 'ok' | 'error' }

GET /api/vehicles/migration/stats
// Stats redirections (total, par type, dernière mise à jour)
// Response: { total, byType: {}, lastUpdate }

POST /api/vehicles/migration/migrate-url
// Migration URL unique
// Body: { legacy_url, test_mode? }
// Response: { redirect_id, legacy, new, created }

POST /api/vehicles/migration/migrate-vehicle
// Migration URLs véhicule complet (toutes pièces)
// Body: { brand_slug, brand_id, model_slug, model_id, type_slug, type_id, force_update? }
// Response: { total, created, updated, errors[] }

GET /api/vehicles/migration/test-examples
// URLs exemples pour tests
// Response: { examples: string[] }

GET /api/vehicles/migration/preview/:brand/:brandId/:model/:modelId/:type/:typeId
// Preview URLs générées sans migration
// Response: { vehicle, urls: { old, new }[] }

GET /api/vehicles/migration/generate-caddy-rules
// Génération fichier Caddyfile (règles 301)
// Response: text/plain Caddyfile format
// Note: Utilisé par CI/CD pour config reverse proxy
```

**Tables Migration**:
- `url_redirects` (id, legacy_url, new_url, status_code, created_at)
- Génération automatique via `VehiclePartUrlMigrationService`

---

## 3. Architecture Services

### 3.1 Service Principal (`VehiclesService`) - 1215 lignes

**Responsabilités**:
- Orchestration requêtes Supabase
- Cache in-memory (5min TTL, Map<key, { data, expires }>)
- Méthodes legacy (parité PHP)

**Méthodes clés**:
```typescript
async getVehicleDetails(marqueId, modeleId, typeId): Promise<VehicleDetailsEnhanced>
// Détails complets avec relations (auto_marque, auto_modele, auto_type_motor_code)

async findAll(filters: VehiclePaginationDto): Promise<VehicleResponseDto>
// Liste marques avec pagination + search

async findModelsByBrand(brandId, filters): Promise<VehicleResponseDto>
// Modèles par marque + filtres year

async findTypesByModel(modelId, filters): Promise<VehicleResponseDto>
// Motorisations par modèle + filtres year

async findYearsByBrand(brandId): Promise<{ years: number[] }>
// Années production (min/max extraction auto_type)

async searchAdvanced(query, limit): Promise<{ brands, models, types, total }>
// Recherche multi-entités ILIKE

async searchByMineCode(code): Promise<VehicleType[]>
// Recherche Mine via auto_type_number_code

async searchByCnit(code): Promise<VehicleType[]>
// Recherche CNIT via auto_type_number_code

async getTypeById(typeId): Promise<VehicleType | null>
// Détails motorisation + enrichissement

async getMinesByModel(modelId): Promise<{ codes: string[] }>
// Liste codes Mine par modèle

async getVehicleStats(): Promise<{ brands, models, types }>
// Stats globales (COUNT distinct)

async getMetaTagsByTypeId(typeId): Promise<{ title, description, keywords }>
// Meta-tags SEO génération automatique
```

**Cache Strategy**:
- In-memory Map (pas Redis, simplicité)
- TTL: 5min (CACHE_TTL constant)
- Keys: `vehicle_details_{marque}_{modele}_{type}`, `all_brands`, `models_{brandId}`
- Invalidation: Automatique après TTL expiration

---

### 3.2 Service Enhanced (`EnhancedVehicleService`) - 438 lignes

**Responsabilités**: Orchestrator modulaire (7 services spécialisés)

**Architecture**:
```typescript
EnhancedVehicleService
├── VehicleCacheService (Redis cache optimisé)
├── VehicleEnrichmentService (cars_engine enrichissement)
├── VehicleSearchService (recherches avancées)
├── VehicleMineService (codes Mine/CNIT)
├── VehicleBrandsService (CRUD marques)
├── VehicleModelsService (CRUD modèles)
└── VehicleTypesService (CRUD motorisations)
```

**Méthodes déléguées** (7 migrées):
1. `searchByCode(code)` → VehicleSearchService
2. `getMinesByModel(modeleId)` → VehicleMineService
3. `getTypeById(typeId)` → VehicleTypesService
4. `searchByCnit(code)` → VehicleSearchService
5. `searchByMineCode(code)` → VehicleMineService
6. `searchAdvanced(query)` → VehicleSearchService
7. `getBrands(options)` → VehicleBrandsService (bonus)

**Méthodes complémentaires**:
```typescript
async getModelsByBrand(marqueId, options): Promise<VehicleResponse<VehicleModel>>
async getTypesByModel(modeleId, options): Promise<VehicleResponse<VehicleType>>
async getYearsByBrand(marqueId): Promise<number[]>
```

---

### 3.3 Services Spécialisés (7 Total, ~5.5K lignes)

#### **VehicleBrandsService** - 465 lignes
```typescript
async getBrands(options): Promise<VehicleResponse<VehicleBrand>>
// Cache Redis (CacheType.BRANDS), TTL 1h
// Query: auto_marque WHERE marque_display=1

async getBrandById(marqueId): Promise<VehicleBrand | null>
// Cache Redis key: `brand:{id}`

async searchBrands(query, options): Promise<VehicleResponse<VehicleBrand>>
// ILIKE marque_name + marque_alias

async getBrandStats(): Promise<BrandStats>
// { totalBrands, activeBrands, brandsWithModels, topBrands[] }
```

#### **VehicleModelsService** - 802 lignes
```typescript
async getModels(options): Promise<VehicleResponse<VehicleModel>>
// Cache Redis, pagination

async getModelById(modeleId): Promise<VehicleModel | null>
// Cache key: `model:{id}`

async getModelsByBrand(marqueId, options): Promise<VehicleResponse<VehicleModel>>
// Filtrage year intelligent (jointure auto_type pour dates production)
// Cache: `models_by_brand:{marqueId}:${JSON.stringify(options)}`

async searchModels(query, options): Promise<VehicleResponse<VehicleModel>>
// ILIKE modele_name + modele_alias
```

#### **VehicleTypesService** - 1089 lignes
```typescript
async getTypes(options): Promise<VehicleResponse<VehicleType>>
// Cache Redis, pagination

async getTypeById(typeId, includeEngine?): Promise<VehicleType | null>
// Enrichment cars_engine si includeEngine=true
// Cache key: `type:{id}:engine={bool}`

async getTypesByModel(modeleId, options): Promise<VehicleResponse<VehicleType>>
// Filtrage year, fuel, power
// Cache: `types_by_model:{modeleId}`

async searchTypes(query, options): Promise<VehicleResponse<VehicleType>>
// ILIKE type_name + type_engine
```

#### **VehicleSearchService** - 647 lignes
```typescript
async searchByCode(code, options): Promise<VehicleResponse<any>>
// Recherche Mine/CNIT/alias combinée
// Priority: 1) Mine exact, 2) CNIT exact, 3) Alias ILIKE

async searchAdvanced(query, options): Promise<{ brands, models, types }>
// Multi-entités parallèles (Promise.all)
// Ranking: exact match > starts with > contains

async searchSuggestions(partial): Promise<string[]>
// Autocomplétion (10 suggestions max)
```

#### **VehicleMineService** - 523 lignes
```typescript
async getMinesByModel(modeleId, options): Promise<VehicleResponse<any>>
// Jointure auto_type → auto_type_number_code
// Distinct codes Mine

async searchByMineCode(code): Promise<VehicleType[]>
// Exact match tnc_code, retourne types compatibles

async validateMineCode(code): Promise<boolean>
// Validation format Mine (regex FR)
```

#### **VehicleCacheService** - 412 lignes
```typescript
async getOrSet<T>(type: CacheType, key: string, factory: () => Promise<T>): Promise<T>
// Pattern cache-aside, TTL par type
// Types: BRANDS (1h), MODELS (30min), TYPES (15min), SEARCH (5min)

async invalidate(type: CacheType, key: string): Promise<void>
// Suppression clé Redis

async warmup(): Promise<void>
// Preload marques populaires au démarrage
```

#### **VehicleEnrichmentService** - 389 lignes
```typescript
async enrichWithEngineData(type: VehicleType): Promise<VehicleType>
// Jointure cars_engine (specs techniques constructeur)
// Fields: displacement, cylinders, valves, compression, torque

async enrichBatch(types: VehicleType[]): Promise<VehicleType[]>
// Enrichissement parallèle (Promise.all)
```

---

## 4. Database Schema

### 4.1 Tables Principales

#### **auto_marque** (Marques) - 40 actives
```sql
marque_id           SERIAL PRIMARY KEY
marque_name         VARCHAR(100)        -- Peugeot, Renault...
marque_alias        VARCHAR(100)        -- peugeot, renault (SEO)
marque_name_meta    VARCHAR(200)        -- Meta title
marque_logo         VARCHAR(255)        -- URL logo
marque_country      VARCHAR(2)          -- FR, DE, IT...
marque_display      SMALLINT DEFAULT 1  -- Visible frontend
marque_top          SMALLINT DEFAULT 0  -- Marque populaire
marque_relfollow    SMALLINT DEFAULT 1  -- SEO nofollow
marque_sitemap      SMALLINT DEFAULT 1  -- Inclure sitemap
marque_sort         INTEGER             -- Ordre tri
```

**Indexes**:
- `idx_marque_display` ON (marque_display)
- `idx_marque_alias` ON (marque_alias)
- `idx_marque_top` ON (marque_top, marque_display)

#### **auto_modele** (Modèles) - 5745 rows
```sql
modele_id           SERIAL PRIMARY KEY
modele_marque_id    INTEGER → auto_marque(marque_id)
modele_name         VARCHAR(100)        -- 308, Clio, Golf...
modele_alias        VARCHAR(100)        -- 308, clio (SEO)
modele_name_meta    VARCHAR(200)
modele_ful_name     VARCHAR(255)        -- Nom complet
modele_year_from    INTEGER             -- Année début production
modele_year_to      INTEGER             -- Année fin (NULL = actuel)
modele_body         VARCHAR(50)         -- Berline, SUV, Break...
modele_pic          VARCHAR(255)        -- Image modèle
modele_display      SMALLINT DEFAULT 1
modele_relfollow    SMALLINT DEFAULT 1
modele_sitemap      SMALLINT DEFAULT 1
modele_sort         INTEGER
```

**Indexes**:
- `idx_modele_marque` ON (modele_marque_id, modele_display)
- `idx_modele_alias` ON (modele_alias)
- `idx_modele_years` ON (modele_year_from, modele_year_to)

#### **auto_type** (Motorisations) - 48918 rows
```sql
type_id             SERIAL PRIMARY KEY
type_marque_id      INTEGER → auto_marque(marque_id)
type_modele_id      INTEGER → auto_modele(modele_id)
type_name           VARCHAR(200)        -- 1.6 HDI 115ch
type_alias          VARCHAR(200)        -- 16-hdi-115ch (SEO)
type_name_meta      VARCHAR(255)
type_engine         VARCHAR(100)        -- 1.6 HDI
type_engine_code    VARCHAR(50)         -- DV6C
type_fuel           VARCHAR(50)         -- Diesel, Essence...
type_power_ps       INTEGER             -- Puissance chevaux
type_power_kw       INTEGER             -- Puissance kW
type_year_from      INTEGER             -- Année début
type_year_to        INTEGER             -- Année fin (NULL = actuel)
type_month_from     INTEGER             -- Mois début (1-12)
type_month_to       INTEGER             -- Mois fin
type_display        SMALLINT DEFAULT 1
type_relfollow      SMALLINT DEFAULT 1
type_sitemap        SMALLINT DEFAULT 1
type_ccm            INTEGER             -- Cylindrée cm³
type_cylinders      INTEGER             -- Nombre cylindres
type_valves         INTEGER             -- Nombre soupapes
```

**Indexes**:
- `idx_type_marque_modele` ON (type_marque_id, type_modele_id, type_display)
- `idx_type_alias` ON (type_alias)
- `idx_type_years` ON (type_year_from, type_year_to)
- `idx_type_fuel_power` ON (type_fuel, type_power_ps)

#### **auto_type_number_code** (Codes Mine/CNIT) - ~50K rows
```sql
tnc_id              SERIAL PRIMARY KEY
tnc_type_id         INTEGER → auto_type(type_id)
tnc_code            VARCHAR(20)         -- Code Mine (ex: M10PEUOT308)
tnc_cnit            VARCHAR(20)         -- CNIT constructeur
tnc_description     TEXT
```

**Indexes**:
- `idx_tnc_code` ON (tnc_code)
- `idx_tnc_cnit` ON (tnc_cnit)
- `idx_tnc_type` ON (tnc_type_id)

#### **auto_type_motor_code** (Codes moteur) - ~30K rows
```sql
tmc_id              SERIAL PRIMARY KEY
tmc_type_id         INTEGER → auto_type(type_id)
tmc_code            VARCHAR(50)         -- DV6C, K9K...
tmc_description     TEXT
```

**Index**: `idx_tmc_type` ON (tmc_type_id)

#### **cars_engine** (Specs techniques) - ~20K rows
```sql
engine_id           SERIAL PRIMARY KEY
type_id             INTEGER → auto_type(type_id)
displacement        INTEGER             -- Cylindrée
cylinders           INTEGER
valves              INTEGER
compression_ratio   DECIMAL(4,2)
max_torque_nm       INTEGER
max_torque_rpm      INTEGER
fuel_system         VARCHAR(50)
```

**Index**: `idx_engine_type` ON (type_id)

---

### 4.2 Table Compatibilité Produits

#### **vehicules_pieces** (Compatibility) - ~500K rows
```sql
vp_id               SERIAL PRIMARY KEY
piece_id            INTEGER → pieces_price(piece_id)
brand_id            INTEGER → auto_marque(marque_id)
model_id            INTEGER → auto_modele(modele_id)
type_id             INTEGER → auto_type(type_id)       NULLABLE
motor_code          VARCHAR(50)                         NULLABLE
fuel_type           VARCHAR(50)                         NULLABLE
year_from           INTEGER                             NULLABLE
year_to             INTEGER                             NULLABLE
is_direct_fit       BOOLEAN DEFAULT true
requires_adaptation BOOLEAN DEFAULT false
adaptation_notes    TEXT
created_at          TIMESTAMP DEFAULT NOW()
```

**Indexes**:
- `idx_vp_piece` ON (piece_id)
- `idx_vp_vehicle` ON (brand_id, model_id, type_id)
- `idx_vp_composite` ON (piece_id, brand_id, model_id)

**Usage**:
```typescript
// ProductsService.findByVehicleCompatibility()
// Requête compatible produits pour véhicule donné
const { data } = await client
  .from('vehicules_pieces')
  .select('piece_id, pieces_price!inner(*)')
  .eq('brand_id', brandId)
  .eq('model_id', modelId)
  .lte('year_from', year)
  .or(`year_to.gte.${year},year_to.is.null`);
```

---

## 5. Validation Zod

### 5.1 Schémas Requêtes

```typescript
// vehicles-simple-zod.dto.ts
export const BrandQuerySchema = z.object({
  search: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  page: z.number().int().min(0).default(0),
});

export const ModelQuerySchema = z.object({
  brandId: z.string(),
  search: z.string().optional(),
  year: z.number().int().min(1900).max(2030).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  page: z.number().int().min(0).default(0),
});

export const TypeQuerySchema = z.object({
  modelId: z.string(),
  year: z.number().int().min(1900).max(2030).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  page: z.number().int().min(0).default(0),
});

// vehicles-zod.dto.ts (complet)
export const VehicleSearchSchema = z.object({
  brandCode: z.string().min(1).optional(),
  modelCode: z.string().min(1).optional(),
  typeCode: z.string().min(1).optional(),
  year: z.number().int().min(1900).max(2030).optional(),
  engineCode: z.string().min(1).optional(),
  fuelType: z.enum(['Essence', 'Diesel', 'Électrique', 'Hybride', 'GPL', 'GNV']).optional(),
});
```

### 5.2 Pipe Validation

```typescript
// vehicle-validation.pipe.ts
@Injectable()
export class VehicleZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: any) {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          message: 'Validation échouée',
          errors: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      throw error;
    }
  }
}
```

**Usage Controller**:
```typescript
@Get('brands')
@UsePipes(new VehicleZodValidationPipe(BrandQuerySchema))
async getAllBrands(@Query() query: BrandQueryDto) {
  return this.vehiclesService.findAll(query);
}
```

---

## 6. Frontend Integration

### 6.1 Composant Principal (`vehicle-selector-v3.tsx`)

**Features**:
- Sélection progressive (Brand → Model → Type)
- Recherche autocomplete par marque/modèle
- Filtrage année production
- Affichage specs techniques (puissance, carburant)
- Lazy loading images (logos marques)

**API Calls**:
```typescript
// 1. Charger marques
const { data: brands } = await fetch('/api/vehicles/brands?limit=100');

// 2. Charger modèles par marque (avec filtrage année)
const { data: models } = await fetch(`/api/vehicles/brands/${brandId}/models?year=${year}`);

// 3. Charger motorisations par modèle
const { data: types } = await fetch(`/api/vehicles/models/${modelId}/types?year=${year}`);

// 4. Recherche avancée
const results = await fetch(`/api/vehicles/search/advanced?q=${query}`);
```

**State Management**:
```typescript
const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
const [selectedModel, setSelectedModel] = useState<VehicleModel | null>(null);
const [selectedType, setSelectedType] = useState<VehicleType | null>(null);
const [year, setYear] = useState<number | null>(null);
```

---

### 6.2 Routes Commerciales

#### **`commercial.vehicles.brands.$brandId.models.tsx`**
- Liste modèles par marque avec cards
- Filtres: année, search
- Stats: nombre modèles, période production
- SEO: meta-tags dynamiques (marque_name_meta)

#### **`commercial.vehicles.compatibility.tsx`**
- Recherche compatibilité pièce-véhicule
- Input: pieceId, brandId, modelId, typeId
- Output: Liste pièces compatibles avec véhicule
- Table: vehicules_pieces jointure pieces_price

#### **`blog-pieces-auto.auto.$marque.$modele.tsx`**
- Page SEO véhicule (URL canonique)
- Format: `/blog-pieces-auto/auto/peugeot/308`
- Content: Specs techniques, motorisations, pièces disponibles
- Meta-tags: Générés par `VehiclesService.getMetaTagsByTypeId()`

---

## 7. Migration URLs & SEO

### 7.1 Anciennes URLs (Legacy)

**Format PHP**:
```
/pieces-auto/marque-{brandId}-{brandAlias}/
/pieces-auto/marque-{brandId}-{brandAlias}/modele-{modelId}-{modelAlias}/
/pieces-auto/marque-{brandId}-{brandAlias}/modele-{modelId}-{modelAlias}/type-{typeId}-{typeAlias}/
```

**Exemple**:
```
/pieces-auto/marque-9-peugeot/modele-1324-308/type-28491-16-hdi-115ch/
```

### 7.2 Nouvelles URLs (NestJS/Remix)

**Format Remix**:
```
/blog-pieces-auto/auto/{brandAlias}/{modelAlias}
/blog-pieces-auto/auto/{brandAlias}/{modelAlias}/{typeAlias}
```

**Exemple**:
```
/blog-pieces-auto/auto/peugeot/308
/blog-pieces-auto/auto/peugeot/308/16-hdi-115ch
```

### 7.3 Service Migration

**`VehiclePartUrlMigrationService`** - 887 lignes

**Méthodes**:
```typescript
async parseLegacyUrl(url: string): Promise<{ brand, model, type }>
// Regex extraction IDs + aliases

async generateNewUrl(brand, model, type): Promise<string>
// Construction nouvelle URL Remix

async createRedirect(legacy, newUrl, statusCode = 301): Promise<Redirect>
// Insertion table url_redirects

async bulkMigrate(filters): Promise<{ created, updated, errors }>
// Migration lot (par marque/modèle)

async generateCaddyRules(): Promise<string>
// Export Caddyfile pour reverse proxy
```

**Exemple Caddyfile**:
```caddyfile
# Auto-generated by VehiclePartUrlMigrationService
redir /pieces-auto/marque-9-peugeot/modele-1324-308/* /blog-pieces-auto/auto/peugeot/308{uri} 301
redir /pieces-auto/marque-17-renault/* /blog-pieces-auto/auto/renault{uri} 301
```

---

## 8. Performance & Cache

### 8.1 Stratégies Cache

**In-Memory (VehiclesService)**:
- TTL: 5min
- Storage: Map<string, { data, expires }>
- Scope: Instance-local (pas partagé multi-instances)
- Use case: Détails véhicule fréquemment consultés

**Redis (VehicleCacheService)**:
- TTL variable par type:
  - BRANDS: 1h (données stables)
  - MODELS: 30min (mises à jour rares)
  - TYPES: 15min (specs techniques)
  - SEARCH: 5min (résultats dynamiques)
- Keys: `vehicles:{type}:{identifier}:{hash}`
- Warmup: Top 20 marques au démarrage

### 8.2 Optimisations Requêtes

**Jointures Optimisées**:
```typescript
// Éviter N+1 queries: jointure auto_marque + auto_modele + motor_codes
const { data } = await client
  .from('auto_type')
  .select(`
    *,
    auto_marque!inner(*),
    auto_modele!inner(*),
    auto_type_motor_code(*)
  `)
  .eq('type_id', typeId);
```

**Filtrage Année Intelligent**:
```typescript
// Motorisations compatibles avec année donnée
.lte('type_year_from', year)
.or(`type_year_to.gte.${year},type_year_to.is.null`)
```

**Pagination Efficace**:
```typescript
const offset = page * limit;
query.range(offset, offset + limit - 1);
// + count() séparé pour total (option returnCount: 'exact')
```

---

## 9. Tests & Validation

### 9.1 Endpoints Tests

**Test Codes Mine**:
```bash
curl http://localhost:3000/api/vehicles/test-mines
# Response: { data: [10 codes], total }
```

**Test Migration URL**:
```bash
curl http://localhost:3000/api/vehicles/migration/test/pieces-auto%2Fmarque-9-peugeot%2Fmodele-1324-308
# Response: { legacy, new, status: 'ok' }
```

### 9.2 Frontend Tests

**Vehicle Selector**:
- Sélection complète (brand → model → type)
- Validation compatibilité année
- Affichage specs (puissance, carburant)
- Reset cascade (change brand → reset model + type)

**Compatibility Checker**:
- Input pièce + véhicule → Liste compatibilité
- Validation: pièce existe + véhicule valide
- Display: Badge stock, prix, gamme

---

## 10. Business Rules

### 10.1 Affichage Frontend

**Marques visibles**: `marque_display = 1` (40/100+ marques)  
**Marques top**: `marque_top = 1` (10 marques populaires en premier)  
**Modèles actifs**: `modele_display = 1` (tous par défaut, peut changer)  
**Types visibles**: `type_display = 1` (affichage frontend)

### 10.2 Compatibilité Produit

**Direct Fit**: `is_direct_fit = true` → Montage sans adaptation  
**Adaptation**: `requires_adaptation = true` → Nécessite modification  
**Universal**: Compatible tous véhicules (pas d'entrée vehicules_pieces)  
**Specific**: Lié à marque/modèle/type précis

### 10.3 SEO

**Canonical URLs**: Générées par alias (lowercase, slugify)  
**Meta-tags**: Dynamiques par typeId (title, description, keywords)  
**Sitemap**: `marque_sitemap = 1` + `modele_sitemap = 1` (inclusion XML)  
**NoFollow**: `marque_relfollow = 0` → rel="nofollow" sur liens  
**Redirects 301**: Anciennes URLs → Nouvelles (préservation SEO)

---

## 11. Error Handling

### 11.1 Validation Errors

**Zod Validation Failure**:
```typescript
throw new BadRequestException({
  message: 'Validation échouée',
  errors: zodError.errors.map(e => ({
    path: e.path.join('.'),
    message: e.message,
  })),
});
```

### 11.2 Database Errors

**Supabase Error Handling**:
```typescript
if (error) {
  this.logger.error('Erreur Supabase:', error);
  throw new InternalServerErrorException('Erreur récupération véhicules');
}
```

### 11.3 Cache Errors

**Redis Failure → Degraded Mode**:
```typescript
try {
  return await this.cacheService.getOrSet(key, factory);
} catch (error) {
  this.logger.warn('Cache error, fallback to DB:', error);
  return await factory(); // Direct DB query
}
```

---

## 12. Summary

**Module Vehicles**: Infrastructure centrale compatibilité véhicules pour e-commerce auto parts.

**Endpoints**: 31 total
- 18 standard (brands, models, types, search, stats)
- 5 Zod validation (strict types)
- 8 migration (redirections 301 SEO)

**Architecture**: 
- VehiclesService (1215 lignes, orchestrator legacy)
- EnhancedVehicleService (438 lignes, orchestrator moderne)
- 7 services spécialisés (~5.5K lignes: Brands, Models, Types, Search, Mine, Cache, Enrichment)

**Database**: 5 tables principales (auto_marque, auto_modele, auto_type, auto_type_number_code, auto_type_motor_code) + 1 compatibility (vehicules_pieces) + enrichment (cars_engine)

**Cache**: Dual strategy (in-memory 5min + Redis variable TTL)

**SEO**: Migration URLs legacy → Remix, meta-tags dynamiques, sitemap XML

**Frontend**: vehicle-selector-v3.tsx (sélection progressive), compatibility checker, routes commerciales SEO

**Business Value**: 40 marques, 5745 modèles, 48918 motorisations, ~500K compatibilités produits → Search pièces par véhicule (core business requirement auto parts).
