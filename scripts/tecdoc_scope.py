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

Usage bibliotheque
------------------
    from tecdoc_scope import charger_perimetre

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
import hashlib
import json
import sys
from pathlib import Path

VERSIONS_SUPPORTEES = {"2026-03-reconstructed-v1", "2026-03-reconstructed-v2"}


class SceauInvalide(RuntimeError):
    """Le hash recalcule ne correspond pas au hash declare — l'artefact a ete altere."""


def _canonique(charge: dict) -> str:
    """Serialisation canonique documentee dans l'artefact lui-meme.

    Doit rester STRICTEMENT identique a celle de scripts/tecdoc-scope-build/build_scope.py,
    sinon le sceau ne se verifiera jamais.
    """
    return json.dumps(charge, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


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
        sceau = document.get("seal")
        if not sceau or "sha256" not in sceau:
            raise SceauInvalide(f"{p} ne porte aucun sceau — refus de servir ce perimetre")
        charge = {k: v for k, v in document.items() if k != "seal"}
        calcule = hashlib.sha256(_canonique(charge).encode("utf-8")).hexdigest()
        if calcule != sceau["sha256"]:
            raise SceauInvalide(
                f"sceau invalide pour {p}\n  declare  : {sceau['sha256']}\n  recalcule: {calcule}\n"
                "L'artefact a ete modifie apres scellement. Rejeu REFUSE."
            )

    return Perimetre(document, p)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _dlnr_vivants() -> list[int]:
    """Rejoue la requete vivante de load-t400-active.py, pour comparaison uniquement."""
    import os

    import psycopg2  # import tardif : la comparaison est optionnelle

    dsn = os.environ.get("DATABASE_URL")
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
