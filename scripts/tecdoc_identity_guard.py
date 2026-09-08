#!/usr/bin/env python3
"""Garde d'identite TecDoc — un identifiant attribue ne se reattribue jamais.

Ce que cette garde protege
--------------------------
La campagne de mars 2026 a cree des entites applicatives qui sont aujourd'hui SERVIES
et INDEXEES : 23 457 types vehicule (auto_type 60000-83456), 7 088 modeles,
119 702 pieces, 876 gammes (pieces_gamme 60000-61103). Leurs identifiants sont
references par des URL, des relations, des medias et des mappings.

Un rejeu qui recalculerait ces identifiants « proprement » les renumeroterait. Les URL
casseraient, les relations pointeraient a cote, et le mal serait fait avant qu'un
humain le voie. Le risque n'est pas theorique : la copie DEV de `fix-vehicles-massdoc.py`
(anterieure a la version versionnee) contient
`DROP TABLE IF EXISTS tecdoc_map.modele_id_remap` suivi d'un CREATE + INSERT qui
reattribue les identifiants de modele par ROW_NUMBER.

Les trois interdits, verifies separement
----------------------------------------
1. DERIVE      — une cle deja mappee change d'identifiant interne.
2. REEMPLOI    — un identifiant deja pris par une cle est propose pour une AUTRE cle.
3. COLLISION   — une cle nouvelle recoit un identifiant deja attribue.

Une cle nouvelle qui recoit un identifiant libre est LEGITIME : c'est ainsi qu'un rejeu
source-truth ajoute ce que le chargement de mars avait perdu. La garde ne s'y oppose pas.

Une cle qui DISPARAIT du mapping propose n'est pas une violation d'identite en soi
(le rejeu peut etre partiel), mais elle est signalee : `absentes`. C'est au verificateur
de conservation (`tecdoc_preservation.py`) de dire si cette absence est acceptable.

Usage
-----
    from tecdoc_identity_guard import verifier_mapping, IdentiteViolee

    existant = {"KTYP:12345": 60050, "KTYP:12346": 60051}
    propose  = {"KTYP:12345": 60050, "KTYP:12346": 60051, "KTYP:99999": 83457}
    rapport  = verifier_mapping(existant, propose)   # OK, 1 ajout

    verifier_mapping(existant, {"KTYP:12345": 70000})   # leve : DERIVE

Codes de sortie CLI : 0 conforme · 3 fichier illisible · 6 identite violee.
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path


class IdentiteViolee(RuntimeError):
    """Un identifiant deja attribue serait modifie ou reattribue — rejeu REFUSE."""


@dataclass(frozen=True)
class RapportIdentite:
    """Resultat d'une comparaison de mappings. N'existe que si aucun interdit n'est viole."""

    registre: str
    conservees: int
    ajoutees: int
    absentes: tuple

    def __str__(self) -> str:
        s = (f"{self.registre} : {self.conservees} identites conservees, "
             f"{self.ajoutees} nouvelles")
        if self.absentes:
            s += f", {len(self.absentes)} absentes du rejeu"
        return s


def verifier_mapping(existant: dict, propose: dict, *,
                     registre: str = "mapping") -> RapportIdentite:
    """Verifie qu'aucune identite deja attribuee n'est modifiee ni reattribuee.

    Args:
        existant: mapping en place, {cle source: identifiant interne}.
        propose: mapping que le rejeu produirait.
        registre: nom du registre, pour les messages.

    Returns:
        RapportIdentite si les trois interdits sont respectes.

    Raises:
        IdentiteViolee: derive, reemploi ou collision. Ne jamais « corriger » en
            alignant l'existant sur le propose : c'est l'existant qui fait foi.
    """
    derives = [
        (cle, existant[cle], propose[cle])
        for cle in existant
        if cle in propose and propose[cle] != existant[cle]
    ]
    if derives:
        detail = "\n".join(
            f"    {cle} : {avant} -> {apres}" for cle, avant, apres in derives[:10]
        )
        suite = f"\n    … et {len(derives) - 10} autres" if len(derives) > 10 else ""
        raise IdentiteViolee(
            f"{registre} : DERIVE — {len(derives)} identite(s) deja attribuee(s) "
            f"changeraient de valeur.\n{detail}{suite}\n"
            "STOP. Ces identifiants sont references par des URL, des relations et des "
            "medias en production. L'existant fait foi, jamais le recalcul."
        )

    #: identifiant -> cle, pour l'existant. Sert a detecter reemploi et collision.
    par_id = {}
    for cle, ident in existant.items():
        par_id.setdefault(ident, cle)

    reemplois, collisions = [], []
    for cle, ident in propose.items():
        if cle in existant:
            continue
        proprietaire = par_id.get(ident)
        if proprietaire is None:
            continue
        (reemplois if proprietaire != cle else collisions).append((cle, ident, proprietaire))

    if reemplois or collisions:
        lignes = "\n".join(
            f"    identifiant {ident} appartient deja a {ancien}, propose pour {cle}"
            for cle, ident, ancien in (reemplois + collisions)[:10]
        )
        raise IdentiteViolee(
            f"{registre} : REEMPLOI — {len(reemplois) + len(collisions)} identifiant(s) "
            f"deja attribue(s) seraient donnes a une autre entite.\n{lignes}\n"
            "STOP. Reutiliser un identifiant fait pointer d'anciennes references vers "
            "une entite differente — la corruption la plus difficile a detecter."
        )

    return RapportIdentite(
        registre=registre,
        conservees=sum(1 for c in existant if c in propose),
        ajoutees=sum(1 for c in propose if c not in existant),
        absentes=tuple(sorted(c for c in existant if c not in propose)),
    )


REGISTRES_PROTEGES = (
    "tecdoc_map.type_id_remap",
    "tecdoc_map.article_registry",
    "tecdoc_map.linkage_target_registry",
    "tecdoc_map.pg_id_remap",
    "tecdoc_map.modele_id_remap",
)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--existant", required=True, help="JSON {cle: id} en place")
    ap.add_argument("--propose", required=True, help="JSON {cle: id} que le rejeu produirait")
    ap.add_argument("--registre", default="mapping")
    a = ap.parse_args(argv)

    try:
        existant = json.loads(Path(a.existant).read_text(encoding="utf-8"))
        propose = json.loads(Path(a.propose).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(f"illisible : {e}", file=sys.stderr)
        return 3

    try:
        rapport = verifier_mapping(existant, propose, registre=a.registre)
    except IdentiteViolee as e:
        print(f"REFUS :\n{e}", file=sys.stderr)
        return 6

    print(rapport)
    if rapport.absentes:
        print(f"\nAVERTISSEMENT : {len(rapport.absentes)} cle(s) absente(s) du rejeu. "
              "L'identite n'est pas violee, mais la conservation doit etre verifiee "
              "separement (scripts/tecdoc_preservation.py).", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
