#!/usr/bin/env python3
"""
Generate Actionable Report - Génère un rapport détaillé avec tâches concrètes

Pour chaque agent d'analyse, génère:
- Findings détaillés
- Tâches à réaliser
- Actions concrètes
- Priorités
- Estimations de temps

Usage:
    python generate_actionable_report.py
    python generate_actionable_report.py --agent a2_massive_files
"""

import sys
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List
from collections import defaultdict

from core.config import Config
from core.runner import AgentRunner


def estimate_refactoring_time(lines: int, severity: str) -> str:
    """Estime le temps de refactoring"""
    if severity == 'critical':
        return f"{int(lines / 100)}h-{int(lines / 50)}h"
    elif severity == 'high':
        return f"{int(lines / 150)}h-{int(lines / 100)}h"
    elif severity == 'medium':
        return f"{int(lines / 200)}h-{int(lines / 150)}h"
    else:
        return "30min-1h"


def generate_a2_actionable_report(findings: List[Dict], f):
    """Rapport actionnable A2 - Massive Files avec tâches concrètes"""
    
    f.write("# 📊 A2 - Fichiers Massifs - Rapport Actionnable\n\n")
    f.write(f"**Date**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    f.write(f"**Findings**: {len(findings)} fichiers massifs\n\n")
    
    f.write("---\n\n")
    
    # Grouper par sévérité
    by_severity = defaultdict(list)
    for finding in findings:
        severity = finding.get('severity', 'unknown')
        by_severity[severity].append(finding)
    
    # Statistiques globales
    f.write("## 📈 Vue d'Ensemble\n\n")
    
    total_lines = sum(f['lines'] for f in findings)
    total_threshold = sum(f['threshold'] for f in findings)
    avg_ratio = (total_lines / total_threshold - 1) * 100 if total_threshold > 0 else 0
    
    f.write(f"- **Total fichiers**: {len(findings)}\n")
    f.write(f"- **Total lignes**: {total_lines:,}\n")
    f.write(f"- **Dépassement moyen**: +{avg_ratio:.0f}%\n\n")
    
    f.write("### Par Sévérité\n\n")
    f.write("| Sévérité | Fichiers | Lignes Totales | Temps Estimé |\n")
    f.write("|----------|----------|----------------|---------------|\n")
    
    severity_order = ['critical', 'high', 'medium', 'warning']
    severity_icons = {'critical': '🔴', 'high': '🟠', 'medium': '🟡', 'warning': '🟢'}
    
    total_time_hours = 0
    
    for sev in severity_order:
        if sev not in by_severity:
            continue
        
        items = by_severity[sev]
        icon = severity_icons.get(sev, '⚪')
        total_sev_lines = sum(f['lines'] for f in items)
        
        # Estimation temps
        if sev == 'critical':
            hours_per_file = 4
        elif sev == 'high':
            hours_per_file = 2
        elif sev == 'medium':
            hours_per_file = 1
        else:
            hours_per_file = 0.5
        
        total_hours = len(items) * hours_per_file
        total_time_hours += total_hours
        
        f.write(f"| {icon} {sev.upper()} | {len(items)} | {total_sev_lines:,} | ~{total_hours:.0f}h |\n")
    
    f.write(f"\n**Temps total estimé**: ~{total_time_hours:.0f}h ({total_time_hours/8:.0f} jours)\n\n")
    
    f.write("---\n\n")
    
    # Rapport détaillé par sévérité
    for sev in severity_order:
        if sev not in by_severity:
            continue
        
        items = by_severity[sev]
        icon = severity_icons.get(sev, '⚪')
        
        f.write(f"## {icon} {sev.upper()} - {len(items)} Fichiers\n\n")
        
        # Trier par lignes (desc)
        items.sort(key=lambda x: x['lines'], reverse=True)
        
        f.write(f"### 📋 Liste Complète\n\n")
        
        for i, finding in enumerate(items, 1):
            file_path = finding['file_path']
            lines = finding['lines']
            threshold = finding['threshold']
            ratio = ((lines - threshold) / threshold * 100) if threshold > 0 else 0
            suggestions = finding.get('suggestions', [])
            
            # Nom court pour affichage
            file_name = Path(file_path).name
            
            f.write(f"#### {i}. `{file_name}`\n\n")
            f.write(f"**Path**: `{file_path}`\n\n")
            f.write(f"**Métriques**:\n")
            f.write(f"- Lignes actuelles: **{lines}**\n")
            f.write(f"- Seuil: {threshold}\n")
            f.write(f"- Dépassement: **+{ratio:.0f}%**\n")
            f.write(f"- Temps estimé: **{estimate_refactoring_time(lines, sev)}**\n\n")
            
            # Actions recommandées
            f.write(f"**✅ Actions Recommandées**:\n\n")
            
            if suggestions:
                for j, suggestion in enumerate(suggestions, 1):
                    f.write(f"{j}. {suggestion}\n")
            else:
                f.write("1. Analyser la structure du fichier\n")
                f.write("2. Identifier les sections réutilisables\n")
                f.write("3. Extraire en composants/modules séparés\n")
            
            f.write("\n")
            
            # Tâches concrètes
            f.write(f"**📝 Tâches Concrètes**:\n\n")
            
            # Déterminer type de fichier
            if file_path.endswith('.tsx'):
                f.write("- [ ] Identifier composants à extraire\n")
                f.write("- [ ] Créer sous-composants séparés\n")
                f.write("- [ ] Extraire hooks personnalisés si logique complexe\n")
                f.write("- [ ] Déplacer types dans fichier .types.ts\n")
                f.write("- [ ] Tester après refactoring\n")
            elif file_path.endswith('.ts') and 'service' in file_path:
                f.write("- [ ] Identifier méthodes à extraire\n")
                f.write("- [ ] Créer services spécialisés\n")
                f.write("- [ ] Séparer logique métier/accès données\n")
                f.write("- [ ] Ajouter tests unitaires\n")
                f.write("- [ ] Vérifier injection dépendances\n")
            else:
                f.write("- [ ] Analyser le code\n")
                f.write("- [ ] Identifier sections à extraire\n")
                f.write("- [ ] Refactoriser progressivement\n")
                f.write("- [ ] Tester après chaque extraction\n")
            
            f.write("\n")
            
            # Commande de formatage rapide
            f.write(f"**🔧 Format Rapide** (avant refactoring):\n")
            f.write(f"```bash\n")
            f.write(f"python format_one_by_one.py --severity {sev} --max-files 1\n")
            f.write(f"```\n\n")
            
            f.write("---\n\n")
        
        # Plan d'action par sévérité
        f.write(f"### 🎯 Plan d'Action {sev.upper()}\n\n")
        
        f.write(f"**Objectif**: Refactoriser {len(items)} fichiers {sev}\n\n")
        
        if sev == 'critical':
            f.write(f"**Priorité**: 🔴 **HAUTE** - À traiter en priorité\n\n")
            f.write(f"**Approche Recommandée**:\n")
            f.write(f"1. Commencer par les 3 fichiers les plus gros\n")
            f.write(f"2. Refactoriser un fichier par jour\n")
            f.write(f"3. Review code après chaque refactoring\n")
            f.write(f"4. Commit atomique par fichier\n\n")
            f.write(f"**Timeline**: {len(items) * 4}h → ~{len(items)} jours\n\n")
        
        elif sev == 'high':
            f.write(f"**Priorité**: 🟠 **MOYENNE** - Traiter après CRITICAL\n\n")
            f.write(f"**Approche Recommandée**:\n")
            f.write(f"1. Grouper par type (routes, services, etc.)\n")
            f.write(f"2. Traiter par batch de 5 fichiers\n")
            f.write(f"3. Refactoring léger acceptable\n\n")
            f.write(f"**Timeline**: {len(items) * 2}h → ~{int(len(items) * 2 / 8)} jours\n\n")
        
        elif sev == 'medium':
            f.write(f"**Priorité**: 🟡 **BASSE** - Opportuniste\n\n")
            f.write(f"**Approche Recommandée**:\n")
            f.write(f"1. Refactoriser quand vous touchez le fichier\n")
            f.write(f"2. Extraction simple (composants, utils)\n")
            f.write(f"3. Pas urgent\n\n")
            f.write(f"**Timeline**: ~{len(items)}h total\n\n")
        
        else:  # warning
            f.write(f"**Priorité**: 🟢 **TRÈS BASSE** - Acceptable\n\n")
            f.write(f"**Approche Recommandée**:\n")
            f.write(f"1. Laisser tel quel ou formater uniquement\n")
            f.write(f"2. Améliorer si opportunité\n\n")
            f.write(f"**Timeline**: ~{len(items) * 0.5}h total\n\n")
        
        # Quick wins
        f.write(f"**⚡ Quick Wins** (Format sans refactoring):\n")
        f.write(f"```bash\n")
        f.write(f"# Format tous les fichiers {sev} automatiquement\n")
        f.write(f"python format_one_by_one.py --severity {sev}\n\n")
        f.write(f"# Résultat: {len(items)} commits atomiques\n")
        f.write(f"# Durée: ~{int(len(items) * 0.5)}min\n")
        f.write(f"```\n\n")
        
        f.write("---\n\n")


def generate_a3_actionable_report(findings: List[Dict], f):
    """Rapport actionnable A3 - Duplications avec tâches concrètes"""
    
    f.write("# 🔄 A3 - Duplications de Code - Rapport Actionnable\n\n")
    f.write(f"**Date**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    f.write(f"**Findings**: {len(findings)} duplications\n\n")
    
    f.write("---\n\n")
    
    # Stats globales
    total_occurrences = sum(f.get('occurrences', 0) for f in findings)
    total_impact = sum(f.get('impact_score', 0) for f in findings)
    
    f.write("## 📈 Vue d'Ensemble\n\n")
    f.write(f"- **Duplications détectées**: {len(findings)}\n")
    f.write(f"- **Occurrences totales**: {total_occurrences:,}\n")
    f.write(f"- **Impact total**: {total_impact:,}\n\n")
    
    # Grouper par sévérité
    by_severity = defaultdict(list)
    for finding in findings:
        severity = finding.get('severity', 'minor')
        by_severity[severity].append(finding)
    
    f.write("### Par Sévérité\n\n")
    f.write("| Sévérité | Duplications | Impact Total | Temps Estimé |\n")
    f.write("|----------|--------------|--------------|---------------|\n")
    
    for sev in ['critical', 'high', 'medium', 'minor']:
        if sev in by_severity:
            items = by_severity[sev]
            sev_impact = sum(f.get('impact_score', 0) for f in items)
            
            # Estimation temps (30min par duplication critique)
            if sev == 'critical':
                hours = len(items) * 1
            elif sev == 'high':
                hours = len(items) * 0.5
            else:
                hours = len(items) * 0.25
            
            f.write(f"| {sev.upper()} | {len(items)} | {sev_impact} | ~{hours:.0f}h |\n")
    
    f.write("\n")
    f.write("---\n\n")
    
    # Top 20 duplications par impact
    f.write("## 🔝 Top 20 Duplications à Traiter\n\n")
    
    sorted_findings = sorted(findings, key=lambda x: x.get('impact_score', 0), reverse=True)
    
    for i, finding in enumerate(sorted_findings[:20], 1):
        files = finding.get('files', [])
        occurrences = finding.get('occurrences', 0)
        impact = finding.get('impact_score', 0)
        fragment = finding.get('fragment', '')[:100]
        severity = finding.get('severity', 'minor')
        lines = finding.get('lines_duplicated', 0)
        
        icon_sev = {'critical': '🔴', 'high': '🟠', 'medium': '🟡', 'minor': '🟢'}
        icon = icon_sev.get(severity, '⚪')
        
        f.write(f"### {i}. {icon} Duplication (Impact: {impact})\n\n")
        
        f.write(f"**Métriques**:\n")
        f.write(f"- Impact: **{impact}**\n")
        f.write(f"- Occurrences: {occurrences}\n")
        f.write(f"- Fichiers touchés: {len(files)}\n")
        f.write(f"- Lignes dupliquées: ~{lines}\n")
        f.write(f"- Sévérité: {icon} {severity.upper()}\n\n")
        
        f.write(f"**Fragment**:\n")
        f.write(f"```\n{fragment}\n```\n\n")
        
        f.write(f"**Fichiers Concernés** ({len(files)} fichiers):\n")
        for j, file in enumerate(files[:5], 1):
            f.write(f"{j}. `{file}`\n")
        if len(files) > 5:
            f.write(f"... et {len(files) - 5} autres fichiers\n")
        f.write("\n")
        
        # Actions recommandées
        f.write(f"**✅ Actions Recommandées**:\n\n")
        
        # Déterminer type de duplication
        if 'className' in fragment or 'div' in fragment:
            f.write("**Type**: Duplication JSX/UI\n\n")
            f.write("1. Créer un composant réutilisable\n")
            f.write("2. Extraire dans `components/shared/`\n")
            f.write("3. Accepter props pour personnalisation\n")
            f.write("4. Remplacer dans tous les fichiers\n")
            f.write("5. Tester rendu visuel\n\n")
            
            f.write(f"**Exemple de composant**:\n")
            f.write(f"```tsx\n")
            f.write(f"// components/shared/DuplicatedComponent.tsx\n")
            f.write(f"export function DuplicatedComponent(props) {{\n")
            f.write(f"  return (\n")
            f.write(f"    {fragment[:50]}...\n")
            f.write(f"  );\n")
            f.write(f"}}\n")
            f.write(f"```\n\n")
        
        elif 'async' in fragment or 'function' in fragment or 'return' in fragment:
            f.write("**Type**: Duplication Logique\n\n")
            f.write("1. Créer une fonction utilitaire\n")
            f.write("2. Placer dans `utils/` ou `lib/`\n")
            f.write("3. Paramétrer les variations\n")
            f.write("4. Importer dans les fichiers\n")
            f.write("5. Ajouter tests unitaires\n\n")
            
            f.write(f"**Exemple de fonction**:\n")
            f.write(f"```ts\n")
            f.write(f"// lib/utils/common.ts\n")
            f.write(f"export function extractedFunction(params) {{\n")
            f.write(f"  // {fragment[:50]}...\n")
            f.write(f"}}\n")
            f.write(f"```\n\n")
        
        else:
            f.write("1. Analyser le contexte de duplication\n")
            f.write("2. Identifier pattern commun\n")
            f.write("3. Créer abstraction (composant/fonction/hook)\n")
            f.write("4. Remplacer les occurrences\n")
            f.write("5. Tester\n\n")
        
        # Tâches concrètes
        f.write(f"**📝 Tâches Concrètes**:\n\n")
        f.write(f"- [ ] Créer fichier pour abstraction\n")
        f.write(f"- [ ] Extraire code commun\n")
        f.write(f"- [ ] Remplacer dans {len(files)} fichiers\n")
        f.write(f"- [ ] Tester chaque remplacement\n")
        f.write(f"- [ ] Commit avec message clair\n\n")
        
        # Temps estimé
        time_hours = 0.5 if severity == 'critical' else 0.25
        f.write(f"**⏱️ Temps Estimé**: ~{time_hours * len(files) / 2:.1f}h\n\n")
        
        f.write("---\n\n")
    
    # Plan d'action global
    f.write("## 🎯 Plan d'Action Global\n\n")
    
    f.write("### Phase 1: Duplications CRITICAL (Impact > 200)\n\n")
    critical = [f for f in sorted_findings if f.get('impact_score', 0) > 200]
    f.write(f"- **Nombre**: {len(critical)} duplications\n")
    f.write(f"- **Priorité**: 🔴 HAUTE\n")
    f.write(f"- **Timeline**: ~{len(critical) * 2}h\n\n")
    
    f.write("**Actions**:\n")
    f.write("1. Traiter top 5 en priorité\n")
    f.write("2. Créer composants réutilisables\n")
    f.write("3. Review après chaque extraction\n\n")
    
    f.write("### Phase 2: Duplications HIGH (Impact 100-200)\n\n")
    high = [f for f in sorted_findings if 100 <= f.get('impact_score', 0) < 200]
    f.write(f"- **Nombre**: {len(high)} duplications\n")
    f.write(f"- **Priorité**: 🟠 MOYENNE\n")
    f.write(f"- **Timeline**: ~{len(high)}h\n\n")
    
    f.write("### Phase 3: Duplications MEDIUM/MINOR\n\n")
    low = [f for f in sorted_findings if f.get('impact_score', 0) < 100]
    f.write(f"- **Nombre**: {len(low)} duplications\n")
    f.write(f"- **Priorité**: 🟡 BASSE\n")
    f.write(f"- **Approche**: Opportuniste lors de refactoring\n\n")
    
    f.write("---\n\n")


def generate_a4_actionable_report(findings: List[Dict], f):
    """Rapport actionnable A4 - Dead Code"""
    
    f.write("# 💀 A4 - Code Mort - Rapport Actionnable\n\n")
    f.write(f"**Date**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    f.write(f"**Findings**: {len(findings)} fichiers\n\n")
    
    f.write("---\n\n")
    
    if not findings:
        f.write("## ✅ Excellente Nouvelle !\n\n")
        f.write("**Aucun code mort détecté** dans le projet.\n\n")
        f.write("Le codebase est propre et bien maintenu. 👍\n\n")
        f.write("---\n\n")
        return
    
    # Sinon, lister fichiers morts
    f.write("## 📋 Fichiers Non Utilisés\n\n")
    
    for i, finding in enumerate(findings, 1):
        file_path = finding.get('file_path', 'unknown')
        reason = finding.get('reason', 'Non importé')
        
        f.write(f"### {i}. `{Path(file_path).name}`\n\n")
        f.write(f"**Path**: `{file_path}`\n")
        f.write(f"**Raison**: {reason}\n\n")
        
        f.write(f"**✅ Actions**:\n\n")
        f.write(f"1. Vérifier si réellement inutilisé\n")
        f.write(f"2. Chercher références avec grep\n")
        f.write(f"3. Si mort → Supprimer\n")
        f.write(f"4. Si utilisé → Corriger imports\n\n")
        
        f.write(f"**🔍 Vérification**:\n")
        f.write(f"```bash\n")
        f.write(f"# Chercher références\n")
        f.write(f"grep -r '{Path(file_path).stem}' --include='*.ts' --include='*.tsx'\n")
        f.write(f"```\n\n")
        
        f.write(f"**❌ Suppression**:\n")
        f.write(f"```bash\n")
        f.write(f"git rm {file_path}\n")
        f.write(f"git commit -m \"chore: Remove dead code {Path(file_path).name}\"\n")
        f.write(f"```\n\n")
        
        f.write("---\n\n")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Générer rapport actionnable')
    parser.add_argument('--agent', choices=['a2', 'a3', 'a4', 'all'], default='all',
                       help='Agent spécifique (default: all)')
    parser.add_argument('--output-dir', default='reports',
                       help='Dossier de sortie (default: reports/)')
    
    args = parser.parse_args()
    
    workspace_root = Path(__file__).parent.parent
    config = Config.load(str(Path(__file__).parent / "config.yaml"))
    runner = AgentRunner(config, workspace_root)
    
    # Créer dossier reports
    reports_dir = Path(__file__).parent / args.output_dir
    reports_dir.mkdir(exist_ok=True)
    
    print("🔍 Exécution de l'analyse...\n")
    
    # Exécuter agents
    analysis_results = runner.run_analysis_agents()
    
    print(f"\n✅ Analyse terminée\n")
    
    # Générer rapports par agent
    for result in analysis_results:
        agent_name = result.agent_name
        
        # Filtrer si agent spécifique demandé
        if args.agent != 'all' and not agent_name.startswith(args.agent):
            continue
        
        if not result.findings:
            print(f"⏭️  {agent_name}: Aucun finding, skip rapport")
            continue
        
        output_file = reports_dir / f"{agent_name.upper()}-ACTIONABLE.md"
        
        print(f"📝 Génération rapport {agent_name}...")
        
        with open(output_file, 'w', encoding='utf-8') as f:
            if agent_name == 'a2_massive_files':
                generate_a2_actionable_report(result.findings, f)
            elif agent_name == 'a3_duplications':
                generate_a3_actionable_report(result.findings, f)
            elif agent_name == 'a4_dead_code':
                generate_a4_actionable_report(result.findings, f)
        
        size_kb = output_file.stat().st_size / 1024
        print(f"✅ {output_file.name} généré ({size_kb:.1f} KB)\n")
    
    print(f"\n📊 Résumé:")
    print(f"   - Dossier: {reports_dir}")
    print(f"   - Fichiers: {len(list(reports_dir.glob('*.md')))}\n")
    
    return 0


if __name__ == '__main__':
    sys.exit(main())
