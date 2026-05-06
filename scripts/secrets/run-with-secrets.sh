#!/usr/bin/env bash
# Wrapper: decrypt one or more SOPS-encrypted env files in-memory, then exec
# the given command with those secrets injected as environment variables.
#
# Usage:
#   scripts/secrets/run-with-secrets.sh secrets/sentry.dev.sops.env -- docker compose up -d
#   scripts/secrets/run-with-secrets.sh secrets/a.sops.env secrets/b.sops.env -- node dist/main.js
#
# Secrets only exist in this process's env + the child process's env.
# Never written to disk. Released when the child exits.
set -euo pipefail

if ! command -v sops >/dev/null 2>&1; then
  echo "❌ sops not installed. See docs/runbooks/secrets-sops.md § Install" >&2
  exit 127
fi

files=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --) shift; break ;;
    *)  files+=("$1"); shift ;;
  esac
done

if [[ ${#files[@]} -eq 0 ]] || [[ $# -eq 0 ]]; then
  echo "Usage: $0 <secret-file>... -- <command> [args...]" >&2
  exit 64
fi

# Pre-flight: every file must be decryptable. Fail fast if any age key is missing.
for f in "${files[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "❌ Secret file not found: $f" >&2
    exit 66
  fi
  if ! sops decrypt "$f" >/dev/null 2>&1; then
    echo "❌ Cannot decrypt $f — missing age key on this host?" >&2
    echo "   Expected: \${SOPS_AGE_KEY_FILE:-~/.config/sops/age/keys.txt}" >&2
    exit 65
  fi
done

# Source each decrypted dotenv into the current shell env (auto-export).
# Files are dotenv-format (KEY=VALUE per line) so `source` interprets them
# as shell variable assignments. Auto-export makes them visible to children.
set -a
for f in "${files[@]}"; do
  # Process substitution: decrypt to a transient file descriptor, source it,
  # fd is closed immediately. No plaintext touches the filesystem.
  # shellcheck disable=SC1090
  . <(sops decrypt "$f")
done
set +a

exec "$@"
