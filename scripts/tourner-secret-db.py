#!/usr/bin/env python3
"""Tourne le mot de passe de la base d'un projet Supabase, par le chemin supporte.

POURQUOI L'API PLUTOT QU'UN `ALTER USER`
-----------------------------------------
Le mot de passe de la base existe a DEUX endroits : le role PostgreSQL, et
l'identifiant que le pooler (Supavisor) conserve cote plan de controle pour ouvrir
ses connexions amont. Un `ALTER USER` emis en direct ne change que le premier : le
pooler garde l'ancien et cesse de fonctionner. Sur une base qui sert du trafic, cela
coupe le site.

`PATCH /v1/projects/{ref}/database/password` est l'operation qu'appelle le bouton
« Reset database password » du tableau de bord : elle change les deux ensemble.
C'est la seule voie qui laisse le systeme coherent.

ORDRE DES OPERATIONS — pense pour qu'aucune panne ne verrouille la base
-----------------------------------------------------------------------
  1. prouver qu'un identifiant de reference ouvre bien la base (sinon on ne pourra
     rien prouver ensuite, et l'etat de depart est deja inconnu)
  2. engendrer le secret et l'ecrire IMMEDIATEMENT dans un fichier 0600 —
     avant tout changement, pour qu'un plantage ne puisse pas le perdre
  3. appeler l'API
  4. verifier : le nouveau ouvre la base ET l'ancien est refuse (28P01)
  5. seulement alors, mettre a jour le .env, avec sauvegarde horodatee
Rien n'est ecrit dans le .env tant que la base n'a pas confirme.

Le secret n'est ni affiche, ni journalise, ni passe en argv. Seules des empreintes
SHA-256 tronquees apparaissent. Le jeton d'API est lu dans l'environnement.

Codes de sortie
  0 rotation prouvee             4 le changement n'a pas pris
  2 etat de depart inexploitable  5 l'ancien identifiant est encore accepte
  3 erreur d'entree/sortie        6 l'API a refuse l'appel
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import secrets
import string
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

CLE = "SUPABASE_DB_PASSWORD"
JETON = "SUPABASE_ACCESS_TOKEN"
#: Alphabet volontairement alphanumerique. Un `.env` n'a pas de regle de citation
#: universelle et une URL de connexion encore moins : un caractere special mal
#: echappe reproduit exactement le defaut qu'on vient de diagnostiquer.
ALPHABET = string.ascii_letters + string.digits


def empreinte(v: str) -> str:
    return hashlib.sha256(v.strip().encode()).hexdigest()[:12]


def engendrer(n: int) -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(n))


def lire_secret(chemin: Path) -> str | None:
    """Extrait la valeur de SUPABASE_DB_PASSWORD d'un fichier de type .env."""
    if not chemin.is_file():
        return None
    for ligne in chemin.read_text(encoding="utf-8", errors="replace").splitlines():
        if ligne.startswith(f"{CLE}="):
            return ligne.split("=", 1)[1].strip()
    return None


def essayer(secret: str, *, hote: str, port: int, utilisateur: str, base: str) -> tuple[bool, str]:
    """Tente une connexion. Distingue un refus d'authentification d'une panne reseau :
    confondre les deux ferait passer une coupure pour une rotation reussie."""
    import psycopg2
    try:
        psycopg2.connect(host=hote, port=port, user=utilisateur, password=secret,
                         dbname=base, connect_timeout=20).close()
        return True, "OK"
    except psycopg2.OperationalError as e:
        texte = str(e).strip().replace("\n", " ")
        if "password authentication failed" in texte:
            return False, "28P01"
        return False, f"PANNE:{texte[:70]}"
    except Exception as e:  # noqa: BLE001
        return False, f"PANNE:{type(e).__name__}"


def appeler_api(projet: str, secret: str, jeton: str) -> tuple[int, str]:
    requete = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{projet}/database/password",
        data=json.dumps({"password": secret}).encode("utf-8"),
        headers={"Authorization": f"Bearer {jeton}", "Content-Type": "application/json"},
        method="PATCH",
    )
    try:
        with urllib.request.urlopen(requete, timeout=120) as r:
            return r.status, r.read().decode("utf-8", "replace")[:200]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")[:200]
    except Exception as e:  # noqa: BLE001
        return 0, f"{type(e).__name__}: {e}"


def ecrire_env(env: Path, valeur: str) -> Path:
    """Remplace la ligne du secret, atomiquement, apres sauvegarde horodatee."""
    contenu = env.read_text(encoding="utf-8", errors="replace")
    sauvegarde = env.with_name(f"{env.name}.avant-rotation-{time.strftime('%Y%m%d_%H%M%S')}")
    sauvegarde.write_text(contenu, encoding="utf-8")
    sauvegarde.chmod(0o600)

    lignes, vu = [], False
    for ligne in contenu.splitlines(keepends=True):
        if ligne.startswith(f"{CLE}="):
            lignes.append(f"{CLE}={valeur}\n")
            vu = True
        else:
            lignes.append(ligne)
    if not vu:
        raise RuntimeError(f"{CLE} absent de {env} — refus d'ajouter une ligne a l'aveugle")

    fd, provisoire = tempfile.mkstemp(dir=str(env.parent), prefix=".env.")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write("".join(lignes))
    os.chmod(provisoire, env.stat().st_mode & 0o777)
    os.replace(provisoire, env)
    return sauvegarde


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--projet", required=True, help="reference du projet Supabase")
    ap.add_argument("--hote", required=True, help="hote de verification (pooler)")
    ap.add_argument("--port", type=int, required=True)
    ap.add_argument("--utilisateur", required=True, help="ex. postgres.<ref> pour le pooler")
    ap.add_argument("--base", default="postgres")
    ap.add_argument("--reference", required=True,
                    help="fichier .env portant l'identifiant ACTUELLEMENT valide "
                         "(celui qu'on veut invalider)")
    ap.add_argument("--env", required=True, help="fichier .env a mettre a jour")
    ap.add_argument("--coffre", required=True,
                    help="fichier 0600 ou deposer le nouveau secret (hors depot)")
    ap.add_argument("--longueur", type=int, default=40)
    ap.add_argument("--attente", type=int, default=90,
                    help="secondes d'attente max pour la propagation")
    args = ap.parse_args(argv)

    jeton = os.environ.get(JETON, "").strip()
    if not jeton:
        print(f"{JETON} absent de l'environnement.", file=sys.stderr)
        print("Creer un jeton sur https://supabase.com/dashboard/account/tokens", file=sys.stderr)
        print(f"puis : read -rs {JETON} && export {JETON}", file=sys.stderr)
        return 3

    cfg = dict(hote=args.hote, port=args.port, utilisateur=args.utilisateur, base=args.base)
    env, coffre = Path(args.env), Path(args.coffre)

    ancien = lire_secret(Path(args.reference))
    if ancien is None:
        print(f"{CLE} introuvable dans {args.reference}", file=sys.stderr)
        return 3

    print("=== 1/5 — etat de depart ===")
    ok, detail = essayer(ancien, **cfg)
    print(f"  identifiant de reference ({empreinte(ancien)}) : "
          f"{'ACCEPTE' if ok else 'REFUSE'} ({detail})")
    if not ok:
        print("\n  Il n'ouvre pas la base : on ne pourra pas prouver qu'il cesse de",
              file=sys.stderr)
        print("  fonctionner. Fournir via --reference un identifiant valide.", file=sys.stderr)
        return 2

    print()
    print("=== 2/5 — generation et mise a l'abri (avant tout changement) ===")
    neuf = engendrer(args.longueur)
    coffre.write_text(neuf + "\n", encoding="utf-8")
    coffre.chmod(0o600)
    print(f"  secret de {args.longueur} caracteres, empreinte {empreinte(neuf)}")
    print(f"  depose dans {coffre} (0600) — jamais affiche")

    print()
    print("=== 3/5 — appel de l'API supportee ===")
    code, corps = appeler_api(args.projet, neuf, jeton)
    print(f"  PATCH /v1/projects/{args.projet}/database/password -> HTTP {code}")
    if code != 200:
        print(f"  reponse : {corps}", file=sys.stderr)
        print(f"\n  Aucun changement applique. Le secret engendre reste dans {coffre} ;",
              file=sys.stderr)
        print("  le supprimer s'il ne sert pas.", file=sys.stderr)
        return 6

    print()
    print(f"=== 4/5 — verification (jusqu'a {args.attente}s de propagation) ===")
    limite = time.time() + args.attente
    while True:
        ok_neuf, d_neuf = essayer(neuf, **cfg)
        if ok_neuf or time.time() > limite:
            break
        time.sleep(5)
    ok_ancien, d_ancien = essayer(ancien, **cfg)
    print(f"  nouveau secret  : {'ACCEPTE' if ok_neuf else 'REFUSE'} ({d_neuf})")
    print(f"  ancien secret   : {'ACCEPTE' if ok_ancien else 'REFUSE'} ({d_ancien})")
    if not ok_neuf:
        print("\n  L'API a repondu 200 mais le nouveau secret n'ouvre pas la base.",
              file=sys.stderr)
        print(f"  Ne rien conclure : il est dans {coffre}. Reessayer la verification",
              file=sys.stderr)
        print("  avant de toucher au .env.", file=sys.stderr)
        return 4
    if ok_ancien:
        print("\n  L'ancien identifiant ouvre ENCORE la base — rotation non effective.",
              file=sys.stderr)
        return 5

    print()
    print("=== 5/5 — mise a jour du .env ===")
    sauvegarde = ecrire_env(env, neuf)
    print(f"  {env} mis a jour · sauvegarde : {sauvegarde.name}")
    relu = lire_secret(env)
    if relu != neuf:
        print("  ecriture incoherente — verifier le fichier a la main", file=sys.stderr)
        return 3
    print(f"  relecture conforme (empreinte {empreinte(relu)})")

    print()
    print("ROTATED")
    print()
    print("Reste a faire, dans cet ordre :")
    print(f"  1. reporter la valeur de {coffre} dans le secret CI")
    print("  2. redemarrer les services qui ont l'ancien identifiant en memoire")
    print(f"  3. supprimer {args.reference} et {coffre} une fois la valeur reportee")
    return 0


if __name__ == "__main__":
    sys.exit(main())
