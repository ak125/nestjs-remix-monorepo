#!/usr/bin/env python3
"""
Vérification des tables et colonnes Supabase
"""

import os
import requests
import json

# Configuration
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SERVICE_ROLE_KEY:
    print('❌ Variables d\'environnement manquantes')
    exit(1)

headers = {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': f'Bearer {SERVICE_ROLE_KEY}',
    'Content-Type': 'application/json',
}

tables = [
    'catalog_gamme',
    '__seo_gamme',
    '__seo_gamme_conseil',
    '__seo_gamme_info',
    '__cross_gamme_car_new',
    '__seo_equip_gamme',
    '__blog_advice',
    'catalog_family',
    'pieces_gamme',
    '__seo_item_switch'
]

print('🔍 Vérification des tables et colonnes...\n')

for table in tables:
    print(f'\n📋 Table: {table}')
    
    try:
        # Récupérer un échantillon
        url = f'{SUPABASE_URL}/rest/v1/{table}?limit=1'
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                record = data[0]
                columns = list(record.keys())
                print(f'   ✅ Existe - {len(columns)} colonnes')
                print(f'   📊 Colonnes: {", ".join(columns[:10])}{"..." if len(columns) > 10 else ""}')
                
                # Identifier les colonnes ID
                id_columns = [col for col in columns if 
                    '_id' in col or 'pg_id' in col or col == 'pg_id' or
                    'sgc_pg_id' in col or 'sgi_pg_id' in col or
                    'cgc_pg_id' in col or 'seg_pg_id' in col or
                    'ba_pg_id' in col or 'mc_pg_id' in col or
                    'sis_pg_id' in col]
                
                if id_columns:
                    print('   🔑 Colonnes ID:')
                    for col in id_columns:
                        value = record[col]
                        value_type = type(value).__name__
                        is_numeric = isinstance(value, (int, float))
                        icon = '🔢 numérique' if is_numeric else '📝 texte'
                        print(f'      - {col}: {value_type} (valeur: {value}) {icon}')
            else:
                print('   ⚠️  Existe mais vide')
        else:
            print(f'   ❌ Erreur HTTP {response.status_code}: {response.text[:100]}')
            
    except Exception as e:
        print(f'   ❌ Erreur: {e}')

# Test spécifique pour catalog_gamme
print('\n\n🔍 TEST SPÉCIFIQUE: catalog_gamme.mc_pg_id')

# Test avec texte '10'
try:
    url = f'{SUPABASE_URL}/rest/v1/catalog_gamme?mc_pg_id=eq.10&limit=1&select=mc_pg_id,mc_name'
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        data = response.json()
        print(f'   ✅ mc_pg_id = "10" (texte via URL): {len(data)} résultats')
        if data:
            print(f'      Données: {data[0]}')
    else:
        print(f'   ❌ Erreur: {response.text[:100]}')
except Exception as e:
    print(f'   ❌ Erreur: {e}')

# Test avec RPC pour voir le type exact
print('\n\n🔍 TEST: Appel RPC get_gamme_page_data_optimized')
try:
    url = f'{SUPABASE_URL}/rest/v1/rpc/get_gamme_page_data_optimized'
    response = requests.post(url, headers=headers, json={'p_pg_id': 10})
    
    if response.status_code == 200:
        result = response.json()
        print(f'   ✅ RPC fonctionne!')
        if isinstance(result, dict):
            print(f'   📊 Clés retournées: {list(result.keys())}')
    else:
        error_data = response.json() if response.headers.get('content-type') == 'application/json' else response.text
        if isinstance(error_data, dict):
            print(f'   ❌ Erreur RPC: {error_data.get("message", error_data)}')
            print(f'   💡 Code: {error_data.get("code")}')
            print(f'   💡 Hint: {error_data.get("hint")}')
        else:
            print(f'   ❌ Erreur: {error_data[:200]}')
except Exception as e:
    print(f'   ❌ Erreur: {e}')

print('\n')
