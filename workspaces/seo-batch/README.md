# SEO Batch Workspace

Workspace pour le planning de mots-clés, les audits SEO et la méthode de contenu
[seo-content-loop](.claude/skills/seo-content-loop/SKILL.md).
Les rôles et statuts sont décrits dans [AGENTS.md](AGENTS.md) ; les règles métier
sont dans [CLAUDE.md](CLAUDE.md) et [.claude/rules/seo-batch.md](.claude/rules/seo-batch.md).

## Sources et méthode de contenu

Le contenu vient de **RAW → WIKI validée → exports/projections autorisés → consommateurs**.
Le **RAG est réservé au chatbot**, jamais source de génération SEO.

- Pour planifier ou exécuter la méthode de contenu R1-R8, consulter
  [seo-content-loop](.claude/skills/seo-content-loop/SKILL.md), dans le mandat autorisé.
- Pour rédiger des proposals WIKI, utiliser le [workspace WIKI](../wiki/README.md).
  La présence d'un outil ne prouve pas sa promotion, son activation ou son résultat servi.
- Les agents marqués **NEUTRALISÉ** dans [AGENTS.md](AGENTS.md) restent inertes ;
  leurs fichiers indiquent leurs remplacements. Ne pas les réactiver.
- Les opérations RAG concernent le chatbot selon le périmètre de
  [rag-ops](.claude/skills/rag-ops/SKILL.md), sans ingestion RAG destinée au contenu SEO.

## Usage et chargement

```bash
cd /opt/automecanik/app/workspaces/seo-batch && claude
```

Les instructions et skills parents restent applicables. La
[carte commune des workspaces](../../.claude/knowledge/workspaces.md) décrit la découverte
Claude/Codex ; ce dossier ne constitue pas une isolation technique.
Consulter la description du skill pertinent sous `.claude/skills/`, sans charger le catalogue entier.
Le contrat de sortie distribué est sous `.claude/canon-mirrors/`, séparé des règles locales.

## Choisir le périmètre

| Tâche | Point d'entrée |
|---|---|
| Planning KW, audit SEO, qualité ou diversité | Ce workspace et le skill pertinent |
| Méthode de contenu R1-R8 à partir de WIKI validée | `seo-content-loop` |
| Rédaction de proposals WIKI | `workspaces/wiki/` |
| Diagnostic du retrieval chatbot | `rag-ops`, dans son périmètre autorisé |
| Modification backend/frontend ou infrastructure | Racine du dépôt et règles du domaine |

Ce guide n'autorise aucune migration, publication, activation ni intervention PROD.
