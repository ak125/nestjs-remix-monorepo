# `.claude/handoffs/` — documents de reprise de session

Un document de reprise permet à une session qui n'a pas vécu la précédente de repartir sans
re-découvrir l'état. Convention : `reprise-AAAA-MM-JJ.md`, et chaque document **périme
explicitement** son prédécesseur sur les points qui ont changé.

## Ce qui se commite ici

Les `reprise-*.md`. Ils sont versionnés parce qu'un document de reprise qui ne vit que sur le
disque d'une machine disparaît avec elle — exactement le risque qu'il sert à documenter.

## Ce qui ne se commite JAMAIS ici

- **De la gouvernance** — ADR, rules, policies, evidence-packs. Elles vivent au vault
  (`ak125/governance-vault`), jamais dans ce monorepo (CLAUDE.md §Gouvernance, règles 1 et 3).
  Le dossier `vault-fafa-g3/` est une zone de préparation de PR vault : il reste **non suivi**.
- Les artefacts de passage : `*.patch`, brouillons de description de PR. Ils sont utiles le temps
  d'une PR et deviennent faux ensuite.

## Avant de committer un document de reprise

Il sera lu par quelqu'un qui agira sans vérifier. Donc :

1. Marquer chaque fait comme vérifié ou hérité, avec sa date — l'état bouge en heures.
2. Ne pas y figer d'infrastructure (IP, hôte, port, UUID) : pointer `.claude/rules/deployment.md`.
3. Passer les gardes du dépôt, pas l'œil :
   `bash scripts/lint/check-preprod-vocabulary.sh` et `gitleaks detect --no-git --source .claude/handoffs`.
