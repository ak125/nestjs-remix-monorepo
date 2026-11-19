#!/usr/bin/env python3
"""Mandat DM 6.2/6.4 — jointure : règle sitemap rejouée (sql/10) × sitemap pièces servi (GET PROD 12:39Z)
× présence GSC (grain page 90 j : data/grain_page_r2_r8.tsv ; grain requête 90 j : data/couples_r2_r8_brut.tsv).
Clé de jointure = (pg_id, type_id) lus dans l'URL. L'état d'index par URL (« Explorée, non indexée ») n'est pas en base.
Robots estimé = règle legacy r2-indexability.ts (count >= 2 → index) avec map_has_item comme approximation de count :
c'est une estimation, pas le robots servi.
Usage : python3 -I scripts/soeurs_6_4.py <dossier dm>"""
import csv, re, sys
from collections import defaultdict, Counter
from pathlib import Path
B = Path(sys.argv[1]); D = B / "data"
RX = re.compile(r"^/pieces/[^/]*-(\d+)/[^/]*/[^/]*-(\d+)/[^/]*-(\d+)\.html$")
def key(p):
    m = RX.match(p); return (int(m.group(1)), int(m.group(3))) if m else None
served = {key(l.strip()) for l in open(D / "sitemap_pieces_servi_paths.txt") if key(l.strip())}
gp = {}
for r in csv.DictReader(open(D / "grain_page_r2_r8.tsv"), delimiter="\t"):
    if r["win"] == "90j" and r["role"] == "R2" and key(r["path"]):
        gp[key(r["path"])] = (int(r["impr_page"]), int(r["clics_page"]), r["pos_page"])
gq = set()
for r in csv.DictReader(open(D / "couples_r2_r8_brut.tsv"), delimiter="\t"):
    if r["win"] == "90j" and r["role"] == "R2" and key(r["path"]):
        gq.add(key(r["path"]))
rows = list(csv.DictReader(open(D / "soeurs_r2_brut.tsv"), delimiter="\t"))
out = []
for r in rows:
    pg = int(r["map_pg_id"] or r["seed_pg"]); ty = int(r["map_type_id"] or r["seed_type"]); k = (pg, ty)
    mh = int(r["map_has_item"]) if r["map_has_item"] else None
    o = dict(r, sitemap_servi="oui" if k in served else "non",
             gsc_page_90j_impr=gp.get(k, (0, 0, ""))[0], gsc_page_90j_clics=gp.get(k, (0, 0, ""))[1],
             gsc_page_90j_pos=gp.get(k, (0, 0, ""))[2], gsc_requete_90j="oui" if k in gq else "non",
             robots_estime=("" if mh is None else ("index (estimé)" if mh >= 2 else "noindex (estimé)")))
    out.append(o)
cols = list(rows[0].keys()) + ["sitemap_servi", "gsc_page_90j_impr", "gsc_page_90j_clics", "gsc_page_90j_pos", "gsc_requete_90j", "robots_estime"]
with open(D / "soeurs_r2_6_4.tsv", "w", newline="") as f:
    w = csv.DictWriter(f, cols, delimiter="\t"); w.writeheader(); w.writerows(out)
# contrôle règle rejouée vs servi (self)
c = Counter((o["regle_sitemap"], o["sitemap_servi"]) for o in out if o["kind"] == "self")
print("self regle×servi:", dict(c))
for kind in ("meme_gamme_meme_modele", "meme_type_autre_gamme"):
    l = [o for o in out if o["kind"] == kind]
    print(kind, "n=", len(l),
          "| sitemap servi:", sum(o["sitemap_servi"] == "oui" for o in l),
          "| règle:", sum(o["regle_sitemap"] == "t" for o in l),
          "| absentes GSC page 90j:", sum(o["gsc_page_90j_impr"] == 0 for o in l),
          "| absentes GSC & hors sitemap:", sum(o["gsc_page_90j_impr"] == 0 and o["sitemap_servi"] == "non" for o in l),
          "| absentes GSC & dans sitemap:", sum(o["gsc_page_90j_impr"] == 0 and o["sitemap_servi"] == "oui" for o in l),
          "| map_has_item<=20:", sum(int(o["map_has_item"]) <= 20 for o in l),
          "| robots noindex estimé:", sum(o["robots_estime"].startswith("noindex") for o in l))
    # impressions page des soeurs selon sitemap
    for s in ("oui", "non"):
        ll = [o for o in l if o["sitemap_servi"] == s]
        if ll:
            print(f"   sitemap={s}: n={len(ll)} part avec impressions={100*sum(o['gsc_page_90j_impr']>0 for o in ll)/len(ll):.0f}% impr moy={sum(o['gsc_page_90j_impr'] for o in ll)/len(ll):.1f} clics={sum(o['gsc_page_90j_clics'] for o in ll)}")
