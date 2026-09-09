# Rebuild TecDoc par vagues — environnement, dimensionnement, plan

> **Date** : 2026-09-08, révisé 2026-09-09 · **Base** : `33d0049` (PR #1418 mergée)
> **Statut** : environnement **GO** sur la machine existante. Le rejeu complet des
> 110 DLNR **n'est pas lancé**.
>
> Ce document ne consigne aucun état de secret : ce dépôt est public.

---

## 1. Correction du dimensionnement — de 250 Go à ~5 Go

La première version de cette spécification exigeait un volume dédié de **250 Go** et
concluait `NO_GO`. Ce chiffre ne venait pas des données : il venait d'une hypothèse non
soumise — **matérialiser les 110 DLNR simultanément** dans une seule instance.

Or l'invariant à démontrer — `PROD actuelle ⊆ REBUILD source-truth`, sans perte de ligne
ni dérive d'identité — se vérifie **DLNR par DLNR**. On rejoue un fournisseur, on le
réconcilie, on scelle la preuve, **puis on jette la matière**. Le pic disque devient celui
du plus gros fournisseur seul, pas leur somme.

**Mesure réelle** (rejeu HIDRIA, PostgreSQL 17 jetable) : `2 654 208` octets pour
`13 057` lignes, index compris → **203 octets/ligne**.

| | lignes source | occupation en base |
|---|---:|---:|
| FEBI (DLNR 101) — cas dimensionnant | 17 421 432 | 3,3 Go |
| BOSCH (DLNR 30) | 9 357 752 | 1,8 Go |
| VALEO (DLNR 21) | 6 369 779 | 1,2 Go |

```
pic en base (FEBI seul) ........... 3,3 Go
+ CSV de parsing (transitoire) .... 1,5 Go
+ archive 7z (déjà présente) ...... 5,8 Go, non dupliquée
PIC ESTIMÉ ....................... ~5 Go
libre sur / aujourd'hui .......... 39 Go        → GO
```

Un volume de 250 Go n'est nécessaire **que** si l'on souhaite conserver un rebuild
matérialisé à inspecter après coup. Pour démontrer l'invariant, les preuves suffisent.

## 2. Ce que le rejeu par vagues démontre — et ce qu'il ne démontre pas

**Démontré, au niveau RAW (`tecdoc_raw.t400`)** : aucune ligne source n'est perdue
(comptabilité vérifiée avant commit), la PROD est incluse dans le rejeu, les registres
d'identité ne bougent pas, les 9 ensembles figés sont intacts. C'est exactement là que la
perte de mars 2026 s'est produite.

**Non démontré** : rien sur la projection `source_linkages`. Aucun projecteur vérifié
n'existe à ce jour — les projecteurs historiques sont en quarantaine, dont celui qui a
pollué `pieces_relation_type` de ~219 M lignes fantômes. Ce sera un chantier séparé.
Annoncer ici une preuve de projection serait le vert-mais-faux que ce pipeline combat.

## 3. Le registre de preuve

Puisque la matière est jetée, **la preuve est le livrable**. Chaque DLNR y laisse :

```json
{ "dlnr": 4523, "fichier": "400.4523.sql", "batch_id": "5df6aa47…",
  "comptabilite":       { "rows_emitted": 13057, "rows_loaded": 13057,
                          "rows_deduplicated": 0, "rows_rejected": {} },
  "empreinte_du_charge":{ "lignes": 13057, "borne_min": 1, "borne_max": 13057,
                          "empreinte_md5": "0f46f853577f32c79303bc8505e034ca" },
  "reconciliation":     { "identites_conservees": 13057, "conflits": 0,
                          "inclusion_respectee": true } }
```

Le registre est **scellé** (SHA-256, canonicalisation identique aux autres artefacts).
Vérifié : falsifier une seule valeur fait diverger le sceau. Une preuve qu'on peut
réécrire n'en est pas une.

L'empreinte du contenu chargé survit à la purge : elle permet de constater qu'un second
rejeu produit exactement le même contenu, sans conserver la donnée.

## 4. Fail-closed — ce qui se passe quand ça casse

Toute anomalie arrête la vague et **ne purge pas** le DLNR fautif : sa matière reste en
base pour le diagnostic. Un DLNR n'est purgé que **lorsque sa preuve est écrite**.

| Situation | Code | Effet |
|---|---:|---|
| Comptabilité déséquilibrée | 5 | rollback du DLNR, vague arrêtée |
| Dérive d'identité | 6 | vague arrêtée |
| Conservation rompue | 7 | vague arrêtée |
| Inclusion PROD ⊄ REBUILD | 8 | vague arrêtée, **matière conservée** |
| Purge non confirmée | 9 | vague arrêtée |

Éprouvé : `test-tecdoc-replay.sh` — **35 assertions, 0 rouge**, dont la vague nominale
avec purge, la relance idempotente, l'inclusion rompue et la conservation de la matière
sur échec.

Trois de ces assertions portent sur la **preuve elle-même**, pas sur le chargement :

- les **13 champs** du contrat de registre sont présents et non nuls — une preuve
  incomplète est une preuve qu'on ne peut pas refaire ;
- la **partition de la réconciliation** : tout ce que le rejeu produit est soit déjà
  identique en PROD, soit en quarantaine ; aucune troisième catégorie silencieusement
  activable ;
- le **sceau est un vrai sceau** — recalculé sur le contenu il concorde, recalculé après
  modification d'une seule valeur (`rows_loaded += 1`) il diverge. Sans cette seconde
  moitié, le sceau n'atteste que de lui-même.

## 5. Environnement

```
archive TecDoc (SQL-CONVERTED.7z, 5,8 Go)
        ↓  extraction + CRC32 confronté au périmètre scellé
PostgreSQL 17 isolé — 127.0.0.1 uniquement, aucun accès PROD
        ↓  tecdoc_replay.py (fail-closed)      un DLNR
        ↓  tecdoc_replay_controls.py           réconciliation + identité
        ↓  registre scellé                     la preuve
        ↓  purge vérifiée                      la matière repart
        ↺  DLNR suivant
```

| Contrainte | Mise en œuvre | Vérifiée par |
|---|---|---|
| PostgreSQL 17 | `postgres:17-alpine` (17.11 constatée) | contrôle final du provisionnement |
| Isolé | `-p 127.0.0.1:<port>:5432` | `provision-rebuild-env.sh` |
| Jetable | tout l'état sous le point de montage | — |
| Aucun accès PROD | refus si une variable d'accès PROD est exportée | garde §2 du script |
| Capacité | deux modes, deux seuils, deux périmètres physiques — refus en dessous | `check-rebuild-capacity.sh`, banc `test-check-rebuild-capacity.sh` |

`provision-rebuild-env.sh` reste utilisable tel quel. Le mot de passe local est généré
sur place, `0600`, jamais affiché.

**La porte de capacité a deux modes**, parce que les deux stratégies de rebuild ont des
besoins disque de nature différente et qu'une porte unique ne peut pas juger les deux
honnêtement. Desserrer le seuil du mode matérialisé pour faire passer un rejeu par vagues
masquerait le besoin réel du premier.

| | `materialise` (défaut) | `vagues` |
|---|---|---|
| Sélection | `TECDOC_REBUILD_MODE` non défini | `TECDOC_REBUILD_MODE=vagues` |
| Besoin disque | la **somme** des 110 DLNR | le **plus gros DLNR seul** |
| Cible par défaut | `/mnt/tecdoc-rebuild` | `/` (stockage Docker) |
| Seuil de refus | `TECDOC_REBUILD_MIN_GO` — **210 Go** | `TECDOC_REBUILD_VAGUE_MIN_GO` — **20 Go** (4× le pic mesuré) |
| Cible de provisionnement | `TECDOC_REBUILD_CIBLE_GO` — 250 Go | sans objet |
| Volume dédié obligatoire | **oui** | **non** |
| Mode inconnu | refusé, code 2 — jamais interprété | idem |

L'exigence de volume dédié n'a jamais protégé de la *taille* mais du *blast radius* : un
rebuild de ~139 Go qui remplit `/` arrête le runtime DEV et la session opérateur. Un pic
de ~5 Go ne menace pas `/`, donc la lever en mode vagues n'assouplit rien — l'imposer
reviendrait à refuser précisément les configurations bien dimensionnées. Le seuil des
vagues reste une **vraie porte** : sous 20 Go libres, elle rend `NO_GO` et chiffre le
manque.

Cette double-lecture est le risque propre à une porte à deux modes — on la desserre par
inadvertance. `test-check-rebuild-capacity.sh` existe pour que cela se voie : **25
assertions, 0 rouge**, dont la paire décisive *même cible `/`, mode matérialisé refuse,
mode vagues accepte*, et la vérification que le refus « volume non dédié » n'existe
**que** en matérialisé.

## 6. Plan de lots

`plan-lots.json`, dérivé de l'artefact scellé, régénération déterministe vérifiée.
**110/110 DLNR couverts.**

| Lot | DLNR | Lignes source | Pic disque | Divergents |
|---|---:|---:|---:|---|
| 0 — fumée | 1 | 13 057 | < 0,1 Go | — |
| 1 | 5 | 2 179 199 | ~0,3 Go | NISSENS, PAYEN |
| 2 | 20 | 7 932 092 | ~1,1 Go | RIDEX |
| 3 — lourds isolés | 2 | 26 779 184 | ~3,3 Go | BOSCH, FEBI |
| 4 | 30 | 9 404 364 | ~0,5 Go | — |
| 5 | 30 | 25 567 877 | ~1,2 Go | — |
| 6 | 22 | 59 056 373 | ~1,2 Go | — |

Le pic est celui du **plus gros DLNR de chaque lot**, la matière étant purgée entre
chacun. Les 5 divergents arrivent tôt et par poids croissant : ce sont les cas de
non-régression prioritaires, et les découvrir tard reviendrait à trouver un défaut après
des heures de rejeu.

## 7. Cibles de non-régression des 5 divergents

| DLNR | Fournisseur | t400 PROD | Source émise | Delta attendu | Chargé en mars |
|---:|---|---:|---:|---:|---:|
| 123 | NISSENS | 100 | 790 974 | +790 874 | 0,01 % |
| 30 | BOSCH | 69 000 | 9 357 752 | +9 288 752 | 0,74 % |
| 101 | FEBI | 2 558 500 | 17 421 432 | +14 862 932 | 14,69 % |
| 6358 | RIDEX | 2 323 000 | 5 662 767 | +3 339 767 | 41,02 % |
| 113 | PAYEN | 1 085 500 | 1 259 429 | +173 929 | 86,19 % |
| | **Total** | **6 036 100** | **34 492 354** | **+28 456 254** | |

Les préfixes tronqués de `t400` sont de la **vérité forensique historique**, jamais une
cible.

## 8. Rotation d'un identifiant de base — procédure vérifiable

`scripts/verifier-rotation-secret.py` établit mécaniquement qu'une rotation a eu lieu.
Une rotation n'est pas prouvée parce qu'on l'a faite : elle l'est quand **l'ancien
identifiant est refusé** *et* que le nouveau fonctionne.

```bash
python3 scripts/verifier-rotation-secret.py \
  --env /chemin/vers/backend/.env --commit <sha> --chemin <fichier>
```

| Sortie | Signification |
|---|---|
| `ROTATED` (0) | ancien refusé en `28P01`, nouveau accepté |
| `ROTATION_FAIL` (1) | l'ancien ouvre encore la base |
| `BLOCKED_BY_SECRET_ROTATION` (2) | actif == publié, rien n'a changé |
| `INDETERMINE` (3) | une vérification n'a pas pu être menée — jamais supposée |

Aucune valeur n'est affichée, journalisée, passée en `argv` ni écrite : seules des
empreintes SHA-256 tronquées à 12 hexadécimaux apparaissent. La référence du blob publié
est fournie **à l'exécution** et n'est pas inscrite dans le dépôt — l'y figer en ferait un
panneau indicateur.

Le distinguo refus d'authentification / panne réseau est **éprouvé** : un `INDETERMINE`
est rendu si l'ancien identifiant échoue autrement qu'en `28P01`, parce qu'une coupure
réseau ressemble à un refus sans en être un.

Ordre des opérations, une fois le nouvel identifiant en place :

1. mettre à jour le `.env` de la machine opérateur ;
2. mettre à jour le secret CI correspondant (saisie interactive) ;
3. lancer le vérificateur → doit rendre `ROTATED` ;
4. **alors seulement**, supprimer les copies locales que le vérificateur inventorie —
   les purger avant la rotation détruirait une sauvegarde d'un identifiant encore en
   service, sans rien réduire.

### 8.1 Exécuter la rotation — pourquoi l'API et pas `ALTER USER`

`scripts/tourner-secret-db.py` exécute la rotation ; `verifier-rotation-secret.py` la
constate après coup. Les deux sont séparés à dessein : un outil qui juge son propre
travail ne prouve rien.

Le mot de passe de la base vit à **deux endroits** : le rôle PostgreSQL, et
l'identifiant que le pooler (Supavisor) conserve côté plan de contrôle pour ouvrir ses
connexions amont. Un `ALTER USER` émis en direct ne change que le premier — le pooler
garde l'ancien et cesse de fonctionner. Sur une base qui sert du trafic, c'est une
coupure du site. `PATCH /v1/projects/{ref}/database/password` est l'opération
qu'appelle le bouton du tableau de bord : elle change les deux ensemble. C'est la
seule voie qui laisse le système cohérent, et c'est pour ça que l'outil n'expose pas
de chemin SQL.

Ordre des étapes, choisi pour qu'aucune panne ne verrouille la base :

| # | Étape | Ce qu'elle protège |
|---|---|---|
| 0 | le jeton porte-t-il la permission voulue ? (`GET`, lecture seule) | un jeton absent ou erroné ne laisse aucun secret orphelin derrière lui |
| 1 | prouver qu'un identifiant de référence ouvre la base | sans lui, on ne pourra pas prouver qu'il cesse de fonctionner |
| 2 | engendrer et déposer en `0600` **avant** tout changement | un plantage ne peut pas perdre le nouveau secret |
| 3 | appeler l'API | — |
| 4 | nouveau accepté **et** ancien refusé en `28P01` | un `200` de l'API n'est pas une preuve de rotation |
| 5 | écrire le `.env`, atomiquement, après sauvegarde | le `.env` ne devance jamais l'état réel de la base |

Codes de sortie : `0` rotation prouvée · `2` état de départ inexploitable · `3` erreur
d'E/S · `4` le changement n'a pas pris · `5` l'ancien est encore accepté · `6` l'API a
refusé. Aux codes 2, 4, 6 le `.env` n'est pas touché — vérifié par le banc.

**Permission requise sur le jeton : « Database Config », en lecture-écriture.** C'est
elle qui porte `v1-update-database-password`. Un jeton classique (accès complet du
compte) convient aussi, mais un jeton restreint est préférable et se révoque après usage.

L'étape 0 interroge `GET /v1/projects/{ref}/config/database/postgres`, et ce choix n'est
pas anodin : `GET /v1/projects/{ref}` relève de « Project Settings », pas de « Database
Config ». Une première version l'utilisait — un jeton correctement restreint à la tâche
aurait donc été refusé par le préflight lui-même. **Une garde doit éprouver la même
permission que ce qu'elle précède**, sinon elle bloque exactement les cas les mieux
configurés.

**Le client HTTP doit s'annoncer.** Sans `User-Agent` explicite, `urllib` s'annonce
`Python-urllib/3.x` — signature bannie par le pare-feu applicatif devant l'API, qui rend
`403 · error code: 1010`. Mesuré, même jeton (faux) :

| Client | Réponse |
|---|---|
| `urllib` par défaut | `403` · `error code: 1010` |
| `urllib` + `User-Agent` | `401` · `JWT could not be decoded` |
| `curl` | `401` · `JWT could not be decoded` |

Le piège est que le `403` sort **à l'identique pour un jeton valide et pour un jeton
bidon** : la requête n'atteint jamais l'API, et un diagnostic naïf accuse le jeton. C'est
arrivé en conditions réelles, et le message du script a envoyé chercher du côté des
permissions un défaut qui était dans le client HTTP.

Deux gardes en découlent : toute requête porte l'en-tête (assertion de couverture au
banc, pour qu'une requête ajoutée plus tard ne rejoue pas l'incident), et **une réponse
qui n'est pas du JSON est imputée au pare-feu, jamais au jeton** — l'API répond en JSON,
le filtrage en amont non.

Le diagnostic ne sur-affirme pas non plus sur le reste : le script nomme la permission
attendue et montre la réponse, plutôt que d'envoyer chercher au mauvais endroit.

**Saisie du jeton — pourquoi le script le demande lui-même.** La voie évidente était
`read -rs VAR && export VAR` puis la commande. Elle échoue silencieusement : `read` lit
l'entrée standard, donc un collage multi-lignes lui fait avaler la ligne suivante au lieu
d'attendre la frappe, et la variable part **vide**. L'erreur se relit alors comme « jeton
refusé » alors qu'il n'a jamais été saisi. Constaté deux fois de suite en conditions
réelles.

Ajouter `< /dev/tty` corrige le symptôme mais laisse la cause : un état de shell à porter
d'une commande à l'autre, donc un ordre à respecter et une session à ne pas changer. Le
script **demande le jeton directement** (`getpass`, saisie masquée sur `/dev/tty`) — plus
d'`export`, plus d'ordre, la classe d'erreur entière disparaît. `SUPABASE_ACCESS_TOKEN`
reste lu en priorité pour l'usage non interactif ; sans terminal *et* sans variable, le
script sort en `3` en nommant la voie non interactive plutôt qu'en ouvrant une saisie
qui resterait suspendue.

Le jeton d'API est lu dans `SUPABASE_ACCESS_TOKEN`, jamais dans un fichier de
configuration ni en `argv`. Le script ne contient aucune référence de projet, de dépôt
ni de chemin de secret : tout est paramètre, pour que sa présence dans un dépôt public
ne désigne rien.

`scripts/test-tourner-secret-db.sh` — **23 assertions, banc hermétique**. Un
PostgreSQL jetable, l'API remplacée par un double qui applique réellement le
changement. Sont vérifiés le cas nominal, les trois refus (2, 6, clé absente), la
préservation des autres lignes du `.env`, le contenu de la sauvegarde, et surtout que
le secret **n'apparaît jamais** dans la sortie — seulement trois empreintes de douze
hexadécimaux.

### 8.2 Le point d'entrée direct n'est pas utilisable ici

Mesuré : `db.<ref>.supabase.co:5432` ne résout plus qu'en IPv6 et **refuse activement**
la connexion (RST immédiat, pas un délai d'attente), route IPv6 valide côté appelant.
Le pooler répond sur les deux ports, en mode session comme en mode transaction.

Conséquence pratique : la vérification comme la rotation passent par le pooler, avec
l'utilisateur au format `postgres.<ref>`. Une erreur de région se signale par
`ENOTFOUND tenant/user … not found` — c'est un message de routage, **pas** un refus
d'authentification, et le confondre avec un `28P01` ferait conclure à une rotation
réussie alors qu'on frappe la mauvaise porte.

Les scripts du dépôt qui ouvrent une connexion directe sont à recenser séparément :
c'est une dette distincte de la rotation, et elle ne doit pas la retarder.
