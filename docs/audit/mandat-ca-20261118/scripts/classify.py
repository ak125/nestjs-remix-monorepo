#!/usr/bin/env python3
"""Classement des tables public de massdoc (mandat CA, 2026-11-18). Lecture seule.

Entrées : out/xref.json (xref.py), out/q*.csv (relevés SELECT), dépôt = argv[1].
Sorties : out/classified.json, out/fn_callers.json
Règles de classement : voir docs/audit/mandat-ca-20261118/README.md §Méthode.
"""
import csv, json, re, subprocess, sys, collections, os, glob

csv.field_size_limit(10**9)
REPO = sys.argv[1]
OUT = 'out'
x = json.load(open(f'{OUT}/xref.json'))
names = set(x)

# ---------- fonctions SQL : qui les appelle ? ----------
funcs = list(csv.DictReader(open(f'{OUT}/q9_funcs.csv')))
fn_short = sorted({f['fn'].split('#')[0].split('.', 1)[1] for f in funcs})
open(f'{OUT}/fn_names.txt', 'w').write('\n'.join(fn_short) + '\n')
g = subprocess.run(['git', '-C', REPO, 'grep', '-l', '-I', '-w', '-F', '-f', os.path.abspath(f'{OUT}/fn_names.txt'),
                    '--', 'backend/src', 'frontend/app', 'scripts', 'workspaces', 'packages', 'backend/scripts'],
                   capture_output=True, text=True).stdout.splitlines()
fn_in_code = collections.defaultdict(set)
for p in g:
    if re.search(r'(\.spec\.|\.test\.|__tests__/|database\.types\.ts|packages/database-types/)', p):
        continue
    txt = open(os.path.join(REPO, p), errors='replace').read()
    for fn in set(re.findall(r'[A-Za-z0-9_]+', txt)) & set(fn_short):
        fn_in_code[fn].add(p)
crons = list(csv.DictReader(open(f'{OUT}/q8_cron.csv')))
fn_in_cron = collections.defaultdict(set)
for c in crons:
    for fn in set(re.findall(r'[A-Za-z0-9_]+', c['command'])) & set(fn_short):
        fn_in_cron[fn].add(f"cron#{c['jobid']}")
trigfn = set(open(f'{OUT}/q11_trigfn.txt').read().split())
fn_src = {f['fn'].split('#')[0].split('.', 1)[1]: f['src'] for f in funcs}
fn_in_fn = collections.defaultdict(set)
for caller, src in fn_src.items():
    for fn in set(re.findall(r'[A-Za-z0-9_]+', src)) & set(fn_short):
        if fn != caller:
            fn_in_fn[fn].add(caller)

def fn_live(fn, seen=None):
    seen = seen or set()
    if fn in seen: return False
    seen.add(fn)
    if fn_in_code.get(fn) or fn_in_cron.get(fn) or fn in trigfn: return True
    return any(fn_live(c, seen) for c in fn_in_fn.get(fn, ()))

fn_callers = {fn: {'code': sorted(fn_in_code.get(fn, ())), 'cron': sorted(fn_in_cron.get(fn, ())),
                   'trigger': fn in trigfn, 'functions': sorted(fn_in_fn.get(fn, ())), 'live': fn_live(fn)} for fn in fn_short}
json.dump(fn_callers, open(f'{OUT}/fn_callers.json', 'w'), indent=1)

# ---------- date de création : registre des migrations appliquées + fichiers du dépôt ----------
ledger = list(csv.DictReader(open(f'{OUT}/q10_ledger.csv')))
created = {}
CREATE_RX = re.compile(r'create\s+table\s+(if\s+not\s+exists\s+)?(public\.)?"?([A-Za-z0-9_]+)"?', re.I)
for r in sorted(ledger, key=lambda r: r['version']):
    for m in CREATE_RX.finditer(r['stm']):
        n = m.group(3)
        if n in names and n not in created:
            created[n] = {'version': r['version'], 'name': r['name'], 'source': 'supabase_migrations.schema_migrations'}
mig_files = sorted(glob.glob(os.path.join(REPO, 'backend/supabase/migrations/*.sql')) + glob.glob(os.path.join(REPO, 'migrations/*.sql')))
file_created = {}
for f in mig_files:
    if f.endswith('.down.sql'): continue
    for m in CREATE_RX.finditer(open(f, errors='replace').read()):
        n = m.group(3)
        if n in names and n not in file_created:
            file_created[n] = os.path.relpath(f, REPO)

def file_date(rel):
    m = re.match(r'.*/(\d{8})', rel)
    return m.group(1) if m else None

def git_add_commit(rel):
    out = subprocess.run(['git', '-C', REPO, 'log', '--diff-filter=A', '--format=%h|%as|%s', '--', rel],
                         capture_output=True, text=True).stdout.strip().splitlines()
    return out[-1] if out else ''

# ---------- départements ----------
MODULE_DEPT = {}
import yaml
om = yaml.safe_load(open(os.path.join(REPO, '.spec/00-canon/ai-registry/agent-operating-map.yaml')))
DEPT_LABEL = {}
for d in om['departments']:
    DEPT_LABEL[int(d['business_number'])] = d['id']
    for f in d.get('functions') or []:
        for c in f.get('covers') or []:
            if isinstance(c, dict) and c.get('module'):
                MODULE_DEPT.setdefault(c['module'], int(d['business_number']))
MODULE_DEPT.pop('admin', None)  # 01 direction : trop large pour attribuer une table, repli sur le préfixe

PREFIX_DEPT = [  # repli déduit du préfixe, appliqué seulement sans module écrivain/lecteur
    (r'^pieces_media_img', 8), (r'^(__seo_|seo_|__sitemap|sitemap|__soft_404|__gsc|__ga4|__cwv)', 7),
    (r'^(kg_|__diag_)', 11), (r'^(__rag_|rag_)', 9), (r'^__marketing', 4),
    (r'^(pricing_|catalog_pricing)', 16), (r'^(supplier_|__supplier|am_20)', 12),
    (r'^(pieces_|auto_|rm_|__cnit|catalog_|gamme_|__catalog|__v_level|audit_vlevel|cars_)', 10),
    (r'^(__import_|import_batch|stg_|norm_|xref_|decision_|natural_key_|__staging_|__quarantine_)', 10),
    (r'^(agent_|__agent|write_scope|_killswitch|pipeline_event_log|gate_thresholds)', 23),
    (r'^(__db_governance|__error|error_)', 22), (r'^(support_|___xtr_msg)', 14),
    (r'^(___xtr_customer|___xtr_msg|reviews|__claims)', 14), (r'^(___xtr_invoice)', 17),
    (r'^(___xtr_delivery|shipping_)', 15), (r'^(___xtr_order|___xtr_cart|promo_|__abandoned_cart)', 13),
    (r'^(quantity_discounts)', 16), (r'^(___config|___header|___footer|___meta)', 20),
    (r'^(__tecdoc_)', 10), (r'^(__blog_|blog_)', 6), (r'^(__video|__media)', 8),
]

def dept_from_files(files):
    c = collections.Counter()
    for p in files:
        m = re.match(r'backend/src/modules/([^/]+)/', p)
        if m and m.group(1) in MODULE_DEPT:
            c[MODULE_DEPT[m.group(1)]] += 1
    return c

def dept_of(n, v):
    w = v['writes'].get('service', [])
    c = dept_from_files(w)
    if c:
        return c.most_common(1)[0][0], 'mesuré (module écrivain)'
    c = dept_from_files(v['strict'].get('service', []))
    if c:
        return c.most_common(1)[0][0], 'mesuré (module lecteur)'
    c = dept_from_files(v['hits'].get('service', []))
    if c:
        return c.most_common(1)[0][0], 'déduit (module citant la table)'
    for rx, d in PREFIX_DEPT:
        if re.search(rx, n):
            return d, 'déduit (préfixe)'
    if n.startswith('___'):
        return None, 'à trancher'
    return None, 'à trancher'

DATED = re.compile(r'(_(19|20)\d{6}$|_(19|20)\d{6}_|backup|_bak$|_old$|_copy$|_recover_|_snapshot_\d|_tier_c)', re.I)
RECENT = '20260901'

res = {}
for n, v in x.items():
    s = v['stats']
    ins, upd, dele = (int(float(s[k] or 0)) for k in ('n_tup_ins', 'n_tup_upd', 'n_tup_del'))
    dml = ins + upd + dele
    rel = float(s['reltuples'] or -1)
    rows = int(rel) if rel >= 0 else int(float(s['n_live_tup'] or 0))
    idx = int(float(s['idx_scan'] or 0)); seq = int(float(s['seq_scan'] or 0))
    svc = v['strict'].get('service', []); scr = v['strict'].get('script', []); tst = v['strict'].get('test', [])
    any_code = {k: v['hits'].get(k, []) for k in ('service', 'script', 'test', 'autre')}
    fns = [f.split('.', 1)[1] for f in v['functions']]
    live_fns = [f for f in fns if fn_callers[f]['live']]
    dead_fns = [f for f in fns if not fn_callers[f]['live']]
    cr = file_created.get(n)
    cdate = (created.get(n) or {}).get('version', '')[:8] or (file_date(cr) if cr else None)
    sql_deps = bool(v['views'] or v['fk_in'] or v['functions'] or v['cron'])
    reasons = []
    is_pmi = n.startswith('pieces_media_img_')
    if is_pmi or DATED.search(n):
        cls = 'copie_datee'
        reasons.append('nom daté ou de sauvegarde')
        if is_pmi:
            reasons.append('zone interdite pieces_media_img* : trace d’incident, jamais candidate')
    elif svc and (dml or rows or idx > 100 or v['writes'].get('service')):
        cls = 'vivante'
    elif dml > 0 or v['cron']:
        cls = 'vivante'
        reasons.append('écritures mesurées depuis le 2026-09-17' if dml else 'tournée par un cron')
    elif live_fns and (v['functions_writing'] or rows > 0):
        cls = 'vivante'
        reasons.append(('écrite' if v['functions_writing'] else 'lue (référentiel)') + ' par une fonction appelée : ' + ', '.join(live_fns[:3]))
    elif idx >= 1000 and (svc or scr or live_fns):
        cls = 'vivante'
        reasons.append(f'lecture mesurée : {idx} parcours d’index depuis le 2026-09-17')
    elif not any(any_code.values()) and not sql_deps and dml == 0 and idx <= 50 and seq <= 100:
        cls = 'morte'
    elif cdate and cdate >= RECENT and dml == 0:
        cls = 'prevue'
    else:
        cls = 'a_trancher'
    res[n] = {
        'relkind': s['relkind'], 'nparts': int(s['nparts'] or 0), 'bytes': int(float(s['total_bytes'])),
        'rows_est': rows, 'dml_since_reset': {'ins': ins, 'upd': upd, 'del': dele}, 'seq_scan': seq, 'idx_scan': idx,
        'created': cdate, 'created_by': (created.get(n) or {}).get('name') or cr,
        'created_commit': git_add_commit(cr) if cr else '',
        'service_refs': svc, 'service_writers': v['writes'].get('service', []), 'script_refs': scr, 'test_refs': tst,
        'loose_code_hits': {k: vv for k, vv in any_code.items() if vv},
        'migration_files': v['hits'].get('migration', []), 'doc_files_count': len(v['hits'].get('doc_ou_genere', [])),
        'views': v['views'], 'fk_in': v['fk_in'], 'fk_out': v['fk_out'], 'functions_live': live_fns,
        'functions_uncalled': dead_fns, 'functions_writing': v['functions_writing'], 'cron': v['cron'],
        'triggers': v['triggers'], 'policies': v['policies'], 'class': cls, 'reasons': reasons,
    }
    d, how = dept_of(n, v)
    res[n]['dept'] = d; res[n]['dept_how'] = how; res[n]['dept_id'] = DEPT_LABEL.get(d)

json.dump(res, open(f'{OUT}/classified.json', 'w'), indent=1, ensure_ascii=False)
print(collections.Counter(r['class'] for r in res.values()))
print(collections.Counter(r['dept_how'] for r in res.values()))
