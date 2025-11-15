#!/usr/bin/env python3
"""
Script pour analyser la colonne modele_display et comprendre pourquoi K2500 apparaît
"""
import requests
import json

# Configuration Supabase
SUPABASE_URL = 'https://cxpojprgwgubzjyqzmoq.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cG9qcHJnd2d1YnpqeXF6bW9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MzQ1OTUsImV4cCI6MjA2ODExMDU5NX0.4sdE4f8QRwDU1De5-Kf8ZCD1otS8mgTRBds1I0gYDOg'

headers = {
    'apikey': SUPABASE_KEY,
    'Content-Type': 'application/json'
}

print('🔍 Analyse de K2500 (modele_id=88031) dans auto_modele...\n')

# 1. Récupérer les infos du modèle K2500
response = requests.get(
    f'{SUPABASE_URL}/rest/v1/auto_modele',
    headers=headers,
    params={
        'modele_id': 'eq.88031',
        'select': 'modele_id,modele_name,modele_year_from,modele_year_to,modele_display,modele_display_v1,modele_sitemap,modele_relfollow'
    }
)

if response.status_code == 200:
    data = response.json()
    if data:
        modele = data[0]
        print('📊 Informations du modèle K2500:')
        print(f'   • modele_id: {modele["modele_id"]}')
        print(f'   • modele_name: {modele["modele_name"]}')
        print(f'   • modele_year_from: {modele["modele_year_from"]}')
        print(f'   • modele_year_to: {modele["modele_year_to"]}')
        print(f'   • modele_display: {modele["modele_display"]} {"⚠️ (masqué)" if modele["modele_display"] == 0 else "✅ (affiché)"}')
        print(f'   • modele_display_v1: {modele["modele_display_v1"]}')
        print(f'   • modele_sitemap: {modele["modele_sitemap"]}')
        print(f'   • modele_relfollow: {modele["modele_relfollow"]}')
        
        if modele['modele_display'] == 0:
            print('\n❌ modele_display = 0 → Ce modèle ne devrait PAS être affiché dans le sélecteur!')
            print('   💡 Solution: Ajouter un filtre .eq("modele_display", 1) dans la requête')
        else:
            print('\n✅ modele_display = 1 → Ce modèle devrait être affiché')
    else:
        print('❌ Aucun modèle trouvé avec modele_id=88031')
else:
    print(f'❌ Erreur API: {response.status_code}')

# 2. Vérifier combien de modèles KIA 2011 ont display=0 vs display=1
print('\n\n🔍 Statistiques des modèles KIA avec motorisations pour 2011...\n')

# Récupérer tous les types pour KIA 2011
response = requests.get(
    f'{SUPABASE_URL}/rest/v1/auto_type',
    headers=headers,
    params={
        'type_marque_id': 'eq.88',
        'type_year_from': 'lte.2011',
        'or': '(type_year_to.is.null,type_year_to.gte.2011)',
        'select': 'type_modele_id'
    }
)

if response.status_code == 200:
    types_data = response.json()
    unique_model_ids = list(set([str(t['type_modele_id']) for t in types_data]))
    
    print(f'📊 {len(unique_model_ids)} modèles avec motorisations pour KIA 2011')
    print(f'   (dont K2500: {"OUI" if "88031" in unique_model_ids else "NON"})\n')
    
    # Récupérer les infos display de ces modèles
    model_ids_str = ','.join(unique_model_ids)
    response = requests.get(
        f'{SUPABASE_URL}/rest/v1/auto_modele',
        headers=headers,
        params={
            'modele_marque_id': 'eq.88',
            'modele_id': f'in.({model_ids_str})',
            'select': 'modele_id,modele_name,modele_display,modele_display_v1'
        }
    )
    
    if response.status_code == 200:
        models = response.json()
        display_0 = [m for m in models if m['modele_display'] == 0]
        display_1 = [m for m in models if m['modele_display'] == 1]
        
        print(f'📊 Répartition par modele_display:')
        print(f'   • modele_display = 0: {len(display_0)} modèles (masqués) ❌')
        print(f'   • modele_display = 1: {len(display_1)} modèles (affichés) ✅\n')
        
        if display_0:
            print(f'❌ Modèles avec modele_display=0 qui ne devraient PAS apparaître:')
            for m in sorted(display_0, key=lambda x: x['modele_name'])[:15]:
                marker = ' ⚠️ K2500 - PROBLÈME ICI!' if m['modele_id'] == 88031 else ''
                print(f'   • {m["modele_name"]} (ID: {m["modele_id"]}){marker}')
            if len(display_0) > 15:
                print(f'   ... et {len(display_0) - 15} autres')
        
        print(f'\n\n💡 SOLUTION RECOMMANDÉE:')
        print(f'   Ajouter dans vehicles.service.ts ligne ~430:')
        print(f'   .eq("modele_display", 1)  // Filtrer uniquement les modèles à afficher')
        print(f'\n   Cela réduira de {len(unique_model_ids)} à {len(display_1)} modèles affichés')
