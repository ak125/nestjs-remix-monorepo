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

### Colors

Colors come from `packages/design-tokens/src/tokens.json`, by role, never as raw values (P44 of `.claude/governance/journal-des-principes.md`). Navy and orange are the brand colors. Orange marks the one primary action per screen, with navy text; other actions are outlined. Red is for errors and destructive actions only.

### Typography

Outfit for headings, DM Sans for body text, Roboto Mono for codes the user copies, from the tokens (P46). Every weight used is loaded.

### Key Dimensions

Desktop sidebar width, minimum card width and card gap come from the tokens (P46); none is hard-coded.

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

Every effect below stops when the user asks for reduced motion (`prefers-reduced-motion: reduce`, P45). Durations and shadows come from the tokens (P46).

### Pulse CTA (Urgence)
A pulse on the primary action, with its duration from the tokens.

### Fast Transitions
```css
transition: all var(--transition-fast) ease-out;
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
