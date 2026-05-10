#!/usr/bin/env bash
# Fail if any `secrets/*.env` (without `.sops.` infix) is committed in cleartext.
# Run by pre-commit hook + CI to make accidental leaks impossible.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# All tracked files under secrets/ that look like .env but lack `.sops.` infix
plaintext=$(git ls-files 'secrets/*.env' | grep -v '\.sops\.' || true)

if [[ -n "$plaintext" ]]; then
  echo "❌ Plaintext .env file(s) committed under secrets/:" >&2
  echo "$plaintext" >&2
  echo >&2
  echo "Encrypt with: sops encrypt --in-place <file> && git mv <file> <file:.env=.sops.env>" >&2
  exit 1
fi

# Sanity-check that all *.sops.env files are actually SOPS-encrypted (not raw .env
# accidentally renamed). SOPS files have `sops:` mapping at the top.
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  # Skip placeholder / readme
  case "$f" in
    *.PLACEHOLDER|*/README.md) continue ;;
  esac
  if ! grep -q '^sops:' "$f" 2>/dev/null && ! head -c 200 "$f" | grep -q 'ENC\[AES'; then
    echo "❌ $f has .sops. infix but is NOT SOPS-encrypted (no 'sops:' marker)." >&2
    echo "   Run: sops encrypt --in-place $f" >&2
    exit 1
  fi
done < <(git ls-files 'secrets/*.sops.env')

echo "✅ secrets/ encryption guard OK"
