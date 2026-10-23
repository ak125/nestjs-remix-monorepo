# Protocole figé — lot Rust `GET /api/vehicles/brands/:brandId/models`

Figé le 2026-10-21, avant toute mesure de charge. Toute modification ultérieure est signalée
dans le rapport comme écart au protocole.

## Données
- Passe 1 : enregistrement des réponses PostgREST réelles via le proxy `examples/replay record`,
  requêtes émises par le chemin legacy (harnais Node, flag éteint). Lecture seule (GET).
- Toutes les mesures de charge rejouent ce même fichier (`examples/replay replay`), corps en clair,
  latence amont imposée L0 = 0 ms et L20 = 20 ms par réponse (approximation de l'aller-retour Supabase).
- Aucune charge contre la base réelle (base partagée DEV = PREPROD = PROD).

## Chemins de charge (18, chemin non caché du VehicleSelector)
`/api/vehicles/brands/{b}/models?year={y}&page=0&limit=100`, b ∈ {164, 108, 173, 140, 128, 441},
y ∈ {1995, 2008, 2018}. Pour C, mêmes cas sur `/v1/brands/{b}/models?year={y}&page=0&limit=100`.

## Configurations
- A : harnais Node (`bench/harness.cjs`, `backend/dist`, NODE_ENV=production,
  NODE_OPTIONS=--max-old-space-size=4096), flag éteint (legacy).
- B : même harnais, flag allumé + `vehicle-models-rs --release` (coexistence réelle visée).
- C : `vehicle-models-rs` seul, appelé directement (information, pas une cible de déploiement).

## Ressources (identiques)
- Cibles : `taskset -c 0,1` (2 CPU comme le conteneur PROD) dans un scope systemd
  MemoryMax=2G MemorySwapMax=0 (limite du conteneur PROD). En B, Node et Rust partagent ces 2 CPU
  et ces 2 Go. Rust : VEHICLE_MODELS_RS_WORKER_THREADS=2.
- Rejeu : CPU 4-5. Générateur : CPU 6-7 (`examples/loadgen`, HTTP/1.1, connexions réutilisées).
- Cache Node : le chemin avec `year` contourne le cache (skipCache) dans A comme dans B ; pas de
  cache côté Rust. Processus neufs à chaque répétition.

## Charge
- Concurrence 16, chauffe 10 s, mesure 60 s. 3 répétitions par configuration et par latence,
  ordre alterné A B C A B C A B C.
- Dérive : 1 passe de 300 s (après chauffe 10 s) pour A et B à L20, concurrence 16.

## Mesures
- loadgen : requêtes, erreurs (tout non-200), débit, p50/p95/p99/max.
- /proc de chaque processus cible : CPU = Δ(utime+stime) sur la fenêtre de mesure, rapporté en
  ms CPU par requête ; VmRSS échantillonné à 1 Hz pendant la mesure (médiane = « stable »,
  max = « crête ») ; VmHWM en fin de passe ; RSS au repos 5 s après le démarrage.
  B = somme Node + Rust, détail par processus.
- Dérive : pente de VmRSS (Mo/min) sur les 240 dernières secondes, médiane 1re minute vs dernière.
- Build : temps réel et `memory.peak` du cgroup, construction propre (déjà mesuré : voir rapport).

## Porte de parité (avant mesure)
- Réponses A et B octet pour octet identiques sur tous les cas enregistrés (hors champ
  `timestamp` des erreurs génériques), 0 clé absente, 0 en-tête différent côté rejeu.
- Échec de parité = pas de mesure de charge, verdict « garder l'existant / corriger le lot ».

## Règle de décision (déclarée avant les résultats)
- Continuer : parité totale ET, aux deux latences, CPU par requête de B (Node + Rust) inférieur
  à celui de A au-delà de l'écart entre répétitions, p95 de B non supérieur à A au-delà de cet
  écart, 0 erreur.
- Améliorer le lot : parité totale mais gain CPU dans l'écart des répétitions, ou gain CPU payé
  par une hausse du RSS total ou du p95.
- Garder l'existant : parité incomplète, erreurs, ou CPU de B ≥ A.
- Aucun pourcentage hors médianes mesurées ; dispersion min–max publiée.
