---
title: "Stack Technique AI-COS v2.0"
status: draft
version: 2.0.0
authors: [DevOps Team, Architecture Team]
created: 2025-11-19
updated: 2025-11-19
relates-to:
  - ../workflows/ai-cos-workflow.md
  - ../features/ai-cos-operating-system.md
  - ../architecture/006-ai-cos-enrichment.md
tags: [ai-cos, stack, architecture, best-practices, technical]
---

# Stack Technique AI-COS v2.0

## Principes Directeurs

**Directive technique fondamentale** : Toujours utiliser les **meilleures pratiques modernes, approches stables et éprouvées**.

### Piliers Architecturaux

- ✅ **Stabilité** : Technologies LTS (Node 20 LTS → 2026-04), battle-tested patterns
- ✅ **Modernité** : Standards 2024/2025, TypeScript 5.6+, ESM natives
- ✅ **Scalabilité** : Horizontal scaling, stateless services, event-driven
- ✅ **Sécurité** : Zero Trust, defense in depth, OWASP Top 10
- ✅ **Maintenabilité** : DX-first, type-safety 100%, tests >85%
- ✅ **Observabilité** : Distributed tracing, structured logging, SLO/SLI

---

## Vue d'Ensemble Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                    AI-COS ARCHITECTURE v2.0                           │
│                  (Event-Driven + 3-Tiers Moderne)                     │
└──────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 1 : PRESENTATION (Remix + Progressive Enhancement)           │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐   ┌──────────────┐   ┌─────────────────┐         │
│  │  Dashboard  │   │  Admin Panel │   │  API Explorer   │         │
│  │  /admin/    │   │  /admin/     │   │  /api/docs      │         │
│  │  ai-cos/*   │   │  settings    │   │  (OpenAPI 3.1)  │         │
│  └─────────────┘   └──────────────┘   └─────────────────┘         │
│         │                  │                    │                   │
│         └──────────────────┴────────────────────┘                   │
│              Remix SSR + Client Hydration                           │
│              (Server-First, Progressive Enhancement)                │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                    HTTP/REST + WebSocket
                             │
┌────────────────────────────┼────────────────────────────────────────┐
│  LAYER 2 : APPLICATION (NestJS + CQRS + Event Sourcing)             │
├────────────────────────────┼────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │           API Gateway + Controllers (REST/WS)                 │  │
│  │  /api/ai-cos/* → Health, KPIs, Actions, Agents, Simulations  │  │
│  └────────────────────┬─────────────────────────────────────────┘  │
│                       │                                             │
│  ┌────────────────────┴──────────────────────────────────────────┐ │
│  │              ORCHESTRATEUR IA-CEO v2                          │ │
│  │           (Event Bus Redis + SAGA Pattern)                    │ │
│  └───┬──────────────┬──────────────┬─────────────┬──────────────┘ │
│      │              │              │             │                 │
│  ┌───▼────┐   ┌────▼────┐   ┌────▼───┐   ┌─────▼────┐           │
│  │ Code   │   │ Infra   │   │Business│   │ Support  │           │
│  │ Quality│   │ Squad   │   │ Squad  │   │ Squad    │           │
│  │ (6 ag.)│   │ (5 ag.) │   │(16 ag.)│   │ (15 ag.) │           │
│  └────────┘   └─────────┘   └────────┘   └──────────┘           │
│      │              │              │             │                 │
│      └──────────────┴──────────────┴─────────────┘                 │
│           ┌─────────▼──────────┐                                   │
│           │   Services Layer   │                                   │
│           │ (Repository Pattern│                                   │
│           │  + Dependency DI)  │                                   │
│           └─────────┬──────────┘                                   │
└─────────────────────┼───────────────────────────────────────────────┘
                      │
          Database Access + Cache
                      │
┌─────────────────────┼───────────────────────────────────────────────┐
│  LAYER 3 : DATA (Supabase + Redis + Vector DB)                      │
├─────────────────────┼───────────────────────────────────────────────┤
│  ┌──────────────────▼─────────────┐   ┌──────────────────────┐    │
│  │   PostgreSQL (Supabase)        │   │   Redis Cluster      │    │
│  │  • ai_cos_snapshots            │   │  • KPIs cache (5min) │    │
│  │  • ai_cos_actions              │   │  • Event Bus pub/sub │    │
│  │  • ai_cos_simulations          │   │  • BullMQ queues     │    │
│  │  • ai_cos_monitoring_events    │   │  • Session store     │    │
│  │  • RLS enabled                 │   └──────────────────────┘    │
│  │  • PgBouncer pooling           │   ┌──────────────────────┐    │
│  └────────────────────────────────┘   │  Vector DB (pgvector)│    │
│                                        │  • Agent embeddings  │    │
│                                        │  • Similarity search │    │
│                                        └──────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  OBSERVABILITY (OpenTelemetry + Prometheus + Grafana)               │
├─────────────────────────────────────────────────────────────────────┤
│  Tracing → Spans → Correlation IDs → SLO/SLI → Alerting            │
└─────────────────────────────────────────────────────────────────────┘
```

**Pattern** : Event-Driven CQRS + SAGA orchestration

---

## 1. Backend Stack (NestJS)

### Technologies Core

| Composant | Version | Justification |
|-----------|---------|---------------|
| **Node.js** | v20.18 LTS | Support → 2026-04-30 |
| **NestJS** | v10.4.20 | Enterprise-grade, DI, modulaire |
| **TypeScript** | v5.6+ | Strict mode, type-safety 100% |
| **Zod** | v3.24+ | Validation runtime, schemas partagés |
| **pnpm** | v9.15+ | Monorepo performant |

### Patterns Architecture

#### 1. Clean Architecture + DDD

```
packages/ai-cos-core/
├── domain/              # Entités (agnostic framework)
│   ├── agent.entity.ts
│   └── action.entity.ts
├── application/         # Use cases
│   ├── commands/        # CQRS Write
│   └── queries/         # CQRS Read
├── infrastructure/      # Implémentation
│   ├── repositories/
│   └── event-bus/
└── presentation/        # Controllers
```

#### 2. CQRS Pattern

```typescript
// Command Handler
@CommandHandler(ValidateActionCommand)
export class ValidateActionHandler {
  async execute(cmd: ValidateActionCommand) {
    const action = await this.repo.findById(cmd.actionId);
    action.validate(cmd.approved, cmd.validatedBy);
    await this.repo.save(action);
    await this.eventBus.publish(new ActionValidatedEvent(action));
  }
}
```

#### 3. Repository Pattern

```typescript
@Injectable()
export class ActionRepository {
  async findById(id: string): Promise<Action> {
    const { data } = await this.supabase
      .from('ai_cos_actions')
      .select('*')
      .eq('id', id)
      .single();
    return Action.fromPersistence(data);
  }
}
```

#### 4. Event Sourcing

```typescript
export class RedisEventBus {
  async publish(event: DomainEvent) {
    const channel = `ai-cos:events:${event.type}`;
    await this.redis.publish(channel, JSON.stringify({
      id: event.id,
      timestamp: event.occurredOn,
      data: event.data,
      metadata: { correlationId: event.correlationId },
    }));
    await this.storeEvent(event); // Immutable audit
  }
}
```

#### 5. Validation (Zod)

```typescript
// Schema partagé frontend/backend
export const ActionSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string().min(1),
  description: z.string().min(10).max(500),
  risk: z.number().int().min(0).max(100),
  budget: z.number().nonnegative(),
  status: z.enum(['pending', 'approved', 'rejected']),
});

export type Action = z.infer<typeof ActionSchema>;
```

---

## 2. Frontend Stack (Remix)

### Technologies Core

| Composant | Version | Justification |
|-----------|---------|---------------|
| **Remix** | v2.15.0 | Server-First, Web Standards |
| **React** | v18.3.1 | Concurrent features |
| **Vite** | v6.0+ | Fast HMR, optimized builds |
| **shadcn/ui** | Latest | Composants accessibles |

### Patterns Best Practices

#### 1. Progressive Enhancement

```typescript
// Server: Loader (SEO-friendly)
export async function loader() {
  const health = await getHealthBoard();
  return json(health, {
    headers: { 'Cache-Control': 'private, max-age=60' },
  });
}

// Client: Component (works without JS)
export default function Board() {
  const { health } = useLoaderData<typeof loader>();
  return <HealthScore score={health.globalScore} />;
}
```

#### 2. Optimistic UI

```typescript
export default function ValidateAction() {
  const fetcher = useFetcher();
  
  return (
    <button 
      onClick={() => fetcher.submit({ approved: true })}
      disabled={fetcher.state === 'submitting'}
    >
      {fetcher.state === 'submitting' ? 'Approving...' : 'Approve'}
    </button>
  );
}
```

#### 3. Code Splitting

```typescript
const Simulation = lazy(() => import('~/components/simulation'));

export default function Admin() {
  return (
    <Suspense fallback={<Skeleton />}>
      <Simulation />
    </Suspense>
  );
}
```

---

## 3. Database Layer

### PostgreSQL (Supabase)

#### Row Level Security

```sql
ALTER TABLE ai_cos_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins only"
ON ai_cos_actions
FOR ALL TO authenticated
USING (auth.jwt() ->> 'role' = 'admin');
```

#### Connection Pooling (PgBouncer)

```yaml
pgbouncer:
  pool_mode: transaction
  max_client_conn: 1000
  default_pool_size: 25
```

#### Indexing Strategy

```sql
-- Performance indexes
CREATE INDEX idx_snapshots_created 
ON ai_cos_snapshots(created_at DESC);

CREATE INDEX idx_actions_pending 
ON ai_cos_actions(created_at) 
WHERE status = 'pending';
```

### Redis Cluster

#### Cache-Aside Pattern

```typescript
async getKpi(id: string) {
  // 1. Check cache
  const cached = await redis.get(`kpi:${id}`);
  if (cached) return JSON.parse(cached);
  
  // 2. Compute
  const value = await this.compute(id);
  
  // 3. Store (TTL 5min)
  await redis.setex(`kpi:${id}`, 300, JSON.stringify(value));
  return value;
}
```

#### Pub/Sub Event Bus

```typescript
// Publisher
await redis.publish('ai-cos:agents:ia-cto', JSON.stringify({
  type: 'action.proposed',
  data: action,
}));

// Subscriber
redis.psubscribe('ai-cos:agents:*');
redis.on('pmessage', (pattern, channel, message) => {
  const event = JSON.parse(message);
  this.handleEvent(event);
});
```

---

## 4. Orchestration Agents

### SAGA Pattern

```typescript
export class IACeoOrchestrator {
  async orchestrateAction(action: Action) {
    const saga = await this.sagaOrchestrator.start({
      type: 'action-execution',
      steps: this.determineWorkflow(action),
      compensation: this.buildCompensation(action),
    });
    
    for (const step of saga.steps) {
      try {
        await this.executeStep(step);
        await saga.markCompleted(step.id);
      } catch (error) {
        await saga.compensate(); // Rollback
        throw error;
      }
    }
  }
}
```

### Idempotence

```typescript
async execute(command: Command) {
  const key = `idempotency:${command.correlationId}`;
  
  // Check if processed
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);
  
  // Execute
  const result = await this.handle(command);
  
  // Store result (24h TTL)
  await redis.setex(key, 86400, JSON.stringify(result));
  return result;
}
```

---

## 5. Observabilité

### OpenTelemetry Tracing

```typescript
@Injectable()
export class TracingInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler) {
    const tracer = trace.getTracer('ai-cos');
    const req = ctx.switchToHttp().getRequest();
    
    return tracer.startActiveSpan(
      `${req.method} ${req.route.path}`,
      async (span) => {
        span.setAttribute('http.method', req.method);
        try {
          return await next.handle().toPromise();
        } finally {
          span.end();
        }
      }
    );
  }
}
```

### Structured Logging

```typescript
logger.info('Agent action', {
  agent: 'ia-cto',
  action: 'code-review',
  traceId: trace.getActiveSpan()?.spanContext().traceId,
  metadata: { pr: 123, files: 5 },
});
```

### Prometheus Metrics

```typescript
const actionCounter = new Counter({
  name: 'ai_cos_actions_total',
  help: 'Total actions by agents',
  labelNames: ['agent_id', 'status'],
});

actionCounter.inc({ agent_id: 'ia-cto', status: 'approved' });
```

---

## 6. CI/CD Pipeline

### Quality Gates

```yaml
jobs:
  quality:
    steps:
      - name: TypeScript Check
        run: pnpm tsc --noEmit --strict
      
      - name: ESLint
        run: pnpm lint --max-warnings 0
      
      - name: Prettier
        run: pnpm prettier --check .
      
      - name: Tests (>85% coverage)
        run: pnpm test --coverage --threshold 85
      
      - name: Security Audit
        run: pnpm audit --audit-level high
      
      - name: Lighthouse CI
        run: pnpm lhci autorun
```

### Blue-Green Deployment

```bash
# Deploy green
./deploy-green.sh

# Health check
curl -f https://green.app.com/health

# Switch traffic
./switch-to-green.sh

# Monitor (5min)
./monitor-deploy.sh --duration 300
```

---

## État Implémentation

| Composant | État | Cible | Priorité |
|-----------|------|-------|----------|
| CQRS Backend | ❌ | ✅ | **P0** |
| Repository Pattern | ⚠️ | ✅ | **P0** |
| Event Bus Redis | ❌ | ✅ | **P0** |
| Validation Zod | ✅ | ✅ | ✅ |
| Type Safety 100% | ⚠️ | ✅ | **P1** |
| Tests >85% | ⚠️ | ✅ | **P1** |
| RLS Supabase | ❌ | ✅ | **P0** |
| PgBouncer | ❌ | ✅ | **P0** |
| OpenTelemetry | ❌ | ✅ | **P1** |
| Health Checks | ⚠️ | ✅ | **P1** |

---

## Versions Recommandées

```json
{
  "engines": {
    "node": ">=20.18.3",
    "pnpm": ">=9.15.0"
  },
  "dependencies": {
    "@nestjs/core": "^10.4.20",
    "@nestjs/cqrs": "^10.2.7",
    "@supabase/supabase-js": "^2.81.0",
    "ioredis": "^5.8.2",
    "bullmq": "^5.63.0",
    "zod": "^3.24.1",
    "@remix-run/react": "^2.15.0"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "eslint": "^8.57.1",
    "prettier": "^3.4.1"
  }
}
```

---

## Checklist Phase 1 (6 semaines)

**Data Brain (Semaine 1-2)**
- [ ] Package `@repo/ai-cos-core` (domain, schemas)
- [ ] Repository Pattern (abstractions)
- [ ] Event Bus Redis
- [ ] Tables Supabase + RLS
- [ ] PgBouncer pooling
- [ ] Indexes optimisés

**Dialogue Layer (Semaine 3-4)**
- [ ] API `/api/ai-cos/*` (CQRS)
- [ ] Health checks `/health`, `/ready`
- [ ] OpenTelemetry tracing
- [ ] Routes Remix `/admin/ai-cos/*`
- [ ] Alertes Slack/PagerDuty

**Simulation (Semaine 5-6)**
- [ ] Package `@repo/ai-cos-simulation`
- [ ] Sandbox PostgreSQL/Redis
- [ ] Simulation engine
- [ ] Tests E2E isolation

---

## Références

- [ADR-006 AI-COS Enrichment](../architecture/006-ai-cos-enrichment.md)
- [AI-COS Workflow](../workflows/ai-cos-workflow.md)
- [Clean Architecture (Uncle Bob)](https://blog.cleancoder.com/)
- [CQRS Pattern (Martin Fowler)](https://martinfowler.com/bliki/CQRS.html)
- [Event Sourcing (Greg Young)](https://www.eventstore.com/event-sourcing)
