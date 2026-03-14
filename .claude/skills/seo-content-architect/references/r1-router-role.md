# R1 — ROUTER GAMME : rôle canonique

## Identité

- Rôle canonique : `R1_ROUTER`
- Promesse centrale exclusive : **aider à trouver la bonne pièce pour le bon véhicule**
- Nature : surface d'orientation et de sélection
- Gouvernance : `G1` à `G5`

---

## Ce que R1 EST

R1 est une surface qui aide à :

- entrer dans la bonne gamme
- cadrer une sélection véhicule
- orienter vers la bonne famille de pièces
- réduire les erreurs de navigation
- préparer proprement l'accès à une surface `R2_PRODUCT`

---

## Ce que R1 N'EST PAS

R1 n'est pas :

- une surface transactionnelle produit → `R2_PRODUCT`
- une procédure / how-to → `R3_CONSEILS`
- une définition technique → `R4_REFERENCE`
- une orientation panne / symptôme → `R5_DIAGNOSTIC`
- un guide d'achat éditorial → `R6_GUIDE_ACHAT`

---

## Double filtre canonique

### Filtre 1 — intention dominante

- trouver la bonne porte d'entrée / la bonne gamme → `R1`
- acheter maintenant / comparer une offre → `R2`
- remplacer / entretenir / agir → `R3`
- comprendre ce qu'est la pièce → `R4`
- diagnostiquer un symptôme → `R5`
- choisir avant achat → `R6`

### Filtre 2 — dépendance véhicule

- dépendance véhicule forte mais orientée sélection : admissible en `R1`
- dépendance véhicule + transaction directe : bascule possible vers `R2`
- dépendance véhicule + diagnostic profond : bascule `TOOL` ou `R5` selon contexte

---

## Entrées minimales obligatoires

- `canonical_role = R1_ROUTER`
- contrat R1 actif
- gamme / famille / slug de pièce
- contexte de sélection ou de compatibilité admissible
- evidence pack admissible
- logique de routing ou de compatibilité exploitable

Entrées optionnelles :

- blocs FAQ de sélection
- variantes de gamme
- rappels de compatibilité
- liens contextuels vers R3/R4/R5/R6

---

## Sections admissibles

R1 ne peut générer que des sections orientées routing, par exemple :

- comprendre à quoi sert la gamme dans le parcours
- sélectionner le bon véhicule
- vérifier les critères de compatibilité essentiels
- identifier les variantes utiles
- éviter les erreurs de sélection
- accéder à la suite du parcours
- FAQ de sélection uniquement

---

## Interdits absolus

Ne jamais produire dans R1 :

- prix détaillés
- stock
- livraison
- panier
- CTA transactionnels dominants
- procédure de montage
- étapes de remplacement
- définition encyclopédique comme angle central
- diagnostic de symptôme
- guide d'achat détaillé

---

## Politique d'evidence

Sources autorisées :

- RAG admissible
- DB admissible
- contrat R1
- brief validé
- contexte de routing / compatibilité

Interdits :

- invention de compatibilité
- invention de variantes
- invention de règles de sélection
- mélange de critères contradictoires sans blocage

Si evidence insuffisante :
- ne pas générer la section
- ou retourner `HOLD_EVIDENCE_INSUFFICIENT`

---

## Politique de reroute

- transaction / produit / prix / stock → `R2_PRODUCT`
- procédure / remplacement → `R3_CONSEILS`
- définition / rôle mécanique → `R4_REFERENCE`
- symptôme / panne → `R5_DIAGNOSTIC`
- choix avant commande → `R6_GUIDE_ACHAT`

---

## Repo awareness

Cette surface est consommée ou contrôlée par :

- `backend/src/config/page-contract-r1.schema.ts`
- `backend/src/config/r1-keyword-plan.constants.ts`
- `backend/src/modules/admin/services/r1-content-pipeline.service.ts`
- `backend/src/modules/admin/services/r1-keyword-plan-gates.service.ts`
- `frontend/app/routes/pieces.$slug.tsx`
- `frontend/app/utils/r1-section-pack.ts`

---

## Règle finale

R1 doit rester une surface de routage et de sélection.
Dès que la promesse centrale devient transaction, procédure, définition, diagnostic ou guide d'achat, il faut bloquer ou rerouter.
