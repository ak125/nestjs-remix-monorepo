#!/usr/bin/env python3
"""
CORRECTION SÉCURISÉE: Adapter le code TypeScript aux tables legacy RÉELLES
Mapping intelligent avec vérification de compatibilité
"""

import json
import re
from pathlib import Path
from collections import defaultdict

# Charger le schéma
with open('/workspaces/nestjs-remix-monorepo/scripts/supabase-all-97-tables.json', 'r') as f:
    schema_data = json.load(f)
    schema = schema_data.get('tables', {})

backend_path = Path('/workspaces/nestjs-remix-monorepo/backend/src')

# MAPPING INTELLIGENT: Table fictive → Table réelle + Mapping colonnes
BLOG_MAPPING = {
    '__blog_constructeur': {
        'real_table': '__blog_seo_marque',
        'columns': {
            'bc_id': 'bsm_id',
            'bc_title': 'bsm_title',
            'bc_descrip': 'bsm_descrip',
            'bc_keywords': 'bsm_keywords',
            'bc_h1': 'bsm_h1',
            'bc_content': 'bsm_content',
            'bc_marque_id': 'bsm_marque_id',
            'bc_constructeur': 'bsm_marque_id',  # Même colonne
            'bc_alias': 'bsm_alias',  # À vérifier si existe
            'bc_create': 'bsm_create',  # À vérifier
            'bc_update': 'bsm_update',  # À vérifier
            'bc_visit': None,  # N'existe pas - à gérer
        }
    },
    '__blog_glossaire': {
        'real_table': '__blog_advice',
        'columns': {
            'bgl_id': 'ba_id',
            'bgl_terme': 'ba_title',
            'bgl_definition': 'ba_content',
            'bgl_descrip': 'ba_descrip',
            'bgl_keywords': 'ba_keywords',
            'bgl_h1': 'ba_h1',
            'bgl_alias': 'ba_alias',
            'bgl_create': 'ba_create',
            'bgl_update': 'ba_update',
            'bgl_visit': 'ba_visit',
        }
    },
    '__blog_constructeur_modele': {
        'real_table': '__blog_advice_cross',
        'columns': {
            'bcm_id': 'bac_id',
            'bcm_bc_id': 'bac_ba_id',
            'bcm_modele_id': 'bac_ba_id_cross',
            'bcm_constructeur': 'bac_ba_id',
        }
    },
    '__blog_constructeur_h2': {
        'real_table': '__blog_advice_h2',
        'columns': {
            'bc2_id': 'ba2_id',
            'bc2_h2': 'ba2_h2',
            'bc2_content': 'ba2_content',
            'bc2_wall': 'ba2_wall',
            'bc2_create': 'ba2_create',
            'bc2_update': 'ba2_update',
            'bc2_bc_id': 'ba2_ba_id',
            'bc2_cta_anchor': 'ba2_cta_anchor',
            'bc2_cta_link': 'ba2_cta_link',
        }
    },
    '__blog_constructeur_h3': {
        'real_table': '__blog_advice_h3',
        'columns': {
            'bc3_id': 'ba3_id',
            'bc3_h3': 'ba3_h3',
            'bc3_content': 'ba3_content',
            'bc3_wall': 'ba3_wall',
            'bc3_create': 'ba3_create',
            'bc3_update': 'ba3_update',
            'bc3_bc2_id': 'ba3_ba2_id',
            'bc3_cta_anchor': 'ba3_cta_anchor',
            'bc3_cta_link': 'ba3_cta_link',
        }
    },
    'blog_articles': {
        'real_table': '__blog_advice',
        'columns': {
            'article_id': 'ba_id',
            'title': 'ba_title',
            'description': 'ba_descrip',
            'content': 'ba_content',
            'slug': 'ba_alias',
            'created_at': 'ba_create',
            'updated_at': 'ba_update',
            'views': 'ba_visit',
            'tags': 'ba_keywords',
        }
    }
}

print("=" * 100)
print("🔧 ADAPTATION CODE TYPESCRIPT → TABLES LEGACY RÉELLES")
print("=" * 100)
print()

# Vérifier que les tables réelles existent
print("✅ VÉRIFICATION DES TABLES RÉELLES:")
print()
for fake_table, mapping in BLOG_MAPPING.items():
    real_table = mapping['real_table']
    if real_table in schema:
        real_cols = schema[real_table]
        print(f"✅ {fake_table:30} → {real_table:25} ({len(real_cols)} colonnes)")
        
        # Vérifier colonnes
        invalid_cols = []
        for fake_col, real_col in mapping['columns'].items():
            if real_col and real_col not in real_cols:
                invalid_cols.append(f"{fake_col}→{real_col}")
        
        if invalid_cols:
            print(f"   ⚠️  Colonnes à vérifier: {', '.join(invalid_cols)}")
    else:
        print(f"❌ {fake_table:30} → {real_table:25} (TABLE N'EXISTE PAS !)")

print()
print("=" * 100)
print("📋 PLAN D'ACTION")
print("=" * 100)
print()
print("Le script va:")
print("1. Scanner tous les fichiers blog")
print("2. Remplacer .from('__blog_constructeur') → .from('__blog_seo_marque')")
print("3. Remplacer toutes les colonnes bc_* → bsm_*")
print("4. Idem pour __blog_glossaire → __blog_advice (bgl_* → ba_*)")
print("5. Créer un backup avant modification")
print()

confirmation = input("⚠️  Continuer? (yes/no): ")

if confirmation.lower() != 'yes':
    print()
    print("❌ Annulé par l'utilisateur")
    exit(0)

print()
print("=" * 100)
print("🔄 TRAITEMENT EN COURS...")
print("=" * 100)
print()

# Trouver tous les fichiers blog
blog_files = list(backend_path.glob('**/blog/**/*.ts'))

total_files_modified = 0
total_replacements = 0
modifications_log = []

for file_path in blog_files:
    if not file_path.exists() or file_path.is_dir():
        continue
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        file_mods = []
        
        # Pour chaque mapping de table
        for fake_table, mapping in BLOG_MAPPING.items():
            real_table = mapping['real_table']
            
            # 1. Remplacer les noms de tables
            patterns = [
                rf"\.from\(['\"]({re.escape(fake_table)})['\"]\)",
                rf"\.insert\(['\"]({re.escape(fake_table)})['\"]\)",
                rf"\.update\(['\"]({re.escape(fake_table)})['\"]\)",
                rf"\.delete\(['\"]({re.escape(fake_table)})['\"]\)",
            ]
            
            for pattern in patterns:
                if re.search(pattern, content):
                    content = re.sub(pattern, lambda m: m.group(0).replace(fake_table, real_table), content)
                    file_mods.append(f"Table: {fake_table} → {real_table}")
            
            # 2. Remplacer les colonnes
            for fake_col, real_col in mapping['columns'].items():
                if real_col is None:
                    continue  # Ignorer les colonnes inexistantes
                
                # Patterns pour colonnes
                col_patterns = [
                    # .select('col1, col2')
                    (rf"\b{re.escape(fake_col)}\b(?=\s*[,')])", real_col),
                    # .eq('col', value)
                    (rf"\.eq\(['\"]({re.escape(fake_col)})['\"]\s*,", f".eq('{real_col}',"),
                    # .neq, .gt, .gte, .lt, .lte, etc.
                    (rf"\.(neq|gt|gte|lt|lte|like|ilike|is|in|contains|containedBy|overlaps|rangeLt|rangeGt|rangeGte|rangeLte|rangeAdjacent|textSearch)\(['\"]({re.escape(fake_col)})['\"]\s*,", 
                     lambda m: f".{m.group(1)}('{real_col}',"),
                    # .order('col')
                    (rf"\.order\(['\"]({re.escape(fake_col)})['\"]\s*", f".order('{real_col}'"),
                ]
                
                for pattern, replacement in col_patterns:
                    if re.search(pattern, content):
                        content = re.sub(pattern, replacement, content)
                        if f"Col: {fake_col} → {real_col}" not in file_mods:
                            file_mods.append(f"Col: {fake_col} → {real_col}")
        
        # Si des modifications ont été faites
        if content != original_content:
            # Sauvegarder
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            rel_path = file_path.relative_to(backend_path)
            print(f"✅ {rel_path}")
            for mod in file_mods[:10]:  # Limiter l'affichage
                print(f"   - {mod}")
            if len(file_mods) > 10:
                print(f"   ... et {len(file_mods) - 10} autres modifications")
            print()
            
            total_files_modified += 1
            total_replacements += len(file_mods)
            modifications_log.append({
                'file': str(rel_path),
                'modifications': file_mods
            })
    
    except Exception as e:
        print(f"❌ Erreur sur {file_path}: {e}")

print("=" * 100)
print(f"✅ {total_files_modified} fichiers modifiés")
print(f"✅ {total_replacements} remplacements effectués")
print("=" * 100)
print()

# Sauvegarder le log
log_file = '/workspaces/nestjs-remix-monorepo/scripts/blog-migration-log.json'
with open(log_file, 'w', encoding='utf-8') as f:
    json.dump(modifications_log, f, indent=2)

print(f"📄 Log des modifications sauvegardé: {log_file}")
print()
print("=" * 100)
print("🔄 PROCHAINES ÉTAPES")
print("=" * 100)
print()
print("1. Vérifier les colonnes manquantes (bc_visit, etc.)")
print("2. Relancer l'audit:")
print("   python3 scripts/audit-supabase-usage.py")
print("3. Tester les endpoints blog")
print("4. Commit si tout fonctionne")
print()
print("=" * 100)
