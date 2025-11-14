#!/usr/bin/env python3
"""
Script pour trouver dans quelle table/colonne sont stockées les explications techniques
"""

import os
from supabase import create_client

# Configuration Supabase
SUPABASE_URL = "https://cxpojprgwgubzjyqzmoq.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_KEY:
    print("⚠️  SUPABASE_SERVICE_ROLE_KEY non définie")
    print("Export la clé : export SUPABASE_SERVICE_ROLE_KEY='ta-cle'")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print("🔍 Recherche des explications techniques pour courroies d'accessoire (pg_id=10)\n")
print("=" * 80)

# 1. Explorer __seo_item_switch pour voir TOUTES les colonnes
print("\n1️⃣  Table __seo_item_switch - Structure complète:")
print("-" * 80)
result = supabase.table("__seo_item_switch").select("*").eq("sis_pg_id", "10").limit(2).execute()
if result.data:
    print(f"Colonnes disponibles: {list(result.data[0].keys())}")
    for row in result.data:
        print(f"\nAlias {row.get('sis_alias')}: {row}")

# 2. Chercher dans __seo_gamme
print("\n\n2️⃣  Table __seo_gamme (sg_id=10):")
print("-" * 80)
result = supabase.table("__seo_gamme").select("*").eq("sg_pg_id", "10").execute()
if result.data:
    print(f"Colonnes: {list(result.data[0].keys())}")
    for row in result.data:
        for key, value in row.items():
            if value and len(str(value)) > 20:
                print(f"{key}: {str(value)[:100]}...")

# 3. Chercher dans pieces_gamme
print("\n\n3️⃣  Table pieces_gamme (pg_id=10):")
print("-" * 80)
result = supabase.table("pieces_gamme").select("*").eq("pg_id", 10).execute()
if result.data:
    row = result.data[0]
    print(f"Colonnes: {list(row.keys())}")
    for key, value in row.items():
        if value and isinstance(value, str) and len(value) > 30:
            print(f"\n{key}:")
            print(f"  {value[:200]}...")

# 4. Chercher des textes contenant des mots-clés
print("\n\n4️⃣  Recherche textes contenant 'transmission' ou 'poulies' ou 'accessoire':")
print("-" * 80)

tables_to_search = [
    "__seo_item_switch",
    "__seo_gamme", 
    "__seo_gamme_content",
    "__seo_gamme_info"
]

for table_name in tables_to_search:
    try:
        print(f"\n📋 Table: {table_name}")
        result = supabase.table(table_name).select("*").limit(100).execute()
        
        if result.data:
            for row in result.data:
                # Vérifier si pg_id ou sg_pg_id = 10
                if row.get("sis_pg_id") == "10" or row.get("sg_pg_id") == "10" or row.get("pg_id") == 10:
                    for key, value in row.items():
                        if isinstance(value, str) and any(keyword in value.lower() for keyword in ["transmission", "poulies", "accessoire"]):
                            print(f"  ✅ {key}: {value[:150]}...")
    except Exception as e:
        print(f"  ⚠️  Erreur: {e}")

print("\n" + "=" * 80)
print("✅ Recherche terminée !")
