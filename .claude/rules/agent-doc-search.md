# Recherche documentaire — sources ciblées

- Tâche ciblée : lire les fichiers connus et utiliser Grep natif ou `rg` avec
  chemins, motifs et sorties bornés. Pas de cartographie globale obligatoire.
- Exploration transverse : filtrer `audit/registry/canonical.json` via `jq`,
  puis consulter `.claude/knowledge/REPO_MAP.md` et les notices pertinentes.
  L1 + L2 sont les sources ; le registre canonical est une projection à vérifier.
- Ne pas lire le registre en entier, ajouter un wrapper de recherche ou créer
  un index/RAG parallèle. `.claude/knowledge/` référence le vault sans le dupliquer.
- Une recherche Markdown ne prouve ni une vérité métier ni un état servi :
  confronter le constat au contrat, au code ou au runtime concerné.
- Agents sans filesystem : utiliser leurs API/MCP de lecture réellement
  disponibles ; l'absence d'accès local n'autorise aucun accès supplémentaire.
