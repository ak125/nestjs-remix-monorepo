#!/usr/bin/env python3
"""Lecteur du perimetre TecDoc fige — remplace toute requete « DLNR actifs aujourd'hui ».

Pourquoi ce module existe
-------------------------
`load-t400-active.py` (hors git, `/opt/automecanik/data/tecdoc/`) derive son perimetre
d'une requete sur l'etat vivant de la base :

    SELECT sm.dlnr FROM __tecdoc_supplier_mapping sm
    JOIN pieces_marque pm ON pm.pm_id = sm.sup_pm_id AND pm.pm_display = '1'
    ORDER BY sm.dlnr

`pieces_marque.pm_display` est un drapeau d'AFFICHAGE COMMERCIAL. Le modifier change
donc silencieusement le perimetre d'un rejeu technique. Mesure du 2026-09-08 : cette
requete rend 109 DLNR, alors que la campagne de mars 2026 en avait projete 110.
Rejouer aujourd'hui perdrait DIEDERICHS (253) et RIDEX (6358) — 4 763 696 liaisons —
et chercherait VDO (4836), qui n'a jamais eu de shard source.

Ce module lit a la place un artefact scelle et immuable, et REFUSE de servir un
perimetre dont le sceau ne se verifie pas. Aucun repli silencieux.

Deux modes, jamais confondus
----------------------------
Les scripts du pipeline n'ont plus le droit de deviner leur perimetre. Ils declarent
lequel des deux ils veulent, et il n'existe aucun repli de l'un vers l'autre :

    --scope-mode historical --scope-file <artefact scelle>
        Rejouer mars 2026. L'artefact est OBLIGATOIRE ; son absence leve
        PerimetreManquant. Retomber sur la requete vivante rejouerait le perimetre
        de 2026-09 en croyant rejouer mars — c'est precisement le defaut a interdire.

    --scope-mode current
        Import courant, pilote par pieces_marque.pm_display. `--scope-file` y est
        REFUSE : les deux sources se contrediraient, et l'appelant croirait rejouer
        l'historique alors qu'il lit le vivant.

Usage bibliotheque
------------------
    from tecdoc_scope import charger_perimetre, resoudre_dlnr

    dlnrs = resoudre_dlnr("historical", "audit/massdoc-tecdoc-import-scope-2026-03.json")

    scope = charger_perimetre("audit/massdoc-tecdoc-import-scope-2026-03.json")
    for dlnr in scope.dlnr_projetes():      # 110 — ce que mars 2026 a projete
        ...
    scope.shard(dlnr, "400")                # {'name': '400.0021.sql', 'crc32': ...}

Usage CLI
---------
    python3 scripts/tecdoc_scope.py --scope-file audit/massdoc-tecdoc-import-scope-2026-03.json --lister projetes
    python3 scripts/tecdoc_scope.py --scope-file ... --lister charges --format csv
    python3 scripts/tecdoc_scope.py --scope-file ... --verifier
    python3 scripts/tecdoc_scope.py --scope-file ... --comparer-au-vivant  # necessite DATABASE_URL

Codes de sortie : 0 succes · 2 sceau invalide · 3 fichier illisible · 4 divergence detectee.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from tecdoc_seal import SceauInvalide, verifier as _verifier_sceau

VERSIONS_SUPPORTEES = {"2026-03-reconstructed-v1", "2026-03-reconstructed-v2"}


MODES = ("historical", "current")

#: Re-exporte depuis tecdoc_seal : le sceau a UNE seule definition, partagee avec le
#: manifeste de preservation. `except SceauInvalide` continue de fonctionner a l'identique.
__all__ = ["MODES", "SceauInvalide", "PerimetreManquant", "Perimetre",
           "charger_perimetre", "resoudre_dlnr", "ajouter_arguments_perimetre"]


class PerimetreManquant(RuntimeError):
    """Mode `historical` demande sans artefact scelle.

    On leve au lieu de retomber sur la requete vivante. Ce repli est exactement le
    defaut que le mode `historical` existe pour empecher : il rejouerait un perimetre
    de 2026-09 en croyant rejouer mars 2026.
    """


class Perimetre:
    """Perimetre TecDoc fige, scelle et verifie."""

    def __init__(self, document: dict, chemin: Path):
        self.chemin = chemin
        self._doc = document
        self.version = document["scope_version"]
        self.suppliers = document["suppliers"]

    # -- selections ---------------------------------------------------------

    def dlnr_projetes(self) -> list[int]:
        """Les DLNR qui ont REELLEMENT produit des source_linkages en mars 2026.

        C'est le perimetre a rejouer pour reproduire l'etat de mars.
        """
        return sorted(s["dlnr"] for s in self.suppliers if s["projete_en_mars_2026"])

    def dlnr_charges(self) -> list[int]:
        """Les DLNR charges dans tecdoc_raw.t400, projetes ou non.

        Sur-ensemble de dlnr_projetes() : 39 fournisseurs ont ete charges sans
        jamais etre projetes, parce que leur marque n'etait pas affichee.
        """
        return sorted(s["dlnr"] for s in self.suppliers)

    def fournisseur(self, dlnr: int) -> dict:
        for s in self.suppliers:
            if s["dlnr"] == dlnr:
                return s
        raise KeyError(f"DLNR {dlnr} absent du perimetre fige {self.version}")

    def shard(self, dlnr: int, table: str) -> dict:
        """Le shard source attendu pour ce DLNR et cette table ('400' ou '232')."""
        for f in self.fournisseur(dlnr).get("source_files_retrouves") or []:
            if f["table"] == table:
                return f
        raise KeyError(f"aucun shard {table} retrouve pour le DLNR {dlnr}")

    # -- diagnostics --------------------------------------------------------

    def divergences_connues(self) -> dict:
        """Les 5 fournisseurs dont t400 contient moins que ce que le parseur a emis."""
        return self._doc.get("preuves_parseur_sur_disque", {}).get("divergences", [])

    def comparer(self, dlnr_vivants: list[int]) -> dict:
        """Compare le perimetre fige a une liste issue de l'etat vivant."""
        fige = set(self.dlnr_projetes())
        vivant = set(dlnr_vivants)
        return {
            "fige": sorted(fige),
            "vivant": sorted(vivant),
            "communs": sorted(fige & vivant),
            "seulement_fige": sorted(fige - vivant),
            "seulement_vivant": sorted(vivant - fige),
            "identiques": fige == vivant,
        }


def charger_perimetre(chemin: str | Path, *, verifier_sceau: bool = True) -> Perimetre:
    """Charge l'artefact et verifie son sceau. Leve plutot que de servir du douteux."""
    p = Path(chemin)
    document = json.loads(p.read_text(encoding="utf-8"))

    version = document.get("scope_version")
    if version not in VERSIONS_SUPPORTEES:
        raise SceauInvalide(
            f"version de perimetre inconnue : {version!r} "
            f"(supportees : {sorted(VERSIONS_SUPPORTEES)})"
        )

    if verifier_sceau:
        _verifier_sceau(document, source=str(p))

    return Perimetre(document, p)


# ---------------------------------------------------------------------------
# Resolution du perimetre — le point d'entree des scripts du pipeline
# ---------------------------------------------------------------------------

def ajouter_arguments_perimetre(ap: argparse.ArgumentParser) -> None:
    """Ajoute `--scope-mode` et `--scope-file` a un parseur de script du pipeline.

    Mutualise pour que les 16 scripts exposent EXACTEMENT la meme surface : un mode
    divergent d'un script a l'autre serait une porte de rentree du defaut.
    """
    ap.add_argument(
        "--scope-mode", choices=MODES, required=True,
        help="historical = rejouer le perimetre fige de mars 2026 (--scope-file obligatoire) ; "
             "current = importer le perimetre commercial du jour (requete vivante). "
             "Aucune valeur par defaut : le mode doit etre choisi explicitement.",
    )
    ap.add_argument(
        "--scope-file", default=None,
        help="artefact scelle du perimetre. Obligatoire en mode historical, "
             "interdit en mode current.",
    )
    ap.add_argument(
        "--scope-selection", choices=["projetes", "charges"], default="projetes",
        help="projetes = les 110 DLNR qui ont produit des source_linkages ; "
             "charges = les 149 presents dans t400. Defaut : projetes.",
    )


def resoudre_dlnr(mode: str, scope_file: str | Path | None = None, *,
                  selection: str = "projetes", dsn: str | None = None) -> list[int]:
    """Rend la liste de DLNR a traiter, selon un mode EXPLICITE.

    C'est la fonction qui remplace `get_active_dlnrs()` dans les scripts du pipeline.

    Contrat, volontairement rigide :
      * `historical` sans `scope_file`      -> PerimetreManquant. Jamais de repli.
      * `historical` avec artefact altere   -> SceauInvalide (via charger_perimetre).
      * `historical` avec version inconnue  -> SceauInvalide.
      * `current` avec `scope_file`         -> ValueError : les deux sources se
        contrediraient, et laisser passer reviendrait a ce que l'appelant croie
        rejouer l'historique alors qu'il lit le vivant.
    """
    if mode not in MODES:
        raise ValueError(f"mode de perimetre inconnu : {mode!r} (attendus : {list(MODES)})")

    if mode == "historical":
        if not scope_file:
            raise PerimetreManquant(
                "--scope-mode historical exige --scope-file.\n"
                "Refus de deriver le perimetre de l'etat vivant : pieces_marque.pm_display "
                "a change depuis mars 2026, un rejeu ainsi pilote perdrait DIEDERICHS (253) "
                "et RIDEX (6358) et chercherait VDO (4836), qui n'a aucun shard source."
            )
        scope = charger_perimetre(scope_file)
        return scope.dlnr_projetes() if selection == "projetes" else scope.dlnr_charges()

    if scope_file:
        raise ValueError(
            "--scope-file est interdit avec --scope-mode current : l'artefact decrit "
            "mars 2026, la requete vivante decrit aujourd'hui. Choisir l'un des deux."
        )
    return _dlnr_vivants(dsn)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _dlnr_vivants(dsn: str | None = None) -> list[int]:
    """Rejoue la requete vivante de load-t400-active.py.

    Legitime pour un import courant et pour la comparaison ; JAMAIS pour un rejeu
    historique — c'est `resoudre_dlnr` qui fait respecter cette distinction.
    """
    import os

    import psycopg2  # import tardif : la comparaison est optionnelle

    dsn = dsn or os.environ.get("DATABASE_URL")
    if not dsn:
        raise SystemExit("DATABASE_URL absent de l'environnement — comparaison impossible")
    with psycopg2.connect(dsn) as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT sm.dlnr FROM __tecdoc_supplier_mapping sm "
            "JOIN pieces_marque pm ON pm.pm_id = sm.sup_pm_id AND pm.pm_display = '1' "
            "ORDER BY sm.dlnr"
        )
        return [r[0] for r in cur.fetchall()]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--scope-file", required=True, help="chemin de l'artefact scelle")
    ap.add_argument("--lister", choices=["projetes", "charges"],
                    help="ecrire la liste de DLNR sur la sortie standard")
    ap.add_argument("--format", choices=["lignes", "csv", "json"], default="lignes")
    ap.add_argument("--verifier", action="store_true", help="verifier le sceau et sortir")
    ap.add_argument("--comparer-au-vivant", action="store_true",
                    help="comparer a la requete pm_display='1' (necessite DATABASE_URL)")
    a = ap.parse_args(argv)

    try:
        scope = charger_perimetre(a.scope_file)
    except SceauInvalide as e:
        print(f"REFUS : {e}", file=sys.stderr)
        return 2
    except (OSError, json.JSONDecodeError) as e:
        print(f"illisible : {e}", file=sys.stderr)
        return 3

    if a.verifier:
        print(f"sceau valide · version {scope.version} · "
              f"{len(scope.dlnr_charges())} DLNR charges · "
              f"{len(scope.dlnr_projetes())} projetes")
        return 0

    if a.comparer_au_vivant:
        d = scope.comparer(_dlnr_vivants())
        print(json.dumps(d, indent=2))
        if not d["identiques"]:
            print(f"\nDIVERGENCE : {len(d['seulement_fige'])} DLNR seulement dans le fige, "
                  f"{len(d['seulement_vivant'])} seulement dans le vivant.", file=sys.stderr)
            return 4
        return 0

    if a.lister:
        vals = scope.dlnr_projetes() if a.lister == "projetes" else scope.dlnr_charges()
        if a.format == "lignes":
            print("\n".join(map(str, vals)))
        elif a.format == "csv":
            print(",".join(map(str, vals)))
        else:
            print(json.dumps(vals))
        return 0

    ap.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
