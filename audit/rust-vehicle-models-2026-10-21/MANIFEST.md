# Preuves v1/v2 — lot Rust `GET /api/vehicles/brands/:brandId/models`

Dépôt durable des résultats bruts des campagnes du 2026-10-21, copiés depuis le
répertoire temporaire de session. Les originaux n'ont pas été modifiés.

## Références exactes

| Version | Commit | Branche |
|---|---|---|
| v1 (lot 1, flag `VEHICLE_MODELS_RS_ENABLED`) | `b879210e8b9ac935249befc30bb693d46aa8ba15` | `feat/rust-vehicle-models-lot1` |
| v2 (analyse en flux, 1 fil de travail) | `9fab8140f45676d3f3921691873a02a596a00c98` | `feat/rust-vehicle-models-lot1` |
| Suite (route complète) | descendant de v2 | `feat/rust-vehicle-models-route-r2` |

Base `main` des deux versions : `4a2ddd1a5`. Les versions initiales restent
récupérables par leur SHA ; aucune réécriture d'historique.

Rapport : [`audit/rust-vehicle-models-lot1-2026-10-21.md`](../rust-vehicle-models-lot1-2026-10-21.md).
Protocoles figés : [`PROTOCOL.md`](../../services/vehicle-models-rs/bench/PROTOCOL.md) (v1)
et [`PROTOCOL-v2.md`](../../services/vehicle-models-rs/bench/PROTOCOL-v2.md) (addendum v2).
Banc : `services/vehicle-models-rs/bench/{bench.sh,tools.py,harness.cjs,paths-*.txt}`.

## Contenu de ce répertoire (versionné)

| Chemin | Contenu |
|---|---|
| `campaign-v1/results.jsonl` | 20 lignes : A/B/C × L0/L20 × 3 répétitions, plus 2 passes de dérive de 300 s (A et B à L20) |
| `campaign-v1/runs/<config>-<latence>-<rep>/` | mesures brutes par passe (charge, échantillons processus, cgroup) |
| `campaign-v1/campaign.log`, `parity.ok`, `paths-parity.txt` | journal, porte de parité franchie, chemins de parité |
| `campaign-v2/…` | même structure pour v2, plus `faults/` (essais de pannes) et `loadavg-start.txt` |
| `diag-v2/` | 4 passes instrumentées hors comparaison (changements de contexte, `nstat`, instantanés `/proc`) |
| `scripts-hors-banc/` | scripts de la passe de diagnostic (`diag-run*.sh`, `diag-snap.py`, `diag-an.py`) |
| `SHA256SUMS.txt` | empreintes des fichiers versionnés ci-dessus |
| `hors-depot-SHA256SUMS.txt` | empreintes des fichiers gardés hors dépôt (voir ci-dessous) |

## Gardé hors dépôt

Les corps de réponse dérivés de la base (enregistrement rejoué, corps de parité,
corps des essais de pannes, journaux Node/Rust) ne sont pas versionnés : le dépôt
est public. Ils sont conservés dans un répertoire local en mode 700,
`/home/deploy/rust-vehicle-models-20261021-evidence/scratchpad-bench/`, avec un
fichier `SHA256SUMS` dont l'empreinte est
`d081f0d6d6bafac51b8c593a33689323ae5a7b9b13f1081a60596e3c60b29795`.

- `recorded.jsonl` (enregistrement servi par le rejoueur, commun à v1 et v2) :
  `cebcc7a1ad2f9c11474fc510000979c66ca0a5467fa06bbf90d61ac624d2d5b3`.
- `recorded-v1.jsonl` : `3b9f8eff1fef27af69c757bfaf5ad814da7dd41885b8dae976c7ad2f740c85b5`.

## Absents

- Les copies de `recorded.jsonl` et `record-A/` faites dans le répertoire de la
  passe `diag-v2` ont été supprimées avant la copie durable. C'étaient des copies
  de l'enregistrement commun ; elles ne sont pas reconstruites.

## Paramètres des campagnes v1/v2

- Données : enregistrement séquentiel en lecture seule (GET uniquement) des réponses
  PostgREST, rejoué localement avec une latence amont imposée L0 = 0 ms ou L20 = 20 ms
  (simulée, pas un aller-retour réseau réel).
- Configurations : A = Node seul ; B = Node qui appelle le service Rust ;
  C = service Rust seul (port interne, hors parcours applicatif).
- Ressources : cibles sous `taskset -c 0,1` dans un scope systemd
  `MemoryMax=2G MemorySwapMax=0` ; rejoueur sur les CPU 4-5, générateur de charge sur 6-7.
- Charge : boucle fermée, concurrence 16, chauffe 10 s, mesure 60 s, 3 répétitions
  par configuration et par latence ; dérive : 1 passe de 300 s pour A et B à L20.
- Mesures : CPU = utime+stime des processus nommés (sans les enfants),
  divisé par le nombre de requêtes terminées ; mémoire = somme des VmRSS à 1 Hz
  (une somme de RSS surcompte les pages partagées).
- Limite de méthode : en boucle fermée, chaque configuration reçoit un débit
  différent ; les CPU par requête sont comparables, les mémoires à débit égal ne le sont pas.
