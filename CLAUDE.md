# CLAUDE.md — Monorepo `nestjs-remix-monorepo`

> **Pointer unique** : ce fichier ne contient **aucune** règle de gouvernance.
> La gouvernance réside dans un **repository séparé**, pas dans ce monorepo.

---

## Démarrage de session — lire `log.md` pour contexte récent

Au début de chaque session Claude Code, lire les ~20 dernières entrées de
[`log.md`](log.md) à la racine pour situer le travail récent (commits, PRs,
décisions). Append-only, écrit par le skill `session-log` (déclenché auto par
le hook `Stop` quand commits/PRs créés).

Délimitation explicite :

- **`log.md`** = QUAND/QUOI : timeline session (date, branche, sortie)
- **`MEMORY.md`** (auto-loaded) = QUOI APPRIS : règles, gotchas, feedback
- **PR descriptions GitHub** = POURQUOI : détails techniques du changement
- **`governance-vault/`** = DÉCIDÉ CANON : ADRs, incidents, retros

---

## Workspaces Claude Code — séparation dev / SEO

Le monorepo expose deux **racines de session** Claude Code distinctes :

| cwd | Surface chargée | Usage |
|-----|-----------------|-------|
| `/opt/automecanik/app/` | 8 skills DEV (`code-review`, `db-migration`, `frontend-design`, `governance-vault-ops`, `responsive-audit`, `session-log`, `ui-ux-pro-max`, `vehicle-ops`) — **0 agents** R*, **0 skills SEO** | dev backend/frontend, refactor, CI, ADR, governance |
| `/opt/automecanik/app/workspaces/seo-batch/` | 39 agents R0-R8 + 16 skills SEO (`content-gen`, `kw-classify`, `pollution-scanner`, `seo-gamme-audit`, `r8-diversity-check`, `rag-check`, `v5-guardian`, …) | campagnes SEO, KW planning, content gen R*, RAG enrich |

Pour les batchs SEO : `cd workspaces/seo-batch && claude`. Voir `workspaces/seo-batch/README.md`.

---

## Mémoire codebase — lire `.claude/knowledge/` avant exploration

**Avant** tout `Grep` / `Glob` / lecture en rafale pour répondre à une question
sur le code applicatif (modules NestJS, tables DB, intégrations externes,
routes Remix critiques), **lire d'abord** :

1. [`.claude/knowledge/README.md`](.claude/knowledge/README.md) — index racine + règles de navigation
2. Le ou les fichiers pertinents sous `.claude/knowledge/{modules,db,integrations,routes}/`

Ce dossier est le **miroir structuré du codebase** — il remplace le grep pour
l'orientation. Le bloc `<!-- AUTO-GENERATED -->` est rafraîchi par
`scripts/knowledge/refresh-knowledge.py` au pre-commit. Les sections prose
("Pourquoi", "Gotchas", "Références") sont éditées à la main par les humains.

**Grep reste légitime pour** : debugging ciblé (pattern précis), strings
dans le code, cas non couverts par le knowledge, cross-refs larges.

La gouvernance canon vit au vault (voir ci-dessous) — `.claude/knowledge/`
ne la duplique pas, il la référence.

---

## Vérifier l'existant AVANT d'inventer (règle non-négociable)

> **Avant** de proposer une nouvelle convention (ENV var, domaine, nom de
> table, nom de service, path de fichier), **GREP** systématiquement la
> racine du codebase. **Tout est déjà documenté à la racine.**

**Commandes obligatoires avant chaque proposition** :

| Si je propose… | Je dois d'abord exécuter… |
|-----------------|---------------------------|
| Une nouvelle ENV var | `grep -rE "process\.env\.\|configService\.get" backend/src \| grep -i "<topic>"` + `cat backend/.env.example \| grep -i "<topic>"` |
| Un domaine canonique | `cat backend/src/config/site.constants.ts` + `grep -rE "automecanik\." backend/src/config frontend/app/root.tsx` |
| Une nouvelle table DB | `ls backend/supabase/migrations/ \| grep -i "<topic>"` + `git ls-files \| grep -E "schemas?\.ts$"` |
| Un nouveau service NestJS | `find backend/src/modules -name "*.ts" \| xargs grep -l "<keyword>"` |
| Un nouveau skill | `ls .claude/skills/` + lire les SKILL.md frontmatters concernés |

**Si grep retourne du code qui résout déjà le problème → étendre l'existant**,
pas créer de nouveau. Si gap réel → confirmer par 2-3 patterns différents avant
de proposer.

**Règles dérivées** :

- Pas de nouvelle ENV var sans avoir grep `process.env` et `.env.example`
- Pas de nouvelle table sans avoir grep les migrations existantes
- Pas de nouveau domaine/URL sans avoir lu `site.constants.ts`
- Pas de nouveau service sans avoir cherché les services équivalents

**Pourquoi cette règle** : incidents répétés où conventions inventées
(`GOOGLE_SA_CLIENT_EMAIL`, `GSC_PROPERTY_URL`, `automecanik.fr`) alors que
le codebase utilisait déjà `GSC_CLIENT_EMAIL`, `GSC_SITE_URL`,
`automecanik.com` (lus par `crawl-budget-audit.service.ts:208-216` et
`url-audit.service.ts:50-60`). Chaque invention = PR à corriger.

---

## Source de vérité (SoT)

**La gouvernance AutoMecanik vit ici et nulle part ailleurs :**

| Canal | Emplacement |
|-------|-------------|
| **Runtime canonique (DEV VPS)** | `/opt/automecanik/governance-vault/` |
| **Repository Git** | https://github.com/ak125/governance-vault |
| **ADR fondateur** | `ADR-015 — Governance Vault as Single Source of Truth` |

Tous les documents `type: canon` (ADR, rules T/G/AI/V, MOCs, policies, evidence-packs,
incidents, post-mortems, retrospectives, runbooks) **doivent** être créés, lus et modifiés
**uniquement** dans le governance vault — jamais dans ce monorepo.

---

## Anti-patterns (interdits)

### 1. Ne PAS écrire dans `app/.local/governance-vault/`

Ce chemin est `.gitignored` et **déprécié** (cf. ADR-015 du vault). Toute ressource produite
ici est invisible, non-versionnée, et crée une dérive entre les VPS.

**Si un agent (Claude Code, Cowork, Agent SDK, Codex) écrit accidentellement dans
`app/.local/governance-vault/`, c'est une régression G2 (Zero Orphelin) — à corriger
immédiatement en déplaçant le fichier vers `/opt/automecanik/governance-vault/` puis PR.**

Un hook `pre-commit` côté monorepo refuse tout fichier sous `app/.local/governance-vault/`.

### 2. Ne PAS dupliquer les règles de gouvernance dans le monorepo

- Pas de `.spec/00-canon/*.md` qui réécrit ce que le vault dit déjà.
- Pas de `docs/governance/*.md` — ce dossier n'existe pas dans ce monorepo.
- Pas de `README.md` qui recopie les règles T/G/AI/V.

Si tu as besoin de référencer une règle, **linke** le vault (wikilink ou URL GitHub),
ne la réécris pas.

### 3. Ne PAS décider depuis le monorepo

Toute décision architecturale (ajout/modif d'ADR, changement de règle canon, nouvelle
policy, nouvel evidence-pack) passe par le vault avec commit **signé** (G3) et PR
reviewée. Aucune ADR ne naît dans `nestjs-remix-monorepo`.

---

## Ce que CE monorepo contient (et uniquement ça)

| Dossier | Rôle |
|---------|------|
| `backend/` | NestJS API |
| `frontend/` | Remix SSR |
| `shared/` | Types, contracts, utils partagés |
| `scripts/` | Scripts de build, deploy, test |
| `docker/` | Configs conteneurs |
| `.github/workflows/` | CI/CD (tests, deploy, lint) |
| `app/` | Application runtime (lecture seule côté governance) |

**Aucun** dossier `governance/`, `docs/adrs/`, `.spec/00-canon/` ne doit être créé ici.

---

## Workflow pour agents IA (Claude Code, Cowork, Codex)

Quand un utilisateur demande à un agent de :

- créer/modifier une ADR → **ouvrir** `/opt/automecanik/governance-vault/ledger/decisions/adr/` et créer une PR dans `ak125/governance-vault`
- rédiger un post-mortem → **ouvrir** `/opt/automecanik/governance-vault/ledger/incidents/YYYY/`
- mettre à jour une policy ou rule → **ouvrir** `/opt/automecanik/governance-vault/ops/rules/` ou `ledger/policies/`
- consulter un evidence-pack → **lire** `/opt/automecanik/governance-vault/ledger/audits/evidence-packs/`
- modifier une MOC → **ouvrir** `/opt/automecanik/governance-vault/ops/moc/`

**Si l'agent n'a pas accès au vault**, il doit **refuser** la tâche et rediriger l'utilisateur
vers la VPS DEV ou le repo GitHub — il ne doit **jamais** produire un substitut dans ce monorepo.

---

## 3-VPS Architecture (rappel ADR-012 du vault)

| VPS | Rôle | Gouvernance |
|-----|------|-------------|
| **DEV** (46.224.118.55) | Dev, CI artefacts, governance-vault runtime | **SoT canonique** (`/opt/automecanik/governance-vault/`) |
| **PROD** (49.12.233.2) | Production | Read-only mirror via sync-canon (jamais de write) |
| **AI-COS** (178.104.1.118) | Agents IA, Airlock | Lit le vault via HTTPS GitHub, ne write jamais |

Ce monorepo peut être déployé sur DEV ou PROD, mais **aucun** des trois VPS ne doit
écrire de gouvernance depuis le monorepo. Les agents IA s'adressent au vault sur DEV.

---

## Références

- [[ADR-012-aicos-vps-architecture]] (vault) — 3-VPS split
- [[ADR-015-vault-single-source-of-truth]] (vault) — pourquoi ce pointer existe
- [[rules-governance]] (vault) — règles G1 à G4 (Canon, Zero Orphelin, Signed Commits, CI Read-Only)
- Kill-switch `AI_VAULT_WRITE=false` — voir `airlock-decisions-reference` dans le vault

---

## Contact

- Owner : Fafa — automecanik.seo@gmail.com
- Canon source : https://github.com/ak125/governance-vault
- Ce monorepo : https://github.com/ak125/nestjs-remix-monorepo

---

_Dernière mise à jour : 2026-04-18_
_Ce fichier est un pointer — pour toute règle, voir le vault._
