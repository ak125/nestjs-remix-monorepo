#!/usr/bin/env python3
"""Mandat DM — couples R2/R8 classés entre les rangs 4 et 15 sur des requêtes longues.

Entrées (produites par les SQL du dossier sql/, lecture seule) :
  data/couples_r2_r8_brut.tsv   — sql/01_couples_r2_r8.sql
  data/courbe_ctr_brut.tsv      — sql/00_courbe_ctr.sql
Sorties (data/) :
  courbe_ctr.tsv, rangs_4_15_<fen>.tsv (retenus), divergents_<fen>.tsv,
  un_appareil_<fen>.tsv, totaux_<fen>_<axe>.tsv, resume.json

Règles (toutes écrites ici, rejouables) :
  - requête longue = 3 mots ou plus (séparés par des espaces) ;
  - rang = position moyenne pondérée par les impressions, 4 <= rang <= 15 ;
  - divergent = ordinateur ET mobile présents et |pos_ordi - pos_mobile| > 10 → écarté ;
  - un seul appareil (ordinateur OU mobile) et 0 clic → « non vérifiable », écarté ;
  - retenu = le reste (appareils concordants, ou un seul appareil avec clics) ;
  - taux attendu au rang 3 = courbe isotonique (non croissante, pondérée par les
    impressions) ajustée sur les rangs 1..20, portée r2r8_3mots, tous appareils ;
  - clics gagnables = impressions × max(0, taux attendu rang 3 − taux réel).
Utilisation : python3 -I scripts/analyse_rangs.py <dossier dm>
"""
import csv
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

BASE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
DATA = BASE / "data"

MOTOR_RE = re.compile(
    r"(\d[.,]\d|\b\d{2,3}\s?(cv|ch|hp)\b|\b(hdi|dci|tdi|cdi|tce|vti|thp|jtd|jtdm|crdi|tdci|"
    r"tsi|tfsi|gti|dti|d4d|bluehdi|ehdi|multijet|16v|8v|12v|20v|diesel|essence|gpl)\b)",
    re.I,
)


def motif(query: str) -> str:
    q = query.lower().strip()
    if re.match(r"^(r[ée]f[ée]rences?|ref)\b", q):
        return "référence …"
    if re.search(r"\bpi[eè]ces?\b", q):
        return "pièces + modèle"
    if MOTOR_RE.search(q):
        return "pièce + modèle + motorisation"
    return "autre"


def slug(seg: str) -> str:
    return re.sub(r"-\d+(\.html)?$", "", seg)


def axes(role: str, path: str):
    parts = path.strip("/").split("/")
    if role == "R2":  # /pieces/<gamme>/<marque>/<modele>/<type>.html
        return slug(parts[1]), slug(parts[2]), slug(parts[3])
    # R8 : /constructeurs/<marque>/<modele>/<type>.html
    return "(R8 sans gamme)", slug(parts[1]), slug(parts[2])


def num(v):
    return float(v) if v not in ("", None) else None


def isotonic_decreasing(xs, ws):
    """Pool-adjacent-violators, contrainte non croissante. Renvoie une valeur par point."""
    blocks = []  # [valeur, poids, nb]
    for x, w in zip(xs, ws):
        blocks.append([x, w, 1])
        while len(blocks) > 1 and blocks[-2][0] < blocks[-1][0]:
            v2, w2, n2 = blocks.pop()
            v1, w1, n1 = blocks.pop()
            blocks.append([(v1 * w1 + v2 * w2) / (w1 + w2), w1 + w2, n1 + n2])
    out = []
    for v, _, n in blocks:
        out.extend([v] * n)
    return out


def courbe():
    rows = list(csv.DictReader(open(DATA / "courbe_ctr_brut.tsv"), delimiter="\t"))
    res = {}
    lines = []
    for scope in ("r2r8_3mots", "tout_3mots", "tout"):
        for dev in ("tous", "desktop", "mobile"):
            agg = defaultdict(lambda: [0, 0])
            for r in rows:
                if r["scope"] != scope or (dev != "tous" and r["device"] != dev):
                    continue
                b = int(r["rang"])
                agg[b][0] += int(r["impr"])
                agg[b][1] += int(r["clics"])
            ranks = list(range(1, 21))
            ctr = [agg[b][1] / agg[b][0] if agg[b][0] else 0 for b in ranks]
            w = [agg[b][0] for b in ranks]
            iso = isotonic_decreasing(ctr, w)
            res[(scope, dev)] = dict(zip(ranks, iso))
            for b, c, i in zip(ranks, ctr, iso):
                lines.append([scope, dev, b, agg[b][0], agg[b][1], f"{100*c:.3f}", f"{100*i:.3f}"])
    with open(DATA / "courbe_ctr.tsv", "w", newline="") as f:
        wr = csv.writer(f, delimiter="\t")
        wr.writerow(["portee", "appareil", "rang", "impr", "clics", "ctr_brut_pct", "ctr_isotonique_pct"])
        wr.writerows(lines)
    return res


def main():
    cur = courbe()
    ctr3 = cur[("r2r8_3mots", "tous")][3]
    sens = {
        "r2r8_3mots_tous_iso": cur[("r2r8_3mots", "tous")][3],
        "tout_3mots_tous_iso": cur[("tout_3mots", "tous")][3],
        "tout_tous_iso": cur[("tout", "tous")][3],
        "r2r8_3mots_desktop_iso": cur[("r2r8_3mots", "desktop")][3],
        "r2r8_3mots_mobile_iso": cur[("r2r8_3mots", "mobile")][3],
    }
    rows = list(csv.DictReader(open(DATA / "couples_r2_r8_brut.tsv"), delimiter="\t"))
    resume = {"ctr_rang3_reference": ctr3, "sensibilite_ctr_rang3": sens, "fenetres": {}}
    for win in ("90j", "28j", "avr-nov"):
        kept, div, single = [], [], []
        base = [r for r in rows if r["win"] == win]
        long_ = [r for r in base if int(r["n_mots"] or 0) >= 3]
        band = [r for r in long_ if 4 <= float(r["pos"]) <= 15]
        for r in band:
            impr, clk = int(r["impr"]), int(r["clics"])
            pd_, pm = num(r["pos_desk"]), num(r["pos_mob"])
            gamme, marque, modele = axes(r["role"], r["path"])
            ctr = clk / impr if impr else 0
            gain = impr * max(0.0, ctr3 - ctr)
            out = dict(r, gamme=gamme, marque=marque, modele=modele, motif=motif(r["query"]),
                       ctr_pct=f"{100*ctr:.2f}", ecart_app=(f"{abs(pd_-pm):.1f}" if pd_ is not None and pm is not None else ""),
                       clics_gagnables=f"{gain:.2f}")
            if pd_ is not None and pm is not None and abs(pd_ - pm) > 10:
                div.append(out)
            elif (pd_ is None or pm is None) and clk == 0:
                single.append(out)
            else:
                kept.append(out)
        key = lambda o: (-float(o["clics_gagnables"]), -int(o["impr"]))
        cols = ["role", "path", "query", "n_mots", "impr", "clics", "ctr_pct", "pos", "pos_desk", "pos_mob",
                "impr_desk", "impr_mob", "clics_desk", "clics_mob", "ecart_app", "gamme", "marque", "modele",
                "motif", "clics_gagnables"]
        for name, lst in (("rangs_4_15", kept), ("divergents", div), ("un_appareil", single)):
            lst.sort(key=key)
            with open(DATA / f"{name}_{win}.tsv", "w", newline="") as f:
                wr = csv.writer(f, delimiter="\t")
                wr.writerow(["rang_liste"] + cols)
                for i, o in enumerate(lst, 1):
                    wr.writerow([i] + [o[c] for c in cols])
        tot = {}
        for axe in ("gamme", "marque", "motif"):
            agg = defaultdict(lambda: {"R2": [0, 0, 0, 0.0], "R8": [0, 0, 0, 0.0]})
            for o in kept:
                a = agg[o[axe]][o["role"]]
                a[0] += 1; a[1] += int(o["impr"]); a[2] += int(o["clics"]); a[3] += float(o["clics_gagnables"])
            with open(DATA / f"totaux_{win}_{axe}.tsv", "w", newline="") as f:
                wr = csv.writer(f, delimiter="\t")
                wr.writerow([axe, "role", "couples", "impr", "clics", "clics_gagnables"])
                flat = [(k, role, *v) for k, d in agg.items() for role, v in d.items() if v[0]]
                flat.sort(key=lambda t: -t[5])
                for k, role, n, im, ck, g in flat:
                    wr.writerow([k, role, n, im, ck, f"{g:.1f}"])
        def summ(lst, role):
            l = [o for o in lst if o["role"] == role]
            return {"couples": len(l), "pages": len({o["path"] for o in l}),
                    "impr": sum(int(o["impr"]) for o in l), "clics": sum(int(o["clics"]) for o in l),
                    "clics_gagnables": round(sum(float(o["clics_gagnables"]) for o in l), 1)}
        resume["fenetres"][win] = {
            "couples_toutes_requetes": {ro: sum(1 for r in base if r["role"] == ro) for ro in ("R2", "R8")},
            "couples_3mots": {ro: sum(1 for r in long_ if r["role"] == ro) for ro in ("R2", "R8")},
            "couples_3mots_rang_4_15": {ro: sum(1 for r in band if r["role"] == ro) for ro in ("R2", "R8")},
            "retenus": {ro: summ(kept, ro) for ro in ("R2", "R8")},
            "divergents": {ro: summ(div, ro) for ro in ("R2", "R8")},
            "un_appareil_sans_clic": {ro: summ(single, ro) for ro in ("R2", "R8")},
        }
    json.dump(resume, open(DATA / "resume.json", "w"), ensure_ascii=False, indent=1)
    print(json.dumps(resume, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
