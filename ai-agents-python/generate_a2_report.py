#!/usr/bin/env python3
"""
Generate A2 Report - Génère rapport détaillé des fichiers massifs

Crée un fichier markdown avec:
- Statistiques globales
- Breakdown par sévérité
- Liste complète des fichiers
- Suggestions de refactoring

Usage:
    python generate_a2_report.py
    python generate_a2_report.py --output reports/massive-files-YYYY-MM-DD.md
"""

import sys
from pathlib import Path
from typing import List, Dict, Any
from collections import defaultdict
from datetime import datetime

from core.config import Config
from agents.analysis.a2_massive_files import MassiveFilesDetector


def generate_markdown_report(findings: List[Dict[str, Any]], output_path: Path):
    """Génère un rapport markdown détaillé"""
    
    # Header
    report = []
    report.append(f"# 📊 Rapport A2 - Fichiers Massifs")
    report.append(f"")
    report.append(f"**Date**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report.append(f"**Total**: {len(findings)} fichiers massifs détectés")
    report.append(f"")
    report.append(f"---")
    report.append(f"")
    
    # Grouper par sévérité
    by_severity = defaultdict(list)
    for finding in findings:
        severity = finding.get('severity', 'unknown')
        by_severity[severity].append(finding)
    
    # Stats par sévérité
    report.append(f"## 📈 Statistiques par Sévérité")
    report.append(f"")
    
    severity_order = ['critical', 'high', 'medium', 'warning']
    severity_emoji = {
        'critical': '🔴',
        'high': '🟠',
        'medium': '🟡',
        'warning': '🟢'
    }
    
    # Table
    report.append(f"| Sévérité | Fichiers | Avg Lignes | Avg Dépassement |")
    report.append(f"|----------|----------|------------|-----------------|")
    
    for sev in severity_order:
        if sev not in by_severity:
            continue
        
        files = by_severity[sev]
        count = len(files)
        avg_lines = sum(f['lines'] for f in files) / count
        avg_threshold = sum(f['threshold'] for f in files) / count
        avg_ratio = (avg_lines / avg_threshold - 1) * 100 if avg_threshold > 0 else 0
        
        emoji = severity_emoji.get(sev, '⚪')
        report.append(f"| {emoji} **{sev.upper()}** | {count} | {int(avg_lines)}L | +{int(avg_ratio)}% |")
    
    report.append(f"")
    report.append(f"**Total**: {len(findings)} fichiers")
    report.append(f"")
    report.append(f"---")
    report.append(f"")
    
    # Détail par sévérité
    for sev in severity_order:
        if sev not in by_severity:
            continue
        
        files = by_severity[sev]
        emoji = severity_emoji.get(sev, '⚪')
        
        report.append(f"## {emoji} {sev.upper()} ({len(files)} fichiers)")
        report.append(f"")
        
        # Trier par nombre de lignes (desc)
        files.sort(key=lambda f: f['lines'], reverse=True)
        
        for i, finding in enumerate(files, 1):
            file_path = finding['file_path']
            lines = finding['lines']
            threshold = finding['threshold']
            ratio = (lines / threshold - 1) * 100 if threshold > 0 else 0
            suggestions = finding.get('suggestions', [])
            
            report.append(f"### {i}. `{file_path}`")
            report.append(f"")
            report.append(f"- **Lignes**: {lines} (seuil: {threshold})")
            report.append(f"- **Dépassement**: +{int(ratio)}%")
            report.append(f"- **Type**: {finding.get('file_type', 'unknown')}")
            
            if suggestions:
                report.append(f"- **💡 Suggestions**:")
                for suggestion in suggestions:
                    report.append(f"  - {suggestion}")
            
            report.append(f"")
        
        report.append(f"---")
        report.append(f"")
    
    # Recommandations
    report.append(f"## 🎯 Recommandations")
    report.append(f"")
    report.append(f"### Priorités")
    report.append(f"")
    report.append(f"1. **🔴 CRITICAL** (23 fichiers)")
    report.append(f"   - Fichiers > 1000 lignes")
    report.append(f"   - **Action**: Refactoring urgent (extraire composants/services)")
    report.append(f"   - **Impact**: Maintenabilité, bugs, performance")
    report.append(f"")
    report.append(f"2. **🟠 HIGH** (25 fichiers)")
    report.append(f"   - Fichiers 700-1000 lignes")
    report.append(f"   - **Action**: Refactoring recommandé")
    report.append(f"   - **Impact**: Complexité croissante")
    report.append(f"")
    report.append(f"3. **🟡 MEDIUM** (39 fichiers)")
    report.append(f"   - Fichiers 550-700 lignes")
    report.append(f"   - **Action**: Surveiller, refactor si croissance")
    report.append(f"   - **Impact**: Risque à moyen terme")
    report.append(f"")
    report.append(f"4. **🟢 WARNING** (50 fichiers)")
    report.append(f"   - Fichiers 500-550 lignes")
    report.append(f"   - **Action**: Acceptable, éviter croissance")
    report.append(f"   - **Impact**: Faible")
    report.append(f"")
    
    # Stratégies de correction
    report.append(f"### 🛠️ Stratégies de Refactoring")
    report.append(f"")
    report.append(f"#### Pour Composants React/Remix (frontend/)")
    report.append(f"")
    report.append(f"1. **Extraire sous-composants**")
    report.append(f"   ```tsx")
    report.append(f"   // Avant: 1500L dans orders._index.tsx")
    report.append(f"   // Après:")
    report.append(f"   //   - OrdersTable.tsx (300L)")
    report.append(f"   //   - OrderFilters.tsx (200L)")
    report.append(f"   //   - OrderSummary.tsx (150L)")
    report.append(f"   ```")
    report.append(f"")
    report.append(f"2. **Hooks personnalisés**")
    report.append(f"   ```tsx")
    report.append(f"   // useOrdersFilters.ts")
    report.append(f"   // useOrdersPagination.ts")
    report.append(f"   ```")
    report.append(f"")
    report.append(f"3. **Layouts/Templates**")
    report.append(f"   - Mutualiser structures communes")
    report.append(f"   - AdminLayout, BlogLayout, etc.")
    report.append(f"")
    report.append(f"#### Pour Services NestJS (backend/)")
    report.append(f"")
    report.append(f"1. **Diviser en sous-services**")
    report.append(f"   ```typescript")
    report.append(f"   // products.service.ts (1567L) →")
    report.append(f"   //   - ProductsCrudService (400L)")
    report.append(f"   //   - ProductsSearchService (300L)")
    report.append(f"   //   - ProductsPricingService (250L)")
    report.append(f"   ```")
    report.append(f"")
    report.append(f"2. **Stratégie Pattern**")
    report.append(f"   - ProductImportStrategy")
    report.append(f"   - ProductExportStrategy")
    report.append(f"")
    report.append(f"3. **Helpers/Utils**")
    report.append(f"   - Extraire logique métier")
    report.append(f"   - Validators, Transformers")
    report.append(f"")
    
    # Workflows disponibles
    report.append(f"### 🚀 Workflows Disponibles")
    report.append(f"")
    report.append(f"```bash")
    report.append(f"# 1. Format fichier par fichier (recommandé)")
    report.append(f"cd ai-agents-python")
    report.append(f"python format_one_by_one.py --interactive")
    report.append(f"")
    report.append(f"# 2. Format uniquement CRITICAL")
    report.append(f"python format_one_by_one.py --severity critical")
    report.append(f"")
    report.append(f"# 3. Format par lots")
    report.append(f"python run_incremental.py --batch-size 20")
    report.append(f"")
    report.append(f"# 4. Mode review (contrôle total)")
    report.append(f"python run_review.py")
    report.append(f"```")
    report.append(f"")
    
    # Footer
    report.append(f"---")
    report.append(f"")
    report.append(f"**Généré par**: AI Agents Python - Agent A2 Massive Files Detector")
    report.append(f"")
    
    # Écrire fichier
    content = "\n".join(report)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content, encoding='utf-8')
    
    return content


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Génère rapport A2 détaillé')
    parser.add_argument('--output', '-o', type=str,
                       help='Chemin fichier output (default: reports/massive-files-YYYY-MM-DD.md)')
    parser.add_argument('--print', '-p', action='store_true',
                       help='Afficher dans terminal aussi')
    
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
    
    print(f"📊 {len(findings)} fichiers massifs détectés\n")
    
    # Déterminer chemin output
    if args.output:
        output_path = Path(args.output)
    else:
        reports_dir = Path(__file__).parent / "reports"
        timestamp = datetime.now().strftime('%Y-%m-%d')
        output_path = reports_dir / f"massive-files-{timestamp}.md"
    
    # Générer rapport
    print(f"📝 Génération rapport...\n")
    content = generate_markdown_report(findings, output_path)
    
    print(f"✅ Rapport généré: {output_path}")
    print(f"   Taille: {len(content)} caractères")
    print(f"   Fichiers analysés: {len(findings)}")
    
    # Afficher dans terminal si demandé
    if args.print:
        print(f"\n{'='*80}")
        print(content)
        print(f"{'='*80}\n")
    
    # Stats rapides
    by_severity = defaultdict(list)
    for finding in findings:
        by_severity[finding.get('severity', 'unknown')].append(finding)
    
    print(f"\n📈 Résumé:")
    for sev in ['critical', 'high', 'medium', 'warning']:
        if sev in by_severity:
            print(f"   {sev}: {len(by_severity[sev])} fichiers")
    
    print(f"\n💡 Voir le rapport complet: cat {output_path}")
    print(f"💡 Ou ouvrir dans VS Code: code {output_path}\n")
    
    return 0


if __name__ == '__main__':
    sys.exit(main())
