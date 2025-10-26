#!/usr/bin/env python3
"""
Correction automatique des erreurs TypeScript dans les services blog
Remplace les variables non définies (ba_alias, ba_content, etc.) par les bonnes
"""

import re
from pathlib import Path

backend_path = Path('/workspaces/nestjs-remix-monorepo/backend/src')

# Fichiers à corriger
files_to_fix = [
    'modules/blog/services/advice.service.ts',
    'modules/blog/services/blog.service.ts',
    'modules/blog/services/constructeur.service.ts',
    'modules/blog/services/glossary.service.ts',
    'modules/blog/services/guide.service.ts',
]

# Corrections à appliquer
corrections = {
    # Paramètres de fonction
    r'\bba_alias\b(?=[,\)]|\s*:)': 'slug',
    r'\bba_content\b(?=[,\)]|\s*:)': 'content',
    r'\bba_title\b(?=[,\)]|\s*:)': 'title',
    
    # Propriétés d'objet (article.ba_xxx → article.xxx ou data appropriée)
    r'article\.ba_title': 'article.title',
    r'article\.ba_content': 'article.content',
    r'article\.ba_alias': 'article.slug',
    r'article\.ba_visit': 'article.views',
    r'article\.ba_keywords': 'article.keywords',
    
    # Dans les méthodes
    r'updates\.ba_title': 'updates.title',
    r'updates\.ba_content': 'updates.content',
    
    # Propriétés isolées (cas où c'est juste un identifiant)
    # Attention: ne pas remplacer dans les .select() ou .eq()
}

print("=" * 100)
print("🔧 CORRECTION AUTOMATIQUE DES ERREURS TYPESCRIPT")
print("=" * 100)
print()

total_replacements = 0

for file_rel in files_to_fix:
    file_path = backend_path / file_rel
    
    if not file_path.exists():
        print(f"⏭️  Fichier ignoré (n'existe pas): {file_rel}")
        continue
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    file_changes = []
    
    # Appliquer chaque correction
    for pattern, replacement in corrections.items():
        matches = re.findall(pattern, content)
        if matches:
            content = re.sub(pattern, replacement, content)
            file_changes.append(f"{pattern} → {replacement} ({len(matches)}x)")
    
    # Sauvegarder si modifié
    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"✅ {file_rel}")
        for change in file_changes:
            print(f"   - {change}")
        print()
        total_replacements += len(file_changes)
    else:
        print(f"⏭️  Aucune modification: {file_rel}")

print("=" * 100)
print(f"✅ {total_replacements} corrections appliquées")
print("=" * 100)
print()
print("🔄 Relancer la compilation:")
print("   cd backend && npm run build")
print("=" * 100)
