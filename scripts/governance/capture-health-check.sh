#!/usr/bin/env bash
# Retired: this legacy writer targets the deprecated application-local vault.
# Keep old callers visible without probing an implicit production environment.
set -euo pipefail
printf '%s\n' \
  'ERROR: legacy health capture is disabled; no endpoint was queried or evidence written.' \
  'Use the separate governance-vault and its _templates/verification-template.md.' \
  'A health verification requires an explicit target, observed results and a declared scope.' \
  'The CI-only capture_verification.py collector does not attest runtime health.' >&2
exit 2
