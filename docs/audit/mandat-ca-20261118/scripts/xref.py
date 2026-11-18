#!/usr/bin/env python3
"""Croisement tables massdoc x code du dépôt (mandat CA, 2026-11-18). Lecture seule.

Entrées : out/q2_tables.csv, out/q3_parts.csv, out/q5_viewdeps.csv, out/q6_fk.csv,
out/q7_trig_pol_pub.csv, out/q8_cron.csv, out/q9_funcs.csv (relevés SELECT) ;
dépôt = argv[1] (worktree sur origin/main).
Sortie : out/xref.json
"""
import csv, json, re, subprocess, sys, collections, os

csv.field_size_limit(10**9)
REPO = sys.argv[1]
OUT = 'out'

tables = list(csv.DictReader(open(f'{OUT}/q2_tables.csv')))
names = [t['relname'] for t in tables]
parts = list(csv.DictReader(open(f'{OUT}/q3_parts.csv')))
part_names = {p['part'] for p in parts}

# ---------- git grep (fichiers suivis seulement) ----------
open(f'{OUT}/names.txt', 'w').write('\n'.join(names) + '\n')
res = subprocess.run(['git', '-C', REPO, 'grep', '-n', '-I', '-w', '-F', '-f', os.path.abspath(f'{OUT}/names.txt')],
                     capture_output=True, text=True)
lines = res.stdout.splitlines()

def path_class(p):
    if p.startswith(('backend/supabase/migrations/', 'migrations/')) or p.endswith('.sql') and '/migrations/' in p:
        return 'migration'
    if (p.startswith(('audit/', 'docs/', '.claude/', '.spec/', 'audit-reports/', 'governance/', 'agents/'))
            or p.endswith(('.md', '.mdx', '.txt')) or p in ('log.md',)
            or p.startswith('packages/database-types/') or p.endswith('database.types.ts')
            or p.endswith(('.json', '.jsonl', '.csv', '.lock')) or 'supabase.types' in p):
        return 'doc_ou_genere'
    if re.search(r'(\.spec\.|\.test\.|__tests__/|/tests?/|^tests?/|__regression__/|tests-curl/|__fixtures__/|\.e2e\.|/e2e/|\.bats$)', p):
        return 'test'
    if p.startswith(('scripts/', 'tools/', 'backend/scripts/', 'frontend/scripts/')) or '/scripts/' in p:
        return 'script'
    if p.startswith(('backend/src/', 'frontend/app/', 'workspaces/', 'packages/', 'services/', 'backend/', 'frontend/')):
        return 'service'
    return 'autre'

name_set = set(names)
WRITE_RX = re.compile(r'\.(insert|upsert|update|delete)\s*\(|\b(insert\s+into|update|delete\s+from|truncate|merge\s+into|copy)\b', re.I)
hits = collections.defaultdict(lambda: collections.defaultdict(set))   # name -> class -> files
strict = collections.defaultdict(lambda: collections.defaultdict(set))
writes = collections.defaultdict(lambda: collections.defaultdict(set))
file_cache = {}

def file_lines(p):
    if p not in file_cache:
        try:
            file_cache[p] = open(os.path.join(REPO, p), errors='replace').read().splitlines()
        except Exception:
            file_cache[p] = []
    return file_cache[p]

word_rx_cache = {}
for ln in lines:
    try:
        p, no, text = ln.split(':', 2)
    except ValueError:
        continue
    cls = path_class(p)
    toks = set(re.findall(r'[A-Za-z0-9_]+', text)) & name_set
    for n in toks:
        hits[n][cls].add(p)
        rx = word_rx_cache.get(n)
        if rx is None:
            e = re.escape(n)
            rx = word_rx_cache[n] = (
                re.compile(rf"(['\"`]{e}['\"`])|\b(from|join|into|update|table|exists|on|truncate|regclass)\s+(public\.)?\"?{e}\b|rest/v1/{e}\b|\}}/{e}\b|[,(]\s*{e}\s*(!|\()", re.I),
                re.compile(rf"(insert\s+into|update|delete\s+from|truncate|merge\s+into)\s+(table\s+)?(only\s+)?(public\.)?\"?{e}\b", re.I))
        if rx[0].search(text):
            strict[n][cls].add(p)
            # écriture : SQL direct sur la ligne, ou chaîne supabase-js dans les 6 lignes suivantes
            win = '\n'.join(file_lines(p)[int(no) - 1:int(no) + 6])
            if rx[1].search(text) or (re.search(rf"from\(\s*['\"`]{re.escape(n)}['\"`]", text) and re.search(r'\.(insert|upsert|update|delete)\s*\(', win)):
                writes[n][cls].add(p)

# ---------- dépendances SQL ----------
viewdeps = collections.defaultdict(set)
for r in csv.DictReader(open(f'{OUT}/q5_viewdeps.csv')):
    viewdeps[r['table_name']].add(f"{r['dependent']}({r['kind']})")
fk_in, fk_out = collections.defaultdict(set), collections.defaultdict(set)
for r in csv.DictReader(open(f'{OUT}/q6_fk.csv')):
    s, t = r['src'].replace('public.', ''), r['tgt'].replace('public.', '')
    fk_out[s].add(t); fk_in[t].add(s)
trig, pol, pub = collections.defaultdict(set), collections.defaultdict(set), collections.defaultdict(set)
for r in csv.reader(open(f'{OUT}/q7_trig_pol_pub.csv')):
    if r[0] == 'trigger': trig[r[1]].add(r[2])
    elif r[0] == 'policy': pol[r[1]].add(r[2])
    elif r[0] == 'publication': pub[r[1]].add(r[2])
crons = list(csv.DictReader(open(f'{OUT}/q8_cron.csv')))
funcs = list(csv.DictReader(open(f'{OUT}/q9_funcs.csv')))
fn_refs = collections.defaultdict(set); fn_writes = collections.defaultdict(set)
for f in funcs:
    src = f['src']
    toks = set(re.findall(r'[A-Za-z0-9_]+', src)) & name_set
    for n in toks:
        fn_refs[n].add(f['fn'].split('#')[0])
        if re.search(rf"(insert\s+into|update|delete\s+from|truncate|merge\s+into)\s+(only\s+)?(public\.)?\"?{re.escape(n)}\b", src, re.I):
            fn_writes[n].add(f['fn'].split('#')[0])
# fonctions appelées par un cron (nom de fonction dans la commande)
cron_fn = collections.defaultdict(set)
cron_tbl = collections.defaultdict(set)
fn_names = {f['fn'].split('#')[0].split('.', 1)[1] for f in funcs}
for c in crons:
    cmd = c['command']
    for n in set(re.findall(r'[A-Za-z0-9_]+', cmd)) & name_set:
        cron_tbl[n].add(f"cron#{c['jobid']} {c['jobname']}")
    for fn in set(re.findall(r'[A-Za-z0-9_]+', cmd)) & fn_names:
        cron_fn[fn].add(f"cron#{c['jobid']} {c['jobname']}")
for n, fns in fn_refs.items():
    for fn in fns:
        short = fn.split('.', 1)[1]
        for cj in cron_fn.get(short, ()):
            cron_tbl[n].add(cj + f" via {short}()")
# fonctions appelées par le code (rpc) : nom de fonction présent dans du code service/script
fn_called = {}
res2 = subprocess.run(['git', '-C', REPO, 'grep', '-l', '-I', '-w', '-F', '-e', 'rpc', '--', 'backend/src', 'frontend/app', 'scripts', 'workspaces', 'packages'],
                      capture_output=True, text=True)

out = {}
for t in tables:
    n = t['relname']
    out[n] = {
        'stats': t,
        'hits': {k: sorted(v) for k, v in hits[n].items()},
        'strict': {k: sorted(v) for k, v in strict[n].items()},
        'writes': {k: sorted(v) for k, v in writes[n].items()},
        'views': sorted(viewdeps[n]), 'fk_in': sorted(fk_in[n]), 'fk_out': sorted(fk_out[n]),
        'triggers': sorted(trig[n]), 'policies': len(pol[n]), 'publications': sorted(pub[n]),
        'functions': sorted(fn_refs[n]), 'functions_writing': sorted(fn_writes[n]),
        'cron': sorted(cron_tbl[n]),
    }
json.dump(out, open(f'{OUT}/xref.json', 'w'), indent=1, ensure_ascii=False)
print('tables', len(out), 'grep lines', len(lines))
