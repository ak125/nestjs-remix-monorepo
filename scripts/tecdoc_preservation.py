#!/usr/bin/env python3
"""Verificateur de conservation TecDoc — AVANT == APRES, ou STOP.

Ce que ce module fait respecter
-------------------------------
`audit/massdoc-tecdoc-preservation-manifest-2026-03.json` fige, par empreinte MD5
calculee cote serveur, les 9 ensembles applicatifs que la campagne TecDoc de mars 2026
a produits et que MassDoc sert aujourd'hui. L'invariant inscrit dans le manifeste :

    AVANT cleanup == APRES cleanup, pour chaque ensemble.
    Un seul ecart => VERDICT ECHEC, STOP, aucun DROP suivant.

Ce module rejoue les empreintes et compare. Il ne repare rien et ne propose rien : un
ecart est un verdict, pas un point de depart de negociation.

Fail-closed sur trois points
----------------------------
1. Sceau du manifeste verifie avant toute lecture (tecdoc_seal).
2. Un ensemble SANS mesure fournie est un ECHEC, pas un « ignore ». Une conservation
   qu'on ne mesure pas n'est pas une conservation constatee.
3. Une mesure incomplete (empreinte absente) est un ECHEC : compter les lignes ne dit
   pas que ce sont les MEMES lignes.

Deux facons de fournir les mesures
----------------------------------
    --mesures fichier.json   mesures deja prises (permet de tester hors base)
    --dsn postgresql://...   les prend en rejouant les requetes du manifeste

Codes de sortie : 0 conservation intacte · 3 illisible · 7 conservation rompue.
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path

from tecdoc_seal import SceauInvalide, verifier as _verifier_sceau

#: Champs compares. L'empreinte est la seule preuve d'identite du CONTENU ; le cardinal
#: et les bornes servent a rendre un ecart lisible (« 3 lignes manquent » plutot que
#: « le hash a change »).
CHAMPS = ("cardinal", "borne_min", "borne_max", "empreinte_md5")

#: Requetes d'empreinte, une par ensemble, VERIFIEES contre la PROD le 2026-09-08 :
#: chacune reproduit exactement le `empreinte_md5` scelle dans le manifeste.
#:
#: Pourquoi une table explicite plutot qu'une derivation depuis le manifeste
#: -------------------------------------------------------------------------
#: `methode_de_controle` documente la forme
#:     SELECT count(*), min(<cle>), max(<cle>), md5(string_agg(<cle>::text, ',' ORDER BY <cle>))
#: qui est SOUS-SPECIFIEE pour les entrees a cle composite. Une derivation naive a ete
#: ecrite, puis rejetee apres confrontation a la base : sur `gamme_registry`, ordonner
#: par l'expression texte `pg_id_source||'>'||pg_id` donne
#: 64816aa0aef69d7a702725350a5bbafe, alors que le manifeste porte
#: 0a2ef785f1b820e7405f375819450a96 — obtenu en ordonnant par `pg_id_source` NUMERIQUE.
#: Meme cardinal (9702), empreinte differente : un tri texte place "1000" avant "2".
#: Sur `type_id_remap` la derivation tombait juste par accident, tous les `old_id` ayant
#: six chiffres, donc ordre texte == ordre numerique.
#:
#: Une requete devinee qui tombe juste par hasard sur 8 cas sur 9 est plus dangereuse
#: qu'une table ecrite : elle ferait un jour echouer un controle de conservation sur une
#: base pourtant intacte, et l'ecart serait attribue a la donnee.
REQUETES = {
    "auto_type — types crees/remappes par la campagne": """
        SELECT count(*), min(type_id_i), max(type_id_i),
               md5(string_agg(type_id_i::text, ',' ORDER BY type_id_i))
        FROM public.auto_type WHERE type_id_i BETWEEN 60000 AND 83456""",
    "auto_modele — modeles ajoutes": """
        SELECT count(*), min(modele_id), max(modele_id),
               md5(string_agg(modele_id::text, ',' ORDER BY modele_id))
        FROM public.auto_modele WHERE modele_is_new::text = '1'""",
    "pieces — cohorte introduite par la campagne": """
        SELECT count(*), min(piece_id), max(piece_id),
               md5(string_agg(piece_id::text, ',' ORDER BY piece_id))
        FROM public.pieces WHERE piece_year::text = '2025'""",
    "pieces — sous-ensemble affiche de la cohorte": """
        SELECT count(*), min(piece_id), max(piece_id),
               md5(string_agg(piece_id::text, ',' ORDER BY piece_id))
        FROM public.pieces WHERE piece_year::text = '2025' AND piece_display""",
    "pieces_gamme — gammes creees par la campagne (bande reservee)": """
        SELECT count(*), min(pg_id), max(pg_id),
               md5(string_agg(pg_id::text, ',' ORDER BY pg_id))
        FROM public.pieces_gamme WHERE pg_id >= 60000""",
    "tecdoc_map.type_id_remap — mapping d'identite vehicule (ancien -> nouveau)": """
        SELECT count(*), min(old_id), max(old_id),
               md5(string_agg(old_id||'>'||new_id, ',' ORDER BY old_id))
        FROM tecdoc_map.type_id_remap""",
    "tecdoc_map.gamme_registry — filiation gamme source -> pg_id": """
        SELECT count(*), min(pg_id), max(pg_id),
               md5(string_agg(pg_id_source||'>'||pg_id, ',' ORDER BY pg_id_source))
        FROM tecdoc_map.gamme_registry WHERE pg_id IS NOT NULL""",
    "tecdoc_map.linkage_target_registry — cibles de liaison": """
        SELECT count(*), min(id), max(id),
               md5(string_agg(id::text, ',' ORDER BY id))
        FROM tecdoc_map.linkage_target_registry""",
    # Rollup : un string_agg sur les 3,24 M identifiants batirait une chaine de ~50 Mo
    # cote serveur. L'empreinte porte donc sur l'agregat par source_dlnr (229 groupes),
    # et les bornes sont NULL dans le manifeste — d'ou le NULL::int explicite ici.
    "tecdoc_map.article_registry — ancrage piece_id <-> ARTNR/DLNR": """
        WITH r AS (SELECT source_dlnr, count(*) AS n
                   FROM tecdoc_map.article_registry GROUP BY source_dlnr)
        SELECT (SELECT count(*) FROM tecdoc_map.article_registry),
               NULL::int, NULL::int,
               md5(string_agg(source_dlnr||':'||n, ',' ORDER BY source_dlnr))
        FROM r""",
}


class ConservationRompue(RuntimeError):
    """Au moins un ensemble applicatif a change — STOP, aucun DROP suivant."""


@dataclass(frozen=True)
class Ecart:
    ensemble: str
    champ: str
    attendu: object
    obtenu: object

    def __str__(self) -> str:
        return f"{self.ensemble} · {self.champ} : attendu {self.attendu!r}, obtenu {self.obtenu!r}"


def charger_manifeste(chemin: str | Path) -> dict:
    """Charge le manifeste et verifie son sceau. Leve SceauInvalide si altere."""
    p = Path(chemin)
    document = json.loads(p.read_text(encoding="utf-8"))
    _verifier_sceau(document, source=str(p))
    return document


def requete_empreinte(ensemble: dict) -> str:
    """Rend la requete d'empreinte VERIFIEE de cet ensemble.

    Raises:
        KeyError: si le manifeste contient un ensemble sans requete verifiee. C'est
            volontairement une erreur et non un saut : mesurer 8 ensembles sur 9 et
            annoncer « conservation intacte » serait un faux vert.
    """
    nom = _nom(ensemble)
    try:
        return " ".join(REQUETES[nom].split())
    except KeyError:
        raise KeyError(
            f"aucune requete d'empreinte verifiee pour {nom!r}. Ajouter la requete a "
            "REQUETES APRES avoir verifie qu'elle reproduit l'empreinte du manifeste — "
            "jamais l'inverse."
        ) from None


def _nom(ensemble: dict) -> str:
    return ensemble.get("nom") or f"{ensemble['table']} [{ensemble.get('filtre', '')}]"


def comparer(manifeste: dict, mesures: dict) -> list[Ecart]:
    """Compare les mesures fournies aux valeurs figees. Rend la liste des ecarts.

    Args:
        manifeste: document deja charge et scelle-verifie.
        mesures: {nom d'ensemble: {cardinal, borne_min, borne_max, empreinte_md5}}.
            Le nom est celui du champ `nom` du manifeste.

    Returns:
        Liste d'Ecart, vide si la conservation est intacte.
    """
    ecarts: list[Ecart] = []
    for ensemble in manifeste["ensembles_figes"]:
        nom = _nom(ensemble)
        mesure = mesures.get(nom)
        if mesure is None:
            ecarts.append(Ecart(nom, "mesure", "fournie", "ABSENTE"))
            continue
        if not mesure.get("empreinte_md5"):
            ecarts.append(Ecart(nom, "empreinte_md5", ensemble.get("empreinte_md5"), "ABSENTE"))
        for champ in CHAMPS:
            if champ not in ensemble or champ not in mesure:
                continue
            if ensemble[champ] != mesure[champ]:
                ecarts.append(Ecart(nom, champ, ensemble[champ], mesure[champ]))
    return ecarts


def verifier(manifeste: dict, mesures: dict) -> int:
    """Leve ConservationRompue au moindre ecart. Rend le nombre d'ensembles verifies."""
    ecarts = comparer(manifeste, mesures)
    if ecarts:
        detail = "\n".join(f"    {e}" for e in ecarts)
        raise ConservationRompue(
            f"CONSERVATION ROMPUE — {len(ecarts)} ecart(s) :\n{detail}\n\n"
            "VERDICT : ECHEC. STOP. Aucun DROP suivant.\n"
            "Ces ensembles sont les vehicules, modeles, pieces, gammes et mappings que "
            "la campagne de mars 2026 a crees et que MassDoc sert aujourd'hui. Le but du "
            "nettoyage est de retirer la matiere intermediaire reconstructible, jamais "
            "ces resultats."
        )
    return len(manifeste["ensembles_figes"])


def mesurer(manifeste: dict, dsn: str) -> dict:
    """Prend les mesures en base. LECTURE SEULE — que des SELECT."""
    import psycopg2  # import tardif : la mesure hors-ligne ne doit rien exiger

    mesures: dict = {}
    with psycopg2.connect(dsn) as conn, conn.cursor() as cur:
        for ensemble in manifeste["ensembles_figes"]:
            cur.execute(requete_empreinte(ensemble))
            cardinal, bmin, bmax, empreinte = cur.fetchone()
            mesures[_nom(ensemble)] = {
                "cardinal": cardinal,
                "borne_min": bmin,
                "borne_max": bmax,
                "empreinte_md5": empreinte,
            }
    return mesures


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--manifest", required=True)
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--mesures", help="mesures deja prises (JSON)")
    src.add_argument("--dsn", help="prendre les mesures en base (lecture seule)")
    ap.add_argument("--ecrire-mesures", help="ecrire les mesures prises dans ce fichier")
    a = ap.parse_args(argv)

    try:
        manifeste = charger_manifeste(a.manifest)
    except SceauInvalide as e:
        print(f"REFUS : {e}", file=sys.stderr)
        return 2
    except (OSError, json.JSONDecodeError) as e:
        print(f"illisible : {e}", file=sys.stderr)
        return 3

    if a.mesures:
        try:
            mesures = json.loads(Path(a.mesures).read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as e:
            print(f"mesures illisibles : {e}", file=sys.stderr)
            return 3
    else:
        mesures = mesurer(manifeste, a.dsn)
        if a.ecrire_mesures:
            Path(a.ecrire_mesures).write_text(
                json.dumps(mesures, indent=2, ensure_ascii=False, sort_keys=True),
                encoding="utf-8")

    try:
        n = verifier(manifeste, mesures)
    except ConservationRompue as e:
        print(str(e), file=sys.stderr)
        return 7

    print(f"conservation intacte — {n} ensembles applicatifs identiques au manifeste.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
