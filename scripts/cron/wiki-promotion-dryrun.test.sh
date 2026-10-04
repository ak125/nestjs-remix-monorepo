#!/usr/bin/env bash
# Test de wiki-promotion-dryrun.sh sur des dépôts FIXTURE jetables (jamais les clones réels).
#
# `promote.py` et `quality-gates.py` sont remplacés, dans le WIKI fixture, par des faux qui
# journalisent ce qu'ils reçoivent : on teste le cron, pas le décideur. Chaque cas vise un
# défaut qui ferait passer une décision fausse pour vraie : lire le working tree périmé
# d'un clone au lieu d'origin/main, écrire dans un clone, laisser AUTOMECANIK_RAW_PATH
# l'emporter sur --raw-root, exporter tout le RAW, prendre un pointeur LFS pour une archive,
# confondre un RAW indisponible (cause infra) avec des propositions bloquées, ou se taire
# sur un décideur en échec.
#
# Usage : bash wiki-promotion-dryrun.test.sh
#         DRYRUN_SCRIPT=/chemin/autre-version.sh bash wiki-promotion-dryrun.test.sh
# Dépendances : git, jq, python3.
set -uo pipefail

SCRIPT="${DRYRUN_SCRIPT:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/wiki-promotion-dryrun.sh}"
FIX="$(mktemp -d "${TMPDIR:-/tmp}/wiki-promo-test.XXXXXX")"
FAIL=0
trap 'rm -rf "$FIX"' EXIT

check() { # check <description> <attendu> <obtenu>
  if [[ "$2" == "$3" ]]; then echo "  ok    — $1 ($3)"; else echo "  ÉCHEC — $1 : attendu « $2 », obtenu « $3 »"; FAIL=1; fi
}

# --- Isolation : aucune config globale/système, aucun hook, aucun dépôt réel ---
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR AUTOMECANIK_WIKI_PATH AUTOMECANIK_RAW_PATH
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=fixture GIT_AUTHOR_EMAIL=fixture@example.invalid
export GIT_COMMITTER_NAME=fixture GIT_COMMITTER_EMAIL=fixture@example.invalid
export TMPDIR="$FIX/tmp"; mkdir -p "$TMPDIR"

LFS_HEADER="version https://git-lfs.github.com/spec/v1"

write_stubs() { # write_stubs <dir WIKI>
  mkdir -p "$1/_scripts" "$1/_meta" "$1/proposals"
  cat > "$1/_scripts/quality-gates.py" <<'PY'
# Faux quality-gates : même interface que celle que le cron appelle.
import csv, json
from pathlib import Path
SOURCE_CATALOG = Path("/nonexistent/catalog")
RAW_INVENTORY = Path("/nonexistent/inventory.csv")
def load_source_catalog():
    return json.loads(SOURCE_CATALOG.read_text())
def source_archive_paths(catalog):
    rows = list(csv.DictReader(RAW_INVENTORY.open()))
    root = RAW_INVENTORY.parent.parent.resolve()
    paths = {}
    for slug, entry in catalog.items():
        if entry.get("status") != "active":
            continue
        ref = entry["raw_ref"]
        hit = [r for r in rows if r["manifest_id"] == ref["manifest_id"] and r["sha256"] == ref["expected_sha256"]]
        if len(hit) == 1:
            paths[slug] = (root / hit[0]["path"]).resolve()
    return paths, []
PY
  cat > "$1/_scripts/promote.py" <<'PY'
# Faux décideur : journalise ce qu'il reçoit, rend le scénario STUB_SCENARIO.
import json, os, sys
from pathlib import Path
a = sys.argv[1:]
wiki, raw = Path(a[a.index("--wiki-root") + 1]), Path(a[a.index("--raw-root") + 1])
files = sorted(str(p.relative_to(raw)) for p in raw.rglob("*") if p.is_file())
marker = wiki / "MARKER"
proposals = sorted(p.name for p in (wiki / "proposals").glob("*.md"))
json.dump({"argv": a, "raw_env": os.environ.get("AUTOMECANIK_RAW_PATH"), "raw_files": files,
           "proposals": proposals,
           "marker": marker.read_text().strip() if marker.exists() else None},
          open(os.environ["STUB_LOG"], "w"))
s = os.environ.get("STUB_SCENARIO", "ok")
if s == "crash":
    sys.stderr.write("boom\n"); sys.exit(1)
if s == "garbage":
    print("pas du json"); sys.exit(0)
def e(status, codes):
    return {"file": str(wiki / "proposals" / "x.md"), "promotion_status": status,
            "eligible": status == "ELIGIBLE", "blocking_reasons": [{"code": c} for c in codes]}
table = {
    "ok": ([e("BLOCKED", ["SOURCE_DIVERSITY"])], 0, 1, 0),
    "eligible": ([e("ELIGIBLE", [])], 1, 0, 0),
    "prov_unavailable": ([e("BLOCKED", ["PROVENANCE_GATE_UNAVAILABLE", "SOURCE_DIVERSITY"])], 0, 1, 0),
    "unknown": ([e("UNKNOWN_FAIL_CLOSED", ["STALE_DURING_EVALUATION"])], 0, 0, 1),
    "eval_error": ([e("BLOCKED", ["EVALUATION_ERROR"])], 0, 1, 0),
    "apply_true": ([], 0, 0, 0),
}
report, eligible, blocked, unknown = table[s]
print(json.dumps({"threshold": 0.9, "apply": s == "apply_true", "apply_failures": 0,
                  "tier_A": 0, "tier_B": len(report), "eligible": eligible, "blocked": blocked,
                  "unknown_fail_closed": unknown, "report": report}))
PY
}

# setup <nom> <catalogue JSON> : origin WIKI + RAW, clones « périmés » sur une autre branche
# et sales, puis un commit poussé sur origin/main APRÈS le clonage (MARKER=fresh).
setup() {
  local d="$FIX/$1"; mkdir -p "$d"
  # RAW
  git init -q --bare -b main "$d/raw-origin.git"
  git init -q -b main "$d/raw-seed"
  mkdir -p "$d/raw-seed/manifests" "$d/raw-seed/sources" "$d/raw-seed/recycled"
  {
    echo "path,manifest_id,layer,unstable_id,sha256,size_bytes,added_at"
    echo "sources/a.md,src-a,sources,false,sha256:aaa,1,2026-01-01T00:00:00Z"
    echo "sources/lfs.html.gz,src-lfs,sources,false,sha256:lll,1,2026-01-01T00:00:00Z"
    echo "sources/missing.md,src-missing,sources,false,sha256:mmm,1,2026-01-01T00:00:00Z"
  } > "$d/raw-seed/manifests/source-inventory.csv"
  echo '{}' > "$d/raw-seed/manifests/checksums.json"
  echo "archive a" > "$d/raw-seed/sources/a.md"
  echo "non référencée" > "$d/raw-seed/sources/unrelated.md"
  echo "couche recyclée" > "$d/raw-seed/recycled/big.md"
  printf '%s\noid sha256:0000\nsize 1\n' "$LFS_HEADER" > "$d/raw-seed/sources/lfs.html.gz"
  git -C "$d/raw-seed" add -A && git -C "$d/raw-seed" commit -qm raw
  git -C "$d/raw-seed" push -q "$d/raw-origin.git" main
  git clone -q "$d/raw-origin.git" "$d/raw"
  git -C "$d/raw" checkout -q -b autre-branche
  echo "sale" > "$d/raw/sources/a.md"   # working tree modifié : ne doit JAMAIS être lu
  # WIKI
  git init -q --bare -b main "$d/wiki-origin.git"
  git init -q -b main "$d/wiki-seed"
  write_stubs "$d/wiki-seed"
  printf '%s\n' "$2" > "$d/wiki-seed/_meta/source-catalog.yaml"
  echo "# x" > "$d/wiki-seed/proposals/x.md"
  git -C "$d/wiki-seed" add -A && git -C "$d/wiki-seed" commit -qm wiki
  git -C "$d/wiki-seed" push -q "$d/wiki-origin.git" main
  git clone -q "$d/wiki-origin.git" "$d/wiki"
  git -C "$d/wiki" checkout -q -b autre-branche
  echo "brouillon" > "$d/wiki/proposals/brouillon.md"   # non suivi : ne doit jamais être lu
  echo "fresh" > "$d/wiki-seed/MARKER"
  git -C "$d/wiki-seed" add MARKER && git -C "$d/wiki-seed" commit -qm fresh
  git -C "$d/wiki-seed" push -q "$d/wiki-origin.git" main
}

run() { # run <nom> <scénario> [env supplémentaires...] -> code de sortie dans $RC
  local d="$FIX/$1" scenario="$2"; shift 2
  rm -f "$d/stub.json"
  env AUTOMECANIK_WIKI_PATH="$d/wiki" AUTOMECANIK_RAW_PATH="$d/raw" \
      CRON_STATE_DIR="$d/state" WIKI_PROMOTION_REPORT_DIR="$d/reports" \
      STUB_LOG="$d/stub.json" STUB_SCENARIO="$scenario" "$@" \
      bash "$SCRIPT" > "$d/out.txt" 2>&1
  RC=$?
}
state() { jq -r "$2" "$FIX/$1/state/wiki-promotion-dryrun.json" 2>/dev/null || echo "<absent>"; }
stub() { jq -r "$2" "$FIX/$1/stub.json" 2>/dev/null || echo "<non appelé>"; }
snap() { # état d'un clone : branche, tête, statut porcelain
  local r="$FIX/$1/$2"
  printf '%s|%s|%s' "$(git -C "$r" rev-parse --abbrev-ref HEAD)" "$(git -C "$r" rev-parse HEAD)" \
    "$(git -C "$r" status --porcelain | tr '\n' ';')"
}

CAT_A='{"a": {"status": "active", "raw_ref": {"manifest_id": "src-a", "expected_sha256": "sha256:aaa"}},
 "todo": {"status": "to_capture", "raw_ref": {"manifest_id": "src-x", "expected_sha256": "sha256:xxx"}}}'

echo "1. cas nominal : origin/main frais, clones intacts, export borné"
setup nominal "$CAT_A"
WIKI_BEFORE=$(snap nominal wiki); RAW_BEFORE=$(snap nominal raw)
run nominal ok
check "code de sortie" "0" "$RC"
check "statut" "ok" "$(state nominal .status)"
check "lit origin/main fraîchement récupéré, pas le clone périmé" "fresh" "$(stub nominal .marker)"
check "WIKI exporté : brouillon non suivi du clone absent" '["x.md"]' "$(stub nominal '.proposals | tojson')"
check "archives RAW = manifests + archive résolue seulement" \
  '["manifests/checksums.json","manifests/source-inventory.csv","sources/a.md"]' "$(stub nominal '.raw_files | tojson')"
check "archive lue depuis origin/main, pas le working tree sale" "archive a" \
  "$(git -C "$FIX/nominal/raw" show origin/main:sources/a.md)"
check "--dry-run transmis, jamais --apply" "true|false" \
  "$(stub nominal '(.argv | index("--dry-run") != null | tostring) + "|" + (.argv | index("--apply") != null | tostring)')"
check "AUTOMECANIK_RAW_PATH retiré de l'environnement du décideur" "null" "$(stub nominal .raw_env)"
check "clone WIKI intact (branche, tête, statut)" "$WIKI_BEFORE" "$(snap nominal wiki)"
check "clone RAW intact (branche, tête, statut)" "$RAW_BEFORE" "$(snap nominal raw)"
check "rapport : chemins relatifs au WIKI" "proposals/x.md" \
  "$(jq -r '.promote.report[0].file' "$FIX/nominal/reports/latest.json")"
check "rapport : SHA WIKI = origin/main" "$(git -C "$FIX/nominal/wiki-origin.git" rev-parse main)" \
  "$(jq -r '.wiki_sha' "$FIX/nominal/reports/latest.json")"
check "rapport daté écrit à côté de latest.json" "1" \
  "$(find "$FIX/nominal/reports" -name '*Z-*-*.json' | wc -l | tr -d ' ')"
check "état : cadence maximale déclarée" "180000" "$(state nominal .max_age_s)"
check "état : métriques agrégées" "1|0|1" "$(state nominal '"\(.metrics.proposals)|\(.metrics.eligible)|\(.metrics.blocked)"')"
check "répertoire de travail retiré" "0" "$(find "$TMPDIR" -maxdepth 1 -type d -name 'wiki-promotion-dryrun.*' | wc -l | tr -d ' ')"

echo "2. proposition éligible : avertissement (acte owner), jamais une promotion"
run nominal eligible
check "code de sortie" "0" "$RC"
check "statut" "warn" "$(state nominal .status)"

echo "3. causes INFRA du décideur : erreur, jamais « propositions bloquées »"
for scenario in prov_unavailable unknown eval_error; do
  run nominal "$scenario"
  check "$scenario — code de sortie" "1" "$RC"
  check "$scenario — statut" "error" "$(state nominal .status)"
done
check "rapport conservé pour diagnostic d'un run en erreur" "1" \
  "$(jq -r '.metrics.evaluation_errors' "$FIX/nominal/reports/latest.json")"

echo "4. décideur en échec ou sortie invalide"
for scenario in crash garbage apply_true; do
  run nominal "$scenario"
  check "$scenario — code de sortie" "1" "$RC"
  check "$scenario — étape" "promote" "$(state nominal .metrics.stage)"
done

echo "5. pointeur LFS parmi les archives à vérifier : arrêt avant le décideur"
setup lfs '{"lfs": {"status": "active", "raw_ref": {"manifest_id": "src-lfs", "expected_sha256": "sha256:lll"}}}'
run lfs ok
check "code de sortie" "1" "$RC"
check "étape" "lfs" "$(state lfs .metrics.stage)"
check "décideur non appelé" "<non appelé>" "$(stub lfs .marker)"

echo "6. archive inventoriée mais absente de l'arbre : laissée au gate (verdict contenu)"
setup missing '{"m": {"status": "active", "raw_ref": {"manifest_id": "src-missing", "expected_sha256": "sha256:mmm"}}}'
run missing ok
check "code de sortie" "0" "$RC"
check "décideur appelé, archive absente de l'export" '["manifests/checksums.json","manifests/source-inventory.csv"]' \
  "$(stub missing '.raw_files | tojson')"
check "métriques : 1 résolue, 0 présente" "1|0" \
  "$(state missing '"\(.metrics.raw_archives_resolved)|\(.metrics.raw_archives_present)"')"

echo "7. clone introuvable : erreur avant tout réseau"
run nominal ok AUTOMECANIK_WIKI_PATH="$FIX/absent"
check "code de sortie" "1" "$RC"
check "étape" "preflight" "$(state nominal .metrics.stage)"
check "décideur non appelé" "<non appelé>" "$(stub nominal .marker)"

if [[ "$FAIL" -eq 0 ]]; then echo "TOUS LES CAS PASSENT"; else echo "ÉCHECS — voir ci-dessus"; fi
exit "$FAIL"
