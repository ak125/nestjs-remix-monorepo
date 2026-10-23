# Contrat de la route R2 — `GET /api/vehicles/brands/:brandId/models`

Statut : banc isolé seulement. Ce document décrit ce que le banc
(`bench/route.sh`) fait servir par la route Rust R2 et ce qui reste à Node, ce
qui a été comparé et comment. Il n'autorise aucune activation : le Caddyfile de
production (`config/caddy/Caddyfile`) ne contient aucune règle pour cette route
et n'est pas modifié. Toute mise en service hors du banc relève d'une décision
du propriétaire.

Termes : **A2** = backend Node complet (`backend/dist`, frontend compris) ;
**R2** = binaire `vehicle-models-route` de cette crate ; **sélection** = amont
choisi par le Caddy du banc pour la route (`node` ou `rust`).

## 1. Responsabilités

| Composant | Rôle sur cette route |
|---|---|
| Caddy du banc (`bench/Caddyfile.route`) | Décide de l'éligibilité, ajoute les en-têtes de cache privés de la route et les en-têtes de sécurité globaux, compresse, transmet l'IP client, traite les erreurs de proxy. Aucun repli : un seul amont par sélection, sans amont secondaire ni nouvelle tentative. |
| R2 (Rust) | Sert les requêtes éligibles (avec une année) quand la sélection vaut `rust`. Reproduit la chaîne Express/Nest de `main.ts` pour cette route (voir § 3). Écoute sur la boucle locale uniquement. Hors du motif de la route, ou sans année valide, répond 421 sans corps et ne relaie rien vers Node. |
| A2 (Node) | Sert tout le reste : rendu SSR, autres routes, la route sans année, exclusions du § 2, prérequêtes CORS, autres méthodes. Sert aussi la route avec année quand la sélection vaut `node`. |

Les loaders SSR qui lisent cette route appellent le backend directement, sans
passer par Caddy : `brands.$brandId.tsx`, `blog-pieces-auto.auto.$marque.index.tsx`,
`commercial.vehicles.*` et `utils/pieces-route.utils.ts`. Ils restent donc servis
par Node dans les deux sélections. Seuls les appels du navigateur
(`services/api/vehicle-api-unified.ts`) passent par Caddy. Parmi eux, seul le
sélecteur de véhicule, qui envoie une année, peut atteindre R2. L'assistant
`/diagnostic-auto` demande la route sans année (`includeAll=true`) et reste à Node.

## 2. Éligibilité et exclusions

Règle Caddy `@vehicle_models` : méthode `GET` ou `HEAD`, chemin
`^/api/vehicles/brands/[^/]+/models/?$`, et une année : `{query.year}` doit
valoir quatre chiffres (`^[1-9][0-9]{3}$`) et la requête compter au plus 1000
paramètres. Le chemin est comparé après décodage et nettoyage par Caddy, en
tenant compte de la casse comme le routage Nest. Une année répétée est jointe par
une virgule et reste donc à Node. Au-delà de 1000 paramètres, `qs` (Node) et R2
ignorent la suite, d'où la limite : une année placée après ne rend pas la requête
éligible. La même règle est réécrite dans `contract.py` (`caddy_eligible`) pour
attendre un amont sans le déduire de la réponse. Côté R2, `route::app::is_route`
applique le même motif de chemin et refuse par 421, avant tout effet, une requête
valide sans année. Une requête invalide reçoit le 400 de la validation, comme
dans Node.

Sans année, la route reste à Node dans les deux sélections (commit 0b3d97eff).
Node la sert depuis le cache LRU en mémoire du module véhicules (100 entrées,
3600 s, sans invalidation), partagé avec les autres appels du module. R2 en
tenait un second, propre à son processus : une seconde politique de fraîcheur et
de mémoire. Ce cache est retiré de R2.

`contract.py scope` vérifie ce périmètre en direct sur R2 (`scope-r2/scope.json`,
0 échec). Sans année, `HEAD` sans année, `page`/`limit` sans année, `year=` vide,
`search` seul, année au-delà du 1000e paramètre : 421 sans corps, sans cookie,
sans ligne de journal de R2, sans lecture du rejeu ni effet Redis. Les deux
témoins donnent 200 (année valide) et 400 (année invalide, refusée par la
validation, `year=1800`, comme dans Node).

Destinations observées sur les 185 cas du contrat (`c185/routes-node.json` et
`c185/routes-rust.json`, 0 défaut). En sélection `rust`, les cas avec année sont
servis par R2, les cas sans année et les `q-*` par Node. Une ligne de requête
Caddy sans amont n'est admise que si une ligne reverse_proxy du journal général
de Caddy nomme l'amont attendu pour le même cas et la même IP cliente, à moins
d'une seconde. Sans elle, le cas est en défaut, comme le montre un essai sans ce
journal.

| Cas | Requête | Servi par | Statut | Lignes R2 |
|---|---|---|---|---|
| (sans année) | route sans `year=`, ou `year` vide, répété ou non numérique | Node | selon Node | 0 |
| p052 | chemin en majuscules (`/API/VEHICLES/BRANDS/140/MODELS?…`) | Node | 404 | 0 |
| p069 | segment de marque vide (`/api/vehicles/brands//models`) | Node | 404 | 0 |
| p068 | `%2F` dans la marque (`/api/vehicles/brands/1%2F2/models`) | Node | 400 | 0 |
| p070 | échappement invalide (`%ZZ`) | Caddy seul, avant routage | 400 | 0 |
| q-headers-20k | en-têtes au-delà de la limite de Caddy | Caddy seul, avant routage | 431 | 0 |
| m-post, m-put, m-delete, m-patch | autres méthodes sur le chemin de la route | Node | 404 | 0 |
| m-options, m-preflight-ok, m-preflight-ko | `OPTIONS` (CORS) | Node | 204 | 0 |

Pour p068, Caddy évalue le chemin décodé (`/api/vehicles/brands/1/2/models`),
qui n'est pas éligible. Node reçoit en revanche le chemin brut et l'attribue au
même handler Nest que la route : réponse 400, sans lecture ni écriture. Ce cas
sert aussi au § 6.

## 3. Chaîne reproduite par R2

Ordre de `main.ts` (`src/route/app.rs`) :

1. **Session** (`express-session` 1.19, `connect.sid`, magasin `connect-redis`
   `sess:*`, `passport.session()`, version de session) : R2 ne crée jamais de
   session. Il relit, touche ou réécrit celle de Node.
2. **Compression** (`compression` 1.8) : les octets compressés diffèrent de zlib,
   le corps décodé est identique.
3. **Corps** JSON ou urlencoded, limite de 10 Mo.
4. **helmet** (nonce CSP) puis **CORS**.
5. **Middlewares Nest** : décodage des segments, `pino-http`, `X-Request-ID`.
6. **BotGuard** : blocage d'IP, moteurs vérifiés, sonde synthétique, filtre géographique, score.
7. **CloudflareThrottlerGuard** : paliers `short` (15/s), `medium` (100/min),
   `payment_callback` (100/min) et `long` (2000/h), avec les exemptions de `skipIf`.
8. **En-têtes SEO**.
9. **Validation** du paramètre de chemin et de la requête (zod `strictObject`).
10. **Service** `getModelsByBrand`, sans cache : dans Node, le cache LRU du module
    est désactivé quand `year` est présent, et seules ces requêtes atteignent R2 (§ 2).

Configuration refusée au démarrage si `NODE_ENV` ne vaut pas `production`, si
`SESSION_SECRET` manque ou compte moins de 32 caractères, ou si `REDIS_URL` manque.

## 4. Réponses

Trois captures du contrat, chacune de 185 cas joués derrière Caddy dans chaque
sélection, sur le corpus de la campagne v3 (92 chemins enregistrés et cas fixes),
journaux de l'application capturés. Les éléments comparés sont le statut, le corps
décodé, les en-têtes avec leur casse et leur ordre, les accès à la base comptés
par le rejeu, les effets Redis du périmètre du § 7 et les journaux.

| Capture | Tête | Binaire R2 (sha256) | Identiques (§ 8) |
|---|---|---|---|
| `c185/` | f638f15e8 | `16a5a8a6…` | 183/185 |
| `contract-v4/final/` | 2a242e490 | `16a5a8a6…` | 185/185 |
| `contract-limiter/final/` | fdf82d84a | `b6d5bcd3…`, limiteur partagé (§ 6) | 185/185 |

Dans les trois, Redis (clés, statistiques, blocages, moteurs vérifiés) est
identique, comme les 44 lignes `__error_logs`.

Les 2 écarts de `c185/`, p001 dans la capture `node` et f-noyear-cleared dans la
capture `rust` (champs `db` et `logs`), venaient du préchauffage de Node au
démarrage (`CacheWarmingService`, `HomepageRpcService`) : 4 lectures hors du
périmètre de la route et 1 écriture refusée par le rejeu, comptées dans la tranche
du cas en cours à cet instant. Les totaux du rejeu sur la capture entière étaient
identiques. Ces écarts n'ont pas été normalisés. Les deux captures suivantes
attendent, après chaque remise à zéro, la ligne de fin du préchauffage de
`CacheWarmingService` (`warm.txt`) avant le premier cas : ces accès ne tombent plus
dans un cas. C'est un changement de procédure, pas une normalisation. Il n'efface
aucun accès de la route.

Destinations (`routes-node.json`, `routes-rust.json` de chaque capture, 0 défaut) :
en sélection `rust`, les 108 cas avec année sont servis par R2 et les 75 autres
par Node ; en sélection `node`, les 183 par Node. Caddy refuse lui-même p070 (400)
et q-headers-20k (431) dans les deux sélections.

q-url-20k a reçu 431 dans les deux sélections des deux dernières captures. La
course de transport du § 9 n'est pas fermée pour autant.

Requêtes conditionnelles : l'ETag est un validateur faible `W/"<longueur>-<sha1>"`
calculé sur le corps. Les cas couverts donnent le même statut et le même ETag
brut des deux côtés :

| Cas | Requête | Statut |
|---|---|---|
| h-inm-match | `If-None-Match` égal à l'ETag | 304 |
| h-inm-gzip | idem, avec `Accept-Encoding: gzip` | 304 |
| h-inm-star | `If-None-Match: *` | 304 |
| h-inm-head | `HEAD` avec `If-None-Match` égal | 304 |
| h-inm-other | autre ETag | 200 |
| h-ims | `If-Modified-Since` seul (pas de `Last-Modified`) | 200 |

L'ETag n'est normalisé que pour un corps JSON dont seul le champ `timestamp`
diffère, comme les corps d'erreur de Nest. Il est alors recalculé de chaque côté
sur le corps reçu, et masqué seulement si les deux recalculs concordent.

**Parcours navigateur.** Neuf parcours rejoués par un navigateur sans interface,
dans chaque sélection, sur les deux binaires (`contract-v4/final/journeys-*`,
`contract-limiter/final/journeys-*`). Six passent par le sélecteur de véhicule de
l'accueil, trois par la page diagnostic :

| Parcours | Options affichées | Empreinte de la liste |
|---|---|---|
| 164, 2008, bureau | 78 | `efbc904158a2…` |
| 140, 2008, mobile | 36 | `60c7af6523be…` |
| 108, 2018, bureau | 84 | `33930cbc78a7…` |
| 173, 1995, mobile | 33 | `24864f292aae…` |
| 128, 2008, bureau | 39 | `a60307c56033…` |
| 441, 2018, mobile | 7 | `8064852f2e18…` |
| 140, diagnostic | 208 | `306133a13b31…` |
| 164, diagnostic | 500 (sur 618) | `1a204b9373db…` |
| 441, diagnostic | 15 | `bf753aee2c7c…` |

Les 36 parcours réussissent (9 par sélection et par binaire), avec les mêmes
options et les mêmes empreintes. Destinations relevées par Caddy :

- sélecteur de l'accueil : l'appel `brands/<id>/models?year=…` est servi par R2
  en sélection `rust` et par Node en sélection `node` ;
- page diagnostic : aucun appel avec année, tout est servi par Node ;
- mêmes appels, mêmes méthodes et mêmes statuts dans les deux sélections. Seul
  l'ordre de deux requêtes simultanées change sur les parcours diagnostic ;
- statuts hors 2xx, identiques dans les deux sélections : sur les parcours
  bureau, 1 × 429 `attribution/landing` et 2 × 429 `cwv/beacon`. Sur les parcours
  diagnostic, 1 × 503 `wizard-steps` (§ 11).

## 5. Sonde synthétique (`X-Synthetic-Probe`)

R2 applique les mêmes règles que Node. Une sonde valide exempte la requête du
filtre géographique. Elle ne l'exempte pas du limiteur sur `/api/` : le cas
p-burst reçoit 429 après 15 requêtes, des deux côtés. Une sonde invalide est
refusée par 403 : fenêtre périmée ou future, casse, valeur tronquée ou vide,
méthode ou chemin non signés, en-tête dupliqué, chemin décodé au lieu du chemin
brut.

Rejouées sur les deux binaires (`contract-v4/final/` et `contract-limiter/final/`,
`diff-probes.json`) : 21 cas identiques sur 21, Redis compris. Destinations
(`routes-r2-probes.json`, 0 défaut) : 20 cas servis par R2 en sélection `rust`.
Le chemin brut `%34` (p-noyear) est sans année et reste à Node.

Les valeurs de sonde ne sont jamais écrites dans les rapports.

## 6. Limiteur : un budget commun à Node et à R2

`@nestjs/throttler` (6.7.1 depuis `c6ecea9d9`, 6.5.0 avant) compte par
(contrôleur, handler, palier, traqueur). Dans Node, une requête de la route
incrémente deux contextes, celui du catch-all Remix (`RemixController`, route
`/{*path}`), puis celui de `VehiclesController.getModelsByBrand`, soit 8
incréments pour les 4 paliers. Une requête `/api` inconnue n'incrémente que le
contexte Remix. Ce contexte porte donc un budget commun aux requêtes de l'IP qui
l'atteignent, et la route en fait partie.

**Avant la correction** (binaire `16a5a8a6…`). Les compteurs vivaient dans la
mémoire de chaque processus : `ThrottlerModule.forRoot` ne déclarait pas de
stockage. En production, un seul conteneur applicatif sert le site
(`docker-compose.prod.yml`, un seul amont dans `config/caddy/Caddyfile`) : ce
compteur était donc, de fait, unique par IP. R2 tenait le sien pour la route.

Mesure (banc de trace séparé, IP neuves, statuts bruts) : alternance de la route
avec année (R) et d'un `GET /api/` inconnu (O) depuis une même IP.

| Sélection | Palier | Réponses servies avant 429 |
|---|---|---|
| node | short (15/s) | 15 au total (8 R + 7 O) |
| rust | short (15/s) | 15 R + 15 O |
| node | medium (100/min) | 100 au total |
| rust | medium (100/min) | 100 R + 100 O |

Avec la sélection `rust`, une IP au trafic mixte disposait donc de deux budgets
au lieu d'un sur les paliers mesurés. `contract.py budget <node|rust> …` mesure la
même différence avec l'exclusion p068, qui atteint le même handler Nest :
`X-RateLimit-Remaining-medium` décroît de 99 à 88 en `node`, et en `rust` de 99,
99, 98, 98… à 94, 94 (`contract-v4/final/budget-*`). Ce binaire n'est pas
activable hors du banc. Cette différence n'a pas été normalisée.

**Correction** (`22cb0cc7a` pour Node, `b646dd0a8` pour R2, binaire
`b6d5bcd3…`). Aucun stockage partagé du limiteur n'existait dans `backend/src`
ni dans `packages`. Les compteurs Redis de BotGuard servent à la télémétrie
horaire et aux listes de blocage, pas à des fenêtres par IP.
`CacheService.atomicIncr` renvoie 1 quand Redis est indisponible, ce qui
ouvrirait la protection sans signal. Les compteurs passent donc dans Redis, par
le point d'extension de la bibliothèque : l'option `storage` de
`ThrottlerModule.forRootAsync` (`RedisThrottlerStorage`,
`backend/src/config/throttler-redis-storage.service.ts`). R2 exécute le même
script Lua (`src/route/throttle.lua`, égal octet à octet à la constante
TypeScript, vérifié par un test Jest), sur les mêmes clés :
`throttler:<sha256(Classe-Handler-palier-traqueur)>` (échéance, fin de blocage,
blocage) et `throttler:<clé>:<palier>` (échéances des coups vivants).

Le garde, les paliers, `skipIf`, `getTracker`, `generateKey` et les `@Throttle`
par route restent ceux de Node. Aucun quota n'est fusionné : chaque contexte,
chaque palier et chaque route garde son compteur. Deux processus qui servent la
même limite décomptent le même compteur. Diviser les limites de R2 a été écarté :
un client servi uniquement par R2 recevrait un budget faux.

| Vérification (binaire `b6d5bcd3…`) | Résultat |
|---|---|
| Alternance R/O, paliers `short` et `medium` (`limiter-shared/`) | 15 et 100 au total dans les deux sélections |
| Rafale simultanée de 40 requêtes | 15 servies, 25 × 429 `short`, dans les deux sélections |
| `contract.py budget` (`contract-limiter/final/budget-*`) | 99 à 88 dans les deux sélections, 0 écart à l'attendu |
| Expiration, 429, `Retry-After` | conformes dans les deux sélections |
| Panne puis retour de Redis | repli en mémoire par processus, journalisé, budget de nouveau commun au retour |

Panne de Redis. La protection ne s'ouvre pas et ne se ferme pas : chaque
processus se replie sur un stockage en mémoire, celui de la bibliothèque pour
Node, son équivalent pour R2. La limite vaut alors par processus. L'entrée en
repli est journalisée en ERROR (contexte `RedisThrottlerStorage`, « Redis
indisponible (<cause>) : limiteur en mémoire du processus, budget non partagé »),
le retour en WARN (« Redis revenu : budget partagé rétabli après N décision(s) en
mémoire du processus »). Chaque commande du limiteur est bornée à 250 ms, sur une
connexion dédiée sans file hors ligne (§ 7).

Réserves : compteurs perdus si Redis redémarre sans persistance, comme au
redémarrage d'un processus aujourd'hui ; éviction possible sous pression mémoire
si Redis applique une politique LRU, non mesurée ; horloge de l'hôte de chaque
processus, la même au banc. Rapport, § 2.4.

Traqueur et confiance des en-têtes. R2 reprend
`CloudflareThrottlerGuard.getTracker` (`Cf-Connecting-Ip`, puis `X-Real-IP`,
puis la pile d'adresses) ; ces en-têtes ne sont fiables que parce que Caddy les
remplace par `{client_ip}` et que R2 refuse au démarrage toute adresse d'écoute
hors boucle locale. La BotGuard, exemption de sortie de la sonde comprise, ne
les lit que si le pair TCP est interne, comme `BotGuardMiddleware.getClientIp`.

Mémoire du limiteur. En 6.5.0, `ThrottlerStorageService` armait un `setTimeout`
par coup et par palier jusqu'à l'échéance du palier (1 h pour `long`). Chaque
expiration recopiait par `filter` la liste des minuteries du palier, toutes clés
confondues. Sous la charge de la campagne v4 (80 req/s, 4096 IP, tas de
4096 Mo), le palier `long` en gardait 560 596 à 3494 s, soit environ deux par requête
achevée. Les premières expirations tombent à 3600 s. La boucle de Node se bloque
alors : la sonde ne relève plus rien, les réponses se figent, le RSS passe de
1360 à 2028 Mo en 11 s, et le cgroup des cibles tue Node à 3602 s (rapport,
§ 6.2 et § 7). Le blocage est reproduit en isolement, sans réseau, pour les deux
plafonds de tas (`bench/throttler-expiry-repro.js`, rapport § 6.3).

Depuis `c6ecea9d9`, 6.7.1 garde les échéances par clé et par palier, les élague
à chaque coup de cette clé, et purge toutes les 60 s les enregistrements sans
coup vivant ni blocage. Il n'arme plus de minuterie par coup, et une clé garde
au plus environ `limit` + 1 échéances.

Depuis `22cb0cc7a` et `b646dd0a8`, ces enregistrements sont dans Redis en service
normal. Chaque clé y expire à la dernière de ses échéances : fin de la fenêtre,
fin du blocage ou dernier coup, soit au plus 1 h après le dernier coup pour
`long`. La mémoire en mode repli suit `ThrottlerStorageService` 6.7.1 pour Node.
Pour R2, elle suit sa transcription : un enregistrement par clé, sans
minuterie. Au-delà de 50 000 enregistrements, R2 retire ceux qui n'ont plus ni
coup, ni échéance, ni blocage vivants, et le seuil double après chaque élagage :
le parcours de la table ne se répète donc pas à chaque requête quand rien n'est
élagable.

Aucun n'a de plafond dur : des requêtes portant chacune un traqueur nouveau font
croître le nombre de clés pendant l'heure de la fenêtre `long`, dans Redis comme
en repli. Un plafond suppose une politique d'éviction, donc un changement de la
garde, à décider avant toute activation, pour Node comme pour R2.

## 7. Redis

R2 utilise les clés que la route partage avec Node : `sess:*`,
`session_version:*`, `bot-guard:*` et, depuis `b646dd0a8`, `throttler:*`, au
moyen de trois clients (`src/route/redis.rs`) :

- **borné**, pour `session_version:*` et `bot-guard:*` : délai par appel de
  `ROUTE_REDIS_TIMEOUT_MS` (2000 ms par défaut). Une panne donne une valeur
  absente, comme le `CacheService` de Node ;
- **file hors ligne**, pour le magasin de sessions, comme node-redis 5.12 dans
  `SessionStoreService` : la commande attend la reconnexion, retentée sans fin,
  et chaque échec est journalisé ;
- **limiteur**, pour `throttler:*` : connexion dédiée, délai de 250 ms par
  commande, sans file hors ligne, comme la connexion ioredis de
  `RedisThrottlerStorage` dans Node. Une panne fait passer le processus en
  repli (§ 6). Cible : `THROTTLER_REDIS_URL` s'il est défini et non vide (Redis
  réservé aux compteurs), sinon `REDIS_URL`, la règle de
  `throttlerRedisConnectionOptions` dans Node ; Node et R2 doivent désigner le
  même stockage pour partager le budget. La cible et sa variable sont
  journalisées au démarrage (`Compteurs sur hôte:port/base (variable)`, contexte
  `RedisThrottlerStorage`). Les deux autres clients restent sur `REDIS_URL`.

Comparaison : le Redis du banc est vidé puis préparé avant chaque capture
(`route.sh reset`). Pour `bot-guard:*`, `sess:*` et `session_version:*`
(`REDIS_SCOPE` dans `contract.py`), le comparateur vérifie ensuite, cas par cas
et à la fin, les clés, les statistiques, les derniers blocages et les moteurs
vérifiés (`vbot`). Résultat : identiques sur les 185 cas et sur les 21 sondes,
sur les deux binaires. Deux normalisations s'appliquent :

- un TTL est remplacé par sa seule présence ;
- les compteurs par minute sont remplacés par leur somme, car le découpage en
  minutes dépend de l'horloge.

Les familles de clés hors de ce périmètre, comme les files BullMQ d'A2, sont
inventoriées à part (`redis_hors_perimetre`) et jamais comparées comme
équivalentes. `throttler:*` en fait partie : `REDIS_SCOPE` date d'avant le
stockage partagé, quand le limiteur n'écrivait pas dans Redis. Le contrat ne
compare donc pas les effets du limiteur dans Redis, ni par cas ni à la fin. Il
compare ses décisions : statut et en-têtes `X-RateLimit-*` de chaque cas, et
l'étape `budget`. Les clés du limiteur sont vérifiées par les essais
`limiter-shared/` (clés, échéances, longueur des listes) et par les tests du
stockage.

Contrôle a posteriori, en lecture seule, de l'instantané de fin de
`contract-limiter/final/`. Chaque clé est rattachée à son contexte, son palier et
son traqueur, en recalculant le hachage de la bibliothèque pour les adresses du
corpus et les traqueurs vus par Caddy.

| Capture | Clés `throttler:*` | Rattachées | Traqueurs distincts |
|---|---|---|---|
| `node` | 922 | 922 | 161 |
| `rust` | 970 | 970 | 161 |

- En sélection `rust`, Node et R2 écrivent ensemble. On retrouve les 922
  rattachements (contexte, palier, traqueur, hachage ou liste) de la sélection
  `node`, où Node écrit seul. Aucun rattachement n'est propre à `node`.
- Les 48 propres à `rust` sont des clés `medium` et `payment_callback`
  (hachage et liste) : 7 clients dans le contexte Remix, 5 dans le contexte
  Vehicles. Une telle clé n'existe plus quand la dernière requête du client date
  de plus de 60 s. Dans les deux captures, l'âge maximal avec clé vaut au plus
  60,05 s, et l'âge minimal sans clé au moins 60,30 s. La capture `rust` a duré
  4 s de moins (97,0 s contre 101,2 s) : à l'instantané, plus de clients étaient
  encore sous ce seuil.
- Contextes : les deux de la route, et `ErrorsApiController-logError`, palier
  `long`, pour un client, des deux côtés. Traqueurs : 159 adresses du corpus et
  deux traqueurs fixes du corpus, des deux côtés.
- Aucune clé `short` (fenêtre de 1 s) ne subsiste, ni d'un côté ni de l'autre.

Ce contrôle n'est pas une normalisation : les comptes bruts restent différents
(922 et 970), et l'écart est expliqué clé par clé.

## 8. Journaux et `__error_logs`

- Les lignes pino gardent le format de `nestjs-pino`, avec les clés dans l'ordre
  observé sur A2. `req.id` vaut l'en-tête `X-Request-Id` reçu, sinon
  `req-<ms>-<base 36>`. Ce n'est pas l'en-tête `X-Request-ID` de la réponse.
- La ligne de fin est écrite à la fin de la réponse, ou à la fermeture par le
  client quand la requête se poursuit après son départ.
- `__error_logs` est vidé toutes les 5 s, par lots de 500. Après 3 échecs, le
  tampon est abandonné pendant 60 s, comme `ErrorLogService`. Sur les 185 cas,
  les 44 lignes reçues par le rejeu sont identiques de part et d'autre après
  normalisation.
- Une pile Rust ne reproduit pas une pile JavaScript : seule la première ligne
  de `err_stack` (nom et message) est comparée brute, la suite est masquée.

Liste complète des normalisations : `NORMALISATIONS` dans `bench/contract.py`,
recopiée dans chaque rapport de comparaison. Aucune ne porte sur un statut, une
décision de sécurité (BotGuard, sonde, limiteur, session) ou un effet Redis
autre que les TTL et les sommes par minute. Les effets Redis du limiteur ne
sont pas normalisés : ils sont hors du périmètre comparé (§ 7).

## 9. Écarts restants

| Écart | Classement | Preuve |
|---|---|---|
| q-url-20k (URL de 20 000 octets) : 431, ou connexion fermée sans octet | course de transport entre Caddy et un amont qui répond tôt puis ferme, présente avec Node seul. Caddy a reçu le 431 puis lit une réinitialisation (« aborting with incomplete response », `connection reset by peer`) et coupe la connexion du client. Explication probable, non vérifiée par capture réseau : l'amont ferme avant d'avoir lu toute la requête. Ne vient pas de R2 ; non normalisé | Répétitions v4 (`url20k/`), 20 essais par série, une connexion et une IP neuves par essai : par Caddy, Node coupé 16 fois et 20 fois (sélection `node`, sans et avec année), 13 fois (sélection `rust`, sans année, servi par Node) ; R2 coupé 12 fois (avec année). En direct sans Caddy : 431 dans 20 essais sur 20 pour Node et pour R2 |
| Panne Redis : lignes du client de session de R2 (« Erreur Redis (session) », puis « ready — vehicle-models-route ») | différence réelle et attribuable : R2 a son propre client de session, ouvert à la première commande de session, qui repart d'un délai court et journalise chaque échec. Même politique de reconnexion que node-redis 5.12 (même formule de délai). Mêmes décisions de session, refus et reprises ; aucune perte de signal : la ligne BotGuard « metrics unavailable » de R2 et le client de session de Node restent présents. Non normalisé | `redis-outages-v4/README.md` (étapes o-redis-down, o-redis-down-session, o-redis-back) ; versions finales, étape o-redis-down-session : 31 lignes en `node`, 66 en `rust` sur `16a5a8a6…` et 65 sur `b6d5bcd3…` ; étape o-redis-back : la ligne « ready » de R2 |
| Panne Redis : cause de l'ERROR `RedisThrottlerStorage` | différence de libellé, depuis le stockage partagé. La ligne est écrite par le processus qui prend la décision du limiteur : A2 en `node`, R2 en `rust`. Node cite l'erreur d'ioredis (« Stream isn't writeable and enableOfflineQueue options is false ; connect ECONNREFUSED … »), R2 « Redis : connexion fermée ». Même niveau, même contexte, même suite. Le WARN de retour est identique (« après 8 décision(s) en mémoire du processus »). Non normalisé | `contract-limiter/final/diff-outages.json`, étapes o-redis-down et o-redis-back |
| Panne Redis : ±1 ligne d'erreur des clients de fond d'A2 (ioredis, `CacheService`, `AiContentCacheService`) | différence temporelle : ces clients tournent dans A2 pour les deux sélections, et leur nombre dépend du rythme de reconnexion | `contract-limiter/final/diff-outages.json`, étapes o-redis-down (4 et 3) et o-redis-down-session (45 et 46) |

Fermés :

- le cache LRU sans année, second cache de R2 propre à son processus. Depuis
  0b3d97eff, la route sans année reste à Node (§ 2), et R2 n'a plus de cache ;
- le budget doublé du limiteur pour une IP au trafic mixte, différence réelle de
  `16a5a8a6…`, corrigée par `22cb0cc7a` et `b646dd0a8` (§ 6). Vérifié au banc
  sur `b6d5bcd3…`, ni en CI ni en PREPROD.

## 10. Pannes et reprise

Comportements attendus et vérifiés derrière Caddy (`contract.py backend-outage`
et `outages`) :

| Panne | Sélection | Route | Exclusion (p068) |
|---|---|---|---|
| Amont de la route arrêté (R2) | rust | 500, page de `handle_errors` émise par Caddy (ligne de niveau error), aucune ligne A2 ni R2 : pas de repli | 400, servie par Node |
| Amont de la route arrêté (A2) | node | 500, page de Caddy | 500, page de Caddy |
| Reprise de l'amont | les deux | revient sur l'amont de la sélection | Node |
| Rejeu (base) arrêté | les deux | mêmes statuts, corps, journaux et lignes `__error_logs` | — |
| Redis arrêté | les deux | mêmes statuts et corps ; journaux selon le § 9 | — |

Rejouées sur les deux binaires (`contract-v4/final/` et `contract-limiter/final/`) :

- `outages` : 17 étapes ; statuts, corps et en-têtes identiques. Écarts de
  journaux selon le § 9 : 2 étapes sur `16a5a8a6…`, 3 sur `b6d5bcd3…`. La
  troisième, o-redis-down, porte la cause de l'ERROR du limiteur et les lignes
  des clients de fond. Les étapes sans année, comme o-replay-down-cached, sont
  servies par Node dans les deux sélections ;
- `backend-outage` : 0 écart à l'attendu dans les deux sélections.

Panne propre à R2 : un 421 de R2 signalerait un désaccord entre Caddy et
`is_route`. Caddy le transmettrait tel quel, et A2 ne renvoyant jamais 421, le
comparateur le relèverait comme écart de statut. Depuis 0b3d97eff, R2 répond aussi
421 à une requête valide sans année (§ 2), que Caddy ne lui envoie pas. Relevé :
aucun 421 dans les journaux Caddy du contrat et des sondes, ni dans les réponses
des étapes de pannes, de budget et de panne d'amont, sur les deux binaires.
Les deux paires de la campagne v4 n'en comptent aucun non plus : chaque passe a
432 800 lignes Caddy, toutes en 200. Les seuls 421 sont ceux attendus de
`scope-r2/`, en direct sur R2.

Panne commune : la route par défaut de Caddy, vers Node, porte un contrôle de
santé actif toutes les 30 s. Après un redémarrage d'A2, Caddy peut répondre
lui-même 500 aux pages jusqu'au contrôle suivant, quelle que soit la sélection.

Retour arrière, ordre imposé : sélection `node` avec destination prouvée, puis
retrait du stockage partagé, puis retour de version du limiteur. Le budget
partagé n'est jamais retiré pendant que R2 reçoit encore la route.

Cet ordre a été répété sur le banc isolé (L3 avec R2, puis Node de L3, L2, L1 et
`main`) : destination prouvée à chaque état, clés `throttler:*` de 962 à 0 au retrait
de L2, budget conservé à la bascule Rust → Node. Le rejeu n'a pas servi la route
nominale sur le Node d'avant L3 : ses enregistrements ne portent que les requêtes
ordonnées de L3. Aucune preuve PREPROD.

## 11. Artefacts du banc (hors contrat)

- Images absentes du banc : environ 30 requêtes Node en 404 par seconde au
  chargement d'une page, depuis l'IP de boucle locale.
- Parcours navigateur enchaînés depuis cette IP : le palier `medium`
  (100/min) est atteint. Les parcours sont donc espacés de 65 s. Même espacés,
  les mesures de page (`/api/seo/cwv/beacon`, `/api/attribution/landing`)
  reçoivent 202 ou 429 selon le parcours. Elles sont servies par Node dans les
  deux sélections, avec les mêmes nombres de 202 et de 429 dans les deux séries.
- `wizard-steps` de l'assistant : 503, ces données n'étant pas enregistrées dans
  le rejeu. Cela n'affecte ni la marque ni les modèles.
- Rejeu local à la place de la base : les écritures `POST /rest/v1/__error_logs`
  sont acceptées localement (201) sans être relayées, et toute autre écriture
  est refusée (403).

## 12. Commandes

Variables : `ROUTE_OUT` (répertoire du banc), `ROUTE_DATA` (enregistrements
rejoués, séparés par « : »). Prérequis : `backend/dist` et `frontend/build`
construits, puis `cargo build --release --locked --bins --examples`.

```sh
bench/route.sh up                      # Redis, rejeu, A2, R2, Caddy ; sélection node
bench/route.sh status                  # processus du banc et amont servi (lu dans la config active de Caddy)
bench/route.sh reset <node|rust>       # état initial d'une capture
python3 -I bench/contract.py capture caddy https://localhost:3161 <sortie> <ns> <chemins>
python3 -I bench/contract.py scope http://127.0.0.1:3150 <sortie> <ns>   # périmètre de R2, en direct
python3 -I bench/contract.py routes <capture> <node|rust> <rapport.json>
python3 -I bench/contract.py diff <capture_node> <capture_rust> <rapport.json>
python3 -I bench/contract.py probes caddy https://localhost:3161 <sortie> <ns>
python3 -I bench/contract.py outages caddy https://localhost:3161 <sortie> <ns>
python3 -I bench/contract.py backend-outage <node|rust> https://localhost:3161 <sortie> <ns>
python3 -I bench/contract.py budget <node|rust> https://localhost:3161 <sortie> <ns>
bench/route.sh journey https://localhost:3161 <marque> <année|-> [desktop|mobile|diagnostic]
python3 -I bench/contract.py journey-routes <parcours.json> <node|rust> <rapport.json>
```

`<chemins>` : le contrat de 185 cas joue `record-v3/paths-recorded.txt` du
répertoire de preuves (92 chemins enregistrés) ; `bench/paths-contract.txt`
donne un corpus réduit de 157 cas. Mesures de charge : `bench/PROTOCOL-v4.md`
(`route.sh load4`, `compress4`, `summary4`).

Activation dans le banc : `bench/route.sh select rust`. Caddy est rechargé, puis
l'amont est relu dans sa configuration active. En cas d'écart, la commande échoue.

Retour arrière : `bench/route.sh select node`. Si le rechargement est refusé,
la sélection précédente est conservée et la commande échoue.

Arrêt : `bench/route.sh down` arrête les seuls processus du banc. `stop`
n'envoie un signal qu'au processus lancé par `start` : le PID et son heure de
démarrage (`pids/<nom>.start`) doivent concorder. Sans ce fichier, ou si le PID
a été réutilisé par un autre processus, la commande refuse et n'arrête rien.

## 13. Limites

- Banc local sur une VM partagée, sans Cloudflare ; certificat interne de Caddy ;
  données rejouées, et non la base réelle.
- A2 est lancé tel quel : `backend/src/main.ts` appelle `app.listen` sans hôte,
  donc A2 écoute sur toutes les interfaces. Les essais n'utilisent que la boucle
  locale, et le pare-feu de la VM n'a pas été inspecté. R2 et Caddy écoutent sur
  la boucle locale seulement.
- R2 n'a été mesuré qu'avec la clé en lecture seule du banc, pas avec la clé de
  rôle service de Node.
- Packaging répété sur conteneurs jetables seulement : l'image n'a été ni
  construite ni exécutée. Après une recréation de Caddy, R2 reste déclaré sain
  mais injoignable jusqu'à son redémarrage.
- Les mesures de ce banc ne valent ni activation, ni preuve de comportement en
  PREPROD ou en PROD, ni correction d'un incident mémoire de production.
