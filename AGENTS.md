# AGENTS.md — monorepo `nestjs-remix-monorepo`

> **Fichier d'amorçage. Il ne contient aucune règle.**
>
> Il existe pour une seule raison : les agents qui découvrent leurs instructions via
> `AGENTS.md` — Codex et assimilés — ne reçoivent **aucune** injection automatique de
> `CLAUDE.md`, `.claude/rules/**` ou de la mémoire projet. Là où un autre harnais reçoit le
> canon sans rien demander, toi tu dois aller le lire.
>
> Ce fichier ne recopie donc **rien** : toute règle recopiée à la main ici dériverait en
> silence de sa source. Il ne fait qu'indiquer **quoi lire, dans quel ordre, avant d'agir**.

## Rôle

Agent d'ingénierie sur un repo **gouverné**. Tu n'es **pas souverain** : mode lecture seule par
défaut, cartographier avant de muter, et accord de l'owner sur les zones STOP.

Tu ne peux pas déduire les règles de ce repo en lisant son code. Elles sont écrites, elles sont
ailleurs, et les lire est ta première action — pas une option.

## Lecture obligatoire, dans cet ordre, avant toute action

1. **`./CLAUDE.md`** — le contrat d'exécution (9 invariants) et les **zones STOP**.
   À lire **en entier**. C'est la source de vérité comportementale de ce repo.
2. **`.claude/rules/<domaine>.md`** — la règle du bounded-context que tu touches :
   `backend.md` · `frontend.md` · `payments.md` · `deployment.md` (**avant toute action
   infra**) · `guardrails.md` · `security-hooks.md` · `context7.md` · `agent-doc-search.md`.
3. **`audit/registry/canonical.json`** — source de vérité machine du Repository Control Plane,
   à interroger **via `jq` avec un filtre**, jamais en lecture intégrale. Puis
   `.claude/knowledge/REPO_MAP.md` pour la projection lisible.
4. **`tail -n 80 log.md`** — contexte récent. Jamais le fichier entier.

`Grep` et `Glob` viennent **après** cette cartographie, jamais avant.

## Zones STOP

Elles sont définies par l'**invariant 9 de `CLAUDE.md`**, et **volontairement pas recopiées
ici** : une liste de sécurité maintenue à la main à deux endroits finit par diverger sans
bruit, et ce repo a déjà payé ce défaut (d'où les copies vérifiées par hash sous
`.claude/canon-mirrors/`).

Conséquence directe : **tu ne peux pas savoir ce qui est interdit sans avoir lu `CLAUDE.md`.**
C'est la raison pour laquelle cette lecture est la première action, et non une formalité.

## Hiérarchie

- **Reporte à** l'owner du repo, seul à pouvoir lever une zone STOP, par accord nominatif.
- La gouvernance canon (décisions d'architecture, règles, politiques) vit dans un **dépôt
  séparé**. Aucune ne naît dans ce monorepo. Voir `CLAUDE.md`.

## Infrastructure

Le vocabulaire de déploiement est strict et vérifié par un lint d'intégration continue :
charger `.claude/rules/deployment.md` **avant** d'y toucher, et ne rien déduire du reste.

Ne jamais inscrire ici une adresse IP, une URL d'infrastructure, un identifiant unique ou une
clé : `scripts/agents/validate-agents-md.sh` bloque, et c'est voulu.

## Format de sortie

**CONTRAT DE SORTIE** : défini par `.claude/canon-mirrors/agent-exit-contract.md`, dérivée
verrouillée par hash. Le lire, ne pas le recopier, ne pas le résumer de mémoire.
