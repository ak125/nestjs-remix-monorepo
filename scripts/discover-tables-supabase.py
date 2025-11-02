#!/usr/bin/env python3
"""
Script pour découvrir TOUTES les tables via Supabase Management API
Utilise l'API de métadonnées de Supabase
"""

import json
import urllib.request
import urllib.error

# Configuration
SUPABASE_URL = "https://cxpojprgwgubzjyqzmoq.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjUzNDU5NSwiZXhwIjoyMDY4MTEwNTk1fQ.ta_KmARDalKoBf6pIKNwZM0e6cBGO3F15CEgfw0lkzY"
PROJECT_REF = "cxpojprgwgubzjyqzmoq"

def get_supabase_schema():
    """Récupère le schéma via l'endpoint REST de Supabase"""
    try:
        # L'endpoint / de PostgREST retourne le schéma OpenAPI
        url = f"{SUPABASE_URL}/rest/v1/"
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Accept': 'application/json'
        }
        
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response:
            content_type = response.headers.get('Content-Type', '')
            data = response.read().decode('utf-8')
            
            # Si c'est du JSON, parser
            if 'json' in content_type:
                schema = json.loads(data)
                return schema
            else:
                print(f"Type de contenu: {content_type}")
                print(f"Données brutes: {data[:500]}...")
                return None
                
    except urllib.error.HTTPError as e:
        print(f"Erreur HTTP {e.code}: {e.reason}")
        if e.code == 404:
            print("L'endpoint n'existe pas")
        return None
    except Exception as e:
        print(f"Erreur: {e}")
        return None

def try_common_tables():
    """Essaie d'accéder à des tables communes pour les découvrir"""
    
    # Liste de préfixes/patterns communs dans les bases Supabase
    common_prefixes = ['auto_', 'pieces_', 'piece_', 'user', 'session', 'auth_']
    common_tables = [
        # Auto
        'auto_marque', 'auto_modele', 'auto_version', 'auto_motorisation',
        'auto_carrosserie', 'auto_energie', 'auto_transmission',
        # Pièces
        'pieces_gamme', 'pieces_piece', 'pieces_categorie', 'pieces_famille',
        'piece_categories', 'piece_versions', 'piece_families',
        # Users
        'users', 'sessions', 'profiles',
        # Autres
        'categories', 'products', 'orders'
    ]
    
    discovered = []
    
    print("🔍 Recherche par essai/erreur de tables communes...")
    print()
    
    for table in common_tables:
        try:
            url = f"{SUPABASE_URL}/rest/v1/{table}?limit=0"
            headers = {
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}',
                'Prefer': 'count=exact'
            }
            
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req) as response:
                # Si pas d'erreur 404, la table existe
                discovered.append(table)
                
                # Récupérer le count depuis le header Content-Range
                content_range = response.headers.get('Content-Range', '')
                if content_range:
                    parts = content_range.split('/')
                    if len(parts) > 1:
                        count = parts[1]
                        print(f"✅ {table:40s} ({count} lignes)")
                else:
                    print(f"✅ {table:40s}")
                    
        except urllib.error.HTTPError as e:
            if e.code != 404:
                print(f"⚠️  {table:40s} Erreur {e.code}")
        except Exception as e:
            pass
    
    return discovered

def get_table_structure(table_name):
    """Récupère la structure d'une table via un SELECT *"""
    try:
        url = f"{SUPABASE_URL}/rest/v1/{table_name}?limit=1"
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}'
        }
        
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            if data and len(data) > 0:
                return list(data[0].keys())
            else:
                # Table vide, essayer avec select=*
                url2 = f"{SUPABASE_URL}/rest/v1/{table_name}?select=*&limit=0"
                req2 = urllib.request.Request(url2, headers=headers)
                with urllib.request.urlopen(req2) as response2:
                    # Pas de données mais on peut voir les colonnes dans certains cas
                    return []
    except Exception as e:
        return None

def expand_discovered_tables(known_tables):
    """
    À partir des tables découvertes, essaie de trouver d'autres tables
    en explorant les patterns de nommage
    """
    expanded = set(known_tables)
    
    # Extraire les préfixes
    prefixes = set()
    for table in known_tables:
        parts = table.split('_')
        if len(parts) > 1:
            prefixes.add(parts[0] + '_')
    
    print(f"\n🔍 Préfixes découverts: {', '.join(sorted(prefixes))}")
    print("🔍 Recherche de variantes...\n")
    
    # Patterns communs
    suffixes = [
        'detail', 'details', 'info', 'infos', 'data',
        'list', 'items', 'entry', 'entries',
        'relation', 'relations', 'link', 'links',
        'meta', 'metadata', 'config', 'settings'
    ]
    
    # Essayer des combinaisons
    for prefix in prefixes:
        for suffix in suffixes:
            potential_table = prefix + suffix
            if potential_table not in expanded:
                if test_table_exists(potential_table):
                    print(f"✅ Trouvé: {potential_table}")
                    expanded.add(potential_table)
    
    return list(expanded)

def test_table_exists(table_name):
    """Test rapide si une table existe"""
    try:
        url = f"{SUPABASE_URL}/rest/v1/{table_name}?limit=0"
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}'
        }
        req = urllib.request.Request(url, headers=headers)
        urllib.request.urlopen(req)
        return True
    except:
        return False

def main():
    print("=" * 100)
    print("🔍 DÉCOUVERTE DES TABLES VIA SUPABASE API")
    print("=" * 100)
    print()
    
    # Méthode 1: Essayer d'obtenir le schéma OpenAPI
    print("📡 Tentative de récupération du schéma OpenAPI...")
    schema = get_supabase_schema()
    
    all_tables = []
    
    if schema and 'definitions' in schema:
        all_tables = list(schema['definitions'].keys())
        print(f"✅ {len(all_tables)} tables trouvées via OpenAPI\n")
        
        # Afficher toutes les tables
        print("=" * 100)
        print(f"📋 LISTE DES {len(all_tables)} TABLES")
        print("=" * 100)
        print()
        
        for i, table in enumerate(sorted(all_tables), 1):
            print(f"[{i:3d}/{len(all_tables)}] 🔹 {table}")
        
        # Récupérer la structure de chaque table
        print()
        print("=" * 100)
        print("🔍 RÉCUPÉRATION DES COLONNES...")
        print("=" * 100)
        print()
        
        tables_info = {}
        for i, table in enumerate(sorted(all_tables), 1):
            print(f"[{i:3d}/{len(all_tables)}] {table:40s}", end=" ... ")
            columns = get_table_structure(table)
            if columns:
                print(f"✅ {len(columns)} colonnes")
                tables_info[table] = columns
            elif columns is not None and len(columns) == 0:
                print("⚠️  Vide")
                tables_info[table] = []
            else:
                print("❌ Erreur")
        
        # Afficher les détails
        print()
        print("=" * 100)
        print("📝 DÉTAILS DES TABLES (Top 20)")
        print("=" * 100)
        print()
        
        count = 0
        for table, columns in sorted(tables_info.items()):
            if columns and count < 20:
                print(f"🔹 {table} ({len(columns)} colonnes)")
                print(f"   Colonnes: {', '.join(columns)}")
                print()
                count += 1
        
        if len(tables_info) > 20:
            print(f"... et {len(tables_info) - 20} autres tables")
            print()
        
        # Sauvegarder
        output_file = "/workspaces/nestjs-remix-monorepo/scripts/supabase-all-97-tables.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump({
                'total_tables': len(all_tables),
                'tables': tables_info,
                'table_names': sorted(all_tables)
            }, f, indent=2, ensure_ascii=False)
        
        print("=" * 100)
        print(f"✅ Résultats sauvegardés: {output_file}")
        print(f"📊 Total: {len(all_tables)} tables")
        print("=" * 100)
        
        return
    else:
        print("⚠️  Schéma OpenAPI non disponible ou format inattendu\n")
        
        # Méthode 2: Découverte par essai/erreur
        print("=" * 100)
        print("🔍 MÉTHODE ALTERNATIVE: Découverte par essai/erreur")
        print("=" * 100)
        print()
        
        discovered = try_common_tables()
        
        if discovered:
            print(f"\n✅ {len(discovered)} tables découvertes!")
            
            # Essayer d'en trouver plus
            all_tables = expand_discovered_tables(discovered)
            
            print()
            print("=" * 100)
            print(f"📋 TOUTES LES TABLES DÉCOUVERTES ({len(all_tables)})")
            print("=" * 100)
            print()
            
            tables_info = {}
            
            for i, table in enumerate(sorted(all_tables), 1):
                print(f"[{i:3d}/{len(all_tables)}] {table:40s}", end=" ... ")
                columns = get_table_structure(table)
                if columns:
                    print(f"✅ {len(columns)} colonnes")
                    tables_info[table] = columns
                elif columns is not None and len(columns) == 0:
                    print("⚠️  Vide")
                    tables_info[table] = []
                else:
                    print("❌ Erreur")
            
            # Afficher les détails
            print()
            print("=" * 100)
            print("📝 DÉTAILS DES TABLES")
            print("=" * 100)
            print()
            
            for table, columns in sorted(tables_info.items()):
                if columns:
                    print(f"🔹 {table} ({len(columns)} colonnes)")
                    print(f"   Colonnes: {', '.join(columns)}")
                    print()
            
            # Sauvegarder
            output_file = "/workspaces/nestjs-remix-monorepo/scripts/supabase-discovered-tables.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'total_tables': len(all_tables),
                    'tables': tables_info,
                    'table_names': sorted(all_tables)
                }, f, indent=2, ensure_ascii=False)
            
            print("=" * 100)
            print(f"✅ Résultats sauvegardés: {output_file}")
            print(f"📊 Total: {len(all_tables)} tables")
            print("=" * 100)
        else:
            print("\n❌ Aucune table découverte")
            print("💡 Veuillez fournir manuellement la liste des tables")

if __name__ == "__main__":
    main()
