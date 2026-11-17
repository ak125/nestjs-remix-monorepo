## Objet

Correctif 02b du mandat BB : `package-manager-cache: false` sur l'étape `setup-node` de
`release-prod.yml`. Rapport : `docs/audit/mandat-bb-20261116/README.md`.

`release-prod.yml` relève de la chaîne PROD : cette PR n'existe que sur accord nominatif de l'owner.

## Effet

Le job tourne sur le runner self-hosted de l'hôte PROD. Son étape `setup-node` retélécharge 3,9 Go
de cache npm : entre 185 s et 198 s sur les runs du 13 au 16 novembre. Le workflow n'installe
aucune dépendance (aucun `npm ci`) : ce cache ne lui sert à rien. Le correctif retire ce
téléchargement ; il ne change ni les étapes, ni les conditions, ni l'ordre du workflow.

## Preuve attendue

Elle ne s'observe qu'au prochain run `release-prod.yml`, donc au prochain tag `v*` décidé par
l'owner : durée de l'étape `setup-node`. Aucun run de release n'est à lancer pour cette PR.

## Retour arrière

`git revert` du commit de fusion.

## Definition of Done

- [x] DoD1 — Tests verts: à lire sur les contrôles de cette PR ; `git apply --check` vert, YAML valide
- [ ] DoD2 — Ownership: assignee posé ; PR écrite par l'owner, qui ne peut pas s'approuver lui-même (item en avis dans le gate)
- [x] DoD3 — Rollback: revert de la PR, reversibility=instant
- [x] DoD4 — Observabilité: durée de l'étape `setup-node` lisible dans chaque run de release
- [x] DoD5 — Drift zéro: une ligne de `.github/workflows/release-prod.yml` ; aucune projection générée éditée
- [x] DoD6 — Docs: `docs/audit/mandat-bb-20261116/README.md`
- [x] DoD7 — Monitoring: N/A, aucun runtime applicatif ; watcher=@ak125
- [x] DoD8 — No TODO unresolved: 0 TODO
- [x] DoD9 — No silent skip: confirmed ; aucune étape retirée ni conditionnée

🤖 Generated with [Claude Code](https://claude.com/claude-code)
