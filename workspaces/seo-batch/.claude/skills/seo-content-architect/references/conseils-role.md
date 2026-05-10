# R3 — CONSEILS / HOW-TO : role canonique

## Identite

- Role canonique : `R3_CONSEILS`
- Promesse centrale exclusive : **aider a agir correctement sur une operation, un entretien, un remplacement ou une verification generique**
- Nature : surface editoriale d'action
- Gouvernance : `G1` a `G5`

---

## Ce que R3 EST

R3 est une surface qui aide a :

- preparer une operation
- comprendre quand intervenir
- verifier la compatibilite avant action
- executer ou cadrer une operation generique
- eviter les erreurs frequentes
- verifier apres intervention

---

## Ce que R3 N'EST PAS

R3 n'est pas :

- une definition encyclopedique → `R4_REFERENCE`
- une orientation panne/symptome → `R5_DIAGNOSTIC`
- un guide d'achat → `R6_GUIDE_ACHAT`
- une surface transactionnelle → `R2_PRODUCT`
- une surface personnalisee forte dependante du vehicule/km/historique → `TOOL`

---

## Double filtre canonique

### Filtre 1 — intention dominante

- agir / remplacer / controler / verifier → `R3`
- comprendre ce que c'est → `R4`
- orienter une panne → `R5`
- choisir avant achat → `R6`
- acheter / prix / stock → `R2`

### Filtre 2 — dependance vehicule

- faible a moyenne : admissible en `R3`
- forte dependance vehicule + km + historique : bascule `TOOL`

---

## Entrees minimales obligatoires

- `canonical_role = R3_CONSEILS`
- contrat R3 actif
- evidence pack admissible
- sections admissibles
- safety policy si surface sensible
- compatibilite minimale / anti-mistakes si necessaire

Entrees optionnelles :
- FAQ maintenance
- related parts
- checklist
- bloc securite
- clusters SEO

---

## Sections admissibles

Exemples de sections admissibles :

- avant de commencer
- quand intervenir
- compatibilite avant action
- depose / repose si preuve suffisante
- erreurs frequentes
- verification finale
- pieces associees
- FAQ maintenance

---

## Interdits absolus

Ne jamais produire dans R3 :

- definition comme angle central
- diagnostic approfondi
- arbre de causes
- code DTC / OBD comme focus principal
- guide d'achat
- prix / stock / livraison / panier
- personnalisation forte non editoriale

---

## Politique d'evidence

Sources autorisees :

- RAG admissible
- DB admissible
- contrat R3
- brief valide

Interdits :

- invention de procedure
- couples de serrage inventes
- securite inventee
- extrapolation non prouvee

Si une section critique n'est pas prouvable :
- ne pas la generer
- ou retourner `HOLD_EVIDENCE_INSUFFICIENT`

---

## Politique de reroute

- definition centrale → `R4_REFERENCE`
- symptome / panne → `R5_DIAGNOSTIC`
- choix achat → `R6_GUIDE_ACHAT`
- transaction → `R2_PRODUCT`
- personnalisation forte → `TOOL`

---

## Repo awareness

Cette surface est consommee ou controlee par :

- `backend/src/modules/admin/services/conseil-enricher.service.ts`
- `backend/src/modules/admin/services/content-refresh.service.ts`
- `backend/src/config/page-contract-r3.schema.ts`
- `backend/src/config/keyword-plan.constants.ts`
- routes frontend conseils
- tables de sections conseils

---

## Regle finale

R3 doit rester une surface d'action generique.
Des qu'il faut surtout diagnostiquer, definir, acheter ou personnaliser fortement, il faut bloquer ou rerouter.
