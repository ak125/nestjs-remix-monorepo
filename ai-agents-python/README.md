# 🐍 AI Agents - Python Local System

**Système d'agents IA simplifié qui tourne EN LOCAL dans VSCode**

## 🎯 Objectif

Détecter et corriger automatiquement les problèmes de code **AVANT le push** :
- ✅ Analyse statique du code
- ✅ Détection automatique des problèmes
- ✅ Correction automatique safe
- ✅ Validation complète
- ✅ Push seulement si tout est vert

## 📊 Architecture

### Agents d'Analyse (A1-A12)
**Détectent les problèmes** :
- `a1_cartographe.py` - Cartographie du monorepo
- `a2_massive_files.py` - Fichiers > 500 lignes
- `a3_duplications.py` - Code dupliqué (DRY violations)
- `a4_dead_code.py` - Code mort (non utilisé)
- `a5_upgrade_nestjs.py` - Breaking changes NestJS
- `a6_upgrade_remix.py` - Breaking changes Remix
- `a7_upgrade_react.py` - Breaking changes React
- `a8_upgrade_nodejs.py` - APIs deprecated Node
- `a9_css_patterns.py` - Patterns CSS dupliqués
- `a10_performance.py` - Bottlenecks performance
- `a11_data_sanity.py` - Incohérences data
- `a12_meta.py` - Meta-analyse & health score

### Agents de Correction (F1-F15)
**Corrigent automatiquement** :
- `f0_orchestrator.py` - Orchestrateur (planifie les corrections)
- `f1_dead_code_surgeon.py` - Supprime dead code
- `f3_duplication_extractor.py` - Extrait duplications
- `f4_massive_splitter.py` - Split fichiers massifs
- `f5_cycle_breaker.py` - Résout cycles imports
- `f6_css_componentizer.py` - Crée composants CSS
- `f15_risk_scorer.py` - Calcule Risk/Confidence

### Tests de Validation (M1-M7)
**7 gates de sécurité** :
- `M1` - Contracts API inchangés
- `M2` - Mutation testing (80%+)
- `M3` - UI perceptually identical
- `M4` - Shadow traffic replay
- `M5` - Performance budgets OK
- `M6` - 0 cycles, 0 violations
- `M7` - Diff-coverage ≥ 80%

## 🚀 Utilisation

### Installation
```bash
cd ai-agents-python
pip install -r requirements.txt
```

### Lancer les agents localement
```bash
# Analyse + Correction automatique
python run.py

# Dry-run (juste montrer ce qui serait corrigé)
python run.py --dry-run

# Analyse seulement (pas de correction)
python run.py --analyze-only
```

### Hook Pre-Commit (automatique)
```bash
# Installer le hook
python install_hook.py

# Maintenant à chaque commit :
# 1. Agents s'exécutent automatiquement
# 2. Si problèmes → correction auto
# 3. Si tout OK → commit autorisé
# 4. Si KO → commit bloqué
```

## 📋 Workflow Typique

```bash
# 1. Vous codez normalement
code frontend/components/BigFile.tsx

# 2. Vous tentez de commit
git add .
git commit -m "feat: new component"

# 3. Hook pre-commit s'exécute automatiquement
🔍 Analyse en cours...
✅ Removed 12 dead files
✅ Extracted 5 duplicate functions
✅ Split BigFile.tsx (800 → 3x250 lines)
✅ All tests pass (M1-M7)
✅ Risk: 25/100 | Confidence: 96/100

[main abc123] feat: new component (auto-cleaned)
 15 files changed, 450 insertions(+), 820 deletions(-)

# 4. Maintenant safe de push
git push
```

## 🛠️ Configuration

Fichier `config.yaml` :
```yaml
# Seuils de détection
thresholds:
  massive_files_tsx: 500
  massive_files_route: 400
  massive_files_service: 300
  duplication_tokens: 6
  dead_code_days: 30
  css_pattern_occurrences: 50

# Corrections automatiques
auto_fix:
  dead_code: true
  lint: true
  format: true
  duplications: false  # Nécessite review
  massive_files: false # Nécessite review

# Tests
tests:
  skip_mutation: false
  skip_ui_snapshots: false
  performance_budgets:
    p95_api: 200  # ms
    bundle: 500   # KB
    build: 300    # seconds

# Reporting
output:
  format: markdown
  verbose: true
  evidence_log: true
```

## 📊 Output Example

```
🤖 AI Agents - Local Fix+Proof System
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 ANALYSE (12 agents)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ A1 Cartographe      : 1075 files, 8 workspaces
⚠️  A2 Massive Files    : 223 files > 500 lines
⚠️  A3 Duplications    : 565 duplicates detected
⚠️  A4 Dead Code       : 276 unused files
✅ A5-A11 Frameworks   : 11 breaking changes
✅ A12 Meta            : Health Score 92/100

🔧 CORRECTIONS (6 agents)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ F1 Dead Code        : Removed 276 files
✅ F3 Duplications     : Extracted 45 functions
⚠️  F4 Massive Split    : 23 files need manual review
✅ F6 CSS Patterns     : Created 8 components

🧪 VALIDATION (M1-M7)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ M1 Contracts        : 0 breaking changes
✅ M5 Performance      : p95 stable, bundle -8%
✅ M6 Graph            : 0 cycles
✅ M7 Diff-Coverage    : 85% (target 80%)

📊 DECISION (F15)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Risk (R)         : 28/100 🟢 LOW
Confidence (C)   : 94/100 🟢 HIGH
Decision         : ✅ SAFE TO COMMIT

💾 Evidence Log      : .ai-agents/evidence/2025-10-19-23h45.json
📝 Full Report       : .ai-agents/reports/latest.md

✅ ALL CHECKS PASSED - Commit autorisé!
```

## 🎯 Avantages Python

1. **Simplicité** : Scripts directs, pas de compilation
2. **Rapidité** : Développement ultra rapide
3. **Libs puissantes** : `ast`, `vulture`, `radon`, `black`
4. **Maintenance** : Code facile à lire et modifier
5. **Local-first** : Tourne dans VSCode, pas besoin de cloud

## 📚 Dependencies

```txt
# Code Analysis
vulture==2.7          # Dead code detection
radon==6.0.1          # Code complexity
bandit==1.7.5         # Security issues
pylint==3.0.2         # Linting

# AST & Refactoring
ast-grep==0.9.1       # Advanced AST search
rope==1.11.0          # Refactoring tools
autopep8==2.0.4       # Auto-formatting

# Testing
pytest==7.4.3         # Testing framework
pytest-cov==4.1.0     # Coverage
mutmut==2.4.3         # Mutation testing

# Performance
py-spy==0.3.14        # Performance profiling

# Utilities
pyyaml==6.0.1         # Config files
click==8.1.7          # CLI interface
rich==13.7.0          # Beautiful terminal output
```

## 🔒 Sécurité

- ✅ Exécution 100% locale (pas de cloud)
- ✅ Pas de modification sans validation
- ✅ Evidence log de chaque action
- ✅ Dry-run mode disponible
- ✅ Rollback automatique si tests KO

## 🤝 Contribution

Pour ajouter un nouvel agent :

1. Créer `agents/analysis/aX_nom.py` ou `agents/fixproof/fX_nom.py`
2. Hériter de `BaseAgent`
3. Implémenter `analyze()` ou `fix()`
4. Ajouter tests dans `tests/`
5. Mettre à jour `config.yaml`

## 📞 Support

Logs détaillés : `.ai-agents/logs/latest.log`  
Evidence : `.ai-agents/evidence/`  
Reports : `.ai-agents/reports/`

---

**Version** : 1.0.0 (Python Local-First)  
**Auteur** : Driven AI System  
**License** : Propriétaire
