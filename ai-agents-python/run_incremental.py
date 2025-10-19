#!/usr/bin/env python3
"""
Run Incremental - Approche par petits lots pour réduire Risk

Stratégie:
1. Diviser findings en lots de N fichiers
2. Exécuter fix + validation sur chaque lot
3. Commit si Risk acceptable
4. Continuer avec lot suivant

Usage:
    python run_incremental.py --batch-size 10
"""

import sys
import time
from pathlib import Path
from typing import List, Dict, Any
from dataclasses import dataclass

from core.config import Config
from core.runner import AgentRunner, AgentResult


def split_into_batches(findings: List[Dict], batch_size: int) -> List[List[Dict]]:
    """Divise findings en lots de taille batch_size"""
    batches = []
    for i in range(0, len(findings), batch_size):
        batches.append(findings[i:i + batch_size])
    return batches


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Run AI agents par lots')
    parser.add_argument('--batch-size', type=int, default=10, help='Taille des lots (default: 10)')
    parser.add_argument('--max-risk', type=int, default=30, help='Risk max acceptable (default: 30)')
    parser.add_argument('--dry-run', action='store_true', help='Mode simulation')
    
    args = parser.parse_args()
    
    workspace_root = Path(__file__).parent.parent
    config = Config.load(str(Path(__file__).parent / "config.yaml"))
    runner = AgentRunner(config, workspace_root)
    
    print(f"\n🔄 MODE INCRÉMENTAL")
    print(f"   Batch size: {args.batch_size}")
    print(f"   Max risk: {args.max_risk}/100")
    print(f"   Dry run: {args.dry_run}\n")
    
    # 1. ANALYSE (complète)
    print("🔍 ANALYSE COMPLÈTE...\n")
    analysis_results = runner.run_analysis_agents()
    
    total_findings = sum(len(r.findings) for r in analysis_results)
    print(f"\n📊 Total findings: {total_findings}")
    
    if total_findings == 0:
        print("✅ Aucune correction nécessaire")
        return 0
    
    # 2. DIVISER EN LOTS
    # Pour simplifier, on prend les findings du premier agent avec des findings
    findings_to_fix = []
    for result in analysis_results:
        if result.findings:
            findings_to_fix = result.findings
            break
    
    batches = split_into_batches(findings_to_fix, args.batch_size)
    print(f"\n📦 {len(batches)} lot(s) à traiter\n")
    
    # 3. TRAITER CHAQUE LOT
    total_fixed = 0
    total_rejected = 0
    
    for batch_num, batch in enumerate(batches, 1):
        print(f"\n{'='*60}")
        print(f"📦 LOT {batch_num}/{len(batches)} ({len(batch)} finding(s))")
        print(f"{'='*60}\n")
        
        # Mock analysis result pour ce lot
        batch_analysis = [AgentResult(
            agent_name='batch_subset',
            agent_type='analysis',
            status='success',
            duration_ms=0,
            findings=batch,
            fixes_applied=[],
            errors=[],
            warnings=[],
            metadata={}
        )]
        
        # Fix
        fix_results = runner.run_fix_agents(batch_analysis, dry_run=args.dry_run)
        
        # Validation
        validation = runner.run_validation(fix_results)
        
        # Décision
        decision = runner.calculate_decision(batch_analysis, fix_results, validation)
        
        risk = decision['risk']['overall']
        confidence = decision['confidence']['overall']
        action = decision['action']
        
        print(f"\n📊 DÉCISION LOT {batch_num}:")
        print(f"   Risk: {risk}/100")
        print(f"   Confidence: {confidence}/100")
        print(f"   Action: {action}")
        
        # Vérifier si acceptable
        if risk <= args.max_risk and action in ['AUTO_COMMIT', 'REVIEW_REQUIRED']:
            print(f"   ✅ LOT ACCEPTÉ")
            
            if not args.dry_run:
                # Commit ce lot
                import subprocess
                commit_msg = f"fix: Lot {batch_num}/{len(batches)} - {len(batch)} corrections"
                try:
                    subprocess.run(['git', 'add', '-A'], cwd=workspace_root, check=True)
                    subprocess.run(['git', 'commit', '-m', commit_msg], cwd=workspace_root, check=True)
                    print(f"   💾 Committed: {commit_msg}")
                except subprocess.CalledProcessError as e:
                    print(f"   ⚠️  Git commit failed: {e}")
            
            total_fixed += len(batch)
        else:
            print(f"   ❌ LOT REJETÉ (Risk trop élevé)")
            total_rejected += len(batch)
        
        time.sleep(0.5)  # Pause entre lots
    
    # 4. RÉSUMÉ
    print(f"\n{'='*60}")
    print(f"📊 RÉSUMÉ FINAL")
    print(f"{'='*60}")
    print(f"✅ Corrigés: {total_fixed}/{total_findings}")
    print(f"❌ Rejetés: {total_rejected}/{total_findings}")
    print(f"📦 Lots traités: {len(batches)}")
    
    return 0 if total_rejected == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
