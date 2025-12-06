#!/usr/bin/env python3
"""
Raccourcissement des meta dans __seo_gamme et __seo_gamme_car
"""
from lib.supabase_client import get_supabase_client
from lib.fix_rules import shorten_meta_title, shorten_meta_descrip

def fix_seo_gamme():
    supabase = get_supabase_client()
    
    print('='*70)
    print('RACCOURCISSEMENT __seo_gamme')
    print('='*70)
    
    r = supabase.table('__seo_gamme').select('sg_id, sg_pg_id, sg_title, sg_descrip').execute()
    data = r.data or []
    
    stats = {'titles': 0, 'descrips': 0, 'titles_ok': 0, 'descrips_ok': 0}
    
    for row in data:
        sg_id = row.get('sg_id')
        pg_id = row.get('sg_pg_id')
        title = row.get('sg_title') or ''
        descrip = row.get('sg_descrip') or ''
        
        updates = {}
        
        # Title
        if len(title) > 60:
            stats['titles'] += 1
            new_title, rules, success = shorten_meta_title(title)
            if rules and new_title != title:
                updates['sg_title'] = new_title
                if success and len(new_title) <= 70:
                    stats['titles_ok'] += 1
                print(f'pg_id {pg_id} TITLE: {len(title)} -> {len(new_title)} car')
                for r in rules:
                    print(f'  - {r}')
        
        # Description
        if len(descrip) > 155:
            stats['descrips'] += 1
            new_descrip, rules, success = shorten_meta_descrip(descrip)
            if rules and new_descrip != descrip:
                updates['sg_descrip'] = new_descrip
                if success and len(new_descrip) <= 160:
                    stats['descrips_ok'] += 1
                print(f'pg_id {pg_id} DESC: {len(descrip)} -> {len(new_descrip)} car')
                for r in rules:
                    print(f'  - {r}')
        
        # Appliquer
        if updates:
            supabase.table('__seo_gamme').update(updates).eq('sg_id', sg_id).execute()
            print(f'  -> Sauvegarde!')
        
        if updates:
            print()
    
    print()
    print(f'Titles traites: {stats["titles"]}, raccourcis OK: {stats["titles_ok"]}')
    print(f'Descriptions traitees: {stats["descrips"]}, raccourcies OK: {stats["descrips_ok"]}')
    
    return stats


def fix_seo_gamme_car():
    supabase = get_supabase_client()
    
    print()
    print('='*70)
    print('RACCOURCISSEMENT __seo_gamme_car')
    print('='*70)
    
    # Compter d'abord
    r = supabase.table('__seo_gamme_car').select('sgc_id', count='exact').execute()
    total = r.count if hasattr(r, 'count') else len(r.data)
    print(f'Total enregistrements: {total}')
    
    # Traiter par lots de 1000
    stats = {'titles': 0, 'descrips': 0, 'titles_ok': 0, 'descrips_ok': 0}
    offset = 0
    batch_size = 1000
    
    while True:
        r = supabase.table('__seo_gamme_car').select('sgc_id, sgc_pg_id, sgc_title, sgc_descrip').range(offset, offset + batch_size - 1).execute()
        data = r.data or []
        
        if not data:
            break
        
        print(f'Traitement lot {offset}-{offset+len(data)}...')
        
        for row in data:
            sgc_id = row.get('sgc_id')
            pg_id = row.get('sgc_pg_id')
            title = row.get('sgc_title') or ''
            descrip = row.get('sgc_descrip') or ''
            
            updates = {}
            
            # Title
            if len(title) > 60:
                stats['titles'] += 1
                new_title, rules, success = shorten_meta_title(title)
                if rules and new_title != title:
                    updates['sgc_title'] = new_title
                    if success and len(new_title) <= 70:
                        stats['titles_ok'] += 1
            
            # Description
            if len(descrip) > 155:
                stats['descrips'] += 1
                new_descrip, rules, success = shorten_meta_descrip(descrip)
                if rules and new_descrip != descrip:
                    updates['sgc_descrip'] = new_descrip
                    if success and len(new_descrip) <= 160:
                        stats['descrips_ok'] += 1
            
            # Appliquer
            if updates:
                try:
                    supabase.table('__seo_gamme_car').update(updates).eq('sgc_id', sgc_id).execute()
                except Exception as e:
                    print(f'  Erreur sgc_id {sgc_id}: {e}')
        
        offset += batch_size
        
        if len(data) < batch_size:
            break
    
    print()
    print(f'Titles traites: {stats["titles"]}, raccourcis OK: {stats["titles_ok"]}')
    print(f'Descriptions traitees: {stats["descrips"]}, raccourcies OK: {stats["descrips_ok"]}')
    
    return stats


if __name__ == '__main__':
    print('='*70)
    print('FIX SEO GAMME - Raccourcissement automatique')
    print('='*70)
    print()
    
    stats1 = fix_seo_gamme()
    stats2 = fix_seo_gamme_car()
    
    print()
    print('='*70)
    print('RESUME TOTAL')
    print('='*70)
    total_titles = stats1['titles'] + stats2['titles']
    total_titles_ok = stats1['titles_ok'] + stats2['titles_ok']
    total_descrips = stats1['descrips'] + stats2['descrips']
    total_descrips_ok = stats1['descrips_ok'] + stats2['descrips_ok']
    
    print(f'Titles: {total_titles_ok}/{total_titles} raccourcis automatiquement')
    print(f'Descriptions: {total_descrips_ok}/{total_descrips} raccourcies automatiquement')
