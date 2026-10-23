# Preuves R2 — route Rust `GET /api/vehicles/brands/:brandId/models` derrière Caddy

Dépôt durable des résultats sans corps de la campagne v3 et des essais du contrat du 2026-10-22,
copiés depuis le répertoire local des preuves. Les originaux n'ont pas été modifiés.

## Références exactes

| Élément | Valeur |
|---|---|
| Branche | `feat/rust-vehicle-models-route-r2` (locale, non poussée), base `main` `4a2ddd1a5` |
| Protocole figé avant mesure | `PROTOCOL-v3.md`, commit `570a1d52b` |
| Lancement de la campagne (12 passes courtes et 2 suivis longs) | commit `0f3aa5c2a515b6945f988902dd6914f1a128e685` (`campaign-v3/versions.txt`) |
| Binaire mesuré | `target/release/vehicle-models-route`, sha256 `2aeea4d5ee2de164c20dbb0352a6493844c7a4eabf6421bdcebb8fab6aa31e8f`, construit sur `25571b854` |
| Run 5 du contrat (même binaire) | commit `1a810f27a815a1b9f1bf9ae1b0050acda135e79d` |

Rapport : [`audit/rust-vehicle-models-route-r2-2026-10-22.md`](../rust-vehicle-models-route-r2-2026-10-22.md).
Contrat : [`services/vehicle-models-rs/docs/route-contract.md`](../../services/vehicle-models-rs/docs/route-contract.md).
Protocole : [`PROTOCOL-v3.md`](../../services/vehicle-models-rs/bench/PROTOCOL-v3.md).
Banc : `services/vehicle-models-rs/bench/{route.sh,tools.py,contract.py,journey.mjs,Caddyfile.route}`.

## Contenu de ce répertoire (versionné)

| Chemin | Contenu |
|---|---|
| `campaign-v3/results.jsonl` | 13 lignes : 12 passes courtes (a2/r2 × L0/L20 × 3) et r2-L20-long. a2-L20-long n'a pas de ligne : la passe s'est arrêtée sur l'OOM du cgroup avant d'écrire son résultat |
| `campaign-v3/summary-v3.txt` | sortie de `route.sh summary` (tableau et décision du code gelé) |
| `campaign-v3/versions.txt`, `versions-r2-L20-long.txt`, `versions-r2-L20-long-post.txt` | versions relevées au lancement de la campagne, au lancement de r2-L20-long et après celui-ci (rapport, § 7) |
| `campaign-v3/runs/<config>-<latence>-<rep>/` | par passe : `idle.json`, `load.json`, `replay.json`, `run.json`, `destination.json`, `result.json`, `progress.json`, `selection.txt`, `procs.txt` ; `progress.json.stop` pour les deux suivis longs |
| `analysis/latency-by-minute-{a2,r2}-L20-long.json` | latence et statuts par minute des deux suivis longs, lus dans les journaux de requêtes de Caddy (observation, hors décision) |
| `contract/contract-summary.json` | résumé sans corps des rapports du contrat, runs 2 à 5 (identifiants de cas, statuts, compteurs, verdicts) |
| `scripts-hors-banc/` | `run5.sh` (rejeu du run 5), `series.sh` (9 parcours navigateur par sélection), `latency_by_minute.py`, `contract_summary.py` |
| `SHA256SUMS.txt` | empreintes des fichiers versionnés ci-dessus |
| `hors-depot-SHA256SUMS.txt` | empreintes des fichiers gardés hors dépôt (voir ci-dessous) |

Les scripts hors banc sont des copies de ceux qui ont tourné ; ils gardent leurs chemins absolus de
session. `series.sh`, `latency_by_minute.py` et `contract_summary.py` sont identiques aux originaux. Dans
`run5.sh`, seule la ligne 8 diffère : l'identifiant de la session de travail, dans le chemin de `S`, est
remplacé par `<session>`. L'original est gardé hors dépôt dans `scripts-originaux/run5.sh` (sha256
`8740c9cae477cbd83a81383d4682819f6e3de08e44fa93666ce5a44260f28ac9`), avec les trois autres scripts.

## Gardé hors dépôt

Le dépôt est public. Ne sont pas versionnés :

- les enregistrements rejoués et les corps de réponse dérivés de la base (`recorded.jsonl`,
  `recorded-new.jsonl`, `fixtures-users.jsonl`, corps capturés par le contrat, rapports `diff-*.json`
  qui recopient des corps) ;
- les journaux de Node, de R2, de Caddy, de Redis et du rejeu, dont les journaux de requêtes de Caddy
  qui servent à `destination.json` et à `analysis/` ;
- `oom-journal.txt` (extrait du journal du scope d'a2-L20-long) et `redis-end.txt` ;
- `prepare.log` et `scope.log` de chaque passe, exclus par la règle `*.log` du `.gitignore` : les 14
  `prepare.log` contiennent la même ligne (« contract: Redis du banc vidé, configuration BotGuard du
  contrat posée », sha256 `a7f78cae94330c2de2e5e7d684c495c420cdf638eb3aa2faaf0680cc069ef864`), les 14
  `scope.log` sont vides ;
- les fichiers de secrets du banc, ni copiés ni empreintés.

Ils sont conservés dans le répertoire local `/home/deploy/rust-vehicle-models-20261021-evidence/r2/`
(mode 700). Le fichier `hors-depot-SHA256SUMS.txt` donne l'empreinte de chacun des 979 fichiers de ce
répertoire, chemin relatif à celui-ci. Il est la copie, préfixe `./` retiré, du fichier local
`SHA256SUMS` de ce répertoire (sha256
`541af27572555cc295f12ac94ee6f44c71136169b1520065dd4670b88c194a9d`). Exclus de ces empreintes : les
fichiers `secrets.env` et `bench-v3/caddy/data/` (clés et certificats de l'autorité interne de Caddy du
banc).

- `record-v3/recorded.jsonl` : `63e6e6b77ca67da0c93568c61861c74dacfe23e3b321269207bdbcf0bf479636`.
- `contract-v1/fixtures-users.jsonl` : `da45f6037b2fb4dd25770ef9126e6fb403f92a5e5149791ccaeea851c080498a`.
- `record-v4/recorded-new.jsonl` : `319c235142f6031e97aa548572155516406b3ef1ceb6652f7e25e356e72f8b01`.

## Absents

- `campaign-v3/runs/a2-L20-long/run.json` n'existe pas, et `result.json` y est vide (0 octet). Node a
  été tué par l'OOM du cgroup des cibles ; l'échantillonneur de `tools.py` a alors levé une `KeyError`
  (`VmHWM` lu hors de sa garde, corrigé après le gel par `1a810f27a`) et n'a pas écrit `run.json` : la
  série RSS de cette passe est perdue (rapport, § 7). Les valeurs du rapport pour cette passe viennent de
  `load.json`, `replay.json`, `destination.json`, `progress.json` et du journal du scope (hors dépôt).
  Elles ne sont pas reconstruites.
- `contract-20261022/run3/binary.sha256` n'existe pas : l'empreinte du binaire des essais du run 3 n'a
  pas été relevée. Ces essais ont été rejoués sur le binaire mesuré (runs 4 et 5).
- Lot 1 : `campaign-v1/campaign.log` et `campaign-v2/campaign.log` figurent dans
  `../rust-vehicle-models-2026-10-21/SHA256SUMS.txt`, mais la règle `*.log` du `.gitignore` les a exclus
  du commit. Ils restent sur le disque du checkout local ; ce lot ne les force pas dans Git.
