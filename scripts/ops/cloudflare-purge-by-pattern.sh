#!/usr/bin/env bash
#
# cloudflare-purge-by-pattern — safe-by-default Cloudflare cache purge + warmup.
#
# Phase B du plan PR-1 GSC 5xx recovery. Lit la liste d'URLs depuis
# audit-reports/seo-smoke/<DATE>/gsc-5xx-evidence-full.json (top 5xx) ou
# accepte --urls-file=<path> (un URL par ligne).
#
# Garde-fous (best-in-class, pas de bricolage) :
#   - dry-run par défaut, --apply requis
#   - --max-urls=N obligatoire en --apply
#   - --hostname-wide interdit sauf --i-understand-impact (incident commander only)
#   - batch 30 URLs/min (CF API limit), pause 60s entre batches
#   - pré-flight check __error_logs (abort si 5xx > seuil)
#   - warmup post-purge avec UA identifiable AutoMecanikCacheWarmer/1.0
#   - audit-trail JSON signé par run (uuid)
#
# Usage:
#   bash scripts/ops/cloudflare-purge-by-pattern.sh --urls-file=/tmp/urls.txt
#   bash scripts/ops/cloudflare-purge-by-pattern.sh --urls-file=/tmp/urls.txt --apply --max-urls=500
#   bash scripts/ops/cloudflare-purge-by-pattern.sh --pattern=pieces --apply --max-urls=300
#
# Env required (in --apply mode):
#   CLOUDFLARE_API_TOKEN    Cloudflare API token with Zone.Cache Purge
#   CLOUDFLARE_ZONE_ID      Zone ID for automecanik.com
#
# Optional:
#   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY  for pre-flight __error_logs check
#   PROD_BASE                                  default https://www.automecanik.com
#   WARMUP_SKIP                                set to 1 to disable post-purge warmup

set -euo pipefail

PROD_BASE="${PROD_BASE:-https://www.automecanik.com}"
UA_WARMER="AutoMecanikCacheWarmer/1.0 (+https://www.automecanik.com/bots/cache-warmer)"

# ── Defaults ─────────────────────────────────────────────────────────────────

APPLY=0
HOSTNAME_WIDE=0
I_UNDERSTAND_IMPACT=0
MAX_URLS=""
URLS_FILE=""
PATTERN=""
PRE_FLIGHT_THRESHOLD="${PRE_FLIGHT_THRESHOLD:-100}"
BATCH_SIZE=30
BATCH_PAUSE_SEC=60

# ── Parse args ───────────────────────────────────────────────────────────────

show_help() {
  sed -n '2,40p' "$0"
  exit 0
}

for arg in "$@"; do
  case "$arg" in
    --help|-h) show_help ;;
    --apply) APPLY=1 ;;
    --hostname-wide) HOSTNAME_WIDE=1 ;;
    --i-understand-impact) I_UNDERSTAND_IMPACT=1 ;;
    --max-urls=*) MAX_URLS="${arg#*=}" ;;
    --urls-file=*) URLS_FILE="${arg#*=}" ;;
    --pattern=*) PATTERN="${arg#*=}" ;;
    --skip-warmup) export WARMUP_SKIP=1 ;;
    *) echo "❌ Unknown arg: $arg" >&2; exit 2 ;;
  esac
done

# ── Audit-trail setup ────────────────────────────────────────────────────────

AUDIT_DATE="$(date -u +%F)"
AUDIT_UUID="$(cat /proc/sys/kernel/random/uuid 2>/dev/null || python3 -c 'import uuid; print(uuid.uuid4())')"
AUDIT_DIR="audit-reports/cloudflare-purge/${AUDIT_DATE}"
mkdir -p "$AUDIT_DIR"
AUDIT_FILE="${AUDIT_DIR}/${AUDIT_UUID}.json"

log() { echo "[$(date -u +%H:%M:%S)] $*" >&2; }

# ── Validation ───────────────────────────────────────────────────────────────

# Block: --apply without --max-urls
if [[ "$APPLY" == "1" && -z "$MAX_URLS" ]]; then
  echo "❌ --apply requires --max-urls=N (anti-purge-too-large safety)" >&2
  echo "   Example: --max-urls=500" >&2
  exit 2
fi

# Block: --hostname-wide without --i-understand-impact
if [[ "$HOSTNAME_WIDE" == "1" && "$I_UNDERSTAND_IMPACT" != "1" ]]; then
  echo "❌ --hostname-wide is dangerous (stampede risk). Require --i-understand-impact." >&2
  echo "   This nukes the entire CDN cache for automecanik.com." >&2
  echo "   Read /home/deploy/.claude/projects/-opt-automecanik-app/memory/feedback_cf_purge_requires_warmup.md" >&2
  exit 2
fi

if [[ "$APPLY" == "1" ]]; then
  : "${CLOUDFLARE_API_TOKEN:?ENV CLOUDFLARE_API_TOKEN required in --apply mode}"
  : "${CLOUDFLARE_ZONE_ID:?ENV CLOUDFLARE_ZONE_ID required in --apply mode}"
fi

# ── Load URL list ────────────────────────────────────────────────────────────

URLS=()

if [[ "$HOSTNAME_WIDE" == "1" ]]; then
  URLS=()  # signal: nuclear mode
elif [[ -n "$URLS_FILE" ]]; then
  if [[ ! -f "$URLS_FILE" ]]; then
    echo "❌ URLS_FILE not found: $URLS_FILE" >&2
    exit 2
  fi
  mapfile -t URLS < <(grep -E '^https?://' "$URLS_FILE" | sort -u)
elif [[ -n "$PATTERN" ]]; then
  # Pull top-5xx URLs from latest evidence pack
  LATEST="$(ls -1dt audit-reports/seo-smoke/*/gsc-5xx-evidence-final.json 2>/dev/null | head -1 || true)"
  if [[ -z "$LATEST" ]]; then
    echo "❌ No evidence pack found (run scripts/seo/gsc-5xx-evidence-batch.ts first)" >&2
    exit 2
  fi
  log "📑 Using evidence pack: $LATEST"
  case "$PATTERN" in
    pieces) FILTER=".top_5xx[] | select(.pattern==\"pieces\") | .url" ;;
    constructeurs) FILTER=".top_5xx[] | select(.pattern==\"constructeurs\") | .url" ;;
    both) FILTER=".top_5xx[].url" ;;
    *) echo "❌ Unknown --pattern=$PATTERN (use pieces|constructeurs|both)" >&2; exit 2 ;;
  esac
  mapfile -t URLS < <(jq -r "$FILTER" "$LATEST" | sort -u)
else
  echo "❌ Must specify --urls-file=<path>, --pattern=<pieces|constructeurs|both>, or --hostname-wide" >&2
  exit 2
fi

# ── Apply --max-urls cap ────────────────────────────────────────────────────

ORIG_COUNT="${#URLS[@]}"
if [[ -n "$MAX_URLS" && "$ORIG_COUNT" -gt "$MAX_URLS" ]]; then
  URLS=("${URLS[@]:0:$MAX_URLS}")
  log "⚠ Capped URL list from $ORIG_COUNT to $MAX_URLS (--max-urls)"
fi

EFFECTIVE_COUNT="${#URLS[@]}"
log "📦 Loaded $EFFECTIVE_COUNT URLs (orig $ORIG_COUNT)"

# ── Pre-flight: check __error_logs is not under storm ────────────────────────

preflight_5xx_count() {
  if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
    log "  (pre-flight skipped: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing)"
    echo "-1"
    return
  fi
  local q='select=*&subject=like.LOADER_5%25&created_at=gte.'
  q+="$(date -u -d '15 minutes ago' +%Y-%m-%dT%H:%M:%S)"
  q+="&select=count"
  local count
  count="$(curl -sS \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Prefer: count=exact" \
    -H "Range-Unit: items" \
    -H "Range: 0-0" \
    -I \
    "${SUPABASE_URL}/rest/v1/__error_logs?${q}" \
    | grep -i '^content-range:' | sed -E 's|.*/([0-9]+).*|\1|' | tr -d '\r' )"
  echo "${count:-0}"
}

if [[ "$APPLY" == "1" ]]; then
  PRE_5XX="$(preflight_5xx_count)"
  if [[ "$PRE_5XX" != "-1" && "$PRE_5XX" -ge "$PRE_FLIGHT_THRESHOLD" ]]; then
    echo "❌ Pre-flight aborted: __error_logs shows $PRE_5XX 5xx events in last 15 min" >&2
    echo "   Threshold: $PRE_FLIGHT_THRESHOLD. Investigate before purging (don't worsen)." >&2
    exit 3
  fi
  log "✅ Pre-flight: __error_logs 5xx count (15min) = $PRE_5XX"
fi

# ── Purge action ─────────────────────────────────────────────────────────────

cf_api() {
  curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "$1"
}

PURGED_OK=0
PURGED_FAIL=0
PURGE_RESPONSES=()

if [[ "$HOSTNAME_WIDE" == "1" ]]; then
  log "💥 HOSTNAME_WIDE purge (nuclear)"
  if [[ "$APPLY" == "1" ]]; then
    BODY='{"hosts":["www.automecanik.com","automecanik.com"]}'
    RESP="$(cf_api "$BODY")"
    PURGE_RESPONSES+=("$RESP")
    if echo "$RESP" | jq -e '.success==true' > /dev/null; then
      PURGED_OK=1
      log "  ✅ hostname purged"
    else
      PURGED_FAIL=1
      log "  ❌ purge failed: $RESP"
    fi
  else
    log "  [dry-run] would POST hosts=[www.automecanik.com,automecanik.com]"
  fi
else
  # Batched purge_by_url
  TOTAL_BATCHES=$(( (EFFECTIVE_COUNT + BATCH_SIZE - 1) / BATCH_SIZE ))
  log "🔄 Will purge in $TOTAL_BATCHES batch(es) of up to $BATCH_SIZE URLs each (pause ${BATCH_PAUSE_SEC}s between)"
  for ((i=0; i<EFFECTIVE_COUNT; i+=BATCH_SIZE)); do
    BATCH=("${URLS[@]:$i:$BATCH_SIZE}")
    BATCH_NUM=$(( (i / BATCH_SIZE) + 1 ))
    log "  📦 Batch $BATCH_NUM/$TOTAL_BATCHES (${#BATCH[@]} URLs)"
    BODY="$(printf '%s\n' "${BATCH[@]}" | jq -R . | jq -s '{files: .}')"
    if [[ "$APPLY" == "1" ]]; then
      RESP="$(cf_api "$BODY")"
      PURGE_RESPONSES+=("$RESP")
      if echo "$RESP" | jq -e '.success==true' > /dev/null; then
        PURGED_OK=$((PURGED_OK + ${#BATCH[@]}))
        log "    ✅ batch ok"
      else
        PURGED_FAIL=$((PURGED_FAIL + ${#BATCH[@]}))
        log "    ❌ batch failed: $(echo "$RESP" | jq -c '.errors // .')"
      fi
    else
      log "    [dry-run] would POST ${#BATCH[@]} URLs (first: ${BATCH[0]})"
    fi
    if [[ $((i + BATCH_SIZE)) -lt $EFFECTIVE_COUNT ]]; then
      log "    💤 sleeping ${BATCH_PAUSE_SEC}s (CF rate-limit + origin warmup time)"
      [[ "$APPLY" == "1" ]] && sleep "$BATCH_PAUSE_SEC"
    fi
  done
fi

# ── Warmup post-purge ────────────────────────────────────────────────────────

WARMED=0
WARM_FAIL=0
if [[ "$APPLY" == "1" && "${WARMUP_SKIP:-0}" != "1" && "$HOSTNAME_WIDE" != "1" && "$EFFECTIVE_COUNT" -gt 0 ]]; then
  log "🔥 Warmup ${EFFECTIVE_COUNT} URLs with UA=$UA_WARMER"
  for u in "${URLS[@]}"; do
    CODE="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 -A "$UA_WARMER" "$u" || echo "000")"
    if [[ "$CODE" =~ ^(2|3) ]]; then
      WARMED=$((WARMED + 1))
    else
      WARM_FAIL=$((WARM_FAIL + 1))
    fi
  done
  log "✅ Warmup: $WARMED ok / $WARM_FAIL fail"
fi

# ── Audit-trail ──────────────────────────────────────────────────────────────

cat > "$AUDIT_FILE" <<EOF
{
  "uuid": "${AUDIT_UUID}",
  "timestamp_utc": "$(date -u +%FT%TZ)",
  "operator": "${USER:-unknown}@$(hostname)",
  "mode": "$([[ "$APPLY" == "1" ]] && echo "apply" || echo "dry-run")",
  "hostname_wide": ${HOSTNAME_WIDE},
  "i_understand_impact": ${I_UNDERSTAND_IMPACT},
  "max_urls": "${MAX_URLS:-null}",
  "url_source": "$([[ -n "$URLS_FILE" ]] && echo "file:$URLS_FILE" || echo "pattern:$PATTERN")",
  "urls_loaded": ${ORIG_COUNT},
  "urls_effective": ${EFFECTIVE_COUNT},
  "purged_ok": ${PURGED_OK},
  "purged_fail": ${PURGED_FAIL},
  "warmed_ok": ${WARMED},
  "warm_fail": ${WARM_FAIL},
  "preflight_5xx_15min": "${PRE_5XX:-n/a}",
  "preflight_threshold": ${PRE_FLIGHT_THRESHOLD},
  "batch_size": ${BATCH_SIZE},
  "batch_pause_sec": ${BATCH_PAUSE_SEC},
  "warmer_ua": "${UA_WARMER}",
  "git_sha": "$(git rev-parse HEAD 2>/dev/null || echo unknown)",
  "git_branch": "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
}
EOF

log "📝 Audit-trail: $AUDIT_FILE"

if [[ "$APPLY" == "1" && "$PURGED_FAIL" -gt 0 ]]; then
  exit 4
fi
