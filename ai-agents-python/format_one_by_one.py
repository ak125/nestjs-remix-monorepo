#!/usr/bin/env python3
"""
Format One by One - Formatte et commite fichier par fichier

Mode ultra-prudent avec confirmation optionnelle pour chaque fichier.

Usage:
    python format_one_by_one.py                    # Auto (tous les fichiers)
    python format_one_by_one.py --interactive      # Demande confirmation
    python format_one_by_one.py --max-files 10     # Limiter à 10 fichiers
    python format_one_by_one.py --dry-run          # Simulation
"""

import sys
import time
from pathlib import Path
from typing import List, Dict

from core.config import Config
from agents.analysis.a2_massive_files import MassiveFilesDetector
from agents.fixproof.f2_lint_format import LintFormatter


def ask_confirmation(file_path: str, severity: str) -> bool:
    """Demande confirmation pour formater un fichier"""
    print(f"\n📄 {file_path}")
    print(f"   Sévérité: {severity}")
    
    while True:
        response = input("   Formater ce fichier? [y/n/q] (q=quitter): ").strip().lower()
        if response in ['y', 'yes', 'o', 'oui']:
            return True
        elif response in ['n', 'no', 'non']:
            return False
        elif response in ['q', 'quit']:
            print("\n❌ Arrêté par l'utilisateur")
            sys.exit(0)
        else:
            print("   Réponse invalide. Utilisez 'y', 'n' ou 'q'.")


def format_file(
    file_path: str,
    finding: Dict,
    formatter: LintFormatter,
    workspace_root: Path,
    dry_run: bool = False,
    auto_commit: bool = True
) -> bool:
    """
    Formatte un seul fichier et commite
    
    Returns:
        True si formaté avec succès, False sinon
    """
    try:
        # Construire chemin absolu si nécessaire
        abs_path = workspace_root / file_path if not Path(file_path).is_absolute() else file_path
        
        # Formater
        results = formatter.fix([finding], dry_run=dry_run)
        
        if not results:
            print(f"   ⏭️  Aucun changement nécessaire")
            return False
        
        if dry_run:
            print(f"   🔍 Simulé: {len(results)} changement(s)")
            return True
        
        # Fichier formaté
        formatted = results[0]
        changes = formatted.get('changes', 0)
        
        print(f"   ✅ Formaté: {changes} changement(s)")
        
        if not auto_commit:
            return True
        
        # Commit ce fichier
        import subprocess
        
        try:
            # Ajouter uniquement ce fichier (utiliser chemin absolu)
            subprocess.run(
                ['git', 'add', str(abs_path)],
                cwd=workspace_root,
                check=True,
                capture_output=True
            )
            
            # Créer commit (utiliser chemin relatif pour le message)
            commit_msg = f"style: Format {file_path}"
            
            subprocess.run(
                ['git', 'commit', '-m', commit_msg],
                cwd=workspace_root,
                check=True,
                capture_output=True
            )
            
            print(f"   💾 Committed: \"{commit_msg}\"")
            return True
            
        except subprocess.CalledProcessError as e:
            print(f"   ⚠️  Git error: {e}")
            return False
    
    except Exception as e:
        print(f"   ❌ Erreur: {e}")
        return False


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Format fichiers un par un')
    parser.add_argument('--interactive', '-i', action='store_true', 
                       help='Demander confirmation pour chaque fichier')
    parser.add_argument('--dry-run', action='store_true', 
                       help='Simulation (pas de commit)')
    parser.add_argument('--no-commit', action='store_true',
                       help='Formater sans commiter')
    parser.add_argument('--max-files', type=int,
                       help='Limiter nombre de fichiers')
    parser.add_argument('--severity', choices=['warning', 'medium', 'high', 'critical'],
                       help='Filtrer par sévérité minimum')
    
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
    
    # ========== RAPPORT DÉTAILLÉ A2 ==========
    print(f"\n{'='*80}")
    print(f"📊 RAPPORT A2 - MASSIVE FILES DETECTOR")
    print(f"{'='*80}\n")
    print(f"Total: {len(findings)} fichier(s) massif(s)\n")
    
    # Grouper par sévérité
    by_severity = {}
    for finding in findings:
        sev = finding.get('severity', 'unknown')
        by_severity[sev] = by_severity.get(sev, [])
        by_severity[sev].append(finding)
    
    # Afficher stats par sévérité
    severity_icons = {
        'critical': '🔴',
        'high': '🟠',
        'medium': '🟡',
        'warning': '🟢'
    }
    
    for severity in ['critical', 'high', 'medium', 'warning']:
        if severity not in by_severity:
            continue
        
        items = by_severity[severity]
        icon = severity_icons.get(severity, '⚪')
        print(f"{icon} {severity.upper()}: {len(items)} fichier(s)")
        
        # Afficher top 3 pour cette sévérité
        for idx, item in enumerate(sorted(items, key=lambda x: x['lines'], reverse=True)[:3], 1):
            file_path = item['file_path']
            lines = item['lines']
            threshold = item['threshold']
            ratio = ((lines - threshold) / threshold * 100) if threshold > 0 else 0
            
            print(f"   {idx}. {file_path}")
            print(f"      Lignes: {lines} (seuil: {threshold}, +{ratio:.0f}%)")
            
            # Suggestions
            if 'suggestions' in item and item['suggestions']:
                print(f"      💡 {item['suggestions'][0]}")
        
        if len(items) > 3:
            print(f"   ... et {len(items) - 3} autres fichiers {severity}\n")
        else:
            print()
    
    print(f"{'='*80}\n")
    # ========== FIN RAPPORT ==========
    
    # Filtrer par sévérité si demandé
    if args.severity:
        severity_order = {'warning': 0, 'medium': 1, 'high': 2, 'critical': 3}
        min_severity = severity_order[args.severity]
        findings = [
            f for f in findings 
            if severity_order.get(f.get('severity', 'warning'), 0) >= min_severity
        ]
    
    # Trier par sévérité (critical → warning)
    severity_order = {'critical': 0, 'high': 1, 'medium': 2, 'warning': 3}
    findings.sort(key=lambda f: severity_order.get(f.get('severity', 'warning'), 3))
    
    # Limiter si demandé
    if args.max_files:
        findings = findings[:args.max_files]
    
    total = len(findings)
    print(f"📊 {total} fichier(s) à traiter")
    print(f"   Interactive: {args.interactive}")
    print(f"   Dry run: {args.dry_run}")
    print(f"   Auto commit: {not args.no_commit and not args.dry_run}\n")
    
    if args.interactive and not args.dry_run:
        print("💡 Astuce: Utilisez 'q' pour quitter à tout moment\n")
    
    # Formatter
    formatter = LintFormatter(config, workspace_root)
    
    # Traiter fichier par fichier
    formatted_count = 0
    skipped_count = 0
    error_count = 0
    
    for i, finding in enumerate(findings, 1):
        file_path = finding['file_path']
        severity = finding.get('severity', 'unknown')
        lines = finding.get('lines', 0)
        
        # file_path est déjà relatif dans findings
        display_path = file_path if isinstance(file_path, str) else str(file_path)
        
        print(f"\n{'='*70}")
        print(f"📄 [{i}/{total}] {display_path}")
        print(f"   Lignes: {lines}")
        print(f"   Sévérité: {severity}")
        print(f"{'='*70}")
        
        # Demander confirmation si mode interactif
        if args.interactive and not args.dry_run:
            if not ask_confirmation(file_path, severity):
                print(f"   ⏭️  Ignoré")
                skipped_count += 1
                continue
        
        # Formater
        success = format_file(
            file_path,
            finding,
            formatter,
            workspace_root,
            dry_run=args.dry_run,
            auto_commit=(not args.no_commit and not args.dry_run)
        )
        
        if success:
            formatted_count += 1
        else:
            error_count += 1
        
        # Petite pause pour lisibilité
        time.sleep(0.1)
    
    # Résumé
    print(f"\n{'='*70}")
    print(f"📊 RÉSUMÉ FINAL")
    print(f"{'='*70}")
    print(f"✅ Formatés: {formatted_count}/{total}")
    if args.interactive:
        print(f"⏭️  Ignorés: {skipped_count}/{total}")
    if error_count > 0:
        print(f"❌ Erreurs: {error_count}/{total}")
    
    if not args.dry_run and not args.no_commit:
        print(f"\n💾 {formatted_count} commit(s) créé(s)")
        print(f"   Chaque fichier = 1 commit atomique")
        print(f"   Facile à revert individuellement")
    
    return 0


if __name__ == '__main__':
    sys.exit(main())
