#!/usr/bin/env bash
# Mandat BB — répartition des circuits de fusion (lecture seule).
# Usage : circuits.sh <dossier-de-sortie>     (à lancer depuis la racine du dépôt)
# Classe par scripts/ci/merge-circuit.mjs les PR fusionnées depuis le 2026-11-13T12:00Z et les PR
# ouvertes hors brouillon, avec l'ownership de l'arbre courant. N'écrit que dans <dossier-de-sortie>.
set -euo pipefail
REPO="${REPO:-ak125/nestjs-remix-monorepo}"
OUT="${1:?usage : circuits.sh <dossier-de-sortie>}"
mkdir -p "$OUT"
date -u +%FT%TZ
gh pr list -R "$REPO" --state merged --limit 80 --json number,mergedAt \
  --jq '.[] | select(.mergedAt >= "2026-11-13T12:00:00Z") | .number' > "$OUT/merged-nums.txt"
gh pr list -R "$REPO" --state open --limit 100 --json number,isDraft \
  --jq '.[] | select(.isDraft | not) | .number' > "$OUT/ready-nums.txt"
: > "$OUT/circuits.jsonl"
for set in merged ready; do
  while read -r n; do
    GH_REPO="$REPO" node scripts/ci/merge-circuit.mjs --pr "$n" 2>/dev/null \
      | jq -c --arg set "$set" --argjson n "$n" '{set: $set, pr: $n, circuit, reasons}' >> "$OUT/circuits.jsonl" \
      || echo "{\"set\":\"$set\",\"pr\":$n,\"circuit\":\"ERREUR\",\"reasons\":[]}" >> "$OUT/circuits.jsonl"
  done < "$OUT/$set-nums.txt"
done
jq -rs '
  def top: [.reasons[] | select(.circuit == "eleve") | .code] | unique;
  (group_by(.set)[] | "\(.[0].set) : \(length) PR ; " + (group_by(.circuit) | map("\(.[0].circuit)=\(length)") | join(" "))),
  "--- motifs du circuit élevé, PR fusionnées",
  ([.[] | select(.set == "merged" and .circuit == "eleve") | top | join(",")] | group_by(.) | map("\(length)\t\(.[0])") | sort | reverse | .[]),
  "--- fichiers non classés des PR fusionnées, par dossier (deux niveaux) : fichiers / PR",
  ([.[] | select(.set == "merged") | . as $p | .reasons[] | select(.code == "UNCLASSIFIED") | {pr: $p.pr, dir: (.path | split("/") | .[0:2] | join("/"))}]
    | group_by(.dir) | map({dir: .[0].dir, f: length, p: (map(.pr) | unique | length)}) | sort_by(-.p, -.f) | .[] | "\(.f)\t\(.p)\t\(.dir)"),
  "--- PR en circuit élevé pour le seul motif « non classé » : fichiers",
  (.[] | select(.set == "merged" and .circuit == "eleve" and top == ["UNCLASSIFIED"]) | "#\(.pr)\t" + ([.reasons[] | select(.code == "UNCLASSIFIED") | .path] | join(" ")))
' "$OUT/circuits.jsonl"
