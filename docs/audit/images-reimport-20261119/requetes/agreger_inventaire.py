#!/usr/bin/env python3
"""Agrège les CSV de mesure_inventaire.sh par marque (relevé mandat DC, lecture seule).

Usage : python3 -I agreger_inventaire.py <dossier lots> <marques.csv> <registre brand-folder yaml> <sortie csv>

Les lignes « SET » écrites par le lecteur psql sont ignorées. Aucune base n'est lue ici.
"""
import csv
import glob
import os
import re
import sys
from collections import defaultdict

LOTS, MARQUES, REGISTRE, SORTIE = sys.argv[1:5]

noms = {}
with open(MARQUES, newline="", encoding="utf-8") as f:
    for row in csv.reader(f):
        if row and row[0].isdigit():
            noms[row[0]] = row[1]

dossier_registre = {}
motif = re.compile(r"pm_id:\s*(\d+),\s*name:\s*\"[^\"]*\",\s*primary_folder:\s*(\d+)")
with open(REGISTRE, encoding="utf-8") as f:
    for ligne in f:
        m = motif.search(ligne)
        if m:
            dossier_registre[m.group(1)] = m.group(2)

sans_affichable = defaultdict(set)
sans_servie = defaultdict(set)
manquantes = defaultdict(int)
dossiers = defaultdict(lambda: defaultdict(int))
lignes = 0
for chemin in sorted(glob.glob(os.path.join(LOTS, "lot_*.csv"))):
    with open(chemin, newline="", encoding="utf-8") as f:
        for row in csv.reader(f):
            if len(row) != 8:
                if row == ["SET"] or not row:
                    continue
                raise SystemExit(f"ligne inattendue dans {chemin}: {row!r}")
            lignes += 1
            piece_id, pm_id, _ref, n_aff, n_pres, classe, folder, _name = row
            if int(n_pres) == 0:
                sans_servie[pm_id].add(piece_id)
            if classe == "sans_image_affichable":
                sans_affichable[pm_id].add(piece_id)
            elif classe == "image_absente":
                manquantes[pm_id] += 1
                dossiers[pm_id][folder] += 1
            else:
                raise SystemExit(f"classe inconnue: {classe!r}")

marques = set(sans_servie) | set(manquantes)
resultat = sorted(
    marques,
    key=lambda p: (-(manquantes[p] + len(sans_servie[p])), int(p)),
)
with open(SORTIE, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow([
        "pm_id", "marque", "dossier_registre",
        "pieces_vendables_sans_image_servie",
        "dont_sans_image_affichable",
        "images_manquantes",
        "dossiers_des_images_manquantes",
    ])
    for p in resultat:
        w.writerow([
            p, noms.get(p, "(absent de pieces_marque)"), dossier_registre.get(p, ""),
            len(sans_servie[p]), len(sans_affichable[p]), manquantes[p],
            " ".join(f"{d or '(vide)'}:{n}" for d, n in sorted(dossiers[p].items(), key=lambda x: -x[1])),
        ])

print(f"lignes={lignes} marques={len(marques)} "
      f"pieces_sans_image_servie={sum(len(s) for s in sans_servie.values())} "
      f"dont_sans_affichable={sum(len(s) for s in sans_affichable.values())} "
      f"images_manquantes={sum(manquantes.values())}")
