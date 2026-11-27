# Résumé d'une sortie page-du4.cjs : violations par règle et nœuds hors zones globales.
import json, sys
for f in sys.argv[1:]:
    d = json.load(open(f)); print(f.rsplit('/',1)[-1], {v['id']: v['count'] for v in d['violations']})
    for v in d['violations']:
        for n in v['nodes']:
            if not n.get('zone','').startswith('GLOBAL'): print('   ', v['id'], n.get('zone'), repr(n.get('text','')[:60]), n.get('data',{}).get('ratio',''), n.get('target','')[:70])
