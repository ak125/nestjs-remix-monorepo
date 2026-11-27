"""Mandat EN — sélection déterministe des 60 exemples (stdlib seule).
Usage : python3 -I 11-exemples-60.py <h1-r2-toutes-pages.tsv.gz> <sortie.tsv>
Imposés : Mini Paceman 53236 / 58881 / 58868 (gamme 402) ; 74085/74086/74087
ajoutés à la main dans le README (hors sitemap ou non affiché).
Puis : 14 cas de niveau 1 (puissance requise), 8 de niveau 2, le reste de
niveau 0, une gamme et une marque différentes autant que possible, pages
indexables d'abord, ordre stable par hash md5 de l'URL."""
import csv, gzip, hashlib, sys
src, out = sys.argv[1], sys.argv[2]
rows = list(csv.DictReader(gzip.open(src, 'rt', encoding='utf-8'), delimiter='\t'))
key = lambda r: (r['indexable'] != 't', hashlib.md5(r['url'].encode()).hexdigest())
rows.sort(key=key)
pick, seen = [], set()
for r in rows:
    if r['pg_id'] == '402' and r['type_id'] in ('53236', '58881', '58868'):
        pick.append(r); seen.add(r['url'])
def take(level, n):
    gam, mar = {p['gamme'] for p in pick}, {p['marque'] for p in pick}
    got = 0
    for strict in (True, False):
        for r in rows:
            if got >= n: return
            if r['niveau'] != level or r['url'] in seen: continue
            if strict and (r['gamme'] in gam or r['marque'] in mar): continue
            pick.append(r); seen.add(r['url']); gam.add(r['gamme']); mar.add(r['marque']); got += 1
take('1', 14); take('2', 8); take('0', 60 - len(pick) - 0)
w = csv.writer(open(out, 'w', encoding='utf-8', newline=''), delimiter='\t', lineterminator='\n')
w.writerow(['page', 'indexable', 'niveau', 'h1_actuel', 'titre_2212', 'h1_propose'])
for r in pick:
    w.writerow([r['url'], r['indexable'], r['niveau'], r['h1_actuel_reproduit'], r['titre_2212'], r['h1_propose']])
print(len(pick), 'exemples ;', 'gammes', len({p['gamme'] for p in pick}), 'marques', len({p['marque'] for p in pick}),
      'niveaux', {l: sum(p['niveau'] == l for p in pick) for l in '012'})
