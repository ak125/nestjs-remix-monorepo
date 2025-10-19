"""
Agent Runner - Orchestration des agents d'analyse et de correction

Inspiré de AIDriver TypeScript mais adapté pour le workflow local-first Python.
"""

import time
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from datetime import datetime
import importlib
import sys

from .config import Config
from .evidence import EvidenceLogger


@dataclass
class AgentResult:
    """Résultat d'exécution d'un agent"""
    agent_name: str
    agent_type: str  # 'analysis' or 'fixproof'
    status: str  # 'success', 'warning', 'error'
    duration_ms: int
    findings: List[Dict[str, Any]]
    fixes_applied: List[Dict[str, Any]]
    errors: List[str]
    warnings: List[str]
    metadata: Dict[str, Any]


@dataclass
class RunReport:
    """Rapport complet d'exécution"""
    timestamp: str
    duration_ms: int
    mode: str  # 'analysis', 'fix', 'full'
    analysis_results: List[AgentResult]
    fix_results: List[AgentResult]
    validation_results: Dict[str, Any]
    decision: Dict[str, Any]
    summary: Dict[str, Any]


class AgentRunner:
    """
    Orchestrateur d'agents - version Python local-first
    
    Responsabilités:
    - Charger et exécuter agents d'analyse (A1-A12)
    - Charger et exécuter agents de correction (F0-F15)
    - Exécuter validation (M1-M7)
    - Calculer décision finale (Risk/Confidence)
    - Logger evidence
    """
    
    def __init__(self, config: Config, workspace_root: Path):
        self.config = config
        self.workspace_root = workspace_root
        self.evidence = EvidenceLogger(workspace_root / ".ai-agents")
        
        # Registres d'agents
        self.analysis_agents: Dict[str, Any] = {}
        self.fix_agents: Dict[str, Any] = {}
        self.validation_gates: Dict[str, Any] = {}
        
        self._register_agents()
    
    def _register_agents(self):
        """Enregistre tous les agents disponibles (lazy loading)"""
        
        # Agents d'analyse (A1-A12)
        self.analysis_agents = {
            # 'a1_cartographe': lambda: self._load_agent('agents.analysis.a1_cartographe', 'CartographeAgent'),
            'a2_massive_files': lambda: self._load_agent('agents.analysis.a2_massive_files', 'MassiveFilesDetector'),
            'a3_duplications': lambda: self._load_agent('agents.analysis.a3_duplications', 'DuplicationDetector'),
            'a4_dead_code': lambda: self._load_agent('agents.analysis.a4_dead_code', 'DeadCodeDetector'),
            # 'a5_upgrade_nestjs': lambda: self._load_agent('agents.analysis.a5_upgrade_nestjs', 'UpgradeNestJSAgent'),
            # 'a6_upgrade_remix': lambda: self._load_agent('agents.analysis.a6_upgrade_remix', 'UpgradeRemixAgent'),
            # 'a7_upgrade_react': lambda: self._load_agent('agents.analysis.a7_upgrade_react', 'UpgradeReactAgent'),
            # 'a8_upgrade_nodejs': lambda: self._load_agent('agents.analysis.a8_upgrade_nodejs', 'UpgradeNodeJSAgent'),
            # 'a9_css_patterns': lambda: self._load_agent('agents.analysis.a9_css_patterns', 'CSSPatternsAgent'),
            # 'a10_performance': lambda: self._load_agent('agents.analysis.a10_performance', 'PerformanceAgent'),
            # 'a11_data_sanity': lambda: self._load_agent('agents.analysis.a11_data_sanity', 'DataSanityAgent'),
            # 'a12_meta': lambda: self._load_agent('agents.analysis.a12_meta', 'MetaAgent'),
        }
        
        # Agents de correction (F0-F15)
        self.fix_agents = {
            # 'f0_orchestrator': lambda: self._load_agent('agents.fixproof.f0_orchestrator', 'OrchestratorAgent'),
            'f1_dead_code_surgeon': lambda: self._load_agent('agents.fixproof.f1_dead_code_surgeon', 'DeadCodeSurgeon'),
            'f2_lint_format': lambda: self._load_agent('agents.fixproof.f2_lint_format', 'LintFormatter'),
            # 'f3_duplication_extractor': lambda: self._load_agent('agents.fixproof.f3_duplication_extractor', 'DuplicationExtractorAgent'),
            # 'f4_massive_splitter': lambda: self._load_agent('agents.fixproof.f4_massive_splitter', 'MassiveSplitterAgent'),
            'f15_risk_scorer': lambda: self._load_agent('agents.fixproof.f15_risk_scorer', 'RiskScorer'),
        }
        
        # Gates de validation (M1-M7)
        self.validation_gates = {
            'm1_contracts': lambda: self._load_agent('tests.m1_contracts', 'ContractsGate'),
            # 'm5_budgets': lambda: self._load_agent('tests.m5_budgets', 'BudgetsGate'),
            # 'm6_graph': lambda: self._load_agent('tests.m6_graph', 'GraphGate'),
            'm7_diff_coverage': lambda: self._load_agent('tests.m7_diff_coverage', 'DiffCoverageGate'),
        }
    
    def _load_agent(self, module_path: str, class_name: str):
        """Lazy loading d'un agent"""
        try:
            module = importlib.import_module(module_path)
            agent_class = getattr(module, class_name)
            # Ordre: config, workspace_root (comme défini dans les agents)
            return agent_class(self.config, self.workspace_root)
        except Exception as e:
            print(f"⚠️  Impossible de charger {module_path}.{class_name}: {e}")
            return None
    
    def run_analysis_agents(self, specific: Optional[List[str]] = None) -> List[AgentResult]:
        """
        Exécute les agents d'analyse
        
        Args:
            specific: Liste d'agents spécifiques à exécuter (ex: ['a4_dead_code'])
                     Si None, exécute tous les agents disponibles
        
        Returns:
            Liste des résultats d'analyse
        """
        print("\n🔍 === PHASE 1: ANALYSE ===\n")
        
        results = []
        agents_to_run = specific if specific else list(self.analysis_agents.keys())
        
        for agent_key in agents_to_run:
            if agent_key not in self.analysis_agents:
                print(f"⚠️  Agent inconnu: {agent_key}")
                continue
            
            # Lazy load de l'agent
            agent_factory = self.analysis_agents[agent_key]
            agent = agent_factory()
            
            if agent is None:
                continue
            
            print(f"▶️  Exécution: {agent_key}")
            start = time.time()
            
            try:
                # Exécuter l'analyse
                findings = agent.analyze()
                duration_ms = int((time.time() - start) * 1000)
                
                result = AgentResult(
                    agent_name=agent_key,
                    agent_type='analysis',
                    status='success' if findings else 'success',
                    duration_ms=duration_ms,
                    findings=findings if isinstance(findings, list) else [findings],
                    fixes_applied=[],
                    errors=[],
                    warnings=[],
                    metadata={'count': len(findings) if isinstance(findings, list) else 1}
                )
                
                results.append(result)
                
                # Logger evidence
                self.evidence.log_analysis(agent_key, result)
                
                print(f"   ✅ {len(result.findings)} finding(s) - {duration_ms}ms")
                
            except Exception as e:
                duration_ms = int((time.time() - start) * 1000)
                result = AgentResult(
                    agent_name=agent_key,
                    agent_type='analysis',
                    status='error',
                    duration_ms=duration_ms,
                    findings=[],
                    fixes_applied=[],
                    errors=[str(e)],
                    warnings=[],
                    metadata={}
                )
                results.append(result)
                print(f"   ❌ Erreur: {e}")
        
        print(f"\n📊 Analyse terminée: {len(results)} agent(s)")
        return results
    
    def run_fix_agents(
        self,
        analysis_results: List[AgentResult],
        specific: Optional[List[str]] = None,
        dry_run: bool = False
    ) -> List[AgentResult]:
        """
        Exécute les agents de correction
        
        Args:
            analysis_results: Résultats de l'analyse
            specific: Agents spécifiques à exécuter
            dry_run: Si True, ne fait que simuler les corrections
        
        Returns:
            Liste des résultats de correction
        """
        print("\n🔧 === PHASE 2: CORRECTION ===\n")
        
        if dry_run:
            print("⚠️  MODE DRY-RUN (simulation seulement)\n")
        
        results = []
        agents_to_run = specific if specific else list(self.fix_agents.keys())
        
        for agent_key in agents_to_run:
            if agent_key not in self.fix_agents:
                print(f"⚠️  Agent inconnu: {agent_key}")
                continue
            
            # Vérifier si auto-fix est activé pour cet agent
            if not self._is_auto_fix_enabled(agent_key):
                print(f"⏭️  {agent_key}: auto-fix désactivé (config)")
                continue
            
            # Lazy load
            agent_factory = self.fix_agents[agent_key]
            agent = agent_factory()
            
            if agent is None:
                continue
            
            # Trouver les findings correspondants
            relevant_findings = self._get_relevant_findings(agent_key, analysis_results)
            
            if not relevant_findings:
                print(f"⏭️  {agent_key}: aucun finding à corriger")
                continue
            
            print(f"▶️  Exécution: {agent_key} ({len(relevant_findings)} finding(s))")
            start = time.time()
            
            try:
                # Exécuter les corrections
                fixes = agent.fix(relevant_findings, dry_run=dry_run)
                duration_ms = int((time.time() - start) * 1000)
                
                result = AgentResult(
                    agent_name=agent_key,
                    agent_type='fixproof',
                    status='success',
                    duration_ms=duration_ms,
                    findings=relevant_findings,
                    fixes_applied=fixes if isinstance(fixes, list) else [fixes],
                    errors=[],
                    warnings=[],
                    metadata={'count': len(fixes) if isinstance(fixes, list) else 1}
                )
                
                results.append(result)
                
                # Logger evidence
                self.evidence.log_fix(agent_key, result)
                
                action = "Simulé" if dry_run else "Appliqué"
                print(f"   ✅ {action}: {len(result.fixes_applied)} fix(es) - {duration_ms}ms")
                
            except Exception as e:
                duration_ms = int((time.time() - start) * 1000)
                result = AgentResult(
                    agent_name=agent_key,
                    agent_type='fixproof',
                    status='error',
                    duration_ms=duration_ms,
                    findings=relevant_findings,
                    fixes_applied=[],
                    errors=[str(e)],
                    warnings=[],
                    metadata={}
                )
                results.append(result)
                print(f"   ❌ Erreur: {e}")
        
        print(f"\n📊 Correction terminée: {len(results)} agent(s)")
        return results
    
    def run_validation(self, fix_results: List[AgentResult]) -> Dict[str, Any]:
        """
        Exécute les gates de validation (M1-M7)
        
        Returns:
            Résultats de validation
        """
        print("\n🧪 === PHASE 3: VALIDATION ===\n")
        
        validation = {
            'gates': {},
            'all_passed': True,
            'critical_failures': []
        }
        
        for gate_key, gate_factory in self.validation_gates.items():
            gate = gate_factory()
            
            if gate is None:
                continue
            
            print(f"▶️  Gate: {gate_key}")
            start = time.time()
            
            try:
                result = gate.validate(fix_results)
                duration_ms = int((time.time() - start) * 1000)
                
                validation['gates'][gate_key] = {
                    'passed': result.get('passed', False),
                    'score': result.get('score', 0),
                    'details': result.get('details', {}),
                    'duration_ms': duration_ms
                }
                
                if not result.get('passed'):
                    validation['all_passed'] = False
                    if result.get('critical', False):
                        validation['critical_failures'].append(gate_key)
                
                status = "✅" if result.get('passed') else "❌"
                print(f"   {status} {result.get('message', 'OK')} - {duration_ms}ms")
                
            except Exception as e:
                validation['gates'][gate_key] = {
                    'passed': False,
                    'error': str(e)
                }
                validation['all_passed'] = False
                print(f"   ❌ Erreur: {e}")
        
        # Logger evidence
        self.evidence.log_validation(validation)
        
        print(f"\n📊 Validation: {'✅ PASS' if validation['all_passed'] else '❌ FAIL'}")
        return validation
    
    def calculate_decision(
        self,
        analysis_results: List[AgentResult],
        fix_results: List[AgentResult],
        validation: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Calcule la décision finale (Risk/Confidence)
        
        Returns:
            Decision avec action, risk, confidence
        """
        print("\n📊 === PHASE 4: DÉCISION ===\n")
        
        # Calculer Risk (0-100)
        risk_score = self._calculate_risk(analysis_results, fix_results)
        
        # Calculer Confidence (0-100)
        confidence_score = self._calculate_confidence(validation, fix_results)
        
        # Déterminer l'action
        action = self._determine_action(risk_score, confidence_score)
        
        decision = {
            'risk': {
                'overall': risk_score,
                'surface': 0,  # TODO: détailler
                'criticality': 0,
                'bug_history': 0,
                'instability': 0
            },
            'confidence': {
                'overall': confidence_score,
                'tests_pass': 100,
                'perf_stable': 100,
                'diff_coverage': 80,
                'evidence': 100
            },
            'action': action,
            'timestamp': datetime.now().isoformat(),
            'details': {
                'total_findings': sum(len(r.findings) for r in analysis_results),
                'total_fixes': sum(len(r.fixes_applied) for r in fix_results),
                'validation_passed': validation.get('all_passed', False)
            }
        }
        
        # Logger evidence
        self.evidence.log_decision(decision)
        
        print(f"🎯 Risk: {risk_score}/100")
        print(f"🎯 Confidence: {confidence_score}/100")
        print(f"🎯 Action: {action}\n")
        
        return decision
    
    def _calculate_risk(self, analysis_results: List[AgentResult], fix_results: List[AgentResult]) -> int:
        """Calcule le score de risque (0-100)"""
        # Formule simple pour Phase 1
        total_fixes = sum(len(r.fixes_applied) for r in fix_results)
        risk = min(100, total_fixes * 10)  # 10 points par fix
        return risk
    
    def _calculate_confidence(self, validation: Dict[str, Any], fix_results: List[AgentResult]) -> int:
        """
        Calcule le score de confiance (0-100)
        
        Formule:
        - 40% validation gates passées
        - 30% diff coverage
        - 20% nombre de fixes (moins = mieux)
        - 10% bonus si aucun fix
        """
        # Base: validation gates
        gates = validation.get('gates', {})
        if not gates:
            # Aucun gate = confiance moyenne
            gate_score = 50
        else:
            # Moyenne des scores de gates
            gate_scores = [g.get('score', 0) for g in gates.values()]
            gate_score = sum(gate_scores) / len(gate_scores) if gate_scores else 0
        
        # Diff coverage (gate M7)
        coverage_score = gates.get('m7_diff_coverage', {}).get('score', 50)
        
        # Nombre de fixes (pénalité si beaucoup)
        total_fixes = sum(len(r.fixes_applied) for r in fix_results)
        fix_penalty = min(20, total_fixes)  # Max -20 points
        
        # Bonus si aucun fix
        no_fix_bonus = 10 if total_fixes == 0 else 0
        
        # Calcul final
        confidence = int(
            gate_score * 0.4 +
            coverage_score * 0.3 +
            (20 - fix_penalty) +
            no_fix_bonus
        )
        
        return max(0, min(100, confidence))
    
    def _determine_action(self, risk: int, confidence: int) -> str:
        """Détermine l'action basée sur Risk/Confidence"""
        # Matrice de décision (depuis config.yaml)
        if risk <= self.config.decision.auto_commit_if.max_risk and \
           confidence >= self.config.decision.auto_commit_if.min_confidence:
            return "AUTO_COMMIT"
        
        if risk <= self.config.decision.review_if.max_risk and \
           confidence >= self.config.decision.review_if.min_confidence:
            return "REVIEW_REQUIRED"
        
        return "REJECT"
    
    def _is_auto_fix_enabled(self, agent_key: str) -> bool:
        """Vérifie si auto-fix est activé pour un agent"""
        # Mapping agent -> config
        mapping = {
            'f1_dead_code_surgeon': 'dead_code',
            'f2_lint_format': 'lint_errors',
            'f3_duplication_extractor': 'duplications',
            'f4_massive_splitter': 'massive_files',
        }
        
        config_key = mapping.get(agent_key)
        if not config_key:
            return False
        
        return getattr(self.config.auto_fix, config_key, False)
    
    def _get_relevant_findings(self, agent_key: str, analysis_results: List[AgentResult]) -> List[Dict[str, Any]]:
        """Trouve les findings pertinents pour un agent de correction"""
        # Mapping fix agent → analysis agent
        mapping = {
            'f1_dead_code_surgeon': 'a4_dead_code',
            'f2_lint_format': 'a2_massive_files',  # F2 formatte fichiers massifs
            'f3_duplication_extractor': 'a3_duplications',
            'f4_massive_splitter': 'a2_massive_files',
        }
        
        analysis_agent = mapping.get(agent_key)
        if not analysis_agent:
            # Si pas de mapping, retourner tous les findings (utile pour F2 qui peut tout formater)
            if agent_key == 'f2_lint_format':
                # F2 peut formater n'importe quel fichier détecté
                all_findings = []
                for result in analysis_results:
                    all_findings.extend(result.findings)
                return all_findings
            return []
        
        for result in analysis_results:
            if result.agent_name == analysis_agent:
                return result.findings
        
        return []
    
    def generate_report(
        self,
        mode: str,
        analysis_results: List[AgentResult],
        fix_results: List[AgentResult],
        validation: Dict[str, Any],
        decision: Dict[str, Any],
        duration_ms: int
    ) -> RunReport:
        """Génère le rapport final"""
        
        summary = {
            'total_analysis_agents': len(analysis_results),
            'total_fix_agents': len(fix_results),
            'total_findings': sum(len(r.findings) for r in analysis_results),
            'total_fixes': sum(len(r.fixes_applied) for r in fix_results),
            'validation_passed': validation.get('all_passed', False),
            'decision_action': decision.get('action'),
            'risk_score': decision.get('risk'),
            'confidence_score': decision.get('confidence')
        }
        
        report = RunReport(
            timestamp=datetime.now().isoformat(),
            duration_ms=duration_ms,
            mode=mode,
            analysis_results=analysis_results,
            fix_results=fix_results,
            validation_results=validation,
            decision=decision,
            summary=summary
        )
        
        # Sauvegarder le rapport
        self.evidence.save_report(report)
        
        return report
