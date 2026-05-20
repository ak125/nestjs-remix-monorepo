# AGENTS.md — `workspaces/wiki/` ownership canon

> Conformité [[ADR-061-workspace-governance]] §2 (structure obligatoire) + §5 (`AGENTS.md` exhaustif).
> Workspace wiki documentaire : Phase 2 [[ADR-033-wiki-gamme-diagnostic-relations-contract]].

## Règle d'ownership

Le workspace `app/workspaces/wiki/` charge **uniquement** le skill `wiki-proposal-writer` (Phase 2 LIVE) + agents wiki orchestrateurs (Phase 4 future). Il **n'invoque** ni les 39 agents R0-R8 SEO (workspace `seo-batch/`), ni les 8 skills DEV daily (workspace `app/`), ni les 3 agents G1 marketing (workspace `marketing/`).

Tout agent / skill invoqué sous le scope de ce workspace **doit** figurer ci-dessous. Ajout/retrait = PR monorepo signée modifiant ce fichier (cf. ADR-061 §5).

## Agents Paperclip LIVE (état 2026-05-14)

**Aucun agent Paperclip activé** sur ce workspace au 2026-05-14. Phase 4 (agents wiki orchestrateurs) reste future, gated par signal empirique post-Phase 2.

## Skills locales LIVE (état 2026-05-14)

| Skill | Rôle | Output canonique | Output interdit |
|-------|------|------------------|-----------------|
| **wiki-proposal-writer** | Production de fiches `automecanik-wiki/proposals/<slug>.md` au format frontmatter v1.0.0 (schema ADR-033 + ADR-039) | Fichiers `proposals/*.md` (FLAT, `_index.md` + `_manifest.json`) | `automecanik-wiki/wiki/<entity_type>/*` direct |

Fichier source : `.claude/skills/wiki-proposal-writer/`.

## Outputs autorisés (conformité ADR-033 + ADR-031 + ADR-060 + ADR-061)

| Destination | Autorisé ? | Justification |
|-------------|-----------|---------------|
| `automecanik-wiki/proposals/<slug>.md` (FLAT, schema v1.0.0) | ✅ Oui | ADR-033 + ADR-031 D19 (proposals FLAT obligatoire) |
| `automecanik-wiki/proposals/_index.md` + `_manifest.json` | ✅ Oui | ADR-031 D19 |
| Documentation interne workspace (ce fichier, README, CLAUDE.md) | ✅ Oui | Standard workspace |
| `automecanik-wiki/wiki/<entity_type>/*` direct (sans passer par proposals) | ❌ Non | ADR-031 D20 (sync-from-wiki lit `wiki/exports/rag/` uniquement, jamais `wiki/<entity_type>/`) |
| `governance-vault/` | ❌ Non | ADR-060 invariant 5 |
| `automecanik-raw/` | ❌ Non | ADR-060 invariant 3 |
| `automecanik-rag/knowledge/` | ❌ Non | ADR-060 invariant 4 + ADR-031 D22 |

## Canon mirrors (read-only)

`.claude/canon-mirrors/` contient au 2026-05-14 :

- `agent-exit-contract.md` — contrat de sortie agentique commun (mirror vault)

Synchronisation : cron VPS DEV (`scripts/cron/sync_canon_mirrors.py`, cf. [[ADR-061-workspace-governance]] §3 + vault PR #268). **Toute modification manuelle est interdite** et bloquée par `.husky/pre-commit` (cf. monorepo PR #495).

## Lifecycle workspace

Création : ADR-033 + brainstorm Phase 2 wiki.
État courant : Phase 2 LIVE au 2026-05-14 (production proposals).
Phase 4 future : agents wiki orchestrateurs (review automatique, batch proposals) sous ADR dédié si signal empirique le justifie.

## Références

- [[ADR-033-wiki-gamme-diagnostic-relations-contract]] (workspace wiki Phase 2 canon)
- [[ADR-031-four-layer-content-architecture]] (4-layer flow, D19 proposals FLAT, D20 sync garde-fou, D22 rag generated)
- [[ADR-039-wiki-frontmatter-zod-canon]] (Zod validator wiki frontmatter)
- [[ADR-060-repository-roles-doctrine]] (5 acteurs canon)
- [[ADR-061-workspace-governance]] (7 invariants workspace governance)
- README.md de ce workspace
