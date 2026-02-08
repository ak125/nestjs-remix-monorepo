# Page Roles System - DCO V2

> 1 URL = 1 Role = 1 Intent

## Overview

The Page Role System ensures each URL has a single, clear purpose. This prevents keyword cannibalization, improves SEO, and creates focused user experiences.

## Role Hierarchy

| Role | Code | Intent | Primary Action | Example URLs |
|------|------|--------|----------------|--------------|
| Router | R1 | Selection | Navigate/Filter | `/pieces/freinage/` |
| Product | R2 | Purchase | Add to Cart | `/pieces/plaquette-de-frein/...html` |
| Blog | R3 | Education | Read/Learn | `/blog-pieces-auto/article/...` |
| Reference | R4 | Definition | Understand | `/reference-auto/abs/` |
| Diagnostic | R5 | Diagnosis | Diagnose Problem | `/diagnostic-auto/bruit-freinage/` |
| Support | R6 | Help | Get Assistance | `/contact`, `/cgv` |

## Role Compliance Rules

### Forbidden Blocks (NEVER include)

| Role | Forbidden |
|------|-----------|
| R1 (Router) | Product specs, reviews, purchase CTAs |
| R2 (Product) | Heavy navigation, catalog grids |
| R3 (Blog) | Aggressive sales CTAs above fold |
| R4 (Reference) | Filters, prices, cart buttons |
| R5 (Diagnostic) | Catalog grids, product listings |
| R6 (Support) | Marketing content, promotions |

### Required Blocks (MUST include)

| Role | Required |
|------|----------|
| R1 (Router) | Filters, navigation, result cards, breadcrumbs |
| R2 (Product) | Trust badges, CTA, compatibility, specs, price |
| R3 (Blog) | Content, reading time, author, date |
| R4 (Reference) | Structured data, schema.org, definitions |
| R5 (Diagnostic) | Wizard steps, symptom inputs, solutions |
| R6 (Support) | Contact info, FAQ, legal text |

## Technical Implementation

### Frontend Attribute

Each page must declare its role:

```tsx
<main data-page-role="R2" data-page-intent="purchase">
```

### Backend Validation

```typescript
// page-role.types.ts
export enum PageRole {
  R1 = 'R1', // Router
  R2 = 'R2', // Product
  R3 = 'R3', // Blog
  R4 = 'R4', // Reference
  R5 = 'R5', // Diagnostic
  R6 = 'R6', // Support
}
```

### Database Schema

```sql
-- In __ux_captures and __ux_debt
page_role TEXT CHECK (page_role IN ('R1', 'R2', 'R3', 'R4', 'R5', 'R6'))
```

## Files

- [R1-router.md](./R1-router.md) - Router/Navigation pages
- [R2-expert.md](./R2-expert.md) - Product/Expert pages (Pack Confiance)
- [R3-blog.md](./R3-blog.md) - Blog/Education pages
- [R4-reference.md](./R4-reference.md) - Reference/Definition pages
- [R5-diagnostic.md](./R5-diagnostic.md) - Diagnostic/Symptom pages
- [R6-support.md](./R6-support.md) - Support/Help pages

## Violations

Role violations are tracked in `__ux_debt` table with:
- `issue_type: 'role_violation'`
- `severity: 'high'`
- `category: 'compliance'`

## Version

- **Version:** 2.0.0
- **Last Updated:** 2026-01-28
