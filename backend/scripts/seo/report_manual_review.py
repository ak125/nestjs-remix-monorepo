#!/usr/bin/env python3
"""
📋 Rapport des éléments nécessitant révision manuelle
"""
from lib.supabase_client import get_supabase_client

def generate_report():
    supabase = get_supabase_client()

    print('='*80)
    print('📋 RAPPORT - ELEMENTS A REVISER MANUELLEMENT')
    print('='*80)

    # Blog Advice
    result = supabase.table('__blog_advice').select('ba_id, ba_pg_id, ba_title, ba_descrip').execute()
    articles = result.data or []

    titles_long = []
    descrips_long = []

    for art in articles:
        ba_id = art.get('ba_id')
        pg_id = art.get('ba_pg_id', 'N/A')
        title = art.get('ba_title', '') or ''
        descrip = art.get('ba_descrip', '') or ''
        
        if len(title) > 60:
            titles_long.append({
                'pg_id': pg_id,
                'ba_id': ba_id,
                'title': title,
                'len': len(title),
                'excess': len(title) - 60
            })
        
        if len(descrip) > 155:
            descrips_long.append({
                'pg_id': pg_id,
                'ba_id': ba_id,
                'descrip': descrip,
                'len': len(descrip),
                'excess': len(descrip) - 155
            })

    # Trier par excès
    titles_long.sort(key=lambda x: x['excess'], reverse=True)
    descrips_long.sort(key=lambda x: x['excess'], reverse=True)

    print()
    print('🔴 TITLES TROP LONGS (objectif: <= 60 car)')
    print('-'*80)
    print(f'Total: {len(titles_long)} titles a raccourcir')
    print()

    for t in titles_long:
        if t['len'] > 70:
            status = '⚠️ CRITIQUE (> 70)'
        else:
            status = '🟡 A OPTIMISER (61-70)'
        print(f"pg_id {t['pg_id']:>4} (ba_id {t['ba_id']:>3}) - {t['len']} car (+{t['excess']}) - {status}")
        print(f"  ACTUEL: {t['title']}")
        # Suggestion de raccourcissement
        suggested = t['title'][:57] + '...' if len(t['title']) > 60 else t['title']
        print(f"  SUGGERE: {suggested}")
        print()

    print()
    print('='*80)
    print('🔴 DESCRIPTIONS TROP LONGUES (objectif: <= 155 car)')
    print('-'*80)
    print(f'Total: {len(descrips_long)} descriptions a raccourcir')
    print()

    for d in descrips_long:
        if d['len'] > 160:
            status = '⚠️ CRITIQUE (> 160)'
        else:
            status = '🟡 A OPTIMISER (156-160)'
        print(f"pg_id {d['pg_id']:>4} (ba_id {d['ba_id']:>3}) - {d['len']} car (+{d['excess']}) - {status}")
        print(f"  ACTUEL: {d['descrip'][:100]}...")
        print()

    print('='*80)
    print('📊 RESUME')
    print('='*80)
    critiques_title = sum(1 for t in titles_long if t['len'] > 70)
    critiques_desc = sum(1 for d in descrips_long if d['len'] > 160)
    print(f'')
    print(f'TITLES:')
    print(f'  > 70 car (CRITIQUE, sera tronque):     {critiques_title}')
    print(f'  61-70 car (A OPTIMISER):               {len(titles_long) - critiques_title}')
    print(f'')
    print(f'DESCRIPTIONS:')
    print(f'  > 160 car (CRITIQUE, sera tronquee):   {critiques_desc}')
    print(f'  156-160 car (A OPTIMISER):             {len(descrips_long) - critiques_desc}')
    print(f'')
    print(f'TOTAL A TRAITER: {len(titles_long) + len(descrips_long)} elements')


if __name__ == '__main__':
    generate_report()
