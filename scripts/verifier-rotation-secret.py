#!/usr/bin/env python3
"""Verifie mecaniquement qu'une rotation du mot de passe PostgreSQL a bien eu lieu.

Une rotation n'est pas prouvee parce qu'on l'a faite : elle est prouvee quand
l'ANCIEN secret est refuse ET que le NOUVEAU fonctionne. Ce script etablit les deux,
sans jamais afficher, journaliser ni ecrire la moindre valeur.

Ce qu'il fait
  1. lit le secret ACTIF depuis backend/.env
  2. lit le secret PUBLIE depuis l'historique git (blob du commit fautif)
  3. compare leurs empreintes SHA-256 tronquees      -> rotation faite ou non
  4. ouvre une connexion avec le secret ACTIF        -> doit REUSSIR
  5. ouvre une connexion avec le secret PUBLIE       -> doit ECHOUER en 28P01
  6. inventorie les copies locales portant l'ancien secret, sans les supprimer

Aucune valeur ne transite par argv, par l'environnement d'un sous-processus, ni par
la sortie. Les empreintes affichees sont tronquees a 12 hexa : elles identifient sans
permettre de reconstituer.

Codes de sortie
  0  ROTATED         ancien refuse, nouveau valide
  1  ROTATION_FAIL   l'ancien secret est ENCORE accepte — le pire cas
  2  BLOCKED_BY_SECRET_ROTATION   actif == publie, rien n'a change
  3  INDETERMINE     une verification n'a pas pu etre menee (dit, jamais suppose)
"""

from __future__ import annotations

import argparse
import hashlib
import subprocess
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
CLE = "SUPABASE_DB_PASSWORD"

#: La reference du blob ou le litteral a ete publie est fournie a l'EXECUTION, jamais
#: ecrite ici. Ce depot est public : y inscrire « le mot de passe est dans tel commit,
#: tel fichier » en ferait un panneau indicateur. L'operateur la connait, le depot non.


def empreinte(valeur: str) -> str:
    return hashlib.sha256(valeur.strip().encode()).hexdigest()[:12]


def secret_actif(env: Path) -> str:
    if not env.is_file():
        raise RuntimeError(
            f"{env} introuvable. Le fichier .env n'est pas suivi par Git : depuis un "
            "worktree, passer --env /opt/automecanik/app/backend/.env")
    for ligne in env.read_text(encoding="utf-8", errors="replace").splitlines():
        if ligne.startswith(f"{CLE}="):
            return ligne.split("=", 1)[1].strip()
    raise RuntimeError(f"{CLE} absent de {env}")


def secret_publie(commit: str, chemin: str) -> str:
    import re
    blob = subprocess.run(["git", "show", f"{commit}:{chemin}"],
                          cwd=RACINE, capture_output=True, text=True)
    if blob.returncode != 0:
        raise RuntimeError(f"blob {commit}:{chemin} illisible — "
                           "historique tronque ou depot incomplet")
    trouves = re.findall(r"['\"]password['\"]\s*:\s*['\"]([^'\"]+)['\"]", blob.stdout)
    if not trouves:
        raise RuntimeError("aucun litteral de mot de passe dans le blob de reference")
    return trouves[0]


def tenter_connexion(secret: str, *, hote: str, port: int, utilisateur: str,
                     base: str) -> tuple[bool, str]:
    """Ouvre une connexion et la referme. Rend (succes, classe d'erreur).

    Le secret est passe par le parametre `password` de psycopg2 : il ne figure ni
    dans argv, ni dans l'environnement, ni dans un fichier temporaire.
    """
    import psycopg2
    try:
        conn = psycopg2.connect(host=hote, port=port, user=utilisateur,
                                password=secret, dbname=base, connect_timeout=15)
        conn.close()
        return True, "OK"
    except psycopg2.OperationalError as e:
        code = getattr(e, "pgcode", None) or ""
        texte = str(e).lower()
        if code == "28P01" or "authentication failed" in texte or "mot de passe" in texte:
            return False, "28P01"
        return False, f"AUTRE:{type(e).__name__}"
    except Exception as e:  # noqa: BLE001 — on nomme, on ne suppose pas
        return False, f"AUTRE:{type(e).__name__}"


def copies_locales(cible: str, racine: Path) -> list[Path]:
    """Fichiers hors Git portant l'empreinte donnee. Inventaire seul, aucune suppression."""
    import re as _re
    trouves: set[Path] = set()
    for motif in ("backend/.env*", ".env*", "backend/*.bak", "backend/*.backup"):
        for f in racine.glob(motif):
            if not f.is_file():
                continue
            try:
                contenu = f.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            for ligne in contenu.splitlines():
                nom, sep, val = ligne.partition("=")
                if not sep or nom.strip() not in (CLE, "DATABASE_URL"):
                    continue
                val = val.strip().strip("\"'")
                if nom.strip() == "DATABASE_URL":
                    m = _re.search(r"://[^:]+:([^@]+)@", val)
                    val = m.group(1) if m else ""
                if val and empreinte(val) == cible:
                    trouves.add(f)
                    break
    return sorted(trouves)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--hote", default="aws-0-eu-west-3.pooler.supabase.com")
    ap.add_argument("--port", type=int, default=6543)
    ap.add_argument("--utilisateur", default="postgres.cxpojprgwgubzjyqzmoq")
    ap.add_argument("--base", default="postgres")
    ap.add_argument("--commit", required=True,
                    help="commit ou le litteral a ete publie (reference forensique, "
                         "fournie par l'operateur — jamais figee dans le depot)")
    ap.add_argument("--chemin", required=True,
                    help="chemin du fichier dans ce commit")
    ap.add_argument("--env", default=str(RACINE / "backend" / ".env"),
                    help="fichier .env portant le secret actif (jamais suivi par Git)")
    ap.add_argument("--sans-connexion", action="store_true",
                    help="comparaison d'empreintes seule, aucune tentative de connexion")
    args = ap.parse_args(argv)

    try:
        env = Path(args.env)
        actif, publie = secret_actif(env), secret_publie(args.commit, args.chemin)
    except Exception as e:  # noqa: BLE001
        print(f"INDETERMINE : {e}", file=sys.stderr)
        return 3

    e_actif, e_publie = empreinte(actif), empreinte(publie)
    print("=== Empreintes SHA-256 tronquees (aucune valeur affichee) ===")
    print(f"  secret actif  ({CLE}) : {e_actif}")
    print(f"  secret publie ({args.commit})     : {e_publie}")

    if e_actif == e_publie:
        print()
        print("  Le secret actif EST celui publie publiquement.")
        print("  La verification negative est sans objet : il n'y a pas d'« ancien » secret.")
        print()
        print("BLOCKED_BY_SECRET_ROTATION")
        return 2

    print("  -> les empreintes different : une rotation a eu lieu.")

    if args.sans_connexion:
        print()
        print("INDETERMINE : rotation constatee par empreinte, connexions non testees "
              "(--sans-connexion). Une rotation non eprouvee n'est pas une rotation prouvee.")
        return 3

    print()
    print(f"=== Verification par connexion ({args.hote}:{args.port}) ===")
    ok_neuf, detail_neuf = tenter_connexion(actif, hote=args.hote, port=args.port,
                                            utilisateur=args.utilisateur, base=args.base)
    print(f"  nouveau secret : {'ACCEPTE' if ok_neuf else 'REFUSE'} ({detail_neuf})")
    ok_vieux, detail_vieux = tenter_connexion(publie, hote=args.hote, port=args.port,
                                              utilisateur=args.utilisateur, base=args.base)
    print(f"  ancien secret  : {'ACCEPTE' if ok_vieux else 'REFUSE'} ({detail_vieux})")

    print()
    if ok_vieux:
        print("  L'identifiant publie publiquement ouvre TOUJOURS la base.")
        print("ROTATION_FAIL")
        return 1
    if not ok_neuf:
        print("  Le secret actif n'ouvre pas la base : configuration incoherente, ou")
        print("  indisponibilite reseau. Ne pas conclure a une rotation reussie.")
        print("INDETERMINE")
        return 3
    if detail_vieux != "28P01":
        print(f"  L'ancien secret echoue, mais pas sur un refus d'authentification "
              f"({detail_vieux}). Un echec reseau ressemble a un refus — il ne le prouve pas.")
        print("INDETERMINE")
        return 3

    restes = copies_locales(e_publie, env.parent.parent)
    print("=== Copies locales portant l'ancien secret (inventaire, aucune suppression) ===")
    if restes:
        for f in restes:
            print(f"  · {f}")
        print("  Ces fichiers peuvent maintenant etre supprimes sans risque : la valeur")
        print("  qu'ils portent n'ouvre plus rien.")
    else:
        print("  aucune")

    print()
    print("ROTATED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
