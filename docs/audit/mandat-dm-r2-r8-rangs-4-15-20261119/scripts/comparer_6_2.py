#!/usr/bin/env python3
"""Mandat DM 6.2 — comparaison gagnantes (G) / stagnantes (S).
Entrées : data/releve_prod_pages.tsv, data/soeurs_r2_6_4.tsv (kind=self), data/sitemap_pieces_servi_paths.txt,
          data/lien_r8_vers_r2.tsv, data/echantillon_6_2.tsv.
Règle d'écart (écrite avant lecture des résultats, rejouable) :
  - indicateur numérique : écart retenu si |médiane G − médiane S| >= 25 % de la plus grande médiane
    ET les moyennes vont dans le même sens ; sinon « pas d'écart mesuré » ;
  - indicateur oui/non : écart retenu si la différence de part est >= 20 points ;
  - n = 20 + 20 (R2) et 5 + 10 (R8) : un écart retenu est une piste, pas une preuve de cause.
Sortie : data/comparaison_6_2.tsv ; colonnes ajoutées à data/releve_prod_pages_complet.tsv."""
import csv, statistics, sys, re
from pathlib import Path
B = Path(sys.argv[1]); D = B / "data"
pages = list(csv.DictReader(open(D / "releve_prod_pages.tsv"), delimiter="\t"))
served = {l.strip() for l in open(D / "sitemap_pieces_servi_paths.txt")}
RX = re.compile(r"^/pieces/[^/]*-(\d+)/[^/]*/[^/]*-(\d+)/[^/]*-(\d+)\.html$")
mh = {}
for r in csv.DictReader(open(D / "soeurs_r2_6_4.tsv"), delimiter="\t"):
    if r["kind"] == "self":
        mh[(r["seed_pg"], r["seed_type"])] = r["map_has_item"]
l8 = {r["path"]: r for r in csv.DictReader(open(D / "lien_r8_vers_r2.tsv"), delimiter="\t")}
ech = {r["path"]: r for r in csv.DictReader(open(D / "echantillon_6_2.tsv"), delimiter="\t")}
for p in pages:
    m = RX.match(p["path"])
    p["sitemap_servi"] = ("oui" if p["path"] in served else "non") if p["role"] == "R2" else "non (sitemap-vehicules.xml 302→/404)"
    p["map_has_item"] = mh.get((m.group(1), m.group(3)), "") if m else ""
    p["dans_sitemap_p_link"] = ("oui" if p["map_has_item"] != "" else "non") if m else ""
    r = l8.get(p["path"])
    p["gamme_dans_catalogue_r8_cache"] = ("oui" if r["gamme_dans_catalogue_r8"] == "t" else "non") if r else ""
    p["rang_dans_famille_r8"] = r["rang_dans_famille"] if r else ""
    e = ech.get(p["path"])
    p["impr_page_90j"] = e["impr_page_90j"] if e else ""
    p["pos_page_90j"] = e["pos_page_90j"] if e else ""
cols = list(pages[0].keys())
with open(D / "releve_prod_pages_complet.tsv", "w", newline="") as f:
    w = csv.DictWriter(f, cols, delimiter="\t"); w.writeheader(); w.writerows(pages)
num = ["pieces_listees", "ld_product", "prix_affiches", "dispo_texte", "img_total", "img_piece", "mots_visibles",
       "mots_propres", "part_commune_pct", "liens_sortants_r2", "map_has_item", "impr_page_90j", "pos_page_90j"]
yes = [("sitemap_servi", "oui"), ("lien_depuis_r1", "oui"), ("robots_meta", "index, follow"), ("canonical_self", "oui"),
       ("dans_sitemap_p_link", "oui"), ("gamme_dans_catalogue_r8_cache", "oui")]
out = []
for role in ("R2", "R8"):
    g = [p for p in pages if p["role"] == role and "G" in p["groupes"].split(",")]
    s = [p for p in pages if p["role"] == role and "S" in p["groupes"].split(",")]
    for c in num:
        vg = [float(p[c]) for p in g if p[c] not in ("", None)]; vs = [float(p[c]) for p in s if p[c] not in ("", None)]
        if not vg or not vs:
            continue
        mg, ms = statistics.median(vg), statistics.median(vs); ag, as_ = statistics.mean(vg), statistics.mean(vs)
        big = max(abs(mg), abs(ms)) or 1
        ecart = abs(mg - ms) >= 0.25 * big and (mg - ms) * (ag - as_) > 0
        out.append([role, c, len(vg), f"{mg:g}", f"{ag:.1f}", len(vs), f"{ms:g}", f"{as_:.1f}", "écart" if ecart else "pas d'écart mesuré"])
    for c, v in yes:
        vg = [p for p in g if p[c] != ""]; vs = [p for p in s if p[c] != ""]
        if not vg or not vs:
            continue
        pg_ = 100 * sum(p[c] == v for p in vg) / len(vg); ps = 100 * sum(p[c] == v for p in vs) / len(vs)
        out.append([role, f"{c}={v} (%)", len(vg), f"{pg_:.0f}", "", len(vs), f"{ps:.0f}", "", "écart" if abs(pg_ - ps) >= 20 else "pas d'écart mesuré"])
with open(D / "comparaison_6_2.tsv", "w", newline="") as f:
    w = csv.writer(f, delimiter="\t")
    w.writerow(["role", "indicateur", "n_G", "mediane_ou_part_G", "moyenne_G", "n_S", "mediane_ou_part_S", "moyenne_S", "verdict"])
    w.writerows(out)
for r in out: print("\t".join(map(str, r)))
