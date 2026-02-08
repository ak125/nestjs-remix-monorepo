#!/usr/bin/env python3
"""
Audit type_id - Détecte les incohérences modèle/type_id

Usage:
    python audit_type_ids.py [pg_id]

Exemple:
    python audit_type_ids.py 7      # Audit pg_id=7 (filtre à huile)
    python audit_type_ids.py        # Audit toutes les gammes
"""
import os
import sys
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client

# Charger .env depuis backend
env_path = '/opt/automecanik/app/backend/.env'
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    load_dotenv()


def get_supabase_client():
    """Créer le client Supabase"""
    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

    if not url or not key:
        print("ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found")
        sys.exit(1)

    return create_client(url, key)


def fetch_all_paginated(supabase, table, query_fn, page_size=1000):
    """Fetch all rows with pagination"""
    all_data = []
    offset = 0

    while True:
        response = query_fn().range(offset, offset + page_size - 1).execute()
        if response.data:
            all_data.extend(response.data)
            if len(response.data) < page_size:
                break
            offset += page_size
        else:
            break

    return all_data


def audit_type_ids(pg_id: int = None):
    """Détecte les incohérences entre model (keyword) et modele_name (auto_type)"""

    supabase = get_supabase_client()

    # Charger keywords avec type_id
    print("Loading keywords with type_id...")

    def query_keywords():
        q = supabase.table('__seo_keywords').select('id, keyword, model, variant, type_id, v_level, pg_id').not_.is_('type_id', 'null')
        if pg_id:
            q = q.eq('pg_id', pg_id)
        return q

    keywords = fetch_all_paginated(supabase, '__seo_keywords', query_keywords)
    print(f"  Loaded {len(keywords)} keywords with type_id")

    if not keywords:
        print("No keywords to audit.")
        return None

    # Charger auto_type + auto_modele
    print("Loading auto_type and auto_modele...")

    type_ids = list(set(k['type_id'] for k in keywords if k['type_id']))

    # Fetch auto_type en batches
    auto_types = []
    batch_size = 500
    for i in range(0, len(type_ids), batch_size):
        batch = type_ids[i:i+batch_size]
        response = supabase.table('auto_type').select('type_id, type_name, type_engine, type_modele_id').in_('type_id', batch).execute()
        auto_types.extend(response.data or [])

    print(f"  Loaded {len(auto_types)} auto_types")

    # Create lookup dict
    type_lookup = {int(t['type_id']): t for t in auto_types}

    # Fetch auto_modele
    modele_ids = list(set(t['type_modele_id'] for t in auto_types if t.get('type_modele_id')))
    auto_modeles = []
    for i in range(0, len(modele_ids), batch_size):
        batch = modele_ids[i:i+batch_size]
        response = supabase.table('auto_modele').select('modele_id, modele_name').in_('modele_id', batch).execute()
        auto_modeles.extend(response.data or [])

    modele_lookup = {str(m['modele_id']): m['modele_name'] for m in auto_modeles}
    print(f"  Loaded {len(auto_modeles)} auto_modeles")

    # Analyser les incohérences
    mismatches = []

    for kw in keywords:
        type_id = kw.get('type_id')
        if not type_id:
            continue

        type_info = type_lookup.get(int(type_id))
        if not type_info:
            continue

        modele_id = type_info.get('type_modele_id')
        expected_model = modele_lookup.get(str(modele_id), '')

        kw_model = (kw.get('model') or '').lower().strip()
        expected_norm = expected_model.lower().strip()

        # Check match
        match = False
        if kw_model and expected_norm:
            if kw_model in expected_norm or expected_norm in kw_model:
                match = True
            else:
                # Handle roman numerals
                kw_num = kw_model.replace(' i', ' 1').replace(' ii', ' 2').replace(' iii', ' 3').replace(' iv', ' 4').replace(' v', ' 5')
                exp_num = expected_norm.replace(' i', ' 1').replace(' ii', ' 2').replace(' iii', ' 3').replace(' iv', ' 4').replace(' v', ' 5')
                if kw_num in exp_num or exp_num in kw_num:
                    match = True
        else:
            match = True  # Skip if missing data

        if not match:
            mismatches.append({
                'id': kw['id'],
                'keyword': kw['keyword'],
                'model': kw.get('model'),
                'type_id': type_id,
                'expected_model': expected_model,
                'type_name': type_info.get('type_name'),
                'type_engine': type_info.get('type_engine'),
                'v_level': kw.get('v_level')
            })

    print(f"\n{'='*60}")
    print(f"INCOHÉRENCES DÉTECTÉES: {len(mismatches)}")
    print(f"{'='*60}\n")

    if not mismatches:
        print("Aucune incohérence détectée.")
        return None

    # Grouper par type d'erreur
    df = pd.DataFrame(mismatches)
    grouped = df.groupby(['model', 'expected_model'])

    for (model, expected), group in grouped:
        print(f"❌ model='{model}' → type_id pointe vers '{expected}'")
        print(f"   {len(group)} keywords affectés")

        for _, row in group.head(3).iterrows():
            print(f"   - \"{row['keyword'][:60]}...\"" if len(str(row['keyword'])) > 60 else f"   - \"{row['keyword']}\"")
            print(f"     type_id: {row['type_id']} ({row['type_name']} {row['type_engine']})")

        if len(group) > 3:
            print(f"   ... +{len(group)-3} autres")
        print()

    # Sauvegarder rapport
    output_file = f"/tmp/type_id_mismatches_pg{pg_id or 'all'}.csv"
    df.to_csv(output_file, index=False)
    print(f"\nRapport sauvegardé: {output_file}")

    return df


if __name__ == "__main__":
    pg_id = int(sys.argv[1]) if len(sys.argv) > 1 else None

    if pg_id:
        print(f"Audit type_id pour pg_id={pg_id}")
    else:
        print("Audit type_id pour TOUTES les gammes")

    print()
    audit_type_ids(pg_id)
