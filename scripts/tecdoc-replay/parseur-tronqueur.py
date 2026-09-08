#!/usr/bin/env python3
"""Stub d'INJECTION : analyse normalement, puis tronque le CSV en gardant le .meta.

Reproduit exactement la situation de mars 2026 — le parseur a rendu compte de
`rows_emitted` lignes, la base n'en a recu qu'un prefixe — sans toucher au chemin
canonique. N'est utilise QUE par `test-tecdoc-replay.sh`.

Variable d'environnement : INJECTION_GARDER = nombre de lignes CSV conservees.
"""
import os
import subprocess
import sys

REEL = "/opt/automecanik/app/scripts/tecdoc-mysql-to-csv.py"

argv = sys.argv[1:]
code = subprocess.run(["python3", REEL, *argv]).returncode
if code != 0:
    sys.exit(code)

garder = int(os.environ["INJECTION_GARDER"])
csv_path = argv[argv.index("-o") + 1]
with open(csv_path, "r", encoding="utf-8") as f:
    lignes = [next(f) for _ in range(garder)]
with open(csv_path, "w", encoding="utf-8") as f:
    f.writelines(lignes)
print(f"INJECTION : CSV tronque a {garder} lignes, .meta laisse intact",
      file=sys.stderr)
