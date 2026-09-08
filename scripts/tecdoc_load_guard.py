#!/usr/bin/env python3
"""Garde de completude du chargement TecDoc — rend impossible la perte silencieuse.

Le defaut que cette garde existe pour empecher
----------------------------------------------
En mars 2026, le chargement de `tecdoc_raw.t400` a perdu des lignes en masse sans
qu'aucun signal ne soit emis. Mesure du 2026-09-08, en confrontant les fichiers `.meta`
du parseur au contenu reel de la base :

    DLNR 123  NISSENS   parseur    790 974 -> base       100   (99,99 % perdu)
    DLNR 30   BOSCH     parseur  9 357 752 -> base    69 000   (99,26 % perdu)
    DLNR 101  FEBI      parseur 17 421 432 -> base 2 558 500   (85,31 % perdu)
    DLNR 6358 RIDEX     parseur  5 662 767 -> base 2 323 000   (58,98 % perdu)
    DLNR 113  PAYEN     parseur  1 259 429 -> base 1 085 500   (13,81 % perdu)

Les 66 fichiers `.meta` declarent tous `rows_rejected=0`. Le parseur n'a donc rien
rejete : la perte s'est produite AU CHARGEMENT, et le lot a ete considere comme reussi.

L'invariant
-----------
    emis == charges + dedoublonnes + somme(rejets par raison)

Toute ligne lue par le parseur doit se retrouver dans exactement une categorie, et
chaque categorie doit etre COMPTEE et NOMMEE. Un ecart, meme d'une ligne, meme
favorable, fait echouer le lot : STOP, pas de projection.

Pourquoi les rejets sont un dictionnaire et non un entier
---------------------------------------------------------
Un compteur global de rejets se solde tout seul : il suffit d'y verser l'ecart pour
que l'egalite tienne, et la garde devient decorative. Exiger une RAISON par rejet
oblige a nommer ce qu'on jette. Une raison vide, blanche ou generique
(« autre », « erreur », « inconnu ») est refusee : elle rouvrirait cette porte.

Usage bibliotheque
------------------
    from tecdoc_load_guard import verifier_lot, ComptabiliteIncoherente

    verifier_lot(dlnr=21, emis=790_974, charges=790_974)                  # PASS
    verifier_lot(dlnr=30, emis=9_357_752, charges=69_000)                 # LEVE
    verifier_lot(dlnr=101, emis=100, charges=90,
                 rejets={"ktypnr_absent_du_registre": 10})                # PASS

Usage CLI
---------
    python3 scripts/tecdoc_load_guard.py --rapport rapport-de-lot.json

Codes de sortie : 0 lots equilibres · 3 rapport illisible · 5 lot incoherent.
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

#: Raisons refusees : elles ne nomment rien et permettraient de solder l'ecart.
RAISONS_INTERDITES = {
    "", "autre", "autres", "erreur", "erreurs", "inconnu", "inconnue",
    "divers", "reste", "n/a", "na", "none", "null", "other", "unknown", "misc",
}


class ComptabiliteIncoherente(RuntimeError):
    """Le lot ne se solde pas — chargement REFUSE, projection interdite."""


@dataclass(frozen=True)
class Bilan:
    """Compte rendu d'un lot equilibre. N'existe que si la garde est passee."""

    dlnr: int | None
    emis: int
    charges: int
    dedoublonnes: int
    rejets: dict = field(default_factory=dict)

    @property
    def rejetes(self) -> int:
        return sum(self.rejets.values())

    @property
    def taux_charge(self) -> float:
        return 0.0 if self.emis == 0 else self.charges / self.emis

    def __str__(self) -> str:
        cible = f"DLNR {self.dlnr}" if self.dlnr is not None else "lot"
        detail = ""
        if self.dedoublonnes:
            detail += f" · {self.dedoublonnes} dedoublonnes"
        for raison, n in sorted(self.rejets.items()):
            detail += f" · {n} rejets[{raison}]"
        return (f"{cible} : {self.emis} emis = {self.charges} charges{detail}"
                f"  ({self.taux_charge:.2%} charge)")


def _valider_entier(nom: str, valeur) -> int:
    if isinstance(valeur, bool) or not isinstance(valeur, int):
        raise ComptabiliteIncoherente(
            f"{nom} doit etre un entier, recu {type(valeur).__name__} ({valeur!r}). "
            "Un compteur approximatif ne prouve rien."
        )
    if valeur < 0:
        raise ComptabiliteIncoherente(f"{nom} est negatif ({valeur}) — compteur corrompu.")
    return valeur


def verifier_lot(*, emis: int, charges: int, dedoublonnes: int = 0,
                 rejets: dict | None = None, dlnr: int | None = None) -> Bilan:
    """Verifie qu'un lot de chargement se solde exactement. Leve sinon.

    Args:
        emis: lignes emises par le parseur (`rows_emitted` du fichier .meta).
        charges: lignes reellement presentes en base apres le chargement.
        dedoublonnes: lignes volontairement fusionnees, comptees explicitement.
        rejets: {raison: nombre}. Chaque raison doit nommer un motif reel.
        dlnr: fournisseur concerne, pour le message d'erreur.

    Returns:
        Bilan, uniquement si le lot est equilibre.

    Raises:
        ComptabiliteIncoherente: des que l'egalite ne tient pas, ou qu'un rejet n'est
            pas motive. La bonne reaction est de STOPPER, jamais d'ajuster un compteur
            pour faire tenir l'egalite.
    """
    emis = _valider_entier("emis", emis)
    charges = _valider_entier("charges", charges)
    dedoublonnes = _valider_entier("dedoublonnes", dedoublonnes)

    propres: dict = {}
    for raison, n in dict(rejets or {}).items():
        cle = str(raison).strip()
        if cle.lower() in RAISONS_INTERDITES:
            raise ComptabiliteIncoherente(
                f"raison de rejet non recevable : {raison!r}. "
                "Une categorie fourre-tout permet de solder n'importe quel ecart et "
                "vide la garde de son sens — nommer le motif reel."
            )
        propres[cle] = _valider_entier(f"rejets[{cle}]", n)

    total = charges + dedoublonnes + sum(propres.values())
    if total != emis:
        ecart = emis - total
        cible = f"DLNR {dlnr}" if dlnr is not None else "lot"
        sens = "manquantes" if ecart > 0 else "en trop"
        part = f" ({abs(ecart) / emis:.2%} du lot)" if emis else ""
        raise ComptabiliteIncoherente(
            f"{cible} : le lot ne se solde pas.\n"
            f"  emis         : {emis}\n"
            f"  charges      : {charges}\n"
            f"  dedoublonnes : {dedoublonnes}\n"
            f"  rejets       : {sum(propres.values())} {propres}\n"
            f"  ECART        : {abs(ecart)} lignes {sens}{part}\n"
            "STOP — chargement refuse, projection interdite. C'est exactement le defaut "
            "de mars 2026 (BOSCH : 9 357 752 emis, 69 000 charges, statut OK)."
        )

    return Bilan(dlnr=dlnr, emis=emis, charges=charges,
                 dedoublonnes=dedoublonnes, rejets=propres)


def verifier_rapport(rapport: dict) -> list[Bilan]:
    """Verifie tous les lots d'un rapport. Leve au PREMIER lot incoherent.

    Format attendu :
        {"lots": [{"dlnr": 21, "emis": 100, "charges": 100,
                   "dedoublonnes": 0, "rejets": {"motif": 0}}, ...]}
    """
    lots = rapport.get("lots")
    if not isinstance(lots, list):
        raise ComptabiliteIncoherente(
            "rapport sans liste 'lots' — rien n'est verifiable. "
            "Un rapport vide n'est pas un rapport vert."
        )
    if not lots:
        raise ComptabiliteIncoherente(
            "rapport a zero lot. Un chargement qui n'a rien charge doit le declarer "
            "explicitement, pas se presenter comme un succes vide."
        )
    return [
        verifier_lot(
            dlnr=lot.get("dlnr"),
            emis=lot["emis"],
            charges=lot["charges"],
            dedoublonnes=lot.get("dedoublonnes", 0),
            rejets=lot.get("rejets"),
        )
        for lot in lots
    ]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--rapport", required=True,
                    help="rapport de chargement JSON ({'lots': [...]})")
    a = ap.parse_args(argv)

    try:
        rapport = json.loads(Path(a.rapport).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(f"rapport illisible : {e}", file=sys.stderr)
        return 3

    try:
        bilans = verifier_rapport(rapport)
    except ComptabiliteIncoherente as e:
        print(f"REFUS :\n{e}", file=sys.stderr)
        return 5

    for b in bilans:
        print(b)
    print(f"\n{len(bilans)} lot(s) equilibre(s) — chargement recevable.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
