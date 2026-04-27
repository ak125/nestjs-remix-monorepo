# R2 — PRODUCT : role canonique

## Identite

- Role canonique : `R2_PRODUCT`
- Promesse centrale exclusive : **convertir sur une offre / selection produit commercialement exploitable**
- Nature : surface transactionnelle
- Gouvernance : `G1` a `G5`

---

## Ce que R2 EST

R2 est une surface qui aide a :

- selectionner un produit precis
- convertir sur une offre exploitable
- presenter prix, stock, disponibilite
- faciliter l'ajout au panier et la commande

---

## Ce que R2 N'EST PAS

R2 n'est pas :

- une selection vehicule comme promesse centrale → `R1_ROUTER`
- une procedure de remplacement → `R3_CONSEILS`
- une definition encyclopedique → `R4_REFERENCE`
- un diagnostic de panne → `R5_DIAGNOSTIC`
- un guide d'achat editorial → `R6_GUIDE_ACHAT`

---

## Double filtre canonique

### Filtre 1 — intention dominante

- acheter / commander / prix / stock → `R2`
- choisir avant achat sans transaction directe → `R6`
- trouver la bonne piece pour le bon vehicule → `R1`
- remplacer / monter → `R3`
- comprendre ce que c'est → `R4`
- identifier une panne → `R5`

### Filtre 2 — contexte transactionnel

- transaction directe possible : admissible en `R2`
- editorial pur sans conversion directe : rerouter vers le role adapte

---

## Entrees minimales obligatoires

- `canonical_role = R2_PRODUCT`
- contrat R2 actif
- evidence pack admissible
- contexte produit/listing
- donnees transactionnelles minimales

---

## Interdits absolus

Ne jamais produire dans R2 :

- selection vehicule comme promesse centrale R1
- procedure de remplacement R3
- definition encyclopedique R4
- diagnostic panne R5
- contenu editorial guide d'achat R6

---

## Politique d'evidence

Ne jamais inventer :
- compatibilite
- stock
- prix
- garantie
- equivalence

---

## Politique de reroute

- choix avant achat sans transaction directe → `R6_GUIDE_ACHAT`
- selection vehicule → `R1_ROUTER`
- how-to → `R3_CONSEILS`
- definition → `R4_REFERENCE`
- symptome → `R5_DIAGNOSTIC`

---

## Repo awareness

Compatible avec :
- `page-contract-r2.schema.ts`
- `r2-keyword-plan.constants.ts`
- routes R2 frontend
- services produit backend

---

## Regle finale

R2 = surface transactionnelle. Tout contenu editorial pur doit etre reroute vers le role adapte.
