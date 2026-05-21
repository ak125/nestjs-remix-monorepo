#!/usr/bin/env bash
# Block markdown drift that positions RAG as a content/SEO source.
#
# Why: canon ADR-031 (accepted 2026-04-28) + ADR-046 (2026-05-07) state that RAG
# is a *retrieval layer for the chatbot ONLY* — never a source of content or SEO
# data. SEO content consumes the wiki exports (`automecanik-wiki/exports/`), and
# never reads from or writes to the RAG. Legacy docs predating that decision kept
# describing RAG as a "gold mine to exploit for SEO" / an enrichment target; this
# guard prevents NEW docs from re-introducing that confusion mechanically.
#
# Mirrors scripts/lint/check-preprod-vocabulary.sh (same allowlist + bypass model).
# Used by: .husky/pre-commit (staged .md only) + CI lint job (full repo).
#
# Bypass: any line that references the canon (`ADR-031` / `ADR-046`) or is marked
# `RAG-ERRATUM` is considered reconciled and skipped (mirror of the ERRATUM bypass).

set -euo pipefail

# Scope: every committed .md file. CI passes no args; pre-commit passes staged.
if [ "$#" -gt 0 ]; then
  FILES=("$@")
else
  mapfile -t FILES < <(git ls-files -- '*.md')
fi

# Files allowed to USE the forbidden phrasings: dated docs PREDATING the canon
# that carry a reconciling banner (a doc cannot be faulted for a decision that
# did not yet exist), plus archives / logs / errata / this script itself.
ALLOWLIST_REGEX='^(PROCEDURE-SEO\.md|ENRICHMENT_SUMMARY\.md|\.spec/00-canon/brand-md-schema\.md|\.spec/ROADMAP-2026\.md|\.spec/AUDIT-SEO-2026-02\.md|\.spec/AUDIT-SEO-GLOBAL-2026-02\.md|\.spec/marketing-module/README\.md|.*/_archive/.*|CHANGELOG.*\.md|log\.md|.*\.errata\.md|.*-errata-.*\.md|scripts/lint/check-rag-scope-vocabulary\.sh)$'

# Case-sensitive: the RAG token is always uppercase, so "storage"/"garage" never
# match. Patterns stay within a single sentence ([^.]{0,N}) to avoid cross-line
# false positives. Each pattern is a clear "RAG as content/SEO source" phrasing.
declare -a PATTERNS=(
  'exploiter[^.]{0,40}RAG|RAG[^.]{0,25}(à|a) exploiter'
  'RAG[^.]{0,30}inexploit|inexploit[^.]{0,30}RAG'
  'enrichir (le|du|les) RAG|écrire[^.]{0,25}dans (le|les) RAG'
  'RAG[^.]{0,30}pour (enrichir|remplir)'
  '(enrichir|remplir)[^.]{0,40}(depuis|via|avec)[^.]{0,15}RAG'
  'RAG[^.]{0,30}source de (contenu|donn|vérit)'
  'mine d.or[^.]{0,30}RAG|RAG[^.]{0,30}mine d.or'
  'RAG[^.]{0,20}as a (content|SEO) source|exploit[^.]{0,25}RAG[^.]{0,20}(content|SEO)'
)
declare -a LABELS=(
  '"exploiter le RAG" (RAG is chatbot-retrieval only — SEO consumes wiki exports, not RAG)'
  '"RAG inexploité" (frames RAG as an untapped content/SEO resource — non-canonical per ADR-031/046)'
  '"enrichir le RAG" / "écrire dans le RAG" (RAG is never a write target for SEO content)'
  '"RAG pour enrichir/remplir" (SEO content does not draw from RAG — use wiki exports)'
  '"enrichir … depuis/via/avec RAG" (RAG is not a content source — ADR-031/046)'
  '"RAG source de contenu/données/vérité" (RAG = retrieval for the chatbot only)'
  '"mine d''or … RAG" (RAG is not an SEO content opportunity — non-canonical)'
  '"RAG as a content/SEO source" (RAG = chatbot retrieval only — ADR-031/046)'
)

violations=0

for f in "${FILES[@]}"; do
  [ -f "$f" ] || continue
  case "$f" in
    *.md) ;;
    *) continue ;;
  esac

  # Skip allowlisted (reconciled / historical / immutable) files
  if [[ "$f" =~ $ALLOWLIST_REGEX ]]; then
    continue
  fi

  for i in "${!PATTERNS[@]}"; do
    pattern="${PATTERNS[$i]}"
    label="${LABELS[$i]}"
    # grep -E (POSIX ERE), case-sensitive. Exit 0 = match = candidate violation.
    if matches=$(grep -nE "$pattern" "$f" 2>/dev/null); then
      # Lines that reference the canon (ADR-031/046) or carry RAG-ERRATUM are reconciled.
      filtered=$(echo "$matches" | grep -vE 'ADR-031|ADR-046|RAG-ERRATUM' || true)
      if [ -n "$filtered" ]; then
        echo ""
        echo "❌ RAG scope drift in $f"
        echo "   Pattern: $label"
        echo "$filtered" | sed 's|^|     |'
        violations=$((violations + 1))
      fi
    fi
  done
done

if [ "$violations" -gt 0 ]; then
  cat <<'EOF'

────────────────────────────────────────────────────────────────────────────
RAG scope drift detected.

Canon: ADR-031 (Four-Layer Content Architecture) + ADR-046 (R-stack canonique).
  RAG = retrieval layer for the chatbot ONLY — never a content/SEO source.
  SEO content consumes the wiki exports (automecanik-wiki/exports/);
  it never reads from, nor writes to, the RAG.

To reconcile a legitimate mention, reference the canon on the same line
(e.g. "… RAG … (legacy, voir ADR-031/046)") or prefix the line with
"RAG-ERRATUM". See scripts/lint/check-preprod-vocabulary.sh for the sibling guard.
────────────────────────────────────────────────────────────────────────────
EOF
  exit 1
fi

echo "✅ RAG scope vocabulary lint: $((${#FILES[@]})) file(s) checked, 0 violations."
