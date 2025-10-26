#!/usr/bin/env python3
"""
Script pour découvrir TOUTES les tables Supabase
Utilise différentes méthodes pour une détection complète
"""

import json
import urllib.request
import urllib.error
import sys

# Configuration Supabase
SUPABASE_URL = "https://cxpojprgwgubzjyqzmoq.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjUzNDU5NSwiZXhwIjoyMDY4MTEwNTk1fQ.ta_KmARDalKoBf6pIKNwZM0e6cBGO3F15CEgfw0lkzY"

def get_openapi_schema():
    """Récupère le schéma OpenAPI qui liste toutes les tables disponibles"""
    try:
        url = f"{SUPABASE_URL}/rest/"
        headers = {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': f'Bearer {SUPABASE_SERVICE_ROLE_KEY}',
            'Accept': 'application/openapi+json'
        }
        
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response:
            schema = json.loads(response.read().decode('utf-8'))
            
            # Les tables sont dans le schéma OpenAPI sous "definitions" ou "paths"
            tables = []
            
            # Méthode 1: Via definitions
            if 'definitions' in schema:
                tables = list(schema['definitions'].keys())
            
            # Méthode 2: Via paths
            elif 'paths' in schema:
                for path in schema['paths'].keys():
                    # Les paths sont de la forme "/{table_name}"
                    if path.startswith('/') and not path.startswith('/rpc'):
                        table = path[1:]  # Enlever le /
                        if table and '?' not in table and '{' not in table:
                            tables.append(table)
            
            return sorted(set(tables))
    except Exception as e:
        print(f"❌ Erreur lors de la récupération du schéma OpenAPI: {e}")
        return None

def get_sample_data(table_name, limit=1):
    """Récupère un échantillon de données d'une table"""
    try:
        url = f"{SUPABASE_URL}/rest/v1/{table_name}?select=*&limit={limit}"
        headers = {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': f'Bearer {SUPABASE_SERVICE_ROLE_KEY}'
        }
        
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            return data
    except urllib.error.HTTPError as e:
        return None
    except Exception as e:
        return None

def get_table_columns(table_name):
    """Récupère les colonnes d'une table via un SELECT"""
    sample = get_sample_data(table_name, limit=1)
    if sample and len(sample) > 0:
        return list(sample[0].keys())
    elif sample is not None and len(sample) == 0:
        # Table existe mais est vide
        return []
    return None

def main():
    print("=" * 100)
    print("🔍 DÉCOUVERTE AUTOMATIQUE DE TOUTES LES TABLES SUPABASE")
    print("=" * 100)
    print()
    
    # Récupérer toutes les tables via le schéma OpenAPI
    print("📡 Tentative de récupération via le schéma OpenAPI...")
    tables = get_openapi_schema()
    
    if not tables:
        print("❌ Impossible de récupérer les tables automatiquement")
        print("💡 Veuillez fournir la liste des tables manuellement")
        return
    
    print(f"✅ {len(tables)} tables découvertes !\n")
    
    # Afficher toutes les tables avec leurs colonnes
    print("=" * 100)
    print("📋 LISTE COMPLÈTE DES TABLES")
    print("=" * 100)
    print()
    
    tables_with_data = []
    empty_tables = []
    error_tables = []
    
    for i, table in enumerate(tables, 1):
        print(f"[{i}/{len(tables)}] 🔹 {table}", end=" ... ")
        
        columns = get_table_columns(table)
        
        if columns is None:
            print("❌ Erreur d'accès")
            error_tables.append(table)
        elif len(columns) == 0:
            print("⚠️  Vide")
            empty_tables.append(table)
        else:
            print(f"✅ {len(columns)} colonnes")
            tables_with_data.append({
                'name': table,
                'columns': columns
            })
    
    print()
    print("=" * 100)
    print("📊 RÉSUMÉ")
    print("=" * 100)
    print(f"✅ Tables avec données: {len(tables_with_data)}")
    print(f"⚠️  Tables vides: {len(empty_tables)}")
    print(f"❌ Erreurs d'accès: {len(error_tables)}")
    print()
    
    # Afficher les détails des tables avec données
    if tables_with_data:
        print("=" * 100)
        print("📝 DÉTAILS DES TABLES (avec colonnes)")
        print("=" * 100)
        print()
        
        for table_info in tables_with_data:
            print(f"🔹 {table_info['name']} ({len(table_info['columns'])} colonnes)")
            print(f"   Colonnes: {', '.join(table_info['columns'])}")
            print()
    
    # Sauvegarder dans un fichier JSON
    output_file = "/workspaces/nestjs-remix-monorepo/scripts/supabase-schema.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({
            'total_tables': len(tables),
            'tables_with_data': tables_with_data,
            'empty_tables': empty_tables,
            'error_tables': error_tables,
            'all_tables': tables
        }, f, indent=2, ensure_ascii=False)
    
    print("=" * 100)
    print(f"✅ Schéma sauvegardé dans: {output_file}")
    print("=" * 100)

if __name__ == "__main__":
    main()
