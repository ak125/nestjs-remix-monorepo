# R2 - Product/Expert Page (Pack Confiance)

> Intent: Purchase | Flow: Trust-First + Compatibility

## Overview

R2 (Product) pages are the conversion engine. The user has already selected a product category; now they need confidence to purchase.

**Primary Goal:** Build trust through verified compatibility, OEM references, and social proof before the purchase CTA.

## Page Structure

### Above Fold (Critical)

1. **Compatibility Hero**
   - Badge: "Compatible" / "Non compatible" / "Vérifier"
   - Vehicle context displayed (if known)
   - Resolution CTA if unknown: "Vérifier en 10s"

2. **Trust Badges Row**
   - Verified seller badge
   - Return policy
   - Secure payment
   - Delivery estimate

3. **Sticky CTA Bar**
   - Price (prominent)
   - Add to cart button (verified green)
   - Quantity selector

### Below Fold

4. **OEM References Section**
   - Original manufacturer numbers
   - Copy-to-clipboard functionality
   - Equivalence list

5. **Reviews Section**
   - Star rating
   - Review count
   - Recent reviews (3-5)

6. **Compatibility Sheet**
   - Full vehicle compatibility table
   - Filterable by brand/model

7. **Related Products**
   - "Souvent achetés ensemble"
   - Alternative products

## Design Tokens

### Colors (Pack Confiance)

```css
--r2-primary: #1D1D1F;
--r2-secondary: #007AFF;
--r2-cta: #34C759;
--r2-background: #FAFAFA;
--r2-accent: #FF6B35;
```

### Typography

```css
--r2-heading: 'Montserrat', sans-serif;
--r2-body: 'DM Sans', sans-serif;
--r2-mono: 'JetBrains Mono', monospace;
```

### Key Dimensions

```css
--r2-hero-height: auto; /* Content-driven */
--r2-sticky-height: 72px;
--r2-card-radius: 12px;
--r2-badge-radius: 6px;
```

## Components (V2)

| Component | File | Purpose |
|-----------|------|---------|
| ProductStickyCTAV2 | `expert/ProductStickyCTAV2.tsx` | Sticky add-to-cart bar |
| CompatibilityBadgeV2 | `expert/CompatibilityBadgeV2.tsx` | Compatibility status + resolver |
| CompatibilitySheetV2 | `expert/CompatibilitySheetV2.tsx` | Full compatibility table |
| TrustRowV2 | `expert/TrustRowV2.tsx` | Trust badges row |
| CompatibilityResolverModal | `expert/CompatibilityResolverModal.tsx` | 10s resolution modal |

## Required Elements

- [ ] Compatibility badge above fold
- [ ] Trust badges visible without scroll
- [ ] Price visible above fold
- [ ] CTA button in sticky bar
- [ ] OEM references with copy button
- [ ] At least 3 reviews displayed

## Forbidden Elements

- [ ] Heavy navigation menus
- [ ] Catalog grids (save for R1)
- [ ] Multiple competing CTAs
- [ ] Intrusive popups
- [ ] Marketing banners above product

## Effects

### Verified Animation
```css
animation: verified-appear 200ms ease-out;
```

### Compatibility Check
```css
/* On verify button click */
animation: shake-verify 150ms ease;
```

### Hover States
```css
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
transition: box-shadow 200ms ease-out;
```

## Performance Targets

| Metric | Target | Priority |
|--------|--------|----------|
| LCP | ≤ 2500ms | Blocking |
| CLS | ≤ 0.05 | Blocking |
| INP | ≤ 200ms | Monitoring |

### Critical Path

1. Hero image (optimized, srcset)
2. Compatibility badge
3. Price + CTA
4. Trust badges

## Accessibility

- Contrast ratio: 4.5:1 minimum
- Touch targets: 44x44px minimum
- Focus states visible
- Screen reader: product name, price, availability

## Mobile Considerations

- Sticky CTA at bottom (thumb zone)
- Collapsible sections for specs
- Swipeable image gallery
- Sheet-based compatibility resolver

## Schema.org

```json
{
  "@type": "Product",
  "name": "...",
  "sku": "...",
  "offers": {
    "@type": "Offer",
    "price": "...",
    "availability": "InStock"
  }
}
```

## Example

```
/pieces/plaquette-de-frein-402/renault-140/megane-iii-140049/1-5-dci-100413.html
```

## Version

- **Version:** 2.0.0
- **Flow Pack:** confiance
- **Last Updated:** 2026-01-28
