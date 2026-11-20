#!/usr/bin/env bash
# Test de triage-file-apply.sh sur FIXTURES (jamais le dépôt réel) : lecture du plan, ordre des
# actions (labels, commentaires, doublons, fermetures), fermeture, doublon (option native et
# repli), exclusion (plan et --exclure), issue fermée ou modifiée depuis le relevé ignorée et
# listée, refus d'un plan mal formé, mode à blanc sans écriture.
# `gh` est remplacé par un faux : il ne lit que `issue list` et `issue close --help`, et n'accepte
# en écriture que `issue edit --add-label`, `issue comment --body` et `issue close`. Toute autre
# commande fait échouer le test.
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
interdit() { echo "faux gh : commande interdite dans le test : $*" >&2; echo "$*" >> "$FAKE_INTERDITS"; exit 99; }
if [[ "$1 $2 ${3:-}" == "issue close --help" ]]; then
  [[ -n "${FAKE_SANS_DOUBLON:-}" ]] || echo "      --duplicate-of string   Mark as duplicate"
  exit 0
fi
if [[ "$1 $2" == "issue list" ]]; then
  [[ "$*" == "issue list --repo exemple/depot --state open --limit 1000 --json number,updatedAt,labels" ]] || interdit "$@"
  cat "$FAKE_OUVERTES"; exit 0
fi
[[ "${4:-} ${5:-}" == "--repo exemple/depot" ]] || interdit "$@"
case "$1 $2 ${6:-}" in
  "issue edit --add-label"|"issue comment --body") (($# == 7)) || interdit "$@" ;;
  "issue close --reason"|"issue close --duplicate-of") (($# == 9)) && [[ "$8" == "--comment" ]] || interdit "$@" ;;
  *) interdit "$@" ;;
esac
printf '%s\n' "$*" >> "$FAKE_ECRITURES"
[[ "$3" == "${FAKE_ECHEC:-}" ]] && exit 1
exit 0
SH
chmod +x "$FIX/bin/gh"
export PATH="$FIX/bin:$PATH" REPO="exemple/depot" FAKE_APPELS="$FIX/appels.log" \
       FAKE_INTERDITS="$FIX/interdits.log" FAKE_ECRITURES="$FIX/ecritures.log" FAKE_OUVERTES="$FIX/ouvertes.json"
raz() { : > "$FAKE_APPELS"; : > "$FAKE_INTERDITS"; : > "$FAKE_ECRITURES"; }
lignes() { wc -l < "$1" | tr -d ' '; }
ecrites() { cut -d' ' -f1-3 "$FAKE_ECRITURES" | tr '\n' ';' | sed 's/;$//'; }

cat > "$FIX/plan.md" <<'MD'
# Plan de test

- **Relevé** : 2026-11-15T12:00:00Z, lecture seule.

| Département | Issues |
|---|---|
| `dept:07-seo` | 3 |

## Décision de l'owner (2026-11-15)

### Exclusions

| Issue | Motif |
|---|---|
| #20 | reste ouverte |

### Commentaires

| Issue | Commentaire |
|---|---|
| #22 | Reste ouverte : partie l'autre à vérifier. |

## Issues ouvertes au relevé

| Issue | Créée | Titre | Département | Confiance | Raison | Suite | Preuve de la suite |
|---|---|---|---|---|---|---|---|
| #10 | 2026-11-01 | Ouverte | `dept:07-seo` | forte | r | garder | p avec `code` |
| #11 | 2026-11-01 | Moyenne | `dept:07-seo` | moyenne | r | garder | p |
| #12 | 2026-11-01 | Obsolète | `dept:21-runtime` | forte | r | fermer | instantané remplacé par #10 |
| #13 | 2026-11-01 | Doublon | `dept:23-ia-agents` | moyenne | r | fermer (doublon de #17) | même routine |
| #14 | 2026-11-01 | Fermée depuis | `dept:21-runtime` | forte | r | garder | p |
| #15 | 2026-11-01 | Déjà classée | `dept:22-data` | forte | r | garder | p |
| #16 | 2026-11-01 | Faible | `dept:22-data` | faible | r | garder | p |
| #17 | 2026-11-01 | Résolue | `dept:23-ia-agents` | moyenne | r | fermer (résolue) | corrigé par #9 |
| #18 | 2026-11-01 | Modifiée depuis | `dept:21-runtime` | forte | r | fermer | p |
| #19 | 2026-11-01 | Fermée depuis | `dept:21-runtime` | forte | r | fermer | p |
| #20 | 2026-11-01 | Exclue | `dept:07-seo` | forte | r | fermer | p |
| #21 | 2026-11-01 | Exclue au lancement | `dept:21-runtime` | forte | r | fermer | p |
| #22 | 2026-11-01 | Commentée | `dept:07-seo` | forte | r | garder | p |

## PR ouvertes sans issue liée

| PR | Brouillon | Titre | Issue à citer | Confiance | Fondement |
|---|---|---|---|---|---|
| #99 | non | PR | aucune | forte | garder |
MD
cat > "$FAKE_OUVERTES" <<'JSON'
[
 {"number":10,"updatedAt":"2026-11-15T11:00:00Z","labels":[]},
 {"number":11,"updatedAt":"2026-11-15T11:00:00Z","labels":[]},
 {"number":12,"updatedAt":"2026-11-15T11:00:00Z","labels":[{"name":"bug"}]},
 {"number":13,"updatedAt":"2026-11-15T11:00:00Z","labels":[]},
 {"number":15,"updatedAt":"2026-11-15T11:00:00Z","labels":[{"name":"dept:22-data"}]},
 {"number":16,"updatedAt":"2026-11-15T11:00:00Z","labels":[]},
 {"number":17,"updatedAt":"2026-11-15T12:00:00Z","labels":[]},
 {"number":18,"updatedAt":"2026-11-15T13:00:00Z","labels":[]},
 {"number":20,"updatedAt":"2026-11-15T11:00:00Z","labels":[]},
 {"number":21,"updatedAt":"2026-11-15T11:00:00Z","labels":[]},
 {"number":22,"updatedAt":"2026-11-15T11:00:00Z","labels":[]}
]
JSON
ATTENDU="issue edit 10;issue edit 22;issue comment 22;issue close 13;issue close 12;issue close 17;issue close 21"

echo "== à blanc (défaut) =="
raz
SORTIE="$(bash "$SCRIPT" --plan "$FIX/plan.md")"; RC=$?
check "code de sortie" "0" "$RC"
check "aucune écriture" "0" "$(lignes "$FAKE_ECRITURES")"
check "seules lectures : aide de close et liste des ouvertes" "2" "$(lignes "$FAKE_APPELS")"
check "ordre : labels, commentaires, doublons, fermetures" "${ATTENDU//;/ }" \
  "$(grep -oP '^gh \Kissue (edit|comment|close) [0-9]+' <<< "$SORTIE" | tr '\n' ' ' | sed 's/ $//')"
check "commande de label" "gh issue edit 10 --repo exemple/depot --add-label dept:07-seo" \
  "$(grep -m1 '^gh issue edit 10 ' <<< "$SORTIE")"
check "commentaire du plan, apostrophe échappée" \
  "gh issue comment 22 --repo exemple/depot --body 'Reste ouverte : partie l'\\''autre à vérifier.'" \
  "$(grep -m1 '^gh issue comment 22 ' <<< "$SORTIE")"
check "fermeture : décision, PR, ligne du plan et preuve" \
  "gh issue close 12 --repo exemple/depot --reason 'not planned' --comment 'Fermeture décidée par l’owner le 2026-11-15 sur le triage ADR-128 D6 (PR #2076) : docs/plans/plan.md, ligne 29. Preuve : instantané remplacé par #10.'" \
  "$(grep -m1 '^gh issue close 12 ' <<< "$SORTIE")"
check "ligne citée = ligne réelle de #12 dans le plan" "29" "$(grep -n '^| #12 ' "$FIX/plan.md" | cut -d: -f1)"
check "résolue : raison completed" "1" "$(grep -c '^gh issue close 17 --repo exemple/depot --reason completed ' <<< "$SORTIE")"
check "doublon natif" "1" "$(grep -c '^gh issue close 13 --repo exemple/depot --duplicate-of 17 --comment ' <<< "$SORTIE")"
check "commande affichée rejouable (bash -n)" "0" "$(grep '^gh ' <<< "$SORTIE" | bash -n; echo $?)"
check "--dry-run explicite = défaut" "identique" \
  "$([[ "$SORTIE" == "$(bash "$SCRIPT" --dry-run --plan "$FIX/plan.md")" ]] && echo identique || echo différent)"

echo "== issues ignorées et listées =="
check "fermée depuis le relevé (label)" "1" "$(grep -c '^# ignorée : #14 (label) : fermée depuis le relevé' <<< "$SORTIE")"
check "fermée depuis le relevé (fermeture)" "1" "$(grep -c '^# ignorée : #19 (fermeture) : fermée depuis le relevé' <<< "$SORTIE")"
check "modifiée depuis le relevé" "1" "$(grep -c '^# ignorée : #18 (fermeture) : modifiée depuis le relevé (2026-11-15T13:00:00Z)' <<< "$SORTIE")"
check "modifiée à l'heure exacte du relevé : non ignorée" "0" "$(grep -c '^# ignorée : #17 ' <<< "$SORTIE")"
check "exclue par le plan" "1" "$(grep -c '^# ignorée : #20 (fermeture) : exclue : reste ouverte' <<< "$SORTIE")"
check "déjà classée" "1" "$(grep -c '^# ignorée : #15 (label) : porte déjà dept:22-data' <<< "$SORTIE")"
check "bilan à blanc" "# à blanc : 7 action(s), 5 ignorée(s)" "$(tail -n1 <<< "$SORTIE")"

echo "== --apply =="
raz
SORTIE="$(bash "$SCRIPT" --apply --plan "$FIX/plan.md")"; RC=$?
check "code de sortie" "0" "$RC"
check "écritures, dans l'ordre" "$ATTENDU" "$(ecrites)"
check "doublon : option native" "1" "$(grep -c '^issue close 13 --repo exemple/depot --duplicate-of 17 --comment Fermeture décidée' "$FAKE_ECRITURES")"
check "fermeture : raison not planned" "1" "$(grep -c '^issue close 12 --repo exemple/depot --reason not planned --comment Fermeture décidée' "$FAKE_ECRITURES")"
check "#20 exclue jamais fermée" "0" "$(grep -c '^issue close 20 ' "$FAKE_ECRITURES")"
check "bilan" "# bilan : 7 faite(s), 5 ignorée(s), 0 échec(s) sur 7 action(s)" "$(tail -n1 <<< "$SORTIE")"
check "aucune commande interdite" "0" "$(lignes "$FAKE_INTERDITS")"

echo "== doublon sans option native =="
raz
FAKE_SANS_DOUBLON=1 bash "$SCRIPT" --apply --plan "$FIX/plan.md" > /dev/null; RC=$?
check "code de sortie" "0" "$RC"
check "commentaire « Doublon de #17 » puis fermeture" "1" \
  "$(grep -c '^issue close 13 --repo exemple/depot --reason not planned --comment Doublon de #17. Fermeture décidée' "$FAKE_ECRITURES")"
check "aucune commande interdite" "0" "$(lignes "$FAKE_INTERDITS")"

echo "== --exclure =="
raz
SORTIE="$(bash "$SCRIPT" --apply --exclure 21,12 --plan "$FIX/plan.md")"; RC=$?
check "code de sortie" "0" "$RC"
check "#12 et #21 non fermées" "issue edit 10;issue edit 22;issue comment 22;issue close 13;issue close 17" "$(ecrites)"
check "exclusions listées" "2" "$(grep -c '^# ignorée : #\(12\|21\) (fermeture) : exclue : exclue au lancement (--exclure)' <<< "$SORTIE")"

echo "== échec d'une écriture =="
raz
FAKE_ECHEC=12 bash "$SCRIPT" --apply --plan "$FIX/plan.md" > "$FIX/sortie" 2>&1; RC=$?
check "un échec rend un code non nul" "1" "$RC"
check "les actions suivantes continuent" "7" "$(lignes "$FAKE_ECRITURES")"
check "bilan" "# bilan : 6 faite(s), 5 ignorée(s), 1 échec(s) sur 7 action(s)" "$(tail -n1 "$FIX/sortie")"

echo "== refus =="
raz
sed 's/| #12 | 2026-11-01 | Obsolète |/| #12 | 2026-11-01 | Titre | coupé |/' "$FIX/plan.md" > "$FIX/mal.md"
bash "$SCRIPT" --plan "$FIX/mal.md" > /dev/null 2>&1; RC=$?
check "ligne mal formée : arrêt" "3" "$RC"
sed 's/| fermer (résolue) |/| fusionner→#10 |/' "$FIX/plan.md" > "$FIX/suite.md"
bash "$SCRIPT" --plan "$FIX/suite.md" > /dev/null 2>&1; RC=$?
check "suite inconnue : arrêt" "3" "$RC"
sed 's/`dept:07-seo` | forte/`dept:7-seo` | forte/' "$FIX/plan.md" > "$FIX/label.md"
bash "$SCRIPT" --plan "$FIX/label.md" > /dev/null 2>&1; RC=$?
check "label hors format dept:NN-slug : arrêt" "3" "$RC"
sed '/^- \*\*Relevé\*\*/d' "$FIX/plan.md" > "$FIX/releve.md"
bash "$SCRIPT" --plan "$FIX/releve.md" > /dev/null 2>&1; RC=$?
check "date du relevé absente : arrêt" "3" "$RC"
bash "$SCRIPT" --plan "$FIX/plan.md" --repo 'x/y;rm' > /dev/null 2>&1; RC=$?
check "dépôt invalide : arrêt" "2" "$RC"
bash "$SCRIPT" --plan "$FIX/plan.md" --exclure '12;rm' > /dev/null 2>&1; RC=$?
check "--exclure invalide : arrêt" "2" "$RC"
bash "$SCRIPT" --close > /dev/null 2>&1; RC=$?
check "option inconnue : arrêt" "2" "$RC"
check "aucun appel gh pendant les refus" "0" "$(lignes "$FAKE_APPELS")"

echo "== liste des ouvertes peut-être tronquée =="
raz
cp "$FAKE_OUVERTES" "$FIX/ouvertes.bak"
jq -n '[range(1000) | {number: ., updatedAt: "2026-11-15T11:00:00Z", labels: []}]' > "$FAKE_OUVERTES"
bash "$SCRIPT" --apply --plan "$FIX/plan.md" > /dev/null 2>&1; RC=$?
check "1000 issues ouvertes : arrêt avant écriture" "4" "$RC"
check "aucune écriture" "0" "$(lignes "$FAKE_ECRITURES")"
cp "$FIX/ouvertes.bak" "$FAKE_OUVERTES"

echo "== plan versionné =="
PLAN="$ICI/../../docs/plans/2026-11-15-adr128-triage-file.md"
awk -F'|' '/^## /{d=($0=="## Issues ouvertes au relevé")} d && /^\| #[0-9]+ \|/ {n=$2; gsub(/[ #]/,"",n); print n}' "$PLAN" \
  | jq -R -s '[split("\n")[] | select(length > 0) | {number: tonumber, updatedAt: "2026-11-15T12:00:00Z", labels: []}]' > "$FAKE_OUVERTES"
raz
SORTIE="$(bash "$SCRIPT")"; RC=$?
check "code de sortie" "0" "$RC"
check "aucune écriture" "0" "$(lignes "$FAKE_ECRITURES")"
check "une ligne par issue du relevé" "181" "$(jq length "$FAKE_OUVERTES")"
check "labels : forte + garder, #745 comprise" "264 411 412 413 414 430 432 593 745 1947 2036 2073" \
  "$(grep -oP '^gh issue edit \K[0-9]+' <<< "$SORTIE" | tr '\n' ' ' | sed 's/ $//')"
check "commentaire : #745 seule" "745" "$(grep -oP '^gh issue comment \K[0-9]+' <<< "$SORTIE")"
check "fermetures : 165" "165" "$(grep -c '^gh issue close ' <<< "$SORTIE")"
check "#745 jamais fermée" "0" "$(grep -c '^gh issue close 745 ' <<< "$SORTIE")"
check "doublons d'abord, #1113 ensuite" "1037 1063 1113" \
  "$(grep -oP '^gh issue close \K(1037|1063|1113)(?= )' <<< "$SORTIE" | tr '\n' ' ' | sed 's/ $//')"
check "#1037 et #1063 : doublons de #1113" "2" "$(grep -c '^gh issue close 10[36][37] --repo exemple/depot --duplicate-of 1113 ' <<< "$SORTIE")"
check "résolues : completed" "203 439 744 1916" \
  "$(grep -oP '^gh issue close \K[0-9]+(?= --repo exemple/depot --reason completed )' <<< "$SORTIE" | tr '\n' ' ' | sed 's/ $//')"
check "chaque fermeture cite la PR et une ligne du plan" "165" \
  "$(grep -c "^gh issue close .*(PR #2076) : docs/plans/2026-11-15-adr128-triage-file.md, ligne [0-9]*\. Preuve : " <<< "$SORTIE")"
check "commandes rejouables (bash -n)" "0" "$(grep '^gh ' <<< "$SORTIE" | bash -n; echo $?)"
check "bilan" "# à blanc : 178 action(s), 0 ignorée(s)" "$(tail -n1 <<< "$SORTIE")"

if ((FAIL)); then echo "ÉCHEC"; exit 1; fi
echo "OK"
