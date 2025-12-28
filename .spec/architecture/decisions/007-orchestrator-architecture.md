# ADR-007: Architecture AI Orchestrator

## Statut

**Accepte** - 2025-12-29

## Contexte

Le systeme AI-COS necessite un orchestrateur pour coordonner :
- Les 16 agents Python existants (12 analyse + 4 fixproof)
- Le systeme RAG (Weaviate) pour la connaissance metier
- Les metriques et KPIs (52 indicateurs)
- Les 4 modes operationnels (safe, assisted, auto-drive, forecast)

### Code existant analyse

| Composant | Fichier | Lignes | Etat |
|-----------|---------|--------|------|
| AgentRunner | `core/runner.py` | 541 | Fonctionnel |
| Config | `core/config.py` | 243 | Complet |
| Evidence | `core/evidence.py` | ~150 | Fonctionnel |
| run.py | `run.py` | 77 | Point d'entree |

**Decouverte cle** : `AgentRunner` est deja un orchestrateur complet avec le pipeline :
```
analyse → fix → validation → decision
```

### Options considerees

| Option | Description | Avantages | Inconvenients |
|--------|-------------|-----------|---------------|
| **A** | Modifier AgentRunner directement | Simple | Violation SRP, risque regression |
| **B** | Wrapper AIOrchestrator | Separation claire | Couche supplementaire |
| **C** | Recreer from scratch | Architecture propre | Perte de code fonctionnel |

## Decision

### Option B : Wrapper AIOrchestrator autour d'AgentRunner

```
┌─────────────────────────────────────────────────────────────────┐
│                    AIOrchestrator (NOUVEAU)                      │
│                    Couche AI-COS                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    AgentRunner (EXISTANT)                    ││
│  │  • run_analysis_agents()  • run_fix_agents()                ││
│  │  • run_validation()       • calculate_decision()            ││
│  └─────────────────────────────────────────────────────────────┘│
│                              +                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ KnowledgeService│  │   ModeManager   │  │   KPIReporter   │ │
│  │ (Weaviate)      │  │ (4 niveaux)     │  │ (52 metriques)  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Justification

1. **Ne pas casser ce qui fonctionne** : AgentRunner est teste et operationnel
2. **Single Responsibility Principle** :
   - AgentRunner = analyse de code
   - AIOrchestrator = coordination AI-COS
3. **Conformite ADR-006** : L'orchestrateur est le seul point d'ecriture RAG
4. **Evolution incrementale** : Ajout de fonctionnalites sans regression

### Structure des fichiers

```
ai-agents-python/
├── orchestrator/                    # NOUVEAU
│   ├── __init__.py
│   ├── main.py                      # AIOrchestrator
│   ├── modes.py                     # ModeManager
│   └── knowledge/
│       ├── __init__.py
│       ├── searcher.py              # READ (tous envs)
│       └── indexer.py               # WRITE (DEV/CI only - ADR-006)
│
├── core/                            # EXISTANT - Inchange
│   ├── config.py
│   ├── runner.py                    # AgentRunner
│   └── evidence.py
│
├── agents/                          # EXISTANT
│   ├── analysis/                    # 12 agents A1-A12
│   └── fixproof/                    # 4 agents F0-F15
│
├── metrics/                         # NOUVEAU
│   ├── __init__.py
│   └── kpi_reporter.py              # 52 KPIs AI-COS
│
└── run.py                           # MODIFIE - Appelle AIOrchestrator
```

### Modes operationnels

| Mode | Description | Niveau d'autonomie |
|------|-------------|-------------------|
| **safe** | Analyse uniquement, pas de modification | 0% |
| **assisted** | Suggestions avec validation humaine | 25% |
| **auto-drive** | Execution automatique si risk < 30% | 75% |
| **forecast** | Prediction et recommandations proactives | 100% |

### Flux d'execution

```
python run.py --mode auto-drive
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AIOrchestrator.run()                         │
├─────────────────────────────────────────────────────────────────┤
│  1. ModeManager.check_mode()     → Determine niveau autonomie   │
│  2. KnowledgeSearcher.query()    → Contexte metier (Weaviate)   │
│  3. AgentRunner.run_full()       → Pipeline existant            │
│  4. KPIReporter.collect()        → 52 metriques                 │
│  5. Decision (selon mode)        → AUTO_COMMIT/REVIEW/REJECT    │
│  6. KnowledgeIndexer.learn()     → Apprentissage (DEV only)     │
└─────────────────────────────────────────────────────────────────┘
```

## Consequences

### Positives

| Avantage | Description |
|----------|-------------|
| **Retrocompatibilite** | `python run.py` continue de fonctionner |
| **Separation des concerns** | Code analysis vs AI-COS orchestration |
| **Testabilite** | Chaque composant testable independamment |
| **Evolution** | Ajout de features sans toucher au core |

### Negatives

| Inconvenient | Mitigation |
|--------------|------------|
| Couche supplementaire | Overhead minimal, composition simple |
| Apprentissage | Documentation complete (CDC) |

### Securite

Conforme a ADR-006 :
- `KnowledgeSearcher` : READ ONLY (tous environnements)
- `KnowledgeIndexer` : WRITE (DEV/CI uniquement, via `WEAVIATE_WRITE_KEY`)
- Aucun credential d'ecriture en PROD

## Implementation

### Phase 1 : Documentation
- [x] ADR-007 (ce document)
- [ ] CDC orchestrator-system.md

### Phase 2 : Code
- [ ] Creer `orchestrator/main.py`
- [ ] Creer `orchestrator/modes.py`
- [ ] Creer `orchestrator/knowledge/`
- [ ] Creer `metrics/kpi_reporter.py`
- [ ] Modifier `run.py`

### Verification

- [ ] AgentRunner reste fonctionnel apres integration
- [ ] Modes AI-COS operationnels
- [ ] KPIs collectes correctement
- [ ] Conformite ADR-006 verifiee

## References

- [ADR-006: Controle d'Acces RAG](./006-rag-write-access-control.md)
- [CDC RAG System](../../features/rag-system.md)
- [CDC AI-COS Operating System](../../features/ai-cos-operating-system.md)
- [core/runner.py](../../../ai-agents-python/core/runner.py) - AgentRunner existant

## Historique

| Date | Action | Auteur |
|------|--------|--------|
| 2025-12-29 | Creation | Claude Code |
