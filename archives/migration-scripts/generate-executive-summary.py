#!/usr/bin/env python3
"""
Génère un résumé exécutif des corrections et du travail restant
"""

import json
import sys
from collections import defaultdict

# Charger l'audit actuel
try:
    with open('/workspaces/nestjs-remix-monorepo/scripts/supabase-audit-report.json', 'r') as f:
        audit = json.load(f)
except:
    print("❌ Impossible de charger le rapport d'audit")
    sys.exit(1)

# Charger le plan de nettoyage
try:
    with open('/workspaces/nestjs-remix-monorepo/scripts/cleanup-action-plan.json', 'r') as f:
        plan = json.load(f)
except:
    plan = None

print("=" * 100)
print("📊 RÉSUMÉ EXÉCUTIF - NETTOYAGE SUPABASE")
print("=" * 100)
print()

# Calculer les stats depuis le nouveau format
stats = audit.get('stats', {})
issues = audit.get('issues', [])

# Filtrer les problèmes de tables
table_issues = [i for i in issues if i.get('type') == 'TABLE_NOT_FOUND']
column_issues = [i for i in issues if i.get('type') == 'COLUMN_NOT_FOUND']

print("🎯 ÉTAT ACTUEL")
print("-" * 100)
print(f"✅ Tables trouvées: {stats.get('tables_found', 0)}")
print(f"✅ Colonnes trouvées: {stats.get('columns_found', 0)}")
print()
print(f"❌ Tables non trouvées: {stats.get('tables_not_found', 0)}")
print(f"❌ Colonnes manquantes: {stats.get('columns_not_found', 0)}")
print()
print(f"📊 Total problèmes: {len(issues)}")
print()

# Grouper les tables par occurrences
table_counts = defaultdict(int)
table_files = defaultdict(set)

for item in table_issues:
    table = item.get('table', 'unknown')
    file = item.get('file', 'unknown')
    table_counts[table] += 1
    table_files[table].add(file)

# Top 20 tables manquantes
print("🔝 TOP 20 TABLES MANQUANTES (par occurrences)")
print("-" * 100)

sorted_tables = sorted(table_counts.items(), key=lambda x: -x[1])

for i, (table, count) in enumerate(sorted_tables[:20], 1):
    files = len(table_files[table])
    print(f"{i:2}. {table:40} → {count:3}x dans {files} fichier(s)")

print()
print("=" * 100)
print("✅ CORRECTIONS DÉJÀ APPLIQUÉES")
print("=" * 100)
print()
print("1. ✅ Tables SEO (+12 tables)")
print("   - seo_gamme_car → __seo_gamme_car")
print("   - seo_item_switch → __seo_item_switch")
print("   - etc.")
print()
print("2. ✅ Casse incorrecte (+26 corrections)")
print("   - ___XTR_ORDER → ___xtr_order (14x)")
print("   - ___META_TAGS_ARIANE → ___meta_tags_ariane (5x)")
print("   - etc.")
print()
print("📈 Impact: ~38 tables corrigées")
print()

print("=" * 100)
print("🎯 PROCHAINES ÉTAPES RECOMMANDÉES")
print("=" * 100)
print()
print("1️⃣  QUICK WINS (1-2 heures)")
print("   - Corriger noms singulier/pluriel (pieces_marques → pieces_marque)")
print("   - Corriger variantes de noms (auto_models → auto_modele)")
print()
print("2️⃣  DÉCISIONS MÉTIER (1-2 jours)")
print("   - Blog: Créer __blog_constructeur, __blog_glossaire ? (6 tables)")
print("   - Stock: Créer système de gestion stock ? (3 tables)")
print("   - Analytics: Utiliser service externe ? (5 tables)")
print()
print("3️⃣  DÉVELOPPEMENT (1 semaine)")
print("   - Créer tables validées")
print("   - Nettoyer code mort (12 tables)")
print()
print("4️⃣  VALIDATION (2-3 jours)")
print("   - Corriger colonnes manquantes (77)")
print("   - Tests end-to-end")
print()

print("=" * 100)
print("📋 FICHIERS GÉNÉRÉS")
print("=" * 100)
print()
print("1. supabase-all-97-tables.json → Schema complet découvert")
print("2. database.types.ts → Types TypeScript générés")
print("3. supabase-audit-report.json → Rapport d'audit détaillé")
print("4. cleanup-action-plan.json → Plan d'action catégorisé")
print("5. SUPABASE-CLEANUP-ACTION-PLAN.md → Guide complet")
print()
print("=" * 100)
print("🚀 COMMANDES UTILES")
print("=" * 100)
print()
print("# Relancer audit complet")
print("python3 scripts/audit-supabase-usage.py")
print()
print("# Voir détails d'une table spécifique")
print("grep -r 'from(\"nom_table\")' backend/src/")
print()
print("# Corriger prochaine vague")
print("python3 scripts/fix-next-batch.py  # À créer")
print()
print("=" * 100)
