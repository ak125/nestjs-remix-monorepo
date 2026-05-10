# R6 — GUIDE D'ACHAT : role canonique

## Identite

- Role canonique : `R6_GUIDE_ACHAT`
- Promesse centrale exclusive : **aider a acheter la bonne piece sans erreur**
- Nature : surface editoriale d'aide au choix
- Gouvernance : `G1` a `G5`
- Ce role remplace toute ancienne lecture metier de type `R3_guide_achat`

---

## Ce que R6 EST

R6 est une surface qui aide a :

- identifier la bonne piece pour le bon vehicule
- securiser la reference
- verifier les specifications critiques
- choisir le bon niveau de qualite
- eviter les erreurs d'achat
- verifier correctement apres reception

---

## Ce que R6 N'EST PAS

R6 n'est pas :

- une procedure de remplacement → `R3_CONSEILS`
- une definition encyclopedique → `R4_REFERENCE`
- une orientation symptome / panne → `R5_DIAGNOSTIC`
- une surface transactionnelle → `R2_PRODUCT`
- une FAQ support generique → support / autre surface

---

## Double filtre canonique

### Filtre 1 — intention dominante

- choisir / comparer / verifier avant commande → `R6`
- remplacer / monter / controler → `R3`
- comprendre ce que c'est → `R4`
- identifier une panne → `R5`
- acheter maintenant / prix / stock → `R2`

### Filtre 2 — dependance vehicule

- faible a moyenne : admissible en `R6`
- forte dependance vehicule + km + historique : bascule possible vers `TOOL`

---

## Entrees minimales obligatoires

Le role R6 ne peut etre produit que si les entrees suivantes existent :

- `canonical_role = R6_GUIDE_ACHAT`
- identifiant metier exploitable (`pg_id`, `slug`, etc.)
- contrat R6 actif
- evidence pack admissible
- criteres de selection / compatibilite
- anti-erreurs / anti-mistakes
- donnees minimales de structure achat

Entrees optionnelles :

- FAQ achat
- clusters SEO
- use cases
- guide marques
- axes de compatibilite
- elements de budget admissibles

---

## Sections admissibles

R6 ne peut generer que des sections orientees achat, par exemple :

- identifier la bonne piece
- trouver la bonne reference
- verifier les specifications techniques
- choisir le bon niveau de qualite
- commander le bon pack
- checklist avant paiement
- verifier apres reception
- FAQ achat uniquement

---

## Interdits absolus

Ne jamais produire dans R6 :

- demontage
- remontage
- depose
- repose
- couple de serrage
- etapes de remplacement
- diagnostic de panne
- symptomes
- causes de panne
- definition encyclopedique comme angle central
- prix promo
- livraison gratuite
- ajouter au panier
- promesse commerciale R2

---

## Politique d'evidence

Sources autorisees :

- RAG admissible
- DB admissible
- contrat/schema R6
- brief valide
- evidence pack resolu

Interdits :

- invention
- extrapolation technique non prouvee
- comparaison de qualite non prouvee
- melange de sources contradictoires sans blocage

Si evidence insuffisante :

- ne pas generer la section
- ou retourner `HOLD_EVIDENCE_INSUFFICIENT`

---

## Politique de reroute

- procedure / remplacement → `R3_CONSEILS`
- definition / role mecanique → `R4_REFERENCE`
- symptome / panne / bruit / voyant → `R5_DIAGNOSTIC`
- transaction / prix / stock / panier → `R2_PRODUCT`
- personnalisation forte non editoriale → `TOOL`

---

## Sortie attendue

Une sortie R6 doit etre :

- role-pure
- compatible avec le contrat R6
- structuree
- non transactionnelle
- non procedurale
- non diagnostique
- non encyclopedique comme angle principal

---

## Repo awareness

Cette surface est consommee ou controlee par :

- `backend/src/modules/admin/services/buying-guide-enricher.service.ts`
- `backend/src/modules/admin/services/content-refresh.service.ts`
- `backend/src/config/page-contract-r6.schema.ts`
- `backend/src/config/r6-keyword-plan.constants.ts`
- routes frontend guide achat
- tables et stockage associes au guide d'achat

---

## Route legacy SEO

La route `/blog-pieces-auto/guide-achat/{alias}` est une URL legacy conservee pour preserver le SEO.
Le role canonique interne est `R6_GUIDE_ACHAT`, pas `R3_CONSEILS`.
Cette decision est documentee et assumee — ce n'est pas une collision metier.

---

## Regle finale

Aucune ancienne etiquette de type `R3_guide_achat` ne doit etre utilisee comme identite metier d'execution.
Elle peut exister comme compatibilite legacy d'entree, jamais comme canon d'execution.
