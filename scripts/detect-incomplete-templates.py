#!/usr/bin/env python3
"""
Détection et correction des templates HTML incomplets dans le code
Identifie les patterns comme "pour  " ou "de votre  relient"
"""

import re
from pathlib import Path

backend_path = Path('/workspaces/nestjs-remix-monorepo/backend/src')

# Patterns problématiques à détecter
PROBLEMATIC_PATTERNS = [
    # Doubles espaces suspects
    (r'\s{2,}', 'Multiple espaces consécutifs'),
    # Texte incomplet (préposition + espace + mot)
    (r'\bpour\s+quoi\b', '"pour quoi" (devrait être "pourquoi")'),
    (r'\bde\s+,\s+\.', '"de , ." (placeholder vide)'),
    (r'de votre\s+relient', '"de votre  relient" (mot manquant)'),
    # HTML avec placeholders vides
    (r'>(.*?)<', 'Contenu HTML'),
]

print("=" * 100)
print("🔍 DÉTECTION DE TEMPLATES HTML INCOMPLETS")
print("=" * 100)
print()

# Chercher dans tous les fichiers TypeScript
ts_files = list(backend_path.glob('**/*.ts'))

issues_found = []

for file_path in ts_files:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Chercher les strings multilignes avec HTML
        html_strings = re.findall(r"(?:content|description|html):\s*['\"](.{100,}?)['\"]", content, re.DOTALL)
        
        for html in html_strings:
            # Vérifier patterns problématiques
            if 'pour  ' in html or 'de votre  ' in html or 'de  , ' in html:
                rel_path = file_path.relative_to(backend_path)
                issues_found.append({
                    'file': str(rel_path),
                    'snippet': html[:200] + '...',
                    'issues': []
                })
                
                # Détailler les problèmes
                if 'pour  quoi' in html:
                    issues_found[-1]['issues'].append('Placeholder manquant après "pour"')
                if 'de votre  relient' in html:
                    issues_found[-1]['issues'].append('Mot manquant entre "votre" et "relient"')
                if 'de  , ' in html or 'De  , ' in html:
                    issues_found[-1]['issues'].append('Placeholders vides dans liste')
                if 'Attention : .' in html or 'Attention&nbsp;: .' in html:
                    issues_found[-1]['issues'].append('Texte d\'attention incomplet')
                
    except Exception as e:
        pass

if not issues_found:
    print("✅ Aucun template HTML incomplet trouvé dans le code TypeScript")
    print()
    print("📌 Le contenu problématique provient probablement de la BASE DE DONNÉES")
    print()
    print("=" * 100)
    print("💡 SOLUTION RECOMMANDÉE")
    print("=" * 100)
    print()
    print("Ce type de contenu avec placeholders vides est généralement stocké dans:")
    print()
    print("1. Tables blog (__blog_advice, __blog_seo_marque)")
    print("   Colonnes: ba_content, bsm_content, ba_preview, etc.")
    print()
    print("2. Tables SEO (__seo_*, __meta_tags_*)")
    print("   Colonnes: contenu, description, etc.")
    print()
    print("=" * 100)
    print("🔧 CORRECTIONS À APPLIQUER")
    print("=" * 100)
    print()
    print("Le contenu devrait ressembler à:")
    print()
    print("AVANT (incorrect):")
    print('   "Les Bras de suspension de votre  relient le moyeu..."')
    print('   "pour  quoi doivent être"')
    print('   "De  , . De  , ."')
    print()
    print("APRÈS (corrigé):")
    print('   "Les Bras de suspension de votre VÉHICULE relient le moyeu..."')
    print('   "pour LESQUELS doivent être CHANGÉS"')
    print('   "De MARQUE1, MODÈLE1. De MARQUE2, MODÈLE2."')
    print()
    print("=" * 100)
    print("📋 OPTIONS DE CORRECTION")
    print("=" * 100)
    print()
    print("Option 1: CORRIGER EN BASE DE DONNÉES (Recommandé)")
    print("   - Se connecter à Supabase SQL Editor")
    print("   - Identifier les lignes avec content incomplet")
    print("   - UPDATE pour corriger les placeholders")
    print()
    print("Option 2: CRÉER UN FILTRE DANS LE CODE")
    print("   - Ajouter une fonction de post-traitement")
    print("   - Remplacer les placeholders vides par défauts")
    print("   - Exemple: 'de votre  ' → 'de votre véhicule '")
    print()
    print("Option 3: TEMPLATE ENGINE")
    print("   - Utiliser Handlebars/Mustache pour templates")
    print("   - Définir variables manquantes")
    print("   - Remplacer au runtime")
    print()
    
else:
    print(f"⚠️  {len(issues_found)} fichier(s) avec templates HTML incomplets trouvés:")
    print()
    
    for issue in issues_found:
        print(f"📄 {issue['file']}")
        for problem in issue['issues']:
            print(f"   ❌ {problem}")
        print(f"   Extrait: {issue['snippet']}")
        print()

print("=" * 100)
print("🔍 RECHERCHE DANS LA BASE DE DONNÉES")
print("=" * 100)
print()
print("Pour identifier les contenus problématiques en base:")
print()
print("```sql")
print("-- Chercher dans tables blog")
print("SELECT ba_id, ba_title, LEFT(ba_content, 100)")
print("FROM __blog_advice")
print("WHERE ba_content LIKE '%de votre  %'")
print("   OR ba_content LIKE '%pour  quoi%'")
print("   OR ba_content LIKE '%De  , %';")
print()
print("-- Chercher dans SEO marque")
print("SELECT bsm_id, bsm_title, LEFT(bsm_content, 100)")
print("FROM __blog_seo_marque")
print("WHERE bsm_content LIKE '%de votre  %'")
print("   OR bsm_content LIKE '%pour  %';")
print("```")
print()
print("=" * 100)
