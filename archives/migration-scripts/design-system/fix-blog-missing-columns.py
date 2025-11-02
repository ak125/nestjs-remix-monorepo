#!/usr/bin/env python3
"""
Nettoyage final: Supprimer ou commenter les colonnes qui n'existent pas
"""

import re
from pathlib import Path

backend_path = Path('/workspaces/nestjs-remix-monorepo/backend/src')

# Colonnes qui n'existent PAS et qu'il faut gérer
NONEXISTENT_COLUMNS = {
    '__blog_seo_marque': ['bsm_alias', 'bsm_create', 'bsm_update', 'bsm_visit', 'bc_visit'],
}

print("=" * 100)
print("🧹 NETTOYAGE FINAL - COLONNES NON EXISTANTES")
print("=" * 100)
print()

constructeur_file = backend_path / 'modules/blog/services/constructeur.service.ts'

with open(constructeur_file, 'r', encoding='utf-8') as f:
    content = f.read()
    lines = content.split('\n')

print(f"📄 Traitement de: {constructeur_file.name}")
print()

# Trouver les lignes problématiques
issues = []
for i, line in enumerate(lines, 1):
    for col in ['bc_visit', 'bsm_visit', 'bsm_alias', 'bsm_create', 'bsm_update']:
        if col in line and not line.strip().startswith('//'):
            issues.append((i, line.strip(), col))

print(f"⚠️  {len(issues)} utilisations de colonnes non existantes trouvées:")
print()

for line_num, line, col in issues[:20]:
    print(f"   Ligne {line_num}: {col}")
    print(f"      {line[:80]}...")
    print()

print("=" * 100)
print("💡 SOLUTIONS PROPOSÉES")
print("=" * 100)
print()
print("Option 1: COMMENTER les colonnes manquantes")
print("   → Les lignes avec bc_visit, bsm_update, etc. sont mises en commentaire")
print("   → Le code continue de fonctionner mais sans ces champs")
print()
print("Option 2: UTILISER DES VALEURS PAR DÉFAUT")
print("   → bc_visit → Remplacer par 0 ou supprimer de .select()")
print("   → bsm_update → Utiliser NOW() ou supprimer")
print()
print("Option 3: AJOUTER CES COLONNES EN BASE (RECOMMANDÉ)")
print("   → ALTER TABLE __blog_seo_marque ADD COLUMN bsm_visit INTEGER DEFAULT 0;")
print("   → ALTER TABLE __blog_seo_marque ADD COLUMN bsm_update TIMESTAMP DEFAULT NOW();")
print()

choice = input("Choisir option (1/2/3): ")

if choice == '1':
    # Commenter les lignes
    new_lines = []
    for i, line in enumerate(lines):
        if any(col in line for col in ['bc_visit', 'bsm_visit', 'bsm_update', 'bsm_alias']):
            if not line.strip().startswith('//'):
                # Conserver l'indentation
                indent = len(line) - len(line.lstrip())
                new_lines.append(' ' * indent + '// TODO: Colonne n\'existe pas - ' + line.strip())
            else:
                new_lines.append(line)
        else:
            new_lines.append(line)
    
    # Sauvegarder
    with open(constructeur_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(new_lines))
    
    print()
    print(f"✅ {len([l for l in new_lines if 'TODO: Colonne' in l])} lignes commentées")

elif choice == '2':
    # Supprimer les colonnes des .select()
    content_new = content
    
    # Patterns à nettoyer
    patterns = [
        # Supprimer bc_visit, ou bsm_update, des select
        (r",\s*bc_visit\b", ""),  
        (r"\bbc_visit\s*,\s*", ""),
        (r",\s*bsm_update\b", ""),
        (r"\bsm_update\s*,\s*", ""),
        (r",\s*bsm_alias\b", ""),
        (r"\bsm_alias\s*,\s*", ""),
        # Order by bc_visit → commenter
        (r"\.order\('bc_visit'[^)]*\)", "// .order() removed - column doesn't exist"),
        (r"\.order\('bsm_update'[^)]*\)", "// .order() removed - column doesn't exist"),
    ]
    
    for pattern, replacement in patterns:
        content_new = re.sub(pattern, replacement, content_new)
    
    with open(constructeur_file, 'w', encoding='utf-8') as f:
        f.write(content_new)
    
    print()
    print("✅ Colonnes supprimées des requêtes")

elif choice == '3':
    print()
    print("📝 SQL À EXÉCUTER DANS SUPABASE:")
    print()
    print("```sql")
    print("-- Ajouter colonnes manquantes à __blog_seo_marque")
    print("ALTER TABLE __blog_seo_marque ")
    print("  ADD COLUMN IF NOT EXISTS bsm_alias VARCHAR(255),")
    print("  ADD COLUMN IF NOT EXISTS bsm_create TIMESTAMP DEFAULT NOW(),")
    print("  ADD COLUMN IF NOT EXISTS bsm_update TIMESTAMP DEFAULT NOW(),")
    print("  ADD COLUMN IF NOT EXISTS bsm_visit INTEGER DEFAULT 0;")
    print()
    print("-- Index pour performance")
    print("CREATE INDEX IF NOT EXISTS idx_blog_seo_marque_visit ON __blog_seo_marque(bsm_visit DESC);")
    print("CREATE INDEX IF NOT EXISTS idx_blog_seo_marque_update ON __blog_seo_marque(bsm_update DESC);")
    print("```")
    print()
    print("Après avoir exécuté ce SQL, le code fonctionnera sans modification.")

else:
    print()
    print("❌ Option invalide")

print()
print("=" * 100)
