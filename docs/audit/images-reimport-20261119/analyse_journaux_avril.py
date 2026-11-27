#!/usr/bin/env python3
"""Analyse en lecture seule d'un journal de scripts/recover-tecdoc-images.py (avril 2026).

Usage : python3 -I analyse_journaux_avril.py <journal.log> > sortie.csv
Ne lit que le fichier passé en argument ; aucune écriture hors stdout.

Pour chaque dossier (DLNR) : images manquantes annoncées, articles cherchés,
récupérées / échouées selon le script, puis la décomposition réelle des échecs :
- recherche_en_erreur : la recherche a levé une exception (souvent
  « Locator.clear: Timeout »), le script l'a avalée et a compté les images
  comme « introuvables » ;
- article_sans_image : la recherche a abouti sans aucune image pour ce DLNR ;
- nom_sans_correspondance : TecDoc a renvoyé des images pour l'article, mais
  aucun fileName n'est égal au pmi_name attendu ;
- envoi_refuse : téléversement refusé par le stockage.
"""
import csv
import re
import sys
from collections import OrderedDict, Counter

RX_DLNR = re.compile(r"=== Recovery DLNR (\S+) ===")
RX_MISSING = re.compile(r"Missing images: (\d+)")
RX_AFTER = re.compile(r"After filtering already recovered: (\d+)")
RX_UNIQUE = re.compile(r"Unique articles to search: (\d+)")
RX_SEARCH = re.compile(r"\[(\d+)/(\d+)\] Searching ARTNR: (.*) \((\d+) images\)\.\.\.$")
RX_SEARCH_ERR = re.compile(r"Search error for ")
RX_NOCDN = re.compile(r"No CDN images found for ARTNR ")
RX_NOMATCH = re.compile(r"No match for (.*) in API response")
RX_OK = re.compile(r"    OK: ")
RX_UPERR = re.compile(r"Upload error ")
RX_DONE = re.compile(r"DONE DLNR (\S+): recovered=(\d+), failed=(\d+)")
RX_LOGIN_FAIL = re.compile(r"Login failed")
RX_TS = re.compile(r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})")


def main(path):
    stats = OrderedDict()
    cur = None
    pending_imgs = 0
    pending_err = False
    ext_nomatch = Counter()
    with open(path, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            m = RX_DLNR.search(line)
            if m:
                cur = stats.setdefault(m.group(1), Counter())
                ts = RX_TS.match(line)
                cur["_debut"] = ts.group(1) if ts else ""
                continue
            if cur is None:
                continue
            for rx, key in ((RX_MISSING, "manquantes"), (RX_AFTER, "apres_reprise"), (RX_UNIQUE, "articles")):
                m = rx.search(line)
                if m:
                    cur[key] = int(m.group(1))
            m = RX_SEARCH.search(line)
            if m:
                pending_imgs = int(m.group(4))
                pending_err = False
                cur["articles_cherches"] += 1
                continue
            if RX_SEARCH_ERR.search(line):
                pending_err = True
                cur["recherches_en_erreur"] += 1
                continue
            if RX_NOCDN.search(line):
                if pending_err:
                    cur["images_recherche_en_erreur"] += pending_imgs
                else:
                    cur["images_article_sans_image"] += pending_imgs
                continue
            m = RX_NOMATCH.search(line)
            if m:
                cur["images_nom_sans_correspondance"] += 1
                name = m.group(1)
                ext = name.rsplit(".", 1)[-1].lower() if "." in name else "(aucune)"
                ext_nomatch[ext] += 1
                continue
            if RX_OK.search(line):
                cur["ok"] += 1
                continue
            if RX_UPERR.search(line):
                cur["envois_refuses"] += 1
                continue
            if RX_LOGIN_FAIL.search(line):
                cur["connexion_refusee"] += 1
                continue
            m = RX_DONE.search(line)
            if m:
                cur["recuperees"] = int(m.group(2))
                cur["echouees"] = int(m.group(3))
                ts = RX_TS.match(line)
                cur["_fin"] = ts.group(1) if ts else ""

    cols = ["dlnr", "debut", "fin", "manquantes", "articles", "articles_cherches",
            "recuperees", "echouees", "recherches_en_erreur", "images_recherche_en_erreur",
            "images_article_sans_image", "images_nom_sans_correspondance", "envois_refuses",
            "taux_reussite_pct"]
    w = csv.writer(sys.stdout)
    w.writerow(cols)
    tot = Counter()
    for dlnr, c in stats.items():
        att = c["recuperees"] + c["echouees"]
        taux = round(100.0 * c["recuperees"] / att, 1) if att else ""
        w.writerow([dlnr, c["_debut"], c["_fin"], c["manquantes"], c["articles"], c["articles_cherches"],
                    c["recuperees"], c["echouees"], c["recherches_en_erreur"], c["images_recherche_en_erreur"],
                    c["images_article_sans_image"], c["images_nom_sans_correspondance"], c["envois_refuses"], taux])
        for k in cols[3:13]:
            tot[k] += c[k.replace("dlnr", "")] if k in c else 0
    att = tot["recuperees"] + tot["echouees"]
    w.writerow(["TOTAL", "", ""] + [tot[k] for k in cols[3:13]] + [round(100.0 * tot["recuperees"] / att, 1) if att else ""])
    extensions = ", ".join(f"{k}={v}" for k, v in ext_nomatch.most_common())
    print("# extensions des noms sans correspondance : " + extensions, file=sys.stderr)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: analyse_journaux_avril.py <journal.log>")
    main(sys.argv[1])
