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
- **Non livré** : lecture quotidienne automatique et alerte de capture en
  retard. Les deux dépendent de cette réponse.
