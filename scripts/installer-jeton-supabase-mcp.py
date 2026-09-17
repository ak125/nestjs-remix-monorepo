#!/usr/bin/env python3
"""Installe un jeton d'acces personnel Supabase (management) dans .mcp.json.

Un jeton n'est pas installe parce qu'on l'a colle : il est installe quand l'API qui
l'a emis l'accepte. Ce script refuse d'ecrire un jeton qui ne repond pas 200, pour
que le prochain 401 ne vienne jamais d'une installation silencieusement ratee.

Membre de la meme famille que `verifier-rotation-secret.py` : aucune valeur n'est
affichee, journalisee, passee en argv ni exportee dans l'environnement d'un
sous-processus. Les empreintes montrees sont des SHA-256 tronquees a 12 hexa : elles
identifient un jeton sans permettre de le reconstituer.

Ce qu'il fait
  1. lit le NOUVEAU jeton sans echo (getpass) ou sur stdin si redirige
  2. refuse un jeton mal forme (prefixe `sbp_`)
  3. refuse un jeton dont l'empreinte figure deja comme REVOQUEE dans
     audit/baselines/revoked-secrets-baseline.json
  4. l'eprouve contre GET https://api.supabase.com/v1/projects  -> doit rendre 200
  5. n'ecrit QUE si l'epreuve reussit : sauvegarde horodatee, ecriture atomique,
     mode 600 preserve
  6. rappelle que la session Claude Code doit etre relancee pour recharger le serveur

Codes de sortie
  0  INSTALLE       jeton valide, .mcp.json mis a jour
  1  REFUSE_API     l'API refuse ce jeton (401/403) — rien n'a ete ecrit
  2  REFUSE_FORME   jeton mal forme, vide, ou deja connu comme revoque
  3  INDETERMINE    l'epreuve n'a pas pu etre menee (reseau, fichier) — rien d'ecrit

Usage
  python3 scripts/installer-jeton-supabase-mcp.py
      (invite interactive, sans echo — le jeton ne passe ni par l'historique du
       shell ni par `ps`)

  python3 scripts/installer-jeton-supabase-mcp.py --verifier-seulement
      (eprouve le jeton DEJA installe, n'ecrit rien)

Le jeton se cree sur https://supabase.com/dashboard/account/tokens — cette action
demande une session authentifiee et n'est pas automatisable depuis ce depot.
"""

from __future__ import annotations

import argparse
import getpass
import hashlib
import json
import os
import shutil
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
MCP_JSON = RACINE / ".mcp.json"
RATCHET = RACINE / "audit" / "baselines" / "revoked-secrets-baseline.json"
SERVEUR = "supabase"
CLE = "SUPABASE_ACCESS_TOKEN"
EPREUVE_URL = "https://api.supabase.com/v1/projects"
PREFIXE_ATTENDU = "sbp_"

INSTALLE, REFUSE_API, REFUSE_FORME, INDETERMINE = 0, 1, 2, 3


def empreinte(valeur: str) -> str:
    """SHA-256 tronquee a 12 hexa — meme convention que `fingerprint()` dans
    scripts/audit/check-revoked-secrets-ratchet.ts, qui fait autorite.

    Difference deliberee : le canon hache la valeur BRUTE, on hache `.strip()`.
    C'est un sur-ensemble (un jeton colle avec un blanc parasite donne ici la meme
    empreinte que le meme jeton propre), pour qu'un copier-coller maladroit ne fasse
    pas passer pour inconnu un jeton deja declare mort. Sur un jeton bien forme,
    les deux coincident.
    """
    return hashlib.sha256(valeur.strip().encode()).hexdigest()[:12]


def empreintes_revoquees() -> dict[str, str]:
    """Empreintes deja declarees revoquees, par le ratchet.

    AUCUN repli silencieux : un ratchet absent ou illisible rendrait le controle
    « ce jeton est-il deja mort ? » vacant SANS un mot, et un jeton declare mort
    s'installerait en affichant un parcours nominal. On le DIT, et on n'installe pas.
    """
    if not RATCHET.is_file():
        raise RuntimeError(f"ratchet introuvable : {RATCHET}")
    try:
        data = json.loads(RATCHET.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as err:
        raise RuntimeError(f"ratchet illisible : {err}") from err
    return {
        e["sha256_12"]: f"{e.get('incident', '?')} / {e.get('secret_type', '?')}"
        for e in data.get("revoked_value_fingerprints", [])
        if e.get("sha256_12")
    }


def eprouver(jeton: str) -> tuple[int, str]:
    """Rend (code HTTP, resume). Le jeton ne figure que dans l'en-tete Authorization."""
    requete = urllib.request.Request(
        EPREUVE_URL,
        headers={"Authorization": f"Bearer {jeton}", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(requete, timeout=20) as reponse:
            corps = reponse.read(4096).decode("utf-8", errors="replace")
            try:
                projets = json.loads(corps)
                resume = f"{len(projets)} projet(s) visible(s)" if isinstance(projets, list) else "reponse OK"
            except json.JSONDecodeError:
                resume = "reponse OK (corps non JSON)"
            return reponse.status, resume
    except urllib.error.HTTPError as err:
        return err.code, err.reason or "refus"
    except urllib.error.URLError as err:
        raise RuntimeError(f"epreuve impossible (reseau) : {err.reason}") from err


def lire_mcp() -> dict:
    if not MCP_JSON.is_file():
        raise RuntimeError(f"{MCP_JSON} introuvable")
    return json.loads(MCP_JSON.read_text(encoding="utf-8"))


def jeton_installe(config: dict) -> str | None:
    return (
        config.get("mcpServers", {})
        .get(SERVEUR, {})
        .get("env", {})
        .get(CLE)
    )


def ecrire_mcp(config: dict, jeton: str) -> Path:
    """Sauvegarde HORS du depot, puis ecriture atomique, mode 600 preserve.

    La sauvegarde porte un jeton VIVANT et ce depot est PUBLIC : elle n'a rien a
    faire dans le working tree. `.mcp.json` est ignore, mais `.mcp.json.avant-*`
    ne l'etait pas — un outil qui manipule des jetons ne depose pas de copie la ou
    un `git add -A` la ramasserait. Le fichier temporaire, lui, ne PEUT pas sortir
    du repertoire (`os.replace` atomique exige la meme partition) : il est couvert
    par `.gitignore` (`.mcp.*.tmp`).
    """
    horodatage = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    abri = Path.home() / ".cache" / "automecanik" / "mcp-backups"
    abri.mkdir(parents=True, exist_ok=True, mode=0o700)
    sauvegarde = abri / f"mcp-{horodatage}.json"
    shutil.copy2(MCP_JSON, sauvegarde)
    os.chmod(sauvegarde, 0o600)

    config.setdefault("mcpServers", {}).setdefault(SERVEUR, {}).setdefault("env", {})[CLE] = jeton

    fd, provisoire = tempfile.mkstemp(dir=str(MCP_JSON.parent), prefix=".mcp.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as sortie:
            json.dump(config, sortie, indent=2, ensure_ascii=False)
            sortie.write("\n")
        os.chmod(provisoire, 0o600)
        os.replace(provisoire, MCP_JSON)
    except BaseException:
        Path(provisoire).unlink(missing_ok=True)
        raise
    return sauvegarde


def main() -> int:
    analyseur = argparse.ArgumentParser(
        description="Installe et eprouve le jeton de management Supabase du serveur MCP.",
    )
    analyseur.add_argument(
        "--verifier-seulement",
        action="store_true",
        help="eprouve le jeton deja present dans .mcp.json, n'ecrit rien",
    )
    arguments = analyseur.parse_args()

    try:
        config = lire_mcp()
    except (RuntimeError, json.JSONDecodeError, OSError) as err:
        print(f"INDETERMINE — {err}", file=sys.stderr)
        return INDETERMINE

    if arguments.verifier_seulement:
        actuel = jeton_installe(config)
        if not actuel:
            print(f"INDETERMINE — {CLE} absent de {MCP_JSON}", file=sys.stderr)
            return INDETERMINE
        print(f"jeton installe : empreinte {empreinte(actuel)}")
        try:
            code, resume = eprouver(actuel)
        except RuntimeError as err:
            print(f"INDETERMINE — {err}", file=sys.stderr)
            return INDETERMINE
        if code == 200:
            print(f"VALIDE — HTTP 200, {resume}")
            return INSTALLE
        print(f"REFUSE_API — HTTP {code} ({resume}). Ce jeton est mort : le remplacer.",
              file=sys.stderr)
        return REFUSE_API

    ancien = jeton_installe(config)
    if ancien:
        print(f"jeton actuellement installe : empreinte {empreinte(ancien)}")

    print("Creer le jeton sur https://supabase.com/dashboard/account/tokens,")
    print("puis le coller ici. La saisie n'est PAS affichee et ne passe ni par")
    print("l'historique du shell ni par `ps`.\n")

    if sys.stdin.isatty():
        nouveau = getpass.getpass("Nouveau jeton Supabase (sbp_...) : ").strip()
    else:
        nouveau = sys.stdin.readline().strip()

    if not nouveau:
        print("REFUSE_FORME — jeton vide, rien n'a ete ecrit.", file=sys.stderr)
        return REFUSE_FORME

    if not nouveau.startswith(PREFIXE_ATTENDU):
        print(f"REFUSE_FORME — un jeton de management commence par « {PREFIXE_ATTENDU} ». "
              "Une cle de projet (sb_secret_, eyJ...) n'ouvre pas l'API de management.",
              file=sys.stderr)
        return REFUSE_FORME

    trace = empreinte(nouveau)
    try:
        revoques = empreintes_revoquees()
    except RuntimeError as err:
        print(f"INDETERMINE — {err}. Controle de revocation NON effectue, "
              "rien n'a ete ecrit.", file=sys.stderr)
        return INDETERMINE
    if trace in revoques:
        print(f"REFUSE_FORME — empreinte {trace} deja declaree REVOQUEE dans le ratchet "
              f"({revoques[trace]}). Ce jeton est mort, en creer un neuf.", file=sys.stderr)
        return REFUSE_FORME

    if ancien and nouveau == ancien:
        print(f"REFUSE_FORME — identique au jeton deja installe (empreinte {trace}). "
              "Rien n'a change, donc rien n'est ecrit.", file=sys.stderr)
        return REFUSE_FORME

    print(f"\nempreinte du nouveau jeton : {trace}")
    print(f"epreuve : GET {EPREUVE_URL} ...")
    try:
        code, resume = eprouver(nouveau)
    except RuntimeError as err:
        print(f"INDETERMINE — {err}. Rien n'a ete ecrit.", file=sys.stderr)
        return INDETERMINE

    if code != 200:
        print(f"REFUSE_API — HTTP {code} ({resume}). Le jeton n'est PAS installe : "
              "un jeton que l'API refuse maintenant la refusera aussi au prochain demarrage.",
              file=sys.stderr)
        return REFUSE_API

    print(f"epreuve reussie — HTTP 200, {resume}")
    try:
        sauvegarde = ecrire_mcp(config, nouveau)
    except OSError as err:
        print(f"INDETERMINE — ecriture impossible : {err}", file=sys.stderr)
        return INDETERMINE

    print(f"\nINSTALLE — {MCP_JSON} mis a jour (mode 600).")
    print(f"sauvegarde de l'ancien fichier : {sauvegarde.name}")
    print("\nLe serveur MCP ne recharge pas sa configuration a chaud :")
    print("relancer la session Claude Code pour que le jeton prenne effet,")
    print("puis controler avec  --verifier-seulement.")
    if ancien:
        print(f"\nPenser a declarer l'ancienne empreinte {empreinte(ancien)} dans")
        print(f"{RATCHET.relative_to(RACINE)} (revoked_value_fingerprints) — owner-gated.")
    return INSTALLE


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nINDETERMINE — interrompu, rien n'a ete ecrit.", file=sys.stderr)
        sys.exit(INDETERMINE)
