#!/usr/bin/env bash
# Quality Metrics Baseline Script
# Usage: bash scripts/quality-metrics.sh
# Tracks key code quality indicators across the codebase.

set -euo pipefail

BACKEND="backend/src"
FRONTEND="frontend/app"

echo "========================================="
echo "  CODE QUALITY METRICS"
echo "  $(date '+%Y-%m-%d %H:%M')"
echo "========================================="
echo ""

# --- TYPAGE ---
echo "--- TYPAGE ---"
ANY_BACKEND=$(grep -rn '\bany\b' "$BACKEND" --include='*.ts' | grep -v 'node_modules' | grep -v '.d.ts' | wc -l)
ANY_FRONTEND=$(grep -rn '\bany\b' "$FRONTEND" --include='*.ts' --include='*.tsx' | grep -v 'node_modules' | wc -l)
echo "  any (backend):   $ANY_BACKEND"
echo "  any (frontend):  $ANY_FRONTEND"
echo "  any (total):     $((ANY_BACKEND + ANY_FRONTEND))"
echo ""

# --- ERREURS ---
echo "--- ERREURS ---"
HTTP_EXC=$(grep -rn 'throw new HttpException' "$BACKEND" --include='*.ts' | wc -l)
DOMAIN_EXC=$(grep -rn 'throw new \(Domain\|Database\|ExternalService\|Configuration\|OperationFailed\|DomainConflict\|BusinessRule\|Authentication\|DomainValidation\|DomainNotFound\)' "$BACKEND" --include='*.ts' | wc -l)
GENERIC_ERR=$(grep -rn 'throw new Error(' "$BACKEND" --include='*.ts' | wc -l)
echo "  throw HttpException:    $HTTP_EXC"
echo "  throw DomainException*: $DOMAIN_EXC"
echo "  throw Error (generic):  $GENERIC_ERR"
echo ""

# --- LOGGING ---
echo "--- LOGGING ---"
CONSOLE_LOG=$(grep -rn 'console\.log' "$BACKEND" --include='*.ts' | wc -l)
CONSOLE_ERROR=$(grep -rn 'console\.error' "$BACKEND" --include='*.ts' | wc -l)
echo "  console.log:   $CONSOLE_LOG"
echo "  console.error: $CONSOLE_ERROR"
echo "  total:         $((CONSOLE_LOG + CONSOLE_ERROR))"
echo ""

# --- MODULARITE ---
echo "--- MODULARITE ---"
echo "  Services >800 lines:"
find "$BACKEND" -name '*.service.ts' -exec wc -l {} + 2>/dev/null | sort -rn | head -20 | while read -r lines file; do
  if [ "$lines" -gt 800 ] && [ "$file" != "total" ]; then
    echo "    $lines  $(basename "$file")"
  fi
done
echo ""

FORWARD_REF=$(grep -rn 'forwardRef' "$BACKEND" --include='*.ts' | wc -l)
echo "  forwardRef usages: $FORWARD_REF"
echo ""

# --- DRY ---
echo "--- DRY ---"
ZOD_EMAIL=$(grep -rn 'z\.string()\.email()' "$BACKEND" --include='*.ts' | wc -l)
echo "  z.string().email() duplicates: $ZOD_EMAIL"
echo ""

# --- ASYNC ---
echo "--- ASYNC ---"
THEN_CHAINS=$(grep -rn '\.then(' "$BACKEND" --include='*.ts' | grep -v 'node_modules' | grep -v '.d.ts' | wc -l)
echo "  .then() chains: $THEN_CHAINS"
echo ""

# --- DOCUMENTATION ---
echo "--- DOCUMENTATION ---"
TOTAL_TS=$(find "$BACKEND" -name '*.ts' ! -name '*.d.ts' | wc -l)
WITH_JSDOC=$(grep -rl '/\*\*' "$BACKEND" --include='*.ts' | grep -v '.d.ts' | wc -l)
WITHOUT_JSDOC=$((TOTAL_TS - WITH_JSDOC))
COVERAGE=$((WITH_JSDOC * 100 / TOTAL_TS))
echo "  Total TS files:    $TOTAL_TS"
echo "  With JSDoc:        $WITH_JSDOC ($COVERAGE%)"
echo "  Without JSDoc:     $WITHOUT_JSDOC"
DEPRECATED=$(grep -rn '@deprecated' "$BACKEND" --include='*.ts' | wc -l)
TODO_FIXME=$(grep -rn 'TODO\|FIXME' "$BACKEND" --include='*.ts' | wc -l)
echo "  @deprecated tags:  $DEPRECATED"
echo "  TODO/FIXME:        $TODO_FIXME"
echo ""

echo "========================================="
echo "  DONE"
echo "========================================="
