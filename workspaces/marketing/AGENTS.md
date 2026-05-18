# AGENTS.md — `workspaces/marketing/` ownership canon

> Conformité [[ADR-061-workspace-governance]] §2 (structure obligatoire) + §5 (`AGENTS.md` exhaustif).
> Workspace marketing canon : [[ADR-036-marketing-operating-layer]] (3 agents G1 Phase 1-2 — LEAD/LOCAL/RETENTION + business_unit ECOMMERCE/LOCAL/HYBRID).

## Règle d'ownership

Le workspace `app/workspaces/marketing/` charge **uniquement** les 3 agents G1 marketing + skills marketing-relevant. Il **n'invoque** ni les 39 agents R0-R8 SEO (workspace `seo-batch/`), ni les 8 skills DEV daily (workspace `app/`), ni le skill `wiki-proposal-writer` (workspace `wiki/`).

Tout agent invoqué sous le scope de ce workspace **doit** figurer ci-dessous. Ajout/retrait d'agent = PR monorepo signée modifiant ce fichier (cf. ADR-061 §5).

## Agents Paperclip G1 LIVE (état 2026-05-14)

| Agent | Role | business_unit | Output canonique | Output interdit |
|-------|------|---------------|------------------|-----------------|
| **marketing-lead-agent** | `MARKETING_LEAD` | cross-units (ECOMMERCE + LOCAL) | Plan hebdo coordonné, arborescence priorités + handoffs (orchestration uniquement, n'exécute aucun brief) | Brief direct, copy LLM |
| **local-business-agent** | `LOCAL_BUSINESS` | LOCAL (filtre dur) | Briefs conversion-orientés GBP / local landing / signage (CALL/VISIT/QUOTE goals) | Brief où `business_unit ≠ LOCAL` |
| **customer-retention-agent** | `CUSTOMER_RETENTION` | ECOMMERCE + HYBRID | Briefs réactivation (panier abandonné, freinage > 6 mois, livraison 93 → retrait magasin HYBRID), filtre RGPD `marketing_consent_at IS NOT NULL` | Outreach sans consentement RGPD |

Fichiers source : `.claude/agents/{marketing-lead-agent,local-business-agent,customer-retention-agent}.md`.

## Skills locales

Le workspace ne charge **aucun skill local exclusif** au 2026-05-14. Les skills marketing-relevant (frontend-design, ui-ux-pro-max) restent dans `app/.claude/skills/` (DEV root) et sont disponibles via PATH d'inclusion natif Claude Code.

## Outputs autorisés (conformité ADR-036 + ADR-060 + ADR-061)

| Destination | Autorisé ? | Justification |
|-------------|-----------|---------------|
| Tables DB `__marketing_*` via backend NestJS `marketing/` modules | ✅ Oui | ADR-036 (backend NestJS = moteur unique d'exécution) |
| Briefs structurés en DB (table `__marketing_brief`) | ✅ Oui | ADR-036 (pas de `.md` flottants wiki) |
| Documentation interne workspace (ce fichier, README, CLAUDE.md) | ✅ Oui | Standard workspace |
| `automecanik-wiki/` (direct ou via proposals) | ❌ Non | ADR-031 + ADR-036 (wiki = connaissance validée, briefs ne sont pas connaissance) |
| `governance-vault/` | ❌ Non | ADR-060 invariant 5 (vault décide, pas d'écriture métier) |
| `automecanik-raw/` | ❌ Non | ADR-060 invariant 3 (monorepo n'écrit pas dans raw) |
| `automecanik-rag/knowledge/` | ❌ Non | ADR-060 invariant 4 (rag mirror jamais source) |

## Canon mirrors (read-only)

`.claude/canon-mirrors/` contient au 2026-05-14 :

- `agent-exit-contract.md` — contrat de sortie agentique commun (mirror vault)
- `marketing-voice.md` — canon voice marketing (mirror `governance-vault/ledger/rules/rules-marketing-voice.md` statut `canon`)

Synchronisation : cron VPS DEV (`scripts/cron/sync_canon_mirrors.py`, cf. [[ADR-061-workspace-governance]] §3 + vault PR #268). **Toute modification manuelle est interdite** et bloquée par `.husky/pre-commit` (cf. monorepo PR #495).

## Lifecycle workspace

Création : ADR-036 + brainstorm 2026-04-30 (Phase 1-2).
État courant : Phase 1-2 LIVE au 2026-05-14.
Phase 3 future : agents G2 (additional verticals) sous ADR dédié si besoin.

## Références

- [[ADR-036-marketing-operating-layer]] (workspace marketing canon, accepted 2026-05-13 PR vault #263)
- [[ADR-060-repository-roles-doctrine]] (5 acteurs canon, accepted 2026-05-13 PR vault #264)
- [[ADR-061-workspace-governance]] (7 invariants workspace governance, accepted 2026-05-13 PR vault #265)
- `governance-vault/ledger/rules/rules-marketing-voice.md` (status `canon`)
- README.md de ce workspace (rôle + Phase 0-3)
