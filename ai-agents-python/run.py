#!/usr/bin/env python3
"""
AI Agents - Entry point MVP
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from core.config import Config
from core.runner import AgentRunner

def main():
    print("=" * 60)
    print("🤖 AI AGENTS - MVP")
    print("=" * 60)
    
    workspace_root = Path(__file__).parent.parent
    config = Config.load(str(Path(__file__).parent / "config.yaml"))
    runner = AgentRunner(config, workspace_root)
    
    start = time.time()
    
    # Analyze
    print("\n🔍 ANALYSE...")
    analysis_results = runner.run_analysis_agents()
    total_findings = sum(len(r.findings) for r in analysis_results)
    print(f"✅ {len(analysis_results)} agent(s), {total_findings} finding(s)")
    
    # Sauvegarder les résultats en JSON
    results_dir = Path(__file__).parent
    for result in analysis_results:
        output_file = results_dir / f"{result.agent_name}_results.json"
        import json
        
        # Convertir les findings en dictionnaires
        findings_json = []
        for finding in result.findings:
            if hasattr(finding, '__dict__'):
                findings_json.append(vars(finding))
            elif isinstance(finding, dict):
                findings_json.append(finding)
            else:
                findings_json.append(str(finding))
        
        with open(output_file, 'w') as f:
            json.dump({
                'agent_name': result.agent_name,
                'status': result.status,
                'duration_ms': result.duration_ms,
                'findings': findings_json,
                'errors': result.errors,
                'warnings': result.warnings
            }, f, indent=2, default=str)
    
    # Fix
    print("\n🔧 CORRECTIONS...")
    fix_results = runner.run_fix_agents(analysis_results, dry_run=False)
    print(f"✅ {len(fix_results)} agent(s), {sum(len(r.fixes_applied) for r in fix_results)} fix(es)")
    
    # Validate
    print("\n🧪 VALIDATION...")
    validation_results = runner.run_validation(fix_results)
    
    # Decide
    print("\n📊 DÉCISION...")
    decision = runner.calculate_decision(analysis_results, fix_results, validation_results)
    
    print(f"\n   Risk: {decision['risk']['overall']:.0f}/100")
    print(f"   Confidence: {decision['confidence']['overall']:.0f}/100")
    print(f"   Action: {decision['action']}")
    print(f"   Durée: {time.time()-start:.1f}s")
    
    # Générer rapport actionnable
    if total_findings > 0:
        print("\n📄 RAPPORT...")
        import subprocess
        try:
            subprocess.run([sys.executable, str(results_dir / "generate_report_final.py")], check=False)
        except:
            pass
    
    return 0 if decision['action'] == "AUTO_COMMIT" else 1

if __name__ == "__main__":
    sys.exit(main())
