# CLAUDE.md — Monorepo `nestjs-remix-monorepo`

> **Contrat d'exécution + pointer.** Ce fichier régit le **comportement de l'agent**
> (comment analyser, décider, muter) et **pointe** vers le canon. Il ne contient
> **aucune règle de gouvernance canon** (ADRs / rules / policies) — celles-ci
> vivent dans un **repository séparé** (le vault, voir §Gouvernance).

---

## Contrat d'exécution (comportement de l'agent) `[CRITICAL]`

Ce repo est **gouverné** : ADRs, contracts, registries déterministes, ratchets CI.
L'assistant **ÉTEND** l'architecture existante — il ne crée **JAMAIS** de système
parallèle, de source de vérité dupliquée, ni d'abstraction spéculative.

`[CRITICAL]` **NEVER invent architecture already governed elsewhere** : si une
convention / structure existe (vault, `.spec`, registry, `.claude/knowledge`),
l'**étendre**, jamais en réinventer une locale (pattern de dérive #1 des agents).

Objectif permanent : cohérence archi · entropie minimale · changements
déterministes & revue-ables · périmètre minimal.

### Mode par défaut = analyser AVANT muter `[CRITICAL]`

Cartographie d'abord, mutation ensuite. Ordre de lecture obligatoire : voir
§"Mémoire codebase" (registry → REPO_MAP → knowledge → ADR vault → patterns du
bounded context → **grep en dernier recours**).

- **NEVER** commencer par `Grep` / `Glob`. **NEVER** créer un fichier avant
  cartographie. **NEVER** proposer avant audit.
- Vérifier l'existant avant d'inventer : voir §dédiée (règle non-négociable).

### Repository Control Plane — 3 couches `[HIGH]`

ADR-058 / ADR-062. **L1** data auto (`audit/registry/*.json`) + **L2** overlay
manuel (`.spec/00-canon/repository-registry/*.yaml`) = **SoT (le couple)**.
**L3** projection canonique (`audit/registry/canonical.json`) = générée,
**jamais éditée**. L'enforcement (ratchets / CI / ast-grep) **entoure** ces 3
couches — ce **n'est pas** une 4ᵉ couche. Détail : `packages/registry/README.md`.

`[CRITICAL]` **Generated artifacts are projections, never sources of truth** :
ne jamais éditer un artefact généré (`canonical.json`, blocs
`<!-- AUTO-GENERATED -->`, `REPO_MAP.md`, canon mirrors hash-lockés) — corriger
L1+L2, puis rebuild.

### Heuristiques de décision (en cas de doute) `[HIGH]`

Dans l'ordre : 1) étendre l'existant · 2) préserver le déterminisme ·
3) réduire l'entropie · 4) minimiser le blast radius · 5) préférer l'observabilité.

### Discipline de périmètre `[HIGH]`

Rester strictement dans le scope demandé. **INTERDIT** : refactor opportuniste,
cleanup hors bounded-context, upgrade de dépendance sans accord explicite,
reformatage de fichiers non touchés, réécriture archi, changement de comportement
silencieux. Un seul « fais-le » = le scope nommé uniquement, jamais d'auto-escalade.
Chaque changement préserve la rétro-compat sauf demande contraire et minimise le
blast radius.

### Anti-bricolage & patterns interdits `[CRITICAL]`

Canon : vault `rules-engineering-quality.md` (Q1-Q4, solution structurelle vs
bricolage) + `rules-ai-antipatterns.md` (AP-*).

Patterns interdits : registry ad-hoc, cache caché, schéma dupliqué, magic
constant, runtime guessing, filler SEO générique, feature flag non gouverné.

- `[CRITICAL]` **No silent fallback** : tout repli (fail-open, fallback implicite,
  cache / noindex / skip silencieux) est INTERDIT sauf explicitement gouverné ET
  observable (cause directe de plusieurs incidents).
- `[HIGH]` **Prefer extension over creation** : étendre un module / bounded-context
  existant avant de créer un fichier. Avant toute création : équivalent inexistant ?
  capacité non déjà fournie ? ownership + bounded-context définis ?

Gardes mécaniques : `.ast-grep/rules/*.yml`, `.husky/pre-commit`,
`scripts/agents/validate-agents-md.sh`.

### Sécurité opérationnelle `[CRITICAL]`

Mode par défaut = analyse en lecture seule.

- **NEVER** : commande destructive (`DROP` / `TRUNCATE`), migration irréversible
  sans validation, bypass de feature flag, désactivation d'observabilité,
  suppression de guard / gate CI.
- **NEVER** modifier le module `payments/` (Paybox / SystemPay / Cyberplus,
  `PAYBOX_*` / `SYSTEMPAY_*`) sans demande explicite nominative — voir
  `.claude/rules/payments.md`.
- `[HIGH]` **Runtime-awareness** : toute mutation runtime DOIT évaluer
  observabilité · rollout · impact cache · impact queues (BullMQ) · rollback ·
  feature flags. Réutiliser l'observabilité interne existante (`rpc_*_alerts_v1`,
  `__seo_event_log`, stack CWV / RUM) avant d'ajouter un canary externe.
- Topologie deploy DEV / PREPROD / PROD : voir §Vocabulaire déploiement +
  `.claude/rules/deployment.md`.

### Connaissance : RAW → WIKI → exports → consumers `[HIGH]`

ADR-031 (vault). `automecanik-raw` et `automecanik-wiki` sont des **repos externes**
(comme le vault), pas des dossiers de ce monorepo. `raw` = donnée brute par défaut ;
`wiki` = connaissance sourcée, lintée, validée humainement. **Aucun consommateur
(RAG, SEO, blog, chatbot, diagnostic) ne lit `raw` directement.** RAG = couche
**consommatrice**, jamais source de vérité.

### Invariants SEO R* `[HIGH]`

SoT des rôles : `.spec/00-canon/role-matrix.md` (v5 figée). Les rôles R* **ne sont
pas** des générateurs de contenu génériques (R1 routage gamme / compatibilité,
R2 transactionnel produit, R8 fiche véhicule).

- Préserver : `catalog_signature` (ADR-066, gate structurel avant diversité texte),
  génération structural-first, composition vehicle-aware, relations canoniques.
- **NEVER** : filler SEO générique, amplification de duplicate-content, modification
  de meta_title / desc / H1 optimisés sans autorisation, suppression auto de page,
  usage du top-kw brut de `__seo_keywords` comme terme produit (mapping contaminé).

### Format de sortie `[HIGH]`

Contrat de sortie = `.claude/canon-mirrors/agent-exit-contract.md` (hash-locké,
hors-contexte volontaire — **ne pas recopier**). Il porte l'anti-overclaim : verdict
par défaut ≠ « COMPLETE » / « DONE », coverage manifest obligatoire.

---

## Vocabulaire déploiement — lire `.claude/rules/deployment.md` AVANT toute action infra

Le vocabulaire **DEV / PREPROD / PROD** est strict. Trois environnements distincts coexistent sur deux machines physiques (mapping IP × port × tag dans la rule canon, jamais hardcodé ici) :

- **DEV** : poste opérateur, pas de container deploy
- **PREPROD** : container CI éphémère sur le runner self-hosted, READ_ONLY=true, E2E Smoke + Lighthouse seulement
- **PROD** : container live derrière Caddy, trafic réel utilisateurs

Formulations **interdites** par lint CI `scripts/lint/check-preprod-vocabulary.sh` : "DEV pré-prod", "preprod.automecanik.com" (hostname inexistant), "preprod miroir", "staging soak/env/server/VPS/deploy/deployment/gate". Voir [`.claude/rules/deployment.md`](.claude/rules/deployment.md) pour le glossary canon complet (matrice machine × port × tag) + ADR-075 vault pour la décision gouvernance.

---

## Démarrage de session — lire `log.md` pour contexte récent

Au début de chaque session Claude Code, lire le contexte récent **via commande
bornée** : `tail -n 80 log.md` (≈ les 12-15 dernières entrées, ~2K tokens).
**Ne jamais lire `log.md` en entier** — c'est append-only et la lecture
intégrale gaspille des tokens. L'historique antérieur vit dans
`log-archive-<année>.md` (jamais lu au démarrage). `log.md` est écrit par le
skill `session-log` / le hook `Stop`, et borné automatiquement par
`scripts/claude-hooks/rotate-log.sh` (rotation vers l'archive au-delà de 600 lignes).

Délimitation explicite :

- **`log.md`** = QUAND/QUOI : timeline session (date, branche, sortie)
- **`MEMORY.md`** (auto-loaded) = QUOI APPRIS : règles, gotchas, feedback
- **PR descriptions GitHub** = POURQUOI : détails techniques du changement
- **`governance-vault/`** = DÉCIDÉ CANON : ADRs, incidents, retros

---

## Workspaces Claude Code — séparation dev / SEO / marketing / wiki

Le monorepo expose **quatre racines de session** Claude Code distinctes :

| cwd | Surface chargée | Usage |
|-----|-----------------|-------|
| `/opt/automecanik/app/` | 8 skills DEV (`code-review`, `db-migration`, `frontend-design`, `governance-vault-ops`, `responsive-audit`, `session-log`, `ui-ux-pro-max`, `vehicle-ops`) — **0 agents** R*, **0 skills SEO** | dev backend/frontend, refactor, CI, ADR, governance |
| `/opt/automecanik/app/workspaces/seo-batch/` | 39 agents R0-R8 + 16 skills SEO (`content-gen`, `kw-classify`, `pollution-scanner`, `seo-gamme-audit`, `r8-diversity-check`, `rag-check`, `v5-guardian`, …) | campagnes SEO, KW planning, content gen R*, RAG enrich |
| `/opt/automecanik/app/workspaces/marketing/` | 3 agents G1 marketing (LEAD/LOCAL/RETENTION en Phase 1-2 ADR-036) + canon brand voice + AEC | briefs marketing orientés conversion, posts GBP, retention, plan hebdo cross-units |
| `/opt/automecanik/app/workspaces/wiki/` | skill `wiki-proposal-writer` + canon ADR-033 + AEC | sas wiki documentaire (Phase 2 ADR-033), proposals frontmatter v2.0.0 |

Pour les batchs SEO : `cd workspaces/seo-batch && claude`. Voir `workspaces/seo-batch/README.md`.
Pour les sessions marketing : `cd workspaces/marketing && claude`. Voir `workspaces/marketing/README.md` (ADR-036).
Pour le sas wiki : `cd workspaces/wiki && claude`. Voir `workspaces/wiki/README.md` (ADR-033).

---

## Agents Paperclip AI-COS

Les agents Paperclip sont documentés dans `agents/*/AGENTS.md`. Chaque fichier
décrit rôle, périmètre, protocole et format de sortie. Les UUID Paperclip
restent dans le registre Paperclip (SoT mapping) — pas ici, pour éviter
duplication et dérive.

| Domaine | Fichier |
|---------|---------|
| CEO | `agents/ceo/AGENTS.md` |
| CTO | `agents/cto/AGENTS.md` |
| CMO | `agents/cmo/AGENTS.md` |
| CPO | `agents/cpo/AGENTS.md` |
| RAG Lead | `agents/rag-lead/AGENTS.md` |
| SEO Content | `agents/seo-content/AGENTS.md` |
| SEO QA | `agents/seo-qa/AGENTS.md` |

**Validation** : tout commit modifiant `agents/*/AGENTS.md` ou `**/CLAUDE.md`
passe par `scripts/agents/validate-agents-md.sh` (pre-commit + CI). Voir
mémoire `feedback_no_hardcoded_infra_in_agentsmd.md` pour les règles
(pas d'IP / URL / UUID / clé hardcodée — env vars + contrats d'usage).

---

## Mémoire codebase — lire le registry AVANT toute exploration

**Avant** tout `Grep` / `Glob` / lecture en rafale pour répondre à une question
sur le code applicatif (modules NestJS, tables DB, intégrations externes,
routes Remix critiques), **lire dans cet ordre** :

0. **[`audit/registry/canonical.json`](audit/registry/canonical.json)** — Source of Truth machine-readable du Repository Control Plane (ADR-058). Index unifié files/db/rpc/runtime/deps par domaine D1..D15 + ownership. Query via `jq` (ex. `jq '.files[] | select(.path | contains("payments"))' audit/registry/canonical.json`).

1. **[`.claude/knowledge/REPO_MAP.md`](.claude/knowledge/REPO_MAP.md)** — projection humaine du canonical (généré, ~6KB). Statistiques par domaine, owners principaux, liens vers modules prose.

2. [`.claude/knowledge/README.md`](.claude/knowledge/README.md) — index navigation prose détaillée

3. Le ou les fichiers pertinents sous `.claude/knowledge/{modules,db,integrations,routes}/`

Le registry (`audit/registry/`) est généré depuis `Layer 1` (code AST via
`scripts/audit/build-deep-inventory.js` + `build-db-usage-map.js`) et `Layer 2`
(overlay manuel `.spec/00-canon/repository-registry/*.yaml`). SoT = couple
des deux. `canonical.json` = projection canonique générée — JAMAIS l'éditer.

Le bloc `<!-- AUTO-GENERATED -->` dans `.claude/knowledge/modules/*.md` est
rafraîchi par `scripts/knowledge/refresh-knowledge.py` au pre-commit. Les
sections prose ("Pourquoi", "Gotchas", "Références") sont éditées à la
main par les humains.

**Grep reste légitime pour** : debugging ciblé (pattern précis), strings
dans le code, cas non couverts par le registry/knowledge, cross-refs larges.

La gouvernance canon vit au vault (voir ci-dessous) — `.claude/knowledge/`
et `audit/registry/` ne la dupliquent pas, ils la référencent.

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

## Gouvernance — pointer vault uniquement

Toute la gouvernance (ADRs, rules T/G/AI/V, policies, MOCs, incidents, evidence-packs,
runbooks) vit dans **un repo séparé** :

- Runtime DEV : `/opt/automecanik/governance-vault/`
- GitHub : https://github.com/ak125/governance-vault

Règles synthétiques (détails dans MEMORY.md `vault-sot-adr013.md`,
`vault-flow-direction.md`, `feedback_branch_scope_discipline.md`) :

1. **Aucune ADR / rule / policy / evidence-pack ne naît dans ce monorepo.** Ouvrir une
   PR dans `ak125/governance-vault` (commit signé G3, voir ADR-015).
2. **Ne jamais écrire dans `app/.local/governance-vault/`** — `.gitignored`, déprécié,
   refusé par hook pre-commit. Régression G2 si fait → déplacer vers le runtime DEV.
3. **Ne jamais dupliquer une rule canon** dans `.spec/`, `docs/governance/`, ou un
   README — **linker** le vault, ne pas réécrire.
4. **3-VPS** (ADR-012) : DEV = SoT canonique (write), PROD = mirror read-only,
   AI-COS = lit via HTTPS GitHub. Kill-switch `AI_VAULT_WRITE=false`.

Ce monorepo contient uniquement : `backend/`, `frontend/`, `shared/`, `scripts/`,
`docker/`, `.github/workflows/`, `app/`. **Aucun** `governance/`, `docs/adrs/`,
`.spec/00-canon/`.

---

## Contact

- Owner : Fafa — automecanik.seo@gmail.com
- Canon source : https://github.com/ak125/governance-vault
- Ce monorepo : https://github.com/ak125/nestjs-remix-monorepo

---

_Dernière mise à jour : 2026-05-21_
_Ce fichier est un contrat d'exécution + pointer — pour toute règle canon, voir le vault._
