#!/usr/bin/env bash
# Retired: caller-supplied statuses are not verification evidence (ADR-015).
# Kept as an explicit migration error for old callers; no network or file writes.
set -euo pipefail
printf '%s\n' \
  'ERROR: legacy verification capture is disabled; no evidence was collected or written.' \
  'Use the separate governance-vault repository: python3 _scripts/capture_verification.py --help' \
  'The vault collector binds a GitHub run, attempt, workflow and full commit SHA.' \
  'Health, RPC and deployment attestations are not supported by this CI-only collector.' >&2
exit 2
