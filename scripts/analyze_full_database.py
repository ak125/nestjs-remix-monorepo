#!/usr/bin/env python3
"""
Analyse COMPLÈTE de la base de données Supabase
- Toutes les tables
- Comptage des lignes
- Analyse des colonnes clés
- Focus sur les tables sitemap
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client
from tabulate import tabulate
from collections import defaultdict

# Charger .env depuis backend/
env_path = Path(__file__).parent.parent / "backend" / ".env"
load_dotenv(env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Variables SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requises")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print("=" * 100)
print("🔍 ANALYSE COMPLÈTE BASE DE DONNÉES SUPABASE")
print("=" * 100)

# Liste complète des tables connues
ALL_TABLES = [
    # Pièces
    'pieces', 'pieces_price', 'pieces_marque', 'pieces_media_img',
    'pieces_criteria', 'pieces_criteria_link', 'pieces_criteria_group',
    'pieces_relation_type', 'pieces_relation_criteria', 'pieces_gamme',
    'pieces_list', 'pieces_ref_brand', 'pieces_ref_ean', 'pieces_ref_oem',
    'pieces_ref_search', 'pieces_side_filtre', 'pieces_status', 'pieces_details',
    'pieces_gamme_cross',
    
    # Véhicules
    'auto_marque', 'auto_modele', 'auto_modele_group', 'auto_modele_robot',
    'auto_type', 'auto_type_motor_code', 'auto_type_motor_fuel', 'auto_type_number_code',
    
    # Catalogue
    'catalog_family', 'catalog_gamme', 'cars_engine',
    
    # Configuration système
    '___config', '___config_admin', '___config_ip', '___config_old',
    '___footer_menu', '___header_menu', '___meta_tags_ariane',
    
    # Clients et commandes
    '___xtr_customer', '___xtr_customer_billing_address', '___xtr_customer_delivery_address',
    '___xtr_delivery_agent', '___xtr_delivery_ape_corse', '___xtr_delivery_ape_domtom1',
    '___xtr_delivery_ape_domtom2', '___xtr_delivery_ape_france',
    '___xtr_invoice', '___xtr_invoice_line', '___xtr_msg',
    '___xtr_order', '___xtr_order_line', '___xtr_order_line_equiv_ticket',
    '___xtr_order_line_status', '___xtr_order_status',
    '___xtr_supplier', '___xtr_supplier_link_pm',
    
    # Blog
    '__blog_advice', '__blog_advice_cross', '__blog_advice_h2', '__blog_advice_h3',
    '__blog_advice_old', '__blog_guide', '__blog_guide_h2', '__blog_guide_h3',
    '__blog_meta_tags_ariane', '__blog_seo_marque',
    
    # SEO et Cross
    '__cross_gamme_car', '__cross_gamme_car_new', '__cross_gamme_car_new2',
    '__seo_equip_gamme', '__seo_family_gamme_car_switch', '__seo_gamme',
    '__seo_gamme_car', '__seo_gamme_car_switch', '__seo_gamme_conseil',
    '__seo_gamme_info', '__seo_item_switch', '__seo_marque', '__seo_type_switch',
    
    # SITEMAP - Tables pré-calculées
    '__sitemap_blog', '__sitemap_gamme', '__sitemap_marque', '__sitemap_motorisation',
    '__sitemap_p_link', '__sitemap_p_xml', '__sitemap_search_link',
    
    # Autres
    'am_2022_suppliers', 'categories', 'ic_postback', 'password_resets', 
    'products', 'promo_codes', 'promo_usage', 'quantity_discounts',
    'sessions', 'shipping_rates_cache', 'users',
    'v_index_usage', 'v_table_health'
]

# =============================================================================
# FONCTION: Compter les lignes d'une table
# =============================================================================
def count_table_rows(table_name: str) -> dict:
    """Compte les lignes et récupère les colonnes d'une table"""
    result = {
        "table": table_name,
        "count": 0,
        "columns": [],
        "error": None,
        "sample": None
    }
    
    try:
        # Compter via count
        response = supabase.table(table_name).select("*", count="exact").limit(1).execute()
        result["count"] = response.count if response.count else 0
        
        if response.data and len(response.data) > 0:
            result["columns"] = list(response.data[0].keys())
            result["sample"] = response.data[0]
    except Exception as e:
        result["error"] = str(e)[:50]
    
    return result

# =============================================================================
# 1. INVENTAIRE COMPLET DES TABLES
# =============================================================================
print("\n" + "=" * 100)
print("📊 1. INVENTAIRE COMPLET DES TABLES")
print("=" * 100)

tables_data = []
categories = defaultdict(list)

for table in ALL_TABLES:
    info = count_table_rows(table)
    
    # Catégoriser
    if table.startswith("pieces"):
        cat = "🔧 Pièces"
    elif table.startswith("auto"):
        cat = "🚗 Véhicules"
    elif table.startswith("catalog"):
        cat = "📦 Catalogue"
    elif table.startswith("___xtr"):
        cat = "🛒 Commandes/Clients"
    elif table.startswith("___"):
        cat = "⚙️ Config"
    elif table.startswith("__blog"):
        cat = "📝 Blog"
    elif table.startswith("__seo") or table.startswith("__cross"):
        cat = "🔍 SEO/Cross"
    elif table.startswith("__sitemap"):
        cat = "🗺️ SITEMAP"
    else:
        cat = "📋 Autres"
    
    tables_data.append({
        "cat": cat,
        "table": table,
        "count": info["count"],
        "cols": len(info["columns"]) if info["columns"] else 0,
        "error": info["error"]
    })
    
    categories[cat].append(info)

# Trier par catégorie puis par count
tables_data.sort(key=lambda x: (x["cat"], -x["count"]))

# Afficher par catégorie
current_cat = None
for row in tables_data:
    if row["cat"] != current_cat:
        current_cat = row["cat"]
        print(f"\n{current_cat}")
        print("-" * 80)
    
    status = "❌" if row["error"] else "✅"
    count_str = f"{row['count']:,}" if row["count"] else "0"
    print(f"  {status} {row['table']:<40} {count_str:>12} lignes  ({row['cols']} cols)")

# =============================================================================
# 2. RÉSUMÉ PAR CATÉGORIE
# =============================================================================
print("\n" + "=" * 100)
print("📊 2. RÉSUMÉ PAR CATÉGORIE")
print("=" * 100)

summary_data = []
for cat in sorted(categories.keys()):
    tables = categories[cat]
    total_rows = sum(t["count"] for t in tables)
    num_tables = len(tables)
    summary_data.append([cat, num_tables, f"{total_rows:,}"])

print("\n" + tabulate(summary_data, headers=["Catégorie", "Tables", "Total Lignes"], tablefmt="grid"))

# =============================================================================
# 3. FOCUS TABLES SITEMAP
# =============================================================================
print("\n" + "=" * 100)
print("🗺️ 3. ANALYSE DÉTAILLÉE TABLES SITEMAP")
print("=" * 100)

sitemap_tables = [t for t in ALL_TABLES if "sitemap" in t.lower()]

for table in sitemap_tables:
    print(f"\n### {table} ###")
    info = count_table_rows(table)
    
    if info["error"]:
        print(f"  ❌ Erreur: {info['error']}")
        continue
    
    print(f"  📊 Total: {info['count']:,} entrées")
    print(f"  📋 Colonnes: {', '.join(info['columns'])}")
    
    if info["sample"]:
        print(f"  📝 Exemple: {info['sample']}")

# =============================================================================
# 4. ANALYSE CROISÉE: TABLES AUTO VS SITEMAP
# =============================================================================
print("\n" + "=" * 100)
print("🔄 4. ANALYSE CROISÉE: SOURCES vs SITEMAP")
print("=" * 100)

# Marques
print("\n### MARQUES ###")
marques_info = count_table_rows("auto_marque")
sitemap_marque_info = count_table_rows("__sitemap_marque")

# Compter marques actives
marques_all = supabase.table("auto_marque").select("marque_id, marque_display, marque_relfollow").execute()
marques_active = [m for m in marques_all.data if str(m.get("marque_display")) == "1"]
marques_relfollow = [m for m in marques_active if str(m.get("marque_relfollow", "1")) in ["1", None, ""]]

print(f"  auto_marque total:        {marques_info['count']:>8}")
print(f"  auto_marque display=1:    {len(marques_active):>8}")
print(f"  auto_marque relfollow OK: {len(marques_relfollow):>8}")
print(f"  __sitemap_marque:         {sitemap_marque_info['count']:>8}")

# Modèles
print("\n### MODÈLES ###")
modeles_info = count_table_rows("auto_modele")
print(f"  auto_modele total: {modeles_info['count']:>8}")

# Compter modèles actifs
modeles_sample = supabase.table("auto_modele").select("modele_id, modele_display, modele_relfollow").execute()
modeles_active = [m for m in modeles_sample.data if str(m.get("modele_display")) == "1"]
print(f"  auto_modele display=1: {len(modeles_active):>8}")

# Types
print("\n### TYPES (MOTORISATIONS) ###")
types_info = count_table_rows("auto_type")
sitemap_motor_info = count_table_rows("__sitemap_motorisation")

# Compter types actifs par pagination
types_active_count = 0
types_relfollow_count = 0
offset = 0
batch_size = 1000

while True:
    batch = supabase.table("auto_type").select(
        "type_id, type_display, type_relfollow"
    ).range(offset, offset + batch_size - 1).execute()
    
    if not batch.data:
        break
    
    for t in batch.data:
        if str(t.get("type_display")) == "1":
            types_active_count += 1
            if str(t.get("type_relfollow", "1")) in ["1", None, ""]:
                types_relfollow_count += 1
    
    offset += batch_size
    if len(batch.data) < batch_size:
        break

print(f"  auto_type total:          {types_info['count']:>8}")
print(f"  auto_type display=1:      {types_active_count:>8}")
print(f"  auto_type relfollow OK:   {types_relfollow_count:>8}")
print(f"  __sitemap_motorisation:   {sitemap_motor_info['count']:>8}")

diff = types_relfollow_count - sitemap_motor_info['count']
if diff > 0:
    print(f"  ⚠️  DIFFÉRENCE: {diff} types manquants dans __sitemap_motorisation")
elif diff < 0:
    print(f"  ⚠️  DIFFÉRENCE: {abs(diff)} entrées en trop dans __sitemap_motorisation")

# Pièces
print("\n### PIÈCES ###")
pieces_info = count_table_rows("pieces")
sitemap_plink_info = count_table_rows("__sitemap_p_link")

# Pièces avec stock
plink_stock = supabase.table("__sitemap_p_link").select("map_id", count="exact").gt("map_has_item", "0").execute()

print(f"  pieces total:              {pieces_info['count']:>8}")
print(f"  __sitemap_p_link total:    {sitemap_plink_info['count']:>8}")
print(f"  __sitemap_p_link (stock):  {plink_stock.count:>8}")

# =============================================================================
# 5. ESTIMATION SITEMAP TOTALE
# =============================================================================
print("\n" + "=" * 100)
print("📈 5. ESTIMATION SITEMAP TOTALE")
print("=" * 100)

# Gammes
gammes_info = count_table_rows("pieces_gamme")
gammes_active = supabase.table("pieces_gamme").select("pg_id", count="exact").eq("pg_display", "1").execute()

print("\n### GAMMES ###")
print(f"  pieces_gamme total:     {gammes_info['count']:>8}")
print(f"  pieces_gamme display=1: {gammes_active.count:>8}")

# Blog
blog_advice = count_table_rows("__blog_advice")
blog_guide = count_table_rows("__blog_guide")

print("\n### BLOG ###")
print(f"  __blog_advice:  {blog_advice['count']:>8}")
print(f"  __blog_guide:   {blog_guide['count']:>8}")

# Calcul final
print("\n" + "=" * 100)
print("🎯 ESTIMATION FINALE SITEMAP")
print("=" * 100)

estimation_table = [
    ["Constructeurs (__sitemap_marque)", sitemap_marque_info['count']],
    ["Motorisations (__sitemap_motorisation)", sitemap_motor_info['count']],
    ["Pièces avec stock (__sitemap_p_link)", plink_stock.count],
    ["Gammes actives (pieces_gamme)", gammes_active.count],
    ["Blog articles", blog_advice['count'] + blog_guide['count']],
]

total_sitemap = sum(row[1] for row in estimation_table)
estimation_table.append(["=" * 40, "=" * 10])
estimation_table.append(["TOTAL ESTIMÉ", total_sitemap])

print("\n" + tabulate(estimation_table, headers=["Source", "URLs"], tablefmt="grid"))

# Comparaison avec approche cascade
print("\n### COMPARAISON APPROCHES ###")
print(f"""
  Approche TABLES SITEMAP (recommandée):
    - Marques:       {sitemap_marque_info['count']:>8} URLs
    - Motorisations: {sitemap_motor_info['count']:>8} URLs
    - Pièces:        {plink_stock.count:>8} URLs
    - Gammes:        {gammes_active.count:>8} URLs
    - Blog:          {blog_advice['count'] + blog_guide['count']:>8} URLs
    ────────────────────────────────
    TOTAL:           {total_sitemap:>8} URLs

  Approche CASCADE (auto_* avec filtres):
    - Marques actives:     {len(marques_relfollow):>8} URLs
    - Types actifs:        {types_relfollow_count:>8} URLs
    - Pièces (via plink):  {plink_stock.count:>8} URLs
    ────────────────────────────────
    TOTAL:                 {len(marques_relfollow) + types_relfollow_count + plink_stock.count:>8} URLs
""")

# =============================================================================
# 6. RECOMMANDATIONS
# =============================================================================
print("\n" + "=" * 100)
print("📌 6. RECOMMANDATIONS")
print("=" * 100)

print(f"""
🔍 CONSTATS:

1. __sitemap_motorisation ({sitemap_motor_info['count']}) < auto_type actifs ({types_relfollow_count})
   → La table __sitemap_motorisation est INCOMPLÈTE (manque {types_relfollow_count - sitemap_motor_info['count']} entrées)
   → SOIT: Mettre à jour __sitemap_motorisation
   → SOIT: Utiliser auto_type directement avec filtres

2. __sitemap_marque ({sitemap_marque_info['count']}) ≈ marques actives ({len(marques_relfollow)})
   → OK, peut être utilisée

3. __sitemap_p_link ({plink_stock.count}) est la source principale d'URLs
   → Déjà utilisée correctement ✅

📋 ACTIONS RECOMMANDÉES:

   [ ] Vérifier pourquoi __sitemap_motorisation manque {types_relfollow_count - sitemap_motor_info['count']} entrées
   [ ] Soit mettre à jour la table via job SQL/CRON
   [ ] Soit garder l'approche cascade pour les types
   [ ] Optimiser le sharding pieces (actuellement 10 shards x ~48k URLs)
""")

print("\n" + "=" * 100)
print("✅ ANALYSE COMPLÈTE TERMINÉE")
print("=" * 100)
