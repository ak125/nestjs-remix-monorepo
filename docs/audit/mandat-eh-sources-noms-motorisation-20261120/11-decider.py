#!/usr/bin/env python3
"""Mandat EH, 6.3 : fusionne les relevés de sources extérieures des 205 cas et
décide, cas par cas, de la migration où il entre.

Usage : python3 -I 11-decider.py <erreurs.tsv (mandat EE)> <dossier recherche/> <cibles-origine.tsv>
                                  <verdicts-sources.tsv (sortie)> <decisions.tsv (sortie)> [<exclusions-eh.tsv>]

- recherche/*.tsv : une ligne par cas, en-tête `type_id valeur_juste code_moteur_source
  puissance_source annees_source sources verdict justification` (relevé web, URL publiques).
- cibles-origine.tsv : pour chaque cas dont le nom d'origine est faux, la valeur
  retenue pour type_name et type_name_meta (règle de choix dans README.md).
- exclusions-eh.tsv (facultatif) : sortie de 14-collisions.mjs ; ces cas gardent
  leur verdict mais sortent de la migration.

Règles de décision (aucune autre) :
- affichage_faux_origine_juste -> migration « affichage » : type_name_meta := type_name
  (valeur_corrigee du mandat EE, identique à type_name) ;
- origine_faux_aussi / origine_faux_affichage_juste -> migration « origine »,
  valeurs de cibles-origine.tsv ;
- deux_justes / incertain -> aucune migration ;
- les 32 cas écartés par le contrôle 6.6 du mandat EE et les cas de
  exclusions-eh.tsv : verdict seul, aucune migration.
"""
import csv
import glob
import sys

VERDICTS = {
    "affichage_faux_origine_juste": "nom d'affichage faux, nom d'origine juste",
    "origine_faux_aussi": "nom d'origine faux aussi",
    "origine_faux_affichage_juste": "nom d'origine faux (nom d'affichage juste)",
    "deux_justes": "les deux justes",
    "incertain": "incertain",
}
CHAMPS = ["type_id", "valeur_juste", "code_moteur_source", "puissance_source",
          "annees_source", "sources", "verdict", "justification"]


def lit(path):
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f, delimiter="\t", quoting=csv.QUOTE_NONE))


def ecrit(path, cols, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, cols, delimiter="\t", quoting=csv.QUOTE_NONE, escapechar=None,
                           lineterminator="\n", extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def main():
    erreurs = {r["type_id"]: r for r in lit(sys.argv[1])}
    releves = {}
    for p in sorted(glob.glob(sys.argv[2].rstrip("/") + "/*.tsv")):
        for r in lit(p):
            if list(r) != CHAMPS:
                raise SystemExit(f"{p} : en-tête inattendu {list(r)}")
            if r["type_id"] in releves:
                raise SystemExit(f"type {r['type_id']} relevé deux fois")
            if r["verdict"] not in VERDICTS:
                raise SystemExit(f"type {r['type_id']} : verdict inconnu {r['verdict']!r}")
            if "http" not in r["sources"]:
                raise SystemExit(f"type {r['type_id']} : aucune URL de source")
            releves[r["type_id"]] = r
    if set(releves) != set(erreurs):
        raise SystemExit(f"relevés ≠ 205 cas : manquants {sorted(set(erreurs) - set(releves))}, "
                         f"en trop {sorted(set(releves) - set(erreurs))}")
    cibles = {r["type_id"]: r for r in lit(sys.argv[3])}
    exclues = {r["type_id"]: r["motif"] for r in lit(sys.argv[6])} if len(sys.argv) > 6 else {}

    verdicts, decisions = [], []
    for tid in sorted(erreurs, key=int):
        e, r = erreurs[tid], releves[tid]
        v = r["verdict"]
        ee_6_6 = e["migration"] != "retenue"
        nom_ap, meta_ap, migration, motif = e["type_name"], e["type_name_meta"], "", ""
        if v.startswith("origine_faux"):
            if tid not in cibles:
                raise SystemExit(f"type {tid} : nom d'origine faux sans valeur dans cibles-origine.tsv")
            nom_ap, meta_ap = cibles[tid]["type_name_apres"], cibles[tid]["meta_apres"]
            migration = "origine"
        elif tid in cibles:
            raise SystemExit(f"type {tid} : valeur dans cibles-origine.tsv mais verdict {v}")
        elif v == "affichage_faux_origine_juste":
            if e["valeur_corrigee"] != e["type_name"]:
                raise SystemExit(f"type {tid} : valeur corrigée EE ≠ type_name")
            meta_ap, migration = e["valeur_corrigee"], "affichage"
        else:
            motif = f"verdict « {VERDICTS[v]} » : aucune correction"
        if migration and ee_6_6:
            migration, motif = "", "écarté par le contrôle 6.6 du mandat EE : verdict seul"
        elif migration and tid in exclues:
            migration, motif = "", f"écarté par 14-collisions.mjs : {exclues[tid]}"
        if not migration:
            nom_ap, meta_ap = e["type_name"], e["type_name_meta"]
        commun = dict(type_id=tid, marque=e["marque"], modele=e["modele"])
        verdicts.append(dict(commun, type_name=e["type_name"], type_name_meta=e["type_name_meta"],
                             type_fuel=e["type_fuel"], type_power_ps=e["type_power_ps"],
                             codes_moteur_base=e["codes_moteur"], **{k: r[k] for k in CHAMPS[1:6]},
                             verdict=VERDICTS[v], ee_6_6="écarté" if ee_6_6 else "retenu",
                             justification=r["justification"]))
        decisions.append(dict(commun, verdict=VERDICTS[v], type_name_avant=e["type_name"],
                              type_name_apres=nom_ap, meta_avant=e["type_name_meta"], meta_apres=meta_ap,
                              migration=migration, motif=motif))
    ecrit(sys.argv[4], list(verdicts[0]), verdicts)
    ecrit(sys.argv[5], list(decisions[0]), decisions)
    from collections import Counter
    print(dict(Counter(d["verdict"] for d in decisions)))
    print(dict(Counter(d["migration"] or "aucune" for d in decisions)))


if __name__ == "__main__":
    main()
