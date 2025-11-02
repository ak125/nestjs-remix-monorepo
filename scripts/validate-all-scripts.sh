#!/bin/bash
# validate-all-scripts.sh - Valider tous les scripts du projet

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                                                                  ║"
echo "║       🧪 VALIDATION DE TOUS LES SCRIPTS DU PROJET 🧪            ║"
echo "║                                                                  ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# Compteurs
TOTAL_SHELL=0
OK_SHELL=0
FAIL_SHELL=0

TOTAL_PYTHON=0
OK_PYTHON=0
FAIL_PYTHON=0

echo "📋 Phase 1 - Validation des scripts Shell (.sh)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Valider les scripts shell
while IFS= read -r script; do
    TOTAL_SHELL=$((TOTAL_SHELL + 1))
    if bash -n "$script" 2>/dev/null; then
        echo "✅ $script"
        OK_SHELL=$((OK_SHELL + 1))
    else
        echo "❌ $script - ERREUR DE SYNTAXE"
        FAIL_SHELL=$((FAIL_SHELL + 1))
        bash -n "$script" 2>&1 | head -3
    fi
done < <(find . -name "*.sh" -type f)

echo ""
echo "📋 Phase 2 - Validation des scripts Python (.py)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Valider les scripts Python
while IFS= read -r script; do
    TOTAL_PYTHON=$((TOTAL_PYTHON + 1))
    if python3 -m py_compile "$script" 2>/dev/null; then
        echo "✅ $script"
        OK_PYTHON=$((OK_PYTHON + 1))
        # Nettoyer les fichiers .pyc
        rm -f "${script}c" 2>/dev/null
    else
        echo "❌ $script - ERREUR DE SYNTAXE"
        FAIL_PYTHON=$((FAIL_PYTHON + 1))
        python3 -m py_compile "$script" 2>&1 | head -3
    fi
done < <(find . -name "*.py" -type f)

# Nettoyer __pycache__
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

echo ""
echo "📋 Phase 3 - Vérification des permissions"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

NON_EXEC=$(find . -name "*.sh" -type f ! -perm -111 2>/dev/null | wc -l)
if [ "$NON_EXEC" -eq 0 ]; then
    echo "✅ Tous les scripts .sh sont exécutables"
else
    echo "⚠️  $NON_EXEC scripts .sh ne sont PAS exécutables:"
    find . -name "*.sh" -type f ! -perm -111 2>/dev/null | head -10
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                                                                  ║"
echo "║                    📊 RÉSULTATS FINAUX 📊                        ║"
echo "║                                                                  ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo "Scripts Shell (.sh):"
echo "  Total    : $TOTAL_SHELL"
echo "  Valides  : $OK_SHELL ✅"
echo "  Erreurs  : $FAIL_SHELL ❌"
echo ""
echo "Scripts Python (.py):"
echo "  Total    : $TOTAL_PYTHON"
echo "  Valides  : $OK_PYTHON ✅"
echo "  Erreurs  : $FAIL_PYTHON ❌"
echo ""

TOTAL_SCRIPTS=$((TOTAL_SHELL + TOTAL_PYTHON))
TOTAL_OK=$((OK_SHELL + OK_PYTHON))
TOTAL_FAIL=$((FAIL_SHELL + FAIL_PYTHON))

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TOTAL: $TOTAL_OK/$TOTAL_SCRIPTS scripts valides"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$TOTAL_FAIL" -eq 0 ]; then
    echo "✅ SUCCÈS - Tous les scripts sont valides !"
    exit 0
else
    echo "❌ ÉCHEC - $TOTAL_FAIL scripts avec des erreurs"
    exit 1
fi
