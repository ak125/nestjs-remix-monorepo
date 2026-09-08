#!/usr/bin/env python3
"""Sceau des artefacts TecDoc — une seule definition de la canonicalisation.

Deux artefacts scelles cohabitent (`massdoc-tecdoc-import-scope-2026-03.json` et
`massdoc-tecdoc-preservation-manifest-2026-03.json`), lus par trois modules et
produits par deux generateurs. La regle de canonicalisation etait donc sur le point
d'exister en quatre exemplaires ; une divergence d'un seul separateur rendrait un
sceau invalide sans que personne ne comprenne pourquoi. Elle vit ici, une fois.

Contrat, identique a celui inscrit dans les artefacts eux-memes :
  * JSON UTF-8, `sort_keys=True`, separateurs `(',', ':')`, `ensure_ascii=False` ;
  * le bloc `seal` est RETIRE avant hachage ;
  * aucun horodatage de generation dans la zone hachee — le hash est reproductible.
"""
from __future__ import annotations

import hashlib
import json


class SceauInvalide(RuntimeError):
    """Le hash recalcule ne correspond pas au hash declare — l'artefact a ete altere."""


def canonique(charge: dict) -> str:
    """Serialisation canonique de la zone hachee (sceau exclu)."""
    return json.dumps(charge, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def calculer(document: dict) -> str:
    """Hash SHA256 de la zone hachee d'un document, sceau exclu."""
    charge = {k: v for k, v in document.items() if k != "seal"}
    return hashlib.sha256(canonique(charge).encode("utf-8")).hexdigest()


def verifier(document: dict, *, source: str = "artefact") -> str:
    """Verifie le sceau d'un document deja charge. Rend le hash, ou leve.

    Fail-closed : un artefact sans sceau est refuse au meme titre qu'un artefact
    altere. L'absence de preuve n'est pas une preuve d'integrite.
    """
    sceau = document.get("seal")
    if not sceau or "sha256" not in sceau:
        raise SceauInvalide(f"{source} ne porte aucun sceau — refus de le servir")
    calcule = calculer(document)
    if calcule != sceau["sha256"]:
        raise SceauInvalide(
            f"sceau invalide pour {source}\n"
            f"  declare  : {sceau['sha256']}\n"
            f"  recalcule: {calcule}\n"
            "L'artefact a ete modifie apres scellement. Utilisation REFUSEE."
        )
    return calcule
