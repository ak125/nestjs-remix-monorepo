## Objet

Correctifs 01, 02, 04 et 05 du mandat BB (décisions 107, 113, 114). Rapport et mesures :
`docs/audit/mandat-bb-20261116/README.md`. Aucun contrôle requis n'est retiré, renommé ni filtré.

| Correctif | Effet | Mesure avant |
|---|---|---|
| 01 | les jobs hébergés qui n'installent rien ne sauvegardent plus de cache npm vide | entrée de 882 octets restaurée à chaque installation ; installation 93 s en médiane |
| 02 | les jobs du runner self-hosted (deploy PREPROD, E2E, Lighthouse, smoke tests) ne retéléchargent plus 3,9 Go de cache npm | étape `setup-node` 185 à 189 s par job ; `npm ci` 26 à 28 s |
| 04 | annulation des runs dépassés sur 8 workflows non requis | 9 min-job par jour |
| 05 | la porte des fichiers nouveaux écrit les fichiers refusés dans son journal ; verdict et code de sortie inchangés | fichier refusé absent du journal |

## Preuve attendue

- Les 14 contrôles requis passent sur cette PR.
- Correctif 02 : il ne s'observe qu'après fusion, sur le run `ci.yml` de `main` (étape `setup-node`
  des jobs deploy, E2E et Lighthouse : de ≈ 185 s à quelques secondes).
- Correctif 01 : il prend effet après la suppression des deux caches npm de `main`
  (`commandes-owner.md`, même bloc relancé après la fusion).

## Retour arrière

`git revert` du commit de fusion. Aucun état runtime, aucune migration.

## Definition of Done

- [x] DoD1 — Tests verts: à lire sur les contrôles de cette PR ; avant publication : `git apply --check` vert, YAML valide, 9 tests de câblage identiques avant et après (215 réussis sur 216, même échec sans rapport)
- [ ] DoD2 — Ownership: assignee posé ; PR écrite par l'owner, qui ne peut pas s'approuver lui-même (item en avis dans le gate)
- [x] DoD3 — Rollback: revert de la PR, reversibility=instant (aucun état runtime, aucune migration)
- [x] DoD4 — Observabilité: durées des étapes `setup-node` et `npm ci` lisibles dans les runs ; journal de la porte des fichiers nouveaux
- [x] DoD5 — Drift zéro: aucune projection générée éditée ; seuls des fichiers `.github/workflows/` changent
- [x] DoD6 — Docs: `docs/audit/mandat-bb-20261116/README.md` et `commandes-owner.md`
- [x] DoD7 — Monitoring: N/A, aucun runtime applicatif ; watcher=@ak125
- [x] DoD8 — No TODO unresolved: 0 TODO ; la suppression des deux caches est nommée dans `commandes-owner.md`
- [x] DoD9 — No silent skip: confirmed ; aucun job sauté ni filtré, aucun contrôle requis touché par le correctif 04

🤖 Generated with [Claude Code](https://claude.com/claude-code)
