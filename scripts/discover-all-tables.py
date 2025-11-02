#!/usr/bin/env python3
"""
Script ultime pour découvrir TOUTES les tables Supabase
Utilise une requête SQL directe via supabase-py
"""

from supabase import create_client, Client
import json

# Configuration
SUPABASE_URL = "https://cxpojprgwgubzjyqzmoq.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjUzNDU5NSwiZXhwIjoyMDY4MTEwNTk1fQ.ta_KmARDalKoBf6pIKNwZM0e6cBGO3F15CEgfw0lkzY"

def main():
    print("=" * 100)
    print("🔍 DÉCOUVERTE COMPLÈTE DES TABLES SUPABASE (via supabase-py)")
    print("=" * 100)
    print()
    
    # Créer le client Supabase
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    print("📡 Exécution de la requête SQL pour lister toutes les tables...")
    
    try:
        # Requête SQL pour obtenir toutes les tables et leurs colonnes
        result = supabase.rpc('exec_sql', {
            'query': """
                SELECT 
                    table_name,
                    column_name,
                    data_type,
                    is_nullable
                FROM information_schema.columns
                WHERE table_schema = 'public'
                ORDER BY table_name, ordinal_position;
            """
        }).execute()
        
        if result.data:
            # Organiser par table
            tables_info = {}
            for row in result.data:
                table = row['table_name']
                if table not in tables_info:
                    tables_info[table] = []
                tables_info[table].append({
                    'column': row['column_name'],
                    'type': row['data_type'],
                    'nullable': row['is_nullable']
                })
            
            print(f"✅ {len(tables_info)} tables découvertes !\n")
            
            # Afficher toutes les tables
            print("=" * 100)
            print("📋 TOUTES LES TABLES")
            print("=" * 100)
            print()
            
            for i, (table, columns) in enumerate(sorted(tables_info.items()), 1):
                print(f"[{i:3d}/{len(tables_info)}] 🔹 {table:40s} ({len(columns):3d} colonnes)")
            
            print()
            print("=" * 100)
            print("📝 DÉTAILS DES TABLES (avec colonnes)")
            print("=" * 100)
            print()
            
            for table, columns in sorted(tables_info.items()):
                print(f"🔹 {table} ({len(columns)} colonnes)")
                for col in columns:
                    nullable = "NULL" if col['nullable'] == 'YES' else "NOT NULL"
                    print(f"   • {col['column']:30s} {col['type']:20s} {nullable}")
                print()
            
            # Sauvegarder
            output_file = "/workspaces/nestjs-remix-monorepo/scripts/supabase-complete-schema.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'total_tables': len(tables_info),
                    'tables': {
                        table: [col['column'] for col in columns]
                        for table, columns in tables_info.items()
                    },
                    'tables_detailed': tables_info
                }, f, indent=2, ensure_ascii=False)
            
            print("=" * 100)
            print(f"✅ Schéma complet sauvegardé dans: {output_file}")
            print("=" * 100)
            
        else:
            print("❌ Aucune donnée retournée")
            
    except Exception as e:
        print(f"❌ Erreur: {e}")
        print("\n💡 Le RPC 'exec_sql' n'existe peut-être pas. Essayons une approche alternative...")
        
        # Alternative: interroger chaque table manuellement
        print("\n🔄 Recherche des tables via l'introspection...")
        # Cette méthode nécessiterait de connaître les noms des tables à l'avance

if __name__ == "__main__":
    main()
