# R-Page Excellence Baseline — doctrine (cited, not redefined)

> **Cette PR ne définit pas l'excellence de toutes les pages R.** Elle démarre par **R3** (sujet
> actif, voir la note pilote `seo-r3-eeat-baseline-filtre-a-air-20260606.md`). La doctrine devra être
> déclinée **ensuite, un rôle à la fois**, pour R1, R2, R7, R8.
>
> **Reference projection — non-canon.** Ce document ne crée aucune règle ni aucun seuil : il **cite**
> le canon et les barres gouvernées existantes. La vérité des rôles reste `.spec/00-canon/role-matrix.md`
> (v5 figée) ; les barres restent les contrats + scorers nommés ci-dessous.

## Principe directeur

**L'excellence d'une page R = satisfaire excellemment la PROMESSE de son rôle (role-matrix), telle que
mesurée par le contrat + le scorer gouvernés EXISTANTS de ce rôle — sans empiéter sur les rôles voisins.**

Conséquences : même *objectif* (excellence), mais **rôle / sections / score / CTA différents** par page.
Là où un rôle n'a **pas encore** de barre gouvernée, c'est un **gap noté** — jamais une grille inventée ici.

## Définition par rôle (citations, paths)

| Rôle | Promesse (role-matrix v5) | Barre / contrat cité | Scorer existant | Règle « ne pas bavurer » |
|---|---|---|---|---|
| **R1** router gamme/compat | trouver la bonne gamme pour le véhicule | `backend/src/config/page-contract-r1.{json,schema.ts}` ; `packages/seo-role-contracts/src/contracts/r1.ts` | `quality-scoring-engine.service.ts` (R1) | 0 prix/stock/panier (= R2) ; how-to → lien R3 |
| **R2** produit/transactionnel | acheter la bonne référence | `backend/src/config/page-contract-r2.schema.ts` + données produit (prix/stock/compat) | (vérifier barre dédiée — gap si absente) | pas de conseil dominant (= R3/R4) ; **surface sensible catalogue/prix** |
| **R3** conseil/pilier léger *(pilote)* | intervenir correctement sur la pièce | `backend/src/config/conseil-pack.constants.ts` → `PACK_DEFINITIONS.eeat` ; `page-contract-r3.{json,schema.ts}` ; `packages/seo-role-contracts/src/contracts/r3.ts` | `conseil-quality-scorer.service.ts` (section /100) ; `quality-scoring-engine.service.ts` (page) | S3 = compatibilité/critères (≠ « comment choisir » R6) ; pas d'encyclopédie (= R4) ; CTA **soft → R1** ; forbidden_dominant_signals R3 (`role-matrix.md` : buying_checklist, quality_tiers, transactional_listing, symptom_tree, deep_glossary) |
| **R7** hub marque | explorer l'univers d'une marque | `backend/src/config/page-contract-r7.schema.ts` | (vérifier barre dédiée — gap si absente) | pas de générique ; pas de duplication R3 |
| **R8** fiche véhicule | contexte véhicule → bonnes pièces | `backend/src/config/page-contract-r8.schema.ts` (+ règle noindex types 60000-83456) | `r8-diversity-check` (anti-duplicate sœurs) | pas de contenu constructeur générique ; canonical/index propres |

Invariant transverse cité : les ancres de section sont **dérivées au runtime** (`slugifyTitle(titre)`,
`backend/src/modules/blog/services/r3-guide.service.ts`) — donc fonction de l'éditorial, pas d'un set figé.

## Statut des pilotes

- **R3 — FAIT** : `audit/seo-r3-eeat-baseline-filtre-a-air-20260606.md` (pilote #1, read-only).
- **R1 · R2 · R7 · R8 — DEFERRED** : non audités dans cette PR (voir §Extension future).

## Extension future (NO-GO maintenant — gated, un rôle à la fois)

- **Phase 2** : un pilote baseline **par rôle** (R1, puis R2, R7, R8), même forme que la note R3,
  **citant le contrat + scorer de CE rôle**, **un seul rôle par PR**, read-only. R2 = catalogue/prix
  → prudence accrue. Si un rôle n'a pas de scorer dédié, le pilote **note le gap** (n'invente pas de barre).
- **Phase 3** : corrections ciblées par rôle via le pipeline gouverné (`/content-gen`), **jamais** de
  génération massive ; toute 301/canonical reste owner-gated + ADR, **après** baseline du rôle prête.

## Garde-fous de cette doctrine

- **Citer, pas redéfinir** : aucun seuil/grille nouveau ici ; tout pointe `role-matrix` + les contrats/scorers nommés.
- **Pas de vérité parallèle** : si une règle de rôle change, ça passe par son canon (vault ADR / contrat), pas par ce doc.
- **Read-only** : ce document n'agit sur aucun runtime, aucune URL, aucun contenu.
