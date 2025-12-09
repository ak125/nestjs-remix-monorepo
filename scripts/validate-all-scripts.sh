#!/bin/bash
# validate-all-scripts.sh - Valider tous les scripts du projet

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—"
echo "â•‘                                                                  â•‘"
echo "â•‘       ðŸ§ª VALIDATION DE TOUS LES SCRIPTS DU PROJET ðŸ§ª            â•‘"
echo "â•‘                                                                  â•‘"
echo "â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
echo ""

# Compteurs
TOTAL_SHELL=0
OK_SHELL=0
FAIL_SHELL=0

TOTAL_PYTHON=0
OK_PYTHON=0
FAIL_PYTHON=0

echo "ðŸ“‹ Phase 1 - Validation des scripts Shell (.sh)"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""

# Valider les scripts shell
while IFS= read -r script; do
    TOTAL_SHELL=$((TOTAL_SHELL + 1))
    if bash -n "$script" 2>/dev/null; then
        echo "âœ… $script"
        OK_SHELL=$((OK_SHELL + 1))
    else
        echo "âŒ $script - ERREUR DE SYNTAXE"
        FAIL_SHELL=$((FAIL_SHELL + 1))
        bash -n "$script" 2>&1 | head -3
    fi
done < <(find . -name "*.sh" -type f)

echo ""
echo "ðŸ“‹ Phase 2 - Validation des scripts Python (.py)"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""

# Valider les scripts Python
while IFS= read -r script; do
    TOTAL_PYTHON=$((TOTAL_PYTHON + 1))
    if python3 -m py_compile "$script" 2>/dev/null; then
        echo "âœ… $script"
        OK_PYTHON=$((OK_PYTHON + 1))
        # Nettoyer les fichiers .pyc
        rm -f "${script}c" 2>/dev/null
    else
        echo "âŒ $script - ERREUR DE SYNTAXE"
        FAIL_PYTHON=$((FAIL_PYTHON + 1))
        python3 -m py_compile "$script" 2>&1 | head -3
    fi
done < <(find . -name "*.py" -type f)

# Nettoyer __pycache__
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

echo ""
echo "ðŸ“‹ Phase 3 - VÃ©rification des permissions"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""

NON_EXEC=$(find . -name "*.sh" -type f ! -perm -111 2>/dev/null | wc -l)
if [ "$NON_EXEC" -eq 0 ]; then
    echo "âœ… Tous les scripts .sh sont exÃ©cutables"
else
    echo "âš ï¸  $NON_EXEC scripts .sh ne sont PAS exÃ©cutables:"
    find . -name "*.sh" -type f ! -perm -111 2>/dev/null | head -10
fi

echo ""
echo "â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—"
echo "â•‘                                                                  â•‘"
echo "â•‘                    ðŸ“Š RÃ‰SULTATS FINAUX ðŸ“Š                        â•‘"
echo "â•‘                                                                  â•‘"
echo "â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•"
echo ""
echo "Scripts Shell (.sh):"
echo "  Total    : $TOTAL_SHELL"
echo "  Valides  : $OK_SHELL âœ…"
echo "  Erreurs  : $FAIL_SHELL âŒ"
echo ""
echo "Scripts Python (.py):"
echo "  Total    : $TOTAL_PYTHON"
echo "  Valides  : $OK_PYTHON âœ…"
echo "  Erreurs  : $FAIL_PYTHON âŒ"
echo ""

TOTAL_SCRIPTS=$((TOTAL_SHELL + TOTAL_PYTHON))
TOTAL_OK=$((OK_SHELL + OK_PYTHON))
TOTAL_FAIL=$((FAIL_SHELL + FAIL_PYTHON))

echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo "TOTAL: $TOTAL_OK/$TOTAL_SCRIPTS scripts valides"
echo "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
echo ""

if [ "$TOTAL_FAIL" -eq 0 ]; then
    echo "âœ… SUCCÃˆS - Tous les scripts sont valides !"
    exit 0
else
    echo "âŒ Ã‰CHEC - $TOTAL_FAIL scripts avec des erreurs"
    exit 1
fi
