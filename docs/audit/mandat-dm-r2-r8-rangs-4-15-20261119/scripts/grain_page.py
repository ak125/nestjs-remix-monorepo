#!/usr/bin/env python3
"""Mandat DM — complément au grain page (totaux Search Console par page, non anonymisés).

Entrées : donnees/grain_page_r2_r8.tsv (sql/03), donnees/courbe_ctr_page_brut.tsv (sql/04),
          donnees/rangs_4_15_<fen>.tsv (analyse_rangs.py).
Règles : taux attendu au rang 3 au grain page = courbe isotonique non croissante (rangs 1..20)
sur les lignes jour × page R2+R8 depuis le 2026-06-01 ; clics gagnables page =
impressions_page × max(0, taux rang 3 − taux réel page), pour les pages de rang page 4..15.
Utilisation : python3 -I scripts/grain_page.py <dossier dm>
"""
import csv, json, sys
from collections import defaultdict
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from analyse_rangs import isotonic_decreasing  # noqa: E402

BASE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
DATA = BASE / "donnees"
cur = {int(r["rang"]): r for r in csv.DictReader(open(DATA / "courbe_ctr_page_brut.tsv"), delimiter="\t")}
ranks = list(range(1, 21))
ctr = [int(cur[b]["clics"]) / int(cur[b]["impr"]) for b in ranks]
iso = isotonic_decreasing(ctr, [int(cur[b]["impr"]) for b in ranks])
ctr3 = iso[2]
with open(DATA / "courbe_ctr_page.tsv", "w", newline="") as f:
    wr = csv.writer(f, delimiter="\t"); wr.writerow(["rang", "impr", "clics", "ctr_brut_pct", "ctr_isotonique_pct"])
    for b, c, i in zip(ranks, ctr, iso):
        wr.writerow([b, cur[b]["impr"], cur[b]["clics"], f"{100*c:.3f}", f"{100*i:.3f}"])
pages = defaultdict(dict)
for r in csv.DictReader(open(DATA / "grain_page_r2_r8.tsv"), delimiter="\t"):
    pages[r["win"]][r["path"]] = r
out = {"ctr_rang3_page": ctr3, "fenetres": {}}
for win in ("90j", "28j"):
    P = pages[win]
    band = {p: r for p, r in P.items() if 4 <= float(r["pos_page"]) <= 15}
    def g(r):
        im, ck = int(r["impr_page"]), int(r["clics_page"])
        return im * max(0.0, ctr3 - ck / im)
    stat = {}
    for role in ("R2", "R8"):
        allp = [r for r in P.values() if r["role"] == role]
        b = [r for r in band.values() if r["role"] == role]
        stat[role] = {"pages_avec_impr": len(allp), "impr": sum(int(r["impr_page"]) for r in allp),
                      "clics": sum(int(r["clics_page"]) for r in allp),
                      "pages_rang_page_4_15": len(b), "impr_4_15": sum(int(r["impr_page"]) for r in b),
                      "clics_4_15": sum(int(r["clics_page"]) for r in b),
                      "clics_gagnables_page_4_15": round(sum(g(r) for r in b), 1)}
    # pages de la liste retenue (grain requête) avec leurs totaux page
    lst = list(csv.DictReader(open(DATA / f"rangs_4_15_{win}.tsv"), delimiter="\t"))
    seen = {}
    for o in lst:
        p = o["path"]
        if p in seen:
            seen[p]["gain_req"] += float(o["clics_gagnables"]); seen[p]["n"] += 1
            continue
        r = P.get(p)
        seen[p] = {"role": o["role"], "path": p, "n": 1, "gain_req": float(o["clics_gagnables"]),
                   "impr_page": r["impr_page"] if r else "", "clics_page": r["clics_page"] if r else "",
                   "pos_page": r["pos_page"] if r else "", "gain_page": f"{g(r):.2f}" if r and 4 <= float(r['pos_page']) <= 15 else ""}
    rows = sorted(seen.values(), key=lambda s: -s["gain_req"])
    with open(DATA / f"pages_liste_grain_page_{win}.tsv", "w", newline="") as f:
        wr = csv.writer(f, delimiter="\t")
        wr.writerow(["role", "path", "couples_retenus", "clics_gagnables_req", "impr_page", "clics_page", "pos_page", "clics_gagnables_page"])
        for s in rows:
            wr.writerow([s["role"], s["path"], s["n"], f"{s['gain_req']:.2f}", s["impr_page"], s["clics_page"], s["pos_page"], s["gain_page"]])
    for role in ("R2", "R8"):
        rr = [s for s in rows if s["role"] == role]
        stat[role]["liste_pages"] = len(rr)
        stat[role]["liste_impr_page"] = sum(int(s["impr_page"] or 0) for s in rr)
        stat[role]["liste_clics_page"] = sum(int(s["clics_page"] or 0) for s in rr)
        stat[role]["liste_gain_page"] = round(sum(float(s["gain_page"] or 0) for s in rr), 1)
    out["fenetres"][win] = stat
json.dump(out, open(DATA / "resume_grain_page.json", "w"), ensure_ascii=False, indent=1)
print(json.dumps(out, ensure_ascii=False, indent=1))
