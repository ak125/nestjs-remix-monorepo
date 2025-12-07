#!/usr/bin/env python3
"""
Format Only - Formatte les fichiers massifs détectés par lots

Usage simple:
    python format_massive_files.py --batch-size 20
"""

import sys
import time
from pathlib import Path
from typing import List

from core.config import Config
from agents.analysis.a2_massive_files import MassiveFilesDetector
from agents.fixproof.f2_lint_format import LintFormatter


def format_in_batches(files: List[str], batch_size: int, workspace_root: Path, dry_run: bool = False):
    """Formatte fichiers par lots"""
    
    total = len(files)
    num_batches = (total + batch_size - 1) // batch_size
    
    print(f"\n📦 {total} fichier(s) à formater en {num_batches} lot(s)")
    print(f"   Batch size: {batch_size}")
    print(f"   Dry run: {dry_run}\n")
    
    config = Config.load(str(workspace_root / 'ai-agents-python' / 'config.yaml'))
    formatter = LintFormatter(config, workspace_root)
    
    total_formatted = 0
    
    for i in range(0, total, batch_size):
        batch_num = i // batch_size + 1
        batch = files[i:i + batch_size]
        
        print(f"📦 LOT {batch_num}/{num_batches} ({len(batch)} fichiers)")
        
        # Créer findings pour ce lot
        findings = [{'file_path': f} for f in batch]
        
        # Formater
        try:
            results = formatter.fix(findings, dry_run=dry_run)
            
            if not dry_run:
                print(f"   ✅ {len(results)} fichier(s) formaté(s)")
                total_formatted += len(results)
                
                # Commit ce lot
                import subprocess
                try:
                    subprocess.run(['git', 'add'] + batch, cwd=workspace_root, check=True)
                    commit_msg = f"style: Format lot {batch_num}/{num_batches} ({len(batch)} files)"
                    subprocess.run(['git', 'commit', '-m', commit_msg], cwd=workspace_root, check=True)
                    print(f"   💾 Committed: {commit_msg}\n")
                except subprocess.CalledProcessError as e:
                    print(f"   ⚠️  Git commit error: {e}\n")
            else:
                print(f"   🔍 Simulé: {len(results)} changement(s)\n")
            
            time.sleep(0.2)  # Petite pause
            
        except Exception as e:
            print(f"   ❌ Erreur: {e}\n")
            continue
    
    if not dry_run:
        print(f"\n✅ TERMINÉ: {total_formatted}/{total} fichier(s) formaté(s)")
    else:
        print(f"\n🔍 SIMULATION TERMINÉE")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Format massive files par lots')
    parser.add_argument('--batch-size', type=int, default=20, help='Taille lots (default: 20)')
    parser.add_argument('--dry-run', action='store_true', help='Simulation')
    parser.add_argument('--max-files', type=int, help='Limiter nombre fichiers')
    
    args = parser.parse_args()
    
    workspace_root = Path(__file__).parent.parent
    config = Config.load(str(Path(__file__).parent / "config.yaml"))
    
    # Détecter fichiers massifs
    print("🔍 Détection fichiers massifs...\n")
    detector = MassiveFilesDetector(config, workspace_root)
    findings = detector.analyze()
    
    if not findings:
        print("✅ Aucun fichier massif détecté")
        return 0
    
    print(f"📊 {len(findings)} fichier(s) massif(s) détecté(s)\n")
    
    # Extraire paths
    files = [f['file_path'] for f in findings]
    
    # Limiter si demandé
    if args.max_files:
        files = files[:args.max_files]
        print(f"⚠️  Limité à {args.max_files} fichiers\n")
    
    # Formater par lots
    format_in_batches(files, args.batch_size, workspace_root, args.dry_run)
    
    return 0


if __name__ == '__main__':
    sys.exit(main())
