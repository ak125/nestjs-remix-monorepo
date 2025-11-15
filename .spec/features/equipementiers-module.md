# Feature Spec: Équipementiers Module (Parts Brands)

**Phase**: 3 Extended (Feature 12/18)  
**Coverage**: +1 module → 74% (24/37 modules)  
**Endpoints**: 3 total (list, search, get by id)  
**Architecture**: EquipementiersService + EquipementiersController  
**Lines**: ~289 (backend) + ~300 (frontend)

---

## 1. Objectif Métier

Module de gestion des **équipementiers** (fabricants de pièces automobiles). Permet affichage marques pièces (Bosch, Valeo, Mann-Filter...), filtrage par qualité OES/Aftermarket, tri par popularité.

**Business Value**:
- 🏭 Catalogue équipementiers (Bosch, Valeo, Mann-Filter, Sachs, Febi, TRW...)
- ⭐ Qualité pièces (OES = Original Equipment Supplier, Aftermarket, 1-6 stars)
- 🎯 Filtrage marques par niveau qualité (pm_oes: O/OES = premium, A = aftermarket)
- 📊 Tri intelligent (pm_top → pm_sort → alphabétique)
- �� Recherche équipementiers par nom

**Distinction vs Vehicles**:
- **Vehicles** (`auto_marque`) = Constructeurs automobiles (Peugeot, Renault, BMW...)
- **Équipementiers** (`pieces_marque`) = Fabricants pièces (Bosch, Valeo, Mann...)
- **⚠️ Manufacturers** (`auto_marque`) = DOUBLON de Vehicles → À SUPPRIMER

---

## 2. Endpoints (3 Total)

### 2.1 GET /api/catalog/equipementiers

**Description**: Liste équipementiers actifs avec tri prioritaire  
**Controller**: `EquipementiersController.getEquipementiers()`  
**Service**: `EquipementiersService.getEquipementiers()`

**Query Params**: Aucun (liste complète)

**Business Logic**:
1. Filtrage: `pm_display = '1'` (actifs uniquement)
2. Tri prioritaire: `pm_top DESC` (top en premier)
3. Tri secondaire: `pm_sort ASC` (ordre manuel)
4. Tri tertiaire: `pm_name ASC` (alphabétique)
5. Déduplication: DISTINCT `pm_name` (éviter doublons)

**Response Example**:
```json
{
  "success": true,
  "data": [
    {
      "pm_id": "123",
      "pm_name": "BOSCH"
    },
    {
      "pm_id": "456",
      "pm_name": "VALEO"
    }
  ],
  "stats": {
    "total_equipementiers": 89
  },
  "message": "89 équipementiers récupérés avec succès"
}
```

---

### 2.2 GET /api/catalog/equipementiers/search?q={term}

**Description**: Recherche équipementiers par nom (ILIKE)  
**Controller**: `EquipementiersController.searchEquipementiers()`  
**Service**: `EquipementiersService.searchEquipementiers()`

**Query Params**:
- `q` (string, **required**): Terme recherche

**Business Logic**:
- ILIKE `%{term}%` sur `pm_name`
- Tri alphabétique `pm_name ASC`
- Pas de filtrage `pm_display` (recherche globale)

**Response Example**:
```json
{
  "success": true,
  "data": [
    {
      "pm_id": "123",
      "pm_name": "BOSCH"
    },
    {
      "pm_id": "789",
      "pm_name": "ROBERT BOSCH"
    }
  ],
  "stats": {
    "results_count": 2
  },
  "search_term": "bosch",
  "message": "2 équipementiers trouvés pour \"bosch\""
}
```

---

### 2.3 GET /api/catalog/equipementiers/:id

**Description**: Détails équipementier par ID  
**Controller**: `EquipementiersController.getEquipementierById()`  
**Service**: `EquipementiersService.getEquipementierById()`

**Path Params**:
- `id` (string): pm_id équipementier

**Response Example** (trouvé):
```json
{
  "success": true,
  "data": {
    "pm_id": "123",
    "pm_name": "BOSCH"
  },
  "message": "Équipementier BOSCH récupéré avec succès"
}
```

**Response Example** (non trouvé):
```json
{
  "success": false,
  "data": null,
  "message": "Équipementier 999 non trouvé"
}
```

---

## 3. Architecture Service

### 3.1 EquipementiersService - 151 lignes

**Extends**: `SupabaseBaseService`  
**Location**: `/backend/src/modules/catalog/services/equipementiers.service.ts`

**Méthodes Clés**:

#### `getEquipementiers()`
```typescript
async getEquipementiers(): Promise<{
  data: Equipementier[];
  stats: { total_equipementiers: number };
  success: boolean;
}>
```

**Logique**:
1. Query Supabase avec filtrage `pm_display = '1'`
2. Tri multi-niveaux (pm_top → pm_sort → pm_name)
3. Déduplication DISTINCT par `pm_name`
4. Filtrage noms vides
5. Return avec stats

**Code Simplifié**:
```typescript
const { data, error } = await this.supabase
  .from('pieces_marque')
  .select('pm_id, pm_name, pm_top, pm_sort')
  .eq('pm_display', '1')
  .order('pm_top', { ascending: false })
  .order('pm_sort', { ascending: true })
  .order('pm_name', { ascending: true });

// Déduplication
const uniqueEquipementiers = (data || [])
  .filter(eq => eq.pm_name && eq.pm_name.trim() !== '')
  .reduce((acc, current) => {
    if (!acc.find(item => item.pm_name === current.pm_name)) {
      acc.push({ pm_id: current.pm_id, pm_name: current.pm_name });
    }
    return acc;
  }, []);
```

---

#### `getEquipementierById(id)`
```typescript
async getEquipementierById(equipementierId: string): Promise<Equipementier | null>
```

**Logique**:
- `.single()` pour 1 résultat
- Return `null` si error ou non trouvé
- Pas de filtrage `pm_display`

---

#### `searchEquipementiers(term)`
```typescript
async searchEquipementiers(searchTerm: string): Promise<{
  data: Equipementier[];
  stats: { results_count: number };
  success: boolean;
}>
```

**Logique**:
- ILIKE sur `pm_name` (case-insensitive)
- Tri alphabétique
- Return tous résultats (pas de limite)

---

### 3.2 EquipementiersController - 138 lignes

**Location**: `/backend/src/modules/catalog/controllers/equipementiers.controller.ts`  
**Route Base**: `/api/catalog/equipementiers`

**Méthodes**:

1. `@Get()` → `getEquipementiers()`
   - Logs: `🏭 [GET] /api/catalog/equipementiers`
   - Success: `✅ {count} équipementiers récupérés`

2. `@Get('search')` → `searchEquipementiers(@Query('q'))`
   - Validation: `q` required
   - Logs: `🔍 [GET] /search?q={term}`

3. `@Get(':id')` → `getEquipementierById(@Param('id'))`
   - Logs: `🔍 [GET] /:id`
   - Not Found: `⚠️ Équipementier {id} non trouvé`

---

## 4. Database Schema

### 4.1 Table pieces_marque

**Description**: Fabricants pièces détachées  
**Rows**: ~400 entries (~150 DISTINCT pm_name)

```sql
CREATE TABLE pieces_marque (
  -- Identifiants
  pm_id           TEXT PRIMARY KEY,
  pm_alias        TEXT,                        -- Slug SEO
  pm_name         TEXT NOT NULL,               -- Nom marque
  pm_name_url     TEXT,
  pm_name_meta    TEXT,                        -- Meta title
  
  -- Assets
  pm_logo         TEXT,                        -- Filename logo
  pm_preview      TEXT,
  
  -- Qualité & Notation
  pm_quality      TEXT,
  pm_oes          TEXT,                        -- 'O', 'OES', '1' = OES
  pm_nb_stars     TEXT,                        -- 1-6 étoiles
  pm_nature       TEXT,
  
  -- Affichage & SEO
  pm_display      TEXT DEFAULT '1',            -- '1' = visible
  pm_top          TEXT DEFAULT '0',            -- '1' = top
  pm_sort         TEXT,                        -- Ordre manuel
  pm_relfollow    TEXT DEFAULT '1',
  pm_sitemap      TEXT DEFAULT '1'
);
```

**Indexes**:
```sql
CREATE INDEX idx_pm_display ON pieces_marque(pm_display);
CREATE INDEX idx_pm_name ON pieces_marque(pm_name);
CREATE INDEX idx_pm_top_sort ON pieces_marque(pm_top DESC, pm_sort ASC);
CREATE INDEX idx_pm_oes ON pieces_marque(pm_oes) WHERE pm_oes IS NOT NULL;
```

---

### 4.2 Colonnes Business

**pm_oes** (Qualité OES):
- `'O'`, `'OES'`, `'1'` = **OES** (Original Equipment Supplier) → Premium
- `NULL`, autres = **Aftermarket** → Standard

**pm_nb_stars** (Notation):
- `'6'` = Qualité exceptionnelle OES
- `'5'` = Premium OES
- `'4'` = Très bonne
- `'3'` = Standard
- `'2'` = Économique
- `'1'` = Budget

**pm_top** (Priorité):
- `'1'` = Marque TOP (priorité affichage)
- `'0'` = Standard

**pm_display** (Visibilité):
- `'1'` = Actif, visible
- `'0'` = Masqué

**pm_sort** (Ordre manuel):
- TEXT numérique (ex: "10", "20", "30")
- Tri ASC (ordre croissant)

---

### 4.3 Relations

**pieces_marque → pieces_price** (1:N)
```sql
pieces_price.pri_pm_id → pieces_marque.pm_id
```

**Exemple query produits par équipementier**:
```sql
SELECT pp.* 
FROM pieces_price pp
JOIN pieces_marque pm ON pp.pri_pm_id = pm.pm_id
WHERE pm.pm_id = '123'
```

---

## 5. Frontend Integration

### 5.1 EquipementiersCarousel (Homepage)

**Location**: `/frontend/app/components/homepage/EquipementiersCarousel.tsx`  
**Lines**: ~200 lignes  
**Usage**: Section homepage "Nos partenaires équipementiers"

**Props**:
```typescript
interface EquipementiersCarouselProps {
  equipementiersData: {
    data?: Equipementier[];
    stats?: { total_equipementiers: number };
    success?: boolean;
  } | null;
  className?: string;
  title?: string;
}
```

**Features**:
- Grid responsive (6 cols desktop, scroll mobile)
- Logos lazy loading
- Limite 12 premiers
- Stats visuelles
- CTA "Devenir partenaire"

**API Call** (loader):
```typescript
const equipementiersResult = await fetch(
  `${apiUrl}/api/catalog/equipementiers`
).then(res => res.json());
```

**Logo URL**:
```typescript
const logoUrl = eq.pm_logo 
  ? `/upload/logos/equipementiers/${eq.pm_logo}`
  : '/upload/logo-placeholder.svg';
```

---

### 5.2 EquipementiersSection (Product Pages)

**Location**: `/frontend/app/components/homepage/EquipementiersSection.tsx`  
**Lines**: ~100 lignes  
**Usage**: Pages produits "Équipementiers disponibles"

**Props**:
```typescript
interface EquipementiersSectionProps {
  equipementiers?: {
    title: string;
    items: EquipementierItem[];
  };
}
```

**Features**:
- Grid 2 colonnes (responsive)
- Badge "Équipementier"
- Logo + description
- Fallback image

---

## 6. Business Rules

### 6.1 Qualité OES vs Aftermarket

**Hiérarchie**:
1. **OES** (pm_oes = 'O'/'OES'/'1') → Qualité constructeur (Bosch, Valeo, SKF)
2. **Premium Aftermarket** (pm_nb_stars = '5'/'6') → Qualité supérieure (Mann-Filter)
3. **Standard Aftermarket** (pm_nb_stars = '3'/'4') → Qualité standard
4. **Budget Aftermarket** (pm_nb_stars = '1'/'2') → Qualité économique

**Affichage Frontend**:
- Tri: OES > Premium > Standard > Budget
- Filtres: Par niveau qualité
- Badges: OES sur produits premium

---

### 6.2 Système Notation (pm_nb_stars)

**Échelle 1-6 Étoiles**:
- ⭐⭐⭐⭐⭐⭐ (6) = Exceptionnelle OES
- ⭐⭐⭐⭐⭐ (5) = Premium OES
- ⭐⭐⭐⭐ (4) = Très bonne
- ⭐⭐⭐ (3) = Standard
- ⭐⭐ (2) = Économique
- ⭐ (1) = Budget

---

### 6.3 Affichage & Priorité

**Tri Final**:
```sql
ORDER BY 
  pm_top DESC,        -- 1. TOP en premier
  pm_sort ASC,        -- 2. Ordre manuel
  pm_name ASC         -- 3. Alphabétique
```

**Filtrage Automatique**:
- Tous endpoints filtrent `pm_display = '1'`
- ~89 équipementiers actifs affichés

---

### 6.4 SEO

**URLs**: `/pieces-auto/marque-{pm_id}-{pm_alias}`  
**Meta-tags**: Via `pm_name_meta`  
**Sitemap**: `pm_sitemap = '1'` (inclusion XML)  
**NoFollow**: `pm_relfollow = '0'` → `rel="nofollow"`

---

## 7. Integration Modules

### 7.1 Products Module

**Filtrage par équipementier**:
```typescript
const { data: products } = await this.supabase
  .from('pieces_price')
  .select(`
    *,
    pieces_marque!pri_pm_id (
      pm_id, pm_name, pm_logo, pm_oes, pm_nb_stars
    )
  `)
  .eq('pri_pm_id', equipementierId);
```

**Badge OES**:
```typescript
{product.pieces_marque.pm_oes === 'O' && (
  <Badge>Qualité OE</Badge>
)}
```

---

### 7.2 Catalog Module

**Menu équipementiers**:
```typescript
const topEquipementiers = await this.equipementiersService
  .getEquipementiers()
  .then(result => result.data.filter(eq => eq.pm_top === '1'));
```

**Filtres recherche**:
```tsx
<select name="manufacturer">
  <option value="">Tous</option>
  {equipementiers.map(eq => (
    <option value={eq.pm_id}>{eq.pm_name}</option>
  ))}
</select>
```

---

### 7.3 Search Module

**Facets MeiliSearch**:
```typescript
await meiliClient.index('products').updateSettings({
  filterableAttributes: [
    'manufacturer_id',
    'manufacturer_oes',
    'manufacturer_stars'
  ]
});

const results = await meiliClient.index('products').search(query, {
  filter: ['manufacturer_oes = O', 'manufacturer_stars >= 5']
});
```

**Autocomplete**:
```typescript
GET /api/catalog/equipementiers/search?q=bos
// Response: [{ pm_name: "BOSCH" }, { pm_name: "ROBERT BOSCH" }]
```

---

## 8. Error Handling

### 8.1 Validation Errors

**Missing query param**:
```typescript
if (!searchTerm) {
  return {
    success: false,
    data: [],
    stats: { results_count: 0 },
    error: 'Terme de recherche requis (paramètre q)'
  };
}
```

**Invalid ID**:
```typescript
if (!equipementier) {
  return {
    success: false,
    data: null,
    message: `Équipementier ${id} non trouvé`
  };
}
```

---

### 8.2 Database Errors

**Supabase error**:
```typescript
if (error) {
  this.logger.error('❌ Erreur Supabase:', error);
  throw new BadRequestException(
    `Erreur récupération équipementiers: ${error.message}`
  );
}
```

---

### 8.3 Frontend Errors

**Empty data**:
```tsx
if (equipementiers.length === 0) {
  return null;
}
```

**Logo fallback**:
```tsx
<img
  src={eq.pm_logo || '/upload/logo-placeholder.svg'}
  onError={(e) => {
    e.currentTarget.src = '/images/default-brand.jpg';
  }}
/>
```

---

## 9. Performance

### 9.1 Optimisations

**Déduplication**:
```typescript
// Post-processing JS (évite DISTINCT SQL lent)
const uniqueEquipementiers = equipementiers.reduce((acc, current) => {
  if (!acc.find(item => item.pm_name === current.pm_name)) {
    acc.push({ pm_id: current.pm_id, pm_name: current.pm_name });
  }
  return acc;
}, []);
```

**Indexes**:
```sql
CREATE INDEX idx_pm_display_top_sort_name 
ON pieces_marque(pm_display, pm_top DESC, pm_sort ASC, pm_name ASC);

CREATE INDEX idx_pm_name_trgm 
ON pieces_marque USING gin(pm_name gin_trgm_ops);
```

---

### 9.2 Cache Strategy (Future)

**Non implémenté**, recommandation:
- **TTL**: 1h (données stables)
- **Keys**: 
  - `equipementiers_all_display_1` (liste)
  - `equipementiers_search_{term}` (recherche)
  - `equipementiers_by_id_{id}` (détails)
- **Invalidation**: Admin update ou cron nightly

---

### 9.3 Frontend Optimization

**Lazy loading**:
```tsx
<img loading="lazy" src={logoUrl} />
```

**Slice data**:
```tsx
{equipementiers.slice(0, 12).map(eq => <Card key={eq.pm_id} />)}
```

**Memoization**:
```tsx
const equipementiers = useMemo(() => {
  if (!equipementiersData?.data) return [];
  return equipementiersData.data;
}, [equipementiersData]);
```

---

## 10. Testing

### 10.1 Endpoint Tests

**Liste équipementiers**:
```bash
curl http://localhost:3000/api/catalog/equipementiers
# Expected: { success: true, data: [...], stats: { total_equipementiers: 89 } }
```

**Recherche**:
```bash
curl "http://localhost:3000/api/catalog/equipementiers/search?q=bosch"
# Expected: { success: true, data: [{ pm_id: '123', pm_name: 'BOSCH' }], ... }
```

**Détails**:
```bash
curl http://localhost:3000/api/catalog/equipementiers/123
# Expected: { success: true, data: { pm_id: '123', pm_name: 'BOSCH' } }
```

---

### 10.2 Frontend Tests

**EquipementiersCarousel**:
```typescript
test('renders carousel with equipementiers', () => {
  const mockData = {
    data: [
      { pm_id: '1', pm_name: 'BOSCH', pm_logo: 'bosch.png' },
      { pm_id: '2', pm_name: 'VALEO', pm_logo: 'valeo.png' }
    ],
    stats: { total_equipementiers: 2 },
    success: true
  };
  
  render(<EquipementiersCarousel equipementiersData={mockData} />);
  
  expect(screen.getByText('BOSCH')).toBeInTheDocument();
  expect(screen.getByText('VALEO')).toBeInTheDocument();
});
```

---

## 11. Migration Notes

### 11.1 Module Manufacturers = DOUBLON

**⚠️ IMPORTANT**: Module `/backend/src/modules/manufacturers/` est un **DOUBLON** de Vehicles.

**Constat**:
- Manufacturers utilise table `auto_marque` (vehicle brands: Peugeot, Renault...)
- Vehicles utilise AUSSI table `auto_marque` (déjà documenté, 31 endpoints)
- **→ Manufacturers = DOUBLON total de Vehicles**

**Recommandation**:
1. ✅ **Garder**: Module Vehicles (complet, documenté)
2. ✅ **Garder**: Module Équipementiers (distinct, `pieces_marque`)
3. ❌ **Supprimer**: Module Manufacturers (redondant)

**Plan suppression**:
```bash
# 1. Rediriger endpoints
# /api/manufacturers → /api/vehicles/brands

# 2. Update imports frontend
- import { ManufacturersService } from 'manufacturers';
+ import { VehiclesService } from 'vehicles';

# 3. Supprimer module
rm -rf backend/src/modules/manufacturers/

# 4. Update app.module.ts
# Retirer ManufacturersModule des imports
```

---

### 11.2 Distinction Modules

| Critère | Vehicles | Manufacturers | Équipementiers |
|---------|----------|---------------|----------------|
| **Table** | auto_marque | auto_marque | pieces_marque |
| **Type** | Vehicle brands | Vehicle brands | Parts brands |
| **Exemples** | Peugeot, Renault | Peugeot, Renault | Bosch, Valeo |
| **Usage** | Sélecteur véhicule | DOUBLON | Filtres produits |
| **Status** | ✅ Keep | ❌ Delete | ✅ Keep |

---

### 11.3 Module Standalone (Recommandation)

**Architecture future**:
```
backend/src/modules/
├── vehicles/              # Marques VÉHICULES (auto_marque)
│   ├── services/
│   └── controllers/
│
├── equipementiers/        # Marques PIÈCES (pieces_marque) → STANDALONE
│   ├── equipementiers.service.ts
│   ├── equipementiers.controller.ts
│   └── equipementiers.module.ts
│
└── ❌ manufacturers/      # DOUBLON → À SUPPRIMER
```

**Migration steps**:
1. Créer module standalone `/modules/equipementiers/`
2. Migrer service/controller depuis `/modules/catalog/`
3. Update imports dans Products, Catalog, Search
4. Supprimer module manufacturers
5. Update frontend imports

---

## 12. Summary

**Module Équipementiers**: Gestion fabricants pièces (parts brands) pour e-commerce auto.

**Endpoints**: 3 total
- GET / (liste, tri intelligent)
- GET /search?q= (recherche ILIKE)
- GET /:id (détails)

**Architecture**:
- EquipementiersService (151 lignes)
- EquipementiersController (138 lignes)
- Total: ~289 lignes backend

**Database**:
- Table `pieces_marque` (~400 rows, ~150 DISTINCT)
- Colonnes business: pm_oes, pm_nb_stars, pm_display, pm_top, pm_sort
- Relations: pieces_price (1:N)

**Frontend**:
- EquipementiersCarousel (~200 lignes, homepage)
- EquipementiersSection (~100 lignes, produits)
- Total: ~300 lignes frontend

**Business Rules**:
- Tri: pm_top DESC → pm_sort ASC → pm_name ASC
- Qualité: OES (pm_oes='O') > Premium (5-6) > Standard (3-4) > Budget (1-2)
- Déduplication: DISTINCT pm_name
- Affichage: pm_display='1' automatique

**Integration**:
- Products: filtrage, badges OES
- Catalog: menu, filtres
- Search: facets, autocomplete

**Migration**:
- **Manufacturers module = DOUBLON à supprimer**
- Vehicles (auto_marque) ≠ Équipementiers (pieces_marque)

**Performance**:
- Indexes: pm_display, pm_top_sort, pm_name
- Cache future: Redis TTL 1h
- Frontend: lazy loading, slice(12), memoization

**Business Value**:
- ~150 équipementiers (Bosch, Valeo, Mann-Filter, SKF...)
- Système qualité OES vs Aftermarket
- Notation 1-6 étoiles
- Homepage carousel (partenaires)
- Product filters (search by manufacturer)
