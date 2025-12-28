#!/usr/bin/env python3
"""
Test rapide du système AI Agents Python
"""

import sys
from pathlib import Path

# Ajouter le workspace au path
workspace = Path(__file__).parent
sys.path.insert(0, str(workspace))

from core.config import Config
from core.runner import AgentRunner

def main():
    print("🤖 AI AGENTS PYTHON - TEST RAPIDE\n")
    
    # 1. Load config
    print("📁 Chargement configuration...")
    config_path = workspace / "config.yaml"
    config = Config.load(str(config_path))
    print(f"   ✅ Config chargée: mode={config.mode}")
    print(f"   ✅ Thresholds:")
    print(f"      - TSX component: {config.thresholds.massive_files.tsx_component} lignes")
    print(f"      - Duplications: {config.thresholds.duplication.min_tokens} tokens")
    print(f"      - Dead code: {config.thresholds.dead_code.untouched_days} jours")
    
    # 2. Créer runner
    print("\n🏃 Création runner...")
    root = workspace.parent  # Racine monorepo
    runner = AgentRunner(config, root)
    print(f"   ✅ Runner créé")
    print(f"   ✅ Agents d'analyse: {len(runner.analysis_agents)}")
    print(f"   ✅ Agents de correction: {len(runner.fix_agents)}")
    
    # 3. Test analyse (juste A4 pour l'instant)
    print("\n🔍 Test analyse (A4 Dead Code uniquement)...")
    try:
        analysis_results = runner.run_analysis_agents(specific=['a4_dead_code'])
        print(f"   ✅ Analyse terminée: {len(analysis_results)} résultat(s)")
        
        for result in analysis_results:
            print(f"\n   📊 {result.agent_name}:")
            print(f"      - Status: {result.status}")
            print(f"      - Findings: {len(result.findings)}")
            print(f"      - Durée: {result.duration_ms}ms")
    
    except Exception as e:
        print(f"   ❌ Erreur: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n✅ Test terminé!")

if __name__ == '__main__':
    main()
