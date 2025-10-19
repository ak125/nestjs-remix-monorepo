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
    print(f"✅ {len(analysis_results)} agent(s), {sum(len(r.findings) for r in analysis_results)} finding(s)")
    
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
    
    return 0 if decision['action'] == "AUTO_COMMIT" else 1

if __name__ == "__main__":
    sys.exit(main())
