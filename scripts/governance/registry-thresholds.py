#!/usr/bin/env python3
"""registry-thresholds.py — fonctions et seuils du registre pour le rapport du matin (mandat BZ).

Lit .spec/00-canon/ai-registry/agent-operating-map.yaml (bloc `functions` de chaque
département, mandat BX) et, si fourni, le fichier des lectures produit par
registry-threshold-read.ts. Écrit sur stdout un JSON :

  {"departments": [{"n", "label", "intitule", "counts": {...}, "line"}],
   "thresholds":  [{"id", "department", "issue_label", "state", "color", "detail",
                    "title", "state_label", "body"}]}

Rien n'est écrit ailleurs : l'ouverture ou la mise à jour des issues revient à
registry-thresholds.sh, selon THRESHOLD_ISSUES_MODE.

États d'un seuil :
  franchi        — règle évaluable, branchée, indicateur lu, condition vraie ;
  sous_le_seuil  — idem, condition fausse ;
  non_mesure     — branché, mais la valeur n'a pas pu être lue (jamais zéro) ;
  non_evalue     — branché, mode off : aucune lecture faite ;
  non_branche    — règle évaluable (threshold.eval), wired: false ;
  non_evaluable  — seuil en texte seul (pas de threshold.eval) : n'ouvre rien.

Dépôt public : la valeur de l'indicateur n'est jamais publiée (règle du rapport du
matin) ; le statut du producteur, la règle, la fenêtre, la source et l'heure le sont.

Usage : registry-thresholds.py <carte.yaml> <lectures.json|-> <mode> <url_blob_du_registre>
"""
import json
import sys

import yaml

STATUS_COLOR = {"CRITICAL": "rouge", "WARNING": "orange"}
STATUS_WORDS = {"operational": "opérationnelle(s)", "non_operational": "non opérationnelle(s)", "missing": "absente(s)"}
EMOJI = {"rouge": "🔴", "orange": "🟠", "vert": "🟢"}
TITLE = "Seuil de fonction — {id}"


def compare(actual, operator, expected):
    """Condition du seuil ; None si la comparaison est impossible (valeur absente ou type différent)."""
    if actual is None:
        return None
    if operator == "in":
        return actual in expected
    if operator == "eq":
        return actual == expected
    if operator == "ne":
        return actual != expected
    if not isinstance(actual, (int, float)) or not isinstance(expected, (int, float)):
        return None
    return {"lt": actual < expected, "le": actual <= expected, "gt": actual > expected, "ge": actual >= expected}[operator]


def eval_text(e):
    v = "[" + ", ".join(str(x) for x in e["value"]) + "]" if isinstance(e["value"], list) else str(e["value"])
    return f"{e['field']} {e['operator']} {v} sur {e['window_days']} j"


def evaluate(f, readings, mode):
    """(state, color, detail, reading) pour le seuil de la fonction f."""
    t = f["threshold"]
    e = t.get("eval")
    if not e:
        return "non_evaluable", None, "seuil en texte seul, sans règle évaluable", None
    if t.get("wired") is not True:
        return "non_branche", None, "règle évaluable, non branchée (wired: false)", None
    if mode == "off":
        return "non_evalue", None, "mode off : aucune lecture", None
    k = next((k for k in f.get("kpi_input") or [] if k.get("id") == e["indicator"]), None)
    if not k or k.get("state") != "present":
        return "non_mesure", None, f"indicateur {e['indicator']} non produit", None
    r = (readings or {}).get(e["indicator"])
    if r is None:
        return "non_mesure", None, f"aucune lecture de {e['indicator']} dans ce passage", None
    if r.get("producer") != k.get("producer"):
        return "non_mesure", None, f"lecture d'une autre source que le producteur déclaré ({k.get('producer')})", None
    if r.get("unmeasured"):
        return "non_mesure", None, r["unmeasured"], None
    if r.get("window_days") != e["window_days"]:
        return "non_mesure", None, f"fenêtre du producteur ({r.get('window_days')} j) ≠ fenêtre du registre ({e['window_days']} j)", None
    crossed = compare(r.get(e["field"]), e["operator"], e["value"])
    if crossed is None:
        return "non_mesure", None, f"{e['field']} illisible dans la lecture", None
    if crossed:
        return "franchi", STATUS_COLOR.get(r.get("status"), "rouge"), f"{e['field']} = {r.get('status') if e['field'] == 'status' else 'non publiée'}", r
    return "sous_le_seuil", "vert", f"{e['field']} = {r.get('status') if e['field'] == 'status' else 'non publiée'}", r


def body(f, dep, state, detail, r, read_at, link):
    t, e = f["threshold"], f["threshold"]["eval"]
    k = next(k for k in f.get("kpi_input") or [] if k.get("id") == e["indicator"])
    when = f"{read_at[:10]} {read_at[11:16]} UTC" if read_at else "heure inconnue"
    lines = [f"## Seuil de fonction — `{f['id']}`", ""]
    if state == "franchi":
        lines.append(f"**Constat** : seuil **franchi** à la lecture du {when}.")
    else:
        lines.append(f"**Constat** : **retour sous le seuil** à la lecture du {when}. L'issue reste ouverte : aucune fermeture automatique (décision 9).")
    lines += [
        "",
        f"**Chiffres** : statut du producteur `{r.get('status')}` ; certifié par le producteur : {'oui' if r.get('certified') else 'non'} ; "
        f"fenêtre : {r.get('window_days')} j ; valeur : non publiée (dépôt public, règle du rapport du matin).",
        f"**Règle évaluée** : `{eval_text(e)}` (registre, `threshold.eval`) — « {t['rule']} ».",
        f"**Source** : indicateur `{k['id']}` du producteur `{k['producer']}`"
        + (f" (règle `{k['rule']}`)" if k.get("rule") else "")
        + f", lu par le rapport du matin le {when}.",
        f"**Fonction** : [`{f['id']}`]({link}) — département {dep['n']:02d} {dep['intitule']}, propriétaire `{f.get('owner') or 'non renseigné'}`.",
        "",
        "**Mandat proposé (texte seul, rien n'est lancé)** : "
        f"pour la fonction `{f['id']}`, relire l'indicateur `{k['id']}` chez `{k['producer']}` sur {e['window_days']} j, "
        f"établir en lecture seule la cause du franchissement de la règle « {t['rule']} », "
        "puis proposer une correction dans le périmètre de la fonction, sans écriture hors mandat. "
        "Décision et lancement : Marwane.",
        "",
        f"_Issue tenue par le rapport du matin (mandat BZ) : titre fixe, corps remplacé à chaque passage, "
        f"commentaire seulement au changement de couleur. Label `{t['issue_label']}` existant, jamais créé._",
    ]
    return "\n".join(lines) + "\n"


def line_of(map_text, fid):
    for i, s in enumerate(map_text.splitlines(), 1):
        if s.strip() in (f"- id: {fid}", f"id: {fid}"):
            return i
    return None


def main(argv):
    map_path, readings_path, mode, blob = argv[1:5]
    text = open(map_path, encoding="utf-8").read()
    carte = yaml.safe_load(text)
    read = json.load(open(readings_path, encoding="utf-8")) if readings_path not in ("", "-") else {}
    readings, read_at = read.get("indicators") or {}, read.get("read_at") or ""
    deps = [d for d in carte.get("departments") or [] if isinstance(d, dict) and isinstance(d.get("business_number"), int)]
    deps.sort(key=lambda d: d["business_number"])
    out = {"departments": [], "thresholds": []}
    for d in deps:
        dep = {"n": d["business_number"], "label": "dept:%02d-%s" % (d["business_number"], d["id"]), "intitule": d.get("label", "")}
        fns = [f for f in d.get("functions") or [] if isinstance(f, dict)]
        counts = {s: sum(1 for f in fns if f.get("status") == s) for s in STATUS_WORDS}
        measured, others = [], {}
        for f in fns:
            if not isinstance(f.get("threshold"), dict):
                continue
            state, color, detail, r = evaluate(f, readings, mode)
            th = {"id": f["id"], "department": dep["n"], "issue_label": f["threshold"]["issue_label"], "state": state,
                  "color": color, "detail": detail, "title": TITLE.format(id=f["id"]),
                  "state_label": f"Seuil de {f['id']} (vert = sous le seuil)"}
            if state in ("franchi", "sous_le_seuil"):
                n = line_of(text, f["id"])
                th["body"] = body(f, dep, state, detail, r, read_at, f"{blob}#L{n}" if n else blob)
                measured.append(f"{f['id']} {EMOJI[color]} {'franchi' if state == 'franchi' else 'sous le seuil'}")
            else:
                others.setdefault(state, []).append(f["id"])
            out["thresholds"].append(th)
        line = f"{dep['n']:02d} {dep['intitule']} — fonctions : " + " · ".join(f"{counts[s]} {w}" for s, w in STATUS_WORDS.items())
        rest = []
        for state, word in (("non_mesure", "non mesuré"), ("non_evalue", "non évalué (mode off)"),
                            ("non_branche", "évaluable non branché"), ("non_evaluable", "non évaluable")):
            if others.get(state):
                rest.append(f"{len(others[state])} {word} ({', '.join(others[state])})" if state != "non_evaluable" else f"{len(others[state])} {word}")
        line += " — seuils : " + " ; ".join(measured + rest) if measured else " — pas de mesure" + (f" (seuils : {' ; '.join(rest)})" if rest else "")
        dep.update(counts=counts, line=line)
        out["departments"].append(dep)
    if len(out["departments"]) != 24:
        print(f"registry-thresholds : {len(out['departments'])} départements lus, 24 attendus", file=sys.stderr)
        return 1
    json.dump(out, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
