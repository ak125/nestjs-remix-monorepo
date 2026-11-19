#!/usr/bin/env python3
"""Mandat DG 6.4 — relevé de ce que servent 15 pages conseil et leurs 15 pages R1 (PROD).

Entrée : un dossier de fichiers HTML récupérés par simple GET (voir README, commande curl,
1 requête/s) et la liste `liste.txt` (« groupe alias pg_id » par ligne).
Sortie (CSV, dans le dossier `out/` passé en 3e argument) :
  pages_prod_entetes.csv : title, H1, meta description, robots, canonical, types JSON-LD,
                           sélecteur véhicule présent.
  pages_prod_liens.csv   : chaque lien utile (conseil → R1/R2/conseil, R1 → conseil),
                           rang dans la page, part du texte visible lue avant le lien,
                           libellé, data-link-type, classe.

Limite : le pli mobile ne se déduit pas du HTML (images, CSS, polices). La colonne
`texte_avant_pct` (part du texte visible placée avant le lien) en est un indicateur, pas
une mesure. Stdlib seule ; à lancer avec `python3 -I`.
"""
import csv
import json
import os
import re
import sys
from html.parser import HTMLParser

BASE = "https://www.automecanik.com"
R1 = re.compile(r"^/pieces/([a-z0-9-]+)-(\d+)\.html$")
R2 = re.compile(r"^/pieces/[^/]+/[^/]+/[^/]+/[^/]+\.html$")
CONSEIL = re.compile(r"^/blog-pieces-auto/conseils/([a-z0-9-]+)/?$")
GUIDE = re.compile(r"^/blog-pieces-auto/guide-achat/")
SELECTEUR = ("Sélectionner la marque", "S&eacute;lectionner la marque", "Sélectionner la marque")


class P(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.h1 = []
        self.meta = {}
        self.canonical = ""
        self.jsonld = []
        self.links = []
        self.text_len = 0
        self._in = []  # pile : 'title', 'h1', 'a', 'ldjson', 'skip'
        self._a = None
        self._buf = ""
        self.selecteur = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "select" and (a.get("aria-label") or "") in SELECTEUR:
            self.selecteur = True
        if tag == "meta":
            k = (a.get("name") or a.get("property") or "").lower()
            if k in ("description", "robots", "og:title"):
                self.meta[k] = a.get("content") or ""
        elif tag == "link" and (a.get("rel") or "").lower() == "canonical":
            self.canonical = a.get("href") or ""
        elif tag == "title":
            self._in.append("title")
        elif tag == "h1":
            self._in.append("h1")
            self.h1.append("")
        elif tag == "script":
            self._in.append("ldjson" if (a.get("type") or "") == "application/ld+json" else "skip")
            self._buf = ""
        elif tag == "style":
            self._in.append("skip")
        elif tag == "a":
            href = a.get("href") or ""
            if href.startswith(BASE):
                href = href[len(BASE):]
            href = href.split("#")[0].split("?")[0]
            self._a = {
                "href": href,
                "rang": len(self.links) + 1,
                "texte_avant": self.text_len,
                "libelle": "",
                "data_link_type": a.get("data-link-type") or "",
                "classe": (a.get("class") or "")[:80],
            }

    def handle_endtag(self, tag):
        if tag in ("title", "h1", "script", "style") and self._in:
            k = self._in.pop()
            if k == "ldjson":
                try:
                    self.jsonld.append(json.loads(self._buf))
                except ValueError:
                    self.jsonld.append({"@type": "JSON-LD illisible"})
        elif tag == "a" and self._a is not None:
            self._a["libelle"] = re.sub(r"\s+", " ", self._a["libelle"]).strip()[:90]
            self.links.append(self._a)
            self._a = None

    def handle_data(self, data):
        if self._in and self._in[-1] == "ldjson":
            self._buf += data
            return
        if self._in and self._in[-1] == "skip":
            return
        if self._in and self._in[-1] == "title":
            self.title += data
        if self._in and "h1" in self._in:
            self.h1[-1] += data
        if self._a is not None:
            self._a["libelle"] += data
        self.text_len += len(data.strip())


def types_ld(objs):
    out = []

    def walk(o):
        if isinstance(o, dict):
            t = o.get("@type")
            if t:
                out.extend(t if isinstance(t, list) else [t])
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    walk(objs)
    return sorted(set(map(str, out)))


def main(html_dir, liste, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    ent, lks = [], []
    for line in open(liste, encoding="utf-8"):
        if not line.strip():
            continue
        groupe, alias, pg_id = line.split()
        for ptype, path in (
            ("conseil", f"/blog-pieces-auto/conseils/{alias}"),
            ("R1", f"/pieces/{alias}-{pg_id}.html"),
        ):
            fn = os.path.join(html_dir, path.lstrip("/").replace("/", "_") + ".html")
            if not os.path.exists(fn):  # page non récupérée (budget de 60 GET) : ignorée
                continue
            p = P()
            p.feed(open(fn, encoding="utf-8", errors="replace").read())
            total = max(p.text_len, 1)
            r1_meme = f"/pieces/{alias}-{pg_id}.html"
            n = {"r1_meme": 0, "r1_autre": 0, "r2": 0, "conseil_meme": 0, "conseil_autre": 0, "guide_achat": 0}
            for l in p.links:
                h = l["href"]
                if h == r1_meme:
                    cible = "R1_meme_gamme"
                    n["r1_meme"] += 1
                elif R1.match(h):
                    cible = "R1_autre_gamme"
                    n["r1_autre"] += 1
                elif R2.match(h):
                    cible = "R2"
                    n["r2"] += 1
                elif CONSEIL.match(h):
                    m = CONSEIL.match(h).group(1)
                    cible = "conseil_meme_gamme" if m == alias else "conseil_autre"
                    n["conseil_meme" if m == alias else "conseil_autre"] += 1
                elif GUIDE.match(h):
                    cible = "guide_achat"
                    n["guide_achat"] += 1
                else:
                    continue
                if ptype == "conseil" or cible.startswith("conseil"):
                    lks.append({
                        "groupe": groupe, "alias": alias, "page_type": ptype, "cible": cible,
                        "href": h, "rang_lien": l["rang"], "liens_total": len(p.links),
                        "texte_avant_pct": round(100 * l["texte_avant"] / total, 1),
                        "libelle": l["libelle"], "data_link_type": l["data_link_type"],
                        "classe": l["classe"],
                    })
            ent.append({
                "groupe": groupe, "alias": alias, "pg_id": pg_id, "page_type": ptype, "path": path,
                "title": re.sub(r"\s+", " ", p.title).strip(),
                "h1": " | ".join(re.sub(r"\s+", " ", h).strip() for h in p.h1),
                "nb_h1": len(p.h1),
                "meta_description": p.meta.get("description", "")[:200],
                "robots": p.meta.get("robots", ""),
                "canonical": p.canonical,
                "jsonld_types": " ".join(types_ld(p.jsonld)),
                "selecteur_vehicule": int(p.selecteur),
                "liens_total": len(p.links),
                "liens_r1_meme": n["r1_meme"], "liens_r1_autre": n["r1_autre"], "liens_r2": n["r2"],
                "liens_conseil_meme": n["conseil_meme"], "liens_conseil_autre": n["conseil_autre"],
                "liens_guide_achat": n["guide_achat"],
            })
    for name, rows in (("pages_prod_entetes.csv", ent), ("pages_prod_liens.csv", lks)):
        with open(os.path.join(out_dir, name), "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0]))
            w.writeheader()
            w.writerows(rows)
    print(len(ent), "pages,", len(lks), "liens")


if __name__ == "__main__":
    main(*sys.argv[1:4])
