# Correctifs préparés, non appliqués (mandat AM, 2026-11-16)

Ces correctifs ne sont **pas appliqués** dans cette PR. Les fichiers `.github/**` sont réservés à
l'owner (garde de fichiers de l'agent, ADR-130 D3.4). Cette PR ne contient donc que les correctifs
et l'inventaire. **Leur application revient à Marwane.**

## Objet

- `morning-health-digest` met à jour **une seule issue**, au titre fixe
  « Rapport du matin — santé de la plateforme (morning-health-digest) », au lieu d'en créer une par
  jour ouvré : 132 issues ouvertes au relevé du 2026-11-15 23:48 UTC. L'issue est retrouvée par ce
  titre parmi celles de `github-actions`, puis créée si elle manque. Son corps est remplacé à chaque
  passage. Un commentaire court n'est posté que si un signal change de couleur.
- `weekly-pr-hygiene` suit le même principe, avec le titre
  « Hygiène hebdomadaire des PR — rapport unique (weekly-pr-hygiene) » (26 issues ouvertes au relevé).
- Le rapport du matin lit six signaux. Chacun porte sa source, son heure de lecture et sa qualité
  (qualifié, cohérent en interne, à requalifier, non qualifié). Une source illisible est écrite
  « indisponible », jamais 0.
  1. Tunnel de paiement, avec les mêmes règles et seuils que `check-payment-tunnel.sh`.
  2. Commandes non payées depuis plus de 24 h (créées entre J-30 et J-1).
  3. 5xx PROD par chemin, appels internes `node` séparés.
  4. Tendance hebdomadaire des clics Google.
  5. Dernier test de fumée.
  6. Issues au label `attend-marwane`.
- L'état des couleurs est conservé dans le corps de l'issue, dans le marqueur
  `<!-- report-state:v1 {…} -->`. Aucun stockage nouveau.
- Le corps de l'issue ne publie que des agrégats : le dépôt est public. Aucun identifiant de
  commande ni aucune donnée client n'y figure.

## Fichiers

| Correctif | Fichiers touchés | Effet de la fusion |
|---|---|---|
| `01-check-payment-tunnel-check-only.patch` | `scripts/monitoring/check-payment-tunnel.sh` | Ajoute `CHECK_ONLY=1` : le script applique ses règles, imprime `CHECK_ONLY_RESULT …` et sort sans alerter ni écrire son fichier d'état. Sans cette variable, rien ne change. **Sa fusion déclenche `deploy-monitoring-scripts.yml`, qui installe le script sur l'hôte PROD.** |
| `02-rapports-issue-unique-scripts.patch` | `.github/scripts/report-issue-publish.sh` (nouveau), `.github/scripts/morning-health-digest.sh`, `.github/scripts/weekly-pr-hygiene.sh` | Aucun effet tant que les workflows n'appellent pas `--publish`. Sans cet argument, les deux scripts gardent leur sortie actuelle (`title`, `body_path`). |
| `03-rapports-issue-unique-workflows.patch` | `.github/workflows/morning-health-digest.yml`, `.github/workflows/weekly-pr-hygiene.yml` | Les workflows appellent `--publish`. L'étape « create issue » disparaît. Le rapport du matin reçoit `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`, deux secrets existants déjà utilisés par `diag-canon-slugs-export.yml`. |

## Application, dans cet ordre

À faire depuis une branche issue de `main` :

```bash
git apply --check docs/plans/2026-11-16-mandat-am-patches/01-check-payment-tunnel-check-only.patch
git apply         docs/plans/2026-11-16-mandat-am-patches/01-check-payment-tunnel-check-only.patch
git apply docs/plans/2026-11-16-mandat-am-patches/02-rapports-issue-unique-scripts.patch
git apply docs/plans/2026-11-16-mandat-am-patches/03-rapports-issue-unique-workflows.patch
chmod +x .github/scripts/report-issue-publish.sh

# contrôles statiques
shellcheck -x .github/scripts/report-issue-publish.sh .github/scripts/morning-health-digest.sh \
  .github/scripts/weekly-pr-hygiene.sh scripts/monitoring/check-payment-tunnel.sh
actionlint .github/workflows/morning-health-digest.yml .github/workflows/weekly-pr-hygiene.yml
```

On peut appliquer les correctifs 02 et 03 seuls, dans une PR qui ne touche pas l'hôte PROD. Dans ce
cas, le signal « Tunnel de paiement » s'affiche « indisponible » avec le motif « mode CHECK_ONLY
absent du script (patch non appliqué) », jusqu'à ce que le correctif 01 soit fusionné. Le rapport ne
lit jamais le tunnel par un autre chemin.

Premier passage à blanc, sans écriture dans GitHub, depuis la branche appliquée :

```bash
REPO=ak125/nestjs-remix-monorepo SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
  bash .github/scripts/morning-health-digest.sh        # sans --publish : imprime title= et body_path=
```

## Hors de ces correctifs

- La fermeture des 132 et 26 issues datées revient au mandat U (PR #2076). Ces correctifs n'en ferment
  aucune.
- Le label `attend-marwane` n'est pas créé par ces correctifs. S'il n'existe pas, le signal le dit.
- `closure-t48h-slo-digest.yml` pourra reprendre `report-issue-publish.sh` plus tard ; il n'est pas
  modifié ici.

## Preuves (scratchpad de la session `662e39b2-69ff-455f-a5c8-016d1efb0199`)

- Les correctifs, rejoués sur des copies de la base `9908188b38`, reproduisent octet pour octet les
  six fichiers testés (`cmp`), et passent `git apply --check`.
- shellcheck 0.10.0 sur les quatre scripts : rc 0. Les scripts d'origine ne passent pas (rc 1).
- actionlint 1.7.12 sur les deux workflows : rc 0.
- Scénarios de test, avec un PostgREST factice et un `gh` factice :
  - tunnel vert, BURST et LOW_RATE (avec comparaison à `CHECK_ONLY`) ;
  - source indisponible, écrite « indisponible » et non 0 ;
  - issue absente, alors créée ;
  - issue existante, avec son corps remplacé ;
  - changement de couleur, avec un commentaire ;
  - couleur inchangée, sans commentaire ;
  - homonyme d'un autre auteur, ignoré ;
  - hygiène hebdomadaire, en mode actuel et en mode `--publish`.
