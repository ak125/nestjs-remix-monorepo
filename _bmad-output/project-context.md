---
project_name: 'automecanik'
user_name: 'Deploy'
date: '2026-01-06'
sections_completed: ['technology_stack', 'critical_rules', 'patterns']
existing_patterns_found: 23
---

# Project Context for AI Agents

_Ce fichier contient les regles critiques et patterns que les agents IA doivent suivre lors de l'implementation du code dans ce projet. Focus sur les details non-evidents que les agents pourraient manquer._

---

## Technology Stack & Versions

### Core Stack

| Couche | Technologie | Version |
|--------|-------------|---------|
| **Frontend** | Remix + React | 2.15.0 + 18.3.1 |
| **Backend** | NestJS | 10.4.20 |
| **Database** | Supabase (PostgreSQL) | SDK 2.83.0 |
| **Cache** | Redis + ioredis | 7.x / 5.8.2 |
| **UI** | Tailwind + shadcn/ui + Radix | 3.4.15 |
| **Build** | Turbo + Vite | 2.2.3 + 5.4.11 |
| **Runtime** | Node.js | 20.x |
| **Validation** | Zod + nestjs-zod | 3.24.1 / 4.3.1 |

### Backend Dependencies

| Package | Version | Usage |
|---------|---------|-------|
| `@nestjs/passport` | 10.0.3 | Auth strategies |
| `@nestjs/jwt` | 11.0.1 | JWT tokens admin |
| `express-session` | 1.17.3 | Sessions utilisateurs |
| `bcrypt` | 6.0.0 | Password hashing |
| `sharp` | 0.34.3 | Image processing |
| `meilisearch` | 0.52.0 | Search engine |
| `bullmq` | 5.63.0 | Job queues |

### Frontend Dependencies

| Package | Version | Usage |
|---------|---------|-------|
| `@tanstack/react-query` | 5.87.1 | Server state |
| `zustand` | 5.0.7 | Client state |
| `@conform-to/react` | 1.13.1 | Form validation |
| `lucide-react` | 0.462.0 | Icons |
| `recharts` | 3.1.2 | Charts |
| `sonner` | 2.0.7 | Toast notifications |

---

## Critical Implementation Rules

### R1: Architecture 3-Tier (OBLIGATOIRE)

```
Controller (HTTP Layer) → Service (Business Logic) → DataService (Supabase SDK)
```

- **INTERDIT** : Acces DB direct depuis Controller
- **INTERDIT** : Logic metier dans DataService
- Chaque module suit : `*.controller.ts` → `*.service.ts` → `*-data.service.ts`

### R2: Supabase SDK Direct (PAS de Prisma)

```typescript
// ✅ CORRECT
const { data, error } = await this.supabase
  .from('pieces')
  .select('*')
  .eq('piece_id', id);

// ❌ INTERDIT
const product = await prisma.product.findUnique({ where: { id } });
```

### R3: Conventions Colonnes Supabase

| Table | Prefixe colonnes | Exemple |
|-------|------------------|---------|
| `pieces_gamme` | `pg_*` | pg_id, pg_name, pg_alias |
| `pieces_marque` | `pm_*` | pm_id, pm_name, pm_logo |
| `auto_marque` | `marque_*` | marque_id, marque_name |
| `catalog_family` | `mf_*` | mf_id, mf_name |
| `catalog_gamme` | `mc_*` | mc_pg_id, mc_mf_id |

**Attention** : Ne PAS confondre `pieces_marque` (pm_*) et `auto_marque` (marque_*)

### R4: Sessions Redis + Passport

- Cookie : `connect.sid` (HttpOnly, SameSite: lax)
- TTL : 30 jours
- Redis obligatoire (pas de sessions en memoire)
- Admin : JWT tokens (24h expiry)

### R5: Validation Zod

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateOrderSchema = z.object({
  userId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().positive(),
  })),
});

export class CreateOrderDto extends createZodDto(CreateOrderSchema) {}
```

### R6: Paiements HMAC

| Gateway | Algorithme | Env vars |
|---------|------------|----------|
| Paybox (prod) | HMAC-SHA512 | `PAYBOX_HMAC_KEY` |
| SystemPay (test) | HMAC-SHA256 | `SYSTEMPAY_CERTIFICATE_*` |

### R7: Tests (curl + Playwright)

| Type | Outil | Commande |
|------|-------|----------|
| API | curl | `curl localhost:3000/api/... \| jq` |
| E2E | Playwright | `npm run test:a11y` |
| Composants | @testing-library/react | Via Playwright |

**INTERDIT** : Jest, Vitest

---

## Code Patterns

### NestJS Module Structure

```
src/modules/{feature}/
├── {feature}.module.ts
├── controllers/
│   └── {feature}.controller.ts
├── services/
│   ├── {feature}.service.ts
│   └── {feature}-data.service.ts
├── interfaces/
│   └── {feature}.interface.ts
└── dto/
    └── {feature}.dto.ts
```

### Supabase Service Pattern

```typescript
@Injectable()
export class MyService extends SupabaseBaseService {
  constructor(private readonly cacheService: RedisCacheService) {
    super();
  }

  async getData(): Promise<MyData> {
    return this.cacheService.cached(
      'cache:key',
      () => this.fetchData(),
      3600, // TTL 1h
      'namespace',
    );
  }

  private async fetchData(): Promise<MyData> {
    const { data, error } = await this.supabase
      .from('my_table')
      .select('*');

    if (error) {
      this.logger.error('Erreur:', error);
      throw new BadRequestException('Erreur');
    }
    return data;
  }
}
```

### Remix Route Pattern

```typescript
// Loader (server-side)
export async function loader({ request, params }: LoaderFunctionArgs) {
  const data = await fetch(`${API_URL}/api/...`);
  return json({ data });
}

// Meta SEO
export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data?.product?.name },
  { name: 'description', content: data?.product?.description },
];

// Component
export default function MyRoute() {
  const { data } = useLoaderData<typeof loader>();
  return <div className="flex items-center gap-4">...</div>;
}
```

### UI Components (shadcn/ui)

```typescript
// ✅ CORRECT
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { ChevronDown } from 'lucide-react';

// ❌ INTERDIT - pas d'import React pour composants fonctionnels
import React from 'react';

// ✅ CORRECT - Tailwind classes
<div className="flex items-center gap-3 p-4 bg-white rounded-lg border">

// ❌ INTERDIT - inline styles
<div style={{ display: 'flex' }}>
```

---

## Git Workflow

### Branches

- `main` = production (deploy automatique)
- Validation manuelle **OBLIGATOIRE** avant push main

### Commit Format

```bash
git commit -m "$(cat <<'EOF'
feat: description courte

Details si necessaire.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

### CI/CD

- Runner : self-hosted Linux
- Pipeline : Lint → TypeCheck → Build → Deploy
- Trigger : push sur `main` uniquement

---

## Environment Variables

### Backend (.env)

```env
PORT=3000
NODE_ENV=development|production
DATABASE_URL=postgresql://...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
REDIS_URL=redis://localhost:6379
SESSION_SECRET=...
PAYBOX_SITE=...
PAYBOX_HMAC_KEY=...
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

---

## AI-COS Governance

### Axiome Zero

```
L'IA NE CREE PAS LA VERITE.
Elle produit. Elle analyse. Elle propose.
LA VERITE EST VALIDEE PAR : Structure + Humain.
```

### Truth Levels RAG

| Level | Description | Validation |
|-------|-------------|------------|
| L1 | Donnees Supabase | Automatique |
| L2 | Docs valides | Quality Officer |
| L3 | Calculs derives | Tests + Review |
| L4 | Contenu genere | Humain obligatoire |

### Kill Switches

| Switch | Trigger | Action |
|--------|---------|--------|
| `AI_PROD_WRITE=false` | Defaut prod | Bloque ecriture IA |
| `RAG_GATING` | Score < 0.70 | Refuse reponse |

---

_Genere par BMad Method v6.0.0-alpha.22_
_Date: 2026-01-06_
