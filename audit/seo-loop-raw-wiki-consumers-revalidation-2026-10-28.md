# Boucle scraping → RAW → WIKI → consommateurs → SEO — revalidation et corrections du 2026-10-28

Date : 2026-10-28. Auteur : agent Claude Code (Opus 5.5), mandat « Fiabiliser la boucle scraping RAW WIKI consumers et SEO ».
Branche `fix/seo-loop-gates-r3-pilot-20261028`, base `origin/main` `7bf9cfbad`, PR en brouillon (aucune fusion, aucun tag, aucun déploiement).

Ce document reprend l'audit du 28/10 (base `c24b7b945`), sépare ce qui reste défectueux de ce qui est déjà corrigé, décrit les quatre corrections faites sur la branche et prépare, sans l'activer, la canary PROD du filtre à huile. Les états sont distincts : **présent** (code dans le dépôt), **raccordé** (appelé par un chemin réel), **activé** (flag ou déclencheur effectif), **exécuté** (trace d'exécution observée), **servi** (contenu observé dans la réponse HTTP de l'environnement).

## 1. Révisions comparées

| Objet | Audit du 28/10 | Revalidé le 28/10 | Écart |
|---|---|---|---|
| Monorepo | `c24b7b945` | `7bf9cfbad` | #1904, #1908, #1909 : aucun ne touche la boucle SEO/projection |
| RAW | `60634a49` | `2c6a242` | capture Garrett #76 (worklist 35 → 36) |
| WIKI `main` | `394768f7` | `edae4a9` | 5 gammes approuvées sur `main` contre 4 au pin |
| Pin WIKI du monorepo | `88017732` | `88017732` | inchangé |
| PROD | `9384ef9a7` (tag `v2026.10.11-maintenance-9384ef9a`) | idem | aucune promotion depuis |

Exécutions CI citées par l'audit, revérifiées avec `gh run view` :

- [38170173038](https://github.com/ak125/nestjs-remix-monorepo/actions/runs/38170173038) — Deploy PROD (via tag), succès, `9384ef9a7`, 2026-10-11 ;
- [40620665577](https://github.com/ak125/nestjs-remix-monorepo/actions/runs/40620665577) — wiki-exports-seo-generate, succès, `c24b7b945`, 2026-10-28 ;
- [40684547550](https://github.com/ak125/nestjs-remix-monorepo/actions/runs/40684547550) — PROD Smoke Tests, succès, `c24b7b945`, 2026-10-28.

Un smoke PROD vert ne prouve ni la source servie ni l'activation d'un flag : il est cité comme preuve de disponibilité seulement.

## 2. Synthèse en cinq états

| État | Contenu |
|---|---|
| **Implémenté** | 4 commits sur la branche : gate R8 (porte dure), gate balises ADR-095 sur le passage INDEX R8, tests de cache canary R3, curseur du seed R8 et fin de l'auto-boucle outbox |
| **Intégré** | Non : PR en brouillon, aucune fusion sur `main` (ADR-102) |
| **Vérifié** | Localement : jest backend, vitest frontend, tests du paquet `@repo/seo-role-contracts`, mutations de régression détectées, lectures DB bornées en lecture seule. CI de la PR à lire sur la PR |
| **Opérationnel** | Aucune des corrections n'est servie. Le chemin projeté R3 n'est pas servi en PROD (observé). L'overlay R8 est servi sur 1 page ; la chaîne de snapshots R8 n'a jamais tourné |
| **Bloqué** | Canary R3 filtre à huile : refusée par la règle D7 d'ADR-106 (contenu projeté inférieur au servi). Correctif R7, correctif de la RPC de snapshot, mise à jour du pin WIKI : hors mandat ou zone STOP, préparés §8 |

La boucle publique **n'est pas opérationnelle** au sens du mandat : aucune page publique n'est observée servant un corps issu de la projection WIKI.

## 3. Revalidation des constats de l'audit

Classement : **confirmé** (reproduit sur la version courante), **déjà corrigé**, **contredit** (la donnée courante diffère), **non vérifiable** (pas d'accès à la preuve dans le mandat).

| # | Constat de l'audit | Classement | Preuve courante |
|---|---|---|---|
| A1 | Worklist RAW : 35 entrées (25 CAPTURED_NEEDS_REVIEW, 10 TODO) | **Contredit** | 36 entrées (26 + 10) : capture Garrett #76 fusionnée après l'audit |
| A2 | RAW en REPORT_ONLY, runner limité à `provided` | Confirmé | runner refuse tout mode ≠ `provided` ; aucun contournement fait ni proposé |
| A3 | `source_score` en observation seulement | Confirmé | aucun lecteur décisionnel du score |
| A4 | `license_status` inconnu | Confirmé | 36/36 `unknown` |
| A5 | Le lineage ne prouve pas le passage par WIKI | Confirmé | lineage vide ; `__seo_entity_sources` = 0 ligne, aucun producteur dans le code |
| A6 | Filtre à huile : 12 blocs, 6 R3, ready | Confirmé | export et projection : 12 blocs (6 R3_CONSEILS, 3 R4_REFERENCE, 3 R6_GUIDE_ACHAT) ; le mapper retient 4 blocs R3 (S1, S2, S8) et rend `ready` ; voir §6 |
| A7 | Filtre à air : 2 blocs / 1 R3, incomplet | Confirmé | bloc `maintenance` de 99 caractères ; mapper `MAPPER_INCOMPLETE`. Aucune preuve manquante inventée |
| A8 | Carburant 0, habitacle 0 | Confirmé | exports valides au schéma mais vides : non comptés comme substantiels |
| A9 | Plaquettes : 11 blocs absents de la projection | Confirmé, cause précisée | approuvée sur WIKI `main` mais pas au pin `88017732` ; auto-promue le 21/10 sans chemin de retrait (`withdrawal_authorized: False`) |
| A10 | 24 runs de projection depuis le 05/10, 0 échec | Confirmé | 24 runs du 05/10 au 28/10 |
| A11 | 4 entités, 14 blocs actifs, 0 conflit | Confirmé | 12 blocs huile + 2 blocs air actifs, une version chacun (`__seo_content_blocks` / `__seo_content_block_versions`) |
| A12 | 0 run de projection diagnostic | Confirmé | `DIAGNOSTIC_PROJECTION_ENABLED` défaut off |
| A13 | Flags PROD au 11/10 : feed R1 on, lecture off, canary vide | **Non vérifiable** directement (pas d'accès à l'environnement PROD) ; comportement cohérent | page PROD du 28/10 16:20 UTC : `cache-control: public, max-age=300, stale-while-revalidate=3600`, pas de `X-R3-Canary` ⇒ paire non ciblée |
| A14 | R2 enrich-single : score 0, reject, `pr1_stub_data_loader_pending` | Confirmé | stub dans `r2-admin-pilot.controller.ts` (l. 98-111) ; voir §7.3 |
| A15 | R8 : 155 pages, 0 `current_snapshot_id`, 0 snapshot | Confirmé, cause établie | voir §7.2 |
| A16 | Gate R8 : le score agrégé neutralise des portes dures | Confirmé puis **corrigé sur la branche** | commit `19ba1bd7a` |
| A17 | Anti-duplicate : `SeoBaliseCollisionGate` sans appelant runtime | Confirmé puis **raccordé sur la branche** (R8) | commit `77a4825ed` |
| A18 | R2 : résultat vide et panne amont confondus | **Déjà corrigé** | `pieces-vehicle.loader.server.ts` l. 255-322 : panne amont ⇒ 503 non mis en cache |
| A19 | Feeder « R1 » | Confirmé, nom historique | il écrit R3, R4 et R6 ; voir §4.2 |

## 4. Cartographie de la chaîne

### 4.1 Maillons

| Maillon | Entrée | Producteur | Contrat | Persistance | Consommateur | Déclencheur | Flag | Preuve | Défaut |
|---|---|---|---|---|---|---|---|---|---|
| Découverte / capture | sources de l'allowlist | runner RAW (`provided`) | worklist + checksums | dépôt RAW | revue humaine | manuel | REPORT_ONLY | 26/26 empreintes OK | licence `unknown` 36/36 |
| RAW → WIKI | captures RAW | rédaction + validation humaine | fiche WIKI, quality-gates | dépôt WIKI | builder d'exports | revue + fusion WIKI | — | `quality-gates --all-local` 24/24 PASS | contrôle cross-repo ancre 0 fiche et n'est pas en CI |
| WIKI → exports | fiches `approved` | `build_exports_seo.py` | schéma d'export SEO | `exports/` du WIKI | pin du monorepo | job `wiki-exports-seo-generate` | — | run 40620665577 | auto-promotion sans chemin de retrait (plaquettes) |
| Exports → pin | exports au commit pin | sous-module | pin `88017732` | monorepo | feeder de projection | bump du pin (PR) | — | pin inchangé | bump suspendu (plaquettes, §8.4) |
| Pin → projection | exports au pin | `SeoProjectionFeederService` + writer | ADR-059 | `__seo_content_blocks` / `_versions` | reader | cron | `SEO_PROJECTION_R1_FEED_ENABLED` (lu via `ConfigService`) | 24 runs, 0 échec ; `content_hash` huile `773367f7` identique export / pin / DB | writer non transactionnel, résultats non vérifiés, retrait de bloc absent (§7.1) |
| Projection → RPC → mapper | `gamme:<alias>` | `SeoProjectionReaderService` + `mapR3Projection` | contrat de rendu ADR-106 `1.0.0` | — | `R3ProjectionDecisionService` | requête page | `SEO_PROJECTION_READ_V1` + `SEO_PROJECTION_READ_CANARY` | mapper huile `ready` sur enveloppes réelles | air `MAPPER_INCOMPLETE` |
| Payload R3 → HTML | `projectionMeta` | `R3GuideService` | `R3ProjectionMeta` | Redis (legacy seulement) | loader conseils | requête page | idem | tests §5.3 | — |
| R8 enricher → overlay | données véhicule | `R8VehicleEnricherService` | gate R8 + ADR-095 | `__seo_r8_pages` | `getR8Content` | admin, à la demande | `SEO_CHAIN_DUPLICATE_GATE_MODE` (nouveau raccordement) | 1 page INDEX servie | corrigé §5.1-5.2 |
| R8 → snapshots → R2 | `auto_type` | seed + `enrichTypeId` + RPC `__seo_r8_publish_snapshot` | ADR-072 | `__seo_r8_snapshot_store`, outbox | `R8SnapshotReaderService` (0 appelant) | seed manuel jamais appelé | READ_ONLY sur PREPROD | 0 job, 0 outbox, 0 snapshot | §5.4 et §7.2 |
| R7 enricher → overlay | données marque | `R7BrandEnricherService` | gate R7 | `__seo_r7_pages` | `getR7Content` (PUBLISH seulement) | admin | — | 36 pages PUBLISH | même défaut que R8, non corrigé (§7.4) |

### 4.2 Le feeder « R1 »

`SEO_PROJECTION_R1_FEED_ENABLED` et `seo-projection-feeder.service.ts` portent un nom historique, que le code signale lui-même (`seo-projection-admin.controller.ts` l. 6). Le feeder écrit les rôles autorisés par `SEO_PROJECTION_WRITABLE_TYPES` et `SEO_PROJECTION_GAMME_ROLES`, soit R3_CONSEILS, R4_REFERENCE et R6_GUIDE_ACHAT. Il n'écrit aucun contenu R1. Le flag ne gouverne que la planification du feeder et il est lu par `ConfigService` (`seo-projection-feeder.service.ts` l. 425), hors `FeatureFlagsService`. Aucun renommage n'est fait : renommer un flag actif en PROD est une mutation de configuration hors mandat.

## 5. Corrections livrées sur la branche

### 5.1 `19ba1bd7a` — gate R8 : une porte dure n'est plus neutralisée par le score

- **Problème.** `R8VehicleEnricherService.gate()` rendait INDEX dès que `diversityScore ≥ index_min`, en convertissant les raisons de porte dure (LOW_SPECIFIC_CONTENT, HIGH_BOILERPLATE, HIGH_FAQ_REUSE, LOW_SEMANTIC_DIVERSITY, LOW_COMMERCIAL_INTENT) en avertissements. La pénalité de collision meta était appliquée après l'agrégat : la décision et le `diversity_score` persisté étaient pré-pénalité, `semantic_similarity_score` post-pénalité.
- **Correction.** Porte dure ⇒ REVIEW_REQUIRED ; un seul bloc `MISSING_*` reste un avertissement. Ordre rétabli : métriques → pénalité → agrégat recalculé → décision → persistance (page et version).
- **Impact.** La seule ligne INDEX de `__seo_r8_pages` passe toutes les portes dures. Aucune ligne n'est réévaluée : l'enricher ne tourne qu'à la demande et n'a pas tourné depuis le 2026-04-24.
- **Preuves.** `r8-vehicle-enricher.gate.test.ts` (nouveau) et cas I de `write-gate.test.ts` : 56/56. Le cas de persistance échoue sur l'ancien code.
- **Interdits respectés.** La garde de démarrage qui refuse `mode=on` pour R7/R8/RM n'est pas modifiée.

### 5.2 `77a4825ed` — gate balises anti-duplicate ADR-095 au passage INDEX R8

- **Problème.** `SeoBaliseCollisionGate` / `SeoFingerprintCore` n'avaient aucun appelant runtime.
- **Point de raccordement.** Le passage INDEX d'une page R8, qui active l'overlay title/description servi par `getR8Content`.
- **Modes.** Clé réservée `DUPLICATE_GATE` de `SeoFeatureFlagRegistry` (`SEO_CHAIN_DUPLICATE_GATE_MODE`, défaut `off`, valeur invalide ⇒ `off`) :
  - `off` : aucune lecture, aucun événement ;
  - `shadow` : verdict journalisé dans `__seo_event_log` (`anomaly_detected`, `observation_kind=BALISE`), écriture inchangée ;
  - `on` : collision exacte title ou H1 entre pages indexables ⇒ écriture refusée (`write_gate_blocked`, `BALISE_GATE_BLOCKED`).
- **Refus.** Aucune écriture : la version servie reste en place. Ni suppression, ni changement d'URL, de canonical ou de robots, ni noindex automatique.
- **Exemptions et périmètre.** Catalogue et FAQ exemptés (R-SEO-09). Near-dup en rapport seulement (`CALIBRATION_PENDING`). Indexabilité effective = `seo_validation.is_indexable` du cache véhicule, hors plage TecDoc sous release gate. Le nouveau prédicat `isR8TecdocReleaseGateOpen` de `@repo/seo-role-contracts` reprend la plage de la page servie.
- **Sœurs illisibles.** En `shadow`, journalisées et sans effet. En `on`, `DB_ERROR` sans écriture : jamais traité comme « aucune sœur ».
- **Preuves.** 18 tests, couvrant :
  - collision exacte title et H1 ;
  - collision hors périmètre ;
  - chaque mode ;
  - préservation de la version ;
  - absence d'écriture partielle ;
  - rejeu idempotent.

  Les mutations M1 à M3 sont détectées. Paquet : 143/143.
- **Limites.**
  - Les sœurs couvrent les overlays R8 servis ; les titres legacy calculés côté frontend n'y sont pas.
  - Le H1 des sœurs est reconstruit depuis les champs stockés.
  - Une sœur absente du cache véhicule compte comme non indexable.
  - Le `canonicalUrl` de l'enricher diffère du format servi (utilisé seulement comme `entity_url` d'événement).
  - Un insert anon dans `__seo_event_log` sur PREPROD peut échouer ; il est journalisé.
  - `r8-transform.ts` (frontend) garde les littéraux `60000`/`83456` en suivi.

### 5.3 `94ae9d3b1` — cache de la page conseils selon le ciblage canary R3

- **Problème.** Aucun test ne couvrait le chemin de succès de la canary : une régression qui neutralise le ciblage aurait mis la variante dépendante du flag en cache partagé.
- **Correction (tests).**
  - Paire ciblée (READY_FOR_RENDER et FALLBACK) ⇒ `private, no-store` et `X-R3-Canary: 1`.
  - Paire non ciblée ⇒ `public, max-age=300, stale-while-revalidate=3600` sans marqueur.
- **Preuves.** vitest 7/7. La mutation `isCanaryTargeted = false` est détectée. eslint 0, prettier OK, tsc 0 erreur.

### 5.4 `0a019695a` — seed R8 : curseur texte, et fin de l'auto-boucle outbox

- **Problème 1 : curseur.** `auto_type.type_id` est TEXT (53 959 lignes, longueur 1 à 5, 0 valeur non canonique). Le seed paginait avec un curseur numérique `n + 1` sous une comparaison PostgREST en ordre texte. Des identifiants étaient sautés à chaque frontière de longueur, et la lecture repartait au début après « 9999 » : boucle sans fin.
- **Problème 2 : outbox.** `__seo_r8_publish_snapshot` insère un événement `R8SnapshotUpdated` à chaque appel, hit idempotent compris. Le relais le renvoyait vers `r8-enrichment`, qui republiait le même `type_id`.
- **Corrections.**
  - Curseur keyset texte : dernière valeur lue, y compris pour un lot entièrement invalide. Contrat public `sinceTypeId` conservé.
  - `R8SnapshotUpdated` acquitté sans ré-enrichissement, conformément à `OUTBOX_EVENT_ROUTING` (aucun consommateur livré).
- **Preuves.** `src/modules/seo/r2` : 9 suites / 74 tests. L'ancien code fait échouer 4 tests (3 seed, 1 processeur). tsc 0 ; eslint sans nouvel avertissement.
- **Hors périmètre.** Aucun seed lancé. La RPC ne pose de pointeur que sur les lignes existantes (§7.2).

## 6. Pilote R3 — filtre à huile (`pg_id` 7)

### 6.1 Chaîne tracée

| Étape | Observation | État |
|---|---|---|
| RAW | 3 captures (Filtron, MAHLE, Renault), empreintes vérifiées | présent |
| WIKI | fiche `approved`, tier A, auto-promue le 30/09 | présent |
| Export | 12 blocs : 6 R3_CONSEILS, 3 R4_REFERENCE, 3 R6_GUIDE_ACHAT | présent |
| Pin | `88017732`, `content_hash` `773367f7` | présent |
| Projection DB | 6 blocs R3 actifs (`function`, `maintenance`, `maintenance-interval`, `failure-symptoms`, `replacement-guidance`, `faq`), une version chacun ; même `content_hash` | exécuté (feeder) |
| RPC + mapper | sur enveloppes réelles : `ready`. Retient `function` (S1), `maintenance-interval` + `failure-symptoms` (S2), `faq` (S8) | vérifié localement |
| Décision | `isTargeted` faux en PROD (paire non ciblée) | non activé |
| HTML PROD | titres legacy, FAQPage présent, politique publique, sans `X-R3-Canary` | **legacy servi** |

Jeton canary revalidé : `toCanaryToken('gamme:filtre-a-huile')` = `R3_CONSEILS@gamme:filtre-a-huile` (`R3_MAPPER_ROLE` = `R3_CONSEILS`, contrat `1.0.0`). Le chemin de lecture (#1290) est en PROD depuis `9384ef9a7`. Aucun commit ultérieur ne touche la décision, le service de guide, le mapper ou la route conseils.

### 6.2 Mesure D7

| Corps | Caractères de texte | Sections | FAQPage |
|---|---|---|---|
| Legacy servi (`__seo_gamme_conseil`, `pg_id` 7) | 9 128 | 11 | oui, 3+ `<details><summary><b>` |
| Projection (mapper `ready`) | 1 381 (Markdown des 4 blocs retenus : 195 + 247 + 426 + 513) | 3 | **non** : `guide-schemas.ts` l. 76-88 exige la forme `<details><summary><b>` |

Écart : **−84,9 %** et perte du FAQPage. ADR-106 D7 n'autorise l'activation d'un lecteur que si le contenu WIKI dépasse ce qui est servi. La canary est donc refusée en l'état. Ce n'est pas un défaut de code : aucun statut, score ou section n'est forcé pour passer la règle.

### 6.3 Tests du chemin R3

| Cas exigé | Couverture |
|---|---|
| Projection complète / absente / incomplète | décision + mapper (jest existant, 188 tests verts) |
| Contrat invalide | `MAPPER_INVALID` (jest existant) |
| Master flag off | `MASTER_OFF`, 0 appel RPC (jest existant) |
| Paire hors canary | `NOT_ALLOWLISTED`, 0 appel RPC (jest existant) |
| Erreur RPC | `RPC_ERROR` / `RPC_EXCEPTION` (jest existant) |
| Repli observable | `projectionMeta.fallbackReason` exposé (jest + vitest) |
| Cache au changement de ciblage | **nouveau** : `94ae9d3b1` |
| Idempotence et périmètre d'écriture du feeder | 65 tests d'environnement verts ; défauts du writer listés §7.1 |

## 7. Défauts confirmés non corrigés

### 7.1 Writer de projection

- Écritures non transactionnelles.
- Résultats non vérifiés (`seo-projection-writer.service.ts` l. 497-509, 586-595, 666-678).
- Le contrôle de no-op lit `status='active'`.
- Un bloc retiré de l'export n'est jamais retiré de la projection.

Aucune correction sur cette branche. Le brouillon #1493 touche ce writer et n'est pas à fusionner tel quel. Le commentaire `seo-projection-reader.service.ts` l. 23-24 est périmé.

### 7.2 Snapshots R8 (ADR-072)

Contrat : seed → `R8ParentEnrichmentService.enrichTypeId` → RPC `__seo_r8_publish_snapshot`. La RPC insère le snapshot (`ON CONFLICT (version_sha) DO NOTHING`), met à jour `__seo_r8_pages.current_snapshot_id` **seulement pour les lignes existantes**, et insère toujours un événement outbox.

Pourquoi la table est vide :

- aucun déclencheur automatique ;
- le seed manuel `POST /api/admin/seo/r2/r8-seed/run` n'a jamais été appelé (`__seo_admin_job` = 0, outbox = 0) ;
- PREPROD est en READ_ONLY : le processeur ignore le job.

Reste après `0a019695a` :

- **RPC.** UPDATE sans INSERT : seuls ~154 `type_id` recevraient un pointeur. Correction = migration, zone STOP, non incluse.
- **`maybeSingle`.** Un `type_id` en double dans `__seo_r8_pages` le fait échouer.
- **Lecteur.** `R8SnapshotReaderService` n'a aucun appelant.

Les brouillons #1530 et #1541 sont remplacés par #1587 ; #1537 l'est en partie.

### 7.3 R2 enrich-single

Le stub de `r2-admin-pilot.controller.ts` (l. 98-111) est conservé. Le calcul réel exige un `searchVolumeFactor` qui n'a aucune source gouvernée : le retirer reviendrait à inventer une constante métier. Condition de retrait : une source gouvernée de volume, raccordée et testée.

### 7.4 Gate R7 (même classe que R8, zone STOP)

`r7-brand-enricher.service.ts` l. 807-820 : `diversityScore ≥ minQualityScore` rend PUBLISH même avec LOW_SPECIFIC_CONTENT, HIGH_BOILERPLATE ou HIGH_GENERIC_PHRASES.

Correctif préparé, non appliqué :

```ts
// après le contrôle REGENERATE
const hardGate = reasons.filter((r) => !r.startsWith('MISSING_'));
if (hardGate.length > 0) {
  return { decision: 'REVIEW_REQUIRED', reasons, warnings };
}
if (metrics.diversityScore >= R7_KP_QUALITY_THRESHOLDS.minQualityScore) {
  warnings.push(...reasons.map((r) => `gate warning: ${r}`));
  return { decision: 'PUBLISH', reasons, warnings };
}
return { decision: 'REVIEW_REQUIRED', reasons, warnings };
```

Impact mesuré : 1 page PUBLISH sur 36 (`r7_brand_13`, `generic_phrase_ratio` 0,200, score 85,4) passerait en REVIEW_REQUIRED à son prochain enrichissement. `getR7Content` ne sert que PUBLISH : cette page perdrait son overlay meta/H1/contenu servi. Or `R7_SITEMAP_RULES.REVIEW_REQUIRED` garde `index, follow` et le sitemap. Le correctif modifie donc des balises servies d'une page indexée : zone STOP, et hors du lot « Gate R8 » du mandat.

### 7.5 WIKI / exports

- Plaquettes auto-promues le 21/10 sans chemin de retrait (`build_exports_seo.py` l. 650, `withdrawal_authorized: False`). Le bump du pin reste suspendu : le prochain bump embarquerait 11 blocs sans retrait possible.
- Le contrôle cross-repo ancre 0 fiche et ne tourne pas en CI.
- Filtre à air : preuves manquantes. Rien n'est inventé : il faut une capture RAW puis une rédaction WIKI validée.

## 8. Dossier canary PROD — filtre à huile (préparé, NON activé)

### 8.1 Statut

**Refusée en l'état par ADR-106 D7** (§6.2). Le dossier décrit l'activation et le retrait pour le jour où une révision WIKI du filtre à huile dépasse le corps servi.

### 8.2 Prérequis vérifiables

| Élément | Valeur attendue | Valeur au 28/10 |
|---|---|---|
| Code servi | contient #1290 (chaîne de décision R3) | `9384ef9a7` la contient ; aucun déploiement requis pour la seule lecture |
| Pin WIKI | révision dont l'export R3 huile dépasse D7 | `88017732` : ne dépasse pas |
| `content_hash` du bloc R3 huile | identique export / pin / DB | `773367f7` partout |
| Mapper | `ready`, `invalidCount` 0 | `ready`, 0 invalide (local) |
| D7 | texte projeté ≥ texte servi, FAQPage conservé | **échec** |
| Anti-dup | titre et H1 de la page conseils inchangés | la projection ne remplace que le corps ; title/H1 restent legacy |

### 8.3 Activation (action réservée, PROD)

- Variables : `SEO_PROJECTION_READ_V1=true` et `SEO_PROJECTION_READ_CANARY=R3_CONSEILS@gamme:filtre-a-huile` ; aucun autre jeton.
- Effet attendu sur la seule URL conseils du filtre à huile :
  - `X-R3-Canary: 1` et `Cache-Control: private, no-store` ;
  - payload `projectionMeta = { projectionStatus: 'READY_FOR_RENDER', servedBodySource: 'projection', fallbackReason: null, mappedCount: n, invalidCount: 0 }`.
- Autres gammes : réponse inchangée, politique publique, sans `projectionMeta`.
- Caches :
  - le chemin ciblé contourne Redis (ni lecture, ni écriture) ;
  - le loader pose `no-store` ;
  - côté Cloudflare, `cf-cache-status: DYNAMIC` observé sur la page.

### 8.4 Critères d'arrêt

Retrait immédiat si l'un est observé :

- `fallbackReason` non nul sur la paire ciblée ;
- perte du FAQPage dans le HTML ;
- titre ou H1 modifié ;
- `X-R3-Canary` présent sur une autre gamme ;
- réponse publique (`public, max-age`) sur la paire ciblée ;
- erreur 5xx sur l'URL.

### 8.5 Retour arrière

Vider `SEO_PROJECTION_READ_CANARY`, ou passer `SEO_PROJECTION_READ_V1=false`, puis recréer le conteneur backend pour qu'il relise son environnement (un simple redémarrage ne relit pas un fichier d'environnement modifié). Effet : `isTargeted` faux ⇒ 0 appel RPC, corps legacy. Aucune donnée à restaurer : la canary ne fait que lire. Les réponses ciblées étant `no-store`, aucune variante ne survit en cache partagé.

## 9. Matrice de preuves

| Maillon | État actuel | Correction | Validation obtenue | Limite restante |
|---|---|---|---|---|
| Capture RAW | présent, REPORT_ONLY, 36 entrées | aucune | empreintes 26/26 | licence `unknown` 36/36 ; lineage vide |
| RAW → WIKI | 5 gammes approuvées sur `main`, 4 au pin | aucune | quality-gates 24/24 | contrôle cross-repo hors CI, 0 ancre |
| Exports | huile 12 blocs (6 R3), air 2 (1 R3), plaquettes 11 sur `main` et absentes au pin, carburant et habitacle vides | aucune | run 40620665577 | plaquettes sans retrait ⇒ bump suspendu |
| Projection | exécutée (24 runs) | aucune | `content_hash` cohérent | writer non transactionnel, pas de retrait de bloc |
| Lecture R3 | présente, non activée | tests de cache (`94ae9d3b1`) | vitest 7/7, mutation détectée | D7 refuse la canary huile |
| HTML R3 PROD | legacy servi | aucune | en-têtes et HTML PROD du 28/10 | boucle publique non opérationnelle |
| Gate R8 | corrigé sur branche | `19ba1bd7a` | jest 56/56 | non servi tant que non fusionné/déployé |
| Anti-dup R8 | raccordé sur branche, défaut `off` | `77a4825ed` | 18 tests, M1-M3, paquet 143/143 | aucun environnement en `shadow` ; sœurs = overlays R8 seulement |
| Seed / outbox R8 | corrigé sur branche, jamais exécuté | `0a019695a` | 74 tests r2, 4 échecs sur l'ancien code | RPC UPDATE-only (migration) ; lecteur sans appelant |
| R2 rendu | 503 sur panne amont | déjà corrigé | code l. 255-322 | — |
| R2 enrich-single | stub | aucune | — | pas de source gouvernée de volume |
| Gate R7 | défectueux | préparée (§7.4) | requête d'impact | zone STOP |

## 10. Actions réservées

Elles sont hors mandat ; chacune a son contenu préparé dans ce document.

| Action | Préparation | Raison de la réserve |
|---|---|---|
| Fusion de la PR | PR brouillon, CI à lire | ADR-102 : l'agent ne fusionne pas |
| Correctif R7 | §7.4 | balises servies d'une page indexée |
| Migration de la RPC `__seo_r8_publish_snapshot` (INSERT de la page manquante) | constat §7.2 | migration DB |
| Lancement du seed R8 | correctif `0a019695a` prérequis | écriture DB de production |
| Passage `SEO_CHAIN_DUPLICATE_GATE_MODE=shadow` sur PREPROD | §5.2 | changement de configuration effective |
| Canary huile | §8 | flag PROD, et D7 refuse aujourd'hui |
| Bump du pin WIKI | §7.5 | bloqué tant que les plaquettes n'ont pas de chemin de retrait |

## 11. Commandes et requêtes

Tests (worktree de la branche ; une config jest locale mappe `@repo/*` vers les sources, la CI construit les paquets d'abord) :

```bash
# backend (depuis backend/)
npx jest src/modules/admin/services/r8-vehicle-enricher   # gate + balise + write-gate
npx jest src/modules/seo/r2                                # 9 suites / 74 tests
# paquet (depuis packages/seo-role-contracts/)
npm test                                                   # tsx --test, 143/143
# frontend (depuis frontend/)
npx vitest run tests/unit/conseils-loader-status.test.ts   # 7/7
```

Lectures DB : PostgreSQL direct, `default_transaction_read_only=on`, `statement_timeout=5s`, `lock_timeout=2s`, contrôle `transaction_read_only='on'`, 200 lignes maximum, ROLLBACK systématique. Une requête SELECT par appel :

```sql
-- R8 : pages, pointeurs, snapshots, décisions
SELECT (SELECT count(*) FROM __seo_r8_pages) AS r8_pages,
       (SELECT count(*) FROM __seo_r8_pages WHERE current_snapshot_id IS NOT NULL) AS with_snapshot,
       (SELECT count(*) FROM __seo_r8_snapshot_store) AS snapshot_rows,
       (SELECT json_object_agg(seo_decision, n) FROM (SELECT seo_decision, count(*) n FROM __seo_r8_pages GROUP BY 1) d) AS decisions;
-- → 155 / 0 / 0 / {INDEX:1, REVIEW_REQUIRED:148, REGENERATE:6}

-- auto_type.type_id
SELECT c.data_type, (SELECT count(*) FROM auto_type) AS n_rows,
       (SELECT count(*) FROM auto_type WHERE type_id !~ '^[1-9][0-9]*$') AS n_non_canonical,
       (SELECT min(length(type_id)) FROM auto_type), (SELECT max(length(type_id)) FROM auto_type)
FROM information_schema.columns c
WHERE c.table_schema = 'public' AND c.table_name = 'auto_type' AND c.column_name = 'type_id';
-- → text / 53959 / 0 / 1 / 5

-- R7 : portes dures par décision
SELECT seo_decision, count(*) AS n,
       count(*) FILTER (WHERE specific_content_ratio < 0.4 OR boilerplate_ratio > 0.5 OR generic_phrase_ratio > 0.1) AS any_hard
FROM __seo_r7_pages GROUP BY seo_decision;
-- → PUBLISH 36 dont 1 avec porte dure

-- R3 : blocs projetés huile / air
SELECT cb.entity_id, cb.role, cb.block_kind, bv.status, length(coalesce(bv.content->>'content_md','')) AS md_len
FROM __seo_content_blocks cb JOIN __seo_content_block_versions bv ON bv.version_id = cb.active_version_id
WHERE cb.entity_id IN ('gamme:filtre-a-huile', 'gamme:filtre-a-air');

-- R3 : corps legacy servi
SELECT sgc_section_type, length(sgc_content) FROM __seo_gamme_conseil WHERE sgc_pg_id = '7';
```

Observation PROD (lecture HTTP publique, 2026-10-28 16:20 UTC) : `HTTP/2 200`, `cache-control: public, max-age=300, stale-while-revalidate=3600`, `cf-cache-status: DYNAMIC`, pas de `X-R3-Canary`.

## 12. Manifeste de couverture (AEC)

```yaml
scope_requested: >
  Boucle sources → découverte → capture → RAW → WIKI → exports → pin → projection → RPC →
  mapper → payload → HTML → contrôles SEO/anti-duplicate ; gates R8 et anti-duplicate ;
  snapshots R8→R2 ; pilote R3 filtre à huile ; canary PROD préparée.
scope_actually_scanned:
  - backend : seo-projection (feeder, writer, reader, mapper R3), blog (décision R3, service de guide),
    admin (enrichers R8 et R7), seo/r2 (seed, enrichissement parent, outbox, processeurs, admin pilote),
    seo/utils (collision de balises, empreintes), registre des flags SEO, garde de démarrage shadow
  - frontend : route conseils, transformation R8, loader pièces×véhicule (R2)
  - packages/seo-role-contracts
  - dépôts RAW et WIKI (worklist, empreintes, fiches huile/air/plaquettes, builder d'exports, quality-gates)
  - DB en lecture seule : __seo_r8_pages, __seo_r8_snapshot_store, __seo_r7_pages, auto_type,
    __seo_content_blocks(+_versions), __seo_gamme_conseil, __seo_event_log (schéma), __vehicle_page_cache (schéma)
  - PROD : une page conseils (en-têtes et HTML publics)
files_read_count: "environ 60 fichiers source, plus les fiches et exports WIKI cités (estimation, non instrumentée)"
excluded_paths:
  - payments/, panier, commandes, prix/stock, RLS (zones STOP)
  - governance-vault (lecture des ADR citées seulement, aucune écriture)
unscanned_zones:
  - configuration effective PROD (flags) : pas d'accès ; comportement HTTP observé seulement
  - rôles R1, R4, R5, R6, RM côté rendu
  - autres gammes que huile, air, carburant, habitacle, plaquettes
  - writers RAG et pipelines de contenu hors projection
corrections_proposed:
  - 19ba1bd7a gate R8
  - 77a4825ed gate balises ADR-095 sur R8
  - 94ae9d3b1 tests de cache canary R3
  - 0a019695a seed R8 et outbox
  - correctif R7 (§7.4, non appliqué)
corrections_applied: []   # aucune validation humaine ni fusion à ce stade
validation_executed:
  - jest backend (gate R8 56/56, balises 18 tests, seo/r2 74/74), paquet 143/143, vitest 7/7
  - mutations : ancien code ou ciblage neutralisé ⇒ échecs détectés
  - tsc, eslint, prettier sur les fichiers touchés
  - lectures DB bornées en lecture seule ; observation HTTP PROD
remaining_unknowns:
  - valeurs effectives des flags PROD
  - comportement réel du gate balises en shadow (aucun environnement configuré)
  - résultat CI de la PR
final_status: PARTIAL_COVERAGE
```

Statuts par lot :

- gate R8 : `VALIDATED_FOR_SCOPE_ONLY` ;
- gate balises R8 : `VALIDATED_FOR_SCOPE_ONLY` ;
- seed/outbox R8 : `VALIDATED_FOR_SCOPE_ONLY` ;
- pilote R3 : `REVIEW_REQUIRED` (D7) ;
- R7 : `REVIEW_REQUIRED` ;
- RAW/WIKI : `SCOPE_SCANNED` ;
- flags PROD : `INSUFFICIENT_EVIDENCE`.

### Section 13 — couverture

Couverture partielle et déclarée ci-dessus. Les zones non lues ne sont pas présumées saines.

### Section 14 — conditions de sortie

Le travail de cette branche sort en `PARTIAL_COVERAGE`. Il ne passe à un état supérieur qu'après :

1. lecture de la CI de la PR ;
2. revue humaine et fusion par le propriétaire ;
3. preuve PREPROD des comportements corrigés.

La boucle publique R3 ne pourra être déclarée opérationnelle qu'avec une page PROD observée servant `servedBodySource: 'projection'` et ses contrôles (§8.4).
