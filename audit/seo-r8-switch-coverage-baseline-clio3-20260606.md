# R8 Switch-Coverage Baseline — pilote Clio III (READ-ONLY) · 2026-06-06

> **AUCUNE MUTATION.** SELECT only (DB live `cxpojprgwgubzjyqzmoq`) + lecture code. Aucune génération,
> aucun enrichissement, aucun changement runtime, aucune canonical/301/noindex, aucune modif R1/R2.
> **Anti-réinvention** : *cette baseline n'introduit aucune métrique nouvelle ; elle projette l'existant
> (`r8-vehicle-enricher` + système de switch + `__seo_r8_fingerprints`).*
> `indexability_status = observed` · `noindex_action = out_of_scope`.

## Synthèse

| Metric | Value | Meaning |
|---|---|---|
| Clio III types total | **45** | 3 carrosseries (berline 26 / break 17 / camionnette 2) |
| Displayable types | **33** | cible R8 switch coverage (`type_display='1'` → 200, indexable) |
| Enriched types | **2** (3 versions) | le switch a tourné |
| Generic live types | **31** | coverage gap → **risque duplicate live élevé** |
| Hidden types | **12** | hors-scope (dédup TecDoc, confirmé owner) |
| 1.5 dCi types | **18** | groupe de sœurs à haut risque (cross-carrosserie) |
| R8 enriched global | **155** | univers pilote (DS 81 / SMART 71 / Renault 3) |
| Indexed enriched pages | **1** | indexabilité réelle actuelle (/155) |
| Avg diversity | **61.2** | sous `index_min` 70 |

**`cluster_verdict` Clio III = `SWITCH_COVERAGE_GAP`** (31/33 affichables non enrichis).

## Le sujet

Page R8 = fiche véhicule `/constructeurs/{marque}/{modele}/{type}.html`, **une par motorisation**. Objectif
owner : **33 motorisations = 33 contenus distincts**, via le **système de switch** déjà construit. Une page
est **rendue par type** via `/api/vehicles/types/{id}/page-data-rpc` (loader
[`constructeurs.$brand.$model.$type.tsx`](../frontend/app/routes/constructeurs.$brand.$model.$type.tsx)),
**indépendamment de l'enrichissement** — donc « page existe » (33) ≠ « page enrichie » (2).

## Deux défauts distincts (fixes différents)

- **Défaut A — coverage gap** : `45 = 12 masquées + 2 enrichies + 31 génériques`. Les **31** affichables non
  enrichies rendent **le contenu générique attendu par le fallback** → **risque duplicate live élevé**
  *(formulation prudente : le HTML rendu n'a pas été comparé page-à-page ; le risque est structurel, pas un
  verdict absolu)*. **Fix = lancer le switch** sur ces types.
- **Défaut B — diversité post-enrichment** : même enrichi, `diversity_score` moyen **61.2 < 70** → **1 page
  indexée /155**. **Fix = vraie diversification FAQ/catalogue** (≠ même fix que A).

## État vérifié (DB live, read-only)

**Clio III** (modele `140004` berline / `140005` break / `11387` camionnette) :
- **33 affichables** = cible · **12 masquées = normal, hors-scope** (dédup TecDoc : carburant alt relabelé
  Hi-Flex GPL/Éthanol ; jumeaux de puissance 65↔64, 103↔106… ; entrée mince 1.6 107 ch = 2989 pièces).
- **2 enrichies** (`__seo_r8_pages`, dont 1 `INDEX` div 88) + **31 génériques live**.
- Sportour (`6446`) + EURO CLIO III (`5462`) = **0 type** (coquilles/alias).

**Groupe à haut risque — « 1.5 dCi » cross-carrosserie (18 types, 1 seul enrichi) :**

| carrosserie | type_ids (puissance ch) | enrichi |
|---|---|---|
| Berline (140004) | 26627(64) · 30141(65)* · 19051(68) · 34744(75) · 28839(82)* · 19052(86) · 34746(88) · 20078(103)* · **19053(106)** | **19053** |
| Break (140005) | 34749(65) · 23455(68) · 34745(75) · 23456(86) · 34747(88) · 23457(103) · 23458(106)* | — |
| Camionnette (11387) | 77069(75) · 77070(88) | — |

`*` = masqué (`type_display='0'`). Jumeaux cross-carrosserie (ex. 86 ch berline `19052` ↔ break `23456`,
106 ch berline `19053` ↔ break `23458`).

**Pilote R8 global** : 155 pages = **DS 81** (15 modèles, avg 60.9, 0 indexée) / **SMART 71** (15 modèles,
avg 61.3, 0 indexée) / **Renault-Clio III 3** (avg 68.3, 1 indexée). Peugeot/Citroën/VW/Audi/Ford/Opel = **0**.

## Cause racine du Défaut B (diagnostiquée — lecture code)

`faq_signature` **et** `category_signature` = **`PRESENT_IDENTICAL`** (pas absents) : par groupe de sœurs,
`content`/`semantic` distincts, mais FAQ et catalogue collapsent à **1 seule valeur** (ex. `smart::city coupe
(450)::essence::coupé` 12 pages → 1 FAQ / 1 catalogue ; `ds::ds 3::essence::berline` 8 pages → idem).

- **FAQ** sourcée **par gamme** : `gammeRags.flatMap(g => g.faq)`
  ([`r8-vehicle-enricher.service.ts`](../backend/src/modules/admin/services/r8-vehicle-enricher.service.ts) L239-240, L806),
  indexée `pg_alias` → **identique pour toutes les sœurs**. `faqSignature=sha256(faqBlock)` (L984).
- **Catalogue** = top familles par `product_count` via RPC `compatible_families` (L194-200, L792-793) →
  **même liste pour toutes les sœurs**. `categorySignature=sha256(categoryBlock)` (L985-987).
- Le switch (`selectVariation`, [`seo-variations.config.ts`](../backend/src/config/seo-variations.config.ts))
  ne fait varier que les **ouvertures de texte**, pas les **pools de contenu**.

## Le système de switch (existant — réutiliser, ne pas réinventer)

- **Blocs** : `selectVariation(pool, typeId, pgId, offset)` = `(typeId+pgId+offset) % pool.length` ; pools
  INTRO 7 · VARIANT_HIGHLIGHT 11 · CATALOG_ACCESS 7 · FAQ_OPENING 7 · TRUST 5 ; salts `R8_SLOT_OFFSETS`.
- **Meta** : `SeoRoleTemplateSelector` → `SeoSwitchSelector` (seed sha256) sur DB `__seo_role_template_pool`
  (7 titres + 11 desc) → persisté `variant_signature` (`__seo_r8_pages`).
- **Clustering/garde** : `buildNeighborFamilyKey = brand::model::fuel::body` ; `applyMetaCollisionPenalty`.
  **Limite** : la clé inclut la carrosserie → **jumeaux cross-carrosserie jamais comparés** entre eux.
- **Gate** : `R8_DIVERSITY_THRESHOLDS.index_min = 70`
  ([`r8-keyword-plan.constants.ts`](../backend/src/config/r8-keyword-plan.constants.ts)).

## Architecture recommandée (robuste · moderne · anti-bricolage) — DESIGN, gated

> Décomposition au **niveau SOURCE** (réutilise le switch, **zéro système parallèle, zéro padding**).
> **Garde anti-bricolage** : un échantillon de sœurs proches (19052 ↔ 19053) partage **~98,7 %** des
> familles compatibles → **re-trier le catalogue = risque cosmétique** (même contenu, hash différent =
> gamer le seuil). **Le levier honnête est la FAQ, pas le re-tri catalogue.**

**Fix B — vraie diversification, par ordre de levier honnête :**
1. **FAQ par motorisation (levier fort)** : sourcer des données spécifiques à la motorisation (ex.
   `problemes_connus` / `pieces_usure` par moteur/puissance) + 1-2 FAQ gamme filtrées par co-occurrence
   `engine_code` ; pondérer véhicule > gamme. → distinctness **réelle**.
2. **Catalogue (headroom faible — prudence)** : ne différencier **que** là où le set compatible diffère
   vraiment ; sinon **accepter** un catalogue partagé entre sœurs proches plutôt que le falsifier. Option :
   que le gate **ne sur-pénalise pas** un catalogue légitimement similaire (pondération, pas contenu inventé).
3. **Tech specs / `S_VARIANT_DIFFERENCE`** : déjà distincts (puissance/année) → bien pondérer.

**Fix A — couverture** : batch gouverné, **lot ≤5 ciblé** (déterministe : affichables → plus bas
`diversity_score` d'abord → ROI sibling ; **pas « les 5 premiers », pas les 31**), feature flag
`R8_MOTORISATION_BINDING` (OFF par défaut), idempotent, rollback.

**Réutilisation stricte** : `selectVariation` (ouvertures), `__seo_r8_fingerprints`, gate,
`SeoRoleTemplateSelector`, `SupabaseBaseService`. **Nouveau minimal** : FAQ vehicle-RAG par motorisation ;
`MotorFamilyRanker` + table de scores **seulement si** le headroom catalogue est prouvé par cluster.

**Rollout phasé (gated, owner GO à chaque palier)** : Phase 0 merge code + flag OFF (zéro impact) → Phase 1
pilote staging (lot Clio III 1.5 dCi, vérifier `diversity_score ≥ 70` **honnête**) → Phase 2 prod lot 1 (≤5,
gate owner) → Phases suivantes lot-par-lot → freeze + monitoring (réutiliser `rpc_*_alerts_v1` / `__seo_event_log`).

**Questions ouvertes (à lever Phase 0/1, read-only d'abord)** : la vehicle-RAG porte-t-elle déjà
`problemes_connus`/`pieces_usure`/`faq` **par motorisation** ? · couverture des tags carburant sur la FAQ
gamme · ratio de pondération FAQ · `engine_family_key` désambiguïse-t-il les jumeaux cross-carrosserie
(≥18 clés Clio III) · seuils du gate post-fix · latence du ranking.

## Verdicts (constat ≠ décision)

- **`cluster_verdict`** ∈ `SWITCH_COVERAGE_GAP` · `SWITCH_DIVERSITY_GAP` · `SWITCH_OK` · `OBSERVE` :
  - **Clio III = `SWITCH_COVERAGE_GAP`** (31/33 non enrichis).
  - **Pilote DS / SMART = `SWITCH_DIVERSITY_GAP`** (FAQ/catalogue constants → avg < 70, 0 indexée). *Le gate
    fait son travail* : il bloque les sœurs insuffisamment distinctes.
  - **Peugeot / Citroën / VW / Audi / Ford / Opel = `OBSERVE`** (gap d'enrichissement, pas un duplicate).
- **par type** : `ENRICHED` · `NOT_ENRICHED_GENERIC` (risque duplicate live) · `NOT_DISPLAYABLE`.

## Limites honnêtes

- `faq/category = 1/groupe` est ici **`PRESENT_IDENTICAL`** (bloc rempli mais identique), pas un sentinelle
  d'absence — à reconfirmer par cas avant tout refresh.
- `~98,7 %` de recouvrement catalogue = **un échantillon de paire** (19052↔19053), pas une mesure exhaustive
  des 18 sœurs ; à élargir avant de décider du levier catalogue.
- R8 = `/constructeurs/` ; le runtime `/pieces/` (RM API V2) **ne lit pas** `__seo_r8_pages`.
- **1 seule page indexée** → impact GSC actuel de R8 quasi nul ; mesurer GSC par page R8 est prématuré.

## Suite (NO-GO maintenant — owner-gated, jamais auto)

1. **Fix A (couverture)** : enrichir les 31, par **lots ≤5 ciblés** (règle déterministe ci-dessus), gouverné.
2. **Fix B (diversité)** : FAQ par motorisation d'abord (levier honnête) ; catalogue avec prudence anti-cosmétique.
3. **Baselines R1 puis R2** (read-only, ordre owner R8→R1→R2) — séparées.
4. **Jamais** : canonical/301/noindex, modif role-matrix/R1-R2, suppression de page, enrichissement auto, padding pour gamer le gate.

**Zéro mutation. Zéro génération. Baseline read-only, basée sur l'existant.**
