#!/usr/bin/env bash
# report-issue-publish.sh — one standing GitHub issue per report, updated in place.
#
# Sourced by .github/scripts/morning-health-digest.sh and weekly-pr-hygiene.sh
# (mandat AM, 2026-11-16). Same publication pattern as scripts/ops/pilote-file.sh:
# the open issue with a FIXED title is the report, its body is replaced, and
# `gh issue create` runs only when it is missing. No label is created or required
# (creating a label is an owner act).
#
#   report_issue_publish <title> <body_file> <state_json> [assignee]
#   report_marker_extract <tag>          (stdin: body)  → JSON of a marker line, or {}
#   report_marker_set <issue> <tag> <json>              → rewrites that marker line only
#
# - <title>      exact title of the standing issue (open, authored by GitHub Actions).
# - <body_file>  new body (markdown). A one-line state marker is appended to it.
# - <state_json> {"<id>": {"c": "<couleur>", "l": "<libellé>"}, ...}
#                The previous marker is read from the current body. A short comment
#                is posted ONLY when an id present in both states changed colour,
#                so the owner is notified on change, not every morning.
#
# Requires gh (GH_TOKEN), jq and REPO=<owner/name>. Prints the issue number.

REPORT_STATE_TAG="report-state:v1"

report_issue_find() { # <title> → number of the open standing issue (lowest if several), or empty
  gh issue list --repo "$REPO" --state open --limit 500 --json number,title,author \
    | jq -r --arg t "$1" '[.[] | select(.title == $t)
        | select(.author.login == "app/github-actions" or .author.login == "github-actions[bot]" or .author.login == "github-actions")
        | .number] | min // empty'
}

report_marker_extract() { # <tag>; stdin: issue body → JSON object of the last <!-- <tag> {…} --> line, or {}
  local line
  line=$(grep -o "<!-- $1 .* -->" | tail -n1 || true)
  line=${line#"<!-- $1 "}
  line=${line%" -->"}
  if [ -n "$line" ] && printf '%s' "$line" | jq -e 'type == "object"' >/dev/null 2>&1; then
    printf '%s' "$line"
  else
    printf '{}'
  fi
}

report_state_extract() { report_marker_extract "$REPORT_STATE_TAG"; }

report_marker_line() { # <tag> <json> → one marker line; the JSON cannot close the comment early
  local json
  json=$(printf '%s' "$2" | jq -c .) || return 1
  printf '<!-- %s %s -->\n' "$1" "${json//-->/—>}"
}

report_marker_set() { # <issue> <tag> <json> — replace (or append) one marker line in the body, nothing else
  local body
  body=$(mktemp)
  gh issue view "$1" --repo "$REPO" --json body --jq '.body' | grep -v "^<!-- $2 " > "$body" || true
  report_marker_line "$2" "$3" >> "$body"
  gh issue edit "$1" --repo "$REPO" --body-file "$body" > /dev/null
  rm -f "$body"
}

report_state_changes() { # <prev_json> <cur_json> → one markdown line per colour change, empty if none
  jq -rn --argjson p "$1" --argjson c "$2" '
    $c | to_entries[]
    | select($p[.key] != null and $p[.key].c != .value.c)
    | "- \(.value.l) : \($p[.key].c) → **\(.value.c)**"'
}

report_issue_publish() {
  local title="$1" body_file="$2" state="$3" assignee="${4:-}"
  local number prev changes comment_file

  state=$(printf '%s' "$state" | jq -c 'if type == "object" then . else error("état non objet") end') \
    || { echo "report-issue-publish : état invalide" >&2; return 1; }
  # One line, and it must not close the HTML comment early.
  printf '\n' >> "$body_file"
  report_marker_line "$REPORT_STATE_TAG" "$state" >> "$body_file"

  number=$(report_issue_find "$title")
  if [ -z "$number" ]; then
    local args=(--repo "$REPO" --title "$title" --body-file "$body_file")
    [ -n "$assignee" ] && args+=(--assignee "$assignee")
    number=$(gh issue create "${args[@]}" | grep -o '[0-9]\+$')
    echo "$number"
    return 0
  fi

  prev=$(gh issue view "$number" --repo "$REPO" --json body --jq '.body' | report_state_extract)
  gh issue edit "$number" --repo "$REPO" --body-file "$body_file" > /dev/null

  changes=$(report_state_changes "$prev" "$state")
  if [ -n "$changes" ]; then
    comment_file=$(mktemp)
    {
      echo "Changement de couleur, lecture du $(date -u +'%F %H:%M') UTC :"
      echo ""
      echo "$changes"
      echo ""
      echo "Détail à jour dans le corps de l'issue."
    } > "$comment_file"
    gh issue comment "$number" --repo "$REPO" --body-file "$comment_file" > /dev/null
  fi
  echo "$number"
}
