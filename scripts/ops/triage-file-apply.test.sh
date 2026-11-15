#!/usr/bin/env bash
# Test de triage-file-apply.sh sur FIXTURES (jamais le dépôt réel) : sélection forte + garder du
# seul tableau des issues, refus d'une ligne mal formée, mode à blanc sans appel gh, et --apply
# limité à `gh issue edit --add-label` (issue fermée ou déjà classée ignorée).
# `gh` est remplacé par un faux : toute commande autre que `issue view` / `issue edit --add-label`
# fait échouer le test.
set -uo pipefail

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$ICI/triage-file-apply.sh"
FIX="$(mktemp -d "${TMPDIR:-/tmp}/triage-file-test.XXXXXX")"
trap 'rm -rf "$FIX"' EXIT
FAIL=0
check() { if [[ "$2" == "$3" ]]; then echo "  ok    — $1 ($3)"; else echo "  ÉCHEC — $1 : attendu « $2 », obtenu « $3 »"; FAIL=1; fi; }

mkdir -p "$FIX/bin"
cat > "$FIX/bin/gh" <<'SH'
#!/usr/bin/env bash
echo "$*" >> "$FAKE_APPELS"
if [[ "$1 $2" == "issue view" ]]; then
  ligne="$(grep -P "^$3\t" "$FAKE_ETATS")" || exit 1
  cut -f2- <<< "$ligne"; exit 0
fi
if [[ "$1 $2" == "issue edit" && "$4 $5" == "--repo exemple/depot" && "$6" == "--add-label" && $# -eq 7 ]]; then
  [[ "$3" == "${FAKE_EDIT_ECHEC:-}" ]] && exit 1
  exit 0
fi
echo "faux gh : commande interdite dans le test : $*" >&2; echo "$*" >> "$FAKE_INTERDITS"; exit 99
SH
chmod +x "$FIX/bin/gh"
export PATH="$FIX/bin:$PATH" REPO="exemple/depot" FAKE_APPELS="$FIX/appels.log" \
       FAKE_INTERDITS="$FIX/interdits.log" FAKE_ETATS="$FIX/etats.tsv"
raz() { : > "$FAKE_APPELS"; : > "$FAKE_INTERDITS"; }

cat > "$FIX/plan.md" <<'MD'
# Plan de test

| Département | Issues |
|---|---|
| `dept:07-seo` | 3 |

## Issues ouvertes au relevé

| Issue | Créée | Titre | Département | Confiance | Raison | Suite | Preuve de la suite |
|---|---|---|---|---|---|---|---|
| #10 | 2026-11-01 | Ouverte | `dept:07-seo` | forte | r | garder | p avec `code` |
| #11 | 2026-11-01 | Moyenne | `dept:07-seo` | moyenne | r | garder | p |
| #12 | 2026-11-01 | Obsolète | `dept:21-runtime` | forte | r | fermer | p |
| #13 | 2026-11-01 | Doublon | `dept:23-ia-agents` | forte | r | fusionner→#10 | p |
| #14 | 2026-11-01 | Fermée depuis | `dept:21-runtime` | forte | r | garder | p |
| #15 | 2026-11-01 | Déjà classée | `dept:22-data` | forte | r | garder | p |
| #16 | 2026-11-01 | Faible | `dept:22-data` | faible | r | garder | p |

## PR ouvertes sans issue liée

| PR | Brouillon | Titre | Issue à citer | Confiance | Fondement |
|---|---|---|---|---|---|
| #99 | non | PR | aucune | forte | garder |
MD
printf '10\tOPEN\t\n14\tCLOSED\t\n15\tOPEN\tdept:22-data\n' > "$FAKE_ETATS"

echo "== à blanc (défaut) =="
raz
SORTIE="$(bash "$SCRIPT" --plan "$FIX/plan.md")"; RC=$?
check "code de sortie" "0" "$RC"
check "lignes retenues : forte + garder du seul tableau des issues" "10 14 15" \
  "$(grep -oP '^gh issue edit \K[0-9]+' <<< "$SORTIE" | tr '\n' ' ' | sed 's/ $//')"
check "commande affichée" 'gh issue edit 10 --repo exemple/depot --add-label "dept:07-seo"' \
  "$(grep -m1 '^gh issue edit 10 ' <<< "$SORTIE")"
check "aucun appel gh" "0" "$(wc -l < "$FAKE_APPELS" | tr -d ' ')"
check "--dry-run explicite = défaut" "$SORTIE" "$(bash "$SCRIPT" --dry-run --plan "$FIX/plan.md")"

echo "== --apply =="
raz
SORTIE="$(bash "$SCRIPT" --apply --plan "$FIX/plan.md")"; RC=$?
check "code de sortie" "0" "$RC"
check "seule écriture : #10 reçoit son dept:" "issue edit 10 --repo exemple/depot --add-label dept:07-seo" \
  "$(grep '^issue edit' "$FAKE_APPELS")"
check "issue fermée ignorée" "1" "$(grep -c '^#14 : CLOSED' <<< "$SORTIE")"
check "issue déjà classée ignorée" "1" "$(grep -c '^#15 : porte déjà dept:22-data' <<< "$SORTIE")"
check "bilan" "# 1 ajouté(s), 2 ignorée(s), 0 échec(s) sur 3" "$(tail -n1 <<< "$SORTIE")"
check "aucune commande interdite (close, remove-label, comment…)" "0" "$(wc -l < "$FAKE_INTERDITS" | tr -d ' ')"

echo "== échec d'ajout =="
raz
FAKE_EDIT_ECHEC=10 bash "$SCRIPT" --apply --plan "$FIX/plan.md" > /dev/null 2>&1; RC=$?
check "un échec rend un code non nul" "1" "$RC"

echo "== refus =="
sed 's/| #12 | 2026-11-01 | Obsolète |/| #12 | 2026-11-01 | Titre | coupé |/' "$FIX/plan.md" > "$FIX/mal.md"
raz; bash "$SCRIPT" --plan "$FIX/mal.md" > /dev/null 2>&1; RC=$?
check "ligne mal formée : arrêt" "3" "$RC"
sed 's/`dept:07-seo` | forte/`dept:7-seo` | forte/' "$FIX/plan.md" > "$FIX/label.md"
bash "$SCRIPT" --plan "$FIX/label.md" > /dev/null 2>&1; RC=$?
check "label hors format dept:NN-slug : arrêt" "3" "$RC"
bash "$SCRIPT" --plan "$FIX/plan.md" --repo 'x/y;rm' > /dev/null 2>&1; RC=$?
check "dépôt invalide : arrêt" "2" "$RC"
bash "$SCRIPT" --close > /dev/null 2>&1; RC=$?
check "option inconnue : arrêt" "2" "$RC"
check "aucun appel gh pendant les refus" "0" "$(wc -l < "$FAKE_APPELS" | tr -d ' ')"

echo "== plan versionné =="
raz
SORTIE="$(bash "$SCRIPT")"; RC=$?
check "code de sortie" "0" "$RC"
check "lignes forte + garder du plan" "264 411 412 413 414 430 432 593 1947 2036 2073" \
  "$(grep -oP '^gh issue edit \K[0-9]+' <<< "$SORTIE" | tr '\n' ' ' | sed 's/ $//')"
check "aucun appel gh" "0" "$(wc -l < "$FAKE_APPELS" | tr -d ' ')"
PLAN="$ICI/../../docs/plans/2026-11-15-adr128-triage-file.md"
check "une ligne par issue du relevé" "181" \
  "$(awk '/^## /{d=($0=="## Issues ouvertes au relevé")} d && /^\| #[0-9]+ \|/' "$PLAN" | wc -l | tr -d ' ')"

if ((FAIL)); then echo "ÉCHEC"; exit 1; fi
echo "OK"
