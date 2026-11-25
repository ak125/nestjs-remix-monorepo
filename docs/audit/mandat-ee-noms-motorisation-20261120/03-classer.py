#!/usr/bin/env python3
"""Mandat EE — classement rejouable des 900 noms d'affichage de motorisation.

Entrées (exports en lecture seule, voir 01-export-cas.sql et 02-export-attestations.sql) :
  cas-enrichis.tsv    les 900 cas (type_display=1, type_name_meta non contenu dans type_name)
  attestations.tsv    tous les noms bruts des marques concernées, avec codes moteur
Sortie : classement.tsv (une ligne par cas : verdict, famille, règle, preuve, valeur corrigée).

Usage : python3 -I 03-classer.py <dossier-des-exports> > classement.tsv

Les règles sont décrites dans README.md (§Règle de classement). Ordre d'évaluation :
une condition d'« erreur » l'emporte sur « incertain », qui l'emporte sur « précision juste ».
"""
import csv
import re
import sys
from collections import defaultdict

D = sys.argv[1] if len(sys.argv) > 1 else "."


def read(name):
    with open(f"{D}/{name}", newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh, delimiter="\t"))


def toks(s):
    return [t for t in re.split(r"[\s\-(),/]+", (s or "").upper()) if t]


def norm(s):
    return re.sub(r"[^0-9A-Z]", "", (s or "").upper().replace("Ë", "E").replace("É", "E"))


PHASE = re.compile(r"\s*\(\s*phase\s*\d+\s*\)", re.I)


def sans_phase(s):
    return re.sub(r"\s+", " ", PHASE.sub("", s or "")).strip()


def cover(a, b):
    """Jetons de a non couverts par b (jetons de b et concaténations de 2-3 jetons adjacents)."""
    bt = toks(b)
    words = set(bt)
    for i in range(len(bt)):
        for j in range(i + 2, min(i + 4, len(bt) + 1)):
            words.add("".join(bt[i:j]))
    at = toks(a)
    out, i = [], 0
    while i < len(at):
        done = False
        for j in range(min(i + 3, len(at)), i + 1, -1):
            if "".join(at[i:j]) in words:
                i, done = j, True
                break
        if not done:
            if at[i] not in words:
                out.append(at[i])
            i += 1
    return out


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


LITRE = re.compile(r"^\d\.\d{1,2}$")
NOMBRE = re.compile(r"^\d{2,3}$")
SOUPAPES = re.compile(r"^(8|12|16|20|24|32)V$")
DIESEL = {"D", "TD", "TDI", "HDI", "CDTI", "DCI", "JTD", "CRDI", "CRD", "CDI", "DT", "TDS", "DS",
          "DI", "DTI", "TDCI", "TDDI", "CTDI", "DID", "D4D", "4D", "MULTIJET", "BLUEHDI", "BLUETEC"}
TRANSMISSION_4X4 = {"4X4", "4WD", "AWD", "QUATTRO", "XDRIVE", "4MATIC", "ALL4", "INTEGRALE", "INTÉGRALE", "Q4"}
# Synonymes de sens identique (développement d'abréviation) — liste fermée, documentée au README.
SYNONYMES = {
    "TWIN": {"T.SPARK"}, "SPARK": {"T.SPARK"},
    "AUT.": {"AUTOMATIQUE"},
    "4WD": TRANSMISSION_4X4 | {"TRACTION"},
    "DT": {"TD"},  # turbo diesel, ordre des lettres propre à la marque (Renault dT, PSA DT)
    "TURBO": {"TJET"},  # T-Jet = moteur turbo Fiat/Alfa
    "JCW": {"JOHN", "WORKS"},  # John Cooper Works
}
SEUIL_USAGE = 10  # un jeton « désigne autre chose » s'il figure dans >= 10 noms bruts d'autres marques

cas = read("cas-enrichis.tsv")
ids = {r["type_id"]: r for r in cas}
att = read("attestations.tsv")

# Index d'attestation : (marque, code moteur) -> types ; jetons de marque -> carburants.
par_code = defaultdict(set)
info = {}
jetons_marque = defaultdict(lambda: defaultdict(set))  # marque -> jeton -> {carburants}
marques_du_jeton = defaultdict(set)
usage = defaultdict(lambda: defaultdict(int))  # jeton -> marque -> nb de noms bruts
for a in att:
    info[a["type_id"]] = a
    for code in (a["codes_moteur"] or "").split(","):
        if code:
            par_code[(a["type_marque_id"], code)].add(a["type_id"])
    for t in toks(a["type_name"]):
        jetons_marque[a["type_marque_id"]][t].add(a["type_fuel"])
        marques_du_jeton[t].add(a["type_marque_id"])
        usage[t][a["type_marque_id"]] += 1


def attestations(r, mid, tok):
    """Autres types de la même marque, partageant un code moteur, puissance à ±10 %, dont le nom brut contient tok."""
    p = num(r["type_power_ps"])
    out = set()
    for code in (r["codes_moteur"] or "").split(","):
        for tid in par_code.get((mid, code), ()):
            if tid == r["type_id"]:
                continue
            a = info[tid]
            pa = num(a["type_power_ps"])
            if p and pa and abs(pa - p) / p > 0.10:
                continue
            if tok in toks(a["type_name"]):
                out.add(tid)
    return sorted(out, key=int)


def soeurs(r):
    out = []
    for s in (r["soeurs_meme_modele"] or "").split(" ¦ "):
        p = s.split("|")
        if len(p) == 6:
            out.append(dict(zip(["type_id", "type_name", "type_name_meta", "type_liter", "type_power_ps", "type_fuel"], p)))
    return out


def autre_motorisation(r, nom):
    """Soeur affichée du même modèle dont le nom brut (sans phase) a la même forme normalisée et une puissance différente (>5 %)."""
    p = num(r["type_power_ps"])
    for s in soeurs(r):
        ps = num(s["type_power_ps"])
        if norm(sans_phase(s["type_name"])) == norm(nom) and p and ps and abs(ps - p) / p > 0.05:
            return s
    return None


def nombre_autre_motorisation(r, tok):
    p = num(r["type_power_ps"])
    for s in soeurs(r):
        ps = num(s["type_power_ps"])
        if tok in toks(s["type_name"]) and p and ps and abs(ps - p) / p > 0.05:
            return s
    return None


def faute_de_frappe(a, b):
    if a == b or len(a) != len(b) or len(a) < 3:
        return False
    diff = [i for i in range(len(a)) if a[i] != b[i]]
    return len(diff) == 2 and diff[1] == diff[0] + 1 and a[diff[0]] == b[diff[1]] and a[diff[1]] == b[diff[0]]


def litre_ok(r, tok):
    l = float(tok)
    tl = num(r["type_liter"])
    if tl is not None and abs(tl / 100 - l) <= 0.05:
        return f"type_liter={r['type_liter']}"
    for m in (r["tecdoc_moteurs"] or "").split(" ; "):
        mm = re.search(r":(\d+)cc:", m)
        if mm and round(int(mm.group(1)) / 1000, 1) == l:
            return f"TecDoc {m.split(':')[0]}={mm.group(1)} cm3"
    return None


def classer(r):
    k = ids[r["type_id"]]
    mid, body = k["type_marque_id"], k["type_body"] or ""
    brut, aff = r["type_name"], r["type_name_meta"]
    fuel = r["type_fuel"]
    add, rem = cover(aff, brut), cover(brut, aff)
    marque, modele = norm(r["marque_name"]), r["modele_name"].upper()
    preuves, erreurs, incertains, justes = [], [], [], []

    # R1 — valeur parasite (double espace, jeton orphelin après suppression).
    if "  " in aff or not norm(aff):
        erreurs.append(("valeur vide ou parasite", "R1", "double espace / reste d'une suppression"))

    # R2 — nom d'une autre motorisation affichée du même modèle (décidé après l'examen des jetons).
    s = autre_motorisation(r, aff)
    non_factuel = []  # jetons justifiés par une règle de contexte, pas par un fait en base

    for t in add:
        ev = attestations(r, mid, t)
        if LITRE.match(t):
            ok = litre_ok(r, t)
            if ok:
                justes.append(f"{t} : {ok}")
            elif ev:
                justes.append(f"{t} : attesté types {','.join(ev[:3])}")
            else:
                erreurs.append(("cylindrée contredite", "R3", f"{t} ≠ type_liter={r['type_liter']} / {r['tecdoc_moteurs'] or 'TecDoc absent'}"))
            continue
        if NOMBRE.match(t) and t != r["type_power_ps"]:
            s2 = nombre_autre_motorisation(r, t)
            if s2:
                erreurs.append(("nom d'une autre motorisation", "R2",
                                f"{t} = désignation du type {s2['type_id']} « {s2['type_name']} » {s2['type_power_ps']} ch ≠ {r['type_power_ps']} ch"))
                continue
        if t.isdigit() and t == r["type_power_ps"]:
            justes.append(f"{t} : = type_power_ps")
            continue
        if ev:
            justes.append(f"{t} : attesté même marque, code moteur et puissance, types {','.join(ev[:3])}")
            continue
        if t == "I" and marque == "HONDA" and set(toks(aff)) & {"CTDI", "DTEC"}:
            justes.append("i : nomenclature Honda i-CTDi / i-DTEC (liste fermée, hors base)")
            non_factuel.append(t)
            continue
        if t == "D" and fuel == "Diesel":
            justes.append("D : diesel, type_fuel=Diesel")
            continue
        if t == "I":
            if fuel == "Essence":
                justes.append("i : injection essence, type_fuel=Essence")
            else:
                erreurs.append(("carburant contredit", "R4", f"« i » (essence) sur type_fuel={fuel}"))
            continue
        if t in DIESEL and fuel == "Essence" and t not in {"DI"} | {"D"}:
            erreurs.append(("carburant contredit", "R4", f"{t} (diesel) sur type_fuel=Essence"))
            continue
        if t == marque or norm(t) == marque:
            justes.append(f"{t} : nom de la marque")
            non_factuel.append(t)
            continue
        if marque == "MERCEDES" and t in {"T", "TD"} and ("BREAK" in modele or "BREAK" in body.upper()):
            justes.append(f"{t} : désignation Mercedes du break (T-Modell), modèle « {r['modele_name']} »")
            non_factuel.append(t)
            continue
        if marque == "MERCEDES" and t == "ML" and "CLASSE M " in modele + " ":
            justes.append("ML : préfixe commercial de la Classe M")
            non_factuel.append(t)
            continue
        if t == "FWD" and not (set(toks(brut)) & TRANSMISSION_4X4 or "INTEGRALE" in norm(brut)):
            justes.append("FWD : aucune mention 4x4 dans le nom brut")
            non_factuel.append(t)
            continue
        syn = SYNONYMES.get(t)
        if syn and (set(toks(brut)) & syn or any(x in norm(brut) for x in map(norm, syn))):
            justes.append(f"{t} : synonyme de « {'/'.join(sorted(set(toks(brut)) & syn) or sorted(syn))} »")
            non_factuel.append(t)
            continue
        if SOUPAPES.match(t):
            autres = set()
            for code in (r["codes_moteur"] or "").split(","):
                for tid in par_code.get((mid, code), ()):
                    autres |= {x for x in toks(info[tid]["type_name"]) if SOUPAPES.match(x)}
            if autres and t not in autres:
                erreurs.append(("nombre de soupapes contredit", "R5", f"{t} ; même code moteur : {','.join(sorted(autres))}"))
            else:
                incertains.append(f"{t} : non attesté pour ce code moteur")
            continue
        typo = next((x for x in rem if faute_de_frappe(t, x)), None)
        if typo and t not in marques_du_jeton:
            erreurs.append(("faute de frappe", "R6", f"{t} : inversion de lettres de « {typo} », jeton absent de tous les noms bruts"))
            continue
        n_marque = usage[t].get(mid, 0)
        n_autres = sum(v for m, v in usage[t].items() if m != mid)
        if NOMBRE.match(t):
            num_rem = [x for x in rem if NOMBRE.match(x)]
            if num_rem:
                erreurs.append(("abréviation ou désignation qui change le sens", "R7",
                                f"désignation {t} remplace « {' '.join(num_rem)} » du nom brut ; 0 attestation (même marque, code moteur, puissance ±10 %)"))
                continue
        tech_rem = [x for x in rem if not x.isdigit() and not LITRE.match(x) and not SOUPAPES.match(x) and x not in {"PHASE"}]
        if tech_rem and not t.isdigit():
            if n_marque or n_autres >= SEUIL_USAGE:
                erreurs.append(("abréviation ou désignation qui change le sens", "R7",
                                f"{t} remplace « {' '.join(tech_rem)} » ; 0 attestation (même marque, code moteur {r['codes_moteur'] or 'absent'}, puissance ±10 %) ; "
                                f"{t} désigne ailleurs d'autres moteurs : {n_marque} nom(s) brut(s) de la marque, {n_autres} d'autres marques"))
            else:
                incertains.append(f"{t} remplace « {' '.join(tech_rem)} » sans attestation, mais n'a pas d'autre usage établi ({n_marque}+{n_autres} noms bruts)")
            continue
        if t.isalpha() and len(t) >= 2 and not n_marque and n_autres >= SEUIL_USAGE:
            erreurs.append(("désignation étrangère à la marque", "R8",
                            f"{t} : absent des {sum(1 for a in att if a['type_marque_id']==mid)} noms bruts de la marque, présent dans {n_autres} noms bruts de {len(marques_du_jeton[t])} autre(s) marque(s)"))
            continue
        if t.isdigit() and NOMBRE.match(t):
            incertains.append(f"{t} : désignation numérique non attestée, aucune soeur ne la porte")
            continue
        incertains.append(f"{t} : non attesté (même marque, code moteur, puissance)")

    if s:
        note = f"= nom brut de type {s['type_id']} « {s['type_name']} » {s['type_power_ps']} ch ≠ {r['type_power_ps']} ch"
        if (not add and rem) or (add and (non_factuel or erreurs or incertains)):
            erreurs.insert(0, ("nom d'une autre motorisation", "R2", note))
        else:
            justes.append(f"collision préexistante signalée : {note}")
    if erreurs:
        fam = erreurs[0][0]
        regle = ",".join(sorted({e[1] for e in erreurs}))
        preuve = " ; ".join(e[2] for e in erreurs)
        verdict = "erreur"
    elif incertains:
        verdict, fam, regle = "incertain", "preuve manquante", "R9"
        preuve = " ; ".join(incertains + justes)
    else:
        verdict = "précision juste"
        if not add:
            fam, regle = ("réordonnancement" if not rem else "simplification (mentions retirées)"), "R10"
            preuve = ("retire : " + " ".join(rem)) if rem else "mêmes jetons, ordre ou casse différents"
        else:
            fam, regle = "suffixe ou précision justifiés", "R11"
            preuve = " ; ".join(justes)
            if rem:
                preuve += " ; retire : " + " ".join(rem)
    corrigee = ""
    if verdict == "erreur":
        corrigee = sans_phase(brut)
    return dict(type_id=r["type_id"], marque=r["marque_name"], modele=r["modele_name"], modele_affiche=r["modele_affiche"],
                type_name=brut, type_name_meta=aff, type_fuel=fuel, type_liter=r["type_liter"], type_power_ps=r["type_power_ps"],
                codes_moteur=r["codes_moteur"], verdict=verdict, famille=fam, regle=regle,
                ajoute=" ".join(add), retire=" ".join(rem), preuve=preuve, valeur_corrigee=corrigee,
                r8_indexable=r["r8_indexable"], r8_sitemap=r["r8_sitemap"],
                r2_servables=r["r2_servables"], r2_indexables=r["r2_indexables"],
                type_modele_id=k["type_modele_id"])


out = [classer(r) for r in cas]

# Valeur corrigée : nom brut sans mention de phase, sauf si cela recrée le nom affiché
# d'une autre motorisation du même modèle — on garde alors le nom brut complet.
aff_par_modele = defaultdict(dict)
for r in cas:
    for s in soeurs(r):
        aff_par_modele[ids[r["type_id"]]["type_modele_id"]][s["type_id"]] = s["type_name_meta"] or s["type_name"]
for o in out:
    if o["verdict"] != "erreur":
        continue
    autres = {tid: v for tid, v in aff_par_modele[o["type_modele_id"]].items() if tid != o["type_id"]}
    corrige = {x["type_id"]: x["valeur_corrigee"] for x in out if x["verdict"] == "erreur" and x["type_modele_id"] == o["type_modele_id"]}
    autres.update({tid: v for tid, v in corrige.items() if tid != o["type_id"]})
    if any(norm(v) == norm(o["valeur_corrigee"]) for v in autres.values()) and o["valeur_corrigee"] != o["type_name"].strip():
        o["valeur_corrigee"] = re.sub(r"\s+", " ", o["type_name"]).strip()

cols = list(out[0].keys())
w = csv.DictWriter(sys.stdout, fieldnames=cols, delimiter="\t", lineterminator="\n")
w.writeheader()
for o in sorted(out, key=lambda x: (x["verdict"], x["marque"], x["modele"], x["type_name"], int(x["type_id"]))):
    w.writerow(o)
