#!/usr/bin/env python3
"""Mandat DG 6.5b — essai sur papier de 3 gabarits title/H1 R1 pour les requêtes d'achat.

RIEN n'est écrit nulle part : le script calcule, pour 10 gammes réelles, le texte que chaque
gabarit produirait, sa longueur, sa conformité à la liste R1_FORBIDDEN_TERMS
(backend/src/modules/seo/utils/seo-field-gate.ts:30) et la couverture des requêtes d'achat
observées (part des impressions « achat » R1 sur 90 j dont tous les mots utiles figurent
dans le title).

Entrées : out/pages_prod_entetes.csv (title/H1 servis, relevé PROD) et
out/requetes_classees.csv (famille par requête). Sortie : out/gabarits_titres_essai.csv.
Stdlib seule ; `python3 -I scripts/tester_gabarits_titres.py <dossier-du-mandat>`.
"""
import csv
import os
import re
import sys
import unicodedata

TITLE_MAX = 60  # seo-title-engine.service.ts:63
BRAND = "AutoMecanik"
R1_FORBIDDEN = ["pas cher", "prix", "meilleur prix", "à partir de", "promo", "en stock",
                "acheter", "commander", "livraison rapide", "garantie",
                "satisfait ou remboursé", "€"]
GAMMES = ["alternateur", "filtre-a-huile", "cardan", "corps-papillon", "volant-moteur",
          "courroie-d-accessoire", "plaquette-de-frein", "catalyseur", "kit-d-embrayage",
          "compresseur-de-climatisation"]
# Mots vides ignorés dans la mesure de couverture. Les mots d'achat (« prix »…) NE SONT PAS
# ignorés : une requête « prix X » n'est couverte que si le title contient « prix ».
VIDES = {"le", "la", "les", "de", "du", "des", "d", "l", "a", "au", "aux", "en", "pour", "un",
         "une", "et", "sur", "ou", "c", "est", "s"}


def norm(s):
    s = unicodedata.normalize("NFKD", s.lower()).encode("ascii", "ignore").decode()
    toks = re.sub(r"[^a-z0-9]+", " ", s).split()
    return [t[:-1] if len(t) > 3 and t[-1] in "sx" else t for t in toks]


IGNORES = set(norm(" ".join(VIDES)))


def gabarits(nom, marques):
    m3 = ", ".join(marques[:3])
    m2 = ", ".join(marques[:2])
    m1 = marques[0] if marques else ""
    out = {}
    if not marques:  # title servi sans marques : gabarits réduits au nom
        return {"G1": (f"{nom} | {BRAND}", nom), "G2": (f"{nom} neuf | {BRAND}", f"{nom} neuf pour votre véhicule"),
                "G3": (f"{nom} : prix et références | {BRAND}", f"{nom} : comparez prix et références compatibles")}
    # G1 — règle R1 inchangée : marques collées au nom (« alternateur bosch… »), sans séparateur.
    t = f"{nom} {m3} | {BRAND}"
    if len(t) > TITLE_MAX:
        t = f"{nom} {m2} & + | {BRAND}"
    if len(t) > TITLE_MAX:
        t = f"{nom} {m1} & + | {BRAND}"
    out["G1"] = (t, f"{nom} {m3} et autres équipementiers")
    # G2 — règle R1 inchangée : qualifiant d'achat non interdit (« neuf »).
    t = f"{nom} neuf | {m3} | {BRAND}"
    if len(t) > TITLE_MAX:
        t = f"{nom} neuf | {m2} & + | {BRAND}"
    if len(t) > TITLE_MAX:
        t = f"{nom} neuf | {BRAND}"
    out["G2"] = (t, f"{nom} neuf pour votre véhicule")
    # G3 — EXIGE de changer R1_FORBIDDEN_TERMS (décision Marwane) : mot « prix ».
    t = f"{nom} : prix et références | {m2} | {BRAND}"
    if len(t) > TITLE_MAX:
        t = f"{nom} : prix et références | {BRAND}"
    out["G3"] = (t, f"{nom} : comparez prix et références compatibles")
    return out


def main(base):
    ent = {}
    for x in csv.DictReader(open(os.path.join(base, "out/pages_prod_entetes.csv"), encoding="utf-8")):
        if x["page_type"] == "R1":
            ent[x["alias"]] = x
    req = [x for x in csv.DictReader(open(os.path.join(base, "out/requetes_classees.csv"), encoding="utf-8"))
           if x["ptype"] == "R1" and x["famille"] == "achat"]
    rows = []
    for alias in GAMMES:
        e = ent[alias]
        parts = [p.strip() for p in e["title"].split("|")]
        nom = parts[0]
        marques = [m.strip() for m in parts[1].replace("& +", "").split(",") if m.strip()] if len(parts) > 2 else []
        if any("référence" in m.lower() for m in marques):
            marques = []  # title servi sans marques (cas filtre-a-huile)
        rq = [x for x in req if x["pg_alias"] == alias]
        imp_tot = sum(int(x["impressions"]) for x in rq)
        top = sorted(rq, key=lambda x: -int(x["impressions"]))[:3]
        for g, (title, h1) in gabarits(nom, marques).items():
            tt = set(norm(title))
            couv = sum(int(x["impressions"]) for x in rq
                       if all(t in tt for t in norm(x["query"]) if t not in IGNORES))
            rows.append({
                "gamme": alias, "gabarit": g, "title_actuel": e["title"], "h1_actuel": e["h1"],
                "title_essai": title, "longueur": len(title), "depasse_60": int(len(title) > TITLE_MAX),
                "terme_interdit_r1": ";".join(f for f in R1_FORBIDDEN if f in title.lower()),
                "h1_essai": h1,
                "imp_achat_r1_90j": imp_tot,
                "imp_achat_couvertes": couv,
                "couverture_pct": round(100 * couv / imp_tot, 1) if imp_tot else "",
                "top3_requetes_achat": " ; ".join(f"{x['query']} ({x['impressions']})" for x in top),
            })
        # Référence : couverture du title servi aujourd'hui.
        tt = set(norm(e["title"]))
        couv = sum(int(x["impressions"]) for x in rq
                   if all(t in tt for t in norm(x["query"]) if t not in IGNORES))
        rows.append({"gamme": alias, "gabarit": "ACTUEL", "title_actuel": e["title"], "h1_actuel": e["h1"],
                     "title_essai": e["title"], "longueur": len(e["title"]),
                     "depasse_60": int(len(e["title"]) > TITLE_MAX),
                     "terme_interdit_r1": "", "h1_essai": e["h1"], "imp_achat_r1_90j": imp_tot,
                     "imp_achat_couvertes": couv,
                     "couverture_pct": round(100 * couv / imp_tot, 1) if imp_tot else "",
                     "top3_requetes_achat": ""})
    with open(os.path.join(base, "out/gabarits_titres_essai.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    print(len(rows), "lignes")


if __name__ == "__main__":
    main(sys.argv[1])
