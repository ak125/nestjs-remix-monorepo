# AGENTS.md — AutoMecanik / `nestjs-remix-monorepo`

## Rôle et amorçage

Le contrat commun reste dans [CLAUDE.md](CLAUDE.md). Le lire une fois avant
d'intervenir s'il n'est pas déjà chargé. Ce lien est une consigne de lecture,
pas un import automatique Codex.

Depuis `workspaces/<workspace>/`, lire aussi le `CLAUDE.md` de ce workspace
avant d’intervenir ; il précise les règles locales et leurs références pertinentes.
Pour toute tâche relevant d'un workspace, même lancée à la racine, appliquer
**Sélection et application des skills** dans `.claude/knowledge/workspaces.md`.
Cette lecture explicite s'applique aussi aux exécutants isolés lancés par Hermes.

Les règles plus proches précisent leur seul périmètre. Codex préfère
`AGENTS.override.md` à `AGENTS.md` dans un même répertoire, puis combine les
instructions de la racine au répertoire de travail. Ne pas lui attribuer les
imports ou le chargement des `.claude/rules/` de Claude Code.

## Références à la demande

- Lire la règle du domaine indiquée dans `CLAUDE.md` ; charger
  `.claude/rules/deployment.md` avant toute action infra et
  `.claude/rules/guardrails.md` avant modification d'une garde.
- `.agents/skills` pointe vers `.claude/skills` dans ce dépôt. Vérifier la
  destination réelle avant édition. Chaque workspace expose ses skills par le
  même lien relatif local ; les sources restent dans `.claude/skills/`.
  Depuis la racine, lire explicitement le skill du workspace concerné : un lien
  imbriqué ne prouve pas sa découverte dans cette session.
- Les politiques `agents/openai.yaml` des skills sensibles restent applicables.
  Un skill ne lève ni une zone STOP ni une permission système.
- Relecture française : `.claude/prompts/_shared/editorial-review.md`.
- Chargement et limites par agent : `.claude/knowledge/workspaces.md`.

## Format de sortie

**CONTRAT DE SORTIE** : `.claude/canon-mirrors/agent-exit-contract.md`.
Présenter les corrections autorisées, les preuves du périmètre et leurs limites.
L'autorisation déjà donnée ne doit pas être redemandée pour chaque étape.
