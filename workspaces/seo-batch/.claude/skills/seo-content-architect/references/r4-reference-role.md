# R4 — RÉFÉRENCE : rôle canonique

## Identité

- Rôle canonique : `R4_REFERENCE`
- Promesse centrale exclusive : **définir clairement un terme, une pièce, un concept ou une notion technique**
- Nature : surface encyclopédique technique
- Gouvernance : `G1` à `G5`

---

## Ce que R4 EST

R4 est une surface qui aide à :

- comprendre ce qu'est une pièce ou un terme
- clarifier son rôle mécanique
- distinguer des notions proches
- expliquer des différences importantes
- éviter les confusions de vocabulaire
- stabiliser une compréhension technique

---

## Ce que R4 N'EST PAS

R4 n'est pas :

- une procédure / how-to → `R3_CONSEILS`
- une orientation panne / symptôme → `R5_DIAGNOSTIC`
- un guide d'achat → `R6_GUIDE_ACHAT`
- une surface transactionnelle → `R2_PRODUCT`
- une fiche véhicule → `R8_VEHICLE`
- un hub marque → `R7_BRAND`

---

## Double filtre canonique

### Filtre 1 — intention dominante

- comprendre ce que c'est / clarifier une notion → `R4`
- agir / remplacer / entretenir → `R3`
- orienter un symptôme → `R5`
- choisir avant achat → `R6`
- acheter / stock / prix → `R2`

### Filtre 2 — dépendance véhicule

- faible dépendance véhicule : admissible en `R4`
- forte dépendance à un véhicule précis : bascule possible vers `R8`
- forte dépendance à un contexte symptôme : bascule possible vers `R5`

---

## Entrées minimales obligatoires

- `canonical_role = R4_REFERENCE`
- contrat R4 actif
- terme / organe / système / concept identifié
- evidence pack admissible
- base de définition ou de distinctions techniques exploitables

Entrées optionnelles :

- glossaire connexe
- distinctions OEM/OES/IAM
- confusions fréquentes
- liens vers R1/R3/R5/R6

---

## Sections admissibles

R4 ne peut générer que des sections encyclopédiques, par exemple :

- définition claire
- rôle mécanique
- composition ou principes utiles
- distinctions importantes
- confusions fréquentes
- limites de la notion
- FAQ de compréhension
- liens de renvoi utiles

---

## Interdits absolus

Ne jamais produire dans R4 :

- procédure détaillée
- étapes de remplacement
- diagnostic de panne comme angle principal
- guide d'achat comme angle principal
- prix / stock / panier / livraison
- compatibilité fine non prouvée
- dépendance forte à un véhicule précis comme axe central

---

## Politique d'evidence

Sources autorisées :

- RAG admissible
- DB admissible
- contrat R4
- brief validé
- evidence pack résolu

Interdits :

- invention de définition
- invention de composition
- invention de distinctions techniques
- invention de compatibilités non prouvées

Si evidence insuffisante :
- ne pas générer la section
- ou retourner `HOLD_EVIDENCE_INSUFFICIENT`

---

## Politique de reroute

- procédure / entretien / remplacement → `R3_CONSEILS`
- symptôme / panne → `R5_DIAGNOSTIC`
- guide de choix avant achat → `R6_GUIDE_ACHAT`
- transaction / offre produit → `R2_PRODUCT`
- dépendance véhicule forte → `R8_VEHICLE`

---

## Repo awareness

Cette surface est consommée ou contrôlée par :

- `backend/src/config/page-contract-r4.schema.ts`
- `backend/src/config/page-contract-r4-media.schema.ts`
- `backend/src/config/r4-keyword-plan.constants.ts`
- `backend/src/modules/seo/services/page-role-validator.service.ts`
- `frontend/app/routes/reference-auto.$slug.tsx`
- `frontend/app/routes/reference-auto._index.tsx`
- `frontend/app/routes/reference-auto.intent.$intent.tsx`
- `frontend/app/routes/reference-auto.systeme.$system.tsx`

---

## Règle finale

R4 doit rester une surface de compréhension technique.
Dès que l'objectif devient agir, diagnostiquer, acheter ou contextualiser fortement par véhicule, il faut bloquer ou rerouter.
