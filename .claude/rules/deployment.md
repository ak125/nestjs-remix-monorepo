# Deployment (DEV preprod + PROD)

## Deploy triggers (CRITIQUE — ne pas confondre DEV et PROD)

| Trigger git | Workflow | Image produite | Environnement | VPS |
|-------------|----------|----------------|---------------|-----|
| `push origin main` (ou `dev`) | `.github/workflows/ci.yml` (job `deploy`) | `massdoc/nestjs-remix-monorepo:preprod` | **DEV pré-prod** | 46.224.118.55 |
| `push origin v*` (tag) | `.github/workflows/deploy-prod.yml` | promote `preprod` → `production` | **PROD** | 49.12.233.2 |
| `workflow_dispatch` manuel sur `deploy-prod.yml` | idem | idem | **PROD** | idem |

**Règle mnémonique** :
- `git push main` = **DEV** pré-prod (pas prod)
- `git tag v... && git push --tags` = **PROD**

Jamais annoncer "déployé en prod" après un simple merge sur main.

## Docker

Port 3001 interne, Caddy reverse proxy, Redis sessions, Supabase prod.
- Image DEV : `massdoc/nestjs-remix-monorepo:preprod`
- Image PROD : `massdoc/nestjs-remix-monorepo:production` (promote preprod sur tag push)

## Promote DEV → PROD (workflow nominal)

```bash
# 1. Merger sur main (déclenche deploy DEV automatique)
gh pr merge {PR} --repo ak125/nestjs-remix-monorepo --squash

# 2. Valider en DEV sur 46.224.118.55

# 3. Créer un tag semver + push pour déclencher deploy PROD
git checkout main && git pull
git tag v2.1.0
git push origin v2.1.0
```

Ou via UI GitHub : Actions → "Deploy PROD (via tag)" → Run workflow.

## Rollback

```bash
# DEV : revert + push main
git revert HEAD && git push origin main

# PROD : pull une image production précédente + redeploy
docker pull massdoc/nestjs-remix-monorepo:v2.0.9 && docker compose up -d
```

## Monitoring

- GitHub Actions : `github.com/ak125/nestjs-remix-monorepo/actions`
- DEV : `ssh 46.224.118.55 docker compose logs -f`
- PROD : `ssh 49.12.233.2 docker compose logs -f`
- Health : `curl localhost:3000/health`

## Secrets GitHub

`DOCKERHUB_USERNAME/TOKEN`, `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `TURBO_TOKEN/TEAM` (optionnel)

## Regles

- `main` → DEV pré-prod uniquement (JAMAIS prod directement)
- `v*` tag → PROD
- `dev` → DEV pré-prod (branche de développement équivalente à main pour les deploys)
- **No Paid Render** — Docker + Caddy self-hosted uniquement
