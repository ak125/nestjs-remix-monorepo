# Protocole v3 — route complète derrière Caddy (A2 / R2)

Figé le 2026-10-22, avant toute passe de mesure v3. Toute modification ultérieure est signalée
dans le rapport comme écart au protocole. Les verdicts v1 et v2 (lot mesuré dans le harnais Node,
`PROTOCOL.md`, `PROTOCOL-v2.md`) restent ceux de leurs campagnes ; la v3 mesure une autre chose,
la route complète derrière Caddy, et ne les remplace pas.

## Objet et préalables
- Question : R2 sert-il `GET /api/vehicles/brands/:brandId/models` avec un gain serveur réel,
  surtout en mémoire ? Le comportement identique est établi à part, avant cette campagne
  (`docs/route-contract.md` : contrat des 185 cas via Caddy, sondes, Redis, journaux, navigateur).
- `route.sh campaign` refuse de démarrer si la crate a des changements non commités. Les binaires
  sont ceux du commit : `cargo build --release --locked --bins --examples` ne doit rien recompiler.
- Aucune opération lourde (cargo, registre, build) pendant la campagne.

## Versions
Relevées par `route.sh campaign` dans `versions.txt` avant la première passe : commit, Node, Caddy,
Redis, noyau, CPU, empreinte de l'arbre `backend/dist`, sha256 des binaires (`vehicle-models-route`,
`loadgen`, `replay`), de ce protocole, des chemins, des en-têtes, du Caddyfile, des scripts et des
données rejouées. Au gel : Node v24.21.0, Caddy v2.11.7, Redis 7.0.15, noyau 6.8.0-139,
AMD EPYC-Genoa 8 CPU.

## Configurations
- **a2** : Caddy → Node (backend complet `dist/main`, frontend compris) pour tous les chemins.
- **r2** : même Caddy ; GET et HEAD de la route → Rust (`vehicle-models-route`, 1 fil de travail,
  `VEHICLE_MODELS_RS_WORKER_THREADS=1`) ; tous les autres chemins → Node.
- Même `Caddyfile.route` ; seul le bloc de sélection change, sans amont secondaire ni repli.
- Node est démarré et compté dans les deux configurations : il sert le SSR et les autres routes.
  Pendant une passe r2, il reçoit les contrôles de santé de Caddy (30 s) et exécute ses tâches
  planifiées, comme en a2.
- Environnement de Node identique dans les deux configurations (`route.sh`, `start_a2`) :
  `NODE_ENV=production`, `READ_ONLY=true`, `NODE_OPTIONS=--max-old-space-size=4096`, services
  externes fermés, tâches de fond coupées.

## Ressources et placement
- Cibles (Node ; Node et Rust en r2) dans un seul scope systemd `MemoryMax=2G MemorySwapMax=0`,
  `taskset -c 0,1`, comme les protocoles v1 et v2.
- Caddy et Redis : CPU 2,3. Rejeu : CPU 4,5. Générateur et échantillonneur : CPU 6,7.
- La VM est partagée : d'autres processus peuvent s'exécuter sur tous les CPU. Leur part sur les
  CPU 0,1 est mesurée (« CPU des voisins »).

## Données, caches et état initial
- Rejeu des enregistrements `ROUTE_DATA` (3 fichiers, empreintes dans `versions.txt`).
  Latence imposée par le rejeu à chaque réponse amont : L0 = 0 ms, L20 = 20 ms. Elle s'applique au
  même endroit dans les deux configurations : entre les cibles et la base simulée.
- Chaque passe démarre une pile neuve : Redis du banc sans persistance, `contract.py prepare`
  (vidage puis configuration BotGuard du contrat), rejeu, scope des cibles, Caddy avec le
  répertoire de journaux de la passe. Les compteurs du rejeu sont remis à zéro avant la charge.
- Caches : le cache LRU de `getModelsByBrand` est désactivé quand `year` est présent, ce qui est
  le cas de tous les chemins de charge ; Rust n'a pas de cache ; Redis est vidé. Les caches de la
  route sont donc les mêmes, vides, dans les deux configurations.
- Limiteur : en mémoire de chaque processus, remis à zéro par le démarrage.

## Charge
- `examples/loadgen`, HTTP/1.1 sans TLS vers `http://localhost:3160` (Caddy), connexions
  réutilisées, concurrence 16.
- Les 18 chemins de `paths-load.txt` (6 marques × 3 années, `page=0&limit=100`), en cycle.
- En-têtes de `load-headers.txt` : navigateur courant, `Accept-Encoding: gzip, deflate, br, zstd`,
  donc réponses compressées comme pour un navigateur.
- IP clientes tournantes : 4096 adresses du bloc de documentation, `2001:db8:fff0::1` à
  `2001:db8:fff0::1000`, la n-ième requête prenant l'adresse n modulo 4096. Elles sont transmises
  dans `Cf-Connecting-Ip` (Caddy fait confiance à la boucle locale). À 400 req/s, chaque adresse
  reçoit environ 6 requêtes par minute et 350 par heure, sous les paliers du limiteur
  (15/s, 100/min, 2000/h).
- Chauffe 10 s, mesure 60 s.
- Ordre : à L0, a2-1 r2-1 a2-2 r2-2 a2-3 r2-3 ; puis la même suite à L20 ; puis les suivis longs à
  L20, a2 puis r2.

## Mesures
- Générateur : requêtes, statuts, erreurs (toute réponse autre que 200), débit, p50, p95, p99, max.
- Relevés à 1 Hz de chaque processus mesuré (Node, Rust en r2, Caddy, Redis) : CPU
  (Δ utime+stime sur la fenêtre, rapporté par requête réussie), VmRSS, VmHWM en fin de passe,
  RSS initial relevé 5 s après le démarrage de Caddy, avant la charge.
- cgroup des cibles : CPU, `memory.peak`, `memory.current` à 1 Hz.
- CPU des voisins sur les CPU 0,1 : occupation totale − cgroup des cibles − fils noyau des CPU 0,1,
  en pourcentage de la capacité. `CONFIG_IRQ_TIME_ACCOUNTING` n'étant pas actif, le temps
  d'interruption n'est pas séparé.
- Périmètre : total = Node + Rust (r2) + Caddy + Redis. Le rejeu et le générateur sont exclus :
  ils simulent la base et les clients.
- Destination : l'amont de chaque requête de la route est lu dans le journal par requête de
  Caddy. Exigé : 0 amont erroné, et autant de requêtes journalisées que de requêtes envoyées par
  le générateur, chauffe comprise. Le journal tourne à 100 Mio et garde 100 fichiers compressés.

## Conditions d'arrêt
Vérifiées chaque seconde par l'échantillonneur, qui arrête alors le générateur :
- erreurs > 1 % sur 10 s, ou 0 requête en 10 s ;
- OOM dans le cgroup des cibles ;
- `MemAvailable` < 1 Gio ;
- disque libre < 2 Gio ;
- disparition d'un processus mesuré.

Une passe arrêtée est invalide. Elle compte contre sa configuration et n'est pas rejouée. Un amont
erroné interrompt la campagne. Abandon manuel d'une passe : `touch <passe>/progress.json.stop` ; le
générateur s'arrête, l'échantillonneur sort sur « 0 requête en 10 s » et la passe est invalide.

## Voisins : rejeu d'une passe
- Seuil : 10 % des CPU 0,1. Base relevée banc arrêté le 2026-10-22 (`smoke-v3/foreign-baseline.txt`,
  12 × 10 s) : médiane 3,05 %, maximum 4,75 %. Le seuil vaut le double de ce maximum.
- Une passe courte au-delà du seuil est rejouée une fois (répétition suffixée `b`). Si le rejeu
  dépasse aussi le seuil, il est écarté. Les deux passes restent archivées.
- Les suivis longs ne sont pas rejoués ; leur CPU des voisins est publiée.

## Suivi long
- L20, a2 puis r2, mesure de 3600 s au plus.
- Plateau : à partir de 1800 s, vérifié toutes les 60 s ; |pente| de VmRSS ≤ 1,0 Mo/min sur les
  900 dernières secondes, pour chaque processus et pour le total. La passe s'arrête au plateau, ou
  à 3600 s sans plateau.
- Seuil : sous la plus faible dérive de Node relevée en v2 (A à L20 : +1,90 Mo/min sur les 240 s
  finales ; B : +12,60 Mo/min), pour qu'une dérive de cet ordre ne passe pas pour un plateau.
  Rust y dérivait de +0,03 Mo/min.

## Décision (déclarée avant mesure)
Passes retenues : valides, et CPU des voisins ≤ 10 %. Il en faut 3 par configuration et par
latence. Pour chaque indicateur et chaque latence, les plages min–max d'a2 et de r2 sont
comparées :
- disjointes : « r2 inférieur » ou « r2 supérieur » ;
- recouvrantes, avec une dispersion (max−min)/médiane > 15 % dans l'une des configurations :
  inconclusif ;
- recouvrantes sinon : pas de différence démontrée.

Seuil de dispersion : en v2, toutes les dispersions valaient au plus 10,2 %, sauf A à L0
(CPU 16,4 %, RSS pic 24,6 %). Le seuil de 15 % admet la dispersion courante de la v2 et classe
inconclusive une dispersion comme celle d'A à L0.

Conclusions :
- **R2 validé et bénéfice démontré** : contrat établi ; 0 erreur dans toutes les passes r2
  retenues ; aux deux latences, RSS en charge et pic cgroup des cibles « r2 inférieur » ;
  CPU ms/req OK, p95 et p99 non « r2 supérieur » ; suivi long r2 au plateau, avec un RSS total des
  900 s finales « r2 inférieur ».
- **R2 conforme mais bénéfice insuffisant** : contrat établi, 0 erreur en r2, aucun cas
  inconclusif, mais un critère mémoire non satisfait, ou CPU, p95 ou p99 « r2 supérieur ».
- **Mesures inconclusives** : moins de 3 passes retenues, dispersion au-delà du seuil sur un
  indicateur de décision, suivi long r2 sans plateau, ou erreurs dans les deux configurations.
- **R2 non validé** : erreurs propres à r2, amont erroné, ou écart de contrat découvert.

Aucune conclusion ne vaut activation en production, ni preuve que l'incident mémoire de
production est corrigé. Aucun pourcentage hors médianes mesurées ; plages min–max publiées.

## Limites
- VM partagée : voisins mesurés, non éliminés.
- HTTP sans TLS entre le générateur et Caddy : le coût TLS de Caddy est absent, dans les deux
  configurations.
- RSS et non PSS : les pages partagées comptent dans chaque processus.
- Banc limité à la route : en production, Node sert aussi le SSR et les autres routes ; son RSS de
  base ici n'est pas celui de la production.
- Rust tourne avec 1 fil de travail ; s'il est saturé, le débit r2 plafonne.
- Journal Caddy par requête : coût CPU de Caddy présent dans les deux configurations.
- Données rejouées et latence amont constante : ni la base réelle, ni ses variations.

## Écarts connus au gel
- Ce protocole a été rédigé après des passes de mise au point (`smoke-v3/`) qui ont exercé les
  outils, l'arrêt et la destination. Leurs chiffres ont été vus ; ils sont exclus des résultats.
- Le critère de rejeu pour voisins a été fixé après la mise au point : 5 % de CPU étrangère, puis
  10 % de CPU des voisins, au vu de la base relevée banc arrêté.
- Lors de la mise au point, la CPU des voisins était plus élevée en r2 (6,6 à 8,3 %) qu'en a2
  (2,2 à 2,3 %), sans cause établie. Hypothèse non vérifiée : le planificateur place des voisins
  sur la capacité laissée libre par Rust.
