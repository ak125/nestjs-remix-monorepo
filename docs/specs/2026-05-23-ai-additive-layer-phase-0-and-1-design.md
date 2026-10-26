# AI Visibility additive layer — Phase 0 governance + Phase 1 tech extensions

**Date** : 2026-05-23
**Statut** : design validé (plan approuvé), spec à reviewer avant writing-plans
**Branche** : `feat/ai-additive-layer-design-spec`
**Plan source** : `/home/deploy/.claude/plans/je-vais-expose-plusieur-resilient-hickey.md` (approuvé 2026-05-23 après 8 salves de brainstorm + 4 meta-reviews user)
**Spec compagnon** : `2026-05-23-product-c-design.md` (Phase 3, gated post commerce-loop V1)
**Mémoires** : [[project_a_b_c_surfaces_distinction]], [[feedback_product_c_design_invariants]], [[feedback_no_questionnaire_propose_best]], [[feedback_no_rag_for_content_legacy_code_is_not_strategy]], [[feedback_verify_existing_first]], [[feedback_more_seo_engineering_not_equal_more_business]], [[feedback_v1_first_dont_build_ultimate_engine_too_early]]

---

## 1. Contexte et problème

L'utilisateur a exposé 50+ idées inspirées de 7 outils SaaS GEO/AI-SEO (Qwairy, ChatSEO, Arvow, Blotato, Fabi Markl, NP Digital, BotSEO) pour AutoMecanik. La doctrine canon refuse l'import bulk : commerce-loop V1 P1 non finie (funnel `conversion_funnel` = 0.17 % organic, verdict empirique 2026-05-20), "SEO ≠ produit", "plus de SEO ≠ plus de business", pas de Phase 2 SEO platform non-planifiée.

Le filtre des 8 salves a abouti à un **keep-list minuscule** : ≤8 livrables petits + 1 décision-fork (R5 désambiguation A/B/C). Cette spec porte la moitié exécutable du keep-list (Phase 0 gouvernance + Phase 1 extensions tech). La Phase 3 produit C (outil interactif) est portée par `2026-05-23-product-c-design.md` et reste **gated**.

**Désambiguation critique R5** (cf. [[project_a_b_c_surfaces_distinction]]) :

| Surface | Nature | État |
|---|---|---|
| **A** — Pages symptômes SEO `role-matrix v5` | Contenu SEO indexé | ✅ EN PROD (tag `v2026.05.21-r2-vehicle-aware-descriptions`) |
| **B** — Section symptômes dans R3 conseils | Contenu SEO contextuel | ✅ EN PROD |
| **C** — Outil diagnostic / panne / entretien / intervalle interactif | Produit conversion-first hors-SEO | ❌ N'EXISTE PAS — spec compagnon |

A/B = optimisation contenu (Phase 2 du plan). C = produit séparé (Phase 3 du plan, gated).

## 2. Stratégie 3-phases (position γ recommandée)

> Gouvernance d'abord → extensions tech petites → C gated post commerce-loop V1.

| Position | Quand C démarre | Force | Faiblesse |
|---|---|---|---|
| α | Jamais | Faible risk | Pas de différentiation produit |
| β | Parallèle V1 | Moat rapide | Outil sur funnel cassé = sable |
| **γ recommandée** | Post-V1 + KPI prouvé + ADR | Séquence saine | Lent à voir moat C |

Cette spec couvre **Phase 0 et Phase 1**. Phase 2 (A+B optimisation) découle directement de Phase 1 (livrable AI Citation Readiness benefits A/B existants) et n'a pas de design propre. Phase 3 = spec compagnon.

## 3. Phase 0 — Gouvernance vault (9 ADRs courts, ordre obligatoire)

Acter les invariants AVANT code. Splittés en 9 ADRs distincts car les décisions hétérogènes ne tiennent pas dans un seul ADR auditable.

**ADR-0 — Désambiguation R5 (A/B/C)** *(fondateur, bloque les ADRs C)*
Acte la distinction. C requalifié en produit conversion-first hors-SEO. Pause de C dérivée de "commerce-loop V1 doit prouver le funnel d'abord", PAS de "no Phase 2 SEO".

**ADRs indépendants en parallèle (2-4)** :
- **ADR — Brand Intelligence canon** : consolide pays/langue/domaine/zones/activité/typologie (dispersé `backend/src/config/site.constants.ts` + `.spec/00-canon/role-matrix.md` + `agents/*/AGENTS.md`).
- **ADR — AI Visibility = couche additive du Search Control Plane** : pas de plateforme parallèle. Signaux AI nourrissent les rapports SEO **existants**.
- **ADR — HITL / Approval Workflow canon** : aucun output IA (suggestion/contenu/fix) ne se publie sans revue humaine. Re-affirme `feedback_no_auto_page_suppression_ever` + `feedback_no_touch_meta_h1_if_optimized`.

**ADRs C en série après ADR-0 (5-9)** — détaillés dans `2026-05-23-product-c-design.md` :
- ADR — Produit C (vision + KPIs hors-SEO)
- ADR — Doctrine déterministe + anti-magique + anti-chatbot-libre
- ADR — Complexity budget C
- ADR — Ontology governance C
- ADR — Decision liability C

**Critère "Phase 0 done"** : les 9 ADRs vault mergées + hash-locked + mirrored dans `.claude/canon-mirrors/`. Les ADRs vivent dans le repo `governance-vault` séparé (cf. CLAUDE.md §Gouvernance) ; ce monorepo ne fait que linker / mirrorer.

## 4. Phase 1 — Extensions tech (6 livrables petits, parallèle commerce-loop V1)

Chaque livrable = extension d'un service existant, migration additive, observable, blast radius minimal. Effort taggé `[dev]` / `[ops]` / `[process]`.

### 4.1 AI Citation Readiness — `[dev]` ~1-2 jours

**Description** : extension de `PageQualityScore` avec 3 critères AI-readable.

**Fichiers touchés** :
- `backend/src/modules/seo/page-quality/page-quality.service.ts` (ou équivalent — à confirmer par grep `PageQualityScore` lors du writing-plans)
- `backend/supabase/migrations/` : nouvelle migration additive `add_ai_readiness_columns` sur `__seo_page_quality_history`

**Critères ajoutés** :
- `has_extractable_tldr` (boolean) : TL;DR <200 chars détecté en début de page
- `has_faq_schema` (boolean) : JSON-LD FAQPage présent
- `has_visible_sources` (boolean) : ≥1 source externe citée visible dans le DOM

**Pas de** nouveau module, nouvelle table, ou changement d'API. Calcul sur les pages existantes, comparé à `conv_funnel` pour signal.

**Verification** : 3 critères calculés sur 100 pages échantillon, distribution par R-role, comparaison avec sessions / conversion via `__seo_event_log` jointure.

### 4.2 Schema audit par R-role — `[dev]` ~1 jour

**Description** : audit de couverture schema sur l'existant.

**Fichiers touchés** :
- Lecture seule : `frontend/app/services/seo/DynamicSeoV4UltimateService` (ou équivalent — à confirmer par grep)
- Production : `docs/audit/schema-coverage-by-r-role.md` (rapport)

**Gap inventory** par R-role :
- R5 : FAQPage + (MedicalCondition-like) → couverture actuelle ?
- R3 : HowTo + FAQ → couverture actuelle ?
- R2 : Product ✅ (déjà couvert)
- Local : LocalBusiness → couverture actuelle ?
- Comparatif : ItemList → couverture actuelle ?

**Fill additive uniquement** là où gap, avec respect strict de `feedback_no_touch_meta_h1_if_optimized` (les meta optimisées sont intouchables).

**Verification** : rapport gap + PR fill schema → ré-audit gap = 0.

### 4.3 Probe AI manuelle mensuelle — `[ops/process]` ~1h/mois

**Description** : Google Sheet versionné. Zero infra technique.

**Fichiers touchés** :
- Nouveau : `workspaces/ai-probe/template.csv` (template) + `workspaces/ai-probe/README.md` (protocole + cadence)
- (Décision : `workspaces/ai-probe/` nouveau workspace, ou `workspaces/seo-batch/` existant ? Recommandé `workspaces/ai-probe/` car cadence + protocole distincts ; mais nécessite README dédié.)

**Colonnes du template** : `date`, `prompt`, `r_role`, `provider` (chatgpt/perplexity/gemini/claude), `brand_mentioned`, `url_cited`, `type_de_contenu_cité` (R5/R3/R2/Local), `concurrents_co_cités`, `sentiment`, `source_vue`, `gsc_present`.

**Protocole** : 10-20 prompts représentatifs R2/R3/R5 × 4 LLM web grand public, **zéro API payant** (per directive user "pas de payant"). Cadence : 1×/mois.

**Verification** : 1 cycle complet livré (≥40 lignes remplies, dates uniques, tous providers présents).

### 4.4 Prompt Registry MINIMAL — `[dev]` ~0.5 jour

**Description** : fichier YAML versionné. **5 champs uniquement**. Pas de DB, pas de UI, pas d'API.

**Fichiers touchés** :
- Nouveau : `workspaces/ai-probe/prompts.yaml` (recommandé hors-canon) OU `.spec/00-canon/prompts/` (canon, nécessite ADR canon-registry-extension préalable). **Trancher dans writing-plans** : par défaut hors-canon pour éviter ADR canon-extension prématurée.

**Schema** :
```yaml
- prompt: "Pourquoi ma Clio 3 fume noir ?"
  intent: diagnostic
  r_role: R5
  target_url: /symptomes-auto/fumee-noire/clio-3
  funnel_stage: MOFU
```

**Pourquoi minimal** : les prompts deviennent progressivement l'équivalent intent des requêtes. On en a besoin tôt ou tard pour la probe + KW canonical alignment + futur produit C. Mais une plateforme = prématurée.

**Verification** : 20 prompts initiaux entrés, validation YAML, alignement avec `@repo/seo-roles` (R5/R3/R2 cohérents).

### 4.5 Opportunity Lens analytique — `[dev]` ~0.5 jour

**Description** : pas de moteur auto, pas de scoring, pas de DB nouvelle, pas de dashboard.

**Fichiers touchés** :
- Nouveau : `scripts/analytics/opportunity-lens.sql` (query versionnée) + `scripts/analytics/opportunity-lens.md` (doc usage)

**Logique** : croise GSC strong impressions × `__seo_page_quality_history` faible × probe AI absent (depuis le prompt registry) → CSV de **review candidates**. Triage humain ensuite.

**Important** (cf. self-review #7) : V1 = intersection avec **queries probe-cibles seulement** (10-20 prompts), pas toute GSC (millions de queries) — la probe n'a pas le volume pour matcher GSC à grande échelle.

**Verification** : query exécutée → CSV produit avec ≥5 candidates → triage humain manuel → ≥1 candidate transformée en PR d'amélioration A/B.

### 4.6 Trend Signals — middle ground — `[dev]` ~2-3 jours

**Décision (self-review #6)** : version "BullMQ + table" PLUS process manuel trimestriel. Si jugé trop lourd au writing-plans, fallback sur **process trimestriel uniquement** (~2h/3mois). Par défaut : version middle ground.

**Description** : petite ingestion light, job mensuel, table d'agrégats simple, vue admin minimale.

**Fichiers touchés** :
- Nouveau : `backend/src/modules/trend-signals/` (module NestJS)
- Nouvelle table additive : `__trend_signals` (date, source, label, freq, link)
- Nouveau cron BullMQ : `trend-signals.processor.ts`
- Frontend : vue admin lecture seule (extension `admin.*` existante)

**Sources** : `rappels.gouv.fr` API publique + codes défaut fréquents (via `scripts/raw-downloaders` existants) + saisonnalité CT (calendrier statique annuel).

**Sert d'input** R3/(A+B) refresh priorisation. Pas de génération auto contenu.

**Verification** : 1 run complet du processor → ≥10 entrées dans `__trend_signals` → vue admin affiche les trends → 1 décision priorisation R3 prise sur cette base.

## 5. Décisions à trancher au writing-plans (judgment calls self-review)

Listées dans le plan source #6-#15. Résumé :

| # | Décision | Défaut anti-bricolage proposé |
|---|---|---|
| #4 | Cible conv rate Phase 1→2 | Cible conv rate organic ≥0.5% (3× baseline) à mesurer sur 30j post-V1 |
| #4 | Error rate Supplier Truth Phase 2→3 | <5% sur golden set de 200 références, mesuré sur 14j |
| #6 | Trend Signals niveau d'effort | Version middle ground (BullMQ + table) ; fallback process si capacity drain |
| #7 | Opportunity Lens scope | Intersection probe-cibles only V1 (cf. §4.5) |
| #9 | Prompt Registry emplacement | `workspaces/ai-probe/prompts.yaml` hors-canon (évite ADR canon-extension prématurée) |
| #10 | Ownership matrix | À ajouter au writing-plans output (PR / agent par livrable) |
| #11 | Verification per-livrable | Déjà inclus dans cette spec (§4.x dernière ligne) |
| #14 | Création `workspaces/ai-probe/` | Oui, listée comme micro-action en §4.3 |

## 6. Hors-scope explicite

- Aucune table `ai_response_snapshots` créée (storage longitudinal des réponses LLM).
- Aucun module `/admin/seo/ai-visibility` ou `/admin/seo/ai-observatory` (dashboard nouvelle plateforme).
- Aucun appel LLM payant (per directive user "pas de payant").
- Aucune génération automatique de contenu IA non contrôlée.
- Aucun moteur d'auto-fix Arvow-style sur meta/URL/canonical/alt.
- Aucune infrastructure cross-posting / faceless video / repurpose engine.
- Aucun chatbot client (gated post-V1, projet séparé).
- Produit C reste gated (cf. spec compagnon + ADR-0 Phase 0 §3).

## 7. Critères de succès Phase 0+1

**Phase 0 done** :
- 9 ADRs vault mergées + hash-locked + mirrored
- Aucun chevauchement de décision entre ADRs (split propre validé)
- Désambiguation A/B/C citable depuis le code via mémoire référencée

**Phase 1 done** :
- 6 livrables shipped (4 dev + 1 ops + 1 dev/process)
- AI Citation Readiness : 3 critères calculés sur ≥100 pages, distribution stable sur 14j
- Probe : ≥3 cycles mensuels consécutifs, ≥40 prompts par cycle
- Opportunity Lens : ≥1 candidate transformée en PR A/B
- Pas d'augmentation du complexity budget (cf. ADR Complexity budget Phase 0)

**Décision Phase 1 → Phase 2 (A+B optimisation)** :
- Funnel commerce-loop V1 atteint cible conv organic ≥0.5% sur 30j
- Probe AI a accumulé ≥3 cycles → baseline AI-citation établie
- ADR-0 mergée → désambiguation actée comme canon

**Décision Phase 2 → Phase 3 (Produit C)** :
- Supplier Truth error rate <5% sur golden set
- ADRs C (5-9) mergées
- Wiki pipeline branché OU décision owner explicite

## 8. Anti-régressions

- Conformité [[feedback_branch_scope_discipline]] : branche dédiée `feat/ai-additive-layer-design-spec` depuis main.
- Conformité [[feedback_commit_via_worktree_when_concurrent_agents]] : commit via worktree dédié `/opt/automecanik/app/.claude/worktrees/ai-additive-layer-design`.
- Conformité [[feedback_worktree_commit_needs_no_verify_husky]] : commit `--no-verify` + commitlint manuel si husky absent en worktree.
- Aucune action sur `payments/` (cf. [[feedback_no_payment_module_changes_ever]]).
- Aucun changement URL/canonical/slug (cf. [[feedback_no_url_changes_ever]]).
- Aucune action SEO auto sur pages optimisées (cf. [[feedback_no_touch_meta_h1_if_optimized]]).
