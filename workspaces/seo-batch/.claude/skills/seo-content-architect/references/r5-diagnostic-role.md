# R5 — DIAGNOSTIC : rôle canonique

## Identité

- Rôle canonique : `R5_DIAGNOSTIC`
- Promesse centrale exclusive : **aider à orienter un problème à partir d'un symptôme ou d'un signal anormal**
- Nature : surface symptomatique / triage éditorial prudent
- Gouvernance : `G1` à `G5`

---

## Ce que R5 EST

R5 est une surface qui aide à :

- partir d'un symptôme observable
- proposer des hypothèses prudentes
- organiser des vérifications simples
- signaler les niveaux de risque
- décider quoi vérifier d'abord
- orienter vers la bonne suite du parcours

---

## Ce que R5 N'EST PAS

R5 n'est pas :

- une procédure détaillée → `R3_CONSEILS`
- une définition encyclopédique → `R4_REFERENCE`
- un guide d'achat → `R6_GUIDE_ACHAT`
- une surface transactionnelle → `R2_PRODUCT`
- un outil expert personnalisé profond → `TOOL`

---

## Double filtre canonique

### Filtre 1 — intention dominante

- symptôme / bruit / voyant / anomalie → `R5`
- remplacement / contrôle / action → `R3`
- compréhension d'un terme ou d'une pièce → `R4`
- choix avant commande → `R6`
- achat direct / offre produit → `R2`

### Filtre 2 — dépendance contexte

- contexte générique ou semi-contextuel : admissible en `R5`
- forte dépendance véhicule + kilométrage + historique + combinaisons profondes : bascule `TOOL`

---

## Entrées minimales obligatoires

- `canonical_role = R5_DIAGNOSTIC`
- contrat R5 actif
- evidence pack admissible
- symptôme / signal / observable identifié
- niveau de risque ou de prudence exploitable
- quick checks ou logique d'orientation minimale

Entrées optionnelles :

- niveaux d'urgence
- causes probables admissibles
- liens vers R3/R4/R1
- bloc sécurité

---

## Sections admissibles

R5 ne peut générer que des sections orientées diagnostic éditorial prudent, par exemple :

- symptôme observé
- hypothèses plausibles
- quick checks
- drapeaux de risque
- quand arrêter l'usage
- quand consulter / escalader
- renvois utiles vers autres rôles

---

## Interdits absolus

Ne jamais produire dans R5 :

- procédure détaillée complète
- démontage / remontage
- causes affirmées comme certaines sans preuve
- définition encyclopédique comme angle central
- guide d'achat
- transaction / prix / stock / panier
- personnalisation profonde sans contexte suffisant

---

## Politique d'evidence

Sources autorisées :

- RAG admissible
- DB admissible
- contrat R5
- brief validé
- evidence pack résolu

Interdits :

- invention de cause certaine
- invention de sécurité critique
- hiérarchisation arbitraire des causes
- action définitive non prouvée

Si evidence insuffisante :
- ne pas générer la section
- ou retourner `HOLD_EVIDENCE_INSUFFICIENT`

Si contexte trop faible pour un diagnostic éditorial fiable :
- `HOLD`
- ou reroute `TOOL`

---

## Politique de reroute

- procédure / remplacement → `R3_CONSEILS`
- définition / rôle mécanique → `R4_REFERENCE`
- guide d'achat / choix avant commande → `R6_GUIDE_ACHAT`
- transaction / produit → `R2_PRODUCT`
- personnalisation forte véhicule / historique / multi-facteurs → `TOOL`

---

## Repo awareness

Cette surface est consommée ou contrôlée par :

- `backend/src/config/page-contract-r5.schema.ts`
- `backend/src/config/r5-diagnostic.constants.ts`
- `backend/src/modules/diagnostic-engine/types/diagnostic-contract.schema.ts`
- `backend/src/modules/diagnostic-engine/types/diagnostic-input.schema.ts`
- `backend/src/modules/diagnostic-engine/types/evidence-pack.schema.ts`
- `backend/src/modules/seo/controllers/diagnostic.controller.ts`
- `backend/src/modules/seo/services/diagnostic.service.ts`
- `frontend/app/routes/diagnostic-auto.$slug.tsx`
- `frontend/app/routes/diagnostic-auto._index.tsx`
- `frontend/app/routes/diagnostic.tsx`

---

## Règle finale

R5 doit rester une surface d'orientation prudente à partir d'un symptôme.
Dès qu'il faut surtout démonter, expliquer encyclopédiquement, acheter ou personnaliser profondément, il faut bloquer ou rerouter.
