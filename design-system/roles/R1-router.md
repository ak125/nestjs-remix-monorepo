# R1 - Router/Navigation Page (Pack Urgence)

> Intent: Selection | Flow: Quick Navigation + Filtering

## Overview

R1 (Router) pages help users find the right product category or refine their selection. The user knows what they need but hasn't found the exact product yet.

**Primary Goal:** Fast, efficient navigation to the right product with minimal friction.

## Page Structure

### Above Fold

1. **Vehicle Selector Bar**
   - Current vehicle context
   - Change vehicle CTA
   - Quick filters (brand, model, type)

2. **Filter Sheet** (Mobile) / **Sidebar** (Desktop)
   - Category filters
   - Price range
   - Brand filter
   - Availability

3. **Active Filter Chips**
   - Visual representation of active filters
   - Quick remove (X button)

### Content Area

4. **Result Cards Grid**
   - Product cards with:
     - Image thumbnail
     - Product name
     - Price range
     - Compatibility indicator
   - Grid: 2 cols mobile, 3-4 cols desktop

5. **Sort Dropdown**
   - Relevance (default)
   - Price: Low to High
   - Price: High to Low
   - Popularity

### Below Fold

6. **Pagination / Infinite Scroll**
   - Load more button
   - Page numbers

7. **SEO Content Section**
   - Category description
   - FAQ accordion
   - Internal links

## Design Tokens

### Colors (Pack Urgence)

```css
--r1-primary: #1A1A1A;
--r1-secondary: #FF9500;
--r1-cta: #FF3B30;
--r1-background: #F5F5F5;
--r1-accent: #FF6B35;
```

### Typography

```css
--r1-heading: 'Archivo Black', sans-serif;
--r1-body: 'Source Sans Pro', sans-serif;
--r1-mono: 'JetBrains Mono', monospace;
```

### Key Dimensions

```css
--r1-filter-width: 280px; /* Desktop sidebar */
--r1-card-min-width: 160px;
--r1-card-gap: 16px;
```

## Components

| Component | Purpose |
|-----------|---------|
| VehicleSelectorBar | Vehicle context + change |
| FilterSheet | Mobile filter drawer |
| FilterSidebar | Desktop filter sidebar |
| ActiveFilterChips | Active filter display |
| ResultCard | Product preview card |
| SortDropdown | Sort options |

## Required Elements

- [ ] Vehicle context visible
- [ ] Filter access above fold
- [ ] Active filters displayed
- [ ] Result count visible
- [ ] Sort options accessible
- [ ] Clear pagination

## Forbidden Elements

- [ ] Product specifications (save for R2)
- [ ] Reviews section
- [ ] Purchase CTAs
- [ ] Long marketing content above grid
- [ ] Auto-play videos

## Effects

### Pulse CTA (Urgence)
```css
animation: pulse-cta 1.5s infinite;
```

### Fast Transitions
```css
transition: all 150ms ease-out;
```

### Hover Scale
```css
transform: scale(1.02);
```

## Performance Targets

| Metric | Target | Priority |
|--------|--------|----------|
| LCP | ≤ 2500ms | Blocking |
| CLS | ≤ 0.05 | Blocking |
| INP | ≤ 200ms | Monitoring |

### Critical Path

1. Vehicle selector bar
2. First 6-8 result cards
3. Filter access
4. Pagination

## Accessibility

- Filter labels associated with inputs
- Grid navigation with arrow keys
- Clear focus indicators
- Announce result count to screen readers

## Mobile Considerations

- Filter sheet (bottom drawer)
- Sticky vehicle bar
- Infinite scroll option
- Pull-to-refresh

## Example URLs

```
/pieces/freinage/
/pieces/filtration/renault/
/pieces/embrayage/peugeot/208/
```

## Version

- **Version:** 2.0.0
- **Flow Pack:** urgence
- **Last Updated:** 2026-01-28
