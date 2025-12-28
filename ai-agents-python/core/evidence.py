"""
Evidence Logger - Traçabilité complète des opérations

Enregistre toutes les actions pour audit et débug.
"""

import json
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List
from dataclasses import asdict


class EvidenceLogger:
    """
    Logger de preuves pour traçabilité complète
    
    Enregistre dans .ai-agents/:
    - evidence/ : JSON détaillés par run
    - reports/ : Rapports markdown
    - logs/ : Logs texte
    """
    
    def __init__(self, ai_agents_dir: Path):
        self.base_dir = ai_agents_dir
        self.evidence_dir = self.base_dir / "evidence"
        self.reports_dir = self.base_dir / "reports"
        self.logs_dir = self.base_dir / "logs"
        
        # Créer les répertoires
        for dir_path in [self.evidence_dir, self.reports_dir, self.logs_dir]:
            dir_path.mkdir(parents=True, exist_ok=True)
        
        # Session courante
        self.session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.session_data = {
            'session_id': self.session_id,
            'start_time': datetime.now().isoformat(),
            'analysis': [],
            'fixes': [],
            'validation': {},
            'decision': {}
        }
    
    def log_analysis(self, agent_name: str, result: Any):
        """Enregistre un résultat d'analyse"""
        entry = {
            'timestamp': datetime.now().isoformat(),
            'agent': agent_name,
            'result': asdict(result) if hasattr(result, '__dataclass_fields__') else result
        }
        self.session_data['analysis'].append(entry)
        
        # Log aussi en texte
        self._append_log(f"[ANALYSIS] {agent_name}: {result.status} - {len(result.findings)} finding(s)")
    
    def log_fix(self, agent_name: str, result: Any):
        """Enregistre un résultat de correction"""
        entry = {
            'timestamp': datetime.now().isoformat(),
            'agent': agent_name,
            'result': asdict(result) if hasattr(result, '__dataclass_fields__') else result
        }
        self.session_data['fixes'].append(entry)
        
        # Log aussi en texte
        self._append_log(f"[FIX] {agent_name}: {result.status} - {len(result.fixes_applied)} fix(es)")
    
    def log_validation(self, validation: Dict[str, Any]):
        """Enregistre les résultats de validation"""
        self.session_data['validation'] = {
            'timestamp': datetime.now().isoformat(),
            'results': validation
        }
        
        # Log aussi en texte
        status = "✅ PASS" if validation.get('all_passed') else "❌ FAIL"
        self._append_log(f"[VALIDATION] {status} - {len(validation.get('gates', {}))} gate(s)")
    
    def log_decision(self, decision: Dict[str, Any]):
        """Enregistre la décision finale"""
        self.session_data['decision'] = decision
        
        # Log aussi en texte
        self._append_log(
            f"[DECISION] Action: {decision['action']} | "
            f"Risk: {decision['risk']}/100 | "
            f"Confidence: {decision['confidence']}/100"
        )
    
    def save_report(self, report: Any) -> str:
        """
        Sauvegarde le rapport final
        
        Returns:
            Path du rapport sauvegardé
        """
        # JSON détaillé
        json_path = self.evidence_dir / f"session_{self.session_id}.json"
        with open(json_path, 'w', encoding='utf-8') as f:
            if hasattr(report, '__dataclass_fields__'):
                json.dump(asdict(report), f, indent=2, ensure_ascii=False)
            else:
                json.dump(report, f, indent=2, ensure_ascii=False)
        
        # Markdown lisible
        md_path = self.reports_dir / f"report_{self.session_id}.md"
        markdown = self._generate_markdown_report(report)
        with open(md_path, 'w', encoding='utf-8') as f:
            f.write(markdown)
        
        # Sauvegarder aussi session_data
        session_path = self.evidence_dir / f"session_{self.session_id}_details.json"
        with open(session_path, 'w', encoding='utf-8') as f:
            json.dump(self.session_data, f, indent=2, ensure_ascii=False)
        
        print(f"\n💾 Evidence sauvegardée:")
        print(f"   📄 {json_path}")
        print(f"   📝 {md_path}")
        print(f"   🔍 {session_path}")
        
        return str(md_path)
    
    def _append_log(self, message: str):
        """Ajoute une ligne au log texte"""
        log_path = self.logs_dir / f"session_{self.session_id}.log"
        timestamp = datetime.now().strftime("%H:%M:%S")
        with open(log_path, 'a', encoding='utf-8') as f:
            f.write(f"[{timestamp}] {message}\n")
    
    def _generate_markdown_report(self, report: Any) -> str:
        """Génère un rapport markdown lisible"""
        
        # Extraire les données
        if hasattr(report, '__dataclass_fields__'):
            data = asdict(report)
        else:
            data = report
        
        md = "# 🤖 AI Agents - Rapport d'Exécution\n\n"
        
        # En-tête
        md += f"**Session**: `{self.session_id}`\n"
        md += f"**Date**: {data.get('timestamp', 'N/A')}\n"
        md += f"**Durée**: {data.get('duration_ms', 0)}ms\n"
        md += f"**Mode**: {data.get('mode', 'N/A')}\n\n"
        
        md += "---\n\n"
        
        # Résumé
        summary = data.get('summary', {})
        md += "## 📊 Résumé\n\n"
        md += f"- **Agents d'analyse**: {summary.get('total_analysis_agents', 0)}\n"
        md += f"- **Agents de correction**: {summary.get('total_fix_agents', 0)}\n"
        md += f"- **Findings détectés**: {summary.get('total_findings', 0)}\n"
        md += f"- **Corrections appliquées**: {summary.get('total_fixes', 0)}\n"
        md += f"- **Validation**: {'✅ PASS' if summary.get('validation_passed') else '❌ FAIL'}\n\n"
        
        # Décision
        decision = data.get('decision', {})
        md += "## 🎯 Décision Finale\n\n"
        md += f"- **Action**: `{decision.get('action', 'N/A')}`\n"
        md += f"- **Risk Score**: {decision.get('risk', 0)}/100\n"
        md += f"- **Confidence Score**: {decision.get('confidence', 0)}/100\n\n"
        
        action_emoji = {
            'AUTO_COMMIT': '✅',
            'REVIEW_REQUIRED': '⚠️',
            'REJECT': '❌'
        }
        emoji = action_emoji.get(decision.get('action'), '❓')
        md += f"### {emoji} {decision.get('action', 'N/A')}\n\n"
        
        if decision.get('action') == 'AUTO_COMMIT':
            md += "✅ **Commit autorisé** - Risque faible, confiance élevée\n\n"
        elif decision.get('action') == 'REVIEW_REQUIRED':
            md += "⚠️ **Review requise** - Risque moyen ou confiance moyenne\n\n"
        else:
            md += "❌ **Commit bloqué** - Risque trop élevé ou confiance trop faible\n\n"
        
        # Agents d'analyse
        analysis_results = data.get('analysis_results', [])
        if analysis_results:
            md += "## 🔍 Agents d'Analyse\n\n"
            for result in analysis_results:
                status_emoji = '✅' if result['status'] == 'success' else '❌'
                md += f"### {status_emoji} {result['agent_name']}\n\n"
                md += f"- **Status**: {result['status']}\n"
                md += f"- **Durée**: {result['duration_ms']}ms\n"
                md += f"- **Findings**: {len(result.get('findings', []))}\n"
                
                if result.get('errors'):
                    md += f"- **Erreurs**: {len(result['errors'])}\n"
                    for error in result['errors']:
                        md += f"  - ❌ {error}\n"
                
                md += "\n"
                
                # Détails des findings (limité aux 5 premiers)
                findings = result.get('findings', [])
                if findings:
                    md += "**Findings détectés**:\n\n"
                    for i, finding in enumerate(findings[:5]):
                        if isinstance(finding, dict):
                            file_path = finding.get('file_path', finding.get('path', 'N/A'))
                            reason = finding.get('reason', finding.get('message', 'N/A'))
                            md += f"{i+1}. `{file_path}` - {reason}\n"
                        else:
                            md += f"{i+1}. {finding}\n"
                    
                    if len(findings) > 5:
                        md += f"\n... et {len(findings) - 5} autre(s)\n"
                    md += "\n"
        
        # Agents de correction
        fix_results = data.get('fix_results', [])
        if fix_results:
            md += "## 🔧 Agents de Correction\n\n"
            for result in fix_results:
                status_emoji = '✅' if result['status'] == 'success' else '❌'
                md += f"### {status_emoji} {result['agent_name']}\n\n"
                md += f"- **Status**: {result['status']}\n"
                md += f"- **Durée**: {result['duration_ms']}ms\n"
                md += f"- **Corrections appliquées**: {len(result.get('fixes_applied', []))}\n\n"
                
                # Détails des fixes (limité aux 5 premiers)
                fixes = result.get('fixes_applied', [])
                if fixes:
                    md += "**Corrections effectuées**:\n\n"
                    for i, fix in enumerate(fixes[:5]):
                        if isinstance(fix, dict):
                            file_path = fix.get('file_path', 'N/A')
                            action = fix.get('action', 'N/A')
                            md += f"{i+1}. `{file_path}` - {action}\n"
                        else:
                            md += f"{i+1}. {fix}\n"
                    
                    if len(fixes) > 5:
                        md += f"\n... et {len(fixes) - 5} autre(s)\n"
                    md += "\n"
        
        # Validation
        validation = data.get('validation_results', {})
        if validation:
            md += "## 🧪 Validation (Gates)\n\n"
            gates = validation.get('gates', {})
            
            for gate_name, gate_result in gates.items():
                passed = gate_result.get('passed', False)
                emoji = '✅' if passed else '❌'
                md += f"### {emoji} {gate_name}\n\n"
                md += f"- **Passed**: {passed}\n"
                md += f"- **Score**: {gate_result.get('score', 'N/A')}\n"
                
                if gate_result.get('error'):
                    md += f"- **Erreur**: {gate_result['error']}\n"
                
                md += "\n"
            
            if validation.get('critical_failures'):
                md += "**⚠️ Échecs critiques**:\n\n"
                for failure in validation['critical_failures']:
                    md += f"- ❌ {failure}\n"
                md += "\n"
        
        # Footer
        md += "---\n\n"
        md += f"*Généré le {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*\n"
        
        return md
    
    def get_session_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Récupère l'historique des sessions
        
        Args:
            limit: Nombre max de sessions à retourner
        
        Returns:
            Liste des sessions (plus récentes en premier)
        """
        sessions = []
        
        # Lister tous les fichiers de session
        session_files = sorted(
            self.evidence_dir.glob("session_*.json"),
            key=lambda p: p.stat().st_mtime,
            reverse=True
        )
        
        for session_file in session_files[:limit]:
            try:
                with open(session_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    sessions.append(data)
            except Exception as e:
                print(f"⚠️  Impossible de lire {session_file}: {e}")
        
        return sessions
    
    def cleanup_old_sessions(self, keep_days: int = 30):
        """
        Nettoie les anciennes sessions
        
        Args:
            keep_days: Nombre de jours à conserver
        """
        import time
        
        cutoff_time = time.time() - (keep_days * 24 * 60 * 60)
        removed_count = 0
        
        for dir_path in [self.evidence_dir, self.reports_dir, self.logs_dir]:
            for file_path in dir_path.iterdir():
                if file_path.stat().st_mtime < cutoff_time:
                    file_path.unlink()
                    removed_count += 1
        
        if removed_count > 0:
            print(f"🧹 {removed_count} ancien(s) fichier(s) supprimé(s)")
