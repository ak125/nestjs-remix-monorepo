# Lot Rust n°1 — modèles par marque délégués à `vehicle-models-rs` (DEV)

Date : 2026-10-21. Branche `feat/rust-vehicle-models-lot1`, base `4a2ddd1a5`. Commits : v1 `b879210e8`
(version mesurée en premier), v2 « améliorer le lot » (commit suivant sur la branche). Périmètre : DEV
local seulement. Rien n'est poussé, déployé ni activé : le flag est éteint par défaut.

Rust n'est pas présenté comme la correction des saturations mémoire ou des arrêts serveur passés : leur
cause n'est pas établie, et ce lot ne mesure qu'une route.

## 1. Choix du lot

| | |
|---|---|
| Candidat instruit | sélecteur véhicule (marques → modèles → motorisations), endpoints publics en lecture seule |
| Lot retenu | `GET /api/vehicles/brands/:brandId/models` avec `year` |
| Appelant réel | `VehicleSelector.handleYearChange` → `getModels(marque_id, { year, page: 0, limit: 100 })` (`HeroSection`, `GammeHero`, `constructeurs.$brand[.]html`) |
| Pourquoi | avec `year`, Node contourne son cache : chaque appel refait 3 requêtes PostgREST ou plus, environ 308 Ko de corps amont en moyenne sur le jeu de banc, puis regroupe et filtre en JavaScript |
| Risque | lecture seule, publique : pas de session, de rôle, de RLS, de transaction, d'écriture ni de file (Bull/BullMQ non concernés) ; ni paiement, ni SEO, ni URL |
| Hypothèse annoncée | moins de CPU et de churn de tas Node sur ce chemin, au prix d'un processus Rust de plus ; aucun gain de RAM totale supposé |

## 2. Contrat et branchement

- **Délégué** : seul le calcul non caché (`executeQuery` de `VehicleModelsService.getModelsByBrand`).
  Contrôleur, pipes zod, `PositiveIntParamPipe`, cache, journaux et `GlobalErrorFilter` restent ceux de Node.
- **Sélecteur** : `VEHICLE_MODELS_RS_ENABLED` (getter `FeatureFlagsService.vehicleModelsRsEnabled`,
  défaut `false`, environnement seulement, hors `ALLOWED_KEYS`) et `VEHICLE_MODELS_RS_URL`. Appel `fetch`
  depuis `vehicle-models.service.ts`, délai 35 s. Retour arrière : `false` puis redémarrage du backend.
- **Pas de repli silencieux** : URL absente, service injoignable ou statut inattendu → valeur levée
  `VEHICLE_MODELS_RS_UNAVAILABLE` (warn journalisé) → 500 générique, comme une erreur PostgREST.
- **Service** : Axum 0.8 / Tokio, un binaire, boucle locale seulement. `GET /v1/brands/{brandId}/models`
  avec `page`, `limit`, `year`, `search` et `includeAll`, validés comme les pipes zod.
- **Pourquoi HTTP local** : c'est déjà la convention de `services/remotion-renderer` (URL de base en
  variable d'environnement, `fetch` depuis NestJS). Aucun module natif n'est chargé dans Node : un
  incident Rust reste dans son processus, et le retour arrière se fait par variable d'environnement.

| Réponse du service | Cas | Effet côté Node |
|---|---|---|
| 200 | objet legacy `{ success, data, total, page, limit }` | renvoyé tel quel |
| 400 `invalid_request` | entrée hors contrat (inatteignable après zod) | 500 générique |
| 502 `upstream` + `thrown` | erreur PostgREST, relayée telle quelle | `throw thrown` → même 500 que legacy |
| 502 `contract` / `limit` + `thrown` | corps amont impossible ; plus de 200 000 types | 500 générique |
| 503 `overloaded` / 504 `deadline` | plus de 256 requêtes en cours ; échéance de 30 s dépassée | 500 générique |

- **Fidélité** : mêmes requêtes PostgREST, dans le même ordre et le même encodage que postgrest-js, et
  mêmes nouvelles tentatives (échec de `fetch`, 503). Même objet, ordre des clés compris.
- **Bornes** : 20 requêtes amont simultanées, 15 s par requête amont, corps ≤ 16 Mio, requête ≤ 4096
  octets, aucun cache côté Rust, arrêt propre sur SIGTERM.
- **Clé** : même résolution que `SupabaseBaseService` (service role ; anon si `READ_ONLY=true` ;
  `DEV_SUPABASE_KEY` sous `DEV_KILL_SWITCH` hors production). Jamais journalisée. Aucun identifiant
  fourni par le client n'est utilisé.
- **Écart voulu** : un corps 200 qui n'est pas un tableau (`objet200`, aucune donnée réelle ne le
  produit) donne un refus `contract`. Legacy lève une `TypeError` dont le message part dans `logError`.

## 3. Preuves de comportement

| Preuve | Conditions | Résultat |
|---|---|---|
| `cargo fmt --check`, `cargo clippy --locked --all-targets -- -D warnings` | v2 | OK |
| `cargo test --locked` | v2 : 22 tests unitaires, dont l'analyse en flux contre l'oracle v1 sur 5000 lots pseudo-aléatoires, et 8 tests de service contre un faux PostgREST | 30/30 |
| Mutation du test différentiel | condition `!fuel.is_empty()` retirée | test en échec, puis code restauré |
| Jest `vehicle-models.service.test.ts` | sélecteur, `fetch`, `thrown`, indisponibilité, cache devant la délégation | 9/9 |
| Parité rejouée A/B | 28 cas (18 de charge, 10 limites), même enregistrement | v1 et v2 : 28/28 identiques, 0 absent, 0 en-tête différent ; rejeu = enregistrement 28/28 |
| Base réelle, séquentiel | 13 GET : A, B, puis retour arrière A (v1) | A/B 13/13 et A/A 13/13 identiques |
| Pannes amont imposées | 6 pannes, A puis B, puis Rust arrêté | statuts, corps et `logError` identiques à v1 en v2 (13/13 empreintes) |

Les pannes donnent ceci en A et en B, sauf `objet200` :

| Panne | Statut | Durée | `logError` |
|---|---|---|---|
| 503 une fois | 200 | 1,05 s (nouvelle tentative) | +0 |
| 503 répété | 500 | 7,02 s | +0 |
| 400, 500 ou HTML 502 répétés | 500 | < 10 ms | +0 |
| `objet200` | 500 | < 10 ms | A +1 (`allModels.map is not a function`), B +0 |
| Rust arrêté, flag allumé | 500 | 3,5 ms, 0 appel amont | +0 |

## 4. Protocole de mesure

- **Gel** : protocole figé avant toute charge (copie : `services/vehicle-models-rs/bench/PROTOCOL.md`).
  L'addendum v2 (`PROTOCOL-v2.md`) a été écrit **après** lecture des premiers résultats v1 et des profils,
  mais avant toute mesure v2. C'est un écart déclaré : v2 est rapportée à part.
- **Données** : réponses PostgREST réelles enregistrées une fois en GET séquentiels, puis rejouées en
  HTTP clair, sans TLS, avec une latence amont imposée L0 = 0 ms ou L20 = 20 ms. Aucune charge contre la
  base réelle.
- **Charge** : 18 chemins du sélecteur (6 marques × 3 années), concurrence 16, chauffe 10 s, mesure 60 s,
  3 répétitions alternées A B C par latence, puis dérive de 300 s pour A et B à L20.
- **Configurations** : A = Node, flag éteint. B = Node, flag allumé, plus Rust. C = Rust appelé seul
  (information, pas une cible).
- **Ressources** : cibles sur `taskset -c 0,1`, dans un scope systemd `MemoryMax=2G`
  `MemorySwapMax=0` comme le conteneur de production. Node et Rust partagent ces 2 CPU en B. Rejeu sur
  les CPU 4-5, générateur sur les CPU 6-7. Processus neufs à chaque passe.
- **Node** : `NODE_ENV=production`, `--max-old-space-size=4096`. Rust : `--release`.
- **Mesures** : CPU = Δ(utime+stime) par requête. RSS échantillonné à 1 Hz : médiane = stable,
  max = crête, plus `VmHWM`. B = somme de Node et de Rust.
- **Limites** :
  - le harnais Node sert la vraie route avec `backend/dist`, sans `AppModule` (ni helmet, compression,
    sessions ou throttler, identiques pour A et B) ;
  - une seule machine de 8 CPU partagée avec d'autres processus DEV ;
  - L20 n'approche l'aller-retour Supabase qu'en latence, pas en TLS ni en gigue ;
  - 3 répétitions seulement ; 300 s ne suffit pas pour conclure à une fuite.

## 5. Résultats v1 (Rust 2 fils de travail)

Médianes, [min–max] sur 3 passes, 0 erreur partout.

| Lat. | Cfg | req/s | p95 ms | CPU ms/req | RSS stable Mo | RSS crête Mo | RSS repos Mo |
|---|---|---|---|---|---|---|---|
| L0 | A | 295 [282–312] | 71,3 [65,1–76,9] | 3,685 [3,474–4,141] | 592,6 [555,6–644,4] | 609,3 | 170,2 |
| L0 | B | 221 [214–232] | 118,6 [116,1–119,1] | 8,301 [7,942–8,529] | 414,3 [398,8–437,6] | 452,0 | 175,0 |
| L0 | C | 278 [232–304] | 115,3 [99,1–124,9] | 6,529 [6,056–7,657] | 67,4 | 73,6 | 5,3 |
| L20 | A | 132 [130–132] | 161,7 [159,9–165,6] | 4,565 [4,530–4,933] | 482,9 [470,2–492,1] | 483,7 | 170,8 |
| L20 | B | 129 [129–130] | 164,8 [164,0–165,6] | 7,752 [7,594–7,757] | 349,9 [349,6–361,8] | 409,4 | 175,3 |
| L20 | C | 126 | 175,6 | 7,816 [7,803–7,866] | 76,2 | 82,7 | 5,3 |

- **Répartition B** : Node 1,005 ms/req à L0 et 1,158 à L20 ; Rust 7,281 et 6,591. RSS stable de Node
  en B : 348,4 Mo à L0, 275,4 Mo à L20.
- **Dérive** (300 s à L20, 0 erreur) :
  - A : pente RSS +5,30 Mo/min (472,2 → 487,8 Mo, de la 1re à la dernière minute) ;
  - B côté Node : +12,94 Mo/min (258,4 → 403,4 Mo) ;
  - B côté Rust : +0,61 Mo/min (71,3 → 73,7 Mo) ;
  - p95 de 167,4 ms en A et de 167,5 ms en B.
- **Verdict v1 selon la règle figée : garder l'existant.** Le CPU par requête de B est supérieur à celui
  de A aux deux latences, et son p95 est plus élevé à L0. Le RSS total de B est plus bas que celui de A,
  mais il ne compense pas ce CPU selon la règle.
- **Profil v1** : construire l'arbre `serde_json::Value` des lots `auto_type` coûtait environ 1,9 ms CPU
  par requête. Avec 1 fil de travail au lieu de 2, Rust consommait environ 3,6 à 3,9 ms par requête (profil
  séparé, hors campagne).

## 6. Résultats v2 (analyse en flux, 1 fil de travail)

Changements limités à la crate :
- les lots `auto_type` sont analysés en flux (visiteurs serde), et regroupement, filtre d'année et
  carburants sont calculés pendant l'analyse, sans arbre `Value` ;
- `VEHICLE_MODELS_RS_WORKER_THREADS` vaut 1 par défaut.

La sortie reste identique (parité et pannes ci-dessus). A est remesuré dans la même campagne.

Médianes, [min–max] sur 3 passes, 0 erreur partout. Le CPU mesuré par le scope systemd (cgroup) diffère
de celui de `/proc` de moins de 0,002 ms/req.

| Lat. | Cfg | req/s | p95 ms | CPU ms/req | RSS stable Mo | RSS crête Mo | RSS repos Mo |
|---|---|---|---|---|---|---|---|
| L0 | A | 297 [277–304] | 71,2 [67,8–79,5] | 3,643 [3,569–4,165] | 573,0 [531,7–574,3] | 595,4 | 171,0 |
| L0 | B | 605 [589–607] | 37,4 [37,1–38,7] | 2,398 [2,397–2,445] | 439,3 [438,7–454,6] | 513,8 | 174,5 |
| L0 | C | 617 [607–617] | 36,9 [36,6–37,4] | 1,619 [1,619–1,646] | 17,1 | 17,5 | 5,3 |
| L20 | A | 130 [129–132] | 165,1 [161,6–167,2] | 4,891 [4,560–4,959] | 469,0 [464,3–485,0] | 473,2 | 169,9 |
| L20 | B | 137 [137–138] | 149,1 [148,9–149,2] | 5,820 [5,754–5,838] | 303,3 [294,7–313,3] | 370,0 | 179,6 |
| L20 | C | 142 [142–143] | 143,4 [143,3–143,9] | 3,750 [3,711–3,838] | 16,9 | 17,5 | 5,4 |

- **A d'une campagne à l'autre** : 3,685 puis 3,643 ms/req à L0, 4,565 puis 4,891 à L20. Les plages se
  recouvrent.
- **Répartition B** : Node 0,771 ms/req à L0 et 1,848 à L20 ; Rust 1,637 et 3,972. RSS stable en B :
  Node 422,4 Mo à L0 et 286,1 Mo à L20, Rust 16,6 et 17,0 Mo.
- **Dérive** (300 s à L20, 0 erreur) :
  - A : pente RSS +1,90 Mo/min (472,6 → 484,7 Mo, de la 1re à la dernière minute) ;
  - B côté Node : +12,60 Mo/min (263,1 → 406,7 Mo), comme en v1 ;
  - B côté Rust : +0,03 Mo/min (16,8 → 17,0 Mo) ;
  - p95 de 166,4 ms en A et de 148,4 ms en B.

**Diagnostic hors protocole** (après la campagne, données exclues du verdict) : C seul relancé 30 s à
chaque latence.
- Le surcoût de L20 se reproduit : 1,645 puis 3,830 ms/req, puis 1,619 et 3,767 au second essai.
- Il est presque entièrement en temps utilisateur, dans l'unique fil `tokio-rt-worker` :
  - utilisateur 1,461 → 3,420 ms/req ;
  - système 0,165 → 0,409 ms/req ;
  - changements de contexte volontaires : 0 → 2,19 par requête.
- Le service n'ouvre pas de connexions en boucle : 89 connexions TCP ouvertes sur toute la passe L0 et 59
  sur la passe L20, toute la machine comptée.
- La machine est une VM KVM (AMD EPYC Genoa) sans fréquence visible. `perf` et `ptrace` sont fermés sans
  droits root, donc l'analyse s'arrête là.
- Hypothèse non démontrée : le même travail coûte plus de temps CPU quand le fil s'endort entre deux
  événements (caches froids, reprise du vCPU) que quand il tourne à saturation. A passe aussi de 3,643 à
  4,891 ms/req. En B, ce surcoût touche deux processus : Node +1,08 ms/req et Rust +2,34.

## 7. Builds

Mesurés à part, hors campagne :

| Build | Temps réel | Mémoire |
|---|---|---|
| backend `npm run build` (`tsc --build && tsc-alias`) | 32,24 s | 4,135 Go, pic du scope systemd (`memory.peak`) |
| paquets requis par le backend (`turbo run build --filter='@fafa/backend^...'`) | 14,45 s | 1,06 Go, RSS max d'un seul processus |
| crate Rust `cargo build --release --locked`, répertoire cible vide, dépendances déjà téléchargées | 21,25 s | 1,336 Go, pic du scope systemd |

Le binaire release pèse 4,9 Mo.

## 8. Dépendances

- **Ajoutées (crate seule, verrouillées par `Cargo.lock`)** : axum 0.8.9, tokio 1.54.0, reqwest 0.13.5
  (rustls avec ring, sans fournisseur par défaut), rustls 0.23, serde 1.0.229 (v2, déjà présent dans le
  verrou), serde_json 1.0.154 (`float_roundtrip` et `preserve_order`, pour reproduire `JSON.parse` et
  l'ordre des clés), url 2.5.8, tracing 0.1.44 et tracing-subscriber 0.3.23.
- **Toolchain** : rustc et cargo 1.99.1 stable, installés par rustup depuis les sources officielles dans
  un répertoire utilisateur isolé. Aucun outil partagé remplacé.
- **Node** : aucune dépendance npm ajoutée ni retirée. Le banc utilise `python3` (système) et deux
  exemples Rust (`replay`, `loadgen`).
- **Retirables** : toute la crate, le getter, le branchement et les deux variables d'environnement, si le
  lot est abandonné. Rien d'autre n'en dépend.

## 9. Commandes

Depuis la racine du dépôt, avec la toolchain dans le `PATH` (`RUSTUP_HOME` et `CARGO_HOME` du répertoire
isolé). Les builds lourds se lancent sous `systemd-run --user --scope -p MemoryMax=3G -p MemorySwapMax=0`.

| But | Commande |
|---|---|
| Construire | `cargo build --release --locked --bins --examples` (dans `services/vehicle-models-rs`) |
| Tester Rust | `cargo fmt --check && cargo clippy --locked --all-targets -- -D warnings && cargo test --locked` |
| Tester Node | `cd backend && npx jest src/modules/vehicles/services/data/vehicle-models.service.test.ts` |
| Démarrer le service en DEV | `python3 -I services/vehicle-models-rs/bench/tools.py envexec backend/.env services/vehicle-models-rs/target/release/vehicle-models-rs` (lit seulement les 6 clés Supabase et n'écrase pas l'environnement) |
| Basculer le backend DEV (owner) | dans `backend/.env` : `VEHICLE_MODELS_RS_ENABLED=true` et `VEHICLE_MODELS_RS_URL=http://127.0.0.1:3110`, puis redémarrer le backend DEV |
| Retour arrière | `VEHICLE_MODELS_RS_ENABLED=false`, redémarrer le backend, puis arrêter le service (SIGTERM) |
| Comparer | `BENCH_OUT=<dir> services/vehicle-models-rs/bench/bench.sh record`, puis `parity`, `faults`, `live`, `campaign` et `summary` |

`bench.sh` : `record` et `live` lisent la base réelle en GET séquentiels. Les autres commandes rejouent
l'enregistrement. Il faut avoir construit `backend/dist` au préalable.

## 10. Défauts préexistants (hors lot, non corrigés)

Reproduits à l'identique par le portage, pour garder la parité :

1. Pagination `auto_type` par `offset` sans `ORDER BY` : pages instables possibles sous écriture
   concurrente.
2. Recherche interpolée telle quelle dans `.or()` : `search=a,b` donne un 500 dans les deux versions.
3. `brandId` hors plage `smallint` (999999) : 500 au lieu d'un 4xx.
4. Étape 1 (`auto_modele`) non paginée, donc plafonnée à 1000 lignes par `max-rows`.
5. Le chemin avec `year` n'est jamais mis en cache.
6. Aucun maximum sur `limit`.
7. Tri seulement sur `modele_name` : l'ordre des ex æquo n'est pas garanti.
8. Tas Node limité à 4 Go dans un conteneur limité à 2 Go.
9. Legacy envoie le message d'une `TypeError` interne à `logError` sur un corps amont malformé.

Constat sans lien avec la route : `backend/src/config/diag-canon.schema.test.ts` échoue sur cette base.
Ce test lit l'export `diag-canon.json` du dépôt wiki voisin, hors de ce lot.

## 11. Verdict et suite

- **Verdict v1 (passes v1) : garder l'existant.**
- **Verdict v2 (passes v2, même règle figée) : garder l'existant.**
  - Parité totale et 0 erreur.
  - À L0, B consomme moins de CPU que A au-delà de l'écart entre répétitions : 2,398 [2,397–2,445]
    contre 3,643 [3,569–4,165] ms/req, avec un p95 plus bas.
  - À L20, B consomme plus que A : 5,820 [5,754–5,838] contre 4,891 [4,560–4,959] ms/req. Or la règle
    exige un gain aux deux latences.
- **Ce qui reste servi** : le chemin Node existant. Le flag reste éteint.
- **Au-delà de la règle** :
  - Le RSS total de B est plus bas que celui de A aux deux latences : 439,3 contre 573,0 Mo, puis 303,3
    contre 469,0 Mo.
  - Mais Node en B grossit plus vite : +12,60 Mo/min contre +1,90 sur 300 s. Cette durée ne permet pas de
    distinguer une fuite d'une croissance du tas avant un ramassage majeur. L'avantage RSS reste donc
    provisoire.
  - Rust seul (C) passe sous A à L20 : 3,750 contre 4,891 ms/req, avec un p95 de 143,4 contre 165,1 ms
    et 17 Mo de RSS. Mais en B, Node garde 1,848 ms/req à L20 pour l'appel HTTP et la réponse. Le gain
    n'existerait que si Rust servait la route sans Node devant. Cela exige un changement de routage devant
    le backend, et la réécriture en Rust du contrôleur, des pipes, du cache, du filtre et des journaux.
    C'est hors de ce mandat (DEV seulement, Node conservé).
- **Suite recommandée** :
  1. Ne pas étendre à d'autres routes le schéma « Node puis `fetch` puis Rust ». Sur ce lot, à L20, la
     part de Node plus celle de Rust dépasse Node seul.
  2. Corriger dans Node, en lot séparé, le défaut n°1 de la section 10 (pagination sans `ORDER BY`).
     C'est un défaut de justesse, indépendant de Rust.
  3. Instruire le défaut n°5 (chemin avec `year` jamais mis en cache) par le cache borné existant
     (`VehicleCacheService`). Mesurer d'abord la répartition réelle des couples marque × année : le banc
     rejoue 18 chemins et donnerait un taux de succès irréaliste.
  4. Pas de PR pour cette branche : elle reste la référence mesurée. Elle n'est pas poussée.

## 12. Actions owner

- Seulement si la branche est un jour proposée à la fusion : `ownership.yaml` est réservé à l'owner. Il
  manque la règle suivante, sans quoi la porte CI `block-new` (ADR-058) échoue sur les 21 fichiers de la
  crate :
  `- glob: services/vehicle-models-rs/**` avec `domain: D4`, `owner: '@ak125'`, `sourceConfidence: high`
  et `risk: high`. Il faut ensuite lancer `npm run registry:heal`.
- Basculer DEV:3000 reste une action de l'owner (section 9), pour observer le chemin Rust. Aucun gain CPU
  n'est attendu à latence réaliste. Le banc n'a jamais touché le backend DEV en cours d'exécution.
