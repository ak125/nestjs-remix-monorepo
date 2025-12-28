#!/usr/bin/env python3
"""
Run Review Mode - Mode interactif pour valider avant commit

Affiche findings, demande confirmation, applique corrections
Usage:
    python run_review.py
"""

import sys
from pathlib import Path

from core.config import Config
from core.runner import AgentRunner


def print_findings_summary(analysis_results):
    """Affiche résumé des findings"""
    print("\n" + "="*60)
    print("📋 RÉSUMÉ DES FINDINGS")
    print("="*60)
    
    for result in analysis_results:
        if not result.findings:
            continue
        
        print(f"\n{result.agent_name}:")
        print(f"  Findings: {len(result.findings)}")
        
        # Grouper par sévérité
        by_severity = {}
        for finding in result.findings:
            sev = finding.get('severity', 'unknown')
            by_severity[sev] = by_severity.get(sev, 0) + 1
        
        for sev, count in sorted(by_severity.items()):
            print(f"    - {sev}: {count}")
    
    print()


def print_fixes_summary(fix_results):
    """Affiche résumé des corrections"""
    print("\n" + "="*60)
    print("🔧 RÉSUMÉ DES CORRECTIONS")
    print("="*60)
    
    for result in fix_results:
        if not result.fixes_applied:
            continue
        
        print(f"\n{result.agent_name}:")
        print(f"  Fixes: {len(result.fixes_applied)}")
        
        # Exemples
        for fix in result.fixes_applied[:3]:
            file_path = fix.get('file_path', 'unknown')
            action = fix.get('action', 'unknown')
            print(f"    - {file_path}: {action}")
        
        if len(result.fixes_applied) > 3:
            print(f"    ... et {len(result.fixes_applied) - 3} autres")
    
    print()


def ask_confirmation(prompt: str) -> bool:
    """Demande confirmation utilisateur"""
    while True:
        response = input(f"{prompt} (y/n): ").strip().lower()
        if response in ['y', 'yes', 'o', 'oui']:
            return True
        elif response in ['n', 'no', 'non']:
            return False
        else:
            print("Réponse invalide. Utilisez 'y' ou 'n'.")


def main():
    workspace_root = Path(__file__).parent.parent
    config = Config.load(str(Path(__file__).parent / "config.yaml"))
    runner = AgentRunner(config, workspace_root)
    
    print("\n🔍 MODE REVIEW INTERACTIF")
    print("Vous pourrez valider chaque étape avant application\n")
    
    # 1. ANALYSE
    print("🔍 ANALYSE...\n")
    analysis_results = runner.run_analysis_agents()
    
    print_findings_summary(analysis_results)
    
    total_findings = sum(len(r.findings) for r in analysis_results)
    
    if total_findings == 0:
        print("✅ Aucune correction nécessaire")
        return 0
    
    if not ask_confirmation(f"📋 {total_findings} finding(s) détecté(s). Continuer avec corrections?"):
        print("❌ Annulé par l'utilisateur")
        return 1
    
    # 2. CORRECTIONS (DRY RUN d'abord)
    print("\n🔧 SIMULATION CORRECTIONS (dry-run)...\n")
    dry_run_results = runner.run_fix_agents(analysis_results, dry_run=True)
    
    print_fixes_summary(dry_run_results)
    
    total_fixes = sum(len(r.fixes_applied) for r in dry_run_results)
    
    if not ask_confirmation(f"🔧 {total_fixes} correction(s) proposée(s). Appliquer?"):
        print("❌ Annulé par l'utilisateur")
        return 1
    
    # 3. APPLIQUER CORRECTIONS
    print("\n🔧 APPLICATION CORRECTIONS...\n")
    fix_results = runner.run_fix_agents(analysis_results, dry_run=False)
    
    # 4. VALIDATION
    print("\n🧪 VALIDATION...\n")
    validation = runner.run_validation(fix_results)
    
    # 5. DÉCISION
    print("\n📊 DÉCISION...\n")
    decision = runner.calculate_decision(analysis_results, fix_results, validation)
    
    risk = decision['risk']['overall']
    confidence = decision['confidence']['overall']
    action = decision['action']
    
    print(f"\n📊 RÉSULTAT:")
    print(f"   Risk: {risk}/100")
    print(f"   Confidence: {confidence}/100")
    print(f"   Action: {action}\n")
    
    # 6. COMMIT ?
    if action == 'AUTO_COMMIT':
        print("✅ Corrections sûres - Auto-commit recommandé")
        if ask_confirmation("💾 Créer commit?"):
            import subprocess
            try:
                subprocess.run(['git', 'add', '-A'], cwd=workspace_root, check=True)
                subprocess.run(['git', 'commit', '-m', f'fix: AI corrections ({total_fixes} fixes)'], cwd=workspace_root, check=True)
                print("✅ Commit créé")
            except subprocess.CalledProcessError as e:
                print(f"❌ Erreur git: {e}")
    elif action == 'REVIEW_REQUIRED':
        print("⚠️  Review manuelle recommandée avant commit")
        print("   Vérifiez les changements avec: git diff")
        if ask_confirmation("💾 Créer commit quand même?"):
            import subprocess
            subprocess.run(['git', 'add', '-A'], cwd=workspace_root)
            subprocess.run(['git', 'commit', '-m', f'fix: AI corrections (review required - {total_fixes} fixes)'], cwd=workspace_root)
    else:  # REJECT
        print("❌ Risk trop élevé - Corrections appliquées mais non-commitées")
        print("   Options:")
        print("   1. Vérifier git diff")
        print("   2. Annuler: git reset --hard HEAD")
        print("   3. Commit manuel si OK: git add -A && git commit")
    
    return 0


if __name__ == '__main__':
    sys.exit(main())
