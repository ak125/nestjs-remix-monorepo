---
scope: Ops / Cycle breaking recipes
audience: human + Claude
sources:
  - audit-reports/phase0-baseline.json
  - npm run audit:madge
  - npm run audit:graph  (génère audit-reports/dep-graph.json)
last_scan: 2026-04-24
---

# Cycle Resolution Playbook

Baseline 2026-04-24 : **17 cycles** dans le monorepo (16 backend + 1 frontend).
Ce playbook donne les patterns concrets pour casser chaque catégorie.

## Avant de commencer

Regénérer la vue courante :
```bash
npm run audit:madge            # liste des 17 cycles en texte
npm run audit:graph            # export audit-reports/dep-graph.json (graphe complet)
```

Le JSON `dep-graph.json` peut être :
- parsé dans un script perso pour analyse programmatique
- chargé dans un tool externe (miserables.js, cytoscape.js, d3-graphviz) pour viz
- importé dans Gephi via conversion intermédiaire

Si Graphviz est installé localement (pas le cas sur le VPS DEV) :
```bash
# Installation (local/laptop uniquement)
sudo apt install graphviz           # Linux
brew install graphviz                # macOS

# Rendu SVG depuis le JSON (via script simple)
node -e "
const g = require('./audit-reports/dep-graph.json');
const lines = ['digraph G {'];
for (const [src, deps] of Object.entries(g)) {
  for (const d of deps) lines.push('  \"'+src+'\" -> \"'+d+'\";');
}
lines.push('}');
console.log(lines.join('\n'));
" > audit-reports/dep-graph.dot
dot -Tsvg audit-reports/dep-graph.dot > audit-reports/dep-graph.svg
```

## Pattern 1 — Cycle fortuit par types partagés

**Signal** : 2 fichiers qui s'importent mutuellement **uniquement pour des types**
(pas de logique runtime).

**Exemple réel** (baseline ligne 1) :
```
config/role-ids.ts ↔ workers/types/content-refresh.types.ts
```

**Solution** : extraire les types dans un 3ᵉ fichier neutre.

```typescript
// AVANT
// config/role-ids.ts
import type { RefreshableRole } from '../workers/types/content-refresh.types';
export const ROLE_IDS: RefreshableRole[] = [...];

// workers/types/content-refresh.types.ts
import { ROLE_IDS } from '../../config/role-ids';
export type RefreshableRole = typeof ROLE_IDS[number];   // << cycle

// APRÈS
// shared/types/role-ids.types.ts    ← NEW
export type RoleId = 'R0' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'R8';
export type RefreshableRole = RoleId;

// config/role-ids.ts
import type { RoleId } from '../shared/types/role-ids.types';
export const ROLE_IDS: RoleId[] = ['R0', ...];

// workers/types/content-refresh.types.ts
export type { RefreshableRole } from '../../shared/types/role-ids.types';
```

Effort : **~30 min par cycle**.

## Pattern 2 — Cycle par direction canonique inversée

**Signal** : 2 modules cohérents hiérarchiquement où le parent importe l'enfant
AU LIEU de l'inverse.

**Exemple réel** (baseline ligne 9) :
```
auth/auth.module ↔ modules/users/users.module
```

Dans l'architecture AutoMecanik, `users` devrait dépendre de `auth` (un user
est authentifié), pas l'inverse. Le cycle indique que `auth.module` a importé
quelque chose de `users.module` qu'il ne devrait pas (probablement un type
`User` ou un service utilisé dans un guard).

**Solution** :
1. Identifier ce que `auth` importe depuis `users`
2. Deux options :
   - **Déplacer** cette chose dans `auth` (si elle est core-auth)
   - **Extraire** dans un 3ᵉ module `shared/user-types` ou similaire

```typescript
// AVANT
// auth/auth.module.ts
import { UsersModule } from '../modules/users/users.module';  // cycle
import { UserEntity } from '../modules/users/entities/user.entity';

// APRÈS — option A (déplacer UserEntity dans auth)
// auth/entities/user.entity.ts
export class UserEntity { ... }

// modules/users/users.module.ts
import { UserEntity } from '../../auth/entities/user.entity';  // direction OK
```

Effort : **~1-2h par cycle** (nécessite relocation + update imports).

## Pattern 3 — Cycle intra-module orchestrateur ↔ workers

**Signal** : plusieurs services d'un même module qui s'importent mutuellement
pour former un pipeline orchestré.

**Exemple réel** (baseline lignes 6-7) :
```
rag-proxy/services/rag-cleanup.service ↔ rag-gamme-detection.service ↔ rag-knowledge.service
rag-proxy/rag-proxy.service ↔ services/rag-ingestion.service ↔ rag-redis-job.service
```

**Solution** : inversion de dépendance via `interfaces/`.

1. Identifier les méthodes "publiques" appelées cross-service
2. Créer `rag-proxy/interfaces/*.ts` avec ces signatures
3. Les services implémentent l'interface, s'injectent par interface
4. L'orchestrateur reçoit les interfaces en constructeur

```typescript
// AVANT
// rag-proxy/rag-proxy.service.ts
import { RagIngestionService } from './services/rag-ingestion.service';
import { RagRedisJobService } from './services/rag-redis-job.service';

// rag-ingestion.service.ts
import { RagProxyService } from '../rag-proxy.service';    // cycle

// APRÈS
// rag-proxy/interfaces/rag-ingestion.port.ts    ← NEW
export interface RagIngestionPort {
  ingest(doc: Doc): Promise<void>;
}

// rag-proxy/interfaces/rag-proxy.port.ts        ← NEW
export interface RagProxyPort {
  emit(event: string, payload: unknown): void;
}

// rag-ingestion.service.ts
import { RagProxyPort } from '../interfaces/rag-proxy.port';
@Injectable()
export class RagIngestionService implements RagIngestionPort {
  constructor(@Inject('RagProxyPort') private readonly proxy: RagProxyPort) {}
}
```

Effort : **~3-4h par cluster** (plusieurs fichiers impliqués, tests à adapter).

## Pattern 4 — Cycle intra-module "frère" (acceptable)

**Signal** : 2 services du même dossier qui s'appellent mutuellement par
conception (orchestration bidirectionnelle cohérente).

**Exemples réels acceptés** :
```
admin/services/admin-gammes-seo ↔ gamme-detail-enricher
admin/services/stock-management ↔ stock-movement, stock-report
blog/services/advice ↔ advice-enrichment
```

**Décision** : **ne pas casser**. Documenter dans `cleanup-targets.md` avec
status `wontfix (acceptable intra-module orchestration)`.

Ces cycles traduisent un pattern "un service principal + des spécialisations
qui peuvent s'invoquer mutuellement". C'est du code métier, pas une dette.

Si un jour une règle `no-circular` passe à severity `error`, ajouter ces
cycles en exclusion explicite dans `.dependency-cruiser.cjs` avec commentaire.

## Pattern 5 — Cycle frontend Remix SSR

**Signal** : `root.tsx` ↔ `hooks/useRootData.ts`.

C'est le pattern typique Remix pour accéder aux loaders depuis n'importe quel
composant. **Acceptable et documenté** ; même les templates officiels Remix
ont ce cycle.

**Décision** : laisser.

## Ordre recommandé pour attaque

1. **Pattern 1 (fortuit types)** — 3 cycles → 3 PRs simples de ~30 min chacune
2. **Pattern 2 (direction inversée)** — 2 cycles → 2 PRs de ~1-2h chacune
3. **Pattern 3 (intra-module pipeline)** — 1 cluster rag-proxy → ADR + PR lourde (après décision archi)
4. **Pattern 4 + 5 (acceptables)** — documenter wontfix

## Checklist PR "cycle fix"

Pour chaque PR cassant un cycle :

- [ ] `npm run audit:madge` **AVANT** — capturer le count
- [ ] Refactor (pattern approprié)
- [ ] `npm run audit:madge` **APRÈS** — count doit avoir diminué
- [ ] `npm run build` + `npm test` passent
- [ ] `npm run audit:baseline` — vérifier 0 régression ailleurs
- [ ] Mettre à jour `.claude/knowledge/ops/cleanup-targets.md` (status → `done-pr#XXX`)
- [ ] Après merge, refresh `audit-reports/phase0-baseline.json` (cycles -= N)

## Références

- Baseline : `audit-reports/phase0-baseline.json`
- Backlog : `.claude/knowledge/ops/cleanup-targets.md`
- Runbook delete : `.claude/knowledge/ops/safe-delete-procedure.md`
- Tool : `npm run audit:madge` / `npm run audit:graph`
