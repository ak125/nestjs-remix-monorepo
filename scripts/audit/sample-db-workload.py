#!/usr/bin/env python3
"""Échantillonneur **différentiel** de la charge PostgreSQL — lecture seule.

POURQUOI CET INSTRUMENT EXISTE
------------------------------
La question « le compute XL (4 vCPU / 16 Go) peut-il descendre en Large
(2 vCPU / 8 Go) ? » ne se tranche pas sur la taille du disque, et elle ne se
tranche pas non plus sur les compteurs `pg_stat_*` tels quels : ils sont
**cumulés depuis le dernier reset** — `pg_stat_database` depuis le 2025-06-06
(458 jours au 2026-09-07), `pg_stat_statements` depuis le 2025-12-10 **et
saturé** (4 905/5 000 entrées ⇒ éviction active). Sur ce projet ces fenêtres
englobent l'ingestion TecDoc (507 M d'insertions, ~79 h) : la moyenne cumulée
annonce 8,76 tps quand la mesure courante en donne ~4. Un compteur cumulé
répond à « qu'est-ce qui s'est passé depuis un an », jamais à « de quoi cette
base a-t-elle besoin maintenant ».

Le seul relevé honnête est donc **différentiel** : deux lectures espacées, et
la dérivée entre les deux. C'est ce que fait ce script, sans rien muter et sans
jamais toucher aux compteurs.

CE QU'IL MESURE, ET RIEN DE PLUS
--------------------------------
Par fenêtre d'agrégation :

- `sessions_actives_moy / p95 / max` — échantillonné à haute fréquence dans
  `pg_stat_activity`. **C'est le chiffre qui dimensionne le vCPU** : une
  moyenne de 0,1 session active veut dire qu'un seul cœur suffirait ; une
  moyenne proche du nombre de vCPU veut dire que le CPU est le goulot.
- `cache_hit_pct` et `lu_disque_mo_s` — dérivés de `pg_stat_database`. **C'est
  le couple qui dimensionne la RAM** : à `shared_buffers` constant, un débit de
  lecture disque soutenu signifie que le working set déborde déjà du cache.
- `temp_fichiers / temp_mo` — débordements de `work_mem`.
- `connexions` vs `max_connections` — Supabase réduit `max_connections` avec la
  taille de compute (240 en XL). Une pointe proche du plafond est un bloqueur
  indépendant du CPU et de la RAM.

Il **ne dit pas** si Large suffit. Il produit les relevés qui permettent de le
dire, et seulement pour la fenêtre observée : une mesure de soirée ne prouve
rien sur l'heure de pointe. Échantillonner aux heures de pointe fait partie de
la mesure, pas des détails d'exécution.

CONTRAT DE PÉRIMÈTRE — OBSERVATION, JAMAIS UN GATE
--------------------------------------------------
Ce script n'a **aucun seuil** et ne sort jamais non-zéro sur une valeur
mesurée. Il n'est pas branché en CI et ne doit pas l'être : un gate de capacité
serait un second détecteur pour une responsabilité que personne ne porte
aujourd'hui, et il échouerait sur la variance normale du trafic
(`.claude/rules/guardrails.md`, passes 2 et 4). Les décisions de compute sont
owner-gated.

POURQUOI IL NE LIT PAS `pg_stat_statements`
-------------------------------------------
Mesuré le 2026-09-07 : **chaque `SELECT … FROM pg_stat_statements` écrit un
fichier temporaire de 18,43 Mo** sur ce projet (4 905 entrées, textes de requête
matérialisés). Une sonde qui interroge `pg_stat_statements` à chaque tick
fabrique donc elle-même les débordements `work_mem` qu'elle est censée
observer — la première version de cet échantillonneur a rapporté « 18 Mo de
temp toutes les 15 s » qui étaient intégralement les siens. L'effet
d'observation est corrigé à la cause : ce script ne touche pas à la vue.
Pour identifier *quelle* requête consomme, faire un différentiel
`pg_stat_statements` **séparé et ponctuel**, en sachant qu'il se compte
lui-même.

USAGE
-----
    export DATABASE_URL=…                       # pooler ⇒ user = postgres.<ref>
    python3 scripts/audit/sample-db-workload.py --duration 1800
    python3 scripts/audit/sample-db-workload.py --duration 3600 --emit audit/…json
    python3 scripts/audit/sample-db-workload.py --self-test    # pas de DB
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
import sys
import time
from datetime import datetime, timezone

EXIT_OK = 0
EXIT_USAGE = 2

# Fenêtre d'agrégation et fréquence d'échantillonnage des sessions. Le tick est
# court parce qu'une requête de 300 ms est invisible à un tick de 60 s : c'est
# la fréquence qui fait la fidélité de `sessions_actives_moy`, pas la fenêtre.
DEFAULT_WINDOW_S = 60.0
DEFAULT_TICK_S = 1.0

DB_COUNTERS = """
SELECT xact_commit + xact_rollback AS xacts,
       blks_read, blks_hit, temp_files, temp_bytes, numbackends
  FROM pg_stat_database
 WHERE datname = current_database()
"""

# `pg_stat_activity` est une vue mémoire : pas de lecture de fichier, pas de
# tri, donc pas de fichier temporaire — contrairement à pg_stat_statements.
ACTIVITY = """
SELECT count(*) FILTER (WHERE state = 'active')                        AS actives,
       count(*) FILTER (WHERE state = 'active'
                          AND wait_event_type IS NOT NULL)             AS actives_en_attente,
       count(*)                                                        AS connexions
  FROM pg_stat_activity
 WHERE datname = current_database() AND pid <> pg_backend_pid()
"""

SETTINGS = """
SELECT current_setting('max_connections')::int,
       current_setting('shared_buffers'),
       current_setting('effective_cache_size'),
       current_setting('work_mem')
"""


def fail(code: int, msg: str) -> None:
    print(f"ERREUR: {msg}", file=sys.stderr)
    sys.exit(code)


# --------------------------------------------------------------------------
# Agrégation — fonctions pures, couvertes par --self-test
# --------------------------------------------------------------------------

def percentile(values: list[float], q: float) -> float:
    """Percentile par rang le plus proche (borné aux extrêmes de l'échantillon).

    `statistics.quantiles` interpole et refuse n < 2 ; sur des comptages de
    sessions, une valeur interpolée n'existe pas dans le système observé.
    """
    if not values:
        return 0.0
    ordered = sorted(values)
    idx = max(0, min(len(ordered) - 1, int(round(q * (len(ordered) - 1)))))
    return float(ordered[idx])


def window_metrics(before: dict, after: dict, ticks: list[dict], elapsed_s: float) -> dict:
    """Dérive une fenêtre à partir de deux relevés de compteurs et des ticks.

    `elapsed_s` est mesuré sur une horloge monotone par l'appelant : l'heure
    murale peut sauter, et une division par un intervalle faux fabrique
    silencieusement des débits faux.
    """
    if elapsed_s <= 0:
        raise ValueError("elapsed_s doit être > 0")
    read = after["blks_read"] - before["blks_read"]
    hit = after["blks_hit"] - before["blks_hit"]
    actives = [t["actives"] for t in ticks]
    conns = [t["connexions"] for t in ticks]
    return {
        "fenetre_s": round(elapsed_s, 1),
        "ticks": len(ticks),
        "tps": round((after["xacts"] - before["xacts"]) / elapsed_s, 2),
        "cache_hit_pct": round(100.0 * hit / (hit + read), 2) if (hit + read) else None,
        "lu_disque_mo": round(read * 8192 / 1e6, 2),
        "lu_disque_mo_s": round(read * 8192 / 1e6 / elapsed_s, 3),
        "sessions_actives_moy": round(statistics.fmean(actives), 3) if actives else 0.0,
        "sessions_actives_p95": percentile([float(a) for a in actives], 0.95),
        "sessions_actives_max": max(actives) if actives else 0,
        "actives_en_attente_max": max((t["actives_en_attente"] for t in ticks), default=0),
        "connexions_moy": round(statistics.fmean(conns), 1) if conns else 0.0,
        "connexions_max": max(conns) if conns else 0,
        "temp_fichiers": after["temp_files"] - before["temp_files"],
        "temp_mo": round((after["temp_bytes"] - before["temp_bytes"]) / 1e6, 2),
    }


def summarize(windows: list[dict]) -> dict:
    """Résume les fenêtres. Les maxima priment : c'est la pointe qui dimensionne."""
    if not windows:
        return {}
    total_s = sum(w["fenetre_s"] for w in windows)
    total_mo = sum(w["lu_disque_mo"] for w in windows)
    moy = [w["sessions_actives_moy"] for w in windows]
    return {
        "fenetres": len(windows),
        "duree_totale_s": round(total_s, 1),
        "tps_moy": round(statistics.fmean([w["tps"] for w in windows]), 2),
        "sessions_actives_moy": round(statistics.fmean(moy), 3),
        "sessions_actives_p95_max": max(w["sessions_actives_p95"] for w in windows),
        "sessions_actives_max": max(w["sessions_actives_max"] for w in windows),
        "actives_en_attente_max": max(w["actives_en_attente_max"] for w in windows),
        "connexions_max": max(w["connexions_max"] for w in windows),
        "lu_disque_mo_s_moy": round(total_mo / total_s, 3) if total_s else 0.0,
        "lu_disque_mo_s_max": max(w["lu_disque_mo_s"] for w in windows),
        "cache_hit_pct_min": min(
            (w["cache_hit_pct"] for w in windows if w["cache_hit_pct"] is not None),
            default=None,
        ),
        "temp_mo_total": round(sum(w["temp_mo"] for w in windows), 2),
    }


# --------------------------------------------------------------------------
# Collecte
# --------------------------------------------------------------------------

def connect():
    try:
        import psycopg
    except ImportError:
        fail(EXIT_USAGE, "psycopg manquant — pip install 'psycopg[binary]==3.2.*'")
    url = os.environ.get("DATABASE_URL")
    if not url:
        fail(EXIT_USAGE, "DATABASE_URL absent de l'environnement.")
    return psycopg.connect(url, autocommit=True)


def read_counters(cur) -> dict:
    cur.execute(DB_COUNTERS)
    cols = [c.name for c in cur.description]
    return dict(zip(cols, cur.fetchone()))


def read_tick(cur) -> dict:
    cur.execute(ACTIVITY)
    actives, waiting, conns = cur.fetchone()
    return {"actives": actives, "actives_en_attente": waiting, "connexions": conns}


def run(duration_s: float, window_s: float, tick_s: float, emit: str | None) -> int:
    with connect() as conn, conn.cursor() as cur:
        # Le read-only est affirmé côté serveur, pas seulement par convention :
        # toute écriture accidentelle échouerait au lieu de passer.
        cur.execute("SET default_transaction_read_only = on")
        cur.execute("SET statement_timeout = '15s'")
        cur.execute(SETTINGS)
        max_conn, shared_buffers, eff_cache, work_mem = cur.fetchone()
        header = {
            "debut": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "max_connections": max_conn,
            "shared_buffers": shared_buffers,
            "effective_cache_size": eff_cache,
            "work_mem": work_mem,
        }
        print(json.dumps({"entete": header}, ensure_ascii=False), flush=True)

        windows: list[dict] = []
        deadline = time.monotonic() + duration_s
        while time.monotonic() < deadline:
            w_start = time.monotonic()
            before = read_counters(cur)
            ticks: list[dict] = []
            w_end = min(w_start + window_s, deadline)
            while time.monotonic() < w_end:
                ticks.append(read_tick(cur))
                time.sleep(tick_s)
            after = read_counters(cur)
            w = window_metrics(before, after, ticks, time.monotonic() - w_start)
            w["ts"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
            windows.append(w)
            print(json.dumps(w, ensure_ascii=False), flush=True)

    resume = summarize(windows)
    print(json.dumps({"resume": resume}, ensure_ascii=False), flush=True)
    if emit:
        with open(emit, "w", encoding="utf-8") as fh:
            json.dump({"entete": header, "fenetres": windows, "resume": resume},
                      fh, ensure_ascii=False, indent=2)
        print(f"→ {emit}", file=sys.stderr)
    return EXIT_OK


# --------------------------------------------------------------------------
# Self-test — aucune DB requise
# --------------------------------------------------------------------------

def self_test() -> int:
    n = 0

    def check(cond, label):
        nonlocal n
        assert cond, label
        n += 1

    check(percentile([], 0.95) == 0.0, "percentile: échantillon vide → 0")
    check(percentile([3.0], 0.95) == 3.0, "percentile: un seul point")
    # Rang le plus proche : jamais une valeur absente de l'échantillon.
    check(percentile([0.0, 0.0, 0.0, 5.0], 0.95) == 5.0, "percentile: p95 atteint le max")
    check(percentile([0.0, 1.0, 2.0, 3.0], 0.5) in (1.0, 2.0), "percentile: médiane dans l'échantillon")
    check(all(percentile([1.0, 2.0, 9.0], q) in (1.0, 2.0, 9.0) for q in (0.0, 0.5, 0.95, 1.0)),
          "percentile: n'interpole jamais")

    before = {"xacts": 100, "blks_read": 10, "blks_hit": 90,
              "temp_files": 0, "temp_bytes": 0, "numbackends": 5}
    after = {"xacts": 400, "blks_read": 60, "blks_hit": 1030,
             "temp_files": 2, "temp_bytes": 3_000_000, "numbackends": 6}
    ticks = [{"actives": 0, "actives_en_attente": 0, "connexions": 10},
             {"actives": 2, "actives_en_attente": 1, "connexions": 12},
             {"actives": 1, "actives_en_attente": 0, "connexions": 11}]
    w = window_metrics(before, after, ticks, 60.0)
    check(w["tps"] == 5.0, "tps = 300 transactions / 60 s")
    # 50 blocs lus, 940 hits ⇒ 940/990.
    check(w["cache_hit_pct"] == 94.95, f"cache_hit attendu 94.95, obtenu {w['cache_hit_pct']}")
    check(w["lu_disque_mo"] == 0.41, f"50 blocs = 0.41 Mo, obtenu {w['lu_disque_mo']}")
    check(w["sessions_actives_moy"] == 1.0, "moyenne (0+2+1)/3")
    check(w["sessions_actives_max"] == 2, "max des ticks")
    check(w["actives_en_attente_max"] == 1, "max des actives en attente")
    check(w["connexions_max"] == 12, "max des connexions")
    check(w["temp_fichiers"] == 2 and w["temp_mo"] == 3.0, "delta temp")
    check(w["ticks"] == 3, "nombre de ticks conservé")

    # Une fenêtre sans I/O disque du tout ne doit pas annoncer 0 % de cache.
    quiet_after = dict(before, xacts=100)
    wq = window_metrics(before, quiet_after, ticks, 10.0)
    check(wq["cache_hit_pct"] is None, "aucun bloc touché ⇒ hit ratio indéfini, pas 0")
    check(wq["tps"] == 0.0, "aucune transaction ⇒ 0 tps")

    try:
        window_metrics(before, after, ticks, 0)
    except ValueError:
        n += 1
    else:
        raise AssertionError("elapsed_s = 0 doit lever, pas diviser par zéro")

    s = summarize([w, wq])
    check(s["fenetres"] == 2, "résumé: 2 fenêtres")
    check(s["sessions_actives_max"] == 2, "résumé: max propagé")
    check(s["cache_hit_pct_min"] == 94.95, "résumé: min ignore les fenêtres sans I/O")
    check(summarize([]) == {}, "résumé d'une liste vide")

    print(f"self-test OK — {n} assertions")
    return EXIT_OK


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(
        description="Échantillonneur différentiel read-only de la charge PostgreSQL.",
        epilog="Observation seule — aucun seuil, aucun verdict, jamais en CI.",
    )
    p.add_argument("--duration", type=float, default=1800.0,
                   help="durée totale du relevé en secondes (défaut 1800)")
    p.add_argument("--window", type=float, default=DEFAULT_WINDOW_S,
                   help=f"fenêtre d'agrégation en secondes (défaut {DEFAULT_WINDOW_S:g})")
    p.add_argument("--tick", type=float, default=DEFAULT_TICK_S,
                   help=f"période d'échantillonnage des sessions (défaut {DEFAULT_TICK_S:g})")
    p.add_argument("--emit", metavar="FICHIER", help="écrit le relevé complet en JSON")
    p.add_argument("--self-test", action="store_true", help="teste les fonctions pures, sans DB")
    args = p.parse_args(argv)

    if args.self_test:
        return self_test()
    if args.tick <= 0 or args.window <= 0 or args.duration <= 0:
        fail(EXIT_USAGE, "--duration, --window et --tick doivent être > 0.")
    if args.tick > args.window:
        fail(EXIT_USAGE, "--tick doit être ≤ --window, sinon la fenêtre n'a aucun tick.")
    return run(args.duration, args.window, args.tick, args.emit)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
