# Marketing Workspace

Claude Code project root pour les agents marketing AutoMecanik (ADR-036). Charge uniquement les agents marketing G1 + skills marketing-relevant, sans charger les 39 agents R0-R8 SEO ni les 8 skills dev daily.

## Pourquoi ce workspace existe

Phase 0 ADR-036 introduit 3 agents G1 dédiés au marketing :

| Agent | Scope `business_unit` | Routine Paperclip |
|---|---|---|
| `marketing-lead-agent` | lit ECOMMERCE + LOCAL, exécute aucun | `rt-weekly-marketing-plan` (lundi 07:00) |
| `local-business-agent` | LOCAL only (10 communes 93) | `rt-local-gbp-week` (mercredi 09:00) |
| `customer-retention-agent` | ECOMMERCE primary, HYBRID strict zone 93 | `rt-retention-monthly` (1er du mois) |

Les mélanger avec les 39 agents R0-R8 SEO (`workspaces/seo-batch/`) diluerait le scope. Le pattern dual-workspace (PR #200) est étendu ici — 3 racines Claude Code distinctes :

| cwd | Surface chargée | Usage |
|-----|-----------------|-------|
| `/opt/automecanik/app/` | 8 skills DEV | dev backend/frontend, refactor, CI, ADR, governance |
| `/opt/automecanik/app/workspaces/seo-batch/` | 39 agents R0-R8 + 16 skills SEO | campagnes SEO, KW planning, content gen, RAG enrich |
| `/opt/automecanik/app/workspaces/marketing/` | 3 agents G1 marketing + skills marketing-relevant | briefs marketing, GBP posts, retention campaigns |

## Usage

```bash
# Session marketing (charge uniquement les 3 agents G1 marketing)
cd /opt/automecanik/app/workspaces/marketing && claude

# Session SEO (charge les 39 agents R0-R8)
cd /opt/automecanik/app/workspaces/seo-batch && claude

# Session dev daily (ne charge AUCUN agent métier)
cd /opt/automecanik/app && claude
```

## Contenu

- `.claude/agents/` : 3 agents G1 marketing — arrivent en Phase 1 (`local-business-agent`) et Phase 2 (`marketing-lead-agent`, `customer-retention-agent`)
- `.claude/skills/` : skills marketing-relevant (réutilisés via paths partagés au démarrage, dédiés plus tard si gap)
- `.claude/rules/` : règles spécifiques marketing (`marketing-batch.md`) + canons distribués depuis le vault (`marketing-voice.md`, `agent-exit-contract.md`)
- `.claude/settings.json` : hooks PreToolUse / PostToolUse / Stop (mêmes scripts que monorepo, paths absolus)
- `CLAUDE.md` : pointer vers gouvernance + règles marketing spécifiques

## Phase actuelle

**Phase 0 (J+0 → J+5)** : scaffold workspace + canon brand voice + workflow CI hash check. ADR-036 mergé côté vault. Pré-requis Phase 1 = merge PR monorepo #222 (`feat/seo-agent-operating-matrix`).

**Phase 1 (J+5 → J+15)** : pilote `local-business-agent` (10 communes 93, 1 GBP post/commune/semaine max). Scaffold backend (`__marketing_brief` + `__marketing_feedback` + `__retention_trigger_rules` + `users.marketing_consent_at`).

**Phase 2 (J+15 → J+30)** : `marketing-lead-agent` + `customer-retention-agent`.

**Phase 3 (différée)** : branchement providers externes (Mailjet/Brevo email, Twilio SMS, GBP API). ADR séparée par provider.

## Références

- ADR-036 : `governance-vault/ledger/decisions/adr/ADR-036-marketing-operating-layer.md`
- Brand voice : `.claude/canon-mirrors/marketing-voice.md` (canon distribué depuis vault)
- Runbook rollback : `governance-vault/ledger/knowledge/runbook-marketing-pilot-rollback.md`
- Plan détaillé : `/home/deploy/.claude/plans/verifier-la-strategie-une-piped-hummingbird.md`
