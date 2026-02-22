#!/usr/bin/env bash
set -euo pipefail

# Two-pass RAG reindex job for cron:
# 1) normal files (below threshold)
# 2) large files (one-by-one)

RAG_DIR="${RAG_DIR:-/opt/automecanik/rag}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
SIZE_THRESHOLD_BYTES="${SIZE_THRESHOLD_BYTES:-500000}"
BATCH_SIZE="${BATCH_SIZE:-1}"
LOG_DIR="${LOG_DIR:-$RAG_DIR/logs/reindex-cron}"
STAMP="$(date +%Y%m%d_%H%M%S)"
LOG_FILE="$LOG_DIR/reindex_${STAMP}.log"
LOCK_FILE="${LOCK_FILE:-/tmp/rag-reindex-two-pass.lock}"

mkdir -p "$LOG_DIR"

# --- Global lock (prevent concurrent RAG operations) ---
GLOBAL_LOCK="/tmp/rag-global.lock"
exec 8>"$GLOBAL_LOCK"
if ! flock -n 8; then
  echo "[$(date -Is)] Another RAG operation active (global lock); exit." | tee -a "$LOG_FILE"
  exit 0
fi

# --- Local lock (prevent concurrent reindex runs) ---
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[$(date -Is)] Another reindex job is running; exit." | tee -a "$LOG_FILE"
  exit 0
fi

run_in_container() {
  local label="$1"
  local mode="$2"

  echo "[$(date -Is)] START ${label}" | tee -a "$LOG_FILE"

  cd "$RAG_DIR"
  docker compose -p rag -f "$COMPOSE_FILE" run --rm --no-deps rag-api sh -lc "
    set -euo pipefail
    export ENV=dev
    export WEAVIATE_URL=http://weaviate-prod:8080
    export REINDEX_BATCH_SIZE=$BATCH_SIZE
    export MALLOC_ARENA_MAX=2
    export STRICT_ROUTING=1

    mkdir -p /tmp/reindex-pass
    rm -rf /tmp/reindex-pass/*

    if [ '$mode' = 'normal' ]; then
      find /knowledge -type f -name '*.md' ! -name 'README.md' -size -${SIZE_THRESHOLD_BYTES}c -print0 | \
        while IFS= read -r -d '' f; do
          rel=\"\${f#/knowledge/}\"
          mkdir -p \"/tmp/reindex-pass/\$(dirname \"\$rel\")\"
          cp \"\$f\" \"/tmp/reindex-pass/\$rel\"
        done

      python scripts/reindex.py \
        --path /tmp/reindex-pass \
        --batch-size $BATCH_SIZE \
        --cpu-strict \
        --strict-routing
    else
      count=\$(find /knowledge -type f -name '*.md' ! -name 'README.md' -size +${SIZE_THRESHOLD_BYTES}c | wc -l)
      if [ \"\$count\" -eq 0 ]; then
        echo '[large] no large files found'
        exit 0
      fi

      find /knowledge -type f -name '*.md' ! -name 'README.md' -size +${SIZE_THRESHOLD_BYTES}c -print0 | \
        while IFS= read -r -d '' f; do
          rm -rf /tmp/reindex-pass/*
          rel=\"\${f#/knowledge/}\"
          mkdir -p \"/tmp/reindex-pass/\$(dirname \"\$rel\")\"
          cp \"\$f\" \"/tmp/reindex-pass/\$rel\"
          echo \"[large] indexing \$rel\"

          python scripts/reindex.py \
            --path /tmp/reindex-pass \
            --batch-size $BATCH_SIZE \
            --max-files 1 \
            --cpu-strict \
            --strict-routing
        done
    fi
  " | tee -a "$LOG_FILE"

  echo "[$(date -Is)] END ${label}" | tee -a "$LOG_FILE"
}

run_in_container "PASS 1 normal files" "normal"
run_in_container "PASS 2 large files" "large"

echo "[$(date -Is)] DONE two-pass reindex" | tee -a "$LOG_FILE"
