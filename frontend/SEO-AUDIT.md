# 📊 AUDIT SEO - État des lieux

## ✅ Déjà en place

### 1. **SEOHelmet.tsx** (/components/ui/SEOHelmet.tsx)
- ✅ Meta tags (title, description, keywords)
- ✅ Canonical URLs
- ✅ Open Graph (Facebook)
- ✅ Twitter Cards
- ✅ Schema.org JSON-LD basique (Product, Brand, AggregateOffer)
- ✅ Hook `useVehicleSEO()` pour véhicules
- ⚠️ **Limites:** 
  - Pas de Review schema
  - Pas de BreadcrumbList schema
  - Pas d'Organization schema global

### 2. **Breadcrumbs.tsx** (/components/layout/Breadcrumbs.tsx)
- ✅ Fil d'Ariane visuel
- ✅ Génération automatique depuis URL
- ✅ Icônes et séparateurs
- ✅ Responsive
- ❌ **Manque:** Schema.org BreadcrumbList JSON-LD

### 3. **Images lazy loading**
- ✅ OptimizedImage.tsx avec `loading="lazy"` natif
- ✅ Utilisé dans plusieurs pages (blog, produits)
- ⚠️ **Manque:** Lazy hydration des composants React (pas juste images)

### 4. **Canonical & Robots**
- ✅ Canonical URLs dans SEOHelmet
- ✅ Robots meta tags dans plusieurs routes
- ✅ Logique noindex pour marques (marque_relfollow)
- ⚠️ **Manque:** 
  - Gestion facettes indexables (filtres)
  - Règles canoniques pour pagination/tri

### 5. **Schema.org existant**
- ✅ AutoPartsStore (page d'accueil)
- ✅ Product basique
- ✅ AggregateOffer
- ⚠️ **Manque:**
  - Review + AggregateRating
  - Organization globale
  - ItemList pour listings
  - FAQPage (existe mais non utilisé systématiquement)

---

## 🔧 À améliorer/créer

### Priorité HAUTE

1. **Enrichir SEOHelmet avec schemas manquants**
   - ✅ Product → Ajouter Review, AggregateRating
   - ➕ Organization (entreprise)
   - ➕ BreadcrumbList (fil d'ariane SEO)
   - ➕ ItemList (listings produits)
   - ➕ Offer avec stock/prix temps réel

2. **Ajouter schema BreadcrumbList à Breadcrumbs.tsx**
   - JSON-LD automatique quand breadcrumbs affichés

3. **Lazy hydration composants React**
   - Sections avis (non critiques)
   - Produits similaires
   - Footer
   - Scripts analytics

### Priorité MOYENNE

4. **Canonical URLs + Facettes**
   - Helper génération URL canoniques
   - Règles facettes indexables (max 2-3 filtres)
   - Pagination rel="next/prev"

5. **Meta generator par type**
   - Template meta pour gammes
   - Template meta pour pièces
   - Template meta pour marques
   - Variables dynamiques (nom, prix, stock)

### Priorité BASSE

6. **Sitemap dynamique**
   - Route /sitemap.xml
   - Génération auto depuis DB
   - Sitemap index (multi-fichiers si >50k URLs)

---

## 📋 Recommandation

**Approche progressive:**

1. **Phase 1** (30min) - Enrichir l'existant
   - Ajouter Review/AggregateRating à SEOHelmet
   - Ajouter BreadcrumbList schema à Breadcrumbs
   - Créer Organization schema global

2. **Phase 2** (45min) - Lazy hydration
   - Créer LazySection component (Suspense + lazy)
   - Wrapper sections non-critiques (avis, similaires)

3. **Phase 3** (1h) - Canonical + Meta
   - Helper canonicalUrl avec règles facettes
   - Meta templates par type (gamme, pièce, marque)

4. **Phase 4** (optionnel) - Sitemap
   - Route sitemap.xml dynamique

---

**Voulez-vous :**
- A) Enrichir l'existant (Phase 1)
- B) Créer lazy hydration (Phase 2)  
- C) Tout faire (Phases 1+2+3)
- D) Autre priorité ?
