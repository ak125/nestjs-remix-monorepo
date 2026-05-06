#!/usr/bin/env bash
# Block any Remix route file that exports a zero-arg `HeadersFunction`
# whose body sets `Cache-Control: ... s-maxage=...`.
#
# Why: a zero-arg `headers` cannot inspect `loaderHeaders` / `errorHeaders`,
# so the success policy (with `s-maxage`) is applied to loader-thrown 4xx/5xx
# responses too. Cloudflare then caches the failure for `s-maxage` seconds.
# See `frontend/app/utils/cache-control.ts` for the canonical helper.
#
# Used by: .husky/pre-commit (changed files only) + CI lint job (full repo).
# ast-grep equivalent: .ast-grep/rules/frontend-no-zero-arg-headers-with-s-maxage.yml
# (severity warning until ast-grep version supports the combined `has`+regex
# matcher reliably).

set -euo pipefail

# Default scope: every Remix route. CI passes no args; pre-commit passes the
# subset of staged files to keep the check fast.
ROUTES_GLOB="frontend/app/routes"
if [ "$#" -gt 0 ]; then
  FILES=("$@")
else
  mapfile -t FILES < <(find "$ROUTES_GLOB" -type f \( -name '*.tsx' -o -name '*.ts' \))
fi

violations=0
violators=()

for f in "${FILES[@]}"; do
  [ -f "$f" ] || continue
  case "$f" in
    "$ROUTES_GLOB"/*) ;;
    *) continue ;;
  esac

  # awk state machine: capture the body of `export const headers: HeadersFunction = () => (`
  # up to the matching `})`, then check whether it contains `s-maxage`.
  bad=$(awk '
    BEGIN { in_block = 0; depth = 0; buf = "" }
    /^export const headers: HeadersFunction = \(\) => \(/ {
      in_block = 1
      depth = 1
      buf = $0
      next
    }
    in_block {
      buf = buf "\n" $0
      n = gsub(/\(/, "(", $0)
      m = gsub(/\)/, ")", $0)
      depth += n - m
      if (depth <= 0) {
        if (buf ~ /s-maxage/) {
          print buf
          exit 0
        }
        in_block = 0
        depth = 0
        buf = ""
      }
    }
  ' "$f")

  if [ -n "$bad" ]; then
    violations=$((violations + 1))
    violators+=("$f")
  fi
done

if [ "$violations" -gt 0 ]; then
  echo ""
  echo "ERROR: zero-arg HeadersFunction with \`s-maxage\` detected (${violations} file(s))."
  echo ""
  echo "A zero-arg \`headers\` cannot read errorHeaders/loaderHeaders, so the"
  echo "success Cache-Control is applied to loader-thrown 5xx → Cloudflare"
  echo "caches the failure for \`s-maxage\` seconds (24h on /pieces/* in"
  echo "INC-2026-005-recurrence: 27.8% of /pieces/* sample 5xx in cache HIT)."
  echo ""
  echo "Fix: use the canonical helper:"
  echo ""
  echo "    import { buildCacheHeaders } from \"~/utils/cache-control\";"
  echo "    export const headers = buildCacheHeaders("
  echo "      \"public, max-age=60, s-maxage=86400, stale-while-revalidate=3600\","
  echo "    );"
  echo ""
  echo "Files:"
  for v in "${violators[@]}"; do
    echo "  - $v"
  done
  echo ""
  echo "See frontend/app/utils/cache-control.ts + .test.ts for the contract."
  exit 1
fi

exit 0
