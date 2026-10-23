# Protocole v4 — route avec année derrière Caddy, débit fixe (A2 / R2)

Figé le 2026-10-22, avant la première passe v4 (`a2-L20-diag`). Toute modification ultérieure est
signalée dans le rapport comme écart au protocole. La v3 (`PROTOCOL-v3.md`, boucle fermée,
concurrence 16) a conclu « mesures inconclusives » : son suivi long a2 a été arrêté par un OOM du
cgroup des cibles sans collecte exploitable. La v4 ne la rejoue pas. Elle mesure, à débit fixe et
sur 90 min, une paire A2/R2 et décide selon les règles ci-dessous, figées avant mesure.
Amendé trois fois : pendant la passe `a2-L20-diag` et avant tout résultat, tas de Node (section
« Amendement 1 ») ; après cette passe et avant toute passe a2c ou r2, défaut du limiteur établi par
un test isolé et sa correction (section « Amendement 2 ») ; après la passe a2c et avant toute passe
r2, classement d'un processus admis relevé pendant sa sortie (section « Amendement 3 »).

## Objet et préalables
- Question : à un débit fixe soutenable par Node, R2 sert-il
  `GET /api/vehicles/brands/:brandId/models?year=…` avec moins de mémoire totale des cibles, sans
  CPU par requête réussie, p95 ou p99 supérieurs, et la référence Node tient-elle 90 min ?
- Comportement : contrat via Caddy de `docs/route-contract.md`, rejoué sur les binaires et sources
  de la campagne, avant et après les passes si l'un d'eux change.
- `route.sh load4` refuse une passe si un fichier suivi du dépôt est modifié (sources = commit
  relevé), si le disque libre est sous 3 Gio, ou si un processus du banc tourne déjà.
- Aucune opération lourde (cargo, Jest, registre, build) pendant une passe.

## Périmètre (changé depuis la v3)
- `Caddyfile.route` envoie à l'amont choisi les GET et HEAD de la route **avec une année**
  (`year` à une seule valeur de 4 chiffres, au plus 1000 paramètres). Sans année, la route reste à
  Node dans les deux sélections : son cache LRU est partagé avec le reste du module véhicules, et
  R2 n'en crée pas un second. Hors de ce périmètre, R2 répond 421, sans repli.
- Les 18 chemins de charge (`paths-load.txt`) portent tous une année : toute la charge est dans le
  périmètre. Le cache LRU de Node est inactif dès que `year` est présent ; R2 n'a pas de cache ;
  Redis du banc vidé à chaque passe. Aucune optimisation de cache propre à R2.

## Versions
`versions.txt` de chaque passe (`versions4`) : commit et état de l'arbre, Node, Caddy, Redis,
noyau, CPU, empreinte de `backend/dist`, version et empreinte de `@nestjs/throttler`, débit,
plafond en vol, chauffe, nombre d'IP, disque libre, charge de la VM, sha256 des binaires
(`vehicle-models-route`, `loadgen`, `replay`), de ce protocole, des chemins, des en-têtes, du
Caddyfile, des scripts, de la sonde et des 3 fichiers de `ROUTE_DATA`. Les binaires sont ceux du
commit : `cargo build --release --locked --bins --examples` ne recompile rien.

## Configurations
- **a2** : Caddy → Node (`backend/dist`, frontend compris) pour tous les chemins, tas fixé par
  `--max-old-space-size=4096` comme dans la v3 : passe diag seulement (amendement 1).
- **a2c** : Node lancé comme l'image, sans `--max-old-space-size` (plafond par défaut de V8 sous
  le cgroup, relevé par la sonde) ; limiteur corrigé si le défaut est établi (amendement 2 : par le
  test isolé, D2 n'ayant pas pu l'observer) et si la correction passe le critère d'acceptation.
  Correction : mise à jour de `@nestjs/throttler`, Jest et typecheck du backend, commit ;
  `backend/dist` inchangé (le limiteur est résolu dans `node_modules`) ; la nouvelle référence est
  tracée par `versions.txt`.
- **r2** : même Caddy ; la route avec année → Rust (1 fil de travail) ; le reste → Node. Node est
  démarré, compté et identique à celui d'a2c (tas et limiteur).
- Environnement de Node identique dans toutes les configurations (`start_a2`), hormis le tas :
  `NODE_ENV=production`, `READ_ONLY=true`, services externes fermés, tâches de fond coupées ;
  sonde `memprobe.cjs` chargée par `--require` dans le processus testé. Tas : `A2_HEAP_MB`, posé à
  4096 par `load4` pour a2 seulement ; ailleurs, plafond par défaut de V8.

## Ressources et collecte
- Cibles dans un seul scope systemd `MemoryMax=2G MemorySwapMax=0 OOMPolicy=continue`,
  `taskset -c 0,1`. Même budget total pour a2, a2c et r2 : Node seul, ou Node et Rust.
- Processus admis dans le cgroup : le shell témoin `route.sh _targets`, son `sleep 1`,
  `node dist/main`, `vehicle-models-route`. Tout autre processus invalide la passe.
- Le shell témoin reste dans le scope jusqu'à la fin des relevés : le cgroup survit à la mort des
  cibles. Instantanés `cgroup-pre`, `-post` (fin de charge, cibles vivantes) et `-end` (cibles
  arrêtées) : `memory.current`, `.max`, `.peak`, `.stat`, `.events` (avec descendants) et
  `.events.local` (cgroup seul), `cgroup.procs`.
- Journaux de Node et de Rust, et sonde Node, écrits dans des FIFO lues par des processus hors
  cgroup : une ligne écrite avant une mort est conservée.
- Sonde Node, toutes les 10 s : `process.memoryUsage()` (tas, RSS, mémoire externe), espaces du
  tas, GC par type, retard de boucle, CPU, handles par type, taille des tables du limiteur.
- Caddy et Redis : CPU 2,3. Rejeu : CPU 4,5. Générateur et échantillonneur : CPU 6,7.
- `dmesg` n'est pas lisible sans droits ; les protections du système ne sont pas modifiées. L'OOM
  est attribué par `memory.events`, `memory.events.local`, les instantanés et la sonde.

## Charge
- `examples/loadgen` en boucle ouverte : 80 req/s prévues (requête k à départ + k/80), plafond de
  64 en vol ; une requête prévue au plafond est abandonnée, jamais émise. Comptes séparés :
  prévues, émises, achevées, abandonnées, inachevées. Latence mesurée depuis l'heure prévue.
- Débit : 80 req/s ≈ 69 % du débit servi par a2 à L20 en v3 (≈ 116 req/s en boucle fermée,
  concurrence 16) et ≈ 60 % de celui de r2 (≈ 134 req/s). Soutenable par Node, identique pour
  toutes les configurations.
- Mêmes chemins, en-têtes (`load-headers.txt`), IP tournantes (4096 adresses
  `2001:db8:fff0::1…1000`) et distribution qu'en v3. Par adresse : environ 1,2 requête par minute
  et 70 par heure, sous les paliers du limiteur (15/s, 100/min, 2000/h), même compté deux fois.
- Latence du rejeu L20 (20 ms par réponse amont). Chauffe 10 s, mesure 5400 s.

## Commandes et ordre
Avec `ROUTE_OUT` (répertoire du banc) et `ROUTE_DATA` (3 fichiers séparés par « : ») :
1. Avant chaque passe : `route.sh down` vérifié, disque libre, `MemAvailable`, charge et CPU 0,1
   des autres processus relevés banc arrêté pendant 60 s.
2. `route.sh load4 a2 20 diag 5400` (limiteur 6.5.0, tas 4096).
3. Correction du limiteur (amendement 2) : `@nestjs/throttler` ^6.7.1 installé depuis le registre,
   `throttler-expiry-repro.js` avec le tas par défaut puis 4096, `tools.py limiter-accept` (écrit
   `campaign-v4/limiter-acceptance.json`) ; si accepté, Jest et typecheck du backend, commit.
   Dans tous les cas : `route.sh load4 a2c 20 1 5400`.
4. `route.sh load4 r2 20 1 5400`.
5. `route.sh compress4` après chaque passe, puis `tools.py summary4 campaign-v4/results.jsonl`.
Une passe à la fois, jamais deux cibles en charge en même temps. Reprise unique : `rep` 2.

## Conditions d'arrêt
Vérifiées chaque seconde : OOM dans le cgroup, cgroup disparu, `MemAvailable` < 1 Gio, disque
libre < 2 Gio, disparition d'un processus mesuré. Ni le taux d'erreur ni l'absence de réponse
n'arrêtent une passe v4 : une défaillance de l'application doit rester mesurée.

## Issues d'une passe (`run4`)
- **Défaut du banc** : collecte (série absente, trou > 5 s dans l'échantillonnage, > 30 s dans le
  générateur ou la sonde, sonde interrompue avant la fin de Node, instantané cgroup absent ou
  illisible, journal vide) ; contrôles (amont erroné, compte du journal Caddy hors
  [réussies, émises], rejeu avec clé absente ou en-tête différent, processus étranger dans le
  cgroup) ; arrêt sur `MemAvailable`, disque, cgroup disparu, Caddy ou Redis disparu. Si aucune
  défaillance fatale n'est constatée : générateur en retard (p99 > 10 ms) ou CPU des voisins
  > 10 %.
- **Défaillance de l'application** (résultat de capacité) : OOM, Node ou Rust disparu, moins de
  99 % des requêtes prévues servies en 200, ou une fenêtre complète de 10 min sous 95 %.
- **Complet** sinon. Un OOM d'A2 avec une collecte valide est un résultat, pas un défaut du banc.

## Diagnostic du limiteur (passe a2 diag)
La garde s'exécute deux fois par requête de la route dans Node. Avec 6.5.0, chaque coup crée une
minuterie par palier ; l'hypothèse est une table du palier long (1 h) qui croît sans purge
effective et dont l'expiration coûte, au-delà de 3600 s.
- **D1** (cardinalité) : à 3500 s, minuteries du palier long ≥ 0,9 × 2 × requêtes achevées.
- **D2** (effet), un des trois : CPU du cgroup par requête OK de [3700, 5400] ≥ 1,15 × celle de
  [2400, 3600] ; temps de GC par seconde ≥ 2 × ; ou OOM, Node mort après 3600 s, avec un tas
  utilisé au dernier relevé supérieur à celui du dernier relevé avant 3600 s.
- Défaut démontré seulement si D1 et D2. Sinon l'hypothèse reste une hypothèse et a2c garde le
  limiteur 6.5.0. Amendement 2 : D1 vrai, D2 faux tel que défini, défaut établi par le test isolé.

## Indicateurs
- Régime à partir de 600 s ; fenêtres de 10 min. Mémoire : médiane de `memory.current` du cgroup
  à partir de 3600 s, `memory.peak` en fin de charge, pente de `memory.current` sur les 1800 s
  finales (fenêtre observée seulement). RSS par processus publié à part, jamais additionné au
  cgroup.
- CPU ms/req OK : cgroup + Caddy + Redis, rapporté aux réponses 200 ; CPU du cgroup seul publié.
- Latences p50, p95, p99, max de la passe depuis l'heure prévue (et, à part, depuis l'émission) ;
  par fenêtre, médiane des p95 et p99 des relevés de 10 s du générateur. Débit servi ; erreurs et
  statuts.
- CPU des voisins (seuil) : occupation des CPU 0,1 sur la passe, moins le cgroup et les fils
  noyau. Par fenêtre, la même occupation moins le seul cgroup, borne haute publiée.

## Décision (`summary4`, déclarée avant mesure)
- Référence : a2c (amendement 1) ; la passe diag est rapportée à part (diagnostic du limiteur et
  attribution de l'OOM). Paire : a2c et r2. Défaut du banc dans la paire : une reprise, puis plus
  aucune ; les deux essais sont gardés.
  Un résultat défavorable valide ne donne lieu à aucune nouvelle passe.
- Amendement 2 : limiteur d'a2c attendu = celui accepté par `limiter-accept`, sinon celui de la
  passe diag. Dans ce dernier cas, une référence défaillante donne **mesures inconclusives sur la
  capacité** (défaut démontré du limiteur, non corrigé), et toute autre conclusion porte la mention
  « référence portant le défaut démontré du limiteur, non corrigé ».
- Par indicateur (mémoire courante, pic, CPU ms/req OK, p95, p99), si les deux passes sont
  complètes : écart sous max(10 %, plancher) → « pas de différence démontrée » (planchers : 10 Mo,
  0 ms CPU, 1 ms de latence) ; au-delà, fenêtres de 10 min du régime disjointes → « r2 inférieur »
  ou « r2 supérieur » ; recouvrantes → inconclusif. Le pic est une valeur unique : son sens suffit.
- Conclusions, dans cet ordre :
  - défaut du banc après la reprise → **mesures inconclusives** ;
  - amont erroné, défaillance de r2, ou erreurs propres à r2 → **R2 non validé** ;
  - pente r2 au-delà de 1,0 Mo/min → **mesures inconclusives** ;
  - référence défaillante, r2 complet → **R2 validé, bénéfice de capacité** à ce débit et dans
    cette fenêtre ;
  - erreurs dans les deux, ou indicateur inconclusif → **mesures inconclusives** ;
  - mémoire courante et pic « r2 inférieur », sans CPU, p95 ni p99 « r2 supérieur » →
    **R2 validé et bénéfice démontré** ;
  - sinon → **R2 conforme mais bénéfice insuffisant**.
- Toute conclusion est subordonnée au contrat final. Aucune ne vaut activation en production,
  preuve de correction du crash de production, ni décision de réécrire l'application en Rust.
  Aucun pourcentage hors valeurs mesurées.

## Limites
- VM partagée : voisins mesurés, non éliminés. HTTP sans TLS entre générateur et Caddy.
- Une seule paire : pas de dispersion entre passes ; les fenêtres de 10 min en tiennent lieu.
- Node du banc limité à la route et à ses tâches ; son niveau de base n'est pas celui de la
  production. Rust à 1 fil de travail. Données rejouées, latence amont constante.

## Écarts connus au gel
- Rédigé après la mise au point des outils v4 (test d'arrêt `kill-test-v4/`, 70 s) ; ses chiffres
  ont été vus et sont exclus. Les CPU 0,1 y portaient 14,4 % de CPU des voisins, au-dessus du seuil
  et des valeurs v3 (1,6 à 8,1 %), sans cause établie : d'où le relevé banc arrêté avant chaque
  passe.
- Seuils et durées de `tools.py` (`WINDOW_S` à `D2_GC_RATIO`) écrits pendant cette mise au point,
  avant toute passe de 5400 s.

## Amendement 1 (2026-10-22, pendant la passe diag, avant tout résultat)
- Constat : le protocole figeait `--max-old-space-size=4096` pour Node. L'image déployée n'en fixe
  pas (`Dockerfile` : `NODE_OPTIONS` seulement dans l'étage `installer` ; étage `runner`, fichiers
  compose de PROD et de PREPROD, et images locales sans `NODE_OPTIONS`, vérifié aussi sur
  `origin/main` `9ca6fc867`). Sous un cgroup de 2 Go, Node 24 sans option plafonne le tas à
  1 174 405 120 octets ; avec 4096, à 4 395 630 592, plus du double du cgroup. Le fichier
  d'environnement de PROD n'a pas été lu : une valeur qu'il fixerait reste inconnue.
- Décision : la passe diag continue sans changement (configuration de l'OOM v3) pour D1, D2 et
  l'attribution de l'OOM ; la référence devient a2c dans tous les cas, Node lancé comme l'image ;
  r2 lance le même Node. Durées, débit, seuils, fenêtres, reprise et ordre des conclusions
  inchangés.
- Écrit à 19:09:46 (heure de Paris) dans `ROUTE_OUT/campaign-v4/AMENDMENT-1.md` (sha256
  `1b1968c2334f4728f8f5ac00ecd5ec6f4f10c94713008c0c0b06ad70fa0101ae`), mesure jointe
  `heap-default-2G.json`. Vu à ce moment : compteurs de progression et un relevé de la sonde à
  510 s de la passe diag ; aucun résultat de décision, aucune passe r2.

## Amendement 2 (2026-10-22, après la passe diag, avant toute passe a2c ou r2)
- Constat : passe `a2-L20-diag` (commit 2149e3cf1, tas 4096, limiteur 6.5.0) en défaillance de
  l'application : OOM dans le cgroup des cibles (`memory.events.local` : `oom_kill` 1), Node
  disparu à 3602 s. D1 vrai (560 596 minuteries du palier long pour 280 394 requêtes achevées au
  relevé de 3494 s). D2 faux tel que défini : Node mort avant la fenêtre [3700, 5400], et le
  dernier relevé de la sonde (3584,8 s) précède 3600 s. La sonde tourne dans la boucle de Node,
  qui s'est bloquée : elle ne pouvait pas observer ce mode de défaillance. L'échantillonneur
  (hors processus) relève le RSS de Node à 1334 Mo à 3589 s, puis 2028 Mo à 3601 s, et la
  progression du générateur se fige.
- Mécanisme (code de 6.5.0) : une minuterie par coup ; à chaque expiration, la liste des
  minuteries du palier, toutes clés confondues, est recopiée par `filter`, soit un coût O(N) par
  expiration à partir de 3600 s. Test isolé `throttler-expiry-repro.js` (576 000 coups du palier
  long sur 8192 clés, puis expirations et nouveaux coups à 160/s, sans réseau) : avec 6.5.0, après
  le début des expirations, relevés espacés jusqu'à 101 060 ms (tas par défaut) et 103 285 ms
  (tas 4096), 184 et 180 nouveaux coups traités en environ 151 et 155 s, RSS jusqu'à 694 et
  1217 Mo. Défaut démontré pour les deux plafonds de tas.
- Décision : le mandat demande de corriger un défaut Node simple démontré avant la comparaison
  finale, ce qui prime sur la porte D1 ∧ D2. Correction : `@nestjs/throttler` ^6.7.1 du registre
  (expirations par clé, sans minuterie par coup), sans modification du code. Acceptation fixée
  avant toute mesure de 6.7.1 (`limiter-accept`, constantes `REPRO_*`) : pour le tas par défaut et
  4096, aucun écart entre relevés au-delà de 2000 ms, au moins 90 % des nouveaux coups prévus
  traités, 60 s observées après le début des expirations, remplissage complet et version mesurée
  égale à la version installée ; appliquée à 6.5.0, elle refuse les deux essais.
- Si la correction est refusée par le critère ou n'est pas installée, a2c garde 6.5.0 et la règle
  de la section « Décision » s'applique. La passe diag n'est pas rejouée. Durées, débit, seuils,
  fenêtres, reprise et ordre des conclusions inchangés.
- Écrit dans `ROUTE_OUT/campaign-v4/AMENDMENT-2.md` (empreinte dans `AMENDMENT-2.sha256`) ; mesures
  dans `campaign-v4/limiter-repro/`. Vu à ce moment : le résultat complet de la passe diag et les
  deux essais 6.5.0 du test isolé ; aucune passe a2c ou r2, aucune mesure de 6.7.1.

## Amendement 3 (2026-10-22, après la passe a2c, avant toute passe r2)
- Constat : passe `a2c-L20-1` classée « banc » par un seul motif, « processus étrangers dans le
  cgroup : ['sleep'] ». Données brutes (`sample-series.jsonl`) : 542 relevés de processus (541
  pendant la mesure et l'instantané pré), chacun avec exactement un `sleep` du shell témoin. 541
  ont la ligne de commande `sleep 1`. Un seul, au relevé de 1540 s (pid entre ceux des `sleep 1`
  voisins), a le nom `sleep` et une ligne de commande vide : le noyau ne la donne plus pour un
  processus en sortie. `tools.py` prenait alors le nom seul comme clé, et la liste des admis ne
  reconnaît que `sleep 1`. Le témoin admis a été compté comme étranger.
- Correction (`tools.py`, `CGROUP_EXITING`) : un processus sans ligne de commande est compté sous
  la clé `<nom> (en sortie)`, qui reste visible dans `cgroup_procs_seen`. Il n'est admis que si son
  nom noyau est celui d'un composant déclaré : `bash`, `sleep`, `MainThread` (fil principal de
  Node, relevé au test d'arrêt) ou `vehicle-models-` (nom de `vehicle-models-route` tronqué à 15
  caractères, vérifié sur une copie renommée de `sleep`). Tout autre nom reste étranger.
  L'échantillonneur n'est pas modifié : il est le même pour a2c et r2. Une cible disparue reste
  détectée par l'absence de son RSS, pas par cette liste.
- a2c est réévaluée par `tools.py run4` sur ses fichiers bruts, sans nouvelle passe. Le résultat et
  la ligne d'origine sont gardés (`result-before-amendment-3.json`,
  `results.jsonl.before-amendment-3`). Durées, débit, seuils, fenêtres, reprise et ordre des
  conclusions inchangés.
- Vu à ce moment : la ligne de synthèse et `result.json` de la passe a2c ; aucune passe r2.

## Amendement 4 (2026-10-23, après la paire a2c/r2, avant toute passe de la version corrigée)
- Constat : la paire `a2c-L20-1` / `r2-L20-1` (commit `2a242e490`, `vehicle-models-route` `16a5a8a6…`,
  `backend/dist` `f2c349e3…`, `@nestjs/throttler` 6.7.1) mesurait des limiteurs tenus dans la mémoire
  de chaque processus. Le test mixte (`ROUTE_OUT/limiter-mixed-v4/README.md`) montre qu'en sélection
  rust une même adresse dispose d'un budget dans R2 et d'un autre dans Node pour le contexte Remix
  (palier short : 15 R + 15 O servies, contre 15 au total en sélection node).
- Correction, hors de ce protocole : commits `22cb0cc7a` (Node : `RedisThrottlerStorage`, option
  `storage` de `ThrottlerModule`), `b646dd0a8` (R2 : mêmes clés et même script, dans le même Redis) et
  `350e09ba9` (attendu de l'étape budget du contrat). Chaque requête soumise au limiteur ajoute des
  appels Redis : un `EVALSHA` par palier et par contexte dans Node (8 pour la route, séquentiels), un
  seul pour les 8 entrées dans R2. Les compteurs passent de la mémoire des cibles à Redis (jusqu'à 1 h
  pour le palier long). Node et R2 ouvrent chacun une connexion Redis de plus.
- Décision : nouvelle paire sur les binaires de `b646dd0a8` (`vehicle-models-route` `b6d5bcd3…`,
  `backend/dist` `2fcdbf66…`, `loadgen` et `replay` inchangés), avec
  `ROUTE_CAMPAIGN4=ROUTE_OUT/campaign-v4-limiter` : `route.sh load4 a2c 20 1 5400`, puis
  `route.sh load4 r2 20 1 5400`, `compress4` après chaque passe, puis `summary4`. Le `results.jsonl` de
  ce répertoire commence par la ligne de la passe diag, recopiée telle quelle, et
  `limiter-acceptance.json` y est recopié (empreintes dans `AMENDMENT-4.md`) : la passe diag n'est pas
  rejouée et `summary4` est inchangé. Avant la paire : vérifications fonctionnelles du limiteur et
  contrat final sur ces binaires. Durées, débit, seuils, fenêtres, reprise unique et ordre des
  conclusions inchangés. Un résultat défavorable valide ne donne lieu à aucune nouvelle passe.
- Les conclusions de la première paire restent publiées pour les binaires qu'elle a mesurés et ne
  valent pas pour la version corrigée ; celles de la nouvelle paire valent pour la seule version
  corrigée.
- Rapporté à part, sans effet sur la conclusion :
  - Redis : RSS médian à partir de 3600 s (`rss_mb_by_proc.redis`), `used_memory` et `dbsize` en fin de
    charge (`redis-end.txt`). Son CPU est déjà compté dans CPU ms/req OK.
  - Écart avec la première paire : pour a2c, puis pour r2, `compare4` de `tools.py` (mêmes seuils,
    mêmes fenêtres) entre la passe de la première paire (référence) et celle de la version corrigée.
    Les deux passes sont séparées dans le temps sur une VM partagée, voisins relevés : un écart est
    rapporté comme observé entre ces deux passes, sans être attribué au seul correctif.
- Vu à ce moment : Jest et `cargo test` du correctif (Redis jetable compris), `clippy`, empreintes des
  nouveaux binaires ; aucune exécution au banc des nouveaux binaires.
