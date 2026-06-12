# R8 — Modèle de contenu éditorial par motorisation (reference design, NON-canon)

> Read-only. Définit la **structure de vrais paragraphes éditoriaux** par motorisation
> (pas seulement la FAQ, pas de la rotation de templates) et **quelle connaissance éditoriale
> OWNED** (DB `__seo_gamme_*`) alimente chaque section. **N'invente aucun contenu** (doctrine : pas de prose LLM ;
> tout est sourcé + validé). Référence, pas canon — cite role-matrix §R8 + `page-contract-r8`.

## Constat vérifié (code)

Les sections de l'enricher V5 (`R8_V5_PLANNABLE_SECTIONS`,
[`r8-keyword-plan.constants.ts:589`](../backend/src/config/r8-keyword-plan.constants.ts#L589)) :
`S_IDENTITY · S_COMPAT_SCOPE · S_VARIANT_DIFFERENCE · S_SELECTION_GUIDE · S_ENTRETIEN_CONTEXT · S_CATALOG_ACCESS · S_TECH_SPECS · S_FAQ_DEDICATED · S_TRUST`.

- **Sections FAITS** (DB interne par `type_id`, déjà OK) : `S_COMPAT_SCOPE`, `S_TECH_SPECS`, `S_CATALOG_ACCESS`.
- **Sections PROSE éditoriale** (existent, mais alimentées par **rotation de templates**
  `selectVariation` + RAG **par gamme** → PAS de vrai paragraphe par motorisation) :
  `S_IDENTITY` (intro), `S_VARIANT_DIFFERENCE`, `S_SELECTION_GUIDE`, `S_ENTRETIEN_CONTEXT`, `S_FAQ_DEDICATED`.

→ La **structure des paragraphes existe déjà**. Ce qui manque = **brancher la connaissance
éditoriale OWNED** (DB `__seo_gamme_*`, par gamme) pour les remplir. C'est ça « un vrai contenu paragraphe ».

## Le modèle (par section prose : paragraphe réel + source éditoriale owned + garde-fou faits)

| Section                | Vrai paragraphe attendu                           | Source éditoriale **OWNED (DB `__seo_gamme_*`, ~221-259 gammes, EEAT-sourcé)** | Garde-fou faits (DB interne)    |
| ---------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------- |
| `S_IDENTITY`           | **Présentation** : ce qu'est cette version        | `__seo_gamme_conseil.sgc_content` (section intro) × motorisation               | type/puissance/années/carburant |
| `S_VARIANT_DIFFERENCE` | **Ce qui distingue** cette motorisation des sœurs | `sgc_content` (spécificités) + faits moteur tissés                             | puissance/année/code moteur     |
| `S_SELECTION_GUIDE`    | **Comment choisir** la bonne pièce                | `__seo_gamme_purchase_guide.sgpg_how_to_choose` + `sgpg_selection_criteria`    | familles compatibles            |
| `S_ENTRETIEN_CONTEXT`  | **Entretien narratif** + vigilance                | `sgpg_timing_*` + `sgpg_symptoms` + `sgpg_risk_explanation`                    | intervalles                     |
| (erreurs)              | **Erreurs fréquentes** à éviter                   | `sgpg_anti_mistakes` (5-35 par gamme)                                          | —                               |
| `S_FAQ_DEDICATED`      | **FAQ** = un bloc **parmi d'autres**, pas le cœur | `sgpg_faq` (jsonb)                                                             | —                               |

## Règles (non négociables)

1. **Les paragraphes éditoriaux viennent de l'éditorial OWNED** (DB `__seo_gamme_*`,
   EEAT-sourcé/validé ; WIKI/RAW seulement pour combler des trous) — **jamais** d'une
   rotation de templates ni d'invention LLM.
1. **Les faits = garde-fous** (DB interne : compatibilité/specs), **pas la plume**.
1. **Décliné par rôle** : `R8` = ce qui caractérise cette motorisation · `R1` = comment choisir
   une gamme pour elle · `R2` = pourquoi ce produit précis est compatible. Même connaissance
   éditoriale owned, angles différents (anti-duplication entre rôles).

## Le vrai gap (correction — l'éditorial est OWNED, pas vide)

**L'éditorial existe déjà, owned, dans la DB** (vérifié) : `__seo_gamme_purchase_guide`
(221 gammes : `how_to_choose`, `risk_explanation`, `symptoms`, `timing`, `anti_mistakes`,
`faq`, `selection_criteria`…) + `__seo_gamme_conseil` (259 gammes, 2750 blocs prose
substantiels, EEAT-sourcé). **L'enricher R8 ne l'utilise pas** (il ne lit que la FAQ des RAG files).

Donc le gap **n'est PAS le sourcing** — c'est le **câblage** de cet éditorial owned dans
les sections prose R8, croisé avec les faits par type :

```
DB owned __seo_gamme_* (par gamme) × faits par type_id (DB)
→ content-gen rend les sections prose V5 par motorisation
```

**Aucune dépendance externe, aucun scraping, aucune invention.** Le RAW éditorial (#17→#21)
sert **uniquement à combler les trous** (gammes/sujets sans éditorial owned), en complément.

## Anti-bricolage

Des sœurs **quasi-identiques** (ex. 86 ch vs 106 ch berline, ~98,7% de familles communes)
partagent **légitimement** l'essentiel de l'éditorial → **ne pas forcer** de fausse différence.
La vraie diversité se joue au niveau **famille moteur / énergie / carrosserie / cran de puissance**,
pas entre quasi-jumeaux (ceux-ci = candidats **canonical-group**, finding #876, owner-gated, jamais
sans demande/URL).

## Portée

- **Reference design**, pas canon. Mutation (binder l'éditorial **owned DB `__seo_gamme_*`** →
  enricher R8 / content-gen sur ces sections, × faits par type) = chantier **séparé,
  owner-gated, runtime-aware** (observabilité/feature-flag/rollback/cache).
- Cite : `role-matrix §R8` (vault), `page-contract-r8.schema.ts`, `R8_V5_PLANNABLE_SECTIONS`.
- Ne modifie aucun contrat, aucune section, aucun runtime. Read-only.
