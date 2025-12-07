"""
Analyse Complète avec TOUS les 12 agents d'analyse.

Exécute:
- A1: Security (vulnérabilités)
- A2: Massive Files (fichiers trop gros)
- A3: Duplications (code dupliqué)
- A4: Dead Code (code mort)
- A5: Complexity (complexité)
- A6: Dependencies (dépendances)
- A7: Performance (performance)
- A8: Accessibility (accessibilité)
- A9: SEO (référencement)
- A10: I18n (internationalisation)
- A11: Tests (couverture tests)
- A12: Documentation (documentation)
"""

import json
import subprocess
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, Any


def run_agent(agent_name: str, agent_file: str, workspace: Path) -> Dict[str, Any]:
    """Exécute un agent et retourne ses résultats."""
    
    print(f"\n{agent_name}...")
    start = datetime.now()
    
    try:
        # Timeout plus long pour A6 Dependencies
        timeout = 120 if 'a6_' in agent_file else 60
        
        result = subprocess.run(
            ['python', f'agents/analysis/{agent_file}', str(workspace)],
            capture_output=True,
            text=True,
            timeout=timeout
        )
        
        # Parser les résultats depuis le JSON généré
        json_file = Path(agent_file.replace('.py', '_results.json'))
        if json_file.exists():
            with open(json_file, 'r', encoding='utf-8') as f:
                agent_results = json.load(f)
            json_file.unlink()  # Supprimer le fichier temporaire
        else:
            agent_results = {}
        
        duration = (datetime.now() - start).total_seconds()
        
        return {
            'status': 'success',
            'duration': duration,
            'results': agent_results,
        }
    
    except Exception as e:
        duration = (datetime.now() - start).total_seconds()
        return {
            'status': 'error',
            'duration': duration,
            'error': str(e),
        }


def run_full_analysis() -> Dict[str, Any]:
    """Exécute tous les 12 agents d'analyse."""
    
    workspace = Path('/workspaces/nestjs-remix-monorepo')
    
    print("=" * 80)
    print("🤖 ANALYSE COMPLÈTE - 12 AGENTS")
    print("=" * 80)
    print(f"📁 Workspace: {workspace}")
    print(f"⏰ Début: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    results = {
        'timestamp': datetime.now().isoformat(),
        'workspace': str(workspace),
        'agents': {},
        'summary': {},
        'duration_seconds': 0,
    }
    
    start_time = datetime.now()
    
    # Liste des agents à exécuter
    agents = [
        ('🔒 A1 - Security', 'a1_security.py'),
        ('📄 A2 - Massive Files', 'a2_massive_files.py'),
        ('🔁 A3 - Duplications', 'a3_duplications.py'),
        ('💀 A4 - Dead Code', 'a4_dead_code.py'),
        ('🧠 A5 - Complexity', 'a5_complexity.py'),
        ('📦 A6 - Dependencies', 'a6_dependencies.py'),
        ('⚡ A7 - Performance', 'a7_performance.py'),
        ('♿ A8 - Accessibility', 'a8_accessibility.py'),
        ('🔍 A9 - SEO', 'a9_seo.py'),
        ('🌍 A10 - I18n', 'a10_i18n.py'),
        ('🧪 A11 - Tests', 'a11_tests.py'),
        ('📚 A12 - Documentation', 'a12_documentation.py'),
    ]
    
    # Exécuter chaque agent
    for agent_name, agent_file in agents:
        agent_key = agent_file.replace('.py', '').replace('_', '-')
        agent_result = run_agent(agent_name, agent_file, workspace)
        results['agents'][agent_key] = agent_result
        
        # Afficher le résumé
        if agent_result['status'] == 'success':
            data = agent_result['results']
            
            # Gérer les différents formats de retour
            if isinstance(data, list):
                total = len(data)
            elif isinstance(data, dict):
                total = data.get('total_issues', 
                       data.get('total_vulnerabilities',
                       data.get('total_complex_functions',
                       data.get('total_hardcoded',
                       data.get('total_missing_tests',
                       data.get('total_undocumented',
                       len(data.get('findings', []))))))))
            else:
                total = 0
            
            print(f"   ✓ {total} problèmes ({agent_result['duration']:.2f}s)")
        else:
            print(f"   ❌ Erreur: {agent_result.get('error', 'Unknown')}")
    
    # Calculer la durée totale
    total_duration = (datetime.now() - start_time).total_seconds()
    results['duration_seconds'] = total_duration
    
    # Calculer le résumé
    print("\n" + "=" * 80)
    print("📊 RÉSUMÉ GLOBAL")
    print("=" * 80)
    
    successful = sum(1 for a in results['agents'].values() if a['status'] == 'success')
    failed = sum(1 for a in results['agents'].values() if a['status'] == 'error')
    
    print(f"\n✅ Agents exécutés: {successful}/{len(agents)}")
    if failed > 0:
        print(f"❌ Agents en erreur: {failed}")
    
    print(f"\n⏱️  Durée totale: {total_duration:.2f}s")
    
    # Compter les issues critiques totales
    total_critical = 0
    total_high = 0
    total_issues = 0
    
    for agent_key, agent_data in results['agents'].items():
        if agent_data['status'] == 'success' and 'results' in agent_data:
            data = agent_data['results']
            
            # Gérer les différents formats de retour
            if isinstance(data, dict):
                # Essayer différentes structures de données
                if 'severity_counts' in data:
                    total_critical += data['severity_counts'].get('CRITICAL', 0)
                    total_high += data['severity_counts'].get('HIGH', 0)
                
                # Compter le total d'issues
                total = data.get('total_issues', 
                       data.get('total_vulnerabilities',
                       data.get('total_complex_functions',
                       data.get('total_hardcoded',
                       data.get('total_missing_tests',
                       data.get('total_undocumented', len(data.get('findings', []))))))))
            elif isinstance(data, list):
                total = len(data)
            else:
                total = 0
            
            total_issues += total
    
    results['summary'] = {
        'total_issues': total_issues,
        'critical_issues': total_critical,
        'high_issues': total_high,
        'successful_agents': successful,
        'failed_agents': failed,
    }
    
    print(f"\n🎯 Issues totales: {total_issues}")
    print(f"   🔴 CRITICAL: {total_critical}")
    print(f"   🟠 HIGH: {total_high}")
    
    return results


def generate_markdown_report(results: Dict[str, Any], output_file: Path):
    """Génère un rapport Markdown complet."""
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("# 🤖 Rapport d'Analyse Complète - 12 Agents\n\n")
        f.write(f"**Date**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"**Durée**: {results['duration_seconds']:.2f}s\n\n")
        f.write("---\n\n")
        
        f.write("## 📊 Vue d'Ensemble\n\n")
        f.write(f"- ✅ Agents réussis: {results['summary']['successful_agents']}/12\n")
        f.write(f"- ❌ Agents en erreur: {results['summary']['failed_agents']}\n")
        f.write(f"- 📈 Issues totales: {results['summary']['total_issues']}\n")
        f.write(f"- 🔴 Issues CRITICAL: {results['summary']['critical_issues']}\n")
        f.write(f"- 🟠 Issues HIGH: {results['summary']['high_issues']}\n\n")
        
        f.write("---\n\n")
        
        # Résumé par agent
        f.write("## 📋 Résumé par Agent\n\n")
        f.write("| Agent | Status | Durée | Issues |\n")
        f.write("|-------|--------|-------|--------|\n")
        
        agent_names = {
            'a1-security': '🔒 A1 Security',
            'a2-massive-files': '📄 A2 Massive Files',
            'a3-duplications': '🔁 A3 Duplications',
            'a4-dead-code': '💀 A4 Dead Code',
            'a5-complexity': '🧠 A5 Complexity',
            'a6-dependencies': '📦 A6 Dependencies',
            'a7-performance': '⚡ A7 Performance',
            'a8-accessibility': '♿ A8 Accessibility',
            'a9-seo': '🔍 A9 SEO',
            'a10-i18n': '🌍 A10 I18n',
            'a11-tests': '🧪 A11 Tests',
            'a12-documentation': '📚 A12 Documentation',
        }
        
        for agent_key, agent_name in agent_names.items():
            if agent_key in results['agents']:
                agent = results['agents'][agent_key]
                status = '✅' if agent['status'] == 'success' else '❌'
                duration = f"{agent['duration']:.2f}s"
                
                if agent['status'] == 'success' and 'results' in agent:
                    data = agent['results']
                    
                    # Gérer les différents formats de retour
                    if isinstance(data, list):
                        issues = len(data)
                    elif isinstance(data, dict):
                        issues = data.get('total_issues',
                                data.get('total_vulnerabilities',
                                data.get('total_complex_functions',
                                data.get('total_hardcoded',
                                data.get('total_missing_tests',
                                data.get('total_undocumented', len(data.get('findings', []))))))))
                    else:
                        issues = 0
                else:
                    issues = 0
                
                f.write(f"| {agent_name} | {status} | {duration} | {issues} |\n")
        
        f.write("\n---\n\n")
        
        # Détails par agent
        f.write("## 📝 Détails par Agent\n\n")
        
        for agent_key, agent_name in agent_names.items():
            if agent_key in results['agents']:
                agent = results['agents'][agent_key]
                
                f.write(f"### {agent_name}\n\n")
                
                if agent['status'] == 'success' and 'results' in agent:
                    data = agent['results']
                    
                    # Statistiques de base
                    if isinstance(data, list):
                        f.write(f"- **Total**: {len(data)} problèmes\n")
                    elif isinstance(data, dict):
                        total = data.get('total_issues',
                                data.get('total_vulnerabilities',
                                data.get('total_complex_functions',
                                data.get('total_hardcoded',
                                data.get('total_missing_tests',
                                data.get('total_undocumented', len(data.get('findings', []))))))))
                        f.write(f"- **Total**: {total} problèmes\n")
                        
                        # Sévérités
                        if 'severity_counts' in data:
                            f.write("- **Sévérités**:\n")
                            for sev, count in sorted(data['severity_counts'].items(), 
                                                    key=lambda x: {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3}.get(x[0], 4)):
                                icon = {'CRITICAL': '🔴', 'HIGH': '🟠', 'MEDIUM': '🟡', 'LOW': '🔵'}.get(sev, '⚪')
                                f.write(f"  - {icon} {sev}: {count}\n")
                        
                        # Catégories
                        if 'category_counts' in data:
                            f.write("- **Top Catégories**:\n")
                            top_categories = sorted(data['category_counts'].items(), 
                                                   key=lambda x: x[1], reverse=True)[:5]
                            for cat, count in top_categories:
                                f.write(f"  - {cat}: {count}\n")
                        
                        # Statistiques spécifiques à certains agents
                        if 'total_files_scanned' in data:
                            f.write(f"- **Fichiers scannés**: {data['total_files_scanned']}\n")
                        if 'code_files' in data:
                            f.write(f"- **Fichiers code**: {data['code_files']}\n")
                        if 'test_files' in data:
                            f.write(f"- **Fichiers test**: {data['test_files']}\n")
                        if 'estimated_coverage' in data:
                            f.write(f"- **Couverture estimée**: {data['estimated_coverage']:.1f}%\n")
                        if 'untested_loc' in data:
                            f.write(f"- **LOC non testées**: {data['untested_loc']:,}\n")
                    
                    f.write(f"- **Durée**: {agent['duration']:.2f}s\n")
                else:
                    f.write(f"- ❌ **Erreur**: {agent.get('error', 'Unknown')}\n")
                
                f.write("\n")
        
        f.write("---\n\n")
        
        # Recommandations
        f.write("## 💡 Recommandations Prioritaires\n\n")
        
        if results['summary']['critical_issues'] > 0:
            f.write(f"### 🔥 URGENT ({results['summary']['critical_issues']} issues CRITICAL)\n\n")
            f.write("1. **Sécurité**: Corriger les vulnérabilités critiques\n")
            f.write("2. **Performance**: Optimiser les fichiers bloquants\n")
            f.write("3. **Accessibilité**: Ajouter les labels ARIA manquants\n")
            f.write("4. **Complexité**: Simplifier les fonctions critiques\n\n")
        
        if results['summary']['high_issues'] > 0:
            f.write(f"### ⚠️  IMPORTANT ({results['summary']['high_issues']} issues HIGH)\n\n")
            f.write("1. **Dépendances**: Mettre à jour les packages vulnérables\n")
            f.write("2. **Tests**: Ajouter la couverture manquante\n")
            f.write("3. **Documentation**: Documenter les APIs publiques\n")
            f.write("4. **I18n**: Externaliser les textes hardcodés\n\n")
        
        f.write("### 📋 Moyen Terme\n\n")
        f.write("1. **Refactoring**: Découper les fichiers massifs\n")
        f.write("2. **DRY**: Extraire les duplications\n")
        f.write("3. **SEO**: Ajouter les meta tags manquants\n")
        f.write("4. **Performance**: Optimiser les bundles\n\n")


def main():
    """Point d'entrée principal."""
    
    # Exécuter l'analyse
    results = run_full_analysis()
    
    # Sauvegarder les résultats JSON
    json_file = Path('reports/full_analysis_12_agents.json')
    json_file.parent.mkdir(exist_ok=True)
    
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Résultats JSON: {json_file}")
    
    # Générer le rapport Markdown
    md_file = Path('reports/FULL_ANALYSIS_12_AGENTS.md')
    generate_markdown_report(results, md_file)
    
    print(f"💾 Rapport Markdown: {md_file}")
    
    print("\n" + "=" * 80)
    print("✅ ANALYSE COMPLÈTE DES 12 AGENTS TERMINÉE")
    print("=" * 80)
    
    return 0 if results['summary']['failed_agents'] == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
