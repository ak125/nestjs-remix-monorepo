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

_Dernière mise à jour : 2026-05-03_
_Ce fichier est un pointer — pour toute règle, voir le vault._
