# Frontend Architecture (Remix)

## SSR with Remix

- Server-side rendering for SEO and performance
- Route-based code splitting (flat routes pattern)
- Loaders for server-side data fetching
- Actions for form submissions

## State Management

- Server state: React Query (TanStack)
- Client state: Zustand stores
- Form state: Conform.js + Zod validation

## API Communication

- Services in `frontend/app/services/api/`
- Native fetch with error handling
- Base URL: `http://localhost:3000` (same port as backend)

## Key Routes Pattern

```
app/routes/
├── _index.tsx                    # Homepage
├── admin.*/                      # Admin dashboard routes
├── panier.*/                     # Cart pages
├── pieces.*.tsx                  # Product catalog routes
└── api.*.ts                      # API routes (handled by Remix)
```

## UI Components Convention

**IMPORTANT: Use shadcn/ui + Tailwind CSS**
- Always use `shadcn/ui` components from `~/components/ui/` (not raw HTML or custom components)
- Style with Tailwind CSS utility classes only
- Icons: Use `lucide-react` (already installed)
- Do NOT import `React` unless using class components or specific React APIs (hooks don't need it)

**Component imports:**
```typescript
// Correct - use shadcn/ui
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { ChevronDown, ChevronUp } from 'lucide-react';

// Wrong - don't import React for functional components
import React from 'react';  // Not needed with modern JSX transform
```

**Styling:**
```typescript
// Correct - Tailwind classes
<div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200">

// Wrong - inline styles or CSS modules
<div style={{ display: 'flex' }}>
```

## Remix Loaders

```typescript
// Server-side data fetching
export async function loader({ request, params }: LoaderFunctionArgs) {
  const productId = params.productId;
  const product = await fetch(`${API_URL}/api/products/${productId}`);
  return json({ product });
}

// Meta tags for SEO
export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data.product.name },
  { name: "description", content: data.product.description }
];
```

## SEO Architecture (Advanced)

**DynamicSeoV4UltimateService:**
- 180% more variables than original
- Dynamic meta descriptions, Open Graph, Twitter cards
- Structured data (Schema.org JSON-LD)
- Breadcrumbs with internal linking

**Sitemap System (V2 Scalable):**
- 3-level hierarchy: Index -> Sub-indices -> Final sitemaps
- 50k URL limit per file (Google requirement)
- Sharding strategies: alphabetic, numeric, temporal
- GZIP compression for large sitemaps
- Supports 1M+ URLs with intelligent caching

**Key SEO Tables:**
- `__seo_*` prefix for dynamic content
- `__blog_*` for blog/guides/advice content
- RPC functions for efficient querying

## Making Changes

- Edit files in `frontend/app/`
- Vite provides HMR (instant updates)
- Remix handles routing, loaders, actions
- Components in `frontend/app/components/`

## Testing Strategy

**API Testing (curl):**
- Tester les endpoints directement avec curl
- Utiliser jq pour parser les réponses JSON
- Scripts de test dans `backend/scripts/` si nécessaire

**Tests manuels recommandés:**
```bash
curl http://localhost:3000/health
curl -s http://localhost:3000/api/catalog/families | jq '.data | length'
curl -s "http://localhost:3000/pieces/freinage" | grep -o '<title>[^<]*</title>'
```
