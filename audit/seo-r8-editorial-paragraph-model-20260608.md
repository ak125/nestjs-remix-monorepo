# R8 — Modèle de contenu éditorial par motorisation (reference design, NON-canon)

> Read-only. Définit la **structure de vrais paragraphes éditoriaux** par motorisation
> (pas seulement la FAQ, pas de la rotation de templates) et **quelle connaissance WIKI**
> alimente chaque section. **N'invente aucun contenu** (doctrine : pas de prose LLM ;
> tout est sourcé + validé). Référence, pas canon — cite role-matrix §R8 + `page-contract-r8`.

## Constat vérifié (code)

Les sections de l'enricher V5 (`R8_V5_PLANNABLE_SECTIONS`,
[`r8-keyword-plan.constants.ts:589`](../backend/src/config/r8-keyword-plan.constants.ts#L589)) :
`S_IDENTITY · S_COMPAT_SCOPE · S_VARIANT_DIFFERENCE · S_SELECTION_GUIDE · S_ENTRETIEN_CONTEXT ·
S_CATALOG_ACCESS · S_TECH_SPECS · S_FAQ_DEDICATED · S_TRUST`.

- **Sections FAITS** (DB interne par `type_id`, déjà OK) : `S_COMPAT_SCOPE`, `S_TECH_SPECS`, `S_CATALOG_ACCESS`.
- **Sections PROSE éditoriale** (existent, mais alimentées par **rotation de templates**
  `selectVariation` + RAG **par gamme** → PAS de vrai paragraphe par motorisation) :
  `S_IDENTITY` (intro), `S_VARIANT_DIFFERENCE`, `S_SELECTION_GUIDE`, `S_ENTRETIEN_CONTEXT`, `S_FAQ_DEDICATED`.

→ La **structure des paragraphes existe déjà**. Ce qui manque = la **connaissance éditoriale
réelle par motorisation** (WIKI) pour les remplir. C'est ça « un vrai contenu paragraphe ».

## Le modèle (par section prose : paragraphe réel + source WIKI + garde-fou faits)

| Section | Vrai paragraphe attendu (par motorisation) | Source WIKI (sourcée/validée) | Garde-fou faits (DB interne) |
|---|---|---|---|
| `S_IDENTITY` | **Présentation** : ce qu'est cette version (moteur, énergie, usage typique) | description véhicule/motorisation | type/puissance/années/carburant |
| `S_VARIANT_DIFFERENCE` | **Ce qui distingue** réellement cette motorisation des sœurs (moteur K9K, FAP, phase) — pas le mot « variant » | spécificités moteur/version | puissance/année/code moteur |
| `S_SELECTION_GUIDE` | **Comment choisir** la bonne pièce pour cette motorisation (critères, pièges) | critères de choix gamme × motorisation | familles compatibles |
| `S_ENTRETIEN_CONTEXT` | **Entretien narratif** : intervalles, points de vigilance (admission/EGR/turbo/carburant diesel) | entretien/vigilance par moteur | intervalles si présents |
| (erreurs) | **Erreurs fréquentes** à éviter (ex. confondre filtre air/habitacle/carburant) | erreurs connues par motorisation | — |
| `S_FAQ_DEDICATED` | **FAQ** = un bloc **parmi d'autres**, pas le cœur | Q&A par motorisation | — |

## Règles (non négociables)

1. **Les paragraphes éditoriaux viennent du WIKI éditorial** (sourcé + validé) —
   **jamais** d'une rotation de templates ni d'invention LLM.
2. **Les faits = garde-fous** (DB interne : compatibilité/specs), **pas la plume**.
3. **Décliné par rôle** : `R8` = ce qui caractérise cette motorisation · `R1` = comment choisir
   une gamme pour elle · `R2` = pourquoi ce produit précis est compatible. Même connaissance WIKI,
   angles différents (anti-duplication entre rôles).

## Dépendance honnête (le vrai blocage)

La couche **WIKI éditoriale par motorisation est VIDE aujourd'hui** (la chaîne RAW éditorial
#17→#21 a capturé 0 éditorial validé). Donc « vrais paragraphes » exige, dans l'ordre :

```
sources éditoriales (allowlist, owner) → RAW éditorial (runner) → validation humaine
→ WIKI par motorisation → content-gen rend les paragraphes (sections V5 ci-dessus)
```

**Aucun raccourci** : tant que le WIKI n'a pas de connaissance par motorisation, les sections
prose restent de la rotation (générique). On ne comble pas ça en inventant du texte.

## Anti-bricolage

Des sœurs **quasi-identiques** (ex. 86 ch vs 106 ch berline, ~98,7% de familles communes)
partagent **légitimement** l'essentiel de l'éditorial → **ne pas forcer** de fausse différence.
La vraie diversité se joue au niveau **famille moteur / énergie / carrosserie / cran de puissance**,
pas entre quasi-jumeaux (ceux-ci = candidats **canonical-group**, finding #876, owner-gated, jamais
sans demande/URL).

## Portée

- **Reference design**, pas canon. Mutation (binder WIKI → content-gen sur ces sections) =
  chantier **séparé, owner-gated, runtime-aware** (observabilité/flag/rollback).
- Cite : `role-matrix §R8` (vault), `page-contract-r8.schema.ts`, `R8_V5_PLANNABLE_SECTIONS`.
- Ne modifie aucun contrat, aucune section, aucun runtime. Read-only.
