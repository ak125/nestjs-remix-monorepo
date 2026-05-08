# Legacy PHP → Monorepo Gap Matrix (SEO seo-v9 PR-1)

> Generated: 2026-05-08T17:11:20.908Z
> Plan référence : `/home/deploy/.claude/plans/apres-investigation-seo-on-iterative-spark.md`
> Statut : LIVRABLE CANON PR-1. Mis à jour à chaque PR de la cascade seo-v9.

## Matrice

| php_file | monorepo_equivalent | status | gap | priority | proof_link |
|---|---|---|---|---|---|
| index.php | CatalogModule.getHomeCatalog | ✅ | Vérifier rendu Remix final R0 | P1 | backend/src/modules/catalog/ |
| products.gamme.php / v7.products.gamme.php | GammeResponseBuilderService + __seo_gamme + SeoTitleEngineService | ✅ | Robots simplifié pg_level=1=>index sinon noindex vs logique complète legacy | P1 | backend/src/modules/gamme-rest/services/gamme-response-builder.service.ts |
| products.car.gamme.php | RPC get_pieces_for_type_gamme_v4 + raw SEO templates + NestJS processing | ✅ | Comparaison sortie PHP vs Remix non finalisée | P1 | rpc:get_pieces_for_type_gamme_v4 |
| __SEO_ITEM_SWITCH + __SEO_GAMME_CAR_SWITCH + __SEO_FAMILY_GAMME_CAR_SWITCH | SeoSwitchesService (migration "TERMINÉE") | ✅ | #PrixPasCher#, #VousPropose#, #MinPrice# encore TODO | P1 | backend/src/modules/seo/services/seo-switches.service.ts |
| constructeurs.type.php | RPC build_vehicle_page_payload | ✅ | Vérifier rendu Remix + indexabilité réelle | P1 | rpc:build_vehicle_page_payload |
| products.car.gamme.fiche.php / v7.products.fiche.php | Listing RPC get_listing_products_for_build (prix/stock/score/images) | ⚠️ | Fiche produit détaillée OEM/critères/composition pas prouvée | P1 | rpc:get_listing_products_for_build |
| 410.page.php / 412.page.php | CatalogDataIntegrityService 200/404/410 + système 3 couches erreurs 4xx existant (à auditer) | ⚠️ | Page indisponible contextualisée 412/410 à formaliser ; SeoUnavailablePolicy doit RACCORDER, pas créer un middleware | P1 | backend/src/modules/catalog/services/catalog-data-integrity.service.ts |
| blog.advice.gamme.php / v7.blog.advice.gamme.php | Tables SEO/blog connues, agents/plans | ⚠️ | R3 doit venir du wiki canonique (ADR-031), pas clone PHP direct | P2 | automecanik-wiki/exports/ |
| constructeurs.marque.php | Données marque DB + payload véhicule + domain map | ⚠️ | Hub marque R7 complet à vérifier côté Remix/API | P1 | backend/src/modules/vehicles/services/brand-rpc.service.ts |
| meta.conf.php | SeoTitleEngineService + URL builders + canonical partiel | ⚠️ | Slug/canonical/robots à centraliser par rôle (SeoCanonicalService + SeoIndexabilityPolicyService) | P1 | backend/src/modules/seo/services/seo-title-engine.service.ts |

## Légende

- ✅ Porté : équivalent monorepo identifié, gap = finition.
- ⚠️ Partiel : présence partielle, gap = compléter ou centraliser.
- ❌ Absent : équivalent monorepo manquant.
- **P0** : ne pas refaire (consolider l'existant).
- **P1** : compléter en PR-2 ou cascade.
- **P2** : différé (wiki éditorial, blog, R4).
