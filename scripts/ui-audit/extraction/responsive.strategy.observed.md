# Responsive Strategy - Automecanik

> **Extraction Date:** 2026-01-29
> **Scope:** Responsive implementation observed without judgment

---

## 1. Breakpoints Usage

### Defined (Tailwind Config)
| Breakpoint | Min-Width | Usage Count |
|------------|-----------|-------------|
| sm | 640px | 234 |
| md | 768px | 189 |
| lg | 1024px | 156 |
| xl | 1280px | 45 |
| 2xl | 1536px | 12 |

### Distribution
- Mobile (base): **67%** of responsive patterns
- Tablet (sm/md): **19%**
- Desktop (lg+): **14%**

---

## 2. Mobile-First vs Desktop-First

**Observed Approach:** Mobile-First

### Evidence
```css
/* Pattern observed */
grid-cols-1 sm:grid-cols-2 lg:grid-cols-4

/* NOT observed */
grid-cols-4 lg:grid-cols-2 sm:grid-cols-1
```

### Base Styles (Mobile)
- Single column layouts
- Full-width containers
- Hidden secondary navigation
- Collapsed menus

---

## 3. Grid Patterns

### Observed Progressions
| Pattern | Count | Example |
|---------|-------|---------|
| 1 → 2 → 4 | High | Product grids |
| 1 → 2 | Medium | Footer, forms |
| 1 → 3 | Low | Stats cards |
| 1 → 4 | Low | Blog grid |

### Most Common
```css
grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4
```

---

## 4. Flex Patterns

### Navigation
```css
/* Mobile: column/hidden */
flex flex-col lg:flex-row
hidden lg:flex
```

### Content
```css
/* Stack on mobile, row on desktop */
flex flex-col md:flex-row gap-4
```

---

## 5. Visibility Toggles

### Mobile-Only Elements
```css
lg:hidden
md:hidden
```
- Mobile navigation menu
- Mobile sticky bar
- Simplified headers

### Desktop-Only Elements
```css
hidden lg:block
hidden md:flex
```
- Secondary navigation
- Full search bar
- Filter sidebars
- Table views (vs card views)

---

## 6. Sidebars Strategy

### Desktop
```css
hidden lg:block w-64
```
- Fixed width sidebar
- Always visible on lg+

### Mobile
```css
lg:hidden
```
- Sheet/Drawer component
- Triggered by button
- Full-screen overlay

### Pattern Files
- `PiecesFilterSidebar.tsx`: Desktop sidebar, mobile drawer
- `AdminSidebar.tsx`: Same pattern
- `CartSidebar.tsx`: Drawer on all sizes

---

## 7. Tables vs Cards

### Observed Pattern
```jsx
{/* Desktop: Table */}
<div className="hidden lg:block">
  <Table>...</Table>
</div>

{/* Mobile: Cards */}
<div className="lg:hidden">
  <CardView>...</CardView>
</div>
```

### Files with This Pattern
- `OrdersTable.tsx` / mobile cards
- `AuditTable.tsx` / mobile cards
- `MotorisationsTable.tsx` / mobile cards

### Inconsistencies Noted
Some tables use `overflow-x-auto` without mobile cards fallback

---

## 8. Typography Responsive

### Headings
```css
text-xl sm:text-2xl lg:text-3xl
text-sm sm:text-base
```

### Body Text
```css
text-sm md:text-base
text-xs sm:text-sm
```

### Fluid Typography (Observed)
```css
clamp(1rem, 0.95rem + 0.25vw, 1.125rem)
```

---

## 9. Spacing Responsive

### Padding
```css
px-4 sm:px-6 lg:px-8
py-4 md:py-6 lg:py-8
```

### Gaps
```css
gap-3 sm:gap-4 lg:gap-6
gap-4 md:gap-6
```

### Margins
```css
mb-4 md:mb-6
mt-6 lg:mt-8
```

---

## 10. Touch Targets

### Button Heights Observed
| Size | Tailwind | Pixels | Mobile Safe |
|------|----------|--------|-------------|
| h-8 | 32px | Yes | No |
| h-9 | 36px | Yes | Borderline |
| h-10 | 40px | Yes | Close |
| h-11 | 44px | Yes | Yes |
| h-12 | 48px | Yes | Recommended |

### Observation
Mixed usage of h-10 and h-11 for CTAs

---

## 11. Drawers & Modals

### Mobile Drawers
**Component:** Sheet (from shadcn/ui)

```jsx
<Sheet>
  <SheetTrigger className="lg:hidden">...</SheetTrigger>
  <SheetContent side="left">...</SheetContent>
</Sheet>
```

**Usage:**
- Mobile navigation
- Filter sidebar
- Cart sidebar

### Dialogs
**Component:** Dialog (from shadcn/ui)

```jsx
<Dialog>
  <DialogTrigger>...</DialogTrigger>
  <DialogContent className="max-w-lg">...</DialogContent>
</Dialog>
```

---

## 12. Sticky Elements

### Header
```css
sticky top-0 z-50 bg-white
```

### Mobile CTA Bar
```css
fixed bottom-0 left-0 right-0 z-50
lg:hidden
```

### Table of Contents
```css
sticky top-20 hidden lg:block
```

---

## 13. Images

### Responsive Images
```jsx
<img 
  className="w-full h-auto"
  srcSet="..."
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
/>
```

### Aspect Ratios
```css
aspect-square
aspect-video
aspect-[4/3]
```

---

## 14. Inconsistencies Detected

### 1. Grid Without Mobile Base
```css
/* Observed but not mobile-first */
grid-cols-4 gap-4
```
**Expected:** `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`

### 2. Tables Without Mobile Fallback
Some `<Table>` components without `lg:hidden` wrapper and card alternative

### 3. Sidebar Without Drawer
Some `<aside className="hidden lg:block">` without mobile Sheet trigger

### 4. Touch Targets
Mix of h-8, h-9, h-10 for buttons (not consistent h-11)

---

## Summary

| Aspect | Status |
|--------|--------|
| Mobile-First | Yes |
| Breakpoint Usage | sm > md > lg > xl > 2xl |
| Grid Strategy | 1 → 2 → 4 columns |
| Sidebar Pattern | hidden lg:block + Sheet |
| Table Pattern | Mixed (some have cards, some don't) |
| Touch Targets | Inconsistent (h-8 to h-12) |
| Typography | Partially fluid |
| Spacing | Consistent progressive scaling |
