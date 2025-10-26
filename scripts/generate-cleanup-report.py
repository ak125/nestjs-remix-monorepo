#!/usr/bin/env python3
"""
Génère un rapport complet pour décider quoi faire avec chaque table manquante
Classe les tables par catégorie : à créer, à corriger, ou code à supprimer
"""

import json
from collections import defaultdict
from pathlib import Path

# Charger les données
audit_path = '/workspaces/nestjs-remix-monorepo/scripts/supabase-audit-report.json'
with open(audit_path, 'r') as f:
    audit = json.load(f)

schema_path = '/workspaces/nestjs-remix-monorepo/scripts/supabase-all-97-tables.json'
with open(schema_path, 'r') as f:
    schema = json.load(f)

backend_path = Path('/workspaces/nestjs-remix-monorepo/backend/src')

# Analyser les problèmes
missing_tables = defaultdict(lambda: {'count': 0, 'files': set()})
missing_columns = defaultdict(lambda: {'count': 0, 'files': set(), 'columns': set()})

for issue in audit['issues']:
    if issue['type'] == 'TABLE_NOT_FOUND':
        table = issue['table']
        missing_tables[table]['count'] += 1
        missing_tables[table]['files'].add(issue['file'])
    elif issue['type'] == 'COLUMN_NOT_FOUND':
        table = issue['table']
        col = issue['column']
        missing_columns[table]['count'] += 1
        missing_columns[table]['files'].add(issue['file'])
        missing_columns[table]['columns'].add(col)

# Catégoriser les tables manquantes
categories = {
    'casse_incorrecte': [],  # Majuscules au lieu de minuscules
    'tables_blog': [],       # Tables blog manquantes
    'tables_stock': [],      # Système de stock
    'tables_logs': [],       # Logs et analytics
    'tables_seo': [],        # SEO restantes
    'tables_metier': [],     # Tables métier (produits, véhicules, etc.)
    'code_mort': [],         # Probablement du code obsolète
}

for table, info in missing_tables.items():
    # Casse incorrecte
    if table.isupper() or table != table.lower():
        lower_table = table.lower()
        if lower_table in schema['tables']:
            categories['casse_incorrecte'].append({
                'table': table,
                'correct': lower_table,
                'count': info['count'],
                'files': list(info['files'])
            })
            continue
    
    # Tables blog
    if 'blog' in table.lower():
        categories['tables_blog'].append({
            'table': table,
            'count': info['count'],
            'files': list(info['files'])
        })
    # Tables stock
    elif 'stock' in table.lower():
        categories['tables_stock'].append({
            'table': table,
            'count': info['count'],
            'files': list(info['files'])
        })
    # Tables logs/analytics
    elif any(x in table.lower() for x in ['log', 'analytics', 'metrics']):
        categories['tables_logs'].append({
            'table': table,
            'count': info['count'],
            'files': list(info['files'])
        })
    # Tables SEO
    elif 'seo' in table.lower():
        categories['tables_seo'].append({
            'table': table,
            'count': info['count'],
            'files': list(info['files'])
        })
    # Tables métier
    elif any(x in table.lower() for x in ['product', 'vehicle', 'pieces', 'auto', 'order', 'customer']):
        categories['tables_metier'].append({
            'table': table,
            'count': info['count'],
            'files': list(info['files'])
        })
    # Code mort potentiel
    else:
        categories['code_mort'].append({
            'table': table,
            'count': info['count'],
            'files': list(info['files'])
        })

# Générer le rapport
print("=" * 100)
print("📊 RAPPORT COMPLET - TABLES MANQUANTES ET ACTIONS RECOMMANDÉES")
print("=" * 100)
print()

total_tables = sum(len(v) for v in categories.values())
print(f"📋 {total_tables} tables manquantes classées en {len(categories)} catégories")
print()

# 1. Casse incorrecte - FACILE À CORRIGER
if categories['casse_incorrecte']:
    print("=" * 100)
    print(f"🟢 1. CASSE INCORRECTE - {len(categories['casse_incorrecte'])} tables (CORRECTION AUTOMATIQUE)")
    print("=" * 100)
    print()
    print("✅ Action: Remplacer automatiquement par la version en minuscules")
    print()
    
    for item in sorted(categories['casse_incorrecte'], key=lambda x: x['count'], reverse=True):
        print(f"   {item['count']:3d}x  {item['table']:40s} → {item['correct']}")
        for file in item['files'][:3]:
            print(f"          📄 {file}")
    print()

# 2. Tables blog
if categories['tables_blog']:
    print("=" * 100)
    print(f"🟡 2. TABLES BLOG MANQUANTES - {len(categories['tables_blog'])} tables")
    print("=" * 100)
    print()
    print("💡 Action: Vérifier si ces fonctionnalités blog sont nécessaires")
    print()
    
    for item in sorted(categories['tables_blog'], key=lambda x: x['count'], reverse=True):
        print(f"   {item['count']:3d}x  {item['table']}")
        print(f"          Fichiers: {', '.join(item['files'][:2])}")
        print()

# 3. Tables stock
if categories['tables_stock']:
    print("=" * 100)
    print(f"🟠 3. SYSTÈME DE STOCK - {len(categories['tables_stock'])} tables")
    print("=" * 100)
    print()
    print("💡 Action: Créer les tables de gestion de stock OU désactiver cette fonctionnalité")
    print()
    
    for item in sorted(categories['tables_stock'], key=lambda x: x['count'], reverse=True):
        print(f"   {item['count']:3d}x  {item['table']}")
        print(f"          Fichiers: {', '.join(item['files'][:2])}")
        print()

# 4. Tables logs
if categories['tables_logs']:
    print("=" * 100)
    print(f"🔵 4. LOGS & ANALYTICS - {len(categories['tables_logs'])} tables")
    print("=" * 100)
    print()
    print("💡 Action: Créer les tables de logs OU utiliser un service externe (Sentry, etc.)")
    print()
    
    for item in sorted(categories['tables_logs'], key=lambda x: x['count'], reverse=True):
        print(f"   {item['count']:3d}x  {item['table']}")
        print(f"          Fichiers: {', '.join(item['files'][:2])}")
        print()

# 5. Tables métier
if categories['tables_metier']:
    print("=" * 100)
    print(f"🟣 5. TABLES MÉTIER MANQUANTES - {len(categories['tables_metier'])} tables")
    print("=" * 100)
    print()
    print("💡 Action: Créer les tables OU corriger les noms de tables")
    print()
    
    for item in sorted(categories['tables_metier'], key=lambda x: x['count'], reverse=True):
        print(f"   {item['count']:3d}x  {item['table']}")
        print(f"          Fichiers: {', '.join(item['files'][:2])}")
        print()

# 6. Code mort
if categories['code_mort']:
    print("=" * 100)
    print(f"🔴 6. CODE MORT PROBABLE - {len(categories['code_mort'])} tables")
    print("=" * 100)
    print()
    print("💡 Action: Supprimer le code obsolète")
    print()
    
    for item in sorted(categories['code_mort'], key=lambda x: x['count'], reverse=True):
        print(f"   {item['count']:3d}x  {item['table']}")
        print(f"          Fichiers: {', '.join(item['files'][:2])}")
        print()

# Colonnes manquantes
print("=" * 100)
print(f"🟡 COLONNES MANQUANTES - {len(missing_columns)} tables concernées")
print("=" * 100)
print()

for table, info in sorted(missing_columns.items(), key=lambda x: x[1]['count'], reverse=True)[:15]:
    print(f"📋 {table} ({info['count']} erreurs)")
    print(f"   Colonnes manquantes: {', '.join(sorted(info['columns']))}")
    if table in schema['tables']:
        available = schema['tables'][table][:10]
        print(f"   Colonnes disponibles: {', '.join(available)}")
    print()

# Sauvegarder le rapport structuré
report = {
    'categories': {k: v for k, v in categories.items() if v},
    'missing_columns': {
        table: {
            'count': info['count'],
            'columns': list(info['columns']),
            'files': list(info['files'])
        }
        for table, info in missing_columns.items()
    },
    'statistics': {
        'total_missing_tables': total_tables,
        'by_category': {k: len(v) for k, v in categories.items()},
        'total_missing_columns': len(missing_columns)
    }
}

output_path = '/workspaces/nestjs-remix-monorepo/scripts/cleanup-action-plan.json'
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(report, f, indent=2)

print("=" * 100)
print("📊 RÉSUMÉ DES ACTIONS")
print("=" * 100)
print()
print(f"🟢 Casse incorrecte: {len(categories['casse_incorrecte'])} tables → CORRECTION AUTO")
print(f"🟡 Tables blog: {len(categories['tables_blog'])} tables → DÉCISION MÉTIER")
print(f"🟠 Système stock: {len(categories['tables_stock'])} tables → CRÉER OU DÉSACTIVER")
print(f"🔵 Logs/Analytics: {len(categories['tables_logs'])} tables → CRÉER OU SERVICE EXTERNE")
print(f"🟣 Tables métier: {len(categories['tables_metier'])} tables → CRÉER OU CORRIGER")
print(f"🔴 Code mort: {len(categories['code_mort'])} tables → SUPPRIMER")
print()
print(f"📄 Rapport détaillé: {output_path}")
print("=" * 100)
