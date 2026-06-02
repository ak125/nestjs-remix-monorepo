# Relance manuelle — 6 commandes non payées (suivi anonymisé)

> Action commerciale **Commercial & Ventes** (cf. [sales-funnel-report.md](./sales-funnel-report.md)).
> **Aucune PII ici** (noms/emails restent hors repo). Envoi **manuel par l'owner**, zéro automatisation, zéro paiement touché.
> Période : commandes non payées des 30 derniers jours. Maj 2026-05-31.

## Segmentation (clé)
**4/6 des commandes non payées sont des pièces désormais gelées** (embrayage en rupture) → on ne relance PAS vers le paiement.
- **Groupe A — produit vendable (1)** : relance « vérif compatibilité + dispo avant paiement ».
- **Groupe B — produit gelé/rupture (4)** : relance « pièce indisponible → proposition d'alternative » (on ne pousse pas au paiement d'une pièce qu'on sait indispo = leçon quarantaine).
- **1 ignorée** : compte de test (nom/email bidons).

## Objets d'email
- **A** : « Votre alternateur SNRA TC8051 — vérification compatibilité avant paiement »
- **B** : « Votre commande — pièce actuellement indisponible, proposition d'alternative »

## Message A — produit disponible (placeholders)
> Bonjour [Prénom],
>
> Nous avons vu que votre commande du [date] pour **[produit, réf]** n'a pas été finalisée.
>
> Avant tout paiement, souhaitez-vous que nous vérifiions la **compatibilité** avec votre véhicule et que nous **confirmions la disponibilité** de la pièce pour éviter toute mauvaise surprise ?
>
> Vous pouvez simplement répondre à cet email avec votre **plaque d'immatriculation** ou le **modèle exact** du véhicule.
>
> Cordialement,
> AutoMecanik

## Message B — produit en rupture (placeholders)
> Bonjour [Prénom],
>
> Votre commande du [date] pour **[produit, réf]** n'a pas été finalisée.
>
> Après vérification, **cette référence est actuellement en rupture chez notre fournisseur**. Plutôt que de vous faire payer puis de devoir vous rembourser, nous préférons vous prévenir et vous proposer une **alternative compatible** si elle existe.
>
> Souhaitez-vous que nous recherchions une pièce **équivalente, compatible et disponible** ? Répondez simplement avec votre **plaque d'immatriculation** ou le **modèle exact** du véhicule.
>
> Cordialement,
> AutoMecanik

## Tableau de suivi (anonymisé — remplir au fil des réponses)
| Commande | Groupe | Produit | Date | Répondu ? | Raison invoquée (prix/confiance/paiement/dispo/autre) | Besoin exprimé | Alternative proposée | Converti ? |
|---|---|---|---|---|---|---|---|---|
| ORD-…264 | A | Alternateur SNRA (TC8051) | 22/05 | | | | — | |
| ORD-…981 | B | Kit embrayage SASIC (SCL4123, gelé) | 19/05 | | | | | |
| ORD-…284 | B | Émetteur embrayage LUK (513 0046 10, gelé) | 07/05 | | | | | |
| ORD-…386 | B | Émetteur embrayage LUK (513 0049 10, gelé) | 06/05 | | | | | |
| ORD-…528 | B | Émetteur embrayage LUK (513 0049 10, gelé) | 02/05 | | | | | |
*(ORD-…921 maître-cylindre = compte test, ignoré.)*

## Ce que ça mesure (invisible au tracking)
Raison réelle d'abandon : doute compatibilité · prix · délai/dispo · confiance · rupture · appétence pour une alternative. **Besoin exprimé** = la phrase libre du client (« je veux la pièce vite », « pas sûr de la réf », « j'ai acheté ailleurs »).

## Règles de décision après réponses
- Plusieurs « compatibilité » → renforcer les blocs compatibilité sur pages (→ Pages & SEO report).
- Plusieurs « prix » → revoir pricing/concurrence.
- Plusieurs « délai/dispo » → renforcer disponibilité/alternatives.
- Plusieurs B convertissent sur alternative → l'alternative est une vraie opportunité (gamme embrayage).
- Personne ne répond → relance J+2 très courte, puis passer au **Pages & SEO report** (fuite vue→panier 4 %).
