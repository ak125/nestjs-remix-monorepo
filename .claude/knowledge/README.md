# Knowledge — Mémoire codebase AutoMecanik

> **But** : permettre à Claude Code de répondre aux questions sur le codebase
> **sans relire tous les fichiers**. Cette mémoire est lue en premier, avant
> tout `Grep` ou `Glob` en rafale.

## Hiérarchie de lecture

1. `README.md` (ce fichier) — index + règles de navigation
2. `modules/<name>.md` — pour toute question portant sur un module backend NestJS
3. `db/*.md` — pour les questions sur les tables, RPCs, migrations Supabase
4. `integrations/*.md` — pour Paybox, SystemPay, Supabase, catalogue fournisseur (parts-feed)
5. `routes/*.md` — pour les routes Remix critiques
6. `ops/*.md` — pour toute question sur **cleanup / refactor / suppression** (procédures, backlog, playbook cycles)

Si la question n'est pas couverte ici, lire `.claude/rules/*` puis grepper.

### Voisins (pas dans ce dossier mais souvent utiles)

- [`/log.md`](../../log.md) — **timeline append-only des sessions Claude** (date, branche, décision, PRs/commits). Lecture conseillée en début de session pour contexte récent.
- `~/.claude/projects/.../memory/MEMORY.md` — **apprentissages persistants** (règles, gotchas, feedback). Auto-loadé chaque session, USER-only.
- PR descriptions sur GitHub — **détails techniques** d'un changement.
- `governance-vault/` — **décisions canon** (ADRs, incidents, retros).

Distinction : `knowledge/` = STRUCTURE du codebase (où vit quoi) ; `log.md` = TIMELINE des sessions (quand quoi a été fait) ; `MEMORY.md` = APPRIS (règles persistantes) ; PRs = POURQUOI (détails) ; vault = CANON (décisions).

## Modules backend (auto-détectés, `backend/src/modules/*`)

Les fichiers `modules/*.md` ont tous une section `Rôle` / `Pourquoi` /
`Gotchas` / `Références` à compléter humainement. Le bloc `AUTO-GENERATED`
(exports, providers, fichiers primaires) est mis à jour par
`scripts/knowledge/refresh-knowledge.py`.

### Modules critiques (lire en priorité)

| Module | Rôle principal | Criticité |
|---|---|---|
| [payments](modules/payments.md) | Passerelles Paybox + SystemPay (HMAC, callbacks, RSA) | **HIGH** — sécurité |
| [rag-proxy](modules/rag-proxy.md) | Pipeline RAG, ingestion, search, circuit breaker | **HIGH** — coeur IA |
| [seo](modules/seo.md) | SEO V4 Ultimate, DynamicSeo, sitemap, JSON-LD | **HIGH** — trafic |
| [admin](modules/admin.md) | Dashboard, SEO tooling, gammes, content-refresh | **HIGH** — outillage interne |
| [auth](modules/../../rules/backend.md) | Sessions Redis, bcrypt+MD5, JWT admin (voir rules/) | **HIGH** — sécurité |
| [catalog](modules/catalog.md) | Catalogue pièces, V-Level, filtres véhicule | MEDIUM |
| [products](modules/products.md) | Produits, cross-selling, gammes | MEDIUM |
| [orders](modules/orders.md) | Commandes, items, statuts | MEDIUM |
| [cart](modules/cart.md) | Panier, merge anonymous→user | MEDIUM |
| [diagnostic-engine](modules/diagnostic-engine.md) | Diagnostic véhicule, symptômes, opérations | MEDIUM |
| [knowledge-graph](modules/knowledge-graph.md) | KG sync, RAG bridge | MEDIUM |
| [substitution](modules/substitution.md) | Équivalences pièces, refs croisées | MEDIUM |
| [search](modules/search.md) | Recherche unifiée, RPC Postgres | MEDIUM |
| [vehicles](modules/vehicles.md) | V-Level, compatibility, cache | MEDIUM |
| [users](modules/users.md) | Users, profils, roles | MEDIUM |

### Autres modules (stub auto-généré, à enrichir à la demande)

analytics, ai-content, agentic-engine, blog, blog-metadata, bot-guard,
commercial, config, dashboard, errors, gamme-rest, health, invoices, layout,
marketing, mcp-validation, messages, metadata, navigation, promo, rm,
seo-logs, shipping, staff, suppliers, support, system, upload

## Base de données

| Fichier | Couvre |
|---|---|
| [db/tables-seo.md](db/tables-seo.md) | `__seo_*`, `__blog_*`, vues `__pg_*` |
| [db/tables-pieces.md](db/tables-pieces.md) | `pieces_*`, `pieces_media_img*`, dédoublonnage `_i` |
| [db/tables-rag.md](db/tables-rag.md) | `rag_documents`, `__rag_*`, `kg_rag_sync_log` |
| [db/rpcs-critical.md](db/rpcs-critical.md) | RPCs SEO, vehicle-compat, pieces-detail |

## Intégrations externes

| Fichier | Couvre |
|---|---|
| [integrations/paybox.md](integrations/paybox.md) | HMAC-SHA512, callback flow, RSA mode |
| [integrations/systempay.md](integrations/systempay.md) | HMAC-SHA256, vads_* ordering |
| [integrations/supabase.md](integrations/supabase.md) | Projet `cxpojprgwgubzjyqzmoq`, MCP, RLS |
| [integrations/parts-feed.md](integrations/parts-feed.md) | Pipeline V2 catalogue fournisseur, remap, noindex legacy |

## Routes Remix critiques

| Fichier | Couvre |
|---|---|
| [routes/pieces.md](routes/pieces.md) | Catalogue pièces (pieces.*) |
| [routes/admin.md](routes/admin.md) | Dashboard interne (admin.*) |
| [routes/panier.md](routes/panier.md) | Panier + checkout (panier.*) |

## Opérations cleanup / refactor / fusion

Toute action de suppression, refactor, ou fusion de module DOIT passer par ces docs d'abord :

| Fichier | Couvre |
|---|---|
| [ops/safe-delete-procedure.md](ops/safe-delete-procedure.md) | Runbook en 4 étapes + script `validate-before-delete.sh` + anti-patterns |
| [ops/cleanup-targets.md](ops/cleanup-targets.md) | Backlog structuré : 76 scripts obsolètes, 147 dead components, fusions candidates, 17 cycles classifiés |
| [ops/cycle-resolution-playbook.md](ops/cycle-resolution-playbook.md) | 5 patterns pour casser les cycles (fortuit / inversion / pipeline / acceptable / Remix) |

Outils associés :
- `npm run audit:baseline` — comparer counts actuels vs `audit-reports/phase0-baseline.json` (CI bloquant)
- `npm run audit:graph` — export `audit-reports/dep-graph.json` pour visualisation
- `./scripts/cleanup/validate-before-delete.sh <path>` — probe safety avant `git rm`

## Règles adjacentes (NE PAS dupliquer ici)

Ces règles vivent dans `.claude/rules/*` — `knowledge/` les référence, jamais ne les recopie :

- [rules/backend.md](../rules/backend.md) — stack NestJS, three-tier, session, Redis
- [rules/frontend.md](../rules/frontend.md) — Remix, shadcn/ui + Tailwind, conventions
- [rules/deployment.md](../rules/deployment.md) — DEV preprod / PROD (tag), Docker, Caddy
- [rules/payments.md](../rules/payments.md) — règles HMAC critiques, timingSafeEqual, security
- [rules/context7.md](../rules/context7.md) — Context7 MCP usage (frugal)
- [rules/agent-exit-contract.md](../rules/agent-exit-contract.md) — anti-overclaim pour agents

## Gouvernance

La gouvernance (ADRs, incidents, policies) vit dans
`/opt/automecanik/governance-vault/` — voir [CLAUDE.md](../../CLAUDE.md).
Ce dossier `knowledge/` est le miroir *code applicatif*, pas le vault.

## Maintenance

- Auto-refresh du bloc `<!-- AUTO-GENERATED -->` + frontmatter à chaque commit via `.husky/pre-commit`
- Audit manuel : `python3 scripts/knowledge/refresh-knowledge.py refresh`
- Audit complet : `python3 scripts/knowledge/refresh-knowledge.py bootstrap` (recrée les manquants, ne touche pas l'humain)

---

_Dernière révision index : 2026-04-24 — `feat/claude-knowledge-base`_
