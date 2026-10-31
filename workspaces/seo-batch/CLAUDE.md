# CLAUDE.md — Workspace SEO Batch (AutoMecanik)

> Workspace dédié aux campagnes SEO : keyword planning R0-R8, content generation, RAG enrichment, audits gammes et véhicules.

## Quand utiliser ce workspace

```bash
cd /opt/automecanik/app/workspaces/seo-batch && claude
```

Le [contrat commun](../../CLAUDE.md) s'applique avec les rôles de [AGENTS.md](AGENTS.md).
Héritage des instructions, skills et mémoire : [carte des workspaces](../../.claude/knowledge/workspaces.md).
Avant d'agir, y appliquer **Sélection et application des skills**, même si la session
a démarré à la racine ; lire explicitement le skill SEO retenu et ses références requises.

## Règles spécifiques SEO

Voir `.claude/rules/seo-batch.md` pour :
- Sources WIKI validées et projections autorisées ; RAG réservé au chatbot, jamais source de génération SEO
- Pièges DB connus (`gamme_aggregates`, V-Level v5.0, vehicles)
- Anti-patterns (parts-feed re-scrape, naming "tecdoc")
