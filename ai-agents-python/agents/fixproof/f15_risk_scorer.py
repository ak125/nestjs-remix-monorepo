#!/usr/bin/env python3
"""
Agent F15 - Risk Scorer
Calcule Risk (R) et Confidence (C) pour décision auto-commit vs review

Formules:
- Risk (0-100): Basé sur surface changée, criticité, historique bugs
- Confidence (0-100): Basé sur tests pass, perf stable, coverage, evidence

Decision Matrix:
- R≤30 ET C≥95 → AUTO_COMMIT
- R≤60 ET C≥90 → REVIEW_REQUIRED
- Sinon → REJECT
"""

from pathlib import Path
from typing import Dict, Any, List
from dataclasses import dataclass
import subprocess
from datetime import datetime, timedelta


@dataclass
class RiskScore:
    """Score de risque décomposé"""
    overall: float  # 0-100
    surface: float  # Surface de changement
    criticality: float  # Criticité du module
    bug_history: float  # Historique de bugs
    instability: float  # Instabilité (fréquence commits)


@dataclass
class ConfidenceScore:
    """Score de confiance décomposé"""
    overall: float  # 0-100
    tests_pass: float  # Tests passent
    perf_stable: float  # Perf stable
    diff_coverage: float  # Coverage du diff
    evidence: float  # Qualité des preuves


@dataclass
class Decision:
    """Décision finale"""
    action: str  # AUTO_COMMIT | REVIEW_REQUIRED | REJECT
    risk: RiskScore
    confidence: ConfidenceScore
    reason: str
    can_auto_commit: bool


class RiskScorer:
    """
    Agent F15 - Calcule Risk/Confidence
    
    Inspiré du F15 TypeScript mais adapté pour workflow local Python
    """
    
    def __init__(self, config, workspace_root: Path):
        self.config = config
        self.workspace_root = workspace_root
    
    def calculate(
        self,
        analysis_results: List[Dict[str, Any]],
        fix_results: List[Dict[str, Any]],
        validation_results: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Calcule Risk, Confidence et Decision
        
        Returns:
            Decision sérialisée
        """
        print("📊 F15 - Risk Scorer...")
        
        # Calculer Risk
        risk = self._calculate_risk(analysis_results, fix_results)
        
        # Calculer Confidence
        confidence = self._calculate_confidence(validation_results, fix_results)
        
        # Décision
        decision = self._make_decision(risk, confidence)
        
        return self._serialize(decision)
    
    def _calculate_risk(
        self,
        analysis_results: List[Dict[str, Any]],
        fix_results: List[Dict[str, Any]]
    ) -> RiskScore:
        """
        Calcule le Risk Score (0-100)
        
        Composantes:
        - Surface (40%): Nombre de fichiers/lignes modifiés
        - Criticité (30%): Importance des modules touchés
        - Bug History (20%): Bugs récents dans ces fichiers
        - Instabilité (10%): Fréquence de commits récents
        """
        
        # 1. Surface de changement
        total_fixes = sum(len(r.get('fixes_applied', [])) for r in fix_results)
        total_files = len(set(
            fix.get('file_path')
            for r in fix_results
            for fix in r.get('fixes_applied', [])
        ))
        
        # Surface: 0-100 (linéaire jusqu'à 20 fichiers)
        surface = min(100, (total_files / 20) * 100)
        
        # 2. Criticité (basé sur patterns de fichiers)
        criticality = self._calculate_criticality(fix_results)
        
        # 3. Bug History (commits avec "fix" dans message récent)
        bug_history = self._calculate_bug_history(fix_results)
        
        # 4. Instabilité (nombre de commits récents)
        instability = self._calculate_instability(fix_results)
        
        # Overall: formule pondérée
        overall = (
            0.4 * surface +
            0.3 * criticality +
            0.2 * bug_history +
            0.1 * instability
        )
        
        return RiskScore(
            overall=overall,
            surface=surface,
            criticality=criticality,
            bug_history=bug_history,
            instability=instability
        )
    
    def _calculate_confidence(
        self,
        validation_results: Dict[str, Any],
        fix_results: List[Dict[str, Any]]
    ) -> ConfidenceScore:
        """
        Calcule le Confidence Score (0-100)
        
        Composantes:
        - Tests Pass (40%): Tous les tests passent
        - Perf Stable (20%): Pas de régression perf
        - Diff Coverage (30%): Coverage des lignes modifiées
        - Evidence (10%): Qualité des logs/preuves
        """
        
        # 1. Tests passent
        gates = validation_results.get('gates', {})
        if gates:
            passed = sum(1 for g in gates.values() if g.get('passed', False))
            tests_pass = (passed / len(gates)) * 100
        else:
            tests_pass = 100  # Pas de gates = assume OK
        
        # 2. Perf stable (check M5 budgets si existe)
        perf_stable = 100  # Default optimiste
        if 'm5_budgets' in gates:
            perf_stable = 100 if gates['m5_budgets'].get('passed') else 50
        
        # 3. Diff coverage (check M7 si existe)
        diff_coverage = 80  # Default raisonnable
        if 'm7_diff_coverage' in gates:
            coverage_data = gates['m7_diff_coverage'].get('details', {})
            diff_coverage = coverage_data.get('coverage_percent', 80)
        
        # 4. Evidence (basé sur nombre de fixes documentés)
        total_fixes = sum(len(r.get('fixes_applied', [])) for r in fix_results)
        evidence = min(100, (total_fixes / 10) * 100)  # 100% si 10+ fixes documentés
        
        # Overall: formule pondérée
        overall = (
            0.4 * tests_pass +
            0.2 * perf_stable +
            0.3 * diff_coverage +
            0.1 * evidence
        )
        
        return ConfidenceScore(
            overall=overall,
            tests_pass=tests_pass,
            perf_stable=perf_stable,
            diff_coverage=diff_coverage,
            evidence=evidence
        )
    
    def _make_decision(self, risk: RiskScore, confidence: ConfidenceScore) -> Decision:
        """
        Applique la matrice de décision
        
        Rules:
        1. R≤30 ET C≥95 → AUTO_COMMIT
        2. R≤60 ET C≥90 → REVIEW_REQUIRED
        3. Sinon → REJECT
        """
        
        R = risk.overall
        C = confidence.overall
        
        # Decision matrix depuis config
        auto_threshold = self.config.decision.auto_commit_if
        review_threshold = self.config.decision.review_if
        
        if R <= auto_threshold.max_risk and C >= auto_threshold.min_confidence:
            action = "AUTO_COMMIT"
            reason = f"Low risk ({R:.0f}) + High confidence ({C:.0f})"
            can_auto = True
        
        elif R <= review_threshold.max_risk and C >= review_threshold.min_confidence:
            action = "REVIEW_REQUIRED"
            reason = f"Medium risk ({R:.0f}) or confidence ({C:.0f})"
            can_auto = False
        
        else:
            action = "REJECT"
            reason = f"High risk ({R:.0f}) or low confidence ({C:.0f})"
            can_auto = False
        
        return Decision(
            action=action,
            risk=risk,
            confidence=confidence,
            reason=reason,
            can_auto_commit=can_auto
        )
    
    def _calculate_criticality(self, fix_results: List[Dict[str, Any]]) -> float:
        """
        Calcule criticité basée sur patterns de fichiers
        
        Criticité haute:
        - Backend auth, payment, API
        - Frontend checkout, payment
        - Database migrations
        """
        
        critical_patterns = [
            'auth', 'payment', 'checkout', 'prisma/migrations',
            'database', 'security', 'admin'
        ]
        
        critical_count = 0
        total_count = 0
        
        for result in fix_results:
            for fix in result.get('fixes_applied', []):
                file_path = fix.get('file_path', '').lower()
                total_count += 1
                
                if any(pattern in file_path for pattern in critical_patterns):
                    critical_count += 1
        
        if total_count == 0:
            return 0
        
        # Ratio × 100
        return (critical_count / total_count) * 100
    
    def _calculate_bug_history(self, fix_results: List[Dict[str, Any]]) -> float:
        """
        Calcule historique de bugs (commits avec 'fix' récents)
        """
        
        try:
            # Git log derniers 90 jours avec "fix" dans message
            result = subprocess.run(
                [
                    'git', 'log',
                    '--since=90 days ago',
                    '--grep=fix',
                    '--grep=bug',
                    '--oneline',
                    '-i'  # Case insensitive
                ],
                cwd=self.workspace_root,
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                bug_commits = len(result.stdout.strip().split('\n'))
                # Max 10 bugs = 100 points de risque
                return min(100, (bug_commits / 10) * 100)
        
        except Exception as e:
            print(f"⚠️  Erreur git log: {e}")
        
        return 0  # Default: pas de bugs connus
    
    def _calculate_instability(self, fix_results: List[Dict[str, Any]]) -> float:
        """
        Calcule instabilité (fréquence commits récents)
        Code qui change souvent = plus instable
        """
        
        try:
            # Git log derniers 30 jours
            result = subprocess.run(
                [
                    'git', 'log',
                    '--since=30 days ago',
                    '--oneline'
                ],
                cwd=self.workspace_root,
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                recent_commits = len(result.stdout.strip().split('\n'))
                # Max 50 commits = 100 points d'instabilité
                return min(100, (recent_commits / 50) * 100)
        
        except Exception as e:
            print(f"⚠️  Erreur git log: {e}")
        
        return 0  # Default: stable
    
    def _serialize(self, decision: Decision) -> Dict[str, Any]:
        """Sérialise la décision"""
        return {
            'action': decision.action,
            'can_auto_commit': decision.can_auto_commit,
            'reason': decision.reason,
            'risk': {
                'overall': round(decision.risk.overall, 1),
                'surface': round(decision.risk.surface, 1),
                'criticality': round(decision.risk.criticality, 1),
                'bug_history': round(decision.risk.bug_history, 1),
                'instability': round(decision.risk.instability, 1)
            },
            'confidence': {
                'overall': round(decision.confidence.overall, 1),
                'tests_pass': round(decision.confidence.tests_pass, 1),
                'perf_stable': round(decision.confidence.perf_stable, 1),
                'diff_coverage': round(decision.confidence.diff_coverage, 1),
                'evidence': round(decision.confidence.evidence, 1)
            }
        }


# Test standalone
if __name__ == '__main__':
    from pathlib import Path
    import sys
    
    sys.path.insert(0, str(Path(__file__).parent.parent.parent))
    
    from core.config import Config
    
    workspace = Path.cwd()
    while not (workspace / 'package.json').exists() and workspace != workspace.parent:
        workspace = workspace.parent
    
    config = Config.load(str(workspace / 'ai-agents-python' / 'config.yaml'))
    
    scorer = RiskScorer(config, workspace)
    
    # Test avec données simulées
    analysis_results = []
    fix_results = [
        {
            'agent_name': 'f1_dead_code',
            'fixes_applied': [
                {'file_path': 'backend/old-service.ts', 'action': 'removed'}
            ]
        }
    ]
    validation_results = {'gates': {}, 'all_passed': True}
    
    decision = scorer.calculate(analysis_results, fix_results, validation_results)
    
    print(f"\n📊 Décision:")
    print(f"   Action: {decision['action']}")
    print(f"   Raison: {decision['reason']}")
    print(f"   Risk: {decision['risk']['overall']}/100")
    print(f"   Confidence: {decision['confidence']['overall']}/100")
    print(f"   Auto-commit: {'✅ OUI' if decision['can_auto_commit'] else '❌ NON'}")
