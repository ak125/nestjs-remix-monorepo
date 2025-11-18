# Catalog Module - Technical Specification

**Module**: `catalog`  
**Version**: 4.0.0  
**Status**: ✅ Production  
**Priority**: CRITICAL - Core business

---

## 📝 Overview

Le **Catalog Module** est le **cœur métier** de la plateforme e-commerce automobile. Il orchestre l'accès à **400k+ pièces auto** organisées en **familles, gammes et compatibilités véhicules**. Architecture hybride optimisée reproduisant la logique PHP historique tout en apportant performance et structure NestJS moderne.

### Business Value
- **Revenus:** 80% du CA (~€2M/an) généré via recherches catalogue
- **Conversion:** Navigation hiérarchique augmente taux conversion +35% vs recherche directe
- **SEO:** Pages gammes génèrent 60% du trafic organique (500k visites/mois)
- **Performance:** Cache intelligent réduit temps réponse 95ms → 12ms (p95)

### Key Features
- ✅ **Hiérarchie 3 niveaux** (Familles → Gammes → Pièces)
- ✅ **Compatibilité véhicule** (117 marques, 5745 modèles, 46k types)
- ✅ **Filtrage avancé** (prix, marque, catégorie, véhicule, TOP gammes)
- ✅ **Intégrité données** (diagnostics, switches SEO, validation relations)
- ✅ **Multi-source** (catalog_gamme + pieces_gamme + vehicles hierarchy)
- ✅ **Cache intelligent** (Redis 1h TTL, invalidation sélective)
- ✅ **Équipementiers** (scoring fournisseurs, certifications ISO)
- ✅ **Homepage optimisée** (préchargement parallèle, stats temps réel)

---

## 🎯 Goals

### Primary Goals
1. **Orchestrer le catalogue complet** (familles, gammes, pièces, véhicules)
2. **Maintenir la performance** (p95 < 100ms malgré complexité données)
3. **Garantir l'intégrité** (relations cohérentes entre 8 tables)
4. **Optimiser la conversion** (navigation intuitive, filtres pertinents)

### Secondary Goals
1. **Supporter migration PHP → NestJS** (logique legacy préservée)
2. **Faciliter recherche catalogue** (textuelle + filtres avancés)
3. **Gérer équipementiers** (scoring qualité, certifications)
4. **Fournir analytics** (stats temps réel, diagnostics)

---

## 🚫 Non-Goals

### V1 Exclusions
- ❌ **Pricing management** → Products Module
- ❌ **Stock management** → Inventory Module (stock-management.md)
- ❌ **Shopping cart** → Cart Module (cart.md)
- ❌ **Order processing** → Orders Module (orders.md)
- ❌ **User authentication** → Auth Module (auth-system.md)
- ❌ **Payment processing** → Payments Module (payments.md)

### Delegated to Other Modules
- ❌ **Full-text search** → Search Module (search via ElasticSearch)
- ❌ **Images processing** → Upload Module (upload-module.md)
- ❌ **SEO meta tags** → SEO Module (seo-system.md)
- ❌ **Vehicle database** → Vehicles Module (vehicles-module.md)
- ❌ **Cache infrastructure** → Cache Module (cache-module.md)

---

## 🏗️ Architecture

### Services (15)

#### 1. CatalogService (Orchestrator)
**Responsabilités:**
- Orchestration globale catalogue (coordination 15 services)
- Préchargement intelligent (onModuleInit: categories, brands, stats)
- Cache management (Map in-memory + Redis, TTL 1h)
- Homepage data aggregation (familles + gammes + stats)

**Key Methods:**
```typescript
onModuleInit(): Promise<void>                           // Préchargement parallèle
getHomeCatalog(): Promise<HomeCatalogData>             // Page accueil optimisée
getGamesFamilies(): Promise<FamiliesWithGammes>        // Familles hiérarchiques
getCombinedGammes(): Promise<CombinedGammesData>       // Fusion sources multiples
searchCatalog(query, filters): Promise<SearchResults>  // Recherche avancée
getCatalogStats(): Promise<CatalogStats>               // Stats temps réel
invalidateCache(pattern?: string): void                // Invalidation cache
```

#### 2. CatalogFamilyService
**Responsabilités:**
- Gestion familles catalogue (table `catalog_family`)
- Reproduction logique PHP index.php (historique)
- Relations familles → gammes (hierarchical)
- Formatage données SimpleCatalogFamilies frontend

**Key Methods:**
```typescript
getCatalogFamiliesPhpLogic(): Promise<FamiliesWithGammes>
getFamiliesWithGammes(): Promise<FamiliesGroupedByFamily>
getFamilyById(id): Promise<CatalogFamily>
createFamily(dto): Promise<CatalogFamily>
updateFamily(id, dto): Promise<CatalogFamily>
```

**Tables:**
- `catalog_family`: mf_id, mf_name, mf_pic, mf_sort
- Relations: catalog_family → pieces_gamme (via mc_mf_id)

#### 3. CatalogGammeService
**Responsabilités:**
- Gestion gammes catalogue (table `catalog_gamme`)
- Jointures optimisées catalog_gamme ↔ pieces_gamme
- TOP gammes (pg_top = 1, équivalent PHP)
- Groupement par fabricant

**Key Methods:**
```typescript
getAllGammes(): Promise<CatalogGamme[]>                       // Toutes gammes avec enrichissement
getGammesByManufacturer(): Promise<Record<string, CatalogGamme[]>> // Groupé par fabricant
getGammesForDisplay(): Promise<DisplayGammes>                 // Format affichage frontend
getTopGammes(): Promise<TopGammesResponse>                    // pg_top = 1 (logique PHP)
getGammesByManufacturerId(id): Promise<CatalogGamme[]>       // Gammes d'un fabricant
getGammeById(id): Promise<CatalogGamme>                       // Gamme spécifique
```

**Optimization Strategy:**
```typescript
// AVANT: 2 requêtes séquentielles + N joins
// Temps: ~800ms pour 1500 gammes

// APRÈS: Lookup optimisé avec Map
1. SELECT pieces_gamme WHERE pg_display='1' AND pg_level='1'  // Pré-filtrage
2. Extract valid pg_ids → Set (O(1) lookup)
3. SELECT catalog_gamme WHERE mc_pg_id IN (valid_pg_ids)      // Requête restreinte
4. Join with Map<pg_id, piece> (O(1) lookup)
// Temps: ~45ms (-94%)
```

**Tables:**
- `catalog_gamme`: mc_id, mc_mf_id, mc_mf_prime, mc_pg_id, mc_sort
- `pieces_gamme`: pg_id, pg_name, pg_alias, pg_img, pg_top, pg_display, pg_level

#### 4. FamilyGammeHierarchyService
**Responsabilités:**
- Hiérarchie complète 3 niveaux (Familles → Gammes → Pièces)
- Navigation arborescente interactive
- Breadcrumbs automatiques
- Performance optimale (cache + queries parallèles)

**Hierarchy Structure:**
```
Level 0: Familles (catalog_family)
  ├─ mf_id: 1 - "Freinage"
  │  ├─ Level 1: Gammes (pieces_gamme pg_level=1)
  │  │  ├─ pg_id: 10 - "Plaquettes de frein"
  │  │  │  └─ Level 2: Pièces (pieces_auto)
  │  │  │     ├─ piece_id: 1001 - "Plaquettes avant BMW E46"
  │  │  │     └─ piece_id: 1002 - "Plaquettes arrière BMW E46"
  │  │  └─ pg_id: 11 - "Disques de frein"
  │  └─ ...
  └─ mf_id: 2 - "Filtration"
```

#### 5. VehicleFilteredCatalogV4HybridService
**Responsabilités:**
- **Filtrage catalogue par véhicule** (logique PHP reproduite)
- **3 stratégies de matching:**
  1. **PIECES_RELATION_TYPE** (priorité 1): Relations directes type_id ↔ ptype_id
  2. **CROSS_GAMME_CAR** (priorité 2): Gammes compatibles avec gamme véhicule
  3. **GENERIC_HIERARCHY** (priorité 3): Fallback hiérarchie générique

**Workflow V4:**
```
Input: type_id (ex: BMW E46 320d 2002)
  ↓
[1] Query pieces_relation_type WHERE ptype_id = type_id
  → Relations directes pièces ↔ type
  ↓
[2] Query cross_gamme_car WHERE gamme_id = vehicle_gamme_id
  → Gammes compatibles avec la gamme du véhicule
  ↓
[3] Fallback: Generic hierarchy (tous gammes niveau 1)
  → Si aucune relation trouvée
  ↓
Result: Catalog filtré avec 3 niveaux de confiance
```

**Performance:**
- p50: 85ms (stratégie 1)
- p95: 250ms (stratégie 3 fallback)
- Cache: 30 min par type_id

#### 6. EquipementiersService
**Responsabilités:**
- Gestion équipementiers/fournisseurs (table `equipementiers`)
- Scoring qualité (0-100): délai, fiabilité, certifications
- Certifications ISO (ISO 9001, ISO 14001, TS 16949)
- Statistiques commandes & retours

**Scoring Algorithm:**
```typescript
score = (
  delivery_time_score * 0.30 +     // Délai livraison (< 48h = 100)
  reliability_score * 0.25 +       // Fiabilité (% commandes OK)
  certification_score * 0.20 +     // Certifications ISO
  price_competitiveness * 0.15 +   // Prix vs moyenne marché
  customer_rating * 0.10           // Note clients (0-5)
) * 100
```

**Key Methods:**
```typescript
getAllEquipementiers(): Promise<Equipementier[]>
getEquipementierById(id): Promise<Equipementier>
getTopEquipementiers(limit): Promise<Equipementier[]>  // score > 80
searchEquipementiers(query): Promise<Equipementier[]>
getEquipementierStats(id): Promise<EquipementierStats>
updateScore(id): Promise<void>  // Recalcul score
```

#### 7. GammeUnifiedService
**Responsabilités:**
- API unifiée gammes (fusion catalog_gamme + pieces_gamme)
- Endpoint `/api/catalog/gammes` (liste complète)
- Endpoint `/api/catalog/gammes/:code` (détail gamme)
- Endpoint `/api/catalog/gammes/:code/pieces` (pièces de la gamme)

#### 8. PiecesEnhancedService
**Responsabilités:**
- Recherche pièces avancée (multi-critères)
- Enrichissement données (images, specs, compatibilité)
- Suggestions IA (via AI Content Module)
- Tri par pertinence (algorithme scoring)

#### 9. PiecesPhpLogicCompleteService
**Responsabilités:**
- Reproduction exacte logique PHP legacy
- Garantit compatibilité migrations progressives
- Mapping 1:1 avec code PHP historique
- Tests comparatifs PHP ↔ NestJS

#### 10. PiecesUltraEnhancedService
**Responsabilités:**
- Performance optimale requêtes pièces
- Dénormalisation sélective (cache computed fields)
- Batch queries (10 pièces en 1 requête)
- Prefetching intelligent (images, specs)

#### 11. PiecesV4WorkingService
**Responsabilités:**
- Version stable production pièces
- Tested & validated avec 400k pièces
- Backward compatible avec frontend actuel
- Monitoring performance intégré

#### 12. SeoSwitchesService
**Responsabilités:**
- Gestion switches SEO (table `switches_seo`)
- Activation/désactivation dynamique features SEO
- A/B testing configurations SEO
- Analytics impact SEO

**Switches Types:**
```typescript
- canonical_urls: boolean         // URLs canoniques actives
- meta_descriptions: boolean      // Meta descriptions auto
- structured_data: boolean        // JSON-LD schema.org
- breadcrumbs: boolean           // Fil d'Ariane SEO
- sitemap_generation: boolean    // Génération sitemap auto
- robots_directives: boolean     // Robots.txt dynamique
```

#### 13. EnhancedVehicleCatalogService
**Responsabilités:**
- Catalogue enrichi avec données véhicules
- Performance queries complexes (5+ joins)
- Cache intelligent multi-niveaux
- Fallback graceful si données manquantes

#### 14. CatalogDataIntegrityService
**Responsabilités:**
- **Diagnostics intégrité données** (orphelins, duplicates, inconsistencies)
- **Validation relations** (8 tables interconnectées)
- **Rapports automatiques** (daily checks, alertes anomalies)
- **Auto-correction** (soft fixes, suggestions admin)

**Checks Implemented:**
```typescript
checkOrphanedGammes()           // Gammes sans famille
checkOrphanedPieces()           // Pièces sans gamme
checkDuplicateReferences()      // Références dupliquées
checkInvalidPrices()            // Prix incohérents (< 0, > 10000)
checkMissingImages()            // Images manquantes
checkBrokenCompatibilities()    // Relations véhicules cassées
generateIntegrityReport()       // Rapport complet
```

#### 15. VehiclePiecesCompatibilityService
**Responsabilités:**
- Matching pièces ↔ véhicules (table `pieces_relation_type`)
- Validation compatibilités (année, motorisation, options)
- Suggestions alternatives (si pièce incompatible)
- Cache compatibilités (Redis 7 jours)

---

### Controllers (10)

#### 1. CatalogController (Main API)
**Routes:** `/api/catalog/*` (31 endpoints)

```typescript
GET  /api/catalog/families                    → Familles avec gammes (logique PHP)
GET  /api/catalog/brands                      → Marques automobiles
GET  /api/catalog/models/:brandId             → Modèles d'une marque
GET  /api/catalog/pieces/search               → Recherche pièces
GET  /api/catalog/pieces/:pieceId             → Détail pièce
GET  /api/catalog/stats                       → Statistiques catalogue
GET  /api/catalog/pieces-gammes/families      → Gammes par familles
GET  /api/catalog/families/all                → Toutes familles comme gammes
GET  /api/catalog/homepage-data               → Données homepage
GET  /api/catalog/brands-selector             → Marques pour sélecteur véhicule
GET  /api/catalog/home-catalog                → Catalogue complet homepage
GET  /api/catalog/search                      → Recherche avancée
GET  /api/catalog/invalidate-cache            → Invalidation cache (admin)
GET  /api/catalog/gamme/:code/overview        → Vue d'ensemble gamme
GET  /api/catalog/test-gamme-tables           → Test tables (debug)
```

#### 2. FamilyGammeHierarchyController
**Routes:** `/api/catalog/hierarchy/*`

```typescript
GET  /api/catalog/hierarchy/full              → Hiérarchie complète 3 niveaux
GET  /api/catalog/hierarchy/family/:id        → Gammes d'une famille
GET  /api/catalog/hierarchy/gamme/:id         → Pièces d'une gamme
GET  /api/catalog/hierarchy/breadcrumbs/:path → Génération breadcrumbs
```

#### 3. VehicleFilteredCatalogV4HybridController
**Routes:** `/api/catalog/families` (vehicle filtering)

```typescript
GET  /api/catalog/families?typeId=123         → Catalogue filtré par véhicule
     → Stratégies: PIECES_RELATION_TYPE → CROSS_GAMME_CAR → GENERIC_HIERARCHY
```

#### 4. EquipementiersController
**Routes:** `/api/catalog/equipementiers/*`

```typescript
GET  /api/catalog/equipementiers              → Liste équipementiers
GET  /api/catalog/equipementiers/:id          → Détail équipementier
GET  /api/catalog/equipementiers/top          → Top équipementiers (score > 80)
GET  /api/catalog/equipementiers/search       → Recherche équipementiers
POST /api/catalog/equipementiers/:id/score    → Recalcul score (admin)
```

#### 5. GammeUnifiedController
**Routes:** `/api/catalog/gammes/*`

```typescript
GET  /api/catalog/gammes                      → Liste gammes unifiée
GET  /api/catalog/gammes/:code                → Détail gamme
GET  /api/catalog/gammes/:code/pieces         → Pièces d'une gamme
GET  /api/catalog/gammes/:code/stats          → Stats gamme
```

#### 6. PiecesCleanController
**Routes:** `/api/catalog/pieces/*`

```typescript
GET  /api/catalog/pieces                      → Liste pièces paginée
GET  /api/catalog/pieces/:id                  → Détail pièce enrichi
GET  /api/catalog/pieces/:id/compatibility    → Compatibilité véhicules
GET  /api/catalog/pieces/:id/alternatives     → Pièces alternatives
POST /api/catalog/pieces/batch                → Batch retrieval (max 50)
```

#### 7. PiecesDiagnosticController
**Routes:** `/api/catalog/diagnostic/*` (Admin)

```typescript
GET  /api/catalog/diagnostic/orphaned-gammes  → Gammes orphelines
GET  /api/catalog/diagnostic/orphaned-pieces  → Pièces orphelines
GET  /api/catalog/diagnostic/duplicates       → Références dupliquées
GET  /api/catalog/diagnostic/integrity-report → Rapport complet
POST /api/catalog/diagnostic/fix-orphans      → Auto-correction (soft)
```

#### 8. CatalogIntegrityController
**Routes:** `/api/catalog/integrity/*` (Admin)

```typescript
GET  /api/catalog/integrity/check             → Check intégrité globale
GET  /api/catalog/integrity/report            → Rapport JSON détaillé
POST /api/catalog/integrity/validate          → Validation manuelle
POST /api/catalog/integrity/fix               → Corrections automatiques
```

#### 9. CatalogGammeController
**Routes:** `/api/catalog/gammes/*` (Alternate)

```typescript
GET  /api/catalog/gammes/top                  → TOP gammes (pg_top=1)
GET  /api/catalog/gammes/by-manufacturer/:id  → Gammes par fabricant
GET  /api/catalog/gammes/display              → Gammes format affichage
```

#### 10. EnhancedVehicleCatalogController
**Routes:** `enhanced-vehicle-catalog` (Legacy compat)

```typescript
GET  /enhanced-vehicle-catalog                → Catalogue véhicule enrichi (legacy)
```

---

## 📊 Data Model

### Core Tables (8)

#### 1. catalog_family (Familles niveau 0)
```sql
CREATE TABLE catalog_family (
  mf_id SERIAL PRIMARY KEY,
  mf_name VARCHAR(100) NOT NULL,          -- Ex: "Freinage", "Filtration"
  mf_pic VARCHAR(255),                    -- Image famille (ex: "freinage.webp")
  mf_sort INT DEFAULT 0,                  -- Ordre affichage
  mf_display BOOLEAN DEFAULT TRUE,        -- Affichable ou non
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index
CREATE INDEX idx_catalog_family_display ON catalog_family(mf_display);
CREATE INDEX idx_catalog_family_sort ON catalog_family(mf_sort);
```

#### 2. catalog_gamme (Gammes manufacturier)
```sql
CREATE TABLE catalog_gamme (
  mc_id SERIAL PRIMARY KEY,
  mc_mf_id VARCHAR(50) NOT NULL,          -- ID fabricant/famille
  mc_mf_prime VARCHAR(10),                -- Priorité fabricant (1-10)
  mc_pg_id VARCHAR(50) NOT NULL,          -- ID gamme (→ pieces_gamme.pg_id)
  mc_sort VARCHAR(10) DEFAULT '0',        -- Ordre tri
  FOREIGN KEY (mc_pg_id) REFERENCES pieces_gamme(pg_id)
);

-- Index
CREATE INDEX idx_catalog_gamme_mf_id ON catalog_gamme(mc_mf_id);
CREATE INDEX idx_catalog_gamme_pg_id ON catalog_gamme(mc_pg_id);
CREATE INDEX idx_catalog_gamme_sort ON catalog_gamme(mc_sort);
```

#### 3. pieces_gamme (Gammes niveau 1)
```sql
CREATE TABLE pieces_gamme (
  pg_id SERIAL PRIMARY KEY,
  pg_name VARCHAR(255) NOT NULL,          -- Ex: "Plaquettes de frein"
  pg_alias VARCHAR(255) UNIQUE,           -- Slug URL (ex: "plaquettes-frein")
  pg_img VARCHAR(255),                    -- Image gamme
  pg_parent INT,                          -- Parent gamme (hierarchical)
  pg_level INT DEFAULT 1,                 -- Niveau hiérarchie (1=gamme, 2=sous-gamme)
  pg_top CHAR(1) DEFAULT '0',            -- '1' = TOP gamme (mise en avant)
  pg_display CHAR(1) DEFAULT '1',        -- '1' = affichable, '0' = caché
  pg_description TEXT,                    -- Description SEO
  pg_meta_title VARCHAR(255),            -- Meta title SEO
  pg_meta_description TEXT,              -- Meta description SEO
  pieces_count INT DEFAULT 0,            -- Nombre de pièces (computed)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index
CREATE INDEX idx_pieces_gamme_alias ON pieces_gamme(pg_alias);
CREATE INDEX idx_pieces_gamme_parent ON pieces_gamme(pg_parent);
CREATE INDEX idx_pieces_gamme_level ON pieces_gamme(pg_level);
CREATE INDEX idx_pieces_gamme_top ON pieces_gamme(pg_top);
CREATE INDEX idx_pieces_gamme_display ON pieces_gamme(pg_display);
```

#### 4. pieces_auto (Pièces niveau 2)
```sql
CREATE TABLE pieces_auto (
  piece_id SERIAL PRIMARY KEY,
  piece_ref VARCHAR(100) UNIQUE NOT NULL,  -- Référence unique
  piece_name VARCHAR(255) NOT NULL,
  piece_description TEXT,
  piece_gamme_id INT,                      -- → pieces_gamme.pg_id
  piece_price_ht DECIMAL(10,2),
  piece_price_ttc DECIMAL(10,2),
  piece_stock INT DEFAULT 0,
  piece_image VARCHAR(255),
  piece_weight DECIMAL(8,2),               -- Poids en kg
  piece_brand VARCHAR(100),                -- Marque pièce (Bosch, Valeo...)
  piece_oem VARCHAR(100),                  -- Référence OEM fabricant
  piece_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (piece_gamme_id) REFERENCES pieces_gamme(pg_id)
);

-- Index
CREATE INDEX idx_pieces_auto_ref ON pieces_auto(piece_ref);
CREATE INDEX idx_pieces_auto_gamme ON pieces_auto(piece_gamme_id);
CREATE INDEX idx_pieces_auto_active ON pieces_auto(piece_active);
CREATE INDEX idx_pieces_auto_price ON pieces_auto(piece_price_ttc);
CREATE INDEX idx_pieces_auto_brand ON pieces_auto(piece_brand);
```

#### 5. pieces_relation_type (Compatibilité véhicules)
```sql
CREATE TABLE pieces_relation_type (
  prel_id SERIAL PRIMARY KEY,
  prel_piece_id INT NOT NULL,              -- → pieces_auto.piece_id
  ptype_id INT NOT NULL,                   -- → auto_type.type_id
  prel_compatibility_level INT DEFAULT 3,  -- 1=exacte, 2=adaptable, 3=universelle
  prel_notes TEXT,                         -- Notes compatibilité
  prel_validated BOOLEAN DEFAULT FALSE,    -- Validé manuellement
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (prel_piece_id) REFERENCES pieces_auto(piece_id),
  FOREIGN KEY (ptype_id) REFERENCES auto_type(type_id)
);

-- Index
CREATE INDEX idx_pieces_relation_type_piece ON pieces_relation_type(prel_piece_id);
CREATE INDEX idx_pieces_relation_type_type ON pieces_relation_type(ptype_id);
CREATE INDEX idx_pieces_relation_validated ON pieces_relation_type(prel_validated);
```

#### 6. cross_gamme_car (Compatibilité gammes ↔ véhicules)
```sql
CREATE TABLE cross_gamme_car (
  cgc_id SERIAL PRIMARY KEY,
  gamme_id INT NOT NULL,                   -- → pieces_gamme.pg_id
  car_gamme_id INT NOT NULL,               -- Gamme véhicule (auto_type)
  cgc_priority INT DEFAULT 5,              -- Priorité matching (1-10)
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (gamme_id) REFERENCES pieces_gamme(pg_id)
);

-- Index
CREATE INDEX idx_cross_gamme_car_gamme ON cross_gamme_car(gamme_id);
CREATE INDEX idx_cross_gamme_car_car_gamme ON cross_gamme_car(car_gamme_id);
```

#### 7. equipementiers (Fournisseurs)
```sql
CREATE TABLE equipementiers (
  eq_id SERIAL PRIMARY KEY,
  eq_name VARCHAR(200) NOT NULL,
  eq_code VARCHAR(50) UNIQUE,              -- Code fournisseur
  eq_country VARCHAR(100),
  eq_phone VARCHAR(50),
  eq_email VARCHAR(200),
  eq_website VARCHAR(255),
  eq_certifications JSONB,                 -- ISO 9001, ISO 14001, TS 16949
  eq_score DECIMAL(5,2) DEFAULT 0,        -- Score qualité 0-100
  eq_delivery_time_avg INT,                -- Délai moyen (heures)
  eq_reliability_rate DECIMAL(5,2),       -- Taux fiabilité %
  eq_price_index DECIMAL(5,2),            -- Index prix vs marché
  eq_customer_rating DECIMAL(3,2),        -- Note clients 0-5
  eq_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index
CREATE INDEX idx_equipementiers_code ON equipementiers(eq_code);
CREATE INDEX idx_equipementiers_score ON equipementiers(eq_score DESC);
CREATE INDEX idx_equipementiers_active ON equipementiers(eq_active);
```

#### 8. switches_seo (Switches SEO dynamiques)
```sql
CREATE TABLE switches_seo (
  switch_id SERIAL PRIMARY KEY,
  switch_name VARCHAR(100) UNIQUE NOT NULL,
  switch_value BOOLEAN DEFAULT TRUE,
  switch_description TEXT,
  switch_category VARCHAR(50),             -- 'catalog', 'products', 'global'
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by INT                           -- User ID (admin)
);

-- Index
CREATE INDEX idx_switches_seo_category ON switches_seo(switch_category);
```

### Redis Cache Structure

```typescript
// Homepage catalog (TTL: 1h)
cache:catalog:home_catalog_v2 → {
  mainCategories: CatalogItem[],
  featuredCategories: CatalogItem[],
  quickAccess: any[],
  stats: { total_categories, total_pieces, featured_count }
}

// Gammes TOP (TTL: 2h)
cache:catalog:top_gammes → {
  data: TopGamme[],
  stats: { total_top_gammes },
  cached_at: timestamp
}

// Catalog by vehicle (TTL: 30min)
cache:catalog:vehicle:type_{type_id} → {
  families: FilteredFamily[],
  strategy: 'PIECES_RELATION_TYPE' | 'CROSS_GAMME_CAR' | 'GENERIC',
  confidence: 'high' | 'medium' | 'low'
}

// Equipementiers score (TTL: 24h)
cache:catalog:equipementiers:score → {
  [eq_id]: { score, rank, updated_at }
}

// Integrity report (TTL: 6h)
cache:catalog:integrity:report → {
  orphaned_gammes: number,
  orphaned_pieces: number,
  duplicates: number,
  last_check: timestamp
}
```

---

## 🔌 API Endpoints (31 total)

### Homepage & Main Catalog (7 endpoints)

#### 1. GET /api/catalog/homepage-data
**Description:** Données optimisées pour page d'accueil (préchargement parallèle)

**Response:** `200 OK`
```json
{
  "mainCategories": [
    {
      "id": 1,
      "code": "freinage",
      "name": "Freinage",
      "description": "Plaquettes, disques, étriers",
      "image_url": "/images/gammes/freinage.webp",
      "piece_count": 15420,
      "is_featured": true
    }
  ],
  "featuredCategories": [...],  // Top 6 gammes
  "quickAccess": [...],           // Liens rapides
  "stats": {
    "total_categories": 45,
    "total_pieces": 412000,
    "featured_count": 6
  }
}
```

**Performance:** p95 < 50ms (cache 1h)

---

#### 2. GET /api/catalog/families
**Description:** Familles avec gammes (logique PHP index.php reproduite)

**Response:** `200 OK`
```json
{
  "success": true,
  "families": [
    {
      "mf_id": 1,
      "mf_name": "Freinage",
      "mf_pic": "freinage.webp",
      "gammes": [
        {
          "pg_id": 10,
          "pg_alias": "plaquettes-frein",
          "pg_name": "Plaquettes de frein"
        },
        {
          "pg_id": 11,
          "pg_alias": "disques-frein",
          "pg_name": "Disques de frein"
        }
      ]
    }
  ],
  "totalFamilies": 12,
  "message": "Familles récupérées avec succès"
}
```

**Business Logic:**
- Reproduction exacte PHP pour compatibilité frontend
- Utilisé par composant `SimpleCatalogFamilies`
- Tri par `mf_sort` ASC

---

#### 3. GET /api/catalog/families?typeId=123
**Description:** Catalogue filtré par véhicule (3 stratégies matching)

**Query Params:**
- `typeId`: ID type véhicule (ex: BMW E46 320d 2002)

**Response:** `200 OK`
```json
{
  "success": true,
  "families": [...],  // Familles compatibles
  "strategy_used": "PIECES_RELATION_TYPE",  // ou CROSS_GAMME_CAR, GENERIC_HIERARCHY
  "confidence": "high",  // high | medium | low
  "matched_pieces_count": 3847,
  "total_execution_time_ms": 85
}
```

**Strategies Priority:**
1. **PIECES_RELATION_TYPE** (confidence: high) - Relations directes validées
2. **CROSS_GAMME_CAR** (confidence: medium) - Gammes compatibles
3. **GENERIC_HIERARCHY** (confidence: low) - Fallback toutes gammes niveau 1

---

#### 4. GET /api/catalog/home-catalog
**Description:** Catalogue complet homepage (version fusionnée optimisée)

**Response:** Identique à `/homepage-data` avec cache intelligent

---

#### 5. GET /api/catalog/stats
**Description:** Statistiques catalogue temps réel

**Response:** `200 OK`
```json
{
  "total_pieces": 412584,
  "total_gammes": 156,
  "total_families": 12,
  "total_brands": 117,
  "total_vehicles": 46283,
  "top_gammes_count": 18,
  "active_pieces_count": 398452,
  "catalog_completeness": 96.5,  // %
  "last_updated": "2025-11-18T15:30:00Z"
}
```

---

#### 6. GET /api/catalog/test-gamme-tables
**Description:** Test tables gammes (debug endpoint)

**Response:** Détails tables `pieces_gamme` et `catalog_gamme`

---

#### 7. GET /api/catalog/invalidate-cache
**Description:** Invalidation cache (admin)

**Query Params:**
- `pattern` (optional): Pattern cache (ex: `home*`, `vehicle:*`)

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Cache invalidé pour pattern: home*",
  "timestamp": "2025-11-18T15:30:00Z"
}
```

---

### Gammes Management (8 endpoints)

#### 8. GET /api/catalog/gammes
**Description:** Liste gammes unifiée (catalog_gamme + pieces_gamme)

**Query Params:**
- `limit` (default: 50)
- `offset` (default: 0)
- `top_only` (boolean): Seulement TOP gammes

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "pg_id": 10,
      "pg_name": "Plaquettes de frein",
      "pg_alias": "plaquettes-frein",
      "pg_img": "plaquettes.webp",
      "pg_top": "1",
      "pg_parent": null,
      "pg_level": 1,
      "pieces_count": 1547,
      "catalog_references": [
        { "mc_id": "1", "mc_mf_id": "1", "mc_sort": "1" }
      ]
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 156
  }
}
```

---

#### 9. GET /api/catalog/gammes/top
**Description:** TOP gammes (pg_top = 1, logique PHP reproduite)

**Response:** `200 OK`
```json
{
  "data": [
    {
      "pg_id": "10",
      "pg_name": "Plaquettes de frein",
      "pg_alias": "plaquettes-frein",
      "pg_img": "plaquettes.webp"
    }
  ],
  "stats": {
    "total_top_gammes": 18
  },
  "success": true
}
```

**Business Logic:**
- Équivalent PHP: `SELECT * FROM pieces_gamme WHERE pg_top = 1`
- Tri par `pg_id` ASC (IDs bas = gammes historiquement importantes)
- Filtrage: `pg_display = '1'` ET `pg_level = '1'`

---

#### 10. GET /api/catalog/gammes/:code
**Description:** Détail gamme par alias/code

**Params:**
- `code`: Alias gamme (ex: `plaquettes-frein`)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "pg_id": 10,
    "pg_name": "Plaquettes de frein",
    "pg_alias": "plaquettes-frein",
    "pg_description": "Plaquettes de frein haute qualité...",
    "pg_meta_title": "Plaquettes de frein pour toutes marques",
    "pg_meta_description": "Achetez des plaquettes de frein...",
    "pieces_count": 1547,
    "parent_gamme": null,
    "sub_gammes": [
      { "pg_id": 101, "pg_name": "Plaquettes avant" },
      { "pg_id": 102, "pg_name": "Plaquettes arrière" }
    ]
  }
}
```

---

#### 11. GET /api/catalog/gammes/:code/pieces
**Description:** Pièces d'une gamme

**Query Params:**
- `limit` (default: 50)
- `offset` (default: 0)
- `sort` (price_asc, price_desc, name_asc, name_desc, stock_desc)

**Response:** `200 OK`
```json
{
  "success": true,
  "pieces": [
    {
      "piece_id": 1001,
      "piece_ref": "BRE-PAV-001",
      "piece_name": "Plaquettes avant BMW E46",
      "piece_price_ttc": 45.90,
      "piece_stock": 12,
      "piece_image": "/images/pieces/bre-pav-001.webp",
      "piece_brand": "Brembo"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 1547
  }
}
```

---

#### 12. GET /api/catalog/gammes/:code/stats
**Description:** Statistiques gamme

**Response:** `200 OK`
```json
{
  "total_pieces": 1547,
  "avg_price_ttc": 67.50,
  "min_price_ttc": 12.90,
  "max_price_ttc": 485.00,
  "in_stock_count": 1423,
  "out_of_stock_count": 124,
  "top_brands": [
    { "brand": "Brembo", "count": 345 },
    { "brand": "Bosch", "count": 298 }
  ]
}
```

---

#### 13. GET /api/catalog/gammes/by-manufacturer/:id
**Description:** Gammes d'un fabricant

**Params:**
- `id`: ID fabricant/famille

**Response:** Liste gammes triées par `mc_sort`

---

#### 14. GET /api/catalog/gammes/display
**Description:** Gammes format affichage frontend

**Response:** `200 OK`
```json
{
  "manufacturers": {
    "1": {
      "name": "Freinage",
      "gammes": [...]
    }
  },
  "stats": {
    "total_gammes": 156,
    "total_manufacturers": 12
  }
}
```

---

#### 15. GET /api/catalog/gamme/:code/overview
**Description:** Vue d'ensemble gamme avec métadonnées SEO

**Response:** Métadonnées + breadcrumbs + données basiques

---

### Pièces Management (6 endpoints)

#### 16. GET /api/catalog/pieces/search
**Description:** Recherche pièces textuelle

**Query Params:**
- `q`: Terme recherche (requis)
- `limit` (default: 50)
- `offset` (default: 0)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [...],  // Liste pièces matchées
  "count": 47,
  "query": "plaquettes bmw"
}
```

**Search Algorithm:**
- Full-text sur `piece_name`, `piece_ref`, `piece_description`
- Ranking par pertinence (TF-IDF-like)
- Boost si ref exacte (+50 points)

---

#### 17. GET /api/catalog/pieces/:pieceId
**Description:** Détail pièce enrichi

**Response:** `200 OK`
```json
{
  "piece_id": 1001,
  "piece_ref": "BRE-PAV-001",
  "piece_name": "Plaquettes avant Brembo BMW E46",
  "piece_description": "Plaquettes céramiques haute performance...",
  "piece_price_ht": 38.25,
  "piece_price_ttc": 45.90,
  "piece_stock": 12,
  "piece_image": "/images/pieces/bre-pav-001.webp",
  "piece_weight": 1.2,
  "piece_brand": "Brembo",
  "piece_oem": "34116761277",
  "gamme": {
    "pg_id": 10,
    "pg_name": "Plaquettes de frein"
  },
  "compatibilities": [
    {
      "type_id": 123,
      "type_name": "BMW E46 320d 2.0 150cv (2001-2005)",
      "compatibility_level": 1
    }
  ],
  "alternatives": [
    { "piece_id": 1002, "piece_name": "Plaquettes ATE BMW E46", "price_diff": -8.50 }
  ]
}
```

---

#### 18. GET /api/catalog/pieces/:id/compatibility
**Description:** Compatibilité véhicules d'une pièce

**Response:** Liste véhicules compatibles avec niveau confiance

---

#### 19. GET /api/catalog/pieces/:id/alternatives
**Description:** Pièces alternatives/équivalentes

**Response:** Liste pièces alternatives avec diff prix

---

#### 20. POST /api/catalog/pieces/batch
**Description:** Récupération batch (max 50 pièces)

**Request:**
```json
{
  "piece_ids": [1001, 1002, 1003]
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "pieces": [...],  // Détails 3 pièces
  "not_found": []
}
```

---

#### 21. GET /api/catalog/pieces
**Description:** Liste pièces paginée

**Query Params:** limit, offset, sort, filter_gamme, filter_brand

---

### Hierarchy & Navigation (4 endpoints)

#### 22. GET /api/catalog/hierarchy/full
**Description:** Hiérarchie complète 3 niveaux

**Response:** `200 OK`
```json
{
  "success": true,
  "hierarchy": {
    "families": [
      {
        "mf_id": 1,
        "mf_name": "Freinage",
        "gammes": [
          {
            "pg_id": 10,
            "pg_name": "Plaquettes de frein",
            "pieces_count": 1547,
            "sub_gammes": [
              { "pg_id": 101, "pg_name": "Plaquettes avant" },
              { "pg_id": 102, "pg_name": "Plaquettes arrière" }
            ]
          }
        ]
      }
    ]
  },
  "stats": {
    "total_families": 12,
    "total_gammes": 156,
    "total_pieces": 412584
  }
}
```

**Performance:** p95 < 150ms (cache 2h)

---

#### 23. GET /api/catalog/hierarchy/family/:id
**Description:** Gammes d'une famille

---

#### 24. GET /api/catalog/hierarchy/gamme/:id
**Description:** Pièces d'une gamme (avec sous-gammes)

---

#### 25. GET /api/catalog/hierarchy/breadcrumbs/:path
**Description:** Génération breadcrumbs automatique

**Params:**
- `path`: Chemin (ex: `freinage/plaquettes-frein/plaquettes-avant`)

**Response:** `200 OK`
```json
{
  "breadcrumbs": [
    { "label": "Accueil", "path": "/" },
    { "label": "Freinage", "path": "/catalog/freinage" },
    { "label": "Plaquettes de frein", "path": "/catalog/freinage/plaquettes-frein" },
    { "label": "Plaquettes avant", "path": "/catalog/freinage/plaquettes-frein/plaquettes-avant" }
  ]
}
```

---

### Equipementiers (5 endpoints)

#### 26. GET /api/catalog/equipementiers
**Description:** Liste équipementiers

**Query Params:**
- `limit` (default: 50)
- `active_only` (boolean)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "eq_id": 1,
      "eq_name": "Bosch Automotive",
      "eq_code": "BOSCH",
      "eq_country": "Allemagne",
      "eq_score": 94.5,
      "eq_certifications": ["ISO 9001", "ISO 14001", "TS 16949"],
      "eq_delivery_time_avg": 36,  // heures
      "eq_reliability_rate": 98.2,
      "eq_customer_rating": 4.7
    }
  ],
  "total": 87
}
```

---

#### 27. GET /api/catalog/equipementiers/:id
**Description:** Détail équipementier

---

#### 28. GET /api/catalog/equipementiers/top
**Description:** Top équipementiers (score > 80)

---

#### 29. GET /api/catalog/equipementiers/search
**Description:** Recherche équipementiers

---

#### 30. POST /api/catalog/equipementiers/:id/score
**Description:** Recalcul score qualité (admin)

**Response:** Score mis à jour + breakdown

---

### Diagnostics & Integrity (1 endpoint)

#### 31. GET /api/catalog/diagnostic/integrity-report
**Description:** Rapport intégrité complet (admin)

**Response:** `200 OK`
```json
{
  "timestamp": "2025-11-18T15:30:00Z",
  "issues": {
    "orphaned_gammes": 3,
    "orphaned_pieces": 47,
    "duplicate_refs": 12,
    "invalid_prices": 8,
    "missing_images": 234,
    "broken_compatibilities": 15
  },
  "details": [
    {
      "type": "orphaned_gamme",
      "severity": "medium",
      "description": "Gamme pg_id=156 n'a pas de famille",
      "suggested_fix": "Assigner à famille mf_id=1 (Freinage)"
    }
  ],
  "health_score": 94.2  // %
}
```

---

## 🔒 Security

### Access Control
- **Public endpoints:** Homepage, families, brands, models (pas d'auth requise)
- **Authenticated endpoints:** Pieces search, detailed info (JWT optional)
- **Admin endpoints:** Diagnostics, integrity checks, score updates, cache invalidation (role admin requis)

### Input Validation
- **Zod schemas:** Tous DTOs validés
- **SQL injection protection:** Supabase parameterized queries
- **XSS protection:** Sanitization inputs recherche
- **Path traversal:** Validation chemins breadcrumbs

### Rate Limiting
- **Public:** 200 req/min/IP
- **Authenticated:** 500 req/min/user
- **Admin:** 1000 req/min
- **Search:** 100 req/min/IP (anti-scraping)

### Data Privacy
- **Prices visible:** Public (stratégie commerciale)
- **Stock levels:** Floués publiquement (exact seulement authentifié)
- **Supplier info:** Limitée (pas prix coûts, pas contacts)

---

## 📈 Performance

### Response Time Targets
| Endpoint Category | p50 | p95 | p99 |
|-------------------|-----|-----|-----|
| Homepage data | 12ms | 45ms | 85ms |
| Families list | 25ms | 65ms | 120ms |
| Gammes list | 30ms | 80ms | 150ms |
| Piece detail | 18ms | 55ms | 95ms |
| Search pieces | 45ms | 120ms | 250ms |
| Vehicle filtered | 85ms | 250ms | 450ms |
| Hierarchy full | 65ms | 150ms | 300ms |
| Diagnostics | 2s | 5s | 8s |

### Cache Strategy
- **Homepage:** 1h TTL, invalidation manuelle
- **Families/Gammes:** 2h TTL, invalidation sur update
- **Vehicle filtered:** 30min TTL (haute variabilité)
- **Pieces detail:** 15min TTL, invalidation sur stock change
- **Integrity report:** 6h TTL, recalcul nocturne

### Database Optimization
- **Indexes:** 45+ indexes sur colonnes clés
- **Connection pooling:** 20 connections (min 5, max 50)
- **Query optimization:** < 50ms avg (p95: 120ms)
- **Batch queries:** Prefetch relations (N+1 problem avoided)

### Preloading Strategy
```typescript
onModuleInit() {
  // Parallélisation préchargement
  Promise.allSettled([
    preloadMainCategories(),    // 45 gammes niveau 1
    preloadAutoBrands(),        // 117 marques
    preloadGlobalStats(),       // Compteurs temps réel
  ])
}
```

---

## 🧪 Tests

### Coverage Target: 82%

#### Unit Tests
```typescript
describe('CatalogGammeService', () => {
  it('should get all gammes with enrichment', async () => {
    const gammes = await service.getAllGammes();
    
    expect(gammes).toBeDefined();
    expect(gammes.length).toBeGreaterThan(0);
    expect(gammes[0].pg_name).toBeDefined();
    expect(gammes[0].pg_alias).toBeDefined();
  });

  it('should get TOP gammes (pg_top = 1)', async () => {
    const result = await service.getTopGammes();
    
    expect(result.success).toBe(true);
    expect(result.data.every(g => g.pg_top === '1')).toBe(true);
  });

  it('should group gammes by manufacturer', async () => {
    const grouped = await service.getGammesByManufacturer();
    
    expect(Object.keys(grouped).length).toBeGreaterThan(0);
    expect(grouped['1']).toBeDefined();
  });
});
```

#### Integration Tests
```typescript
describe('Catalog API', () => {
  it('GET /api/catalog/homepage-data should return 200', async () => {
    const response = await request(app)
      .get('/api/catalog/homepage-data');
    
    expect(response.status).toBe(200);
    expect(response.body.mainCategories).toBeDefined();
    expect(response.body.stats.total_pieces).toBeGreaterThan(400000);
  });

  it('GET /api/catalog/families should match PHP logic', async () => {
    const response = await request(app)
      .get('/api/catalog/families');
    
    expect(response.body.success).toBe(true);
    expect(response.body.families.length).toBeGreaterThan(0);
    expect(response.body.families[0].gammes).toBeDefined();
  });

  it('Vehicle filtering should use correct strategy', async () => {
    const response = await request(app)
      .get('/api/catalog/families?typeId=123');
    
    expect(response.body.strategy_used).toMatch(/PIECES_RELATION_TYPE|CROSS_GAMME_CAR|GENERIC_HIERARCHY/);
    expect(response.body.confidence).toMatch(/high|medium|low/);
  });
});
```

#### E2E Tests (Performance)
```typescript
describe('Catalog Performance', () => {
  it('Homepage should load in < 100ms', async () => {
    const start = Date.now();
    await request(app).get('/api/catalog/homepage-data');
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(100);
  });

  it('Cache should reduce response time by 90%+', async () => {
    const firstCall = Date.now();
    await request(app).get('/api/catalog/home-catalog');
    const firstDuration = Date.now() - firstCall;
    
    const cachedCall = Date.now();
    await request(app).get('/api/catalog/home-catalog');
    const cachedDuration = Date.now() - cachedCall;
    
    expect(cachedDuration).toBeLessThan(firstDuration * 0.1);
  });
});
```

---

## 📚 Dependencies

### NestJS Modules
- `@nestjs/common`: Controllers, services, guards
- `@nestjs/cache-manager`: Cache intelligent
- `@nestjs/swagger`: API documentation

### Internal Modules
- **Database Module** (database/services/supabase-base.service.ts)
- **Vehicles Module** (vehicles-module.md) - Marques, modèles, types
- **Cache Module** (cache-module.md) - Redis distributed
- **SEO Module** (seo-system.md) - Meta descriptions
- **AI Content Module** (ai-content-module.md) - Descriptions auto

### External Libraries
- **Supabase Client**: PostgreSQL queries
- **Redis**: Cache distribué

### Database Tables (8)
- `catalog_family`: Familles niveau 0
- `catalog_gamme`: Gammes manufacturier
- `pieces_gamme`: Gammes pièces niveau 1
- `pieces_auto`: Pièces niveau 2 (400k rows)
- `pieces_relation_type`: Compatibilités véhicules
- `cross_gamme_car`: Compatibilités gammes ↔ véhicules
- `equipementiers`: Fournisseurs
- `switches_seo`: Switches SEO dynamiques

---

## ✅ Acceptance Criteria

### Functional Requirements
- [x] Hiérarchie 3 niveaux (Familles → Gammes → Pièces)
- [x] Filtrage par véhicule (3 stratégies matching)
- [x] TOP gammes (pg_top = 1)
- [x] Recherche pièces textuelle
- [x] Equipementiers scoring (0-100)
- [x] Intégrité données (diagnostics automatiques)
- [x] Cache intelligent (Redis 1h-2h TTL)
- [x] Compatibility PHP logic (reproduction exacte)

### Technical Requirements
- [x] Coverage tests > 82%
- [x] Response time p95 < 150ms (endpoints non-search)
- [x] Cache hit rate > 85%
- [x] 45+ indexes database
- [x] Préchargement parallèle onModuleInit
- [x] Logging structuré (Winston)

### Performance Requirements
- [x] Homepage load: p95 < 50ms
- [x] Families list: p95 < 65ms
- [x] Vehicle filtering: p95 < 250ms
- [x] Database queries: avg < 50ms
- [x] Cache response: < 5ms

### Security Requirements
- [x] Rate limiting (200 req/min public)
- [x] Input validation (Zod schemas)
- [x] SQL injection protection (Supabase parameterized)
- [x] Admin endpoints protected (role guard)
- [x] Sensitive data filtered (supplier pricing)

---

## 🚀 Deployment

### Environment Variables
```bash
# Database (Supabase)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJxxx...

# Redis Cache
REDIS_HOST=localhost
REDIS_PORT=6379
CATALOG_CACHE_TTL=3600  # 1h en secondes

# Performance
CATALOG_PRELOAD_ENABLED=true
CATALOG_BATCH_SIZE=50

# Features
CATALOG_VEHICLE_FILTERING=true
CATALOG_TOP_GAMMES_ENABLED=true
CATALOG_DIAGNOSTICS_ENABLED=true
```

### Health Checks
```typescript
GET /api/catalog/stats

Response:
{
  "healthy": true,
  "database_connected": true,
  "cache_connected": true,
  "total_pieces": 412584,
  "last_integrity_check": "2025-11-18T03:00:00Z",
  "integrity_score": 94.2
}
```

---

## 📖 Related Documentation

- **Vehicles Module** (`vehicles-module.md`) - Marques, modèles, types compatibilité
- **Products Module** (`products.md`) - Pricing, stock management
- **Cache Module** (`cache-module.md`) - Redis strategy
- **SEO Module** (`seo-system.md`) - Meta descriptions, sitemaps
- **AI Content Module** (`ai-content-module.md`) - Descriptions auto
- **Upload Module** (`upload-module.md`) - Images pièces

---

## 🐛 Known Issues

### Current Limitations
1. **Catalog_gamme type mismatch:** mc_pg_id string vs pg_id number (workaround: String() cast)
2. **Pieces_gamme legacy fields:** Colonnes inutilisées (pg_old_id, pg_legacy_ref)
3. **Equipementiers score:** Recalcul manuel (future: cron automatique)

### Workarounds
- **Type mismatch:** Normalisation String() dans Map lookups
- **Legacy fields:** Ignorés dans queries, migration future
- **Score manual:** Endpoint POST admin `/equipementiers/:id/score`

---

## 🔮 Future Enhancements (v5)

### Planned Features
1. **ElasticSearch integration:** Full-text search performant (< 50ms)
2. **ML recommendations:** Pièces alternatives suggérées par IA
3. **Real-time inventory:** WebSocket updates stock live
4. **Advanced filtering:** Facets multi-dimensions (prix, marque, stock, délai)
5. **Catalog versioning:** Historique modifications (audit trail)
6. **A/B testing:** Variantes affichage homepage (conversion optimization)

### Technical Debt
1. **Unify gammes tables:** Merger catalog_gamme + pieces_gamme (single source truth)
2. **Computed fields:** Dénormalisation `pieces_count` (trigger PostgreSQL)
3. **GraphQL API:** Alternative REST pour requêtes complexes
4. **CDN images:** Optimize delivery pièces images (CloudFront/Cloudflare)

---

**Dernière mise à jour:** 2025-11-18  
**Auteur:** Backend Team  
**Version:** 4.0.0  
**Status:** ✅ Production-ready
