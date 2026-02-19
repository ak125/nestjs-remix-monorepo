#!/usr/bin/env bash
# ============================================================
# RUNBOOK v2.1 — Content Refresh E2E Validation (all-in-one)
# Date: 2026-02-19
# ============================================================
#
# Usage:
#   bash scripts/runbook-content-refresh-e2e.sh           # manuel
#   bash scripts/runbook-content-refresh-e2e.sh --auto    # triggers auto
#
# Output:  /tmp/runbook-e2e-YYYYMMDD-HHMM.txt
#
# Micro-ajustements integres:
#   1) BullMQ failed <= 2
#   2) jq null safety (+ fallback sans jq)
#   3) HTML regex noise (strip internes + whitespace)
#   4) PM mismatch escalation (procedure 5 etapes)
#   5) Polling 5s / 120s timeout
#   6) Partial entry tolerance (pending = WARN)
#   7) active <= 1 + 10s post-polling wait
# ============================================================

set -euo pipefail

# --- Configurable Variables ---
BASE="${BASE:-http://localhost:3000}"
REDIS_CONTAINER="${REDIS_CONTAINER:-app-redis_prod-1}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"
SLUG_NO_RAG="${SLUG_NO_RAG:-bouton-de-retroviseur}"
SLUG_NO_RAG_2="${SLUG_NO_RAG_2:-disque-d-embrayage}"
SLUG_WITH_RAG="${SLUG_WITH_RAG:-plaquette-de-frein}"
PAGES=("demarreur-2" "plaquette-de-frein-402" "filtre-a-huile-7")
POLL_TIMEOUT=120
POLL_INTERVAL=5

# --- Mode ---
AUTO_MODE=false
[[ "${1:-}" == "--auto" ]] && AUTO_MODE=true

# --- Output file ---
OUT="/tmp/runbook-e2e-$(date +%Y%m%d-%H%M).txt"

# --- Auth header ---
AUTH_HEADER=""
if [ -n "$ADMIN_TOKEN" ]; then
  AUTH_HEADER="-H \"Authorization: Bearer ${ADMIN_TOKEN}\""
fi

# --- jq detection ---
HAS_JQ=false
command -v jq >/dev/null 2>&1 && HAS_JQ=true

# ============================================================
# Helpers
# ============================================================

section() {
  local title="$1"
  echo "" | tee -a "$OUT"
  echo "============================================================" | tee -a "$OUT"
  echo " $title" | tee -a "$OUT"
  echo "============================================================" | tee -a "$OUT"
}

check() {
  echo "" | tee -a "$OUT"
  echo "--- $1 ---" | tee -a "$OUT"
}

log() {
  echo "$1" | tee -a "$OUT"
}

verdict() {
  local label="$1" result="$2"
  echo "  >> ${label}: ${result}" | tee -a "$OUT"
}

# Safe jq: uses jq if available, otherwise grep fallback
# Usage: safe_jq '<jq_filter>' '<fallback_grep_pattern>' <<< "$json"
safe_jq() {
  local filter="$1"
  local fallback_pattern="${2:-}"
  if [ "$HAS_JQ" = true ]; then
    jq -r "$filter" 2>/dev/null || echo "[jq_error]"
  elif [ -n "$fallback_pattern" ]; then
    grep -oP "$fallback_pattern" 2>/dev/null | head -1 || echo "[parse_error]"
  else
    cat  # passthrough
  fi
}

# Curl wrapper with optional auth
api_get() {
  local url="$1"
  if [ -n "$ADMIN_TOKEN" ]; then
    curl -s --max-time 10 -H "Authorization: Bearer ${ADMIN_TOKEN}" "$url"
  else
    curl -s --max-time 10 "$url"
  fi
}

api_post() {
  local url="$1" data="$2"
  if [ -n "$ADMIN_TOKEN" ]; then
    curl -s --max-time 10 -H "Content-Type: application/json" -H "Authorization: Bearer ${ADMIN_TOKEN}" -X POST -d "$data" "$url"
  else
    curl -s --max-time 10 -H "Content-Type: application/json" -X POST -d "$data" "$url"
  fi
}

redis_cmd() {
  docker exec "$REDIS_CONTAINER" redis-cli "$@" 2>/dev/null
}

# Polling function [#5]
# Polls status API until all entries are done or timeout
# Returns 0 if all done, 1 if timeout
poll_until_done() {
  local alias="$1"
  local elapsed=0

  while [ $elapsed -lt $POLL_TIMEOUT ]; do
    local raw
    raw=$(api_get "${BASE}/api/admin/content-refresh/status?pg_alias=${alias}&limit=20")

    local total=0 pending=0 done_count=0 draft=0 skipped=0 failed=0
    if [ "$HAS_JQ" = true ]; then
      total=$(echo "$raw" | jq '(.data | length) // 0' 2>/dev/null)
      total=${total:-0}
      pending=$(echo "$raw" | jq '[(.data // [])[] | select(.status == "pending" or .status == "processing")] | length' 2>/dev/null)
      pending=${pending:-0}
      done_count=$(echo "$raw" | jq '[(.data // [])[] | select(.status != "pending" and .status != "processing")] | length' 2>/dev/null)
      done_count=${done_count:-0}
      draft=$(echo "$raw" | jq '[(.data // [])[] | select(.status == "draft")] | length' 2>/dev/null)
      draft=${draft:-0}
      skipped=$(echo "$raw" | jq '[(.data // [])[] | select(.status == "skipped")] | length' 2>/dev/null)
      skipped=${skipped:-0}
      failed=$(echo "$raw" | jq '[(.data // [])[] | select(.status == "failed")] | length' 2>/dev/null)
      failed=${failed:-0}
    else
      total=$(echo "$raw" | grep -oP '"status"\s*:' | wc -l)
      pending=$(echo "$raw" | grep -oP '"status"\s*:\s*"(pending|processing)"' | wc -l)
      done_count=$((total - pending))
      draft=$(echo "$raw" | grep -oP '"status"\s*:\s*"draft"' | wc -l)
      skipped=$(echo "$raw" | grep -oP '"status"\s*:\s*"skipped"' | wc -l)
      failed=$(echo "$raw" | grep -oP '"status"\s*:\s*"failed"' | wc -l)
    fi

    log "[${elapsed}s] ${alias}: total=${total} pending=${pending} done=${done_count} (draft=${draft} skipped=${skipped} failed=${failed})"

    if [ "$total" -gt 0 ] && [ "$pending" -eq 0 ]; then
      log "ALL DONE for ${alias}"
      return 0
    fi

    sleep $POLL_INTERVAL
    elapsed=$((elapsed + POLL_INTERVAL))
  done

  log "TIMEOUT after ${POLL_TIMEOUT}s — ${pending} entries still pending for ${alias}"
  return 1
}

# Show final status for an alias
show_status() {
  local alias="$1"
  local raw
  raw=$(api_get "${BASE}/api/admin/content-refresh/status?pg_alias=${alias}&limit=20")

  if [ "$HAS_JQ" = true ]; then
    echo "$raw" | jq '.data[] | {id, page_type, status, quality_score: (.quality_score // "null"), quality_flags}' 2>/dev/null | tee -a "$OUT"
  else
    echo "$raw" | tee -a "$OUT"
  fi
}

# SQL step placeholder
sql_step() {
  local label="$1" query="$2"
  check "SQL STEP — ${label} — run via MCP Supabase"
  log "Copy-paste this query into MCP execute_sql (project: cxpojprgwgubzjyqzmoq):"
  log ""
  log "$query"
  log ""
}

# ============================================================
# Init
# ============================================================

echo "RUNBOOK v2.1 — Content Refresh E2E Validation" > "$OUT"
echo "Date:      $(date -Iseconds)" >> "$OUT"
echo "Host:      $(hostname)" >> "$OUT"
echo "Mode:      $([ "$AUTO_MODE" = true ] && echo "AUTO" || echo "MANUAL")" >> "$OUT"
echo "Base:      ${BASE}" >> "$OUT"
echo "Redis:     ${REDIS_CONTAINER}" >> "$OUT"
echo "Auth:      $([ -n "$ADMIN_TOKEN" ] && echo "token set" || echo "none")" >> "$OUT"
echo "jq:        $([ "$HAS_JQ" = true ] && echo "available" || echo "MISSING — using fallback")" >> "$OUT"
echo "No-RAG:    ${SLUG_NO_RAG}" >> "$OUT"
echo "With-RAG:  ${SLUG_WITH_RAG}" >> "$OUT"

log ""
log "Output: ${OUT}"
log ""

if [ "$HAS_JQ" = false ]; then
  log "WARNING: jq not found. Using grep/sed fallback (reduced formatting)."
fi

# ============================================================
section "L0 — INFRA"
# ============================================================

# L0.1
check "L0.1 — API health"
HEALTH_RAW=$(api_get "${BASE}/health")
if [ "$HAS_JQ" = true ]; then
  echo "$HEALTH_RAW" | jq '{status: (.status // "unknown"), uptime: (.uptime // 0)}' 2>/dev/null | tee -a "$OUT"
else
  echo "$HEALTH_RAW" | tee -a "$OUT"
fi

HEALTH_STATUS=""
if [ "$HAS_JQ" = true ]; then
  HEALTH_STATUS=$(echo "$HEALTH_RAW" | jq -r '.status // "unknown"' 2>/dev/null)
else
  HEALTH_STATUS=$(echo "$HEALTH_RAW" | grep -oP '"status"\s*:\s*"\K[^"]+' | head -1)
fi

if [ "$HEALTH_STATUS" = "ok" ]; then
  verdict "L0.1" "PASS"
else
  verdict "L0.1" "FAIL (status=${HEALTH_STATUS:-empty})"
fi

# L0.2
sql_step "L0.2 — DB gammes" \
"SELECT count(*) as active_gammes FROM pieces_gamme WHERE pg_display = '1';"

# L0.3
check "L0.3 — Redis"
REDIS_PING=$(redis_cmd ping 2>/dev/null || echo "FAIL")
log "Result: ${REDIS_PING}"
if [ "$REDIS_PING" = "PONG" ]; then
  verdict "L0.3" "PASS"
else
  verdict "L0.3" "FAIL"
fi

# L0.4
check "L0.4 — BullMQ queues (baseline)"
BQ_WAIT=$(redis_cmd LLEN "bull:seo-monitor:wait" 2>/dev/null || echo "0")
BQ_ACTIVE=$(redis_cmd LLEN "bull:seo-monitor:active" 2>/dev/null || echo "0")
BQ_COMPLETED=$(redis_cmd ZCARD "bull:seo-monitor:completed" 2>/dev/null || echo "0")
BQ_FAILED=$(redis_cmd ZCARD "bull:seo-monitor:failed" 2>/dev/null || echo "0")
log "wait:${BQ_WAIT}  active:${BQ_ACTIVE}  completed:${BQ_COMPLETED}  failed:${BQ_FAILED}"
COMPLETED_BASELINE="${BQ_COMPLETED}"
log "completed_baseline=${COMPLETED_BASELINE}"

# [#1] BullMQ failed tolerance: <= 2
if [ "${BQ_COMPLETED:-0}" -gt 0 ] && [ "${BQ_FAILED:-0}" -le 2 ]; then
  verdict "L0.4" "PASS (completed=${BQ_COMPLETED}, failed=${BQ_FAILED})"
else
  verdict "L0.4" "FAIL (completed=${BQ_COMPLETED}, failed=${BQ_FAILED})"
fi

# L0.5
check "L0.5 — RAG health (overlay)"
RAG_RAW=$(api_get "${BASE}/api/rag/health" 2>/dev/null || echo '{"status":"unreachable"}')
if [ "$HAS_JQ" = true ]; then
  echo "$RAG_RAW" | jq '{status: (.status // "unreachable"), docs: (.services.corpus.total_documents // 0)}' 2>/dev/null | tee -a "$OUT"
else
  echo "$RAG_RAW" | tee -a "$OUT"
fi
# RAG = overlay optionnel: toute reponse = PASS
verdict "L0.5" "PASS (overlay — up ou down = OK)"

# ============================================================
section "L1 — DB-FIRST PAGES"
# ============================================================

# L1.1
check "L1.1 — HTTP 200"
L1_1_OK=true
for URL in "${PAGES[@]}"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/pieces/${URL}.html")
  log "${URL}: ${CODE}"
  [ "$CODE" != "200" ] && L1_1_OK=false
done
if [ "$L1_1_OK" = true ]; then verdict "L1.1" "PASS"; else verdict "L1.1" "FAIL"; fi

# L1.2 — [#3] HTML regex noise: strip tags + whitespace
check "L1.2 — Title"
L1_2_OK=true
for URL in "${PAGES[@]}"; do
  log "=== ${URL} ==="
  TITLE=$(curl -s --compressed "${BASE}/pieces/${URL}.html" | \
    perl -0777 -ne '
      if (/<title[^>]*>(.*?)<\/title>/si) {
        my $t=$1;
        $t =~ s/<[^>]+>//g;
        $t =~ s/\s+/ /g;
        $t =~ s/^\s+|\s+$//g;
        print "$t\n";
      } else { print "[NO_TITLE]\n"; }
    ' 2>/dev/null)
  log "  title: ${TITLE:-[EMPTY]}"
  [ -z "$TITLE" ] || [ "$TITLE" = "[NO_TITLE]" ] && L1_2_OK=false
done
if [ "$L1_2_OK" = true ]; then verdict "L1.2" "PASS"; else verdict "L1.2" "FAIL"; fi

# L1.3 — [#3] HTML regex noise: strip inner tags
check "L1.3 — H1"
L1_3_OK=true
for URL in "${PAGES[@]}"; do
  log "=== ${URL} ==="
  H1=$(curl -s --compressed "${BASE}/pieces/${URL}.html" | \
    perl -0777 -ne '
      if (/<h1[^>]*>(.*?)<\/h1>/si) {
        my $t=$1;
        $t =~ s/<[^>]+>//g;
        $t =~ s/\s+/ /g;
        $t =~ s/^\s+|\s+$//g;
        print "$t\n";
      } else { print "[NO_H1]\n"; }
    ' 2>/dev/null)
  log "  h1: ${H1:-[EMPTY]}"
  [ -z "$H1" ] || [ "$H1" = "[NO_H1]" ] && L1_3_OK=false
done
if [ "$L1_3_OK" = true ]; then verdict "L1.3" "PASS"; else verdict "L1.3" "FAIL"; fi

# L1.4
check "L1.4 — Canonical"
L1_4_OK=true
for URL in "${PAGES[@]}"; do
  log "=== ${URL} ==="
  CANON=$(curl -s --compressed "${BASE}/pieces/${URL}.html" | \
    perl -ne 'print "$1\n" if /rel="canonical"[^>]*href="([^"]+)"/i || /href="([^"]+)"[^>]*rel="canonical"/i' 2>/dev/null | head -1)
  log "  canonical: ${CANON:-[MISSING]}"
  [ -z "$CANON" ] && L1_4_OK=false
done
if [ "$L1_4_OK" = true ]; then verdict "L1.4" "PASS"; else verdict "L1.4" "FAIL"; fi

# L1.5
check "L1.5 — Zero erreur RAG dans le HTML"
L1_5_OK=true
for URL in "${PAGES[@]}"; do
  COUNT=$(curl -s --compressed "${BASE}/pieces/${URL}.html" | \
    grep -ci "rag error\|missing content\|content unavailable\|Internal Server Error" 2>/dev/null) || COUNT=0
  log "${URL}: rag_errors=${COUNT}"
  [ "${COUNT:-0}" -gt 0 ] && L1_5_OK=false
done
if [ "$L1_5_OK" = true ]; then verdict "L1.5" "PASS"; else verdict "L1.5" "FAIL"; fi

# L1.6
check "L1.6 — Conclusion DB-first"
log "demarreur (pg_id=2) n'a aucun fichier RAG. Si HTTP 200 + H1 + title + canonical OK"
log "=> preuve structurelle que ces champs proviennent de __seo_gamme_car (DB), pas du RAG."
verdict "L1.6" "Derive de L1.1-L1.5 (voir verdicts ci-dessus)"

# ============================================================
section "PM.1 — PROTECTION META (BEFORE)"
# ============================================================

sql_step "PM.1 — Snapshot BEFORE refresh" \
"SELECT
  sgc_pg_id as pg_id,
  md5(coalesce(sgc_h1,'') || '|' || coalesce(sgc_title,'') || '|' || coalesce(sgc_descrip,'')) as protected_hash,
  left(sgc_h1, 60) as h1_preview,
  left(sgc_title, 60) as title_preview,
  left(sgc_descrip, 60) as descrip_preview
FROM __seo_gamme_car
WHERE sgc_pg_id IN ('402', '82', '7')
ORDER BY sgc_pg_id::int;"

log ">>> NOTER LES 3 HASH BEFORE ICI <<<"
log "| pg_id | protected_hash (BEFORE)          |"
log "|-------|----------------------------------|"
log "| 7     | ________________________________ |"
log "| 82    | ________________________________ |"
log "| 402   | ________________________________ |"

# ============================================================
section "L3.0 — DISTRIBUTION INITIALE"
# ============================================================

sql_step "L3.0a — Distribution" \
"SELECT status, count(*) as cnt
FROM __rag_content_refresh_log
GROUP BY status
ORDER BY cnt DESC;"

sql_step "L3.0b — Faux positifs" \
"SELECT count(*) as faux_positifs_restants
FROM __rag_content_refresh_log
WHERE status = 'failed'
  AND quality_flags::text LIKE '%NO_RAG_DATA_AVAILABLE%';"

# ============================================================
section "L3.A — SANS RAG (${SLUG_NO_RAG})"
# ============================================================

check "Pre-check: fichier RAG absent?"
if [ -f "/opt/automecanik/rag/knowledge/gammes/${SLUG_NO_RAG}.md" ]; then
  log "WARNING: ${SLUG_NO_RAG}.md EXISTS — ce test suppose NO_RAG"
  verdict "L3.A pre-check" "WARN (fichier present — test compromis)"
else
  log "OK: ${SLUG_NO_RAG}.md absent (NO_RAG)"
  verdict "L3.A pre-check" "PASS"
fi

if [ "$AUTO_MODE" = true ]; then
  check "Trigger ${SLUG_NO_RAG}"
  TRIGGER_RAW=$(api_post "${BASE}/api/admin/content-refresh/trigger" "{\"pgAlias\": \"${SLUG_NO_RAG}\"}")
  if [ "$HAS_JQ" = true ]; then
    echo "$TRIGGER_RAW" | jq '.' 2>/dev/null | tee -a "$OUT"
  else
    echo "$TRIGGER_RAW" | tee -a "$OUT"
  fi

  # [#5] Polling
  check "Polling ${SLUG_NO_RAG} (5s / ${POLL_TIMEOUT}s timeout)"
  POLL_RESULT=0
  poll_until_done "${SLUG_NO_RAG}" || POLL_RESULT=1

  check "Resultat ${SLUG_NO_RAG}"
  show_status "${SLUG_NO_RAG}"

  # [#6] Partial entry tolerance: evaluate only finished entries
  if [ "$HAS_JQ" = true ]; then
    RAW=$(api_get "${BASE}/api/admin/content-refresh/status?pg_alias=${SLUG_NO_RAG}&limit=20")
    FINISHED_FAILED=$(echo "$RAW" | jq '[(.data // [])[] | select(.status == "failed")] | length' 2>/dev/null)
    FINISHED_FAILED=${FINISHED_FAILED:-0}
    FINISHED_SKIPPED=$(echo "$RAW" | jq '[(.data // [])[] | select(.status == "skipped")] | length' 2>/dev/null)
    FINISHED_SKIPPED=${FINISHED_SKIPPED:-0}
    STILL_PENDING=$(echo "$RAW" | jq '[(.data // [])[] | select(.status == "pending" or .status == "processing")] | length' 2>/dev/null)
    STILL_PENDING=${STILL_PENDING:-0}
    HAS_NO_RAG_FAIL=$(echo "$RAW" | jq '[(.data // [])[] | select(.status == "failed") | select(.quality_flags | tostring | test("NO_RAG_DATA_AVAILABLE"))] | length' 2>/dev/null)
    HAS_NO_RAG_FAIL=${HAS_NO_RAG_FAIL:-0}

    log ""
    log "Analysis: skipped=${FINISHED_SKIPPED} failed=${FINISHED_FAILED} pending=${STILL_PENDING} no_rag_fail=${HAS_NO_RAG_FAIL}"

    if [ "$HAS_NO_RAG_FAIL" -gt 0 ]; then
      verdict "L3.A" "FAIL — failed+NO_RAG_DATA_AVAILABLE detected (ragSkipped fix NOT active)"
    elif [ "$FINISHED_FAILED" -gt 0 ]; then
      verdict "L3.A" "FAIL — unexpected failed entries"
    elif [ "$STILL_PENDING" -gt 0 ]; then
      verdict "L3.A" "WARN — ${STILL_PENDING} entries still pending (finished ones are OK)"
    else
      verdict "L3.A" "PASS"
    fi
  else
    log "[no jq — manual inspection required]"
    verdict "L3.A" "MANUAL CHECK REQUIRED"
  fi

else
  # Manual mode
  log "[MODE MANUEL] Commandes a executer :"
  log ""
  log "# 1) Trigger"
  log "curl -s -X POST ${BASE}/api/admin/content-refresh/trigger \\"
  log "  -H 'Content-Type: application/json' \\"
  log "  -d '{\"pgAlias\": \"${SLUG_NO_RAG}\"}' | jq '.'"
  log ""
  log "# 2) Polling (copier-coller le bloc)"
  log "ALIAS=\"${SLUG_NO_RAG}\"; TIMEOUT=${POLL_TIMEOUT}; INTERVAL=${POLL_INTERVAL}; ELAPSED=0"
  log "while [ \$ELAPSED -lt \$TIMEOUT ]; do"
  log "  RAW=\$(curl -s \"${BASE}/api/admin/content-refresh/status?pg_alias=\${ALIAS}&limit=20\")"
  log "  TOTAL=\$(echo \"\$RAW\" | jq '.data | length')"
  log "  PENDING=\$(echo \"\$RAW\" | jq '[.data[] | select(.status == \"pending\" or .status == \"processing\")] | length')"
  log "  echo \"[\${ELAPSED}s] total=\${TOTAL} pending=\${PENDING}\""
  log "  [ \"\$TOTAL\" -gt 0 ] && [ \"\$PENDING\" -eq 0 ] && echo \"ALL DONE\" && break"
  log "  sleep \$INTERVAL; ELAPSED=\$((ELAPSED + INTERVAL))"
  log "done"
  log ""
  log "# 3) Resultat"
  log "curl -s \"${BASE}/api/admin/content-refresh/status?pg_alias=${SLUG_NO_RAG}&limit=20\" | \\"
  log "  jq '.data[] | {id, page_type, status, quality_score: (.quality_score // \"null\"), quality_flags}'"
  log ""
  log "PASS: toutes entries terminees = skipped, quality_score = null, 0 failed"
  log "FAIL: au moins 1 failed avec NO_RAG_DATA_AVAILABLE"
fi

# ============================================================
section "L3.A2 — SANS RAG #2 (${SLUG_NO_RAG_2})"
# ============================================================

check "Pre-check: fichier RAG absent?"
if [ -f "/opt/automecanik/rag/knowledge/gammes/${SLUG_NO_RAG_2}.md" ]; then
  log "WARNING: ${SLUG_NO_RAG_2}.md EXISTS — ce test suppose NO_RAG"
  verdict "L3.A2 pre-check" "WARN (fichier present — test compromis)"
else
  log "OK: ${SLUG_NO_RAG_2}.md absent (NO_RAG)"
  verdict "L3.A2 pre-check" "PASS"
fi

if [ "$AUTO_MODE" = true ]; then
  check "Trigger ${SLUG_NO_RAG_2}"
  TRIGGER_RAW=$(api_post "${BASE}/api/admin/content-refresh/trigger" "{\"pgAlias\": \"${SLUG_NO_RAG_2}\"}")
  if [ "$HAS_JQ" = true ]; then
    echo "$TRIGGER_RAW" | jq '.' 2>/dev/null | tee -a "$OUT"
  else
    echo "$TRIGGER_RAW" | tee -a "$OUT"
  fi

  check "Polling ${SLUG_NO_RAG_2} (5s / ${POLL_TIMEOUT}s timeout)"
  POLL_RESULT=0
  poll_until_done "${SLUG_NO_RAG_2}" || POLL_RESULT=1

  check "Resultat ${SLUG_NO_RAG_2}"
  show_status "${SLUG_NO_RAG_2}"

  if [ "$HAS_JQ" = true ]; then
    RAW=$(api_get "${BASE}/api/admin/content-refresh/status?pg_alias=${SLUG_NO_RAG_2}&limit=20")
    FINISHED_FAILED=$(echo "$RAW" | jq '[(.data // [])[] | select(.status == "failed")] | length' 2>/dev/null)
    FINISHED_FAILED=${FINISHED_FAILED:-0}
    STILL_PENDING=$(echo "$RAW" | jq '[(.data // [])[] | select(.status == "pending" or .status == "processing")] | length' 2>/dev/null)
    STILL_PENDING=${STILL_PENDING:-0}
    HAS_NO_RAG_FAIL=$(echo "$RAW" | jq '[(.data // [])[] | select(.status == "failed") | select(.quality_flags | tostring | test("NO_RAG_DATA_AVAILABLE"))] | length' 2>/dev/null)
    HAS_NO_RAG_FAIL=${HAS_NO_RAG_FAIL:-0}

    log ""
    log "Analysis: failed=${FINISHED_FAILED} pending=${STILL_PENDING} no_rag_fail=${HAS_NO_RAG_FAIL}"

    if [ "$HAS_NO_RAG_FAIL" -gt 0 ]; then
      verdict "L3.A2" "FAIL — failed+NO_RAG_DATA_AVAILABLE detected"
    elif [ "$FINISHED_FAILED" -gt 0 ]; then
      verdict "L3.A2" "FAIL — unexpected failed entries"
    elif [ "$STILL_PENDING" -gt 0 ]; then
      verdict "L3.A2" "WARN — ${STILL_PENDING} entries still pending"
    else
      verdict "L3.A2" "PASS"
    fi
  else
    log "[no jq — manual inspection required]"
    verdict "L3.A2" "MANUAL CHECK REQUIRED"
  fi
else
  log "[MODE MANUEL] Meme procedure que L3.A avec slug: ${SLUG_NO_RAG_2}"
fi

# ============================================================
section "L3.B — AVEC RAG (${SLUG_WITH_RAG})"
# ============================================================

check "Pre-check: fichier RAG present?"
if [ -f "/opt/automecanik/rag/knowledge/gammes/${SLUG_WITH_RAG}.md" ]; then
  log "OK: ${SLUG_WITH_RAG}.md present (HAS_RAG)"
  verdict "L3.B pre-check" "PASS"
else
  log "WARNING: ${SLUG_WITH_RAG}.md ABSENT — ce test suppose HAS_RAG"
  verdict "L3.B pre-check" "WARN (fichier absent — test compromis)"
fi

if [ "$AUTO_MODE" = true ]; then
  check "Trigger ${SLUG_WITH_RAG}"
  TRIGGER_RAW=$(api_post "${BASE}/api/admin/content-refresh/trigger" "{\"pgAlias\": \"${SLUG_WITH_RAG}\"}")
  if [ "$HAS_JQ" = true ]; then
    echo "$TRIGGER_RAW" | jq '.' 2>/dev/null | tee -a "$OUT"
  else
    echo "$TRIGGER_RAW" | tee -a "$OUT"
  fi

  # [#5] Polling
  check "Polling ${SLUG_WITH_RAG} (5s / ${POLL_TIMEOUT}s timeout)"
  POLL_RESULT=0
  poll_until_done "${SLUG_WITH_RAG}" || POLL_RESULT=1

  check "Resultat ${SLUG_WITH_RAG}"
  show_status "${SLUG_WITH_RAG}"

  # [#6] Partial entry tolerance
  if [ "$HAS_JQ" = true ]; then
    RAW=$(api_get "${BASE}/api/admin/content-refresh/status?pg_alias=${SLUG_WITH_RAG}&limit=20")
    FINISHED_DRAFT=$(echo "$RAW" | jq '[(.data // [])[] | select(.status == "draft")] | length' 2>/dev/null)
    FINISHED_DRAFT=${FINISHED_DRAFT:-0}
    FINISHED_FAILED=$(echo "$RAW" | jq '[(.data // [])[] | select(.status == "failed")] | length' 2>/dev/null)
    FINISHED_FAILED=${FINISHED_FAILED:-0}
    STILL_PENDING=$(echo "$RAW" | jq '[(.data // [])[] | select(.status == "pending" or .status == "processing")] | length' 2>/dev/null)
    STILL_PENDING=${STILL_PENDING:-0}
    HAS_NO_RAG_FAIL=$(echo "$RAW" | jq '[(.data // [])[] | select(.status == "failed") | select(.quality_flags | tostring | test("NO_RAG_DATA_AVAILABLE"))] | length' 2>/dev/null)
    HAS_NO_RAG_FAIL=${HAS_NO_RAG_FAIL:-0}
    MAX_SCORE=$(echo "$RAW" | jq '[(.data // [])[] | select(.status == "draft") | (.quality_score // 0)] | max // 0' 2>/dev/null)
    MAX_SCORE=${MAX_SCORE:-0}

    log ""
    log "Analysis: draft=${FINISHED_DRAFT}(max_score=${MAX_SCORE}) failed=${FINISHED_FAILED} pending=${STILL_PENDING} no_rag_fail=${HAS_NO_RAG_FAIL}"

    if [ "$HAS_NO_RAG_FAIL" -gt 0 ]; then
      verdict "L3.B" "FAIL — failed+NO_RAG_DATA_AVAILABLE detected"
    elif [ "$FINISHED_DRAFT" -eq 0 ]; then
      if [ "$STILL_PENDING" -gt 0 ]; then
        verdict "L3.B" "WARN — 0 draft yet, ${STILL_PENDING} still pending"
      else
        verdict "L3.B" "FAIL — 0 draft among finished entries"
      fi
    elif [ "$MAX_SCORE" -lt 70 ]; then
      verdict "L3.B" "FAIL — max draft score ${MAX_SCORE} < 70"
    elif [ "$STILL_PENDING" -gt 0 ]; then
      verdict "L3.B" "WARN — ${FINISHED_DRAFT} draft OK but ${STILL_PENDING} entries still pending"
    else
      verdict "L3.B" "PASS (${FINISHED_DRAFT} draft, max_score=${MAX_SCORE})"
    fi
  else
    log "[no jq — manual inspection required]"
    verdict "L3.B" "MANUAL CHECK REQUIRED"
  fi

else
  # Manual mode
  log "[MODE MANUEL] Commandes a executer :"
  log ""
  log "# 1) Trigger"
  log "curl -s -X POST ${BASE}/api/admin/content-refresh/trigger \\"
  log "  -H 'Content-Type: application/json' \\"
  log "  -d '{\"pgAlias\": \"${SLUG_WITH_RAG}\"}' | jq '.'"
  log ""
  log "# 2) Polling (copier-coller le bloc)"
  log "ALIAS=\"${SLUG_WITH_RAG}\"; TIMEOUT=${POLL_TIMEOUT}; INTERVAL=${POLL_INTERVAL}; ELAPSED=0"
  log "while [ \$ELAPSED -lt \$TIMEOUT ]; do"
  log "  RAW=\$(curl -s \"${BASE}/api/admin/content-refresh/status?pg_alias=\${ALIAS}&limit=20\")"
  log "  TOTAL=\$(echo \"\$RAW\" | jq '.data | length')"
  log "  PENDING=\$(echo \"\$RAW\" | jq '[.data[] | select(.status == \"pending\" or .status == \"processing\")] | length')"
  log "  echo \"[\${ELAPSED}s] total=\${TOTAL} pending=\${PENDING}\""
  log "  [ \"\$TOTAL\" -gt 0 ] && [ \"\$PENDING\" -eq 0 ] && echo \"ALL DONE\" && break"
  log "  sleep \$INTERVAL; ELAPSED=\$((ELAPSED + INTERVAL))"
  log "done"
  log ""
  log "# 3) Resultat"
  log "curl -s \"${BASE}/api/admin/content-refresh/status?pg_alias=${SLUG_WITH_RAG}&limit=20\" | \\"
  log "  jq '.data[] | {id, page_type, status, quality_score: (.quality_score // \"null\"), quality_flags}'"
  log ""
  log "PASS: >=1 draft avec score>=70, 0 failed+NO_RAG"
  log "FAIL: 0 draft OU failed+NO_RAG_DATA_AVAILABLE"
fi

# ============================================================
section "PM.2 — PROTECTION META (AFTER)"
# ============================================================

sql_step "PM.2 — Snapshot AFTER refresh (meme requete que PM.1)" \
"SELECT
  sgc_pg_id as pg_id,
  md5(coalesce(sgc_h1,'') || '|' || coalesce(sgc_title,'') || '|' || coalesce(sgc_descrip,'')) as protected_hash,
  left(sgc_h1, 60) as h1_preview,
  left(sgc_title, 60) as title_preview,
  left(sgc_descrip, 60) as descrip_preview
FROM __seo_gamme_car
WHERE sgc_pg_id IN ('402', '82', '7')
ORDER BY sgc_pg_id::int;"

log ""
log ">>> COMPARER LES 3 HASH AVEC PM.1 <<<"
log ""
log "| pg_id | hash BEFORE | hash AFTER | Match? |"
log "|-------|-------------|------------|--------|"
log "| 7     |             |            | ☐ oui  |"
log "| 82    |             |            | ☐ oui  |"
log "| 402   |             |            | ☐ oui  |"
log ""
log "PASS: 3/3 identiques"
log "MISMATCH = NO-GO IMMEDIAT => Executer ESCALATION PM (voir ci-dessous)"

# [#4] PM mismatch escalation
log ""
log "=== ESCALATION PM MISMATCH (si hash !=) ==="
log ""
log "Etape 1 — Diff champs:"
log "  SELECT sgc_pg_id, sgc_h1, sgc_title, sgc_descrip, sgc_updated_at"
log "  FROM __seo_gamme_car WHERE sgc_pg_id = '<PG_ID>';"
log ""
log "Etape 2 — Verifier updated_at: doit etre AVANT le trigger L3.B"
log ""
log "Etape 3 — Grep logs:"
log "  docker logs \$(docker ps -q -f name=nestjs-remix) --since 30m 2>&1 | \\"
log "    grep -i '__seo_gamme_car\|sgc_h1\|sgc_title\|sgc_descrip' | tail -20"
log ""
log "Etape 4 — Derniers writes overlay:"
log "  SELECT 'purchase_guide', sgpg_pg_id, sgpg_updated_at"
log "  FROM __seo_gamme_purchase_guide WHERE sgpg_pg_id IN ('402','82','7')"
log "  UNION ALL"
log "  SELECT 'conseil', sgc_pg_id, max(sgc_updated_at)"
log "  FROM __seo_gamme_conseil WHERE sgc_pg_id IN ('402','82','7')"
log "  GROUP BY sgc_pg_id ORDER BY 3 DESC;"
log ""
log "Etape 5 — Stop pipeline + incident:"
log "  docker exec ${REDIS_CONTAINER} redis-cli DEL 'bull:seo-monitor:wait'"
log "  Documenter: pg_id, champ modifie, hash before/after, timestamp"
log "  Rollback champ depuis PM.1 si possible"
log ""
log ">>> NO-GO DEFINITIF — ne PAS continuer le runbook <<<"

# ============================================================
section "L3.C — VRAIS FAILS"
# ============================================================

sql_step "L3.C — Vrais fails coherents" \
"SELECT id, pg_alias, page_type, status, quality_score, quality_flags, error_message
FROM __rag_content_refresh_log
WHERE status = 'failed'
  AND NOT (quality_flags::text LIKE '%NO_RAG_DATA_AVAILABLE%')
ORDER BY created_at DESC
LIMIT 5;"

log "PASS: quality_score < 70, flags = vrais flags qualite, error_message non-vide"
log "      Zero flag NO_RAG_DATA_AVAILABLE dans ce lot"

# ============================================================
section "L3.D — BullMQ POST-REFRESH"
# ============================================================

# [#7] active=0 timing: wait 10s post-polling
check "L3.D — BullMQ post-refresh (10s post-polling wait)"
if [ "$AUTO_MODE" = true ]; then
  log "Waiting 10s post-polling..."
  sleep 10
fi

BQ_WAIT_POST=$(redis_cmd LLEN "bull:seo-monitor:wait" 2>/dev/null || echo "0")
BQ_ACTIVE_POST=$(redis_cmd LLEN "bull:seo-monitor:active" 2>/dev/null || echo "0")
BQ_COMPLETED_POST=$(redis_cmd ZCARD "bull:seo-monitor:completed" 2>/dev/null || echo "0")
BQ_FAILED_POST=$(redis_cmd ZCARD "bull:seo-monitor:failed" 2>/dev/null || echo "0")
log "wait:${BQ_WAIT_POST}  active:${BQ_ACTIVE_POST}  completed:${BQ_COMPLETED_POST}  failed:${BQ_FAILED_POST}"
log "completed_baseline was: ${COMPLETED_BASELINE}"
log "completed_delta: $((BQ_COMPLETED_POST - COMPLETED_BASELINE))"

# [#1] failed <= 2, [#7] active <= 1
if [ "${BQ_WAIT_POST:-0}" -eq 0 ] && [ "${BQ_ACTIVE_POST:-0}" -le 1 ] && [ "${BQ_FAILED_POST:-0}" -le 2 ]; then
  if [ "${BQ_COMPLETED_POST:-0}" -gt "${COMPLETED_BASELINE:-0}" ]; then
    verdict "L3.D" "PASS (completed grew by $((BQ_COMPLETED_POST - COMPLETED_BASELINE)), failed=${BQ_FAILED_POST})"
  elif [ "$AUTO_MODE" = false ]; then
    verdict "L3.D" "PASS (manual mode — completed delta check skipped)"
  else
    verdict "L3.D" "WARN (completed did not increase: ${COMPLETED_BASELINE} -> ${BQ_COMPLETED_POST})"
  fi
else
  verdict "L3.D" "FAIL (wait=${BQ_WAIT_POST} active=${BQ_ACTIVE_POST} failed=${BQ_FAILED_POST})"
fi

# ============================================================
section "L3.E — DISTRIBUTION FINALE"
# ============================================================

sql_step "L3.E-a — Distribution finale" \
"SELECT status, count(*) as cnt
FROM __rag_content_refresh_log
GROUP BY status
ORDER BY cnt DESC;"

sql_step "L3.E-b — Faux positifs restants" \
"SELECT count(*) as faux_positifs_restants
FROM __rag_content_refresh_log
WHERE status = 'failed'
  AND quality_flags::text LIKE '%NO_RAG_DATA_AVAILABLE%';"

log "PASS: skipped > 0 ET faux_positifs_restants = 0"

# ============================================================
section "TABLEAU RECAPITULATIF"
# ============================================================

log ""
log "| #    | Check                      | Critere                    | Verdict          |"
log "|------|----------------------------|----------------------------|------------------|"
log "| L0.1 | API health                 | status=ok, uptime>0        | _____________    |"
log "| L0.2 | DB gammes (MCP)            | count > 4000               | _____________    |"
log "| L0.3 | Redis ping                 | PONG                       | _____________    |"
log "| L0.4 | BullMQ baseline            | completed>0, failed<=2     | _____________    |"
log "| L0.5 | RAG health                 | reponse recue (up ou down) | _____________    |"
log "| L1.1 | HTTP 200 x3               | 200 x3                     | _____________    |"
log "| L1.2 | Title x3                   | non-vide + nom gamme       | _____________    |"
log "| L1.3 | H1 x3                      | non-vide + nom gamme       | _____________    |"
log "| L1.4 | Canonical x3               | URL valide x3              | _____________    |"
log "| L1.5 | 0 erreurs RAG              | 0 x3                       | _____________    |"
log "| L1.6 | DB-first prouve            | demarreur OK sans RAG      | _____________    |"
log "| PM.1 | Hash BEFORE (MCP)          | 3 hash notes               | _____________    |"
log "| L3.0 | Distrib + faux pos (MCP)   | faux_positifs=0            | _____________    |"
log "| L3.A | Sans RAG -> skipped        | skipped, null, 0 failed    | _____________    |"
log "| L3.A2| Sans RAG #2 -> skipped     | skipped, null, 0 failed    | _____________    |"
log "| L3.B | Avec RAG -> draft >=70     | >=1 draft, 0 NO_RAG fail  | _____________    |"
log "| PM.2 | Hash AFTER==BEFORE (MCP)   | 3/3 identiques             | _____________    |"
log "| L3.C | Vrais fails (MCP)          | score<70, flags reels      | _____________    |"
log "| L3.D | BullMQ post-refresh        | wait=0,active<=1,failed<=2 | _____________    |"
log "| L3.E | Distrib finale (MCP)       | skipped>0, faux=0          | _____________    |"

# ============================================================
section "VERDICT"
# ============================================================

log ""
log "Regles:"
log "  NO-GO immediat : PM.2 hash != PM.1 (au moins 1 pg_id)"
log "  NO-GO           : L3.A produit >= 1 failed"
log "  NO-GO           : faux_positifs_restants > 0 en L3.E"
log "  GO CONDITIONNEL : timeout polling + entries pending"
log "  GO CONDITIONNEL : BullMQ failed passe de <=2 a >2"
log "  GO CONDITIONNEL : active=1 en L3.D"
log "  GO              : tous les checks PASS"
log ""
log "VERDICT FINAL: ________________"
log ""

# ============================================================
section "FIN"
# ============================================================

log ""
log "Output complet: ${OUT}"
log "Steps SQL a executer via MCP Supabase: L0.2, PM.1, PM.2, L3.0, L3.C, L3.E"
log ""
log "--- FIN DU RUNBOOK ---"
