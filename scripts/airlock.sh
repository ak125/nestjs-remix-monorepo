#!/usr/bin/env bash
set -euo pipefail

# ====== CONFIG ======
REPO_DIR="${AIRLOCK_REPO_DIR:-/opt/automecanik/app}"
BUNDLES_DIR="${AIRLOCK_BUNDLES_DIR:-/opt/automecanik/airlock/inbox}"
BASE_BRANCH="${AIRLOCK_BASE_BRANCH:-main}"
SUBMISSIONS_DIR="${AIRLOCK_SUBMISSIONS_DIR:-/opt/automecanik/app/agent-submissions/bundles}"

MAX_FILES="${AIRLOCK_MAX_FILES:-10}"
MAX_LINES="${AIRLOCK_MAX_LINES:-500}"

NO_PR=0
NO_PUSH=0
NO_TAIL=0
NO_MOVE=0
REASON=""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

need(){ command -v "$1" >/dev/null 2>&1 || { echo "❌ Missing: $1" >&2; exit 1; }; }
need git; need find; need sort; need head; need awk; need wc; need sha256sum

# ====== DEC-011: OBSERVABILITY LOGGING ======
AUDIT_LOG="${AIRLOCK_AUDIT_LOG:-/opt/automecanik/airlock/audit.log}"
log_event() {
  local action="$1" bundle="${2:-}" outcome="${3:-}" detail="${4:-}"
  local ts user_name
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  user_name="${USER:-unknown}"
  mkdir -p "$(dirname "$AUDIT_LOG")"
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$ts" "${ENV:-DEV}" "$user_name" "$action" "$bundle" "$outcome" "$detail" \
    >> "$AUDIT_LOG" 2>/dev/null || true
}

# ====== DEC-008: PROD READ-ONLY ENFORCEMENT ======
check_prod_readonly() {
  if [[ "${ENV:-}" == "PROD" ]]; then
    log_event "BLOCKED" "${bundle_id:-}" "PROD_READONLY" "DEC-008 violation attempt"
    echo "🛑 PROD is READ-ONLY — no Airlock operations allowed (DEC-008)"
    echo "   This environment can only execute, never modify."
    exit 1
  fi
}

# ====== DEC-004: KILL-SWITCH GLOBAL ======
KILL_SWITCH_FILE="/opt/automecanik/airlock/AIRLOCK_DISABLED"
check_kill_switch() {
  check_prod_readonly
  if [[ -f "$KILL_SWITCH_FILE" ]]; then
    local reason=""
    [[ -s "$KILL_SWITCH_FILE" ]] && reason="$(cat "$KILL_SWITCH_FILE")"
    log_event "BLOCKED" "${bundle_id:-}" "KILL_SWITCH" "$reason"
    echo "🛑 AIRLOCK DISABLED — operations halted by governance"
    [[ -n "$reason" ]] && echo "   Reason: $reason"
    echo "   Remove $KILL_SWITCH_FILE to re-enable (requires governance approval)"
    exit 1
  fi
}

usage(){
  cat <<'USAGE'
Usage:
  airlock.sh status <bundle-id|latest>
  airlock.sh validate <bundle-id|latest>
  airlock.sh accept <bundle-id|latest> [--no-pr] [--no-push] [--no-tail]
  airlock.sh reject <bundle-id|latest> --reason "text"
  airlock.sh validate-all             # Validate all bundles, show report
  airlock.sh approve-all [--yes] [--auto-reject]  # Approve valid, auto-reject invalid
  airlock.sh ingest [--yes] [--auto-reject]      # Ingest from submissions + approve

Commands:
  status        Show bundle info (files, lines, risk)
  validate      Check BUNDLE-SPEC constraints (forbidden paths/patterns, budget)
  accept        Apply patch, run checks, create PR
  reject        Record rejection in vault with reason
  validate-all  Validate ALL bundles in inbox, show summary report
  approve-all   Approve ALL valid bundles in one command

Notes:
- Recommended: accept ... --no-tail then tail after manual merge.
- approve-all merges all bundles to main and pushes once.
USAGE
}

list_all_bundles() {
  find "$BUNDLES_DIR" -maxdepth 2 -type f -name "changes.patch" 2>/dev/null \
    | while read -r p; do basename "$(dirname "$p")"; done \
    | sort -u
}

resolve_latest_bundle() {
  local latest_patch
  latest_patch="$(find "$BUNDLES_DIR" -maxdepth 2 -type f -name "changes.patch" -printf '%T@ %p\n' 2>/dev/null \
    | sort -nr | head -n 1 | awk '{print $2}')"
  [[ -n "${latest_patch:-}" ]] || return 1
  basename "$(dirname "$latest_patch")"
}

print_recovery_instructions() {
  echo ""
  echo "┌─────────────────────────────────────────────────────────┐"
  echo "│  RECOVERY INSTRUCTIONS                                  │"
  echo "├─────────────────────────────────────────────────────────┤"
  echo "│  cd $REPO_DIR"
  echo "│  git fetch origin $BASE_BRANCH"
  echo "│  git reset --hard origin/$BASE_BRANCH"
  echo "│                                                         │"
  echo "│  Bundles non-merged restent en inbox.                   │"
  echo "│  Bundles déjà merged sont en processed/.                │"
  echo "└─────────────────────────────────────────────────────────┘"
}

move_to_processed() {
  local bid="$1"
  local bdir="$BUNDLES_DIR/$bid"
  local bpatch="$bdir/changes.patch"
  local bhash pdate shash pname

  bhash="$(sha256sum "$bpatch" 2>/dev/null | awk '{print $1}')"
  pdate="$(date +%Y%m%d)"
  shash="${bhash:0:12}"
  pname="${pdate}__${bid}__${shash}"
  mkdir -p /opt/automecanik/airlock/processed
  mv "$bdir" "/opt/automecanik/airlock/processed/$pname"
  echo "$pname"
}

cmd="${1:-}"; shift || true

# Handle commands that don't need bundle_id
case "$cmd" in
  validate-all)
    check_kill_switch
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  AIRLOCK VALIDATE-ALL"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    all_bundles=($(list_all_bundles))
    if [[ ${#all_bundles[@]} -eq 0 ]]; then
      echo "ℹ️  No bundles in inbox: $BUNDLES_DIR"
      exit 0
    fi

    total_bundles=${#all_bundles[@]}
    valid_count=0
    invalid_count=0
    total_files=0
    total_lines=0

    for bid in "${all_bundles[@]}"; do
      echo "── Bundle: $bid ──"
      if "$0" validate "$bid" 2>&1; then
        ((valid_count++)) || true
        # Get stats
        p="$BUNDLES_DIR/$bid/changes.patch"
        if [[ -f "$p" ]]; then
          fc=$(git apply --numstat "$p" 2>/dev/null | wc -l)
          added=$(git apply --numstat "$p" 2>/dev/null | awk '{a+=$1} END{print a+0}')
          deleted=$(git apply --numstat "$p" 2>/dev/null | awk '{d+=$2} END{print d+0}')
          total_files=$((total_files + fc))
          total_lines=$((total_lines + added + deleted))
        fi
      else
        ((invalid_count++)) || true
      fi
      echo ""
    done

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  SUMMARY"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Bundles: $total_bundles total ($valid_count valid, $invalid_count invalid)"
    echo "  Scope:   $total_files files, $total_lines lines"
    echo ""

    if [[ $invalid_count -gt 0 ]]; then
      echo "❌ Cannot approve: $invalid_count bundle(s) failed validation"
      exit 1
    fi

    echo "✅ All bundles valid"
    echo ""
    echo "┌─────────────────────────────────────────────────────────┐"
    echo "│  To approve ALL bundles:                                │"
    echo "│                                                         │"
    echo "│  gov airlock approve-all                                │"
    echo "│                                                         │"
    echo "└─────────────────────────────────────────────────────────┘"
    exit 0
    ;;

  ingest)
    check_kill_switch

    # Parse args (passthrough to approve-all)
    INGEST_ARGS=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --yes|-y) INGEST_ARGS="$INGEST_ARGS --yes"; shift ;;
        --auto-reject) INGEST_ARGS="$INGEST_ARGS --auto-reject"; shift ;;
        *) shift ;;
      esac
    done

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  AIRLOCK INGEST (Submissions → Inbox → Approve)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    # Check submissions directory
    if [[ ! -d "$SUBMISSIONS_DIR" ]]; then
      echo "ℹ️  No submissions directory: $SUBMISSIONS_DIR"
      exit 0
    fi

    # Find bundles in submissions
    submission_bundles=()
    while IFS= read -r p; do
      [[ -n "$p" ]] && submission_bundles+=("$(basename "$(dirname "$p")")")
    done < <(find "$SUBMISSIONS_DIR" -maxdepth 2 -type f -name "changes.patch" 2>/dev/null)

    if [[ ${#submission_bundles[@]} -eq 0 ]]; then
      echo "ℹ️  No bundles in submissions: $SUBMISSIONS_DIR"
      # Still run approve-all in case inbox has bundles
      exec "$0" approve-all $INGEST_ARGS
    fi

    echo "ℹ️  Found ${#submission_bundles[@]} bundle(s) in submissions:"
    for bid in "${submission_bundles[@]}"; do
      echo "   - $bid"
    done
    echo ""

    # Move bundles to inbox
    echo "ℹ️  Moving to inbox..."
    mkdir -p "$BUNDLES_DIR"
    moved_count=0
    for bid in "${submission_bundles[@]}"; do
      src="$SUBMISSIONS_DIR/$bid"
      dst="$BUNDLES_DIR/$bid"
      if [[ -d "$dst" ]]; then
        echo "   ⚠️  $bid already in inbox (skipped)"
      else
        mv "$src" "$dst"
        echo "   ✅ $bid → inbox"
        ((moved_count++)) || true
      fi
    done
    echo ""
    echo "ℹ️  Moved $moved_count bundle(s) to inbox"
    echo ""

    log_event "INGEST" "all" "SUCCESS" "moved=$moved_count"

    # Chain to approve-all
    exec "$0" approve-all $INGEST_ARGS
    ;;

  approve-all)
    check_kill_switch
    YES_FLAG=0
    AUTO_REJECT=0
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --yes|-y) YES_FLAG=1; shift ;;
        --auto-reject) AUTO_REJECT=1; shift ;;
        *) shift ;;
      esac
    done

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  AIRLOCK APPROVE-ALL (Atomic Bundle-by-Bundle)"
    [[ $AUTO_REJECT -eq 1 ]] && echo "  Mode: --auto-reject (invalid bundles will be rejected)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    all_bundles=($(list_all_bundles))
    if [[ ${#all_bundles[@]} -eq 0 ]]; then
      echo "ℹ️  No bundles in inbox: $BUNDLES_DIR"
      exit 0
    fi

    total_count=${#all_bundles[@]}
    valid_bundles=()
    invalid_bundles=()

    # Per-bundle validation
    echo "ℹ️  Validating bundles..."
    for bid in "${all_bundles[@]}"; do
      if "$0" validate "$bid" >/dev/null 2>&1; then
        valid_bundles+=("$bid")
        echo "   ✅ $bid"
      else
        invalid_bundles+=("$bid")
        echo "   ❌ $bid"
      fi
    done
    echo ""

    # Handle invalid bundles
    if [[ ${#invalid_bundles[@]} -gt 0 ]]; then
      if [[ $AUTO_REJECT -eq 1 ]]; then
        echo "ℹ️  Auto-rejecting ${#invalid_bundles[@]} invalid bundle(s)..."
        for bid in "${invalid_bundles[@]}"; do
          "$0" reject "$bid" --reason "auto-reject: failed validation" 2>/dev/null || true
          echo "   🗑️  $bid → rejected/"
        done
        echo ""
      else
        echo "❌ ${#invalid_bundles[@]} bundle(s) failed validation."
        echo "   Run validate-all for details, or use --auto-reject to skip invalid bundles."
        exit 1
      fi
    fi

    # Check if any valid bundles remain
    if [[ ${#valid_bundles[@]} -eq 0 ]]; then
      echo "ℹ️  No valid bundles to approve."
      exit 0
    fi

    echo "ℹ️  ${#valid_bundles[@]}/${total_count} bundles ready for approval"
    echo ""

    # Confirmation
    if [[ $YES_FLAG -eq 0 ]]; then
      echo "⚠️  About to approve ${#valid_bundles[@]} bundle(s):"
      for bid in "${valid_bundles[@]}"; do
        echo "   - $bid"
      done
      echo ""
      read -r -p "Continue? (y/N) " ans
      [[ "$ans" =~ ^[yY]$ ]] || { echo "Aborted."; exit 0; }
    fi

    # Setup: checkout base branch
    cd "$REPO_DIR"
    git fetch origin "$BASE_BRANCH" >/dev/null 2>&1 || true
    git checkout "$BASE_BRANCH" >/dev/null 2>&1
    git pull --ff-only origin "$BASE_BRANCH" >/dev/null 2>&1 || true

    # Atomic loop: accept → merge → move (one bundle at a time)
    echo ""
    echo "ℹ️  Processing bundles (atomic: accept → merge → move)..."
    merged_count=0
    rejected_count=${#invalid_bundles[@]}

    for bid in "${valid_bundles[@]}"; do
      echo ""
      echo "━━ Bundle: $bid ━━"

      # 1. Accept with --no-move
      echo "   [1/3] Accepting..."
      if ! "$0" accept "$bid" --no-move --no-pr --no-push --no-tail; then
        echo "❌ Accept failed for $bid"
        print_recovery_instructions
        exit 1
      fi

      # 2. Merge to base branch
      echo "   [2/3] Merging airlock/$bid → $BASE_BRANCH..."
      git checkout "$BASE_BRANCH" >/dev/null 2>&1
      if ! git merge "airlock/$bid" --no-edit >/dev/null 2>&1; then
        echo "❌ Merge conflict on airlock/$bid"
        echo ""
        echo "   Bundle $bid remains in inbox for recovery."
        echo "   $merged_count bundle(s) already merged to $BASE_BRANCH (local)."
        print_recovery_instructions
        exit 1
      fi

      # 3. Move bundle to processed (now safe)
      echo "   [3/3] Moving to processed/..."
      processed_name="$(move_to_processed "$bid")"

      ((merged_count++)) || true
      echo "   ✅ $bid: accepted + merged + moved → $processed_name"
    done

    # Push once (all merges complete)
    echo ""
    echo "ℹ️  Pushing to origin/$BASE_BRANCH..."
    git push origin "$BASE_BRANCH"

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  ✅ APPROVE-ALL COMPLETE"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Total:    $total_count bundles"
    echo "  Merged:   $merged_count"
    echo "  Rejected: $rejected_count"
    echo "  Pushed:   origin/$BASE_BRANCH"
    echo ""
    echo "  Next: write tail for merged bundles"
    echo "  ENV=PREPROD gov tail --bundle <id> --decision MERGED --reason '...'"
    echo ""
    log_event "APPROVE_ALL" "all" "SUCCESS" "total=$total_count merged=$merged_count rejected=$rejected_count"
    exit 0
    ;;
esac

bundle_id="${1:-}"; shift || true
[[ -n "${cmd:-}" && -n "${bundle_id:-}" ]] || { usage; exit 2; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-pr) NO_PR=1; shift ;;
    --no-push) NO_PUSH=1; shift ;;
    --no-tail) NO_TAIL=1; shift ;;
    --no-move) NO_MOVE=1; shift ;;
    --reason) REASON="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "❌ Unknown arg: $1" >&2; usage; exit 2 ;;
  esac
done

if [[ "$bundle_id" == "latest" ]]; then
  latest="$(resolve_latest_bundle || true)"
  [[ -n "${latest:-}" ]] || { echo "❌ No bundle found in: $BUNDLES_DIR" >&2; exit 1; }
  bundle_id="$latest"
  echo "✅ Resolved latest bundle → $bundle_id"
fi

cd "$REPO_DIR"
bundle_dir="$BUNDLES_DIR/$bundle_id"
patch="$bundle_dir/changes.patch"
[[ -f "$patch" ]] || { echo "❌ Patch not found: $patch" >&2; exit 1; }

patch_hash="$(sha256sum "$patch" | awk '{print $1}')"

# Validate patch format (skip for reject command - we want to reject invalid patches)
PATCH_VALID=1
if ! git apply --numstat "$patch" >/dev/null 2>&1; then
  PATCH_VALID=0
  # Only fail for commands that require valid patch
  if [[ "$cmd" != "reject" ]]; then
    echo "❌ INVALID PATCH FORMAT (corrupt or malformed patch file)" >&2
    exit 1
  fi
fi

# Calculate stats only if patch is valid
if [[ $PATCH_VALID -eq 1 ]]; then
  files_count="$(git apply --numstat "$patch" | wc -l | awk '{print $1}')"
  added="$(git apply --numstat "$patch" | awk '{a+=$1} END{print a+0}')"
  deleted="$(git apply --numstat "$patch" | awk '{d+=$2} END{print d+0}')"
  lines="$((added + deleted))"
else
  files_count=0
  added=0
  deleted=0
  lines=0
fi

risk="LOW"
if (( files_count > MAX_FILES || lines > MAX_LINES )); then
  risk="HIGH"
fi

print_status(){
  echo "ℹ️  Bundle: $bundle_id"
  echo "ℹ️  Patch:  $patch"
  echo "ℹ️  Hash:   $patch_hash"
  if [[ $PATCH_VALID -eq 1 ]]; then
    echo "ℹ️  Scope:  files=$files_count lines=+$added -$deleted (= $lines)"
    echo "ℹ️  Risk:   $risk (max files=$MAX_FILES, max lines=$MAX_LINES)"
  else
    echo "⚠️  Scope:  INVALID PATCH (cannot apply)"
  fi
}

branch="airlock/$bundle_id"

case "$cmd" in
  status)
    print_status
    ;;
  validate)
    check_kill_switch
    print_status
    echo ""
    echo "ℹ️  Validating BUNDLE-SPEC constraints..."

    # Check 5 required files
    missing=0
    for f in manifest.json constraints.json changes.patch evidence.json report.md; do
      if [[ ! -f "$bundle_dir/$f" ]]; then
        echo "❌ Missing required file: $f"
        missing=1
      fi
    done
    [[ $missing -eq 0 ]] || { echo "❌ Bundle structure invalid"; exit 1; }
    echo "✅ Structure: 5/5 required files present"

    # FAIL-CLOSED: Block symlinks (tamper protection)
    for f in manifest.json constraints.json changes.patch evidence.json report.md; do
      if [[ -L "$bundle_dir/$f" ]]; then
        echo "❌ BLOCKED: $f is a symlink (tampering attempt)"
        exit 1
      fi
    done
    echo "✅ Symlinks: None detected (tamper-proof)"

    # FAIL-CLOSED: Bundle must be in airlock (not in repo)
    if [[ "$bundle_dir" == *"/opt/automecanik/app/"* ]]; then
      echo "❌ BLOCKED: Bundle inside repo (must be in /opt/automecanik/airlock/inbox)"
      exit 1
    fi
    echo "✅ Location: Bundle in airlock (isolated)"

    # FAIL-CLOSED: Patch must not touch system paths (blast radius files)
    # (^|/) prevents bypass via subdirectories, $ prevents false positives
    forbidden_system_paths='(^|/)\.git/|(^|/)\.env($|/)|(^|/)\.github/|(^|/)scripts/|(^|/)docker-compose|(^|/)Caddyfile$|(^|/)Dockerfile|(^|/)\.dockerignore$|(^|/)package-lock\.json$|(^|/)pnpm-lock\.yaml$|(^|/)yarn\.lock$|(^|/)infrastructure/'
    if git apply --numstat "$patch" 2>/dev/null | awk '{print $3}' | grep -qE "$forbidden_system_paths"; then
      echo "❌ BLOCKED: Patch touches forbidden system path (blast radius file)"
      exit 1
    fi
    echo "✅ Paths: No forbidden system paths"

    # FAIL-CLOSED: Block binary files in patch (hard to audit)
    if grep -qE '^Binary files|^GIT binary patch' "$patch"; then
      echo "❌ BLOCKED: Patch contains binary data (cannot audit)"
      exit 1
    fi
    echo "✅ Binary: No binary data in patch"

    # FAIL-CLOSED: Block renames to forbidden paths
    if grep -E '^rename to ' "$patch" 2>/dev/null | grep -qE "$forbidden_system_paths"; then
      echo "❌ BLOCKED: Patch renames file to forbidden path"
      exit 1
    fi
    echo "✅ Renames: No renames to forbidden paths"

    # Check constraints if jq available
    if command -v jq >/dev/null 2>&1 && [[ -f "$bundle_dir/constraints.json" ]]; then
      # FAIL-CLOSED: Validate minimal constraints.json schema
      # Accept both formats:
      #   Format A (original): { "diff_budget": { "max_files": N, "max_lines": N } }
      #   Format B (OpenClaw): { "enforced_constraints": { "file_limits": { "max_files_modified": N }, "line_limits": { "max_lines_changed": N } } }
      format_a=""
      format_b=""
      if jq -e '.diff_budget.max_files and .diff_budget.max_lines' "$bundle_dir/constraints.json" >/dev/null 2>&1; then
        format_a="A"
      fi
      if jq -e '.enforced_constraints.file_limits.max_files_modified and .enforced_constraints.line_limits.max_lines_changed' "$bundle_dir/constraints.json" >/dev/null 2>&1; then
        format_b="B"
      fi

      if [[ -z "$format_a" && -z "$format_b" ]]; then
        echo "❌ BLOCKED: constraints.json missing required budget fields"
        echo "   Expected: diff_budget.{max_files,max_lines} OR enforced_constraints.{file_limits.max_files_modified,line_limits.max_lines_changed}"
        exit 1
      fi
      echo "✅ Schema: constraints.json valid (format ${format_a:-$format_b})"

      # Check forbidden_paths
      while IFS= read -r pattern; do
        [[ -z "$pattern" ]] && continue
        if git apply --numstat "$patch" | awk '{print $3}' | grep -qE "$pattern"; then
          echo "❌ Patch touches forbidden path: $pattern"
          exit 1
        fi
      done < <(jq -r '.forbidden_paths[]?' "$bundle_dir/constraints.json" 2>/dev/null)
      echo "✅ Forbidden paths: OK"

      # Check forbidden_patterns in patch content (support both formats)
      while IFS= read -r pattern; do
        [[ -z "$pattern" ]] && continue
        if grep -qE "$pattern" "$patch"; then
          echo "❌ Patch contains forbidden pattern: $pattern"
          exit 1
        fi
      done < <(jq -r '(.forbidden_patterns // .enforced_constraints.forbidden_patterns.patterns // [])[]?' "$bundle_dir/constraints.json" 2>/dev/null)
      echo "✅ Forbidden patterns: OK"

      # Check diff_budget (support both formats)
      if [[ -n "$format_a" ]]; then
        budget_max_files=$(jq -r '.diff_budget.max_files // 999' "$bundle_dir/constraints.json" 2>/dev/null)
        budget_max_lines=$(jq -r '.diff_budget.max_lines // 9999' "$bundle_dir/constraints.json" 2>/dev/null)
      else
        budget_max_files=$(jq -r '.enforced_constraints.file_limits.max_files_modified // 999' "$bundle_dir/constraints.json" 2>/dev/null)
        budget_max_lines=$(jq -r '.enforced_constraints.line_limits.max_lines_changed // 9999' "$bundle_dir/constraints.json" 2>/dev/null)
      fi
      if (( files_count > budget_max_files )); then
        echo "❌ Budget exceeded: files=$files_count > max=$budget_max_files"
        exit 1
      fi
      if (( lines > budget_max_lines )); then
        echo "❌ Budget exceeded: lines=$lines > max=$budget_max_lines"
        exit 1
      fi
      echo "✅ Diff budget: OK (files=$files_count/$budget_max_files, lines=$lines/$budget_max_lines)"
    else
      echo "⚠️  jq not available or no constraints.json - skipping constraint checks"
    fi

    # Check patch applicability
    set +e
    git apply --check "$patch" 2>/dev/null
    apply_rc=$?
    set -e
    if [[ $apply_rc -eq 0 ]]; then
      echo "✅ Patch: applicable"
    elif [[ $apply_rc -eq 128 ]]; then
      echo "❌ INVALID PATCH FORMAT (git apply --check failed)"
      exit 1
    else
      echo "❌ Patch: cannot be applied cleanly (conflicts or missing base)"
      exit 1
    fi

    echo ""
    log_event "VALIDATE" "$bundle_id" "SUCCESS" "files=$files_count lines=$lines"
    echo "✅ Bundle valid"
    ;;
  reject)
    check_kill_switch
    [[ -n "$REASON" ]] || { echo "❌ --reason required" >&2; exit 2; }
    print_status
    echo ""
    echo "ℹ️  Recording rejection in vault..."
    # tail-bundle may fail if entry already exists (idempotent rejection)
    "$SCRIPT_DIR/tail-bundle.sh" \
      --bundle "$bundle_id" \
      --decision REJECTED \
      --reason "$REASON" || echo "⚠️  Vault entry already exists (idempotent)"

    # Move bundle to rejected (tamper-proof naming)
    rejected_date="$(date +%Y%m%d)"
    short_hash="${patch_hash:0:12}"
    rejected_name="${rejected_date}__${bundle_id}__${short_hash}"
    mkdir -p /opt/automecanik/airlock/rejected
    rejected_dest="/opt/automecanik/airlock/rejected/$rejected_name"

    # Handle duplicate rejections (same bundle on same day)
    if [[ -d "$rejected_dest" ]]; then
      # Add suffix for duplicate
      suffix=2
      while [[ -d "${rejected_dest}_${suffix}" ]]; do
        ((suffix++))
      done
      rejected_dest="${rejected_dest}_${suffix}"
      rejected_name="${rejected_name}_${suffix}"
    fi

    mv "$bundle_dir" "$rejected_dest"
    log_event "REJECT" "$bundle_id" "SUCCESS" "reason=$REASON"
    echo "✅ Bundle moved to: $rejected_dest"
    echo "✅ Rejected and recorded in vault"
    ;;
  accept)
    check_kill_switch
    print_status

    # TOCTOU Protection: Store initial hash and verify bundle integrity
    initial_hash="$patch_hash"
    echo "ℹ️  TOCTOU check: verifying bundle integrity..."

    # Re-validate bundle (prevents race condition)
    echo "ℹ️  Re-running validation..."
    "$0" validate "$bundle_id" >/dev/null 2>&1 || {
      echo "❌ BLOCKED: Bundle failed re-validation (TOCTOU protection)"
      exit 1
    }

    # Verify bundle is still in inbox (not moved/replaced)
    if [[ ! -d "$bundle_dir" ]]; then
      echo "❌ BLOCKED: Bundle no longer exists in inbox (TOCTOU protection)"
      exit 1
    fi

    # Verify hash hasn't changed since initial read
    current_hash="$(sha256sum "$patch" 2>/dev/null | awk '{print $1}')"
    if [[ "$current_hash" != "$initial_hash" ]]; then
      echo "❌ BLOCKED: Bundle hash changed (TOCTOU protection)"
      echo "   Initial: $initial_hash"
      echo "   Current: $current_hash"
      exit 1
    fi
    echo "✅ TOCTOU: Bundle integrity verified"

    if [[ "$risk" == "HIGH" ]]; then
      read -r -p "⚠️  Risk HIGH. Continue? (y/N) " ans
      [[ "$ans" =~ ^[yY]$ ]] || { echo "✅ Aborted."; exit 0; }
    fi

    git fetch origin "$BASE_BRANCH" >/dev/null 2>&1 || true
    git checkout "$BASE_BRANCH" >/dev/null 2>&1
    git pull --ff-only origin "$BASE_BRANCH" >/dev/null 2>&1 || true

    if git show-ref --verify --quiet "refs/heads/$branch"; then
      git checkout "$branch" >/dev/null 2>&1
      git reset --hard "origin/$BASE_BRANCH" >/dev/null 2>&1 || git reset --hard "$BASE_BRANCH"
    else
      git checkout -b "$branch" >/dev/null 2>&1
    fi

    echo "ℹ️  Applying patch..."
    if ! git apply --index "$patch" >/dev/null 2>&1; then
      git apply --3way --index "$patch"
    fi

    git commit -m "airlock($bundle_id): apply bundle" >/dev/null 2>&1 || {
      echo "❌ Commit failed (conflicts?)" >&2
      exit 1
    }

    echo "ℹ️  Running checks..."
    set +e
    npm run typecheck; tc=$?
    npm test; ts=$?
    set -e

    if [[ $tc -ne 0 || $ts -ne 0 ]]; then
      echo "❌ Checks failed (typecheck=$tc test=$ts)" >&2
      exit 1
    fi
    echo "✅ Checks OK."

    if [[ "$NO_PUSH" -eq 0 ]]; then
      git push -u origin "$branch"
      echo "✅ Branch pushed: $branch"
    else
      echo "⚠️  --no-push set: branch not pushed."
    fi

    if [[ "$NO_PR" -eq 0 ]]; then
      if command -v gh >/dev/null 2>&1; then
        body=$(
          cat <<BODY
Bundle: \`$bundle_id\`
Patch hash: \`$patch_hash\`
Scope: files=$files_count lines=+$added -$deleted (= $lines)
Risk: $risk

Checks:
- ✅ npm run typecheck
- ✅ npm test
BODY
        )
        set +e
        pr_url="$(gh pr create --base "$BASE_BRANCH" --head "$branch" \
          --title "airlock($bundle_id): apply bundle" --body "$body" 2>/dev/null | tail -n 1)"
        set -e
        [[ -n "${pr_url:-}" ]] && echo "✅ PR created: $pr_url" || echo "⚠️  PR not created (maybe exists)."
      else
        echo "⚠️  gh not installed: skipping PR creation."
      fi
    fi

    if [[ "$NO_TAIL" -eq 0 ]]; then
      echo "ℹ️  Tail is disabled by strategy unless you really want ACCEPTED tail here."
      echo "   Recommended: run tail-bundle.sh after manual merge with decision=MERGED."
    fi

    # Move bundle to processed (tamper-proof naming)
    if [[ "$NO_MOVE" -eq 0 ]]; then
      processed_name="$(move_to_processed "$bundle_id")"
      log_event "ACCEPT" "$bundle_id" "SUCCESS" "branch=$branch files=$files_count"
      echo "✅ Bundle moved to: /opt/automecanik/airlock/processed/$processed_name"
      echo "✅ Done. Next: merge PR manually, then write tail (MERGED)."
    else
      log_event "ACCEPT" "$bundle_id" "SUCCESS" "branch=$branch files=$files_count defer_move=1"
      echo "ℹ️  Bundle NOT moved (--no-move). Move manually after merge."
      echo "✅ Done. Branch ready: $branch"
    fi
    ;;
  *)
    echo "❌ Unknown command: $cmd" >&2
    usage
    exit 2
    ;;
esac
