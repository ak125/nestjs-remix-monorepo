#!/usr/bin/env bash
# =============================================================================
# check-rpc-allowlist-coverage.sh
# =============================================================================
# Gate CI : empêche un appel `callRpc('foo')` backend qui ne serait pas dans
# `backend/governance/rpc/rpc_allowlist.json`. Déclenche sinon une erreur
# RpcBlockedError au runtime (cause incident 2026-04-21 INC-2026-006, où
# ADR-016 Phase 2 a renommé get_vehicle_page_data_optimized →
# get_vehicle_page_data_cached sans mettre à jour l'allowlist).
#
# Scope : détecte uniquement les littéraux string simples. N'attrape PAS les
# noms RPC calculés dynamiquement (variable, concat, template litéral). Ces
# cas sont rares et généralement repérables en code review.
#
# Usage :
#   bash scripts/ci/check-rpc-allowlist-coverage.sh
#
# Exit codes :
#   0  — tous les callRpc('*') littéraux sont dans l'allowlist
#   1  — au moins un RPC manquant
#   2  — erreur setup (fichier allowlist introuvable, jq manquant, etc.)
# =============================================================================

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ALLOWLIST="$ROOT/backend/governance/rpc/rpc_allowlist.json"
BACKEND_SRC="$ROOT/backend/src"

if [ ! -f "$ALLOWLIST" ]; then
  echo "[FATAL] Allowlist introuvable : $ALLOWLIST" >&2
  exit 2
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "[FATAL] jq est requis (apt install jq)" >&2
  exit 2
fi

# ── Étape 1 : extraire les noms RPC de l'allowlist ──────────────────────────
ALLOWED=$(jq -r '.functions[].name' "$ALLOWLIST" | sort -u)

# ── Étape 2 : extraire les callRpc(...) avec source: 'api' ────────────────
# Seules les RPC appelées avec `source: 'api'` DOIVENT être dans l'allowlist
# (cf. rpc-gate.service.ts : UNKNOWN_SERVICE_ROLE=ALLOW, UNKNOWN_BLOCKED_PROD
# quand source=api). Les autres contextes (service-role, internal) passent
# par défaut et n'ont pas besoin d'allowlist.
#
# Pattern cible :
#   this.callRpc<T>('rpc_name', { params }, { source: 'api' })
# On extrait le nom RPC SI le bloc d'appel contient `source: 'api'`.
CALLED=$(python3 - "$BACKEND_SRC" <<'PYEOF' | sort -u
import os, re, sys
root = sys.argv[1]

# On capture TOUT l'appel callRpc(...) pour inspecter son context.
# Pattern robuste : callRpc, optionnel <Type>, puis ( jusqu'à la ) qui ferme
# au bon niveau de parenthèses.
def extract_calls(src: str):
    """Yield (rpc_name, has_api_source) per callRpc(...) invocation."""
    # Trouver toutes les positions de "callRpc"
    for m in re.finditer(r"callRpc(?:<[^>]*>)?\s*\(", src):
        start = m.end()
        # Parcourir pour trouver la ) qui ferme, en comptant les (
        depth = 1
        i = start
        while i < len(src) and depth > 0:
            c = src[i]
            if c == "(":
                depth += 1
            elif c == ")":
                depth -= 1
            elif c in "'\"`":
                # Skip string literals proprement
                quote = c
                i += 1
                while i < len(src) and src[i] != quote:
                    if src[i] == "\\":
                        i += 2
                        continue
                    i += 1
            i += 1
        call_body = src[start:i]
        # Extraire le nom RPC (1er string literal)
        name_m = re.search(r"^\s*['\"]([a-zA-Z_][a-zA-Z0-9_]*)['\"]", call_body)
        if not name_m:
            continue
        has_api = bool(re.search(r"source\s*:\s*['\"]api['\"]", call_body))
        yield name_m.group(1), has_api

found = set()
for dirpath, dirs, files in os.walk(root):
    if any(skip in dirpath for skip in ("/node_modules", "/dist", "/build", "/.nest")):
        continue
    for f in files:
        if not f.endswith(".ts"):
            continue
        path = os.path.join(dirpath, f)
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as fh:
                src = fh.read()
        except Exception:
            continue
        for name, has_api in extract_calls(src):
            if has_api:  # ← le filtre clé
                found.add(name)

for name in sorted(found):
    print(name)
PYEOF
)

# ── Étape 3 : diff ──────────────────────────────────────────────────────────
MISSING=$(comm -23 <(echo "$CALLED") <(echo "$ALLOWED"))

if [ -z "$MISSING" ]; then
  COUNT=$(echo "$CALLED" | grep -c . || echo 0)
  echo "✅ RPC allowlist coverage OK ($COUNT appels callRpc, tous couverts)"
  exit 0
fi

echo "❌ RPC allowlist coverage FAILED" >&2
echo "" >&2
echo "Les RPC suivantes sont appelées par le backend mais absentes de l'allowlist :" >&2
echo "$MISSING" | sed 's/^/  - /' >&2
echo "" >&2
echo "Fix : ajouter chaque RPC dans $ALLOWLIST" >&2
echo "      (format : {\"name\": \"<rpc>\", \"volatility\": \"STABLE|VOLATILE\", \"reason\": \"...\"})" >&2
echo "" >&2
echo "Pourquoi ce gate existe :" >&2
echo "  Incident 2026-04-21 — ADR-016 Phase 2 a renommé get_vehicle_page_data_optimized" >&2
echo "  en get_vehicle_page_data_cached sans MAJ de l'allowlist → 503 systémique en prod" >&2
echo "  pendant 67 min. Ce gate empêche la classe de bug." >&2
exit 1
