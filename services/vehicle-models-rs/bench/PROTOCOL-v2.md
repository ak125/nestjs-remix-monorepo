# Addendum v2 — « améliorer le lot » (déclaré après les résultats v1)

Rédigé le 2026-10-21 pendant la campagne v1, après lecture de ses premières passes et des profils
(analyse `serde_json::Value` des lots `auto_type` ≈ 1,9 ms CPU/req ; runtime 2 workers plus coûteux
que 1). Figé avant toute mesure v2. La v2 est une amélioration décidée en voyant les résultats : elle
est rapportée à part, sans fusion avec les données v1.

## Changements mesurés (crate seule, côté Node inchangé)
1. Lots `auto_type` analysés en flux : regroupement, filtre d'année et carburants calculés pendant
   l'analyse (visiteurs serde), sans arbre `Value` des lignes. Sortie attendue identique à v1.
2. `VEHICLE_MODELS_RS_WORKER_THREADS` : défaut 1 (au lieu du défaut tokio = nombre de CPU) ; le banc
   v2 lance Rust avec 1 (variable `BENCH_RS_WORKER_THREADS`, défaut 1 ; v1 = 2).

## Inchangé par rapport au protocole v1
Données (copie de `campaign-v1/recorded.jsonl` et `record-A`), 18 chemins de charge, configurations
A/B/C, ressources (cibles `taskset -c 0,1`, scope MemoryMax=2G MemorySwapMax=0, rejeu CPU 4-5,
générateur CPU 6-7), concurrence 16, chauffe 10 s, mesure 60 s, 3 répétitions alternées A B C à L0
puis L20, dérive 300 s A et B à L20, mesures et règle de décision. A est remesuré dans la campagne v2
(mêmes binaires Node que v1) : la comparaison v2 se fait entre passes de la même campagne.

## Portes avant mesure v2
- `cargo fmt --check`, `cargo clippy --locked --all-targets -- -D warnings`, `cargo test --locked`
  (dont le test différentiel analyse en flux / oracle v1 sur `Value`, 5000 lots pseudo-aléatoires).
- `bench.sh parity` : A et B octet pour octet identiques sur tous les cas, 0 clé absente, 0 en-tête
  différent, et A rejeu identique à A enregistrement.
- `bench.sh faults` : mêmes empreintes de corps et statuts que v1 pour chaque panne.
- Échec d'une porte = pas de campagne v2.

## Règle de décision
Celle du protocole v1, appliquée aux seules passes v2 ; le verdict v1 reste celui des passes v1.
