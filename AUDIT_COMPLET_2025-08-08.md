# Audit technique complet – nestjs-remix-monorepo (08/08/2025)

Ce rapport synthétise l’état du monorepo (backend NestJS + frontend Remix) et propose des actions prioritaires.

## 1) Aperçu rapide
- Monorepo géré par Turbo, workspaces: backend, frontend, packages/*.
- Backend NestJS 10, Remix/Vite côté frontend, intégration via package `@fafa/frontend`.
- Cache/session Redis, CORS permissif, Helmet/compression dynamiques.
- Pile données: migration vers Supabase (services dédiés) mais vestiges Prisma encore référencés dans Docker/start.

## 2) “Quality gates” (exécuté dans l’environnement de dev container)
- Typecheck: PASS (backend, frontend) – `npm run typecheck` OK.
- Build: PASS (backend, frontend) – `npm run build` OK. Avertissements Turbo sur outputs mais artefacts générés.
- Lint: FAIL (frontend) – après correction d’un plugin manquant, restent ~40 erreurs, principalement `no-unused-vars` et import order.
- Tests: non exécutés (aucune suite de tests active détectée côté frontend; backend a une config Jest mais pas de tests listés).

## 3) Incohérences et risques majeurs
1) Vestiges Prisma bloquants en CI/CD
   - Dockerfile: `ADD backend/prisma ...`, `npx prisma generate`, copie du dossier `backend/prisma` – or, le dossier n’existe pas et Prisma n’est plus utilisé => build Docker cassé.
   - Script `backend/start.sh`: `npx prisma migrate deploy` => échouera en runtime.
   - Recommandation (urgence): supprimer toutes les étapes Prisma du Dockerfile et du start.sh; aligner sur Supabase.

2) Versions Node hétérogènes
   - Dev container: Node 22.17.0; Dockerfile: `node:18-alpine`; frontend `engines` >= 20.
   - Recommandation: normaliser sur Node 20 LTS (ou 22 partout) pour éviter des écarts de comportement.

3) Sécurité
   - Source maps serveur activées en production (vite config): expose le code serveur aux clients.
   - `SESSION_SECRET` par défaut à "123" si absent; CORS par défaut `origin: true`.
   - Recommandations:
     - Désactiver sourcemaps en prod pour SSR.
     - Exiger `SESSION_SECRET` en prod (fail fast si manquant).
     - Restreindre `CORS_ORIGIN` en prod.

4) Lint/Tooling
   - Config ESLint partagée utilise `@typescript-eslint` v7 («not officially supported» avec TS 5.9.x), warning récurrent.
   - Recommandation: migrer vers `@typescript-eslint` v8 dans `packages/eslint-config` et harmoniser TypeScript sur ^5.4+ minimal.

5) Arborescence Remix ambiguë
   - Présence d’un `app/routes/admin.payment.tsx` à la racine du repo en plus de `frontend/app/**`. Vite/Remix build cible `frontend/app`, mais le fichier racine crée de la confusion.
   - Recommandation: déplacer/supprimer les vestiges root `app/**` si non utilisés.

## 4) Points d’architecture notables
- Backend `AppModule` propre: Throttler global, ConfigModule global, modules métiers clairs, filtres HTTP, session Redis.
- Intégration Remix dev via `@fafa/frontend` utile pour DX.
- Services de données: `DatabaseModule` expose `SupabaseServiceFacade` + services métier (User/Order/Redis) – bon découplage.

## 5) Détails des vérifications
- Typecheck (OK): `turbo typecheck` sans erreurs.
- Lint (KO): plugin `eslint-plugin-remix-react-routes` supprimé de la config (incompatible Remix v2). Reste ~40 erreurs (unused vars, import order, jsx-a11y). Correctifs rapides à appliquer ou adapter les règles.
- Build (OK): `remix vite:build` génère client + server; warnings de chunking dynamique et sourcemaps prod; `tsc --build` pour backend OK.

## 6) Recommandations priorisées (P0 → P2)
P0 – Bloquants build/prod
- Retirer Prisma du Docker et du start:
  - Dockerfile: supprimer `ADD backend/prisma`, `npx prisma generate`, copies `backend/prisma`.
  - `backend/start.sh`: supprimer `npx prisma migrate deploy`.
- Normaliser Node: choisir 20 LTS ou 22 et l’appliquer au Dockerfile + engines + CI.
- Désactiver sourcemaps SSR en prod (vite/remix config) ou conditionner par `NODE_ENV`.

P1 – Qualité/maintenabilité
- Frontend lint: corriger les `no-unused-vars`, réordonner imports; activer `--fix` quand possible.
- Mettre à jour `packages/eslint-config` vers `@typescript-eslint` v8 compatible TS 5.9.x.
- CORS: lister explicitement les origines en prod via `CORS_ORIGIN`.
- Sécurité session: rendre `SESSION_SECRET` obligatoire en prod (throw si absent) et `sameSite: strict` si possible.
- Supprimer le dossier racine `app/` si non utilisé.

P2 – Améliorations DX/ops
- Corriger `turbo.json` outputs si nécessaire (les artefacts existent; vérifier les chemins et patterns).
- Ajouter tests unitaires de base backend (services) et smoke tests frontend (loader/action critiques).
- Documentation: ajouter un README de run/dev/ops consolidé au root.

## 7) Quick wins effectués dans cette session
- Frontend ESLint: suppression de la règle `plugin:remix-react-routes/recommended` qui cassait le lint (plugin incompatible Remix v2).

## 8) Prochaines étapes proposées
1. Patch Dockerfile et `start.sh` pour retirer Prisma (ETA ~15 min).
2. Désactivation des sourcemaps SSR en prod (ETA ~10 min).
3. MEP Node 20 LTS dans Dockerfile et vérif `engines` (ETA ~10 min).
4. `eslint --fix` + corrections rapides des unused vars (ETA 30–60 min).
5. MAJ `@typescript-eslint` v8 dans `packages/eslint-config` (ETA ~20 min).
6. Nettoyage du répertoire racine `app/` (ETA ~5 min).

---

Annexes (constats clés de fichiers)
- Dockerfile: références Prisma obsolètes; copie de `@fafa/frontend` en runtime.
- `backend/start.sh`: `npx prisma migrate deploy` à retirer.
- `src/main.ts`: session Redis, Helmet/compression dynamiques, CORS permissif par défaut.
- `frontend/vite.config.ts`: sourcemaps activés en prod; `preserveSymlinks`; routes flat.
- `DatabaseModule`: utilise Supabase (plus de Prisma service en code), mais voir Docker.
