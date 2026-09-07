#!/bin/bash
# TecDoc Batch Loader — Safe & Robust
# Usage: ./tecdoc-batch-load.sh <TABLE_ID> [BATCH_ID]
# Example: ./tecdoc-batch-load.sh 200 batch_2026_03_15
#
# Consumes a pre-generated file-list, processes one file at a time:
# extract → parse → load → log → purge

set -euo pipefail

TABLE_ID="${1:?Usage: tecdoc-batch-load.sh <TABLE_ID> [BATCH_ID]}"
BATCH_ID="${2:-batch_$(date +%Y%m%d_%H%M%S)}"

ARCHIVE="/opt/automecanik/app/.github/SQL-CONVERTED.7z"
FILE_LIST="/opt/automecanik/data/tecdoc/filelists/${TABLE_ID}.txt"
WORKDIR="/opt/automecanik/data/tecdoc/workdir"
LOGDIR="/opt/automecanik/data/tecdoc/logs"
PARSEUR="/opt/automecanik/app/scripts/tecdoc-mysql-to-csv.py"

# Database connection (uses PGDATABASE, PGHOST, etc. from env or .pgpass)
PSQL_CMD="psql -h db.cxpojprgwgubzjyqzmoq.supabase.co -U postgres -d postgres"

# Verify prerequisites
if [[ ! -f "$ARCHIVE" ]]; then echo "ERROR: Archive not found: $ARCHIVE"; exit 1; fi
if [[ ! -f "$FILE_LIST" ]]; then echo "ERROR: File list not found: $FILE_LIST"; exit 1; fi
if [[ ! -f "$PARSEUR" ]]; then echo "ERROR: Parser not found: $PARSEUR"; exit 1; fi

mkdir -p "$WORKDIR" "$LOGDIR"

TOTAL_FILES=$(wc -l < "$FILE_LIST")
CURRENT=0
TOTAL_LOADED=0
TOTAL_ERRORS=0

echo "=== TecDoc Batch Load ==="
echo "Table: t${TABLE_ID}"
echo "Batch: ${BATCH_ID}"
echo "Files: ${TOTAL_FILES}"
echo "Start: $(date -Iseconds)"
echo "========================="

while IFS= read -r FILE; do
  CURRENT=$((CURRENT + 1))

  # 0. Validate file prefix matches TABLE_ID
  if [[ "$FILE" != ${TABLE_ID}.* ]]; then
    echo "$(date -Iseconds)|${FILE}|SKIP|wrong_prefix" >> "$LOGDIR/batch_${TABLE_ID}.log"
    echo "[$CURRENT/$TOTAL_FILES] SKIP $FILE (wrong prefix)"
    continue
  fi

  echo -n "[$CURRENT/$TOTAL_FILES] $FILE ... "

  # 1. Extract single file from 7z
  7z e "$ARCHIVE" "$FILE" -o"$WORKDIR/" -y > /dev/null 2>&1
  if [[ ! -f "$WORKDIR/$FILE" ]]; then
    echo "$(date -Iseconds)|${FILE}|ERROR|extract_failed" >> "$LOGDIR/batch_${TABLE_ID}.log"
    echo "EXTRACT FAILED"
    TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
    continue
  fi

  # 2. Parse MySQL → CSV
  CSV_FILE="$WORKDIR/${FILE%.sql}.csv"
  META_FILE="$WORKDIR/${FILE%.sql}.meta"
  python3 "$PARSEUR" "$WORKDIR/$FILE" -o "$CSV_FILE" 2>> "$LOGDIR/parse_${TABLE_ID}.log" || true

  # Read counters from .meta
  PARSED=0; EMITTED=0; REJECTED=0
  if [[ -f "$META_FILE" ]]; then
    PARSED=$(grep -oP 'rows_parsed=\K\d+' "$META_FILE" || echo 0)
    EMITTED=$(grep -oP 'rows_emitted=\K\d+' "$META_FILE" || echo 0)
    REJECTED=$(grep -oP 'rows_rejected=\K\d+' "$META_FILE" || echo 0)
  fi

  if [[ ! -f "$CSV_FILE" ]] || [[ "$EMITTED" -eq 0 ]]; then
    echo "$(date -Iseconds)|${FILE}|${PARSED}|${EMITTED}|${REJECTED}|PARSE_EMPTY|0ms" >> "$LOGDIR/batch_${TABLE_ID}.log"
    echo "EMPTY (0 rows emitted)"
    rm -f "$WORKDIR/$FILE" "$CSV_FILE" "$META_FILE"
    continue
  fi

  # 3. Load into tecdoc_raw
  BEFORE=$(date +%s%N)
  COPY_RESULT=$($PSQL_CMD -c "\copy tecdoc_raw.t${TABLE_ID} FROM '${CSV_FILE}' WITH (FORMAT csv, NULL '__PG_NULL__')" 2>&1) || true
  LOAD_STATUS=$?
  AFTER=$(date +%s%N)
  DURATION_MS=$(( (AFTER - BEFORE) / 1000000 ))

  if [[ $LOAD_STATUS -eq 0 ]]; then
    echo "$(date -Iseconds)|${FILE}|${PARSED}|${EMITTED}|${REJECTED}|OK|${DURATION_MS}ms" >> "$LOGDIR/batch_${TABLE_ID}.log"
    echo "OK (${EMITTED} rows, ${DURATION_MS}ms)"
    TOTAL_LOADED=$((TOTAL_LOADED + EMITTED))
  else
    echo "$(date -Iseconds)|${FILE}|${PARSED}|${EMITTED}|${REJECTED}|LOAD_ERROR|${DURATION_MS}ms|${COPY_RESULT}" >> "$LOGDIR/batch_${TABLE_ID}.log"
    echo "LOAD ERROR: ${COPY_RESULT}"
    TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
  fi

  # 5. Purge working files
  rm -f "$WORKDIR/$FILE" "$CSV_FILE" "$META_FILE"

done < "$FILE_LIST"

echo "========================="
echo "End: $(date -Iseconds)"
echo "Total loaded: ${TOTAL_LOADED} rows"
echo "Total errors: ${TOTAL_ERRORS}"
echo "Log: ${LOGDIR}/batch_${TABLE_ID}.log"
echo "========================="
