#!/usr/bin/env python3
"""Rejeu TecDoc par vagues — empreinte disque bornee, preuve conservee.

POURQUOI DES VAGUES
-------------------
Materialiser les 110 DLNR simultanement demanderait ~250 Go. Or l'invariant a
demontrer — `PROD actuelle ⊆ REBUILD source-truth`, sans perte de ligne ni derive
d'identite — se verifie DLNR par DLNR. On rejoue donc un fournisseur, on le
reconcilie, on scelle la preuve, **puis on jette la matiere**. Le pic disque devient
celui du plus gros DLNR seul, pas leur somme.

Ce qui est conserve n'est pas la donnee : c'est le REGISTRE DE PREUVE. Il porte, par
DLNR, la comptabilite complete, l'empreinte du contenu charge et le verdict de
reconciliation. Il est scelle : une preuve qu'on peut reecrire n'en est pas une.

CE QUE CE SCRIPT DEMONTRE, ET RIEN DE PLUS
------------------------------------------
Au niveau RAW (`tecdoc_raw.t400`) : aucune ligne source n'est perdue, la PROD est
incluse dans le rejeu, les registres d'identite ne bougent pas, les 9 ensembles figes
sont intacts. C'est exactement la ou la perte de mars 2026 s'est produite.

Il ne demontre RIEN sur la projection `source_linkages` : aucun projecteur verifie
n'existe a ce jour (les projecteurs historiques sont en quarantaine, dont celui qui a
pollue `pieces_relation_type` de ~219 M lignes fantomes). Ce sera un chantier separe.
Annoncer ici une preuve de projection serait le vert-mais-faux que ce pipeline combat.

FAIL-CLOSED
-----------
Toute anomalie arrete la vague, **sans purger le DLNR fautif** : sa matiere reste en
base pour le diagnostic. Un DLNR n'est purge que lorsque sa preuve est ecrite.

Codes de sortie
  0 vague conforme · 3 illisible · 5 comptabilite · 6 identite
  7 conservation · 8 inclusion rompue · 9 purge non confirmee
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

from tecdoc_identity_guard import IdentiteViolee
from tecdoc_preservation import ConservationRompue
from tecdoc_replay_controls import (controle_conservation, controle_identite,
                                    controle_reconciliation)
from tecdoc_seal import calculer as sceller

ICI = Path(__file__).resolve().parent

#: Empreinte du contenu charge pour un lot. Survit a la purge : c'est elle qui rend
#: la preuve verifiable une fois la matiere jetee, et qui permet de constater qu'un
#: second rejeu produit exactement le meme contenu.
REQUETE_EMPREINTE = """
    SELECT count(*), min(_source_row_no), max(_source_row_no),
           md5(string_agg(_source_row_no || ':' || _raw_hash, ',' ORDER BY _source_row_no))
    FROM tecdoc_raw.t400 WHERE _batch_id = %s"""


class VagueInterrompue(RuntimeError):
    """Anomalie fatale. La matiere du DLNR en cause est CONSERVEE pour diagnostic."""


def _psy():
    import psycopg2
    return psycopg2


def rejouer_dlnr(*, dlnr: int, scope_file: str, cible_dsn: str, workdir: Path,
                 archive: str | None) -> dict:
    """Appelle le chemin canonique. Son code de sortie fait foi, jamais sa sortie texte."""
    cmd = [sys.executable, str(ICI / "tecdoc_replay.py"),
           "--scope-mode", "historical", "--scope-file", scope_file,
           "--dlnr", str(dlnr), "--table", "400",
           "--cible-dsn", cible_dsn, "--workdir", str(workdir), "--json"]
    if archive:
        cmd += ["--archive", archive]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise VagueInterrompue(
            f"DLNR {dlnr} : chargement refuse (code {r.returncode}).\n"
            f"{(r.stderr or '').strip()[-800:]}")
    return json.loads(r.stdout)


def empreinte_lot(cible_dsn: str, batch_id: str) -> dict:
    with _psy().connect(cible_dsn) as conn, conn.cursor() as cur:
        cur.execute(REQUETE_EMPREINTE, (batch_id,))
        n, bmin, bmax, md5 = cur.fetchone()
    return {"lignes": n, "borne_min": bmin, "borne_max": bmax, "empreinte_md5": md5}


def purger_lot(cible_dsn: str, batch_id: str) -> None:
    """Retire la matiere du lot de la base JETABLE, puis VERIFIE qu'elle est partie.

    `VACUUM` simple (jamais FULL) rend l'espace reutilisable par le DLNR suivant : la
    table se stabilise au niveau du plus gros fournisseur, pas de leur somme.
    """
    conn = _psy().connect(cible_dsn)
    try:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute("DELETE FROM tecdoc_raw.t400 WHERE _batch_id = %s", (batch_id,))
            cur.execute("SELECT count(*) FROM tecdoc_raw.t400 WHERE _batch_id = %s",
                        (batch_id,))
            reste = cur.fetchone()[0]
            if reste:
                raise VagueInterrompue(
                    f"purge non confirmee : {reste} ligne(s) subsistent pour {batch_id}.")
            cur.execute("VACUUM (ANALYZE) tecdoc_raw.t400")
    finally:
        conn.close()


def charger_registre(chemin: Path) -> dict:
    if chemin.exists():
        return json.loads(chemin.read_text(encoding="utf-8"))
    return {"objet": "Registre de preuve du rejeu TecDoc par vagues.",
            "invariant": "PROD actuelle ⊆ REBUILD source-truth, sans perte de ligne "
                         "ni derive d'identite.",
            "portee": "RAW (tecdoc_raw.t400) uniquement. Aucune preuve de projection.",
            "entrees": []}


def ecrire_registre(chemin: Path, registre: dict) -> None:
    registre.pop("seal", None)
    registre["seal"] = {"algorithm": "sha256",
                        "canonicalization": "sort_keys, UTF-8, separateurs (',',':'), "
                                            "bloc seal exclu.",
                        "sha256": sceller(registre)}
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(json.dumps(registre, ensure_ascii=False, indent=2, sort_keys=True)
                      + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--lot", type=int, required=True, help="index du lot dans le plan")
    ap.add_argument("--plan", default=str(ICI / "tecdoc-replay" / "plan-lots.json"))
    ap.add_argument("--scope-file", required=True)
    ap.add_argument("--cible-dsn", required=True, help="base JETABLE du rebuild")
    ap.add_argument("--reference-dsn", required=True, help="base de reference, LUE seule")
    ap.add_argument("--manifeste", required=True, help="manifeste de conservation scelle")
    ap.add_argument("--workdir", required=True)
    ap.add_argument("--registre", required=True, help="registre de preuve (JSON scelle)")
    ap.add_argument("--archive", default=None)
    ap.add_argument("--conserver", action="store_true",
                    help="ne pas purger apres preuve — reserve au diagnostic, "
                         "fait exploser l'empreinte disque.")
    args = ap.parse_args(argv)

    try:
        plan = json.loads(Path(args.plan).read_text(encoding="utf-8"))
        lot = plan["lots"][args.lot]
    except (OSError, json.JSONDecodeError, IndexError, KeyError) as e:
        print(f"PLAN ILLISIBLE : {e}", file=sys.stderr)
        return 3

    registre_path = Path(args.registre)
    registre = charger_registre(registre_path)
    deja = {e["dlnr"]: e for e in registre["entrees"]}
    workdir = Path(args.workdir)

    print(f"=== {lot['nom']} — {lot['nombre']} DLNR, "
          f"{lot['lignes_source_attendues']:,} lignes source attendues ===")
    if lot.get("divergents_inclus"):
        print(f"    divergents : {', '.join(lot['divergents_inclus'])}")

    traites = 0
    try:
        for dlnr in lot["dlnr"]:
            if dlnr in deja:
                print(f"  · DLNR {dlnr} : deja prouve, ignore (registre)")
                continue

            resultat = rejouer_dlnr(dlnr=dlnr, scope_file=args.scope_file,
                                    cible_dsn=args.cible_dsn, workdir=workdir,
                                    archive=args.archive)
            emp = empreinte_lot(args.cible_dsn, resultat["batch_id"])

            rec = controle_reconciliation(reference_dsn=args.reference_dsn,
                                          rejeu_dsn=args.cible_dsn, dlnr=dlnr)
            if not rec["inclusion_respectee"]:
                raise VagueInterrompue(
                    f"DLNR {dlnr} : INCLUSION ROMPUE — la reference sert des lignes que "
                    f"le rejeu ne reproduit pas, ou en contredit le contenu.\n"
                    f"{json.dumps(rec, ensure_ascii=False, indent=2)}")

            identite = controle_identite(reference_dsn=args.reference_dsn,
                                         rejeu_dsn=args.cible_dsn, dlnr=dlnr)

            registre["entrees"].append({
                "dlnr": dlnr,
                "fichier": resultat["fichier"],
                "batch_id": resultat["batch_id"],
                # Les deux entrees qui, avec la table et le DLNR, PRODUISENT le
                # batch_id. Les consigner rend l'identite du lot recalculable par un
                # tiers ; sans elles le registre demande qu'on le croie sur parole.
                "source": {"crc32": resultat["crc32"],
                           "version_perimetre": resultat["version_perimetre"]},
                "comptabilite": {"rows_emitted": resultat["emis"],
                                 "rows_loaded": resultat["charges"],
                                 "rows_deduplicated": resultat["dedoublonnes"],
                                 "rows_rejected": resultat["rejets"]},
                "empreinte_du_charge": emp,
                "reconciliation": rec,
                "identite": [str(r) for r in identite],
            })
            ecrire_registre(registre_path, registre)   # preuve ecrite AVANT la purge

            if args.conserver:
                print(f"  ✓ DLNR {dlnr} : {resultat['charges']:,} lignes — matiere conservee")
            else:
                purger_lot(args.cible_dsn, resultat["batch_id"])
                print(f"  ✓ DLNR {dlnr} : {resultat['charges']:,} lignes prouvees "
                      f"(md5 {emp['empreinte_md5'][:12]}…) puis purgees")
            traites += 1

        print()
        print("=== controle de conservation (9 ensembles figes) ===")
        n = controle_conservation(manifeste_path=args.manifeste,
                                  reference_dsn=args.reference_dsn)
        print(f"  ✓ {n} ensembles intacts")
        registre["conservation"] = {"ensembles_verifies": n, "lot": lot["nom"]}
        ecrire_registre(registre_path, registre)

    except VagueInterrompue as e:
        print(f"\nVAGUE INTERROMPUE\n{e}", file=sys.stderr)
        print("La matiere du DLNR en cause est CONSERVEE pour diagnostic.", file=sys.stderr)
        return 8
    except IdentiteViolee as e:
        print(f"\nIDENTITE VIOLEE\n{e}", file=sys.stderr)
        return 6
    except ConservationRompue as e:
        print(f"\nCONSERVATION ROMPUE\n{e}", file=sys.stderr)
        return 7
    except Exception as e:  # noqa: BLE001 — on nomme la cause, on ne la ravale pas
        print(f"\nECHEC : {type(e).__name__}: {e}", file=sys.stderr)
        return 3

    print()
    print(f"LOT CONFORME — {traites} DLNR prouves, registre scelle "
          f"{registre['seal']['sha256'][:16]}…")
    print(f"  {registre_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
