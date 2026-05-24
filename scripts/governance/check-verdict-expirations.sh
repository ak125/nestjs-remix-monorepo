#!/usr/bin/env bash
# Vérifie l'expiration des verdicts empiriques canon (ADR-081 G9).
#
# Lit tous les fichiers `ledger/verdicts/*.md` dans le vault (path configurable
# via VAULT_PATH env var, défaut /opt/automecanik/governance-vault), parse le
# frontmatter YAML, compare `expires_at` à aujourd'hui.
#
# Output (V1 MVP) :
#   - report-only stdout (1 ligne par verdict, statut OK / EXPIRED / SOON)
#   - exit 0 toujours (informational)
#
# Production target (follow-up cron + intégration __seo_event_log) :
#   - wire ce script dans .github/workflows/check-verdict-expirations-cron.yml
#     (weekly schedule)
#   - poster event_type='verdict_expired' dans __seo_event_log (réutilise
#     observabilité existante, cf. feedback_no_external_canary_when_internal_observability_exists)
#   - escalation auto : DO_NOT_START qu'un verdict expire bloque deviennent
#     OPEN_FOR_REVIEW (mécanisme à spec dans PR follow-up cron)
#
# Usage : scripts/governance/check-verdict-expirations.sh
# Exit 0 toujours en V1 MVP (report-only).

set -euo pipefail

VAULT_PATH="${VAULT_PATH:-/opt/automecanik/governance-vault}"
VERDICTS_DIR="${VAULT_PATH}/ledger/verdicts"

if [ ! -d "$VERDICTS_DIR" ]; then
  echo "INFO: $VERDICTS_DIR n'existe pas — aucun verdict canon, exit 0"
  echo "(Quand un verdict sera créé via _templates/empirical-verdict-header.md, ce script le détectera automatiquement)"
  exit 0
fi

TODAY=$(date +%Y-%m-%d)
TOTAL=0
EXPIRED=0
SOON=0
OK=0

echo "=== Verdict expiration report ($TODAY) ==="
echo ""

# Loop tous les *.md sous verdicts/
shopt -s nullglob
for verdict in "$VERDICTS_DIR"/*.md; do
  TOTAL=$((TOTAL+1))
  basename=$(basename "$verdict")

  # Extract YAML frontmatter id + expires_at + blocks_until_expiry
  id=$(awk '/^---$/{c++; next} c==1 && /^id:/{print $2; exit}' "$verdict" || true)
  expires=$(awk '/^---$/{c++; next} c==1 && /^expires_at:/{print $2; exit}' "$verdict" || true)
  blocks=$(awk '/^---$/{c++; next} c==1 && /^blocks_until_expiry:/{
    sub(/^blocks_until_expiry: */, "");
    print;
    exit
  }' "$verdict" || true)

  if [ -z "$id" ] || [ -z "$expires" ]; then
    echo "  WARN $basename — frontmatter malformé (id ou expires_at manquant)"
    continue
  fi

  # Date comparison (POSIX-compatible via date -d)
  expires_epoch=$(date -d "$expires" +%s 2>/dev/null || echo "0")
  today_epoch=$(date -d "$TODAY" +%s)

  if [ "$expires_epoch" -eq 0 ]; then
    echo "  WARN $id ($basename) — expires_at invalide : '$expires'"
    continue
  fi

  diff_days=$(( (expires_epoch - today_epoch) / 86400 ))

  if [ "$diff_days" -lt 0 ]; then
    EXPIRED=$((EXPIRED+1))
    echo "  ❌ EXPIRED $id — expires_at=$expires (J$diff_days) — blocks: $blocks"
    echo "       → cf. ADR-081 G9 : DO_NOT_START qu'il bloque deviennent OPEN_FOR_REVIEW"
  elif [ "$diff_days" -lt 14 ]; then
    SOON=$((SOON+1))
    echo "  ⚠️  SOON    $id — expires_at=$expires (J+$diff_days) — blocks: $blocks"
  else
    OK=$((OK+1))
    echo "  ✓  OK      $id — expires_at=$expires (J+$diff_days)"
  fi
done

echo ""
echo "=== Summary : $TOTAL verdicts total | $EXPIRED expired | $SOON soon (<14j) | $OK ok ==="
exit 0
