#!/usr/bin/env python3
"""Reconciliation rejeu <-> PROD, et mise en quarantaine de ce que la source ajoute.

Le probleme que ce module resout
--------------------------------
La decision owner du 2026-09-08 est que le futur rejeu suive la SOURCE TecDoc, pas le
defaut de chargement historique. Consequence mecanique : pour NISSENS, BOSCH, FEBI,
RIDEX et PAYEN, un rejeu fidele a la source produira BEAUCOUP plus de lignes que la
PROD actuelle — jusqu'a 790 974 la ou la base en porte 100.

Ces lignes supplementaires sont probablement legitimes. « Probablement » ne suffit pas
pour les afficher, les activer, les publier ou les indexer : ce sont des pieces vues
par des clients et des URL vues par Google. Elles vont donc en QUARANTAINE, et un
humain decide.

L'invariant de l'owner, formule en ensembles :

    PROD actuelle  ⊆  REBUILD source-truth

et non `PROD actuelle == REBUILD`. Ce module verifie l'inclusion et non l'egalite.

Les quatre categories
---------------------
    EXISTING_PROD    la cle existe des deux cotes, avec la MEME valeur. Rien a faire.
    NEW_FROM_SOURCE  la cle n'existe qu'au rejeu. QUARANTAINE — jamais activee d'office.
    CONFLICT         la cle existe des deux cotes avec des valeurs DIFFERENTES.
                     C'est le cas le plus grave : la PROD dit une chose, la source une
                     autre. Ni ecrasement, ni ignorance — arbitrage humain.
    UNKNOWN          la valeur manque d'un cote. Indecidable, donc traite comme du
                     CONFLICT du point de vue de l'activation : jamais active.

Une cinquieme grandeur est rapportee a part : `absentes_du_rejeu`, les cles presentes
en PROD que le rejeu n'a pas reproduites. Ce n'est pas une categorie de quarantaine
mais un signal de CONSERVATION : c'est exactement ce que l'invariant d'inclusion
interdit. Sa presence rend `inclusion_respectee` faux.

Usage
-----
    from tecdoc_reconcile import reconcilier, a_activer, ActivationInterdite

    rec = reconcilier(prod={"A": 1, "B": 2}, source={"A": 1, "B": 9, "C": 3})
    rec.par_categorie["CONFLICT"]        # ['B']
    rec.par_categorie["NEW_FROM_SOURCE"] # ['C']
    a_activer(rec)                       # ['A'] — et rien d'autre

Codes de sortie CLI : 0 inclusion respectee · 3 illisible · 8 inclusion rompue.
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

CATEGORIES = ("EXISTING_PROD", "NEW_FROM_SOURCE", "CONFLICT", "UNKNOWN")

#: Categories qui ne doivent JAMAIS etre activees, affichees, publiees ni indexees
#: sans decision humaine explicite.
QUARANTAINE = ("NEW_FROM_SOURCE", "CONFLICT", "UNKNOWN")


class ActivationInterdite(RuntimeError):
    """On a tente d'activer des elements sous quarantaine — refus."""


@dataclass(frozen=True)
class Reconciliation:
    """Comparaison d'un rejeu a la PROD, pour un DLNR ou globalement."""

    dlnr: int | None
    par_categorie: dict = field(default_factory=dict)
    absentes_du_rejeu: tuple = ()

    @property
    def inclusion_respectee(self) -> bool:
        """Vrai si PROD ⊆ REBUILD : rien de ce que sert la PROD n'a disparu.

        Un CONFLICT compte comme une rupture d'inclusion : la cle existe des deux
        cotes, mais ce que la PROD sert n'est PAS ce que le rejeu produirait.
        """
        return not self.absentes_du_rejeu and not self.par_categorie.get("CONFLICT")

    def total(self, categorie: str) -> int:
        return len(self.par_categorie.get(categorie, ()))

    def resume(self) -> dict:
        """La forme demandee pour le rapport de dry-run."""
        return {
            "dlnr": self.dlnr,
            "lignes_source_attendues": sum(self.total(c) for c in
                                           ("EXISTING_PROD", "NEW_FROM_SOURCE",
                                            "CONFLICT", "UNKNOWN")),
            "lignes_prod_actuelles": (self.total("EXISTING_PROD") + self.total("CONFLICT")
                                      + self.total("UNKNOWN") + len(self.absentes_du_rejeu)),
            "absentes_de_prod": self.total("NEW_FROM_SOURCE"),
            "en_trop_dans_prod": len(self.absentes_du_rejeu),
            "conflits": self.total("CONFLICT"),
            "indecidables": self.total("UNKNOWN"),
            "identites_conservees": self.total("EXISTING_PROD"),
            "candidats_en_quarantaine": sum(self.total(c) for c in QUARANTAINE),
            "inclusion_respectee": self.inclusion_respectee,
        }

    def __str__(self) -> str:
        cible = f"DLNR {self.dlnr}" if self.dlnr is not None else "global"
        parts = " · ".join(f"{c}={self.total(c)}" for c in CATEGORIES)
        etat = "inclusion OK" if self.inclusion_respectee else "INCLUSION ROMPUE"
        return f"{cible} : {parts} · absentes_du_rejeu={len(self.absentes_du_rejeu)} · {etat}"


def reconcilier(prod: dict, source: dict, *, dlnr: int | None = None) -> Reconciliation:
    """Classe chaque cle des deux cotes dans une des quatre categories.

    Args:
        prod: etat servi aujourd'hui, {cle: valeur}.
        source: etat qu'un rejeu source-truth produirait, {cle: valeur}.
        dlnr: fournisseur concerne, pour le rapport.

    Returns:
        Reconciliation. Ne leve jamais : classer n'est pas juger. C'est `a_activer`
        qui refuse, et `inclusion_respectee` qui alerte.
    """
    par: dict = {c: [] for c in CATEGORIES}
    for cle, valeur_src in source.items():
        if cle not in prod:
            par["NEW_FROM_SOURCE"].append(cle)
            continue
        valeur_prod = prod[cle]
        if valeur_prod is None or valeur_src is None:
            par["UNKNOWN"].append(cle)
        elif valeur_prod == valeur_src:
            par["EXISTING_PROD"].append(cle)
        else:
            par["CONFLICT"].append(cle)

    return Reconciliation(
        dlnr=dlnr,
        par_categorie={c: sorted(v, key=str) for c, v in par.items()},
        absentes_du_rejeu=tuple(sorted((c for c in prod if c not in source), key=str)),
    )


def a_activer(rec: Reconciliation, *, inclure_quarantaine: bool = False) -> list:
    """Rend ce qui peut etre active sans decision humaine : EXISTING_PROD, et rien d'autre.

    Raises:
        ActivationInterdite: si l'appelant demande explicitement d'inclure la
            quarantaine. Le drapeau existe pour que cette demande soit ECRITE dans le
            code appelant et visible en revue, jamais pour etre honoree.
    """
    if inclure_quarantaine:
        sous_quarantaine = sum(rec.total(c) for c in QUARANTAINE)
        raise ActivationInterdite(
            f"activation de {sous_quarantaine} element(s) sous quarantaine refusee "
            f"({', '.join(f'{c}={rec.total(c)}' for c in QUARANTAINE)}).\n"
            "Les donnees qu'un rejeu source-truth ajoute ne sont ni affichees, ni "
            "activees, ni publiees, ni indexees d'office : elles sont vues par des "
            "clients et par Google. Decision humaine, explicite, tracee."
        )
    return list(rec.par_categorie.get("EXISTING_PROD", ()))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--prod", required=True, help="JSON {cle: valeur} servi aujourd'hui")
    ap.add_argument("--source", required=True, help="JSON {cle: valeur} produit par le rejeu")
    ap.add_argument("--dlnr", type=int, default=None)
    ap.add_argument("--quarantaine", help="ecrire les cles sous quarantaine dans ce fichier")
    a = ap.parse_args(argv)

    try:
        prod = json.loads(Path(a.prod).read_text(encoding="utf-8"))
        source = json.loads(Path(a.source).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(f"illisible : {e}", file=sys.stderr)
        return 3

    rec = reconcilier(prod, source, dlnr=a.dlnr)
    print(json.dumps(rec.resume(), indent=2, ensure_ascii=False))

    if a.quarantaine:
        Path(a.quarantaine).write_text(
            json.dumps({c: rec.par_categorie.get(c, []) for c in QUARANTAINE},
                       indent=2, ensure_ascii=False, sort_keys=True),
            encoding="utf-8")

    if not rec.inclusion_respectee:
        print(
            f"\nINCLUSION ROMPUE : {len(rec.absentes_du_rejeu)} cle(s) servie(s) en PROD "
            f"absente(s) du rejeu, {rec.total('CONFLICT')} conflit(s).\n"
            "L'invariant est PROD ⊆ REBUILD. Un rejeu qui perd ou contredit ce que la "
            "PROD sert deja n'est pas promouvable.", file=sys.stderr)
        return 8
    return 0


if __name__ == "__main__":
    sys.exit(main())
