#!/usr/bin/env python3
"""Porte de controle du rejeu TecDoc — a franchir AVANT toute projection.

Le chargement (`tecdoc_replay.py`) prouve qu'aucune ligne n'a ete perdue. Cette porte
prouve les trois autres proprietes exigees avant qu'une donnee rejouee ne touche quoi
que ce soit d'applicatif :

  identite      aucun identifiant deja attribue n'est modifie ni reattribue
  conservation  aucun ensemble applicatif de mars 2026 n'a bouge
  reconciliation PROD actuelle est INCLUSE dans le rejeu source-truth, et tout ce que
                le rejeu ajoute part en QUARANTAINE

Les lectures de la base de reference (MassDoc PROD) sont exclusivement des SELECT.
Aucune ecriture, aucun DDL, aucune migration n'est emise vers elle.

Codes de sortie :
  0 porte franchie · 2 sceau invalide · 3 illisible
  6 identite violee · 7 conservation rompue · 8 activation interdite / inclusion rompue
"""

from __future__ import annotations

import argparse
import json
import sys

from tecdoc_identity_guard import (REGISTRES_PROTEGES, IdentiteViolee,
                                   verifier_mapping)
from tecdoc_preservation import (ConservationRompue, charger_manifeste, mesurer,
                                 verifier)
from tecdoc_reconcile import ActivationInterdite, a_activer, reconcilier
from tecdoc_scope import SceauInvalide

#: Cle naturelle de chaque registre protege : (requete, colonne cle, colonne identite).
#: Une entree par registre — pas de derivation, meme motif que `tecdoc_preservation`.
LECTURES_REGISTRES = {
    "tecdoc_map.type_id_remap":
        "SELECT old_id::text, new_id::text FROM tecdoc_map.type_id_remap",
    "tecdoc_map.modele_id_remap":
        "SELECT old_id::text, new_id::text FROM tecdoc_map.modele_id_remap",
    "tecdoc_map.pg_id_remap":
        "SELECT old_id::text, new_id::text FROM tecdoc_map.pg_id_remap",
    "tecdoc_map.gamme_registry":
        "SELECT pg_id_source::text, pg_id::text FROM tecdoc_map.gamme_registry "
        "WHERE pg_id IS NOT NULL",
    "tecdoc_map.linkage_target_registry":
        "SELECT id::text, target_key::text FROM tecdoc_map.linkage_target_registry",
    # Filtre par DLNR : le registre porte 3,24 M d'ancrages, dont seul le fournisseur
    # rejoue est en jeu. Le lire en entier des deux cotes n'apprendrait rien de plus.
    "tecdoc_map.article_registry":
        "SELECT source_artnr::text, piece_id::text FROM tecdoc_map.article_registry "
        "WHERE source_dlnr::text = %(dlnr)s",
}


def _lire(dsn: str, requete: str, params: dict | None = None) -> dict:
    """Rend {cle: identite}. LECTURE SEULE."""
    import psycopg2
    with psycopg2.connect(dsn) as conn, conn.cursor() as cur:
        cur.execute("SET statement_timeout = 250000")
        cur.execute(requete, params)
        return {str(k): (None if v is None else str(v)) for k, v in cur.fetchall()}


def controle_identite(*, reference_dsn: str, rejeu_dsn: str, dlnr: int | None = None,
                      registres: tuple = REGISTRES_PROTEGES) -> list:
    """Compare les registres du rejeu a ceux de la reference. Leve au premier ecart.

    Un registre que le rejeu n'a pas encore peuple rend `non_applicable`, jamais `OK` :
    tant qu'aucune projection n'a tourne, il n'y a rien a comparer, et l'annoncer
    conforme reviendrait a faire passer une absence de controle pour un controle.
    """
    rapports = []
    for registre in registres:
        requete = LECTURES_REGISTRES.get(registre)
        if requete is None:
            raise KeyError(
                f"{registre} est protege mais aucune lecture n'est definie pour lui. "
                "Ajouter la requete explicitement plutot que de deviner sa cle : un "
                "registre non controle est un registre ou l'identite peut deriver."
            )
        params = {"dlnr": str(dlnr)} if "%(dlnr)s" in requete else None
        if params is None and "%(dlnr)s" in requete:
            raise ValueError(f"{registre} exige --dlnr")
        propose = _lire(rejeu_dsn, requete, params)
        if not propose:
            rapports.append(f"{registre} : non_applicable — le rejeu n'a produit "
                            "aucune entree (aucune projection n'a encore tourne)")
            continue
        rapports.append(verifier_mapping(_lire(reference_dsn, requete, params), propose,
                                         registre=registre))
    return rapports


def controle_conservation(*, manifeste_path: str, reference_dsn: str) -> int:
    """Verifie que les ensembles applicatifs figes n'ont pas bouge en reference."""
    manifeste = charger_manifeste(manifeste_path)
    return verifier(manifeste, mesurer(manifeste, reference_dsn))


def _lignes_t400(dsn: str, dlnr: int, *, schema: str = "tecdoc_raw") -> dict:
    """{numero de ligne source: empreinte de ligne} pour un DLNR."""
    import psycopg2
    with psycopg2.connect(dsn) as conn, conn.cursor() as cur:
        cur.execute("SET statement_timeout = 250000")
        cur.execute(
            f"SELECT _source_row_no::text, _raw_hash FROM {schema}.t400 WHERE col_2 = %s",
            (str(dlnr),))
        return {k: v for k, v in cur.fetchall()}


def controle_reconciliation(*, reference_dsn: str, rejeu_dsn: str, dlnr: int) -> dict:
    """Classe chaque ligne et REFUSE toute activation de la quarantaine."""
    rec = reconcilier(_lignes_t400(reference_dsn, dlnr),
                      _lignes_t400(rejeu_dsn, dlnr), dlnr=dlnr)
    resume = rec.resume()
    resume["activables_sans_decision_humaine"] = len(a_activer(rec))
    return resume


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--reference-dsn", required=True,
                    help="base de reference, LUE uniquement (MassDoc PROD).")
    ap.add_argument("--rejeu-dsn", required=True, help="base jetable du rejeu.")
    ap.add_argument("--manifeste", default=None,
                    help="manifeste de preservation scelle (controle conservation).")
    ap.add_argument("--dlnr", type=int, default=None,
                    help="fournisseur a reconcilier.")
    ap.add_argument("--controles", default="identite,conservation,reconciliation",
                    help="sous-ensemble a executer, separe par des virgules.")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args(argv)

    demandes = [c.strip() for c in args.controles.split(",") if c.strip()]
    inconnus = set(demandes) - {"identite", "conservation", "reconciliation"}
    if inconnus:
        ap.error(f"controle(s) inconnu(s) : {sorted(inconnus)}")

    rapport: dict = {}
    try:
        if "identite" in demandes:
            rapports = controle_identite(reference_dsn=args.reference_dsn,
                                         rejeu_dsn=args.rejeu_dsn, dlnr=args.dlnr)
            rapport["identite"] = [str(r) for r in rapports]

        if "conservation" in demandes:
            if not args.manifeste:
                print("CONSERVATION : --manifeste est obligatoire pour ce controle. "
                      "Refus de le declarer passe sans l'avoir execute.", file=sys.stderr)
                return 3
            rapport["conservation"] = (
                f"{controle_conservation(manifeste_path=args.manifeste, reference_dsn=args.reference_dsn)}"
                " ensembles figes intacts")

        if "reconciliation" in demandes:
            if args.dlnr is None:
                print("RECONCILIATION : --dlnr est obligatoire pour ce controle.",
                      file=sys.stderr)
                return 3
            resume = controle_reconciliation(reference_dsn=args.reference_dsn,
                                             rejeu_dsn=args.rejeu_dsn, dlnr=args.dlnr)
            rapport["reconciliation"] = resume
            if not resume["inclusion_respectee"]:
                print("INCLUSION ROMPUE — la reference sert des lignes que le rejeu ne "
                      "reproduit pas, ou en contredit le contenu.\n"
                      f"{json.dumps(resume, ensure_ascii=False, indent=2)}", file=sys.stderr)
                return 8

    except SceauInvalide as e:
        print(f"SCEAU INVALIDE : {e}", file=sys.stderr)
        return 2
    except IdentiteViolee as e:
        print(f"IDENTITE VIOLEE\n{e}", file=sys.stderr)
        return 6
    except ConservationRompue as e:
        print(f"CONSERVATION ROMPUE\n{e}", file=sys.stderr)
        return 7
    except ActivationInterdite as e:
        print(f"ACTIVATION INTERDITE\n{e}", file=sys.stderr)
        return 8

    if args.json:
        print(json.dumps(rapport, ensure_ascii=False, indent=2, sort_keys=True))
    else:
        for cle, val in rapport.items():
            print(f"OK  {cle}")
            for ligne in (val if isinstance(val, list) else [val]):
                print(f"      {ligne}" if not isinstance(ligne, dict)
                      else json.dumps(ligne, ensure_ascii=False, indent=6))
    return 0


if __name__ == "__main__":
    sys.exit(main())
