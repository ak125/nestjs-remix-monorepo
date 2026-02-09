# Production Deployment

## Docker Build

```bash
docker build -t automecanik-app .
docker-compose -f docker-compose.prod.yml up -d
```

**Environment:**
- `NODE_ENV=production`
- Port 3001 internally, exposed via Caddy reverse proxy
- Redis for sessions on internal network
- Supabase for database (production URL)

**Monitoring:**
- Logs: `docker-compose logs -f app`
- Health check: `http://localhost:3000/health`
- Admin stats: `http://localhost:3000/admin/stats`

## CI/CD Automatique (GitHub Actions)

**IMPORTANT : Deploiement automatique active !**

Le projet utilise **GitHub Actions avec self-hosted runner** pour deployer automatiquement sur le serveur de production.

### Workflow de deploiement

**Fichier:** `.github/workflows/ci.yml`

**Declenchement:**
```bash
git push origin main  # Declenche automatiquement le deploiement
```

**Pipeline (5-10 minutes):**
1. **Lint** - Verification ESLint (`npm run lint`)
2. **TypeCheck** - Verification TypeScript (`npm run typecheck`)
3. **Build** - Construction image Docker (`massdoc/nestjs-remix-monorepo:production`)
4. **Deploy** - Deploiement sur serveur self-hosted

**Condition de deploiement:**
- Branche: `main` uniquement
- Event: `push` (pas sur PR)
- Runner: `self-hosted, Linux, X64`

### Commandes de deploiement automatique

Le runner execute automatiquement :
```bash
docker pull massdoc/nestjs-remix-monorepo:production
cp docker-compose.prod.yml /home/deploy/app/
cp docker-compose.caddy.yml /home/deploy/app/
docker network create automecanik-prod
docker stop nestjs-remix-caddy nestjs-remix-monorepo-prod
docker rm nestjs-remix-caddy nestjs-remix-monorepo-prod
docker compose -f docker-compose.prod.yml -f docker-compose.caddy.yml up -d
docker exec nestjs-remix-monorepo-prod env | grep -E "UNIFIED|RPC"
```

### Workflow manuel (si besoin)

```bash
docker build -t massdoc/nestjs-remix-monorepo:production .
docker push massdoc/nestjs-remix-monorepo:production
ssh deploy@server
cd /home/deploy/app
docker pull massdoc/nestjs-remix-monorepo:production
docker compose -f docker-compose.prod.yml -f docker-compose.caddy.yml up -d
```

### Monitoring du deploiement

**Via GitHub Actions:**
- `https://github.com/ak125/nestjs-remix-monorepo/actions`

**Sur le serveur:**
```bash
docker compose -f docker-compose.prod.yml logs -f
docker ps | grep nestjs-remix
curl http://localhost:3000/health
```

### Secrets GitHub (deja configures)

- `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN`
- `DATABASE_URL` - URL Supabase production
- `TURBO_TOKEN` / `TURBO_TEAM` (optionnel)

### Rollback en cas de probleme

```bash
# Revenir a la version precedente
git revert HEAD
git push origin main  # Redeclenche le deploiement avec l'ancien code

# OU restaurer manuellement une image precedente
docker pull massdoc/nestjs-remix-monorepo:production@sha256:xxxxx
docker compose up -d
```

**Note:** Le workflow conserve les anciennes images Docker. Verifier avec `docker images` sur le serveur.

## Separation Documentation / Production

| Branche | Contenu |
|---------|---------|
| `main` (prod) | Code uniquement - pas de `.spec/`, docs minimales |
| `develop` | Code + documentation complete (`.spec/`, guides, README detailles) |

**Objectif :** Garder `main` leger et propre pour la production.

**No Paid Render:** Ne jamais utiliser Render payant. Docker + Caddy sur serveur self-hosted avec GitHub Actions CI/CD.
