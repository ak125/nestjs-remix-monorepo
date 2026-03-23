# R1 Content & Media Contract

> Version 1.0 — 2026-03-24

## Rôle de la page R1

Page gamme/catégorie. Intention : **aider l'utilisateur à trouver la bonne pièce pour son véhicule**.

## Sources de contenu

| Couche | Table / Source | Générateur | Rôle |
|--------|---------------|-----------|------|
| Corpus SEO long | `__seo_gamme.sg_content` | `/content-gen --r1` (editorial.md) | 1500-2000 mots, 6-8 H2, maillage interne |
| Micro-sections UX | `__seo_r1_gamme_slots.r1s_*` | `r1-content-batch` agent (generator.md) | Courtes (<150 mots), scannables, rendues directement |
| Keyword plan | `__seo_r1_keyword_plan` | `r1-keyword-planner` agent | Intent, section terms, anti-cannib R3 |

### Relation editorial.md / generator.md

- **editorial.md** : génère `sg_content` — corpus SEO riche, H2 dynamiques
- **generator.md** : génère `r1s_*` — micro-copy (buy_args, equip, motorisations, faq, intro_role)
- Les deux coexistent sur la page. Pas de chevauchement : `sg_content` = contenu long, `r1s_*` = widgets courts.

## Sources d'images

| Slot | Builder | Intention visuelle | RAG champs | Rendu |
|------|---------|-------------------|-----------|-------|
| HERO | `hero.builder.ts` | Photo produit, confiance | domain.role, selection.criteria | Hero section (image principale) |
| TYPES | `types.builder.ts` | Clarification variantes | selection.criteria, confusion_with | Section S4 (après contenu éditorial) |
| PRICE | `price.builder.ts` | Réassurance valeur | cost_range, criteria | Section S4 (après buy arguments) |
| LOCATION | `location.builder.ts` | Pédagogie emplacement | installation.* | Après motorisations (section S5) |
| OG | `og.builder.ts` | Diffusion sociale | domain.role, category | Meta tags uniquement (jamais body) |

### Negative prompts

- **HERO, OG** : `NEG_PHOTO` (bloque schéma, illustration)
- **TYPES, PRICE, LOCATION** : `NEG_SCHEMA` (bloque photo, studio)

## Qui écrit quoi

| Système | Champs | Fréquence | Garde-fou |
|---------|--------|-----------|-----------|
| `/content-gen --r1` | `sg_content`, meta draft | On-demand | Guard anti-régression (longueur ≥ existant) |
| `r1-content-batch` | `r1s_*` (5 colonnes) | Batch | Cannib guard score ≥ 65 |
| `r1-image-prompt.service` | `__seo_r1_image_prompts` | Admin trigger | Anti-overwrite (ne pas écraser image existante) |
| Admin UI | Upload/select/approve | Manuel | forceSelect pour remplacement, index DB unique |

## Frontend

Le frontend **consomme** le contrat, il n'arbitre rien :
- `R1SectionPack` merge sections (prompt > api > fallback)
- `R1ImagesBySlot` affiche les images par section
- `getOgImageUrl()` résout OG → HERO → pg_pic → default

## Maillage

Source de vérité : `__seo_gamme_links` (1199 liens, 236 gammes).
Règles : append-only, max 3 entrants, bidirectionnel, ancre naturelle.
