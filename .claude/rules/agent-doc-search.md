# Recherche documentaire des agents — registry-first, Grep natif, zéro nouvelle couche

> Comment un agent retrouve du contexte documentaire dans ce monorepo.
> **Aide à la lecture uniquement** — la vérité reste `RAW → WIKI → exports → consommateurs`.

## Ordre de recherche (avant toute exploration en rafale)

1. **`audit/registry/canonical.json`** — Source of Truth machine-readable (ADR-058).
   Query via `jq` (ex. `jq '.files[] | select(.path | contains("payments"))' audit/registry/canonical.json`).
2. **`.claude/knowledge/REPO_MAP.md`** puis `.claude/knowledge/{modules,db,integrations,routes}/`.
3. **Grep natif** pour debugging ciblé, strings, cas non couverts par le registry.

L'outil **Grep** de Claude Code **EST** ripgrep (smart-case, `--glob '*.md'`, exclusions,
numéros de ligne intégrés). Donc :

- **Pas de wrapper** type `md-find.sh` — re-wrapper le natif = abstraction plus faible.
- **Pas de nouvel index**, pas de QMD, pas de couche RAG parallèle, pas de vérité parallèle.

## Interdits

- Ne **jamais** trancher un fait canonique (SEO runtime, R2, supplier truth, canonical URL)
  à partir d'un grep de markdown. Ces décisions passent par leurs sources dédiées (vault,
  RPC, funnel), pas par cette recherche.
- Lecture seule : cette recherche aide à comprendre, elle ne décide pas.
- La gouvernance canon vit au vault (`governance-vault/`) — `.claude/knowledge/` et
  `audit/registry/` la **référencent**, ne la dupliquent pas.

## Outils CLI (ergonomie humaine — hors agents)

`rg` / `fd` / `bat` / `fzf` installés sur le VPS servent l'**humain** en shell. Les agents
Claude Code utilisent l'outil **Grep natif** (déjà ripgrep), pas ces binaires système.

## Agents sans filesystem (runtime AI-COS / Paperclip)

Les agents remote (HTTP/MCP only) n'ont pas accès au repo. Pour eux, « recherche
documentaire » = consulter le canon via le **vault** + les **APIs/MCP** listées dans leur
`AGENTS.md` (lecture seule). Aucun grep local — même discipline « canon d'abord ».
