# Layout System - Automecanik

> **Extraction Date:** 2026-01-29
> **Scope:** Layout architecture observed without judgment

---

## 1. Root Structure

**File:** `frontend/app/root.tsx`

```
<html lang="fr" class="h-full">
  <body class="h-full bg-gray-100">
    <div class="min-h-screen flex flex-col">
      <header> <!-- HeaderV8Enhanced --> </header>
      <main class="flex-grow"> <!-- Outlet --> </main>
      <footer> <!-- Footer --> </footer>
    </div>
  </body>
</html>
```

**Providers:**
- VehicleProvider (vehicle context persistence)
- NotificationProvider (global notifications)
- Sonner Toaster (toast notifications)

---

## 2. Shells / Layout Components

### LayoutUnified
**File:** `frontend/app/components/layout/LayoutUnified.tsx`

**Purpose:** Modular layout system supporting Core/Massdoc layouts

**Props:**
- `showHeader` - Toggle header visibility
- `showFooter` - Toggle footer visibility
- `modular sections` - Dynamic section insertion
- `editable mode` - Admin editing capability

---

## 3. Header Structure

**Primary:** `frontend/app/components/layout/HeaderV8Enhanced.tsx`

### Desktop (lg:)
```
┌────────────────────────────────────────────────────────────┐
│ TOP BAR: phone | email | social_links | user_stats         │
│ bg-gray-100 border-b                                       │
├────────────────────────────────────────────────────────────┤
│ MAIN HEADER: logo (120x48) | search_bar | nav | actions    │
│ bg-white shadow-md                                         │
├────────────────────────────────────────────────────────────┤
│ SECONDARY NAV: flattened children (max 6)                  │
│ bg-gray-50 border-b hidden lg:block                        │
└────────────────────────────────────────────────────────────┘
```

### Mobile (< lg)
```
┌────────────────────────────────────────────────────────────┐
│ TOP BAR: (reduced version)                                 │
├────────────────────────────────────────────────────────────┤
│ MAIN: logo | [search icon] [user] [cart] [menu hamburger]  │
├────────────────────────────────────────────────────────────┤
│ EXPANDABLE SEARCH: md:hidden p-4                           │
├────────────────────────────────────────────────────────────┤
│ MOBILE MENU: sidebar with nested children                  │
└────────────────────────────────────────────────────────────┘
```

---

## 4. Footer Structure

**File:** `frontend/app/components/Footer.tsx`

### Desktop
```css
bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900
```

**Grid:** `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8`

| Column 1 | Column 2 | Column 3 | Column 4 |
|----------|----------|----------|----------|
| About | Links | Legal | Contact |
| description | catalog | CGV | address |
| social icons | brands | privacy | phone |
|  | blog | cookies | email |
|  | contact | legal | hours |

### Mobile
```css
md:hidden overflow-x-auto px-3 py-2 flex gap-4
```
- Horizontal scroll with FooterLinkItem (icon + label)

---

## 5. Containers

### Max Widths Observed
| Token | Usage |
|-------|-------|
| `max-w-7xl` | Main content (most common) |
| `max-w-6xl` | Blog/sections |
| `max-w-4xl` | Narrow content |
| `max-w-md` | Card layouts |

### Padding Pattern
```
container mx-auto px-4 sm:px-6 lg:px-8
```

| Breakpoint | Horizontal | Vertical |
|------------|------------|----------|
| Mobile | px-4 | py-4 |
| Tablet (sm:) | px-6 | py-6 |
| Desktop (lg:) | px-8 | py-8, py-12 |

---

## 6. Grid Systems

### Footer Grid
```css
grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8
```

### Product Grid (PiecesGrid)
- Dynamic columns based on density toggle
- useMemo for filtered/sorted items
- Responsive: 1 → 2 → 3 → 4 columns

### Blog Grid
```css
grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4
```

### KPI Grid (Admin)
```css
grid grid-cols-2 md:grid-cols-4 gap-4
```

---

## 7. Navigation Components

| Component | File | Role |
|-----------|------|------|
| DynamicMenu | `navigation/DynamicMenu.tsx` | Mega menu |
| NavbarMobile | `navbar/NavbarMobile.tsx` | Mobile nav |
| TopBar | `navbar/TopBar.tsx` | Info bar |
| PromoBar | `navbar/PromoBar.tsx` | Promo banner |
| CartSidebar | `navbar/CartSidebar.tsx` | Cart drawer |

---

## 8. Sidebar Patterns

### Admin Sidebar
**File:** `frontend/app/components/AdminSidebar.tsx`
- Fixed width
- Desktop: visible
- Mobile: hidden or drawer

### Filter Sidebar (PLP/PDP)
**File:** `frontend/app/components/pieces/PiecesFilterSidebar.tsx`
- Desktop: `hidden lg:block w-64`
- Mobile: Sheet/Drawer trigger

---

## 9. Sticky Elements

| Element | Position | Breakpoint |
|---------|----------|------------|
| MobileStickyBar | `fixed bottom-0` | Mobile only |
| Header | `sticky top-0` | All |
| Table of Contents | `sticky top-20` | Desktop |
| AddToCart CTA | `fixed bottom-4` | Mobile PDP |

---

## 10. Z-Index Stack

| Layer | z-index | Elements |
|-------|---------|----------|
| Base | 0 | Content |
| Elevated | z-10 | Cards, raised |
| Dropdown | z-20-30 | Menus |
| Sticky | z-40 | Headers |
| Modal | z-50 | Overlays, drawers |

---

## Summary

**Architecture Pattern:** Flex column layout (header > main > footer) with max-w containers

**Responsive Strategy:** Mobile-first with lg: breakpoint for desktop sidebars

**Key Observation:** Two-column layout for content pages (sidebar + main) with sidebar hidden on mobile and triggered via Sheet component
