#!/usr/bin/env python3
"""
Script pour inspecter le schéma Supabase
Affiche toutes les tables et leurs colonnes
"""

import json
import urllib.request
import urllib.error
import sys

# Configuration Supabase
SUPABASE_URL = "https://cxpojprgwgubzjyqzmoq.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjUzNDU5NSwiZXhwIjoyMDY4MTEwNTk1fQ.ta_KmARDalKoBf6pIKNwZM0e6cBGO3F15CEgfw0lkzY"

def query_supabase(sql_query):
    """Exécute une requête SQL via l'API PostgREST de Supabase"""
    url = f"{SUPABASE_URL}/rest/v1/rpc/exec_sql"
    
    headers = {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_ROLE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    }
    
    data = json.dumps({'query': sql_query}).encode('utf-8')
    
    try:
        req = urllib.request.Request(url, data=data, headers=headers, method='POST')
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        # Essayons une approche différente - requête directe
        print(f"⚠️  RPC non disponible, utilisation de l'approche directe...")
        return None

def get_tables_info():
    """Récupère les informations sur toutes les tables"""
    # Requête pour obtenir toutes les tables du schéma public
    query = """
    SELECT 
        table_name,
        table_type
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name;
    """
    
    return query_supabase(query)

def get_columns_for_table(table_name):
    """Récupère les colonnes d'une table spécifique"""
    query = f"""
    SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = '{table_name}'
    ORDER BY ordinal_position;
    """
    
    return query_supabase(query)

def get_all_tables():
    """Récupère TOUTES les tables via une requête PostgreSQL"""
    try:
        # Utiliser l'endpoint REST de Supabase pour exécuter une requête SQL
        url = f"{SUPABASE_URL}/rest/v1/rpc/exec_sql"
        headers = {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': f'Bearer {SUPABASE_SERVICE_ROLE_KEY}',
            'Content-Type': 'application/json'
        }
        
        # Requête pour lister toutes les tables du schéma public
        query = """
        SELECT tablename 
        FROM pg_catalog.pg_tables 
        WHERE schemaname = 'public' 
        ORDER BY tablename;
        """
        
        data = json.dumps({'query': query}).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers=headers, method='POST')
        
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))
            if isinstance(result, list):
                return [row['tablename'] for row in result]
    except Exception as e:
        print(f"⚠️  Impossible d'utiliser exec_sql: {e}")
    
    return None

def list_tables_via_rest():
    """Liste les tables en interrogeant directement chaque table potentielle"""
    
    # D'abord, essayer de récupérer toutes les tables via SQL
    all_tables = get_all_tables()
    
    if all_tables:
        print(f"✅ Découverte automatique: {len(all_tables)} tables trouvées via SQL\n")
        known_tables = all_tables
    else:
        # Fallback: Tables connues du projet (basées sur le code)
        print("⚠️  Découverte SQL échouée, utilisation de la liste manuelle\n")
        known_tables = [
            'pieces_gamme',
            'auto_marque',
            'auto_modele',
            'auto_version',
            'pieces_piece',
            'pieces_categorie',
            'piece_versions',
            'piece_categories',
            'users',
            'sessions'
        ]
    
    print("=" * 80)
    print("📊 INSPECTION DU SCHÉMA SUPABASE")
    print("=" * 80)
    print()
    
    available_tables = []
    
    for table in known_tables:
        try:
            url = f"{SUPABASE_URL}/rest/v1/{table}?select=*&limit=1"
            headers = {
                'apikey': SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': f'Bearer {SUPABASE_SERVICE_ROLE_KEY}'
            }
            
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode('utf-8'))
                if isinstance(data, list):
                    available_tables.append(table)
                    print(f"✅ Table trouvée: {table}")
                    
                    # Si on a des données, afficher les colonnes
                    if len(data) > 0:
                        columns = list(data[0].keys())
                        print(f"   Colonnes ({len(columns)}): {', '.join(columns)}")
                    else:
                        print(f"   Table vide (pas de données pour détecter les colonnes)")
                    print()
                    
        except urllib.error.HTTPError as e:
            if e.code == 404:
                print(f"❌ Table non trouvée: {table}")
            else:
                print(f"⚠️  Erreur pour {table}: {e.code} - {e.reason}")
        except Exception as e:
            print(f"⚠️  Erreur inattendue pour {table}: {str(e)}")
    
    print("=" * 80)
    print(f"📈 RÉSUMÉ: {len(available_tables)} tables trouvées")
    print("=" * 80)
    print()
    
    return available_tables

def get_sample_data(table_name, limit=3):
    """Récupère des exemples de données d'une table"""
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
    except Exception as e:
        return None

def main():
    print("🔍 Démarrage de l'inspection du schéma Supabase...")
    print()
    
    # Liste toutes les tables disponibles
    tables = list_tables_via_rest()
    
    # Pour chaque table, afficher des détails
    if tables:
        print("\n" + "=" * 80)
        print("📋 DÉTAILS DES TABLES")
        print("=" * 80)
        print()
        
        for table in tables:
            print(f"🔹 Table: {table}")
            print("-" * 80)
            
            # Récupérer un échantillon de données
            sample = get_sample_data(table, limit=2)
            if sample and len(sample) > 0:
                print(f"   Nombre de colonnes: {len(sample[0].keys())}")
                print(f"   Colonnes détectées:")
                for col in sample[0].keys():
                    value = sample[0][col]
                    value_type = type(value).__name__
                    print(f"      • {col} ({value_type})")
                
                print(f"\n   Exemple de données (premier enregistrement):")
                for col, value in sample[0].items():
                    if isinstance(value, str) and len(value) > 50:
                        value = value[:50] + "..."
                    print(f"      {col}: {value}")
            else:
                print("   (Table vide)")
            
            print()
    
    print("=" * 80)
    print("✅ Inspection terminée!")
    print("=" * 80)

if __name__ == "__main__":
    main()
