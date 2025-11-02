#!/usr/bin/env python3
"""
Correction automatique des erreurs singulier/pluriel dans les noms de tables
"""

import json
import re
from pathlib import Path

backend_path = Path('/workspaces/nestjs-remix-monorepo/backend/src')

# Mapping des corrections singulier/pluriel basé sur les tables existantes
CORRECTIONS = {
    # Tables qui existent au singulier
    'pieces_marques': 'pieces_marque',
    'auto_models': 'auto_modele',
    'auto_types': 'auto_type',
    'pieces_prices': 'pieces_price',
    'customers': '___xtr_customer',
    'products': 'pieces',  # Selon le contexte
    
    # Tables delivery/company
    'delivery_agents': '___xtr_delivery_agent',
    'company_settings': '___config',
    'user_sessions': 'sessions',
    
    # Tables XTR
    '___xtr_products': 'pieces',
}

print("=" * 100)
print("🔧 CORRECTION AUTOMATIQUE - SINGULIER/PLURIEL")
print("=" * 100)
print()
print(f"✅ {len(CORRECTIONS)} corrections à appliquer")
print()

# Charger l'audit pour trouver les fichiers concernés
try:
    with open('/workspaces/nestjs-remix-monorepo/scripts/supabase-audit-report.json', 'r') as f:
        audit = json.load(f)
    
    issues = audit.get('issues', [])
    table_issues = [i for i in issues if i.get('type') == 'TABLE_NOT_FOUND']
    
    # Trouver les fichiers pour chaque table à corriger
    files_by_table = {}
    for issue in table_issues:
        table = issue.get('table', '')
        if table in CORRECTIONS:
            file = issue.get('file', '')
            if table not in files_by_table:
                files_by_table[table] = set()
            files_by_table[table].add(file)
    
    print("📁 Fichiers à modifier:")
    for table, files in sorted(files_by_table.items()):
        print(f"   {table} → {CORRECTIONS[table]}: {len(files)} fichier(s)")
    print()
    
except Exception as e:
    print(f"⚠️  Impossible de charger l'audit: {e}")
    print("   Utilisation de la recherche dans tous les fichiers...")
    files_by_table = {table: set() for table in CORRECTIONS.keys()}

# Collecter tous les fichiers TypeScript
all_ts_files = list(backend_path.glob('**/*.ts'))
print(f"🔍 Scan de {len(all_ts_files)} fichiers TypeScript...")
print()

total_fixes = 0
files_modified = 0

# Pour chaque fichier
for file_path in all_ts_files:
    if not file_path.exists() or file_path.is_dir():
        continue
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        file_fixes = 0
        file_corrections = []
        
        # Appliquer chaque correction
        for wrong, correct in CORRECTIONS.items():
            # Patterns à rechercher
            patterns = [
                (rf"\.from\(['\"]({re.escape(wrong)})['\"]\)", f".from('{correct}')"),
                (rf"\.insert\(['\"]({re.escape(wrong)})['\"]\)", f".insert('{correct}')"),
                (rf"\.update\(['\"]({re.escape(wrong)})['\"]\)", f".update('{correct}')"),
                (rf"\.delete\(['\"]({re.escape(wrong)})['\"]\)", f".delete('{correct}')"),
            ]
            
            for pattern, replacement in patterns:
                matches = re.findall(pattern, content)
                if matches:
                    content = re.sub(pattern, replacement, content)
                    file_fixes += len(matches)
                    file_corrections.append(f"{wrong} → {correct}")
        
        # Si des modifications ont été faites
        if content != original_content:
            # Sauvegarder
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            rel_path = file_path.relative_to(backend_path)
            print(f"✅ {rel_path}")
            for correction in set(file_corrections):
                print(f"   - {correction}")
            print(f"   ({file_fixes} correction(s) appliquée(s))")
            print()
            
            total_fixes += file_fixes
            files_modified += 1
    
    except Exception as e:
        print(f"❌ Erreur sur {file_path}: {e}")

print("=" * 100)
print(f"✅ {total_fixes} corrections appliquées dans {files_modified} fichier(s)")
print("=" * 100)
print()

# Afficher les corrections par type
if total_fixes > 0:
    print("📊 DÉTAILS DES CORRECTIONS:")
    print()
    for wrong, correct in CORRECTIONS.items():
        # Compter dans tous les fichiers
        count = 0
        for file_path in all_ts_files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    if f".from('{correct}')" in f.read():
                        count += 1
            except:
                pass
        if count > 0:
            print(f"   ✅ {wrong:30} → {correct:30} ({count} fichier(s))")
    print()

print("=" * 100)
print("🔄 PROCHAINES ÉTAPES:")
print("=" * 100)
print()
print("1. Relancer l'audit pour vérifier:")
print("   python3 scripts/audit-supabase-usage.py")
print()
print("2. Générer le rapport mis à jour:")
print("   python3 scripts/generate-executive-summary.py")
print()
print("=" * 100)
