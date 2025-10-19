"""
Workflow complet avec tous les agents implémentés.

Utilise:
- Analysis: A1 (Security), A2 (Files), A3 (Dup), A4 (Dead), A5 (Complexity), A6 (Deps)
- Fix: F0 (AutoImport), F1 (Dead Code), F2 (Lint/Format), F15 (Risk)
- Gates: M1 (Contracts), M7 (Coverage)
"""

import sys
from pathlib import Path
from datetime import datetime

# Ajouter le répertoire parent au path
root_dir = Path(__file__).parent
sys.path.insert(0, str(root_dir))


def run_full_analysis():
    """Lance une analyse complète avec tous les agents."""
    
    workspace = Path('/workspaces/nestjs-remix-monorepo')
    
    print("=" * 80)
    print("🤖 AI AGENTS - ANALYSE COMPLÈTE")
    print("=" * 80)
    print(f"📁 Workspace: {workspace}")
    print(f"⏰ Start: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    # Exécuter l'analyse
    print("\n🔍 Phase 1: Analyse")
    print("-" * 80)
    
    start_time = datetime.now()
    
    try:
        # A1 - Security
        print("\n🔒 A1 - Security Vulnerabilities...")
        a1_start = datetime.now()
        from agents.analysis.a1_security import A1SecurityAgent
        a1 = A1SecurityAgent(str(workspace))
        a1_results = a1.analyze()
        a1_duration = (datetime.now() - a1_start).total_seconds()
        print(f"   ✓ {a1_results['total_vulnerabilities']} vulnérabilités ({a1_duration:.2f}s)")
        print(f"     - CRITICAL: {a1_results['severity_counts']['CRITICAL']}")
        print(f"     - HIGH: {a1_results['severity_counts']['HIGH']}")
        print(f"     - MEDIUM: {a1_results['severity_counts']['MEDIUM']}")
        print(f"     - LOW: {a1_results['severity_counts']['LOW']}")
        
        # A2 - Massive Files
        print("\n📄 A2 - Massive Files...")
        a2_start = datetime.now()
        from agents.analysis.a2_massive_files import MassiveFilesDetector
        a2 = MassiveFilesDetector(str(workspace))
        a2_results = a2.analyze()
        a2_duration = (datetime.now() - a2_start).total_seconds()
        print(f"   ✓ {a2_results['total_massive_files']} fichiers massifs ({a2_duration:.2f}s)")
        
        # A3 - Duplications
        print("\n🔁 A3 - Code Duplications...")
        a3_start = datetime.now()
        from agents.analysis.a3_duplications import DuplicationDetector
        a3 = DuplicationDetector(str(workspace))
        a3_results = a3.analyze()
        a3_duration = (datetime.now() - a3_start).total_seconds()
        print(f"   ✓ {a3_results['total_duplications']} duplications ({a3_duration:.2f}s)")
        
        # A4 - Dead Code
        print("\n💀 A4 - Dead Code...")
        a4_start = datetime.now()
        from agents.analysis.a4_dead_code import DeadCodeDetector
        a4 = DeadCodeDetector(str(workspace))
        a4_results = a4.analyze()
        a4_duration = (datetime.now() - a4_start).total_seconds()
        print(f"   ✓ {a4_results['total_dead_code']} items ({a4_duration:.2f}s)")
        
        # A5 - Complexity
        print("\n🧠 A5 - Code Complexity...")
        a5_start = datetime.now()
        from agents.analysis.a5_complexity import A5ComplexityAgent
        a5 = A5ComplexityAgent(str(workspace))
        a5_results = a5.analyze()
        a5_duration = (datetime.now() - a5_start).total_seconds()
        print(f"   ✓ {a5_results['total_complex_functions']} fonctions complexes ({a5_duration:.2f}s)")
        print(f"     - CRITICAL: {a5_results['severity_counts']['CRITICAL']}")
        print(f"     - HIGH: {a5_results['severity_counts']['HIGH']}")
        print(f"     - Avg Cyclomatic: {a5_results['average_cyclomatic']}")
        print(f"     - Avg Cognitive: {a5_results['average_cognitive']}")
        
        # A6 - Dependencies
        print("\n📦 A6 - Dependencies...")
        a6_start = datetime.now()
        from agents.analysis.a6_dependencies import A6DependenciesAgent
        a6 = A6DependenciesAgent(str(workspace))
        a6_results = a6.analyze()
        a6_duration = (datetime.now() - a6_start).total_seconds()
        print(f"   ✓ {a6_results['total_issues']} problèmes ({a6_duration:.2f}s)")
        print(f"     - Vulnerable: {a6_results['category_counts']['VULNERABLE']}")
        print(f"     - Outdated: {a6_results['category_counts']['OUTDATED']}")
        print(f"     - Deprecated: {a6_results['category_counts']['DEPRECATED']}")
        
        total_analysis_time = (datetime.now() - start_time).total_seconds()
        
        # Résumé
        print("\n" + "=" * 80)
        print("📊 RÉSUMÉ DE L'ANALYSE")
        print("=" * 80)
        print(f"\n⏱️  Temps total: {total_analysis_time:.2f}s")
        print(f"\n📈 Métriques globales:")
        print(f"   - Vulnérabilités sécurité: {a1_results['total_vulnerabilities']}")
        print(f"   - Fichiers massifs: {a2_results['total_massive_files']}")
        print(f"   - Duplications: {a3_results['total_duplications']}")
        print(f"   - Code mort: {a4_results['total_dead_code']}")
        print(f"   - Fonctions complexes: {a5_results['total_complex_functions']}")
        print(f"   - Dépendances obsolètes: {a6_results['total_issues']}")
        
        # Calcul du score global
        critical_issues = (
            a1_results['severity_counts']['CRITICAL'] +
            a2_results.get('critical_count', 0) +
            a5_results['severity_counts']['CRITICAL']
        )
        
        high_issues = (
            a1_results['severity_counts']['HIGH'] +
            a2_results.get('high_count', 0) +
            a5_results['severity_counts']['HIGH']
        )
        
        print(f"\n🎯 Issues prioritaires:")
        print(f"   - CRITICAL: {critical_issues}")
        print(f"   - HIGH: {high_issues}")
        
        # Recommandations
        print(f"\n💡 Recommandations:")
        
        if critical_issues > 0:
            print(f"   ⚠️  URGENT: Traiter {critical_issues} issues CRITICAL en priorité")
        
        if a1_results['severity_counts']['CRITICAL'] > 0:
            print(f"   🔒 Sécurité: {a1_results['severity_counts']['CRITICAL']} vulnérabilités critiques à corriger")
        
        if a2_results['total_massive_files'] > 20:
            print(f"   📄 Refactoring: {a2_results['total_massive_files']} fichiers massifs à découper")
        
        if a3_results['total_duplications'] > 100:
            print(f"   🔁 DRY: {a3_results['total_duplications']} duplications à extraire")
        
        if a5_results['total_complex_functions'] > 100:
            print(f"   🧠 Simplicité: {a5_results['total_complex_functions']} fonctions à simplifier")
        
        if a6_results['category_counts']['VULNERABLE'] > 0:
            print(f"   📦 Dépendances: {a6_results['category_counts']['VULNERABLE']} packages vulnérables à mettre à jour")
        
        print("\n" + "=" * 80)
        print("✅ Analyse terminée")
        print("=" * 80)
        
        # Sauvegarder les résultats complets
        import json
        results_file = workspace / 'ai-agents-python' / 'full_analysis_results.json'
        results_file.parent.mkdir(exist_ok=True)
        
        with open(results_file, 'w', encoding='utf-8') as f:
            json.dump({
                'timestamp': datetime.now().isoformat(),
                'duration_seconds': total_analysis_time,
                'agents': {
                    'a1_security': a1_results,
                    'a2_massive_files': a2_results,
                    'a3_duplications': a3_results,
                    'a4_dead_code': a4_results,
                    'a5_complexity': a5_results,
                    'a6_dependencies': a6_results,
                },
                'summary': {
                    'critical_issues': critical_issues,
                    'high_issues': high_issues,
                }
            }, f, indent=2, ensure_ascii=False)
        
        print(f"\n💾 Résultats sauvegardés: {results_file}")
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Analyse interrompue par l'utilisateur")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Erreur: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    run_full_analysis()
