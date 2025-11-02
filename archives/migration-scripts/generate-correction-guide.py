#!/usr/bin/env python3
"""
Génère un guide de correction pour utiliser uniquement les tables existantes
"""

import json
from collections import defaultdict

# Charger le rapport d'audit
with open('/workspaces/nestjs-remix-monorepo/scripts/supabase-audit-report.json', 'r') as f:
    audit = json.load(f)

# Charger le schéma
with open('/workspaces/nestjs-remix-monorepo/scripts/supabase-all-97-tables.json', 'r') as f:
    schema = json.load(f)

# Mapping des tables manquantes vers leurs équivalents avec __
TABLE_REPLACEMENTS = {
    'seo_gamme_car': '__seo_gamme_car',
    'seo_gamme_car_switch': '__seo_gamme_car_switch',
    'seo_item_switch': '__seo_item_switch',
    'seo_family_switch': '__seo_family_gamme_car_switch',
    'seo_type_switch': '__seo_type_switch',
    'seo_marque': '__seo_marque',
    'seo_gamme': '__seo_gamme',
    'blog_advice': '__blog_advice',
    'blog_guide': '__blog_guide',
    'sitemap_blog': '__sitemap_blog',
    'sitemap_marque': '__sitemap_marque',
    'sitemap_gamme': '__sitemap_gamme',
    'sitemap_p_link': '__sitemap_p_link',
    'sitemap_p_xml': '__sitemap_p_xml',
}

# Grouper les problèmes par fichier
by_file = defaultdict(lambda: {'tables': [], 'columns': []})

for issue in audit['issues']:
    file = issue['file']
    if issue['type'] == 'TABLE_NOT_FOUND':
        by_file[file]['tables'].append(issue)
    elif issue['type'] == 'COLUMN_NOT_FOUND':
        by_file[file]['columns'].append(issue)

print("=" * 100)
print("📋 GUIDE DE CORRECTION - UTILISER UNIQUEMENT LES TABLES EXISTANTES")
print("=" * 100)
print()

print(f"📊 Statistiques:")
print(f"   - {audit['stats']['tables_not_found']} tables à corriger")
print(f"   - {audit['stats']['columns_not_found']} colonnes à corriger")
print(f"   - {len(by_file)} fichiers concernés")
print()

# Tables manquantes les plus fréquentes
table_counts = defaultdict(int)
for issue in audit['issues']:
    if issue['type'] == 'TABLE_NOT_FOUND':
        table_counts[issue['table']] += 1

print("=" * 100)
print("🔴 TOP 10 DES TABLES NON TROUVÉES")
print("=" * 100)
print()

for table, count in sorted(table_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
    replacement = TABLE_REPLACEMENTS.get(table, f"⚠️  AUCUN ÉQUIVALENT TROUVÉ")
    exists = "✅" if replacement in schema['tables'] else "❌"
    print(f"{count:3d}x  {table:40s} → {exists} {replacement}")

print()
print("=" * 100)
print("💡 ACTIONS RECOMMANDÉES PAR FICHIER")
print("=" * 100)
print()

# Prioriser les fichiers avec le plus de problèmes
priority_files = sorted(by_file.items(), 
                       key=lambda x: len(x[1]['tables']) + len(x[1]['columns']), 
                       reverse=True)[:15]

for file, issues in priority_files:
    total = len(issues['tables']) + len(issues['columns'])
    print(f"📄 {file} ({total} problèmes)")
    print("-" * 100)
    
    if issues['tables']:
        print(f"   🔴 Tables à corriger ({len(issues['tables'])}):")
        seen = set()
        for issue in issues['tables']:
            table = issue['table']
            if table in seen:
                continue
            seen.add(table)
            
            replacement = TABLE_REPLACEMENTS.get(table, "❓ À déterminer")
            print(f"      {issue['line']:4d}: {table:35s} → {replacement}")
    
    if issues['columns']:
        print(f"   🟡 Colonnes à vérifier ({len(issues['columns'])}):")
        for issue in issues['columns'][:5]:  # Top 5
            table = issue['table']
            col = issue['column']
            available = schema['tables'].get(table, [])
            print(f"      {issue['line']:4d}: {table}.{col}")
            if available:
                # Suggérer des colonnes similaires
                similar = [c for c in available if col.lower() in c.lower() or c.lower() in col.lower()]
                if similar:
                    print(f"             Similaires: {', '.join(similar[:3])}")
    
    print()

# Sauvegarder le guide de correction
correction_guide = {
    'table_replacements': TABLE_REPLACEMENTS,
    'files_to_fix': {
        file: {
            'tables': [{'line': i['line'], 'old': i['table'], 'new': TABLE_REPLACEMENTS.get(i['table'], '')} 
                      for i in issues['tables']],
            'columns': [{'line': i['line'], 'table': i['table'], 'column': i['column']} 
                       for i in issues['columns']]
        }
        for file, issues in priority_files
    }
}

output_path = '/workspaces/nestjs-remix-monorepo/scripts/correction-guide.json'
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(correction_guide, f, indent=2)

print("=" * 100)
print(f"✅ Guide de correction sauvegardé: {output_path}")
print("=" * 100)
print()
print("💡 Prochaines étapes:")
print("   1. Remplacer les noms de tables sans __ par leurs équivalents avec __")
print("   2. Vérifier que toutes les colonnes utilisées existent réellement")
print("   3. Utiliser le fichier database.types.ts pour le typage TypeScript")
print("   4. Relancer l'audit après corrections")
