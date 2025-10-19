"""
Analyse Complète - Exécute tous les agents d'analyse et génère un rapport unifié.

Agents disponibles:
- A1: Security Vulnerabilities
- A2: Massive Files
- A3: Code Duplications
- A4: Dead Code
- A5: Code Complexity
- A6: Dependencies
"""

import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, Any


def run_analysis() -> Dict[str, Any]:
    """Exécute tous les agents d'analyse."""
    
    workspace = Path('/workspaces/nestjs-remix-monorepo')
    results = {
        'timestamp': datetime.now().isoformat(),
        'workspace': str(workspace),
        'agents': {},
        'summary': {},
        'duration_seconds': 0,
    }
    
    print("=" * 80)
    print("🤖 ANALYSE COMPLÈTE - TOUS LES AGENTS")
    print("=" * 80)
    print(f"📁 Workspace: {workspace}")
    print(f"⏰ Début: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    start_time = datetime.now()
    
    # A1 - Security
    print("\n🔒 A1 - Security Vulnerabilities...")
    try:
        a1_start = datetime.now()
        from agents.analysis.a1_security import A1SecurityAgent
        a1 = A1SecurityAgent(str(workspace))
        a1_results = a1.analyze()
        a1_duration = (datetime.now() - a1_start).total_seconds()
        
        results['agents']['a1_security'] = {
            'status': 'success',
            'duration': a1_duration,
            'results': a1_results,
        }
        
        print(f"   ✓ {a1_results['total_vulnerabilities']} vulnérabilités ({a1_duration:.2f}s)")
        print(f"     🔴 CRITICAL: {a1_results['severity_counts']['CRITICAL']}")
        print(f"     🟠 HIGH: {a1_results['severity_counts']['HIGH']}")
        print(f"     🟡 MEDIUM: {a1_results['severity_counts']['MEDIUM']}")
        print(f"     🟢 LOW: {a1_results['severity_counts']['LOW']}")
    except Exception as e:
        print(f"   ❌ Erreur: {e}")
        results['agents']['a1_security'] = {'status': 'error', 'error': str(e)}
    
    # A2 - Massive Files
    print("\n📄 A2 - Massive Files...")
    try:
        a2_start = datetime.now()
        # Utiliser l'agent directement comme script
        import subprocess
        result = subprocess.run(
            ['python', 'agents/analysis/a2_massive_files.py', str(workspace)],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        # Parser les résultats depuis le JSON généré
        a2_json = Path('a2_massive_files_results.json')
        if a2_json.exists():
            with open(a2_json, 'r', encoding='utf-8') as f:
                a2_results = json.load(f)
            a2_json.unlink()  # Supprimer le fichier temporaire
        else:
            a2_results = []
        
        a2_duration = (datetime.now() - a2_start).total_seconds()
        
        results['agents']['a2_massive_files'] = {
            'status': 'success',
            'duration': a2_duration,
            'results': a2_results,
        }
        
        total_files = len(a2_results)
        print(f"   ✓ {total_files} fichiers massifs ({a2_duration:.2f}s)")
    except Exception as e:
        print(f"   ❌ Erreur: {e}")
        results['agents']['a2_massive_files'] = {'status': 'error', 'error': str(e)}
    
    # A3 - Duplications
    print("\n🔁 A3 - Code Duplications...")
    try:
        a3_start = datetime.now()
        import subprocess
        result = subprocess.run(
            ['python', 'agents/analysis/a3_duplications.py', str(workspace)],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        # Parser les résultats
        a3_json = Path('a3_duplications_results.json')
        if a3_json.exists():
            with open(a3_json, 'r', encoding='utf-8') as f:
                a3_results = json.load(f)
            a3_json.unlink()
        else:
            a3_results = []
        
        a3_duration = (datetime.now() - a3_start).total_seconds()
        
        results['agents']['a3_duplications'] = {
            'status': 'success',
            'duration': a3_duration,
            'results': a3_results,
        }
        
        total_dups = len(a3_results)
        print(f"   ✓ {total_dups} duplications ({a3_duration:.2f}s)")
    except Exception as e:
        print(f"   ❌ Erreur: {e}")
        results['agents']['a3_duplications'] = {'status': 'error', 'error': str(e)}
    
    # A4 - Dead Code
    print("\n💀 A4 - Dead Code...")
    try:
        a4_start = datetime.now()
        import subprocess
        result = subprocess.run(
            ['python', 'agents/analysis/a4_dead_code.py', str(workspace)],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        # Parser les résultats
        a4_json = Path('a4_dead_code_results.json')
        if a4_json.exists():
            with open(a4_json, 'r', encoding='utf-8') as f:
                a4_results = json.load(f)
            a4_json.unlink()
        else:
            a4_results = []
        
        a4_duration = (datetime.now() - a4_start).total_seconds()
        
        results['agents']['a4_dead_code'] = {
            'status': 'success',
            'duration': a4_duration,
            'results': a4_results,
        }
        
        total_dead = len(a4_results)
        print(f"   ✓ {total_dead} éléments de code mort ({a4_duration:.2f}s)")
    except Exception as e:
        print(f"   ❌ Erreur: {e}")
        results['agents']['a4_dead_code'] = {'status': 'error', 'error': str(e)}
    
    # A5 - Complexity
    print("\n🧠 A5 - Code Complexity...")
    try:
        a5_start = datetime.now()
        from agents.analysis.a5_complexity import A5ComplexityAgent
        a5 = A5ComplexityAgent(str(workspace))
        a5_results = a5.analyze()
        a5_duration = (datetime.now() - a5_start).total_seconds()
        
        results['agents']['a5_complexity'] = {
            'status': 'success',
            'duration': a5_duration,
            'results': a5_results,
        }
        
        print(f"   ✓ {a5_results['total_complex_functions']} fonctions complexes ({a5_duration:.2f}s)")
        print(f"     🔴 CRITICAL: {a5_results['severity_counts']['CRITICAL']}")
        print(f"     🟠 HIGH: {a5_results['severity_counts']['HIGH']}")
        print(f"     🟡 MEDIUM: {a5_results['severity_counts']['MEDIUM']}")
        print(f"     Avg Cyclomatic: {a5_results['average_cyclomatic']}")
    except Exception as e:
        print(f"   ❌ Erreur: {e}")
        results['agents']['a5_complexity'] = {'status': 'error', 'error': str(e)}
    
    # A6 - Dependencies
    print("\n📦 A6 - Dependencies...")
    try:
        a6_start = datetime.now()
        from agents.analysis.a6_dependencies import A6DependenciesAgent
        a6 = A6DependenciesAgent(str(workspace))
        a6_results = a6.analyze()
        a6_duration = (datetime.now() - a6_start).total_seconds()
        
        results['agents']['a6_dependencies'] = {
            'status': 'success',
            'duration': a6_duration,
            'results': a6_results,
        }
        
        print(f"   ✓ {a6_results['total_issues']} problèmes ({a6_duration:.2f}s)")
        print(f"     Vulnerable: {a6_results['category_counts']['VULNERABLE']}")
        print(f"     Outdated: {a6_results['category_counts']['OUTDATED']}")
        print(f"     Deprecated: {a6_results['category_counts']['DEPRECATED']}")
    except Exception as e:
        print(f"   ❌ Erreur: {e}")
        results['agents']['a6_dependencies'] = {'status': 'error', 'error': str(e)}
    
    # Calculer la durée totale
    total_duration = (datetime.now() - start_time).total_seconds()
    results['duration_seconds'] = total_duration
    
    # Générer le résumé
    print("\n" + "=" * 80)
    print("📊 RÉSUMÉ")
    print("=" * 80)
    
    successful = sum(1 for a in results['agents'].values() if a['status'] == 'success')
    failed = sum(1 for a in results['agents'].values() if a['status'] == 'error')
    
    print(f"\n✅ Agents exécutés: {successful}/{len(results['agents'])}")
    if failed > 0:
        print(f"❌ Agents en erreur: {failed}")
    
    print(f"\n⏱️  Durée totale: {total_duration:.2f}s")
    
    # Résumé des problèmes critiques
    critical_count = 0
    high_count = 0
    
    if 'a1_security' in results['agents'] and results['agents']['a1_security']['status'] == 'success':
        a1 = results['agents']['a1_security']['results']
        critical_count += a1['severity_counts']['CRITICAL']
        high_count += a1['severity_counts']['HIGH']
    
    if 'a5_complexity' in results['agents'] and results['agents']['a5_complexity']['status'] == 'success':
        a5 = results['agents']['a5_complexity']['results']
        critical_count += a5['severity_counts']['CRITICAL']
        high_count += a5['severity_counts']['HIGH']
    
    results['summary'] = {
        'critical_issues': critical_count,
        'high_issues': high_count,
        'successful_agents': successful,
        'failed_agents': failed,
    }
    
    print(f"\n🎯 Issues prioritaires:")
    print(f"   🔴 CRITICAL: {critical_count}")
    print(f"   🟠 HIGH: {high_count}")
    
    return results


def generate_markdown_report(results: Dict[str, Any], output_file: Path):
    """Génère un rapport Markdown."""
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("# 🤖 Rapport d'Analyse Complète\n\n")
        f.write(f"**Date**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"**Durée**: {results['duration_seconds']:.2f}s\n\n")
        f.write("---\n\n")
        
        f.write("## 📊 Vue d'Ensemble\n\n")
        f.write(f"- ✅ Agents réussis: {results['summary']['successful_agents']}\n")
        f.write(f"- ❌ Agents en erreur: {results['summary']['failed_agents']}\n")
        f.write(f"- 🔴 Issues CRITICAL: {results['summary']['critical_issues']}\n")
        f.write(f"- 🟠 Issues HIGH: {results['summary']['high_issues']}\n\n")
        
        # A1 - Security
        if 'a1_security' in results['agents'] and results['agents']['a1_security']['status'] == 'success':
            a1 = results['agents']['a1_security']['results']
            f.write("## 🔒 A1 - Security Vulnerabilities\n\n")
            f.write(f"**Total**: {a1['total_vulnerabilities']} vulnérabilités\n\n")
            f.write("| Sévérité | Nombre |\n")
            f.write("|----------|--------|\n")
            f.write(f"| 🔴 CRITICAL | {a1['severity_counts']['CRITICAL']} |\n")
            f.write(f"| 🟠 HIGH | {a1['severity_counts']['HIGH']} |\n")
            f.write(f"| 🟡 MEDIUM | {a1['severity_counts']['MEDIUM']} |\n")
            f.write(f"| 🟢 LOW | {a1['severity_counts']['LOW']} |\n\n")
            
            # Top 10 vulnérabilités critiques
            critical_vulns = [v for v in a1['findings'] if v['severity'] == 'CRITICAL'][:10]
            if critical_vulns:
                f.write("### Top 10 Vulnérabilités CRITICAL\n\n")
                for i, vuln in enumerate(critical_vulns, 1):
                    f.write(f"{i}. **{vuln['category']}** - `{vuln['file']}:{vuln['line']}`\n")
                    f.write(f"   - {vuln['description']}\n")
                    f.write(f"   - Recommandation: {vuln['recommendation']}\n\n")
        
        # A2 - Massive Files
        if 'a2_massive_files' in results['agents'] and results['agents']['a2_massive_files']['status'] == 'success':
            a2 = results['agents']['a2_massive_files']['results']
            f.write("## 📄 A2 - Massive Files\n\n")
            f.write(f"**Total**: {len(a2)} fichiers massifs\n\n")
            
            # Top 10 plus gros fichiers
            sorted_files = sorted(a2, key=lambda x: x['lines'], reverse=True)[:10]
            f.write("### Top 10 Plus Gros Fichiers\n\n")
            f.write("| Fichier | Lignes | Dépassement |\n")
            f.write("|---------|--------|-------------|\n")
            for file in sorted_files:
                f.write(f"| `{file['file_path']}` | {file['lines']} | +{file.get('overage_percent', 0)}% |\n")
            f.write("\n")
        
        # A3 - Duplications
        if 'a3_duplications' in results['agents'] and results['agents']['a3_duplications']['status'] == 'success':
            a3 = results['agents']['a3_duplications']['results']
            f.write("## 🔁 A3 - Code Duplications\n\n")
            f.write(f"**Total**: {len(a3)} duplications détectées\n\n")
            
            # Top 10 par impact
            sorted_dups = sorted(a3, key=lambda x: x.get('impact_score', 0), reverse=True)[:10]
            f.write("### Top 10 Duplications (par impact)\n\n")
            f.write("| Impact | Occurrences | Fichiers |\n")
            f.write("|--------|-------------|----------|\n")
            for dup in sorted_dups:
                f.write(f"| {dup.get('impact_score', 0)} | {dup.get('occurrences', 0)} | {len(dup.get('files', []))} |\n")
            f.write("\n")
        
        # A5 - Complexity
        if 'a5_complexity' in results['agents'] and results['agents']['a5_complexity']['status'] == 'success':
            a5 = results['agents']['a5_complexity']['results']
            f.write("## 🧠 A5 - Code Complexity\n\n")
            f.write(f"**Total**: {a5['total_complex_functions']} fonctions complexes\n\n")
            f.write(f"- Complexité cyclomatique moyenne: {a5['average_cyclomatic']}\n")
            f.write(f"- Complexité cognitive moyenne: {a5['average_cognitive']}\n\n")
            
            f.write("| Sévérité | Nombre |\n")
            f.write("|----------|--------|\n")
            f.write(f"| 🔴 CRITICAL | {a5['severity_counts']['CRITICAL']} |\n")
            f.write(f"| 🟠 HIGH | {a5['severity_counts']['HIGH']} |\n")
            f.write(f"| 🟡 MEDIUM | {a5['severity_counts']['MEDIUM']} |\n")
            f.write(f"| 🟢 LOW | {a5['severity_counts']['LOW']} |\n\n")
            
            # Top 10 fonctions les plus complexes
            sorted_funcs = sorted(a5['findings'], key=lambda x: x['cyclomatic'], reverse=True)[:10]
            f.write("### Top 10 Fonctions les Plus Complexes\n\n")
            f.write("| Fonction | Fichier | Cyclomatic | Cognitive |\n")
            f.write("|----------|---------|------------|-----------|\n")
            for func in sorted_funcs:
                f.write(f"| `{func['function']}` | `{func['file']}` | {func['cyclomatic']} | {func['cognitive']} |\n")
            f.write("\n")
        
        # A6 - Dependencies
        if 'a6_dependencies' in results['agents'] and results['agents']['a6_dependencies']['status'] == 'success':
            a6 = results['agents']['a6_dependencies']['results']
            f.write("## 📦 A6 - Dependencies\n\n")
            f.write(f"**Total**: {a6['total_issues']} problèmes\n\n")
            f.write(f"- Packages vulnérables: {a6['category_counts']['VULNERABLE']}\n")
            f.write(f"- Packages obsolètes: {a6['category_counts']['OUTDATED']}\n")
            f.write(f"- Packages dépréciés: {a6['category_counts']['DEPRECATED']}\n\n")
            
            # Packages vulnérables
            vulnerable = [f for f in a6['findings'] if f['category'] == 'VULNERABLE'][:10]
            if vulnerable:
                f.write("### Packages Vulnérables (Top 10)\n\n")
                f.write("| Package | Version | Sévérité |\n")
                f.write("|---------|---------|----------|\n")
                for pkg in vulnerable:
                    f.write(f"| `{pkg['package']}` | {pkg['current']} | {pkg['severity']} |\n")
                f.write("\n")
        
        # Recommandations
        f.write("## 💡 Recommandations\n\n")
        
        if results['summary']['critical_issues'] > 0:
            f.write(f"1. ⚠️  **URGENT**: Traiter {results['summary']['critical_issues']} issues CRITICAL\n")
        
        if 'a1_security' in results['agents'] and results['agents']['a1_security']['status'] == 'success':
            a1 = results['agents']['a1_security']['results']
            if a1['severity_counts']['CRITICAL'] > 0:
                f.write(f"2. 🔒 **Sécurité**: Corriger {a1['severity_counts']['CRITICAL']} vulnérabilités critiques\n")
        
        if 'a2_massive_files' in results['agents'] and results['agents']['a2_massive_files']['status'] == 'success':
            a2 = results['agents']['a2_massive_files']['results']
            if len(a2) > 20:
                f.write(f"3. 📄 **Refactoring**: Découper {len(a2)} fichiers massifs\n")
        
        if 'a5_complexity' in results['agents'] and results['agents']['a5_complexity']['status'] == 'success':
            a5 = results['agents']['a5_complexity']['results']
            if a5['severity_counts']['CRITICAL'] > 0:
                f.write(f"4. 🧠 **Complexité**: Simplifier {a5['severity_counts']['CRITICAL']} fonctions critiques\n")
        
        if 'a6_dependencies' in results['agents'] and results['agents']['a6_dependencies']['status'] == 'success':
            a6 = results['agents']['a6_dependencies']['results']
            if a6['category_counts']['VULNERABLE'] > 0:
                f.write(f"5. 📦 **Dépendances**: Mettre à jour {a6['category_counts']['VULNERABLE']} packages vulnérables\n")


def main():
    """Point d'entrée principal."""
    
    # Exécuter l'analyse
    results = run_analysis()
    
    # Sauvegarder les résultats JSON
    json_file = Path('reports/full_analysis.json')
    json_file.parent.mkdir(exist_ok=True)
    
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Résultats JSON: {json_file}")
    
    # Générer le rapport Markdown
    md_file = Path('reports/FULL_ANALYSIS_REPORT.md')
    generate_markdown_report(results, md_file)
    
    print(f"💾 Rapport Markdown: {md_file}")
    
    print("\n" + "=" * 80)
    print("✅ ANALYSE COMPLÈTE TERMINÉE")
    print("=" * 80)
    
    return 0 if results['summary']['failed_agents'] == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
