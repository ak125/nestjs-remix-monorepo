#!/usr/bin/env python3
"""Produit l'inventaire massdoc (JSON + Markdown) et la liste des candidats à l'archivage
(mandat CA, 2026-11-18). Lecture seule : n'utilise que les relevés out/*.csv déjà faits.
Usage : build_deliverables.py <worktree> <source_commit>
"""
import csv, json, re, sys, collections, datetime, yaml, os

csv.field_size_limit(10**9)
WT, COMMIT = sys.argv[1], sys.argv[2]
r = json.load(open('out/final.json'))
om = yaml.safe_load(open(os.path.join(WT, '.spec/00-canon/ai-registry/agent-operating-map.yaml')))
LBL = {int(d['business_number']): d['id'] for d in om['departments']}
def dl(d): return f"{d:02d} {LBL[d]}" if d else None

TODAY = datetime.date(2026, 11, 18)
CLASS_FR = {'vivante': 'vivante', 'prevue': 'prévue', 'copie_datee': 'copie datée', 'morte': 'morte', 'a_trancher': 'à trancher'}
FAMILY_FR = {'copie_ponctuelle': 'copie ponctuelle', 'partition_instantane': 'partitions d’instantanés',
             'journal': 'journal', 'ancien_site': 'tables de l’ancien site', 'import_staging': 'import et préparation',
             'cache_projection': 'cache ou projection recalculable', 'referentiel_metier': 'référentiel ou donnée métier'}

def mb(b): return round(b / 1e6, 1)

# ---------- partitions ----------
parts = list(csv.DictReader(open('out/q3_parts.csv')))
nonempty = {l.split('|')[0]: l.strip().endswith('|t') for l in open('out/q4_exists.txt') if '|' in l}
ROT = {  # mesuré : cron.job + pg_get_function_arguments (out/q8_cron.csv, out/q16_rotation_args.csv)
    '__seo_snapshot_cf_rum': ('cron#15 snapshot-partition-rotation', 'maintain_snapshot_partitions', 'avance 14 j, supprime après 90 j'),
    '__seo_snapshot_synthetic': ('cron#15 snapshot-partition-rotation', 'maintain_snapshot_partitions', 'avance 14 j, supprime après 90 j'),
    '__seo_cwv_daily': ('cron#16 observability-partition-rotation + cron#22 seo-ensure-monthly-partitions', 'maintain_observability_partitions', 'avance 3 mois, supprime après 18 mois'),
    '__seo_ga4_daily': ('cron#16 observability-partition-rotation + cron#22 seo-ensure-monthly-partitions', 'maintain_observability_partitions', 'avance 3 mois, supprime après 18 mois'),
    '__seo_gsc_daily': ('cron#16 observability-partition-rotation + cron#22 seo-ensure-monthly-partitions', 'maintain_observability_partitions', 'avance 3 mois, supprime après 18 mois'),
    '__seo_cwv_daily_rum': ('cron#20 cwv-daily-rum-rotation', 'maintain_cwv_daily_rum_partitions', 'avance 3 mois, supprime après 12 mois'),
    '__seo_cwv_hourly': ('cron#19 cwv-hourly-rotation', 'maintain_cwv_hourly_partitions', 'avance 3 j, supprime après 14 j'),
    '__seo_cwv_raw': ('cron#18 cwv-raw-rotation', 'maintain_cwv_raw_partitions', 'avance 3 j, supprime après 2 j'),
    '__seo_gsc_daily_page_totals': ('cron#22 seo-ensure-monthly-partitions', '__seo_ensure_monthly_partitions(3)', 'crée seulement : aucune suppression'),
    '__seo_gsc_daily_pages': ('cron#22 seo-ensure-monthly-partitions', '__seo_ensure_monthly_partitions(3)', 'crée seulement : aucune suppression'),
    '__seo_gsc_daily_property_total': ('cron#22 seo-ensure-monthly-partitions', '__seo_ensure_monthly_partitions(3)', 'crée seulement : aucune suppression'),
    '__seo_gsc_daily_totals': ('cron#22 seo-ensure-monthly-partitions', '__seo_ensure_monthly_partitions(3)', 'crée seulement : aucune suppression'),
    '__seo_quality_history': ('cron#17 quality-history-partition-rotation', 'ensure_next_quality_history_partition', 'crée seulement : aucune suppression'),
    'pieces_price_history': ('cron#24 pieces-price-history-partition-rotation', 'maintain_pieces_price_history_partitions', 'crée seulement : aucune suppression'),
    'pricing_decision_snapshot': ('cron#25 pricing-decision-snapshot-partition-rotation', 'maintain_pricing_decision_snapshot_partitions', 'crée seulement : aucune suppression'),
    'supplier_offer_snapshot': ('cron#26 supplier-offer-snapshot-partition-rotation', 'maintain_supplier_offer_snapshot_partitions', 'crée seulement : aucune suppression'),
    'rm_listing_products': (None, 'ensure_rm_partition(p_gamme_id) — jamais appelée', 'aucune rotation (partitions par gamme)'),
}
cov = {row['parent_table']: row for row in csv.DictReader([l for l in open('out/q13_gov_m8.csv')][2:])}
pblock = []
by_parent = collections.defaultdict(list)
for p in parts:
    by_parent[p['parent']].append(p)
for parent in sorted(by_parent):
    ps = by_parent[parent]
    lows = []
    for p in ps:
        m = re.search(r"FROM \('(\d{4}-\d{2}-\d{2})", p['bound'])
        lows.append(datetime.date.fromisoformat(m.group(1)) if m else None)
    dated = [d for d in lows if d]
    future = sum(1 for d in dated if d > TODAY)
    empty = sum(1 for p in ps if not nonempty.get(p['part'], False))
    cron, fn, ret = ROT[parent]
    c = cov.get(parent)
    pblock.append({
        'parent': parent, 'class': r[parent]['class'], 'department': dl(r[parent]['dept']),
        'slices': len(ps), 'empty_slices': empty, 'future_slices': future,
        'has_default': any('DEFAULT' in p['bound'] for p in ps),
        'first_slice_from': str(min(dated)) if dated else None, 'last_slice_from': str(max(dated)) if dated else None,
        'bytes': sum(int(p['bytes']) for p in ps), 'rotation_cron': cron, 'rotation_function': fn,
        'retention_in_service': ret, 'drops_old_slices': 'supprime' in ret,
        'coverage_days_remaining': int(c['days_remaining']) if c else None,
        'evidence': 'mesuré (SELECT 2026-11-18 09:58–10:12 UTC)',
    })
assert sum(p['slices'] for p in pblock) == 355

# ---------- tables ----------
api = collections.defaultdict(int)
for row in list(csv.reader(open('out/q12_pgss.csv')))[3:]:
    if row[1] in ('service_role', 'anon', 'authenticated'):
        api[row[0]] += int(row[3])
exact = {row['relname']: int(row['exact_rows']) for row in csv.DictReader([l for l in open('out/q15_candidates.csv')][2:]) if row.get('relname') and row['relname'] in r}
NOTES = {  # relevé voisin du 2026-09-15 (lots A–E) : tables gardées avec preuve
    '__cnit_raw': ' Le relevé du 2026-09-15 la garde : source RAW du chantier R8 levier A.',
    '__seo_r2_embeddings': ' Le relevé du 2026-09-15 la garde : base du pilote R2 v2.',
}
for n, txt in NOTES.items():
    if r[n]['question']:
        r[n]['question'] += txt
tables = []
for n in sorted(r):
    v = r[n]
    tables.append({
        'name': n, 'kind': 'partitionnée (parent)' if v['relkind'] == 'p' else 'table',
        'class': v['class'], 'question': v['question'], 'family': v['family'],
        'department': dl(v['dept']), 'department_evidence': v['dept_how'],
        'bytes': v['bytes'], 'rows_estimated': v['rows_est'], 'rows_exact': exact.get(n),
        'writes_since_stats_reset': v['dml_since_reset'], 'seq_scan': v['seq_scan'], 'idx_scan': v['idx_scan'],
        'api_role_calls_pgss': api.get(n, 0),
        'created': v['created'], 'created_by': v['created_by'],
        'writers_code': v['service_writers'], 'readers_code': v['service_refs'], 'scripts': v['script_refs'],
        'tests': v['test_refs'],
        'sql': {'views': v['views'], 'fk_in': v['fk_in'], 'fk_out': v['fk_out'], 'functions_called': v['functions_live'],
                'functions_never_called': v['functions_uncalled'], 'functions_writing': v['functions_writing'],
                'cron': v['cron'], 'triggers': v['triggers'], 'policies': v['policies']},
        'reasons': v['reasons'],
    })

cls_count = collections.Counter(t['class'] for t in tables)
assert sum(cls_count.values()) == len(tables) == 363
dept_cls = collections.defaultdict(collections.Counter)
for t in tables:
    dept_cls[t['department']][t['class']] += 1

cands = open('out/candidates.txt').read().split()
assert not any(c.startswith('pieces_media_img') for c in cands)
ADR = re.compile(r'^(__seo_|__diag_|kg_)')

other = [
    {'schema': '_archive', 'line': '62 tables (670 Mo) et 15 vues ; contient déjà les lots D (cars_engine, __qa_audit_*, signal_s*) ; aucune nouvelle entrée par ce mandat', 'evidence': 'mesuré'},
    {'schema': 'tecdoc_doc / tecdoc_ext / tecdoc_map / tecdoc_norm / tecdoc_raw', 'line': '28 tables + 3 vues matérialisées, ≈ 3,7 Go ; hors périmètre (une ligne)', 'evidence': 'mesuré'},
    {'schema': 'auth', 'line': '27 tables, 1,1 Mo ; géré par Supabase, hors périmètre', 'evidence': 'mesuré'},
    {'schema': 'storage', 'line': '10 tables, 2,2 Go ; géré par Supabase, hors périmètre', 'evidence': 'mesuré'},
    {'schema': 'realtime', 'line': '2 tables + 1 partitionnée, 56 ko ; géré par Supabase, hors périmètre', 'evidence': 'mesuré'},
    {'schema': 'cron', 'line': '2 tables, 10 Mo ; job_run_details purgé par cron#32 (lot E du 09-15 voisin)', 'evidence': 'mesuré'},
    {'schema': 'supabase_migrations / vault / _filter / infra / extensions', 'line': '1 + 1 + 1 + 1 tables, vues d’extension ; hors périmètre', 'evidence': 'mesuré'},
    {'schema': 'public (hors tables)', 'line': '45 vues et 4 vues matérialisées, non classées par ce mandat', 'evidence': 'mesuré'},
]

inv = {
    'schema_version': 1,
    'title': 'Inventaire des tables du schéma public de massdoc (mandat CA)',
    'measured_utc': '2026-11-18T09:58:06Z/2026-11-18T10:12:38Z',
    'stats_reset_utc': '2026-09-17T00:53:39Z',
    'source_commit': COMMIT,
    'level': 'L0',
    'totals': {
        'public_relations': 718, 'tables_counted': 363, 'plain_tables': 346, 'partitioned_parents': 17,
        'partition_slices_not_counted': 355,
        'by_class': {k: cls_count.get(k, 0) for k in ['vivante', 'prevue', 'copie_datee', 'morte', 'a_trancher']},
    },
    'by_department': {d or 'non attribué': dict(c) for d, c in sorted(dept_cls.items(), key=lambda x: x[0] or '')},
    'tables': tables, 'partitions': pblock, 'other_schemas': other,
    'archive_candidates': [{'name': c, 'delete_policy': 'ADR_REQUIRED' if ADR.match(c) else 'aucune règle'} for c in cands],
}
os.makedirs(os.path.join(WT, 'audit'), exist_ok=True)
json.dump(inv, open(os.path.join(WT, 'audit/massdoc-table-inventory-2026-11-18.json'), 'w'), indent=1, ensure_ascii=False)

# ---------- Markdown ----------
L = []
w = L.append
w('# Inventaire des tables de massdoc — 2026-11-18 (mandat CA, étape 1)\n')
w('> Niveau L0 : relevé daté, pas une règle. Relevé SELECT en lecture seule, '
  '2026-11-18 entre 09:58 et 10:12 UTC, commit du code `' + COMMIT[:12] + '`. '
  'Compteurs d’activité depuis la remise à zéro du 2026-09-17 00:53 UTC (≈ 62 jours). '
  'Aucune donnée de client lue : noms, comptes et tailles seulement. '
  'Version machine : `audit/massdoc-table-inventory-2026-11-18.json`.\n')
w('Légende des preuves : **mesuré** = relevé en base ou `git grep` ; **déduit** = règle appliquée aux mesures ; '
  '**proposé** = à décider par Marwane ; **non fait** = hors de portée de ce relevé.\n')
w('## 1. Réponse simple\n')
c = inv['totals']['by_class']
w(f"- Le schéma public compte **718 objets de table** (mesuré). **355** ne sont que des tranches de "
  f"17 tables partitionnées : on les compte une fois, au parent. Il reste **363 tables**.")
nb_empty = sum(1 for t in tables if t['class'] == 'vivante' and 'branchée mais vide et jamais écrite depuis le 2026-09-17' in t['reasons'])
w(f"- **{c['vivante']} sont utiles** aujourd’hui (écrites, lues par l’application ou par une fonction appelée) — déduit. "
  f"Parmi elles, {nb_empty} sont branchées mais vides et jamais écrites depuis le 2026-09-17 (une file vide, un journal sans incident…).")
w(f"- **{len(cands)} peuvent être archivées** (déplacées dans `_archive`, pas supprimées) : {c['morte']} tables mortes "
  f"et 1 copie datée — déduit. Les 8 autres copies datées sont des `pieces_media_img_*` : zone interdite, gardées.")
w(f"- **{c['a_trancher']} sont à trancher** : chaque ligne porte la question à poser. Aucune n’est archivée par ce relevé.")
w(f"- **{c['prevue']} table prévue** (créée après le 2026-09-01 et jamais écrite) — déduit.\n")
w('## 2. Synthèse par classe\n')
w('| Classe | Tables | Taille (Mo) |\n|---|---:|---:|')
for k in ['vivante', 'prevue', 'copie_datee', 'morte', 'a_trancher']:
    w(f"| {CLASS_FR[k]} | {c[k]} | {mb(sum(t['bytes'] for t in tables if t['class'] == k)):,} |".replace(',', ' '))
w(f"| **Total** | **{sum(c.values())}** | {mb(sum(t['bytes'] for t in tables)):,} |\n".replace(',', ' '))
w('Contrôle : somme des classes = 363 = 346 tables simples + 17 parents partitionnés (mesuré, `q1_counts`).\n')
w('## 3. Synthèse par département\n')
w('Département = module qui écrit la table (mesuré), sinon module qui la lit, sinon préfixe du nom (déduit). '
  'Le module `admin` (01) est trop large et n’est pas utilisé pour attribuer.\n')
w('| Département | vivante | prévue | copie datée | morte | à trancher | Total |\n|---|---:|---:|---:|---:|---:|---:|')
for d, cc in sorted(dept_cls.items(), key=lambda x: x[0] or ''):
    w(f"| {d} | {cc['vivante']} | {cc['prevue']} | {cc['copie_datee']} | {cc['morte']} | {cc['a_trancher']} | {sum(cc.values())} |")
w('')
w('## 4. Tables partitionnées (comptées une fois)\n')
w('| Parent | Classe | Tranches | Vides | Futures | Première → dernière | Rotation (cron) | Rétention en service | Jours couverts |\n|---|---|---:|---:|---:|---|---|---|---:|')
for p in pblock:
    w(f"| `{p['parent']}` | {CLASS_FR[p['class']]} | {p['slices']} | {p['empty_slices']} | {p['future_slices']} | "
      f"{p['first_slice_from']} → {p['last_slice_from']}{' + DEFAULT' if p['has_default'] else ''} | {p['rotation_cron'] or 'aucun'} | {p['retention_in_service']} | "
      f"{p['coverage_days_remaining'] if p['coverage_days_remaining'] is not None else '—'} |")
w(f"\nTotal : {sum(p['slices'] for p in pblock)} tranches, dont {sum(p['empty_slices'] for p in pblock)} vides (mesuré, `exists()` par tranche).\n")
w('### 4.1 `__seo_snapshot_cf_rum` : 105 tranches vides\n')
w('- **Mesuré** : 105 tranches sur 105 sont vides (du 2026-08-20 au 2026-12-02), 0 insertion depuis le 2026-09-17. '
  'La rotation cron#15 tourne chaque nuit et réussit (dernier passage 2026-11-18 02:20 UTC).')
w('- **Mesuré dans le code** : l’écrivain existe (`backend/src/modules/seo-control-plane/collectors/cf-rum/cf-rum.service.ts`, PR #583 du 2026-05-17). '
  'Son ordonnanceur ne démarre que si `SEO_CP_CF_RUM_ENABLED=true` ; la valeur par défaut est `false` '
  '(`cf-rum.scheduler.service.ts`, `backend/.env.example:271`) et la variable est absente du `backend/.env` du DEV.')
w('- **Déduit** : la collecte n’est pas « arrêtée » ; elle n’a vraisemblablement jamais été activée ici. Aucune écriture depuis au moins le '
  '2026-08-20 (plus ancienne tranche gardée par la rétention de 90 jours).')
w('- **Non établi** : la valeur du drapeau en PROD (aucun accès), et l’existence de lignes entre le 2026-05-17 et le 2026-08-20 '
  '(tranches déjà supprimées par la rotation).')
w('- Décision déjà posée au lot D (2026-09-15) et toujours ouverte : activer le collecteur (jeton Cloudflare) **ou** retirer `cf_rum` de '
  '`maintain_snapshot_partitions`. Rien n’est changé par ce mandat.\n')
w('### 4.2 Écart avec le contrôle `partition-cron-gap`\n')
w('Le contrôle (`.claude/skills/runtime-truth-audit/checks/partition-cron-gap.md`, script '
  '`scripts/audit/runtime-truth/partition-cron-gap.ts`) lit la fonction `__gov_m8_partition_coverage()`. '
  'Relevée le 2026-11-18 10:09 UTC (mesuré), elle ne signale **rien** : toutes les tables ont un cron et au moins 4 jours devant elles '
  '(`__seo_cwv_hourly` et `__seo_cwv_raw` : 4 jours, au-dessus des seuils 2 et 7 jours du script pour une table avec cron).\n')
w('Ce que le contrôle ne voit pas (mesuré ici) :')
w('1. **Rétention absente** : 8 tables partitionnées reçoivent de nouvelles tranches sans que les anciennes soient jamais supprimées '
  '(`__seo_gsc_daily_page_totals`, `__seo_gsc_daily_pages`, `__seo_gsc_daily_property_total`, `__seo_gsc_daily_totals`, '
  '`__seo_quality_history`, `pieces_price_history`, `pricing_decision_snapshot`, `supplier_offer_snapshot`). '
  'Le contrôle ne lit pas la rétention.')
w('2. **Tables tournées mais toujours vides** : `__seo_snapshot_cf_rum` (105/105 vides) passe le contrôle. '
  'Il ne regarde pas si les tranches reçoivent des lignes.')
w('3. **Partitions par liste** : `rm_listing_products` (7 tranches, sans cron) est ignorée, la fonction ne lit que les partitions par plage.')
w('4. Le test « a un cron » accepte tout cron dont la commande contient `maintain…partition` : un cron qui en tourne une autre suffit.\n')
w('Ces écarts sont signalés, pas corrigés (hors mandat).\n')
w('## 5. Autres schémas (une ligne chacun)\n')
for o in other:
    w(f"- `{o['schema']}` : {o['line']} ({o['evidence']}).")
w('')
w('## 6. Tables à archiver (candidats)\n')
w(f"{len(cands)} tables. Détail des preuves et format du lot : `docs/audit/mandat-ca-20261118/candidats-archivage.md`.\n")
w('## 7. Tables à trancher, avec leur question\n')
w('| Table | Dépt | Mo | Lignes (est.) | Question |\n|---|---|---:|---:|---|')
for t in tables:
    if t['class'] == 'a_trancher':
        w(f"| `{t['name']}` | {t['department']} | {mb(t['bytes'])} | {t['rows_estimated']} | {t['question']}"
          + (f" ({t['api_role_calls_pgss']} appels du rôle de l’API mesurés)" if t['api_role_calls_pgss'] else '') + ' |')
w('')
w('## 8. Inventaire complet (une ligne par table)\n')
w('Colonnes : classe (déduit), département, taille et lignes estimées (mesuré), écritures depuis le 2026-09-17 '
  '(insert/update/delete, mesuré), parcours séquentiels/index (mesuré), écrivains et lecteurs dans le code (mesuré, `git grep`), '
  'dépendances SQL (mesuré), famille de conservation (proposé).\n')
w('| Table | Classe | Dépt | Mo | Lignes | Écritures i/u/d | seq/idx | Écrivains (code) | Lecteurs (code) | SQL | Famille |\n|---|---|---|---:|---:|---|---|---|---|---|---|')
def short(lst, k=2):
    lst = [re.sub(r'^backend/src/modules/', 'mod/', x) for x in lst]
    return ', '.join(lst[:k]) + (f' +{len(lst) - k}' if len(lst) > k else '') if lst else '—'
for t in tables:
    s = t['sql']
    sql = '; '.join(x for x in [
        f"cron {len(s['cron'])}" if s['cron'] else '', f"fn {len(s['functions_called'])}" if s['functions_called'] else '',
        f"fn morte {len(s['functions_never_called'])}" if s['functions_never_called'] else '',
        f"vues {len(s['views'])}" if s['views'] else '', f"FK← {len(s['fk_in'])}" if s['fk_in'] else ''] if x) or '—'
    wr = t['writes_since_stats_reset']
    w(f"| `{t['name']}`{' (P)' if t['kind'] != 'table' else ''} | {CLASS_FR[t['class']]} | {t['department'] or '—'} | {mb(t['bytes'])} | "
      f"{t['rows_estimated']} | {wr['ins']}/{wr['upd']}/{wr['del']} | {t['seq_scan']}/{t['idx_scan']} | {short(t['writers_code'])} | "
      f"{short(t['readers_code'])} | {sql} | {FAMILY_FR[t['family']]} |")
w('')
w('## 9. Limites\n')
for x in [
    'Une seule base sert DEV, PREPROD et PROD : les compteurs couvrent tout le trafic, mais ne disent pas quel environnement lit (mesuré).',
    'Les compteurs d’activité et `pg_stat_statements` partent du 2026-09-17 00:53 UTC : une table lue une fois par trimestre peut paraître morte (limite).',
    'Le registre des migrations (`supabase_migrations.schema_migrations`) s’arrête au 2026-10-04 : les dates de création postérieures viennent des fichiers du dépôt, pas de la base (mesuré).',
    'Les lecteurs hors dépôt ont été cherchés dans les dépôts voisins du VPS DEV (rag, raw, wiki, auto-research, mcp-ga4, mcp-gsc, marketing, data, ~/bin) ; ni la PROD ni les postes de travail n’ont été vus (non fait).',
    'Un nom de table construit dynamiquement dans le code échappe au `git grep` ; seuls `gamme_${pgId}` et `_${hint}_` existent, et ne visent aucun candidat (mesuré).',
    'La classe « vivante » ne dit pas que la table est utile au métier, seulement qu’elle est écrite ou lue (déduit).',
    'Les vues et vues matérialisées du schéma public ne sont pas classées (non fait).',
    'Les familles de conservation sont tirées du nom et de la classe : c’est une proposition à relire (proposé).',
]:
    w(f'- {x}')
open(os.path.join(WT, 'audit/massdoc-table-inventory-2026-11-18.md'), 'w').write('\n'.join(L) + '\n')

# ---------- candidats ----------
cand_rows = {row['relname']: row for row in csv.DictReader([l for l in open('out/q15_candidates.csv')][2:]) if row.get('relname') in r}
xr = json.load(open('out/xref.json'))
C = []
w = C.append
w('# Candidats à l’archivage — format du lot D (mandat CA, 2026-11-18)\n')
w('> **Aucune migration n’est écrite.** Ce document liste des candidats et leurs preuves, au format de '
  '`backend/supabase/migrations/20261001_archive_dead_tables_lot_d.sql` (PR #1650). '
  'Chaque lot reste un acte de Marwane : migration passée par « 🗄️ Apply Supabase migrations (manual) », essai à blanc d’abord.\n')
w('## Lots précédents (contexte)\n')
w('Source : `audit/massdoc-db-hygiene-candidates-2026-09-15.md` (worktree `db-hygiene-20260915`, non versionné sur `main`).\n')
w('| Lot | Contenu | PR | État en base le 2026-11-18 |\n|---|---|---|---|')
w('| A | index doublons exacts | #1619 (`20260929_drop_exact_duplicate_indexes.sql`) | appliqué (déduit : la PR suivante #1649 s’appuie dessus) |')
w('| B | 26 index jamais lus de `pieces_price` | #1649 (`20261001_drop_pieces_price_unused_indexes.sql`) | appliqué (mesuré : seuls les index que le fichier garde existent encore) |')
w('| C | schéma `tecdoc_rebuild` (946 Mo) | — | schéma absent (mesuré) |')
w('| D | 7 tables mortes → `_archive` | #1650 (`20261001_archive_dead_tables_lot_d.sql`) | appliqué (mesuré : `cars_engine`, `__qa_audit_*`, `signal_s*` sont dans `_archive`) |')
w('| E | rétention 90 j de `__soft_404_events` | #1620 | appliqué (mesuré : cron#31) |')
w('\nLe présent lot se nomme donc **F** (proposé). Il se découpe en deux :\n')
f1 = [c for c in cands if not ADR.match(c)]
f2 = [c for c in cands if ADR.match(c)]
w(f'- **F1** : {len(f1)} tables sans règle de suppression particulière.')
w(f'- **F2** : {len(f2)} tables `__seo_*`, `__diag_*`, `kg_*` : `deletePolicy = ADR_REQUIRED` dans '
  '`.spec/00-canon/repository-registry/delete-policy.yaml`. Un archivage n’est pas une suppression, mais une décision écrite de Marwane est demandée avant ce lot.\n')
w('## En-tête proposé (même plan que le lot D)\n')
w('```text')
w('-- Scope (lignes exactes comptées le 2026-11-18 10:12 UTC) :')
for grp, lst in (('F1', f1), ('F2', f2)):
    w(f'--   [{grp}]')
    for c in lst:
        w(f"--   public.{c:<42} {cand_rows[c]['exact_rows']:>5} lignes")
w('--')
w('-- POURQUOI : 0 écriture depuis le 2026-09-17 (pg_stat_user_tables) ; 0 appel du rôle de l’API dans')
w('--   pg_stat_statements ; 0 lecteur ou écrivain dans le code (git grep, hors migrations, docs et types générés) ;')
w('--   0 vue, 0 règle, 0 fonction, 0 cron, 0 clé étrangère entrante ; hors publication et hors extension.')
w('-- POURQUOI SET SCHEMA _archive ET PAS DROP : réversible par ALTER TABLE … SET SCHEMA public ;')
w('--   données, index, contraintes, triggers et policies suivent la table.')
w('-- HORS LOT : tous les pieces_media_img* (zone interdite) ; les tables « à trancher » de l’inventaire ;')
w('--   __seo_snapshot_cf_rum (décision collecteur, voir inventaire §4.1).')
w('-- EFFETS CONNUS : clés étrangères sortantes conservées vers public (liste ci-dessous) ; triggers')
w('--   enforce_agent_write_scope / updated_at déplacés avec la table ; types générés à régénérer.')
w('-- IDEMPOTENT : chaque table déplacée seulement si elle est encore dans public.')
w('-- APPLICATION : Actions → « 🗄️ Apply Supabase migrations (manual) », only_ids = <id>, essai à blanc d’abord.')
w('-- ROLLBACK : .down.sql symétrique (SET SCHEMA public).')
w('-- PRÉCONTRÔLE (fail-closed, comme le lot D) : _archive existe et appartient à postgres ; aucun rôle de')
w('--   l’API n’a USAGE dessus ; pour chaque table : nombre de lignes = nombre ci-dessus, table simple (relkind r),')
w('--   propriétaire postgres, hors extension, hors publication.')
w('```\n')
w('## Preuves par table\n')
w('`git grep` : `git grep -l -w -F <table>` au commit `' + COMMIT[:12] + '`. La colonne donne les fichiers trouvés **hors** migrations, '
  'documentation et types générés : 0 partout (mesuré). Les autres colonnes sont mesurées en base.\n')
w('| Table | Lot | Lignes exactes | Mo | Code (grep) | Migrations / docs | Vues · règles · fonctions · cron · FK entrantes | FK sortantes | Triggers | Écritures depuis 09-17 | seq/idx | Appels API | Dépt |\n'
  '|---|---|---:|---:|---:|---|---|---|---|---|---|---:|---|')
for c in cands:
    v = r[c]; h = xr[c]['hits']
    code = sum(len(h.get(k, [])) for k in ('service', 'script', 'test', 'autre'))
    assert code == 0 and not (v['views'] or v['fk_in'] or v['functions_live'] or v['functions_uncalled'] or v['cron'])
    wr = v['dml_since_reset']
    w(f"| `{c}` | {'F2' if ADR.match(c) else 'F1'} | {cand_rows[c]['exact_rows']} | {mb(int(cand_rows[c]['bytes']))} | {code} | "
      f"{len(h.get('migration', []))} / {len(h.get('doc_ou_genere', []))} | 0 · 0 · 0 · 0 · 0 | {', '.join(v['fk_out']) or '—'} | "
      f"{', '.join(t.split(':')[0] for t in v['triggers']) or '—'} | {wr['ins']}/{wr['upd']}/{wr['del']} | {v['seq_scan']}/{v['idx_scan']} | "
      f"{api.get(c, 0)} | {dl(v['dept'])} |")
w('\nRègles et vues : 0 objet `pg_rewrite` ne dépend d’un candidat (mesuré, `q15_candidates`).\n')
w('## Points d’attention (déduit)\n')
w('- `__qa_protected_meta_hash` (140 lignes) : son nom évoque la protection des meta et H1 optimisés. Aucun code ne la lit ; '
  'confirmer qu’aucune garde hors dépôt n’en dépend avant de l’archiver.')
w('- `__seo_role_content` garde une clé étrangère vers `__seo_page_brief` (vivante) ; `__marketing_guest_posts` vers '
  '`__marketing_campaigns` et `__marketing_outreach` ; `norm_vehicle` et `stg_compatibility` vers `import_batch` ; '
  '`__seo_r2_page_content` vers `__seo_r2_pages` ; ces tables cibles restent dans public.')
w('- `__rag_readiness` (1 219 lignes) et `__seo_cannibalization_recommendations` (662 lignes) sont les plus grosses ; '
  'un export avant archivage est possible mais pas nécessaire (SET SCHEMA garde les données).')
w('- `audit_vlevel_pg424_snapshot_20260608` : copie datée du 2026-06-08, 1 616 lignes, 0 lecture depuis le 2026-09-17.\n')
w('## Exclus volontairement\n')
w('- Les 8 tables `pieces_media_img_*` (sauvegardes et reprises de juin et mai 2026) : zone interdite, trace d’un incident. Jamais candidates.')
w('- Toute table à trancher, même vide : il faut d’abord la réponse à sa question (inventaire §7).')
open(os.path.join(WT, 'docs/audit/mandat-ca-20261118/candidats-archivage.md'), 'w').write('\n'.join(C) + '\n')
print('ok', dict(cls_count), len(cands), len(f1), len(f2))
