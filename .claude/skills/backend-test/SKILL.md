# Backend Test Skill

NestJS backend testing patterns. Curl test templates, endpoint verification, health checks, and regression testing for the API layer.

## When to Activate
- Invoke with `/backend-test`
- When verifying backend changes
- After modifying controllers or services

## Prerequisites

```bash
# Redis running (required for sessions)
docker run -d --name redis-dev --rm -p 6379:6379 redis:7-alpine

# Backend compiled
cd backend && npm run build

# Server running on port 3000
npm run dev
```

## Test Templates

### Health Check
```bash
curl -s http://localhost:3000/health | jq
```

### Catalog API
```bash
curl -s http://localhost:3000/api/catalog/families | jq '.data | length'
curl -s "http://localhost:3000/api/catalog/gammes?limit=3" | jq
```

### Search API
```bash
curl -s "http://localhost:3000/api/search?query=freinage&limit=5" | jq
```

### Blog/SEO
```bash
curl -s "http://localhost:3000/api/blog/constructeurs?limit=3" | jq
curl -s "http://localhost:3000/pieces/freinage" | grep -o '<title>[^<]*</title>'
```

### Auth (session-based)
```bash
curl -c /tmp/cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"xxx"}'
curl -b /tmp/cookies.txt http://localhost:3000/api/user/profile
```

### Admin (JWT-based)
```bash
TOKEN="..."
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/admin/stats
```

## Regression Test Workflow

1. Start server: `npm run dev`
2. Run health check
3. Test modified endpoints with curl
4. Verify HTTP status codes: `curl -s -o /dev/null -w "%{http_code}" URL`
5. Check response structure: `curl -s URL | jq '.data | keys'`
6. Check array lengths: `curl -s URL | jq '.data | length'`
7. Verify Redis cache: `redis-cli KEYS "prefix:*"`

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
