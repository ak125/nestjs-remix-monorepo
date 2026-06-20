# Deployment — VOCABULAIRE STRICT (canon)

> **Charger ce fichier AVANT toute action sur l'infra de déploiement.**
> Le vocabulaire DEV / PREPROD / PROD est strict et non-négociable.
> Lint CI `scripts/lint/check-preprod-vocabulary.sh` bloque toute formulation interdite (voir plus bas).

## Glossary — 3 environnements distincts, 2 machines physiques

| Terme canon | Rôle réel | Machine physique | Ports | Image Docker | Trafic |
|-------------|-----------|------------------|-------|--------------|--------|
| **DEV** | Machine de dev opérateur | `46.224.118.55` (hostname `dev-automecanik`) | `3000` (via `npm run dev`) | **aucune image deploy ici** | Opérateur SSH, code-side |
| **PREPROD** | Container CI éphémère | `49.12.233.2` (hostname `ubuntu-16gb-nbg1-1`) | `3200` (localhost only) | `massdoc/nestjs-remix-monorepo:preprod` | **CI uniquement** : E2E Smoke + Lighthouse, `READ_ONLY=true` |
| **PROD** | Container live trafic | `49.12.233.2` (même machine, derrière Caddy) | `80`/`443` (public) | `massdoc/nestjs-remix-monorepo:production` | Utilisateurs finaux via `www.automecanik.com` |

**Sources de vérité de cette table** : [`.sops.yaml:24-40`](../../.sops.yaml), [`.github/workflows/ci.yml:588-712`](../../.github/workflows/ci.yml), [`docker-compose.preprod.yml`](../../docker-compose.preprod.yml), [`.github/workflows/deploy-prod.yml`](../../.github/workflows/deploy-prod.yml).

**Conséquence importante** : DEV (`46.224.118.55`) **n'héberge PAS** de container `:preprod` ni `:production` — c'est un poste de travail SSH. PREPROD et PROD vivent tous les deux sur `49.12.233.2`, qui est aussi le GitHub Actions self-hosted runner.

## Sync du runtime DEV:3000 (où on teste/mesure)

DEV:3000 = `npm run dev` (nodemon) servant **le working tree `/opt/automecanik/app/backend/dist`**.
**Le merge `main` ne met PAS à jour DEV:3000** (il ne réécrit que le tag `:preprod`). Resync
automatisé par [`scripts/ops/sync-dev-runtime.sh`](../../scripts/ops/sync-dev-runtime.sh) (cron ~10 min).

**Convention** : le checkout principal `/opt/automecanik/app` **reste sur `main`** ; tout travail
feature/agent se fait en **worktree** (`.claude/worktrees/`). Ne jamais y laisser une branche
feature (sinon DEV:3000 sert du code périmé).

**5 axes de dérive** vs `main` (le script garde 1-2, alerte sur 3-5 — jamais d'action destructive auto) :

1. **Git** : checkout sur main + ff-pull `origin/main`. (auto)
2. **`.env`** : `backend/.env` doit avoir toutes les vars REQUIRED de `env-validation.ts`
   (ex. `JWT_SECRET` depuis #606) ; manquante → boot crash. (alerte via health-check KO)
3. **Node** : doit matcher `.nvmrc`/`engines` (≥22) ; sinon crash `@supabase/realtime-js` ;
   upgrade manuel (`NodeSource setup_22.x`). (alerte)
4. **Migrations DB** : pas auto-appliquées à la DB partagée ; appliquer l'additif réviewé à la
   main (`ADD VALUE IF NOT EXISTS`…). (alerte)
5. **Workspaces npm** : un nouveau `packages/<name>/` mergé doit être (a) symlinké via
   `npm install`, (b) compilé si `main: ./dist/...` (`turbo build`) — sinon boot crash
   `MODULE_NOT_FOUND` (incident 2026-05-25 : `@repo/domain-commerce` + `@repo/cwv-taxonomy`).
   Détection `check_workspace_integrity()` ; install/build = action manuelle owner-gated
   (mutation `package-lock.json`, comme l'axe 4). (alerte)

## Mécanique du tag Docker `:preprod` (alias flottant)

- Le tag `:preprod` est **réécrit à chaque merge sur `main`** (workflow `ci.yml` → step `build`).
- Il est **promu vers `:production`** par push d'un tag git `v*` (workflow `deploy-prod.yml`).
- Ce n'est **pas une référence stable** — pour debug historique ou rollback, utiliser un SHA git ou un tag semver explicite.

## Pièges de nommage INTERDITS (CI lint enforcé)

Toute occurrence des patterns ci-dessous dans un fichier `.md` du repo (hors errata explicites ou ce fichier canon) fait échouer le job `no-confusing-preprod-formulations` (workflow [`preprod-vocabulary-guard.yml`](../../.github/workflows/preprod-vocabulary-guard.yml)) :

- ❌ `DEV pré-prod` ou `DEV preprod` → confond 2 machines distinctes (46.224.118.55 vs 49.12.233.2)
- ❌ `preprod.automecanik.com` → hostname inexistant. Aucune URL publique n'expose PREPROD.
- ❌ `preprod miroir` ou `miroir de PROD` → faux. PREPROD est `READ_ONLY=true` (ADR-028 Option D), pas une réplique de PROD.
- ❌ `déployé en pré-prod, à valider avant prod` → personne n'interagit avec PREPROD ; c'est CI-only, validé par E2E Smoke + Lighthouse, pas par un humain.
- ❌ `staging` → terme jamais utilisé dans ce repo. Source d'amalgame externe.

**À utiliser à la place** :

- ✅ "Machine DEV (46.224.118.55)" pour parler du poste opérateur
- ✅ "Container PREPROD (49.12.233.2:3200)" pour parler du container CI éphémère
- ✅ "Container PROD (49.12.233.2:80/443)" pour parler du runtime utilisateur
- ✅ "Tag `:preprod`" pour parler de l'artefact Docker spécifiquement (pas d'environnement)

## Triggers Git → environnement

| Trigger git | Workflow | Image produite | Cible runtime | Latence | Validation humaine ? |
|-------------|----------|----------------|---------------|---------|----------------------|
| `push origin main` | `.github/workflows/ci.yml` job `deploy` | push `:preprod` sur DockerHub | container PREPROD (49.12.233.2:3200) redémarré | ~10 min | NON (E2E Smoke + Lighthouse CI automatiques) |
| `push origin v*` (tag) | `.github/workflows/deploy-prod.yml` | promote `:preprod` → `:production` | container PROD (49.12.233.2:80/443) redémarré | ~5 min | OUI (tag manuel = décision opérateur) |
| `workflow_dispatch` manuel sur `deploy-prod.yml` | idem `deploy-prod.yml` | idem | idem PROD | idem | OUI |

**Règles mnémoniques** :

- `git push main` = **build + push tag `:preprod` + redéploiement container PREPROD CI**. **Pas de redéploiement PROD.**
- `git tag v… && git push --tags` = **promotion `:preprod` → `:production` + redéploiement container PROD**.
- Jamais annoncer "déployé en PROD" après un simple merge sur `main`.

## Contrat env CI (preflight)

Le `.env.preprod` heredoc-généré par le step `🧪 Deploy to PREPROD` (ci.yml) est validé **avant**
`docker compose up` par `scripts/ci/preflight-env-contract.ts` contre le SoT Zod
`backend/src/contract/env-contract/preprod.schema.ts` → CI fail immédiat lisible plutôt qu'un
crash boot NestJS opaque. Vars couvertes (boot-crash si absentes/mal-formées) : `NODE_ENV`
(literal `preprod`), `SUPABASE_URL`, `SUPABASE_ANON_KEY` (anon only, ADR-028 Option D),
`JWT_SECRET` (≥32c, PR #606), `SESSION_SECRET` (≥32c, fail-fast), `READ_ONLY=true` (ADR-028),
`REDIS_URL` (`^rediss?://`). `.passthrough()` Phase 1 : les vars hors-contrat passent
(Phase 2 = convergence runtime/CI/schemas + ratchet, ADR follow-up).

## Workflow nominal — Promote DEV (code) → PROD

```bash
# 1. Merger PR sur main → ci.yml déploie le container PREPROD
gh pr merge {PR} --repo ak125/nestjs-remix-monorepo --squash
# 2. Vérifier E2E Smoke + Lighthouse verts
gh run list --repo ak125/nestjs-remix-monorepo --branch main --limit 1
# 3. (Optionnel) spot-check : curl http://localhost:3200/health sur 49.12.233.2
# 4. Tag semver → deploy PROD
git checkout main && git pull && git tag v2.1.0 && git push origin v2.1.0
```

Ou via UI GitHub : `Actions → "Deploy PROD (via tag)" → Run workflow`.

## Rollback

```bash
# PREPROD cassé par un merge : revert PR + push main (relance le cycle)
git revert <sha-bad-commit> && git push origin main
# PROD : pull une image production antérieure + redeploy (ops humain, SSH 49.12.233.2)
docker pull massdoc/nestjs-remix-monorepo:v2.0.9
docker compose -f docker-compose.prod.yml up -d
```

Voir `feedback_rollback_via_revert_pr_branch_protected.md` : main est branch-protected, jamais de force-push.

## Monitoring & inspection

- **GitHub Actions** : `https://github.com/ak125/nestjs-remix-monorepo/actions`
- **PREPROD + PROD (49.12.233.2)** : `ssh deploy@49.12.233.2` → `docker ps`,
  `docker logs nestjs-remix-monorepo-preprod` (3200, READ_ONLY) / `nestjs-remix-monorepo-prod` (80/443)
- **Machine DEV (46.224.118.55)** : poste SSH — aucun container deploy attendu.
- **Health** : local `curl http://localhost:3000/health` (46.224.118.55, si `npm run dev` tourne) ·
  PREPROD `curl http://localhost:3200/health` (sur 49.12.233.2 uniquement, non exposé) ·
  PROD `curl https://www.automecanik.com/health`

## Secrets GitHub Actions

`DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `PREPROD_SESSION_SECRET`, `CRUX_API_KEY`, `TURBO_TOKEN`/`TURBO_TEAM` (optionnel).

Secrets SOPS : `secrets/sentry.dev.sops.env`, `secrets/sentry.prod.sops.env` (clés age dans `.sops.yaml`).

## Règles strictes (récapitulatif)

- `main` → déploiement **PREPROD container CI uniquement** (jamais PROD direct).
- Tag `v*` → déploiement **PROD container live**.
- Branche `dev` → équivalente à `main` pour les déploiements (alias historique, mêmes triggers CI).
- **No Paid Render** — Docker + Caddy self-hosted exclusivement.
- **Port 3000** = port canonique du backend NestJS (local `npm run dev` ou interne container). Pas de repro sur port alternatif (cf. `feedback_no_bricolage_no_alt_port_repro.md`).
- **Port 3200** = port host du container PREPROD sur 49.12.233.2 (mapping `3200:3000`).
- **DEV n'héberge aucun container `:preprod` ni `:production`** — c'est un poste de travail SSH, pas un host runtime.

## Mémoires Claude liées

- [[deployment-topology-canonical]] — résumé mémoire chargé à chaque session
- [[feedback_no_preprod_env_only_dev_to_prod]] — interdit la confusion 3-étages
- [[feedback_no_bricolage_no_alt_port_repro]] — port 3000 canon
- [[feedback_no_overclaim_security_words]] — ne pas dire "déployé en prod" sur merge main
