"""Résumé sans corps des rapports du contrat (runs 3 à 5), pour le dépôt public.

Usage : python3 -I contract_summary.py <répertoire contract-20261022> <sortie.json>
Ne recopie ni corps de réponse, ni ligne de journal, ni IP : seulement les identifiants de cas, les statuts,
les compteurs et les verdicts des rapports produits par bench/contract.py.
"""
import glob
import json
import os
import sys


def load(path):
    with open(path) as fh:
        return json.load(fh)


def rel(base, path):
    return os.path.relpath(path, base)


def diff_report(j):
    s = j['summary']
    count = lambda v: v if isinstance(v, int) else len(v)
    return {'normalisations': len(j['normalisations']),
            'identiques': count(s['identiques']), 'écarts': s['écarts'] if isinstance(s['écarts'], list) else count(s['écarts']),
            'ordre seul': s['ordre seul'], 'absents': s['absents'],
            'journal_erreurs_identiques': j['error_log'].get('identiques'),
            'cas_en_écart': [c.get('id') for c in j.get('cases', [])],
            'redis': j['redis']}


def routes_report(j):
    return {'sélection': j['sélection'], 'cas': j['cas'], 'en_défaut': j['en_défaut'],
            'cas_en_défaut': [c['id'] for c in j['cas_détail'] if c['problèmes']]}


def backend_outage_report(j):
    n = lambda v: v if isinstance(v, int) else len(v)
    steps = [{'id': st['id'], 'éligible': st.get('éligible'), 'statut': st['response'].get('status'),
              'caddy_amont_statut': [c[1:] for c in st['caddy']],
              'lignes_a2': n(st['lignes_a2']), 'lignes_r2': n(st['lignes_r2']), 'problèmes': st['problèmes']}
             for st in j['étapes'] if 'response' in st]
    return {'sélection': j['sélection'], 'arrêté': j['arrêté'], 'échecs': j['échecs'], 'étapes': steps}


def outages_diff_report(j):
    return {'écarts': [{'id': e['id'], 'champs': sorted(k for k in e if k != 'id')} for e in j['écarts']]}


def budget_report(j):
    keep = ('id', 'type', 'amont_attendu', 'status', 'restant', 'amont')
    return {'sélection': j['sélection'], 'échecs': j['échecs'],
            'étapes': [{k: st.get(k) for k in keep} for st in j['étapes']]}


def journey_report(j):
    s = j['summary']
    m = s.get('modèles_reçus') or {}
    shown = s.get('liste_affichée') or {}
    return {'parcours': os.path.basename(s['journey']), 'ok': s['ok'], 'erreur': s['error'], 'sélection': s['selection'],
            'appels': s['appels'], 'en_défaut': s['en_défaut'],
            'modèles_reçus': {k: m.get(k) for k in ('status', 'models', 'total')},
            'liste_affichée': {k: shown.get(k) for k in ('options', 'digest')},
            'erreurs_page': len(s.get('erreurs_page') or []),
            'appels_route': [{'statut': a['status'], 'amont': a['upstream'], 'attendu': a['want'],
                              'fins': a['completions']} for a in j['appels'] if a.get('eligible')]}


def main():
    base, out = sys.argv[1], sys.argv[2]
    res = {}
    for f in sorted(glob.glob(os.path.join(base, 'run*', '*.json'))):
        name = os.path.basename(f)
        j = load(f)
        if name.startswith('diff-outages'):
            res[rel(base, f)] = outages_diff_report(j)
        elif name.startswith('diff-'):
            res[rel(base, f)] = diff_report(j)
        elif name.startswith('routes-'):
            res[rel(base, f)] = routes_report(j)
    for f in sorted(glob.glob(os.path.join(base, 'run*', '*', 'backend-outage.json'))):
        res[rel(base, f)] = backend_outage_report(load(f))
    for f in sorted(glob.glob(os.path.join(base, 'run*', '*', 'budget.json'))):
        res[rel(base, f)] = budget_report(load(f))
    for f in sorted(glob.glob(os.path.join(base, 'run*', 'journeys*', '**', 'routes-*.json'), recursive=True)):
        res[rel(base, f)] = journey_report(load(f))
    with open(out, 'w') as fh:
        json.dump(res, fh, indent=1, ensure_ascii=False)
    print(len(res), 'rapports résumés')


if __name__ == '__main__':
    main()
