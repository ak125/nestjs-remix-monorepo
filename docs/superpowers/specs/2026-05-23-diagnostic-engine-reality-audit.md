# Reality Audit — Diagnostic Engine V1 (Block A)

**Date** : 2026-05-23
**Auditeur** : Claude (session opérateur @automecanik.seo@gmail.com)
**Worktree** : `.claude/worktrees/diagnostic-reality-audit/`
**Branche** : `audit/diagnostic-engine-reality-2026-05-23`
**Plan parent** : `/home/deploy/.claude/plans/utiliser-superpower-et-verifier-precious-pebble.md`

---

## Verdict empirique

**`PIVOT`** — moteur opérationnel, EvidencePack riche, MAIS deux findings à adresser avant/pendant V1A.0.

| Critère | Score | Détail |
|---|---|---|
| Moteur opérationnel | ✅ | 113 sessions persistées, orchestrator validé Zod, 6 engines wirés |
| EvidencePack complet | ✅ | `diagnostic_confidence`, `risk_level`, `catalog_guard`, `maintenance_links`, `ui_block_inputs` déjà partitionnés par panel UI |
| Couverture data baseline | ⚠️ | 13 systèmes / 62 symptômes / 58 causes / 162 links — petit mais représentatif des domaines majeurs |
| Commerce hook | ⚠️ | `CAUSE_GAMME_MAP` TS hardcoded mappe causes → `pg_id`. **Finding #2 : 1 mismatch détecté** |
| RAG usage matrix | ⚠️ | `RagEnrichmentEngine` présent dans orchestrator (legacy). **Finding #1 : à neutraliser V1A.0** per doctrine RAG=chatbot only |
| Vehicle adoption | ✅ | 97% sessions historiques avec `vehicle_context` peuplé |
| Trafic réel | ❌ | Mars 91 sessions (burst MVP) → Avr 12 → Mai 10. Quasi pas de trafic = exactement le gap V1A.0 vise à combler |

---

## A1 — Inventaire moteur (registry-first)

Source : `audit/registry/canonical.json` query domain diagnostic.

### Structure module `backend/src/modules/diagnostic-engine/`

```
diagnostic-engine.controller.ts            → REST API (POST /analyze, /breakdown, GET /systems, /symptoms, /sessions, /stats, /wizard-steps, /signs, /faq, /maintenance-schedule, /calendar, /maintenance-alerts)
diagnostic-engine.orchestrator.ts          → Pipeline 8 étapes (signal → scoring → risk → catalog → maintenance → RAG → assemble + KG shadow)
diagnostic-engine.data-service.ts          → Supabase queries (systems, symptoms, scoredLinks, safetyRules, sessions)
diagnostic-engine.module.ts                → NestJS DI wiring

engines/
  signal-interpretation.engine.ts          → résout signaux primaire+secondaires → resolved_symptom_slugs + signal_quality
  hypothesis-scoring.engine.ts             → scoring 6 axes (signal_match, vehicle_fit, lifecycle_fit, maintenance_history, plausibility, context)
  risk-safety.engine.ts                    → safety rules + safety_alert + risk_level + requires_immediate_action
  catalog-orientation.engine.ts            → ready_for_catalog + confidence_before_purchase + suggested_gammes + allowed_output_mode
  maintenance-intelligence.engine.ts       → maintenance_links + recommendations + preventive_schedule
  rag-enrichment.engine.ts                 → ⚠️ LEGACY (cf. Finding #1)

ports/
  commerce.port.ts                         → handoff to commerce
  editorial.port.ts                        → handoff to R3
  maintenance.port.ts                      → maintenance ops
  vehicle-context.port.ts                  → VehicleContext Option A (PR #606 JWS HS256)

services/
  diagnostic-content.service.ts            → contenu wiki submodule (wizard-steps, signs, FAQ, controles-mensuels)
  kg-shadow.service.ts                     → KG shadow compare (PR-E, fire-and-forget)
  maintenance-calculator.service.ts        → schedule / alerts / calendar fuel-aware (ADR-032 D2/D3/D7/D9)

types/
  diagnostic-input.schema.ts               → Zod input contract
  diagnostic-contract.schema.ts            → EvidencePack contract
  evidence-pack.schema.ts                  → output schema + RagFact type

constants/
  gamme-map.constants.ts                   → CAUSE_GAMME_MAP : cause_slug → [{slug, label, pg_id}] (61 entries)

validate-phase0.ts                         → event emissions (diagnostic_started, diagnostic_completed) — PR #676
vehicle-context-mapping.ts                 → pure helper input → VehicleContext payload
```

### Endpoints existants (confirmés)

```
POST /api/diagnostic-engine/analyze            → EvidencePack + session_id + persist vehicle_ctx JWS
POST /api/diagnostic-engine/breakdown          → force intent_type='breakdown', délègue à analyze
GET  /api/diagnostic-engine/systems            → liste systems (13)
GET  /api/diagnostic-engine/symptoms?system=X  → symptoms par système
GET  /api/diagnostic-engine/sessions           → liste recent (≤50)
GET  /api/diagnostic-engine/sessions/:id       → session par UUID
GET  /api/diagnostic-engine/stats              → dashboard stats
GET  /api/diagnostic-engine/wizard-steps       → contenu wizard (wiki submodule)
GET  /api/diagnostic-engine/safety-config      → config safety (wiki submodule)
GET  /api/diagnostic-engine/signs              → signs (wiki submodule)
GET  /api/diagnostic-engine/faq                → FAQ (wiki submodule)
GET  /api/diagnostic-engine/controles-mensuels → contrôles mensuels (wiki submodule)
GET  /api/diagnostic-engine/maintenance-schedule
GET  /api/diagnostic-engine/maintenance-alerts
GET  /api/diagnostic-engine/calendar           → endpoint agrégé (ADR-032 D9)
```

### Pipeline orchestrator (`diagnostic-engine.orchestrator.ts:48-180`)

1. Validate input (Zod safeParse)
2. Signal interpretation
3. Fetch scoredLinks + safetyRules from DB
4. Hypothesis scoring (multi-axes)
5. Risk safety assessment
6. Catalog orientation
7. Maintenance intelligence
7b. Enrich gammes with cost ranges
8. **RAG enrichment** ⚠️ (Finding #1)
9. Assemble EvidencePack
9b. KG shadow compare (fire-and-forget)
10. Save session

### EvidencePack fields produits (déjà partitionnés par panel UI)

- `diagnostic_confidence` (0-100, calculé depuis topScore × signalQuality × evidenceCount)
- `factual_inputs_confirmed[]`, `factual_inputs_missing[]`
- `system_suspects[]`
- `candidate_hypotheses[]` avec `urgency`, `urgency_timeline`, `scoring_breakdown` 6-axes
- `maintenance_links[]`, `maintenance_recommendations`, `preventive_schedule`
- `risk_flags[]`, `safety_alert`, `risk_level` ∈ {critique, haute, moyenne, basse}
- `catalog_guard.{ready_for_catalog, confidence_before_purchase, allowed_output_mode, suggested_gammes}`
- `rag_facts[]?` ⚠️ optionnel — Finding #1
- `allowed_claims[]`, `forbidden_claims_runtime[]`
- `ui_block_inputs.{VehicleContextCard, SignalSummary, HypothesisCards, RiskPanel, MaintenancePanel, CatalogOrientationBox}`

**Implication V1A.0** : Intent Classifier peut dériver intent directement depuis ces champs canoniques (`risk_level + catalog_guard.ready_for_catalog + maintenance_links + diagnostic_confidence`). **Aucune nouvelle inférence métier requise** — c'est de la composition pure.

---

## A2 — Inventaire data Supabase (`__diag_*` schema)

| Table | Rows | Rôle |
|---|---|---|
| `__diag_system` | 13 | systèmes diagnostic (freinage, refroidissement, demarrage_charge, suspension, injection, embrayage, distribution, climatisation, direction, echappement, filtration, eclairage, transmission) |
| `__diag_symptom` | 62 | symptômes par système (4-7 par système, distribué) |
| `__diag_cause` | 58 | causes avec `cause_type`, `urgency`, `verification_method`, `plausible_km_min/max`, `plausible_age_min/max`, `workshop_priority` |
| `__diag_symptom_cause_link` | 162 | scoring symptôme→cause (lien multi-axes) |
| `__diag_safety_rule` | 21 | règles safety (urgency gates) |
| `__diag_session` | 113 | sessions historiques (Mars 91, Avr 12, Mai 10) |

### Distribution systèmes (top à bottom)

| Slug | Label | Symptoms |
|---|---|---|
| demarrage_charge | Démarrage et circuit de charge | 7 |
| suspension | Suspension et amortisseurs | 6 |
| refroidissement | Système de refroidissement | 6 |
| injection | Injection et alimentation | 5 |
| freinage | Système de freinage | 5 |
| embrayage | Système d'embrayage | 5 |
| distribution | Système de distribution | 4 |
| climatisation | Climatisation | 4 |
| direction | Direction | 4 |
| echappement | Échappement et catalyseur | 4 |
| filtration | Filtration | 4 |
| eclairage | Éclairage et signalisation | 4 |
| transmission | Transmission et boîte de vitesses | 4 |

**Coverage gammes top-commerce** (cf. doc séparée `2026-05-23-vehicle-coverage-prioritization.md`) : couverture diagnostique présente sur freinage / embrayage / distribution / alternateur — qui sont les pg_ids vendus en commande historique.

**Activité sessions** :

| Mois | Sessions | Avec vehicle_ctx | Systèmes distincts |
|---|---|---|---|
| 2026-03 | 91 | 88 (97%) | 13 |
| 2026-04 | 12 | 12 (100%) | 9 |
| 2026-05 | 10 | 10 (100%) | 7 |

Forte adoption `vehicle_context` (97-100%) mais **trafic réel très faible** post-MVP burst. Le gap V1A.0 vise à transformer R5 traffic SEO en sessions diagnostic.

---

## A2bis — Commerce hook : `CAUSE_GAMME_MAP` (TS hardcoded)

Source : `backend/src/modules/diagnostic-engine/constants/gamme-map.constants.ts` (262 lignes).

**Structure** : `Record<cause_slug, [{slug, label, pg_id}]>` — 61 entrées dont :
- 10 entrées avec mapping pg_id non-vide observé (mais le grep est partial — beaucoup d'entrées sur multiline ne sont pas comptées)
- 5 entrées explicites `[]` documentées "pas de gamme standard"

**Cross-référence pg_id ↔ `pieces_gamme` table** (échantillon) :

| pg_id | CAUSE_GAMME_MAP label | pieces_gamme.pg_name | Statut |
|---|---|---|---|
| 1 | Batterie | Batterie | ✅ exact |
| 2 | Démarreur | Démarreur | ✅ exact |
| 4 | Alternateur | Alternateur | ✅ exact |
| 78 | Étrier de frein | Étrier de frein | ✅ exact |
| 82 | Disque de frein | Disque de frein | ✅ exact |
| 193 | Soufflet de Cardan | Soufflet de Cardan | ✅ exact |
| 243 | Bougie de préchauffage | Bougie de préchauffage | ✅ exact |
| 259 | Feu avant | Feu avant | ✅ exact |
| 290 | Feu arrière | Feu arrière | ✅ exact |
| 312 | (non-mappé direct) | Galet enrouleur de courroie d'accessoire | n/a |
| 321 | (non-mappé direct) | Joint de cache culbuteurs | n/a |
| 402 | Plaquette de frein | Plaquette de frein | ✅ exact |
| **479** | **Liquide de frein** ❌ | **Kit d'embrayage** ❌ | **MISMATCH (Finding #2)** |
| 1457 | Ampoule | Ampoule | ✅ exact |

**Bon niveau de fidélité globale (~93% sur échantillon de 14)**. Une erreur identifiée à corriger.

---

## Findings — à adresser

### Finding #1 — `RagEnrichmentEngine` legacy dans l'orchestrator

**Localisation** : `diagnostic-engine.orchestrator.ts:120-125`

```typescript
// ── 8. RAG Enrichment Engine (graceful degradation) ─
const ragFacts = await this.ragEngine.enrich(
  input.system_scope,
  signal.resolved_symptom_slugs,
  hypotheses,
);
```

**Détail** : `RagEnrichmentEngine` injecte `RagProxyService` (`@Optional()`) et appelle `ragService.search()` avec `target_role: 'R5_DIAGNOSTIC'`, truth_levels L1/L2, dedupe + cap 10 facts. Si service absent → return `[]`. Si erreur → log + return `[]`. Les `rag_facts` sont injectés dans `EvidencePack.rag_facts?`.

**Conflit doctrine** : `feedback_no_rag_for_content_legacy_code_is_not_strategy` strict — "RAG = chatbot UNIQUEMENT (retrieval), JAMAIS source de données contenu/SEO. Code legacy présent (enrichers RAG) ≠ stratégie."

**Décision V1A.0** : Intent Classifier ne lira **jamais** `evidence_pack.rag_facts`. Le moteur peut continuer à produire ce champ (rétro-compat), mais :
- L'Intent layer V1A.0 dérive intent depuis `risk_level + catalog_guard + maintenance_links + diagnostic_confidence` uniquement
- Recommandation V1.1+ : retirer l'appel `ragEngine.enrich()` du pipeline (ou guard derrière feature flag `DIAGNOSTIC_RAG_ENRICHMENT_ENABLED=false` par défaut)
- ADR vault V1A.0 ADR-1 "Intent Resolution V1 doctrine" doit explicitement statuer "Intent layer N'utilise PAS rag_facts"

### Finding #2 — `CAUSE_GAMME_MAP` mismatch `brake_fluid_low → 479`

**Localisation** : `gamme-map.constants.ts`

```typescript
brake_fluid_low: [
  { slug: 'liquide-de-frein', label: 'Liquide de frein', pg_id: 479 },
],
```

**Réalité DB** :
- `pg_id 479` dans `pieces_gamme` = **Kit d'embrayage** (alias `kit-d-embrayage`)
- `pg_id 71` = **Liquide de frein** (alias `liquide-de-frein`)

**Impact** : si user diagnostiqué "liquide de frein bas" clique CTA pièce → routé vers /pieces/{slug-bad}/479 = "Kit d'embrayage" au lieu de "Liquide de frein". UX brisée + commerce mismatch.

**Décision V1A.0** : fix `pg_id: 479 → 71` dans `gamme-map.constants.ts`, hors scope changement contract (1 ligne, déterministe, validable manuellement). Peut être fait en hotfix séparé OU intégré au PR V1A.0.

**Action golden** : ajouter case golden bucket `maintenance` ou `flou` testant `brake_fluid_low` avec `expected_pg_id_in_suggested: 71` (post-fix) pour empêcher régression.

---

## Implications pour V1A.0

### Architecture confirmée minimale

L'EvidencePack actuel **suffit** pour V1A.0 — pas besoin de nouvelle data structurelle backend. Intent Classifier = pure composition rule-based sur les fields :

- `risk_level ∈ {critique, haute}` → `intent: 'urgence'` (reason `DR_INTENT_SAFETY_URGENCY_CRITICAL` / `_IMMINENT`)
- `maintenance_links[].length > 0` + maintenance overdue → `intent: 'maintenance'` (reason `DR_INTENT_MAINTENANCE_FLAG_TRUE`)
- `catalog_guard.ready_for_catalog = true` + `confidence_before_purchase ∈ {medium, high}` + single suggested_gamme → `intent: 'commerce'` (reason `DR_INTENT_HIGH_CONFIDENCE_COMMERCE`)
- `diagnostic_confidence < 50` OR `signal_quality = 'low'` → `intent: 'education'` (reason `DR_INTENT_HYPOTHESIS_CONFIDENCE_LOW`)
- `risk_level = 'basse'` + symptome bénin connu → `intent: 'reassurance'` (reason `DR_INTENT_SAFETY_URGENCY_LOW_BENIGN`)
- `vehicle_context = {}` → `safety_rail = true` (reason `DR_SAFETY_VEHICLE_CONTEXT_MISSING`)
- `catalog_guard.allowed_output_mode = 'none'` OR contradictory signals → `safety_rail = true`

### Data pipeline scrape→raw→wiki (V1.1)

**Pas de tables `__pg_symptoms` / `__pg_breakdowns` / `__pg_maintenance_intervals`** — diagnostic data vit dans `__diag_*` curé manuellement. Le wiki submodule (`backend/content/automecanik-wiki/wiki/diagnostic/`) couvre déjà wizard-steps / signs / FAQ / controles-mensuels.

**V1.1 Data Enrichment Pipeline** ciblera donc :
- Extension `__diag_*` tables avec data scrapée (raw → wiki → DB)
- Plus de symptômes par gamme commerce-relevant (Block A2bis priorisation = freinage, embrayage, distribution, alternateur, vidange)
- Élargissement `CAUSE_GAMME_MAP` aux 61 → ~150 entrées avec coverage pg_ids vendus

### Tests + Golden dataset

Le golden dataset `diagnostic-engine-golden-v1.json` contient 10 seed cases (2 par bucket). Coverage gate V1A.0 = ≥10 cases actifs par bucket via human review → **20 cases supplémentaires nécessaires avant ship V1A.0**.

Méthode extension :
1. Validators (domain_owner + ≥1 autre) exécutent wizard sur PREPROD (49.12.233.2:3200 — accès SSH ops)
2. Score chaque cas sur rubric 3-critères (intent / gamme / urgency, 1-5)
3. Append au golden si moyenne ≥ 3.5/5
4. Re-run CI golden regression = 100% pass mandatory

---

## Décisions sortantes (à intégrer V1A.0 plan)

| Décision | Action | Owner |
|---|---|---|
| Verdict empirique **PIVOT** | Reality Audit retains Plan V1A.0 scope unchanged + 2 findings ajoutés | Domain owner |
| Finding #1 RAG legacy | ADR vault V1A.0 doctrine statue "Intent layer ne consomme JAMAIS rag_facts" + recommandation V1.1+ neutralisation | ADR Intent Resolution V1 |
| Finding #2 gamme map | Fix `brake_fluid_low → pg_id 71` dans hotfix séparé OU intégré PR V1A.0 (1 ligne) | V1A.0 PR ou hotfix |
| Golden seed 10 → 50 | Coverage gate V1A.0 = ≥10 actifs/bucket. Validators étendent via PREPROD + rubric scoring | Validators |
| `__pg_*` tables hypothétiques V1.1 | Renoncer — étendre `__diag_*` existant + wiki submodule | V1.1 Data Pipeline |
| CAUSE_GAMME_MAP audit complet | Cross-référencer les ~50 entrées restantes contre `pieces_gamme` (script à ajouter à `scripts/audit/`) | V1A.0 PR side-task |

---

## Annexes

- Plan parent : `/home/deploy/.claude/plans/utiliser-superpower-et-verifier-precious-pebble.md`
- Golden dataset : `backend/src/modules/diagnostic-engine/__tests__/golden/diagnostic-engine-golden-v1.json`
- Failure category enum : `backend/src/modules/diagnostic-engine/types/diagnostic-failure-category.ts`
- Vehicle coverage prioritization : `docs/superpowers/specs/2026-05-23-vehicle-coverage-prioritization.md`

## Mémoires Claude liées

- `feedback_no_rag_for_content_legacy_code_is_not_strategy` (Finding #1 doctrine)
- `feedback_seo_content_pipeline_scrape_raw_wiki_kw` (Data pipeline V1.1)
- `project_diagnostic_control_plane_v1_plan` (gates V1→V1.5)
- `feedback_vehicle_context_option_a_locked` (VehicleContext schema v:1)
- `deployment_topology_canonical` (PREPROD 49.12.233.2:3200 test target)
