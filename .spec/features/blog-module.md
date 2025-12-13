---
title: "blog module"
status: draft
version: 1.0.0
---

# Module Blog - Spécification Technique

## 1. Vue d'ensemble

### Description
Module CMS complet pour gestion de contenu éditorial automobile : conseils techniques, guides pratiques, constructeurs automobiles, et glossaire terminologique. Intègre 85+ articles legacy (`__blog_*` tables) avec système de recherche Meilisearch, cache Redis 3-niveaux (hot/warm/cold), et navigation hiérarchique par gammes produits.

### Objectifs
- **CMS multi-type** : Conseils (85+), Guides (1+), Constructeurs, Glossaire
- **Architecture legacy → moderne** : Transformations automatiques tables `__blog_*` → interface REST
- **Recherche sémantique** : Meilisearch indexation ultra-rapide
- **SEO optimisé** : Meta tags, breadcrumbs, switches par gamme, URL legacy support
- **Performance** : Cache Redis 3 niveaux (TTL adaptatif), pagination optimisée
- **Hiérarchie contenu** : Sections H2/H3 structurées (457+ sections), navigation articles croisés
- **Analytics** : Compteur vues (3.6M+ total), articles populaires

### Contexte technique
- **Architecture** : NestJS + Supabase PostgreSQL (10 tables `__blog_*`)
- **Recherche** : Meilisearch indexation
- **Cache** : Redis 3 niveaux (TTL: 5000s hot, 1000s warm, 600s cold)
- **CDN** : Supabase Storage pour images (articles, marques logos, modèles)
- **SEO** : URL rewrites legacy, meta tags dynamiques, breadcrumbs ariane

---

## 2. Objectifs détaillés

### Fonctionnels
1. **Conseils techniques (Advice)**
   - 85+ articles remplacement pièces (alternateur, courroie, etc.)
   - Hiérarchie H2/H3 (tables `__blog_advice_h2`, `__blog_advice_h3`)
   - Lien gammes produits (`ba_pg_id` → `pieces_gamme`)
   - Articles croisés (`__blog_advice_cross`)
   - Véhicules compatibles (via `__cross_gamme_car_new`)
   - Switches SEO item (`__seo_item_switch`)
   - Conseils remplacement (`__seo_gamme_conseil`)

2. **Guides pratiques (Guide)**
   - Guides techniques détaillés
   - Structure similaire conseils (H2/H3)
   - Pas de lien gamme (contenu généraliste)

3. **Constructeurs automobiles (Constructeur)**
   - Contenu marques (FIAT, VW, BMW, etc.)
   - Historique, modèles, technologies
   - Tri alphabétique A-Z

4. **Glossaire (Glossaire)**
   - Terminologie technique automobile
   - Tri alphabétique par lettre
   - Aide contextuelle produits

5. **Recherche & Navigation**
   - Recherche unifiée multi-tables (titre, contenu, résumé)
   - Pagination optimisée
   - Filtres par type
   - Articles adjacents (précédent/suivant)
   - Articles croisés (sidebar)
   - Breadcrumbs ariane

6. **Performance & Cache**
   - Cache Redis 3 niveaux :
     - Hot: Articles populaires (TTL 5000s)
     - Warm: Articles récents (TTL 1000s)
     - Cold: Listes générales (TTL 600s)
   - Décodage HTML automatique (entités, caractères spéciaux)
   - Sanitization contenu (XSS protection)

7. **Analytics**
   - Compteur vues par article (3.6M+ total cumulé)
   - Articles populaires (top 10)
   - Statistiques dashboard (total, vues, moyennes)
   - Historique mises à jour

### Non-fonctionnels
- **Performance** :
  - Homepage: p50 <300ms, p95 <800ms
  - Article detail: p50 <400ms, p95 <1000ms
  - Recherche: p50 <200ms (Meilisearch), p95 <500ms
  - Cache hit ratio: >80%
- **SEO** :
  - URL rewrites legacy (`/conseil/{pg_alias}` → `/api/blog/article/by-gamme/{pg_alias}`)
  - Meta tags dynamiques (title, description, keywords)
  - Breadcrumbs structurés (JSON-LD)
  - Sitemap génération (`__sitemap_blog`)
- **Disponibilité** : 99.9%
- **Scalabilité** : 10,000+ articles supportés
- **Monitoring** : Logs détaillés (GET, searches, cache hits)

---

## 3. Hors périmètre

- ❌ **Éditeur WYSIWYG backend** → Contenu géré via DB directement
- ❌ **Commentaires utilisateurs** → Future phase 2
- ❌ **Notes/reviews articles** → Future phase 3
- ❌ **Multilingue (i18n)** → Français uniquement
- ❌ **Versioning contenu** → Pas de draft/published workflow
- ❌ **Gestion médias avancée** → Uploads manuels Supabase Storage
- ❌ **Newsletters intégrées** → Module séparé
- ❌ **Podcasts/vidéos** → Texte uniquement

---

## 4. Architecture

### Structure du module

```
backend/src/modules/blog/
├── blog.module.ts                     # Configuration module
├── controllers/
│   ├── blog.controller.ts             # API générale (homepage, search, dashboard, popular)
│   ├── advice.controller.ts           # API conseils (list, detail, stats, hierarchy)
│   ├── advice-hierarchy.controller.ts # Hiérarchie conseils par famille catalogue
│   └── content.controller.ts          # API guides, constructeurs, glossaire
├── services/
│   ├── blog.service.ts                # Service principal (search, transforms, cache)
│   ├── blog-cache.service.ts          # Cache Redis 3 niveaux + décodage HTML
│   ├── advice.service.ts              # Logique conseils (85+ articles)
│   ├── guide.service.ts               # Logique guides
│   ├── constructeur.service.ts        # Logique constructeurs
│   ├── glossary.service.ts            # Logique glossaire
│   └── html-content-sanitizer.service.ts # Nettoyage HTML (XSS protection)
└── interfaces/
    └── blog.interfaces.ts             # Types TypeScript (BlogArticle, BlogSection, etc.)
```

### Tables SQL (Legacy)

#### 1. `__blog_advice` - Conseils techniques (85+ articles)
```sql
ba_id INTEGER PRIMARY KEY           -- ID article
ba_alias VARCHAR(255) UNIQUE        -- Slug URL (ex: 'comment-remplacer-alternateur')
ba_title VARCHAR(255)               -- Titre article
ba_h1 VARCHAR(255)                  -- H1 SEO
ba_h2 VARCHAR(255)                  -- H2 SEO
ba_content TEXT                     -- Contenu principal (HTML encodé)
ba_resume TEXT                      -- Résumé/excerpt
ba_preview TEXT                     -- Aperçu court
ba_descrip TEXT                     -- Meta description
ba_keywords VARCHAR(500)            -- Keywords SEO (CSV)
ba_pg_id VARCHAR(10)                -- ID gamme (pieces_gamme.pg_id, TEXT!)
ba_visit VARCHAR(10)                -- Compteur vues (TEXT!)
ba_create TIMESTAMPTZ               -- Date création
ba_update TIMESTAMPTZ               -- Date dernière MàJ
ba_status CHAR(1)                   -- Statut ('Y' = publié, 'N' = draft)
ba_cta_anchor VARCHAR(255)          -- Texte bouton CTA
ba_cta_link VARCHAR(255)            -- URL bouton CTA

CREATE INDEX idx_advice_alias ON __blog_advice(ba_alias);
CREATE INDEX idx_advice_pg_id ON __blog_advice(ba_pg_id);
CREATE INDEX idx_advice_visit ON __blog_advice(ba_visit);
```

#### 2. `__blog_advice_h2` - Sections H2 (457+ sections)
```sql
ba2_id INTEGER PRIMARY KEY
ba2_ba_id INTEGER REFERENCES __blog_advice(ba_id)  -- Article parent
ba2_h2 VARCHAR(255)                 -- Titre section H2
ba2_content TEXT                    -- Contenu section (HTML)
ba2_cta_anchor VARCHAR(255)         -- CTA section
ba2_cta_link VARCHAR(255)
ba2_wall VARCHAR(255)               -- Image section

CREATE INDEX idx_h2_ba_id ON __blog_advice_h2(ba2_ba_id);
```

#### 3. `__blog_advice_h3` - Sous-sections H3
```sql
ba3_id INTEGER PRIMARY KEY
ba3_ba2_id INTEGER REFERENCES __blog_advice_h2(ba2_id)  -- H2 parent
ba3_h3 VARCHAR(255)                 -- Titre sous-section H3
ba3_content TEXT                    -- Contenu sous-section
ba3_cta_anchor VARCHAR(255)
ba3_cta_link VARCHAR(255)
ba3_wall VARCHAR(255)

CREATE INDEX idx_h3_ba2_id ON __blog_advice_h3(ba3_ba2_id);
```

#### 4. `__blog_advice_cross` - Articles croisés (sidebar)
```sql
bac_id INTEGER PRIMARY KEY
bac_ba_id INTEGER REFERENCES __blog_advice(ba_id)       -- Article source
bac_ba_id_cross INTEGER REFERENCES __blog_advice(ba_id) -- Article lié

CREATE INDEX idx_cross_ba_id ON __blog_advice_cross(bac_ba_id);
```

#### 5. `__blog_guide` - Guides pratiques
```sql
bg_id INTEGER PRIMARY KEY
bg_alias VARCHAR(255) UNIQUE
bg_title VARCHAR(255)
bg_h1 VARCHAR(255)
bg_h2 VARCHAR(255)
bg_content TEXT
bg_preview TEXT
bg_descrip TEXT
bg_keywords VARCHAR(500)
bg_visit VARCHAR(10)                -- Compteur vues (TEXT!)
bg_create TIMESTAMPTZ
bg_update TIMESTAMPTZ
bg_meta_title VARCHAR(255)
bg_meta_description TEXT

CREATE INDEX idx_guide_alias ON __blog_guide(bg_alias);
```

#### 6. `__blog_constructeur` - Constructeurs automobiles
```sql
bsm_id INTEGER PRIMARY KEY
bsm_alias VARCHAR(255) UNIQUE       -- Slug marque (ex: 'fiat')
bsm_name VARCHAR(255)               -- Nom marque (ex: 'FIAT')
bsm_content TEXT                    -- Contenu HTML
bsm_visit VARCHAR(10)               -- Compteur vues
bsm_create TIMESTAMPTZ

CREATE INDEX idx_constructeur_alias ON __blog_constructeur(bsm_alias);
```

#### 7. `__blog_glossaire` - Glossaire terminologique
```sql
ba_id INTEGER PRIMARY KEY
ba_alias VARCHAR(255) UNIQUE        -- Slug terme (ex: 'alternateur')
ba_title VARCHAR(255)               -- Terme (ex: 'Alternateur')
ba_content TEXT                     -- Définition
ba_visit VARCHAR(10)                -- Compteur vues

CREATE INDEX idx_glossaire_alias ON __blog_glossaire(ba_alias);
```

#### 8. `__seo_item_switch` - Switches SEO par gamme
```sql
sis_id INTEGER PRIMARY KEY
sis_pg_id VARCHAR(10)               -- ID gamme (pieces_gamme.pg_id)
sis_alias VARCHAR(255)              -- Type switch (ex: 'symptomes', 'prix')
sis_content TEXT                    -- Contenu HTML

CREATE INDEX idx_seo_switch_pg_id ON __seo_item_switch(sis_pg_id);
```

#### 9. `__seo_gamme_conseil` - Conseils remplacement par gamme
```sql
sgc_id INTEGER PRIMARY KEY
sgc_pg_id VARCHAR(10)               -- ID gamme
sgc_title VARCHAR(255)              -- Titre conseil (ex: 'Quand remplacer ?')
sgc_content TEXT                    -- Contenu HTML

CREATE INDEX idx_gamme_conseil_pg_id ON __seo_gamme_conseil(sgc_pg_id);
```

#### 10. `__sitemap_blog` - Sitemap XML génération
```sql
sb_id INTEGER PRIMARY KEY
sb_url VARCHAR(500)                 -- URL article
sb_lastmod TIMESTAMPTZ              -- Dernière modification
sb_priority DECIMAL(2,1)            -- Priorité sitemap (0.0-1.0)
sb_changefreq VARCHAR(20)           -- Fréquence changement

CREATE INDEX idx_sitemap_lastmod ON __sitemap_blog(sb_lastmod);
```

### Interfaces TypeScript

```typescript
// blog/interfaces/blog.interfaces.ts
export interface BlogArticle {
  id: string;                         // Format: 'advice_123', 'guide_456'
  type: 'advice' | 'guide' | 'constructeur' | 'glossaire';
  title: string;
  slug: string;
  pg_alias?: string | null;           // Alias gamme (ex: 'alternateur')
  pg_id?: number | null;              // ID gamme (ex: 20)
  ba_pg_id?: string | null;           // ba_pg_id original (string) pour catégorisation
  excerpt: string;
  content: string;
  h1?: string;
  h2?: string;
  keywords: string[];
  tags: string[];
  publishedAt: string;
  updatedAt?: string;
  viewsCount: number;
  readingTime?: number;               // Minutes (calculé)
  featuredImage?: string | null;      // URL CDN Supabase
  sections: BlogSection[];            // H2/H3 structurés
  legacy_id: number;                  // ba_id, bg_id, etc.
  legacy_table: string;               // '__blog_advice', etc.
  cta_anchor?: string | null;
  cta_link?: string | null;
  relatedArticles?: BlogArticle[];    // Articles croisés
  compatibleVehicles?: any[];         // Véhicules compatibles (via cross_gamme_car)
  seo_data?: {
    meta_title: string;
    meta_description: string;
    keywords?: string[];
  };
}

export interface BlogSection {
  level: number;                      // 2 = H2, 3 = H3
  title: string;
  content: string;
  anchor: string;                     // Slug pour navigation (#anchor)
  cta_anchor?: string | null;
  cta_link?: string | null;
  wall?: string | null;               // Image section
}

export interface BlogDashboard {
  featured?: BlogArticle[];           // Articles vedette (top 3)
  recent?: BlogArticle[];             // Articles récents (6)
  popular?: BlogArticle[];            // Articles populaires (5)
  categories?: any[];
  stats?: any;
  overview?: {
    totalArticles: number;
    totalViews: number;
    totalAdvice: number;
    totalGuides: number;
  };
  byType?: {
    advice: { total: number; views: number; avgViews: number };
    guide: { total: number; views: number; avgViews: number };
    constructeur: { total: number; views: number; avgViews: number };
    glossaire: { total: number; views: number; avgViews: number };
  };
  lastUpdated: string;
  success: boolean;
}
```

---

## 6. API Endpoints

### 6.1 Blog General (BlogController)

#### GET `/api/blog/homepage`
Homepage blog avec contenu complet.

**Guards:** `OptionalAuthGuard` (public + private content)

**Response 200:**
```json
{
  "success": true,
  "message": "Homepage blog récupérée avec succès",
  "data": {
    "featured": [
      {
        "id": "advice_123",
        "type": "advice",
        "title": "Comment remplacer un alternateur",
        "slug": "comment-remplacer-alternateur",
        "excerpt": "Guide complet pour remplacer votre alternateur...",
        "viewsCount": 12543,
        "featuredImage": "https://supabase.co/.../alternateur.webp"
      }
    ],
    "recent": [...],
    "popular": [...],
    "categories": [...],
    "stats": {
      "totalArticles": 86,
      "totalViews": 3600000,
      "totalAdvice": 85,
      "totalGuides": 1
    },
    "lastUpdated": "2025-11-18T10:00:00Z"
  }
}
```

**Performance:** p50: <300ms, p95: <800ms  
**Cache:** Hot (TTL 5000s)

---

#### GET `/api/blog/search`
Recherche globale multi-tables.

**Query params:**
- `q` (required): Terme recherche (ex: 'alternateur')
- `type` (optional): 'advice' | 'guide' | 'constructeur' | 'glossaire'
- `limit` (default: 20): Nombre résultats
- `page` (default: 1): Page courante

**Response 200:**
```json
{
  "success": true,
  "data": {
    "query": "alternateur",
    "type": "all",
    "articles": [
      {
        "id": "advice_20",
        "type": "advice",
        "title": "Alternateur : Remplacement, Prix et Durée de Vie",
        "slug": "alternateur-remplacement-prix-duree-vie",
        "pg_alias": "alternateur",
        "excerpt": "Tout savoir sur le remplacement de l'alternateur...",
        "viewsCount": 45231
      }
    ],
    "total": 8,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

**Recherche dans:**
- `ba_title`, `ba_content`, `ba_resume` (`__blog_advice`)
- `bg_title`, `bg_content` (`__blog_guide`)
- Operator SQL: `ilike` (case-insensitive)

**Performance:** p50: <200ms (Meilisearch), p95: <500ms

---

#### GET `/api/blog/article/by-gamme/:pg_alias`
Récupérer article par gamme (legacy URL support).

**Params:**
- `pg_alias`: Alias gamme (ex: 'alternateur')

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "advice_20",
    "type": "advice",
    "title": "Alternateur : Remplacement, Prix et Durée de Vie",
    "slug": "alternateur-remplacement-prix-duree-vie",
    "pg_alias": "alternateur",
    "pg_id": 20,
    "content": "...",
    "sections": [
      {
        "level": 2,
        "title": "Qu'est-ce qu'un alternateur ?",
        "content": "...",
        "anchor": "qu-est-ce-qu-un-alternateur"
      },
      {
        "level": 3,
        "title": "Fonctionnement de l'alternateur",
        "content": "...",
        "anchor": "fonctionnement-de-l-alternateur"
      }
    ],
    "relatedArticles": [...],
    "compatibleVehicles": [
      {
        "type_id": 123,
        "type_name": "FIAT PUNTO 1.2",
        "marque_name": "FIAT",
        "modele_name": "PUNTO",
        "marque_logo": "https://supabase.co/.../fiat-logo.svg",
        "modele_pic": "https://supabase.co/.../fiat-punto.webp",
        "catalog_url": "/pieces/alternateur-20/fiat-1/punto-2/123.html"
      }
    ]
  }
}
```

**Flux:**
1. Lookup `pieces_gamme` avec `pg_alias`
2. Query `__blog_advice` avec `ba_pg_id = pg_id`
3. Load H2/H3 sections (`__blog_advice_h2`, `__blog_advice_h3`)
4. Load articles croisés (`__blog_advice_cross`)
5. Load véhicules compatibles (`__cross_gamme_car_new` → `auto_type`/`auto_modele`/`auto_marque`)

**Performance:** p50: <400ms, p95: <1000ms (multi-table joins)

---

#### GET `/api/blog/article/:slug`
Récupérer article par slug.

**Params:**
- `slug`: Slug article (ex: 'comment-remplacer-alternateur')

**Response 200:** Même structure que `/article/by-gamme/:pg_alias`

**Erreurs:**
- 404: Article non trouvé

**Performance:** p50: <400ms, p95: <1000ms

---

#### GET `/api/blog/dashboard`
Tableau de bord statistiques.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalArticles": 86,
      "totalViews": 3600000,
      "totalAdvice": 85,
      "totalGuides": 1
    },
    "byType": {
      "advice": { "total": 85, "views": 3500000, "avgViews": 41176 },
      "guide": { "total": 1, "views": 100000, "avgViews": 100000 },
      "constructeur": { "total": 0, "views": 0, "avgViews": 0 },
      "glossaire": { "total": 0, "views": 0, "avgViews": 0 }
    },
    "popular": [...],
    "lastUpdated": "2025-11-18T10:00:00Z"
  }
}
```

**Cache:** Warm (TTL 1000s)

---

#### GET `/api/blog/popular`
Articles populaires.

**Query params:**
- `limit` (default: 10): Nombre résultats
- `type` (optional): 'advice' | 'guide' | 'constructeur' | 'glossaire'

**Response 200:**
```json
{
  "success": true,
  "data": {
    "articles": [
      {
        "id": "advice_45",
        "title": "Courroie de distribution : quand la changer ?",
        "viewsCount": 98432
      }
    ],
    "type": "all",
    "limit": 10,
    "total": 10
  }
}
```

**Tri:** `ba_visit DESC` (compteur vues)

---

#### GET `/api/blog/stats`
Statistiques générales.

**Response 200:** Même structure que `/dashboard`

---

#### GET `/api/blog/navigation`
Catégories et navigation.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "advice": {
      "keywords": [],
      "total": 85
    },
    "guide": {
      "byType": { "reparation": 1 },
      "total": 1
    },
    "constructeur": {
      "byLetter": [
        { "letter": "F", "count": 5 },
        { "letter": "V", "count": 3 }
      ],
      "total": 8
    },
    "glossaire": {
      "byLetter": [...],
      "total": 120
    }
  }
}
```

---

#### POST `/api/blog/refresh-cache`
Rafraîchir cache (admin seulement).

**Guards:** `AuthGuard('jwt')` (admin level ≥ 7)

**Body:**
```json
{
  "type": "global" | "advice" | "guide" | "constructeur"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Cache rafraîchi avec succès",
  "type": "global",
  "timestamp": "2025-11-18T10:00:00Z"
}
```

---

#### GET `/api/blog/seo-switches/:pg_id`
Switches SEO pour une gamme.

**Params:**
- `pg_id`: ID gamme (ex: 20)

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "sis_id": 123,
      "sis_pg_id": "20",
      "sis_alias": "symptomes",
      "sis_content": "<ul><li>Voyant batterie allumé</li>...</ul>"
    },
    {
      "sis_alias": "prix",
      "sis_content": "Le prix d'un alternateur varie de 150€ à 500€..."
    }
  ],
  "count": 2
}
```

**Source:** Table `__seo_item_switch`

---

#### GET `/api/blog/conseil/:pg_id`
Conseils de remplacement pour une gamme.

**Params:**
- `pg_id`: ID gamme (ex: 20)

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "title": "Quand remplacer ?",
      "content": "L'alternateur doit être remplacé tous les 150,000 km..."
    },
    {
      "title": "Comment détecter une panne ?",
      "content": "Symptômes principaux : voyant batterie, phares faibles..."
    }
  ]
}
```

**Source:** Table `__seo_gamme_conseil`

---

### 6.2 Advice (AdviceController)

#### GET `/api/blog/advice`
Lister tous les conseils avec filtres.

**Query params:**
- `page` (default: 1): Page courante
- `limit` (default: 20): Résultats par page
- `sortBy` (default: 'ba_update'): Champ tri ('ba_visit', 'ba_create', etc.)
- `order` (default: 'DESC'): Ordre tri

**Response 200:**
```json
{
  "success": true,
  "data": {
    "articles": [...],
    "total": 85,
    "page": 1,
    "totalPages": 5,
    "limit": 20
  }
}
```

---

#### GET `/api/blog/advice/:slug`
Détail d'un conseil.

**Response 200:** Même structure que `/api/blog/article/:slug`

---

#### GET `/api/blog/advice/stats`
Statistiques conseils.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "total": 85,
    "totalViews": 3600000,
    "avgViews": 42353,
    "mostPopular": [
      {
        "id": "advice_45",
        "title": "Courroie de distribution",
        "viewsCount": 98432
      }
    ]
  }
}
```

---

### 6.3 Advice Hierarchy (AdviceHierarchyController)

#### GET `/api/blog/advice-hierarchy`
Hiérarchie conseils par famille catalogue.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "hierarchy": {
      "moteur": {
        "name": "Moteur",
        "count": 25,
        "articles": [...]
      },
      "freinage": {
        "name": "Freinage",
        "count": 15,
        "articles": [...]
      }
    }
  }
}
```

---

### 6.4 Content (ContentController)

#### GET `/api/blog/guides`
Lister guides.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "articles": [...],
    "total": 1
  }
}
```

---

#### GET `/api/blog/constructeurs`
Lister constructeurs A-Z.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "byLetter": {
      "F": [
        { "id": "constructeur_1", "name": "FIAT", "slug": "fiat" }
      ],
      "V": [
        { "id": "constructeur_2", "name": "Volkswagen", "slug": "volkswagen" }
      ]
    }
  }
}
```

---

#### GET `/api/blog/glossaire`
Lister glossaire A-Z.

**Response 200:** Structure similaire constructeurs

---

## 7. Sécurité

### Authentification
- **Public endpoints** : Homepage, search, articles → `OptionalAuthGuard`
- **Admin endpoints** : Refresh cache → `AuthGuard('jwt')` + `IsAdminGuard`

### Sanitization HTML
```typescript
// HtmlContentSanitizerService
sanitize(html: string): string {
  // XSS protection: Remove <script>, <iframe>, event handlers
  return html
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '');
}
```

### Décodage HTML
```typescript
// BlogCacheService
static decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&eacute;/g, 'é')
    .replace(/&egrave;/g, 'è')
    // ... +50 entités HTML
}
```

### Protection CSRF
- POST endpoints requirent JWT token
- SameSite cookies: 'strict'

---

## 8. Performance

### Objectifs de performance

| Opération | p50 | p95 | p99 | Notes |
|-----------|-----|-----|-----|-------|
| Homepage | <300ms | <800ms | <1500ms | Cache hot (5000s TTL) |
| Article detail | <400ms | <1000ms | <2000ms | Multi-table joins (H2/H3, cross, vehicles) |
| Search | <200ms | <500ms | <1000ms | Meilisearch indexation |
| Dashboard | <250ms | <700ms | <1500ms | Cache warm (1000s TTL) |
| Popular | <150ms | <400ms | <800ms | Cache hot |
| Cache hit | <50ms | <100ms | <200ms | Redis lookup |

### Cache stratégies (3 niveaux)

#### 1. Hot cache (TTL: 5000s = 83 minutes)
Articles populaires, homepage featured.
```typescript
await blogCacheService.set('featured:3', articles, 5000);
```

#### 2. Warm cache (TTL: 1000s = 16 minutes)
Articles récents, dashboard.
```typescript
await blogCacheService.set('recent:6', articles, 1000);
```

#### 3. Cold cache (TTL: 600s = 10 minutes)
Listes générales, stats.
```typescript
await blogCacheService.set('categories', categories, 600);
```

### Optimisations DB

#### Indexes clés
```sql
CREATE INDEX idx_advice_alias ON __blog_advice(ba_alias);
CREATE INDEX idx_advice_pg_id ON __blog_advice(ba_pg_id);
CREATE INDEX idx_advice_visit ON __blog_advice(ba_visit);
CREATE INDEX idx_h2_ba_id ON __blog_advice_h2(ba2_ba_id);
CREATE INDEX idx_h3_ba2_id ON __blog_advice_h3(ba3_ba2_id);
CREATE INDEX idx_cross_ba_id ON __blog_advice_cross(bac_ba_id);
```

#### Pagination optimisée
```typescript
const offset = (page - 1) * limit;
query = query
  .order('ba_update', { ascending: false })
  .range(offset, offset + limit - 1);  // Limite résultats
```

#### Batch loading véhicules compatibles
```typescript
// 1 requête pour tous type_id
const { data: typesData } = await supabase
  .from('auto_type')
  .select('*')
  .in('type_id', typeIds)  // IN clause batch
  .limit(1000);

// Maps pour accès O(1)
const modelesMap = new Map(modelesData?.map(m => [m.modele_id, m]));
const marquesMap = new Map(marquesData?.map(m => [m.marque_id, m]));
```

---

## 9. Tests

### Tests unitaires

```typescript
// blog/services/blog.service.spec.ts
describe('BlogService', () => {
  let service: BlogService;
  let supabaseService: SupabaseIndexationService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BlogService,
        {
          provide: SupabaseIndexationService,
          useValue: {
            client: {
              from: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn(),
              }),
            },
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: { get: jest.fn(), set: jest.fn() },
        },
        BlogCacheService,
      ],
    }).compile();

    service = module.get<BlogService>(BlogService);
  });

  describe('getArticleBySlug', () => {
    it('devrait récupérer un article par slug', async () => {
      const mockAdvice = {
        ba_id: 20,
        ba_alias: 'alternateur-remplacement-prix',
        ba_title: 'Alternateur : Remplacement',
        ba_content: 'Contenu article...',
        ba_visit: '45231',
      };

      jest.spyOn(supabaseService.client, 'from').mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockAdvice, error: null }),
      } as any);

      const result = await service.getArticleBySlug('alternateur-remplacement-prix');

      expect(result).toBeDefined();
      expect(result.type).toBe('advice');
      expect(result.slug).toBe('alternateur-remplacement-prix');
      expect(result.viewsCount).toBe(45231);
    });

    it('devrait retourner null si article non trouvé', async () => {
      jest.spyOn(supabaseService.client, 'from').mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      } as any);

      const result = await service.getArticleBySlug('slug-inexistant');

      expect(result).toBeNull();
    });
  });

  describe('searchBlog', () => {
    it('devrait rechercher articles par query', async () => {
      const mockResults = [
        { ba_id: 20, ba_title: 'Alternateur', ba_visit: '45231' },
        { ba_id: 30, ba_title: 'Courroie alternateur', ba_visit: '12345' },
      ];

      jest.spyOn(supabaseService.client, 'from').mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: mockResults, count: 2 }),
      } as any);

      const result = await service.searchBlog('alternateur', { limit: 20 });

      expect(result.articles.length).toBe(2);
      expect(result.total).toBe(2);
      expect(result.articles[0].title).toContain('Alternateur');
    });
  });

  describe('getArticleByGamme', () => {
    it('devrait récupérer article par gamme alias', async () => {
      const mockGamme = { pg_id: 20, pg_name: 'Alternateur', pg_alias: 'alternateur' };
      const mockAdvice = {
        ba_id: 20,
        ba_alias: 'alternateur-remplacement',
        ba_pg_id: '20',
        ba_title: 'Alternateur : Remplacement',
      };

      // Mock gamme lookup
      jest.spyOn(supabaseService.client, 'from').mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockGamme, error: null }),
      } as any);

      // Mock advice lookup
      jest.spyOn(supabaseService.client, 'from').mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockAdvice, error: null }),
      } as any);

      const result = await service.getArticleByGamme('alternateur');

      expect(result).toBeDefined();
      expect(result.pg_alias).toBe('alternateur');
      expect(result.pg_id).toBe(20);
    });
  });

  describe('getCompatibleVehicles', () => {
    it('devrait charger véhicules compatibles', async () => {
      const mockCrossData = [
        { cgc_type_id: '123', cgc_level: 1 },
        { cgc_type_id: '456', cgc_level: 1 },
      ];

      jest.spyOn(supabaseService.client, 'from').mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: mockCrossData, error: null }),
      } as any);

      // Mock auto_type, auto_modele, auto_marque...
      // (simplifié pour l'exemple)

      const result = await service.getCompatibleVehicles(20, 1000, 'alternateur');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
```

### Tests d'intégration

```typescript
// blog/controllers/blog.controller.spec.ts (e2e)
describe('BlogController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [BlogModule, SearchModule, CacheModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  describe('GET /api/blog/homepage', () => {
    it('devrait retourner la homepage', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/blog/homepage')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.featured).toBeDefined();
      expect(response.body.data.recent).toBeDefined();
      expect(response.body.data.popular).toBeDefined();
      expect(response.body.data.stats.totalArticles).toBeGreaterThan(0);
    });
  });

  describe('GET /api/blog/search', () => {
    it('devrait rechercher articles', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/blog/search')
        .query({ q: 'alternateur', limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.articles).toBeDefined();
      expect(response.body.data.total).toBeGreaterThan(0);
    });

    it('devrait échouer sans query', async () => {
      await request(app.getHttpServer())
        .get('/api/blog/search')
        .expect(400);  // Bad Request
    });
  });

  describe('GET /api/blog/article/by-gamme/:pg_alias', () => {
    it('devrait récupérer article par gamme', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/blog/article/by-gamme/alternateur')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pg_alias).toBe('alternateur');
      expect(response.body.data.sections).toBeDefined();
      expect(response.body.data.compatibleVehicles).toBeDefined();
    });

    it('devrait retourner 404 si gamme inexistante', async () => {
      await request(app.getHttpServer())
        .get('/api/blog/article/by-gamme/gamme-inexistante')
        .expect(404);
    });
  });

  describe('GET /api/blog/dashboard', () => {
    it('devrait retourner dashboard stats', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/blog/dashboard')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.overview.totalArticles).toBeGreaterThan(0);
      expect(response.body.data.byType.advice.total).toBeGreaterThan(0);
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
  imports: [
    CacheModule.register({
      ttl: 3600,
      max: 2000,
      isGlobal: false,
    }),
    SearchModule, // Meilisearch + Supabase
  ],
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
    "@supabase/supabase-js": "^2.38.4",
    "he": "^1.2.0"
  }
}
```

### Services externes
- **Supabase PostgreSQL** : 10 tables `__blog_*`
- **Redis** : Cache 3 niveaux
- **Meilisearch** : Indexation recherche
- **Supabase Storage** : CDN images

### Variables d'environnement
```bash
# .env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
REDIS_URL=redis://localhost:6379
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_API_KEY=xxx
```

---

## 11. Critères d'acceptation

### Fonctionnels
- ✅ **Homepage** affiche 3 featured + 6 recent + 5 popular
- ✅ **Recherche** trouve articles dans titre/contenu/résumé
- ✅ **Article detail** charge H2/H3 sections hiérarchiques
- ✅ **Legacy URL** `/conseil/{pg_alias}` fonctionne
- ✅ **Articles croisés** chargés depuis `__blog_advice_cross`
- ✅ **Véhicules compatibles** assemblés (type + modèle + marque)
- ✅ **SEO switches** récupérés par `pg_id`
- ✅ **Conseils gamme** récupérés par `pg_id`
- ✅ **Dashboard** affiche stats 4 types (advice, guide, constructeur, glossaire)
- ✅ **Articles populaires** triés par `ba_visit DESC`
- ✅ **Décodage HTML** automatique (entités, caractères spéciaux)
- ✅ **Sanitization** XSS protection (script, iframe removed)

### Non-fonctionnels
- ✅ **Performance** :
  - Homepage: p50 <300ms
  - Article detail: p50 <400ms
  - Search: p50 <200ms
- ✅ **Cache** :
  - Hit ratio >80%
  - TTL adaptatif (hot 5000s, warm 1000s, cold 600s)
- ✅ **SEO** :
  - Meta tags dynamiques (title, description, keywords)
  - URL rewrites legacy
  - Breadcrumbs ariane
- ✅ **Tests** :
  - Couverture >80% services
  - Tests e2e endpoints principaux

---

## 12. Déploiement

### Configuration production

```bash
# .env.production
SUPABASE_URL=https://prod.supabase.co
SUPABASE_SERVICE_ROLE_KEY=prod-key
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=prod-redis-password
MEILISEARCH_HOST=http://meilisearch:7700
MEILISEARCH_API_KEY=prod-key
NODE_ENV=production
```

### Cache configuration
```typescript
// blog.module.ts
CacheModule.register({
  ttl: 3600,        // 1h default
  max: 2000,        // Max 2000 articles en cache
  isGlobal: false,  // Cache spécifique au module
})
```

### Health check
```bash
# Vérifier homepage
curl https://api.example.com/api/blog/homepage

# Vérifier recherche
curl "https://api.example.com/api/blog/search?q=alternateur&limit=10"

# Vérifier cache Redis
redis-cli
> KEYS blog:*
> GET blog:homepage
```

---

## 13. Documentation associée

- [Search Module](./search-module.md) - Meilisearch indexation
- [Database Module](../../database/DATABASE.md) - Supabase client
- [Cache Module](../../cache/CACHE.md) - Redis strategies
- [Auth Module](./auth-module.md) - OptionalAuthGuard
- [Admin Module](./admin-module.md) - Refresh cache endpoint

---

## 14. Problèmes connus

### 1. Compteur vues (ba_visit) stocké en TEXT au lieu INTEGER
**Impact:** Moyen  
**Workaround:** `parseInt(ba_visit, 10)` dans transformations

### 2. ba_pg_id stocké en TEXT au lieu INTEGER
**Impact:** Moyen  
**Workaround:** Conversion explicite pour lookups `pieces_gamme`

### 3. Articles sans sections H2/H3 (certains anciens)
**Impact:** Faible  
**Workaround:** `sections: []` si aucune section trouvée

### 4. Images CDN parfois manquantes (anciens articles)
**Impact:** Faible  
**Workaround:** `featuredImage: null` si fichier inexistant

### 5. Véhicules compatibles assemblage lent (1000+ véhicules)
**Impact:** Moyen  
**Workaround:** Limite 1000 véhicules max, cache warm 1000s TTL

---

## 15. Améliorations futures

### Phase 2 - Q1 2026
- [ ] **Commentaires utilisateurs** : Système commentaires modérés
- [ ] **Notes articles** : 5 étoiles, reviews
- [ ] **Editeur WYSIWYG** : Interface admin CKEditor
- [ ] **Gestion médias** : Upload/crop images depuis admin
- [ ] **Versioning** : Draft/published workflow

### Phase 3 - Q2 2026
- [ ] **Multilingue (i18n)** : Anglais, Espagnol, Italien
- [ ] **Newsletters** : Intégration articles récents
- [ ] **Podcasts/vidéos** : Support contenu multimédia
- [ ] **Analytics avancées** : Heatmaps, scroll depth
- [ ] **A/B testing** : Test titres, images

### Optimisations techniques
- [ ] **Meilisearch full integration** : Remplacer recherche SQL par Meilisearch
- [ ] **CDN images lazy loading** : Optimisation bande passante
- [ ] **AMP pages** : Version mobile ultra-rapide
- [ ] **JSON-LD schema.org** : Rich snippets Google
- [ ] **Sitemap auto-génération** : Daily cron job

---

**Dernière mise à jour:** 2025-11-18  
**Version:** 1.0.0  
**Auteur:** Équipe Backend  
**Statut:** ✅ Production  
**Articles:** 85+ conseils, 3.6M+ vues cumulées
