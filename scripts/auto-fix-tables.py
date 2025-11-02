#!/usr/bin/env python3
"""
Script de correction automatique pour utiliser les tables existantes
Corrige les noms de tables manquantes qui ont juste besoin du préfixe __
"""

import json
import re
from pathlib import Path

# Charger les données
schema_path = '/workspaces/nestjs-remix-monorepo/scripts/supabase-all-97-tables.json'
with open(schema_path, 'r') as f:
    schema = json.load(f)

audit_path = '/workspaces/nestjs-remix-monorepo/scripts/supabase-audit-report.json'
with open(audit_path, 'r') as f:
    audit = json.load(f)

backend_path = Path('/workspaces/nestjs-remix-monorepo/backend/src')

# Tables qui peuvent être corrigées automatiquement
AUTO_FIXES = {
    'seo_gamme_car': '__seo_gamme_car',
    'seo_gamme_car_switch': '__seo_gamme_car_switch',
    'seo_item_switch': '__seo_item_switch',
    'seo_family_switch': '__seo_family_gamme_car_switch',
    'seo_type_switch': '__seo_type_switch',
    'seo_marque': '__seo_marque',
    'seo_gamme': '__seo_gamme',
}

# Vérifier que les tables de remplacement existent
VALID_FIXES = {k: v for k, v in AUTO_FIXES.items() if v in schema['tables']}

print("=" * 100)
print("🔧 CORRECTION AUTOMATIQUE DES TABLES")
print("=" * 100)
print()
print(f"✅ {len(VALID_FIXES)} corrections possibles:")
for old, new in VALID_FIXES.items():
    print(f"   {old:40s} → {new}")
print()

# Compter les occurrences à corriger
files_to_fix = {}
for issue in audit['issues']:
    if issue['type'] == 'TABLE_NOT_FOUND' and issue['table'] in VALID_FIXES:
        file_path = backend_path / issue['file']
        if file_path not in files_to_fix:
            files_to_fix[file_path] = set()
        files_to_fix[file_path].add(issue['table'])

print(f"📁 {len(files_to_fix)} fichiers à corriger")
print()

# Appliquer les corrections
fixed_count = 0
for file_path, tables in files_to_fix.items():
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        for old_table in tables:
            new_table = VALID_FIXES[old_table]
            
            # Remplacer .from('old_table') par .from('new_table')
            pattern1 = rf"\.from\(['\"]({re.escape(old_table)})['\"]\)"
            content = re.sub(pattern1, f".from('{new_table}')", content)
            
            # Compter les remplacements
            if content != original_content:
                count = original_content.count(f"from('{old_table}')") + original_content.count(f'from("{old_table}")')
                if count > 0:
                    print(f"✅ {file_path.relative_to(backend_path)}")
                    print(f"   {old_table} → {new_table} ({count} occurrences)")
                    fixed_count += count
        
        # Sauvegarder si modifié
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
    except Exception as e:
        print(f"❌ Erreur sur {file_path}: {e}")

print()
print("=" * 100)
print(f"✅ {fixed_count} corrections appliquées")
print("=" * 100)
print()
print("💡 Tables restantes nécessitant une action manuelle:")
print()

# Tables qui n'ont pas de correction automatique
remaining_tables = {}
for issue in audit['issues']:
    if issue['type'] == 'TABLE_NOT_FOUND' and issue['table'] not in VALID_FIXES:
        table = issue['table']
        if table not in remaining_tables:
            remaining_tables[table] = 0
        remaining_tables[table] += 1

for table, count in sorted(remaining_tables.items(), key=lambda x: x[1], reverse=True)[:20]:
    print(f"   {count:3d}x  {table:40s} → ⚠️  À créer ou supprimer le code")

print()
print("=" * 100)
print("🔄 Relancez l'audit pour voir les améliorations:")
print("   python3 /workspaces/nestjs-remix-monorepo/scripts/audit-supabase-usage.py")
print("=" * 100)
