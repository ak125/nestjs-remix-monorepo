#!/usr/bin/env python3
"""Genere le manifeste scelle du banc a partir de la reference synthetique.

Les empreintes sont MESUREES sur la base, jamais ecrites a la main : c'est la meme
discipline que pour le manifeste reel de mars 2026. A relancer si
`reference-synthetique.sql` change.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from tecdoc_preservation import REQUETES          # noqa: E402
from tecdoc_seal import calculer                  # noqa: E402

import psycopg2                                   # noqa: E402

CLES = {
    "auto_type — types crees/remappes par la campagne": ("public.auto_type", "type_id_i"),
    "auto_modele — modeles ajoutes": ("public.auto_modele", "modele_id"),
    "pieces — cohorte introduite par la campagne": ("public.pieces", "piece_id"),
    "pieces — sous-ensemble affiche de la cohorte": ("public.pieces", "piece_id"),
    "pieces_gamme — gammes creees par la campagne (bande reservee)": ("public.pieces_gamme", "pg_id"),
    "tecdoc_map.type_id_remap — mapping d'identite vehicule (ancien -> nouveau)":
        ("tecdoc_map.type_id_remap", "old_id"),
    "tecdoc_map.gamme_registry — filiation gamme source -> pg_id":
        ("tecdoc_map.gamme_registry", "pg_id"),
    "tecdoc_map.linkage_target_registry — cibles de liaison":
        ("tecdoc_map.linkage_target_registry", "id"),
    "tecdoc_map.article_registry — ancrage piece_id <-> ARTNR/DLNR":
        ("tecdoc_map.article_registry", "piece_id"),
}

dsn = sys.argv[1]
sortie = Path(sys.argv[2])

ensembles = []
with psycopg2.connect(dsn) as conn, conn.cursor() as cur:
    for nom, requete in REQUETES.items():
        cur.execute(requete)
        cardinal, bmin, bmax, empreinte = cur.fetchone()
        table, cle = CLES[nom]
        ensembles.append({"nom": nom, "table": table, "cle": cle,
                          "cardinal": cardinal, "borne_min": bmin, "borne_max": bmax,
                          "empreinte_md5": empreinte, "confidence": "SYNTHETIQUE"})

doc = {
    "manifest_version": "banc-synthetique-v1",
    "objet": "Manifeste du banc de rejeu — mesure sur reference-synthetique.sql. "
             "N'a AUCUNE valeur sur MassDoc PROD ; il ne sert qu'a eprouver la garde.",
    "invariant": "Les ensembles figes ne changent pas entre deux rejeux.",
    "methode_de_controle": "identique au manifeste reel : cardinal, bornes, empreinte md5.",
    "ensembles_figes": ensembles,
}
doc["seal"] = {"algorithm": "sha256",
               "canonicalization": "sort_keys, UTF-8, separateurs (',',':'), bloc seal exclu.",
               "sha256": calculer(doc)}
sortie.write_text(json.dumps(doc, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
                  encoding="utf-8")
print(f"{sortie.name} : {len(ensembles)} ensembles, sceau {doc['seal']['sha256'][:16]}…")
