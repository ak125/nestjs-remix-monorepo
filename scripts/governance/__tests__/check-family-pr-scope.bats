#!/usr/bin/env bats

# Tests for scripts/governance/check-family-pr-scope.sh.
# Requires bats (preinstalled on ubuntu-latest GitHub runner; on the DEV
# machine install via `npm install -g bats` or `apt install bats`).
# The script also ships a `--self-test` mode that does not require bats.

setup() {
  TMPDIR_BATS=$(mktemp -d)
  cd "$TMPDIR_BATS"
  git init -q -b main
  git config user.email test@test.local
  git config user.name test
  git commit --allow-empty -q -m initial
  cp "$BATS_TEST_DIRNAME/../check-family-pr-scope.sh" ./check.sh
  chmod +x ./check.sh
}

teardown() { rm -rf "$TMPDIR_BATS"; }

@test "exit 0 when only package.json + lockfile change" {
  echo '{"name":"x"}' > package.json
  echo '{}' > package-lock.json
  git add . && git commit -q -m bump
  run ./check.sh --base HEAD~1
  [ "$status" -eq 0 ]
}

@test "exit 0 when only allowlisted audit files change" {
  mkdir -p audit/registry audit/dependencies
  echo '{}' > audit/registry/deps.json
  echo '{}' > audit/registry/canonical.json
  echo '{}' > audit/dependencies/dependency-modernization-inventory.json
  git add . && git commit -q -m regen
  run ./check.sh --base HEAD~1
  [ "$status" -eq 0 ]
}

@test "exit 0 when workspace package.json changes" {
  mkdir -p backend frontend packages/foo
  echo '{}' > backend/package.json
  echo '{}' > frontend/package.json
  echo '{}' > packages/foo/package.json
  git add . && git commit -q -m bump-workspaces
  run ./check.sh --base HEAD~1
  [ "$status" -eq 0 ]
}

@test "exit 1 when backend/src code changes" {
  mkdir -p backend/src
  echo 'x' > backend/src/main.ts
  git add . && git commit -q -m leak
  run ./check.sh --base HEAD~1
  [ "$status" -eq 1 ]
  [[ "$output" =~ "backend/src/main.ts" ]]
}

@test "exit 1 when family-overlay.yaml changes (governance only)" {
  mkdir -p audit/dependencies
  echo 'families: []' > audit/dependencies/family-overlay.yaml
  git add . && git commit -q -m governance-leak
  run ./check.sh --base HEAD~1
  [ "$status" -eq 1 ]
  [[ "$output" =~ "family-overlay.yaml" ]]
}

@test "exit 1 when nested packages workspace src changes" {
  mkdir -p packages/foo/src
  echo 'x' > packages/foo/src/index.ts
  git add . && git commit -q -m nested-leak
  run ./check.sh --base HEAD~1
  [ "$status" -eq 1 ]
  [[ "$output" =~ "packages/foo/src/index.ts" ]]
}

@test "self-test mode runs synthetic suite and passes" {
  run ./check.sh --self-test
  [ "$status" -eq 0 ]
  [[ "$output" =~ "self-test passed" ]]
}

@test "unknown argument exits 2" {
  run ./check.sh --bogus
  [ "$status" -eq 2 ]
}
