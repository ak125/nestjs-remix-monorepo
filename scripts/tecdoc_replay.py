#!/usr/bin/env python3
"""Rejeu TecDoc fail-closed — extraction, analyse, chargement et controles.

Chemin canonique du rejeu. Remplace `load-t400-active.py`, conserve en quarantaine
sous `tecdoc-pipeline/` a titre forensique, dont il corrige les trois defauts qui ont
rendu la perte de mars 2026 invisible :

  1. L'exception avalee (`except Exception: log(...)`) laissait le script rendre le
     nombre de lignes deja committees comme s'il s'agissait d'un succes.
  2. `autocommit = True` committait chaque COPY : un arret en cours de fichier laissait
     un PREFIXE de lignes en base, definitivement pris pour un chargement complet.
  3. Aucune comparaison entre ce que le parseur avait emis et ce qui etait arrive en
     base. `rows_emitted=9357752` et `69000` lignes chargees coexistaient sans alerte.

Ici : une seule transaction par lot, la comptabilite verifiee AVANT le commit, et
toute anomalie leve. Un lot qui ne se solde pas n'est jamais committe.

Etats possibles d'une ligne source — il n'y en a pas de cinquieme :
  charge · dedoublonne · rejete(raison nommee) · fatal (leve, rien n'est committe)

Usage :
  tecdoc_replay.py --scope-mode historical --scope-file <artefact scelle> \\
                   --dlnr 4523 --table 400 --cible-dsn <dsn jetable>

Codes de sortie :
  0 rejeu conforme · 2 sceau invalide · 3 artefact/source illisible
  4 perimetre refuse · 5 comptabilite incoherente · 9 integrite de lot rompue
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import os
import subprocess
import sys
import zlib
from dataclasses import dataclass, field
from pathlib import Path

from tecdoc_load_guard import Bilan, ComptabiliteIncoherente, verifier_lot
from tecdoc_scope import (SceauInvalide, ajouter_arguments_perimetre,
                          charger_perimetre, resoudre_dlnr)

#: Les quatre etats d'une ligne source. Toute branche qui ignore une ligne doit en
#: choisir un — c'est ce qui interdit le « skip » silencieux.
ETATS = ("charge", "dedoublonne", "rejete", "fatal")

ARCHIVE_DEFAUT = "/opt/automecanik/app/.github/SQL-CONVERTED.7z"
PARSEUR_DEFAUT = "/opt/automecanik/app/scripts/tecdoc-mysql-to-csv.py"

#: Colonnes ecrites par le COPY. `_loaded_at` est volontairement ABSENTE : la colonne
#: porte `DEFAULT now()`, et le loader historique la neutralisait en poussant un NULL
#: explicite (un NULL fourni ecrase le defaut). En ne la citant pas, le defaut
#: s'applique et chaque lot devient datable.
COLONNES_COPY = ["col_1", "col_2", "col_3", "col_4", "col_5", "col_6", "col_7", "col_8",
                 "_source_filename", "_batch_id", "_source_row_no", "_raw_hash"]

#: Position des champs dans le CSV du parseur : 8 colonnes metier puis
#: _source_filename, _batch_id (vide), _loaded_at (vide), _source_row_no, _raw_hash.
CHAMPS_METIER = 8
IDX_FICHIER, IDX_ROW_NO, IDX_HASH = 8, 11, 12
CHAMPS_ATTENDUS = 13


class RejeuFatal(RuntimeError):
    """Anomalie qui interdit de committer. Jamais rattrapee pour continuer."""


class IntegriteLotRompue(RejeuFatal):
    """Ce qui est en base ne correspond pas a ce que le lot pretend avoir charge."""


class PerimetreRefuse(RejeuFatal):
    """Le DLNR demande n'appartient pas au perimetre resolu."""


@dataclass
class Lot:
    """Un couple (table, DLNR) traverse le rejeu. Immuable une fois solde."""

    dlnr: int
    table: str
    fichier: str
    batch_id: str
    emis: int = 0
    charges: int = 0
    dedoublonnes: int = 0
    rejets: dict = field(default_factory=dict)
    numeros_rejetes: set = field(default_factory=set)
    bilan: Bilan | None = None

    def rejeter(self, raison: str, numero: int | None) -> None:
        """Enregistre un rejet MOTIVE. Aucune ligne ne disparait sans raison nommee."""
        self.rejets[raison] = self.rejets.get(raison, 0) + 1
        if numero is not None:
            self.numeros_rejetes.add(numero)


# ---------------------------------------------------------------------------
# Identite de lot — la cle d'idempotence
# ---------------------------------------------------------------------------

def batch_id(*, dlnr: int, table: str, crc32: str, version_perimetre: str) -> str:
    """Identifiant DETERMINISTE d'un lot : meme source + meme perimetre = meme id.

    Sert a repondre a « ce lot est-il deja charge ? » sans compter des lignes ni
    interroger `DISTINCT col_2`, qui repondait « oui » des la premiere ligne presente
    et a fige les chargements tronques de mars 2026 (un DLNR partiel n'etait jamais
    retente). La colonne `_batch_id` existe depuis l'origine et n'a jamais ete ecrite.
    """
    graine = f"{table}|{dlnr}|{crc32.lower()}|{version_perimetre}"
    return hashlib.sha256(graine.encode("utf-8")).hexdigest()[:32]


# ---------------------------------------------------------------------------
# Etape 1 — extraction, verifiee contre le sceau
# ---------------------------------------------------------------------------

def crc32_fichier(chemin: Path) -> str:
    """CRC32 au format de l'index 7z (8 hexa majuscules)."""
    somme = 0
    with chemin.open("rb") as f:
        for bloc in iter(lambda: f.read(1 << 20), b""):
            somme = zlib.crc32(bloc, somme)
    return f"{somme & 0xFFFFFFFF:08X}"


def etape_extraire(*, dlnr: int, table: str, perimetre, archive: str,
                   workdir: Path) -> tuple[Path, dict]:
    """Extrait le shard et VERIFIE son CRC32 contre l'artefact scelle.

    Une source qui ne correspond pas au sceau n'est pas la source de mars 2026 :
    rejouer dessus produirait un resultat qu'on croirait comparable et qui ne l'est pas.
    """
    shard = perimetre.shard(dlnr, table)
    nom = shard["name"]
    workdir.mkdir(parents=True, exist_ok=True)
    cible = workdir / nom

    if not cible.exists():
        r = subprocess.run(["7z", "e", "-y", f"-o{workdir}", archive, nom],
                           capture_output=True, timeout=600)
        if r.returncode != 0:
            raise RejeuFatal(f"extraction de {nom} echouee (code {r.returncode}) : "
                             f"{r.stderr.decode('utf-8', 'replace')[:300]}")
    if not cible.exists():
        raise RejeuFatal(f"{nom} absent apres extraction — source introuvable, STOP.")

    obtenu = crc32_fichier(cible)
    attendu = str(shard["crc32"]).upper()
    if obtenu != attendu:
        raise RejeuFatal(
            f"{nom} : CRC32 {obtenu} != {attendu} scelle dans le perimetre.\n"
            "La source ne correspond pas a celle de mars 2026 — rejeu refuse."
        )
    taille = cible.stat().st_size
    if taille != shard["size"]:
        raise RejeuFatal(f"{nom} : taille {taille} != {shard['size']} scellee.")
    return cible, shard


# ---------------------------------------------------------------------------
# Etape 2 — analyse
# ---------------------------------------------------------------------------

def lire_meta(chemin: Path) -> dict:
    """Lit le .meta du parseur. Son absence est FATALE : sans `rows_emitted`, la
    comptabilite n'a pas de terme gauche et la garde ne peut rien prouver."""
    if not chemin.exists():
        raise RejeuFatal(f"{chemin.name} absent : le parseur n'a pas rendu de compte "
                         "d'emission. Sans lui, aucun ecart n'est demontrable — STOP.")
    meta: dict = {}
    for ligne in chemin.read_text(encoding="utf-8").splitlines():
        if "=" in ligne:
            cle, _, val = ligne.partition("=")
            meta[cle.strip()] = int(val) if val.strip().lstrip("-").isdigit() else val.strip()
    for requis in ("rows_parsed", "rows_emitted", "rows_rejected"):
        if requis not in meta:
            raise RejeuFatal(f"{chemin.name} : champ {requis} manquant.")
    return meta


def etape_analyser(sql: Path, parseur: str) -> tuple[Path, dict]:
    """Analyse le shard en CSV. Un code retour non nul du parseur est FATAL.

    Le loader historique se contentait de journaliser `Parser error:` et continuait
    avec le CSV partiel eventuellement produit.
    """
    csv_path = sql.with_suffix(".csv")
    meta_path = sql.with_suffix(".meta")
    r = subprocess.run(["python3", parseur, str(sql), "-o", str(csv_path)],
                       capture_output=True, text=True, timeout=3600)
    if r.returncode != 0:
        raise RejeuFatal(
            f"parseur en echec sur {sql.name} (code {r.returncode}) : "
            f"{(r.stderr or '')[-500:]}\nAucun chargement sur analyse incomplete."
        )
    if not csv_path.exists():
        raise RejeuFatal(f"{csv_path.name} non produit par le parseur — STOP.")
    return csv_path, lire_meta(meta_path)


# ---------------------------------------------------------------------------
# Etape 3 — chargement transactionnel
# ---------------------------------------------------------------------------

def _normaliser(champs: list[str], lot: Lot) -> list[str] | None:
    """Rend la ligne prete pour le COPY, ou None si elle est REJETEE (motif compte).

    C'est ici que vivait le `if len(row) >= 8:` du loader historique : une ligne trop
    courte etait ignoree, sans compteur, sans trace, sans raison.
    """
    numero = None
    if len(champs) > IDX_ROW_NO and champs[IDX_ROW_NO].strip().isdigit():
        numero = int(champs[IDX_ROW_NO])

    if len(champs) < CHAMPS_ATTENDUS:
        lot.rejeter("colonnes_insuffisantes", numero)
        return None
    if numero is None:
        lot.rejeter("numero_de_ligne_source_absent_ou_non_entier", None)
        return None
    if not champs[IDX_HASH].strip():
        lot.rejeter("empreinte_de_ligne_absente", numero)
        return None

    metier = champs[:CHAMPS_METIER]
    return metier + [champs[IDX_FICHIER], lot.batch_id, str(numero), champs[IDX_HASH]]


def _tsv(valeurs: list[str]) -> str:
    """Encode pour COPY texte. Les separateurs presents dans une valeur sont echappes
    au lieu d'etre laisses casser l'alignement des colonnes silencieusement."""
    sortie = []
    for v in valeurs:
        if v == "":
            sortie.append("\\N")
        else:
            sortie.append(v.replace("\\", "\\\\").replace("\t", "\\t")
                           .replace("\n", "\\n").replace("\r", "\\r"))
    return "\t".join(sortie)


def etape_charger(*, conn, csv_path: Path, lot: Lot, meta: dict, schema: str,
                  dedoublonner: bool, taille_bloc: int) -> Lot:
    """Charge le lot dans UNE transaction et ne commit que s'il se solde.

    Contrairement au chemin historique, `conn.autocommit` reste False : une exception
    a n'importe quel moment annule TOUT le lot. Un prefixe partiel n'est plus un etat
    atteignable.
    """
    lot.emis = int(meta["rows_emitted"])
    if lot.emis == 0:
        raise RejeuFatal(f"DLNR {lot.dlnr} : le parseur n'a emis aucune ligne — STOP.")

    table = f"{schema}.t{lot.table}"
    conn.autocommit = False
    cur = conn.cursor()

    cur.execute(f"SELECT count(*) FROM {table} WHERE _batch_id = %s", (lot.batch_id,))
    if cur.fetchone()[0]:
        conn.rollback()
        raise RejeuFatal(
            f"lot {lot.batch_id} deja present dans {table}. Le rejeu est idempotent : "
            "il refuse de recharger par-dessus. Purger explicitement ce lot pour le refaire."
        )

    vus: set[str] = set()
    bloc: list[str] = []
    csv.field_size_limit(1 << 24)

    def vider() -> None:
        if not bloc:
            return
        cur.copy_from(io.StringIO("\n".join(bloc) + "\n"), f"t{lot.table}",
                      sep="\t", columns=COLONNES_COPY, null="\\N")
        bloc.clear()

    try:
        cur.execute(f"SET LOCAL search_path TO {schema}")
        with csv_path.open("r", encoding="utf-8", newline="") as f:
            for champs in csv.reader(f):
                pret = _normaliser(champs, lot)
                if pret is None:
                    continue
                if dedoublonner:
                    empreinte = pret[-1]  # _raw_hash, dernier champ du COPY
                    if empreinte in vus:
                        lot.dedoublonnes += 1
                        continue
                    vus.add(empreinte)
                bloc.append(_tsv(pret))
                lot.charges += 1
                if len(bloc) >= taille_bloc:
                    vider()
            vider()
    except Exception as e:
        conn.rollback()
        # Re-leve TOUJOURS. C'est la ligne que le chemin historique n'avait pas.
        raise RejeuFatal(
            f"DLNR {lot.dlnr} : chargement interrompu apres {lot.charges} lignes sur "
            f"{lot.emis} emises — transaction annulee, rien n'est en base.\n"
            f"  cause : {type(e).__name__}: {e}"
        ) from e

    # --- controles AVANT commit -------------------------------------------
    try:
        lot.bilan = verifier_lot(emis=lot.emis, charges=lot.charges,
                                 dedoublonnes=lot.dedoublonnes, rejets=lot.rejets,
                                 dlnr=lot.dlnr)
    except ComptabiliteIncoherente:
        conn.rollback()
        raise

    cur.execute(
        f"""SELECT count(*), count(DISTINCT _source_row_no),
                   min(_source_row_no), max(_source_row_no)
            FROM {table} WHERE _batch_id = %s""", (lot.batch_id,))
    en_base, distincts, borne_min, borne_max = cur.fetchone()

    anomalies = []
    if en_base != lot.charges:
        anomalies.append(f"{en_base} lignes en base != {lot.charges} annoncees chargees")
    if distincts != en_base:
        anomalies.append(f"{en_base - distincts} numero(s) de ligne source en double")
    if borne_max is not None and borne_max > lot.emis:
        anomalies.append(f"numero de ligne max {borne_max} > {lot.emis} emis")
    # L'egalite emis = charges + dedoublonnes + rejets est portee par `verifier_lot`
    # ci-dessus, et par lui seul. Les controles ci-dessous portent sur ce que la BASE
    # contient reellement — ce qu'aucun compteur en memoire ne peut prouver.

    if anomalies:
        conn.rollback()
        raise IntegriteLotRompue(
            f"DLNR {lot.dlnr} : le contenu charge ne correspond pas au compte rendu.\n  "
            + "\n  ".join(anomalies)
            + "\nTransaction annulee. Le compteur du script ne fait jamais foi contre la base."
        )

    conn.commit()
    return lot


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ajouter_arguments_perimetre(ap)
    ap.add_argument("--dlnr", type=int, required=True, help="fournisseur a rejouer")
    ap.add_argument("--table", default="400", help="table shardee (defaut : 400)")
    ap.add_argument("--cible-dsn", required=True,
                    help="DSN de la base JETABLE. Jamais la base MassDoc partagee.")
    ap.add_argument("--schema", default="tecdoc_raw")
    ap.add_argument("--archive", default=ARCHIVE_DEFAUT)
    ap.add_argument("--parseur", default=PARSEUR_DEFAUT)
    ap.add_argument("--workdir", default=None, help="repertoire de travail (obligatoire)")
    ap.add_argument("--taille-bloc", type=int, default=50000)
    ap.add_argument("--dedoublonner-identiques", action="store_true",
                    help="fusionne les lignes de meme empreinte, COMPTEES separement. "
                         "Par defaut inactif : toute ligne source est chargee.")
    ap.add_argument("--json", action="store_true", help="rapport machine sur stdout")
    args = ap.parse_args(argv)

    if not args.workdir:
        ap.error("--workdir est obligatoire (aucun repertoire par defaut suppose)")

    if args.scope_mode != "historical":
        print("PERIMETRE REFUSE : le rejeu d'un shard d'archive exige "
              "--scope-mode historical. Le mode `current` ne porte ni le nom du shard, "
              "ni son CRC32 : sans eux, rien ne prouve que la source rejouee est celle "
              "de mars 2026.", file=sys.stderr)
        return 4

    try:
        dlnrs = resoudre_dlnr(args.scope_mode, args.scope_file,
                             selection=args.scope_selection)
    except SceauInvalide as e:
        print(f"SCEAU INVALIDE : {e}", file=sys.stderr)
        return 2
    except Exception as e:
        print(f"PERIMETRE : {e}", file=sys.stderr)
        return 4

    if args.dlnr not in dlnrs:
        print(f"PERIMETRE REFUSE : DLNR {args.dlnr} hors du perimetre resolu "
              f"({len(dlnrs)} fournisseurs, mode {args.scope_mode}/{args.scope_selection}).",
              file=sys.stderr)
        return 4

    perimetre = charger_perimetre(args.scope_file)

    try:
        import psycopg2
        sql, shard = etape_extraire(dlnr=args.dlnr, table=args.table,
                                    perimetre=perimetre, archive=args.archive,
                                    workdir=Path(args.workdir))
        csv_path, meta = etape_analyser(sql, args.parseur)
        lot = Lot(dlnr=args.dlnr, table=args.table, fichier=shard["name"],
                  batch_id=batch_id(dlnr=args.dlnr, table=args.table,
                                    crc32=shard["crc32"],
                                    version_perimetre=perimetre.version))
        with psycopg2.connect(args.cible_dsn) as conn:
            etape_charger(conn=conn, csv_path=csv_path, lot=lot, meta=meta,
                          schema=args.schema,
                          dedoublonner=args.dedoublonner_identiques,
                          taille_bloc=args.taille_bloc)
    except ComptabiliteIncoherente as e:
        print(f"COMPTABILITE INCOHERENTE\n{e}", file=sys.stderr)
        return 5
    except IntegriteLotRompue as e:
        print(f"INTEGRITE DE LOT ROMPUE\n{e}", file=sys.stderr)
        return 9
    except RejeuFatal as e:
        print(f"REJEU FATAL\n{e}", file=sys.stderr)
        return 3

    if args.json:
        import json
        print(json.dumps({"dlnr": lot.dlnr, "table": lot.table,
                          "batch_id": lot.batch_id, "fichier": lot.fichier,
                          "emis": lot.emis, "charges": lot.charges,
                          "dedoublonnes": lot.dedoublonnes, "rejets": lot.rejets},
                         ensure_ascii=False, sort_keys=True))
    else:
        print(f"OK  {lot.bilan}")
        print(f"    lot {lot.batch_id} · {lot.fichier} · CRC32 {shard['crc32']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
