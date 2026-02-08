# UI Audit — Page Véhicule (PDP)

**File:** `frontend/app/routes/constructeurs.$brand.$model.$type.tsx`
**Route:** `/constructeurs/:brand/:model/:type.html`
**Date:** 2026-01-29
**Scope:** UI-only (JSX + Tailwind + shadcn). No loader/action/meta changes.
**Lines:** 1619

---

## Summary

| Metric | Score |
|--------|-------|
| **Global** | **6.8/10** |
| Mobile-first | 7.0 |
| Responsive | 8.0 |
| Touch UX | 6.5 |
| E-commerce UX | 7.5 |
| A11y | 6.0 |
| Design System | 5.5 |
| Readability | 8.0 |

---

## Hard Rule Violations (4 violations)

| Rule | Line | Severity | Description |
|------|------|----------|-------------|
| **HR-001** | 847 | ⚠️ Medium | Grid sans base mobile: `grid lg:grid-cols-[...]` |
| **HR-001** | 1443 | ⚠️ Medium | Grid sans base mobile: `grid grid-cols-2` |
| **HR-008** | 867-903 | ❌ High | **4 emojis utilisés comme icônes** (⛽⚡📅🚗) |
| **HR-006** | 1484, 1505 | ⚠️ Medium | `hidden sm:flex` sans alternative accessible |

---

## Détail des Violations

### HR-001: Grid Mobile-First (2 violations)

**Ligne 847** — Hero Grid
```tsx
// ❌ ACTUEL
<div className="grid lg:grid-cols-[minmax(0,1fr)_400px] gap-8">

// ✅ FIX
<div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-6 lg:gap-8">
```

**Ligne 1443** — Trust Badges Grid
```tsx
// ❌ ACTUEL
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">

// ✅ FIX
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
```

### HR-008: Emoji Icons (CRITIQUE)

**Lignes 867-903** — Specs badges utilisent des emojis au lieu de lucide-react

```tsx
// ❌ ACTUEL (4 violations)
<span className="text-lg">⛽</span>  // Ligne 867
<span className="text-xl">⚡</span>  // Ligne 878
<span className="text-lg">📅</span>  // Ligne 893
<span className="text-base">🚗</span> // Ligne 903

// ✅ FIX - Utiliser lucide-react (déjà importé!)
import { Fuel, Zap, Calendar, Car } from 'lucide-react';

<Fuel className="w-5 h-5" />      // Carburant
<Zap className="w-6 h-6" />       // Puissance
<Calendar className="w-5 h-5" />  // Période
<Car className="w-5 h-5" />       // Carrosserie
```

**Note:** Les icônes lucide-react sont DÉJÀ importées ligne 36! C'est une régression.

### HR-006: Hidden No Alternative

**Lignes 1484, 1505** — Contenu masqué sans texte alternatif
```tsx
// ❌ ACTUEL
<div className="hidden sm:flex items-center gap-3">
<a href="/contact" className="hidden md:flex ...">

// ✅ FIX - Ajouter sr-only ou s'assurer que le contenu est accessible autrement
```

---

## Soft Rule Warnings (7 warnings)

| Rule | Count | Impact | Description |
|------|-------|--------|-------------|
| SR-001 | 15+ | Medium | Couleurs gray-* au lieu de sémantiques |
| SR-003 | 3 | Low | Inline styles (lignes 828-839) |
| SR-010 | 5+ | Medium | Boutons sans focus:visible explicite |
| SR-012 | 1 | Medium | Pas de skeleton loading pour catalogue |
| SR-014 | 4+ | Low | Tailles de boutons inconsistantes (py-2, py-3, p-5) |
| SR-015 | 10+ | Low | Textes sans responsive (text-sm sans sm:text-base) |

---

## Points Positifs ✅

1. **CTA Sticky Mobile** (lignes 1480-1513)
   - `fixed bottom-0 left-0 right-0 z-50` ✅
   - Animation `slide-in-from-bottom` ✅
   - Apparaît après scroll (400px) ✅

2. **Grids Mobile-First** (majorité)
   - Ligne 990: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` ✅
   - Ligne 1163: idem ✅
   - Ligne 1278: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` ✅

3. **Images avec Alt**
   - Ligne 927: Alt descriptif complet ✅
   - Ligne 1017, 1199: Alt présent ✅

4. **Truncate pour texte long**
   - `line-clamp-1`, `line-clamp-2` utilisés ✅

5. **Responsive Typography** (partiel)
   - Ligne 852: `text-2xl sm:text-3xl lg:text-4xl` ✅

6. **lucide-react déjà importé**
   - 16 icônes importées (ligne 20-35) ✅

---

## Top Risks (Mobile)

1. **[HIGH]** Emojis comme icônes — Rendu inconsistant entre devices/OS
2. **[MEDIUM]** Trust badges 2 colonnes forcées sur mobile < 375px
3. **[MEDIUM]** Hero grid sans stack mobile explicite

---

## Quick Wins

| ID | Impact | Effort | Description |
|----|--------|--------|-------------|
| QW-1 | HIGH | LOW | Remplacer 4 emojis par lucide-react (déjà importé!) |
| QW-2 | MEDIUM | LOW | Ajouter `grid-cols-1` aux 2 grids non-conformes |
| QW-3 | LOW | LOW | Remplacer `gray-*` par couleurs sémantiques |

---

## Patches Recommandés

### PATCH-001: Fix Emoji Icons (HIGH PRIORITY)

```diff
- <span className="text-lg">⛽</span>
+ <Fuel className="w-5 h-5 text-white/90" />

- <span className="text-xl">⚡</span>
+ <Zap className="w-6 h-6 text-white" />

- <span className="text-lg">📅</span>
+ <Calendar className="w-5 h-5 text-white/90" />

- <span className="text-base">🚗</span>
+ <Car className="w-5 h-5 text-white/90" />
```

### PATCH-002: Fix Hero Grid Mobile-First

```diff
- <div className="grid lg:grid-cols-[minmax(0,1fr)_400px] gap-8 items-start">
+ <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8 items-start">
```

### PATCH-003: Fix Trust Badges Grid

```diff
- <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
+ <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
```

---

## Block Map (Sections Principales)

```
Page: VehicleDetailPage
├── [NAV] Breadcrumb (769-824) ✅ OK
├── [SECTION] Hero (826-958)
│   ├── [BLOCK] Header/H1 (851-860) ✅ Responsive
│   ├── [BLOCK] Specs Badges (862-908) ❌ HR-008 (emojis)
│   └── [BLOCK] Vehicle Image (910-955) ✅ OK
├── [SECTION] SEO Content (961-968) ✅ OK
├── [SECTION] Catalog Families (970-1123)
│   └── [GRID] Family Cards (990) ✅ Mobile-first
├── [SECTION] Popular Parts (1125-1258)
│   └── [GRID] Part Cards (1163) ✅ Mobile-first
├── [SECTION] Specs Table (1260-1356)
│   └── [GRID] Spec Items (1278) ✅ Mobile-first
├── [SECTION] FAQ (1358-1429) ✅ Accordion OK
├── [SECTION] Trust Badges (1441-1477)
│   └── [GRID] Badge Cards (1443) ⚠️ HR-001
├── [STICKY] CTA Bar (1480-1513) ✅ Mobile-first
└── [FOOTER] Page Footer (1515-1563) ✅ OK
```

---

## Calibration Rules Feedback

| Rule | Precision | Notes |
|------|-----------|-------|
| HR-001 | 100% | Détecte bien les grids sans base |
| HR-008 | 100% | Emojis Unicode détectés |
| HR-006 | 80% | Faux positif possible si contenu dupliqué ailleurs |
| SR-001 | 90% | Beaucoup de gray-* légitimes (borders) |

---

## Verdict

**Score: 6.8/10** — Page globalement bien structurée avec de bons patterns mobile-first, mais **4 violations critiques** (emojis) et **2 grids non-conformes**.

**Action immédiate:** Corriger HR-008 (emojis → lucide-react) — 5 minutes de travail.
