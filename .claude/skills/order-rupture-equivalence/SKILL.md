---
name: order-rupture-equivalence
description: >
  Use when a paid customer order cannot be fulfilled because the ordered part is out of stock at
  the supplier and an equivalent part has to be proposed to the customer, often at a higher price
  with a supplement to pay. Triggers — "la pièce est en rupture", "rupture chez le fournisseur sur
  la commande", "proposer un équivalent au client", "faire payer le supplément", "mail de
  proposition au client".
type: discipline
status: experimental
owners: ['@ak125']
domain: D11
runtime_class: privileged
llm_safe: false
last_verified: '2026-10-20'
license: Internal - Automecanik
compatibility: Designed for Claude Code in the AutoMecanik monorepo. Stack — Supabase/PostgreSQL (___xtr_order*, pieces*, pieces_price), Paybox redirect, Gmail SMTP. Privileged — creates a customer order, takes parts off sale and prepares a customer e-mail; each write needs the owner's nominative GO.
tags: [orders, rupture, equivalence, supplement, oem, tecdoc, quarantine, customer-mail, commerce]
argument-hint: "[order-id]"
disable-model-invocation: true
metadata:
  version: "1.1"
  spec: agentskills.io/specification v1
---

# Commande en rupture → équivalence

Une commande payée dont la réf est en rupture chez le fournisseur se sauve en proposant au client
l'équivalent disponible, même plus cher, au lieu de l'annuler « pas dispo ». Ce skill porte la
procédure de l'owner (2026-10-18) et, pour chaque écriture, le seul outil sûr.

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
| « Je passe `pri_dispo` à 0 » / « Je mets la marque en quarantaine » | Retrait = migration FROZEN + `piece_display` par réf, avec garde SEO (§4). |
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

- **Mécanisme unique** : `pieces.piece_display = false` (sort la pièce de la grille R2) +
  `pieces_price.pricing_state = 'FROZEN'`, `pricing_state_reason` lisible,
  `pricing_updated_source` = le fichier de migration (l'import tarif et l'activation sautent les
  lignes FROZEN, donc le retrait tient au prochain import).
- **Par migration du dépôt**, appliquée par le workflow « Apply Supabase migrations (manual) » :
  `dry_run`, puis `confirm=APPLY` avec `only_ids`, puis `status_only`. **REQUIRED SUB-SKILL :**
  `db-migration`.
- **Modèle** : `backend/supabase/migrations/20261018_pricing_quarantine_rupture_sphere_c00282.sql`
  et son `.down.sql` — liste figée, état mesuré de chaque pièce vérifié avant écriture,
  idempotente, retour arrière réf par réf. Il exige une seule ligne `pieces_price` par pièce : pour
  une réf à plusieurs fournisseurs, l'adapter pour geler chacune de ses lignes, jamais en omettre une.
- **Garde SEO dans la migration** : pour chaque type véhicule × gamme touché, compter la grille
  servie (`get_listing_products_extended_filtered`) avant et après. Aucune page ne doit tomber à
  0 pièce : elle passerait en noindex. Si c'est le cas : stop, owner.
- Ne retirer ni l'équivalent proposé ni les autres réfs dispo.
- **Interdits** :
  - `PUT /api/admin/stock/:pieceId/availability` : `pri_dispo='0'` sur toutes les lignes tarif,
    sans historique ni retour, et la pièce reste dans la grille R2 ;
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
- **Il refuse, ou son véhicule n'est pas couvert**, dans cet ordre :
  1. Annuler la commande de supplément avec `supplement-cancel.sql` (même déroulé que le script
     de §6), qui passe par `cancel_order_atomic` : statut '2', ORDER_CANCELLED journalisé. Aucun
     mail : le mail d'annulation part de l'application, jamais du journal. Si elle est déjà payée,
     le script refuse : owner.
     - Jamais de DELETE : `___xtr_order_history` la référence (clé RESTRICT), le journal reste.
     - Jamais le bouton « Annuler » de l'admin ni sa route `POST /api/admin/orders/:id/cancel`,
       même corrigés : mail automatique (§Trous).
  2. L'owner rembourse <montant> (§7, point 8) depuis l'espace Paybox. Aucune route de
     l'application ne rend l'argent (§Trous).
  3. Mail de confirmation au client : règle cardinale, et envoi seulement une fois le
     remboursement fait dans Paybox, confirmé par l'owner. Texte brut, dans cet ordre : objet
     « Votre remboursement de <montant> » ; remboursement fait sur la carte utilisée, montant ;
     commande annulée ; « ne réglez plus le lien de paiement du <date du mail de proposition> : la
     commande qu'il règle est annulée » (phrase obligatoire : le lien reste actif, §Trous) ; excuses
     courtes ; « Cordialement, L'équipe AutoMecanik ». Aucun délai bancaire annoncé.
  4. La commande d'origine reste « payée » en base, et l'admin la montre comme à expédier : aucun
     chemin gouverné ne la marque remboursée (§Trous). Elle ne part pas : c'est l'owner qui la
     retient.
- **Surveiller le supplément annulé** : l'annulation ne coupe pas le lien, qui n'expire pas
  (`getOrderForPayment` ne lit pas le statut), et un paiement reçu remet la commande en « payée »
  (`mark_order_paid_atomic`). Le filet est la notification que le site envoie à l'admin pour toute
  commande payée. En plus, à chaque reprise du dossier, contrôle en lecture seule :
  `ord_ords_id`, `ord_is_pay`, `ord_date_pay` de l'enfant et ses lignes `ic_postback`
  (`orderid`). Payée : livrer ou rembourser, sur décision de l'owner.
- **Il ne répond pas** : une relance est un nouveau mail, donc règle cardinale. Aucune tâche
  planifiée ne touche les commandes impayées.

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
- Aucun statut « remboursée » ni marque « ne pas expédier » : une commande remboursée dans Paybox
  reste « payée » en base et à expédier dans l'admin.
- Aucun gabarit de mail pour une équivalence ou un supplément.
- Le lien de paiement d'une commande annulée non payée reste actif, et `mark_order_paid_atomic`
  remet une commande annulée en « payée » (statut '3') si elle est réglée.
