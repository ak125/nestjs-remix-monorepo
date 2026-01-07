# Cartographie SEO Complète - Site Automecanik

> Document de référence pour la centralisation des blocs SEO
> Date: 2025-12-31

## Résumé Exécutif

| Métrique | Valeur |
|----------|--------|
| Routes analysées | 36+ |
| Tables SEO | 17 |
| Composants frontend | 13 majeurs |
| Interfaces admin existantes | 3 |
| Interfaces admin à créer | ~10 |
| Effort estimé | ~40-50h |

---

## PARTIE 1: INVENTAIRE GAMMES

### Composants Frontend

| Composant | Fichier | Route(s) | Source Données | Admin? |
|-----------|---------|----------|----------------|--------|
| TopGammes | `components/home/TopGammes.tsx` | Homepage | `pieces_gamme` (pg_top=1) | Non |
| FamilyGammeBento | `components/home/FamilyGammeBento.tsx` | Homepage | `/api/catalog/gammes/hierarchy` | Oui |
| FamilyGammeHierarchy | `components/home/FamilyGammeHierarchy.tsx` | Homepage | `mf_families` + `pieces_gamme` | Oui |
| PopularGammesSection | `components/constructeurs/PopularGammesSection.tsx` | `/constructeurs/{brand}` | `/api/brands/{brandId}/gammes` | Partiel |
| PurchaseGuide | `components/catalog/PurchaseGuide.tsx` | `/pieces/{slug}.html` | `__seo_gamme_purchase_guide` | Oui |
| InformationsSection | `components/pieces/InformationsSection.tsx` | `/pieces/{slug}.html` | `__seo_gamme_info` | **Non** |
| EquipementiersSection | `components/pieces/EquipementiersSection.tsx` | `/pieces/{slug}.html` | `__seo_equip_gamme` | **Non** |
| ConseilsSection | `components/pieces/ConseilsSection.tsx` | `/pieces/{slug}.html` | `__seo_gamme_conseil` | Oui |
| CatalogueSection | `components/pieces/CatalogueSection.tsx` | `/pieces/{slug}.html` | RPC famille gammes | Partiel |
| MotorisationsSection | `components/pieces/MotorisationsSection.tsx` | `/pieces/{slug}.html` | `__cross_gamme_car_new` | Non |

### Tables SQL Gammes

#### Tables Principales
- `pieces_gamme` - Table maître (pg_id, pg_name, pg_alias, pg_level, pg_top)
- `catalog_gamme` - Liaison famille/gamme (mc_id, mc_mf_id, mc_pg_id)
- `catalog_family` - Familles (mf_id, mf_name)

#### Tables SEO
| Table | Colonnes | Admin Actuel |
|-------|----------|--------------|
| `__seo_gamme` | sg_title, sg_descrip, sg_h1, sg_content, sg_pg_id | Oui |
| `__seo_gamme_conseil` | sgc_title, sgc_content, sgc_pg_id | Oui |
| `__seo_gamme_info` | sgi_id, sgi_content, sgi_pg_id | **Non** |
| `__seo_equip_gamme` | seg_id, seg_content, seg_pm_id, seg_pg_id | **Non** |
| `__seo_gamme_purchase_guide` | sgpg_step1_*, sgpg_eco_*, sgpg_step3_* | En cours |
| `__seo_item_switch` | sis_content, sis_alias, sis_pg_id | **Non** |
| `__seo_family_gamme_car_switch` | sfgcs_content, sfgcs_mf_id, sfgcs_pg_id | **Non** |

#### Tables Cross-Reference
- `__cross_gamme_car_new` - Compatibilité véhicules (cgc_pg_id, cgc_type_id, cgc_level)
- `pieces_gamme_cross` - Cross-selling (pgc_pg_id, pgc_pg_cross)

### RPC Principale

**`get_gamme_page_data_optimized(p_pg_id)`**

Performance: 1 appel RPC = 15+ appels REST (~75ms vs 680ms)

```json
{
  "page_info": { "pg_id", "pg_name", "pg_alias", "pg_level", "pg_relfollow" },
  "seo": { "sg_title", "sg_descrip", "sg_h1", "sg_content" },
  "conseils": [{ "sgc_title", "sgc_content" }],
  "informations": [{ "sgi_content" }],
  "equipementiers": [{ "seg_pm_id", "seg_content", "pm_name", "pm_logo" }],
  "motorisations_enriched": [...],
  "seo_fragments_1": [{ "sis_content" }],
  "catalogue_famille": [{ "pg_id", "pg_name" }],
  "famille_info": { "mf_id", "mf_name" }
}
```

---

## PARTIE 2: INVENTAIRE BLOG

### Routes Blog (12)

| Route | Table Source | Admin |
|-------|--------------|-------|
| `/blog-pieces-auto` | `/api/blog/homepage` | Non |
| `/blog-pieces-auto/conseils` | `/api/blog/advice-hierarchy` | Non |
| `/blog-pieces-auto/conseils/{slug}` | `__blog_conseil` | Non |
| `/blog-pieces-auto/guide` | `/api/blog/guides` | Non |
| `/blog-pieces-auto/guide/{slug}` | `__blog_guide` | Non |
| `/blog-pieces-auto/article/{slug}` | `__blog_article` | Non |

### Tables Blog

| Table | Colonnes | Admin |
|-------|----------|-------|
| `__blog_conseil` | title, content, sections, image, tags | **Non** |
| `__blog_guide` | title, content, excerpt, sections | **Non** |
| `__blog_article` | title, content, excerpt, keywords | **Non** |
| `__blog_seo_marque` | content, marque_id | Non |

---

## PARTIE 3: INVENTAIRE CONSTRUCTEURS

### Routes Constructeurs (10+)

| Route | Table Source | Admin |
|-------|--------------|-------|
| `/constructeurs/{brand}.html` | `__seo_marque`, `__blog_seo_marque` | Oui |
| `/constructeurs/{brand}/{model}/{type}` | `__seo_type_switch` | **Non** |
| `/brands` | `/api/brands` | Non |
| `/brands/{brandId}` | `/api/vehicles/brands/{id}/models` | Non |

### Tables Constructeurs

| Table | Colonnes | Admin |
|-------|----------|-------|
| `auto_marque` | marque_id, marque_name, marque_alias, marque_logo | Oui |
| `__seo_marque` | sm_title, sm_descrip, sm_h1, sm_content | Oui |
| `__blog_seo_marque` | content, marque_id | **Non** |
| `__seo_type_switch` | SEO content véhicules | **Non** |

---

## PARTIE 4: PLAN D'IMPLÉMENTATION

### Vue d'ensemble

```
PHASE 1 - GAMMES (Enrichir existant) ........... ~8-10h
├── 1.1 Onglet Informations     [__seo_gamme_info]
├── 1.2 Onglet Équipementiers   [__seo_equip_gamme]
├── 1.3 Onglet Switches SEO     [__seo_item_switch]
└── 1.4 Onglet PurchaseGuide    [En cours]

PHASE 2 - BLOG (Nouvelle interface) ............ ~16-20h
├── 2.1 Admin Blog Conseils     [__blog_conseil]
├── 2.2 Admin Blog Guides       [__blog_guide]
└── 2.3 Admin Blog Articles     [__blog_article]

PHASE 3 - CONSTRUCTEURS (Enrichir existant) .... ~4-6h
├── 3.1 Onglet Description Blog [__blog_seo_marque]
└── 3.2 Onglet Points Forts     [Nouveau champ JSON]

PHASE 4 - VÉHICULES (Nouvelle interface) ....... ~8-10h
└── 4.1 Admin Véhicules SEO     [__seo_type_switch]
```

### Priorités

| Priorité | Action | Impact | Tables |
|----------|--------|--------|--------|
| P1 | Gammes: Informations + Équipementiers | 230 pages | `__seo_gamme_info`, `__seo_equip_gamme` |
| P1 | Gammes: Switches SEO | 230 pages | `__seo_item_switch` |
| P2 | Blog: Admin articles | 500+ articles | `__blog_*` |
| P2 | Constructeurs: Description | 34 marques | `__blog_seo_marque` |
| P3 | Véhicules: SEO type | Milliers | `__seo_type_switch` |

### Fichiers à Modifier

**Backend:**
- `backend/src/modules/admin/services/admin-gammes-seo.service.ts`
- `backend/src/modules/admin/controllers/admin-gammes-seo.controller.ts`

**Frontend:**
- `frontend/app/routes/admin.gammes-seo_.$pgId.tsx`

**Nouvelles routes:**
- `frontend/app/routes/admin.blog.conseils._index.tsx`
- `frontend/app/routes/admin.blog.conseils.$id.tsx`
- `frontend/app/routes/admin.vehicules-seo._index.tsx`
- `frontend/app/routes/admin.vehicules-seo.$typeId.tsx`

---

## PARTIE 5: DÉTAIL TECHNIQUE PHASE 1

### 1.1 Onglet Informations

**Table:** `__seo_gamme_info`

```typescript
// Backend - admin-gammes-seo.service.ts
async getInformations(pgId: number): Promise<InformationItem[]>
async addInformation(pgId: number, content: string): Promise<{success, item}>
async updateInformation(sgiId: string, content: string): Promise<{success}>
async deleteInformation(sgiId: string): Promise<{success}>

// Controller endpoints
@Get(':pgId/informations')
@Post(':pgId/informations')
@Put('informations/:sgiId')
@Delete('informations/:sgiId')
```

### 1.2 Onglet Équipementiers

**Table:** `__seo_equip_gamme` + `pieces_marque`

```typescript
// Backend - admin-gammes-seo.service.ts
async getEquipementiers(pgId: number): Promise<EquipementierItem[]>
async addEquipementier(pgId: number, pmId: number, content: string): Promise<{success}>
async updateEquipementier(segId: string, content: string): Promise<{success}>
async deleteEquipementier(segId: string): Promise<{success}>
async getAvailableMarques(): Promise<MarqueOption[]>

// Controller endpoints
@Get(':pgId/equipementiers')
@Post(':pgId/equipementiers')
@Put('equipementiers/:segId')
@Delete('equipementiers/:segId')
@Get('marques/available')
```

### 1.3 Onglet Switches SEO

**Table:** `__seo_item_switch`

```typescript
// Backend - admin-gammes-seo.service.ts
async getSeoSwitches(pgId: number): Promise<SwitchItem[]>
async addSeoSwitch(pgId: number, alias: string, content: string): Promise<{success}>
async updateSeoSwitch(sisId: string, content: string): Promise<{success}>
async deleteSeoSwitch(sisId: string): Promise<{success}>

// Controller endpoints
@Get(':pgId/switches')
@Post(':pgId/switches')
@Put('switches/:sisId')
@Delete('switches/:sisId')
```

---

## Annexe: Variables SEO Dynamiques

### Switches Gammes
- `#Switch_1#`, `#Switch_2#`, `#Switch_3#` - Fragments texte alternatifs
- `#FamilySwitch_11#` - Fragments par famille

### Variables Globales
- `#VMarque#` - Nom de la marque véhicule
- `#PrixPasCher#` - Variations "à prix pas cher", "pas cher", etc.
- `#Gamme#` - Nom de la gamme

---

*Document généré automatiquement - Claude Code*
