# Rapport complémentaire — Mandat AN (décisions 5, 44, 61 et 75 du 16/11/2026)

> Complément au livrable AN (PR #2088, brouillon), dans la même PR.
> Mêmes interdits que le mandat AN :
> - rien d'activé, rien d'envoyé, rien en PROD ;
> - aucune écriture en base : `SELECT` seulement, dans une transaction en lecture seule ;
> - identifiants de commande seulement, aucune donnée personnelle de client ;
> - zones STOP (panier, commande, paiement) en lecture seule.
>
> Requêtes SQL entre 2026-11-16T07:42Z et 07:46Z.

## En bref

| # | Demande | Résultat | État |
|---|---|---|---|
| 1 | Relance à 1 h et 24 h, puis plus rien ; drapeau éteint | Cadence codée et testée. Le drapeau `ABANDONED_CART_EMAIL_ENABLED` vaut `false` par défaut ; il est relu à la détection **et** à l'envoi. | corrigé dans la candidate, testé ; ni intégré ni activé |
| 2 | Textes sans urgence non fondée | « Les stocks sont limites », « Derniere chance », « expire », « supprime » et « vous attend » sont retirés. Deux textes sobres remplacent les trois anciens. | corrigé dans la candidate, testé ; rien envoyé |
| 3 | Frais de port | Confirmé par le code : le port est calculé, affiché avant paiement et inclus dans le montant Paybox. **Aucun supplément de port après paiement**, ni dans le code ni en base depuis le 01/04 (0 cas). Le calcul ignore la zone (Corse, outre-mer, étranger) : 2 commandes concernées depuis avril, aucune payée. | constaté, rien modifié |
| 4 | Mesure sans comptes de test ni doublons | Le taux brut est de **60 % (33/55)**. Mesure corrigée : **40 % (12 sur 30 intentions d'achat)**, et **22 % (4/18)** depuis le 15/07. | proposé (mesure) |

**Rien n'est activé.** Même avec le drapeau allumé, aucun e-mail ne partirait aujourd'hui, pour deux raisons :
- aucun code n'alimente la liste des paniers candidats (constat AN, correctif 5 proposé, zone STOP panier) ;
- aucun des 59 197 comptes n'a de consentement marketing enregistré (décision 44).

---

## 1. Rythme de relance (décision 61)

### Ce qui change

**Fichier `backend/src/modules/cart/services/abandoned-cart.service.ts`**
- `:18` : `ABANDON_THRESHOLD_MS`, une heure sans activité. Ce seuil existait déjà, il était écrit en dur.
- `:27` : `ABANDONED_CART_SEQUENCE`, la séquence complète, en un seul endroit :

  | Étape | Délai après détection | Moment depuis l'abandon |
  |---|---|---|
  | `1h` | 0 | 1 h |
  | `24h` | 23 h | 24 h |

  Il n'y a plus d'étape `72h`.
- `:189` : la détection programme les jobs à partir de cette séquence. Avant, trois appels étaient écrits en dur : 1 h, 24 h et 72 h.
- `:226` : `sendSequenceEmail(recordId, step)`. L'envoi s'arrête dans deux cas, **avant toute lecture de l'enregistrement** :
  - le drapeau est éteint : un e-mail déjà en file ne part pas ;
  - l'étape est hors séquence : un job `72h` programmé avant ce changement ne part jamais.

**Fichier `backend/src/workers/processors/email.processor.ts:199-214`**
- Le job reçoit `step: string` et passe par `sendSequenceEmail`.

**Fichier `backend/.env.example:205-215`**
- `ABANDONED_CART_EMAIL_ENABLED=false`, avec un commentaire qui renvoie à :
  - la décision 61 ;
  - ADR-036 (consentement) ;
  - la décision 44 (base légale établie par le département 18) ;
  - la surcharge runtime existante : `PATCH /api/admin/feature-flags/ABANDONED_CART_EMAIL_ENABLED`, gérée par `admin-feature-flags.controller.ts`.
- Le drapeau existait déjà (`backend/src/config/feature-flags.service.ts:283`). Aucun nouveau drapeau n'est créé.

**Inchangé, à dessein**
- La colonne `email_72h_sent_at` et le compteur `emails_sent_72h` restent en base. Supprimer une colonne serait une migration, hors mandat.

### Ce qui reste nécessaire avant toute activation (proposé, non fait)

1. **Base légale établie par le département 18** (décision 44). Sans consentement enregistré, le filtre ADR-036 refuse chaque envoi.
2. **Brancher l'alimentation des candidats.**
   - `cart.activity` n'est émis que par `CartAnalyticsService.trackCartCreated`, qui n'a aucun appelant.
   - C'est le correctif 5 du rapport AN, en zone STOP panier : accord nominatif requis.
3. **Couper la relance quand une commande est passée après la détection.**
   - Aujourd'hui, seuls la conversion explicite et l'expiration arrêtent la séquence.
   - Proposé dans le même correctif 5, non fait.

## 2. Textes des e-mails

**Fichier modifié : `backend/src/services/mail.service.ts` (`sendAbandonedCartEmail`)**

L'objet est construit dans `abandoned-cart.service.ts`.

| Étape | Avant | Après |
|---|---|---|
| Objet 1 h | « {prénom}, votre panier de N articles vous attend » | « {prénom}, votre panier de N articles est enregistré » |
| Texte 1 h | « Votre panier vous attend ! Finalisez votre commande en quelques clics. » | « Vous avez laissé des articles dans votre panier. Il reste enregistré : vous pouvez reprendre votre commande quand vous le souhaitez. » |
| Objet 24 h | « {prénom}, vos pieces auto vous attendent » | « {prénom}, votre panier est toujours enregistré » |
| Texte 24 h | « **Les stocks sont limites.** Ne manquez pas vos pieces auto. » | « Votre panier est toujours enregistré. Ce message est le dernier que nous vous envoyons à son sujet. » |
| Objet 72 h | « **Derniere chance**, {prénom} — votre panier **expire bientot** » | supprimé (décision 61) |
| Texte 72 h | « Dernier rappel : votre panier sera **bientot supprime**. » | supprimé (décision 61) |
| Tableau | « Qte », « Sous-total : » | « Qté », « Sous-total (hors livraison) : » |
| Mention ajoutée | — | « Prix relevés au moment de l'ajout au panier ; les frais de livraison sont calculés et affichés avant le paiement. » Cette phrase est vérifiée au point 3. |
| Pied | « Vous recevez cet email car vous avez un panier en attente sur Automecanik. » | « Vous recevez cet e-mail car vous avez accepté de recevoir nos messages et un panier est enregistré sur votre compte Automecanik. » Le lien « Ne plus recevoir ces rappels » et les en-têtes `List-Unsubscribe` sont inchangés. |
| Titre | « Votre panier vous attend » | « Votre panier » |

**Pourquoi ces urgences étaient non fondées**
- « Les stocks sont limites » : le panier ne lit aucun stock.
- « expire / supprime » : la relance ne supprime aucun panier.

**Non modifié, signalé**
- Le pied commun `wrapLayout` dit « Automecanik - Pieces auto au meilleur prix » (`mail.service.ts`, vers la ligne 507).
- C'est une affirmation comparative non prouvée, mais elle est partagée par tous les e-mails du site : la changer sort du périmètre.
- À arbitrer par le décideur éditorial.

**Rien n'est envoyé** : les tests simulent `nodemailer`.

## 3. Frais de port (décision 75) — lecture seule, rien modifié

### Calcul

`backend/src/modules/cart/services/shipping-calculator.service.ts`

**Grilles**
- Grilles Colissimo 2026 lues en base : `___xtr_delivery_ape_france`, `_corse`, `_domtom1`, `_domtom2` (`:32-37`).

**Franco**
- Le port est offert dès 150 € TTC de sous-total, articles seuls (`:47`, `:182-185`).

**Poids**
- Le poids vient d'une seule source, `PiecePriceDataService.findWeightsInGrams` : même ligne tarifaire et même conversion GRM/KGM pour le panier et pour la commande.
- Un poids absent ou nul vaut 1 000 g par article, des deux côtés (`piece-price-data.service.ts:129`, `cart-data.service.ts:230-238`, `shipping-calculator.service.ts:253-256`).

**Panier affiché**
- `cart-core.controller.ts:77-86` appelle `calculateByWeight(poids, sous-total)` puis `computeShippingAndTotal` (`cart-controller.utils.ts:75`).

**Commande créée**
- `orders.service.ts:339-353` refait **le même calcul** à partir des lignes de la commande.
- `:402-403` écrit `ord_shipping_fee_ttc` et `ord_total_ttc`, qui inclut le port.

### Affichage avant paiement

**Récapitulatif**
- `frontend/app/components/checkout/CheckoutOrderSummary.tsx:103-112` affiche une ligne « Livraison » : le montant, ou « Offerte » s'il est nul.
- `:134-139` affiche le total.

**Total**
- `frontend/app/routes/checkout.tsx:751-757` : le total vient de `cart.summary.total_price`, c'est-à-dire le total renvoyé par `GET /api/cart`, port compris.

### Montant envoyé à Paybox et vérifié

- `payments/controllers/paybox-redirect.controller.ts:80` : le montant est relu en base (`ord_total_ttc`), jamais pris au navigateur.
- `payments/services/paybox-callback-gate.service.ts:172-174` : le retour Paybox est comparé à ce même `ord_total_ttc`.

### Cas hors grille ou en repli (constatés dans le code)

| Cas | Comportement | Conséquence pour le client | Fréquence depuis le 01/04 |
|---|---|---|---|
| **Zone ignorée** : le panier et la commande appellent `calculateByWeight` sans zone, donc tarif `france`. Les tarifs Corse et outre-mer existent (`determineZone`, `:151-172`), mais seuls `POST /api/cart/shipping` et `POST /api/cart/shipping/calculate` s'en servent, et aucun écran ne les appelle (`rg` dans `frontend/app` : 0 résultat). Un pays autre que la France prend aussi le tarif `france` (`:152`). | Port affiché = port facturé = tarif métropole. | Pas de supplément après coup dans le code. Écart possible entre le tarif facturé et le coût réel Colissimo, à la charge du vendeur. | **2 commandes, 0 payée** : 980 (outre-mer OM1, port 5,49 €) et 239 (Tunisie, port 11,19 €), toutes deux non payées. 0 en Corse. |
| Poids au-delà du dernier palier | Dernier palier appliqué (`:226-227`) | affiché = facturé | non mesuré (poids des commandes non historisé) |
| Plus de 30 kg | Plusieurs colis × tarif du palier (`:192-202`) | affiché = facturé | non mesuré |
| Grilles non chargées : démarrage, erreur de lecture, mode `READ_ONLY` | Forfait de 15,90 € (`:88-90`, `:216-218`), journalisé `[READ_ONLY]` ou `[RLS BLOCKED]` | Si le panier est affiché avant le chargement et la commande créée après, les deux montants peuvent différer. Le client paie alors le montant de la commande, que Paybox relit en base, et non celui vu au panier. | non mesurable en base (fenêtre de démarrage) |

### Supplément ajouté après paiement : il n'en existe pas pour le port

**Code**
- `ord_shipping_fee_ttc` et `ord_total_ttc` ne sont écrits qu'à la création : `createOrder` (`orders.service.ts:402-403`) et `createSupplementOrder` (`:1137-1138`, port **forcé à 0,00**).
- Aucune mise à jour de ces colonnes n'existe :
  - ni dans `backend/src` ;
  - ni dans les migrations : `create_order_atomic` les insère à la création, `cancel_order_atomic` ne change que le statut (`20260523_002_cancel_order_atomic.sql:67-72`).

**Seul mécanisme après paiement : `createSupplementOrder`**
- Endpoint `POST /api/admin/orders/:orderId/supplements`, `order-actions.controller.ts:274-280`.
- Il ne porte que sur une **pièce** : un équivalent plus cher remplace une pièce en rupture.
- Il crée une commande **enfant**, non payée, avec un port à 0. Le client la paie par un nouveau passage Paybox, de son fait. Ce n'est donc pas un débit ajouté.

**En base, depuis le 01/04 (55 commandes)**

| Mesure | Résultat |
|---|---|
| Commandes enfants (suppléments) | **1** : 966, enfant de 756. Supplément de pièce (sphère de suspension), port 0,00 €, annulée, **non payée**. |
| Commandes dont le total ≠ articles + consigne + port | **0** |
| Commandes payées dont le montant Paybox (`ic_postback`) ≠ `ord_total_ttc` | **0 sur 20** |
| Commandes dont le total a changé depuis l'événement `ORDER_CREATED` (`___xtr_order_history`, historique tenu depuis le 15/06) | **0 sur 38** |
| Commandes payées modifiées après paiement (`ord_updated_at`) | 6. Ce sont des passages au statut 6, « annulée par l'administration » (`command-center-kpi.service.ts:86`) : 850, 385, 972, 316, 046, 483. Le montant de chacune est resté égal au montant encaissé. |

**Conclusion**
- Depuis avril, **aucun cas** de supplément de port ajouté après paiement.
- La seule commande de supplément est un écart de prix de pièce. Elle n'a pas été payée.
- La phrase ajoutée à l'e-mail (« les frais de livraison sont calculés et affichés avant le paiement ») est exacte. Elle ne dit pas que le tarif tient compte de la zone, et il n'en tient pas compte.

**Limite**
- Un supplément demandé hors du site (téléphone, virement) ne laisse aucune trace dans ces tables. Il n'est donc pas mesurable ici.

## 4. Mesure des commandes non payées, sans comptes de test ni doublons

**Source de la correction**
- Aucun « rapport du 13 » n'existe dans le dépôt : `rg` sur `13/11`, `2026-11-13` et `20261113` dans tous les fichiers Markdown du worktree ne renvoie que ce rapport-ci.
- La correction s'applique donc à la mesure qui circule depuis le 13/11 : **33 commandes non payées sur 55, soit 60 %** (reprise en tête du rapport AN). **C'est une hypothèse.** Si le chiffre du 13 diffère, appliquer les mêmes règles à sa source.

**Règles** (script reproductible ; entrée : la liste des 55 commandes du mandat AN)

1. **Compte de test** : toutes les commandes du compte P3 sont retirées, payées comprises : 10 commandes, dont 943 et 431, payées.
   - Contrôle indépendant fait le 16/11 à 07:42Z : un filtre sur les motifs d'adresse et de nom de test sélectionne exactement ces 10 commandes, et aucune autre.
   - Aucun compte de niveau personnel (`cst_level`) n'apparaît : 43 commandes sans niveau, 12 au niveau 0.
2. **Commande hors achat** : 966 est retirée (supplément annulé).
3. **Doublon d'un achat payé** : la tentative non payée ou annulée est retirée, l'achat payé reste compté une fois.
   - Établis : 386, 174, 815, 204 et 810.
   - Probables, groupe B* du rapport AN : 284, 981 et 160.
4. **Même panier recommencé sans paiement** : une seule intention est comptée.
   - Acheteur P25, 5 commandes du 21/09 : 831 est gardée ; 129, 989, 446 et 708 sont retirées.
   - Acheteur P15 : 632 est gardée ; 781 et 892 sont retirées.

**Résultats**

| Périmètre | Intentions d'achat | Payées | Non payées | Taux non payé |
|---|---|---|---|---|
| Brut (mesure du 13) | 55 commandes | 20 | 33 | **60,0 %** |
| Corrigé, B* comptés comme doublons | 30 | 18 | 12 | **40,0 %** |
| Corrigé, B* comptés comme achats perdus | 33 | 18 | 15 | 45,5 % |
| Corrigé, depuis le 15/07 (fin de la panne du tunnel) | 18 | 14 | 4 | **22,2 %** |
| Idem, B* comptés comme achats perdus | 19 | 14 | 5 | 26,3 % |

**Lecture**
- La mesure de référence est **40 %**. Elle concorde avec les 12 acheteurs réellement perdus du rapport AN (groupes C à F).
- Depuis la fin des pannes documentées, le taux tombe à **22 %**. Les 4 commandes concernées :
  - 831 : l'acheteur aux 5 tentatives du 21/09 ;
  - 971 : un refus Paybox enregistré ;
  - 520 et 200 : sans trace.
- Effectifs faibles : un seul acheteur fait varier le taux de 5 à 6 points. Ce n'est pas un indicateur stable.

## États (5)

| Élément | Proposé | Corrigé dans la candidate | Testé | Intégré | Activé |
|---|---|---|---|---|---|
| Cadence 1 h / 24 h, étape 72 h refusée | oui | oui | oui (unitaires) | non : PR brouillon, non fusionnée | **non** : drapeau `false`, base légale absente |
| Drapeau relu à l'envoi | oui | oui | oui | non | non |
| Textes sobres | oui | oui | oui (motifs interdits absents) | non | **non** : aucun envoi |
| Alimentation des candidats et coupure à la commande | oui (correctif 5, rapport AN) | non (zone STOP panier) | non | non | non |
| Port : constat | — | aucun changement | lecture du code et SQL | — | — |
| Port : prise en compte de la zone | à décider : non demandé, zone STOP panier et commande | non | non | non | non |
| Mesure corrigée | oui | — | script rejoué | — | — |

## Preuves

**Contexte**
- Session : `6a36dc0b-7cf3-44a6-99f8-d4fc876f9d79`.
- Worktree : `/home/deploy/worktrees/claude-mandat-an-ventes-20261116`. Son `node_modules` n'est pas un lien vers `/opt/automecanik/app` (vérifié par `readlink -f` au mandat AN). Aucun `npm ci` ni `npm install` n'a été lancé.
- Branche : `docs/mandat-an-ventes-20261116`.
- Base : `9908188b380d6cf5f5d8c0b64db8544977818a13`. Commit précédent de la PR : `1190ff9ce4d89da8d61b0d06b6b09953a09b2be8`.
- Head et SHA-256 du diff : donnés dans la description de la PR et dans le compte rendu de session. Un fichier ne peut pas contenir le SHA du commit qui le contient.

**Tests** (jest de `/opt/automecanik/app`, lancé depuis le worktree via `NODE_PATH`, sans installation)
- 2026-11-16T07:40:36Z : `abandoned-cart-cadence`, `abandoned-cart-delivery-truth` et `marketing-consent-wiring` : **51/51 réussis**.

**Contrôles négatifs**
- Le service d'avant la modification échoue à 5 des 7 tests de cadence.
- Le texte d'avant la modification échoue aux 2 tests de texte.
- Méthode : copie temporaire de la version HEAD, puis restauration. Sans `git stash`.

**Contrôles statiques**
- 2026-11-16T07:41Z : `tsc --noEmit` ciblé (`backend/tsconfig.json` étendu aux fichiers modifiés et aux `.d.ts`) : code de sortie 0, aucune erreur.
- Prettier (`backend/.prettierrc`) : les 7 fichiers sont conformes.
- La configuration temporaire et les liens ont été supprimés.

**Requêtes** (UTC, lecture seule)

| Heure | Objet |
|---|---|
| 07:42:55 | motifs de compte de test, par commande (booléens) |
| 07:43:01 – 07:43:06 | `cst_level` / `cst_is_pro` des 55 commandes |
| 07:44:37 | zone de livraison des commandes depuis le 01/04 (préfixe postal, pays) |
| 07:44:46 | commandes enfants, cohérence des totaux, payées avec port, tables d'historique |
| 07:44:50 – 07:44:57 | structure et événements de `___xtr_order_history` |
| 07:45:04 – 07:45:12 | montant `ic_postback` ≠ `ord_total_ttc` pour les commandes payées |
| 07:45:19 | total changé depuis `ORDER_CREATED` ; payées modifiées après paiement |
| 07:45:27 – 07:45:34 | libellés de statut ; ligne de la commande de supplément |

**Règles lues**
- `CLAUDE.md`
- `.claude/rules/payments.md`
- `.claude/rules/security-hooks.md`
- `.claude/rules/agent-doc-search.md`
- `.claude/rules/context7.md`

## Limites et inconnues

- Le « rapport du 13 » n'a pas été retrouvé. La correction porte sur la mesure de 60 % (hypothèse).
- Le classement des B* comme doublons reste probable, pas établi : les deux variantes sont données.
- Le poids des commandes n'est pas historisé. Les cas « au-delà du dernier palier » et « plus de 30 kg » ne sont donc pas mesurés.
- Un supplément demandé hors du site ne laisse aucune trace en base : non mesurable.
- L'historique `___xtr_order_history` ne commence que le 15/06.
- Le comportement en DEV, PREPROD et PROD n'est pas vérifié. Rien n'est déployé, et le drapeau reste éteint partout où il n'a pas été surchargé : cette surcharge n'a pas été lue.

## Manifeste de couverture (AEC)

```yaml
scope: complement mandat AN — decisions 5, 44, 61, 75 (16/11/2026)
covered:
  - cadence 1h/24h + flag re-read at send (code + tests)
  - abandoned-cart email texts (code + tests)
  - shipping: cart, checkout display, createOrder, Paybox amount, supplements (code read + SQL)
  - corrected unpaid measure (script + SQL test-account check)
excluded:
  - activation, sending, PROD, DB writes, migrations
  - candidate feed wiring and stop-on-order (cart STOP zone, proposed only)
  - shipping zone pricing change (not requested, STOP zone)
  - shared wrapLayout footer claim (other emails)
evidence: tests 51/51 at 2026-11-16T07:40:36Z; tsc exit 0; SELECT-only queries 07:42Z–07:46Z
unknowns:
  - source of "rapport du 13"
  - off-site supplements
  - runtime flag overrides in DEV/PREPROD/PROD
final_status: PARTIAL_COVERAGE
```
