# CLAUDE.md — Workspace Marketing (AutoMecanik)

> Workspace dédié aux agents marketing G1 (ADR-036) : briefs orientés conversion, posts GBP, campagnes retention, plan hebdo cross-units.

## Quand utiliser ce workspace

```bash
cd /opt/automecanik/app/workspaces/marketing && claude
```

Le [contrat commun](../../CLAUDE.md) s'applique avec les rôles de [AGENTS.md](AGENTS.md).
Héritage des instructions, skills et mémoire : [carte des workspaces](../../.claude/knowledge/workspaces.md).

## Règles spécifiques marketing

Voir `.claude/rules/marketing-batch.md` pour :
- Scope par agent (LOCAL only / ECOMMERCE primary+HYBRID / coordination cross-units)
- DTO Zod refinements (conversion_goal, business_unit, HYBRID 5 conditions)
- RGPD non-négociable (`marketing_consent_at IS NOT NULL` filtre dur RETENTION)
- Verrou `local_canon.validated=true` (sinon BLOCK systématique LOCAL/HYBRID)
- Anti-patterns écartés (.md flottants, schema Paperclip inventé, prédiction LLM, constantes magiques, etc.)

Voir `.claude/canon-mirrors/marketing-voice.md` pour la voix de marque (copie générée depuis `.spec/00-canon/canon-distribution/rules-marketing-voice.md` du monorepo, contrôlée par hash).

Voir `.claude/canon-mirrors/agent-exit-contract.md` pour le contrat de sortie obligatoire (AEC : coverage manifest, 5 états séparés, statuts autorisés ; version dans son en-tête).
