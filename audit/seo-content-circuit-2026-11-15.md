# Circuit du contenu — carte, preuves d'usage et retraits (mandat AD, 2026-11-15)

- **Base** : monorepo `origin/main` = `c70c4025f`, WIKI `67e49d8`, RAW `401314c`, Vault `main` (ADR-130 au plus haut).
- **Statut AEC** : `PARTIAL_COVERAGE`. Les retraits qui touchent un fichier cité par #2081 (mandat AB, brouillon ouvert) sont différés. Les détails sont au §5.
- Ce document ne crée, n'active ni ne supprime rien. La carte est rédigée dans `workspaces/seo-batch/.claude/skills/seo-content-loop/SKILL.md`, §« Carte du circuit ». Les retraits passent par les PR listées au §5.

## 1. Méthode et sources

| Source | Ce qu'elle prouve | Limites |
|---|---|---|
| Traces Claude Code (`/home/deploy/.claude/projects/**/*.jsonl`) : 420 fichiers, du 2026-10-03T06:58Z au 2026-11-15. Extraction des `tool_use` (`Skill`, `Read`, `Bash`), avec la session courante exclue. | Une *lecture* (`Read` du fichier) ou une *exécution* (`python3/bash/node … <script>`) datée. Une simple mention dans une commande `Bash` (un grep, par exemple) **n'est pas** comptée comme usage. | La rétention est de 14 jours glissants pour certains projets. Les sessions d'autres comptes et les lancements hors Claude Code ne sont pas observés. |
| DB, en lecture seule via `sweep-psql.sh`, relevé du 2026-11-15T14:39Z : `__seo_gamme_conseil` par `sgc_enriched_by`. | Date de dernière écriture par producteur. | Seule la colonne d'attribution est relevée ; aucune ligne n'est lue ni modifiée. |
| Runs GitHub (`gh run list`) | Exécution réelle d'un workflow sur `main`. | Les PR des autres mandats sont exclues. |
| Journal DEV (`journalctl -u automecanik-dev`, `knowledge-jobs`) | Exécution planifiée et résultat. | Couvre DEV seulement, pas la PROD. |
| `rg --hidden` sur les quatre dépôts | Appelants textuels (code, tests, CI, docs). | Un appel dynamique par nom construit à l'exécution n'est pas détecté ; les cas suspects ont été lus à la main. |
| `git log -1` | Date de dernière modification. | Une modification n'est **pas** un usage. |

Règle appliquée : sans preuve d'usage, une pièce est notée **« usage inconnu »** et non « inutilisée ».

Critère « obsolète » (mandat) :
- pièce contraire à ADR-031/046 ;
- ou producteur sans écriture depuis le 2026-04-11.

Les producteurs de `__seo_gamme_conseil` ont tous leur dernière écriture au plus tard le 2026-04-11 :

| Producteur | Lignes | Dernière écriture |
|---|---|---|
| `content-gen-skill` | 1438 | 2026-04-11T11:05Z |
| `conseil-batch-agent` | 749 | 2026-04-11T10:19Z |
| `content-gen-r3` | 243 | 2026-04-11T10:00Z |

Aucune ligne n'est retirée ou modifiée par ce mandat.

## 2. Registres comparés

Huit registres décrivent tout ou partie du circuit :

| Registre | Nature | Décision AD |
|---|---|---|
| `workspaces/seo-batch/.claude/skills/seo-content-loop/SKILL.md` | Skill de la boucle (ADR-111), lu par les sessions | **Choisi comme carte unique** : il est déjà lu par la boucle. C'est une section ajoutée, pas un cinquième registre. |
| `.claude/prompts/_registry/canon-registry.md` | Complétude par rôle R0-R8, datée du 2026-03-14 | Bandeau vers la carte et lignes retirées marquées (#2083). Sa suppression attend AB : `r7-brand-rag-generator.md:34`, cité par #2081, le nomme. |
| `.spec/00-canon/prompt-registry.md` | Table rôle → triplet de prompts. Porte de dérive en mode warn. | Owner-only : patch préparé (§6.1). |
| `.spec/00-canon/artefact-registry.md` | Artefacts par rôle | Owner-only : patch préparé (§6.2). |
| `.spec/00-canon/repository-registry/pipelines.registry.json` | Arêtes du pipeline (L2) | Owner-only : patch préparé (§6.3). |
| `.spec/00-canon/ai-registry/agent-operating-map.yaml` | Handoffs entre agents | Owner-only : patch préparé (§6.4). À appliquer **après** AB, puis régénérer le snapshot Command Center. |
| `audit/registry/canonical.json` | Projection L3 | Jamais éditée à la main. Elle suivra ses sources. |
| REG-001 (Vault) | Registre des agents | Périmètre AB, non touché. |

## 3. Carte (résumé)

Le tableau complet, avec les preuves par étape, se trouve dans la section « Carte du circuit » du SKILL.md. Une pièce canon par étape :

| # | Étape | Pièce canon |
|---|---|---|
| 1 | Besoin | file d'issues ADR-128 + `pilote-file.yml` |
| 2 | Capture | `auto-capture-runner.py` (RAW) |
| 3 | RAW | `gates.py` I/J, `regen-manifests.py` |
| 4 | Proposition WIKI | skill `wiki-proposal-writer` |
| 5 | Contrôle | `validate-frontmatter.py`, `quality-gates.py`, `_scripts/gates/` |
| 6 | Étape 11 | **aucune pièce câblée** (ADR-131 proposée, mandat S) |
| 7 | Promotion | `promotion_decision.py`, appelé par `promote.py --apply` (knowledge-jobs) |
| 8 | Export | `build_exports_seo.py` |
| 9 | Projection | `backend/src/modules/seo-projection/` |
| 10 | Consommation | `seo-projection-reader.service.ts`. Flags OFF : projeté ≠ servi. |
| 11 | Chatbot | `sync-rag-from-wiki.sh` |
| 12 | Mesure | `v5-guardian`, `seo-gamme-audit`, `content-audit` |

Le point d'entrée unique fait l'objet du projet d'ADR-136, au §7.

## 4. Tableau pièce par pièce

Colonnes des traces :
- **L** = lectures (`Read`) ;
- **E** = exécutions ;
- **S** = invocations `Skill`.

Les dates sont en UTC.

### 4.1 Skills

Chemins sous `workspaces/seo-batch/.claude/skills/`, sauf mention contraire.

| Chemin | Étape | Preuve d'usage datée | Verdict | Canon de remplacement |
|---|---|---|---|---|
| `seo-content-loop/` | 1–12 | L=1, S=0 ; 117 mentions, dernière le 11-15T14:38Z | **Canon** (porte la carte) | — |
| `workspaces/wiki/.claude/skills/wiki-proposal-writer/` | 4 | L=10, dernière le 11-15T14:04Z | **Canon** | — |
| `v5-guardian/` | 5 / 12 | S=0, L=0 ; usage inconnu | Conservé : contrôle pollution, scoring et vocabulaire R1 (source unique) | — |
| `pollution-scanner/` | 5 | S=0, L=0. DEPRECATED depuis le 2026-06-12. Tous ses motifs SQL sont dans v5-guardian, module 1. | **Doublon** | `v5-guardian` — **retiré dans le candidat** (PR skills) |
| `content-quality-gate/` | 5 | S=0, L=0. DEPRECATED, fusionné. | **Doublon** | `v5-guardian` — retrait différé : nommé par `agents/cmo`, cité par #2081 |
| `content-gen/` | — | S=0. Ses producteurs DB n'ont rien écrit depuis le 2026-04-11. Neutralisé le 2026-07-02. | **Obsolète** | `seo-content-loop` — retrait différé, à faire avec la PR backend (cf. §5) |
| `keyword-planner/` | — | S=0 ; 195 mentions | **Obsolète** : il lit le RAG (ADR-046) | Aucun canon de remplacement : **proposé seulement** |
| `surgical-cleaner/`, `legacy-recycler/`, `rag-check/` | — | S=0. Producteurs `pipeline-v5-*` : dernière écriture le 2026-03-28. | Obsolètes probables | Différés jusqu'à AB (verdicts agents) |
| `seo-content-architect/` | — | S=0 ; 54 mentions. Neutralisé le 2026-07-02 (corps retiré, `disable-model-invocation`). Ses `references/` sont citées par `canon-registry.md` (page-roles) et par le backend, mais via un chemin racine qui n'existe pas (§8). | Conservé avec raison : il sert de pointeur vers `seo-content-loop` et ses références ont des lecteurs déclarés | — (relocalisation des références : **proposé seulement**) |
| `pipeline-orchestrator/`, `content-audit/`, `seo-gamme-audit/`, `seo-vault-verify/`, `rag-ops/`, `kw-classify/`, `r8-diversity-check/` | 12 / outils | S=0 ; usage inconnu | Conservés : audit ou mesure, aucun doublon établi | — |

### 4.2 Prompts (`.claude/prompts/`)

| Chemin | Étape | Preuve d'usage datée | Verdict | Canon de remplacement |
|---|---|---|---|---|
| `R0_HOME`, `R1_ROUTER`, `R2_PRODUCT`, `R4_REFERENCE`, `R6_GUIDE_ACHAT`, `R7_BRAND`, `R8_VEHICLE` : `{planner,generator,validator}.md` | — | L=0, E=0 depuis le 10-03. Aucun appelant dans le code ou la CI. | **Obsolètes** : générateurs sourcés RAG, sans lecteur | `seo-content-loop` — **retirés dans le candidat** (#2083) |
| `R1_ROUTER/editorial.md` | — | L=0. Générateur de `sg_content` avec « RAG gamme » comme source. Neutralisé le 2026-07-02. | **Obsolète** (ADR-046) | `seo-content-loop`. Sa liste de vocabulaire interdit est **déplacée** vers `v5-guardian/references/r1-forbidden-vocabulary.md`. Retiré dans le candidat (#2083). |
| `_shared/kp-shared-gates.md`, `_shared/write-publish-boundary.md` | — | L=0 ; aucun lecteur | **Obsolètes** | Retirés dans le candidat (#2083) |
| `_shared/kp-shared-output.md` | — | L=0 | **Doublon** | `workspaces/seo-batch/.claude/agents/_shared/kp-shared-output.md`, lu par les agents. Retiré dans le candidat (#2083). |
| `R3_CONSEILS/*`, `R5_DIAGNOSTIC/*`, `_shared/{upstream-required,stop-conditions,quality-constraints}.md` | — | L=0 ; lus par des agents cités par #2081 | Conservés jusqu'à AB | — |
| `_shared/editorial-review.md` | relecture | L=33, dernière le 11-15T12:13Z | **Canon** (relecture de style) | — |
| `_registry/canon-registry.md` | registre | 30 mentions | Bandeau vers la carte (#2083). Suppression après AB. | Carte du circuit |

### 4.3 Backend (`backend/src/modules/admin/services/`)

| Service | Étape | Preuve datée | Verdict | Canon de remplacement |
|---|---|---|---|---|
| `r2-enricher.service.ts`, `buying-guide-enricher.service.ts`, `buying-guide/buying-guide-rag-fetcher.service.ts` | — | Lisent le RAG comme contenu. Derniers commits : 2026-09-29, 2026-09-30, 2026-04-07. | **Obsolètes** (ADR-046) | Projection WIKI (`seo-projection`) — retrait différé : `seo-agent-matrix.json` est cité par #2081 ; précédent #1297 |
| `r4-content-enricher.service.ts` | — | RAG utilisé seulement comme drapeau de présence. Commit du 2026-11-15. | Conservé avec raison | — |
| `r7-brand-enricher`, `r8-vehicle-enricher`, `vehicle-rag-generator`, `rag-gamme-reader`, `rag-proposal`, `conseil-quality-scorer`, `execution-router`, `gamme-detail-enricher` | — | Usage inconnu : pas de trace d'exécution observable depuis Claude Code. Lisent le RAG à des degrés divers. | Non classés : leur lecture du RAG reste à qualifier un par un | — (**proposé seulement** : à instruire après AB) |
| `backend/src/modules/seo-projection/**` | 9–10 | 42 runs réussis, dernier le 11-15T02:00Z (DEV) | **Canon** | — |

### 4.4 Scripts WIKI et RAW

| Chemin | Étape | Preuve datée | Verdict | Canon de remplacement |
|---|---|---|---|---|
| WIKI `_scripts/promotion_decision.py`, `promote.py` | 7 | E=3 et E=12, dernière le 11-15T14:43Z. knowledge-jobs tourne chaque jour. | **Canon** | — |
| WIKI `compute-confidence-score.py`, `shadow_score.py`, `compare-proposal-versions.py` | 7 | E=9 / 0 / 6 | Composants lus par le décideur | — |
| WIKI `validate-frontmatter.py`, `quality-gates.py`, `_scripts/gates/` | 5 | E=11 / 14 ; CI sur `main` | **Canon** | — |
| WIKI `build_exports_seo.py` | 8 | E=8 ; workflow à 02:15 UTC, vert le 11-15T02:20Z | **Canon** | — |
| WIKI `recycle-from-rag.py` | — | E=0, aucun appelant, aucun test. Dernière proposition écrite le 2026-04-29. DEPRECATED depuis #65. | **Obsolète** : lit le RAG (ADR-046) | `wiki-proposal-writer` — **retiré dans le candidat** (WIKI #137) |
| WIKI `anti-inflation-report.py` | 5 | E=0 ; 1 test ; usage inconnu | Conservé : advisory en attente de l'amendement ADR-083/086 | — |
| WIKI `gap1_auto_review.py` | 5 | Tests seulement ; usage inconnu | Conservé | — |
| WIKI `semantic_review_executor.py` | 6 | E=10, dernière le 11-15T14:35Z | Candidat ADR-131 (mandat S), non touché | — |
| WIKI `raw_to_wiki_content_loop_pilot.py` | 2–4 | CI `wiki-quality-gates` | Conservé (pilote) | — |
| RAW `auto-capture-runner.py` | 2 | E=5, dernière le 11-15T14:42Z | **Canon** | — |
| RAW `gates.py`, `regen-manifests.py`, `regen-encyclopedia-state.py` | 3 | E=18 ; pre-commit | **Canon** | — |
| RAW `download-oem-corpus.py`, `download-brand-oem-corpus.py` | — | E=0 | Obsolètes probables | Différés : `agents/rag-lead` est cité par #2081 |
| `sync-rag-from-wiki.sh` | 11 | No-op à 15:00Z ; dernier commit RAG le 2026-07-19 | **Canon** (chatbot) | — |

## 5. PR de retrait et lots différés

| Famille | Dépôt | PR | État |
|---|---|---|---|
| Carte et preuves | monorepo | `docs/mandat-ad-carte-circuit-contenu-20261115` | Brouillon |
| Prompts | monorepo | #2083 | Brouillon. Fusion après application des patches §6.1–6.2. |
| Skills | monorepo | `chore/mandat-ad-retrait-skills-20261115` | Brouillon |
| Scripts WIKI | automecanik-wiki | #137 | Brouillon. Fusion après le patch §6.3. |
| Backend | monorepo | — | Différé jusqu'à AB (`seo-agent-matrix.json`, cité par #2081) |
| Fiches Vault | governance-vault | projet ADR-136 (§7) | Brouillon |

Différés jusqu'à la livraison d'AB, avec reprise de ses verdicts :
- `content-quality-gate`, `content-gen`, `surgical-cleaner`, `legacy-recycler`, `rag-check` ;
- prompts R3 et R5 et leurs `_shared` ;
- suppression de `canon-registry.md` ;
- services backend RAG ;
- `download-*-oem-corpus.py` ;
- patch §6.4.

## 6. Patches owner (préparés, non appliqués)

Les fichiers visés sont réservés à l'owner (`.spec/00-canon/**`).

Pour appliquer un patch :
1. Copier le bloc dans un fichier.
2. Lancer `git apply -p1 <fichier>` à la racine du monorepo, sur la branche de la PR concernée.

Les blocs 6.1 et 6.2 passent `git apply --check` sur #2083. Avec eux, la dérive du registre des prompts redescend de 46 à 30 chemins morts, soit le niveau de `main`.

### 6.1 `.spec/00-canon/prompt-registry.md` (avec #2083)

```diff
--- a/.spec/00-canon/prompt-registry.md	2026-11-15 16:02:58.987753938 +0100
+++ b/.spec/00-canon/prompt-registry.md	2026-11-15 16:04:07.154863504 +0100
@@ -3,6 +3,8 @@
 > **Date** : 2026-03-14
 > **Version** : 1.0.0
 > **Statut** : ACTIVE
+>
+> **Carte du circuit (2026-11-15, mandat AD)** : les pièces qui exécutent le circuit du contenu sont nommées dans `workspaces/seo-batch/.claude/skills/seo-content-loop/SKILL.md` §« Carte du circuit ». Les prompts marqués « retiré » n’avaient aucun lecteur (preuves : `audit/seo-content-circuit-2026-11-15.md`). R3_CONSEILS, R5_DIAGNOSTIC et leurs fichiers `_shared` restent listés jusqu’à la livraison du mandat AB.
 
 Ce registre est la table de vérité reliant chaque rôle canonique à son triplet (planner/generator/validator), ses agents, services, tables et routes réels.
 
@@ -31,9 +33,9 @@
 
 | Couche | Artefact |
 |--------|----------|
-| Planner | `.claude/prompts/R1_ROUTER/planner.md` (maximum, 191 lignes) |
-| Generator | `.claude/prompts/R1_ROUTER/generator.md` (hardened) |
-| Validator prompt | `.claude/prompts/R1_ROUTER/validator.md` |
+| Planner | — retiré 2026-11-15 (mandat AD, sans lecteur) |
+| Generator | — retiré 2026-11-15 (mandat AD, sans lecteur) |
+| Validator prompt | — retiré 2026-11-15 (mandat AD, sans lecteur) |
 | Execution agent | — (inline via R1ContentPipelineService) |
 | Validator agent | `.claude/agents/r1-router-validator.md` (maximum, 231 lignes) |
 | Content batch | `.claude/agents/r1-content-batch.md` |
@@ -90,9 +92,9 @@
 
 | Couche | Artefact |
 |--------|----------|
-| Planner | `.claude/prompts/R4_REFERENCE/planner.md` |
-| Generator | `.claude/prompts/R4_REFERENCE/generator.md` (hardened) |
-| Validator prompt | `.claude/prompts/R4_REFERENCE/validator.md` |
+| Planner | — retiré 2026-11-15 (mandat AD, sans lecteur) |
+| Generator | — retiré 2026-11-15 (mandat AD, sans lecteur) |
+| Validator prompt | — retiré 2026-11-15 (mandat AD, sans lecteur) |
 | Execution agent | `.claude/agents/r4-reference-execution.md` |
 | Validator agent | `.claude/agents/r4-reference-validator.md` |
 | Content batch | `.claude/agents/r4-content-batch.md` |
@@ -130,9 +132,9 @@
 
 | Couche | Artefact |
 |--------|----------|
-| Planner | `.claude/prompts/R6_GUIDE_ACHAT/planner.md` (maximum, 198 lignes) |
-| Generator | `.claude/prompts/R6_GUIDE_ACHAT/generator.md` (hardened, price gate) |
-| Validator prompt | `.claude/prompts/R6_GUIDE_ACHAT/validator.md` |
+| Planner | — retiré 2026-11-15 (mandat AD, sans lecteur) |
+| Generator | — retiré 2026-11-15 (mandat AD, sans lecteur) |
+| Validator prompt | — retiré 2026-11-15 (mandat AD, sans lecteur) |
 | Execution agent | — (inline via buying-guide-enricher) |
 | Validator agent | `.claude/agents/r6-guide-achat-validator.md` (maximum, 254 lignes) |
 | Support validator | `.claude/agents/r6-support-validator.md` (hors matrice cœur) |
@@ -152,9 +154,9 @@
 
 | Couche | Artefact |
 |--------|----------|
-| Planner | `.claude/prompts/R7_BRAND/planner.md` |
-| Generator | `.claude/prompts/R7_BRAND/generator.md` (hardened) |
-| Validator prompt | `.claude/prompts/R7_BRAND/validator.md` |
+| Planner | — retiré 2026-11-15 (mandat AD, sans lecteur) |
+| Generator | — retiré 2026-11-15 (mandat AD, sans lecteur) |
+| Validator prompt | — retiré 2026-11-15 (mandat AD, sans lecteur) |
 | Execution agent | `.claude/agents/r7-brand-execution.md` |
 | Validator agent | `.claude/agents/r7-brand-validator.md` |
 | RAG generator | `.claude/agents/r7-brand-rag-generator.md` |
@@ -173,9 +175,9 @@
 
 | Couche | Artefact |
 |--------|----------|
-| Planner | `.claude/prompts/R8_VEHICLE/planner.md` |
-| Generator | `.claude/prompts/R8_VEHICLE/generator.md` (hardened) |
-| Validator prompt | `.claude/prompts/R8_VEHICLE/validator.md` |
+| Planner | — retiré 2026-11-15 (mandat AD, sans lecteur) |
+| Generator | — retiré 2026-11-15 (mandat AD, sans lecteur) |
+| Validator prompt | — retiré 2026-11-15 (mandat AD, sans lecteur) |
 | Execution agent | `.claude/agents/r8-vehicle-execution.md` |
 | Validator agent | `.claude/agents/r8-vehicle-validator.md` |
 | Keyword planner | `.claude/agents/r8-keyword-planner.md` |
@@ -198,7 +200,7 @@
 | Stop conditions partagées | `.claude/prompts/_shared/stop-conditions.md` |
 | Quality constraints partagées | `.claude/prompts/_shared/quality-constraints.md` |
 | Upstream required partagé | `.claude/prompts/_shared/upstream-required.md` |
-| Write/publish boundary partagé | `.claude/prompts/_shared/write-publish-boundary.md` |
+| Write/publish boundary partagé | — retiré 2026-11-15 (mandat AD, sans lecteur) |
 
 ---
 
@@ -206,7 +208,7 @@
 
 | Type | Nombre |
 |------|--------|
-| Prompts (planner+generator+validator) | 7 × 3 = 21 |
+| Prompts (planner+generator+validator) | 2 × 3 = 6 (R3, R5 ; 15 retirés le 2026-11-15) |
 | Agents exécution | 5 (R0, R4, R5, R7, R8) |
 | Agents validator | 10 (R0-R8 + R6_SUPPORT) |
 | Agents keyword planner | 6 (R2, R4, R6, R7, R8 + orchestrateur) |
```

### 6.2 `.spec/00-canon/artefact-registry.md` (avec #2083)

```diff
--- a/.spec/00-canon/artefact-registry.md	2026-11-15 16:02:59.001753961 +0100
+++ b/.spec/00-canon/artefact-registry.md	2026-11-15 16:04:07.155863506 +0100
@@ -2,6 +2,8 @@
 
 > Date : 2026-03-14
 > Version : 1.0.0
+>
+> **Carte du circuit (2026-11-15, mandat AD)** : les pièces qui exécutent le circuit du contenu sont nommées dans `workspaces/seo-batch/.claude/skills/seo-content-loop/SKILL.md` §« Carte du circuit ». Les prompts marqués « retiré » n’avaient aucun lecteur (preuves : `audit/seo-content-circuit-2026-11-15.md`). R3_CONSEILS, R5_DIAGNOSTIC et leurs fichiers `_shared` restent listés jusqu’à la livraison du mandat AB.
 
 ## Par rôle
 
@@ -9,8 +11,8 @@
 
 | Artefact | Emplacement | Statut |
 |----------|-------------|--------|
-| Planner | `.claude/prompts/R0_HOME/planner.md` | — (pas de prompt, surface statique) |
-| Generator | `.claude/prompts/R0_HOME/generator.md` | — |
+| Planner | — retiré 2026-11-15 (mandat AD, sans lecteur) | — (pas de prompt, surface statique) |
+| Generator | — retiré 2026-11-15 (mandat AD, sans lecteur) | — |
 | Validator | `.claude/agents/r0-home-validator.md` | ✅ |
 | Execution | `.claude/agents/r0-home-execution.md` | ✅ |
 | Role reference | — | — (couvert par page-roles.md) |
@@ -21,8 +23,8 @@
 
 | Artefact | Emplacement | Statut |
 |----------|-------------|--------|
-| Planner | `.claude/prompts/R1_ROUTER/planner.md` | ✅ |
-| Generator | `.claude/prompts/R1_ROUTER/generator.md` | ✅ hardened |
+| Planner | — retiré 2026-11-15 (mandat AD, sans lecteur) | ✅ |
+| Generator | — retiré 2026-11-15 (mandat AD, sans lecteur) | ✅ hardened |
 | Validator | `.claude/agents/r1-router-validator.md` | ✅ maximum |
 | Role reference | `.claude/skills/.../references/r1-router-role.md` | ✅ canon |
 | Contrat | `backend/src/config/page-contract-r1.schema.ts` | ✅ |
@@ -64,8 +66,8 @@
 
 | Artefact | Emplacement | Statut |
 |----------|-------------|--------|
-| Planner | `.claude/prompts/R4_REFERENCE/planner.md` | ✅ |
-| Generator | `.claude/prompts/R4_REFERENCE/generator.md` | ✅ hardened |
+| Planner | — retiré 2026-11-15 (mandat AD, sans lecteur) | ✅ |
+| Generator | — retiré 2026-11-15 (mandat AD, sans lecteur) | ✅ hardened |
 | Validator | `.claude/agents/r4-reference-validator.md` | ✅ |
 | Execution | `.claude/agents/r4-reference-execution.md` | ✅ |
 | Role reference | `.claude/skills/.../references/r4-reference-role.md` | ✅ canon |
@@ -94,8 +96,8 @@
 
 | Artefact | Emplacement | Statut |
 |----------|-------------|--------|
-| Planner | `.claude/prompts/R6_GUIDE_ACHAT/planner.md` | ✅ |
-| Generator | `.claude/prompts/R6_GUIDE_ACHAT/generator.md` | ✅ hardened (price gate) |
+| Planner | — retiré 2026-11-15 (mandat AD, sans lecteur) | ✅ |
+| Generator | — retiré 2026-11-15 (mandat AD, sans lecteur) | ✅ hardened (price gate) |
 | Validator | `.claude/agents/r6-guide-achat-validator.md` | ✅ maximum |
 | Role reference | `.claude/skills/.../references/guide-achat-role.md` | ✅ canon |
 | Contrat | `backend/src/config/page-contract-r6.schema.ts` | ✅ |
@@ -110,8 +112,8 @@
 
 | Artefact | Emplacement | Statut |
 |----------|-------------|--------|
-| Planner | `.claude/prompts/R7_BRAND/planner.md` | ✅ |
-| Generator | `.claude/prompts/R7_BRAND/generator.md` | ✅ hardened |
+| Planner | — retiré 2026-11-15 (mandat AD, sans lecteur) | ✅ |
+| Generator | — retiré 2026-11-15 (mandat AD, sans lecteur) | ✅ hardened |
 | Validator | `.claude/agents/r7-brand-validator.md` | ✅ |
 | Execution | `.claude/agents/r7-brand-execution.md` | ✅ |
 | Role reference | `.claude/skills/.../references/r7-brand-role.md` | ✅ canon |
@@ -125,8 +127,8 @@
 
 | Artefact | Emplacement | Statut |
 |----------|-------------|--------|
-| Planner | `.claude/prompts/R8_VEHICLE/planner.md` | ✅ |
-| Generator | `.claude/prompts/R8_VEHICLE/generator.md` | ✅ hardened |
+| Planner | — retiré 2026-11-15 (mandat AD, sans lecteur) | ✅ |
+| Generator | — retiré 2026-11-15 (mandat AD, sans lecteur) | ✅ hardened |
 | Validator | `.claude/agents/r8-vehicle-validator.md` | ✅ |
 | Execution | `.claude/agents/r8-vehicle-execution.md` | ✅ |
 | Role reference | `.claude/skills/.../references/r8-vehicle-role.md` | ✅ canon |
@@ -155,7 +157,7 @@
 | Stop conditions (shared) | `.claude/prompts/_shared/stop-conditions.md` |
 | Quality constraints (shared) | `.claude/prompts/_shared/quality-constraints.md` |
 | Upstream required (shared) | `.claude/prompts/_shared/upstream-required.md` |
-| Write/publish boundary (shared) | `.claude/prompts/_shared/write-publish-boundary.md` |
+| Write/publish boundary (shared) | — retiré 2026-11-15 (mandat AD, sans lecteur) |
 | Role IDs enum | `backend/src/config/role-ids.ts` |
 | Bridge functions | `backend/src/config/content-section-policy.ts` |
 | Scoring bridge | `backend/src/config/scoring-profiles.config.ts` |
@@ -198,7 +200,7 @@
 
 | Type | Nombre |
 |------|--------|
-| Prompts (planner+generator+validator) | 21 (7 roles × 3) |
+| Prompts (planner+generator+validator) | 6 (R3, R5 × 3 ; 15 retirés le 2026-11-15) |
 | Shared prompt blocks | 4 |
 | Agent execution prompts | 5 (R0, R4, R5, R7, R8) |
 | Agent validators | 10 (R0-R8 + R6_SUPPORT) |
```

### 6.3 `.spec/00-canon/repository-registry/pipelines.registry.json` (avant WIKI #137)

```diff
--- a/.spec/00-canon/repository-registry/pipelines.registry.json	2026-11-15 16:02:59.016753985 +0100
+++ b/.spec/00-canon/repository-registry/pipelines.registry.json	2026-11-15 16:03:16.314781808 +0100
@@ -9,8 +9,8 @@
       "to": "automecanik-wiki/proposals/",
       "kind": "promotion",
       "status": "PARTIAL",
-      "scripts": ["automecanik-wiki/_scripts/recycle-from-rag.py"],
-      "gaps": ["claim extraction structurée", "source_map typed Pydantic", "structured proposal renderer"],
+      "scripts": [],
+      "gaps": ["claim extraction structurée", "source_map typed Pydantic", "structured proposal renderer", "écriture des propositions par le skill workspaces/wiki/.claude/skills/wiki-proposal-writer, sans script dédié ; recycle-from-rag.py retiré le 2026-11-15 (lisait automecanik-rag, contraire ADR-046)"],
       "owner_pr": "PR-3a (monorepo orchestration) + PR-3b (wiki repo bridge)",
       "adr": "ADR-058"
     },
```

### 6.4 `.spec/00-canon/ai-registry/agent-operating-map.yaml` (après AB, puis `node scripts/governance/build-command-center-snapshot.js`)

```diff
--- a/.spec/00-canon/ai-registry/agent-operating-map.yaml	2026-11-15 16:02:59.032754011 +0100
+++ b/.spec/00-canon/ai-registry/agent-operating-map.yaml	2026-11-15 16:03:16.314781808 +0100
@@ -78,9 +78,8 @@
     state: PARTIAL
     evidence:
       adr: ADR-031
-      scripts:
-        - "automecanik-wiki/_scripts/recycle-from-rag.py"
-    notes: "pipelines.registry.json line 12 status=PARTIAL. Manual gate, no CI enforcement."
+      scripts: []
+    notes: "Carte du circuit = workspaces/seo-batch/.claude/skills/seo-content-loop/SKILL.md (mandat AD, 2026-11-15). Écriture des propositions par le skill workspaces/wiki/.claude/skills/wiki-proposal-writer ; recycle-from-rag.py retiré (lisait automecanik-rag, contraire ADR-046). Gate human_review_required antérieur à ADR-119, sans effet."
 
   - id: wiki-to-seo-r2-r7
     from: external:automecanik-wiki
```

## 7. Point d'entrée unique : projet ADR-136

Le projet est rédigé dans le Vault (statut `proposed`, PR signée en brouillon). Il compare quatre options :

| Option | Description |
|---|---|
| A | Routine `pilote-file` (ADR-128) |
| B | Workflow `repository_dispatch` / cron |
| C | Sessions sous mandat |
| D | Timer `knowledge-jobs`, versionné |

Il intègre aussi la condition D3 d'ADR-131 et la boucle de corroboration. Rien n'est construit ni activé : la ratification revient à Marwane.

## 8. Constats hors périmètre (signalés, non corrigés)

1. `knowledge-jobs` (le timer qui promeut chaque jour) vit hors dépôt (`~/.local/lib/knowledge-jobs/run.py`) et n'est pas versionné.
2. Le backend lit des chemins `.claude/skills/seo-content-architect/...` qui n'existent pas à la racine. Le skill est sous `workspaces/seo-batch/`. Fichiers concernés :
   - `quality-validator.service.ts:91` (`data/forbidden.csv`, absent partout) ;
   - `rag-phase2a-shadow-audit.service.ts:430/443` ;
   - `phase2a-shadow-audit.constants.ts:106`.
3. Le miroir RAG n'a reçu aucun commit depuis le 2026-07-19. `sync-rag-from-wiki.sh` tourne à vide.
4. `auto-enrich` a échoué le 2026-09-30 (`INTERNAL_API_KEY`).
5. L'agent `r3-keyword-planner` lit le RAG (périmètre AB).
6. REG-001 (Vault) dérive par rapport aux agents présents (périmètre AB).
7. 226 lignes de `__seo_gamme_purchase_guide` portent `source_type = rag`. Aucune écriture n'a été faite (zone DB).
8. `prompt-registry.md` contient déjà 30 chemins morts sur `main`. La porte de dérive est en mode warn, donc non bloquante.
9. Des propositions WIKI de la phase F ont été générées depuis le RAG (`ingested_by: skill:recycle-from-rag@v0.1`). Ce sont des données, conservées.
10. #1924 (brouillon) est en conflit ; il touche `seo-content-loop/SKILL.md` et `editorial-review.md`.
11. L'étape 11 n'a aucune pièce câblée : la condition `technical_qualification_pass` (ADR-131 D3) n'est pas lue par le décideur (mandat S).
