#!/usr/bin/env python3
"""Mandat DM 6.6 — PROPOSÉ, non appliqué : rendu de gabarits title candidats sur 10 pages réelles par rôle.
Pages = les 10 premières pages R2 et les 10 premières pages R8 distinctes du top 50 (data/rangs_4_15_90j.tsv).
Données : véhicule = data/vehicules_releves.tsv (auto_type/auto_modele/auto_marque, sql/13) ;
prix mini et nombre de pièces = données du chargeur servies (GET PROD 12:34–12:37Z, prod_html/).
Carburant ajouté seulement s'il n'est pas déjà implicite dans le nom du type (règle FUEL_IMPLICITE).
Aucun de ces titres n'est écrit nulle part : décision réservée à Marwane.
Usage : python3 -I scripts/demo_gabarits_6_6.py <dossier dm>"""
import csv, re, sys
from pathlib import Path
B = Path(sys.argv[1]); D = B / "data"; H = B / "prod_html"
veh = {r["type_id"]: r for r in csv.DictReader(open(D / "vehicules_releves.tsv"), delimiter="\t")}
pages = {r["path"]: r for r in csv.DictReader(open(D / "releve_prod_pages.tsv"), delimiter="\t")}
top = list(csv.DictReader(open(D / "rangs_4_15_90j.tsv"), delimiter="\t"))[:50]
FUEL_IMPLICITE = re.compile(r"(?i)\b(essence|diesel|hdi|dci|tdi|cdi|tdci|crdi|jtd|multijet|bluehdi|d|td|dti|sdi|tce|puretech|tsi|tfsi|vti|thp|gpl)\b")
def gamme_name(title, h1):
    return re.split(r" [A-ZÀ-Ý][A-ZÀ-Ý0-9-]+ ", title)[0]
def fuel(v):
    f = v["type_fuel"] or ""
    return "" if (not f or FUEL_IMPLICITE.search(v["type_name"])) else f
def years(v):
    a, b = v["type_year_from"], v["type_year_to"]
    return f"({a}–{b})" if a and b else (f"(depuis {a})" if a else "")
def sp(*xs): return re.sub(r"\s+", " ", " ".join(x for x in xs if x)).strip()
R2 = {
 "R2-A carburant + prix court (après tarifs)": lambda d: sp(d["g"], d["ma"], d["mo"], d["ty"], d["fu"], d["ch"], f"dès {d['px']} €" if d["px"] else ""),
 "R2-B carburant + années, sans prix (avant tarifs)": lambda d: sp(d["g"], d["ma"], d["mo"], d["ty"], d["fu"], d["ch"], d["an"]),
 "R2-C carburant + nombre de références + prix (après tarifs et #2191)": lambda d: sp(d["g"], d["ma"], d["mo"], d["ty"], d["fu"], ":", f"{d['n']} références dès {d['px']} €" if d["n"] and d["px"] else ""),
}
R8 = {
 "R8-A « Pièces détachées » + carburant + puissance": lambda d: sp("Pièces détachées", d["ma"], d["mo"], d["ty"], d["fu"], d["ch"]),
 "R8-B « Pièces » + carburant + puissance + années": lambda d: sp("Pièces", d["ma"], d["mo"], d["ty"], d["fu"], d["ch"], d["an"]),
}
rows, seen = [], {"R2": [], "R8": []}
for r in top:
    if r["path"] in seen[r["role"]] or len(seen[r["role"]]) >= 10: continue
    seen[r["role"]].append(r["path"])
for role, tpls in (("R2", R2), ("R8", R8)):
    for p in seen[role]:
        pg = pages[p]; tid = re.search(r"-(\d+)\.html$", p).group(1); v = veh[tid]
        s = (H / f"{int(pg['n']):03d}.html").read_text(encoding="utf-8", errors="replace")
        px = re.search(r'\\"minPrice\\",(\d+(?:\.\d+)?)', s)
        d = {"g": gamme_name(pg["title"], pg["h1"]) if role == "R2" else "", "ma": v["marque_name"], "mo": v["modele_name"],
             "ty": v["type_name"], "fu": fuel(v), "ch": f"{v['type_power_ps']} ch" if v["type_power_ps"] else "",
             "an": years(v), "px": (f"{float(px.group(1)):.0f}" if px else ""), "n": pg["pieces_listees"]}
        q = [x["query"] for x in top if x["path"] == p]
        for name, f in tpls.items():
            t = f(d)
            rows.append([role, name, p, " | ".join(q), pg["title"], len(pg["title"]), t, len(t), "oui" if len(t) > 60 else "non"])
with open(D / "gabarits_candidats_demo.tsv", "w", newline="") as f:
    w = csv.writer(f, delimiter="\t")
    w.writerow(["role", "gabarit_propose", "path", "requetes_top50", "title_servi", "len_servi", "title_candidat", "len_candidat", "plus_de_60_car"])
    w.writerows(rows)
for r in rows: print(r[1][:5], r[5], r[7], r[6])
