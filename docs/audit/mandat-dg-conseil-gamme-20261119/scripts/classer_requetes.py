#!/usr/bin/env python3
"""Mandat DG, 6.1 et 6.2 — classement rejouable des requêtes GSC (règle écrite ici, stdlib seule).

Entrées (dossier data/, produites par sql/q01..q03) :
  gsc_r1_conseil_90j.csv, gsc_totaux_pages_90j.csv, pieces_gamme.tsv,
  vocab_marques_auto.txt, vocab_modeles_auto.txt, vocab_equipementiers.txt
  ctr_site_par_position_90j.csv (sql/q06, courbe de taux de clic du site)
Sorties (dossier out/) : tableaux CSV relus par le rapport.

Règle (première qui s'applique, relative à la gamme de la page qui reçoit la requête) :
  0. exclue    : requête synthétique ^ai\\d+$ (type_id internes, 0 clic, cf. mémoire GSC du 2026-05-26)
  1. question  : un mot de QUESTION (liste ci-dessous) ou « c est »
  2. achat     : un mot d'ACHAT, ou une marque d'équipementier, ou une référence (jeton de 5+ caractères
                 avec 3+ chiffres, hors année 19xx/20xx)
  3. vehicule  : une marque automobile, un premier mot de nom de modèle, ou un mot de motorisation
  4. nue       : tous les mots restants (hors mots vides) appartiennent au nom ou à l'alias de la gamme
  5. autre     : le reste (pièce + précision, autre pièce, faute de frappe…)
Un mot qui appartient au nom de la gamme de la page ne déclenche jamais les règles 1 à 3
(ex. « commande » dans « câble de commande »).
  « nue » tolère : mots génériques et de position (NEUTRE), une faute d'une lettre sur un mot de 4+ lettres,
  le synonyme listé (SYNONYME). Les autres synonymes (« boîtier papillon », « capteur esp »…) restent « autre ».
Normalisation : minuscules, accents retirés, ponctuation → espace, pluriel final s/x retiré (mot > 3 lettres).
"""
import csv, os, re, sys, unicodedata
from collections import defaultdict

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA, OUT = os.path.join(BASE, 'data'), os.path.join(BASE, 'out')
os.makedirs(OUT, exist_ok=True)

STOP = set('de d du des la le les l a au aux pour en et sur un une sa son ses ma mon me ma mes avec sans par'.split())
QUESTION = set('''comment quand pourquoi quel quelle quoi qu symptome role fonctionnement fonctionne fonction sert servir
definition changer changement remplacer remplacement remplace demonter demontage montage monter tuto tutoriel
panne bruit signe usure hs defaillant defectueux voyant fuite tester test verifier controle controler emplacement
schema entretien duree nettoyer nettoyage regler reglage purger purge difference faut combien
grippe fuit qui bloque claque siffle vibre chauffe probleme defaut'''.split())
NEUTRE = set('voiture auto automobile vehicule piece avant arriere gauche droit droite'.split())
SYNONYME = {'clim': 'climatisation'}
ACHAT = set('prix cher acheter achat promo promotion solde discount vente commander commande livraison tarif cout euro eur neuf occasion origine moins'.split())
MOTEUR = set('hdi dci tdi tsi tfsi fsi cdi crdi cdti jtd jtdm multijet puretech bluehdi ecoblue tdci vti thp tce dti d4d gti 16v 8v'.split())
EQUIP_DENY = set('car stop real fast gold king ultra exact storm wolf fit abs don auto pro top era miles johns frey mat10 555 mobil shell'.split())
MARQUE_DENY = {'gaz'}  # marque GAZ = « papillon des gaz »
MODELE_DENY = set('''classe serie grand nouvelle new mark wagon type coupe break van pick pickup sport city courier express combi
cabriolet berline camionnette plateau chassis bus mini super grande citation logo rocky silvia carry'''.split())


def norm(s):
    s = unicodedata.normalize('NFKD', s.lower())
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()


def sing(t):
    return t[:-1] if len(t) > 3 and t[-1] in 'sx' and not t.isdigit() else t


def toks(s):
    return [sing(t) for t in norm(s).split()]


def load_lines(name):
    with open(os.path.join(DATA, name), encoding='utf-8') as f:
        return [l.strip() for l in f if l.strip()]


gammes = {}
with open(os.path.join(DATA, 'pieces_gamme.tsv'), encoding='utf-8') as f:
    for r in csv.DictReader(f, delimiter='\t'):
        gammes[int(r['pg_id'])] = r
ALL_GAMME_TOKENS = set()
GT = {}
for pid, r in gammes.items():
    s = set(toks(r['pg_name'] or '')) | set(toks((r['pg_alias'] or '').replace('-', ' ')))
    s -= STOP
    GT[pid] = s
    ALL_GAMME_TOKENS |= s

MARQUES = set()
for m in load_lines('vocab_marques_auto.txt'):
    tt = norm(m).split()
    if tt and len(tt[0]) >= 3 and tt[0] not in MARQUE_DENY:
        MARQUES.add(tt[0])
MODELES = set()
for m in load_lines('vocab_modeles_auto.txt'):
    tt = norm(m).split()
    if not tt:
        continue
    t = tt[0]
    ok = (len(t) >= 3 and not t.isdigit()) or (len(t) >= 2 and any(c.isdigit() for c in t) and any(c.isalpha() for c in t)) or (t.isdigit() and len(t) in (3, 4))
    if ok and t not in MODELE_DENY and t not in STOP and t not in ALL_GAMME_TOKENS and t not in QUESTION and t not in ACHAT:
        MODELES.add(t)
EQUIP = set()
for m in load_lines('vocab_equipementiers.txt'):
    tt = norm(m).split()
    if tt and len(tt[0]) >= 3 and tt[0] not in EQUIP_DENY and tt[0] not in MARQUES and tt[0] not in ALL_GAMME_TOKENS and not tt[0].isdigit():
        EQUIP.add(tt[0])
QUESTION, ACHAT, MOTEUR, NEUTRE = ({sing(t) for t in x} for x in (QUESTION, ACHAT, MOTEUR, NEUTRE))
REF = re.compile(r'^(?=(?:.*\d){3})[a-z0-9]{5,}$')
YEAR = re.compile(r'^(19|20)\d\d$')


def lev1(a, b):
    """Vrai si a et b diffèrent d'au plus une lettre (ajout, retrait, substitution)."""
    if a == b:
        return True
    if abs(len(a) - len(b)) > 1:
        return False
    if len(a) == len(b):
        return sum(x != y for x, y in zip(a, b)) == 1
    if len(a) > len(b):
        a, b = b, a
    return any(b[:i] + b[i + 1:] == a for i in range(len(b)))


def own_match(t, own):
    """Mot de la gamme, à une faute de frappe près (mots de 4 lettres et plus), ou synonyme listé."""
    t = SYNONYME.get(t, t)
    if t in own:
        return True
    return len(t) >= 4 and any(len(o) >= 4 and lev1(t, o) for o in own)


def classer(query, pg_id):
    q = norm(query)
    if re.fullmatch(r'ai\d+', q.replace(' ', '')):
        return 'exclue'
    tt = [sing(t) for t in q.split()]
    own = GT.get(pg_id, set())
    free = [t for t in tt if t not in own]
    if any(t in QUESTION for t in free) or re.search(r'\bc est\b', q):
        return 'question'
    if any(t in ACHAT for t in free) or any(t in EQUIP for t in free) or any(REF.match(t) and not YEAR.match(t) for t in free):
        return 'achat'
    if any(t in MARQUES or t in MODELES or t in MOTEUR for t in free):
        return 'vehicule'
    core = [t for t in tt if t not in STOP and t not in NEUTRE]
    if core and all(own_match(t, own) for t in core) and any(own_match(t, own) for t in core):
        return 'nue'
    return 'autre'


def wpos(rows):
    imp = sum(r['imp'] for r in rows)
    return (sum(r['pos'] * r['imp'] for r in rows) / imp) if imp else None


def main():
    rows = []
    with open(os.path.join(DATA, 'gsc_r1_conseil_90j.csv'), encoding='utf-8') as f:
        for r in csv.DictReader(f):
            if not r['pg_id']:
                continue
            rows.append(dict(ptype=r['ptype'], pg_id=int(r['pg_id']), page=r['page'], query=r['query'],
                             clk=int(r['clicks']), imp=int(r['impressions']), pos=float(r['pos'] or 0)))
    for r in rows:
        r['fam'] = classer(r['query'], r['pg_id'])
    with open(os.path.join(OUT, 'requetes_classees.csv'), 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['ptype', 'pg_id', 'pg_alias', 'query', 'famille', 'clics', 'impressions', 'position'])
        for r in sorted(rows, key=lambda r: (-r['imp'], r['query'])):
            w.writerow([r['ptype'], r['pg_id'], gammes.get(r['pg_id'], {}).get('pg_alias', ''), r['query'], r['fam'], r['clk'], r['imp'], round(r['pos'], 2)])

    r1_g = {r['pg_id'] for r in rows if r['ptype'] == 'R1'}
    co_g = {r['pg_id'] for r in rows if r['ptype'] == 'conseil'}
    both = r1_g & co_g
    sub = [r for r in rows if r['pg_id'] in both]

    # anonymisation : totaux page vs somme des lignes requête
    tot = {}
    with open(os.path.join(DATA, 'gsc_totaux_pages_90j.csv'), encoding='utf-8') as f:
        for r in csv.DictReader(f):
            tot[r['page']] = (int(r['clicks']), int(r['impressions']))
    anon = defaultdict(lambda: [0, 0, 0, 0])
    pages_seen = defaultdict(lambda: [0, 0])
    for r in rows:
        pages_seen[r['page']][0] += r['clk']
        pages_seen[r['page']][1] += r['imp']
    for p, (c, i) in pages_seen.items():
        pt = 'R1' if '/pieces/' in p else 'conseil'
        if p in tot:
            anon[pt][0] += c; anon[pt][1] += i; anon[pt][2] += tot[p][0]; anon[pt][3] += tot[p][1]
    with open(os.path.join(OUT, 'anonymisation.csv'), 'w', newline='') as f:
        w = csv.writer(f); w.writerow(['ptype', 'clics_requetes', 'imp_requetes', 'clics_totaux', 'imp_totaux', 'part_imp_anonymisee'])
        for pt, (c, i, tc, ti) in sorted(anon.items()):
            w.writerow([pt, c, i, tc, ti, round(1 - i / ti, 3) if ti else ''])

    # 6.1 familles × type de page (gammes à double page)
    with open(os.path.join(OUT, 'familles_par_type.csv'), 'w', newline='') as f:
        w = csv.writer(f); w.writerow(['famille', 'ptype', 'requetes', 'impressions', 'clics', 'ctr_pct', 'position'])
        for fam in ['nue', 'question', 'achat', 'vehicule', 'autre', 'exclue']:
            for pt in ['conseil', 'R1']:
                rr = [r for r in sub if r['fam'] == fam and r['ptype'] == pt]
                imp = sum(r['imp'] for r in rr); clk = sum(r['clk'] for r in rr)
                p = wpos(rr)
                w.writerow([fam, pt, len({r['query'] for r in rr}), imp, clk, round(100 * clk / imp, 2) if imp else '', round(p, 1) if p else ''])

    # 6.1 par gamme : requêtes partagées R1/conseil de la même gamme, qui est devant, par famille
    by = defaultdict(lambda: defaultdict(list))
    for r in sub:
        by[(r['pg_id'], r['query'])][r['ptype']].append(r)
    duel = []
    for (pid, q), d in by.items():
        if 'R1' in d and 'conseil' in d:
            pr, pc = wpos(d['R1']), wpos(d['conseil'])
            duel.append(dict(pg_id=pid, query=q, fam=d['R1'][0]['fam'], imp_r1=sum(x['imp'] for x in d['R1']),
                             imp_co=sum(x['imp'] for x in d['conseil']), clk_r1=sum(x['clk'] for x in d['R1']),
                             clk_co=sum(x['clk'] for x in d['conseil']), pos_r1=pr, pos_co=pc))
    with open(os.path.join(OUT, 'duels_meme_gamme.csv'), 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f); w.writerow(['pg_id', 'pg_alias', 'query', 'famille', 'imp_conseil', 'pos_conseil', 'clics_conseil', 'imp_r1', 'pos_r1', 'clics_r1', 'devant'])
        for d in sorted(duel, key=lambda d: -(d['imp_r1'] + d['imp_co'])):
            w.writerow([d['pg_id'], gammes[d['pg_id']]['pg_alias'], d['query'], d['fam'], d['imp_co'], round(d['pos_co'], 1), d['clk_co'], d['imp_r1'], round(d['pos_r1'], 1), d['clk_r1'],
                        'conseil' if d['pos_co'] < d['pos_r1'] else ('R1' if d['pos_r1'] < d['pos_co'] else 'egal')])
    with open(os.path.join(OUT, 'duels_synthese.csv'), 'w', newline='') as f:
        w = csv.writer(f); w.writerow(['famille', 'requetes_partagees', 'conseil_devant', 'r1_devant', 'egal'])
        for fam in ['nue', 'question', 'achat', 'vehicule', 'autre', 'exclue']:
            dd = [d for d in duel if d['fam'] == fam]
            w.writerow([fam, len(dd), sum(d['pos_co'] < d['pos_r1'] for d in dd), sum(d['pos_r1'] < d['pos_co'] for d in dd), sum(d['pos_r1'] == d['pos_co'] for d in dd)])

    # par gamme × famille × type (pour la carte)
    with open(os.path.join(OUT, 'carte_par_gamme.csv'), 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f); w.writerow(['pg_id', 'pg_alias', 'famille', 'imp_conseil', 'clics_conseil', 'pos_conseil', 'imp_r1', 'clics_r1', 'pos_r1'])
        for pid in sorted(both, key=lambda p: gammes[p]['pg_alias']):
            for fam in ['nue', 'question', 'achat', 'vehicule', 'autre']:
                rc = [r for r in sub if r['pg_id'] == pid and r['fam'] == fam and r['ptype'] == 'conseil']
                rr = [r for r in sub if r['pg_id'] == pid and r['fam'] == fam and r['ptype'] == 'R1']
                if not rc and not rr:
                    continue
                pc, pr = wpos(rc), wpos(rr)
                w.writerow([pid, gammes[pid]['pg_alias'], fam, sum(r['imp'] for r in rc), sum(r['clk'] for r in rc), round(pc, 1) if pc else '',
                            sum(r['imp'] for r in rr), sum(r['clk'] for r in rr), round(pr, 1) if pr else ''])

    # 6.2 couples conseil × requête en position 1–10 (hors exclues)
    curve = {}
    with open(os.path.join(DATA, 'ctr_site_par_position_90j.csv'), encoding='utf-8') as f:
        for r in csv.DictReader(f):
            curve[int(r['pos_arrondie'])] = float(r['ctr_site'])
    top = [r for r in rows if r['ptype'] == 'conseil' and r['fam'] != 'exclue' and 1 <= r['pos'] <= 10.49 and r['imp'] > 0]
    for r in top:
        b = max(1, min(10, round(r['pos'])))
        r['exp_clk'] = r['imp'] * curve.get(b, 0)
    with open(os.path.join(OUT, 'conseil_top10_couples.csv'), 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f); w.writerow(['page', 'query', 'famille', 'impressions', 'clics', 'ctr_pct', 'position', 'ctr_attendu_site_pct', 'clics_attendus', 'ecart_clics'])
        for r in sorted(top, key=lambda r: -(r['exp_clk'] - r['clk'])):
            w.writerow([r['page'].split('/conseils/')[1], r['query'], r['fam'], r['imp'], r['clk'], round(100 * r['clk'] / r['imp'], 2), round(r['pos'], 1),
                        round(100 * curve.get(max(1, min(10, round(r['pos']))), 0), 2), round(r['exp_clk'], 1), round(r['exp_clk'] - r['clk'], 1)])
    pg = defaultdict(lambda: [0, 0, 0.0, 0])
    for r in top:
        a = pg[r['page'].split('/conseils/')[1]]
        a[0] += r['imp']; a[1] += r['clk']; a[2] += r['exp_clk']; a[3] += 1
    with open(os.path.join(OUT, 'conseil_top10_pages.csv'), 'w', newline='') as f:
        w = csv.writer(f); w.writerow(['page', 'couples', 'impressions', 'clics', 'clics_attendus', 'ecart_clics', 'ctr_pct', 'ctr_attendu_pct'])
        for p, (i, c, e, n) in sorted(pg.items(), key=lambda kv: -(kv[1][2] - kv[1][1])):
            w.writerow([p, n, i, c, round(e, 1), round(e - c, 1), round(100 * c / i, 2), round(100 * e / i, 2)])

    # 6.6 gammes dont la requête nue a des impressions (sur R1) — la liste « sans page conseil » est faite côté rapport
    nue_r1 = defaultdict(lambda: [0, 0])
    for r in rows:
        if r['fam'] == 'nue' and r['ptype'] == 'R1':
            nue_r1[r['pg_id']][0] += r['imp']; nue_r1[r['pg_id']][1] += r['clk']
    with open(os.path.join(OUT, 'nue_r1_par_gamme.csv'), 'w', newline='') as f:
        w = csv.writer(f); w.writerow(['pg_id', 'pg_alias', 'imp_nue_r1', 'clics_nue_r1', 'conseil_en_gsc'])
        for pid, (i, c) in sorted(nue_r1.items(), key=lambda kv: -kv[1][0]):
            w.writerow([pid, gammes[pid]['pg_alias'], i, c, int(pid in co_g)])

    # 6.1 par gamme : duels « nue » agrégés (qui est devant, pondéré par impressions)
    dg = defaultdict(list)
    for d in duel:
        if d['fam'] == 'nue':
            dg[d['pg_id']].append(d)
    with open(os.path.join(OUT, 'nue_par_gamme_duel.csv'), 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f); w.writerow(['pg_alias', 'requetes_nues_partagees', 'conseil_devant', 'r1_devant', 'imp_conseil', 'pos_conseil', 'imp_r1', 'pos_r1', 'devant_pondere'])
        for pid, dd in sorted(dg.items(), key=lambda kv: -sum(d['imp_co'] + d['imp_r1'] for d in kv[1])):
            ic, ir = sum(d['imp_co'] for d in dd), sum(d['imp_r1'] for d in dd)
            pc = sum(d['pos_co'] * d['imp_co'] for d in dd) / ic if ic else 0
            pr = sum(d['pos_r1'] * d['imp_r1'] for d in dd) / ir if ir else 0
            w.writerow([gammes[pid]['pg_alias'], len(dd), sum(d['pos_co'] < d['pos_r1'] for d in dd), sum(d['pos_r1'] < d['pos_co'] for d in dd),
                        ic, round(pc, 1), ir, round(pr, 1), 'conseil' if pc < pr else 'R1'])

    # 6.6 gammes sans page conseil (absentes de __blog_advice, data/conseil_cta_indexable.csv) dont la requête nue a des impressions R1
    with open(os.path.join(DATA, 'conseil_cta_indexable.csv'), encoding='utf-8') as f:
        adv = {r['ba_pg_id'] for r in csv.DictReader(f)}
    with open(os.path.join(OUT, 'sans_conseil_nue.csv'), 'w', newline='') as f:
        w = csv.writer(f); w.writerow(['pg_id', 'pg_alias', 'imp_nue_r1', 'clics_nue_r1', 'conseil_publie', 'indexable'])
        for pid, (i, c) in sorted(nue_r1.items(), key=lambda kv: -kv[1][0]):
            g = gammes[pid]
            idx = int(g.get('pg_display') == '1' and g.get('pg_relfollow') == '1' and g.get('pg_level') == '1')
            w.writerow([pid, g['pg_alias'], i, c, int(str(pid) in adv), idx])

    print('lignes', len(rows), 'gammes R1', len(r1_g), 'gammes conseil', len(co_g), 'gammes double', len(both), 'duels', len(duel), 'couples top10', len(top))
    print('vocab marques', len(MARQUES), 'modeles', len(MODELES), 'equip', len(EQUIP))


if __name__ == '__main__':
    sys.exit(main())
