#!/usr/bin/env bash
# scripts/governance/check-family-pr-scope.sh
# Hard-fails if `git diff` between the base ref and HEAD touches any path
# outside the explicit dependency-family allowlist.
#
# Allowlist (literal regex, anchored on full path from repo root):
#   - package.json (root + workspaces: backend, frontend, packages/*)
#   - package-lock.json
#   - audit/registry/deps.json
#   - audit/registry/canonical.json
#   - audit/dependencies/dependency-modernization-inventory.json
#
# Intentionally excluded:
#   - audit/dependencies/family-overlay.yaml (governance L2 = humans only)
#   - any backend/, frontend/, packages/*/src code path
#
# Usage:
#   check-family-pr-scope.sh                       # diff origin/main...HEAD
#   check-family-pr-scope.sh --base <ref>          # diff <ref>...HEAD
#   check-family-pr-scope.sh --self-test           # synthetic suite (no repo state required)

set -euo pipefail

ALLOWLIST=(
  '^package\.json$'
  '^package-lock\.json$'
  '^backend/package\.json$'
  '^frontend/package\.json$'
  '^packages/[^/]+/package\.json$'
  '^audit/registry/deps\.json$'
  '^audit/registry/canonical\.json$'
  '^audit/dependencies/dependency-modernization-inventory\.json$'
)

is_allowed() {
  local path="$1"
  for pat in "${ALLOWLIST[@]}"; do
    if [[ "$path" =~ $pat ]]; then return 0; fi
  done
  return 1
}

run_check() {
  local base="${1:-origin/main}"
  local changed
  if ! changed=$(git diff --name-only "$base"...HEAD 2>/dev/null); then
    changed=$( { git diff --name-only --cached; git diff --name-only HEAD; } 2>/dev/null | sort -u )
  fi

  local violations=()
  while IFS= read -r path; do
    [[ -z "$path" ]] && continue
    if ! is_allowed "$path"; then
      violations+=("$path")
    fi
  done <<< "$changed"

  if [[ ${#violations[@]} -gt 0 ]]; then
    echo "::error::Scope violation — non-allowlisted paths in this dependency-family PR:"
    for v in "${violations[@]}"; do echo "::error::  - $v"; done
    echo ""
    echo "Allowlist (literal regex):"
    for p in "${ALLOWLIST[@]}"; do echo "  $p"; done
    echo ""
    echo "If you intentionally need to touch one of these paths, open a manual PR — not a family-bump PR."
    return 1
  fi

  local file_count
  file_count=$(printf '%s\n' "$changed" | grep -c . || true)
  echo "✅ Scope clean: ${file_count} file(s) changed vs ${base}, all allowlisted."
}

self_test() {
  local tmp
  tmp=$(mktemp -d)
  local script_path
  script_path=$(realpath "$0")
  cd "$tmp"

  git init -q -b main
  git config user.email selftest@local
  git config user.name selftest
  git commit --allow-empty -q -m initial

  # Case 1: clean — only allowlisted files
  echo '{"name":"x"}' > package.json
  echo '{}' > package-lock.json
  git add . && git commit -q -m bump-clean
  if ! bash "$script_path" --base HEAD~1 >/dev/null; then
    echo "self-test FAILED: clean case rejected" >&2
    rm -rf "$tmp"
    return 1
  fi

  # Case 2: leak — touches backend/src
  mkdir -p backend/src
  echo 'x' > backend/src/main.ts
  git add . && git commit -q -m leak
  if bash "$script_path" --base HEAD~1 >/dev/null 2>&1; then
    echo "self-test FAILED: leak case accepted" >&2
    rm -rf "$tmp"
    return 1
  fi

  # Case 3: governance leak — touches family-overlay.yaml
  git reset --hard HEAD~1 -q
  mkdir -p audit/dependencies
  echo 'families: []' > audit/dependencies/family-overlay.yaml
  git add . && git commit -q -m governance-leak
  if bash "$script_path" --base HEAD~1 >/dev/null 2>&1; then
    echo "self-test FAILED: governance leak accepted (family-overlay.yaml must be rejected)" >&2
    rm -rf "$tmp"
    return 1
  fi

  # Case 4: clean regen — audit artifacts only
  git reset --hard HEAD~1 -q
  mkdir -p audit/registry audit/dependencies
  echo '{}' > audit/registry/deps.json
  echo '{}' > audit/registry/canonical.json
  echo '{}' > audit/dependencies/dependency-modernization-inventory.json
  git add . && git commit -q -m regen-clean
  if ! bash "$script_path" --base HEAD~1 >/dev/null; then
    echo "self-test FAILED: clean regen rejected" >&2
    rm -rf "$tmp"
    return 1
  fi

  rm -rf "$tmp"
  echo "✅ self-test passed (4/4 cases)"
}

case "${1:-}" in
  --self-test) self_test ;;
  --base) run_check "$2" ;;
  '') run_check ;;
  -h|--help)
    grep -E '^# ' "$0" | sed 's/^# \{0,1\}//'
    ;;
  *)
    echo "::error::Unknown argument: $1" >&2
    exit 2
    ;;
esac
