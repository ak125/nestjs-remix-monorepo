#!/usr/bin/env python3
"""Générateur de rapport actionnable - Version corrigée"""

import json
from pathlib import Path
from datetime import datetime

results_dir = Path(__file__).parent

print("📊 Génération du rapport...")

# Charger résultats
agents_data = {}
for f in sorted(results_dir.glob('a*_results.json')):
    name = f.stem.replace('_results', '')
    try:
        with open(f) as fp:
            agents_data[name] = json.load(fp)
    except Exception as e:
        print(f"⚠️  Erreur {f.name}: {e}")

if not agents_data:
    print("⚠️  Aucun résultat trouvé.")
    exit(1)

# Extraire les findings de chaque agent
def extract_findings(data):
    """Extrait les findings selon la structure de l'agent"""
    # Si c'est déjà une liste de findings
    if isinstance(data.get('findings'), list):
        # Vérifier si c'est une liste de dicts ou une liste dans un dict
        findings_list = data['findings']
        if findings_list and isinstance(findings_list[0], dict):
            # Vérifier si c'est un wrapper avec un 'findings' interne
            if 'findings' in findings_list[0] and isinstance(findings_list[0]['findings'], list):
                return findings_list[0]['findings']
        return findings_list
    return []

# Compter
total = 0
by_agent = {}

for agent_name, data in agents_data.items():
    findings = extract_findings(data)
    by_agent[agent_name] = len(findings)
    total += len(findings)

# Générer rapport
report = f"""# 📊 Rapport d'Analyse Monorepo NestJS/Remix

**Date** : {datetime.now().strftime('%d/%m/%Y à %H:%M')}  
**Agents exécutés** : {len(agents_data)}  
**Total problèmes détectés** : **{total:,}**

---

## 🎯 Résumé Exécutif

"""

# Labels et émojis
labels = {
    'a1_security': ('🔒', 'Sécurité'),
    'a2_massive_files': ('📏', 'Fichiers Volumineux'),
    'a3_duplications': ('🔁', 'Code Dupliqué'),
    'a4_dead_code': ('💀', 'Code Mort'),
    'a5_complexity': ('🧠', 'Complexité'),
    'a6_dependencies': ('📦', 'Dépendances'),
    'a7_performance': ('⚡', 'Performance'),
    'a8_accessibility': ('♿', 'Accessibilité'),
    'a9_seo': ('🔍', 'SEO'),
    'a10_i18n': ('🌍', 'Internationalisation'),
    'a11_tests': ('🧪', 'Tests'),
    'a12_documentation': ('📚', 'Documentation')
}

# Trier par nombre de problèmes
sorted_agents = sorted(by_agent.items(), key=lambda x: x[1], reverse=True)

# Top 5 agents
report += "### Top 5 des Problèmes\n\n"
for agent_name, count in sorted_agents[:5]:
    emoji, label = labels.get(agent_name, ('📊', agent_name))
    if count > 0:
        report += f"- {emoji} **{label}** : {count:,} problèmes\n"

report += "\n---\n\n## 📋 Détail par Agent\n\n"

# Détail par agent
for agent_name, count in sorted_agents:
    emoji, label = labels.get(agent_name, ('📊', agent_name))
    
    if count == 0:
        report += f"### ✅ {emoji} {label}\n\n**Aucun problème détecté** - Excellent !\n\n"
        continue
    
    report += f"### {emoji} {label}\n\n"
    report += f"**{count:,} problèmes détectés**\n\n"
    
    # Extraire les findings
    findings = extract_findings(agents_data[agent_name])
    
    if not findings:
        report += "*Détails non disponibles*\n\n"
        continue
    
    # Afficher top 5 - DÉDUPLIQUÉ par fichier
    report += "**Top 5 exemples** :\n\n"
    
    # Regrouper par fichier pour éviter répétitions
    by_file = {}
    for f in findings:
        file = f.get('file_path', f.get('file', 'N/A'))
        if file not in by_file:
            by_file[file] = []
        by_file[file].append(f)
    
    # Trier par nombre de problèmes par fichier, puis par sévérité
    severity_order = {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3, 'INFO': 4}
    sorted_files = sorted(
        by_file.items(),
        key=lambda x: (
            -len(x[1]),  # Plus de problèmes d'abord
            severity_order.get(x[1][0].get('severity', 'INFO').upper(), 5)  # Puis par sévérité
        )
    )
    
    # Afficher top 5 fichiers
    for i, (file, file_findings) in enumerate(sorted_files[:5], 1):
        # Premier finding pour les détails
        f = file_findings[0]
        
        # Description contextuelle
        if 'lines' in f:  # Massive files
            desc = f"**{f.get('lines')} lignes** ({f.get('category', 'N/A')})"
            if 'suggestions' in f and f['suggestions']:
                desc += f" - {f['suggestions'][0]}"
        elif 'function_name' in f:  # Complexity
            desc = f"Fonction `{f.get('function_name')}` - Cyclo: {f.get('cyclomatic_complexity', '?')}, Cogn: {f.get('cognitive_complexity', '?')}"
        elif 'category' in f:  # Security, Performance
            desc = f"{f.get('category', 'N/A')}"
            if 'description' in f:
                desc += f" - {f.get('description')[:80]}"
            # Si plusieurs problèmes, indiquer le count
            if len(file_findings) > 1:
                desc += f" ({len(file_findings)} problèmes dans ce fichier)"
        elif 'fragment' in f:  # Duplications
            occurrences = f.get('occurrences', '?')
            lines = f.get('lines_duplicated', '?')
            desc = f"**{occurrences} occurrences** ({lines} lignes dupliquées)"
        else:
            desc = f.get('description', f.get('message', f.get('type', 'N/A')))
            if len(file_findings) > 1:
                desc += f" (+ {len(file_findings)-1} autres problèmes)"
        
        # Tronquer fichier si trop long
        if len(str(file)) > 65:
            file = '...' + str(file)[-62:]
        
        # Sévérité
        severity = str(f.get('severity', '')).upper()
        severity_emoji = {'CRITICAL': '🔴', 'HIGH': '🟠', 'MEDIUM': '🟡', 'LOW': '🟢'}.get(severity, '')
        
        report += f"{i}. `{file}`"
        if severity_emoji:
            report += f" {severity_emoji}"
        report += f"\n   {desc}\n\n"
    
    if len(findings) > 5:
        report += f"*... et {len(findings) - 5:,} autres problèmes*\n\n"

# Plan d'action
report += """---

## 🎯 Plan d'Action Recommandé

"""

# Priorités basées sur les résultats
critical_count = sum(1 for a in sorted_agents if a[1] > 100)
high_count = sum(1 for a in sorted_agents if 20 < a[1] <= 100)

if by_agent.get('a1_security', 0) > 0 or by_agent.get('a2_massive_files', 0) > 50:
    report += f"""### 🔥 Priorité 1 - Cette Semaine

"""
    if by_agent.get('a1_security', 0) > 0:
        report += f"1. **Sécurité** : Analyser et corriger les {by_agent['a1_security']} vulnérabilités\n"
    if by_agent.get('a2_massive_files', 0) > 50:
        report += f"2. **Refactoring** : Découper les 10-15 fichiers les plus volumineux (> 1000 lignes)\n"
    if by_agent.get('a3_duplications', 0) > 200:
        report += f"3. **Duplications** : Extraire le code dupliqué (focus top 20)\n"
    report += "\n"

if by_agent.get('a5_complexity', 0) > 100 or by_agent.get('a7_performance', 0) > 100:
    report += f"""### ⚡ Priorité 2 - Ce Mois

"""
    if by_agent.get('a5_complexity', 0) > 100:
        report += f"1. **Complexité** : Simplifier les fonctions les plus complexes (top 20)\n"
    if by_agent.get('a6_dependencies', 0) > 0:
        report += f"2. **Dépendances** : Mettre à jour packages obsolètes et vulnérables\n"
    if by_agent.get('a7_performance', 0) > 100:
        report += f"3. **Performance** : Optimiser les bottlenecks (console.log, imports, etc.)\n"
    report += "\n"

report += f"""### 📅 Moyen Terme (1-2 Mois)

1. **Tests** : Améliorer couverture ({by_agent.get('a11_tests', 0)} gaps)
2. **Documentation** : Compléter docs manquantes ({by_agent.get('a12_documentation', 0)} items)
3. **Accessibilité** : Corriger WCAG ({by_agent.get('a8_accessibility', 0)} violations)
4. **SEO** : Optimiser référencement ({by_agent.get('a9_seo', 0)} améliorations)
5. **I18n** : Compléter traductions ({by_agent.get('a10_i18n', 0)} clés)

---

## 📊 Vue d'Ensemble

| Agent | Problèmes | Priorité |
|-------|-----------|----------|
"""

for agent_name, count in sorted_agents:
    emoji, label = labels.get(agent_name, ('📊', agent_name))
    priority = '🔴 Haute' if count > 100 else ('🟠 Moyenne' if count > 20 else ('🟢 Basse' if count > 0 else '✅ OK'))
    report += f"| {emoji} {label} | {count:,} | {priority} |\n"

report += f"""

---

**📁 Données brutes** : `*_results.json` (dossier ai-agents-python)  
**🔄 Relancer l'analyse** : `cd ai-agents-python && python run.py`  
**📅 Généré le** : {datetime.now().strftime('%d/%m/%Y à %H:%M:%S')}

"""

# Sauvegarder
output = results_dir / 'RAPPORT_ANALYSE.md'
output.write_text(report)

print(f"✅ Rapport généré : {output}")
print(f"   📊 {total:,} problèmes détectés")
print(f"   📁 {len(agents_data)} agents analysés")
print(f"\n💡 Ouvrez le fichier pour consulter le rapport complet!")
