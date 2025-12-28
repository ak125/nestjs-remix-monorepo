#!/usr/bin/env python3
"""
Generate Report - Génère un rapport détaillé de l'analyse complète

Exécute tous les agents d'analyse et génère un rapport Markdown complet.

Usage:
    python generate_report.py
    python generate_report.py --output custom-report.md
    python generate_report.py --format json
"""

import sys
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List
from collections import defaultdict

from core.config import Config
from core.runner import AgentRunner


def generate_markdown_report(analysis_results: List[Any], output_path: Path):
    """Génère un rapport Markdown détaillé"""
    
    with open(output_path, 'w', encoding='utf-8') as f:
        # En-tête
        f.write("# 📊 Rapport d'Analyse AI Agents\n\n")
        f.write(f"**Date**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write("---\n\n")
        
        # Sommaire exécutif
        f.write("## 📈 Sommaire Exécutif\n\n")
        
        total_findings = sum(len(r.findings) for r in analysis_results)
        f.write(f"- **Agents exécutés**: {len(analysis_results)}\n")
        f.write(f"- **Findings totaux**: {total_findings}\n")
        f.write(f"- **Durée totale**: {sum(r.duration_ms for r in analysis_results) / 1000:.1f}s\n\n")
        
        # Table des matières
        f.write("## 📑 Table des Matières\n\n")
        for result in analysis_results:
            if result.findings:
                agent_name = result.agent_name.upper().replace('_', ' ')
                f.write(f"- [{agent_name}](#{result.agent_name})\n")
        f.write("\n---\n\n")
        
        # Détail par agent
        for result in analysis_results:
            if not result.findings:
                continue
            
            agent_name = result.agent_name.upper().replace('_', ' ')
            f.write(f"## {agent_name}\n\n")
            f.write(f"**Findings**: {len(result.findings)}\n")
            f.write(f"**Durée**: {result.duration_ms / 1000:.2f}s\n")
            f.write(f"**Statut**: {result.status}\n\n")
            
            # Spécifique à chaque agent
            if result.agent_name == 'a2_massive_files':
                generate_a2_section(result.findings, f)
            elif result.agent_name == 'a3_duplications':
                generate_a3_section(result.findings, f)
            elif result.agent_name == 'a4_dead_code':
                generate_a4_section(result.findings, f)
            
            f.write("\n---\n\n")
        
        # Recommandations
        f.write("## 💡 Recommandations\n\n")
        generate_recommendations(analysis_results, f)
        
        # Footer
        f.write("\n---\n\n")
        f.write("*Généré par AI Agents Python - Système d'analyse automatique*\n")


def generate_a2_section(findings: List[Dict], f):
    """Section détaillée A2 - Massive Files"""
    
    # Grouper par sévérité
    by_severity = defaultdict(list)
    for finding in findings:
        severity = finding.get('severity', 'unknown')
        by_severity[severity].append(finding)
    
    f.write("### 📊 Statistiques par Sévérité\n\n")
    f.write("| Sévérité | Nombre | Lignes Moy. | Dépassement Moy. |\n")
    f.write("|----------|--------|-------------|------------------|\n")
    
    severity_order = ['critical', 'high', 'medium', 'warning']
    severity_icons = {'critical': '🔴', 'high': '🟠', 'medium': '🟡', 'warning': '🟢'}
    
    for sev in severity_order:
        if sev not in by_severity:
            continue
        
        items = by_severity[sev]
        icon = severity_icons.get(sev, '⚪')
        avg_lines = sum(f['lines'] for f in items) / len(items)
        avg_threshold = sum(f['threshold'] for f in items) / len(items)
        avg_ratio = (avg_lines / avg_threshold - 1) * 100 if avg_threshold > 0 else 0
        
        f.write(f"| {icon} {sev.upper()} | {len(items)} | {int(avg_lines)} | +{int(avg_ratio)}% |\n")
    
    f.write("\n### 🔝 Top 10 Fichiers les Plus Massifs\n\n")
    f.write("| # | Fichier | Lignes | Seuil | Dépassement | Sévérité |\n")
    f.write("|---|---------|--------|-------|-------------|----------|\n")
    
    # Trier par lignes (desc)
    sorted_findings = sorted(findings, key=lambda x: x['lines'], reverse=True)
    
    for i, finding in enumerate(sorted_findings[:10], 1):
        file_path = finding['file_path']
        lines = finding['lines']
        threshold = finding['threshold']
        ratio = ((lines - threshold) / threshold * 100) if threshold > 0 else 0
        severity = finding.get('severity', 'unknown')
        icon = severity_icons.get(severity, '⚪')
        
        # Tronquer path si trop long
        display_path = file_path if len(file_path) < 50 else '...' + file_path[-47:]
        
        f.write(f"| {i} | `{display_path}` | {lines} | {threshold} | +{ratio:.0f}% | {icon} {severity} |\n")
    
    f.write("\n### 💡 Suggestions de Refactoring\n\n")
    
    # Grouper suggestions
    for sev in severity_order:
        if sev not in by_severity:
            continue
        
        icon = severity_icons.get(sev, '⚪')
        f.write(f"**{icon} {sev.upper()}**:\n\n")
        
        for finding in by_severity[sev][:3]:
            suggestions = finding.get('suggestions', [])
            if suggestions:
                file_path = Path(finding['file_path']).name
                f.write(f"- `{file_path}` ({finding['lines']}L): {suggestions[0]}\n")
        
        f.write("\n")


def generate_a3_section(findings: List[Dict], f):
    """Section détaillée A3 - Duplications"""
    
    f.write("### 📊 Statistiques Globales\n\n")
    
    total_occurrences = sum(f.get('occurrences', 0) for f in findings)
    total_impact = sum(f.get('impact_score', 0) for f in findings)
    
    f.write(f"- **Duplications détectées**: {len(findings)}\n")
    f.write(f"- **Occurrences totales**: {total_occurrences}\n")
    f.write(f"- **Impact total**: {total_impact}\n\n")
    
    # Grouper par sévérité
    by_severity = defaultdict(list)
    for finding in findings:
        severity = finding.get('severity', 'minor')
        by_severity[severity].append(finding)
    
    f.write("| Sévérité | Nombre | Impact Moy. |\n")
    f.write("|----------|--------|-------------|\n")
    
    for sev in ['critical', 'high', 'medium', 'minor']:
        if sev in by_severity:
            items = by_severity[sev]
            avg_impact = sum(f.get('impact_score', 0) for f in items) / len(items)
            f.write(f"| {sev.upper()} | {len(items)} | {int(avg_impact)} |\n")
    
    f.write("\n### 🔝 Top 10 Duplications par Impact\n\n")
    
    # Trier par impact
    sorted_findings = sorted(findings, key=lambda x: x.get('impact_score', 0), reverse=True)
    
    for i, finding in enumerate(sorted_findings[:10], 1):
        files = finding.get('files', [])
        occurrences = finding.get('occurrences', 0)
        impact = finding.get('impact_score', 0)
        fragment = finding.get('fragment', '')[:80]
        
        f.write(f"**{i}. Impact: {impact}** ({occurrences} occurrences)\n\n")
        f.write(f"- Fichiers: {len(files)}\n")
        f.write(f"- Fragment: `{fragment}...`\n\n")


def generate_a4_section(findings: List[Dict], f):
    """Section détaillée A4 - Dead Code"""
    
    if not findings:
        f.write("✅ **Aucun code mort détecté** - Le projet est propre !\n\n")
        return
    
    f.write("### 📊 Statistiques\n\n")
    f.write(f"- **Fichiers avec code mort**: {len(findings)}\n\n")
    
    f.write("### 📋 Liste des Fichiers\n\n")
    
    for i, finding in enumerate(findings, 1):
        file_path = finding.get('file_path', 'unknown')
        reason = finding.get('reason', 'No details')
        
        f.write(f"{i}. `{file_path}`\n")
        f.write(f"   - Raison: {reason}\n\n")


def generate_recommendations(analysis_results: List[Any], f):
    """Génère recommandations basées sur l'analyse"""
    
    # Compter findings par type
    massive_files = next((len(r.findings) for r in analysis_results if r.agent_name == 'a2_massive_files'), 0)
    duplications = next((len(r.findings) for r in analysis_results if r.agent_name == 'a3_duplications'), 0)
    dead_code = next((len(r.findings) for r in analysis_results if r.agent_name == 'a4_dead_code'), 0)
    
    priority_actions = []
    
    # Fichiers massifs
    if massive_files > 100:
        priority_actions.append({
            'priority': 'HAUTE',
            'action': 'Refactoriser fichiers massifs',
            'reason': f'{massive_files} fichiers dépassent les seuils',
            'command': '`python format_one_by_one.py --severity critical`'
        })
    elif massive_files > 50:
        priority_actions.append({
            'priority': 'MOYENNE',
            'action': 'Nettoyer fichiers massifs',
            'reason': f'{massive_files} fichiers à optimiser',
            'command': '`python format_massive_files.py --batch-size 30`'
        })
    
    # Duplications
    if duplications > 500:
        priority_actions.append({
            'priority': 'HAUTE',
            'action': 'Réduire duplications de code',
            'reason': f'{duplications} duplications détectées',
            'command': 'Extraire composants réutilisables, créer hooks partagés'
        })
    elif duplications > 100:
        priority_actions.append({
            'priority': 'MOYENNE',
            'action': 'Examiner duplications critiques',
            'reason': f'{duplications} duplications à analyser',
            'command': 'Voir rapport A3 pour top 10'
        })
    
    # Code mort
    if dead_code > 0:
        priority_actions.append({
            'priority': 'FAIBLE',
            'action': 'Supprimer code mort',
            'reason': f'{dead_code} fichiers non utilisés',
            'command': '`python run.py` avec F1 Dead Code Surgeon activé'
        })
    
    # Afficher recommandations
    if priority_actions:
        f.write("### 🎯 Actions Prioritaires\n\n")
        
        for action in sorted(priority_actions, key=lambda x: {'HAUTE': 0, 'MOYENNE': 1, 'FAIBLE': 2}[x['priority']]):
            priority_icon = {'HAUTE': '🔴', 'MOYENNE': '🟡', 'FAIBLE': '🟢'}[action['priority']]
            
            f.write(f"**{priority_icon} {action['priority']}**: {action['action']}\n\n")
            f.write(f"- **Raison**: {action['reason']}\n")
            f.write(f"- **Action**: {action['command']}\n\n")
    else:
        f.write("✅ **Aucune action urgente nécessaire**\n\n")
        f.write("Le projet est dans un état acceptable. Continuez les bonnes pratiques !\n\n")
    
    # Prochaines étapes
    f.write("### 🚀 Prochaines Étapes\n\n")
    f.write("1. **Formatage automatique**:\n")
    f.write("   ```bash\n")
    f.write("   python format_one_by_one.py --severity critical --max-files 10\n")
    f.write("   ```\n\n")
    
    f.write("2. **Mode incrémental** (pour gros volumes):\n")
    f.write("   ```bash\n")
    f.write("   python run_incremental.py --batch-size 20\n")
    f.write("   ```\n\n")
    
    f.write("3. **Validation complète**:\n")
    f.write("   ```bash\n")
    f.write("   python run.py\n")
    f.write("   ```\n\n")


def generate_json_report(analysis_results: List[Any], output_path: Path):
    """Génère un rapport JSON pour traitement automatique"""
    
    report = {
        'timestamp': datetime.now().isoformat(),
        'agents': [],
        'summary': {
            'total_agents': len(analysis_results),
            'total_findings': sum(len(r.findings) for r in analysis_results),
            'total_duration_ms': sum(r.duration_ms for r in analysis_results)
        }
    }
    
    for result in analysis_results:
        report['agents'].append({
            'name': result.agent_name,
            'status': result.status,
            'duration_ms': result.duration_ms,
            'findings_count': len(result.findings),
            'findings': result.findings[:100]  # Limiter pour taille JSON
        })
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Générer rapport d\'analyse')
    parser.add_argument('--output', '-o', default='ANALYSIS-REPORT.md',
                       help='Fichier de sortie (default: ANALYSIS-REPORT.md)')
    parser.add_argument('--format', choices=['markdown', 'json'], default='markdown',
                       help='Format du rapport (default: markdown)')
    
    args = parser.parse_args()
    
    workspace_root = Path(__file__).parent.parent
    config = Config.load(str(Path(__file__).parent / "config.yaml"))
    runner = AgentRunner(config, workspace_root)
    
    print("🔍 Exécution de l'analyse complète...\n")
    
    # Exécuter tous les agents d'analyse
    analysis_results = runner.run_analysis_agents()
    
    total_findings = sum(len(r.findings) for r in analysis_results)
    
    print(f"\n✅ Analyse terminée: {total_findings} finding(s)\n")
    
    # Générer rapport
    output_path = Path(args.output)
    
    print(f"📝 Génération du rapport {args.format}...")
    
    if args.format == 'markdown':
        generate_markdown_report(analysis_results, output_path)
    else:
        generate_json_report(analysis_results, output_path)
    
    print(f"✅ Rapport généré: {output_path}\n")
    
    # Stats
    print(f"📊 Statistiques:")
    print(f"   - Agents: {len(analysis_results)}")
    print(f"   - Findings: {total_findings}")
    print(f"   - Durée: {sum(r.duration_ms for r in analysis_results) / 1000:.1f}s")
    print(f"   - Taille: {output_path.stat().st_size / 1024:.1f} KB\n")
    
    return 0


if __name__ == '__main__':
    sys.exit(main())
