# Legacy PHP → Monorepo Gap Matrix (SEO seo-v9 PR-1)

> Generated: 2026-05-08T17:36:52.489Z
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


## Findings empiriques (run DEV)

### Couverture services

- **Services SEO existants** : 31
- **Mappés à une cible v9 par filename** : 4/14 (29% brut)
- Couverture fonctionnelle réelle probablement plus élevée (services existants couvrent partiellement plusieurs cibles — à inventorier précisément en PR-2a registry)

### Diff sortie SEO V4 vs actuel

- Sample : 2 URLs
  - `divergent` : 2/2

### Audit R2 fiche produit

- **Route Remix R2 dédiée** : **ABSENTE** (équivalent `v7.products.fiche.php` non porté)
- Conséquence : R2 traité comme R1 listing actuellement. Pas de fiche produit individuelle indexable. Cohérent avec l'option "R2 noindex par défaut" du legacy.

### Volume R2 (3 sources Supabase croisées)

| Source | Count | Ratio |
|---|---|---|
| `pieces` (raw)             | 4 135 954 | 100% |
| `v_pieces_seo_safe` (vue)  | 502 734 | 12.2% |
| `__sitemap_p_xml` (sitemap actuel) | 1 960 | 0.39% |

**Justification empirique `R2IndexabilityGate`** : sans gate strict, R2 pourrait passer de 1 960 URLs (sitemap actuel) à 502 734 (×256) — risque de spam Google catastrophique. Gate non négociable avant tout branchement R2.

## Findings clés (audit fonctionnel)

### V4 est code mort de production

**Évidence** : `DynamicSeoV4UltimateService.generateCompleteSeo()` n'est appelé QUE par `dynamic-seo.controller.ts` (4 endpoints admin/debug `/api/seo-dynamic-v4/*`). 0 appel par `rm-builder`, `gamme-rest`, `brand-rpc`, `vehicle-rpc` — les services applicatifs réels.

**Impact** : La régression GSC 73% `/pieces/*` ne vient PAS du contrat strict V4 (jamais appelé en prod). Elle vient des 4 systèmes SEO parallèles qui produisent des sorties divergentes. Confirme empiriquement la motivation PR-2 (centraliser via chaîne unique). Scénario A (refactor majeur) confirmé : raccord léger impossible si V4 jamais branché.

### Contrat V4 strict (14 variables Zod) n'aide pas à débuguer en prod

**Évidence** : `SeoVariablesSchema.parse()` au top de `generateCompleteSeo()` (line 78) throw avant le try/catch. Les 14 champs requis (gamme, gammeMeta, marque, marqueMeta, marqueMetaTitle, modele, modeleMeta, type, typeMeta, annee, nbCh, carosserie, fuel, codeMoteur) sont rarement tous fournis quand l'endpoint est testé manuellement. V4 throw 500 générique sans message Zod détaillé.

**Impact** : Pas un bug en prod (V4 jamais appelé en prod), mais bloque tout test manuel de V4. À PR-2 : soit défauts sensibles sur 8 champs metaXxx (typiquement = champ principal lowercased), soit error handler controller qui propage le détail Zod.

### Sortie V4 ≠ sortie actuelle (divergent verdict)

**Évidence** : Sample 2/2 URLs avec inputs complets : `diff_verdict = divergent` (≥2 hashes title/h1/content différents). `current_fingerprint.robots = ""` (endpoint actuel ne retourne pas de robots dans le payload SEO).

**Impact** : Confirme que les 4 systèmes SEO parallèles produisent des sorties différentes — pas juste "V4 plus riche". À PR-2 : décider si V4 devient SoT et les autres adoptent ses sorties, ou si V4 est dépréciée au profit d'une 5e chaîne.


## Décision PR-2 (proposée à partir des findings)

**Scénario A — refactor majeur**

Couverture filename 29% **+ V4 confirmé code mort de production** (0 appel par services applicatifs réels). Créer la chaîne SEO + brancher tous les controllers actuels (rm-builder, gamme-rest, brand-rpc, vehicle-rpc) sur la chaîne. Effort ~2 sprints minimum. Voir "Findings clés" ci-dessus.

**Manques prioritaires confirmés** :

1. `R2IndexabilityGate` — absent (volet 4 montre volume × 256 potentiel sans gate)
2. `SeoSurfaceRegistry` + `SeoVariantFamilyRegistry` + `SeoFeatureFlagRegistry` — registries non identifiés dans l'inventaire
3. `seo_render_fingerprint` table — inexistante (pas de duplicate gate observable)
4. `SeoUnavailablePolicy` 410/412 contextualisé — à raccorder au système 3 couches erreurs existant (auditer en PR-2)
5. Variables marketing `#PrixPasCher#` / `#VousPropose#` / `#MinPrice#` — vérifier statut réel dans `SeoSwitchesService` (le doc switch les disait TODO)
6. R0 home hub SEO — actuellement non branché à `___meta_tags_ariane`
7. R3 contenu éditorial — doit venir du wiki canonique (ADR-031), pas clone PHP

**Hors-scope PR-2** (différés) :
- R2 fiche produit complète (PR-11 conditionnel post-stabilisation A-D)
- Blog (PR-12)
- R4 critères techniques + OEM cross-reference (≥ PR-13)
