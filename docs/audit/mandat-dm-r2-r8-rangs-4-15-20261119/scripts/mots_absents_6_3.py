#!/usr/bin/env python3
"""Mandat DM 6.3 — mots des requêtes du top 50 (data/rangs_4_15_90j.tsv) absents du title et du H1 servis
(data/releve_prod_pages.tsv, GET PROD du 2026-11-19 12:34–12:37Z). Constat seulement, aucun titre proposé.
Normalisation : minuscules, accents retirés, apostrophes et tirets → espace ; « 1,5 » = « 1.5 ».
Mots vides ignorés : MOTS_VIDES ci-dessous. Un mot est « absent » s'il n'apparaît comme mot entier ni dans le
title ni dans le H1 (comparaison séparée title / H1 aussi fournie). Pas de lemmatisation (pièce ≠ pièces est
compté absent : « pieces » vs « piece » sont signalés comme tels).
Usage : python3 -I scripts/mots_absents_6_3.py <dossier dm>"""
import csv, re, sys, unicodedata
from collections import Counter, defaultdict
from pathlib import Path
B = Path(sys.argv[1]); D = B / "data"
MOTS_VIDES = {"de", "a", "pour", "la", "le", "les", "du", "des", "d", "l", "en", "et", "sur", "au", "aux", "un", "une"}
def norm(s):
    s = unicodedata.normalize("NFKD", s.lower()); s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"(\d),(\d)", r"\1.\2", s)
    return re.findall(r"[a-z0-9]+(?:\.[0-9]+)?", s.replace("'", " ").replace("-", " "))
pg = {r["path"]: r for r in csv.DictReader(open(D / "releve_prod_pages.tsv"), delimiter="\t")}
top = list(csv.DictReader(open(D / "rangs_4_15_90j.tsv"), delimiter="\t"))[:50]
rows, freq, freq_w, by_g, by_role = [], Counter(), Counter(), defaultdict(Counter), defaultdict(Counter)
for r in top:
    p = pg[r["path"]]
    t, h = set(norm(p["title"])), set(norm(p["h1"]))
    q = [w for w in norm(r["query"]) if w not in MOTS_VIDES]
    miss = [w for w in q if w not in t and w not in h]
    miss_t = [w for w in q if w not in t]; miss_h = [w for w in q if w not in h]
    for w in miss:
        freq[w] += 1; freq_w[w] += int(r["impr"]); by_g[r["gamme"]][w] += 1; by_role[r["role"]][w] += 1
    rows.append([r["rang_liste"], r["role"], r["gamme"], r["query"], r["impr"], p["title"], p["h1"],
                 " ".join(miss), " ".join(miss_t), " ".join(miss_h), len(q), len(miss)])
with open(D / "mots_absents_top50.tsv", "w", newline="") as f:
    w = csv.writer(f, delimiter="\t")
    w.writerow(["rang_liste", "role", "gamme", "query", "impr", "title_servi", "h1_servi", "absents_title_et_h1",
                "absents_title", "absents_h1", "n_mots_utiles", "n_absents"]); w.writerows(rows)
with open(D / "mots_absents_frequence.tsv", "w", newline="") as f:
    w = csv.writer(f, delimiter="\t"); w.writerow(["mot", "couples", "impressions", "dont_R2", "dont_R8"])
    for m, n in freq.most_common():
        w.writerow([m, n, freq_w[m], by_role["R2"][m], by_role["R8"][m]])
with open(D / "mots_absents_par_gamme.tsv", "w", newline="") as f:
    w = csv.writer(f, delimiter="\t"); w.writerow(["gamme", "mot", "couples"])
    for g in sorted(by_g, key=lambda g: -sum(by_g[g].values())):
        for m, n in by_g[g].most_common():
            w.writerow([g, m, n])
print("couples avec >=1 mot absent :", sum(1 for r in rows if r[-1] > 0), "/ 50 ; R2", sum(1 for r in rows if r[-1] > 0 and r[1]=="R2"), "/", sum(r[1]=="R2" for r in rows), "; R8", sum(1 for r in rows if r[-1] > 0 and r[1]=="R8"), "/", sum(r[1]=="R8" for r in rows))
print("mots absents (couples, impressions):", freq.most_common(30))
