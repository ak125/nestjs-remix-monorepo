---
name: order-rupture-equivalence
description: >
  Use when a paid customer order cannot be fulfilled because the ordered part is out of stock at
  the supplier — an equivalent part has to be proposed to the customer, often at a higher price
  with a supplement to pay, or the order has to be cancelled and the customer told. Triggers —
  "la pièce est en rupture", "rupture chez le fournisseur sur la commande", "proposer un
  équivalent au client", "faire payer le supplément", "mail de proposition au client", "annuler
  la commande pour rupture", "paiement annulé avant encaissement", "mettre la pièce en rupture".
type: discipline
status: experimental
owners: ['@ak125']
domain: D11
runtime_class: privileged
llm_safe: false
last_verified: '2026-10-22'
license: Internal - Automecanik
compatibility: Designed for Claude Code in the AutoMecanik monorepo. Stack — Supabase/PostgreSQL (___xtr_order*, pieces*, pieces_price), Paybox redirect, Gmail SMTP. Privileged — creates a customer order, takes parts off sale, cancels orders and prepares a customer e-mail; each write needs the owner's nominative GO.
tags: [orders, rupture, equivalence, supplement, oem, tecdoc, quarantine, cancellation, customer-mail, commerce]
argument-hint: "[order-id]"
disable-model-invocation: true
metadata:
  version: "1.3"
  spec: agentskills.io/specification v1
---

# Commande en rupture → équivalence

Une commande payée dont la réf est en rupture chez le fournisseur se sauve en proposant au client
l'équivalent disponible, même plus cher, au lieu de l'annuler « pas dispo ». Quand aucun
équivalent n'est dispo, que le client refuse ou que l'owner décide d'annuler, la commande est
annulée et le client prévenu (§8). Ce skill porte la procédure de l'owner (2026-10-18, complétée
les 2026-10-21 et 2026-10-22) et, pour chaque écriture, le seul outil sûr.

> **Règle cardinale `[CRITICAL]`** : aucun mail au client avant que l'owner ait validé **le texte
> final, affiché en entier** dans la conversation. Un « envoie directement », « gère tout » ou
> « fais au mieux » donné avant que ce texte existe ne le valide pas. Cela vaut pour tout mail :
> proposition, attente, relance, excuse.

> **Zones STOP** (CLAUDE.md, invariant 9) : créer la commande de supplément, retirer des réfs de la
> vente, toute écriture en base, l'envoi du mail. Chacune exige un GO nominatif de l'owner **pour
> cette écriture-là**, donné après avoir vu le script rempli, les valeurs du formulaire ou le texte
> final. « Annule tout », « pas besoin de me le montrer » ne valent pas GO. Ce skill décrit la
> procédure ; il ne lève aucune zone STOP.

## Signaux d'alerte — s'arrêter

| Pensée | Réalité |
|---|---|
| « Je demande l'immatriculation ou le VIN, pour être sûr » | Consigne owner : le client est sûr de sa pièce, on ne lui demande rien. Le mail liste les véhicules couverts et ceux qui ne le sont pas (§7). |
| « Un petit mail d'attente ce soir n'engage à rien » | C'est un mail client : texte affiché, GO, puis envoi. |
| « L'owner a dit "envoie directement" » | Pas sur CE texte. Montrer le texte final. |
| « Je ne sais pas faire le lien de paiement, l'owner s'en chargera » | Le lien vient d'une commande enfant (§6). Pas de commande enfant, pas de lien. |
| « Je passe `pri_dispo` à 0 par l'admin » / « Je mets la marque en quarantaine » | Retrait ou mise en rupture = migration par réf, FROZEN, avec garde SEO (§4). |
| « Le retrait vide une page, tant pis : elle reviendra » | Une page à 0 pièce passe en noindex. Cette réf se met en rupture au lieu d'être retirée (§4). |
| « Le texte a été validé, je l'envoie » | Si un fait du texte a changé depuis (commande annulée, supplément payé), il est caduc : nouveau texte, nouveau GO. |
| « Le paiement est annulé dans Paybox, donc la commande est annulée en base » | La base n'en sait rien : elle reste « payée » et l'admin la montre à expédier. L'annuler avec `voided-payment-cancel.sql`, sur GO (§8, étape 4). |
| « Le paiement a été remboursé, j'annule avec `voided-payment-cancel.sql` » | Réservé au paiement annulé avant encaissement. Remboursée, la commande reste « payée » ; l'owner la retient (§Trous). |
| « J'écris "remboursé" dans le mail d'annulation » | Seulement après un remboursement fait dans Paybox. Paiement annulé avant encaissement : « aucun montant ne sera prélevé » (§8). |
| « L'admin a un flux d'équivalence (statuts 91–94), je l'utilise » | Inutilisable (§Trous de l'application). Le supplément passe par le formulaire « Supplément après rupture » ou par le script, selon la sonde de §6. |
| « La route de supplément est sur `main`, donc en ligne » | `main` = PREPROD ; PROD ne change qu'au tag. Seule la sonde de §6 sur PROD décide. |
| « La route d'annulation admin est corrigée, j'annule par le bouton » | Elle envoie au client le mail automatique « Commande annulée », jamais validé, avant le remboursement. Annuler avec `supplement-cancel.sql` (§8). |
| « Même réf OEM, donc compatible » | Indice seulement. Preuve = types véhicule communs + mêmes critères (§2). |
| « Je commande l'équivalent chez le fournisseur tout de suite » | Seulement après paiement du supplément (§8). |
| « Le client refuse, je supprime la commande de supplément » | Le journal l'interdit ; on l'annule par `cancel_order_atomic`, et l'annulation ne coupe pas le lien (§8). |
| « Je rembourse par l'admin, c'est plus rapide » | Les routes de l'application annoncent un remboursement sans rendre l'argent. Seul l'espace Paybox rembourse (§8). |
| « Avec l'achat réel la vente est à perte, mais pour une fois… » | Jamais à perte, sans exception : corriger le tarif par le canal gouverné d'abord (§5). |

## Procédure (ordre imposé)

Lectures en base : SELECT, ou l'essai à blanc du script de §6, dans une session READ ONLY.
Données client (nom, e-mail, id de commande, `cst_id`, adresse) : scratchpad uniquement, jamais
dans un fichier commité, une PR ou un commit (dépôt public).

### 1. Constater la rupture

Commande payée : `ord_is_pay='1'` et `ord_date_pay` renseignée. Relever la ligne en rupture de
`___xtr_order_line` : `orl_id`, `orl_pg_id` (= `piece_id`), `orl_pm_name`, `orl_art_ref`,
`orl_art_quantity`, `orl_art_price_sell_ttc`, `orl_art_deposit_ttc`. La rupture est celle
qu'annonce le fournisseur de la réf (`pieces_price.pri_frs`) ; la base ne la connaît pas.

### 2. Trouver les correspondances — TecDoc d'abord, la base corrobore

1. Sur TecDoc, réf initiale → réf(s) d'origine constructeur (OEM). Taper ensuite **chaque** OEM,
   pas seulement la première, et lister toutes les marques. Cas réel : la 1re OEM menait à une réf
   qui ne couvrait qu'1 des 13 types de la réf initiale ; une autre OEM menait à celle qui les
   couvrait tous. TecDoc est le catalogue en ligne que consulte l'owner ; l'agent qui n'y a pas
   accès part de la base (étapes 2 et 3) et l'owner confirme la liste sur TecDoc.
2. En base, `pieces_ref_search` : `prs_kind` vaut `'1'` (réf propre), `'3'` (OEM), `'4'` (réfs
   d'autres marques). Candidats = pièces affichées qui partagent au moins une OEM (`prs_kind='3'`)
   avec la réf initiale.
3. Prouver la compatibilité de chaque candidat :
   - `pieces_relation_type` (`rtp_piece_id`, `rtp_type_id`) : types véhicule communs avec la réf
     initiale, et types de la réf initiale qu'il ne couvre **pas** ;
   - `pieces_criteria` (`pc_piece_id`, `pc_cri_id`, `pc_cri_value`, `pc_display`) : mêmes valeurs
     (essieu, côté, pression, capacité…).

   Une réf « large » se scinde : un équivalent ne couvre souvent qu'une partie de ses véhicules.
4. Unité de vente : les prix de `pieces_price` sont à la pièce, et `pri_qte_vente` est le
   multiple de vente (une réf vendue par paire se commande par 2). La quantité du supplément
   compte les pièces physiques — celle de la ligne en rupture quand l'équivalent la remplace
   pièce pour pièce — et reste un multiple du `pri_qte_vente` de l'équivalent.

### 3. Interroger la dispo de chaque correspondance chez les fournisseurs

Au portail, réf par réf, **chez chaque fournisseur** de la réf : `pri_dispo` et `pri_date_from` ne
prouvent pas la dispo. Consulter un portail depuis le serveur exige le GO de l'owner (outils en
lecture seule de `supplier-price-load` §2). Sans GO, ou portail refusé depuis le serveur (ex.
boutique IDLP) : l'owner vérifie dans son navigateur. Noter pour chaque réf : fournisseur, dispo,
prix d'achat net HT, remise.

Un autre fournisseur a la réf initiale elle-même : pas d'équivalence ni de retrait. La commander
chez lui, après le contrôle anti-perte de §5 avec son prix d'achat.

### 4. Retirer de la vente la réf initiale et les correspondances en rupture

But : ne plus vendre ce qu'on ne peut pas livrer. Périmètre = la réf commandée + chaque
correspondance que §3 a trouvée en rupture. Une réf tenue par plusieurs fournisseurs (plusieurs
lignes `pieces_price`) n'entre dans le périmètre que si tous sont en rupture ; sinon elle reste en
vente, toutes ses lignes intactes. Toute autre réf, même de la même gamme, sort de ce skill.

Ce retrait n'attend pas la réponse du client. La demande de l'owner suffit pour préparer la PR ;
l'écriture a lieu quand l'owner la fusionne puis lance le workflow.

- **Deux mécanismes, choisis réf par réf.** Avant d'écrire, compter pour chaque type véhicule ×
  gamme de la réf la grille servie (`get_listing_products_extended_filtered`) :

  | Si la réf était retirée | Mécanisme | Effet servi |
  |---|---|---|
  | chaque page garderait au moins 1 pièce | **Retrait** : `pieces.piece_display = false` | La pièce sort de la grille R2. |
  | au moins une page tomberait à 0 pièce, donc en noindex | **Mise en rupture** (choix owner 2026-10-21) : `pieces_price.pri_dispo = '0'`, `piece_display` inchangé | La pièce reste dans la grille, « Indisponible », sans prix ; panier, fiche produit et recherche la refusent (le site ne vend que `pri_dispo = '1'`). Chaque page garde son nombre de pièces. |

  Dans les deux cas, les lignes `pieces_price` de la réf passent en `pricing_state = 'FROZEN'`,
  avec `pricing_state_reason` lisible, `pricing_updated_by` et `pricing_updated_source` = le
  fichier de migration. L'import tarif et l'activation sautent les lignes FROZEN : la mesure tient
  au prochain import.
- **Mise en rupture et indexation.** Règle servie tant que `SEO_R2_SELLABLE_NOINDEX_ENABLED` vaut
  `false` (`frontend/app/utils/seo/r2-indexability.ts`) : une page reste indexable avec 2 pièces,
  ou avec 1 pièce et une qualité ≥ 50. La qualité vient de `rm_get_page_complete_v2`
  (`validation.dataQuality`) : 100 − 50 × part des pièces sans marque − 30 × part sans image
  − 20 × part sans prix. La rupture retire le prix : une pièce seule sur sa page
  garde 80 avec marque et image, 50 avec la marque seule, et passe en noindex sans marque. Dans ce
  dernier cas : stop, owner. Si le réglage passe à `true`, une page sans pièce vendable passe en
  noindex, et la rupture ne la protège plus.
- **Par migration du dépôt**, appliquée par le workflow « Apply Supabase migrations (manual) » :
  `dry_run`, puis `confirm=APPLY` avec `only_ids`, puis `status_only`. **REQUIRED SUB-SKILL :**
  `db-migration`. En tête, un bloc `DO $precheck$` en lecture seule (état mesuré de chaque ligne,
  grille de chaque page), rejoué tel quel avant la fusion et avant l'application.
- **Modèles**, chacun avec son `.down.sql` (liste figée, état mesuré vérifié avant écriture,
  idempotente, retour arrière réf par réf) :
  - retrait : `backend/supabase/migrations/20261018_pricing_quarantine_rupture_sphere_c00282.sql` ;
  - mise en rupture : `backend/supabase/migrations/20261021_pricing_rupture_emetteur_embrayage_luk_5130041.sql`.

  Tous deux exigent une seule ligne `pieces_price` par pièce : pour une réf à plusieurs
  fournisseurs, les adapter pour traiter chacune de ses lignes, jamais en omettre une.
- **Garde SEO dans la migration**, pour chaque type véhicule × gamme touché, grille comptée avant
  et après l'écriture : retrait, aucune page à 0 pièce ; mise en rupture, nombre de pièces
  inchangé et la pièce listée `stock_status = 'OUT_OF_STOCK'`. Tout écart interrompt la migration
  sans rien écrire.
- **Après l'application**, sur PROD : chaque page touchée qui ne garde qu'une pièce sert
  `<meta name="robots" content="index, follow">`. Une réponse `cf-cache-status: HIT` dont l'`age`
  remonte avant l'application est encore l'ancienne page, pas une preuve.
- Ne retirer ni l'équivalent proposé ni les autres réfs dispo.
- **Interdits** :
  - `PUT /api/admin/stock/:pieceId/availability` : `pri_dispo` posé sur toutes les lignes tarif,
    sans FROZEN (le prochain import le défait), sans motif ni retour arrière ;
  - `POST /api/admin/pricing/display/quarantine` : agit sur une marque entière, et seulement sur
    des réfs déjà non vendables ;
  - tout UPDATE hors migration.
- Les caches Redis et Cloudflare des pages R2 retardent l'effet.

### 5. Choisir l'équivalent, vérifier tarif et remise

- La moins chère des réfs **dispo** et compatibles, à couverture véhicules la plus proche de la
  réf initiale.
- Prix d'achat réel = le portail, remise confirmée. La base date souvent de 2022 (cas réel :
  remise 56 % au portail contre 64 % en base).
- **Jamais à perte** : `pri_vente_ht ≥ max(pri_achat_ht en base, achat confirmé au portail)`.
  Comparer à `pri_vente_ht`, pas au TTC ÷ 1,2.
- Le prix de vente reste celui du site (meilleure marge). S'il devient à perte avec l'achat réel,
  corriger le tarif d'abord (**REQUIRED SUB-SKILL :** `supplier-price-load`) :
  1. dry-run d'import d'une seule ligne (la réf, l'achat confirmé au portail) : UPDATE attendu, la
     dispo de la ligne est conservée, et le module recalcule la vente (marge en base conservée, ou
     grille du profil) ;
  2. rapport montré à l'owner, 0 `VENTE_BELOW_ACHAT` ; commit sur son GO ;
  3. reprendre ici avec le nouveau prix du site.

  Jamais de prix de vente fixé à la main ni d'UPDATE direct de `pieces_price`.
- Aucune réf dispo et compatible, ou l'owner choisit d'annuler : ni §6 ni §7, directement §8
  (Annulation). Le §4 s'applique quand même.

### 6. Commande de supplément et lien de paiement

Le lien de paiement du site relit le total d'une commande **existante et non payée**, et refuse
une commande payée. Le supplément passe donc par une **commande enfant** (`ord_parent` = commande
d'origine), créée avant l'envoi du mail de §7, qui porte son lien.

- **Montant** = prix TTC unitaire de l'équivalent × quantité − (`orl_art_price_sell_ttc` +
  `orl_art_deposit_ttc` de la ligne en rupture). La consigne de la réf initiale disparaît si
  l'équivalent n'en a pas. Le port payé reste acquis (choix owner) : port 0 sur l'enfant, même si le
  nouveau sous-total franchit 150 € (`FREE_SHIPPING_THRESHOLD`).
- Montant ≤ 0, ou équivalent à consigne : hors procédure, owner.
- **Outil = ce que PROD sert**, jamais ce que contient `main`. Sonde sans session, refusée avant
  toute écriture :

  ```bash
  curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Content-Type: application/json' -d '{}' https://www.automecanik.com/api/admin/orders/0/supplements
  ```

  Témoins, même requête : `…/api/admin/orders/0/cancel` (route servie) répond 403, et
  `…/api/admin/orders/0/zz-route-inexistante` (route absente) répond 404. Sinon la sonde ne
  distingue plus les deux cas.

  | Sonde | Outil |
  |---|---|
  | 403 (route servie, session exigée) | Formulaire de l'admin |
  | 404 (route absente) | `supplement-create.sql` |
  | Autre code, ou un témoin qui ne répond pas son code attendu | Stop, owner |

  Refus du formulaire ou ABORT du script : rien n'est écrit. Le rapporter tel quel, et ne changer
  une valeur qu'en refaisant le § qui l'a produite.
- **Formulaire** : fiche de la commande d'origine dans l'admin, bouton « Supplément après
  rupture » (commande payée et non annulée). L'agent n'a pas de session admin : il donne à l'owner
  les valeurs et le montant attendu ; l'owner les saisit et clique. Bouton absent alors que la
  sonde répond 403 : stop, owner.
  - « Ligne en rupture » = `orl_id` ; « Pièce équivalente (piece_id) » ; « Quantité » (§2,
    point 4 ; proposée = celle de la ligne) ; « Achat HT unitaire confirmé chez le fournisseur
    (€) » = achat net HT du portail (§3).
  - « Créer le supplément » écrit tout de suite, sans essai à blanc : le GO porte sur ces valeurs.
    Le service vérifie avant d'écrire — commande d'origine payée, non annulée, montants égaux à
    ses lignes ; aucun autre supplément non annulé ; équivalent affiché, autre que la pièce en
    rupture, vendable, sans consigne, jamais à perte (achat en base et achat confirmé) ; montant
    positif et divisible au centime par la quantité ; client avec e-mail.
  - Aucun mail ne part à la création.
  - Montant affiché ≠ montant attendu : aucun mail au client ; annuler ce supplément (§8, étape 1)
    et reprendre le calcul.
  - Le lien s'affiche une seule fois, sous le formulaire (« Copier le lien ») ; perdu, il se
    reconstruit au format ci-dessous.
- **Script** `supplement-create.sql` (ce dossier) : un seul bloc DO qui appelle la fonction du site
  `create_order_atomic` (commande + ligne + événement ORDER_CREATED en une transaction), avec ses
  pré-contrôles : commande d'origine payée et inchangée, aucun supplément non annulé, équivalent
  en vente au prix du mail et jamais à perte, montant exact, contrôles après écriture.
  1. Copier le fichier en scratchpad et renseigner les constantes ; le bloc refuse de partir sinon.
  2. `c_apply := false` : l'agent lance les pré-contrôles seuls, sans écriture, en session
     READ ONLY.
  3. Montrer le script à l'owner. Sur GO nominatif, `c_apply := true` : `execute_sql` du MCP
     Supabase, ou l'owner le colle dans l'éditeur SQL Supabase. Un refus du classifieur ne se
     contourne pas.

  Transitoire : quand la sonde désigne le formulaire (403, témoins conformes), retirer le script
  par une PR.
- **Lien** =
  `https://www.automecanik.com/api/paybox/redirect?orderId=<id enfant>&amount=<montant, point décimal>&email=<e-mail encodé>`.
  Il répond 400 « Commande introuvable » avant la création, 200 avec le formulaire Paybox après
  (`PBX_CMD` = id enfant, `PBX_TOTAL` en centimes). Jamais de lien inventé.
- Au paiement, le site envoie au client « Commande <id enfant> confirmée » et prévient l'admin.

### 7. Mail de proposition — rédiger, afficher, attendre le GO

Texte brut, dans cet ordre :

1. **Objet** tourné vers la solution : « Vos <pièces> : une solution disponible tout de suite ».
2. Rappel de la commande : date, numéro, quantité, marque, réf.
3. Rupture chez le fournisseur, sans date de retour ; plutôt que de le faire attendre, on a cherché
   l'équivalent disponible immédiatement.
4. **NOTRE PROPOSITION** : marque et réf ; mêmes références d'origine constructeur (les citer) ;
   mêmes caractéristiques (les critères de §2) ; consigne ou non ; en stock, commandée dès
   l'accord. Un atout de la marque (origine, groupe, équipement d'origine) seulement s'il est
   sourcé (site ou catalogue du fabricant) ; sinon, aucun.
5. **VOTRE VÉHICULE** : véhicules couverts ; véhicules de la réf initiale **non** couverts, suivis
   de « si vous roulez en <modèle>, ne payez pas et répondez à ce mail ». Véhicules nommés comme le
   client les connaît (modèle, motorisation, années), jamais par id de type. Aucune demande
   d'immatriculation.
6. **LE PRIX** : quantité × prix = total ; déjà réglé pour les pièces et la consigne ; port déjà
   réglé ; reste à régler.
7. **POUR ACCEPTER** : le lien, « par carte bancaire » (PayPal via Paybox est refusé depuis le
   14/08) ; le mail « Commande <id enfant> confirmée » qui suivra ; même adresse de livraison.
8. Refus : « répondez, nous annulons et vous remboursons intégralement <montant> ». <montant> =
   total payé de la commande d'origine si la ligne en rupture est sa seule ligne ; sinon l'owner
   le fixe avant le mail.
9. « Cordialement, L'équipe AutoMecanik ».

Ton clair et vendeur, sans jargon (« référence d'origine constructeur », pas « OEM »). Aucun fait
non prouvé : compatibilité, délai, origine de la marque.

**Envoi**, une fois le texte final validé :

- Depuis contact@automecanik.com (choix owner). Le connecteur Gmail de claude.ai est branché sur une
  autre boîte, sans alias : il ne convient pas.
- Par défaut : l'owner copie le texte validé et l'envoie lui-même depuis contact@.
- Sur autorisation nominative seulement : script ponctuel en scratchpad, même transport que
  `MailService` (Gmail OAuth2, variables `GMAIL_*` de `backend/.env` lues sans affichage). Il refuse
  de partir si l'expéditeur n'est pas contact@, si le texte diffère du texte validé, s'il reste un
  `[` ou si le lien manque, et il écrit un fichier témoin contre le double envoi.
- N'afficher aucune valeur `GMAIL_*` ni aucun autre secret, même tronqué.

### 8. Après la réponse du client

- **Il paie** : commander l'équivalent chez le fournisseur retenu, au prix d'achat confirmé, livré à
  l'adresse de la commande d'origine.
- **Annulation** — il refuse, son véhicule n'est pas couvert, aucun équivalent n'est dispo
  (§5), ou l'owner annule (pas de réponse, décision commerciale). Dans cet ordre :
  1. S'il existe une commande de supplément, l'annuler avec `supplement-cancel.sql` (même déroulé
     que le script de §6), avant tout mail qui annonce l'annulation. Le script passe par
     `cancel_order_atomic` : statut '2', ORDER_CANCELLED journalisé. Aucun mail : le mail
     d'annulation part de l'application, jamais du journal. Si elle est déjà payée, le script
     refuse : owner.
     - Jamais de DELETE : `___xtr_order_history` la référence (clé RESTRICT), le journal reste.
     - Jamais le bouton « Annuler » de l'admin ni sa route `POST /api/admin/orders/:id/cancel`,
       même corrigés : mail automatique (§Trous).
  2. L'owner traite le paiement dans l'espace Paybox, seul endroit qui rend l'argent (§Trous) :
     transaction pas encore encaissée, il l'annule ; encaissée, il rembourse <montant> (§7,
     point 8). Le délai avant encaissement se règle dans le compte Paybox, pas dans le code : seul
     l'espace Paybox dit où en est la transaction, l'agent ne le déduit pas des dates.
  3. Mail au client : règle cardinale, et envoi seulement une fois l'opération faite dans Paybox,
     confirmée par l'owner, en disant laquelle. Texte brut, dans cet ordre :
     1. objet : « Votre commande <id> est annulée » (paiement annulé) ou « Votre remboursement
        de <montant> » (remboursement) ;
     2. rappel de la commande : date, numéro, quantité, marque, réf ;
     3. rupture chez le fournisseur, livraison impossible, commande annulée ;
     4. l'argent, sans délai bancaire :
        - paiement annulé : « Votre paiement de <montant> a été annulé avant encaissement :
          aucun montant ne sera prélevé sur votre carte. » ;
        - remboursement : remboursement de <montant> fait sur la carte utilisée ;
     5. si un lien de supplément a été envoyé : « Ne réglez plus le lien de paiement du <date du
        mail de proposition> : la commande qu'il règle est annulée. » (obligatoire : le lien reste
        actif, §Trous) ;
     6. excuses courtes ; « Cordialement, L'équipe AutoMecanik ».
  4. La commande d'origine reste « payée » en base tant qu'on ne l'annule pas :
     `cancel_order_atomic` refuse une commande payée.
     - Paiement **annulé** avant encaissement, confirmé par l'owner dans l'espace Paybox (étape 2) :
       l'annuler avec `voided-payment-cancel.sql`, même déroulé que le script de §6 (essai à blanc
       en READ ONLY, script rempli montré, GO nominatif). Le script passe par
       `cancel_order_payment_voided_atomic` : statut '2', date et motif d'annulation, ORDER_CANCELLED
       journalisé avec l'attestation (`c_attested_by` : qui a vu l'annulation dans Paybox, et
       quand). Les champs de paiement restent tels quels : le KPI la compte « annulée après
       paiement ». Aucun mail. La fonction n'est exécutable que par le propriétaire de la base :
       `execute_sql` du MCP Supabase ou éditeur SQL, jamais l'application. Fonction absente
       (migration non appliquée) : le script refuse, la commande reste « payée », l'owner la retient.
     - Paiement **remboursé** après encaissement : aucun chemin gouverné. Elle reste « payée » et
       l'admin la montre à expédier ; elle ne part pas : c'est l'owner qui la retient (§Trous).
  5. Un mail préparé pour ce client et pas encore envoyé (relance, attente) devient caduc :
     le marquer comme tel en scratchpad, ne jamais l'envoyer.
- **Surveiller le supplément annulé** : l'annulation ne coupe pas le lien, qui n'expire pas
  (`getOrderForPayment` ne lit pas le statut), et un paiement reçu remet la commande en « payée »
  (`mark_order_paid_atomic`). Le filet est la notification que le site envoie à l'admin pour toute
  commande payée. En plus, à chaque reprise du dossier, contrôle en lecture seule :
  `ord_ords_id`, `ord_is_pay`, `ord_date_pay` de l'enfant et ses lignes `ic_postback`
  (`orderid`). Payée : livrer ou rembourser, sur décision de l'owner.
- **Il ne répond pas** : une relance est un nouveau mail, donc règle cardinale ; ou l'owner
  annule (Annulation). Aucune tâche planifiée ne touche les commandes impayées.

## Trous de l'application

Ni contourner, ni utiliser. Corriger l'un d'eux = PR de code séparée, sur GO owner (zones commande
et paiement ; le module `payments/` ne se modifie pas).

- Flux d'équivalence admin (statuts 91–94, `order-actions.controller.ts`) : `ParseIntPipe` refuse
  les ids `ORD-…` ; le front appelle `PATCH …/validate-equivalent`, absent du backend ;
  `propose-equivalent` lit le tarif hors `PiecePriceDataService` et lit `pieces_marque[0]` sur une
  relation qui renvoie un objet ; ni mail ni interface client.
- `proceed-supplement` renvoie un `redirectUrl` indéfini.
- Route admin `POST /api/admin/orders/:id/cancel` (bouton « Annuler ») : quelle que soit la
  version servie, elle envoie au client le mail automatique « Commande <id> annulée » — motif
  saisi dans l'admin, « vous serez remboursé sous 5 à 7 jours ouvrés » — sans texte validé et
  avant tout remboursement. Les versions anciennes, en plus, acceptent une commande payée,
  écrivent `ord_ords_id = '6'` (hors des 5 statuts canon) sans `cancel_order_atomic` ni journal,
  et envoient ce mail deux fois.
- Route `POST /api/payments/:id/refund` : enregistre un remboursement `processed` et envoie au
  client « remboursement confirmé », sans aucun appel à Paybox. Le client est prévenu, pas
  remboursé.
- Aucun statut « remboursée », ni marque « ne pas expédier » : une commande encaissée puis
  remboursée reste « payée » en base (`cancel_order_atomic` refuse une commande payée) et à
  expédier dans l'admin. Seul le paiement annulé avant encaissement a un chemin (§8, étape 4).
- Aucun gabarit de mail pour une équivalence ou un supplément.
- Le lien de paiement d'une commande annulée non payée reste actif, et `mark_order_paid_atomic`
  remet une commande annulée en « payée » (statut '3') si elle est réglée.
