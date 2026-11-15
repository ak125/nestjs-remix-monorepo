# Rapport — Mandat AN : commandes non payées et relance de panier

> Mandat transmis le 16/11/2026 par le chat de pilotage. **Lecture seule** : aucun code
> applicatif modifié, aucune écriture en base, aucun envoi, aucune activation, rien en PROD.
> Identifiants de commande seulement ; aucune donnée personnelle de client.
> Requêtes SQL : `SELECT` dans une transaction en lecture seule, entre 2026-11-15T23:33Z et 23:44Z.

## En bref

- **55 commandes depuis le 01/04 : 20 payées, 33 non payées (60 %), 2 annulées.**
- **Le chiffre de 60 % est trompeur.** Sur les 33 :
  - 8 viennent d'un compte servant aux tests ;
  - 7 sont des tentatives en double d'un achat payé quelques minutes plus tard.
- Il reste **18 commandes, soit environ 12 acheteurs réels, pour environ 1 848 €** de paniers
  (un panier par acheteur). Parmi ces 12 acheteurs :
  - 6 sont tombés pendant les **pannes documentées du tunnel** (mars–avril et mai–juillet) ;
  - 1 a eu un **refus Paybox enregistré** ;
  - 5 restent **sans explication possible** (aucune trace n'existe entre la création de la
    commande et Paybox) : 4 acheteurs isolés et 1 acheteur qui a créé 5 commandes le 21/09.
- **Montants payés : écart nul.** Pour les 20 commandes payées, le montant encaissé par Paybox est
  égal au total de la commande, port compris.
- **Statut 3 : le client ne voit jamais un montant sans port suivi d'un supplément.**
  - Le port est calculé et affiché avant le paiement, puis inclus dans le montant envoyé à Paybox.
  - Le statut 3 est posé *après* le paiement, et le client le voit sous le libellé « En préparation ».
- **La relance de panier ne tourne pas, pour trois raisons cumulées, chacune suffisante :**
  1. aucun code n'alimente la liste des paniers candidats ;
  2. le réglage est éteint ;
  3. aucun client n'a de consentement marketing enregistré : **0 sur 59 197**.

  Basculer le réglage seul n'enverrait donc **aucun** email.
- **order-cleanup ne touche à aucune commande, et il ne tourne pas** : le planificateur `@Cron`
  est désactivé.
- **`landing_source` est vide sur 45 des 55 commandes**, pour trois causes :
  - 16 commandes sont antérieures à la capture ;
  - 19 viennent du parcours invité, qui régénérait la session ;
  - les autres ont perdu l'attribution à la connexion, qui régénère aussi la session.

  Le skill `runtime-truth-audit` a tourné mais **ne voit pas ce défaut** (faux négatif).

---

## 1. Parcours des 33 commandes non payées

### Ce que les sources permettent d'établir, et ce qu'elles ne permettent pas

| Étape | Source | Couverture réelle |
|---|---|---|
| Commande créée | `___xtr_order`, `order_idempotency` | toutes les commandes |
| Page Paybox atteinte | aucune | **jamais en base** : `GET /api/paybox/redirect` relit la commande et n'écrit rien (`backend/src/modules/payments/controllers/paybox-redirect.controller.ts:30`, lecture lignes 63-96) |
| Retour Paybox (IPN) réussi | `ic_postback` | toutes les commandes |
| Retour Paybox refusé | `ic_postback` (ligne `failed`) ; `__paybox_gate_log` pour les rejets de signature | lignes `failed` : oui ; mais `statuscode` est **codé en dur à `'00'`** (`payments/repositories/payment-data.service.ts:206`), donc le code d'erreur Paybox réel est perdu ; `__paybox_gate_log` s'arrête au 14/04 |
| Erreurs applicatives | `__error_logs` | rétention à partir du 16/10, **après** la dernière commande non payée (13/10) |
| Journaux DEV | journal du conteneur DEV | à partir du 24/10, et DEV seulement |
| Journaux PROD, back-office Paybox | — | **hors d'accès agent** (owner seulement) |

**Conséquence.** Pour presque toutes les commandes, deux situations laissent la même trace en base :

- l'acheteur n'a pas atteint Paybox ;
- l'acheteur a atteint Paybox puis a abandonné.

C'est le même angle mort que celui déjà relevé le 07/09 (`audit/payment-tunnel-sev1-alert-2026-09-07.md`).

### Les 33 commandes, classées en six groupes disjoints

- **Port** : part du port dans le TTC affiché.
- **Acheteur** : libellé anonyme (P1, P2…) qui regroupe les commandes d'un même compte client.

| Commande | Date UTC | TTC € | Port € | Acheteur | Groupe | Jusqu'où (établi) |
|---|---|---:|---:|---|---|---|
| ORD-1776178521703-793 | 04-14 14:55 | 14,37 | 5,49 | P3 | A | créée pendant l'enquête SEV1 d'avril (`.spec/reports/incident-2026-04-14-payments-sev1.md:213`) |
| ORD-1776181846208-158 | 04-14 15:50 | 14,37 | 5,49 | P3 | A | **Paybox atteint, carte refusée** : 3 essais, `Erreur=00040` (même rapport, l. 490) |
| ORD-1776954691840-888 | 04-23 14:31 | 42,43 | 11,19 | P3 | A | créée ; suite inconnue |
| ORD-1782066582923-278 | 06-21 18:29 | 41,12 | 11,19 | P3 | A | créée ; suite inconnue |
| ORD-1782066574909-699 | 06-21 18:29 | 41,12 | 11,19 | P3 | A | créée ; suite inconnue |
| ORD-1782149720951-690 | 06-22 17:35 | 64,41 | 17,39 | P3 | A | créée ; suite inconnue |
| ORD-1784008203505-836 | 07-14 05:50 | 62,35 | 7,59 | P3 | A | commande de test créée depuis DEV le 14/07, laissée impayée volontairement |
| ORD-1788936381214-361 | 09-09 06:46 | 49,03 | 5,49 | P3 | A | créée ; suite inconnue |
| ORD-1778093528098-386 | 05-06 18:52 | 291,86 | 0,00 | P6 | B | même compte payé le lendemain : ORD-1778188033019-385, même montant |
| ORD-1788791453974-174 | 09-07 14:30 | 110,52 | 9,29 | P23 | B | 3 tentatives en 4 min, aucun IPN ; même email payé le 08/09 (ORD-1788898842195-316) |
| ORD-1788791548881-815 | 09-07 14:32 | 110,52 | 9,29 | P23 | B | idem |
| ORD-1788791681028-204 | 09-07 14:34 | 110,52 | 9,29 | P23 | B | idem |
| ORD-1778145410438-284 | 05-07 09:16 | 266,08 | 0,00 | P7 | B* | même montant payé 4 min plus tard sous un autre compte (ORD-1778145618622-850) |
| ORD-1779205768406-981 | 05-19 15:49 | 169,73 | 0,00 | P10 | B* | même montant payé 11 min plus tard sous un autre compte (ORD-1779206456739-972) |
| ORD-1788438172560-160 | 09-03 12:22 | 542,64 | 0,00 | P21 | B* | même montant payé 4 min plus tard sous un autre compte (ORD-1788438418870-302) |
| ORD-1775665993373-969 | 04-08 16:33 | 147,78 | 17,39 | P1 | C | panne du 20/03 au 14/04 (rapport SEV1 d'avril) |
| ORD-1775809521117-980 | 04-10 08:25 | 31,49 | 5,49 | P2 | C | idem |
| ORD-1779460457842-264 | 05-22 14:34 | 349,26 | 0,00 | P12 | C | panne du 19/05 au 14/07 (jambe 1 corrigée par #1256) |
| ORD-1781542232088-239 | 06-15 16:50 | 42,43 | 11,19 | P13 | C | idem |
| ORD-1782893007413-694 | 07-01 08:03 | 200,36 | 0,00 | P14 | C | idem |
| ORD-1783794662047-632 | 07-11 18:31 | 62,35 | 7,59 | P15 | C | idem ; échec jambe 1 confirmé par les journaux PROD de juillet |
| ORD-1783874528747-781 | 07-12 16:42 | 62,35 | 7,59 | P15 | C | **redirection Paybox atteinte avec un formulaire valide, aucun IPN** (enquête de juillet) |
| ORD-1783874803516-892 | 07-12 16:46 | 62,35 | 7,59 | P15 | C | idem |
| ORD-1790022596496-831 | 09-21 20:29 | 240,38 | 0,00 | P25 | D | 5 commandes en 11 min, aucune trace ; suite inconnue |
| ORD-1790022691937-129 | 09-21 20:31 | 240,38 | 0,00 | P25 | D | idem |
| ORD-1790022771072-989 | 09-21 20:32 | 240,38 | 0,00 | P25 | D | idem |
| ORD-1790023000593-446 | 09-21 20:36 | 240,38 | 0,00 | P25 | D | idem |
| ORD-1790023224651-708 | 09-21 20:40 | 240,38 | 0,00 | P25 | D | idem |
| ORD-1790877107473-971 | 10-01 17:51 | 40,43 | 5,49 | P27 | E | **Paybox atteint et retour reçu** : 2 lignes `ic_postback` `failed` ; code d'erreur réel perdu (`'00'` codé en dur) |
| ORD-1777729440764-528 | 05-02 13:44 | 291,86 | 0,00 | P5 | F | créée ; suite inconnue |
| ORD-1778169515764-921 | 05-07 15:58 | 151,09 | 9,29 | P9 | F | créée ; suite inconnue |
| ORD-1791218272947-520 | 10-05 16:37 | 255,97 | 0,00 | P28 | F | créée ; suite inconnue |
| ORD-1791915122394-200 | 10-13 18:12 | 34,75 | 5,49 | P29 | F | créée ; suite inconnue |

**B\*** : rapprochement *probable* mais **non établi**. Les montants et les horaires
concordent, mais le compte est différent : chaque tentative du parcours invité crée un compte.

### Totaux par groupe

| Groupe | Cause | Commandes | Acheteurs | TTC € | Port € |
|---|---|---:|---:|---:|---:|
| A | compte P3 de tests documentés (statut interne/client réel **non établi formellement**) | 8 | 1 | 329,20 | 75,02 |
| B | doublon d'un achat payé ensuite (4 établis, 3 probables) | 7 | 4 | 1 601,87 | 27,87 |
| C | pannes documentées du tunnel | 8 | 6 | 958,37 | 56,84 |
| D | un acheteur, 5 commandes le 21/09, aucune trace | 5 | 1 | 1 201,90 | 0,00 |
| E | refus Paybox enregistré | 1 | 1 | 40,43 | 5,49 |
| F | commande isolée, aucune trace, tunnel censé fonctionner | 4 | 4 | 733,67 | 14,78 |
| **Total** | | **33** | | **4 865,44** | **180,00** |

- **Ventes réellement perdues (C + D + E + F)** : 12 acheteurs.
  - Un panier par acheteur : environ 1 848 €.
  - Somme des 18 commandes : 2 934 €, doublons du 21/09 et du 12/07 compris.
- **Part du port** :
  - 3,7 % du TTC non payé ;
  - 13 des 33 commandes non payées ont un port nul (seuil de franco à 150 €) ;
  - côté payé, 8 commandes sur 20 ont un port non nul, avec 73,32 € de port sur 4 021,25 €.

  Rien n'indique que le port fasse fuir. Un tel indice ne serait de toute façon pas
  concluant à cet effectif.

### Commandes payées : écart entre affiché et encaissé

- Sur les 20 commandes payées (14 au statut 3, 6 au statut 6), le montant `ic_postback` est
  égal à `ord_total_ttc`. **L'écart est nul pour les 20.**
- Le montant envoyé à Paybox est relu en base au moment de la redirection
  (`paybox-redirect.controller.ts:63-96`). Il ne vient pas du navigateur.

### Ce qui ne peut pas être établi, et pourquoi

1. **Pour 29 des 33 commandes, on ne sait pas si l'acheteur a atteint la page Paybox.**
   La redirection n'écrit rien en base. Les seules exceptions sont 158, 781, 892 et 971, établies
   par l'enquête SEV1 d'avril, l'enquête de juillet et `ic_postback`.
2. **Pour les groupes D et F, on ne sait pas s'il y a eu refus de carte, abandon ou incident.**
   - Les journaux PROD sont hors d'accès.
   - `__error_logs` commence le 16/10 et `__paybox_gate_log` s'arrête au 14/04.
   - Le groupe D tombe dans la période « PayPal refusé 9 fois sur 9 depuis le 14/08 », mais
     c'est une **hypothèse**, sans aucune preuve sur ces commandes.
3. **On ne sait pas si un acheteur a été débité sans IPN.** Seul le back-office Paybox peut le dire.
4. **Le statut du compte P3 n'est pas établi formellement.** Rien ne dit s'il est interne ou
   client réel, même si deux de ses commandes sont des tests documentés.
5. **Les rapprochements B\* ne peuvent pas être prouvés.** Ils reposent sur le montant et
   l'horaire seulement. Les rapprocher par email aurait demandé de lire et comparer des données
   personnelles, ce que je n'ai pas fait.

---

## 2. Effet du statut 3 : le client voit-il un montant sans port, puis un supplément ?

**Non, d'après le code du tunnel.**

1. **Le port est calculé côté serveur à la création de la commande**, puis inclus dans le total :
   - calcul au poids sur le sous-total : `backend/src/modules/orders/services/orders.service.ts:340-353` ;
   - écriture de `ord_shipping_fee_ttc` et de `ord_total_ttc` port compris : `orders.service.ts:393-404` ;
   - seuil de gratuité : `backend/src/modules/cart/services/shipping-calculator.service.ts:47`
     (`FREE_SHIPPING_THRESHOLD = 150`) et lignes 182-184.
2. **Le récapitulatif affiche le port avant le paiement**, avec une ligne « Livraison » et un
   total qui l'inclut :
   - `frontend/app/components/checkout/CheckoutOrderSummary.tsx:104-107` (Livraison) ;
   - `CheckoutOrderSummary.tsx:136-138` (Total).
3. **Paybox reçoit le total port compris**, relu en base (§1).
4. **Le statut 3 est posé au paiement, pas avant** :
   - RPC `mark_order_paid_atomic`, `ord_ords_id = '3'` :
     `backend/supabase/migrations/20260417_fix_mark_order_paid_atomic_type_error.sql:45` ;
   - corps de la fonction en base vérifié identique à 2026-11-15T23:40:00Z.
5. **Le client voit le statut 3 sous le libellé « En préparation »**, pas « En attente de rajout
   de frais de port » :
   - libellés : `frontend/app/utils/orders.ts:8-19` ;
   - affichage : `account.orders.tsx:287`, via `orders.server.ts:375`.
6. **Le code ne contient aucun supplément de port.**
   - `createSupplementOrder` (`orders.service.ts:898-932`) ne couvre qu'un cas : une rupture
     fournisseur avec une pièce équivalente plus chère.
   - Il est déclenché par l'admin : `POST /api/admin/orders/:orderId/supplements`,
     `order-actions.controller.ts:274-280`.
   - Il n'envoie aucun email.

**Limite.** Si Marwane demande hors site un complément de port au client, cette demande est
invisible pour le code et pour la base.

**Défaut de libellé côté client** (zone commande, proposé seulement) :
- le statut 2 en base (annulée) s'affiche « Confirmée » ;
- le statut 6 (payée puis annulée) s'affiche « Livrée ».

Six commandes payées sont au statut 6. Leurs clients voient « Livrée ».

---

## 3. Relance de panier abandonné

### Le code

| Rôle | Emplacement |
|---|---|
| Enregistrement d'un panier candidat | `@OnEvent('cart.activity')` → `registerCandidate` : `backend/src/modules/cart/services/abandoned-cart.service.ts:74-84`. Liste Redis `abandoned-cart:candidates`, durée de vie 7 jours |
| Scan toutes les 15 min | job répétable `abandoned-cart-scan` sur la file Bull `email` : `abandoned-cart.service.ts:52-64` ; consommé par `backend/src/workers/processors/email.processor.ts:172` |
| Écriture dans `__abandoned_cart_emails` | `scanAndEnqueue` (`abandoned-cart.service.ts:99`), qui appelle `abandoned-cart-data.service.ts` : jeton aléatoire de 32 octets, statut `detected` |
| Envoi des 3 emails | jobs `abandoned-cart-email` différés de 0 h, 23 h et 71 h (`abandoned-cart.service.ts:167-192`) ; `email.processor.ts:197` ; `sendSequenceEmail` (`abandoned-cart.service.ts:221`) ; `MailService.sendAbandonedCartEmail` (`backend/src/services/mail.service.ts:263-361`) |
| Lien de récupération, désinscription, pixel | `backend/src/modules/cart/controllers/cart-recovery.controller.ts:47, 106, 129, 152` |

### Pourquoi la table est vide : trois verrous cumulés, chacun suffisant

Preuve en base, à 2026-11-15T23:42:24Z : `pg_stat_user_tables` pour `__abandoned_cart_emails`
donne `n_tup_ins = 0` et `n_live_tup = 0`. **Aucune ligne n'a jamais été insérée.**

1. **Aucun panier n'est jamais candidat.**
   - Le seul émetteur de `cart.activity` est `CartAnalyticsService.trackCartCreated`
     (`backend/src/modules/cart/services/cart-analytics.service.ts:41-74`).
   - Cette méthode n'a **aucun appelant** dans le code.
   - `git log -S` ne trouve que son introduction (`c8dba1a2af`, 05/10/2025). La fonctionnalité de
     relance (`4fcb5bb061`, 24/03/2026) s'est appuyée dessus sans la brancher.
   - Même branchée, elle n'émet que si `parseInt(sessionId) > 0`, donc pour un identifiant client
     numérique. Les comptes du parcours invité ont un identifiant `usr_…` (88 comptes en base)
     et ne pourraient jamais être candidats ; `__abandoned_cart_emails.cst_id` est d'ailleurs de
     type `integer`.
2. **Le réglage est éteint par défaut.**
   - `scanAndEnqueue` sort immédiatement si `ABANDONED_CART_EMAIL_ENABLED` n'est pas `'true'` :
     `abandoned-cart.service.ts:100`, `backend/src/config/feature-flags.service.ts:283-284` et 521-525.
   - Constat déjà fait le 11/09 (`audit/seo-sept-leviers-2026-09-11.md:224`).
   - Valeur en PROD : non lisible par l'agent.
3. **Personne n'a consenti.**
   - L'envoi exige `cst_marketing_consent_at` (ADR-036) : `abandoned-cart-data.service.ts:206-214`,
     vérifié au scan et à chaque envoi.
   - En base, à 2026-11-15T23:42:04Z : **0 client sur 59 197** a un consentement enregistré.
   - La capture du consentement n'existe que depuis le 21/10 (`954584eb06`, #1847) :
     - case « newsletter » à l'inscription : `backend/src/auth/controllers/auth-login.controller.ts:97` ;
     - réglage dans « Paramètres ».
   - 10 comptes ont été créés depuis le 01/10. Le parcours invité ne propose pas la case.

### Défauts à corriger avant toute activation (proposés, non appliqués)

- **Les rappels continuent après un achat.**
  - Une relance passe à `recovered` seulement quand le client clique sur le lien de récupération
    (`cart-recovery.controller.ts:60`).
  - Un client qui commande par un autre chemin recevrait encore les emails de 24 h et 72 h.
  - Les contrôles à l'envoi (`abandoned-cart.service.ts:232-279`) ne regardent ni les commandes
    ni le contenu actuel du panier.
- **Couper le réglage n'arrête pas les emails déjà planifiés.** Le réglage n'est testé qu'au scan
  (ligne 100), pas à l'envoi (`sendSequenceEmail`, ligne 221).

### Procédure d'activation, pour Marwane (rien n'a été activé)

**Prérequis de code, sans lesquels activer ne change rien :**
- émettre `cart.activity` à l'ajout au panier d'un client connecté ;
- passer la relance à `recovered` quand une commande est créée pour ce client.

**Prérequis de conformité :**
- avis du département 18 sur l'obligation d'information et sur le pixel de suivi d'ouverture ;
- validation du texte des emails (ci-dessous).

**Activation :**
1. Dans le fichier `.env` lu par le service `monorepo_prod` (`docker-compose.prod.yml`,
   `env_file: .env`), poser `ABANDONED_CART_EMAIL_ENABLED=true`.
2. Recréer le conteneur.
3. Vérifier que `SITE_ORIGIN` (`backend/src/config/site.constants.ts`) pointe vers le domaine
   public : il sert aux 3 liens de l'email.

**Variante sans redémarrage, temporaire :**
- `PATCH /api/admin/feature-flags/ABANDONED_CART_EMAIL_ENABLED` avec le corps
  `{"value":"true"}`, en session admin ;
- source : `backend/src/modules/admin/controllers/admin-feature-flags.controller.ts:36`.
- La valeur est **en mémoire et propre à un processus** : elle est perdue au redémarrage
  (`feature-flags.service.ts:13`).

**Contrôle :**
- `GET /api/cart/abandoned-stats` (admin) ;
- lignes dans `__abandoned_cart_emails` après le premier scan (15 min) et l'heure de seuil.

**Où tournent les jobs :**
- `EmailProcessor` est enregistré dans `WorkerModule`, qui est importé par `AppModule`
  (`backend/src/app.module.ts:197`). Il tourne donc dans le processus backend.
- `release-prod.yml` ne démarre que `monorepo_prod`, `caddy` et `redis_prod`.
- Qu'il tourne réellement en PROD n'est **pas vérifié**.

**Retour arrière :**
1. `DELETE /api/admin/feature-flags/ABANDONED_CART_EMAIL_ENABLED` (retour à la valeur d'env),
   ou `ABANDONED_CART_EMAIL_ENABLED=false` puis recréation du conteneur.
2. **Puis** retirer de la file Bull `email` les jobs différés `abandoned-cart-email`.
   Sans cette étape, les emails de 24 h et 72 h déjà planifiés partent quand même.
3. Facultatif : retirer le job répétable `abandoned-cart-scanner`.
4. Les lignes `__abandoned_cart_emails` ne s'effacent pas d'elles-mêmes. Les passer à `expired`
   est une écriture en base, à décider par Marwane.

### Texte exact des 3 emails, à valider par Marwane

**Objets** (`abandoned-cart.service.ts:293-295`). `{prénom}` vaut le prénom du client, ou
« Client » à défaut :
- 1 h : `{prénom}, votre panier de {n} article(s) vous attend`
  (« article » sans « s » quand n = 1)
- 24 h : `{prénom}, vos pieces auto vous attendent`
- 72 h : `Derniere chance, {prénom} — votre panier expire bientot`

**Corps** (`mail.service.ts:263-361`). Il est identique pour les 3 envois, sauf la phrase d'urgence.

- Bandeau orange (#f59e0b) : **Votre panier vous attend**
- `Bonjour {prénom},`
- Phrase d'urgence :
  - 1 h : `Votre panier vous attend ! Finalisez votre commande en quelques clics.`
  - 24 h : `Les stocks sont limites. Ne manquez pas vos pieces auto.`
  - 72 h : `Dernier rappel : votre panier sera bientot supprime.`
- Tableau des articles :
  - colonnes : image, `Article`, `Qte`, `Prix` ;
  - chaque ligne : nom en gras (« Article » à défaut), marque en gris, quantité, `{prix} EUR`
    avec une virgule décimale ;
  - pied : `Sous-total :` `{sous-total} EUR`.
- Bouton : **Retrouver mon panier**, vers `{SITE_ORIGIN}/panier/recover/{jeton}`
- Pied de message :
  `Vous recevez cet email car vous avez un panier en attente sur Automecanik.` et le lien
  `Ne plus recevoir ces rappels`, vers `{SITE_ORIGIN}/api/cart/unsubscribe/{jeton}`
- Pied général : `Automecanik - Pieces auto au meilleur prix`
- Pixel invisible 1×1 vers `{SITE_ORIGIN}/api/cart/track/open/{jeton}`
- En-têtes `List-Unsubscribe` et `List-Unsubscribe-Post: List-Unsubscribe=One-Click`

**Points à trancher par Marwane :**
- **Accents absents partout** : pieces, Derniere, bientot, limites, supprime, Qte.
- **« Les stocks sont limites »** : c'est une affirmation d'urgence. Aucune donnée de stock ne la
  soutient dans le code.
- **« votre panier sera bientot supprime » / « expire bientot »** :
  - le panier dure **30 jours** (`backend/src/database/services/cart-data.service.ts:68`) ;
  - la relance dure 7 jours ;
  - à 72 h, rien n'est supprimé, donc la phrase est inexacte.
- **Le pixel de suivi d'ouverture** relève peut-être du consentement (département 18).

---

## 4. order-cleanup : ce qu'il fait, et s'il tourne

Fichier : `backend/src/modules/orders/services/order-cleanup.service.ts`, enregistré à
`orders.module.ts:82`.

**Ce qu'il ferait :**
- `cleanupOrphanProcessing`, `@Cron('0 */15 * * * *')` : passe à `failed` les lignes
  `order_idempotency` restées `processing` plus de 15 min sans `order_id` ;
- `purgeExpired`, `@Cron(EVERY_HOUR)` : supprime les lignes expirées de `order_idempotency` et
  `order_resume_tokens`.

**Effet sur les commandes non payées : aucun.**
- Il ne lit ni ne modifie `___xtr_order`.
- Une commande non payée reste au statut 1 indéfiniment.

**Il ne tourne pas.**
- `ScheduleModule.forRoot` est commenté (`backend/src/app.module.ts:13` et 111-114), donc tout
  `@Cron` est inerte.
- Le service est marqué `INERT-OK-NO-SCHEDULER`, avec un TODO de passage sur BullMQ (#487).
- **Preuve en base (2026-11-15T23:3xZ)** :
  - 58 lignes d'idempotence expirées sur 58 sont toujours présentes ;
  - 56 jetons de reprise expirés sur 56 sont toujours présents ;
  - `n_tup_del = 0`.

---

## 5. Attribution : pourquoi `landing_source` est vide

**Chaîne prévue :**
1. Le beacon client fait `POST /api/attribution/landing`, une fois par onglet
   (`frontend/app/utils/attribution-beacon.client.ts:25, 53, 80`, clé `amk_attr_pinged`).
2. Le serveur enregistre `session.landing` en premier contact
   (`backend/src/modules/analytics/controllers/landing-attribution.controller.ts`).
3. `createOrder` et `createGuestOrder` copient la valeur dans `___xtr_order.landing_*`
   (`backend/src/modules/orders/controllers/orders.controller.ts`, environ l. 385-397, et à
   partir de la l. 446 environ).

**Résultat mesuré : `landing_source` est rempli sur 10 commandes sur 55, `ga_client_id` sur 52.**

| Population | Avec `landing` | Cause |
|---|---|---|
| Avant le 21/05 (capture introduite par `ebc7532c63`) | 0 / 16 | pas encore de capture |
| Parcours invité, du 21/05 au 11/11 | 0 / 19 | `createGuestOrder` régénérait la session avant de lire `landing`. Corrigé par #1965 (`d6f384168d`, 06/11) ; premier tag PROD contenant le correctif : 12/11. Aucune commande invité depuis pour le vérifier |
| Compte existant, période middleware (21/05 → 14/07) | 7 / 8 | — |
| Compte existant, période beacon (15/07 → 11/11) | 3 / 12 | à la connexion, `auth-login.controller.ts:107, 278, 380, 566, 708` régénère la session **sans recopier `landing`** ; le beacon ne se relance pas dans le même onglet (`amk_attr_pinged`) |

**Le skill `runtime-truth-audit` a-t-il marché ? Partiellement.**
- Il a tourné : check `.claude/skills/runtime-truth-audit/checks/attribution-write-gap.md`.
- Il a trouvé les colonnes et les écrivains, et mesuré `n_tup_upd = 32`. Son verdict est
  « écrivain présent », donc **check passé**.
- C'est un **faux négatif** : il cherche une colonne sans écrivain, alors qu'ici l'écrivain
  existe et la valeur est perdue en amont, dans la session.
- Il suppose aussi le MCP Supabase, qui renvoie 401. J'ai utilisé `psql` en lecture seule à la place.

---

## 6. Conclusion

### Causes établies, classées par nombre de commandes non payées concernées

| Rang | Cause | Commandes | Statut de la preuve |
|---|---|---:|---|
| 1 | Pannes du tunnel (20/03 → 14/04 ; 19/05 → 14/07) | 8 | établi (rapports d'incident, journaux de juillet) ; corrigé depuis |
| 1 | Compte P3 de tests | 8 | 2 tests documentés, 6 probables |
| 3 | Tentatives en double : une nouvelle clé d'idempotence à chaque montage de la page, et un nouveau compte à chaque tentative invité | 7 (B), et la forme multi-commandes de D (5) et de P15 (3) | établi pour 4, probable pour 3 ; la cause structurelle est établie dans le code (audit du 07/09) |
| 4 | Aucune trace possible entre la création et Paybox (D + F) | 9 | **cause non établissable** : défaut d'observabilité, pas une cause d'échec |
| 5 | Refus Paybox | 1 (+ 1 test : 158) | établi ; code d'erreur perdu |

**Lecture.** Sur la période **après** la réparation de juillet, les acheteurs perdus sont :
- 1 acheteur du 21/09 (5 commandes) ;
- 1 refus Paybox (971) ;
- 2 acheteurs isolés (520, 200).

Pour ces quatre-là, la base ne dit pas pourquoi : seuls le back-office Paybox et les journaux
PROD peuvent trancher.

### Corrections proposées, **aucune appliquée**

| # | Correction | Zone | Gain |
|---|---|---|---|
| 1 | Écrire une trace à la redirection Paybox (commande, horodatage, résultat) | `payments/`, **zone STOP** | rend « jamais atteint » et « abandonné » distinguables |
| 2 | Stocker le vrai code d'erreur Paybox au lieu de `'00'` (`payment-data.service.ts:206`) | `payments/`, **zone STOP** | cause des refus lisible |
| 3 | Clé d'idempotence stable par panier, et pas de nouveau compte à chaque tentative invité | commande, **zone STOP** | fin des doublons ; chiffres justes |
| 4 | Recopier `session.landing` lors des régénérations de session au login | auth | attribution des comptes existants |
| 5 | Brancher `cart.activity`, couper la relance à la commande, tester le réglage à l'envoi | panier, **zone STOP** | prérequis de la relance |
| 6 | Passer les `@Cron` (order-cleanup) sur BullMQ (#487) | commandes | purge et réparation d'idempotence effectives |
| 7 | Libellés client : statut 2 ≠ « Confirmée », statut 6 ≠ « Livrée » (`frontend/app/utils/orders.ts:8-19`) | commande, **zone STOP** | information client exacte |
| 8 | Retirer l'email de l'acheteur des journaux de redirection (`paybox-redirect.controller.ts:40-42`) | `payments/`, **zone STOP** | donnée personnelle hors journaux |
| 9 | Ajouter au skill un check « valeur perdue en amont » (taux de remplissage par période) | `.claude/skills/` | supprime le faux négatif |

**Actions owner :**
- consulter le back-office Paybox pour 971 et pour les groupes D et F ;
- valider le texte des emails ;
- décider de l'activation ;
- recueillir l'avis du département 18.

---

## Les 5 états

| État | Contenu |
|---|---|
| Proposé seulement | corrections 1 à 9 ; procédure d'activation et de retour arrière |
| Corrigé dans la candidate | **rien** : aucun défaut isolé hors zone STOP ne justifiait une PR de correction |
| Testé | rien de modifié, donc rien à tester ; constats prouvés par lecture du code et `SELECT` |
| Intégré | rien |
| Activé | rien ; `ABANDONED_CART_EMAIL_ENABLED` non touché, aucun email envoyé |

## Preuves

- **Session** : `6a36dc0b-7cf3-44a6-99f8-d4fc876f9d79`
- **Worktree** : `/home/deploy/worktrees/claude-mandat-an-ventes-20261116`, neuf, sans `node_modules`
  (donc sans lien vers `/opt/automecanik/app`) ; aucune installation lancée.
- **Branche** : `docs/mandat-an-ventes-20261116`
- **Base** : `origin/main` `9908188b380d6cf5f5d8c0b64db8544977818a13`
- **Head et SHA-256 du diff** : donnés dans le message de commit et le compte rendu de session ;
  un fichier ne peut pas contenir son propre hash.
- **Fichiers modifiés** : `RAPPORT-MANDAT-AN.md` seulement.

**Requêtes (UTC), toutes en `SELECT` dans une transaction en lecture seule :**

| Horodatage | Objet |
|---|---|
| 23:33Z → 23:38Z | 55 commandes depuis le 01/04 (statut, montants, port, `landing_*`, `ga_client_id`) ; `ic_postback` par commande ; `order_idempotency` (empreinte, statut) ; type d'identifiant et âge du compte |
| 23:38Z | `order_idempotency` et `order_resume_tokens` expirés ; `pg_stat_user_tables` (n_tup_del, n_tup_upd) |
| 23:40:00Z | corps de `mark_order_paid_atomic` (`pg_proc`) |
| 23:42:04Z | consentements marketing (comptage seul) |
| 23:42:24Z | `__abandoned_cart_emails` : colonnes et `pg_stat` ; types d'identifiants clients (comptage) |
| 23:43:29Z | comptes créés depuis le 01/10 (comptage) |

**Règles lues :**
- `AGENTS.md`, `CLAUDE.md` ;
- `.claude/rules/payments.md`, `.claude/rules/agent-doc-search.md`, `.claude/rules/context7.md`,
  `.claude/rules/security-hooks.md` ;
- `.claude/canon-mirrors/agent-exit-contract.md` ;
- `.claude/skills/runtime-truth-audit/SKILL.md` et `checks/attribution-write-gap.md` ;
- `scripts/monitoring/README.md` ;
- `.spec/reports/incident-2026-04-14-payments-sev1.md` ;
- `audit/payment-tunnel-sev1-alert-2026-09-07.md`.

**Non lues** : `.claude/rules/deployment.md`, `backend.md`, `frontend.md` et `guardrails.md`.
Aucune action infra, ni modification de garde, ni de code applicatif n'a été faite.

## Coverage manifest (AEC)

```
scope_requested: points 1 à 6 du mandat AN
scope_actually_scanned:
  - 55 commandes depuis le 01/04 (dont les 33 non payées), ic_postback, order_idempotency,
    order_resume_tokens, __abandoned_cart_emails, ___xtr_customer (comptages)
  - code : tunnel checkout → redirect → callback Paybox ; création de commande et invité ;
    relance panier ; feature flags ; order-cleanup ; beacon et attribution ; login ; libellés client
files_read_count: environ 35 fichiers de code et de doc (lus en entier ou par extraits ciblés)
excluded_paths: tout hors du périmètre ci-dessus ; aucune lecture de .env ni de secret
unscanned_zones:
  - journaux PROD et back-office Paybox (hors d'accès)
  - journaux DEV antérieurs au 24/10
  - valeurs d'env PROD
  - frontend/app/routes/panier.recover.$token.tsx
  - corps de cart-recovery.controller.ts (endpoints seulement)
  - frontend du checkout invité (régénération de la clé d'idempotence non relue dans cette session ;
    reprise de l'audit du 07/09)
corrections_proposed: 9 (§6)
corrections_applied: aucune
validation_executed: SELECT en lecture seule horodatés ; relecture des lignes citées
remaining_unknowns:
  - accès réel à Paybox pour 29 commandes sur 33 ; cause d'échec des groupes D et F
  - débit éventuel sans IPN
  - rapprochements B*
  - statut du compte P3
  - valeur PROD de ABANDONED_CART_EMAIL_ENABLED
  - exécution réelle des processeurs Bull en PROD
  - effet de #1965 sur l'attribution invité (aucune commande invité depuis le 12/11)
final_status: PARTIAL_COVERAGE
```

LIVRABLE MANDAT AN
