#!/usr/bin/env python3
"""
ANALYSE SÉCURISÉE: Identifier les colonnes utilisées vs colonnes existantes
pour éviter toute régression
"""

import json
import re
from pathlib import Path
from collections import defaultdict

# Charger le schéma
with open('/workspaces/nestjs-remix-monorepo/scripts/supabase-all-97-tables.json', 'r') as f:
    schema_data = json.load(f)
    schema = schema_data.get('tables', {})

# Tables blog existantes
BLOG_TABLES = {
    '__blog_advice': schema.get('__blog_advice', []),
    '__blog_advice_cross': schema.get('__blog_advice_cross', []),
    '__blog_advice_h2': schema.get('__blog_advice_h2', []),
    '__blog_advice_h3': schema.get('__blog_advice_h3', []),
    '__blog_guide': schema.get('__blog_guide', []),
    '__blog_guide_h2': schema.get('__blog_guide_h2', []),
    '__blog_guide_h3': schema.get('__blog_guide_h3', []),
    '__blog_seo_marque': schema.get('__blog_seo_marque', []),
    '__blog_meta_tags_ariane': schema.get('__blog_meta_tags_ariane', []),
}

print("=" * 100)
print("🔍 ANALYSE SÉCURISÉE - TABLES BLOG LEGACY")
print("=" * 100)
print()

print("📋 TABLES EXISTANTES DANS SUPABASE:")
print()
for table, cols in BLOG_TABLES.items():
    print(f"✅ {table:30} ({len(cols):2} colonnes)")
    if cols:
        print(f"   Préfixe: {cols[0][:3] if cols[0] else '???'}_*")
        print(f"   Colonnes: {', '.join(cols[:5])}")
        if len(cols) > 5:
            print(f"             {', '.join(cols[5:10])}")
    print()

print("=" * 100)
print("🔍 ANALYSE DU CODE BLOG")
print("=" * 100)
print()

backend_path = Path('/workspaces/nestjs-remix-monorepo/backend/src')
blog_files = list(backend_path.glob('**/blog/**/*.ts'))

# Tables non existantes référencées
missing_tables = defaultdict(list)
# Colonnes utilisées par table
columns_used = defaultdict(set)

print(f"📁 Analyse de {len(blog_files)} fichiers blog...")
print()

for file_path in blog_files:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            lines = content.split('\n')
        
        rel_path = str(file_path.relative_to(backend_path))
        
        # Chercher les tables non existantes
        for match in re.finditer(r"\.from\(['\"](__blog_\w+|blog_\w+)['\"]\)", content):
            table = match.group(1)
            if table not in BLOG_TABLES and table not in schema:
                missing_tables[table].append(rel_path)
        
        # Chercher les colonnes utilisées
        for i, line in enumerate(lines, 1):
            # Select avec colonnes spécifiques
            if '.select(' in line and not ".select('*')" in line:
                # Extraire colonnes
                match = re.search(r"\.select\(['\"]([^'\"]+)['\"]\)", line)
                if match:
                    cols = match.group(1)
                    for col in re.split(r',\s*', cols):
                        col = col.strip()
                        if col and col != '*' and not col.startswith('{'):
                            # Déterminer la table (chercher .from avant)
                            for j in range(max(0, i-5), i):
                                table_match = re.search(r"\.from\(['\"](__blog_\w+|blog_\w+)['\"]\)", lines[j])
                                if table_match:
                                    table = table_match.group(1)
                                    columns_used[table].add(col)
                                    break
    except Exception as e:
        print(f"❌ Erreur {file_path}: {e}")

print("=" * 100)
print("⚠️  TABLES NON EXISTANTES RÉFÉRENCÉES")
print("=" * 100)
print()

for table, files in sorted(missing_tables.items()):
    print(f"❌ {table}")
    print(f"   Utilisée dans {len(files)} fichier(s):")
    for f in set(files):
        print(f"   - {f}")
    print()

print("=" * 100)
print("📊 COLONNES UTILISÉES PAR TABLE")
print("=" * 100)
print()

for table, cols in sorted(columns_used.items()):
    print(f"📋 {table}")
    print(f"   Colonnes utilisées: {', '.join(sorted(cols))}")
    
    # Vérifier si la table existe
    if table in BLOG_TABLES:
        real_cols = BLOG_TABLES[table]
        print(f"   ✅ Table existe avec: {', '.join(real_cols[:10])}")
        
        # Vérifier compatibilité
        missing_cols = [c for c in cols if c not in real_cols and c != '*']
        if missing_cols:
            print(f"   ⚠️  Colonnes MANQUANTES: {', '.join(missing_cols)}")
    else:
        print(f"   ❌ Table n'existe PAS")
    print()

print("=" * 100)
print("💡 RECOMMANDATIONS SÉCURISÉES")
print("=" * 100)
print()

print("Option 1: NE RIEN CHANGER pour l'instant")
print("   → Laisser le code tel quel")
print("   → Créer les tables manquantes en production plus tard")
print()

print("Option 2: MAPPER vers tables existantes (RISQUE DE RÉGRESSION)")
print("   → __blog_constructeur → __blog_seo_marque")
print("   → __blog_glossaire → __blog_advice")
print("   ⚠️  Nécessite adaptation des colonnes (bc_* → bsm_* ou ba_*)")
print("   ⚠️  Nécessite tests exhaustifs")
print()

print("Option 3: CRÉER LES TABLES MANQUANTES (RECOMMANDÉ)")
print("   → Créer __blog_constructeur avec colonnes bc_*")
print("   → Créer __blog_glossaire avec colonnes bg_*")
print("   → Migrer données depuis tables legacy si besoin")
print()

print("=" * 100)
print("🎯 DÉCISION RECOMMANDÉE")
print("=" * 100)
print()
print("✅ Option 3 est la plus sûre:")
print("   - Aucune modification du code existant")
print("   - Aucun risque de régression")
print("   - Structure claire et prévisible")
print()
print("=" * 100)
