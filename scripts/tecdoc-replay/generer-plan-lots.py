#!/usr/bin/env python3
"""Genere le plan de lots du rejeu complet DEPUIS l'artefact scelle.

Le decoupage n'est pas invente : il derive du perimetre fige de mars 2026 et du
volume source de chaque fournisseur. Regenerable a l'identique.

Regle de placement :
  LOT 0  fumee — 1 petit DLNR, deja prouve en PR #1418
  LOT 1  5 DLNR petits, dont les 2 divergents les plus legers (signal maximal, cout minimal)
  LOT 2  20 DLNR, dont le divergent moyen
  LOT 3  les 2 divergents lourds, isoles : ce sont eux qui ont perdu 99 % des lignes
  LOT 4+ le reste, par tranches de 30
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from tecdoc_scope import charger_perimetre  # noqa: E402

SCOPE = sys.argv[1] if len(sys.argv) > 1 else "../../audit/massdoc-tecdoc-import-scope-2026-03.json"
SORTIE = Path(sys.argv[2] if len(sys.argv) > 2 else "plan-lots.json")

p = charger_perimetre(SCOPE)
projetes = set(p.dlnr_projetes())
DIVERGENTS = {123: "NISSENS", 30: "BOSCH", 101: "FEBI", 6358: "RIDEX", 113: "PAYEN"}

def volume(s):
    m = s.get("parseur_meta") or {}
    return m.get("rows_emitted") or s.get("t400_rows") or 0

fournisseurs = {s["dlnr"]: s for s in p.suppliers if s["dlnr"] in projetes}
par_volume = sorted(fournisseurs.values(), key=volume)

SMOKE = 4523                                     # HIDRIA — valide en #1418
div_tries = sorted(DIVERGENTS, key=lambda d: volume(fournisseurs[d]) if d in fournisseurs else 0)
div_legers, div_moyen, div_lourds = div_tries[:2], div_tries[2:3], div_tries[3:]

place, lots = set(), []
def prendre(n, exclure=()):
    out = []
    for s in par_volume:
        if len(out) >= n: break
        d = s["dlnr"]
        if d in place or d in exclure or d == SMOKE: continue
        out.append(d); place.add(d)
    return out

place.add(SMOKE)
lots.append(("LOT 0 — fumee", [SMOKE]))
for d in div_legers: place.add(d)
lots.append(("LOT 1 — 5 DLNR, 2 divergents legers", div_legers + prendre(5 - len(div_legers), DIVERGENTS)))
for d in div_moyen: place.add(d)
lots.append(("LOT 2 — 20 DLNR, 1 divergent moyen", div_moyen + prendre(20 - len(div_moyen), DIVERGENTS)))
for d in div_lourds: place.add(d)
lots.append(("LOT 3 — divergents lourds, isoles", div_lourds))
reste = [s["dlnr"] for s in par_volume if s["dlnr"] not in place]
for i in range(0, len(reste), 30):
    tranche = reste[i:i+30]
    place.update(tranche)
    lots.append((f"LOT {4 + i//30} — reste ({len(tranche)} DLNR)", tranche))

doc = {
    "objet": "Plan de lots du rejeu complet TecDoc. PREPARE, NON EXECUTE.",
    "perimetre_source": {"fichier": Path(SCOPE).name, "version": p.version,
                         "dlnr_projetes": len(projetes)},
    "contrat_par_lot": {
        "checkpoint": "_batch_id deterministe par (table, DLNR, CRC32, version) — un lot "
                      "interrompu se reprend au DLNR pres, sans doublon.",
        "comptabilite": "emis = charges + dedoublonnes + rejets_explicites, verifiee AVANT "
                        "commit (tecdoc_load_guard.verifier_lot). Sinon FAIL + ROLLBACK + STOP.",
        "rollback": "une transaction par DLNR : toute anomalie annule le DLNR entier. "
                    "Aucun prefixe partiel ne peut etre committe.",
        "rapport": "<volume>/rapports/lot-<n>.json — par DLNR : rows_source, rows_parsed, "
                   "rows_emitted, rows_loaded, rows_deduplicated, rows_rejected, rows_fatal.",
        "condition_de_passage": "un lot ne s'ouvre que si le precedent est integralement vert.",
    },
    "lots": [],
}
for nom, dlnrs in lots:
    if not dlnrs: continue
    doc["lots"].append({
        "nom": nom,
        "dlnr": sorted(dlnrs),
        "nombre": len(dlnrs),
        "lignes_source_attendues": sum(volume(fournisseurs[d]) for d in dlnrs),
        "divergents_inclus": sorted(DIVERGENTS[d] for d in dlnrs if d in DIVERGENTS),
    })

couvert = sum(l["nombre"] for l in doc["lots"])
assert couvert == len(projetes), f"couverture {couvert} != {len(projetes)}"
doc["couverture"] = {"dlnr_planifies": couvert, "dlnr_du_perimetre": len(projetes),
                     "lignes_source_totales": sum(l["lignes_source_attendues"] for l in doc["lots"])}
SORTIE.write_text(json.dumps(doc, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
print(f"{SORTIE.name} : {len(doc['lots'])} lots, {couvert}/{len(projetes)} DLNR couverts")
for l in doc["lots"]:
    d = f"  [{', '.join(l['divergents_inclus'])}]" if l["divergents_inclus"] else ""
    print(f"  {l['nom']:42} {l['nombre']:>3} DLNR  {l['lignes_source_attendues']:>12,} lignes{d}")
