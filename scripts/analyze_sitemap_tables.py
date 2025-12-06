#!/usr/bin/env python3
"""
Analyse approfondie des tables Sitemap dans Supabase
Comparaison entre tables normales (auto_*) et tables pré-calculées (__sitemap_*)
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client
from tabulate import tabulate

# Charger .env depuis backend/
env_path = Path(__file__).parent.parent / "backend" / ".env"
load_dotenv(env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")  # Service role pour accès complet

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Variables SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requises")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print("=" * 80)
print("🔍 ANALYSE DES TABLES SITEMAP - SUPABASE")
print("=" * 80)

# =============================================================================
# 1. ANALYSE DES TABLES AUTO_* (sources normales)
# =============================================================================

print("\n" + "=" * 80)
print("📊 1. TABLES SOURCES (auto_marque, auto_modele, auto_type)")
print("=" * 80)

# Marques
print("\n### AUTO_MARQUE ###")
marques = supabase.table("auto_marque").select("marque_id, marque_alias, marque_display, marque_relfollow").execute()
total_marques = len(marques.data)
marques_display_1 = [m for m in marques.data if str(m.get("marque_display")) == "1"]
marques_relfollow = [m for m in marques_display_1 if str(m.get("marque_relfollow", "1")) in ["1", None, ""]]

print(f"  Total marques: {total_marques}")
print(f"  Marques display=1: {len(marques_display_1)}")
print(f"  Marques display=1 + relfollow OK: {len(marques_relfollow)}")

# IDs des marques actives pour filtrage cascade
active_marque_ids = set(str(m["marque_id"]) for m in marques_display_1)

# Modèles
print("\n### AUTO_MODELE ###")
modeles_count = supabase.table("auto_modele").select("modele_id", count="exact").execute()
total_modeles = modeles_count.count

# Récupérer tous les modèles en pagination
modeles_data = []
offset = 0
batch_size = 1000
while True:
    batch = supabase.table("auto_modele").select(
        "modele_id, modele_alias, modele_marque_id, modele_display, modele_relfollow"
    ).range(offset, offset + batch_size - 1).execute()
    if not batch.data:
        break
    modeles_data.extend(batch.data)
    offset += batch_size
    if len(batch.data) < batch_size:
        break

modeles_display_1 = [m for m in modeles_data if str(m.get("modele_display")) == "1"]
modeles_with_active_marque = [m for m in modeles_display_1 if str(m.get("modele_marque_id")) in active_marque_ids]

print(f"  Total modèles: {total_modeles}")
print(f"  Modèles display=1: {len(modeles_display_1)}")
print(f"  Modèles display=1 + marque active: {len(modeles_with_active_marque)}")
print(f"  ⚠️  PERTE CASCADE MARQUE: {len(modeles_display_1) - len(modeles_with_active_marque)} modèles")

# IDs des modèles actifs pour filtrage cascade
active_modele_ids = set(str(m["modele_id"]) for m in modeles_with_active_marque)

# Types
print("\n### AUTO_TYPE ###")
types_count = supabase.table("auto_type").select("type_id", count="exact").execute()
total_types = types_count.count

# Récupérer les types en pagination
types_data = []
offset = 0
while True:
    batch = supabase.table("auto_type").select(
        "type_id, type_alias, type_marque_id, type_modele_id, type_display, type_relfollow"
    ).range(offset, offset + batch_size - 1).execute()
    if not batch.data:
        break
    types_data.extend(batch.data)
    offset += batch_size
    if len(batch.data) < batch_size:
        break

types_display_1 = [t for t in types_data if str(t.get("type_display")) == "1"]
types_relfollow_ok = [t for t in types_display_1 if str(t.get("type_relfollow", "1")) in ["1", None, ""]]
types_with_active_marque = [t for t in types_relfollow_ok if str(t.get("type_marque_id")) in active_marque_ids]
types_full_cascade = [t for t in types_with_active_marque if str(t.get("type_modele_id")) in active_modele_ids]

print(f"  Total types: {total_types}")
print(f"  Types display=1: {len(types_display_1)}")
print(f"  Types display=1 + relfollow OK: {len(types_relfollow_ok)}")
print(f"  Types + marque active: {len(types_with_active_marque)}")
print(f"  Types + marque + modèle actif (cascade complète): {len(types_full_cascade)}")
print(f"  ⚠️  PERTE CASCADE TOTALE: {len(types_relfollow_ok) - len(types_full_cascade)} types")

# =============================================================================
# 2. ANALYSE DES TABLES __SITEMAP_* (pré-calculées)
# =============================================================================

print("\n" + "=" * 80)
print("📊 2. TABLES PRÉ-CALCULÉES (__sitemap_*)")
print("=" * 80)

# __sitemap_marque
print("\n### __SITEMAP_MARQUE ###")
try:
    sitemap_marque = supabase.table("__sitemap_marque").select("*", count="exact").execute()
    print(f"  ✅ Table existe - {sitemap_marque.count} entrées")
    if sitemap_marque.data and len(sitemap_marque.data) > 0:
        print(f"  Colonnes: {list(sitemap_marque.data[0].keys())}")
        print(f"  Exemple: {sitemap_marque.data[0]}")
except Exception as e:
    print(f"  ❌ Erreur: {e}")

# __sitemap_motorisation
print("\n### __SITEMAP_MOTORISATION ###")
try:
    sitemap_motor_count = supabase.table("__sitemap_motorisation").select("map_id", count="exact").execute()
    print(f"  ✅ Table existe - {sitemap_motor_count.count} entrées")
    
    # Échantillon
    sitemap_motor_sample = supabase.table("__sitemap_motorisation").select("*").limit(5).execute()
    if sitemap_motor_sample.data:
        print(f"  Colonnes: {list(sitemap_motor_sample.data[0].keys())}")
        print(f"  Exemple: {sitemap_motor_sample.data[0]}")
except Exception as e:
    print(f"  ❌ Erreur: {e}")

# __sitemap_p_link
print("\n### __SITEMAP_P_LINK ###")
try:
    sitemap_plink_count = supabase.table("__sitemap_p_link").select("map_id", count="exact").execute()
    total_plink = sitemap_plink_count.count
    
    # Avec stock (map_has_item > 0)
    sitemap_plink_stock = supabase.table("__sitemap_p_link").select("map_id", count="exact").gt("map_has_item", "0").execute()
    with_stock = sitemap_plink_stock.count
    
    print(f"  ✅ Table existe - {total_plink} entrées totales")
    print(f"  Entrées avec stock (map_has_item > 0): {with_stock}")
    
    # Échantillon
    sample = supabase.table("__sitemap_p_link").select("*").limit(3).execute()
    if sample.data:
        print(f"  Colonnes: {list(sample.data[0].keys())}")
except Exception as e:
    print(f"  ❌ Erreur: {e}")

# __sitemap_search_link
print("\n### __SITEMAP_SEARCH_LINK ###")
try:
    sitemap_search = supabase.table("__sitemap_search_link").select("map_id", count="exact").execute()
    print(f"  ✅ Table existe - {sitemap_search.count} entrées")
except Exception as e:
    print(f"  ❌ Erreur ou table vide: {e}")

# __sitemap_blog
print("\n### __SITEMAP_BLOG ###")
try:
    sitemap_blog = supabase.table("__sitemap_blog").select("*", count="exact").execute()
    print(f"  ✅ Table existe - {sitemap_blog.count} entrées")
except Exception as e:
    print(f"  ❌ Erreur: {e}")

# =============================================================================
# 3. COMPARAISON & RECOMMANDATIONS
# =============================================================================

print("\n" + "=" * 80)
print("📊 3. COMPARAISON & ANALYSE")
print("=" * 80)

# Tableau comparatif
comparison_data = []

# Marques
sitemap_marque_count = sitemap_marque.count if 'sitemap_marque' in dir() and sitemap_marque else 0
comparison_data.append([
    "Constructeurs",
    len(marques_relfollow),
    sitemap_marque_count,
    "✅ OK" if abs(len(marques_relfollow) - sitemap_marque_count) < 5 else "⚠️ Différence"
])

# Motorisations (types via __sitemap_motorisation vs cascade)
sitemap_motor_total = sitemap_motor_count.count if 'sitemap_motor_count' in dir() and sitemap_motor_count else 0
comparison_data.append([
    "Motorisations (Types)",
    len(types_full_cascade),
    sitemap_motor_total,
    f"⚠️ PERTE {sitemap_motor_total - len(types_full_cascade)}" if sitemap_motor_total > len(types_full_cascade) else "✅ OK"
])

# Pièces
comparison_data.append([
    "Pièces (avec stock)",
    "-",
    with_stock if 'with_stock' in dir() else 0,
    "✅ Utilisé correctement"
])

print("\n" + tabulate(comparison_data, headers=["Type", "Via cascade auto_*", "Via __sitemap_*", "Status"], tablefmt="grid"))

# =============================================================================
# 4. ESTIMATION URLS TOTALES
# =============================================================================

print("\n" + "=" * 80)
print("📊 4. ESTIMATION URLs SITEMAP")
print("=" * 80)

urls_estimation = []

# Approche actuelle (cascade)
urls_cascade = len(marques_relfollow) + len(modeles_with_active_marque) + len(types_full_cascade)
urls_estimation.append(["Approche CASCADE (actuelle)", urls_cascade])

# Approche tables pré-calculées
urls_precalc = sitemap_marque_count + sitemap_motor_total + (with_stock if 'with_stock' in dir() else 0)
urls_estimation.append(["Approche __sitemap_* (recommandée)", urls_precalc])

# Sans filtrage cascade (potentiel max)
urls_max = len(marques_relfollow) + len(modeles_display_1) + len(types_relfollow_ok) + (with_stock if 'with_stock' in dir() else 0)
urls_estimation.append(["Potentiel MAXIMUM (sans cascade)", urls_max])

print("\n" + tabulate(urls_estimation, headers=["Stratégie", "Estimation URLs"], tablefmt="grid"))

# =============================================================================
# 5. RECOMMANDATIONS FINALES
# =============================================================================

print("\n" + "=" * 80)
print("🎯 5. RECOMMANDATIONS")
print("=" * 80)

print("""
📌 CONSTATS:
""")

if sitemap_motor_total > len(types_full_cascade):
    print(f"   1. __sitemap_motorisation contient {sitemap_motor_total} URLs vs {len(types_full_cascade)} via cascade")
    print(f"      → GAIN POTENTIEL: +{sitemap_motor_total - len(types_full_cascade)} URLs")

print(f"""
   2. La cascade marque_display → modele → type exclut:
      - {len(modeles_display_1) - len(modeles_with_active_marque)} modèles valides
      - {len(types_relfollow_ok) - len(types_full_cascade)} types valides

📌 RECOMMANDATIONS:

   ✅ PRIORITÉ 1: Utiliser __sitemap_motorisation au lieu de auto_type avec cascade
      - Ajouter 'sitemap_motorisation' dans constants.ts
      - Remplacer fetchTypes() par lecture directe de __sitemap_motorisation
      
   ✅ PRIORITÉ 2: Utiliser __sitemap_marque au lieu de auto_marque
      - Données déjà filtrées et validées
      
   ✅ PRIORITÉ 3: Garder __sitemap_p_link pour les pièces (déjà fait ✓)
   
   ⚠️  ATTENTION: Vérifier que __sitemap_motorisation est à jour
      - Comparer avec le nombre de types actifs dans la base
      - Ajouter un job CRON pour régénération si nécessaire
""")

print("\n" + "=" * 80)
print("✅ ANALYSE TERMINÉE")
print("=" * 80)
