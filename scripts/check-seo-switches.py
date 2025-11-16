#!/usr/bin/env python3
"""
Vérification des switches SEO dans __seo_gamme_car_switch
"""

import os
import requests
import json

# Configuration
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SERVICE_ROLE_KEY:
    print('❌ Variables d\'environnement manquantes')
    print('   SUPABASE_URL:', 'définie' if SUPABASE_URL else 'MANQUANTE')
    print('   SUPABASE_SERVICE_ROLE_KEY:', 'définie' if SERVICE_ROLE_KEY else 'MANQUANTE')
    exit(1)

headers = {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': f'Bearer {SERVICE_ROLE_KEY}',
    'Content-Type': 'application/json',
}

print('🔍 VÉRIFICATION DES SWITCHES SEO\n')
print('=' * 80)

# 1. Vérifier l'existence et la structure de la table
print('\n📋 1. Structure de la table __seo_gamme_car_switch')
print('-' * 80)

try:
    url = f'{SUPABASE_URL}/rest/v1/__seo_gamme_car_switch?limit=1'
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        if data and len(data) > 0:
            record = data[0]
            columns = list(record.keys())
            print(f'✅ Table existe - {len(columns)} colonnes')
            print(f'📊 Colonnes: {", ".join(columns)}')
            print(f'\n📝 Exemple de données:')
            for col, val in record.items():
                preview = str(val)[:80] + '...' if len(str(val)) > 80 else str(val)
                print(f'   {col}: {preview}')
        else:
            print('⚠️  Table existe mais est vide')
    else:
        print(f'❌ Erreur HTTP {response.status_code}: {response.text[:200]}')
        exit(1)
        
except Exception as e:
    print(f'❌ Erreur: {e}')
    exit(1)

# 2. Compter le nombre total de switches
print('\n\n📊 2. Statistiques globales')
print('-' * 80)

try:
    url = f'{SUPABASE_URL}/rest/v1/__seo_gamme_car_switch?select=sgcs_id'
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print(f'✅ Total switches: {len(data)}')
    else:
        print(f'⚠️  Impossible de compter (erreur {response.status_code})')
        
except Exception as e:
    print(f'❌ Erreur: {e}')

# 3. Grouper par alias
print('\n📈 Répartition par alias:')

for alias in [1, 2, 3]:
    try:
        url = f'{SUPABASE_URL}/rest/v1/__seo_gamme_car_switch?sgcs_alias=eq.{alias}&select=sgcs_id'
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            print(f'   Alias {alias}: {len(data)} switches')
            
    except Exception as e:
        print(f'   Alias {alias}: Erreur - {e}')

# 4. Vérifier les gammes spécifiques (bestsellers BMW)
print('\n\n🔍 3. Vérification gammes bestsellers BMW')
print('-' * 80)

test_pg_ids = [3927, 2462, 1095, 1200]  # Débitmètre, Rotule suspension, etc.

for pg_id in test_pg_ids:
    try:
        url = f'{SUPABASE_URL}/rest/v1/__seo_gamme_car_switch?sgcs_pg_id=eq.{pg_id}&select=*'
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                print(f'\n✅ pg_id {pg_id}: {len(data)} switch(es)')
                for switch in data[:2]:  # Afficher max 2 switches
                    content_preview = switch.get('sgcs_content', '')[:60] + '...' if len(switch.get('sgcs_content', '')) > 60 else switch.get('sgcs_content', '')
                    print(f'   - Alias {switch.get("sgcs_alias")}: {content_preview}')
            else:
                print(f'\n❌ pg_id {pg_id}: AUCUN SWITCH')
        else:
            print(f'\n⚠️  pg_id {pg_id}: Erreur HTTP {response.status_code}')
            
    except Exception as e:
        print(f'\n❌ pg_id {pg_id}: Erreur - {e}')

# 5. Récupérer le nom des gammes sans switches
print('\n\n📋 4. Identifier les gammes sans switches')
print('-' * 80)

try:
    # Récupérer les noms des gammes
    url = f'{SUPABASE_URL}/rest/v1/pieces_gamme?pg_id=in.({",".join(map(str, test_pg_ids))})'
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        gammes = response.json()
        gammes_dict = {g['pg_id']: g.get('pg_name', 'N/A') for g in gammes}
        
        for pg_id in test_pg_ids:
            gamme_name = gammes_dict.get(pg_id, 'Inconnu')
            
            # Vérifier si switches existent
            url_check = f'{SUPABASE_URL}/rest/v1/__seo_gamme_car_switch?sgcs_pg_id=eq.{pg_id}&select=sgcs_id'
            resp_check = requests.get(url_check, headers=headers)
            
            has_switches = len(resp_check.json()) > 0 if resp_check.status_code == 200 else False
            icon = '✅' if has_switches else '❌'
            
            print(f'{icon} pg_id {pg_id}: {gamme_name}')
            
except Exception as e:
    print(f'❌ Erreur: {e}')

# 6. Exemples de contenu
print('\n\n📝 5. Exemples de contenu de switches')
print('-' * 80)

try:
    url = f'{SUPABASE_URL}/rest/v1/__seo_gamme_car_switch?limit=5&select=sgcs_pg_id,sgcs_alias,sgcs_content'
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        switches = response.json()
        for i, switch in enumerate(switches, 1):
            print(f'\nExemple {i}:')
            print(f'   PG_ID: {switch.get("sgcs_pg_id")}')
            print(f'   Alias: {switch.get("sgcs_alias")}')
            content = switch.get("sgcs_content", "")
            print(f'   Contenu: {content[:100]}{"..." if len(content) > 100 else ""}')
            
except Exception as e:
    print(f'❌ Erreur: {e}')

# 7. Recommandations
print('\n\n💡 RECOMMANDATIONS')
print('=' * 80)

try:
    # Compter gammes avec switches
    url = f'{SUPABASE_URL}/rest/v1/__seo_gamme_car_switch?select=sgcs_pg_id'
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        all_switches = response.json()
        unique_pg_ids = set([s['sgcs_pg_id'] for s in all_switches])
        
        print(f'📊 {len(unique_pg_ids)} gammes ont des switches SEO')
        print(f'📊 {len(all_switches)} switches au total')
        
        if len(unique_pg_ids) < 50:
            print('\n⚠️  ATTENTION: Peu de gammes ont des switches!')
            print('   → Envisager d\'importer les switches depuis le PHP legacy')
            print('   → Ou générer des switches avec AI pour les gammes populaires')
        else:
            print('\n✅ Couverture correcte des gammes avec switches')
            
except Exception as e:
    print(f'❌ Erreur calcul recommandations: {e}')

print('\n' + '=' * 80)
print('✅ Vérification terminée\n')
