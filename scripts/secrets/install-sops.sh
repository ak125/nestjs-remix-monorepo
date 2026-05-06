#!/usr/bin/env bash
# Install sops + age binaries. Idempotent. Run once per machine.
set -euo pipefail

SOPS_VERSION="${SOPS_VERSION:-v3.9.1}"
AGE_VERSION="${AGE_VERSION:-v1.2.0}"

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64)  ARCH=amd64 ;;
  aarch64) ARCH=arm64 ;;
  arm64)   ARCH=arm64 ;;
esac

INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"

install_sops() {
  if command -v sops >/dev/null 2>&1; then
    echo "✓ sops already installed: $(sops --version 2>&1 | head -1)"
    return 0
  fi
  echo "→ Installing sops ${SOPS_VERSION} for ${OS}/${ARCH}"
  local url="https://github.com/getsops/sops/releases/download/${SOPS_VERSION}/sops-${SOPS_VERSION}.${OS}.${ARCH}"
  sudo curl -fsSL "$url" -o "$INSTALL_DIR/sops"
  sudo chmod +x "$INSTALL_DIR/sops"
  sops --version
}

install_age() {
  if command -v age >/dev/null 2>&1 && command -v age-keygen >/dev/null 2>&1; then
    echo "✓ age already installed: $(age --version 2>&1 | head -1)"
    return 0
  fi
  echo "→ Installing age ${AGE_VERSION} for ${OS}/${ARCH}"
  local tmpdir
  tmpdir=$(mktemp -d)
  trap 'rm -rf "$tmpdir"' EXIT
  local url="https://github.com/FiloSottile/age/releases/download/${AGE_VERSION}/age-${AGE_VERSION}-${OS}-${ARCH}.tar.gz"
  curl -fsSL "$url" | tar -xz -C "$tmpdir"
  sudo install -m 755 "$tmpdir/age/age" "$INSTALL_DIR/age"
  sudo install -m 755 "$tmpdir/age/age-keygen" "$INSTALL_DIR/age-keygen"
  age --version
}

main() {
  install_sops
  install_age
  echo
  echo "Next steps:"
  echo "  1. Generate a key:    age-keygen -o ~/.config/sops/age/keys.txt"
  echo "  2. Note the public key (printed by age-keygen as 'Public key: age1...')"
  echo "  3. Add it to .sops.yaml under the relevant alias"
  echo "  4. See docs/runbooks/secrets-sops.md § Bootstrap"
}

main "$@"
