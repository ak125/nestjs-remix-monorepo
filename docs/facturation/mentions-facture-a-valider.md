# Mentions de la facture — à valider (département 18 et comptable)

Mandat BM, 17 novembre 2026. Ce document liste ce que la facture produite par
`backend/src/modules/orders/services/invoice-pdf.ts` affiche, d'où vient chaque
valeur, et ce qui reste à trancher. Rien n'a été inventé : une valeur absente du
dépôt ou de la commande est marquée « absente », pas complétée.

**Statut : proposé, non validé.** La facturation reste éteinte
(`ORDER_BILLING_ENABLED` absent) tant que ce document n'est pas validé.

## Textes de référence à confirmer

Les articles sont cités comme pistes de vérification. Leur lecture juridique
appartient au département 18 et au comptable.

| Sujet | Texte cité |
|---|---|
| Mentions obligatoires de la facture | CGI, art. 242 nonies A de l'annexe II ; Code de commerce, art. L441-9 |
| Obligation de facturer, ventes à distance | CGI, art. 289 |
| Numérotation continue | CGI, art. 242 nonies A, 7° de l'annexe II |
| Facturation électronique et e-reporting | Réforme 2026-2027 : calendrier et périmètre B2C à confirmer |

## Ce que la facture affiche aujourd'hui

| Mention | Affichée | Source de la valeur |
|---|---|---|
| Numéro unique, séquence continue | Oui, `F<année>-<6 chiffres>` | RPC `issue_order_invoice_atomic`, compteur `__invoice_number_counter` verrouillé (une seule transaction, pas de trou) |
| Date de facture | Oui | `inv_date` (heure de l'émission) |
| Vendeur : dénomination, adresse, téléphone, forme, capital, RCS, SIRET, n° TVA, APE, site | Oui | Pied de facture déjà publié dans `frontend/app/routes/account_.orders.$orderId.invoice.tsx`, recopié mot pour mot (un test vérifie l'égalité) |
| Acheteur : nom et adresse de facturation | Oui | `ord_billing_snapshot` de la commande ; à défaut, prénom et nom du compte client |
| Commande d'origine et sa date | Oui | `ord_id`, `ord_date` |
| Date de paiement | Oui | `ord_date_pay` |
| Date d'expédition | Oui | `ord_date_ship`, posée avec le numéro de suivi |
| Désignation, marque, référence, quantité | Oui | Lignes de la commande (`orl_*`) |
| Prix unitaire et total par ligne | **TTC seulement** | `orl_art_price_sell_unit_ttc`, `orl_art_price_sell_ttc` |
| Consigne par ligne | Oui, TTC | `orl_art_deposit_ttc` |
| Réduction (« moins cher ») | Oui, ligne négative « Réduction : motif » | `__order_payment_adjustment` |
| Supplément payé (« plus cher ») | Oui, lignes « Supplément (commande X) : motif » | Commande enfant payée et encaissée |
| Pièces HT, consigne HT, port HT, total HT | Oui | Dérivés du TTC au taux `DEFAULT_TVA_RATE` (0,20) |
| TVA (un seul taux) et total TTC | Oui | Total TTC moins total HT |
| Récapitulatif des ajustements et motifs | Oui | `inv_info` |

## Questions ouvertes

1. **Prix unitaire HT par ligne.** L'annexe II demande le prix unitaire hors
   taxe et le taux de TVA de chaque ligne. La facture n'affiche que du TTC par
   ligne et un HT global. Faut-il ajouter le PU HT et le taux sur chaque ligne ?
2. **TVA de la consigne.** Le calcul applique 20 % à la consigne comme au reste
   (`inv_deposit_ht` = consigne TTC ÷ 1,2). Une consigne remboursable peut
   relever d'un autre traitement. Quelle règle s'applique ?
3. **TVA du port.** Le port est traité comme une prestation accessoire à 20 %.
   À confirmer.
4. **Arrondi.** Le HT est arrondi au centime sur chaque total (pièces, consigne,
   port), puis la TVA est calculée par différence. Le comptable préfère-t-il un
   arrondi par ligne ?
5. **Numérotation.** Une série par année (`F2026-000001`, puis `F2027-000001`)
   est-elle acceptée ? La migration ne fait pas repartir la série legacy
   (`___xtr_invoice` : une ligne de remplissage `inv_id = '0'`).
6. **Adresse de livraison.** Elle n'est pas affichée. Faut-il la mentionner
   quand elle diffère de l'adresse de facturation ?
7. **Date de la vente.** La facture donne la date de paiement et la date
   d'expédition. Laquelle vaut date de livraison au sens fiscal ?
8. **Clients professionnels.** Pénalités de retard, indemnité forfaitaire de
   recouvrement et conditions d'escompte : rien n'est affiché. Le paiement étant
   reçu avant l'émission, faut-il quand même ces mentions pour un client
   professionnel, et comment le reconnaître (le compte ne le dit pas toujours) ?
9. **Facture électronique.** Le PDF est généré par le site. Le passage par une
   plateforme agréée et l'e-reporting des ventes aux particuliers concernent-ils
   ce flux, et à quelle date ?
10. **Statuts 4, 5 et 6.** L'expédition écrit le statut 4 (« frais de port
    reçu » dans `___xtr_order_status`). `account.orders.tsx` affiche 5 comme
    « Expédiée » et le statut 6 n'a pas de libellé connu. La facture ne dépend
    pas de ces codes (elle lit `ord_date_ship`), mais leur sens est à fixer.
11. **Mention de la capture différée.** Le client a été débité à la capture
    (J+7), pas au paiement. La facture indique « Paiement reçu le <date de
    paiement> ». Faut-il dater la capture à la place ?

## Ce qui n'est pas sur la facture et n'a pas été ajouté

- Aucune mention de garantie, de rétractation ou de médiation : rien dans le
  dépôt n'en fixe le texte.
- Aucun logo : aucun fichier de logo n'est désigné comme officiel pour la facture.
