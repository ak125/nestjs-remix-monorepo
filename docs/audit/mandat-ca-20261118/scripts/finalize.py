#!/usr/bin/env python3
"""Étape finale du classement (mandat CA) : appels mesurés par pg_stat_statements,
citations en commentaire seulement, groupes fermés de clés étrangères, question
à trancher, famille de conservation. Entrée out/classified.json ; sortie out/final.json.
"""
import csv, json, re, subprocess, sys, collections

REPO = sys.argv[1]
r = json.load(open('out/classified.json'))
fn_callers = json.load(open('out/fn_callers.json'))

# pg_stat_statements (depuis le 2026-09-17 00:53 UTC) — rôles de l'API seulement
api = collections.defaultdict(int)
for row in list(csv.reader(open('out/q12_pgss.csv')))[3:]:
    if row[1] in ('service_role', 'anon', 'authenticated'):
        api[row[0]] += int(row[3])

COMMENT = re.compile(r'^\s*(\*|//|#|--|/\*|<!--)')
def code_lines(n):
    out = subprocess.run(['git', '-C', REPO, 'grep', '-n', '-I', '-w', '-F', n, '--',
                          'backend', 'frontend', 'scripts', 'workspaces', 'packages', 'tools', 'services',
                          ':!backend/supabase/migrations', ':!*.md', ':!*.json', ':!**/database.types.ts',
                          ':!packages/database-types'], capture_output=True, text=True).stdout.splitlines()
    return out

for n, v in r.items():
    v['api_calls_pgss'] = api.get(n, 0) if n in api or v['class'] != 'vivante' else None
    if v['class'] == 'a_trancher' and api.get(n, 0) >= 100:
        v['class'] = 'vivante'
        v['reasons'].append(f"lue par le rôle de l’API : {api[n]} appels mesurés (pg_stat_statements depuis le 2026-09-17)")
    if v['class'] == 'a_trancher' and not v['service_refs'] and not v['script_refs'] and v['loose_code_hits']:
        ls = code_lines(n)
        v['comment_only'] = bool(ls) and all(COMMENT.match(l.split(':', 2)[2]) for l in ls)
        v['code_lines'] = ls[:8]

# un cron d'entretien (rotation de partitions, RLS) ne prouve pas l'usage : vide + jamais écrite => à trancher
MAINT = re.compile(r'(partition|rls_reconcile|rls-reconcile)')
for n, v in r.items():
    if (v['class'] == 'vivante' and v['rows_est'] <= 0 and sum(v['dml_since_reset'].values()) == 0
            and not api.get(n) and v['cron'] and all(MAINT.search(c) for c in v['cron'])):
        v['class'] = 'a_trancher'
        w = v['service_writers'] or [f + '()' for f in v['functions_writing'] if f.split('.', 1)[-1] in v['functions_live']]
        v['question_override'] = (
            "Seul un cron d’entretien la touche (" + v['cron'][0].split(' via ')[0] + ") ; vide et jamais écrite depuis le 2026-09-17. "
            + (f"L’écrivain existe ({w[0].split('/')[-1]}) mais n’a rien écrit : l’activer, ou abandonner la table (et son entretien) ?"
               if w else "Aucun écrivain dans le code : chantier à reprendre ou à archiver ?"))
for n, v in r.items():
    if v['class'] == 'vivante' and v['rows_est'] <= 0 and sum(v['dml_since_reset'].values()) == 0:
        v['reasons'].append('branchée mais vide et jamais écrite depuis le 2026-09-17')

# groupe fermé : clés étrangères entrantes venant toutes de tables mortes
changed = True
while changed:
    changed = False
    dead = {n for n, v in r.items() if v['class'] == 'morte'}
    for n, v in r.items():
        if v['class'] != 'a_trancher':
            continue
        if (v['fk_in'] and set(v['fk_in']) <= dead and not v['loose_code_hits'] and not v['views']
                and not v['functions_live'] and not v['functions_uncalled'] and not v['cron']
                and sum(v['dml_since_reset'].values()) == 0 and v['idx_scan'] <= 50 and v['seq_scan'] <= 100
                and not api.get(n)):
            v['class'] = 'morte'
            v['reasons'].append('seules des tables mortes la référencent (clé étrangère) : ' + ', '.join(v['fk_in']))
            changed = True

DEPT_FIX = {'__admin_job_health': 21, '__pipeline_chain_queue': 23, '__qa_protected_meta_hash': 7,
            '__quality_gamme_scores': 7, '__quality_page_scores': 7, '__write_audit_log': 23,
            '__write_collision_ledger': 23}
for n, d in DEPT_FIX.items():
    if r[n]['dept'] is None:
        r[n]['dept'] = d; r[n]['dept_how'] = 'déduit (préfixe)'

def question(n, v):
    dml = sum(v['dml_since_reset'].values())
    if v.get('question_override'):
        return v['question_override']
    if v.get('comment_only'):
        return "Citée seulement en commentaire dans le code, aucune écriture ni lecture d’application mesurée : archiver après retrait du commentaire ?"
    if v['functions_uncalled'] and not v['service_refs'] and not v['script_refs']:
        return ("Seules des fonctions SQL jamais appelées la citent (" + ', '.join(v['functions_uncalled'][:4]) +
                ") : chantier abandonné à archiver avec ses fonctions, ou à reprendre ?")
    if v['service_refs'] and v['rows_est'] == 0 and dml == 0:
        return "Code présent mais table vide et jamais écrite depuis le 2026-09-17 : fonctionnalité non activée (laquelle, quand ?) ou abandonnée ?"
    if v['service_refs'] and dml == 0:
        return "Lue par le code mais jamais écrite depuis le 2026-09-17 : référentiel figé voulu, ou écrivain disparu ?"
    if v['script_refs'] and not v['service_refs']:
        return "Seulement citée par des scripts manuels (" + ', '.join(v['script_refs'][:2]) + ") : ces scripts servent-ils encore ?"
    if v['functions_live'] and v['rows_est'] == 0:
        return "Lue par une fonction appelée (" + ', '.join(v['functions_live'][:2]) + ") mais vide : alimentation prévue ou résidu ?"
    if v['views'] or v['fk_in']:
        return "Sans code, mais des vues ou clés étrangères en dépendent (" + ', '.join((v['views'] + v['fk_in'])[:3]) + ") : ces objets sont-ils eux-mêmes utilisés ?"
    if v['idx_scan'] > 50 or v['seq_scan'] > 100:
        return f"Aucun lecteur dans le dépôt mais {v['idx_scan']} parcours d’index et {v['seq_scan']} parcours séquentiels depuis le 2026-09-17 : quel lecteur extérieur ?"
    if v['loose_code_hits']:
        return "Nom présent dans le code sans requête reconnue (" + ', '.join(sum(v['loose_code_hits'].values(), [])[:2]) + ") : usage réel ?"
    return "Preuves insuffisantes : à examiner."

def family(n, v):
    if v['class'] == 'copie_datee': return 'copie_ponctuelle'
    if v['relkind'] == 'p': return 'partition_instantane'
    if n.startswith('___'): return 'ancien_site'
    if re.match(r'^(stg_|__staging_|norm_|xref_|decision_|natural_key_|__import_|import_batch|__quarantine_|__cnit_raw|__catalog_import|__catalog_id_mapping|__tecdoc_import)', n):
        return 'import_staging'
    if re.search(r'(_logs?|_history|_events|_runs|_audit|_audit_log|_ledger|_incidents|_outcomes|_violations|_queue|_alerts|_digests|_evaluations|_reviews|_snapshots)$', n):
        return 'journal'
    if re.search(r'(_cache|_mv|_agg|_aggregates|_stats|_scores|_daily|_weekly|_metrics|_baseline)$', n) or n.startswith('__sitemap'):
        return 'cache_projection'
    return 'referentiel_metier'

for n, v in r.items():
    v['question'] = question(n, v) if v['class'] == 'a_trancher' else None
    v['family'] = family(n, v)

json.dump(r, open('out/final.json', 'w'), indent=1, ensure_ascii=False)
print(collections.Counter(v['class'] for v in r.values()))
print(collections.Counter(v['family'] for v in r.values()))
print('dept None:', [n for n, v in r.items() if v['dept'] is None])
print('comment_only:', [n for n, v in r.items() if v.get('comment_only')])
print('now morte by fk:', [n for n, v in r.items() if v['class'] == 'morte' and v['fk_in']])
