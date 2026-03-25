# Production Deployment

## Docker

Port 3001 interne, Caddy reverse proxy, Redis sessions, Supabase prod. Image : `massdoc/nestjs-remix-monorepo:production`

## CI/CD (GitHub Actions)

Fichier : `.github/workflows/ci.yml`. Self-hosted runner Linux X64.
`git push main` → Lint → TypeCheck → Build Docker → Deploy (~5-10 min).

Pipeline auto : pull image → stop/rm containers → `docker compose up -d`

## Rollback

```bash
git revert HEAD && git push origin main  # Redeclenche avec ancien code
# OU : docker pull image@sha256:xxx && docker compose up -d
```

## Monitoring

- GitHub Actions : `github.com/ak125/nestjs-remix-monorepo/actions`
- Serveur : `docker compose logs -f`, `docker ps | grep nestjs-remix`, `curl localhost:3000/health`

## Secrets GitHub

`DOCKERHUB_USERNAME/TOKEN`, `DATABASE_URL`, `TURBO_TOKEN/TEAM` (optionnel)

## Regles

- `main` = prod uniquement, `develop` = code + docs
- **No Paid Render** — Docker + Caddy self-hosted uniquement
