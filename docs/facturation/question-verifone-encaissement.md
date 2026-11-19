# Question pour Marwane — lire l'état d'encaissement chez Verifone

Mandat BM, point 2, 17 novembre 2026. **Arrêté**, conformément au mandat :
aucune interrogation automatique de Verifone n'est possible avec ce que le
dépôt contient. La saisie manuelle de l'état lu est livrée à la place.

## Ce qui a été vérifié

- Le site paie par le formulaire Paybox System (`paybox.service.ts`).
  `PBX_RETOUR` vaut `Mt:M;Ref:R;Auto:A;Erreur:E;K:K` : montant, référence,
  autorisation, code d'erreur, signature. Le numéro de transaction (S) et le
  numéro d'appel (T) ne sont pas demandés, donc jamais reçus ni stockés.
- La documentation intégrateur Paybox décrit une interrogation par l'interface
  Paybox Direct (question type `00017`). Elle demande la clé Paybox Direct
  (`CLE`, distincte de la clé HMAC), parfois une option d'abonnement, et le
  `NUMTRANS` et le `NUMAPPEL` de la transaction. D'après cette documentation,
  elle donne un état, pas le montant réellement encaissé.
- Aucune variable de clé Paybox Direct n'existe dans la configuration.
  Variables présentes (noms seulement) : `PAYBOX_SITE`, `PAYBOX_RANG`,
  `PAYBOX_IDENTIFIANT`, `PAYBOX_HMAC_KEY`.

## La question

> Marwane, pour savoir chaque jour si une commande a été encaissée chez
> Verifone :
>
> 1. Le contrat Verifone (Paybox) d'AutoMecanik inclut-il l'option
>    **Paybox Direct** (ou « Gestion automatisée des encaissements ») ? Si
>    oui, la clé Paybox Direct (le champ « CLÉ » du back-office, pas la clé
>    HMAC) peut-elle être ajoutée sur le serveur sous un nom de variable que
>    tu choisis ? Tu la poses toi-même, personne d'autre ne la lit.
> 2. Le back-office Verifone propose-t-il un **export ou un rapport
>    quotidien** (fichier de remises, rapport de transactions) envoyé par mail
>    ou en téléchargement ? Si oui, lequel, et dans quel format ?
> 3. La capture à J+7 est-elle automatique (paramètre « délai de remise » du
>    back-office) ou faite à la main ? Pour encaisser moins que l'autorisation,
>    fais-tu la capture partielle dans le back-office ?

## Suite selon la réponse

| Réponse | Suite |
|---|---|
| Paybox Direct disponible, clé posée par Marwane | Nouveau mandat : demander `S` et `T` dans `PBX_RETOUR` (fichier réservé du module paiement : patch préparé, non appliqué), les stocker au retour, puis interroger chaque jour avec la question `00017`, écrire l'état sur la commande (`__order_capture_state`, source autre que `manual`) et alerter en cas de retard |
| Export quotidien seulement | Nouveau mandat : import du fichier, même table, même alerte |
| Ni l'un ni l'autre | La saisie manuelle livrée reste la voie unique ; l'alerte de capture en retard demande alors au moins une saisie par commande |

## Ce qui est livré en attendant

- Saisie de l'état lu (`authorized`, `captured` avec montant, `cancelled`,
  `refunded`) : `POST /api/admin/orders/:id/billing/capture-state`, source
  `manual`, avec l'auteur (`ocs_updated_by`) et l'heure (`ocs_checked_at`).
- La facture ne part que si l'état saisi est `captured` au montant attendu.
- **Non livré par BM** : lecture quotidienne automatique et alerte de capture
  en retard. Le mandat BT ci-dessous les prépare à partir des mails Paybox.

## Mandat BT — lecture des mails Paybox sur automecanik.seo@gmail.com (17 novembre 2026)

Réponse retenue (D25, D97) : Paybox n'est pas touché ; le site lit, en lecture
seule, les mails que Paybox envoie déjà. Rien n'est actif tant que les étapes
ci-dessous ne sont pas faites ; sans jeton, le code ne fait rien.

### Ce que le code lit, et ce qu'il ne lit jamais

- Expéditeurs lus : `noreply@paybox.com` (ticket de paiement, un par
  commande) et `tpeweb@paybox.com` (compte rendu de télécollecte, chaque
  matin vers 04:55 ; le compte rendu de téléparamétrage de 01:55 sert
  seulement à savoir que tpeweb écrit encore). Tout autre mail est ignoré.
- Un mail n'est lu que si son en-tête `Authentication-Results` (posé par
  Gmail) montre une signature DKIM ou DMARC valide de `paybox.com`. Sinon il
  est classé « format non reconnu » et signalé, sans lire son corps.
  **Décision pour toi** : si le relevé à blanc montre que Paybox ne signe pas
  ses mails, tous seront refusés ; il faudra alors choisir entre garder cette
  exigence (rien n'est importé) ou l'assouplir par un nouveau mandat.
- Gardé : référence de commande, montant, numéro d'autorisation, date, accepté
  ou non ; pour la télécollecte, numéro de remise, nombres et totaux (achats,
  remboursements, annulations).
- **Jamais lu ni stocké** : la ligne de carte masquée (`trs_ticket_pan`, ligne
  11 du texte), la ligne « Email client », le corps du message.
- La boîte n'est jamais modifiée (ni lu/non lu, ni libellé, ni corbeille) :
  le jeton n'a que la portée `gmail.readonly`, vérifiée avant chaque passage ;
  un jeton plus large est refusé et rien n'est lu.

### Ce que le code écrit (mode `write` seulement)

- Chaque mail lu une fois dans `__paybox_mail_message` (id Gmail unique).
- Ticket accepté, commande payée au même montant, aucune ligne
  d'encaissement : `__order_capture_state` = `authorized`, source
  `paybox_mail`.
- Télécollecte du jour J égale (nombre et total, zéro remboursement, zéro
  annulation) aux tickets acceptés du jour J − 7 : chaque commande passe à
  `captured` au montant du ticket, à l'heure de la télécollecte. La facture
  BM part alors si `ORDER_BILLING_ENABLED` est actif.
- **Une saisie manuelle n'est jamais écrasée.** Un désaccord avec elle est un
  écart.
- Hypothèse des 7 jours : vue sur une seule paire (tickets du 7 novembre,
  télécollecte du 14 novembre, 42,20 €). Si elle est fausse, rien n'est
  écrit : la télécollecte part en écart « non rapprochée ».

### Écarts signalés (un mail par jour à `ADMIN_ORDER_EMAIL`, seulement s'il y en a)

Commande introuvable ou non payée, montant différent (une commande réduite
avant capture en fait partie : saisir l'état à la main), ticket en double,
télécollecte non rapprochée, désaccord avec la saisie, capture en retard
(ticket autorisé depuis 8 jours ou plus, répété chaque jour), ticket manquant
(paiement enregistré depuis plus de 24 h sans ticket), aucun mail de tpeweb
depuis 48 h, format non reconnu. Le mail ne contient que des références de
commande, des montants et la nature de l'écart.

### Variables (noms seulement)

| Variable | Rôle |
|---|---|
| `PAYBOX_MAIL_IMPORT_MODE` | `off` (défaut), `dry-run` ou `write` |
| `PAYBOX_MAIL_GMAIL_REFRESH_TOKEN` | jeton `gmail.readonly` du compte `automecanik.seo@gmail.com`, distinct de `GMAIL_REFRESH_TOKEN` (jeton d'envoi de contact@) |
| `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET` | client OAuth déjà posé, réutilisé : il n'accorde rien seul, la portée est portée par le jeton |
| `ADMIN_ORDER_EMAIL` | déjà posé, destinataire du mail d'écarts |

Sans `PAYBOX_MAIL_GMAIL_REFRESH_TOKEN` (ou sans le client OAuth), le mode est
`off` quelle que soit la valeur de `PAYBOX_MAIL_IMPORT_MODE`.

### Procédure pour Marwane

Les mails Paybox restent dans `automecanik.seo@gmail.com`, où ils arrivent aujourd'hui :
pas de transfert, pas de changement d'adresse dans le back-office Paybox
(complément n° 1, décision du 18 novembre 2026). Le serveur lit la boîte du
compte qui porte le jeton (`userId: 'me'`) ; aucune adresse n'est écrite dans
le code. Sans transfert, l'expéditeur d'origine et sa signature sont
conservés, et le contrôle exact de `From` reste valable.

1. **Créer le jeton de lecture, en DEV d'abord.** Avec le client OAuth déjà
   utilisé pour l'envoi, autoriser **le compte `automecanik.seo@gmail.com`** avec la seule
   portée `https://www.googleapis.com/auth/gmail.readonly` (OAuth Playground
   ou équivalent, « offline access »). Poser le jeton obtenu sous
   `PAYBOX_MAIL_GMAIL_REFRESH_TOKEN` ; ne pas toucher `GMAIL_REFRESH_TOKEN`
   (jeton d'envoi de contact@). Si l'écran de consentement est en mode
   « test », ajouter `automecanik.seo@gmail.com` comme utilisateur de test.
2. **Relevé à blanc.** Poser `PAYBOX_MAIL_IMPORT_MODE=dry-run`, redémarrer.
   Au démarrage, le journal dit « portée gmail.readonly seule, accepté » ou
   « jeton refusé ». Puis, connecté en admin :
   `POST /api/admin/paybox-mail/dry-run`. La réponse liste les mails lus, les
   écritures prévues et les écarts ; rien n'est écrit ni envoyé. Le passage
   quotidien de 06:30 (heure de Paris) tourne aussi en dry-run et ne fait que
   journaliser.
3. **Passer en écriture.** Seulement après un relevé à blanc qui couvre une
   vraie télécollecte (attendues le 23 ou le 24 novembre) et dont les écarts
   sont compris : `PAYBOX_MAIL_IMPORT_MODE=write`, redémarrer.
4. **Retour arrière.** `PAYBOX_MAIL_IMPORT_MODE=off` (ou retirer le jeton),
   redémarrer : le passage quotidien est désarmé au démarrage, rien n'est plus
   lu. Les lignes déjà écrites restent ; elles portent la source `paybox_mail`
   et l'id du mail (`ocs_updated_by = paybox_mail:<id>`) et se corrigent par la
   saisie manuelle. Le schéma se retire avec
   `20261118_paybox_mail_capture_import.down.sql`, qui refuse s'il reste des
   lignes `paybox_mail`.

Prérequis de schéma : migrations `20261117_order_billing_capture_invoice.sql`
(BM) puis `20261118_paybox_mail_capture_import.sql` (BT), par le workflow
« Apply Supabase migrations (manual) ».
