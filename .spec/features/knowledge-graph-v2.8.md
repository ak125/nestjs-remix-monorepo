---
title: "Knowledge Graph v2.8 - Diagnostic Automobile"
status: planning
version: 2.8.12
authors: [Tech Team]
created: 2025-12-30
updated: 2025-12-31
relates-to:
  - ./ai-cos-operating-system.md
  - ../architecture/ai-cos-enrichment-plan.md
tags: [knowledge-graph, diagnostic, automotive, reasoning-engine]
priority: high
coverage:
  modules: [knowledge-graph]
  routes: [/api/knowledge-graph/*]
---

# Knowledge Graph v2.8 - Roadmap Complète

## Vue d'ensemble

Le Knowledge Graph est le moteur de diagnostic automobile intelligent d'Automecanik. Il utilise une architecture graphe pour relier symptômes (Observables), pannes (Faults) et pièces avec un raisonnement multi-symptômes.

**Objectifs:**
- Diagnostic précis basé sur symptômes utilisateur
- Conversion diagnostic → vente de pièces
- Apprentissage continu via feedback
- Contenu SEO auto-généré

## Approche MVP+ (5 versions prioritaires)

**Stratégie validée** : 80% de valeur pour 40% d'effort

```
         MVP (Priorité)                          Phase 2+3 (Différé)
    ┌─────────────────────┐              ┌──────────────────────────────┐
    │ v2.8.0 ✅ (Base)    │              │ v2.8.1  Taxonomies           │
    │ v2.8.3 🎯 (Safety)  │              │ v2.8.2  Double Score         │
    │ v2.8.4 🎯 (DTC)     │              │ v2.8.5  Case-Based Reasoning │
    │ v2.8.6 🎯 (Fitment) │              │ v2.8.7  Risk Curve           │
    │ v2.8.9 🎯 (XAI/SEO) │              │ v2.8.8  Data Governance      │
    └─────────────────────┘              │ v2.8.10 Root Cause           │
                                         │ v2.8.11 Structured Actions   │
                                         │ v2.8.12 Model Recurring      │
                                         └──────────────────────────────┘
```

### MVP - Versions Prioritaires

| Version | Feature | Phase | Statut | Raison Priorité |
|---------|---------|-------|--------|-----------------|
| **v2.8.0** | Module KG + Reasoning Engine | MVP | ✅ Terminé | Base fonctionnelle |
| **v2.8.3** | Gate Safety | MVP | 🎯 Priorité | Protection légale (pannes critiques) |
| **v2.8.4** | Observable Types/DTC | MVP | 🎯 Priorité | Précision +35% (codes OBD-II) |
| **v2.8.6** | Part Fitment | MVP | 🎯 Priorité | Monétisation directe (diagnostic→vente) |
| **v2.8.9** | Explainable Output | MVP | 🎯 Priorité | SEO + confiance utilisateur |

### Versions Différées (Phase 2/3)

| Version | Feature | Phase | Statut | Raison Report |
|---------|---------|-------|--------|---------------|
| v2.8.1 | Taxonomies Contrôlées | Phase 2 | ⏸️ Différé | Nice-to-have, amélioration incrémentale |
| v2.8.2 | Double Score | Phase 2 | ⏸️ Différé | Amélioration Prob/Conf, pas critique |
| v2.8.5 | Case-Based Reasoning | Phase 2 | ⏸️ Différé | Nécessite volume données utilisateurs |
| v2.8.7 | Risk Curve | Phase 3 | ⏸️ Différé | Email marketing prédictif futur |
| v2.8.8 | Data Governance | Phase 3 | ⏸️ Différé | Workflow interne, pas client-facing |
| v2.8.10 | Root Cause Hierarchy | Phase 3 | ⏸️ Différé | Complexité élevée, valeur incrémentale |
| v2.8.11 | Structured Actions | Phase 3 | ⏸️ Différé | Contenu intensif à créer |
| v2.8.12 | Model Recurring Faults | Phase 3 | ⏸️ Différé | Données moteurs spécialisées requises |

### Justification MVP+

| Critère | 13 versions | MVP+ (5 versions) |
|---------|-------------|-------------------|
| **Effort** | 100% | 40% |
| **Valeur livrée** | 100% | 80% |
| **Time-to-Market** | 12+ mois | 4-5 mois |
| **Risque** | Élevé (scope creep) | Faible (focus) |
| **ROI rapide** | Différé | Immédiat |

---

# Stratégie #1: Module KG Base (v2.8.0) ✅

## Statut: Terminé

Module Knowledge Graph de base avec:
- Tables `kg_nodes` et `kg_edges`
- Types de nodes: Observable, Fault, Part, System
- Types de relations: CAUSES, INDICATES, REQUIRES, RELATED_TO
- Endpoint `/diagnose` avec raisonnement multi-symptômes

## Structure actuelle

```
backend/src/modules/knowledge-graph/
├── index.ts
├── kg.types.ts
├── kg-data.service.ts
├── kg.service.ts
├── kg.controller.ts
└── knowledge-graph.module.ts
```

---

# Stratégie #2: Taxonomies Contrôlées (v2.8.1)

## Approche: Colonnes directes + CHECK constraints

```sql
ALTER TABLE kg_nodes ADD COLUMN tax_phase TEXT CHECK (tax_phase IN ('freinage', 'acceleration', 'ralenti', 'virage', 'demarrage', 'constant'));
ALTER TABLE kg_nodes ADD COLUMN tax_temp TEXT CHECK (tax_temp IN ('froid', 'chaud', 'any'));
ALTER TABLE kg_nodes ADD COLUMN tax_freq TEXT CHECK (tax_freq IN ('intermittent', 'permanent'));
ALTER TABLE kg_nodes ADD COLUMN tax_intensity TEXT CHECK (tax_intensity IN ('faible', 'moyen', 'fort'));
ALTER TABLE kg_nodes ADD COLUMN tax_risk TEXT CHECK (tax_risk IN ('securite', 'panne_simple', 'confort'));
ALTER TABLE kg_nodes ADD COLUMN tax_localisation TEXT CHECK (tax_localisation IN ('avant', 'arriere', 'lateral', 'moteur', 'habitacle'));
ALTER TABLE kg_nodes ADD COLUMN tax_cote TEXT CHECK (tax_cote IN ('gauche', 'droite', 'central', 'bilateral'));

CREATE INDEX idx_kg_nodes_tax_phase ON kg_nodes(tax_phase) WHERE tax_phase IS NOT NULL;
CREATE INDEX idx_kg_nodes_tax_risk ON kg_nodes(tax_risk) WHERE tax_risk IS NOT NULL;
```

## Fichiers à modifier

| Fichier | Action |
|---------|--------|
| `20251231_kg_taxonomy.sql` | ALTER TABLE kg_nodes + CHECK constraints |
| `kg.types.ts` | Ajouter types enum pour taxonomies |
| `kg-data.service.ts` | Supporter filtres taxonomies |
| `kg.controller.ts` | Endpoint GET /nodes?tax_phase=freinage |

---

# Stratégie #3: Double Score — Probability + Confidence (v2.8.2)

## Concept

| Score | Mesure | Type d'incertitude |
|-------|--------|-------------------|
| **Probability** | Probabilité que la panne soit la cause | Aléatoire (inhérente) |
| **Confidence** | Qualité/fiabilité de l'analyse | Épistémique (manque données) |

## Interface

```typescript
interface DiagnosisResult {
  fault: KgNode;
  probability: number;      // 0-100%
  confidence: number;       // 0-100%
  missing_data?: string[];  // Infos manquantes
  reasoning: string;
}
```

## Calcul Confidence

```sql
confidence_score = base_confidence
  + (observables_fournis / observables_requis) * 30
  + (coherence_check ? 20 : 0)
  + (taxonomies_matched ? 15 : 0)
  + (vehicle_history ? 10 : 0)
```

---

# Stratégie #4: Gate Safety — Sécurité Routière (v2.8.3)

## SQL

```sql
ALTER TABLE kg_nodes
  ADD COLUMN safety_level TEXT CHECK (safety_level IN (
    'critical',    -- Arrêt immédiat obligatoire
    'urgent',      -- Contrôle dans 24h
    'warning',     -- Contrôle recommandé
    'normal'       -- Maintenance standard
  )) DEFAULT 'normal';

CREATE INDEX idx_kg_nodes_safety ON kg_nodes(safety_level)
  WHERE safety_level IN ('critical', 'urgent');
```

## Comportement UX

| Safety Level | Affichage | Vente | Actions |
|--------------|-----------|-------|---------|
| `critical` | Alerte rouge plein écran | ❌ Désactivée | Dépannage, Urgences |
| `urgent` | Bandeau orange | ⚠️ Avertissement | RDV garage urgent |
| `warning` | Info jaune | ✅ Normale | Conseils entretien |
| `normal` | Standard | ✅ Normale | Catalogue pièces |

---

# Stratégie #5: Observable Types — Symptom/Sign/DTC (v2.8.4)

## Types

| Type | Nature | Fiabilité | Exemple |
|------|--------|-----------|---------|
| **Symptom** | Ressenti subjectif | 60% | "La voiture tire à droite" |
| **Sign** | Observable objectif | 80% | "Fumée noire à l'échappement" |
| **DTC** | Code OBD standardisé | 95% | "P0171 - Mélange trop pauvre" |

## SQL

```sql
ALTER TABLE kg_nodes
  ADD COLUMN observable_type TEXT CHECK (observable_type IN ('symptom', 'sign', 'dtc'));

ALTER TABLE kg_nodes
  ADD CONSTRAINT check_dtc_format
  CHECK (observable_type != 'dtc' OR node_label ~ '^[PBCU][0-9]{4}');
```

## Scoring pondéré

```typescript
const OBSERVABLE_WEIGHT = {
  symptom: 0.6,
  sign: 0.8,
  dtc: 0.95
};
```

---

# Stratégie #6: Case-Based Reasoning (v2.8.5)

## Concept

Chaque diagnostic devient un "cas" qui peut être confirmé ou infirmé. Le système apprend des résultats réels.

## Tables SQL

```sql
CREATE TABLE kg_cases (
  case_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_id UUID,
  vehicle_type_id INTEGER,
  vehicle_mileage INTEGER,
  observables JSONB,
  predicted_fault_id UUID REFERENCES kg_nodes(node_id),
  predicted_probability DECIMAL(5,2),
  predicted_confidence DECIMAL(5,2),
  outcome TEXT CHECK (outcome IN ('confirmed', 'partial', 'incorrect', 'pending')) DEFAULT 'pending',
  verification_method TEXT CHECK (verification_method IN ('purchase', 'invoice', 'feedback', 'return', 'auto')),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE kg_learned_patterns (
  pattern_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_category TEXT,
  observable_signature TEXT[],
  fault_id UUID REFERENCES kg_nodes(node_id),
  occurrence_count INTEGER DEFAULT 1,
  confirmation_rate DECIMAL(5,2),
  avg_mileage_range INT4RANGE,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vehicle_category, observable_signature, fault_id)
);
```

## ROI

| Métrique | Avant CBR | Après CBR (6 mois) |
|----------|-----------|-------------------|
| Précision diagnostic | 70% | 85%+ |
| Taux de retour | 8% | 4% |
| Données propriétaires | 0 | 10k+ cas confirmés |

---

# Stratégie #7: Part Fitment — Monétisation (v2.8.6)

## Concept

Du diagnostic à la vente en 1 clic.

## SQL

```sql
CREATE TABLE kg_fault_parts (
  fault_part_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fault_node_id UUID REFERENCES kg_nodes(node_id),
  gamme_id INTEGER REFERENCES pieces_gamme(pg_id),
  priority INTEGER DEFAULT 1,
  is_required BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## ROI

| Métrique | Sans Fitment | Avec Fitment |
|----------|--------------|--------------|
| Taux de conversion | 5% | 25-35% |
| Panier moyen | 45€ | 120€+ |
| Taux de retour | 8% | 2% |

---

# Stratégie #8: Risk Curve — Entretien Prédictif (v2.8.7)

## Concept

Courbe de risque progressive basée sur le kilométrage.

## SQL

```sql
CREATE TABLE kg_risk_curves (
  curve_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_category TEXT NOT NULL,
  vehicle_category TEXT,
  engine_type TEXT,
  risk_points JSONB NOT NULL DEFAULT '[]',
  source TEXT,
  confidence DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Interface

```typescript
interface RiskPoint {
  km: number;
  risk: number;       // 0.0 - 1.0
  label?: string;
}

interface RiskAssessment {
  part_category: string;
  current_km: number;
  risk_level: number;
  risk_label: string;
  next_threshold_km: number;
  recommendation: string;
  urgency: 'none' | 'low' | 'medium' | 'high' | 'critical';
}
```

---

# Stratégie #9: Data Governance (v2.8.8)

## Workflow

```
DRAFT → REVIEW → ACTIVE → DEPRECATED
```

## SQL

```sql
ALTER TABLE kg_nodes
  ADD COLUMN status TEXT CHECK (status IN ('draft', 'review', 'active', 'deprecated')) DEFAULT 'draft',
  ADD COLUMN version INTEGER DEFAULT 1,
  ADD COLUMN source TEXT CHECK (source IN ('expert', 'ai_generated', 'imported', 'cbr_learned', 'user_feedback')),
  ADD COLUMN source_ref TEXT,
  ADD COLUMN reviewed_by TEXT,
  ADD COLUMN reviewed_at TIMESTAMPTZ,
  ADD COLUMN previous_version_id UUID REFERENCES kg_nodes(node_id);

CREATE TABLE kg_audit_log (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('node', 'edge')),
  entity_id UUID NOT NULL,
  action TEXT CHECK (action IN ('create', 'update', 'status_change', 'delete', 'restore')),
  old_data JSONB,
  new_data JSONB,
  user_id TEXT,
  user_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

# Stratégie #10: Explainable Output (v2.8.9)

## Structure

```typescript
interface ExplainableOutput {
  reasoning: {
    matched_observables: string[];
    context_factors: string[];
    confidence_factors: { factor: string; contribution: number }[];
    chain_of_evidence: string;
  };
  verification: {
    quick_test: string;
    visual_check?: string;
    tool_required?: string;
    estimated_time: string;
    difficulty: 'facile' | 'moyen' | 'expert';
  };
  urgency: {
    level: 'immediate' | 'soon' | 'planned' | 'optional';
    label: string;
    reason: string;
    can_drive: boolean;
    max_km_before_repair?: number;
  };
  parts_involved: {
    primary: PartSuggestion;
    secondary?: PartSuggestion[];
    diy_feasibility: 'facile' | 'moyen' | 'garage';
  };
  formatted_output: {
    summary: string;
    detailed_html: string;
    faq_compatible: FAQEntry[];
  };
}
```

## SQL

```sql
CREATE TABLE kg_verification_templates (
  template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fault_node_id UUID REFERENCES kg_nodes(node_id),
  quick_test TEXT NOT NULL,
  visual_check TEXT,
  tool_required TEXT,
  estimated_time TEXT DEFAULT '5 minutes',
  difficulty TEXT CHECK (difficulty IN ('facile', 'moyen', 'expert')) DEFAULT 'moyen',
  default_urgency TEXT CHECK (default_urgency IN ('immediate', 'soon', 'planned', 'optional')) DEFAULT 'planned',
  can_drive_default BOOLEAN DEFAULT true,
  max_km_default INTEGER,
  diy_feasibility TEXT CHECK (diy_feasibility IN ('facile', 'moyen', 'garage')) DEFAULT 'garage',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

# Stratégie #11: Root Cause Hierarchy (v2.8.10)

## Concept

`Fault Family → Fault → Root Cause` avec conseils de prévention.

```
FREINAGE ───────┬─── Disque voilé ────┬─── Surchauffe
                │                      ├─── Mauvais montage
                │                      └─── Qualité pièce
                │
                ├─── Plaquettes usées ─┬─── Usure normale
                │                      └─── Conduite sport
                │
                └─── Étrier grippé ────┬─── Corrosion
                                       └─── Manque purge
```

## SQL

```sql
CREATE TABLE kg_fault_families (
  family_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code TEXT UNIQUE NOT NULL,
  family_label TEXT NOT NULL,
  family_icon TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE kg_root_causes (
  root_cause_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  root_cause_code TEXT UNIQUE NOT NULL,
  root_cause_label TEXT NOT NULL,
  description TEXT,
  prevention_tips TEXT[],
  cause_type TEXT CHECK (cause_type IN (
    'usure_normale', 'usage', 'entretien', 'qualite_piece', 'montage', 'environnement', 'conception'
  )),
  is_preventable BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE kg_fault_root_causes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fault_node_id UUID REFERENCES kg_nodes(node_id),
  root_cause_id UUID REFERENCES kg_root_causes(root_cause_id),
  probability DECIMAL(3,2) DEFAULT 0.5,
  context_boost JSONB,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fault_node_id, root_cause_id)
);

ALTER TABLE kg_nodes ADD COLUMN fault_family_id UUID REFERENCES kg_fault_families(family_id);
```

## Interface

```typescript
interface FaultFamily {
  family_id: string;
  family_code: string;
  family_label: string;
  family_icon?: string;
}

interface RootCause {
  root_cause_id: string;
  root_cause_code: string;
  root_cause_label: string;
  description?: string;
  prevention_tips?: string[];
  cause_type: 'usure_normale' | 'usage' | 'entretien' | 'qualite_piece' | 'montage' | 'environnement' | 'conception';
  is_preventable: boolean;
}

interface DiagnosisWithRootCauses extends DiagnosisResult {
  fault_family: FaultFamily;
  root_causes: {
    cause: RootCause;
    probability: number;
    explanation: string;
  }[];
  prevention_advice: string[];
}
```

## Fichiers à créer

| Fichier | Action |
|---------|--------|
| `20251231_kg_root_causes.sql` | Tables kg_fault_families, kg_root_causes, kg_fault_root_causes |
| `kg.types.ts` | Interfaces FaultFamily, RootCause, FaultRootCauseLink |
| `kg-root-cause.service.ts` | Nouveau service pour root causes |
| `kg.controller.ts` | Endpoint `/faults/:id/root-causes` |

---

# Stratégie #12: Structured Actions (v2.8.11)

## Concept

Actions réutilisables : type, durée, outils, étapes, coût MO.

## SQL

```sql
CREATE TABLE kg_actions (
  action_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_code TEXT UNIQUE NOT NULL,
  action_label TEXT NOT NULL,
  action_type TEXT CHECK (action_type IN (
    'controle', 'remplacement', 'nettoyage', 'reglage', 'reparation', 'diagnostic_pro', 'test_routier'
  )) NOT NULL,
  duree_estimee TEXT,
  duree_minutes INTEGER,
  difficulty TEXT CHECK (difficulty IN ('debutant', 'amateur', 'experimente', 'professionnel')) DEFAULT 'professionnel',
  urgency TEXT CHECK (urgency IN ('securite', 'haute', 'normale', 'basse')) DEFAULT 'normale',
  prerequisites JSONB DEFAULT '[]',
  tools_required JSONB DEFAULT '[]',
  steps JSONB DEFAULT '[]',
  labor_cost_min DECIMAL(8,2),
  labor_cost_max DECIMAL(8,2),
  warnings TEXT[],
  seo_title TEXT,
  seo_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE kg_fault_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fault_node_id UUID REFERENCES kg_nodes(node_id),
  action_id UUID REFERENCES kg_actions(action_id),
  execution_order INTEGER DEFAULT 1,
  is_mandatory BOOLEAN DEFAULT true,
  condition TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fault_node_id, action_id)
);
```

## Interface

```typescript
type ActionType = 'controle' | 'remplacement' | 'nettoyage' | 'reglage' | 'reparation' | 'diagnostic_pro' | 'test_routier';

interface ActionStep {
  order: number;
  description: string;
  tip?: string;
  warning?: string;
  image_url?: string;
}

interface StructuredAction {
  action_id: string;
  action_code: string;
  action_label: string;
  action_type: ActionType;
  duree_estimee?: string;
  duree_minutes?: number;
  difficulty: 'debutant' | 'amateur' | 'experimente' | 'professionnel';
  urgency: 'securite' | 'haute' | 'normale' | 'basse';
  prerequisites?: string[];
  tools_required?: string[];
  steps?: ActionStep[];
  warnings?: string[];
  labor_cost_range?: { min: number; max: number };
}

interface DiagnosisWithActions extends DiagnosisResult {
  actions: FaultAction[];
  total_estimated_time: string;
  total_labor_cost_range: { min: number; max: number };
  diy_feasible: boolean;
}
```

## Fichiers à créer

| Fichier | Action |
|---------|--------|
| `20251231_kg_actions.sql` | Tables kg_actions, kg_fault_actions |
| `kg.types.ts` | Interfaces StructuredAction, FaultAction, ActionStep |
| `kg-action.service.ts` | Nouveau service pour actions |
| `kg.controller.ts` | Endpoint `/faults/:id/actions` |

---

# Stratégie #13: Model Recurring Faults (v2.8.12)

## Concept

Pannes connues par modèle/moteur = boost de précision massif.

```
Moteur/Modèle          Panne Récurrente     Km Typique
─────────────          ───────────────      ──────────
PureTech 1.2      ───► Courroie humide      80-120k km
1.5 dCi (K9K)     ───► EGR encrassée        60-100k km
1.5 dCi (K9K)     ───► Injecteurs           100-150k km
TSI 1.4           ───► Bobines d'allumage   50-80k km
HDI 2.0           ───► FAP colmaté          80-120k km
THP 1.6           ───► Chaîne distribution  80-120k km
```

## SQL

```sql
CREATE TABLE kg_model_recurring_faults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_model_pattern TEXT NOT NULL,
  engine_pattern TEXT,
  year_range INT4RANGE,
  fault_node_id UUID REFERENCES kg_nodes(node_id),
  typical_km_range INT4RANGE,
  frequency_rate DECIMAL(3,2),
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  source TEXT CHECK (source IN ('manufacturer_recall', 'garage_feedback', 'forum_analysis', 'internal_stats', 'expert_knowledge')),
  source_ref TEXT,
  probability_boost DECIMAL(3,2) DEFAULT 0.20,
  confidence DECIMAL(3,2) DEFAULT 0.7,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kg_model_recurring_engine ON kg_model_recurring_faults(engine_pattern);
CREATE INDEX idx_kg_model_recurring_fault ON kg_model_recurring_faults(fault_node_id);
```

## Interface

```typescript
interface ModelRecurringFault {
  id: string;
  vehicle_model_pattern: string;
  engine_pattern?: string;
  year_range?: { start: number; end: number };
  fault_node_id: string;
  typical_km_range: { start: number; end: number };
  frequency_rate: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: 'manufacturer_recall' | 'garage_feedback' | 'forum_analysis' | 'internal_stats' | 'expert_knowledge';
  probability_boost: number;
  confidence: number;
}

interface DiagnosisWithModelBoost extends DiagnosisResult {
  model_factors?: {
    matched_patterns: ModelRecurringFault[];
    boost_applied: number;
    explanation: string;
  };
}
```

## Seed Data Exemples

```sql
INSERT INTO kg_model_recurring_faults (vehicle_model_pattern, engine_pattern, fault_node_id, typical_km_range, frequency_rate, source, probability_boost) VALUES
-- PSA PureTech
('Peugeot 308*', 'PureTech*', (SELECT node_id FROM kg_nodes WHERE node_label = 'Courroie distribution défaillante'), '[80000,120000]', 0.35, 'forum_analysis', 0.25),
-- Renault dCi
('%', '1.5 dCi*', (SELECT node_id FROM kg_nodes WHERE node_label = 'EGR encrassée'), '[60000,100000]', 0.42, 'garage_feedback', 0.30),
-- VAG TSI
('%', 'TSI*', (SELECT node_id FROM kg_nodes WHERE node_label = 'Bobine allumage défaillante'), '[50000,80000]', 0.25, 'forum_analysis', 0.20);
```

---

# Documentation Opérationnelle

## Migration Strategy

**Règle d'or:** Chaque version DOIT être déployée séquentiellement.

```
v2.8.0 (Base)
  └── 20251230_knowledge_graph.sql     ✅ Tables kg_nodes/edges
  └── 20251230_seed_knowledge_graph.sql ✅ Données initiales

v2.8.1 (Taxonomies)
  └── 20251231_kg_taxonomy.sql         📋 ALTER TABLE + CHECK

v2.8.3 (Safety Gate)
  └── 20251231_kg_safety.sql           📋 safety_level column

v2.8.4 (Observable Types)
  └── 20251231_kg_observable_types.sql 📋 observable_type + DTC

v2.8.5 (CBR)
  └── 20251231_kg_cases.sql            📋 kg_cases + patterns

v2.8.6 (Fitment)
  └── 20251231_kg_fitment.sql          📋 kg_fault_parts + RPC

v2.8.7 (Risk Curve)
  └── 20251231_kg_risk_curves.sql      📋 kg_risk_curves

v2.8.8 (Governance)
  └── 20251231_kg_governance.sql       📋 status, audit_log

v2.8.9 (Explainable)
  └── 20251231_kg_explainability.sql   📋 verification_templates

v2.8.10 (Root Cause)
  └── 20251231_kg_root_causes.sql      📋 fault_families, root_causes

v2.8.11 (Actions)
  └── 20251231_kg_actions.sql          📋 kg_actions, kg_fault_actions

v2.8.12 (Model Recurring)
  └── 20251231_kg_model_recurring.sql  📋 kg_model_recurring_faults
```

## Performance Targets (SLA)

| Endpoint | Target | Max | Notes |
|----------|--------|-----|-------|
| `POST /diagnose` | < 200ms | 500ms | Multi-symptômes, graph traversal |
| `POST /diagnose-explained` | < 400ms | 800ms | Inclut génération texte |
| `GET /nodes` | < 50ms | 100ms | Lecture simple |
| `GET /nodes/search` | < 100ms | 200ms | Full-text search |
| `GET /risk-profile/:id` | < 300ms | 600ms | Interpolation courbes |
| `GET /stats` | < 100ms | 200ms | Comptages agrégés |
| `GET /validate` | < 1s | 3s | Validation cohérence |

## Dépendances entre versions

```
v2.8.2 (Double Score) dépend de:
└── v2.8.1 (Taxonomies) - contexte améliore confidence

v2.8.5 (CBR) dépend de:
└── v2.8.2 (Double Score) - enregistre probability/confidence

v2.8.6 (Part Fitment) dépend de:
└── v2.8.0 (Module KG) - kg_nodes (Fault)

v2.8.9 (Explainable) dépend de:
├── v2.8.2 (Double Score) - facteurs de confiance
├── v2.8.3 (Gate Safety) - urgence contextuelle
└── v2.8.6 (Part Fitment) - pièces concernées

v2.8.10 (Root Cause) dépend de:
├── v2.8.0 (Module KG) - kg_nodes existants
└── v2.8.8 (Governance) - versioning des root causes

v2.8.11 (Structured Actions) dépend de:
├── v2.8.9 (Explainable) - intégration dans explanation
└── v2.8.10 (Root Cause) - conseils prévention liés aux causes

v2.8.12 (Model Recurring) dépend de:
├── v2.8.2 (Double Score) - boost de probabilité
└── v2.8.5 (CBR) - enrichissement par données terrain
```

## Checklist Pré-Production

- [ ] Migrations SQL exécutées dans l'ordre
- [ ] Seed data chargé et vérifié
- [ ] Index créés (vérifier `EXPLAIN ANALYZE`)
- [ ] Variables d'environnement configurées
- [ ] Redis disponible pour cache
- [ ] Health check OK (`/api/knowledge-graph/stats`)
- [ ] Tests unitaires passants
