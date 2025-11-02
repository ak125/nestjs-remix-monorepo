#!/usr/bin/env python3
"""
Correction des tables blog pour utiliser le système legacy existant
__blog_constructeur → __blog_seo_marque (blog marques legacy)
__blog_glossaire → __blog_advice (conseils/glossaire legacy)
__blog_constructeur_modele → __blog_advice_cross (relations)
blog_articles → __blog_advice (articles de conseils)
"""

import re
from pathlib import Path

backend_path = Path('/workspaces/nestjs-remix-monorepo/backend/src')

# Mapping des tables blog vers le système legacy
BLOG_CORRECTIONS = {
    '__blog_constructeur': '__blog_seo_marque',       # Blog marques → SEO marque
    '__blog_constructeur_modele': '__blog_advice_cross',  # Relations → Cross-references
    '__blog_constructeur_h2': '__blog_advice_h2',     # Structure H2
    '__blog_constructeur_h3': '__blog_advice_h3',     # Structure H3
    '__blog_glossaire': '__blog_advice',              # Glossaire → Advice (conseils)
    'blog_articles': '__blog_advice',                 # Articles → Advice
}

print("=" * 100)
print("📰 CORRECTION TABLES BLOG - UTILISER SYSTÈME LEGACY")
print("=" * 100)
print()
print("🔄 Mapping:")
for old, new in BLOG_CORRECTIONS.items():
    print(f"   {old:35} → {new}")
print()

# Trouver tous les fichiers concernés
blog_files = list(backend_path.glob('**/blog/**/*.ts'))
print(f"📁 {len(blog_files)} fichiers blog à scanner")
print()

total_fixes = 0
files_modified = 0

for file_path in blog_files:
    if not file_path.exists() or file_path.is_dir():
        continue
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        file_fixes = 0
        file_corrections = []
        
        # Appliquer chaque correction
        for wrong, correct in BLOG_CORRECTIONS.items():
            # Patterns Supabase
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
            print(f"   ({file_fixes} correction(s))")
            print()
            
            total_fixes += file_fixes
            files_modified += 1
    
    except Exception as e:
        print(f"❌ Erreur sur {file_path}: {e}")

print("=" * 100)
print(f"✅ {total_fixes} corrections appliquées dans {files_modified} fichier(s)")
print("=" * 100)
print()

if total_fixes > 0:
    print("⚠️  ATTENTION: Les colonnes doivent aussi être adaptées!")
    print()
    print("📋 STRUCTURE DES TABLES LEGACY:")
    print()
    print("__blog_advice (conseils/advice):")
    print("  ba_id, ba_title, ba_descrip, ba_keywords, ba_h1, ba_alias,")
    print("  ba_h2, ba_preview, ba_content, ba_wall, ba_create, ba_update,")
    print("  ba_pg_id, ba_visit, ba_cta_anchor, ba_cta_link")
    print()
    print("__blog_seo_marque (blog marques):")
    print("  bsm_id, bsm_title, bsm_descrip, bsm_keywords, bsm_h1, bsm_alias,")
    print("  bsm_preview, bsm_content, bsm_marque_id, etc.")
    print()
    print("__blog_advice_cross (relations croisées):")
    print("  bac_id, bac_ba_id, bac_ba_id_cross")
    print()
    print("__blog_advice_h2 (sections H2):")
    print("  ba2_id, ba2_h2, ba2_content, ba2_wall, ba2_ba_id, etc.")
    print()
    print("__blog_advice_h3 (sections H3):")
    print("  ba3_id, ba3_h3, ba3_content, ba3_wall, ba3_ba2_id, etc.")
    print()

print("=" * 100)
print("🔄 PROCHAINES ÉTAPES:")
print("=" * 100)
print()
print("1. ⚠️  Adapter les colonnes dans le code (préfixes bc_ → bsm_ ou ba_)")
print("2. Relancer l'audit:")
print("   python3 scripts/audit-supabase-usage.py")
print()
print("=" * 100)
