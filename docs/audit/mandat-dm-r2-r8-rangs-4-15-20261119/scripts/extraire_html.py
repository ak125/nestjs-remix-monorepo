#!/usr/bin/env python3
"""Mandat DM — extraction des éléments servis par les pages PROD relevées (point 6.2 et 6.3).

Entrées : donnees/get_journal.tsv (scripts/get_prod.sh), prod_html/NNN.html(+.headers),
          donnees/echantillon_6_2.tsv, donnees/rangs_4_15_90j.tsv.
Sortie  : donnees/releve_prod_pages.tsv (une ligne par page R2/R8 relevée),
          donnees/releve_prod_groupes.tsv (moyennes et médianes G vs S).
Règles :
  - texte visible = HTML sans <script>/<style>/<noscript>/<svg>, balises retirées ;
  - part commune = part des 8-grammes de mots de la page présents dans au moins une
    autre page relevée du même rôle ; texte propre = mots des 8-grammes absents ailleurs ;
  - liens entrants observés = nombre de pages relevées (R1 de la gamme, R2, R8) dont le
    HTML contient un lien href vers la page (chemin exact) ; ce n'est pas un graphe complet ;
  - pièces listées = valeur "count" des données du chargeur (R2) sinon numberOfItems JSON-LD ;
  - images = balises <img> ; « pièce » = chemin rack-images ; placeholder = no-image|placeholder.
Utilisation : python3 -I scripts/extraire_html.py <dossier dm>
"""
import csv, html, json, re, statistics, sys
from collections import defaultdict
from pathlib import Path

BASE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
DATA, HT = BASE / "donnees", BASE / "prod_html"
journal = list(csv.DictReader(open(DATA / "get_journal.tsv"), delimiter="\t"))
groupes = defaultdict(set)
for r in csv.DictReader(open(DATA / "echantillon_6_2.tsv"), delimiter="\t"):
    groupes[r["path"]].add(r["groupe"])
top50 = [r for r in csv.DictReader(open(DATA / "rangs_4_15_90j.tsv"), delimiter="\t")][:50]
for r in top50:
    groupes[r["path"]].add("T50")


def txt(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


def visible(s):
    s = re.sub(r"<(script|style|noscript|svg|template)\b.*?</\1>", " ", s, flags=re.S | re.I)
    s = re.sub(r"<head\b.*?</head>", " ", s, flags=re.S | re.I)
    return txt(s)


def first(rx, s, flags=re.S | re.I):
    m = re.search(rx, s, flags)
    return m.group(1) if m else ""


pages = {}
for j in journal:
    p = j["path"]
    if not (p.startswith("/pieces/") or p.startswith("/constructeurs/")) or p.count("/") < 4:
        continue
    f = HT / f"{int(j['n']):03d}.html"
    s = f.read_text(encoding="utf-8", errors="replace")
    hdr = (HT / f"{int(j['n']):03d}.html.headers").read_text(errors="replace")
    role = "R2" if p.startswith("/pieces/") else "R8"
    ld_types = defaultdict(int)
    avail = 0
    for m in re.finditer(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', s, re.S):
        for t in re.findall(r'"@type":"([A-Za-z]+)"', m.group(1)):
            ld_types[t] += 1
        avail += len(re.findall(r'"availability"', m.group(1)))
    vis = visible(s)
    imgs = re.findall(r"<img\b[^>]*>", s)
    count = first(r'\\"count\\",(\d+)', s) or first(r'"numberOfItems":(\d+)', s)
    loader_robots = first(r'\\"robots\\",\\"([^\\]+)\\"', s)
    hrefs = set(re.findall(r'href="(?:https://www\.automecanik\.com)?(/[^"#?]+)"', s))
    canon = first(r'<link rel="canonical" href="([^"]+)"', s)
    pages[p] = {
        "n": j["n"], "heure_utc": j["heure_utc"], "role": role, "groupes": ",".join(sorted(groupes[p])),
        "statut": j["statut"], "path": p,
        "title": txt(first(r"<title>(.*?)</title>", s)),
        "h1": txt(first(r"<h1\b[^>]*>(.*?)</h1>", s)),
        "meta_desc": html.unescape(first(r'<meta name="description" content="([^"]*)"', s)),
        "canonical_self": "oui" if canon.endswith(p) else ("absent" if not canon else "non:" + canon),
        "robots_meta": first(r'<meta name="robots" content="([^"]*)"', s),
        "x_robots": first(r"(?im)^x-robots-tag:\s*(.+?)\s*$", hdr),
        "robots_chargeur": loader_robots,
        "ld_types": ";".join(f"{k}:{v}" for k, v in sorted(ld_types.items())),
        "ld_product": ld_types.get("Product", 0), "ld_offer": ld_types.get("Offer", 0) + ld_types.get("AggregateOffer", 0),
        "ld_faq": ld_types.get("FAQPage", 0), "ld_availability": avail,
        "pieces_listees": count,
        "prix_affiches": len(re.findall(r">\s*€\s*<|\d+[.,]\d{2}\s*€", s)),
        "dispo_texte": len(re.findall(r"(?i)\b(en stock|sur commande|disponible|rupture|indisponible)\b", vis)),
        "img_total": len(imgs), "img_piece": sum("rack-images" in i for i in imgs),
        "img_placeholder": sum(bool(re.search(r"no-image|placeholder|default", i, re.I)) for i in imgs),
        "mots_visibles": len(vis.split()),
        "_vis": vis, "_hrefs": hrefs,
    }

# R1 relevés (pour les liens entrants)
r1 = {}
for j in journal:
    p = j["path"]
    if re.match(r"^/pieces/[^/]+\.html$", p):
        s = (HT / f"{int(j['n']):03d}.html").read_text(encoding="utf-8", errors="replace")
        r1[p] = set(re.findall(r'href="(?:https://www\.automecanik\.com)?(/[^"#?]+)"', s))

# part commune (8-grammes) par rôle
def grams(v, n=8):
    w = re.sub(r"[^\w€]+", " ", v.lower()).split()
    return {" ".join(w[i:i + n]) for i in range(max(0, len(w) - n + 1))}

G = {p: grams(d["_vis"]) for p, d in pages.items()}
for role in ("R2", "R8"):
    ps = [p for p in pages if pages[p]["role"] == role]
    freq = defaultdict(int)
    for p in ps:
        for g in G[p]:
            freq[g] += 1
    for p in ps:
        tot = len(G[p]) or 1
        own = [g for g in G[p] if freq[g] == 1]
        pages[p]["part_commune_pct"] = f"{100 * (1 - len(own) / tot):.1f}"
        pages[p]["mots_propres"] = len(own)  # ~ nombre de 8-grammes propres

for p, d in pages.items():
    gseg = p.split("/")[2] if d["role"] == "R2" else None
    d["lien_depuis_r1"] = ("oui" if p in r1.get(f"/pieces/{gseg}.html", set()) else "non") if gseg and f"/pieces/{gseg}.html" in r1 else ""
    d["liens_entrants_r2_releves"] = sum(1 for q, e in pages.items() if q != p and e["role"] == "R2" and p in e["_hrefs"])
    d["liens_entrants_r8_releves"] = sum(1 for q, e in pages.items() if q != p and e["role"] == "R8" and p in e["_hrefs"])
    d["liens_sortants_r2"] = sum(1 for h in d["_hrefs"] if re.match(r"^/pieces/[^/]+/[^/]+/[^/]+/[^/]+\.html$", h) and h != p)

cols = ["n", "heure_utc", "role", "groupes", "statut", "path", "title", "h1", "meta_desc", "canonical_self",
        "robots_meta", "x_robots", "robots_chargeur", "ld_product", "ld_offer", "ld_faq", "ld_availability",
        "ld_types", "pieces_listees", "prix_affiches", "dispo_texte", "img_total", "img_piece", "img_placeholder",
        "mots_visibles", "mots_propres", "part_commune_pct", "lien_depuis_r1", "liens_entrants_r2_releves",
        "liens_entrants_r8_releves", "liens_sortants_r2"]
with open(DATA / "releve_prod_pages.tsv", "w", newline="") as f:
    wr = csv.writer(f, delimiter="\t")
    wr.writerow(cols)
    for p in sorted(pages, key=lambda q: int(pages[q]["n"])):
        wr.writerow([pages[p][c] for c in cols])

num_cols = ["ld_product", "ld_offer", "ld_faq", "ld_availability", "pieces_listees", "prix_affiches", "dispo_texte",
            "img_total", "img_piece", "img_placeholder", "mots_visibles", "mots_propres", "part_commune_pct",
            "liens_entrants_r2_releves", "liens_entrants_r8_releves", "liens_sortants_r2"]
with open(DATA / "releve_prod_groupes.tsv", "w", newline="") as f:
    wr = csv.writer(f, delimiter="\t")
    wr.writerow(["role", "groupe", "n", "indicateur", "moyenne", "mediane", "min", "max"])
    for role in ("R2", "R8"):
        for gk in ("G", "S"):
            ps = [d for d in pages.values() if d["role"] == role and gk in d["groupes"].split(",")]
            if not ps:
                continue
            for c in num_cols:
                vals = [float(d[c]) for d in ps if str(d[c]) != ""]
                if vals:
                    wr.writerow([role, gk, len(ps), c, f"{statistics.mean(vals):.1f}", f"{statistics.median(vals):.1f}", f"{min(vals):g}", f"{max(vals):g}"])
            for c in ("robots_meta", "canonical_self", "lien_depuis_r1", "statut"):
                cnt = defaultdict(int)
                for d in ps:
                    cnt[d[c] or "(vide)"] += 1
                wr.writerow([role, gk, len(ps), c, json.dumps(cnt, ensure_ascii=False), "", "", ""])
print(len(pages), "pages ;", len(r1), "R1")
