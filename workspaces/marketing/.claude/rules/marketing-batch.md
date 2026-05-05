# Règles Marketing Batch

S'applique aux runs depuis `workspaces/marketing/`. Complète (sans les remplacer) les règles génériques monorepo (`/opt/automecanik/app/CLAUDE.md`) + le canon brand voice (`marketing-voice.md`) + le contrat AEC (`agent-exit-contract.md`).

## Sources de vérité

- **Canon brand voice** : `.claude/canon-mirrors/marketing-voice.md` (copie distribuée via canon-publish, hash vérifié CI). Source unique = `governance-vault/ledger/rules/rules-marketing-voice.md`.
- **ADR-036** : `governance-vault/ledger/decisions/adr/ADR-036-marketing-operating-layer.md`.
- **Backend marketing** : `backend/src/modules/marketing/` (9 services existants, à NE JAMAIS dupliquer).
- **DB Supabase** via MCP : tables Phase 1 = `__marketing_brief` + `__marketing_feedback` + `__retention_trigger_rules` + `users.marketing_consent_at`.
- **Wiki/RAG** : `automecanik-wiki/wiki/{vehicle,gamme}/` + `rag/knowledge/gammes/`.
- **Vault gouvernance** : `governance-vault/ledger/` pour les recettes canon (runbook rollback, AEC).

## Scope par agent (verrou DTO Zod)

| Agent | `business_unit` autorisé | Channels autorisés | Refus DTO |
|---|---|---|---|
| `marketing-lead-agent` | lit ECOMMERCE + LOCAL, **n'exécute aucun brief** | n/a (produit un plan, pas un brief) | tente de produire un brief direct |
| `local-business-agent` | LOCAL only | `gbp`, `local_landing`, `sms` | `website_seo`, `email`, `social_*` |
| `customer-retention-agent` | ECOMMERCE primary, HYBRID strict zone 93 | `email`, `sms`, `social_*` (ECOMMERCE) ; HYBRID = 2 channels distincts | `gbp` seul, `local_landing` seul |

## Brief obligatoires (DTO Zod refinement)

Tout brief inséré dans `__marketing_brief` doit avoir :

- `business_unit` ∈ `{ECOMMERCE, LOCAL, HYBRID}` (NOT NULL CHECK SQL)
- `channel` ∈ liste fermée (NOT NULL CHECK SQL)
- `conversion_goal` ∈ `{CALL, VISIT, QUOTE, ORDER}` (NOT NULL CHECK SQL)
- `cta` non-vide
- `target_segment` non-vide
- `coverage_manifest` JSONB avec les 7 champs AEC obligatoires

**HYBRID** : exige en plus dans `payload` les 5 conditions (`target_zone`/`hybrid_reason`/`cta_ecommerce`/`cta_local`/`conversion_goal_*`). Sans ça, refus DTO en amont.

## RGPD non-négociable

Aucun brief avec `business_unit IN ('ECOMMERCE','HYBRID')` et `channel IN ('email','sms')` ne peut cibler un user qui n'a pas `users.marketing_consent_at IS NOT NULL`. Filtré en triple : DTO Zod + query SQL agent + test négatif Phase 1.

## Verrou canon LOCAL

`brand-compliance-gate.service.ts` retourne verdict `BLOCK` avec raison `local_canon_unvalidated` pour tout brief `business_unit IN ('LOCAL','HYBRID')` tant que `rules-marketing-voice.md` section `local_canon` n'a pas `validated: true` + tous les TBD remplis (`legal_name`, `trade_name`, `address`, `phone`, `opening_hours`).

## Sortie en table DB, pas en `.md` flottants

Tout brief = ligne dans `__marketing_brief` (JSONB structuré). **Jamais** de `.md` créé hors workspaces/marketing/.claude/agents/ par un agent. Les outputs `.md` sont réservés aux agents/skills/rules eux-mêmes (méta-données du workspace), pas aux livrables marketing.

## Anti-patterns marketing (en plus des Q1-Q4 monorepo)

- **Pas de schema Paperclip inventé** (`activation_mode`, `write_scope` n'existent pas — vérifier `paperclip/docs/specs/agent-config-ui.md`).
- **Pas de duplication backend marketing/** — les agents *consomment* via `/api/marketing/*`, ne réécrivent pas les services.
- **Pas de prédiction LLM de conversion** (`expected_conversion`) — on mesure via `__marketing_feedback`, on ne devine pas.
- **Pas de constantes magiques** (`calls*3 + clicks` en dur) — pondération dans `backend/src/modules/marketing/marketing-scoring.config.ts` overridable ENV.
- **Pas de règles métier hardcodées** (cycles freinage/vidange/batterie) — table `__retention_trigger_rules` data-driven.
- **Pas d'agent qui publie** — validation humaine obligatoire (AI4 « QTO valide AVANT publication »).
- **Pas de provider externe Phase 1-2** (GBP API, Mailjet, Twilio) — copy/paste manuel, providers = Phase 3 différée.
- **Pas de fusion ECOMMERCE/LOCAL hors HYBRID strict** — DTO Zod refuse, CHECK SQL refuse, OperatingMatrix `subdomains` refuse.

## Contrat de sortie agents

`./agent-exit-contract.md` — règle non-négociable applicable à tous les agents marketing G1 (LEAD, LOCAL, RETENTION).

## Référence

- ADR-036 — Marketing Operating Layer (vault)
- ADR-013 — Agent lifecycle G1/G2/G3 (vault)
- ADR-025 — SEO Department (référence pattern OperatingMatrix)
- Plan rev 6 — `/home/deploy/.claude/plans/verifier-la-strategie-une-piped-hummingbird.md`
- Runbook rollback — `governance-vault/ledger/knowledge/runbook-marketing-pilot-rollback.md`
