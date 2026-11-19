#!/usr/bin/env python3
"""Mandat DM 6.5 — pages perdues AK (#2087, reconstituées par sql/11) × liste 6.1.
Classes (exclusives, dans l'ordre) :
  A « dans la liste 6.1 (couples) »     : la page porte au moins un couple retenu 90 j (data/rangs_4_15_90j.tsv) ;
  B « rang 4–15 au grain page »         : position page 90 j pondérée entre 4 et 15 (data/grain_page_r2_r8.tsv) ;
  C « rang 1–3 au grain page »          ;
  D « au-delà du rang 15 »              ;
  E « sortie : aucune impression 90 j » : absente du grain page sur 2026-08-19 → 2026-11-16.
Ajouts : présence au sitemap pièces servi (GET 12:39Z), clics 90 j.
Usage : python3 -I scripts/croisement_ak_6_5.py <dossier dm>"""
import csv, sys
from collections import Counter, defaultdict
from pathlib import Path
B = Path(sys.argv[1]); D = B / "data"
lost = list(csv.DictReader(open(D / "pages_perdues_ak_reconstituees.tsv"), delimiter="\t"))
l61 = defaultdict(list)
for r in csv.DictReader(open(D / "rangs_4_15_90j.tsv"), delimiter="\t"):
    l61[r["path"]].append(r)
gp = {r["path"]: r for r in csv.DictReader(open(D / "grain_page_r2_r8.tsv"), delimiter="\t") if r["win"] == "90j"}
served = {l.strip() for l in open(D / "sitemap_pieces_servi_paths.txt")}
out, cnt = [], Counter()
for r in lost:
    p = r["path"]; g = gp.get(p)
    if p in l61: cls = "A dans la liste 6.1 (couples)"
    elif g is None: cls = "E sortie : aucune impression 90 j"
    else:
        pos = float(g["pos_page"])
        cls = "C rang 1-3 (grain page)" if pos < 4 else ("B rang 4-15 (grain page)" if pos <= 15 else "D au-dela du rang 15 (grain page)")
    sm = "oui" if p in served else "non"
    cnt[(cls, sm)] += 1
    out.append([p, r["c_jul"], r["i_jul"], r["i_oct"], cls, g["impr_page"] if g else 0, g["clics_page"] if g else 0,
                g["pos_page"] if g else "", sm, len(l61.get(p, [])), "; ".join(x["query"] for x in l61.get(p, []))])
with open(D / "croisement_ak_6_1.tsv", "w", newline="") as f:
    w = csv.writer(f, delimiter="\t")
    w.writerow(["path", "clics_juil", "impr_juil", "impr_oct", "classe", "impr_page_90j", "clics_page_90j", "pos_page_90j",
                "sitemap_pieces_servi", "couples_6_1", "requetes_6_1"]); w.writerows(out)
tot = Counter(); clk = Counter()
for o in out:
    tot[o[4]] += 1; clk[o[4]] += int(o[6])
for k in sorted(tot):
    print(f"{k}\t{tot[k]}\tclics90j={clk[k]}\tsitemap oui={cnt[(k,'oui')]} non={cnt[(k,'non')]}")
print("total", len(out), "| sitemap servi oui", sum(o[8]=='oui' for o in out))
