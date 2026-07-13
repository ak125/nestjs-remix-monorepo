# Tranche B2-0 — Revalidation read-only des 8 producteurs RAG sur main (post-fermeture gouvernance)

```
Status:            READ_ONLY_AUDIT — REVALIDATION
Canonical:         NO
Runtime change:    NONE (0 fichier code modifié ; ce doc uniquement)
B2 code:           NOT AUTHORIZED (GO owner séparé requis)
Tree:              origin/main @ 2cd7e178512157fc107235b7a87805bbd617f26c (worktree détaché dédié)
Baseline:          audit/tranche-b2-step1-rag-mutation-denominator-20260707.md (branche audit/tranche-b0-…, snapshot DIVERGÉ — non repris, rejoué)
Gouvernance:       vault PR #338 MERGÉE (d04815e) — ADR-027 §Correction (RAG=0 autorité, jamais fallback RAG ni observable), ADR-033 accepted, ADR-080/086
Méthode:           5 agents read-only parallèles sur le worktree figé + contre-vérifications inline (ancres citées, discordances inter-agents résolues par grep direct)
```

## Verdict global

**Les 8 producteurs B1–B8 sont TOUS présents, actifs et inchangés sur `2cd7e1785`.** Aucun fichier
cœur modifié depuis le snapshot 07-07 (derniers commits : 2026-03-28 → 2026-06-27 selon flow).
Deux **errata du snapshot 07-07** (erreurs déjà présentes au snapshot, pas des déplacements) :

1. B6 « upsert `__seo_r3_keyword_plan` :507 » → en réalité un **SELECT** (`:506-513`). Le service
   n'écrit jamais cette table (writers réels = agents seo-batch, hors backend).
2. B1/B6 vivent sous `backend/src/modules/admin/services/`, pas `modules/seo/`.

**Faits nouveaux vs snapshot** (précisions, pas des changements de code) :
- **2 tables cibles sans lecteur de serving vivant** sur ce tree : `__seo_r1_gamme_slots` (B2) et
  `__seo_r2_keyword_plan` (B3). L'unique candidat lecteur (`gamme-rest/services/purchase-guide-data.service.ts`)
  **existe mais n'est importé nulle part** (vérifié inline : 0 import, 0 usage de `PurchaseGuideDataService`).
- **3 flows écrivent MÊME SANS RAG** : B4 (prompts génériques persistés, `ragData:null` toléré),
  B3 (payload dégradé `NO_RAG_DATA`), B7 (metadata gatekeeper `ALL_SECTIONS_SKIPPED`).
- **Asymétrie dryRun** : `POST /execute` = Zod default `true`, mais `POST /enqueue` et le processor
  BullMQ défaut `false` (`admin-pipeline.controller.ts:131`, `internal-pipeline.controller.ts:103`,
  `pipeline-chain.processor.ts:89`) — un enqueue nu écrit en live.
- **Aucun cron/scheduler** ne déclenche ces enrichers ; producteurs de la queue `pipeline-chain` =
  uniquement les 2 controllers gardés. Scripts opérateurs : `backfill-r1-micro-seo.py`,
  `backfill-r1-gatekeeper.py` (→ R1, `dryRun:false`), `backfill-r6-gatekeeper.py` (→ B7 live).
- `READ_ONLY` n'est **jamais** vérifié au niveau code dans ces chemins — containment PREPROD =
  clé anon/RLS uniquement (ADR-028 Option D).

---

## Tableau de décision (RECOMMANDATIONS — le GO de retrait reste owner)

| Flow | Table cible | Servie ? | Statut vs 07-07 | Ratchet (clé/count) | Décision recommandée |
|---|---|---|---|---|---|
| B1 | `__seo_gamme.sg_content` | OUI (R1) | IDENTIQUE | `admin-keyword-planner.controller::__seo_gamme` / 2 | **DELETE** |
| B2 | `__seo_r1_gamme_slots` | **NON (0 lecteur vivant)** | IDENTIQUE | `r1-enricher::__seo_r1_gamme_slots` / 1 | **DELETE** |
| B3 | `__seo_r2_keyword_plan` | **NON (0 lecteur vivant)** | IDENTIQUE | **ABSENT du baseline** (table hors `SERVED_TABLES`) | **DELETE** (⚠ ne fera pas bouger le ratchet) |
| B4 | `__seo_r1_image_prompts` | OUI (R1 hero/images) | IDENTIQUE | `r1-image-prompt::__seo_r1_image_prompts` / 6 | **DELETE génération RAG · KEEP curation humaine** (approve/setImageUrl/upload, non-RAG) |
| B5 | `__seo_r3_image_prompts` | OUI (R3 via blog-seo) | IDENTIQUE | `r3-image-prompt::__seo_r3_image_prompts` / 3 | **DELETE génération RAG · KEEP curation humaine** |
| B6 | `__seo_gamme_conseil` + `sg_descrip_draft` | OUI (R3) | IDENTIQUE | `conseil-enricher::__seo_gamme` / 1 + `::__seo_gamme_conseil` / 1 | **DELETE — PILOTE** (plan : `tranche-b2-p1-b6-conseil-removal-plan-2026-07-14.md`) |
| B7 | `__seo_gamme_purchase_guide` | OUI (R6 `r6-guide.service` + R1 `buying-guide-data.service` + R8 composer — câblage vérifié) | IDENTIQUE | `buying-guide-db::__seo_gamme_purchase_guide` / 1 | **DELETE** (fetcher + enricher + endpoints + script backfill-r6) |
| B8 | `__seo_r8_pages.content_main/rendered_json` | OUI (R8 fiche véhicule) | IDENTIQUE | `r8-vehicle-enricher::R8_TABLES` / 6 | **DELETE** (groupe final — laundering auto-entretenu, périmètre le plus large) |

Fail-closed commun (ADR-027 §Correction) : le contenu existant **reste servi statique** ; entrée
canonique absente ⇒ **aucune nouvelle écriture** ; **jamais** de flag transitoire, de nouveau gate,
ni d'adaptateur RAG→WIKI.

---

## Détail par flow

### B1 — RAG_WRITE_R1_SG (`sg_content`)

- **Fichier+lignes** : source `backend/src/modules/admin/services/r1-content-from-rag.service.ts:43-45`
  (`ragReader.readAndParseWithDbKnowledge(pgAlias)`) ; mutations `admin-keyword-planner.controller.ts:1351-1360`
  (single) et `:1525-1532` (batch) — upsert direct `__seo_gamme`.
- **Source lue** : disque `${RAG_KNOWLEDGE_PATH}/gammes/<pgAlias>.md` via `RagGammeReaderService`
  (+ `__rag_knowledge` si `RAG_VIRTUAL_MERGE_ENABLED`, défaut **false** → disque seul).
- **Mutation** : upsert direct **sans ContentWriteGate**. Endpoint single : **`dry_run=false` par
  défaut** (`:1291`) et l'UI admin appelle sans `dry_run` (`admin.keyword-planner.tsx:459-464`) →
  écrit. Batch : dry-run par défaut (`:1411`).
- **Table servie** : `__seo_gamme.sg_content` → servi R1 par `gamme-response-builder.service.ts:258-265`.
- **Entrypoints/callsites (exhaustif)** : 2 endpoints du même controller
  (`POST /api/admin/keyword-planner/generate-from-rag` `:1283-1389`, `batch-generate-from-rag`
  `:1396-1584`), guards `AuthenticatedGuard+IsAdminGuard` ; frontend `admin.keyword-planner.tsx:459`.
  0 BullMQ, 0 cron, 0 CLI, **pas dans l'execution-registry**.
- **Remplacement canonique** : AUCUN (`NEEDS_CANONICAL_SOURCE` — pas d'émission R1_ROUTER côté WIKI).
- **Fallback RAG** : RAG absent → skip sans write (`No RAG data available`). Aucune source ne
  fallback vers le RAG.
- **Décision** : **DELETE** (service + 2 endpoints + bouton UI). `sg_content` existant reste statique.

### B2 — RAG_WRITE_R1_SLOTS

- **Fichier+lignes** : `r1-enricher.service.ts:80-88` (readFileSync disque direct) ; writes
  `:210-217` (ContentWriteGate si `WRITE_GUARD_ENABLED`, défaut true) **sinon `:229-231` upsert
  direct** (bypass structurel).
- **Source lue** : disque `.md` direct + `__seo_r1_keyword_plan` (DB, enrichissement optionnel).
- **Table cible** : `__seo_r1_gamme_slots` — **0 lecteur de serving vivant** (seuls : writer,
  catalogues/types, `purchase-guide-data.service` non câblé, monitoring, vue SQL).
- **Entrypoints** : uniquement via spine (`EXECUTION_REGISTRY:50` R1_ROUTER →
  `execution-router.service.ts:245-249`) ← 2 controllers pipeline gardés + processor BullMQ
  (`dryRun ?? false`) + 2 scripts backfill (`dryRun:false`).
- **Remplacement canonique** : AUCUN.
- **Fallback RAG** : RAG absent → skip (`NO_RAG_DATA`). Fallback interne : gate absent/off → upsert direct.
- **Décision** : **DELETE** (enricher + entrée registry R1_ROUTER + case router — pattern
  d'échec explicite R4/R5 à réutiliser + les 2 scripts backfill).

### B3 — RAG_WRITE_R2_KP

- **Fichier+lignes** : `r2-enricher.service.ts:92-100` (disque) ; writes `:184-191` (gate) /
  `:204-206` (upsert legacy).
- **Table cible** : `__seo_r2_keyword_plan.r2kp_section_content` — **0 lecteur de serving** sur ce
  tree ; **table hors `SERVED_TABLES` du ratchet** → son retrait ne fera pas baisser le baseline
  (à dire explicitement dans la PR de retrait).
- **Entrypoints** : spine uniquement (R2_PRODUCT `EXECUTION_REGISTRY:29`, router `:251-259`).
- **Écrit même sans RAG** (payload dégradé `NO_RAG_DATA`, `qualityScore=0`, status draft).
- **Remplacement canonique** : AUCUN (pas d'émission R2_PRODUCT).
- **Décision** : **DELETE** (enricher + entrée registry + case router).

### B4 — RAG_WRITE_R1_IMG

- **Fichier+lignes** : `r1-image-prompt.service.ts:53-54` (reader centralisé) ; upsert `:95-97`
  direct, sans gate, sans dry-run.
- ⚠ **Écrit MÊME SANS RAG** : `ragData:null` toléré par les builders → prompts génériques persistés.
- **Table servie** : `__seo_r1_image_prompts` → R1 hero/images via `gamme-response-builder.service.ts:279-296`.
- **Entrypoints** : controller dédié `admin-r1-image-prompts.controller.ts` (3 POST, Auth+IsAdmin)
  + 4 routes frontend admin. Pas dans le registry, 0 BullMQ/cron/CLI.
- **Mutations non-RAG dans le même service** : `approvePrompt`, `setImageUrl`, `uploadAndSetImage`
  (curation humaine d'images existantes), `markStaleByGamme` (0 caller — mort).
- **Décision** : **DELETE la génération** (`generateForGamme/Batch/All` + endpoints `generate*`)
  · **KEEP la curation humaine** (approve/set-image-url/upload — pas des producteurs RAG).
- **Fallback RAG** : aucun autre chemin RAG vers la table après retrait de la génération.

### B5 — RAG_WRITE_R3_IMG

- **Fichier+lignes** : `r3-image-prompt.service.ts:442-450` (disque via `readRagFromDisk`, appelé
  `:131`) ; upsert `:207-209` direct sans gate.
- **Le seul flow au fail-closed propre** : RAG absent → skip total, 0 write (`:132-134`).
- **Table servie** : `__seo_r3_image_prompts` → R3 via `blog-seo.service.ts:357` (`getApprovedImages`).
- **Entrypoints** : controller dédié `admin-r3-image-prompts.controller.ts` (Auth+IsAdmin). Pas
  dans le registry (R3_CONSEILS = ConseilEnricherService), 0 BullMQ/cron/CLI.
- **Décision** : **DELETE la génération · KEEP la curation** (approve `:331-341` / set-image-url
  `:343-353` + endpoints PATCH).

### B6 — RAG_WRITE_CONSEIL_R3 (PILOTE)

Résumé (plan complet séparé) :
- **Lectures RAG** : API `getKnowledgeDoc` `:348` → fallback disque `:823` → supplementary
  `:2259-2294` (branche **inatteignable** : le seul caller runtime passe 2 args, `supplementaryFiles=[]`).
- **Mutations** : upsert `__seo_gamme_conseil` `:2150-2152` (gates amont : CanonGate, QualityGate≥70) ;
  `sg_descrip_draft` via WriteGate `:2680` / update direct `:2698-2706` ; réécriture `.md` RAG
  `ragMdMerger.merge` `:478` (**morte par callers**).
- **Toutes les rows stampées `rag-legacy`**, y compris les 2 branches déterministes internes
  (S2_DIAG observable, title-only).
- ⚠ **Alignement gouvernance** : la branche `buildS2DiagFromObservable` `:1333` (fallback
  observable→S2_DIAG) est exactement ce qu'ADR-027 §Correction interdit désormais (« jamais de
  fallback RAG **ni observable** ») — elle meurt avec le service, c'est un alignement, pas une perte.
- **Callsites** : UN SEUL chemin runtime (`execution-router.service.ts:261-265`) ;
  `enrichWithKeywordPlan` = **méthode publique 0 caller** ; aucun consommateur externe d'une
  partie déterministe (writes = private ; seule la fn pure `formatGammeDisplayName` est importée,
  par un test uniquement).
- **Autres écrivains de la table** : `ConseilQualityScorerService` (déterministe, score only —
  KEEP) ; agent `conseil-batch.md` (workspace seo-batch, SQL via MCP, étape RAG optionnelle) =
  **seul chemin RAG→table restant après retrait, hors backend** — à traiter par décision owner
  séparée (surface workspace, pas monorepo runtime).
- **Décision** : **DELETE (pilote)** — voir `audit/tranche-b2-p1-b6-conseil-removal-plan-2026-07-14.md`.

### B7 — RAG_WRITE_PURCHASE_GUIDE

- **Fichier+lignes** : `buying-guide-rag-fetcher.service.ts:73,105` (API RAG) + `:712-720`
  (fallback disque, guides disk-first `:606-708`) ; mutation `buying-guide-db.service.ts:381-384`
  (update direct).
- **Write-guard PARALLÈLE confirmé** : `buying-guide-db` n'importe pas ContentWriteGate — il
  réimplémente ownership+CAS+ledger inline (`:296-378`). Ne bloque pas la provenance RAG.
- **Écrit même à RAG vide** : write « gatekeeper-only » (`ALL_SECTIONS_SKIPPED`,
  `sgpg_source_verified_by:'pipeline:rag-enrich-skipped'`).
- **Table servie** : `__seo_gamme_purchase_guide` → consumers câblés vérifiés : R6
  (`r6-guide.service.ts:112,175` via blog.module), R1 (`buying-guide-data.service.ts:370,449` via
  gamme-rest.module), R8 (`r8-owned-editorial.composer.ts`).
- **Entrypoints** : `POST /api/admin/buying-guides/enrich` (Auth+IsAdmin) ; `POST
  /api/internal/buying-guides/enrich` (InternalApiKeyGuard) ; spine R6_GUIDE_ACHAT
  (`EXECUTION_REGISTRY:134`, router `:267-270`) ; CLI `scripts/seo/backfill-r6-gatekeeper.py:47-48`
  (re-déclenche l'enrich RAG live).
- **Remplacement canonique** : PARTIEL (export R6 WIKI existe, atterrit dans
  `__seo_content_blocks`, pas de repoint lecteur) — `NEEDS_CANONICAL_REWIRE`.
- **Décision** : **DELETE** (fetcher + enricher + 2 endpoints + entrée registry + script backfill).
  Provenance `RAG_LEGACY` des rows existantes conservée telle quelle (audit trail).

### B8 — RAG_WRITE_R8_VEHICLE

- **Fichier+lignes** : `r8-vehicle-enricher.service.ts` — lectures `.md` véhicule `:554` / gamme
  `:574-582` ; **auto-génération du `.md` manquant `:231-242`** (appel
  `vehicle-rag-generator.service.ts:108-243`, write fs `:189-190`) ; mutations WriteGate `:1379`
  (update page existante) / upsert direct `:1396-1398` (page nouvelle) / versions `:1427` +
  fingerprints/similarity/queue/qa (directes).
- **Laundering DB→`.md`→DB auto-entretenu** : le generator synthétise depuis la DB
  (+`__rag_knowledge` web-scrapé `:822-828`) ; l'enricher régénère lui-même le fichier absent puis
  le relit. `RAG_PROPOSAL_MODE` défaut `'off'` → write fs direct.
- **RAG = défaut ET fallback** : le chemin owned-editorial (`R8_OWNED_EDITORIAL_ENABLED`, défaut
  OFF) **retombe sur le RAG** même flag ON (`R8_OWNED_EDITORIAL_FALLBACK` `:895-986`).
- **Table servie** : `__seo_r8_pages` (`content_main`, `rendered_json`…) → servi fiche véhicule
  via `vehicle-rpc.service.ts:199` ← `vehicles.controller.ts:372`.
- **Entrypoints** : `POST /api/admin/r8/enrich/:typeId` (**aucun dryRun — écrit systématiquement**) ;
  spine R8_VEHICLE (`EXECUTION_REGISTRY:176`, router `:307-334`) ; generator exposé
  `POST /api/admin/vehicle-rag/generate/:modeleId` (+batch). **La boucle seed/outbox R8 N'utilise
  PAS cet enricher** (elle passe par `R8ParentEnrichmentService`, service distinct — 0 référence
  croisée, vérifié) → le retrait de B8 ne la touche pas.
- **Remplacement canonique** : PARTIEL (`vehicle→R8` émis côté WIKI ; feeder gamme-only ; read
  overlay non construit). `R8_VARIANT_FACTS_ENABLED` (Lever A CNIT) **absent de main** (worktree
  non mergé).
- **Décision** : **DELETE** (enricher + generator + 2 controllers + entrée registry) — **groupe
  final** : périmètre le plus large (6 occurrences ratchet, tables annexes versions/fingerprints,
  interaction gates SEO), à traiter après validation du pilote B6.

---

## Ratchet B1b — vérification de stabilité (demandée)

- **Count-exact sur ce tree** : exécuté read-only depuis le worktree → exit 0, « 66 keys, 272
  occurrences » = contrat B1b confirmé. `createdOnCommit: 61b38bbf3`.
- **Sémantique retrait** (voulue, vérifiée dans le code) : clé disparue OU count en baisse →
  `removed` → **exit 1 tant que le baseline n'est pas rafraîchi dans la MÊME PR**
  (`check-served-content-write-sinks-ratchet.ts:215,288-304`). Chaque PR de retrait B2 devra donc
  embarquer `npm run audit:served-write-ratchet:refresh` et le diff du baseline **doit montrer une
  BAISSE** — c'est le mécanisme demandé « les suppressions font diminuer le baseline ».
- ⚠ **Limite honnête n°1** : `--refresh` n'a **aucune garde directionnelle** (`refresh()`
  `:230-248` régénère depuis le scan courant ; il actera une hausse aussi facilement qu'une
  baisse — le message d'erreur « added » propose même cette voie). Protections existantes :
  jamais câblé en CI (« MAINTAINER-ONLY », le workflow ne lance que le check), baseline tracké →
  hausse visible au diff de PR + re-trigger du workflow (path filter). **La review humaine du diff
  du baseline est la seule garde anti-masquage.** Règle de review pour les PRs B2 : baseline diff
  = suppressions uniquement, toute ligne ajoutée/count augmenté = STOP.
- ⚠ **Limite honnête n°2** : le workflow ratchet **n'est PAS un required check** de la branch
  protection de main (13 checks requis vérifiés — il n'y figure pas ; cohérent avec son
  path-filtering). Rouge = visible sur la PR mais non bloquant mécaniquement.
- **Compteur attendu du chantier B2 complet** : **−8 clés / −21 occurrences** (66→58 / 272→251),
  hors B3 (table non-served, absente du baseline). Clé adjacente hors périmètre des 8 :
  `r8-parent-enrichment.service::__seo_r8_publish_snapshot` (rpc_publisher, 1) — boucle seed R8,
  à trancher séparément.

## Couverture / honnêteté

- 8/8 flows revalidés par agents dédiés ; ancres critiques B6 + discordances inter-agents
  (`purchase-guide-data` non câblé, consumers B7) re-vérifiées inline au grep.
- Non couvert ici : reachability runtime des tables « 0 lecteur » côté PROD (RPC/SQL direct hors
  repo) — la conclusion « 0 lecteur vivant » vaut pour ce tree uniquement.
- `conseil-enricher.service.ts` lu intégralement cette fois (2719 lignes) — la réserve du snapshot
  07-07 est levée.
- Décisions = **recommandations** ; chaque retrait = PR dédiée + GO owner nominatif + preuve
  file:line/callsite de CE document. Aucun code modifié dans cette passe.
