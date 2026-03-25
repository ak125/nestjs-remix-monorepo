# Frontend Architecture (Remix)

## Stack

- SSR Remix (flat routes), React Query (server state), Zustand (client state), Conform.js + Zod (forms)
- API services dans `frontend/app/services/api/`, fetch natif, base URL `http://localhost:3000`

## Routes

`_index.tsx` (home), `admin.*` (dashboard), `panier.*` (cart), `pieces.*` (catalogue), `api.*` (API Remix)

## UI Convention (IMPORTANT)

- **shadcn/ui** depuis `~/components/ui/` + **Tailwind CSS** uniquement + **lucide-react** pour icones
- Ne PAS importer `React` (JSX transform moderne)
- Ne PAS utiliser inline styles ou CSS modules

```typescript
// Correct
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { ChevronDown } from 'lucide-react';
<div className="flex items-center gap-3 p-4">
```

## SEO

- DynamicSeoV4UltimateService : meta, OG, Twitter, JSON-LD, breadcrumbs
- Sitemap V2 : 3 niveaux, 50k URLs/fichier, sharding, GZIP, 1M+ URLs
- Tables : `__seo_*`, `__blog_*`, RPC functions

## Making Changes

Edit `frontend/app/`, Vite HMR, composants dans `frontend/app/components/`
