# CLAUDE.md — Monorepo `nestjs-remix-monorepo`

> **Contrat d'exécution + pointer.** Régit le **comportement de l'agent** (analyser,
> décider, muter) et **pointe** vers le canon. Aucune règle de gouvernance canon
> (ADRs / rules / policies) ici — elles vivent dans un **repo séparé** (le vault, §Gouvernance).

---

## Contrat d'exécution (comportement de l'agent)

Repo **gouverné** (ADRs, contracts, registries déterministes, ratchets CI). L'assistant
**ÉTEND** l'existant — **JAMAIS** de système parallèle, source de vérité dupliquée, ni
abstraction spéculative. Objectif permanent : cohérence archi · entropie minimale ·
changements déterministes & revue-ables · périmètre minimal.

`[CRITICAL]` **NEVER invent architecture already governed elsewhere** : si une convention /
structure existe (vault, `.spec`, registry, `.claude/knowledge`), l'**étendre**, jamais en
réinventer une locale (pattern de dérive #1 des agents).

### Mode par défaut = analyser AVANT muter `[CRITICAL]`

Cartographie d'abord, mutation ensuite. Ordre de lecture obligatoire : voir §"Mémoire codebase"
(registry → REPO_MAP → knowledge → ADR vault → patterns du bounded context → **grep en dernier recours**).

- **NEVER** commencer par `Grep` / `Glob`. **NEVER** créer un fichier avant cartographie.
  **NEVER** proposer avant audit. Vérifier l'existant avant d'inventer (§dédiée, non-négociable).
- `[HIGH]` **Fraîcheur avant analyse** : avant de conclure sur un repo externe (wiki, vault) ou
  un checkout, vérifier qu'il n'est pas EN RETARD sur `origin/main`
  (`scripts/ops/check-repo-freshness.sh <repo> origin/main`). Conclure sur un checkout périmé =
  cause directe d'analyses fausses (incident 2026-07-02). En cas de doute, l'état réel du repo
  (`git show origin/main:<chemin>`) prime sur toute doc / skill dérivé.

### Repository Control Plane + artefacts générés `[HIGH]`

ADR-058/062. **L1** data auto (`audit/registry/*.json`) + **L2** overlay manuel
(`.spec/00-canon/repository-registry/*.yaml`) = **SoT (le couple)** ; **L3**
`audit/registry/canonical.json` = projection générée. Détail : `packages/registry/README.md`.

`[HIGH]` **Generated artifacts are projections, never sources of truth** : ne jamais éditer un
artefact généré (`canonical.json`, blocs `<!-- AUTO-GENERATED -->`, `REPO_MAP.md`, canon mirrors
hash-lockés) — corriger L1+L2 puis rebuild. AI Operating Map (interop des surfaces IA, non-canon,
non orchestrateur) : `.spec/00-canon/ai-registry/agent-operating-map.yaml` — mutation autoritaire
= vault ADR requis.

### Heuristiques de décision (en cas de doute) `[HIGH]`

Dans l'ordre : 1) étendre l'existant · 2) préserver le déterminisme · 3) réduire l'entropie ·
4) minimiser le blast radius · 5) préférer l'observabilité.

### Discipline de périmètre `[HIGH]`

Rester strictement dans le scope demandé. **INTERDIT** : refactor opportuniste, cleanup hors
bounded-context, upgrade de dépendance sans accord explicite, reformatage de fichiers non touchés,
réécriture archi, changement de comportement silencieux. Un seul « fais-le » = le scope nommé
uniquement, jamais d'auto-escalade. Chaque changement préserve la rétro-compat (sauf demande
contraire) et minimise le blast radius.

### Anti-bricolage & patterns interdits `[CRITICAL]`

Canon : vault `rules-engineering-quality.md` (Q1-Q4, solution structurelle vs bricolage) +
`rules-ai-antipatterns.md` (AP-*). Patterns interdits : registry ad-hoc, cache caché, schéma
dupliqué, magic constant, runtime guessing, filler SEO générique, feature flag non gouverné.

- `[CRITICAL]` **No silent fallback** : tout repli (fail-open, fallback implicite, cache / noindex /
  skip silencieux) est INTERDIT sauf explicitement gouverné ET observable (cause directe de
  plusieurs incidents).
- `[HIGH]` **Prefer extension over creation** : étendre un module / bounded-context existant avant
  de créer un fichier. Avant toute création : équivalent inexistant ? capacité non déjà fournie ?
  ownership + bounded-context définis ?

Gardes mécaniques : `.ast-grep/rules/*.yml`, `.husky/pre-commit`, `scripts/agents/validate-agents-md.sh`.

### Sécurité opérationnelle `[CRITICAL]`

Mode par défaut = analyse en lecture seule.

- **NEVER** : commande destructive (`DROP` / `TRUNCATE`), migration irréversible sans validation,
  bypass de feature flag, désactivation d'observabilité, suppression de guard / gate CI.
- **NEVER** modifier le module `payments/` (Paybox / SystemPay / Cyberplus, `PAYBOX_*` /
  `SYSTEMPAY_*`) sans demande explicite nominative — voir `.claude/rules/payments.md`.
- `[HIGH]` **Runtime-awareness** : toute mutation runtime DOIT évaluer observabilité · rollout ·
  impact cache · impact queues (BullMQ) · rollback · feature flags. Réutiliser l'observabilité
  interne existante (`rpc_*_alerts_v1`, `__seo_event_log`, stack CWV / RUM) avant tout canary externe.
- Topologie deploy DEV / PREPROD / PROD : voir §Vocabulaire déploiement + `.claude/rules/deployment.md`.

### Connaissance : RAW → WIKI → exports → consumers `[HIGH]`

ADR-031 (vault). `automecanik-raw` et `automecanik-wiki` sont des **repos externes** (comme le
vault). `raw` = donnée brute ; `wiki` = connaissance sourcée, lintée, validée humainement.
**Aucun consommateur (RAG, SEO, blog, chatbot, diagnostic) ne lit `raw` directement.** RAG =
couche **consommatrice**, jamais source de vérité.

### Invariants SEO R* `[HIGH]`

SoT des rôles : `.spec/00-canon/role-matrix.md` (v5 figée). Les rôles R* **ne sont pas** des
générateurs de contenu génériques (R1 routage gamme / compatibilité, R2 transactionnel produit,
R8 fiche véhicule). Préserver : `catalog_signature` (ADR-066, gate structurel avant diversité
texte), génération structural-first, composition vehicle-aware, relations canoniques.

- **NEVER** : filler SEO générique, amplification de duplicate-content, modification de
  meta_title / desc / H1 optimisés sans autorisation, suppression auto de page, usage du top-kw
  brut de `__seo_keywords` comme terme produit (mapping contaminé).

### Format de sortie `[HIGH]`

Contrat de sortie = `.claude/canon-mirrors/agent-exit-contract.md` (hash-locké, hors-contexte
volontaire — **ne pas recopier**). Anti-overclaim : verdict par défaut ≠ « COMPLETE » / « DONE »,
coverage manifest obligatoire.

---

## Vocabulaire déploiement — lire `.claude/rules/deployment.md` AVANT toute action infra

Vocabulaire **DEV / PREPROD / PROD** strict (3 environnements, 2 machines physiques ; mapping
IP × port × tag jamais hardcodé), formulations interdites (lint CI
`scripts/lint/check-preprod-vocabulary.sh`), ADR-075 → **[`.claude/rules/deployment.md`](.claude/rules/deployment.md)**
(glossary complet, à charger AVANT toute action infra).

---

## Démarrage de session — lire `log.md` pour contexte récent

Lire le contexte récent **via commande bornée** : `tail -n 80 log.md` (**jamais en entier** —
append-only, gaspillage tokens ; historique dans `log-archive-<année>.md`, borné par
`scripts/claude-hooks/rotate-log.sh` au-delà de 600 lignes). Délimitation : `log.md` = QUAND/QUOI
(timeline) · `MEMORY.md` (auto-loaded) = QUOI APPRIS (règles, gotchas) · PR GitHub = POURQUOI
(détails techniques) · `governance-vault/` = DÉCIDÉ CANON (ADRs, incidents, retros).

---

## Workspaces Claude Code — séparation dev / SEO / marketing / wiki

**Quatre racines de session** distinctes (dev `/opt/automecanik/app/`, `workspaces/seo-batch/`,
`workspaces/marketing/`, `workspaces/wiki/`) — chacune charge une surface skills/agents différente.
Table complète cwd × surface × usage + commandes `cd` →
**[`.claude/knowledge/workspaces.md`](.claude/knowledge/workspaces.md)** (on-demand).

---

## Agents Paperclip AI-COS

Agents documentés dans **`agents/*/AGENTS.md`** (rôle / périmètre / protocole / format de sortie —
CEO / CTO / CMO / CPO / RAG Lead / SEO Content / SEO QA) ; UUID dans le registre Paperclip (SoT
mapping), pas ici. Tout commit sur `agents/*/AGENTS.md` ou `**/CLAUDE.md` passe par
`scripts/agents/validate-agents-md.sh` (pre-commit + CI ; pas d'IP / URL / UUID / clé en dur —
mémoire `feedback_no_hardcoded_infra_in_agentsmd.md`).

---

## Mémoire codebase — lire le registry AVANT toute exploration

**Avant** tout `Grep` / `Glob` / lecture en rafale sur le code applicatif (modules NestJS, tables
DB, intégrations externes, routes React Router critiques), **lire dans cet ordre** :

0. **[`audit/registry/canonical.json`](audit/registry/canonical.json)** — SoT machine-readable du
   Repository Control Plane (ADR-058). Index files/db/rpc/runtime/deps par domaine D1..D15 +
   ownership. **Query via `jq`** (ex. `jq '.files[] | select(.path | contains("payments"))'
   audit/registry/canonical.json`) — jamais `cat` / `jq .` en entier (~770k tokens).
1. **[`.claude/knowledge/REPO_MAP.md`](.claude/knowledge/REPO_MAP.md)** — projection humaine du
   canonical (généré). Stats par domaine, owners, liens modules prose.
2. [`.claude/knowledge/README.md`](.claude/knowledge/README.md) — index navigation prose détaillée.
3. Fichiers pertinents sous `.claude/knowledge/{modules,db,integrations,routes}/`.

Registry généré depuis L1 (AST : `build-deep-inventory.js` + `build-db-usage-map.js`) + L2 (overlay
`.spec/00-canon/repository-registry/*.yaml`) ; SoT = le couple. Bloc `<!-- AUTO-GENERATED -->` des
`modules/*.md` rafraîchi par `scripts/knowledge/refresh-knowledge.py` (pre-commit) ; prose éditée à
la main. **Grep reste légitime** pour : debugging ciblé, strings, cas non couverts, cross-refs larges.
`.claude/knowledge/` et `audit/registry/` **référencent** le canon vault, ne le dupliquent pas.

---

## Vérifier l'existant AVANT d'inventer (règle non-négociable)

> **Avant** de proposer une nouvelle convention (ENV var, domaine, table, service, path de
> fichier), **GREP** systématiquement la racine du codebase. **Tout est déjà documenté à la racine.**

Si grep retourne du code qui résout déjà le problème → **étendre l'existant**, jamais créer de
nouveau ; gap réel → confirmer par 2-3 patterns différents avant de proposer. Table de commandes
par type de proposition (ENV var / domaine / table DB / service / skill) + « Pourquoi » (incidents
de conventions inventées) → **[`.claude/knowledge/verify-before-invent.md`](.claude/knowledge/verify-before-invent.md)** (on-demand).

---

## Gouvernance — pointer vault uniquement

Toute la gouvernance (ADRs, rules T/G/AI/V, policies, MOCs, incidents, evidence-packs, runbooks)
vit dans un **repo séparé** : runtime DEV `/opt/automecanik/governance-vault/` · GitHub
`https://github.com/ak125/governance-vault`. Détails MEMORY.md (`vault-sot-adr013.md`,
`vault-flow-direction.md`, `feedback_branch_scope_discipline.md`).

1. **Aucune ADR / rule / policy / evidence-pack ne naît dans ce monorepo** — ouvrir une PR dans
   `ak125/governance-vault` (commit signé G3, ADR-015).
2. **Ne jamais écrire dans `app/.local/governance-vault/`** (`.gitignored`, déprécié, refusé par
   pre-commit) — régression G2 → déplacer vers le runtime DEV.
3. **Ne jamais dupliquer une rule canon** (`.spec/`, `docs/governance/`, README) — **linker** le
   vault, ne pas réécrire.
4. **3-VPS** (ADR-012) : DEV = SoT canonique (write), PROD = mirror read-only, AI-COS = lit via
   HTTPS GitHub. Kill-switch `AI_VAULT_WRITE=false`.
5. **Normativité ADR** : normative seulement si `status: accepted` ET sans `superseded_by` actif.
   `deprecated` / `superseded` = contexte historique (audit trail, chaînes `amends` / `supersedes`),
   jamais justification d'implémentation courante. Statut via `ops/moc/MOC-Decisions.md` (vault,
   auto-synchronisé), pas d'index parallèle. En cas de conflit ADR ↔ état réel du code / wiki (ou
   skill dérivé ↔ repo), **l'état du repo prime**.

Ce monorepo contient uniquement : `backend/`, `frontend/`, `shared/`, `scripts/`, `docker/`,
`.github/workflows/`, `app/`. **Aucun** `governance/` ni `docs/adrs/` (la gouvernance canon —
ADRs / rules / policies — vit au vault). Seul `.spec/00-canon/repository-registry/**` existe
légitimement ici comme surface de contrats **Layer 2** du Repository Control Plane (ADR-058/062,
référencé plus haut) — ce n'est PAS de la gouvernance canon dupliquée. La légitimité de cette
surface L2 **ne confère aucune autorité courante** aux autres documents legacy `.spec/00-canon/**`
voisins (ex. `architecture.md`, `rules.md`, `governance-policy.md`), dont le statut est traité
séparément (fermeture gouvernée).

---

## Contact

- Owner : Fafa — automecanik.seo@gmail.com
- Canon source : https://github.com/ak125/governance-vault
- Ce monorepo : https://github.com/ak125/nestjs-remix-monorepo

---

_Dernière mise à jour : 2026-07-04 (slim P1/P3 : sections référentielles condensées en pointers,
0 non-négociable retiré)._
_Contrat d'exécution + pointer — pour toute règle canon, voir le vault._
