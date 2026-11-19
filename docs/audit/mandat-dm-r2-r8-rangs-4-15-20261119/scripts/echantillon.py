#!/usr/bin/env python3
"""Mandat DM — sélection des échantillons du point 6.2 (règle écrite, rejouable).

Fenêtre : 90 j (couples) ; grain page : data/grain_page_r2_r8.tsv (90j).
Gagnantes (G) : pages ayant au moins un couple (requête de 3 mots ou plus) de position
pondérée <= 5 avec clics > 0 ; tri par clics de ces couples décroissants, puis impressions.
Stagnantes (S) : pages ayant au moins un couple (3 mots ou plus) de position pondérée
8..15, ordinateur ET mobile présents et concordants (écart <= 10), et 0 clic au grain page
sur 90 j ; tri par impressions de ces couples décroissantes.
Quotas : R2 20 + 20, R8 10 + 10. Si une fenêtre ne suffit pas, la fenêtre avr-nov complète
(signalé dans la colonne fenetre).
"""
import csv, sys
from collections import defaultdict
from pathlib import Path
BASE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
DATA = BASE / "data"
rows = list(csv.DictReader(open(DATA / "couples_r2_r8_brut.tsv"), delimiter="\t"))
pg = {}
for r in csv.DictReader(open(DATA / "grain_page_r2_r8.tsv"), delimiter="\t"):
    if r["win"] == "90j":
        pg[r["path"]] = r
def num(v): return float(v) if v else None
def pick(win, role, kind, n, exclude):
    agg = defaultdict(lambda: [0, 0, []])
    for r in rows:
        if r["win"] != win or r["role"] != role or int(r["n_mots"] or 0) < 3:
            continue
        pos, clk, im = float(r["pos"]), int(r["clics"]), int(r["impr"])
        pd_, pm = num(r["pos_desk"]), num(r["pos_mob"])
        if kind == "G" and pos <= 5 and clk > 0:
            a = agg[r["path"]]; a[0] += clk; a[1] += im; a[2].append(r["query"])
        if kind == "S" and 8 <= pos <= 15 and pd_ is not None and pm is not None and abs(pd_ - pm) <= 10:
            p = pg.get(r["path"])
            if p is None or int(p["clics_page"]) == 0:
                if clk == 0:
                    a = agg[r["path"]]; a[0] += clk; a[1] += im; a[2].append(r["query"])
    order = sorted(agg.items(), key=lambda kv: (-kv[1][0], -kv[1][1]))
    return [(p, v) for p, v in order if p not in exclude][:n]
out = []
for role, n in (("R2", 20), ("R8", 10)):
    for kind in ("G", "S"):
        got = pick("90j", role, kind, n, set())
        sel = [(p, v, "90j") for p, v in got]
        if len(sel) < n:
            more = pick("avr-nov", role, kind, n - len(sel), {p for p, _, _ in sel})
            sel += [(p, v, "avr-nov") for p, v in more]
        for p, v, w in sel:
            g = pg.get(p, {})
            out.append([role, kind, w, p, v[0], v[1], " | ".join(v[2][:3]), g.get("impr_page", ""), g.get("clics_page", ""), g.get("pos_page", "")])
with open(DATA / "echantillon_6_2.tsv", "w", newline="") as f:
    wr = csv.writer(f, delimiter="\t")
    wr.writerow(["role", "groupe", "fenetre", "path", "clics_couples", "impr_couples", "requetes", "impr_page_90j", "clics_page_90j", "pos_page_90j"])
    wr.writerows(out)
from collections import Counter
print(Counter((o[0], o[1], o[2]) for o in out))
