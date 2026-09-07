#!/usr/bin/env python3
"""Ratchet de cohérence **ledger ↔ catalogue** — un objet déclaré par une
migration `applied` doit exister quelque part en base.

POURQUOI CE GARDE EXISTE
------------------------
`infra.schema_migrations` dit `applied`. Sur ce projet, **270 des 300 lignes
`applied` sont des baselines** (221 le 2026-05-16, 49 le 2026-09-02) : la
migration a été marquée appliquée **sans être exécutée**, parce qu'on supposait
l'objet déjà présent par un autre canal. C'est le mode d'emploi documenté de
`--baseline`. Ce qui manquait, c'est que **rien n'a jamais confronté la
supposition au catalogue**.

Le moteur (`scripts/ci/apply-supabase-migration.py`) vérifie déjà la fraîcheur
ledger ↔ **fichiers** : checksum, drift, `applying`, `failed`, backlog. Personne
ne vérifiait ledger ↔ **base**. Mesure du 2026-09-07 : 24 relations, 10
fonctions, 3 types et 1 valeur d'enum déclarés par des migrations `applied`
étaient absents de TOUS les schémas — dont 10 relations lues par 27 appels
`.from()` vivants, invisibles au typecheck (le client Supabase n'est pas typé
`Database`). Détail : `audit/massdoc-ledger-declared-objects-2026-09-07.md`,
PR #1407.

CE QUE CE GARDE AFFIRME, ET RIEN DE PLUS
----------------------------------------
**Un objet déclaré par une migration que le ledger dit `applied` existe dans le
catalogue, dans n'importe quel schéma.**

Il ne dit PAS dans quel schéma l'objet devrait être : une relation déplacée dans
`_archive` par un `SET SCHEMA` est **présente** et ne déclenche rien ici. Savoir
si `public` devrait la porter est une autre question, instruite ailleurs
(`audit/massdoc-ledger-tail-owner-decisions-2026-09-04.md`) — un garde qui répondrait
aux deux serait un garde au périmètre flou.

Il ne remplace ni ne double aucun garde existant : les invariants registry
travaillent hors ligne sur les projections L1/L2/L3, `--status` travaille sur le
ledger et les fichiers. Cette responsabilité-ci n'était portée par personne.

LA MÉCANIQUE DE RATCHET
-----------------------
Les absences connues au 2026-09-07 sont **déclarées** dans
`audit/baselines/ledger-catalog-baseline.json`, chacune avec la migration qui la
déclare. Le baseline est une dette écrite, visible en revue — pas un silencieux.
Le ratchet est **symétrique** :

* une absence **nouvelle** échoue — quelqu'un a baseliné une hypothèse fausse,
  ou un objet a été supprimé hors migration ;
* une absence **résolue** échoue aussi, tant que le baseline n'a pas été
  rafraîchi. Un ratchet qui accepte silencieusement une baisse cesse d'être une
  mesure. Rafraîchir avec `--refresh`, **dans la même PR** que la correction.

LIMITES ASSUMÉES
----------------
L'extraction est une analyse par expressions régulières, pas un parseur SQL :
elle sous-détecte le DDL construit dynamiquement dans un `DO $$`. La comparaison
est **insensible à la casse et au schéma** — Postgres replie les identifiants
non quotés en minuscules, et on cherche l'objet dans tous les schémas. Ce choix
sur-apparie légèrement (deux objets homonymes dans deux schémas sont
indiscernables) : pour un ratchet dont l'échec accuse quelqu'un d'avoir menti,
se tromper du côté du silence est le bon sens de l'erreur.

Les partitions datées (`…_YYYY_MM`) sont écartées : elles sont créées et
retirées par la rotation, leur absence n'accuse pas la migration qui les a
déclarées.

USAGE
-----
::

    python3 scripts/audit/check-ledger-catalog-ratchet.py --self-test
    python3 scripts/audit/check-ledger-catalog-ratchet.py --emit /tmp/declared.json
    python3 scripts/audit/check-ledger-catalog-ratchet.py --verify        # a besoin de DATABASE_URL
    python3 scripts/audit/check-ledger-catalog-ratchet.py --verify --json
    python3 scripts/audit/check-ledger-catalog-ratchet.py --refresh       # réécrit le baseline

Lecture seule côté base : uniquement des `SELECT` sur les catalogues système et
sur `infra.schema_migrations`. Aucun DDL, aucun `bootstrap()`.

CODES DE SORTIE
---------------
0 conforme · 1 violation de ratchet · 2 usage ou environnement · 3 baseline absent
"""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import re
import sys

MIGRATIONS_DIR = pathlib.Path("backend/supabase/migrations")
BASELINE_PATH = pathlib.Path("audit/baselines/ledger-catalog-baseline.json")
SCHEMA_VERSION = "1.0.0"

EXIT_OK = 0
EXIT_RATCHET = 1
EXIT_USAGE = 2
EXIT_NO_BASELINE = 3


def fail(code: int, message: str) -> "None":
    print(f"[ledger-catalog] {message}", file=sys.stderr)
    sys.exit(code)


# --------------------------------------------------------------------------
# 1. Extraction — déterministe, hors ligne, testable sans base
# --------------------------------------------------------------------------

DECL_PATTERNS = {
    "table": re.compile(
        r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_.\"]+)", re.I
    ),
    "view": re.compile(
        r"CREATE\s+(?:OR\s+REPLACE\s+)?(?:MATERIALIZED\s+)?VIEW\s+"
        r"(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_.\"]+)",
        re.I,
    ),
    "function": re.compile(
        r"CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-zA-Z0-9_.\"]+)\s*\(", re.I
    ),
    "type": re.compile(r"CREATE\s+TYPE\s+([a-zA-Z0-9_.\"]+)", re.I),
    # Le libellé accepte l'apostrophe doublée (`'it''s'`), qui est un littéral
    # SQL valide : la capture naïve `'([^']+)'` s'arrêterait sur `it` et
    # enregistrerait une identité fausse.
    "enumvalue": re.compile(
        r"ALTER\s+TYPE\s+([a-zA-Z0-9_.\"]+)\s+ADD\s+VALUE\s+"
        r"(?:IF\s+NOT\s+EXISTS\s+)?'((?:[^']|'')+)'",
        re.I,
    ),
}

# Une migration ultérieure a le droit de supprimer ce qu'une précédente a créé —
# l'objet est alors absent **légitimement**, et le signaler serait un faux
# positif qui gonflerait le baseline jusqu'à le vider de son sens. Les ids de
# migration s'ordonnent lexicalement (le moteur l'assure), donc « supprimé
# après » se décide par comparaison de chaînes.
DROP_PATTERNS = {
    "relation": re.compile(
        r"DROP\s+(?:MATERIALIZED\s+)?(?:TABLE|VIEW)\s+"
        r"(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_.\"]+)",
        re.I,
    ),
    "function": re.compile(
        r"DROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_.\"]+)", re.I
    ),
    "type": re.compile(r"DROP\s+TYPE\s+(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_.\"]+)", re.I),
}

# Partitions datées : `__seo_crux_field_history_2026_05`. Créées et retirées par
# la rotation, pas par la migration qui les déclare — leur absence n'accuse rien.
DATED_PARTITION_RE = re.compile(r"_\d{4}_\d{2}$")

# Littéraux SQL, avec l'échappement par doublement (`'it''s'`). Tout DDL vivant
# dans une chaîne est **dynamique** — `EXECUTE format('CREATE TABLE IF NOT
# EXISTS %I PARTITION OF %I …')` — et son identifiant réel n'est connu qu'à
# l'exécution. Les scanner produit deux artefacts observés sur ce dépôt : un nom
# vide (la capture s'arrête sur `public.`) et le faux nom `if` (le moteur
# rétrograde sur `IF NOT EXISTS` quand `%I` ne peut pas être un identifiant).
# On neutralise donc les littéraux avant l'analyse statique — la valeur d'enum
# est la seule forme qui a besoin du contenu de la chaîne, elle lit le corps brut.
STRING_LITERAL_RE = re.compile(r"'(?:[^']|'')*'", re.S)

# `table` et `view` vivent tous deux dans pg_class : une seule recherche.
CATALOG_BUCKET = {
    "table": "relation",
    "view": "relation",
    "function": "function",
    "type": "type",
    "enumvalue": "enumvalue",
}


def strip_line_comments(sql: str) -> str:
    """Retire les commentaires `--` pour éviter qu'un exemple commenté ne compte
    comme une déclaration. Ne traite pas les blocs `/* */` : aucune migration du
    dépôt n'y cache de DDL, et un retrait naïf casserait les chaînes."""
    return "\n".join(line.split("--")[0] for line in sql.splitlines())


def normalize(identifier: str) -> str:
    """`public."Foo"` → `foo`. Le schéma est écarté (la recherche est
    cross-schéma) et la casse repliée (Postgres replie les identifiants non
    quotés)."""
    return identifier.strip('"').split(".")[-1].strip('"').lower()


def dropped_objects(migrations_dir: pathlib.Path = MIGRATIONS_DIR) -> dict:
    """{bucket: {nom: id de la DERNIÈRE migration montante qui le supprime}}."""
    out: dict[str, dict[str, str]] = {b: {} for b in DROP_PATTERNS}
    for path in sorted(migrations_dir.glob("*.sql")):
        if path.name.endswith(".down.sql"):
            continue
        body = strip_line_comments(path.read_text(encoding="utf-8", errors="replace"))
        static_body = STRING_LITERAL_RE.sub("''", body)
        for bucket, pattern in DROP_PATTERNS.items():
            for match in pattern.finditer(static_body):
                name = normalize(match.group(1))
                if not name:
                    continue
                previous = out[bucket].get(name)
                if previous is None or path.stem > previous:
                    out[bucket][name] = path.stem
    return out


def declared_objects(migrations_dir: pathlib.Path = MIGRATIONS_DIR) -> dict:
    """{migration_id: [{kind, name, label}]} pour chaque fichier `*.sql` montant."""
    out: dict[str, list[dict]] = {}
    for path in sorted(migrations_dir.glob("*.sql")):
        if path.name.endswith(".down.sql"):
            continue
        body = strip_line_comments(path.read_text(encoding="utf-8", errors="replace"))
        static_body = STRING_LITERAL_RE.sub("''", body)
        declarations: list[dict] = []
        for kind, pattern in DECL_PATTERNS.items():
            source = body if kind == "enumvalue" else static_body
            for match in pattern.finditer(source):
                name = normalize(match.group(1))
                if kind == "enumvalue":
                    # `''` dans un littéral SQL vaut une apostrophe : c'est ce
                    # que `pg_enum.enumlabel` stocke, donc ce qu'on compare.
                    label = match.group(2).replace("''", "'")
                    declarations.append({"kind": kind, "name": name, "label": label})
                    continue
                if DATED_PARTITION_RE.search(name):
                    continue
                declarations.append({"kind": kind, "name": name, "label": None})
        if declarations:
            out[path.stem] = declarations
    return out


def identity(declaration: dict) -> str:
    """Clé stable d'un objet déclaré, utilisée par le baseline et le ratchet."""
    if declaration["kind"] == "enumvalue":
        return f"enumvalue:{declaration['name']}.{declaration['label']}"
    return f"{declaration['kind']}:{declaration['name']}"


# --------------------------------------------------------------------------
# 2. Catalogue — les requêtes, partagées par tous les chemins d'exécution
# --------------------------------------------------------------------------

# `pg_catalog` / `information_schema` / `pg_toast` sont écartés : un objet du
# dépôt qui porterait le nom d'un objet système serait déclaré présent à tort.
_SYSTEM_SCHEMAS = "('pg_catalog', 'information_schema', 'pg_toast')"

CATALOG_QUERIES = {
    # relkind : r=table, p=partitionnée, v=vue, m=vue matérialisée, f=étrangère
    "relation": (
        "SELECT lower(c.relname) FROM pg_class c "
        "JOIN pg_namespace n ON n.oid = c.relnamespace "
        "WHERE c.relkind IN ('r','p','v','m','f') "
        f"AND n.nspname NOT IN {_SYSTEM_SCHEMAS}"
    ),
    "function": (
        "SELECT lower(p.proname) FROM pg_proc p "
        "JOIN pg_namespace n ON n.oid = p.pronamespace "
        f"WHERE n.nspname NOT IN {_SYSTEM_SCHEMAS}"
    ),
    "type": (
        "SELECT lower(t.typname) FROM pg_type t "
        "JOIN pg_namespace n ON n.oid = t.typnamespace "
        f"WHERE n.nspname NOT IN {_SYSTEM_SCHEMAS}"
    ),
    "enumvalue": (
        "SELECT lower(t.typname) || '.' || e.enumlabel FROM pg_enum e "
        "JOIN pg_type t ON t.oid = e.enumtypid "
        "JOIN pg_namespace n ON n.oid = t.typnamespace "
        f"WHERE n.nspname NOT IN {_SYSTEM_SCHEMAS}"
    ),
}

APPLIED_IDS_QUERY = "SELECT id FROM infra.schema_migrations WHERE status = 'applied'"


def fetch_catalog(conn) -> dict:
    """{bucket: set(noms)} — un aller-retour par catégorie, en lecture seule."""
    catalog: dict[str, set] = {}
    for bucket, query in CATALOG_QUERIES.items():
        with conn.cursor() as cur:
            cur.execute(query)
            catalog[bucket] = {row[0] for row in cur.fetchall()}
    return catalog


def fetch_applied_ids(conn) -> set:
    with conn.cursor() as cur:
        cur.execute(APPLIED_IDS_QUERY)
        return {row[0] for row in cur.fetchall()}


# --------------------------------------------------------------------------
# 3. Réconciliation
# --------------------------------------------------------------------------


def unexplained(
    declared: dict, applied_ids: set, catalog: dict, dropped: dict | None = None
) -> list:
    """Objets déclarés par une migration `applied`, absents de tout schéma, et
    dont l'absence n'est PAS expliquée par un DROP dans une migration ultérieure.

    Trié par identité pour que la sortie et le baseline soient déterministes.
    Une même identité déclarée par plusieurs migrations les liste toutes."""
    dropped = dropped or {}
    by_identity: dict[str, dict] = {}
    for migration_id, declarations in declared.items():
        if migration_id not in applied_ids:
            continue
        for declaration in declarations:
            bucket = CATALOG_BUCKET[declaration["kind"]]
            key = (
                f"{declaration['name']}.{declaration['label']}"
                if declaration["kind"] == "enumvalue"
                else declaration["name"]
            )
            if key in catalog.get(bucket, set()):
                continue
            drop_id = dropped.get(bucket, {}).get(declaration["name"])
            if drop_id is not None and drop_id > migration_id:
                continue
            ident = identity(declaration)
            entry = by_identity.setdefault(
                ident,
                {"identity": ident, "kind": declaration["kind"], "declaredBy": []},
            )
            if migration_id not in entry["declaredBy"]:
                entry["declaredBy"].append(migration_id)
    for entry in by_identity.values():
        entry["declaredBy"].sort()
    return [by_identity[k] for k in sorted(by_identity)]


def compare(current: list, baseline_entries: list) -> tuple:
    """(ajoutées, résolues) — ratchet symétrique."""
    current_ids = {e["identity"] for e in current}
    baseline_ids = {e["identity"] for e in baseline_entries}
    added = sorted(current_ids - baseline_ids)
    resolved = sorted(baseline_ids - current_ids)
    return added, resolved


# --------------------------------------------------------------------------
# 4. Baseline
# --------------------------------------------------------------------------

BASELINE_CONTRACT = (
    "Absences declarees : un objet (table, vue, fonction, type, valeur d'enum) "
    "declare par une migration que infra.schema_migrations dit 'applied', et "
    "absent de TOUS les schemas du catalogue. Le predicat est l'existence, pas "
    "l'emplacement : une relation deplacee dans _archive est presente et n'est "
    "PAS listee ici. Ces entrees sont une dette ecrite, instruite dans "
    "audit/massdoc-ledger-declared-objects-2026-09-07.md (PR #1407) et arbitree "
    "dans audit/massdoc-ledger-tail-owner-decisions-2026-09-04.md ; ce fichier ne les "
    "absout pas, il empeche qu'elles augmentent en silence. Ratchet symetrique : "
    "une absence nouvelle ECHOUE, une absence resolue ECHOUE aussi tant que ce "
    "fichier n'a pas ete rafraichi (--refresh) dans la MEME PR que la correction."
)


def render_baseline(entries: list) -> dict:
    return {
        "schemaVersion": SCHEMA_VERSION,
        "_contract": BASELINE_CONTRACT,
        "count": len(entries),
        "byKind": {
            kind: sum(1 for e in entries if e["kind"] == kind)
            for kind in sorted({e["kind"] for e in entries})
        },
        "entries": entries,
    }


def load_baseline(path: pathlib.Path = BASELINE_PATH):
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def write_baseline(entries: list, path: pathlib.Path = BASELINE_PATH) -> "None":
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(render_baseline(entries), indent=2, ensure_ascii=True) + "\n",
        encoding="utf-8",
    )


# --------------------------------------------------------------------------
# 5. Auto-test — hors ligne, sans base ni psycopg
# --------------------------------------------------------------------------


def _write(tmp: pathlib.Path, name: str, sql: str) -> "None":
    (tmp / name).write_text(sql, encoding="utf-8")


def self_test() -> "None":
    import tempfile

    checks = 0

    def ok(condition: bool, label: str) -> "None":
        nonlocal checks
        if not condition:
            fail(EXIT_USAGE, f"self-test ÉCHEC : {label}")
        checks += 1

    with tempfile.TemporaryDirectory() as raw:
        tmp = pathlib.Path(raw)
        _write(
            tmp,
            "20260101_a.sql",
            "CREATE TABLE IF NOT EXISTS public.alpha (id int);\n"
            "CREATE OR REPLACE VIEW v_alpha AS SELECT 1;\n"
            "CREATE OR REPLACE FUNCTION public.f_alpha() RETURNS int AS $$ $$;\n"
            "CREATE TYPE alpha_status AS ENUM ('a');\n"
            "ALTER TYPE alpha_status ADD VALUE IF NOT EXISTS 'b';\n",
        )
        _write(tmp, "20260101_a.down.sql", "CREATE TABLE never_seen (id int);\n")
        _write(
            tmp,
            "20260102_b.sql",
            "-- CREATE TABLE commented_out (id int);\n"
            'CREATE TABLE "__hist_2026_05" (id int);\n'
            "EXECUTE format('CREATE TABLE public.%I PARTITION OF public.%I');\n"
            "EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF %I');\n"
            "CREATE TABLE beta (id int);\n",
        )
        _write(
            tmp,
            "20260103_c.sql",
            "ALTER TYPE it_status ADD VALUE IF NOT EXISTS 'it''s';\n",
        )
        declared = declared_objects(tmp)

        ids_a = {identity(d) for d in declared["20260101_a"]}
        ok(
            ids_a
            == {
                "table:alpha",
                "view:v_alpha",
                "function:f_alpha",
                "type:alpha_status",
                "enumvalue:alpha_status.b",
            },
            "extraction des 5 formes de déclaration",
        )
        ok("20260101_a.down" not in declared, "les fichiers .down.sql sont ignorés")
        ids_b = {identity(d) for d in declared["20260102_b"]}
        ok("table:commented_out" not in ids_b, "un CREATE TABLE commenté ne compte pas")
        ok("table:__hist_2026_05" not in ids_b, "les partitions datées sont écartées")
        ok(
            ids_b == {"table:beta"},
            "le DDL dynamique dans format(…) ne déclare rien (ni nom vide, ni « if »)",
        )
        ok("table:beta" in ids_b, "la déclaration voisine de la partition subsiste")
        ok(
            {identity(d) for d in declared["20260103_c"]} == {"enumvalue:it_status.it's"},
            "la valeur d'enum lit le corps brut, apostrophe doublée comprise",
        )

        # Réconciliation
        full = {"relation": {"alpha", "v_alpha", "beta"}, "function": {"f_alpha"},
                "type": {"alpha_status"}, "enumvalue": {"alpha_status.b"}}
        ok(
            unexplained(declared, {"20260101_a", "20260102_b"}, full) == [],
            "tout présent ⇒ aucune absence",
        )
        ok(
            unexplained(declared, set(), full) == [],
            "aucune migration applied ⇒ rien n'est reproché",
        )
        empty = {"relation": set(), "function": set(), "type": set(), "enumvalue": set()}
        ok(
            [e["identity"] for e in unexplained(declared, {"20260102_b"}, empty)]
            == ["table:beta"],
            "seules les migrations applied sont confrontées",
        )
        archived = {"relation": {"beta"}, "function": set(), "type": set(),
                    "enumvalue": set()}
        ok(
            unexplained({"m": [{"kind": "table", "name": "beta", "label": None}]},
                        {"m"}, archived) == [],
            "un objet présent dans n'importe quel schéma est présent",
        )
        # Un DROP dans une migration ULTÉRIEURE explique l'absence ; un DROP
        # antérieur (l'objet est ensuite recréé) ne l'explique pas.
        _decl = {"m2": [{"kind": "table", "name": "delta", "label": None}]}
        ok(
            unexplained(_decl, {"m2"}, empty, {"relation": {"delta": "m3"}}) == [],
            "un DROP postérieur explique l'absence",
        )
        ok(
            [e["identity"] for e in
             unexplained(_decl, {"m2"}, empty, {"relation": {"delta": "m1"}})]
            == ["table:delta"],
            "un DROP antérieur (objet recréé depuis) n'explique rien",
        )
        _write(tmp, "20260104_d.sql", "DROP VIEW IF EXISTS public.v_gone;\n")
        _write(tmp, "20260105_e.sql", "DROP TABLE public.v_gone;\n")
        drops = dropped_objects(tmp)
        ok(
            drops["relation"].get("v_gone") == "20260105_e",
            "le DROP retenu est celui de la migration la PLUS RÉCENTE",
        )

        multi = unexplained(
            {
                "m1": [{"kind": "table", "name": "gamma", "label": None}],
                "m2": [{"kind": "table", "name": "gamma", "label": None}],
            },
            {"m1", "m2"},
            empty,
        )
        ok(
            multi[0]["declaredBy"] == ["m1", "m2"],
            "une absence déclarée deux fois nomme ses deux migrations",
        )

        # Ratchet symétrique
        base = [{"identity": "table:known", "kind": "table", "declaredBy": ["m"]}]
        ok(compare(base, base) == ([], []), "état identique ⇒ ratchet vert")
        ok(
            compare(
                base + [{"identity": "table:new", "kind": "table", "declaredBy": ["m"]}],
                base,
            )
            == (["table:new"], []),
            "une absence nouvelle est signalée",
        )
        ok(
            compare([], base) == ([], ["table:known"]),
            "une absence résolue est signalée (symétrie)",
        )

        # Déterminisme du baseline
        shuffled = list(reversed(multi))
        ok(
            json.dumps(render_baseline(sorted(multi, key=lambda e: e["identity"])))
            == json.dumps(render_baseline(sorted(shuffled, key=lambda e: e["identity"]))),
            "le rendu du baseline est indépendant de l'ordre d'entrée",
        )
        ok(
            render_baseline(base)["byKind"] == {"table": 1},
            "le décompte par nature est calculé, pas saisi",
        )

    print(f"[ledger-catalog] self-test OK — {checks} assertions")


# --------------------------------------------------------------------------
# 6. CLI
# --------------------------------------------------------------------------


def connect():
    try:
        import psycopg  # noqa: PLC0415 — importé tard : --self-test n'en a pas besoin
    except ImportError:
        fail(EXIT_USAGE, "psycopg absent — pip install 'psycopg[binary]'")
    url = os.environ.get("DATABASE_URL")
    if not url:
        fail(EXIT_USAGE, "DATABASE_URL env var missing.")
    return psycopg.connect(url, autocommit=True)


def run_verify(refresh: bool, as_json: bool) -> "None":
    declared = declared_objects()
    dropped = dropped_objects()
    with connect() as conn:
        applied_ids = fetch_applied_ids(conn)
        catalog = fetch_catalog(conn)
    current = unexplained(declared, applied_ids, catalog, dropped)

    if refresh:
        write_baseline(current)
        print(
            f"[ledger-catalog] baseline réécrit : {len(current)} absences déclarées "
            f"→ {BASELINE_PATH}"
        )
        return

    baseline = load_baseline()
    if baseline is None:
        fail(
            EXIT_NO_BASELINE,
            f"{BASELINE_PATH} absent — le créer avec --refresh, jamais à la main.",
        )
    added, resolved = compare(current, baseline["entries"])

    if as_json:
        print(
            json.dumps(
                {
                    "appliedMigrations": len(applied_ids),
                    "declaredMigrations": len(declared),
                    "unexplained": len(current),
                    "baseline": baseline["count"],
                    "added": added,
                    "resolved": resolved,
                },
                indent=2,
            )
        )

    print(
        f"[ledger-catalog] {len(applied_ids)} migrations applied · "
        f"{len(current)} absences · baseline {baseline['count']}"
    )

    if added:
        for ident in added:
            entry = next(e for e in current if e["identity"] == ident)
            print(
                f"  NOUVELLE ABSENCE  {ident}  déclarée par "
                f"{', '.join(entry['declaredBy'])}",
                file=sys.stderr,
            )
        fail(
            EXIT_RATCHET,
            f"{len(added)} absence(s) nouvelle(s). Soit une migration a été "
            "baselinée sur une hypothèse fausse, soit un objet a été supprimé "
            "hors migration. Corriger la cause, pas le baseline.",
        )
    if resolved:
        for ident in resolved:
            print(f"  ABSENCE RÉSOLUE  {ident}", file=sys.stderr)
        fail(
            EXIT_RATCHET,
            f"{len(resolved)} absence(s) résolue(s) non déclarée(s) — rafraîchir "
            "le baseline avec --refresh dans la MÊME PR que la correction.",
        )
    print("[ledger-catalog] ✓ ledger et catalogue concordent (au baseline près)")


def main() -> "None":
    parser = argparse.ArgumentParser(
        description="Ratchet de cohérence ledger ↔ catalogue.",
    )
    parser.add_argument(
        "--self-test", action="store_true", help="auto-test hors ligne, sans base"
    )
    parser.add_argument(
        "--emit", metavar="PATH", help="écrit les objets déclarés en JSON, sans base"
    )
    parser.add_argument(
        "--verify", action="store_true", help="confronte au catalogue (DATABASE_URL)"
    )
    parser.add_argument(
        "--refresh", action="store_true", help="réécrit le baseline (implique --verify)"
    )
    parser.add_argument("--json", action="store_true", help="sortie machine")
    args = parser.parse_args()

    if args.self_test:
        self_test()
        return
    if args.emit:
        declared = declared_objects()
        pathlib.Path(args.emit).write_text(
            json.dumps(declared, indent=2) + "\n", encoding="utf-8"
        )
        total = sum(len(v) for v in declared.values())
        print(f"[ledger-catalog] {len(declared)} migrations déclarent {total} objets")
        return
    if args.verify or args.refresh:
        run_verify(refresh=args.refresh, as_json=args.json)
        return
    parser.print_help()
    fail(EXIT_USAGE, "choisir --self-test, --emit, --verify ou --refresh.")


if __name__ == "__main__":
    main()
