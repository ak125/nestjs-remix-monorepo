#!/usr/bin/env python3
"""Mandat DM — constat hors périmètre : pages R2 vues par Google (grain page, __seo_gsc_daily_page_totals, sql/03)
dans ou hors du sitemap pièces servi (sitemap-pieces-1..3.xml, GET PROD 2026-11-19 12:39:56–12:39:59Z).
Sortie : donnees/couverture_sitemap_r2.tsv. Usage : python3 -I scripts/couverture_sitemap_r2.py <dossier dm>"""
import csv, sys
from pathlib import Path
D = Path(sys.argv[1]) / "donnees"
sm = {l.strip() for l in open(D / "sitemap_pieces_servi_paths.txt") if l.strip()}
out = []
for win in ("90j", "28j"):
    for band, ok in (("tous rangs", lambda p: True), ("rang page 4-15", lambda p: 4 <= p <= 15)):
        a = {"dans sitemap": [0, 0, 0], "hors sitemap": [0, 0, 0]}
        for r in csv.DictReader(open(D / "grain_page_r2_r8.tsv"), delimiter="\t"):
            if r["win"] != win or r["role"] != "R2" or not ok(float(r["pos_page"])):
                continue
            k = "dans sitemap" if r["path"] in sm else "hors sitemap"
            a[k][0] += 1; a[k][1] += int(r["impr_page"]); a[k][2] += int(r["clics_page"])
        for k, (n, i, c) in a.items():
            out.append([win, band, k, n, i, c, f"{100*c/i:.2f}" if i else ""])
with open(D / "couverture_sitemap_r2.tsv", "w", newline="") as f:
    w = csv.writer(f, delimiter="\t"); w.writerow(["fenetre", "rangs", "sitemap_servi", "pages", "impr", "clics", "ctr_pct"]); w.writerows(out)
print("urls sitemap pièces servies:", len(sm))
for r in out: print(*r, sep="\t")
