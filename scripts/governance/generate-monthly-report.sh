#!/usr/bin/env bash
# Retired: unverified legacy status counts must not generate compliance evidence.
# Existing reports are left untouched; no implicit migration or overwrite.
set -euo pipefail
printf '%s\n' \
  'ERROR: legacy monthly report generation is disabled; no report was written or overwritten.' \
  'Use the separate governance-vault and its existing review/archival process (ADR-015).' \
  'A monthly summary requires identified source evidence and explicit coverage of the period.' \
  'Neither legacy status fields nor the CI-only collector establish monthly compliance.' >&2
exit 2
