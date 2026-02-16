---
name: backend-test
description: "NestJS backend testing with curl. Endpoint verification, health checks, regression testing."
argument-hint: "[endpoint or module]"
disable-model-invocation: true
allowed-tools: Bash, Read
version: "1.1"
---

# Backend Test Skill

NestJS backend testing patterns. Curl test templates, endpoint verification, health checks, and regression testing for the API layer.

## Quand proposer ce skill

| Contexte detecte | Proposition |
|------------------|------------|
| User modifie un controller ou service NestJS | `/backend-test [module]` |
| Apres `npm run dev` ou redemarrage backend | `/backend-test health` |
| Demande de test endpoint ou curl | `/backend-test [endpoint]` |
| Validation apres deploy | `/backend-test /api/catalog/families` |

---

## Workflow 4 Phases (OBLIGATOIRE)

### Phase 1 — Setup

1. Verifier les prerequis :
   - [ ] Redis running (`docker ps | grep redis`)
   - [ ] Backend compile (`cd backend && npm run build`)
   - [ ] Server running sur port 3000 (`curl -s http://localhost:3000/health`)
2. Si un prerequis echoue, le resoudre avant de continuer

### Phase 2 — Smoke Tests

Tests rapides pour valider que le serveur fonctionne :

```bash
# Health check (doit retourner 200)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health

# API accessible (doit retourner 200 + JSON)
curl -s http://localhost:3000/api/catalog/families | jq '.data | length'
```

**Gate** : Si smoke tests echouent → STOP. Diagnostiquer avant de continuer.

### Phase 3 — Module Tests

Tester les endpoints du module modifie par categorie (voir section Categories ci-dessous).

Pour chaque endpoint :
1. Verifier le status code : `curl -s -o /dev/null -w "%{http_code}" URL`
2. Verifier la structure reponse : `curl -s URL | jq 'keys'`
3. Verifier les donnees : `curl -s URL | jq '.data | length'`
4. Mesurer le temps : `curl -s -o /dev/null -w "%{time_total}" URL`

### Phase 4 — Report

Generer le rapport de test (voir Format de Sortie ci-dessous).

---

## Categories de Test

### 1. Health (smoke)

```bash
curl -s http://localhost:3000/health | jq
```

### 2. Catalog (module-level)

```bash
curl -s http://localhost:3000/api/catalog/families | jq '.data | length'
curl -s "http://localhost:3000/api/catalog/gammes?limit=3" | jq
```

### 3. Search (module-level)

```bash
curl -s "http://localhost:3000/api/search?query=freinage&limit=5" | jq
```

### 4. SEO (meta + sitemap)

```bash
curl -s "http://localhost:3000/pieces/freinage" | grep -o '<title>[^<]*</title>'
curl -s http://localhost:3000/sitemap-index.xml | head -20
```

### 5. Blog/Content (module-level)

```bash
curl -s "http://localhost:3000/api/blog/constructeurs?limit=3" | jq
```

### 6. Auth (session-based)

```bash
curl -c /tmp/cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"xxx"}'
curl -b /tmp/cookies.txt http://localhost:3000/api/user/profile
```

### 7. Admin (JWT-based)

```bash
TOKEN="..."
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/admin/stats
```

### 8. Payments (gateway)

```bash
# Verifier que les endpoints callback existent
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/payments/paybox/callback
# Attendu : 400 ou 403 (pas 404)
```

---

## Regression Checklist

Apres chaque type de changement, relancer les tests correspondants :

| Type de changement | Tests a relancer |
|-------------------|-----------------|
| Controller modifie | Health + Module concerne |
| Service modifie | Module concerne + modules dependants |
| Data service modifie | Module concerne (verifier structure response) |
| app.module.ts modifie | Health + Smoke complet |
| Middleware/Guard modifie | Auth + Admin + module protege |
| Migration SQL appliquee | Module utilisant la table modifiee |
| package.json modifie | Health (verifier que le build passe) |

---

## Performance Baselines

| Metrique | Seuil acceptable | Seuil warning | Comment mesurer |
|----------|-----------------|---------------|-----------------|
| Response time (GET simple) | < 200ms | 200-500ms | `curl -w "%{time_total}"` |
| Response time (GET complexe) | < 500ms | 500ms-1s | `curl -w "%{time_total}"` |
| Payload size (liste) | < 50KB | 50-100KB | `curl -s URL \| wc -c` |
| Payload size (detail) | < 10KB | 10-30KB | `curl -s URL \| wc -c` |

**Si un seuil warning est depasse** : signaler dans le rapport, suggerer investigation.

---

## Database State Validation

Pour les tests qui modifient des donnees :

```bash
# Avant le test : compter les rows
curl -s http://localhost:3000/api/admin/stats | jq '.orderCount'

# Executer le test (ex: creation commande)
# ...

# Apres le test : verifier le changement
curl -s http://localhost:3000/api/admin/stats | jq '.orderCount'
# Attendu : +1
```

Pour les queries directes (via MCP) :
```sql
-- Before
SELECT count(*) FROM orders WHERE status = 'pending';
-- After test
SELECT count(*) FROM orders WHERE status = 'pending';
```

---

## Response Validation Patterns

```bash
# Check field exists
curl -s URL | jq '.data'

# Check array length
curl -s URL | jq '.data | length'

# Check specific fields
curl -s URL | jq '.data[0] | keys'

# Check HTTP status code only
curl -s -o /dev/null -w "%{http_code}" URL

# Check response time
curl -s -o /dev/null -w "%{time_total}" URL

# Pretty-print first 3 items
curl -s URL | jq '.data[:3]'
```

## Common Failure Modes

- **503** — Redis not running (start with docker run)
- **500** — TypeScript not compiled (run `npm run build`)
- **404** — Route not registered (check module imports in app.module.ts)
- **401** — Missing session cookie or expired JWT
- **400** — Zod validation failure (check request body schema)

---

## Format de Sortie

```markdown
## Backend Test Report — [module ou endpoint]

### Setup
- Redis : OK / FAIL
- Build : OK / FAIL
- Server : OK / FAIL (port 3000)

### Smoke Tests
| Test | Status | Time |
|------|--------|------|
| Health check | PASS/FAIL | Xms |
| API accessible | PASS/FAIL | Xms |

### Module Tests — [nom module]
| Endpoint | Method | Status Code | Response OK | Time |
|----------|--------|-------------|-------------|------|
| /api/... | GET | 200 | PASS | Xms |
| /api/... | POST | 201 | PASS | Xms |

### Performance
| Endpoint | Time | Payload | Verdict |
|----------|------|---------|---------|
| /api/... | Xms | XKB | OK / WARNING |

### Verdict
- Tests passes : [N]/[total]
- Warnings performance : [N]
- Status : ALL PASS / [N] FAIL
```

---

## Interaction avec Autres Skills

| Skill | Direction | Declencheur |
|-------|-----------|-------------|
| `rag-ops` | ← recoit | `/rag-ops test` fournit des templates curl RAG specifiques |
| `payment-review` | ← recoit | Apres `/payment-review`, valider les endpoints gateway avec curl |
| `code-review` | ← recoit | `/code-review` peut deleguer la validation endpoints |
