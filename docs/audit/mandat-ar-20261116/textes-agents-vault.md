# Textes lus au démarrage qui renvoient au vault comme source ou exigent une ADR (complément AR-4, point 4)

Relevé du 2026-11-16 sur la branche du complément AR-4, base `origin/main` `f9e288348`.

**Méthode.** Corpus = fichiers suivis par Git qui sont chargés au démarrage ou à la demande par les
agents :

```bash
git ls-files | grep -E '(^|/)(CLAUDE|AGENTS)\.md$|(^|/)\.claude/(rules|agents|skills|hooks|governance)/|^scripts/claude-hooks/|^\.husky/|(^|/)\.claude/settings\.json$'
```

Le corpus compte 226 fichiers, dans tout le dépôt (workspaces compris). Deux recherches y sont
lancées : `governance-vault`, « vault source / canon / décide », « exige une ADR » (73 lignes) ; puis
toute ligne qui contient `vault` avec `canon`, `source`, `décid`, `normati` ou `autorit`.
`.claude/governance/journal-des-principes.md` est exclu, puisqu'il est la règle. Les lignes qui
nomment seulement le skill `governance-vault-ops`, ou le « vault Obsidian SEO » du skill
`seo-vault-verify`, sont hors sujet : ce dernier est un autre objet.

`scripts/claude-hooks/*` et les `.claude/settings.json` : aucune occurrence.

**États.**

- **Corrigé (point 3)** : modifié dans la PR AR-4 ; le texte cite sa contradiction.
- **Patch réservé** : fichier réservé à l'owner, patch dans `patches/`.
- **Étape N** : attend l'étape N du plan ([`inventaire-vault-et-plan.md`](inventaire-vault-et-plan.md) §2) ;
  un complément par étape, une PR prouvée.
- **Citation** : cite une ADR comme raison ou trace historique, sans en faire une source en
  vigueur ; aucune action requise. Le principe du journal qui la reprend est donné quand il existe.

## Corrigés au point 3

| Chemin:ligne | Ce qui était écrit | Correction | Contradiction |
|---|---|---|---|
| `workspaces/wiki/.claude/rules/wiki-batch.md:22` | promotion « manuelle reviewer humain » | promotion par son décideur, sur preuve, auto-review comprise (ADR-119, P10) | A1 |
| `workspaces/wiki/.claude/rules/wiki-batch.md:3,93,95,122` | AEC v1.0.0, copie locale du workspace | copie déclarée de la racine, version dans son en-tête | D16 |
| `workspaces/wiki/CLAUDE.md:24` | copie locale « AEC v1.0.0 » | copie déclarée de la racine ; la copie locale ne fait pas foi (P30) | D16 |
| `workspaces/wiki/AGENTS.md:36-42` | « mirror vault », synchronisée par `scripts/cron/sync_canon_mirrors.py` (script absent du dépôt) | copie périmée, ne fait pas foi ; retrait ou déclaration à l'étape 2 (owner) | D16 |
| `workspaces/wiki/.claude/skills/wiki-proposal-writer/SKILL.md:3,117,205` | AEC v1.0.0, `./agent-exit-contract.md` | AEC sans version figée ; copie déclarée de la racine | D16 |
| `workspaces/marketing/.claude/skills/fafa-brand-safety-reviewer/SKILL.md:15` | règle AI2 du vault (`rules-ai-cos.md`) | principe P31 | E19 |
| `.claude/rules/deployment.md:24-28` | vocabulaire « décidé au vault » ; « ce fichier ne fonde pas la décision » | règle en vigueur = P1 du journal ; ADR-075 garde la raison | C12 |
| `.claude/rules/deployment.md:182-188` | fusion selon T6 de `rules-technical` (vault), ADR-123/124 | P20 et P21 ; porte ADR-124 tant que les circuits ne sont pas activés | C12 (F22) |

C12 n'est pas dans la liste A, B, D, E, F du point 3. Il est corrigé parce qu'il présente le vault
comme source d'une règle que le journal porte déjà (P1, P20) : c'est une source concurrente, que le
complément demande de retirer. Le fichier est en zone CODEOWNERS : la PR suit donc le circuit élevé.

Hors corpus de démarrage, corrigé aussi : `workspaces/wiki/README.md:29` (D16) et
`workspaces/marketing/fafa-media-factory/scripts/README.md:18` (E19).

## Patch réservé

| Chemin:ligne | Ce qui est écrit | Patch |
|---|---|---|
| `CLAUDE.md:4-5` | « La gouvernance canonique reste dans le dépôt séparé `ak125/governance-vault`. » | `patches/05-claude-md.patch` |
| `CLAUDE.md:100-106` (§Gouvernance) | « Vault séparé… Aucune nouvelle ADR, rule, policy… dans ce monorepo… Changement vault = PR signée, fusion humaine » ; « ADR normative seulement si `accepted` » | `patches/05-claude-md.patch` |

## Attendent une étape du plan

| Chemin:ligne | Ce qui est écrit | Étape |
|---|---|---|
| `.husky/pre-commit:19-51` | les miroirs se comparent au clone du vault (`sync_canon_mirrors.py --check`) ; « vault canon must remain the only source of truth » | 2 (générateur local) |
| `.husky/pre-commit:54-79` | bloque `governance-vault/` dans le dépôt, messages « ADR-015 », « Move these files to the canonical vault » | 8 ; le blocage reste juste (jamais d'écriture dans `app/.local/governance-vault/`), seuls les messages changent |
| `.claude/skills/governance-vault-ops/SKILL.md:22-24` | « ADR-101 (le vault décide) et ADR-102… ils priment sur ce skill » | 8 (réécriture en « archive en lecture seule ») |
| `.claude/skills/governance-vault-ops/SKILL.md:38-40,67-106` | synchronisation vault → monorepo ; préparer une PR vault | 2 (l.38-40), puis 8 |
| `.claude/rules/security-hooks.md:15` | « Definition of Done canonique, règle vault `rules-engineering-definition-of-done` » | 8 ; la DoD passe au monorepo (ADR-138 D6) |
| `.claude/governance/guard-hierarchy.yaml:86-93,103,107` | L4 : « an ADR in the governance vault BEFORE merge » (`requires_adr: true`) ; ajout d'une garde L3/L4 « requires an ADR » | 8 ; **exige une ADR**. Aucun code ne lit ces clés (`git grep requires_adr` vide). Ce qui remplace l'ADR (principe au journal, circuit élevé) est une décision de l'owner. |
| `.claude/skills/README.md:110` | sortie de Phase 2 : « promote ADR vault » | 8 ; **exige une ADR** |
| `agents/{ceo,cmo,cto,rag-lead,seo-content,seo-qa}/AGENTS.md` (l.86-99, 102-104, 393-395, 180-182, 91-93) | « consulter le canon… vault `governance-vault/` » ; « l'accès au canon passe par le vault » | 8 ; `agents/*/AGENTS.md` **ne figure pas** dans la liste de l'étape 8 : à y ajouter |
| `agents/cpo/AGENTS.md:21,41` | source de vérité `governance-vault/` ; « toute ADR vit dans `governance-vault/` » | 8 (même remarque) |
| `agents/seo-content/AGENTS.md:25` | « Canon au vault : ADR-031… ADR-086 » | 8 (même remarque) |
| `workspaces/seo-batch/.claude/skills/seo-content-loop/SKILL.md:13,130` | « La gouvernance vit au vault » ; un seuil change « par son circuit de gouvernance (vault/ADR) » | 8 ; l.149 cite ADR-131 `proposed` (verdict proposé pour la PR vault #413) |
| `workspaces/seo-batch/.claude/rules/seo-batch.md:9,22` | recettes canon dans `governance-vault/ledger/knowledge/` ; règle « vault canon » | 8 |
| `workspaces/marketing/CLAUDE.md:23`, `workspaces/marketing/.claude/rules/marketing-batch.md:7` | voix de marque : « canon vault », « Source unique = `governance-vault/ledger/rules/rules-marketing-voice.md` » | exact jusqu'au transfert de `marketing_voice` (étapes 1 et 2), puis 8 |
| `workspaces/marketing/.claude/agents/local-business-agent.md:59` | voix de marque « distribuée depuis vault » | 2, puis 8 |
| `workspaces/marketing/.claude/rules/marketing-batch.md:8,12,68` | ADR-036 ; recettes et runbook de rollback au vault | 8 (le runbook est un artefact vivant du vault : à reloger, comme à l'étape 7) |
| `workspaces/marketing/AGENTS.md:37` | « ADR-060 invariant 5 (vault décide, pas d'écriture métier) » | 8 ; l'interdit d'écrire dans le vault reste juste, « vault décide » ne l'est plus |
| `workspaces/marketing/AGENTS.md:46-48,58-61` | miroir de `rules-marketing-voice` ; synchronisation par `scripts/cron/sync_canon_mirrors.py` (absent du dépôt) | 2, puis 8 |
| `workspaces/marketing/.claude/skills/fafa-persona-canon/SKILL.md:8,81` | règle vault annoncée ; « V2+ = PR vault dédiée + ADR addendum » | 8 ; **exige une ADR** |
| `workspaces/wiki/AGENTS.md:32` | « `governance-vault/` ❌ Non — ADR-060 invariant 5 » | 8 ; interdit d'écriture, toujours juste |
| `workspaces/wiki/CLAUDE.md:34-36`, `wiki-batch.md:9,11`, `wiki-proposal-writer/SKILL.md:22,193` | ADR-031/032/033 « (vault) », chemins `governance-vault/ledger/…`, « governance-vault canon » | 8 ; P10 et P19 reprennent la règle |

## Citations (aucune action requise)

| Chemin:ligne | Nature |
|---|---|
| `workspaces/seo-batch/.claude/agents/{conseil-batch,r1-content-batch,r4-content-batch,r6-content-batch,r7-brand-rag-generator}.md:15-16` | « (ADR-031 / ADR-046, vault) » comme raison de l'interdit RAG → contenu ; règle reprise par P11. À repointer vers P11 à l'étape 8, sans urgence. |
| `.claude/skills/vehicle-ops/SKILL.md:323,392`, `.claude/skills/runtime-truth-audit/checks/massdoc-typeid-invariant.md:14,35` | origine historique (ADR-032, ADR-085, PR vault #319) ; P7 reprend ADR-085 |
| `workspaces/seo-batch/AGENTS.md:58` | trace « PR vault #19 » |
| `workspaces/marketing/.claude/skills/fafa-brand-safety-reviewer/SKILL.md:222` | constat : règles vault introuvables |
| `workspaces/marketing/README.md:308` | entrée d'historique C18-11 (cite AI2) ; laissée telle quelle, le texte en vigueur est corrigé (E19) |

## Bilan

- 8 emplacements corrigés au point 3 (A1, C12, D16, E19), plus 2 hors corpus.
- 1 fichier réservé : `CLAUDE.md`, deux endroits, un patch.
- 20 lignes du tableau attendent une étape du plan : 2, 8, ou 1-2 puis 8.
- 4 textes **exigent une ADR** : `guard-hierarchy.yaml`, `.claude/skills/README.md:110`,
  `fafa-persona-canon/SKILL.md:81` et `CLAUDE.md` (« aucune nouvelle ADR… dans ce monorepo »,
  traité par le patch). Les trois premiers attendent l'étape 8 et une décision de l'owner sur ce qui
  remplace l'ADR.
- À ajouter à la liste de l'étape 8 : `agents/*/AGENTS.md` (7 fichiers).
