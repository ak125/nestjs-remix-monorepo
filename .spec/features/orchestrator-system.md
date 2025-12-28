# CDC: AI Orchestrator System

> Cahier des Charges Complet - v1.0

## 1. Vue d'ensemble

### 1.1 Objectif

L'AI Orchestrator est le **chef d'orchestre central** du systeme AI-COS. Il coordonne :
- Les agents Python d'analyse de code (16 agents)
- Le systeme RAG pour la connaissance metier
- Les metriques et KPIs (52 indicateurs)
- Les modes operationnels (safe → forecast)

### 1.2 Positionnement

```
┌─────────────────────────────────────────────────────────────────┐
│                         AI-COS                                   │
│                    (Control Plane)                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   RAG System    │  │  Python Agents  │  │    Metrics      │ │
│  │   (Knowledge)   │  │   (Analysis)    │  │    (KPIs)       │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
│           │                    │                    │           │
│           └────────────────────┼────────────────────┘           │
│                                ▼                                 │
│                    ┌─────────────────────┐                      │
│                    │   AI ORCHESTRATOR   │  ← Ce document       │
│                    │                     │                      │
│                    └─────────────────────┘                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Principes directeurs

| Principe | Description |
|----------|-------------|
| **Composition** | Wrapper autour de l'existant, pas de reecriture |
| **Separation** | Chaque composant a une responsabilite unique |
| **Securite** | Conforme ADR-006 (ecriture RAG = DEV/CI only) |
| **Evolutivite** | Ajout de features sans regression |

### 1.4 Hierarchie des Agents

**IMPORTANT** : Le systeme AI-COS comporte deux niveaux d'agents distincts :

```
┌─────────────────────────────────────────────────────────────────┐
│           57 AGENTS AI-COS (Business Domain)                    │
│           Niveau strategique - Decisions metier                 │
├─────────────────────────────────────────────────────────────────┤
│  • IA-CEO, IA-CTO, IA-CFO (Board)                              │
│  • SEO Sentinel, Pricing Bot, Stock Manager (Operations)       │
│  • DevOps Guardian, Security Watcher (Technique)               │
│  • ... 48 autres agents metier                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │ pilote
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│           16 AGENTS PYTHON (Code Analysis)                      │
│           Niveau technique - Analyse de code                    │
├─────────────────────────────────────────────────────────────────┤
│  • A1-A12 : Agents d'analyse (security, complexity, SEO...)    │
│  • F0-F15 : Agents de correction (autoimport, lint, dead code) │
│  Geres par : AgentRunner (core/runner.py)                      │
└─────────────────────────────────────────────────────────────────┘
```

| Niveau | Agents | Responsabilite | Orchestration |
|--------|--------|----------------|---------------|
| **Strategique** | 57 AI-COS | Decisions metier, KPIs, modes | AI-COS Board |
| **Technique** | 16 Python | Analyse code, fixes, validation | AgentRunner |

L'**AIOrchestrator** fait le pont entre ces deux niveaux.

---

## 2. Architecture

### 2.1 Diagramme de composants

```
┌─────────────────────────────────────────────────────────────────┐
│                    AIOrchestrator                                │
│                    (orchestrator/main.py)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    AgentRunner (EXISTANT)                    ││
│  │                    (core/runner.py)                          ││
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            ││
│  │  │ Analysis    │ │ Fix Agents  │ │ Validation  │            ││
│  │  │ (12 agents) │ │ (4 agents)  │ │ (gates)     │            ││
│  │  └─────────────┘ └─────────────┘ └─────────────┘            ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │  ModeManager    │ │ KnowledgeService│ │  KPIReporter    │   │
│  │  (modes.py)     │ │ (knowledge/)    │ │  (metrics/)     │   │
│  │                 │ │                 │ │                 │   │
│  │  • safe         │ │  • searcher.py  │ │  • 52 KPIs      │   │
│  │  • assisted     │ │  • indexer.py   │ │  • Dashboard    │   │
│  │  • auto-drive   │ │                 │ │  • Alertes      │   │
│  │  • forecast     │ │                 │ │                 │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Structure des fichiers

```
ai-agents-python/
├── orchestrator/                    # NOUVEAU - AI Orchestrator
│   ├── __init__.py                  # Exports publics
│   ├── main.py                      # Classe AIOrchestrator
│   ├── modes.py                     # ModeManager (4 modes)
│   └── knowledge/                   # Integration RAG
│       ├── __init__.py
│       ├── searcher.py              # KnowledgeSearcher (READ)
│       └── indexer.py               # KnowledgeIndexer (WRITE)
│
├── metrics/                         # NOUVEAU - KPIs
│   ├── __init__.py
│   └── kpi_reporter.py              # KPIReporter (52 metriques)
│
├── core/                            # EXISTANT - Inchange
│   ├── config.py                    # Configuration YAML
│   ├── runner.py                    # AgentRunner
│   └── evidence.py                  # Collecte preuves
│
├── agents/                          # EXISTANT - 16 agents
│   ├── analysis/                    # A1-A12
│   └── fixproof/                    # F0-F15
│
├── config.yaml                      # Configuration globale
└── run.py                           # Point d'entree (modifie)
```

---

## 3. Composants

### 3.1 AIOrchestrator (main.py)

**Responsabilite** : Coordination centrale de tous les composants.

```python
class AIOrchestrator:
    """Chef d'orchestre AI-COS"""

    def __init__(self, config: Config, workspace: Path):
        self.config = config
        self.workspace = workspace

        # Composants existants
        self.runner = AgentRunner(config, workspace)

        # Nouveaux composants
        self.mode_manager = ModeManager(config)
        self.knowledge = KnowledgeService(config)
        self.kpi_reporter = KPIReporter(config)

    def run(self, mode: str = "safe") -> OrchestratorResult:
        """Execute le pipeline complet"""
        # 1. Verifier le mode
        self.mode_manager.set_mode(mode)

        # 2. Enrichir avec connaissance RAG
        context = self.knowledge.search(self.workspace)

        # 3. Executer le pipeline existant
        analysis = self.runner.run_analysis_agents()
        fixes = self.runner.run_fix_agents(analysis)
        validation = self.runner.run_validation(fixes)
        decision = self.runner.calculate_decision(analysis, fixes, validation)

        # 4. Collecter KPIs
        kpis = self.kpi_reporter.collect(analysis, fixes, decision)

        # 5. Appliquer decision selon mode
        result = self.mode_manager.apply_decision(decision)

        # 6. Apprentissage (DEV only)
        if self.knowledge.can_write():
            self.knowledge.learn(analysis, fixes, decision)

        return OrchestratorResult(
            decision=decision,
            kpis=kpis,
            mode=mode,
            result=result
        )
```

### 3.2 ModeManager (modes.py)

**Responsabilite** : Gestion des 4 niveaux d'autonomie AI-COS.

| Mode | Autonomie | Description | Actions autorisees |
|------|-----------|-------------|-------------------|
| **safe** | 0% | Observation pure | Analyse, rapport |
| **assisted** | 25% | Suggestions | + Propositions de fix |
| **auto-drive** | 75% | Execution conditionnelle | + Fix si risk < 30% |
| **forecast** | 100% | Proactif | + Predictions, alertes |

```python
class ModeManager:
    """Gestion des modes operationnels AI-COS"""

    MODES = {
        "safe": {"autonomy": 0, "can_fix": False, "can_commit": False},
        "assisted": {"autonomy": 25, "can_fix": False, "can_commit": False},
        "auto-drive": {"autonomy": 75, "can_fix": True, "can_commit": True},
        "forecast": {"autonomy": 100, "can_fix": True, "can_commit": True}
    }

    def __init__(self, config: Config):
        self.config = config
        self.current_mode = "safe"

    def set_mode(self, mode: str) -> None:
        if mode not in self.MODES:
            raise ValueError(f"Mode invalide: {mode}")
        self.current_mode = mode

    def can_auto_commit(self, decision: dict) -> bool:
        """Verifie si auto-commit est autorise"""
        mode_config = self.MODES[self.current_mode]

        if not mode_config["can_commit"]:
            return False

        # Auto-drive : commit seulement si low risk
        if self.current_mode == "auto-drive":
            return (
                decision["risk"]["overall"] <= 30 and
                decision["confidence"]["overall"] >= 95
            )

        # Forecast : toujours autorise
        return True

    def apply_decision(self, decision: dict) -> str:
        """Applique la decision selon le mode"""
        if self.can_auto_commit(decision):
            return "AUTO_COMMIT"
        elif self.current_mode in ("safe", "assisted"):
            return "REVIEW_REQUIRED"
        else:
            return decision["action"]
```

### 3.3 KnowledgeService (knowledge/)

**Responsabilite** : Interface avec le systeme RAG (Weaviate).

#### 3.3.1 KnowledgeSearcher (searcher.py)

**Disponible** : Tous environnements (DEV, CI, PROD)

```python
class KnowledgeSearcher:
    """Recherche dans la base de connaissance (READ ONLY)"""

    def __init__(self, config: Config):
        self.config = config
        self.weaviate_url = os.getenv("WEAVIATE_URL")
        # PAS de WEAVIATE_WRITE_KEY - lecture seule

    def search(self, query: str, namespace: str = "knowledge:docs") -> List[dict]:
        """Recherche semantique dans le namespace"""
        # Appel API Weaviate en lecture
        pass

    def get_context(self, file_path: str) -> dict:
        """Recupere le contexte metier pour un fichier"""
        pass

    def get_patterns(self, issue_type: str) -> List[dict]:
        """Recupere les patterns de resolution connus"""
        pass
```

#### 3.3.2 KnowledgeIndexer (indexer.py)

**Disponible** : DEV et CI uniquement (conforme ADR-006)

```python
class KnowledgeIndexer:
    """Indexation dans la base de connaissance (WRITE)"""

    def __init__(self, config: Config):
        self.config = config
        self.weaviate_url = os.getenv("WEAVIATE_URL")
        self.write_key = os.getenv("WEAVIATE_WRITE_KEY")  # DEV/CI only

    def can_write(self) -> bool:
        """Verifie si ecriture est autorisee"""
        return self.write_key is not None

    def index_finding(self, finding: dict) -> None:
        """Indexe un finding pour apprentissage"""
        if not self.can_write():
            raise PermissionError("Ecriture RAG non autorisee (PROD)")
        pass

    def index_resolution(self, issue: dict, fix: dict) -> None:
        """Indexe une resolution reussie"""
        if not self.can_write():
            raise PermissionError("Ecriture RAG non autorisee (PROD)")
        pass

    def learn(self, analysis: list, fixes: list, decision: dict) -> None:
        """Apprentissage a partir d'une session"""
        if not self.can_write():
            return  # Skip silently in PROD

        # Indexer les nouveaux patterns
        for result in analysis:
            for finding in result.findings:
                self.index_finding(finding)

        # Indexer les resolutions reussies
        for fix in fixes:
            if fix.success:
                self.index_resolution(fix.issue, fix.resolution)
```

### 3.4 KPIReporter (metrics/kpi_reporter.py)

**Responsabilite** : Collecte et reporting des 52 KPIs AI-COS.

```python
class KPIReporter:
    """Collecte des 52 KPIs AI-COS"""

    # Categories de KPIs (voir ai-cos-operating-system.md)
    CATEGORIES = {
        "quality": [
            "code_coverage", "mutation_score", "duplication_rate",
            "complexity_avg", "dead_code_ratio", "lint_errors"
        ],
        "security": [
            "vulnerabilities_critical", "vulnerabilities_high",
            "secrets_exposed", "dependency_vulnerabilities"
        ],
        "performance": [
            "lcp_avg", "fid_avg", "cls_avg", "bundle_size",
            "api_response_time_p95"
        ],
        "business": [
            "mttr", "lead_time", "deployment_frequency",
            "change_failure_rate"
        ],
        "ai_ops": [
            "auto_commit_rate", "fix_success_rate",
            "decision_accuracy", "learning_rate"
        ]
    }

    def __init__(self, config: Config):
        self.config = config
        self.metrics = {}

    def collect(self, analysis: list, fixes: list, decision: dict) -> dict:
        """Collecte tous les KPIs d'une session"""
        return {
            "timestamp": datetime.now().isoformat(),
            "quality": self._collect_quality(analysis),
            "security": self._collect_security(analysis),
            "performance": self._collect_performance(analysis),
            "business": self._collect_business(fixes, decision),
            "ai_ops": self._collect_ai_ops(analysis, fixes, decision)
        }

    def _collect_quality(self, analysis: list) -> dict:
        """KPIs qualite code"""
        findings = [f for r in analysis for f in r.findings]
        return {
            "total_findings": len(findings),
            "critical": len([f for f in findings if f.get("severity") == "critical"]),
            "high": len([f for f in findings if f.get("severity") == "high"]),
            "medium": len([f for f in findings if f.get("severity") == "medium"]),
            "low": len([f for f in findings if f.get("severity") == "low"])
        }

    def export(self, format: str = "json") -> str:
        """Exporte les KPIs"""
        if format == "json":
            return json.dumps(self.metrics, indent=2)
        elif format == "prometheus":
            return self._to_prometheus()
        elif format == "dashboard":
            return self._to_dashboard()
```

---

## 4. Flux d'execution

### 4.1 Pipeline principal

```
┌─────────────────────────────────────────────────────────────────┐
│  python run.py --mode auto-drive                                │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. INITIALISATION                                               │
│     • Charger config.yaml                                       │
│     • Initialiser AIOrchestrator                                │
│     • Configurer mode (safe/assisted/auto-drive/forecast)       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. ENRICHISSEMENT RAG                                          │
│     • KnowledgeSearcher.get_context()                           │
│     • Recuperer patterns connus                                 │
│     • Contextualiser les analyses                               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. ANALYSE (AgentRunner existant)                              │
│     • 12 agents d'analyse (A1-A12)                              │
│     • Collecte des findings                                     │
│     • Calcul severity/confidence                                │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. CORRECTION (AgentRunner existant)                           │
│     • 4 agents de fix (F0-F15)                                  │
│     • Application des corrections                               │
│     • Validation des fixes                                      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. VALIDATION                                                  │
│     • Gates M1-M7                                               │
│     • Tests de non-regression                                   │
│     • Verification lint/types                                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. DECISION                                                    │
│     • Calcul risk score                                         │
│     • Calcul confidence score                                   │
│     • Decision: AUTO_COMMIT / REVIEW / REJECT                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  7. APPLICATION MODE                                            │
│     • safe: rapport uniquement                                  │
│     • assisted: rapport + suggestions                           │
│     • auto-drive: commit si risk < 30%                          │
│     • forecast: predictions proactives                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  8. METRIQUES & APPRENTISSAGE                                   │
│     • KPIReporter.collect()                                     │
│     • Export metriques (Prometheus/Dashboard)                   │
│     • KnowledgeIndexer.learn() (DEV only)                       │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Matrice mode/action

| Mode | Risk < 30% | Risk 30-60% | Risk > 60% |
|------|------------|-------------|------------|
| **safe** | REPORT | REPORT | REPORT |
| **assisted** | SUGGEST | SUGGEST | SUGGEST |
| **auto-drive** | AUTO_COMMIT | REVIEW | REJECT |
| **forecast** | AUTO_COMMIT | AUTO_COMMIT + ALERT | REVIEW |

---

## 5. Configuration

### 5.1 Extension config.yaml

```yaml
# config.yaml - Extension pour Orchestrator

# Section existante
thresholds:
  massive_files:
    tsx_component: 500
  duplication:
    min_tokens: 6
  # ...

# NOUVELLE SECTION
orchestrator:
  # Mode par defaut
  default_mode: "safe"

  # Seuils de decision par mode
  modes:
    safe:
      autonomy: 0
      actions: ["analyze", "report"]

    assisted:
      autonomy: 25
      actions: ["analyze", "report", "suggest"]

    auto-drive:
      autonomy: 75
      actions: ["analyze", "fix", "commit"]
      thresholds:
        max_risk_for_commit: 30
        min_confidence_for_commit: 95

    forecast:
      autonomy: 100
      actions: ["analyze", "fix", "commit", "predict"]
      proactive_alerts: true

  # Configuration RAG
  knowledge:
    weaviate_url: "${WEAVIATE_URL}"
    namespaces:
      read: ["knowledge:docs", "knowledge:patterns"]
      write: ["internal:learnings"]  # DEV/CI only

  # Configuration metriques
  metrics:
    enabled: true
    export_format: "prometheus"
    dashboard_url: "${GRAFANA_URL}"
    kpis:
      - category: quality
        enabled: true
      - category: security
        enabled: true
      - category: performance
        enabled: true
      - category: business
        enabled: true
      - category: ai_ops
        enabled: true
```

### 5.2 Variables d'environnement

| Variable | Requis | Environnements | Description |
|----------|--------|----------------|-------------|
| `WEAVIATE_URL` | Oui | Tous | URL du serveur Weaviate |
| `WEAVIATE_WRITE_KEY` | Non | DEV, CI | Cle d'ecriture RAG (ADR-006) |
| `OPENAI_API_KEY` | Oui | Tous | Pour embeddings |
| `GRAFANA_URL` | Non | Tous | Dashboard metriques |

---

## 6. Securite

### 6.1 Conformite ADR-006

```
┌─────────────────────────────────────────────────────────────────┐
│                    REGLES DE SECURITE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ✅ LECTURE RAG (tous environnements) :                         │
│     • KnowledgeSearcher                                          │
│     • Namespaces: knowledge:*, internal:* (read)                │
│                                                                  │
│  ❌ ECRITURE RAG (DEV/CI uniquement) :                          │
│     • KnowledgeIndexer                                           │
│     • Requiert: WEAVIATE_WRITE_KEY                              │
│     • Absent en PROD par design                                 │
│                                                                  │
│  🔒 VERIFICATION :                                               │
│     • can_write() verifie presence de WEAVIATE_WRITE_KEY        │
│     • Echec silencieux si absent (pas d'erreur en PROD)         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Isolation des secrets

| Secret | DEV | CI | PROD |
|--------|-----|-----|------|
| `DATABASE_URL` | ✅ | ✅ | ✅ |
| `WEAVIATE_URL` | ✅ | ✅ | ✅ |
| `WEAVIATE_WRITE_KEY` | ✅ | ✅ | ❌ |
| `OPENAI_API_KEY` | ✅ | ✅ | ✅ |

---

## 7. Tests

### 7.1 Tests unitaires

```python
# tests/test_orchestrator.py

def test_mode_manager_safe():
    """Mode safe ne permet pas de commit"""
    manager = ModeManager(Config())
    manager.set_mode("safe")

    decision = {"risk": {"overall": 10}, "confidence": {"overall": 99}}
    assert manager.can_auto_commit(decision) == False

def test_mode_manager_auto_drive_low_risk():
    """Mode auto-drive commit si low risk"""
    manager = ModeManager(Config())
    manager.set_mode("auto-drive")

    decision = {"risk": {"overall": 20}, "confidence": {"overall": 98}}
    assert manager.can_auto_commit(decision) == True

def test_mode_manager_auto_drive_high_risk():
    """Mode auto-drive refuse si high risk"""
    manager = ModeManager(Config())
    manager.set_mode("auto-drive")

    decision = {"risk": {"overall": 50}, "confidence": {"overall": 98}}
    assert manager.can_auto_commit(decision) == False

def test_knowledge_indexer_prod_blocked():
    """Indexer refuse d'ecrire en PROD"""
    # Simuler absence de WEAVIATE_WRITE_KEY
    os.environ.pop("WEAVIATE_WRITE_KEY", None)

    indexer = KnowledgeIndexer(Config())
    assert indexer.can_write() == False

    with pytest.raises(PermissionError):
        indexer.index_finding({"test": "data"})
```

### 7.2 Tests d'integration

```python
# tests/test_integration.py

def test_full_pipeline_safe_mode():
    """Pipeline complet en mode safe"""
    orchestrator = AIOrchestrator(Config(), Path("."))
    result = orchestrator.run(mode="safe")

    assert result.mode == "safe"
    assert result.result == "REVIEW_REQUIRED"
    assert "kpis" in result
    assert "decision" in result

def test_backward_compatibility():
    """AgentRunner reste fonctionnel"""
    runner = AgentRunner(Config(), Path("."))

    # Ancienne API fonctionne toujours
    analysis = runner.run_analysis_agents()
    assert isinstance(analysis, list)
```

---

## 8. Migration

### 8.1 Plan de migration

| Phase | Action | Impact |
|-------|--------|--------|
| 1 | Creer `orchestrator/` | Aucun - nouveau code |
| 2 | Creer `metrics/` | Aucun - nouveau code |
| 3 | Modifier `run.py` | Retrocompatible |
| 4 | Ajouter config orchestrator | Optionnel |
| 5 | Tests complets | Validation |

### 8.2 Retrocompatibilite

```python
# run.py - Version migree

def main():
    # Detection: nouvelle API ou ancienne?
    if "--mode" in sys.argv or os.getenv("AI_ORCHESTRATOR_ENABLED"):
        # Nouvelle API via AIOrchestrator
        orchestrator = AIOrchestrator(config, workspace)
        result = orchestrator.run(mode=args.mode)
    else:
        # Ancienne API via AgentRunner (compatibilite)
        runner = AgentRunner(config, workspace)
        runner.run_full()
```

---

## 9. Roadmap

### Phase 1 : MVP (Semaine 1)
- [x] Documentation ADR-007
- [x] Documentation CDC (ce document)
- [ ] Implementation `orchestrator/main.py`
- [ ] Implementation `orchestrator/modes.py`

### Phase 2 : Knowledge (Semaine 2)
- [ ] Implementation `knowledge/searcher.py`
- [ ] Implementation `knowledge/indexer.py`
- [ ] Integration Weaviate

### Phase 3 : Metriques (Semaine 3)
- [ ] Implementation `metrics/kpi_reporter.py`
- [ ] Export Prometheus
- [ ] Dashboard Grafana

### Phase 4 : Modes avances (Semaine 4)
- [ ] Mode auto-drive complet
- [ ] Mode forecast (predictions)
- [ ] Alertes proactives

---

## 10. References

| Document | Description |
|----------|-------------|
| [ADR-006](../architecture/decisions/006-rag-write-access-control.md) | Controle d'acces RAG |
| [ADR-007](../architecture/decisions/007-orchestrator-architecture.md) | Architecture Orchestrator |
| [rag-system.md](./rag-system.md) | CDC RAG complet |
| [ai-cos-operating-system.md](./ai-cos-operating-system.md) | CDC AI-COS |
| [core/runner.py](../../ai-agents-python/core/runner.py) | AgentRunner existant |

---

## Historique

| Date | Version | Action | Auteur |
|------|---------|--------|--------|
| 2025-12-29 | 1.0 | Creation | Claude Code |
