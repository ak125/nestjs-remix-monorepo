# Plan — Fix B R8 : éditorial owned → enricher (+ boucle régénération) · 2026-06-08

> **Reference plan, read-only, AVANT code.** Tracé sur `main` pour que l'implémentation ne
> parte pas trop vite et ne mélange pas Fix B + drain. Aucune mutation runtime ici. Chaque
> phase = **PR séparée, owner-gated**. Non-canon.

## Pourquoi (la vraie cause, enfin)

Le problème R8 (Défaut B, baseline #876) n'est **pas seulement le switch**. C'est que les blocs
**FAQ / catalogue / entretien / sélection** manquent d'**éditorial owned exploitable PAR
MOTORISATION** : ils tournent sur des **templates** (`selectVariation`) + la FAQ des fichiers RAG
par gamme → contenu générique, identique entre sœurs.

**La bonne source n'est ni TecDoc ni le scraping web brut.** C'est :

```
DB interne (FAITS par type_id)  +  éditorial OWNED déjà présent
(__seo_gamme_conseil / __seo_gamme_purchase_guide)  +  tissage par type véhicule
```

## Phase 0 — vérifié (read-only)

- `r8-vehicle-enricher.service.ts` `loadGammeRag` (L532) = **fichiers RAG** (FAQ seulement) ; la
  **DB éditoriale `__seo_gamme_*` n'est PAS lue**. Sections éditoriales (`S_SELECTION_GUIDE` L752,
  `S_ENTRETIEN_CONTEXT` L766, `S_VARIANT_DIFFERENCE` L728, `S_FAQ_DEDICATED` L810, `S_IDENTITY`)
  = `selectVariation` (templates en rotation).
- Éditorial owned **vérifié qualité** : `__seo_gamme_purchase_guide` 241 (gatekeeper **90.6**,
  **94% source-verified**, `how_to_choose` **241/241 distincts**) + `__seo_gamme_conseil` 2790
  (qualité **88.9**, **94% distincts**, sections R3 S1-S8). Caveats : `risk_explanation` ~62%
  partagé, `sgc_eeat_sources` vide, 20 drafts.
- `__seo_r8_regeneration_queue` / `__seo_r8_qa_reviews` = **write-only** (aucun consommateur) →
  boucle QC ouverte à l'étape « consommation ».

## Phase A — Fix B (PR séparée, flag OFF) — SCOPE STRICT

**Inclure UNIQUEMENT** :

1. `loadGammeEditorial(pgId)` (3-tier `SupabaseBaseService`) : lit `__seo_gamme_purchase_guide`
   (`how_to_choose`, `selection_criteria`, `timing`, `symptoms`, `risk_explanation`,
   `anti_mistakes`, `faq`) + `__seo_gamme_conseil` (`sgc_content` par `sgc_section_type`).
   **Garde qualité** : `is_draft=false`, `gatekeeper/quality_score ≥ 75`, dédup `risk_explanation`.
1. **Cache Redis + invalidation par `pgId`**.
1. **Wiring `composeBlocks` sous flag `R8_OWNED_EDITORIAL`** (× faits par type tissés) :
   `S_SELECTION_GUIDE` ← `how_to_choose`+`selection_criteria` · `S_ENTRETIEN_CONTEXT` ←
   `timing`+`symptoms`+`risk_explanation` · bloc erreurs ← `anti_mistakes` ·
   `S_VARIANT_DIFFERENCE`/`S_IDENTITY` ← `sgc_content` × faits · `S_FAQ_DEDICATED` ← `sgpg_faq`.
1. **Fallback EXPLICITE logué** `R8_OWNED_EDITORIAL_FALLBACK` : éditorial absent **ou** score
   insuffisant → comportement actuel (`selectVariation`). **Jamais de fallback silencieux.**
1. **Tests unitaires**.
1. **Pilote DEV uniquement** : freinage + filtre-à-air × types Clio III **affichables**.

**NE PAS inclure** : BullMQ drain · consumer `__seo_r8_regeneration_queue` · admin QA UI ·
refresh auto · RAW scrape · canonical/noindex/301/sitemap · génération massive.

## Garde-fous Phase A (explicites)

- flag `R8_OWNED_EDITORIAL` **OFF par défaut** (gouverné, pas ad-hoc)
- **aucune écriture DB nouvelle** sauf logs/events existants
- **pilote DEV only** ; rien de public ; rien d'auto-publié
- **rollback = flag OFF**
- **runtime-aware** : cache/queues/observabilité (`diversity_score`/`seo_decision`/`__seo_event_log`)
- **fallback VISIBLE** (log `R8_OWNED_EDITORIAL_FALLBACK`), jamais silencieux

## Critère de succès Phase A (porte vers Phase B)

Lift **`diversity_score`** / **`seo_decision`** mesurable **SANS baisse qualité** (spot-check
humain) sur le pilote. **Pas de lift → réviser, ne pas avancer.** Pas de gaming du gate.

## Phase B — NO-GO jusqu'à preuve Phase A

Drain `__seo_r8_regeneration_queue` → file BullMQ existante `R8_ENRICHMENT_QUEUE` (réutilise le
pattern outbox-relay) + **anti-boucle-infinie** (max-retry par `page_id` → escalade
`__seo_r8_qa_reviews` **humain**, stop re-queue). `qa_reviews` = surface humaine, jamais auto.

> **Pourquoi bloqué** : fermer la boucle **avant** Fix B = `regeneration_queue` → régénère le
> **même contenu pauvre** → reste `REGENERATE` → **boucle no-op infinie**.

## Séquencing (non négociable)

```
Phase 0 (fait) → Phase A Fix B + pilote DEV → VÉRIFIER lift → Phase B drain
```

## Verdict

- **GO** : commit ce plan (cette note) ; puis **Phase A** en PR flaggée OFF.
- **NO-GO** : Phase B (jusqu'à preuve), refresh massif, canonical/301/noindex, RAW scrape (dans Phase A).

Reference plan, pas canon. Cite `r8-vehicle-enricher.service.ts`, `__seo_gamme_purchase_guide`,
`__seo_gamme_conseil`, `R8_ENRICHMENT_QUEUE`, `__seo_r8_regeneration_queue`.
