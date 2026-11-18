#!/usr/bin/env python3
"""Compile, sans les exécuter, les blocs DO (PL/pgSQL) des migrations données.

Pourquoi : PL/pgSQL ne compile le corps d'un DO qu'au moment de l'exécuter.
squawk (libpg_query) voit un DO comme une chaîne opaque et le dry-run du moteur
ne fait que lister : une erreur de syntaxe PL/pgSQL n'apparaissait donc qu'à
l'application réelle (run 44334611333, lot F1 : `IF x IS DISTINCT FROM CASE …
THEN …`, PL/pgSQL coupe la condition du IF au premier THEN, celui du CASE).

Comment : chaque corps devient une fonction `pg_temp` créée avec
`check_function_bodies = on`. Le validateur PL/pgSQL analyse alors toute la
syntaxe du bloc (expressions des IF comprises) sans résoudre les tables ni les
colonnes : aucun schéma n'est requis. Seuls les `%TYPE`/`%ROWTYPE` sont résolus
à la compilation ; le stub `cron.job` ci-dessous couvre l'unique cas du dépôt.
Le tout s'exécute dans une transaction terminée par ROLLBACK.

Sortie : un script SQL sur stdout, à passer à `psql -v ON_ERROR_STOP=1`.
Aucune connexion ici ; aucune base réelle n'est visée (PostgreSQL éphémère en CI).
"""
import re
import sys

DO_RE = re.compile(r"\bDO\s+(?:LANGUAGE\s+plpgsql\s+)?(\$[A-Za-z_]*\$)", re.I)
COMMENT_LINE_RE = re.compile(r"(?m)^[ \t]*--[^\n]*")

PRELUDE = [
    "BEGIN;",
    "SET LOCAL check_function_bodies = on;",
    "CREATE SCHEMA IF NOT EXISTS cron;",
    "CREATE TABLE IF NOT EXISTS cron.job (jobid bigint, schedule text, command text,"
    " nodename text, nodeport int, database text, username text, active boolean, jobname text);",
]


def extract_do_blocks(sql):
    """Renvoie [(tag, ligne_de_début_du_corps, corps)] ; les lignes de commentaire
    sont vidées d'abord (un `DO $$` cité en commentaire n'est pas un bloc)."""
    sql = COMMENT_LINE_RE.sub("", sql)
    blocks, pos = [], 0
    while (m := DO_RE.search(sql, pos)):
        tag, start = m.group(1), m.end()
        end = sql.find(tag, start)
        if end < 0:
            raise ValueError(f"bloc DO {tag} non fermé (ligne {sql.count(chr(10), 0, start) + 1})")
        blocks.append((tag, sql.count("\n", 0, start) + 1, sql[start:end]))
        pos = end + len(tag)
    return blocks


def build_script(paths):
    out, n = list(PRELUDE), 0
    for path in paths:
        with open(path, encoding="utf-8") as fh:
            blocks = extract_do_blocks(fh.read())
        for tag, line, body in blocks:
            n += 1
            if "$plpgsql_chk$" in body:
                raise ValueError(f"{path}: le corps contient le délimiteur réservé $plpgsql_chk$")
            # La LINE d'une erreur est relative au corps : ligne du fichier = line + LINE - 1.
            out.append(f"\\echo {path} : bloc DO {tag}, corps à partir de la ligne {line}")
            out.append(
                f"CREATE FUNCTION pg_temp.plpgsql_chk_{n}() RETURNS void LANGUAGE plpgsql"
                f" AS $plpgsql_chk${body}$plpgsql_chk$;"
            )
    out.append("ROLLBACK;")
    return "\n".join(out) + "\n", n


def main(argv):
    if not argv:
        print("usage: check-plpgsql-compile.py <migration.sql>...", file=sys.stderr)
        return 2
    try:
        script, n = build_script(argv)
    except (OSError, ValueError) as exc:
        print(f"::error::{exc}", file=sys.stderr)
        return 1
    sys.stdout.write(script)
    print(f"{n} bloc(s) DO à compiler", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
