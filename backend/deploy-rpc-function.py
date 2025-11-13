#!/usr/bin/env python3
"""
Script pour déployer la fonction RPC optimisée sur Supabase
"""

import os
import sys
import requests
from pathlib import Path

def deploy_rpc_function():
    # Vérifier les variables d'environnement
    supabase_url = os.environ.get('SUPABASE_URL')
    service_role_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if not supabase_url or not service_role_key:
        print('❌ Variables d\'environnement manquantes: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY')
        sys.exit(1)
    
    # Lire le fichier SQL
    sql_file_path = Path(__file__).parent / 'prisma' / 'supabase-functions' / 'get_gamme_page_data_optimized.sql'
    
    if not sql_file_path.exists():
        print(f'❌ Fichier SQL non trouvé: {sql_file_path}')
        sys.exit(1)
    
    with open(sql_file_path, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    print('🚀 Déploiement de la fonction RPC optimisée...')
    print(f'📄 Fichier: {sql_file_path}')
    print(f'📦 Taille: {len(sql_content)} caractères\n')
    
    # Utiliser l'API REST de Supabase pour exécuter le SQL
    # Note: Supabase n'expose pas directement exec via REST API
    # Nous devons utiliser une approche alternative
    
    # Option 1: Via l'API Management (nécessite un access token de management)
    # Option 2: Via psycopg2 si disponible
    # Option 3: Instructions manuelles
    
    print('📋 INSTRUCTIONS DE DÉPLOIEMENT:')
    print('=' * 60)
    print('1. Ouvrez Supabase Studio: https://app.supabase.com')
    print('2. Sélectionnez votre projet')
    print('3. Allez dans "SQL Editor"')
    print('4. Créez une nouvelle requête')
    print('5. Copiez-collez le contenu suivant:\n')
    print('=' * 60)
    print(sql_content)
    print('=' * 60)
    print('\n6. Cliquez sur "Run" pour exécuter')
    print('7. Vérifiez que la fonction est créée sans erreur')
    print('\n✅ Une fois fait, relancez le serveur NestJS')
    
    # Tentative d'utilisation de psycopg2 si disponible
    try:
        import psycopg2
        from urllib.parse import urlparse
        
        print('\n🔍 psycopg2 détecté - tentative de déploiement automatique...')
        
        # Parser l'URL de connexion depuis les variables d'environnement
        db_host = os.environ.get('SUPABASE_DB_HOST')
        db_password = os.environ.get('SUPABASE_DB_PASSWORD')
        
        if db_host and db_password:
            conn = psycopg2.connect(
                host=db_host,
                port=5432,
                database='postgres',
                user='postgres',
                password=db_password
            )
            
            cursor = conn.cursor()
            cursor.execute(sql_content)
            conn.commit()
            cursor.close()
            conn.close()
            
            print('✅ Fonction RPC déployée avec succès via psycopg2!')
            return
        else:
            print('⚠️  Variables SUPABASE_DB_HOST ou SUPABASE_DB_PASSWORD non définies')
            
    except ImportError:
        print('⚠️  psycopg2 non installé - installation manuelle requise')
    except Exception as e:
        print(f'⚠️  Erreur lors du déploiement automatique: {e}')
        print('📋 Veuillez suivre les instructions manuelles ci-dessus')

if __name__ == '__main__':
    deploy_rpc_function()
