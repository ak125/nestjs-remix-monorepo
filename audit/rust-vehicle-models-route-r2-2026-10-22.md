# Route Rust R2 — `GET /api/vehicles/brands/:brandId/models` derrière Caddy (banc isolé)

Date : 2026-10-23 (v4 ; la v3 du 2026-10-22 est gardée en historique, § 2.2 et § 5). Branche locale
`feat/rust-vehicle-models-route-r2`, base `4a2ddd1a5`, suite du lot 1
([`rust-vehicle-models-lot1-2026-10-21.md`](rust-vehicle-models-lot1-2026-10-21.md)). Périmètre : banc isolé
sur la VM DEV (Redis, rejeu, A2, R2 et Caddy du banc, sur des ports dédiés). Rien n'est poussé, fusionné,
déployé ni activé. Le Caddyfile de production ne contient aucune règle pour cette route. Le DEV partagé, son
Redis et le Caddy système n'ont pas été modifiés.

Deux versions de R2 sont mesurées. Chaque résultat est rattaché au binaire qui l'a produit :

- **`16a5a8a6…`** (`vehicle-models-route`, avec `backend/dist` `f2c349e3…`) : limiteur tenu dans la mémoire de
  chaque processus ;
- **`b6d5bcd3…`** (avec `backend/dist` `2fcdbf66…`) : limiteur partagé par Node et R2 dans Redis (§ 2.4).

| État | Binaire | Résultat | Section |
|---|---|---|---|
| Performance au banc | `16a5a8a6…` | **démontrée** : R2 validé, bénéfice démontré (PROTOCOL-v4). Rapports r2/a2c : mémoire courante 0,509, pic 0,600, CPU par réponse 0,788, p95 0,839, p99 0,625, sur une paire de 90 min à 80 req/s | § 6.4, § 6.5 |
| Contrat fonctionnel | `16a5a8a6…` et `b6d5bcd3…` | **rejoué** : 185/185 sur chacun ; sondes 21/21 ; parcours navigateur 9/9 par sélection, mêmes listes ; destination 0 défaut | § 2.1, § 3, § 4 |
| Activation hors banc | `16a5a8a6…` | **bloquée** : en sélection rust, une adresse dispose de deux budgets du limiteur | § 2.3 |
| Correction du limiteur | `b6d5bcd3…` | un budget commun à Node et à R2, vérifié au banc et par les tests ; ni CI ni PREPROD | § 2.4, § 9 |
| Performance au banc, version corrigée | `b6d5bcd3…` | **démontrée** sur une seconde paire de 90 min à 80 req/s : R2 validé, bénéfice démontré. Rapports r2/a2c : mémoire courante 0,516, pic 0,642, CPU par réponse 0,757, p95 0,891, p99 0,712 | § 6.7 |
| Coût de la correction | `b6d5bcd3…` | **mesuré** face à la première paire : CPU par réponse ×1,080 pour a2c et ×1,038 pour r2, sous l'écart minimal du protocole, hausse portée par Redis ; aucune hausse de p95 ni de p99 ; Redis à 36 Mo de RSS, plat après 1 h ; aucune entrée en repli | § 6.7 |
| Activation hors banc | `b6d5bcd3…` | **non faite** : le double budget est corrigé au banc ; ni CI ni PREPROD, conditions d'intégration au § 10 | § 2.4, § 10 |

Les gains mesurés sur `16a5a8a6…` ne sont pas attribués à `b6d5bcd3…`. Les mesures de la version corrigée sont
celles du § 6.7, et seulement celles-là.

Aucune conclusion de ce rapport ne vaut activation en production. Aucune ne prouve que le crash initial de la
production est corrigé, et aucune ne vaut décision de réécrire l'application en Rust.

## 1. Objet

Décider si la route Rust R2 sert `GET /api/vehicles/brands/:brandId/models` avec année avec le comportement de
Node, et avec un gain serveur réel, surtout en mémoire. Deux configurations, derrière le même Caddy de test :

- **A2** : Caddy → Node (backend complet `backend/dist`, frontend compris) pour toutes les requêtes ;
- **R2** : même Caddy → binaire Rust `vehicle-models-route` pour les GET et HEAD de la route avec une année,
  Node pour le reste.

La v4 ferme les points ouverts par la v3 : cache sans année (§ 2.3), suivi long des deux configurations
(§ 6), OOM de Node (§ 7) et budget du limiteur (§ 2.3, § 2.4).

Le contrat détaillé (éligibilité, chaîne reproduite, Redis, journaux, limiteur, pannes) est dans
[`services/vehicle-models-rs/docs/route-contract.md`](../services/vehicle-models-rs/docs/route-contract.md).
Ce rapport en reprend les résultats et y ajoute les campagnes de mesure.

## 2. Contrat via Caddy, réserves et limiteur

### 2.1 Contrat final, sur les deux binaires

Le contrat est rejoué en entier sur chaque binaire, avec le même script de capture et le même comparateur.
Le binaire du processus R2 est relu dans `/proc/<pid>/exe` après son démarrage (`r2-exe.txt`).

| Essai | `16a5a8a6…` (`contract-v4/final`, tête `2a242e490`) | `b6d5bcd3…` (`contract-limiter/final`, tête `fdf82d84a`) |
|---|---|---|
| Contrat, 185 cas (`diff-caddy.json`) | 185/185 ; Redis identique ; 44 lignes `__error_logs` identiques | 185/185 ; idem |
| Destination stricte (`routes-node`, `routes-rust`) | 0 défaut. En sélection rust : 108 cas éligibles servis par R2, 75 non éligibles par Node ; en sélection node, tout par Node. Sans amont, dans les deux : p070 (400) et q-headers-20k (431 de Caddy) | idem |
| Sonde synthétique, 21 cas | 21/21 ; 20 servis par R2, p-noyear (chemin brut `16%34`) par Node | idem |
| Budget du limiteur, palier `medium` | node 99…88 ; rust 99, 99, 98, 98…94, 94 : le double budget. 0 écart à l'attendu d'alors, qui le décrivait | 99…88 dans les deux sélections ; 0 écart au nouvel attendu (`350e09ba9`) |
| Amont de la route arrêté | 0 écart à l'attendu | 0 écart à l'attendu |
| Redis et rejeu arrêtés, 17 étapes | statuts, corps et en-têtes égaux ; journaux différents sur 2 étapes | idem ; journaux différents sur 3 étapes (§ 2.3) |
| Parcours navigateur | 9/9 par sélection | 9/9 par sélection, mêmes options et empreintes (§ 4) |
| 421 | aucun hors de `scope-r2/` | aucun hors de `scope-r2/` |

Les deux premières captures de `16a5a8a6…` ont donné 183/185 (`contract-v4/c185`) : deux cas lus pendant le
préchauffage du cache de Node. La capture finale attend la fin de ce préchauffage après chaque remise à zéro
(`warm.txt`). C'est un changement de procédure, pas une normalisation : contrat, § 4.

Le comparateur ne couvre pas les clés Redis `throttler:*`, que le stockage partagé introduit. Les décisions du
limiteur sont comparées par leurs statuts, leurs en-têtes `X-RateLimit-*` et l'étape budget ; les clés sont
vérifiées par `limiter-shared/` et par les tests. Un contrôle a posteriori rattache toutes les clés des deux
captures à leur contexte, leur palier et leur client : contrat, § 7.

Comparateur, normalisations et classement des faux : contrat, § 4 et § 9. Il n'y a pas de nouvelle
normalisation en v4.

### 2.2 Contrat v3 (historique)

Texte de la version v3 (`ed2cb1cc7`), sans changement. Ces essais portent sur le binaire `2aeea4d5…`, avant
`0b3d97eff` ; le contrat final est au § 2.1.

**Preuves et binaire de chaque essai.**

Binaire mesuré par la campagne : `target/release/vehicle-models-route`, sha256 `2aeea4d5ee2de164…`, construit
sur `25571b854`. Les essais du run 3 ont tourné avant le correctif du limiteur (`16286df65`), sur un binaire
construit depuis le code alors non commité. Son empreinte n'a pas été relevée : `run3/` ne contient pas de
`binary.sha256`. Ces essais ont été rejoués sur le binaire mesuré (runs 4 et 5).

| Essai | Run 3 (binaire non relevé) | Binaire mesuré `2aeea4d5` |
|---|---|---|
| Contrat, 185 cas | 184/185 (`diff-caddy-c`) | 185/185 (`run4/diff-caddy-d`) ; Redis et 44 lignes `__error_logs` identiques |
| Destination stricte des 185 cas | 0 défaut (`routes-a2b-strict`, `routes-r2b-strict`, `routes-r2c-strict`) | 0 défaut (`run4/routes-r2d-strict`) |
| Sonde synthétique, 21 cas | 21/21, 0 écart (`diff-probes2`) | 21/21, 0 écart, Redis et journal d'erreurs identiques (`run5/diff-probes`) ; destination 0 défaut (`run5/routes-r2-probes`) |
| Amont de la route arrêté | 0 écart à l'attendu (`r2-backend-outage-3`) | 0 écart à l'attendu (`run5/r2-backend-outage`) |
| Redis et rejeu arrêtés | 3 écarts classés (`diff-outages-g`) | les 3 mêmes écarts, champ `logs` des étapes o-redis-down, o-redis-down-session et o-redis-back (`run5/diff-outages`, contre la même capture A2) |
| Budget du limiteur | 0 écart à l'attendu (`budget-rust`) | 0 écart à l'attendu (`run5/budget-rust`) |
| Parcours navigateur | 9/9 par sélection | 9/9 par sélection, mêmes listes affichées qu'au run 3 (`run5/journeys-node`, `run5/journeys-rust`) |

Run 5 : binaire du processus R2 relu dans `/proc/<pid>/exe` après le démarrage (`2aeea4d5…`,
`run5/r2-exe.txt`), commit `1a810f27a`, code de sortie 0. Le petit contrôle Python intégré à `run5.sh`
après la panne d'amont s'est arrêté sur une `TypeError` (`len()` d'un compteur entier) ; le rapport
`backend-outage.json` qu'il relisait est complet et indique 0 échec. Résumé sans corps de tous les
rapports des runs 2 à 5 : `rust-vehicle-models-route-r2-2026-10-22/contract/contract-summary.json`.

Côté A2, les captures de référence restent celles du run 3 : aucun fichier de `backend/`, `frontend/` ni
`packages/` n'a changé depuis `1cdcaef29`.

**Classement des faux.**

Chaque comparaison a d'abord tourné sans retouche du comparateur. Faux bruts et traitement :

| Cas | Constat brut | Classement | Traitement |
|---|---|---|---|
| q-body-11mb (1re capture R2, `diff-caddy`) | A2 : 500 JSON `PayloadTooLargeError` de Node. R2 : page 500 de Caddy (`text/plain`, `Server: Caddy`, sans `Via`, 0,6 ms) | défaut réel de R2 : échec avant toute réponse | corrigé dans le code de R2 avant `r2-caddy-b` (réponse de R2 identique à celle de Node, 36,8 ms) ; aucune normalisation |
| p052, p069, m-post, m-put, m-delete, m-patch : `__error_logs` faux dans `diff-caddy` et `diff-caddy-b` | servis par Node dans les deux sélections, 0 ligne R2. Seuls diffèrent `err_context.timestamp` des lignes `__error_logs` (écrit par `handle404` de `error.service.ts` et par `routes/$.tsx`) et, dans la page HTML 404 de p052, le nonce CSP, les dates ISO et l'identifiant `cart_<sid>` | horloge et aléa de Node lui-même, pas un écart de R2 | deux normalisations, de 15 à 16 éléments : « journal d'erreurs » étendu à `err_context.timestamp` ; « page HTML » ajoutée, appliquée seulement si les empreintes brutes diffèrent. Rejouées sur les mêmes captures (`diff-caddy-b2`) : 184/185 |
| Redis | `keys`, `stats`, `recent_blocks` et `vbot` vrais dans toutes les comparaisons, dès la première | — | aucun |
| q-url-20k | 431, ou connexion fermée sans octet, dans les deux sélections | course de transport entre Caddy et l'amont (contrat, § 9) | non normalisé ; reste un écart dans `diff-caddy-c` |
| Pannes Redis | lignes « Erreur Redis (session) » plus nombreuses en R2 (65 contre 31) et une ligne « ready » du client de session de R2 ; ±1 ligne d'erreur des clients de fond d'A2 | différence réelle de R2 (second client de session) ; différence temporelle | non normalisées (contrat, § 9) |

Aucune normalisation ne porte sur un statut, une décision de sécurité (BotGuard, sonde, limiteur, session)
ou un effet Redis autre que les TTL et les sommes par minute. Liste complète : `NORMALISATIONS` dans
`bench/contract.py`, recopiée dans chaque rapport de comparaison.

### 2.3 Réserves

| Réserve | Constat | Statut |
|---|---|---|
| Limiteur : budget d'une IP au trafic mixte | budget doublé sur `16a5a8a6…`, mesuré sur les paliers `short` et `medium` | corrigé par `22cb0cc7a` et `b646dd0a8` (§ 2.4), vérifié au banc sur `b6d5bcd3…`, ni en CI ni en PREPROD. `16a5a8a6…` reste non activable |
| Limiteur partagé : panne et perte de Redis | en panne, un budget par processus ; compteurs perdus sans persistance ; éviction LRU possible | réserves documentées, journalisées, non corrigées (§ 2.4) |
| Démarrage de Node sans Redis | Node ne démarre pas (BullMQ, `SeoAuditSchedulerService`) ; R2 démarre | antérieur au correctif, non corrigé ici (§ 2.4) |
| Limiteur : palier long de Node | cardinalité, expirations et blocage établis (§ 6.2, § 6.3) | corrigé par `c6ecea9d9` (6.7.1) |
| Pannes Redis : différences de journaux | sur `16a5a8a6…`, 3 étapes (`redis-outages-v4`) et 2 (`contract-v4/final`) ; sur `b6d5bcd3…`, 3 (`contract-limiter/final`) ; statuts, corps et en-têtes égaux ; expliquées, attribuables, même politique de reconnexion | acceptables ; corrigibles mais non nécessaires ; non normalisées |
| Cache sans année | la route sans année reste à Node dans les deux sélections | fermé par `0b3d97eff`, avant les mesures |
| q-url-20k | course de transport entre Caddy et un amont qui répond tôt puis ferme | défaut identifié, hors R2, non normalisé |

**Limiteur, budget mixte** (`bench-v3/limiter-mixed-v4/`, banc de trace distinct, mêmes binaires). Chaque IP de
test est neuve. Le script alterne une requête de la route (année fixée) et une requête `/api/` inconnue
(404 après le catch-all Remix). Statuts bruts dans l'ordre d'envoi :

| Sélection | Paires, pause | Servies |
|---|---|---|
| node | 10, 0 | 15 au total (8 de la route, 7 autres) ; 429 dès la 16e requête combinée |
| rust | 10, 0 | 20/20 |
| rust | 16, 0 | 15 de chaque type ; 429 à la 16e de chaque type |
| node | 60, 0,05 s | 100 au total ; 429 dès la 101e combinée |
| rust | 110, 0,05 s | 100 de chaque type ; 429 à la 101e de chaque type |

En sélection node, une requête de la route produit 8 incréments du stockage : 4 paliers × 2 contextes,
`RemixController` puis `VehiclesController`. C'est la trace d'une seule requête prise par l'inspecteur de Node.
Les clés sont recalculées depuis `Classe-Handler-palier-IP`. Le palier long (2000/h) n'est pas mesuré : il suit
le même code, et il faudrait plus de 20 min à 100/min pour l'atteindre.

Le budget est global dans le déploiement actuel. `docker-compose.prod.yml` déclare un seul conteneur
applicatif. Le Caddyfile de PROD n'a qu'un amont, et `main.ts` n'utilise pas de cluster. Le stockage en mémoire
par défaut (`app.module.ts`, l. 101-106, sans `storage`) est donc un compteur unique par IP et par contexte.
R2 ajoute un second compteur.

Mécanismes partagés existants examinés :

- aucun `ThrottlerStorage` partagé dans `backend/src` ni dans `packages`, aucune dépendance de ce type ;
- BotGuard (Redis `bot-guard:*`) ne compte pas par IP et par fenêtre ;
- `CacheService.atomicIncr` pose le TTL en deux commandes et renvoie 1 si Redis est indisponible. Ce serait
  une ouverture silencieuse de la protection.

Aucun ne permet de partager ce compteur sans affaiblir la protection. La correction retenue est un stockage
partagé du limiteur, commun à Node et à R2 : Redis, script atomique, clés identiques à celles de Node,
politique de panne explicite (§ 2.4). Elle passe par le point d'extension de la bibliothèque, l'option
`storage`, et ne réimplémente ni le garde ni les paliers. Elle change le stockage de la protection de tout le
site. Diviser les limites de R2 est refusé : ce serait une constante inventée, et le budget serait faux pour un
client servi seulement par R2.

**Limiteur, palier long de Node.** Hypothèse v3 vérifiée :

- cardinalité : environ 2 minuteries par requête pendant 1 h (D1) ;
- expirations : copie O(N) de la liste du palier à chaque expiration en 6.5.0 ;
- purge : aucune minuterie par coup en 6.7.1, et purge des enregistrements inactifs toutes les 60 s ;
- ressources retenues : 560 596 objets `Timeout` à 3494 s.

Le blocage est démontré en isolement, et la correction est commitée. Détails : § 6.2, § 6.3 et § 7.

**Pannes Redis** (`bench-v3/redis-outages-v4/`). Les sources sont les captures `run3` (node) et `run5` (rust).
Le diff ne porte que sur le champ `logs` de trois étapes : statuts, corps et en-têtes sont égaux. La politique
de reconnexion est identique : node-redis 5.12.1 `defaultReconnectStrategy` et `reconnect_delay` de R2 suivent
la même formule, min(2^n × 50, 2000) ms plus une gigue de 0 à 199 ms. Un test de R2 le vérifie. node-redis
garde une socket ouverte et apprend la fermeture aussitôt. R2 ouvre paresseusement, sous un verrou par
processus, et ne constate la fermeture qu'à la première commande.

| Étape | node : session A2 | rust : session A2 | rust : session R2 |
|---|---|---|---|
| o-redis-down (sans cookie) | 4 erreurs | 5 erreurs | 0 : aucune commande de session |
| o-redis-down-session (cookie) | 31 erreurs, cycle déjà vers 2 s | 30 erreurs | 34 erreurs, cycle reparti de n = 0 |
| o-redis-back | ready | ready | 1 erreur (tentative avant le retour de Redis), puis ready |

Les différences ne sont ni une perte d'observabilité ni une divergence de sécurité :

- le signal de panne existe dès la première commande de session de R2. Il apparaît aussi dans la ligne BotGuard
  de R2, aux comptes égaux à ceux d'A2, et dans le cycle du client de session de Node, qui sert le reste du
  site ;
- les deux implémentations retiennent la requête avec cookie, sans réponse sans contrôle de session ni 500.
  Le client abandonne à 60 s : Caddy journalise 499 dans les deux cas ;
- la reprise est la même, et la session recréée donne 200 dans les deux cas.

Les traces du client distinct sont acceptables. Une tâche de surveillance permanente dans R2 les rendrait
semblables, mais elle n'est pas nécessaire. Le comparateur les garde, sans normalisation.

**Pannes Redis, version corrigée** (`b6d5bcd3…`, `contract-limiter/final/outages` et `diff-outages.json`).
Mêmes 17 étapes ; statuts, corps et en-têtes égaux. Le diff porte sur les journaux de trois étapes, contre
deux dans la capture `contract-v4/final` sur `16a5a8a6…`. La nouvelle est o-redis-down : le limiteur partagé
y journalise son entrée en repli. Comptes par processus :

| Étape | sélection node : A2 | sélection rust : A2 | sélection rust : R2 |
|---|---|---|---|
| o-redis-down (sans cookie) | ERROR `RedisThrottlerStorage`, cause « Stream isn't writeable and enableOfflineQueue options is false ; connect ECONNREFUSED » ; ligne BotGuard ; session 4 ; 4 lignes de chaque client de fond | session 4 ; 3 lignes de chaque client de fond | ERROR `RedisThrottlerStorage`, cause « Redis : connexion fermée » ; ligne BotGuard ; session 0 |
| o-redis-down-session (cookie) | session 31 ; 45 lignes de chaque client de fond | session 31 ; 46 | session 34 |
| o-redis-back | WARN `RedisThrottlerStorage` « Redis revenu : budget partagé rétabli après 8 décision(s) en mémoire du processus » ; ready | ready | même WARN ; session ready |

- Le repli et le retour sont journalisés par le processus qui sert la route : A2 en sélection node, R2 en
  sélection rust. Le message et le nombre de décisions prises en mémoire (8, une requête de la route) sont
  les mêmes. Seule la cause citée diffère : elle vient du client Redis de chaque implémentation.
- Les clients de fond sont ceux de Node (`CacheService`, `AiContentCacheService`) ; ils ne servent pas la
  route. L'écart de 4 contre 3, et de 45 contre 46, est un nombre de tentatives de reconnexion journalisées
  pendant l'étape. Sa cause n'est pas établie au-delà de ce constat.
- Aucune perte d'observabilité : le signal de panne du limiteur existe dans les deux sélections, dans le
  processus qui décide. Aucune divergence de sécurité : la requête est servie (200) dans les deux sélections,
  et le budget en repli suit la borne décrite au § 2.4.

**Cache sans année** (`0b3d97eff`, avant toute mesure v4). `Caddyfile.route` n'envoie à l'amont choisi que les
GET et HEAD de la route avec une année : `year` à une seule valeur de 4 chiffres, au plus 1000 paramètres. Sans
année, la route reste à Node dans les deux sélections, avec son cache LRU partagé par le module véhicules. R2
n'en crée pas un second. Hors de ce périmètre, R2 répond 421, sans repli. Le code de R2 suit la même règle
(`is_route`, test `route_requires_a_year_like_caddy`). Elle est vérifiée directement sur R2 (`contract-v4/scope-r2`,
8 étapes, 0 échec) et par la destination du contrat : en sélection rust, les cas sans année sont servis par
Node. Contrat, § 9 et § 10.

**q-url-20k** (`contract-v4/url20k/`). 20 essais par série, chacun sur une connexion neuve et une IP neuve.
Tous sont gardés.

| Série | Amont | 431 reçu | Connexion coupée |
|---|---|---|---|
| sélection node, sans année | Node | 4 | 16 |
| sélection node, avec année | Node | 0 | 20 |
| sélection rust, sans année | Node | 7 | 13 |
| sélection rust, avec année | R2 | 8 | 12 |
| direct, sans Caddy (Node sans et avec année, R2 avec année) | Node, R2 | 20/20 par série | 0 |

Chaque coupure laisse la même trace dans Caddy : l'amont a répondu 431, puis une réinitialisation de la
connexion annule la réponse déjà reçue. Le défaut touche aussi Node seul. C'est un défaut de transport entre
Caddy et un amont qui répond tôt puis ferme, pas un défaut de R2.

Explication probable, non vérifiée par une capture réseau, impossible sans root : l'amont ferme avant d'avoir
lu toute la requête de 20 Ko. L'écart reste dans le contrat, non normalisé, quel que soit le statut obtenu par
une capture donnée.

### 2.4 Limiteur partagé : correction du double budget

**Défaut.** Mesuré sur `16a5a8a6…` (§ 2.3, `bench-v3/limiter-mixed-v4/`) : en sélection rust, une même adresse
dispose d'un budget dans R2 et d'un autre dans Node pour le contexte Remix. Au palier `short`, 15 requêtes de la
route et 15 autres sont servies, contre 15 au total en sélection node. Le budget est global dans le déploiement
actuel : un seul conteneur applicatif, un seul amont, pas de cluster (§ 2.3).

**Correction**, dans des commits distincts des mesures :

| Commit | Contenu |
|---|---|
| `22cb0cc7a` | Node : `RedisThrottlerStorage` (`backend/src/config/throttler-redis-storage.service.ts`), branché par l'option `storage` de `ThrottlerModule` (`app.module.ts`, `forRootAsync`). Script `throttle.lua`, copie pour R2 |
| `b646dd0a8` | R2 : mêmes clés, même script, dans le même Redis (`guard.rs`, `redis.rs`, `app.rs`) |
| `350e09ba9` | contrat : l'attendu de l'étape budget devient 99…88 dans les deux sélections |

Seul l'emplacement des compteurs change : il passe de la mémoire de chaque processus à Redis. Le garde, les
paliers, `skipIf`, `getTracker` et `generateKey` restent ceux de `@nestjs/throttler` 6.7.1. Une clé reste
`sha256(Classe-Handler-palier-IP)`. La portée de chaque limite est donc inchangée, et aucun quota n'est fusionné :

- les contextes Remix et Vehicles gardent des compteurs distincts ;
- chaque palier garde le sien ;
- chaque route `/api` garde son budget ;
- les `@Throttle` par route, dont `payment_callback` sur les deux callbacks de paiement, gardent leurs valeurs.

Ce qui change : deux processus qui servent la même limite décomptent un seul compteur.

- **Script.** `THROTTLER_INCREMENT_LUA` transcrit `ThrottlerStorageService.increment` 6.7.1 en un script Redis
  atomique, avec les branches sans blocage, blocage et levée du blocage. Une entrée correspond à un hachage
  `throttler:<clé>` (échéance, fin de blocage, blocage) et à une liste `throttler:<clé>:<palier>` des
  échéances des coups. L'échéance Redis est le maximum de l'échéance, de la fin du blocage et du dernier coup.
  Le script traite plusieurs entrées et s'arrête après la première bloquée, comme la boucle du garde.
  L'horloge est celle de l'appelant, comme dans le stockage 6.7.1.
- **Appels.** Node appelle le script une fois par palier et par contexte, soit 8 `EVALSHA` séquentiels pour la
  route. R2 envoie les 8 entrées en un seul `EVALSHA`, puis `EVAL` si Redis répond `NOSCRIPT`, et valide la
  réponse. Chaque processus ouvre une connexion Redis dédiée au limiteur, sans file hors ligne, avec un délai
  de commande de 250 ms. Node attend donc au plus 2 s par requête de la route si Redis ne répond plus sans
  couper la connexion.
- **Mécanismes existants.** Aucun `ThrottlerStorage` partagé n'existe dans le dépôt. BotGuard ne compte pas
  par adresse et par fenêtre. `CacheService.atomicIncr` pose l'échéance en deux commandes et rend 1 sur
  panne, ce qui ouvrirait la protection en silence. Le motif repris est celui de `WriteGuardLockService` :
  connexion ioredis dédiée par `redisConnectionOptions` et script Lua.
- **Panne de Redis.** La protection ne s'ouvre pas et ne se ferme pas. Chaque processus se replie sur un
  stockage en mémoire : celui de la bibliothèque pour Node, l'équivalent pour R2. L'entrée en repli est
  journalisée en ERROR, le retour en WARN avec le nombre de décisions prises en mémoire (contexte
  `RedisThrottlerStorage`, dans les deux processus).
- **Dérive.** `services/vehicle-models-rs/src/route/throttle.lua` est inclus dans R2 par `include_str!`. Un test
  Jest du backend, exécuté par la CI, exige son égalité octet à octet avec la constante TypeScript. Le crate
  n'a pas de CI.

**Preuves** (tests au § 9, binaires `b6d5bcd3…` et `2fcdbf66…`, § 2.1) :

| Vérification | Source | Résultat |
|---|---|---|
| Parité avec `ThrottlerStorageService` 6.7.1 : blocage égal, inférieur ou supérieur au ttl, sans blocage | Jest, ioredis-mock et Redis 7.0.15 jetable | identique |
| Deux stockages en alternance, appels simultanés, fin du blocage | Jest et `cargo test`, dont `concurrent_hits_from_two_processes_share_one_budget` et `shared_and_local_agree_on_real_redis` | un seul budget, aucun dépassement |
| Alternance Node/R2 derrière Caddy, paliers `short` et `medium` | banc, `limiter-shared/` | 15 et 100 au total, comme en sélection node |
| Rafale simultanée, 40 requêtes | banc, `limiter-shared/` | 15 servies, 25 × 429 `short`, 16 coups dans la liste Remix-short, comme Node |
| Expiration, 429 et `Retry-After` | banc et Jest à deux applications | conformes dans les deux sélections |
| Clés | banc | toutes avec une échéance |
| Panne puis retour de Redis | banc, phase C | borne documentée en panne (15 R + 15 O), ERROR puis WARN dans chaque processus, budget de nouveau commun au retour |
| Étape budget du contrat | `contract-limiter/final/budget-*` | restant `medium` 99…88 dans les deux sélections, 0 écart à l'attendu. Sur `16a5a8a6…` (`contract-v4/final`) : node 99…88, rust 99, 99, 98, 98…94, 94, le double budget |

Les essais du banc sont détaillés dans
`rust-vehicle-models-20261021-evidence/r2/limiter-shared/README.md` (hors dépôt, sans corps de réponse).

**Réserves de la correction :**

- **Borne en panne.** Elle est de 15 par processus et par palier, pas de 15 au total : chaque processus garde
  son budget en mémoire tant que Redis manque. Elle est journalisée et ne dépasse pas cette borne au banc.
- **Remise à zéro.** Un Redis redémarré sans persistance perd les compteurs, comme au banc. C'est l'équivalent
  du redémarrage d'un processus aujourd'hui. `docker-compose.prod.yml` déclare l'AOF et
  `--maxmemory 512mb --maxmemory-policy allkeys-lru`, ce qui n'est pas prouvé servi. Sous pression mémoire,
  l'éviction LRU peut effacer des compteurs : risque non mesuré.
- **Démarrage sans Redis.** Node ne démarre pas : `SeoAuditSchedulerService.onModuleInit` attend BullMQ
  (`getRepeatableJobs`) sans fin sur un port fermé. Ce comportement est antérieur au correctif : il est établi
  par le code et un test isolé, non observé dans le processus lui-même. R2 démarre et limite en mémoire.
- **Arrêt de Node sans Redis.** `route.sh` a dû envoyer SIGKILL. La cause n'est pas établie. Hypothèse non
  démontrée : les hooks d'arrêt BullMQ attendent Redis.
- **Horloge.** Node et R2 utilisent l'horloge de leur hôte, qui est le même au banc. Avec plusieurs hôtes, il
  faudrait l'horloge de Redis.
- **Écarts assumés.** La purge lit la tête de la liste, ce qui suppose un ttl constant par clé (vrai pour les
  paliers et les `@Throttle` du dépôt). Un recul d'horloge garde des coups expirés. Les deux écarts vont du
  côté strict.
- **Portée du changement.** Le stockage change pour tout le site, callbacks de paiement compris : nouveau
  stockage, mêmes budgets, aucun fichier de `payments/` modifié. Un callback ajoute un appel Redis par
  palier et par contexte de garde traversé, chacun borné à 250 ms. Le nombre de contextes d'un callback n'a
  pas été relevé. Condition d'intégration au § 10.
- **Coût.** La correction ajoute des appels Redis à chaque requête soumise au limiteur et garde les compteurs
  jusqu'à 1 h dans Redis. Elle est mesurée par une nouvelle paire (§ 6.7). Les gains mesurés sur `16a5a8a6…`
  ne lui sont pas attribués.

## 3. Preuve de destination

Une réponse identique ne dit pas quel serveur l'a produite. La destination est lue dans des traces
corrélées :

- **contrat** (`contract.py routes`) : chaque requête porte un en-tête de cas. La ligne de requête de Caddy
  de ce cas doit nommer l'amont attendu (`127.0.0.1:3140` pour Node, `127.0.0.1:3150` pour R2), autant de fois
  qu'il y a de requêtes. Les journaux des amonts doivent concorder : en sélection rust, aucune ligne A2 pour un
  cas éligible ; dans les deux sélections, aucune ligne R2 pour un cas exclu. Une ligne Caddy sans amont n'est
  admise que si une ligne `reverse_proxy` du journal général nomme l'amont attendu pour le même cas et la même
  IP, à moins d'une seconde ;
- **navigateur** (`contract.py journey-routes`) : chaque appel est rattaché à une ligne Caddy unique par
  l'`X-Request-Id` de sa réponse, puis à la ligne de fin du processus qui l'a servi ;
- **campagne** (`destination.json` de chaque passe) : toutes les lignes de requête de Caddy de la passe,
  classées par amont et par statut. `route_wrong` doit être vide, et le nombre de lignes égal au nombre de
  requêtes envoyées.

Un 421 de R2 signalerait un désaccord d'éligibilité entre Caddy et R2. Caddy le transmettrait tel quel, et le
comparateur le relèverait comme écart de statut. Les seuls 421 observés sont ceux attendus de `scope-r2/`, en
direct sur R2, hors de Caddy. Dans la campagne, le `destination.json` de chaque passe des deux paires compte
432 800 lignes Caddy, toutes en 200 : aucun 421.

## 4. Navigateur réel

Chrome piloté par `bench/journey.mjs`, via Caddy : six parcours de l'accueil (marque, année, modèles,
motorisations ; bureau et mobile) et trois parcours de l'assistant `/diagnostic-auto`, qui demande la route
sans année. Même série dans chaque sélection, parcours espacés de 65 s (palier `medium` du limiteur).

| Série | Sélection | Parcours réussis | `models?year=` servie par | Listes affichées |
|---|---|---|---|---|
| `contract-v4/final` (`16a5a8a6…`) | node | 9/9 | Node, 6 appels sur 6 | référence |
| `contract-v4/final` (`16a5a8a6…`) | rust | 9/9 | R2, 6 appels sur 6 | mêmes options et même empreinte SHA-256, pour les 9 parcours |
| `contract-limiter/final` (`b6d5bcd3…`) | node | 9/9 | Node, 6 appels sur 6 | mêmes que la référence |
| `contract-limiter/final` (`b6d5bcd3…`) | rust | 9/9 | R2, 6 appels sur 6 | mêmes que la référence |

Les trois parcours de l'assistant n'appellent pas la route avec année : ils sont servis par Node dans les deux
sélections, et la v4 ne les rattache plus à R2. Dans chaque série : 0 appel en défaut de destination, 0 erreur
de page. Mêmes appels, mêmes méthodes et mêmes statuts dans les deux sélections ; seul l'ordre de deux requêtes
simultanées change sur les parcours de l'assistant. Statuts hors 2xx, identiques partout : 429 des mesures de
page sur les parcours bureau, 503 de `wizard-steps` sur ceux de l'assistant (contrat, § 11). Options et
empreintes par parcours : contrat, § 4.

## 5. Campagne v3 (historique)

Texte de la version v3 de ce rapport (`ed2cb1cc7`), gardé pour l'historique. Seuls changent les renvois
de section et deux précisions de la v4, signalées entre crochets.

### 5.1 Protocole

[`bench/PROTOCOL-v3.md`](../services/vehicle-models-rs/bench/PROTOCOL-v3.md), figé avant mesure (commit
`570a1d52b`). Les verdicts v1 et v2 du lot 1 sont inchangés. Paramètres principaux :

- même Caddy du banc dans les deux configurations, avec un journal par requête ; HTTP entre le générateur et
  Caddy ;
- cibles (Node, plus R2 en r2) dans un cgroup `MemoryMax=2G` sans swap, sur les CPU 0-1 ; Caddy et Redis sur
  les CPU 2-3. Node est compté dans les deux configurations : RSS total = Node + R2 + Caddy + Redis ;
- même état initial à chaque passe (processus relancés, Redis du banc vidé puis préparé) et mêmes caches :
  toutes les requêtes portent `year`, qui désactive le cache LRU dans Node comme dans R2. R2 n'a pas de cache
  propre ;
- latence amont imposée de 0 ou 20 ms (rejeu local), 4096 IP clientes, charge en boucle fermée ; passes
  courtes de 60 s, 3 par configuration et par latence ; une passe est rejouée une fois si la CPU des voisins
  dépasse 10 % ;
- arrêts : erreurs > 1 % sur 10 s ou 0 requête en 10 s, OOM du cgroup, MemAvailable < 1 Gio, disque < 2 Gio,
  disparition d'un processus mesuré. Une passe arrêtée est invalide, compte contre sa configuration et n'est
  pas rejouée ;
- suivi long à L20 : plateau vérifié à partir de 1800 s, toutes les 60 s, quand la pente du VmRSS reste
  comprise entre −1,0 et +1,0 Mo/min sur 900 s pour chaque processus et pour le total ; arrêt au plateau, sinon
  à 3600 s.

### 5.2 Passes courtes

Toutes valides et sans erreur. Chaque requête envoyée a sa ligne Caddy, vers l'amont attendu. CPU des voisins
≤ 8,0 %, aucune passe rejouée. Rejeu : 0 requête manquante ; environ 4,9 lectures de la base par requête dans
les deux configurations. Médiane [min–max] des 3 passes. CPU par requête réussie : processus mesurés, puis
cgroup des cibles.

| Indicateur | L0 a2 | L0 r2 | L20 a2 | L20 r2 |
|---|---|---|---|---|
| requêtes/s | 189 [187–199] | 377 [376–381] | 116 [116–117] | 134 [133–134] |
| p95 (ms) | 161,1 [156,7–167,5] | 61,8 [61,1–61,9] | 184,7 [183,8–186,1] | 158,4 [157,4–160,3] |
| p99 (ms) | 261,2 [221,1–261,9] | 68,4 [68,3–68,4] | 292,5 [271,0–332,1] | 169,7 [168,3–172,9] |
| CPU ms/req | 7,364 [7,082–7,547] | 3,799 [3,779–3,848] | 8,414 [8,396–8,444] | 5,295 [5,287–5,334] |
| CPU cgroup ms/req | 6,386 [6,070–6,534] | 2,641 [2,613–2,647] | 7,212 [7,192–7,237] | 3,963 [3,948–4,046] |
| RSS total au repos (Mo) | 482,9 [478,7–489,1] | 490,4 [486,4–491,1] | 488,8 [483,7–492,7] | 477,8 [473,0–488,8] |
| RSS total en charge (Mo) | 1000,3 [812,7–1021,9] | 544,1 [540,5–545,0] | 1005,5 [992,3–1007,6] | 513,8 [508,2–524,7] |
| RSS total pic (Mo) | 1084,5 [972,8–1086,7] | 555,3 [551,3–555,7] | 1027,3 [1021,9–1050,8] | 514,3 [508,5–525,3] |
| VmHWM total (Mo) | 1097,1 [978,9–1120,4] | 555,7 [553,4–556,8] | 1027,5 [1022,1–1050,9] | 523,3 [519,5–526,5] |
| pic cgroup des cibles (Mo) | 1012,4 [893,6–1036,2] | 470,7 [467,4–470,9] | 935,7 [930,3–959,6] | 405,8 [398,8–415,7] |
| CPU des voisins (%) | 1,9 [1,7–2,3] | 7,3 [7,2–8,0] | 1,8 [1,6–2,0] | 3,2 [3,0–3,9] |

Les plages sont disjointes pour tous les indicateurs de décision, aux deux latences : r2 « inférieur » en RSS
en charge, pic cgroup, CPU par requête, p95 et p99. La dispersion du RSS en charge d'a2 à L0 (20,9 %) ne change
pas ce classement, puisque les plages ne se recouvrent pas. En boucle fermée, R2 sert plus de requêtes par
seconde : la CPU par requête corrige cet écart de débit, la mémoire est mesurée à un débit plus élevé en r2.

Médianes en charge par processus (L0 / L20) : Node 929,5 / 934,3 Mo en a2, 419,2 / 407,0 Mo en r2 ; R2
54,0 / 35,9 Mo (7,1 Mo au repos) ; Caddy environ 56,6 Mo ; Redis environ 14,5 Mo.

Une passe de 60 s ne montre pas une mémoire stabilisée. Seul le suivi long peut le faire.

### 5.3 Suivi long (L20)

**a2-L20-long : invalide.** Lancée à 14:20:25 (première requête journalisée par Caddy à 14:20:34,260). Le
scope des cibles a été tué par l'OOM du cgroup (`MemoryMax=2G`) à 15:20:36 : journal du scope (`systemctl
--user`, conservé hors dépôt) « A process of this unit has been killed by the OOM killer », puis « Failed with
result 'oom-kill' », 54 min 11 s de CPU consommée. La passe compte contre a2 et n'est pas rejouée. Le défaut de
l'échantillonneur (§ 8) a empêché l'écriture de `run.json` : la série RSS de cette passe est perdue, aucun
chiffre de mémoire d'a2 au suivi long n'est publié.

| a2-L20-long | Valeur |
|---|---|
| requêtes mesurées | 389 368, dont 388 901 en 200 et 467 en 500 |
| débit | 108,4 req/s sur 3593 s |
| p50 / p95 / p99 / max (ms) | 153,6 / 195,5 / 555,0 / 3219,4 |
| destination | 390 499 lignes Caddy (chauffe comprise), toutes vers `127.0.0.1:3140` ; `route_wrong` vide |
| rejeu | 1 906 880 lectures, 0 manquante |

Les 467 réponses 500 viennent de Caddy, entre 15:20:37,133 et 15:20:37,207, après la mort de Node : l'amont ne
répondait plus. Ce ne sont pas des erreurs de la route.

**r2-L20-long : valide, arrêt au plateau à 1800 s** (premier contrôle possible). Lancée à 15:30:30.

| r2-L20-long | Valeur |
|---|---|
| requêtes réussies | 239 868 sur 239 868 mesurées, 0 erreur ; 241 198 lignes Caddy (chauffe comprise), toutes en 200 vers `127.0.0.1:3150` |
| débit | 133,2 req/s |
| p50 / p95 / p99 / max (ms) | 134,9 / 160,7 / 173,5 / 219,5 |
| CPU ms/req OK : processus mesurés ; cgroup des cibles | 5,314 (Node 0,057, R2 3,928, Caddy 1,225, Redis 0,103) ; 3,985 |
| CPU des voisins | 3,8 % |
| rejeu | 1 179 195 lectures, 0 manquante |
| OOM du cgroup | 0 |
| RSS total : repos ; médiane en charge ; max ; VmHWM | 497,5 ; 448,5 ; 534,5 ; 540,2 Mo |
| pic cgroup des cibles | 667,0 Mo |

| Processus | Pente RSS, 900 s finales (Mo/min) | RSS 1re → dernière minute (Mo) | RSS 900 s finales (Mo) | RSS max (Mo) |
|---|---|---|---|---|
| Node | +0,64 | 427,1 → 344,8 | 335,3–345,1 | 427,7 |
| R2 | +0,11 | 35,7 → 39,9 | 37,6–39,9 | 39,9 |
| Caddy | +0,01 | 55,7 → 56,9 | 56,2–58,2 | 58,2 |
| Redis | +0,01 | 14,5 → 14,8 | 14,6–14,8 | 14,8 |
| Total | +0,76 | 533,0 → 456,3 | 444,2–456,9 | 534,5 |

Toutes les pentes restent dans ±1,0 Mo/min. Le pic cgroup (667,0 Mo) dépasse celui des passes courtes
(405,8 Mo en médiane à L20) alors que le RSS total baisse. Le cgroup compte aussi le cache de pages des
fichiers écrits par ses processus, dont `r2.log` (341 Mo à la fin de la passe) ; la part de ce cache dans le
pic n'a pas été mesurée.

**Latence par minute** (observation, hors décision ; `analysis/latency-by-minute-*.json`, lus dans les
journaux de requêtes de Caddy) :

| Minute | a2 : requêtes, p99 (ms) | r2 : requêtes, p99 (ms) |
|---|---|---|
| 0 | 7084, 305,4 | 8010, 173,1 |
| 9 | 6619, 436,5 | 7988, 173,2 |
| 19 | 6506, 510,2 | 8035, 170,6 |
| 29 | 6452, 597,1 | 7950, 176,1 |
| 39 | 6391, 619,7 | — |
| 49 | 6319, 735,9 | — |
| 58 | 6161, 875,9 | — |
| 59 | 6327, 824,8 | — |
| 60 | 467 réponses 500 | — |

Côté a2, sur les minutes 0 à 59, la p50 reste entre 147,7 et 156,4 ms, mais la p99 monte de 305,4 à 875,9 ms
(minute 58) et le débit passe de 7084 à 6101–6355 requêtes par minute sur les dix dernières. Côté r2, sur les
minutes 0 à 29, la p99 reste entre 169,2 et 177,9 ms et le débit entre 7937 et 8035 requêtes par minute.

### 5.4 Décision

Application de PROTOCOL-v3, § Décision, sans retouche après mesure :

| Condition | Constat |
|---|---|
| contrat établi | oui (§ 2) |
| 0 erreur dans les passes r2 retenues | oui : 6 passes courtes et le suivi long |
| 3 passes retenues par configuration et par latence | oui : 12/12 valides, voisins ≤ 8,0 % |
| RSS en charge et pic cgroup « r2 inférieur », aux deux latences | oui, plages disjointes |
| CPU ms/req OK, p95, p99 non « r2 supérieur » | oui : « r2 inférieur », plages disjointes |
| suivi long r2 au plateau | oui, à 1800 s |
| RSS total des 900 s finales « r2 inférieur » | **non établi** : le suivi long d'a2 est invalide, sans série RSS |

La conclusion « R2 validé et bénéfice démontré » exige la dernière condition : elle n'est pas remplie. La
conclusion « conforme mais bénéfice insuffisant » exige « aucun cas inconclusif ». Or le code de décision figé
(`summary_v3`, `tools.py`) classe inconclusive la comparaison des suivis longs dès qu'une des deux passes est
invalide. « Non validé » ne s'applique pas : aucune erreur propre à r2, aucun amont erroné, aucun écart de
contrat. Reste **mesures inconclusives**.

Deux points de lecture, signalés sans être tranchés après coup :

- Les conclusions du protocole ne nomment pas le cas d'un suivi long a2 invalide (§ 8). Le classement
  ci-dessus suit le code figé. « Une passe arrêtée compte contre sa configuration » n'est pas lu comme une
  victoire de r2 : l'OOM d'A2 n'est pas une mesure du RSS des 900 s finales.
- La dispersion du RSS en charge d'a2 à L0 vaut 20,9 %, au-delà du seuil de 15 %. La règle par indicateur et
  le code figé ne l'appliquent qu'à des plages recouvrantes : ici « r2 inférieur ». La ligne « Mesures
  inconclusives » (« dispersion au-delà du seuil sur un indicateur de décision ») peut se lire plus largement ;
  cette lecture mènerait à la même conclusion.

Les passes courtes ne remplacent pas le suivi long d'a2 dans la règle : aucun chiffre de gain mémoire n'est
présenté comme démontré.

### 5.5 Limites

- VM partagée : la CPU des voisins est mesurée, pas éliminée. Elle est plus élevée en r2 (jusqu'à 8,0 %) qu'en
  a2 (jusqu'à 2,3 %), sans cause établie.
- Banc limité à la route : Node y sert aussi les autres requêtes du banc, mais pas le trafic réel ; son RSS de
  base n'est pas celui de la production.
- Données rejouées avec une latence constante, sans la base réelle ni ses variations ; HTTP sans TLS entre le
  générateur et Caddy ; RSS et non PSS.
- R2 tourne avec un seul fil de travail.
- Toutes les requêtes de charge portent `year` : le cache LRU sans année n'est pas mesuré (§ 5.6).
- Journal noyau illisible sans les groupes `adm` ou `systemd-journal` : le détail de l'OOM d'A2 (processus,
  mémoire au moment du kill) n'a pas pu être lu (§ 11).

### 5.6 Mémoire de Node et cache : observations et hypothèses (v3)

[v4 : l'hypothèse du limiteur est vérifiée et corrigée (§ 6.2, § 6.3, § 7). La route sans année reste à
Node dans les deux sélections depuis `0b3d97eff` (§ 2.3).]

Observations (code relu ou mesures archivées) :

- **Cache avec année.** `getModelsByBrand` contourne son cache dès que `year` est présent
  (`backend/src/modules/vehicles/services/data/vehicle-models.service.ts`, l. 205-206, commentaire
  « TEMPORAIRE », depuis le 2025-11-15) et écrit à chaque appel une ligne « Cache désactivé pour test filtrage
  année » (l. 209). Le cache contourné est le LRU en mémoire du module véhicules (`boundedMemoryCache`,
  `CacheableMemory`, 100 entrées par défaut, 3600 s pour les modèles), dont la clé contient déjà l'année.
  Pendant la campagne, aucun cache de route n'agit, ni dans Node ni dans R2.
- **Cache de R2.** R2 reproduit ce LRU (100 entrées, 3600 s, ignoré avec `year`) et n'a pas de cache propre.
  Dans Node, les 100 entrées sont partagées par les services du module ; dans R2, elles ne servent qu'aux
  modèles (contrat, § 9). Effet attendu sous un trafic mixte sans année : le nombre de lectures de la base,
  pas le corps. Non mesuré.
- **Taux de succès du cache.** Aucun n'est publié : la charge ne l'exerce pas, et un cycle de 18 chemins
  donnerait un taux propre au banc.
- **Dérive de Node B en v2** (Node qui appelle Rust, harnais Node, `PROTOCOL-v2.md`, 300 s à L20) :

  | Série | RSS début → fin | Pente 60-300 s | Pente 180-300 s | Pentes par fenêtre de 60 s (Mo/min) |
  |---|---|---|---|---|
  | A (Node seul) | 432 → 485 Mo | +1,90 Mo/min | +1,54 Mo/min | 11,69 ; 7,40 ; 0,79 ; 4,23 ; 0,01 |
  | B (Node) | 224 → 408 Mo | +12,60 Mo/min | +0,96 Mo/min | 101,2 ; 43,72 ; 35,68 ; 1,29 ; 1,52 |
  | B (Rust) | 16 → 17 Mo | +0,03 Mo/min | +0,05 Mo/min | 0,5 ; −0,26 ; 0,09 ; 0,44 ; −0,23 |

  La croissance de Node B se concentre sur les trois premières minutes, depuis un RSS initial plus bas que
  celui d'A. 300 s ne suffisent pas à démontrer une dérive continue. Le limiteur, helmet, la compression et les
  sessions sont hors du harnais v2 : ils n'expliquent pas cette croissance. Node B appelle Rust par le `fetch`
  global avec `AbortSignal.timeout(35 000)` (`vehicle-models.service.ts`, l. 26 et 435-437).
- **Limiteur de Node** (`@nestjs/throttler` 6.5.0, `throttler.service.js`, relu). `_storage` n'est jamais
  purgé. Chaque coup crée un `setTimeout` par palier, gardé jusqu'à l'échéance du palier (1 h pour `long`), et
  son identifiant est ajouté au tableau du palier. À chaque échéance, ce tableau entier est recopié par un
  `filter` qui en retire un identifiant. Avec 4096 IP clientes, `_storage` reste borné sur le banc ; les
  tableaux d'identifiants, eux, suivent le débit. La v3 passe par ce limiteur dans les deux configurations :
  toutes les requêtes en a2, les seules requêtes hors route en r2.
- **Tas V8.** Le banc lance Node avec `--max-old-space-size=4096`, comme le `Dockerfile` (l. 40), dans un
  cgroup `MemoryMax=2G`. [v4 : cette ligne du `Dockerfile` n'est que dans l'étage `installer` ; l'image
  servie ne fixe pas le tas (amendement 1, § 6.1).]
- **OOM d'A2 au suivi long.** Première requête journalisée par Caddy à 14:20:34,260 ; dernière ligne de
  `a2.log` à 15:20:34,118 ; kill par l'OOM du cgroup à 15:20:36. Node est donc mort environ 3600 s après le
  début de la charge. La série RSS de la passe est perdue (§ 8). Pendant cette heure, la p99 d'a2 monte de
  305,4 à 875,9 ms et son débit baisse, alors que sa p50 reste stable ; la p99 et le débit de r2 restent
  stables sur 30 min (§ 5.3). Le journal noyau, qui dirait quel processus occupait quelle mémoire au moment du kill, n'a pas pu
  être lu (§ 11).

Hypothèses, non vérifiées :

- **OOM d'A2 et palier `long`.** À environ 108 requêtes/s, le tableau du palier `long` atteint environ
  390 000 identifiants au bout d'une heure. Les premières échéances de ce palier tombent 3600 s après les
  premiers coups, soit au moment de la mort de Node. Chacune recopie alors le tableau entier (environ
  390 000 références), environ 108 fois par seconde. Avec un tas plafonné à 4096 Mo dans un cgroup de 2 Gio,
  le ramassage majeur peut venir après la limite du cgroup. C'est une coïncidence temporelle, pas une preuve.
  La part du cache de pages (527 Mo de `a2.log` écrits depuis le cgroup) est inconnue.
- **Dérive v2 de Node B** : ramassage tardif d'un tas dimensionné à 4096 Mo sous 2 Gio ; montée en charge du
  JIT ; réserve du pool de connexions undici. Les signaux et minuteries de `AbortSignal.timeout` vivent 35 s
  par appel : une réserve bornée, qui n'explique pas une croissance au-delà de 35 s.

Pour vérifier l'hypothèse du limiteur, il faudrait une passe A2 de plus d'une heure avec une série RSS et un
relevé du tas V8 autour de 3600 s. Elle n'a pas été lancée : le protocole ne rejoue pas un suivi long, et ce
mandat limite l'étude de la mémoire de Node aux observations et aux hypothèses.

## 6. Campagne v4

### 6.1 Protocole et amendements

[`bench/PROTOCOL-v4.md`](../services/vehicle-models-rs/bench/PROTOCOL-v4.md), figé avant la première passe
(commit `2149e3cf1`). Il a été amendé deux fois avant tout résultat de la paire (commit `4d6c7cbe5`), puis une
fois après la passe a2c et avant toute passe r2 (commit `2a242e490`). La v3 n'est pas rejouée. Paramètres :

- boucle ouverte à 80 req/s prévues, plafond de 64 en vol. Une requête prévue au plafond est abandonnée, jamais
  émise. Comptes séparés : prévues, émises, achevées, abandonnées, inachevées. Latence mesurée depuis l'heure
  prévue ;
- mêmes chemins (18, tous avec année), en-têtes, 4096 IP tournantes et distribution qu'en v3. Latence du rejeu
  20 ms. Chauffe 10 s, mesure 5400 s ;
- cibles dans un seul scope `MemoryMax=2G MemorySwapMax=0 OOMPolicy=continue`, sur les CPU 0 et 1. Même budget
  pour a2, a2c et r2 : Node seul, ou Node et Rust. Seuls sont admis dans le cgroup le shell témoin, son
  `sleep 1`, `node dist/main` et `vehicle-models-route` ;
- instantanés du cgroup avant, en fin de charge et après l'arrêt : `memory.current`, `max`, `peak`, `stat`,
  `events` et `events.local`, `cgroup.procs`. Journaux et sonde de Node passent par des FIFO lues hors du
  cgroup ;
- sonde `memprobe.cjs` chargée dans le processus Node testé, toutes les 10 s : tas, RSS, mémoire externe, GC,
  retard de boucle, handles, tables du limiteur ;
- issues d'une passe : défaut du banc, défaillance de l'application, complète. Les critères sont rappelés au
  § 6.4. Une reprise unique, seulement sur défaut du banc, les deux essais gardés. Un résultat défavorable
  valide ne donne lieu à aucune nouvelle passe ;
- décision par indicateur, puis conclusions dans un ordre figé (`summary4`, § 6.5).

**Amendement 1** (19:09, pendant la passe diag, avant tout résultat). Le protocole fixait
`--max-old-space-size=4096`, comme le banc v3. L'image déployée n'en fixe pas : le `Dockerfile` ne pose
`NODE_OPTIONS` que dans l'étage `installer`. L'étage `runner`, les fichiers compose de PROD et de PREPROD et les
images locales n'en ont pas, vérifié aussi sur `origin/main` `9ca6fc867`. Sous un cgroup de 2 Go, Node 24 sans
option plafonne le tas à 1 174 405 120 octets ; avec 4096, à 4 395 630 592, soit plus du double du cgroup
(`heap-default-2G.json`). Le fichier d'environnement de PROD n'a pas été lu : une valeur qu'il fixerait reste
inconnue. Décision : la passe diag continue sans changement. La référence devient **a2c**, Node lancé comme
l'image ; r2 lance le même Node.

**Amendement 2** (après la passe diag, avant toute passe a2c ou r2). Le défaut du limiteur est établi par un
test isolé (§ 6.3). La porte D1 ∧ D2 ne pouvait pas l'observer (§ 6.2). Le mandat demande de corriger un défaut
Node simple démontré avant la comparaison finale ; cette demande prime sur la porte. Le critère d'acceptation de
la correction a été fixé avant toute mesure de 6.7.1.

**Amendement 3** (23:08, après la passe a2c, avant toute passe r2). La passe a2c était classée « défaut du
banc » par un seul motif : un `sleep` étranger dans le cgroup. Les 542 relevés de processus contiennent chacun
exactement un `sleep`, celui du shell témoin. 541 ont la ligne de commande `sleep 1`. Un seul, à 1540 s, a une
ligne de commande vide : le noyau ne la donne plus pour un processus en sortie. `tools.py` prenait alors le nom
seul, que la liste des admis ne reconnaît pas. Correction : un processus sans ligne de commande est compté sous
`<nom> (en sortie)`, qui reste visible dans le résultat. Il n'est admis que si son nom noyau est celui d'un
composant déclaré : `bash`, `sleep`, `MainThread` (Node) ou `vehicle-models-` (15 premiers caractères de
`vehicle-models-route`). L'échantillonneur, les durées, les seuils et l'ordre des conclusions sont inchangés.
La passe a2c est réévaluée sur ses fichiers bruts, sans nouvelle passe. Seuls trois champs changent : le motif,
la clé de ce `sleep` et l'issue, de « banc » à « complète ». L'original est gardé
(`result-before-amendment-3.json`, `results.jsonl.before-amendment-3`). La passe diag n'a aucun relevé de ce
type. Une reprise a2c sans correction aurait laissé la conclusion dépendre du même défaut de l'outil.

**Amendement 4** (commit `fdf82d84a`, 02:20, après la première paire, avant toute passe de la version corrigée).
La première paire mesurait des limiteurs tenus dans la mémoire de chaque processus (§ 2.3). La correction
(§ 2.4) ajoute des appels Redis à chaque requête soumise au limiteur : 8 `EVALSHA` séquentiels dans Node pour
la route, un seul pour les 8 entrées dans R2. Elle garde les compteurs dans Redis jusqu'à 1 h, et chaque
processus ouvre une connexion Redis de plus. L'amendement ajoute une seconde paire, a2c puis r2, sur
`b6d5bcd3…` et `2fcdbf66…`, dans `campaign-v4-limiter/`. Il ne change ni les durées, ni le débit, ni les
seuils, ni les fenêtres, ni la reprise unique, ni l'ordre des conclusions. Il ajoute deux relevés rapportés à
part, sans effet sur la conclusion :

- Redis : RSS médian à partir de 3600 s, `used_memory` et `dbsize` en fin de charge ;
- `compare4` entre chaque passe de la première paire et la passe de même nom de la seconde.

Les conclusions de chaque paire ne valent que pour les binaires qu'elle a mesurés. L'amendement a été écrit
après les tests du correctif et avant toute exécution au banc des nouveaux binaires.

Empreintes : protocole après l'amendement 3 `c3683024…`, après l'amendement 4 `4fc0780b…` ;
`AMENDMENT-1.md` à `AMENDMENT-3.md` (`campaign-v4/`) et `AMENDMENT-4.md` (`campaign-v4-limiter/`, `10620a86…`)
conservés hors dépôt avec leur sha256.

Avant chaque passe, la CPU des CPU 0 et 1 est relevée pendant 60 s, banc arrêté (`campaign-v4/precheck.txt`).
Ce relevé n'est qu'informatif : il ne sert à aucun critère.

| Avant | cpu0 | cpu1 | disque libre | MemAvailable |
|---|---|---|---|---|
| a2-L20-diag (18:54) | 3,08 % | 3,49 % | 10,37 Gio | 9,46 Gio |
| a2c-L20-1 (21:31) | 5,17 % | 4,67 % | 10,25 Gio | 9,46 Gio |
| r2-L20-1 (23:09) | 3,57 % | 2,99 % | 10,15 Gio | 9,58 Gio |

Pour la paire de la version corrigée, ce relevé de 60 s n'a pas été fait, ni avant a2c ni avant r2. C'est une
omission de procédure (protocole, « Avant chaque passe », point 1), relevée après le départ de r2 et non
rattrapable. Elle ne touche aucun critère. Restent, pour chaque passe : le banc vérifié arrêté
(`route.sh status` vide), le disque libre (`df`), la charge et le disque libre au départ (`versions.txt`), et la
CPU des voisins pendant la passe, qui est un critère (§ 6.7).

### 6.2 Passe diag `a2-L20-diag` (tas 4096, limiteur 6.5.0)

Configuration de l'OOM v3 : commit `2149e3cf1`, `@nestjs/throttler` 6.5.0, `--max-old-space-size=4096`.
**Issue : défaillance de l'application** (OOM). Aucun défaut du banc : collecte complète ; trous maximaux de
1,0 s pour l'échantillonneur, 10,1 s pour le générateur et 10,5 s pour la sonde (seuils 5 s et 30 s) ;
générateur en retard de 1,84 ms au p99 ; CPU des voisins 3,09 %.

| a2-L20-diag | Valeur |
|---|---|
| arrêt | Node disparu à 3602 s ; `oom_kill` 1 dans le cgroup des cibles |
| requêtes prévues ; émises = achevées ; abandonnées ; inachevées | 288 173 ; 287 224 ; 949 ; 0 |
| statuts | 287 105 × 200, 119 × 500 ; servies en 200 : 99,63 % des prévues |
| p50 / p95 / p99 / max (ms, depuis l'heure prévue) | 145,9 / 308,4 / 700,7 / 11 494,7 |
| CPU ms/req OK : cgroup + Caddy + Redis ; cgroup seul (régime) | 10,73 ; 9,22 |
| `memory.current` au dernier relevé ; `memory.peak` | 1952,7 Mo ; 2048,0 Mo (= `memory.max`) |
| destination | 288 024 lignes Caddy vers `127.0.0.1:3140`, `route_wrong` vide |
| rejeu | 1 407 547 lectures, 0 manquante, 0 en-tête différent |

Les 119 réponses 500 viennent de Caddy (`Server: Caddy`, `text/plain`, 54 octets). Elles sont émises entre
19:55:16,301 et 19:55:16,980, à la mort de Node : ce ne sont pas des réponses de la route.

Fenêtres de 10 min (médianes des relevés de la fenêtre) :

| Fenêtre (s) | servies | p95 (ms) | p99 (ms) | `memory.current` (Mo) | tas utilisé (Mo) | GC (ms/s) | CPU ms/req OK |
|---|---|---|---|---|---|---|---|
| 0-600 | 1,00 | 183,2 | 357,4 | 943,1 | 708,1 | 46,8 | 10,24 |
| 600-1200 | 1,00 | 214,7 | 450,6 | 999,0 | 456,3 | 50,4 | 10,26 |
| 1200-1800 | 1,00 | 299,8 | 576,9 | 1069,5 | 494,0 | 52,8 | 10,58 |
| 1800-2400 | 1,00 | 411,8 | 677,3 | 1123,8 | 527,7 | 53,9 | 10,90 |
| 2400-3000 | 1,00 | 450,0 | 750,4 | 1221,7 | 641,5 | 54,5 | 10,76 |
| 3000-3600 | 0,99 | 571,8 | 868,0 | 1278,9 | 762,9 | 53,9 | 11,13 |
| 3600-4200 (incomplète) | 0,00 | — | — | 1952,7 | — | — | — |

La p95 monte de 183 à 572 ms sur l'heure, et `memory.current` de 943 à 1279 Mo, avant toute expiration du
palier long. Cette montée n'est pas expliquée (§ 7). a2c, qui change à la fois le tas et le limiteur, sert de
témoin, sans pouvoir séparer les deux causes.

**Diagnostic du limiteur** (règles figées, § « Diagnostic » du protocole) :

- **D1 vrai** : à 3494 s, 560 596 minuteries du palier long pour 280 394 requêtes achevées (seuil
  0,9 × 2 × 280 394 = 504 709). Autres paliers au même relevé : `short` 160, `medium` 9582, `payment_callback`
  9582. 32 768 clés dans `_storage` ;
- **D2 faux tel que défini** : Node est mort avant la fenêtre [3700, 5400] et le dernier relevé de la sonde
  (3584,8 s) précède 3600 s. La sonde tourne dans la boucle de Node, qui s'est bloquée : elle ne pouvait pas
  observer ce mode de défaillance. L'échantillonneur, hors processus, relève le RSS de Node à 1334 Mo à 3589 s,
  1360 Mo à 3590 s, puis 2028 Mo à 3601 s. Les requêtes achevées se figent à 287 903, puis 287 905.

D'où l'amendement 2 : le défaut est établi en isolement.

### 6.3 Limiteur : test isolé et correction

`bench/throttler-expiry-repro.js` charge le `ThrottlerStorageService` du paquet testé, sans réseau. Il remplit
le palier long de 576 000 coups sur 8192 clés, échelonnés pour expirer à 160/s. Il envoie ensuite 160 nouveaux
coups par seconde (80 req/s × 2 contextes de garde) et relève chaque seconde l'écart entre relevés, le retard
de boucle, le RSS et le tas. Critère d'acceptation (`tools.py limiter-accept`), fixé avant toute mesure de
6.7.1, pour le tas par défaut et pour 4096 :

- aucun écart au-delà de 2000 ms entre relevés ;
- au moins 90 % des nouveaux coups prévus traités ;
- 60 s observées après le début des expirations ;
- remplissage complet, et version mesurée égale à la version installée.

| Version, tas | Écart max entre relevés | Coups traités / prévus | Retard de boucle max | RSS max | Tas utilisé max | Verdict |
|---|---|---|---|---|---|---|
| 6.5.0, défaut (1,17 Go) | 101 060 ms | 3200 / 27 272 | 1411 ms | 693,9 Mo | 562,8 Mo | refusé |
| 6.5.0, 4096 | 103 285 ms | 3196 / 27 791 | 2634 ms | 1216,7 Mo | 1077,8 Mo | refusé |
| 6.7.1, défaut | 1001 ms | 12 720 / 12 801 | 15,2 ms | 138,8 Mo | 42,3 Mo | accepté |
| 6.7.1, 4096 | 1002 ms | 12 704 / 12 803 | 12,8 ms | 138,7 Mo | 42,6 Mo | accepté |

Les essais 6.5.0 couvrent environ 170 s, dont 60 s au moins après le début des expirations ; les essais 6.7.1
en couvrent 80 s. Dans les deux versions, 576 156 coups vivants sont relevés au début des expirations.

Mécanisme, lu dans `node_modules` :

- **6.5.0** : une minuterie `setTimeout` par coup et par palier. À chaque expiration, la liste des minuteries
  du palier, toutes clés confondues, est recopiée par `filter`, soit un coût O(N) par expiration. Un déblocage
  efface aussi les expirations des autres clés du même palier (`clearExpirationTimes(throttlerName)`) ;
- **6.7.1** : expirations gardées par clé et par palier, élaguées à chaque coup de cette clé. Les
  enregistrements expirés, non bloqués et sans coup vivant sont purgés toutes les 60 s par une minuterie
  `unref`. Aucune minuterie par coup. Sans `blockDuration`, il vaut `ttl`, et une clé garde au plus environ
  `limit` + 1 coups.

**Correction** : commit `c6ecea9d9`, `@nestjs/throttler` ^6.7.1 (`backend/package.json` et les entrées du
limiteur dans `package-lock.json`). Installation lancée par l'utilisateur : la garde du dépôt bloque la
commande d'installation dans une session d'agent. Aucun code modifié, aucun fichier de `payments/` ni de
configuration des paliers. `backend/dist` est inchangé (`f2c349e3…`) : le limiteur est résolu dans
`node_modules`. Pour la configuration actuelle, des limites et durées numériques sans `blockDuration`, le
calcul, la clé et les en-têtes sont inchangés. `CloudflareThrottlerGuard` surcharge toujours `getTracker` :
la normalisation IPv6 ajoutée par défaut après 6.5.0 ne s'applique donc pas. `engines` de 6.7.1 (node >= 24)
est compatible avec `.nvmrc` et l'image `node:24-alpine`. Tests au § 9.

Le garde global s'applique à toutes les routes, y compris les callbacks de paiement. La mise à jour change le
stockage du limiteur pour tout le site, pas seulement pour cette route.

### 6.4 Paire a2c / r2

Ordre fixe, jamais simultané : a2c de 21:31 à 23:01, r2 de 23:11 à 00:41. Les `versions.txt` des deux passes
relèvent les mêmes binaires (`vehicle-models-route` `16a5a8a6…`, `loadgen` `9401f702…`, `replay` `bac423c0…`),
le même `backend/dist` (`f2c349e3…`), le même limiteur 6.7.1 (`05777176…`), Node v24.21.0 au plafond de tas
par défaut, Caddy 2.11.7, Redis 7.0.15 et les mêmes données rejouées. a2c tourne sur `c6ecea9d9`, r2 sur
`2a242e490`. Entre les deux, seuls `PROTOCOL-v4.md` et `tools.py` changent (amendement 3) : les cibles n'en
exécutent aucun.

**Issues : complète et complète.** Aucun défaut du banc dans la paire, donc aucune reprise :

- trous maximaux : 1,0 s pour l'échantillonneur, 10,1 s pour le générateur, 10,0 s pour la sonde ;
- retard du générateur : 1,98 et 2,01 ms au p99 ;
- CPU des voisins : 2,27 % et 4,49 % (seuil 10 %) ;
- destination : 432 800 lignes Caddy vers l'amont attendu (`127.0.0.1:3140` pour a2c, `127.0.0.1:3150` pour
  r2), `route_wrong` vide ;
- rejeu : 2 115 920 lectures, 0 manquante, 0 en-tête différent ;
- cgroup : 542 relevés par passe, sans composant non déclaré.

| | a2c-L20-1 (Node seul) | r2-L20-1 (Node et R2) |
|---|---|---|
| prévues = émises = achevées ; abandonnées ; inachevées | 432 000 ; 0 ; 0 | 432 000 ; 0 ; 0 |
| statuts | 432 000 × 200 | 432 000 × 200 |
| p50 / p95 / p99 / max (ms, depuis l'heure prévue) | 144,6 / 182,6 / 256,9 / 407,0 | 135,9 / 153,3 / 160,6 / 291,1 |
| requêtes en vol, au plus | 31 | 20 |
| CPU ms/req OK : cgroup + Caddy + Redis ; cgroup seul (régime) | 9,956 ; 8,477 | 7,847 ; 6,316 |
| dont Node ; R2 ; Caddy ; Redis | 8,449 ; — ; 1,349 ; 0,130 | 0,114 ; 6,203 ; 1,391 ; 0,140 |
| `memory.current`, médiane à partir de 3600 s ; `memory.peak` | 692,1 Mo ; 701,6 Mo | 352,2 Mo ; 420,9 Mo |
| pente de `memory.current` sur les 1800 s finales | +0,08 Mo/min | −0,05 Mo/min |
| `memory.stat` en fin de charge : `anon` ; `file` ; `kernel` | 637,0 ; 38,6 ; 18,8 Mo | 340,2 ; 0,15 ; 9,5 Mo |
| `memory.events` et `memory.events.local` | tous à 0 | tous à 0 |
| RSS en fin de charge, publié à part : Node ; R2 ; Caddy ; Redis | 692,3 ; — ; 58,6 ; 14,9 Mo | 364,8 ; 41,8 ; 58,0 ; 15,0 Mo |
| Node : GC (ms/s, régime) ; tas utilisé au dernier relevé | 43,1 ; 258,4 Mo | 0,14 ; 205,7 Mo |

Dans r2, Node reste dans le cgroup et tourne comme dans a2c, mais la route ne l'atteint plus. Son RSS passe de
439 Mo au repos à 365 Mo en fin de charge. Dans a2c, il passe de 395 à 692 Mo. Le pic de r2 (420,9 Mo) est
atteint dans la première fenêtre, au niveau d'avant la charge (413,5 Mo).

Fenêtres de 10 min (médianes des relevés de la fenêtre ; régime à partir de 600 s) :

| Fenêtre (s) | CPU ms/req OK a2c | r2 | `memory.current` a2c (Mo) | r2 | p95 a2c (ms) | r2 | p99 a2c (ms) | r2 |
|---|---|---|---|---|---|---|---|---|
| 0-600 | 10,268 | 7,955 | 664,0 | 323,7 | 184,4 | 152,4 | 250,1 | 159,4 |
| 600-1200 | 10,020 | 7,780 | 668,0 | 333,2 | 182,6 | 153,3 | 249,4 | 160,7 |
| 1200-1800 | 9,944 | 7,823 | 673,7 | 344,3 | 184,8 | 153,5 | 253,6 | 160,5 |
| 1800-2400 | 10,062 | 7,970 | 676,7 | 345,7 | 181,0 | 153,2 | 252,5 | 159,9 |
| 2400-3000 | 9,924 | 7,840 | 679,6 | 347,8 | 182,0 | 153,0 | 253,9 | 159,6 |
| 3000-3600 | 9,929 | 7,843 | 689,6 | 350,3 | 183,3 | 153,0 | 251,8 | 159,8 |
| 3600-4200 | 9,915 | 7,750 | 691,4 | 352,9 | 184,3 | 153,7 | 255,9 | 160,7 |
| 4200-4800 | 10,049 | 7,990 | 692,4 | 352,0 | 181,7 | 153,2 | 244,7 | 159,9 |
| 4800-5400 | 9,908 | 7,861 | 693,9 | 352,0 | 182,4 | 153,1 | 248,8 | 160,0 |

Les fenêtres du régime sont disjointes pour les quatre indicateurs. Aucune ne recouvre l'autre passe :

- CPU : de 9,908 à 10,062 pour a2c, de 7,750 à 7,990 pour r2 ;
- `memory.current` : de 668,0 à 693,9 Mo pour a2c, de 333,2 à 352,9 Mo pour r2 ;
- p95 : de 181,0 à 184,8 ms pour a2c, de 153,0 à 153,7 ms pour r2 ;
- p99 : de 244,7 à 255,9 ms pour a2c, de 159,6 à 160,7 ms pour r2.

Décision par indicateur (`summary4`, `campaign-v4/summary4.txt`) :

| Indicateur | a2c | r2 | r2 / a2c | Verdict |
|---|---|---|---|---|
| `memory.current` (médiane ≥ 3600 s) | 692,1 Mo | 352,2 Mo | 0,509 | r2 inférieur, fenêtres disjointes |
| `memory.peak` | 701,6 Mo | 420,9 Mo | 0,600 | r2 inférieur |
| CPU ms/req OK | 9,956 | 7,847 | 0,788 | r2 inférieur, fenêtres disjointes |
| p95 | 182,6 ms | 153,3 ms | 0,839 | r2 inférieur, fenêtres disjointes |
| p99 | 256,9 ms | 160,6 ms | 0,625 | r2 inférieur, fenêtres disjointes |

Deux écarts de mesure jouent contre a2c (§ 8). Ils sont publiés tels quels, non retranchés :

- le `sleep 1` du shell témoin, compté dans le cgroup d'a2c seulement, pèse 0,028 ms/req OK. Sans lui, le
  rapport CPU vaudrait 0,790 ;
- 38,6 Mo de pages de fichiers sont présents dans le cgroup d'a2c dès avant la charge. En mémoire anonyme
  seule, on a 637,0 Mo contre 340,2 Mo.

Aucun ne change un verdict.

### 6.5 Décision

Conclusions de `summary4`, dans l'ordre figé du protocole :

1. défaut du banc après la reprise : aucun défaut, aucune reprise ;
2. amont erroné, défaillance de r2, erreurs propres à r2 : aucun. Les 432 800 lignes de la route vont à R2,
   avec 0 erreur ;
3. pente de r2 : −0,05 Mo/min sur les 1800 s finales, sous le seuil de 1,0 ;
4. référence défaillante : non, a2c est complète ;
5. erreurs dans les deux passes ou indicateur inconclusif : non ;
6. mémoire courante et pic « r2 inférieur », et aucun indicateur « r2 supérieur » : **R2 validé et bénéfice
   démontré**.

Le bénéfice porte sur les binaires mesurés, `vehicle-models-route` `16a5a8a6…` et `backend/dist`
`f2c349e3…`. Il vaut pour cette route et son périmètre (GET et HEAD avec une année), à 80 req/s, sur la
fenêtre observée de 90 min, avec les données et la latence amont du banc. La référence est Node v24.21.0 avec
`@nestjs/throttler` 6.7.1, lancé comme l'image. Les rapports r2/a2c sont de 0,509 pour la mémoire courante des
cibles, 0,600 pour le pic, 0,788 pour le CPU par réponse, 0,839 pour la p95 et 0,625 pour la p99. Ils sont
mesurés sur une seule paire (§ 6.6).

La conclusion est subordonnée au contrat final rejoué sur ces binaires (§ 2.1). Ces binaires tiennent le
limiteur dans la mémoire de chaque processus : en sélection rust, une adresse y dispose de deux budgets
(§ 2.3). Ils ne sont donc pas activables hors du banc. La version corrigée (§ 2.4) est mesurée par une autre
paire (§ 6.7), et les rapports ci-dessus ne lui sont pas attribués. La conclusion ne prouve pas la correction
du crash initial de la production, et elle ne vaut pas décision de réécrire l'application en Rust.

La passe diag est rapportée à part. Son OOM, attribué au palier long de 6.5.0 (§ 7), ne fait pas disparaître
la comparaison : la référence est a2c, avec le défaut corrigé.

### 6.6 Limites

- Une seule paire par version mesurée : pas de dispersion entre passes ; les fenêtres de 10 min en tiennent
  lieu. La seconde paire mesure un autre binaire, pas la dispersion de la première.
- Ordre fixe, a2c puis r2 : un effet d'ordre reste possible. Le seul relevé est le cache de pages compté dans
  a2c (§ 8).
- VM partagée : voisins mesurés, non éliminés. HTTP sans TLS entre générateur et Caddy.
- Node du banc limité à la route et à ses tâches : son niveau de base n'est pas celui de la production. Rust à
  1 fil de travail. Données rejouées, latence amont constante, Redis du banc vidé à chaque passe.
- Toute la charge porte une année : le cache LRU de Node est inactif, et R2 n'a pas de cache (§ 2.3).
- 80 req/s est un débit soutenable par Node, pas sa capacité maximale. Les conclusions valent pour ce débit et
  pour la fenêtre observée de 90 min.

### 6.7 Paire de la version corrigée (amendement 4)

Ordre fixe, jamais simultané : a2c de 03:17 à 04:47, r2 de 04:48 à 06:18 (premier et dernier relevé). La
compression des journaux d'a2c s'achève à 04:47:56, avant le lancement de r2 à 04:48:02. Les `versions.txt`
des deux passes relèvent le commit `fdf82d84a`, arbre suivi propre, les binaires `vehicle-models-route`
`b6d5bcd3…`, `loadgen` `9401f702…` et `replay` `bac423c0…`, le `backend/dist` `2fcdbf66…`, le limiteur 6.7.1
(`05777176…`), Node v24.21.0 au plafond de tas par défaut, Caddy 2.11.7 et Redis 7.0.15. Par rapport à la
première paire, seuls changent les deux binaires des cibles, `PROTOCOL-v4.md` (amendement 4) et `contract.py`
(attendu de l'étape budget, non exécuté pendant une passe). `route.sh`, `tools.py`, `memprobe.cjs`,
`Caddyfile.route`, chemins, en-têtes et données rejouées ont la même empreinte. Charge au départ : 0,04 pour
a2c ; 1,59 pour r2, relevée une minute après la fin d'a2c. Le relevé de 60 s d'avant passe manque (§ 6.1).

**Issues : complète et complète.** Aucun défaut du banc dans la paire, donc aucune reprise :

- trous maximaux : 1,0 s pour l'échantillonneur, 10,1 s pour le générateur, 10,0 s pour la sonde ;
- retard du générateur : 2,01 et 1,88 ms au p99 ;
- CPU des voisins : 2,50 % et 2,57 % (seuil 10 %) ; au plus 3,65 % et 2,84 % sur une fenêtre de 10 min ;
- destination : 432 800 lignes Caddy vers l'amont attendu, toutes en 200, `route_wrong` vide ;
- rejeu : 2 115 920 lectures, 0 manquante, 0 en-tête différent ;
- cgroup : 542 relevés par passe, sans composant non déclaré. Redis est hors du cgroup, comme dans la première
  paire.

| | a2c-L20-1 (Node seul) | r2-L20-1 (Node et R2) |
|---|---|---|
| prévues = émises = achevées ; abandonnées ; inachevées | 432 000 ; 0 ; 0 | 432 000 ; 0 ; 0 |
| statuts | 432 000 × 200 | 432 000 × 200 |
| p50 / p95 / p99 / max (ms, depuis l'heure prévue) | 144,4 / 171,2 / 224,1 / 376,3 | 136,1 / 152,6 / 159,6 / 187,4 |
| requêtes en vol, au plus | 26 | 15 |
| CPU ms/req OK : cgroup + Caddy + Redis ; cgroup seul (régime) | 10,756 ; 8,281 | 8,147 ; 6,199 |
| dont Node ; R2 ; Caddy ; Redis | 8,252 ; — ; 1,365 ; 1,110 | 0,114 ; 6,085 ; 1,405 ; 0,543 |
| `memory.current`, médiane à partir de 3600 s ; `memory.peak` | 602,2 Mo ; 604,3 Mo | 310,7 Mo ; 388,1 Mo |
| pente de `memory.current` sur les 1800 s finales | +0,02 Mo/min | +0,07 Mo/min |
| `memory.stat` en fin de charge : `anon` ; `file` ; `kernel` | 586,9 ; 0,05 ; 15,7 Mo | 301,7 ; 0,02 ; 9,5 Mo |
| `memory.events` et `memory.events.local` | tous à 0 | tous à 0 |
| RSS en fin de charge, publié à part : Node ; R2 ; Caddy ; Redis | 644,0 ; — ; 59,0 ; 36,4 Mo | 338,2 ; 27,3 ; 57,9 ; 36,3 Mo |
| Node : GC (ms/s, régime) ; tas utilisé au dernier relevé | 28,6 ; 357,6 Mo | 0,11 ; 230,1 Mo |
| Redis, rapporté à part : RSS médian à partir de 3600 s ; `used_memory` ; `dbsize` en fin de charge | 36,4 Mo ; 22,9 Mo ; 56 548 | 36,3 Mo ; 22,9 Mo ; 56 171 |

Dans r2, le RSS de Node passe de 412 Mo au repos à 338 Mo en fin de charge ; dans a2c, de 428 à 644 Mo. Le pic
de r2 (388,1 Mo) est atteint à 60 s ; `memory.current` passe ensuite sous 300 Mo dans la première fenêtre. Le
cgroup était à 366,7 Mo avant la charge.

Fenêtres de 10 min (médianes des relevés de la fenêtre ; régime à partir de 600 s) :

| Fenêtre (s) | CPU ms/req OK a2c | r2 | `memory.current` a2c (Mo) | r2 | p95 a2c (ms) | r2 | p99 a2c (ms) | r2 |
|---|---|---|---|---|---|---|---|---|
| 0-600 | 10,933 | 8,293 | 589,0 | 291,8 | 170,4 | 152,6 | 216,4 | 159,7 |
| 600-1200 | 10,774 | 8,102 | 592,1 | 296,9 | 171,8 | 152,5 | 219,3 | 159,4 |
| 1200-1800 | 10,679 | 8,117 | 599,7 | 304,3 | 169,9 | 152,5 | 219,9 | 159,3 |
| 1800-2400 | 10,929 | 8,268 | 600,1 | 309,0 | 171,2 | 152,1 | 213,0 | 158,5 |
| 2400-3000 | 10,754 | 8,080 | 600,8 | 309,3 | 170,5 | 152,4 | 226,4 | 158,7 |
| 3000-3600 | 10,717 | 8,161 | 601,3 | 309,6 | 171,6 | 152,6 | 215,7 | 159,9 |
| 3600-4200 | 10,701 | 8,135 | 601,9 | 309,7 | 171,6 | 152,6 | 216,1 | 158,9 |
| 4200-4800 | 10,904 | 8,271 | 602,2 | 310,7 | 170,4 | 152,6 | 220,7 | 159,5 |
| 4800-5400 | 10,703 | 8,128 | 602,3 | 311,0 | 170,5 | 152,6 | 221,3 | 159,7 |

Les fenêtres du régime sont disjointes pour les quatre indicateurs :

- CPU : de 10,679 à 10,929 pour a2c, de 8,080 à 8,271 pour r2 ;
- `memory.current` : de 592,1 à 602,3 Mo pour a2c, de 296,9 à 311,0 Mo pour r2 ;
- p95 : de 169,9 à 171,8 ms pour a2c, de 152,1 à 152,6 ms pour r2 ;
- p99 : de 213,0 à 226,4 ms pour a2c, de 158,5 à 159,9 ms pour r2.

Décision par indicateur (`summary4`, `campaign-v4-limiter/summary4.txt`) :

| Indicateur | a2c | r2 | r2 / a2c | Verdict |
|---|---|---|---|---|
| `memory.current` (médiane ≥ 3600 s) | 602,2 Mo | 310,7 Mo | 0,516 | r2 inférieur, fenêtres disjointes |
| `memory.peak` | 604,3 Mo | 388,1 Mo | 0,642 | r2 inférieur |
| CPU ms/req OK | 10,756 | 8,147 | 0,757 | r2 inférieur, fenêtres disjointes |
| p95 | 171,2 ms | 152,6 ms | 0,891 | r2 inférieur, fenêtres disjointes |
| p99 | 224,1 ms | 159,6 ms | 0,712 | r2 inférieur, fenêtres disjointes |

Conclusions dans l'ordre figé : aucun défaut du banc ; aucun amont erroné, aucune défaillance de r2, aucune
erreur propre à r2 ; pente de r2 de +0,07 Mo/min, sous le seuil de 1,0 ; référence complète ; aucun indicateur
inconclusif ni « r2 supérieur ». `summary4` conclut : « R2 validé et bénéfice démontré (route, périmètre, débit
et fenêtre de cette campagne) », sous réserve du contrat final, rejoué sur ces binaires : 185/185 (§ 2.1).

Cette conclusion vaut pour `vehicle-models-route` `b6d5bcd3…` et `backend/dist` `2fcdbf66…`, avec les mêmes
bornes qu'au § 6.5 : cette route et son périmètre, 80 req/s, 90 min, données et latence amont du banc, une seule
paire (§ 6.6). Elle ne reprend aucun rapport de la première paire.

**Coût du correctif.** Le correctif ajoute un appel Redis à chaque requête soumise au limiteur, garde les
compteurs dans Redis jusqu'à 1 h et ouvre une connexion Redis de plus par processus (§ 6.1). Les trois points
sont lus dans les deux paires. `compare4` est appliqué entre chaque passe de la première paire et la passe de
même nom de la seconde, avec les mêmes seuils et les mêmes fenêtres (`campaign-v4-limiter/compare-pairs.txt`,
script `compare-pairs.py`) :

| Indicateur | a2c : première paire | corrigée | corrigée / première | verdict | r2 : première paire | corrigée | corrigée / première | verdict |
|---|---|---|---|---|---|---|---|---|
| `memory.current` | 692,1 Mo | 602,2 Mo | 0,870 | corrigée inférieure, fenêtres disjointes | 352,2 Mo | 310,7 Mo | 0,882 | corrigée inférieure, fenêtres disjointes |
| `memory.peak` | 701,6 Mo | 604,3 Mo | 0,861 | corrigée inférieure | 420,9 Mo | 388,1 Mo | 0,922 | pas de différence démontrée |
| CPU ms/req OK | 9,956 | 10,756 | 1,080 | pas de différence démontrée | 7,847 | 8,147 | 1,038 | pas de différence démontrée |
| p95 | 182,6 ms | 171,2 ms | 0,938 | pas de différence démontrée | 153,3 ms | 152,6 ms | 0,996 | pas de différence démontrée |
| p99 | 256,9 ms | 224,1 ms | 0,872 | corrigée inférieure, fenêtres disjointes | 160,6 ms | 159,6 ms | 0,994 | pas de différence démontrée |

- **CPU.** Le CPU par réponse croît de 0,800 ms pour a2c et de 0,300 ms pour r2, sous l'écart minimal du
  protocole (10 %). La hausse est dans Redis : de 0,130 à 1,110 ms pour a2c (8 `EVALSHA` par requête), de 0,140 à
  0,543 ms pour r2 (un seul). Node baisse dans a2c (8,449 puis 8,252), R2 dans r2 (6,203 puis 6,085), et Caddy
  ne varie pas (1,349 puis 1,365 ; 1,391 puis 1,405). Redis est stable par fenêtre : de 1,097 à 1,146 ms pour
  a2c, de 0,533 à 0,557 ms pour r2.
- **Latences.** Aucune hausse. La p99 d'a2c est plus basse dans la version corrigée, fenêtres disjointes. Les
  autres écarts ne sont pas démontrés.
- **Rétention mémoire.** Les compteurs sont dans Redis : `dbsize` de 297 à 56 548 pour a2c et de 296 à 56 171
  pour r2 ; `used_memory` en fin de charge de 2,5 à 22,9 Mo, et de 3,0 à 22,9 Mo. La répartition des clés par
  préfixe n'a pas été relevée. Le RSS de Redis croît pendant la première heure, puis reste plat jusqu'à la fin
  dans les deux passes : 31,9 Mo à 600 s, 36,4 Mo à 3600 s et 36,4 ou 36,3 Mo à 5400 s. Dans la première paire,
  il était plat à 14,9 Mo. Le plateau commence vers 3600 s, l'échéance du palier long ; il n'est observé que
  sur 90 min. Redis est hors du cgroup : ses 21,5 et 21,3 Mo de plus ne sont pas comptés dans
  `memory.current`. Même
  ajoutés, ils ne renversent aucun sens. La somme des médianes vaut 638,6 Mo contre 707,0 Mo pour a2c, et
  347,0 Mo contre 367,2 Mo pour r2. Dans le Node d'a2c, la sonde ne relève aucun appel du stockage en mémoire
  de la bibliothèque, qui sert de repli (`throttler: null`), contre 26 322 clés dans l'a2c de la première paire.
  Aucune entrée en repli n'est journalisée par A2 ni par R2 dans les deux passes.
- **Connexions.** Le banc ne relève pas le nombre de clients de Redis (`redis-end.txt` = `dbsize` et
  `info memory`). Les sockets de Node, toutes sortes confondues, restent bornées : de 48 à 100 dans a2c (de 55 à
  105 dans la première paire), de 51 à 58 dans r2 (de 50 à 57). La connexion supplémentaire de chaque processus
  et son comportement en panne sont vérifiés par les tests et le contrat (§ 2.3, § 2.4, § 9), pas par cette
  paire.

Les écarts entre paires sont observés entre passes séparées de quelques heures, sur une VM partagée. Les
voisins sont relevés : 2,27 % puis 2,50 % pour a2c, 4,49 % puis 2,57 % pour r2. Ces écarts ne sont pas
attribués au seul correctif. En particulier, la baisse de la mémoire de Node dans a2c (`anon` de 637,0 à
586,9 Mo, GC de 43,1 à 28,6 ms/s) coïncide avec l'arrêt des tables du limiteur en mémoire. C'est une
hypothèse, sans profil du tas qui la démontre. La première a2c comptait aussi 38,6 Mo de pages de fichiers
(§ 8), absentes ici.

## 7. Attribution de l'OOM de la passe diag

**Observé** (instantanés, sonde, échantillonneur ; `runs/a2-L20-diag/`) :

- **Composants.** Les 363 relevés de `cgroup.procs` ne contiennent que le shell témoin `route.sh _targets a2`,
  son `sleep 1` et `node dist/main`. Aucun processus étranger.
- **Événements.** Avant la charge, tout est à 0. À la fin, `memory.events` et `memory.events.local` sont égaux :
  `max` 33, `oom` 1, `oom_kill` 1, `oom_group_kill` 0. L'OOM a donc eu lieu dans le cgroup des cibles lui-même.
  Node a disparu, le shell témoin a survécu : seul Node a été tué.
- **Mémoire.** `memory.peak` vaut 2 147 483 648 octets, soit `memory.max`. Avant la charge : `memory.current`
  388 485 120, dont 376 184 832 anonymes. Au dernier relevé avant le kill : `anon` 2 004 602 880, `file`
  94 208, `kernel` 42 074 112, dont `pagetables` 39 055 360. Après la mort de Node : 1,1 Mo, celle du shell
  témoin.
- **RSS par processus** (publié à part, jamais additionné au cgroup) : Node 416,4 Mo au repos, 1998,5 Mo au
  dernier relevé. Caddy et Redis tournent hors du cgroup : 60,9 Mo et 14,9 Mo.
- **Sonde de Node**, dans le processus :

  | Relevé | RSS | tas utilisé | tas total | mémoire externe | minuteries du palier long |
  |---|---|---|---|---|---|
  | −8,4 s | 478,2 Mo | 284,8 Mo | 343,5 Mo | 13,3 Mo | — |
  | 3494,3 s | 1380,2 Mo | 853,9 Mo | 1068,9 Mo | 39,8 Mo | 560 596 |
  | 3584,8 s (dernier) | 1398,8 Mo | 799,9 Mo | 1130,7 Mo | 27,1 Mo | 574 996 |

  Sockets ouverts : 89, 107, puis 100. Retard de boucle maximal de 514,6 ms dans l'intervalle du relevé de
  3494 s.
- **Fin.** Le relevé suivant de la sonde (vers 3595 s) manque. Hors processus, le RSS de Node passe de
  1360 Mo à 3590 s à 2028 Mo à 3601 s, et les réponses achevées se figent.

**Démontré :**

- l'OOM est celui du cgroup des cibles : il tue Node, seul gros processus admis. Ce n'est ni le système ni un
  voisin ;
- la mémoire comptée au kill est la mémoire anonyme de Node : le cache de pages est presque nul (`file`
  94 208 octets), puisque les journaux sortent par des FIFO. En v3, la part du cache de pages était inconnue
  (527 Mo de `a2.log` écrits depuis le cgroup) ;
- le palier long de 6.5.0 garde environ deux minuteries par requête pendant une heure (D1) ;
- en isolement, les expirations de ce palier, à ce volume et à ce débit, bloquent la boucle de Node et font
  croître sa mémoire, pour les deux plafonds de tas. 6.7.1 ne le fait pas (§ 6.3) ;
- l'arrêt de la passe diag commence quand les premières expirations du palier long tombent, 3600 s après les
  premiers coups.

**Hypothèses, non démontrées :**

- les quelque 630 Mo pris entre 3590 et 3601 s seraient les copies de la liste du palier long, que le
  ramassage n'a pas libérées avant la limite du cgroup, avec un tas plafonné à 4 Go sous 2 Gio. Estimation :
  575 000 références de 8 octets, soit environ 4,6 Mo par copie, et environ 160 expirations par seconde, soit
  de l'ordre de 0,7 Go/s de déchets. Cette période n'est pas observée dans le processus : la sonde y était
  bloquée ;
- environ 1 Ko de tas par coup retenu : (854 − 285) Mo / 560 596, estimé sur deux relevés qui incluent toute
  autre croissance ;
- la montée de la p95 et de `memory.current` avant 3600 s (§ 6.2) n'est pas expliquée. Les minuteries du
  palier long en sont une cause possible, non vérifiée. a2c, qui change à la fois le tas et le limiteur, reste
  stable (§ 6.4) : cela n'attribue la montée à aucun des deux.

**Non établi :** le détail noyau du kill (`dmesg`, `journalctl -k` refusés, § 11). Les protections système
n'ont pas été modifiées. Rien dans cette passe ne relie cet OOM au crash initial de la production : le banc ne
sert que la route, avec un tas fixé comme en v3, différent de l'image.

## 8. Écarts au protocole et défauts du banc

Campagne v4 :

- **Première capture du contrat v4 invalide** (`contract-v4/` à la racine, 18:38-18:41). Elle a été jouée sur
  le mauvais corpus (`paths-contract.txt`, 157 cas, au lieu des 185 cas v3) et sans `CONTRACT_LOG`. Elle est
  gardée telle quelle, non utilisée, et remplacée par `contract-v4/c185/`.
- **Préchauffage de Node dans le contrat.** `c185` donne 183/185. Les deux écarts, `p001` en sélection node et
  `f-noyear-cleared` en sélection rust, sont des lectures de `CacheWarmingService` et de `HomepageRpcService`.
  Ces services démarrent 3 s après Node, et leurs lectures tombent dans la tranche du cas en cours : 4 lectures
  hors de la route et 1 écriture refusée. Ce n'est pas un écart de R2. Ce n'est pas non plus une raison de
  normaliser.
  Correction du banc : le rejeu final attend, après chaque `route.sh reset` et dans les deux sélections, la
  ligne de fin du préchauffage. Il filtre sur le contexte `CacheWarmingService`, parce que
  `InternalLinkingService` journalise un message voisin avant l'écoute. Les lignes trouvées sont dans
  `contract-v4/final/warm.txt`. Le rejeu final est la référence du contrat (§ 2.1).
- **D2 aveugle au blocage de la boucle** : la sonde tourne dans la boucle de Node (§ 6.2), d'où l'amendement 2.
- **Amendement 1 pendant la passe diag** : il change la référence (a2c), sans toucher la passe en cours.
- **a2c change deux variables** par rapport à la passe diag : le tas et le limiteur. La comparaison diag/a2c ne
  les sépare pas. Le test isolé, lui, sépare le limiteur, pour les deux tas.
- **Seuils de `tools.py`** écrits pendant la mise au point des outils, avant toute passe de 5400 s. Les chiffres
  du test d'arrêt `kill-test-v4/` ont été vus et sont exclus (protocole, « Écarts connus au gel »).
- **Relevé banc arrêté** des CPU 0 et 1 avant chaque passe : informatif, sans critère.
- **Témoin du cgroup asymétrique** (code figé `f638f15e8`, vu pendant la passe r2). `start_a2` lance Node dans
  un sous-shell : Node n'est pas un enfant du shell témoin, dont le `wait` revient aussitôt. Le témoin boucle
  alors sur `sleep 1` pendant toute la passe. `start_r2` lance R2 comme enfant direct : le `wait` bloque, et
  aucun `sleep` n'apparaît (541 relevés de `sleep 1` dans a2c, 0 dans r2). Le cgroup d'a2c compte donc un
  `sleep` par seconde, soit 0,028 ms/req OK : cgroup 8,477, Node 8,449. Dans r2, le cgroup (6,316) vaut
  exactement Node plus R2. Sans ce `sleep`, le CPU total d'a2c vaudrait 9,928, et le rapport r2/a2c 0,790 au
  lieu de 0,788. Le défaut n'a pas été corrigé au milieu de la paire, et les valeurs sont publiées telles que
  mesurées.
- **Pages de fichiers dans le cgroup d'a2c.** `memory.stat` compte 39,8 Mo de `file` avant la charge et 40,4 Mo
  à la fin. Avant leur charge, la passe diag en avait 12 Ko et r2 152 Ko. a2c est la première passe après la
  réinstallation de `node_modules` (`c6ecea9d9`). Explication probable, non vérifiée : des fichiers lus au
  démarrage de Node n'étaient pas dans le cache de pages, et ils sont comptés au cgroup qui les lit le premier.
  Ces pages sont incluses dans la médiane de 692,1 Mo. En mémoire anonyme seule, a2c a 637,0 Mo contre
  340,2 Mo pour r2. Aucun verdict ne change, et rien n'est retranché.
- **Amendement 3 entre a2c et r2** : il ne touche que le classement (§ 6.1). r2 ne contient aucun processus
  relevé pendant sa sortie : la règle ajoutée ne s'y est pas appliquée.
- **Voisins plus actifs pendant r2** : 4,49 % contre 2,27 % (seuil 10 %). La borne haute par fenêtre est de
  8,02 % contre 2,61 %. Si ce bruit a un effet, il joue contre r2.

Campagne v3 (inchangé) :

- **Échantillonneur v3** : `KeyError` sur `VmHWM` à la mort de Node, série RSS d'a2-L20-long perdue. Corrigé
  après le gel par `1a810f27a`.
- **r2-L20-long** lancée à part, relevé de versions complété après la passe.
- **Lacune du protocole v3** : il ne nomme pas le cas d'un suivi long a2 invalide. Le code figé le classe
  inconclusif. La v4 traite ce cas : un OOM d'A2 avec une collecte valide est un résultat.
- **Run 3 sans empreinte de binaire** : ses essais ne servent de preuve principale nulle part. Ils ont été
  rejoués sur des binaires relevés, aux runs 4 et 5 puis en v4.
- **Commit `ee2a248c2`** (`registry:heal`) : message fixe du script, sans ligne `Co-Authored-By`. Ce manque de
  forme ne change aucune preuve technique.

## 9. Tests

**Version mesurée par la première paire** (`16a5a8a6…`, `backend/dist` `f2c349e3…`) :

| Contrôle | Version | Résultat |
|---|---|---|
| `cargo fmt --check` ; `cargo clippy --locked --release --all-targets -- -D warnings` | arbre ensuite commité en `0b3d97eff` et `f638f15e8` | OK |
| `cargo test --locked --release` | même arbre | 50 tests unitaires et 9 tests de service, OK |
| `cargo test --locked --release` | `2a242e490` (HEAD), banc arrêté, 00:42 | 50 tests unitaires et 9 tests de service, OK ; aucune recompilation ; `vehicle-models-route` toujours `16a5a8a6…` |
| Jest backend ciblé : 8 suites du limiteur (garde Cloudflare, paliers, skip, beacon CWV…) | `c6ecea9d9` (6.7.1 installée) | 100/100 |
| typecheck backend | `c6ecea9d9` | code de sortie 0 |
| Jest backend, suite complète | `c6ecea9d9` | **non obtenue** |
| test isolé du limiteur (`limiter-accept`) | 6.7.1 | accepté (§ 6.3) ; 6.5.0 refusée |

La suite complète a été tuée deux fois par le plafond de 6 Go du scope, avec 2 fils puis 1 fil, sur un test
postérieur à `support-routes-authz`. La cause n'est pas attribuable au limiteur, mais rien ne prouve que la suite
complète est verte. `diag-canon.schema.test.ts` échoue sur l'export du dépôt wiki local, hors de ce dépôt.

Les tests Rust ont tourné à 18:27, puis fmt, clippy et la construction, sans édition entre ces étapes. Les
binaires reconstruits après les commits (18:36) sont identiques octet pour octet à ceux construits juste après
les tests : `vehicle-models-route` `16a5a8a6…`, `loadgen` `9401f702…`, `replay` `bac423c0…`. Cette identité ne
couvre pas le code compilé seulement en test. Aucun fichier Rust n'a changé après `f638f15e8`, jusqu'au
correctif du limiteur.

**Version corrigée** (`b6d5bcd3…`, `backend/dist` `2fcdbf66…`). Chaque ligne indique le contenu testé : l'heure de
la dernière modification des fichiers, celle du test et celle du commit. L'arbre suivi est propre à `fdf82d84a`,
et `350e09ba9` et `fdf82d84a` ne touchent que `bench/contract.py` et `PROTOCOL-v4.md`.

| Contrôle | Contenu testé | Résultat |
|---|---|---|
| `cargo fmt` (écriture), puis `cargo test --release -- --include-ignored`, avec un Redis 7.0.15 jetable sur un port éphémère, sans persistance | celui de `b646dd0a8` : fichiers Rust modifiés au plus tard à 02:08:31, tests à 02:09:05, commit à 02:09:48 | 57 tests unitaires et 9 tests de service, 66/66. Parmi eux : `concurrent_hits_from_two_processes_share_one_budget`, `shared_and_local_agree_on_real_redis` et `bounded_mode_bounds_lock_wait_behind_a_frozen_redis` |
| `cargo clippy --release --all-targets` | même contenu, 02:09:21 | 0 avertissement, 0 erreur ; lancé sans `-D warnings` |
| `cargo build --release --locked --bins --examples` | même contenu, 02:10:15 | code 0 ; `vehicle-models-route` `b6d5bcd3…`, `loadgen` `9401f702…` et `replay` `bac423c0…` inchangés |
| Jest ciblé, ioredis-mock : 4 suites du limiteur (`throttler-redis-storage.service`, `redis-single-target`, `throttler-skip.config`, `throttler-tiers.config`) | celui de `22cb0cc7a` : fichiers modifiés au plus tard à 01:52:55, tests à 01:54:31, commit à 01:55:04 | 63/64, 1 ignoré : « s'arrête après la première entrée bloquée ». Ce test est réservé au Redis réel : ioredis-mock rend cette liste de réponses en objet opaque |
| Jest, `throttler-redis-storage.service`, Redis 7.0.15 jetable sur un socket Unix | avant le formatage par prettier : tests à 01:52:30, fichiers réécrits à 01:52:55 | 13/13, dont le test ignoré ci-dessus et l'égalité octet à octet de `throttle.lua` avec la constante TypeScript |
| même suite, Redis réel, rejouée sur le contenu commité | `fdf82d84a`, arbre suivi propre, 2026-10-23 à 06:28 | 13/13, code 0, aucun ignoré ; mêmes 13 tests que l'essai précédent |
| ESLint sur les 4 fichiers TypeScript modifiés | celui de `22cb0cc7a`, 01:53:19 | code 0 |
| `tsc --noEmit -p tsconfig.json` (backend) | même contenu, 01:53:59 | code 0 |
| `npm run build` (backend) | après `b646dd0a8`, 02:10:53 | code 0 ; `backend/dist` `2fcdbf66…` |

Pendant la mise au point, sur des états non commités, sept exécutions ont échoué ou étaient incomplètes. Elles
sont gardées avec les preuves :

- Jest 1 : tas JavaScript épuisé au plafond par défaut de Node, avant le passage à 3 Go ;
- Jest 2 : 7 échecs sur 64, dont un appel Lua à une fonction absente de l'interpréteur d'ioredis-mock ;
- Jest 3 : 1 échec sur 13, la liste des réponses rendue en objet opaque par ioredis-mock, d'où la réserve du
  test au Redis réel ;
- Jest 4 : 10 échecs sur 13, une réponse du script lue `null` par ioredis-mock sur un état intermédiaire du
  script ;
- Jest 5 : 12/13 et 1 ignoré, sans le passage sur Redis réel ;
- ESLint 1 : tas épuisé (code 134) au plafond par défaut, repassé avec 4 Go ;
- `cargo test` 1 : 54 tests unitaires et 2 ignorés faute de Redis jetable, avant le dernier changement de
  `redis.rs` et l'ajout de `bounded_mode_bounds_lock_wait_behind_a_frozen_redis`.

La suite Jest complète n'a pas été tentée sur la version corrigée elle-même. Elle n'avait pas été obtenue sur
`c6ecea9d9` (plafond de 6 Go, ci-dessus). Elle l'a été ensuite sur la composition des trois livraisons (ci-dessous).

**Livraisons sur `main` `8c8b92007`** (2026-10-23). Preuves dans `reprise-20261022/integration-l123-20261023/`
du répertoire de preuves.

| Contrôle | Arbre | Résultat |
|---|---|---|
| `tsc --noEmit -p tsconfig.json` (backend) | L1, L2, L3 | code 0 sur chacun |
| Jest, suites du limiteur | L1 (6.7.1) | 7 suites, 83/83 ; même sélection sur `main` (6.5.0) : 83/83 |
| déblocage d'une clé, script isolé | 6.5.0 puis 6.7.1 | 6.5.0 refuse l'adresse dont la fenêtre est écoulée ; 6.7.1 l'admet |
| paquet 6.7.1 | verrou de L1 | intégrité identique dans le verrou, l'archive et le registre ; deux signatures du registre vérifiées ; provenance SLSA, workflow `release.yml` de `nestjs/throttler`. `npm audit signatures` inutilisable : il échoue sur `whatwg-url@17.1.1` |
| Jest, stockage partagé et callbacks de paiement, Redis 7.4.11 jetable sans réseau | L2 | 2 suites, 34/34 |
| même sélection, Redis réel exigé, sans socket | L2 | les 2 suites échouent, comme attendu |
| même sélection, ioredis-mock | L2 | 33 réussis, 1 ignoré (forme à plusieurs entrées, Redis réel seulement) |
| panne, redémarrage, éviction et refus d'écriture, `redis-server` jetables | L2 | 6/6 scénarios |
| étapes du job Rust par un exécuteur local : `fmt --check`, `clippy --all-targets -D warnings`, tests, build release, contrôle ELF et glibc | L3 (`05a16602d`), Redis 7.4.11 jetable | 71 tests listés, 71 réussis ; sans Redis, l'étape des tests échoue (101) ; un test ignoré ou filtré fait échouer l'inventaire |
| Jest `vehicle-models.service.order` | L3 | 3/3 |
| suite Jest complète, 6 shards | composition à blanc L1 + L2 + L3 (`85538687a`, sans les commits `.github`) | 357 fichiers prévus, 357 exécutés ; 5 871 tests : 5 837 réussis, 25 ignorés, 9 en échec |

Inventaire Rust : 57 tests de la bibliothèque (dont 2 sur Redis réel) et 9 de `tests/service.rs`, soit les 66 des
campagnes précédentes. `--all-targets` ajoute les 5 tests unitaires de `examples/replay.rs` : 71.

Suite Jest complète :

- chaque shard tourne dans un conteneur sans réseau, avec 5 Gio et un tas Node de 4 Gio, en bande comme la CI ;
  pic entre 4,68 et 4,93 Go, aucun arrêt pour manque de mémoire ;
- les 9 échecs viennent tous de `session-store`, qui démarre un Redis par Testcontainers sans démon Docker dans
  le conteneur. Rejouée seule sur l'hôte : 9/9 ;
- les 25 ignorés existent sur `main` : 23 dans `seo-control/rpcs`, 1 dans `diag-canon.schema`, 1 dans
  `throttler-redis-storage` ;
- couverture fusionnée : lignes 29,54 %, branches 23,62 %, fonctions 23,94 %, instructions 30,25 % (seuil du
  dépôt : 2 %). Aucun test désactivé, aucun seuil modifié ;
- deux corrections de l'instrument, aucune du code. Le shard 1 a été rejoué une fois : paquets internes sans
  `dist/`, puis tas de 3 Gio épuisé. `session-store` a été rejouée une fois : unité de la limite mémoire refusée
  par systemd, Jest non démarré.

**CI, trois états distincts :**

- *préparée* : job Redis de Backend Tests (`ci.yml`, L2) et workflow `vehicle-models-rs.yml` (L3). `.github/`
  est réservé à l'owner : ce sont des diffs owner, vérifiés par `git apply --check` sur les têtes ;
- *exécutée localement* : commandes de ces jobs rejouées. Redis jetable : démarrage, échec sans Redis, arrêt
  sans clé restante, échec si une clé reste. Job Rust : ligne ci-dessus ;
- *CI hébergée* : non exécutée. Rien n'est poussé ; aucun résultat n'est déclaré.

## 10. Fichiers, commits, intégration et retour arrière

**Commits locaux de la v4** (branche `feat/rust-vehicle-models-route-r2`, non poussée, chacun avec sa ligne
`Co-Authored-By`) :

| Commit | Objet | Fichiers |
|---|---|---|
| `0b3d97eff` | chemin sans année laissé à Node (cache LRU partagé) | `Caddyfile.route`, `contract.py`, `js_probe.rs`, `route/app.rs`, `http.rs`, `query.rs` |
| `f638f15e8` | instrumentation v4 (boucle ouverte, sonde Node, cgroup) | `memprobe.cjs`, `route.sh`, `tools.py`, `loadgen.rs` |
| `2149e3cf1` | PROTOCOL-v4 figé | `PROTOCOL-v4.md` |
| `4d6c7cbe5` | amendements 1 et 2 | `PROTOCOL-v4.md`, `route.sh`, `throttler-expiry-repro.js`, `tools.py` |
| `c6ecea9d9` | limiteur `@nestjs/throttler` 6.7.1 | `backend/package.json`, `package-lock.json` |
| `2a242e490` | amendement 3 : processus relevé pendant sa sortie, admis seulement par le nom noyau d'un composant déclaré | `PROTOCOL-v4.md`, `tools.py` |
| `22cb0cc7a` | stockage du limiteur partagé en Redis, côté Node (script atomique, repli en mémoire journalisé) | `backend/src/app.module.ts`, `config/throttler-redis-storage.service.ts` et son test, `config/redis-single-target.test.ts`, `services/vehicle-models-rs/src/route/throttle.lua` |
| `b646dd0a8` | même stockage côté R2, même script | `route/app.rs`, `route/guard.rs`, `route/redis.rs` |
| `350e09ba9` | étape budget du contrat : un seul budget attendu dans les deux sélections | `bench/contract.py` |
| `fdf82d84a` | amendement 4 : paire de la version corrigée | `PROTOCOL-v4.md` |
| commit de ce rapport, après `fdf82d84a` | rapport v4 et contrat de la route | `audit/rust-vehicle-models-route-r2-2026-10-22.md`, `services/vehicle-models-rs/docs/route-contract.md` |

Commits v3 : liste du § 9 de la version précédente de ce rapport, inchangée (`b879210e8` à `02474d3af`, puis
`ed2cb1cc7`). La référence de fin v3 est gardée par l'étiquette locale `r2-v3-ref-20261022` → `ed2cb1cc7`.

Deux étiquettes locales, sans préfixe `v` et non poussées, rattachent les résultats v4 à leur version :

- `r2-v4-mesure-16a5a8a6` → `2a242e490` : tête du contrat final de `16a5a8a6…` ;
- `r2-v4-corrige-b6d5bcd3` → commit de ce rapport, en fin de branche. Le binaire a été construit sur
  `b646dd0a8` et mesuré jusqu'à `fdf82d84a`. Les commits suivants ne touchent aucun fichier compilé.

Ces étiquettes conservent les références historiques avant toute réorganisation locale des commits.

**Intégration sur `main` `8c8b92007`** (rafraîchi le 2026-10-23). Elle remplace les simulations de la version
précédente de ce paragraphe, faites sur `747669961`. Rien n'est poussé, aucune PR n'est ouverte.

| Livraison | Branche locale | Tête avant composition owner | Base |
|---|---|---|---|
| L1, limiteur 6.7.1 | `fix/throttler-6.7.1-expirations` | `ef4ca3c89` | `main` `8c8b92007` |
| L2, stockage partagé | `fix/throttler-redis-shared-storage` | `00b8421d8` | L1 |
| L3, R2 inerte | `feat/vehicle-models-rs-route-r2-inert` | `8e57457ee` + commit de ce rapport | L2 |

- **L1** n'est pas « `c6ecea9d9` seul ». Elle reprend `c6ecea9d9` par cherry-pick (`backend/package.json` et
  verrou), puis ajoute un commit de commentaires alignés sur 6.7.1, les projections régénérées et la fiche
  `analytics.md`, périmée sur `main` depuis #1726. Ces ajouts ne changent aucun comportement.
- **L2 et L3** : les commits réservés à l'owner (`ownership.yaml`, `.github/`) sont insérés par
  `ci/owner-diffs/apply-owner-changes.sh` (répertoire de preuves). Ce script recompose les branches :
  - cherry-pick des commits testés ;
  - patch-ids comparés, puis arbres `backend/` et `services/vehicle-models-rs/` comparés aux arbres testés ;
  - projections régénérées par l'outillage du dépôt, dans un arbre jetable.
  `resync-pr.sh` n'a pas servi : il exige une PR et pousse.
- **Essai à blanc** (`--essai`, sans les deux étapes `.github`, dont seul `git apply --check` est exécuté) :
  sur `8e57457ee`, sortie 0 en 3 min 13 s (RSS max 849 Mo) ; patch-ids et arbres identiques aux arbres
  testés ; `--retour` en sortie 0, L1 inchangée. Rejoué après le commit de ce rapport : sortie consignée dans
  `ci/owner-diffs/` (répertoire de preuves).
- **Gardes** : block-new 415/415 fichiers nouveaux couverts, `registry:validate` 0 erreur. Les hooks étaient
  absents des worktrees lors des commits. Ils ont été rejoués ensuite étape par étape (413 fichiers indexés pour
  L3) : tous en sortie 0 ou sans objet ; commitlint en sortie 0.

**Callbacks de paiement.**

- Endpoints : `POST /api/paybox/callback` (`PayboxCallbackController`) et `POST /api/payments/callback/cyberplus`
  (`PaymentCallbackController`, SystemPay). Les deux portent `@Throttle({ payment_callback: { limit: 30, ttl:
  60000 } })`. `GET /api/paybox/callback` n'a pas de palier explicite. Chaîne : garde global
  `CloudflareThrottlerGuard` (traqueur `Cf-Connecting-Ip`), puis le contrôleur, qui vérifie la signature.
- Effets :
  - L1 change le stockage en mémoire du limiteur, callbacks compris ;
  - L2 place leur budget dans Redis, commun à tous les processus ;
  - L3 ne les touche pas.
  Aucun fichier de `payments/` n'est modifié. Un drapeau R2 éteint ne rend inerte ni L1 ni L2 : elles agissent
  dans Node.
- Source de l'accord requis : `CLAUDE.md`, invariant 9 (zone STOP « Paiement »), et `.claude/rules/payments.md`.
  Aucun accord existant ne couvre L1 ni L2.
- Tests sur fixtures (`payment-callback-throttling.test.ts`). Contrôleurs et validation Paybox réels, paire RSA
  générée pour le test, aucune transaction. Couverts :
  - signatures valides et invalides ;
  - répétition sans nouvelle écriture ;
  - 40 callbacks simultanés, dont exactement 15 admis ;
  - 31e callback en 429 avant le contrôleur ;
  - rejeu SystemPay admis 15 min plus tard ;
  - deux processus ;
  - redémarrage ;
  - panne puis retour de Redis.
  Résultat sur Redis réel : 34/34 avec la suite du stockage.
- Documentation officielle : SystemPay « Centre de notifications » v1.6 et « API Formulaire » v3.42 ; Paybox
  System V8.3.
  - Chez SystemPay, un 429 est un échec. Si le rejeu automatique est activé, SystemPay retente jusqu'à 4 fois,
    aux quarts d'heure fixes.
  - Paybox ne documente aucun rejeu automatique.
  - Inférence, que ces sources n'affirment pas : un 429 sur un callback Paybox peut être définitif.
  Le volume réel de notifications par minute et par adresse n'est pas connu. Extrait des sources :
  `payments/sources-officielles-paybox-systempay.txt`.

**Redis.**

- DEV :6379, en lecture seule, avec un délai de 3 s :
  - connexion TCP en IPv4 par le port publié : aucune réponse (SYN envoyé, délai atteint) ;
  - en IPv6 `::1` : PONG en 19 à 28 ms ; sur l'adresse du conteneur : PONG en 14 ms ;
  - le DEV partagé s'y connecte en IPv6 (53 connexions).
  Un port en écoute ne prouvait donc pas une réponse. Aucune cause n'est établie, ni aucun lien avec R2 ou avec
  un crash.
  Instance : 7.4.7, `maxmemory` 256 Mo, `noeviction`, AOF désactivé, 0 clé évincée.
  Connexion en clair acceptée sans mot de passe pour l'utilisateur `default`, TLS désactivé (`tls-port` 0) ; les
  54 clients connectés sont tous en `default`. L'URL du DEV partagé, dans un `.env`, n'a pas été lue.
- PREPROD et PROD : configuration servie non lue, faute d'accès autorisé. Configuration déclarée : `allkeys-lru`
  et AOF, 128 Mo en PREPROD, 512 Mo en PROD. Lectures console préparées dans `preprod/` :
  - `prod-redis-lecture-console.txt`, avant la fusion de L2 ;
  - `l2-lecture-console.txt`, après la chaîne PREPROD de L2.
- Mesuré sur Redis jetables :
  - redémarrage sans persistance : compteurs remis à zéro ;
  - `allkeys-lru` sous pression : clés du limiteur évincées, sans journal ;
  - `noeviction` saturé : écriture refusée, repli en mémoire journalisé ;
  - panne puis retour : repli, puis reconnexion en environ 200 ms.
  Le préfixe `throttler:` ne réserve aucune mémoire : les autres usages de l'instance peuvent la remplir.

**Candidat intégré** : binaire R2 `5daeb5f0…`, construit sur L3, et `backend/dist` `d58b2173…`. Campagne dans
`candidate/final/` :

- contrat de 185 cas : 184 identiques et 1 écart, `q-url-20k`. C'est une course de transport entre Caddy et un
  amont qui répond tôt puis ferme ; elle est hors R2 et n'est pas normalisée. Destination : 185/185 dans chaque
  sélection ;
- sondes 21/21 ; budget de 99 à 88 dans les deux sélections ;
- pannes : 17 étapes, 3 écarts sur les seuls journaux. Panne d'amont : 0 écart à l'attendu, aucun retour vers
  Node quand R2 est arrêté. `scope-r2` : 0 écart ;
- parcours : 9 par sélection, sans 421 vu par le navigateur. Ils ont servi le frontend de l'arbre de mesure, pas
  celui de L3 : 4 fichiers de code diffèrent, aucun ne lit l'API. Ils ont été rejoués sur celui de L3 pendant la
  répétition du retour arrière (ci-dessous).

**Packaging**, préparé hors des livraisons. Diffs owner `0003` (Dockerfile) et `0004` (compose, profil `r2`).

- Validation hors ligne.
- Répétition sur conteneurs jetables : 15 réussis, 0 échoué.
- Constat : après une recréation de Caddy, R2 reste déclaré sain mais injoignable (502) jusqu'à son redémarrage.
- Non exécutés : construction de l'image, qui exigerait un téléchargement, et exécution de l'image construite.
- R2 n'a été mesuré qu'avec la clé en lecture seule du banc, pas avec la clé de rôle service de Node.

**PREPROD**, après chaque fusion, une livraison à la fois :

1. Sur le run de `main` qui contient le commit de fusion : `🧪 Deploy PREPROD`, `🎭 E2E Smoke Tests` et
   `🔦 Lighthouse Performance Audit` en succès, plus `vehicle-models-rs` pour L3.
2. Après L2, lecture console `preprod/l2-lecture-console.txt` :
   - aucune ligne de repli de `RedisThrottlerStorage` ;
   - clés `throttler:*` présentes ;
   - configuration servie.
3. PREPROD n'a pas de Caddy en frontal et ne reçoit pas les callbacks. Ni la route R2 ni le budget des callbacks
   n'y sont exercés.

Une répétition locale n'est pas une validation PREPROD.

**Activation hors banc.** Aucune des trois livraisons ne la vaut. Ni CI hébergée, ni PREPROD, ni PROD n'ont tourné.
Une activation suppose L2 servie et vérifiée, les limites du packaging levées, puis une décision distincte.

**Retour arrière.**

- Dans le banc : `bench/route.sh select node`, puis `bench/route.sh down`.
- Côté code, aujourd'hui : rien n'est poussé ni fusionné. Abandonner les branches suffit.
- Après intégration, dans cet ordre :
  1. **Routage d'abord.** Rendre la route à Node et prouver la destination, avant tout retour sur le stockage.
     Sinon R2 et Node retrouvent chacun leur budget : c'est le double budget du § 2.3.
  2. **Stockage partagé ensuite** : revert de L2. Le stockage en mémoire repart de zéro. Les clés `throttler:*`
     restées dans Redis ne sont plus lues et expirent seules ; aucune purge n'est nécessaire.
  3. **6.7.1 enfin** : revert de L1, puis réinstallation des dépendances.
  Le budget partagé n'est jamais retiré pendant que Rust reçoit encore le trafic concerné. L'ancien schéma, où
  Node appelle Rust, ne remplace pas ce retour.

**Répétition isolée de ce retour** (banc, 2026-10-23, `candidate/rollback/` du répertoire de preuves). Cinq
états, chacun rattaché à son commit et à son `dist` : S0 L3 `8e57457ee` avec R2 (binaire `5daeb5f0…`) ; S1 même
processus Node, `select node` sans redémarrage, puis R2 arrêté ; S2 Node de L2 `00b8421d8` ; S3 Node de L1
`ef4ca3c89` ; S4 Node de `main` `8c8b92007` (6.5.0).

- Prouvé :
  - ordre imposé par les gardes du script ; destination de la route Rust en S0, Node ensuite (185 cas, 0 en
    défaut à chaque état) ;
  - parcours navigateur 9/9 en S0 et en S1, mêmes empreintes de liste, aucun 421 ;
  - clés `throttler:*` : 962 en S2, 0 en S3 et S4 ; 3 réponses 429 à chaque état ;
  - budget commun conservé à la bascule : Rust ouvre la fenêtre (`remaining` 1999), Node relit et décrémente le
    même compteur (1998).
- Écarts de S1 contre le Node du candidat : 30, classés. Un seul est non expliqué : `s-cookie-twice`, 7 lectures
  de base contre 6, à réponse identique.
- Non prouvé :
  - le chemin nominal de la route sur le Node d'avant L3 (S2 à S4). Les enregistrements du rejeu ne contiennent que
    les requêtes ordonnées de L3 : 131 réponses 500 par état, laissées visibles, sans normalisation ni relance ;
  - rien sur PREPROD.

Classement brut : `candidate/rollback/run/classement.txt`.

## 11. Tâches bloquées

| Tâche | Cause exacte |
|---|---|
| Détail noyau des OOM (v3 et passe diag) | `journalctl -k` : « Users in groups 'adm', 'systemd-journal' can see all messages » ; `dmesg` : « read kernel buffer failed: Operation not permitted ». Les protections système n'ont pas été modifiées. Attribution faite par le cgroup et la sonde (§ 7) |
| Installation de 6.7.1 par l'agent | la garde Bash du dépôt bloque toute commande `npm install` dans une session d'agent ; elle n'a pas été contournée. Le script a été écrit puis lancé par l'utilisateur |
| Écriture de `.github/` et de `ownership.yaml` | la garde de fichiers du dépôt bloque `.github/` ; `ownership.yaml` relève de l'owner. Diffs owner et `apply-owner-changes.sh`, dont seul le mode à blanc a été exécuté (§ 10) |
| Construction et exécution de l'image R2 | la construction exigerait un téléchargement (paquets de la base), non autorisé ; répétition faite avec le binaire du candidat dans la base épinglée (§ 10) |
| R2 avec la clé de rôle service | non mesuré : le banc n'utilise que la clé en lecture seule |
| Cause du SIGKILL de Node arrêté sans Redis | non établie ; l'attente des hooks d'arrêt BullMQ reste une hypothèse (§ 2.4) |
| Configuration Redis servie en PREPROD et en PROD | non lue : aucun accès autorisé à ces hôtes. Lectures console préparées (§ 10) |
| Comparer le limiteur sur la boucle bloquée | la sonde dans le processus ne relève rien pendant le blocage (§ 6.2) ; mesure faite en isolement |
| Expliquer la montée de la p95 d'a2 diag avant 3600 s | non expliquée ; aucune analyse exhaustive du tas n'a été faite (§ 7) |
| Capture réseau de q-url-20k | `tcpdump` exige root |
| CI hébergée, PREPROD, PROD | rien n'est publié : aucune CI hébergée n'a tourné ; aucune activation hors du banc |

## 12. Prochain acte

Les livraisons sont prêtes à relire ; une nouvelle mesure n'apporterait rien. Dans cet ordre :

1. Lire la configuration Redis servie en PROD, en console et en lecture seule
   (`preprod/prod-redis-lecture-console.txt`), avant la fusion de L2.
2. Exécuter `apply-owner-changes.sh` en mode réel (owner) : il installe les commits `ownership.yaml` et
   `.github/`, recompose L2 et L3 et régénère les projections.
3. Publier L1, puis L2 et L3 en brouillon jusqu'à la fusion de leur dépendance. Le dépôt est public : L3, qui
   décrit le blocage de la boucle sous 6.5.0, ne se publie qu'une fois L1 servie en PROD.
4. Pour chaque PR, lire la CI hébergée ; après chaque fusion, lire la chaîne PREPROD, puis faire les lectures
   console du § 10.

L'activation de la route Rust hors banc reste une décision distincte, à prendre sur les preuves de PREPROD.
Rien dans ce lot ne prouve que le crash initial de la production est corrigé, ni ne vaut décision de réécrire
l'application en Rust.
