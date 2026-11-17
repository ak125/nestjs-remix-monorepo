## Objet

Correctif 03 du mandat BB : `--maxWorkers=1` devient `--maxWorkers=2` dans `🧪 Backend Tests`, le
job le plus long des contrôles d'une PR. Rapport : `docs/audit/mandat-bb-20261116/README.md`.

Jest tourne sur un seul worker depuis le commit `99b0f2cedf` (2026-02-26). Les runners hébergés d'un
dépôt public ont aujourd'hui 4 cœurs et 16 Go ; deux workers à 4 Go de tas en demandent 8.

## Mesure

Cette PR exécute son propre `ci.yml` : le run de cette PR est la mesure.

| | Avant (60 runs de PR, 15 et 16 novembre) | Cette PR |
|---|---|---|
| Job `🧪 Backend Tests` | 5,3 min en médiane, p90 6,4 | à lire sur le run |
| Étape des tests | 144 s en médiane (419 suites, 7701 tests) | à lire sur le run |

À fusionner seulement si le job est vert et plus court. Sinon, fermer la PR : rien d'autre n'en dépend.

## Risques

- Mémoire : 2 × 4 Go de tas sur 16 Go.
- Tests sensibles à l'ordre ou à un état partagé : un échec nouveau sur cette PR en serait le signe.

## Retour arrière

`git revert` du commit de fusion.

## Definition of Done

- [x] DoD1 — Tests verts: à lire sur le job `🧪 Backend Tests` de cette PR, qui exécute le workflow corrigé
- [ ] DoD2 — Ownership: assignee posé ; PR écrite par l'owner, qui ne peut pas s'approuver lui-même (item en avis dans le gate)
- [x] DoD3 — Rollback: revert de la PR, reversibility=instant
- [x] DoD4 — Observabilité: durée du job et de l'étape des tests lisibles dans chaque run
- [x] DoD5 — Drift zéro: une ligne de `.github/workflows/ci.yml` ; aucune projection générée éditée
- [x] DoD6 — Docs: `docs/audit/mandat-bb-20261116/README.md`
- [x] DoD7 — Monitoring: N/A, aucun runtime applicatif ; watcher=@ak125
- [x] DoD8 — No TODO unresolved: 0 TODO
- [x] DoD9 — No silent skip: confirmed ; mêmes suites, même commande, seul le nombre de workers change

🤖 Generated with [Claude Code](https://claude.com/claude-code)
