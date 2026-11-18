# Mandat BI — fermer l'écart de P11 : relevé et plan des tranches

Décision 135 de l'owner (17 novembre 2026) : le RAG sert le chatbot, il n'alimente ni RAW, ni le
WIKI, ni un consommateur. Ce dossier contient le relevé des lectures du RAG hors module RAG, le
plan de fermeture mis à jour, et les deux modifications à appliquer quand la référence du ratchet
sera à 0. Rien n'est fusionné, aucune écriture en base, aucune modification du journal.

Base du relevé : `main` = `fc470e41a0fdb173edf382f4eb0f0449db036ac0` (17 novembre).

État au 17 novembre :

| Élément | Avant le mandat | Après la tranche 1 (PR #2137, brouillon, non fusionnée) |
|---|---|---|
| Référence du ratchet (`audit/baselines/rag-authority-read-baseline.json`) | 16 occurrences, 6 fichiers | 10 occurrences, 3 fichiers |
| Règle `seo-no-rag-as-content-source` | avertissement | avertissement (inchangé tant que la référence n'est pas à 0) |
| Ligne « Écart » de P11 | présente | présente |

## 1. Relevé des lectures du RAG hors module RAG

Méthode : recherche de l'identifiant `RAG_KNOWLEDGE_PATH`, des chemins `/opt/automecanik/rag` en
dur, des imports du module `rag-proxy` hors de ce module et des lectures de tables `__rag_*`, dans
tout le dépôt. Exécution réelle mesurée en base le 17 novembre, en lecture seule.

### 1.1 Backend, dans la portée de la règle

Portée actuelle : `backend/src/modules/admin/services/**` et `backend/src/modules/seo/services/**`.

| Fichier (occurrences) | Appelant | Ce qu'il écrit | Encore exécuté | Source de remplacement | Tranche |
|---|---|---|---|---|---|
| `admin/services/r2-enricher.service.ts` (2) | registre d'exécution `R2_PRODUCT`, routeur `POST /api/admin/pipeline/execute` | `__seo_r2_keyword_plan` (plan de mots-clés R2, non servi) | Non : écriture refusée par la porte depuis #1587, 0 ligne en base, 2 exécutions le 2026-03-19 | Aucune nécessaire : rien ne lit la table. Un producteur WIKI→R2 reste à construire | **B3, retirée par #2137** |
| `admin/services/r4-content-enricher.service.ts` (2) | routeur, rôle `R4_REFERENCE` | rien depuis le RAG : le fichier était lu, seul un booléen `ragAvailable` en sortait, sans consommateur | Lecture vestigiale ; `__seo_r4_batch_runs` : 1 ligne, en échec | Aucune nécessaire | **retirée par #2137** |
| `admin/services/execution-router.service.ts` (2) | dry-run de R2 et repli du dry-run R4 | rien : test d'existence du fichier RAG, réponse « would enrich from RAG » | Dernier passage du routeur : 2026-05-21 | Aucune nécessaire | **retirée par #2137** |
| `admin/services/rag-gamme-reader.service.ts` (2) | `R1ImagePromptService` ← `POST api/admin/r1-image-prompts/generate`, `generate-all`, `generate/:pgAlias` ← écrans `admin.r1-images`, `admin.r1-qa`, `admin.keyword-planner` | `__seo_r1_image_prompts` (consignes d'image R1) : 70 lignes, 14 gammes | Oui, à la demande, depuis l'admin | Export WIKI de la gamme quand il existe. Sinon retrait de la génération, conservation des images et validations (modèle B5, #1278) | B4, ouverte |
| `admin/services/buying-guide/buying-guide-rag-fetcher.service.ts` (3) | `BuyingGuideEnricherService` ← `admin-buying-guide.controller.ts`, `internal-enrich.controller.ts`, registre `R6_GUIDE_ACHAT` | `__seo_gamme_purchase_guide` (R6) : écriture RAG refusée par la porte depuis #1587 et #1615 | Lecture oui, écriture non | WIKI de la gamme. Lit aussi le RAG par `RagProxyService` et `RagFoundationGateService`, que la règle ne voit pas | B7, ouverte |
| `admin/services/vehicle-rag-generator.service.ts` (5) | `admin-vehicle-rag.controller.ts` (`api/admin/vehicle-rag`), `rag-proposal.service.ts` | des fichiers `knowledge/vehicles/*.md` dans le RAG (l. 190), à partir de la base et de `knowledge/web` | À la demande, depuis l'admin | Sans objet : ce n'est pas un producteur de contenu servi, c'est une écriture directe dans le RAG hors du miroir WIKI→RAG | À classer, voir §3 |

### 1.2 Backend, hors de la portée de la règle

| Fichier | Lecture | Ce qu'il écrit | Classement |
|---|---|---|---|
| `admin/controllers/admin-keyword-planner.controller.ts` | `RAG_GAMMES_DIR` (l. 33), `loadRag` (l. 1251-1263), `buildContext` (l. 1412-1447) pour `POST generate` (l. 812-870) ; gabarits lus dans le dépôt RAG par un chemin en dur (`TEMPLATES_DIR`, l. 32) | rien en base : la route renvoie à l'écran d'admin une consigne construite depuis le fichier RAG. Le résultat revient ensuite par `POST import` (l. 1011), qui écrit `__seo_keyword_results` sans lire le RAG | **Producteur indirect lisant le RAG, non couvert.** Justifie l'élargissement de la règle à `admin/controllers/**` |
| même fichier, `GET coverage` (l. 219-262) | présence du fichier RAG, table `__rag_web_ingest_jobs` | rien | indicateur d'affichage |
| `admin/controllers/admin-rag-ingest.controller.ts` | écrit dans le RAG (fusion de PDF) | RAG | ingestion, hors périmètre du mandat |
| `admin/services/brief-template.service.ts` (l. 563-573), `marketing/services/marketing-data.service.ts` (l. 356) | table `__rag_content_refresh_log` | rien depuis le RAG | journal d'exécution, pas la base de connaissances. Pas un producteur |
| `rag-proxy/**`, `rag-knowledge-bootstrap/**`, `seo-monitoring/services/rag-mirror-freshness.service.ts`, `diagnostic-engine/**` | chatbot, garde, surveillance, diagnostic | sans objet | consommateurs légitimes, non touchés |
| `ai-content/templates/content-templates.ts` (l. 596, 699, 799, 1054), `seo/r2/schemas/r2-composition.schema.ts` (l. 31) | champ `ragContent` présenté comme « source de vérité » dans les gabarits | rien : sur `main`, seuls les deux services retirés par #2137 portent une variable de ce nom, et aucun ne la transmet aux gabarits | vestige à retirer avec la dernière tranche |

### 1.3 Hors backend (scripts, agents, frontend)

Relevé en lecture seule sur 202 fichiers suivis contenant un motif RAG. Aucune garde ne couvre ces
chemins : la règle de lecture ne vise que `backend/src`, et `no-direct-rag-knowledge-write.yml` ne
vise que les écritures Python de trois dossiers.

| Fichier | Lecture | Ce qu'il écrit | Appelant dans le dépôt |
|---|---|---|---|
| `scripts/seo/batch-r6-keyword-plans.py` | `knowledge/gammes` | `__seo_r6_keyword_plan` | aucun |
| `scripts/seo/backfill-r1-safe-table.py` | `knowledge/gammes` (frontmatter) | `__seo_r1_gamme_slots.r1s_safe_table_rows` | aucun |
| `scripts/seo/curate-r7-batch.py` | `knowledge/web/brands/*/editorial-draft.json` | `PUT /api/admin/r7/editorial/:id` | aucun |
| `scripts/seo/import-gads-kp.py` | `knowledge/gammes`, comme filtre de pertinence sur un CSV Google Ads | `__seo_keywords` | skill `kw-classify`, règle `seo-batch.md`, `.spec/keyword-research-batches.md` |
| 16 agents de `workspaces/seo-batch/.claude/agents/` (planificateurs de mots-clés R1 à R8, `brief-enricher`, `research-agent`, consignes d'image R3 et R6, trois `agentic-*`) | « Read » du fichier RAG de la gamme | tables `__seo_*_keyword_plan`, `__seo_page_brief`, `__seo_research_brief`, `__agentic_*` | chargement réel par une session non vérifié |
| skills `keyword-planner`, `kw-classify`, `rag-check` (Fix B), références de `seo-content-architect` | idem | idem | idem |
| `.claude/prompts/R3_CONSEILS/*`, `.claude/prompts/R5_DIAGNOSTIC/*`, `PROCEDURE-SEO.md` | texte « RAG = source de vérité » | sans objet | aucun chargeur trouvé dans `backend/src` |
| `frontend/app/routes/admin.seo-hub.content.generator.tsx` | aucune : `hasRagFile: true` en dur, `use_rag: true` envoyé à une route qui ne lit plus le RAG | sans objet | libellés périmés |

Ces instructions contredisent `workspaces/seo-batch/CLAUDE.md:17` et
`workspaces/seo-batch/.claude/rules/seo-batch.md:7`, qui interdisent déjà le RAG comme source.

Trois scripts écrivent directement dans le RAG hors du miroir WIKI→RAG
(`scripts/seo/build-keyword-clusters.ts --write-md`, `rag-cleanup-scrape.py`, `rag-upgrade-v4.py`)
et `scripts/wiki-generators/gamme-from-db-template-generator.py` modifie la table `__rag_knowledge`.
Ce ne sont pas des producteurs de contenu servi ; ils relèvent de la règle d'écriture, pas de P11.

### 1.4 Dépôts WIKI et RAW (point 6, lecture seule)

WIKI `origin/main` = `a8368b6d331f220ae1bae6e50a57a38c8cf527b0`, RAW `origin/main` =
`b097ca48a393e0cddaec54be1765038cfa8ec733`.

**Aucun script, workflow, hook ou cron des deux dépôts ne lit le RAG pour écrire RAW ou le WIKI.**
`recycle-from-rag.py` est absent du WIKI depuis sa PR #137.

Ce qui reste, sans correction ici :

- Héritage dans RAW : `recycled/rag-knowledge/` contient 4 834 fichiers, dont 4 693 copiés du RAG
  par deux PR anciennes (#4 et #15). Exemptions de la porte A jusqu'au 2026-12-31.
- Héritage dans le WIKI : trois fiches canon approuvées citent ce dossier recyclé en source
  (`wiki/gamme/filtre-a-air.md`, `filtre-a-carburant.md`, `filtre-d-habitacle.md`) ; six
  propositions véhicules portent `ingested_by: skill:recycle-from-rag@v0.1` ; un export SEO
  (`exports/seo/gamme/filtre-a-air.json`) en dépend.
- Dans le monorepo, deux générateurs lisent ce dossier recyclé et écrivent vers le WIKI
  (`scripts/wiki-generators/gamme-from-web-corpus-generator.py`, sans appelant, et
  `promote-raw-gammes-to-wiki.py`, sous `--owner-go`), alors que le skill `seo-content-loop`
  l'interdit (l. 71 et 174).
- Mentions périmées de `recycle-from-rag.py` : `.spec/00-canon/ai-registry/agent-operating-map.yaml:82`
  et `.spec/00-canon/repository-registry/pipelines.registry.json:13` (fichiers réservés à l'owner).
- Portes dormantes : `--submission-stdin` de `_scripts/auto-capture-runner.py` (RAW, aucun appelant
  trouvé) et le mécanisme `__rag_proposals` (`RAG_PROPOSAL_MODE=off` selon le code, valeur réelle
  non vérifiée).

## 2. L'écart « 12 fichiers » du journal contre 6 dans la référence

Le journal compte 12 fichiers par recherche textuelle de l'identifiant hors module RAG. Ce décompte
inclut un commentaire, un test, l'ingestion, une garde, la surveillance du miroir et le contrôleur
du planificateur de mots-clés. La référence compte 6 fichiers parce qu'elle ne retient que les
occurrences de code, dans les deux dossiers de la règle. Les deux chiffres sont justes pour ce
qu'ils mesurent. Le seul producteur réel absent de la référence est
`admin-keyword-planner.controller.ts`.

## 3. Plan de fermeture, mis à jour

Le plan d'origine (tranches B1 à B8) est dans `audit/adr059-p0d0-audit-2026-07-14.md`, §5 et §6.
**Ce fichier n'est pas suivi par Git** : il n'existe que dans le checkout du DEV, et il est périmé
(il donne 7 tranches sur 8 ouvertes). Les traces versionnées du plan sont les notes de
`scripts/audit/editorial-authority-sinks.ts`, la note de la référence et l'en-tête de la règle. La
section ci-dessous le remplace ; aucun second plan, aucun second détecteur.

| Tranche | Producteur | État | Preuve |
|---|---|---|---|
| B1 | `R1ContentFromRagService` → `__seo_gamme.sg_content` | fermée | #1297 |
| B2 | `R1EnricherService` → `__seo_r1_gamme_slots` | fermée | #1297, puis #1979 (lot R1) |
| B3 | `R2EnricherService` → `__seo_r2_keyword_plan` | retirée dans le candidat | #2137, brouillon |
| B4 | `R1ImagePromptService` → `__seo_r1_image_prompts` | ouverte | voir ci-dessous |
| B5 | `R3ImagePromptService` → `__seo_r3_image_prompts` | fermée | #1278 |
| B6 | `ConseilEnricherService` → `__seo_gamme_conseil` | fermée | avant le 2026-07-14 |
| B7 | `BuyingGuideEnricher` → `__seo_gamme_purchase_guide` | écriture fermée (#1587, #1615), lecture ouverte | voir ci-dessous |
| B8 | `R8VehicleEnricherService` → `__seo_r8_pages` | fermée | #1562, #1587 |

Tranches restantes, dans l'ordre proposé. Aucune n'est commencée : le mandat s'arrête après la
première tranche et ce plan.

| N° | Contenu | Effet sur la référence | Indépendante | Ce qui la bloque |
|---|---|---|---|---|
| 2 | **B4.** Retirer la génération des consignes d'image R1 depuis le RAG (`rag-gamme-reader.service.ts`, routes `generate*`), garder les images déposées et les validations, sur le modèle de B5 | 10 → 8, 3 → 2 fichiers | oui | **Signalement préalable** : les boutons « générer » de trois écrans d'admin disparaissent. Les 70 lignes existantes restent. Décision de l'owner : retrait simple, ou génération depuis l'export WIKI de la gamme |
| 3 | **B7.** Retirer la lecture RAG du guide d'achat (`buying-guide-rag-fetcher.service.ts`, appels `RagProxyService` et `RagFoundationGateService`, entrée `R6_GUIDE_ACHAT` si elle n'a plus de source) | 8 → 5, 2 → 1 fichier | oui | **Signalement préalable** : l'enrichissement R6 depuis l'admin et la route interne n'a plus de source tant qu'un producteur WIKI→R6 n'existe pas. Aucune page servie ne change : l'écriture est déjà refusée. Les 226 guides d'origine RAG restent servis (voir §5) |
| 4 | **Générateur RAG véhicules.** `vehicle-rag-generator.service.ts` écrit dans le RAG, il ne produit pas de contenu servi | 5 → 0, 1 → 0 fichier | oui | **Décision de l'owner sur le classement.** Soit le RAG n'est alimenté que par le miroir WIKI→RAG, et le service est supprimé avec sa route. Soit c'est de l'ingestion légitime, et il déménage dans le module `rag-proxy`, hors de la portée de la règle. L'exclure par une ligne `ignores` reviendrait à assouplir la garde : non proposé |
| 5 | **Planificateur de mots-clés.** Retirer `loadRag`, `buildContext` et `TEMPLATES_DIR` de `admin-keyword-planner.controller.ts`. Élargir la règle à `backend/src/modules/admin/controllers/**` dans la même PR, pour que la référence reste à 0 | hors référence aujourd'hui | oui, après les tranches 2 à 4 pour l'élargissement | **Source de remplacement à décider** : `POST generate` construit sa consigne depuis le fichier RAG. `admin-rag-ingest.controller.ts` est dans le même dossier et lit l'identifiant légitimement : l'élargissement doit viser les contrôleurs de contenu, ou ce contrôleur doit rejoindre `rag-proxy` |
| 6 | **Hors backend.** Supprimer les trois scripts sans appelant de `scripts/seo/`, retirer le filtre RAG d'`import-gads-kp.py`, neutraliser les 16 agents et les skills qui demandent de lire le RAG, corriger `PROCEDURE-SEO.md` et les libellés du générateur de l'admin | sans effet | oui | Les agents et skills de `workspaces/seo-batch/` ont été modifiés le 17 novembre par #2118 (mandat BC), et trois PR ouvertes portent sur les agents ou les skills (#1924, #2081, #2087) : vérifier le chevauchement avant d'y toucher. Le filtre d'`import-gads-kp.py` a besoin d'une autre source de pertinence. La garde : étendre la règle existante `no-direct-rag-knowledge-write.yml` ou la règle de lecture, pas un nouveau détecteur |
| 7 | **Bascule.** Référence à 0, règle en erreur, portée élargie, vestige `ragContent` retiré, ligne « Écart » de P11 retirée | 0 | non : après 2 à 5 | Approbation de l'owner pour le journal |

## 4. Modifications préparées pour la bascule, non appliquées

À n'appliquer que lorsque `npm run audit:rag-authority-read-ratchet` affiche 0 occurrence. Les deux
patches sont dans `patches/`, leurs empreintes dans `SHA256SUMS`. Ils s'appliquent sur `fc470e41a`
(`git apply --check` vert le 17 novembre) ; aucun n'est appliqué.

Le patch 01 ne s'applique pas avant la tranche 5 : avec la portée élargie, la règle signale
`admin-keyword-planner.controller.ts` et `admin-rag-ingest.controller.ts`.

Règle `.ast-grep/rules/seo-no-rag-as-content-source.yml` :

```diff
-severity: warning
+severity: error
 files:
   - backend/src/modules/admin/services/**/*.ts
   - backend/src/modules/seo/services/**/*.ts
+  - backend/src/modules/admin/controllers/**/*.ts
```

Le bloc de commentaire « SÉVÉRITÉ = `warning` … » et le message « LEGACY … » sont à réécrire dans
la même PR, avec le test `scripts/audit/__fixtures__/rag-authority/` et la note de la référence.

Journal `.claude/governance/journal-des-principes.md`, principe P11 (texte proposé, à approuver par
l'owner dans une PR dédiée) :

```diff
 - **P11.** Le RAG est un consommateur en lecture seule, sans autorité de production de contenu.
   Source : ADR-031, ADR-046.
-  Application : L2 pour le neuf (`.ast-grep/rules/no-direct-rag-knowledge-write.yml`,
-  `scripts/audit/check-rag-authority-read-ratchet.ts`). Écart : 12 fichiers hors module RAG lisent
-  encore la base RAG pour produire du contenu ; la règle de lecture
-  (`seo-no-rag-as-content-source.yml`) est en avertissement. Ces producteurs sont à retirer
-  (`CLAUDE.md`, invariant 4).
+  Application : L2 (`.ast-grep/rules/no-direct-rag-knowledge-write.yml` pour l'écriture,
+  `.ast-grep/rules/seo-no-rag-as-content-source.yml` en erreur pour la lecture, référence
+  `scripts/audit/check-rag-authority-read-ratchet.ts` à 0). Les scripts et instructions d'agents
+  hors `backend/src` ne sont couverts par aucune garde.
```

La dernière phrase du texte proposé disparaît si la tranche 6 étend la garde.

## 5. Constats hors périmètre, signalés sans correction

- **226 guides d'achat servis sont d'origine RAG** (`sgpg_source_type = 'rag'` dans
  `__seo_gamme_purchase_guide`, plus 15 lignes sans origine). Retirer le producteur ne les change
  pas. Les re-sourcer ou les retirer est une écriture en base sur du contenu indexé : décision de
  l'owner.
- Le plan d'origine et d'autres documents d'audit ne sont pas versionnés (dossier `audit/` du
  checkout du DEV).
- `agents/rag-lead/AGENTS.md` (l. 91-92) cite deux scripts absents de `scripts/rag/` ; `agents/cto/AGENTS.md:26` contient
  une adresse IP en dur, contraire à `CLAUDE.md`.
- `scripts/seo/curate-r7-batch.py` (l. 60-62) contient des identifiants d'admin par défaut en dur.
- `scripts/validate-gamme-schema.ts` annonce valider l'export WIKI et lit le dossier RAG (l. 17).
- `workspaces/marketing/.claude/rules/marketing-batch.md:11` et le miroir `marketing-voice.md:42`
  citent `rag/knowledge/gammes/` comme référence de vérification, contre
  `workspaces/marketing/AGENTS.md:39`.
- Le commentaire d'exemple de `admin-pipeline.controller.ts` cite encore `R3_CONSEILS`, rôle sans
  entrée de registre.
- `audit/registry/*.json` ne peut pas être régénéré fidèlement depuis un worktree dont
  `node_modules` est un lien : la régénération y réécrit environ 600 lignes sans rapport.

## 6. Non vérifié

- Le crontab installé sur l'hôte et la valeur réelle de `RAG_PROPOSAL_MODE`.
- Le dépôt `automecanik-rag` lui-même et les branches hors `main` des dépôts WIKI et RAW.
- Le chargement réel des agents et skills de `workspaces/seo-batch/` par une session ou par Paperclip.
- Les exécutions manuelles passées des scripts sans appelant.
- La révision servie par le DEV (`/health` renvoie `revision: null`).
- Le comportement des routes `/api/admin/r7/editorial`, `/api/admin/rag/pdf-merge`,
  `/api/rag/admin/images/assign`, `/api/admin/content-refresh/trigger` et `/api/admin/agentic/runs`.
