#!/usr/bin/env python3
"""
Correction automatique de la casse incorrecte des noms de tables
"""

import json
import re
from pathlib import Path

# Charger le rapport
with open('/workspaces/nestjs-remix-monorepo/scripts/cleanup-action-plan.json', 'r') as f:
    plan = json.load(f)

backend_path = Path('/workspaces/nestjs-remix-monorepo/backend/src')

# Tables à corriger (casse incorrecte)
if 'casse_incorrecte' not in plan['categories']:
    print("❌ Aucune correction de casse nécessaire")
    exit(0)

fixes = plan['categories']['casse_incorrecte']

print("=" * 100)
print("🔧 CORRECTION AUTOMATIQUE - CASSE DES TABLES")
print("=" * 100)
print()
print(f"✅ {len(fixes)} tables à corriger")
print()

# Construire le mapping
replacements = {item['table']: item['correct'] for item in fixes}

# Collecter tous les fichiers concernés
files_to_fix = set()
for item in fixes:
    for file in item['files']:
        files_to_fix.add(backend_path / file)

print(f"📁 {len(files_to_fix)} fichiers à modifier")
print()

total_fixes = 0

for file_path in sorted(files_to_fix):
    if not file_path.exists():
        continue
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        file_fixes = 0
        
        for wrong, correct in replacements.items():
            # Remplacer .from('WRONG') par .from('correct')
            pattern = rf"\.from\(['\"]({re.escape(wrong)})['\"]\)"
            matches = re.findall(pattern, content)
            if matches:
                content = re.sub(pattern, f".from('{correct}')", content)
                file_fixes += len(matches)
        
        if content != original_content:
            # Sauvegarder
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            print(f"✅ {file_path.relative_to(backend_path)}")
            print(f"   {file_fixes} corrections appliquées")
            total_fixes += file_fixes
    
    except Exception as e:
        print(f"❌ Erreur sur {file_path}: {e}")

print()
print("=" * 100)
print(f"✅ {total_fixes} corrections de casse appliquées")
print("=" * 100)
print()
print("🔄 Relancez l'audit pour vérifier:")
print("   python3 /workspaces/nestjs-remix-monorepo/scripts/audit-supabase-usage.py")
print("=" * 100)
