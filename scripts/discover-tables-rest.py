#!/usr/bin/env python3
"""
Script pour découvrir TOUTES les tables Supabase via REST uniquement
Interroge les vues système PostgreSQL via l'API REST
"""

import json
import urllib.request
import urllib.error

# Configuration
SUPABASE_URL = "https://cxpojprgwgubzjyqzmoq.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjUzNDU5NSwiZXhwIjoyMDY4MTEwNTk1fQ.ta_KmARDalKoBf6pIKNwZM0e6cBGO3F15CEgfw0lkzY"

def rest_query(endpoint):
    """Effectue une requête REST GET"""
    try:
        url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json'
        }
        
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return None
    except Exception as e:
        return None

def get_all_tables_from_pg_catalog():
    """Interroge pg_catalog.pg_tables via REST"""
    print("📡 Tentative d'accès à pg_catalog.pg_tables...")
    
    # PostgREST expose automatiquement les vues système
    result = rest_query("pg_tables?schemaname=eq.public&select=tablename")
    
    if result:
        tables = [row['tablename'] for row in result]
        return sorted(tables)
    return None

def get_all_tables_from_information_schema():
    """Interroge information_schema.tables via REST"""
    print("📡 Tentative d'accès à information_schema.tables...")
    
    result = rest_query("information_schema.tables?table_schema=eq.public&select=table_name")
    
    if result:
        tables = [row['table_name'] for row in result]
        return sorted(tables)
    return None

def get_columns_for_table_from_information_schema(table_name):
    """Récupère les colonnes via information_schema.columns"""
    endpoint = f"information_schema.columns?table_schema=eq.public&table_name=eq.{table_name}&select=column_name,data_type,is_nullable&order=ordinal_position"
    result = rest_query(endpoint)
    
    if result:
        return [{
            'column': row['column_name'],
            'type': row['data_type'],
            'nullable': row['is_nullable']
        } for row in result]
    return None

def get_sample_data(table_name):
    """Récupère un échantillon de données"""
    result = rest_query(f"{table_name}?limit=1")
    if result and len(result) > 0:
        return list(result[0].keys())
    return None

def main():
    print("=" * 100)
    print("🔍 DÉCOUVERTE COMPLÈTE DES TABLES SUPABASE (via REST)")
    print("=" * 100)
    print()
    
    # Méthode 1: pg_catalog.pg_tables
    tables = get_all_tables_from_pg_catalog()
    
    # Méthode 2: information_schema.tables (fallback)
    if not tables:
        print("⚠️  pg_catalog non accessible, essai avec information_schema...")
        tables = get_all_tables_from_information_schema()
    
    if not tables:
        print("❌ Impossible de découvrir les tables automatiquement")
        print("💡 Les vues système ne sont peut-être pas exposées via PostgREST")
        return
    
    print(f"✅ {len(tables)} tables découvertes !\n")
    
    # Filtrer les tables système
    user_tables = [t for t in tables if not t.startswith('pg_') and t != 'spatial_ref_sys']
    system_tables = [t for t in tables if t.startswith('pg_') or t == 'spatial_ref_sys']
    
    print(f"📊 Tables utilisateur: {len(user_tables)}")
    print(f"🔧 Tables système: {len(system_tables)}")
    print()
    
    # Afficher toutes les tables utilisateur
    print("=" * 100)
    print("📋 TOUTES LES TABLES UTILISATEUR")
    print("=" * 100)
    print()
    
    for i, table in enumerate(user_tables, 1):
        print(f"[{i:3d}/{len(user_tables)}] 🔹 {table}")
    
    print()
    print("=" * 100)
    print("🔍 RÉCUPÉRATION DES COLONNES POUR CHAQUE TABLE...")
    print("=" * 100)
    print()
    
    tables_info = {}
    
    for i, table in enumerate(user_tables, 1):
        print(f"[{i:3d}/{len(user_tables)}] {table:50s}", end=" ... ")
        
        # Essayer via information_schema
        columns = get_columns_for_table_from_information_schema(table)
        
        # Fallback: via échantillon de données
        if not columns:
            col_names = get_sample_data(table)
            if col_names:
                columns = [{'column': c, 'type': 'unknown', 'nullable': 'unknown'} for c in col_names]
        
        if columns:
            print(f"✅ {len(columns)} colonnes")
            tables_info[table] = columns
        else:
            print("⚠️  Vide ou inaccessible")
            tables_info[table] = []
    
    print()
    print("=" * 100)
    print("📝 DÉTAILS DES TABLES")
    print("=" * 100)
    print()
    
    for table, columns in sorted(tables_info.items()):
        if columns:
            print(f"🔹 {table} ({len(columns)} colonnes)")
            for col in columns[:20]:  # Limiter à 20 colonnes pour la lisibilité
                nullable = "NULL" if col['nullable'] == 'YES' else ("NOT NULL" if col['nullable'] == 'NO' else "")
                print(f"   • {col['column']:30s} {col['type']:20s} {nullable}")
            if len(columns) > 20:
                print(f"   ... et {len(columns) - 20} autres colonnes")
            print()
    
    # Sauvegarder
    output_file = "/workspaces/nestjs-remix-monorepo/scripts/supabase-all-tables.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({
            'total_tables': len(user_tables),
            'system_tables': len(system_tables),
            'tables': {
                table: [col['column'] for col in columns]
                for table, columns in tables_info.items()
            },
            'tables_detailed': tables_info,
            'all_table_names': user_tables
        }, f, indent=2, ensure_ascii=False)
    
    print("=" * 100)
    print(f"✅ Schéma complet sauvegardé dans: {output_file}")
    print(f"📊 Total: {len(user_tables)} tables utilisateur")
    print("=" * 100)

if __name__ == "__main__":
    main()
