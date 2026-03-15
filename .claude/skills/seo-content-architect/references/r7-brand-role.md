# R7 — BRAND : rôle canonique

## Identité

- Rôle canonique : `R7_BRAND`
- Promesse centrale exclusive : **orienter et structurer l'accès à l'univers d'une marque**
- Nature : hub marque / constructeur
- Gouvernance : `G1` à `G5`

---

## Ce que R7 EST

R7 est une surface qui aide à :

- entrer par une marque
- explorer les véhicules liés à cette marque
- accéder aux grandes familles de pièces
- structurer la navigation marque
- proposer des raccourcis utiles

---

## Ce que R7 N'EST PAS

R7 n'est pas :

- une page d'accueil générale → `R0_HOME`
- une fiche véhicule précise → `R8_VEHICLE`
- une procédure / how-to → `R3_CONSEILS`
- une définition encyclopédique → `R4_REFERENCE`
- une surface transactionnelle pure → `R2_PRODUCT`
- une page diagnostic → `R5_DIAGNOSTIC`

---

## Double filtre canonique

### Filtre 1 — intention dominante

- entrer par le constructeur / la marque → `R7`
- entrer par un véhicule précis → `R8`
- entrer par une gamme / compatibilité → `R1`
- acheter / convertir → `R2`
- agir / remplacer → `R3`

### Filtre 2 — profondeur cible

- navigation marque large : admissible en `R7`
- contexte véhicule très précis : bascule vers `R8`
- contexte transactionnel direct : bascule vers `R2`

---

## Entrées minimales obligatoires

- `canonical_role = R7_BRAND`
- contrat R7 actif
- marque identifiée
- evidence pack admissible
- accès aux modèles / véhicules / familles associés
- structure navigationnelle marque exploitable

Entrées optionnelles :

- top recherches
- blocs de confiance
- raccourcis populaires
- contenus d'orientation marque

---

## Sections admissibles

R7 ne peut générer que des sections orientées hub marque, par exemple :

- présentation de l'entrée marque
- modèles clés
- accès véhicules
- familles de pièces utiles
- raccourcis de navigation
- top recherches
- FAQ marque légère

---

## Interdits absolus

Ne jamais produire dans R7 :

- procédure détaillée
- diagnostic panne
- définition encyclopédique d'organe comme angle central
- transaction produit comme axe central
- fiche véhicule détaillée
- guide d'achat complet

---

## Politique d'evidence

Sources autorisées :

- RAG admissible
- DB admissible
- contrat R7
- brief validé
- evidence pack résolu

Interdits :

- invention de couverture marque
- invention de compatibilités spécifiques
- invention d'historique détaillé
- promesses de disponibilité non prouvées

Si evidence insuffisante :
- ne pas générer la section
- ou retourner `HOLD_EVIDENCE_INSUFFICIENT`

---

## Politique de reroute

- véhicule précis → `R8_VEHICLE`
- gamme / orientation compatibilité → `R1_ROUTER`
- transaction / listing → `R2_PRODUCT`
- procédure / entretien → `R3_CONSEILS`
- définition technique → `R4_REFERENCE`
- symptôme / panne → `R5_DIAGNOSTIC`

---

## Repo awareness

Cette surface est consommée ou contrôlée par :

- `backend/src/config/page-contract-r7.schema.ts`
- `backend/src/config/r7-keyword-plan.constants.ts`
- `backend/src/config/brand-role-map.schema.ts`
- `frontend/app/routes/constructeurs.$.tsx`
- `.claude/agents/r7-keyword-planner.md`
- `.claude/agents/r7-brand-rag-generator.md`

---

## Routes legacy SEO

Deux points d'entrée coexistent :
- `/constructeurs/{brand}` — route principale R7
- `/blog-pieces-auto/constructeurs/` — index legacy conservé pour SEO

Le rôle canonique interne est `R7_BRAND` pour les deux. Cette coexistence est documentée et assumée.

---

## Règle finale

R7 doit rester une surface d'entrée marque.
Dès que l'objectif principal devient véhicule précis, transaction, procédure, définition ou diagnostic, il faut bloquer ou rerouter.
