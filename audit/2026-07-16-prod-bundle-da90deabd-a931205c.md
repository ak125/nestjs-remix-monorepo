# Audit de bundle PROD — `da90deabd..a931205c` (7 PRs)

- **Date** : 2026-07-16
- **Bundle audité** : `da90deabd..a931205c` (7 PRs)
- **PROD au moment de l'audit** : tag `v2026.07.15-substitution-failopen-r1-404` → `da90deabd`
- **Méthode** : audit multi-agents en lecture seule (11 agents : 7 par-PR + 4 lentilles transverses), revendications « dark » / « behavior-identical » traitées comme **revendications à réfuter**, pas comme faits.
- **Nature** : aide à la décision. Ce document **ne vaut pas GO**.

---

## Verdict

```
CODE_BUNDLE:  APPROVE
PROD_RELEASE: NO-GO
```

### Causes du NO-GO (aucune n'est dans le code applicatif)

1. **Rollback automatique invalide** — le rollback de `deploy-prod.yml` est un **no-op prouvé** : il restaure l'image cassée. Défaut rouge P0.
2. **Absence de sonde SSR en PROD** — aucun gate de déploiement ne rend une page SSR, alors que #1285 réécrit précisément le chemin de données SSR. Défaut rouge P0.
3. **Vérifications `.env` / BullMQ encore externes** — deux conditions non vérifiables depuis le repo (fichier `.env` de la box PROD, état Redis PROD) restent ouvertes.

### Candidat de release

- **`a931205c` = candidat figé historique.** **Dépassé** : `main` est passé à `bd167475c` (#1286 « feat(seo-projection): add dark r3 projection mapper (P2-R3-C, pure) », mergée 2026-07-16T15:21:36Z).
- Tout GO portant sur `a931205c` est **caduc**. La promotion devra viser un **nouveau head** incluant #1286 **et** les correctifs P0 ci-dessous, après un **nouvel audit de bundle**.

---

## Périmètre réel d'un tag

Un tag `v*` promeut **le head de `main` en entier**, jamais une PR isolée. Au moment de l'audit, tagger `a931205c` aurait promu **7 PRs**, pas seulement #1285.

Corollaire acté : **ne jamais fabriquer une branche de release en cherry-pickant une seule PR** — le SHA obtenu diffère de celui validé en PREPROD, donc on promouvrait du code jamais testé.

---

## Matrice par PR

| PR | Titre | Risque | Comportement PROD visible au deploy | Flag (vérifié) | Migrations |
|---|---|---|---|---|---|
| **#1285** | refactor(remix): replace SSR loopback with actor-bound app port | **medium** | **OUI** | **aucun — 100 % du trafic** | aucune |
| #1284 | seo-projection: extract dark projection reader (C0) | low | non | `SEO_BRIEF_WIKI_ENABLED` = **false** — dark **confirmé** (plus fort qu'annoncé) | aucune |
| #1282 | seo-projection: durable snapshot producer + role-scoped writer (P2-R3-B) | low | non | `SEO_PROJECTION_R1_FEED_ENABLED` **OFF** — dark confirmé sur le chemin **automatique** ; **partiellement réfuté** sur « inatteignable » (endpoint de trigger manuel) | aucune |
| #1283 | audit: refresh served-write-sink baseline | low | non | CI-only, zéro runtime — confirmé | aucune |
| #1278 | seo: B5 — remove R3 image-prompt RAG generation | low | **non au deploy** (voir §#1278) | aucun — suppression structurelle inconditionnelle | aucune |
| #1277 | governance: EDITORIAL_AUTHORITY_SINKS registry + ratchet | low | non | claim confirmé, plus fort qu'annoncé | aucune |
| #1281 | seo-projection: replay reads run_id PK | low | non | corrige un vrai bug | aucune |

**Le bundle ne contient AUCUNE migration ni DDL** (`git diff --name-only da90deabd..a931205c -- backend/supabase/migrations/` = vide). Aucune précondition DB au déploiement, aucun risque de « migration non appliquée → crash boot ».

**Aucune PR classée high-risk. Une seule PR change le comportement PROD au déploiement : #1285.**

---

## #1285 — la seule PR à comportement PROD visible

Le cadrage « refactor » du titre est **réfuté** : la PR ship **sans flag, à 100 % du trafic**. Trois deltas non signalés par la PR ont été trouvés :

1. `/orders/new` : 200 (formulaire) → **503**. **Pas une régression de capacité** : `createOrderForRemix` n'existait nulle part au `da90deabd` (un seul hit : le site d'appel) → optional-chain → `undefined` → TypeError → 500. Le chemin de création était **prouvé mort** ; seul le mode d'échec change (formulaire factice + 500 au submit → 503 immédiat).
2. **Durcissement authz** : `staff._index` et `admin.reports` passent `requireUser` → `requireAdmin`. **Fail-closed, zéro perte fonctionnelle** — ces pages servaient des zéros/synthétique (`getStaff()` appelait `/api/users/test-staff`, endpoint inexistant → 404 → catch → all-zeros). Ferme une surface latente de broken-access-control.
3. `getStats` fail-loud **fuit au-delà du port** vers les surfaces REST préexistantes `StaffController @Get('stats')` et `AdminStaffController:89` : sur erreur DB, 400 (BadRequestException) au lieu de 200-avec-zéros. **Chemin d'erreur uniquement, admin-only.**

**Aucun risque de boot** (la préoccupation principale) : `forwardRef(() => StaffModule)` **n'est pas load-bearing** (StaffModule n'importe que ConfigModule → aucun cycle) et **StaffModule était déjà dans le graphe** (`app.module.ts:250`, `admin.module.ts:161`) → l'import n'enregistre **aucune route HTTP nouvelle**. Preuve empirique : run CI `29488460068` sur `a931205c` vert de bout en bout, **Deploy PREPROD + E2E Smoke + Lighthouse** inclus.

### Dégradation réellement visible par un utilisateur (unique)

`frontend/app/components/account/AccountNavigation.tsx:167` conserve un CTA « Nouvelle commande » → `/orders/new`, rendu par `AccountLayout` sur **9 routes `/account/*`** : un client connecté est **à un clic d'un 503 nu**. → traité en PR séparée et étroite.

---

## #1278 — changement réel, mais différé

C'est **un vrai changement** (suppression de capacité, non-dark, shippé ON), **mais il n'est pas visible au déploiement** :

- Les deux endpoints supprimés (`POST /api/admin/r3-image-prompts/generate`, `/generate/:pgAlias`) sont **admin-only derrière `AuthenticatedGuard` + `IsAdminGuard`**.
- Le chemin de lecture servi est **intact** : `blog-seo.service.ts:346 getApprovedImages()` (filtre `rip_selected=true` AND `rip_image_url NOT NULL` AND `rip_status IN ('approved','exported')`), consommé par `r3-guide.service.ts:228` sous le contrôleur public `r3-guide.controller.ts:29`.
- **Aucune ligne, aucun schéma modifié.** Les images des pages conseil continuent de s'afficher à l'identique.
- Aucun caller résiduel, aucun bouton d'admin cassé (le frontend ne référence que `/api/admin/r1-image-prompts/*`).

**Conséquence réelle = perte de capacité différée**, pas une régression : après B5, `rip_selected` et la création de lignes sur `__seo_r3_image_prompts` n'ont **plus aucun writer** dans `backend/src`. Donc (a) une gamme sans ligne existante ne peut plus en obtenir une → jamais d'images guide ; (b) une ligne à `rip_selected=false` ne peut plus être basculée à true. **Effet SEO net : la couverture image R3 est gelée à son set actuel et ne peut décroître qu'en relatif, à mesure que de nouvelles gammes apparaissent. Aucune perte de couverture existante.** C'est le « résidu fonctionnel » owner-acté (remplacement = design séparé owner-gated).

**Inexactitude de documentation à consigner (pas runtime)** : le corps de la PR affirme « les seuls writers sont `approvePrompt` et `setImageUrl` ». **Réfuté** : un 3ᵉ writer existe — `assignToR3Slot` (`rag-image-management.service.ts:219`, `.update({rip_image_url, rip_status:'approved'})`). Il est **promote-only** (ne touche ni `rip_selected` ni `'pending'`), donc il **respecte** l'invariant énoncé et passe le ratchet d'allowlist de colonnes — mais la surface de curation est plus large qu'annoncée, et ce writer ne peut lui non plus ni créer de ligne ni positionner `rip_selected`, ce qui **corrobore le résidu**.

---

## Défauts rouges — mécanique de déploiement (P0)

### 🔴 1. Le rollback automatique est un no-op prouvé

Séquence réelle dans `.github/workflows/deploy-prod.yml` :

1. Étape *safety gate* (l.74-80) : `docker tag :preprod :production` **puis** `docker push :production` → **`:production` pointe déjà sur la NOUVELLE image.**
2. Étape *deploy* (l.204) : `CURRENT_IMAGE=$(docker inspect --format='{{.Image}}' nestjs-remix-monorepo-prod)` — l'**ID immuable correct** de l'ancienne image… **calculé, affiché, puis JAMAIS UTILISÉ**.
3. Étape *deploy* (l.206) : `docker tag :production :production-previous` → comme `:production` a déjà été écrasé en (1), **`production-previous` == la NOUVELLE image**.
4. Rollback (l.283) : `docker tag :production-previous :production` → **restaure exactement l'image cassée**.

**Conséquence** : la branche health-failure ne protège de rien. Le rollback de référence est aujourd'hui **manuel** (tag `v*` antérieur ou `:sha-<sha>`).

### 🔴 2. Aucune sonde SSR

`/health` est un contrôleur NestJS **séparé** ; les autres sondes (`/api/catalog/families`, `/api/gamme-rest/4/page-data-rpc-v2`, guards admin) sont des **routes API**. **Aucun gate ne rend une page SSR.** Or #1285 réécrit exactement ce chemin (`remix-api.server.ts` −623 lignes + port par-requête injecté dans `remix.controller.ts`, 4 routes migrées). **Une régression SSR passerait tous les gates actuels.**

### 🟠 3. Coupure dure de ~60-90 s (P1, non bloquant)

`docker stop` + `docker rm` de `nestjs-remix-monorepo-prod` **et** `nestjs-remix-caddy`, puis `compose up`, puis `sleep 60` avant la première sonde. **Ce n'est pas un rolling restart.** → PR blue/green distincte, après les deux défauts rouges.

---

## Vérifications externes au repo (owner uniquement)

1. **`.env` de PROD** (`49.12.233.2:~/production/.env`, non versionné) : confirmer que `SEO_PROJECTION_R1_FEED_ENABLED` est **absent ou ≠ `"true"`**. Le défaut code est OFF et la variable n'est settée dans **aucun** compose/workflow — mais le `.env` est hors git, donc non vérifiable par audit.
2. **Redis PROD** : `SEO_PROJECTION_R1_FEED_ENABLED=false` **ne déenregistre pas** un repeatable BullMQ déjà enregistré — `removeStaleRepeatableJob()` n'est atteignable que **flag ON**. Vérifier l'absence de repeatable périmé.

### Préconditions du *writer* #1282 (gate le writer, pas le tag)

Le writer est dormant tant que le flag est OFF ; ces points ne bloquent donc **pas** le tag, mais conditionnent **toute** première exécution (`POST /api/admin/seo-projection/feed/trigger-entity` ou `trigger-now`) :

- Confirmer que les 3 migrations ADR-059 sont **réellement appliquées** en PROD (« antérieures » ≠ « appliquées »).
- `/opt/automecanik/object-store` (`OBJECT_STORE_ROOT_DEFAULT`) n'est monté dans **aucun** compose et `SEO_PROJECTION_OBJECT_STORE_ROOT` n'est setté nulle part, alors que le code fait `mkdir -p` **dans le conteneur** → écriture non durable. Monter un volume ou pointer la variable.
- **Hasard event-loop** : `zstdCompressSync` niveau 19 est **synchrone** et `docker-compose.prod.yml` ne lance qu'un seul service → les processors BullMQ partagent l'event-loop Node du serveur HTTP.
- **Churn de version unique** au premier run : le hash de contenu est passé de `md5(JSON.stringify)` à `sha256(fast-json-stable-stringify)` → tous les `content_hash` stockés deviennent non concordants, la détection de no-op est défaite.
- Traiter le premier POST comme un **canary**, jamais comme une action de routine : c'est la première exécution du chemin d'écriture #1282 **où que ce soit** avec `readOnly=false` (PREPROD, en anon + READ_ONLY, ne l'a jamais exercé).

---

## Ce que le vert PREPROD ne prouve pas

PREPROD tourne `NODE_ENV=preprod`, **`READ_ONLY=true`**, **clé anon** (ADR-028 Option D). PROD tourne **`service_role`**. Donc :

- Tout chemin gardé par `guardReadOnly()` **n'a jamais tourné** en PREPROD et **tournera** en PROD.
- Les chemins staff/admin de #1285 **ne peuvent pas** être validés par l'E2E Smoke vert : `StaffDataService` lit `___config_admin` via `.from()` (lecture de table directe, pas une RPC) ; en PREPROD anon cela renverrait 42501. Risque néanmoins **faible** : la forme de requête est **inchangée** et la lecture identique tourne **déjà** en PROD derrière `StaffController /api/admin/staff`. → spot-check `/admin/staff` et `/admin/reports` en admin juste après tout tag.

---

## Suites décidées

| Priorité | Action | Portée |
|---|---|---|
| **P0** | Corriger `deploy-prod.yml` : vrai `CURRENT_IMAGE` pour `production-previous` (sauvegardé/poussé **avant** toute mutation de `:production`) ; assertion d'ID exact au rollback ; re-sonde `/health` **+ sonde SSR réelle** après rollback ; **`GET /` bloquant** post-déploiement (200, `text/html`, marqueur HTML stable, **absence de `X-Robots-Tag: noindex`** — détecte aussi le fallback dégradé de la homepage) | PR dédiée |
| **P0** | Retirer le CTA `/orders/new` de `AccountNavigation.tsx` + import devenu inutilisé + test anti-réapparition | PR **séparée et étroite** — ne touche ni la route 503 ni le domaine commande |
| P1 | Blue/green pour supprimer la coupure de 60-90 s | PR distincte, **après** les deux défauts rouges |
| — | **Nouvel audit de bundle + promotion d'un nouveau head** incluant #1286 et les correctifs | Le GO proposé sur `a931205c` est **caduc** |

**Aucun tag `v*` n'est créé. PROD reste sur `v2026.07.15-substitution-failopen-r1-404` (`da90deabd`).**

---

## Forme attendue d'un futur GO

Un GO PROD doit nommer le **bundle** et **toutes** ses PRs, jamais la PR du jour. Exemple de forme (à réémettre sur le futur head, pas sur `a931205c`) :

> `GO PROD pour le bundle <tag-précédent>..<nouveau-head>, incluant #… , #… , #….`

Un « tag » sec après une session mono-PR est une **demande de confirmation**, pas un GO de bundle.
