# R8 — VEHICLE : rôle canonique

## Identité

- Rôle canonique : `R8_VEHICLE`
- Promesse centrale exclusive : **orienter à partir d'un véhicule précis vers les bonnes familles de pièces et contenus associés**
- Nature : hub véhicule / fiche véhicule
- Gouvernance : `G1` à `G5`

---

## Ce que R8 EST

R8 est une surface qui aide à :

- entrer par un véhicule précis
- contextualiser variantes, motorisations et familles utiles
- relier le véhicule aux bons contenus et parcours
- structurer l'accès vers gammes, conseils, références et diagnostics liés

---

## Ce que R8 N'EST PAS

R8 n'est pas :

- une page marque → `R7_BRAND`
- une surface transactionnelle pure → `R2_PRODUCT`
- une procédure détaillée → `R3_CONSEILS`
- une définition encyclopédique → `R4_REFERENCE`
- un diagnostic central → `R5_DIAGNOSTIC`
- un outil expert personnalisé profond → `TOOL`

---

## Double filtre canonique

### Filtre 1 — intention dominante

- entrer par un véhicule précis → `R8`
- entrer par une marque → `R7`
- entrer par une gamme / sélection de pièce → `R1`
- acheter / convertir → `R2`
- agir / remplacer / contrôler → `R3`
- diagnostiquer un symptôme → `R5`

### Filtre 2 — profondeur de contexte

- identité véhicule + variantes + orientation globale : admissible en `R8`
- besoin de transaction immédiate : bascule `R2`
- besoin de diagnostic personnalisé profond : bascule `TOOL`
- besoin de procédure : bascule `R3`

---

## Entrées minimales obligatoires

- `canonical_role = R8_VEHICLE`
- contrat R8 actif
- véhicule identifié
- evidence pack admissible
- données variantes / motorisations / familles de pièces / points utiles

Entrées optionnelles :

- points d'usure
- liens conseils
- liens références
- liens diagnostics
- raccourcis catalogue

---

## Sections admissibles

R8 ne peut générer que des sections orientées véhicule, par exemple :

- identité véhicule
- variantes / motorisations
- familles de pièces utiles
- points d'attention généraux
- accès vers contenus liés
- FAQ véhicule légère

---

## Interdits absolus

Ne jamais produire dans R8 :

- transaction pure
- guide d'achat comme angle central
- diagnostic comme angle central
- définition encyclopédique comme angle central
- procédure détaillée
- personnalisation profonde façon outil expert

---

## Politique d'evidence

Sources autorisées :

- RAG admissible
- DB admissible
- contrat R8
- brief validé
- evidence pack résolu

Interdits :

- invention de motorisations
- invention de périodes
- invention de spécificités techniques
- invention de maintenance non prouvée

Si evidence insuffisante :
- ne pas générer la section
- ou retourner `HOLD_EVIDENCE_INSUFFICIENT`

---

## Politique de reroute

- marque → `R7_BRAND`
- gamme / orientation compatibilité → `R1_ROUTER`
- transaction / produit → `R2_PRODUCT`
- procédure / entretien → `R3_CONSEILS`
- définition technique → `R4_REFERENCE`
- symptôme / panne → `R5_DIAGNOSTIC`
- besoin expert fortement personnalisé → `TOOL`

---

## Repo awareness

Cette surface est consommée ou contrôlée par :

- `backend/src/config/page-contract-r8.schema.ts`
- `backend/src/config/r8-keyword-plan.constants.ts`
- `backend/src/modules/admin/services/vehicle-rag-generator.service.ts`
- stockage RAG véhicule
- `.claude/agents/r8-keyword-planner.md`

---

## Route legacy SEO

Les pages véhicule sont actuellement servies sous `/blog-pieces-auto/auto/{marque}/{modele}` (namespace legacy blog).
Il n'existe pas encore de route dédiée `/vehicule/{slug}`.
Le rôle canonique interne est `R8_VEHICLE`. Cette route legacy est documentée et assumée.

---

## Règle finale

R8 doit rester une surface d'entrée véhicule.
Dès que l'objectif principal devient marque, transaction, procédure, définition, diagnostic ou outil expert, il faut bloquer ou rerouter.
