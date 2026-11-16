#!/usr/bin/env bash
# Test de purchase-path-probe.sh sur FIXTURES : faux `gh` sur le PATH, aucun accès
# réseau, aucun dépôt réel. Le faux gh sert les listes d'issues et de runs du
# scénario, copie les artefacts de résultat, et journalise toute écriture
# (issue create / comment / close) ; toute autre commande échoue.
# Apostrophes typographiques voulues dans les textes français.
# shellcheck disable=SC1112
set -uo pipefail

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$ICI/purchase-path-probe.sh"
FIX="$(mktemp -d "${TMPDIR:-/tmp}/purchase-path-probe-test.XXXXXX")"
trap '[[ -n "${KEEP_FIX:-}" ]] || rm -rf "$FIX"' EXIT
FAIL=0
check() { if [[ "$2" == "$3" ]]; then echo "  ok    — $1 ($3)"; else echo "  ÉCHEC — $1 : attendu « $2 », obtenu « $3 »"; FAIL=1; fi; }
contient() { if grep -qF -- "$2" "$3"; then echo "  ok    — $1"; else echo "  ÉCHEC — $1 : « $2 » absent"; FAIL=1; fi; }
absent() { if grep -qF -- "$2" "$3"; then echo "  ÉCHEC — $1 : « $2 » présent"; FAIL=1; else echo "  ok    — $1"; fi; }

mkdir -p "$FIX/bin"
cat > "$FIX/bin/gh" <<'SH'
#!/usr/bin/env bash
a=("$@")
case "${a[0]} ${a[1]}" in
  "issue list") cat "$FAKE_DIR/issues.json" ;;
  "run list") cat "$FAKE_DIR/runs.json" ;;
  "run download")
    id="${a[2]}"; dest=""
    for ((i = 3; i < ${#a[@]}; i++)); do [[ "${a[i]}" == "-D" ]] && dest="${a[i+1]}"; done
    [[ -f "$FAKE_DIR/artifacts/$id.json" ]] || exit 1
    mkdir -p "$dest" && cp "$FAKE_DIR/artifacts/$id.json" "$dest/result.json" ;;
  "issue create")
    echo "issue create ${a[*]:2}" >> "$FAKE_WRITES"
    for ((i = 2; i < ${#a[@]}; i++)); do [[ "${a[i]}" == "--body-file" ]] && cp "${a[i+1]}" "$FAKE_DIR/body.md"; done
    echo "https://github.com/exemple/depot/issues/77" ;;
  "issue comment"|"issue close") echo "${a[*]}" >> "$FAKE_WRITES" ;;
  *) echo "faux gh : commande interdite : ${a[*]}" >&2; echo "INTERDIT ${a[*]}" >> "$FAKE_WRITES"; exit 99 ;;
esac
SH
chmod +x "$FIX/bin/gh"
export PATH="$FIX/bin:$PATH" GH_TOKEN=faux REPO=exemple/depot GITHUB_RUN_ID=1000

ok_result() {
  cat <<'JSON'
{"schema":"purchase-path-probe/v1","ok":true,"failed_step":null,"failed_label":null,"failure":null,
 "steps":[{"step":"accueil","ok":true,"ms":900},{"step":"vehicule","ok":true,"ms":2000},{"step":"gamme","ok":true,"ms":1500},
          {"step":"produit","ok":true,"ms":700},{"step":"ajout_panier","ok":true,"ms":400},{"step":"panier","ok":true,"ms":600},
          {"step":"commande","ok":true,"ms":450},{"step":"paiement","ok":true,"ms":900},{"step":"nettoyage","ok":true,"ms":60}]}
JSON
}
ko_result() { # $1 = étape en échec
  jq -n --arg s "$1" '{schema:"purchase-path-probe/v1",ok:false,failed_step:$s,failed_label:"Ajout au panier",
    failure:"expect(received).toBeLessThan(expected)\nPOST /api/cart/items `500` contact@exemple.fr",
    steps:[{step:"accueil",ok:true,ms:1000},{step:"vehicule",ok:true,ms:3000},{step:"gamme",ok:true,ms:2000},
           {step:"produit",ok:true,ms:800},{step:$s,ok:false,ms:15000},{step:"nettoyage",ok:true,ms:50}]}'
}
NO_ISSUE='[]'
OPEN_ISSUE='[{"number":42,"title":"🔴 Parcours d'"'"'achat PROD en échec — étape « Ajout au panier »","author":{"login":"app/github-actions"}},
            {"number":43,"title":"🔴 Parcours d'"'"'achat PROD en échec — copie humaine","author":{"login":"quelquun"}}]'
runs() { # liste "id:conclusion" ; le passage courant (1000) est toujours en cours
  local out='[{"databaseId":1000,"status":"in_progress","conclusion":"","createdAt":"2026-11-16T10:00:00Z"}]' i=0 pair
  for pair in "$@"; do
    i=$((i + 1))
    out=$(jq --argjson id "${pair%%:*}" --arg c "${pair#*:}" --arg t "2026-11-16T09:$(printf '%02d' $((59 - i)))" \
      '. + [{databaseId:$id,status:"completed",conclusion:$c,createdAt:($t + ":00Z")}]' <<<"$out")
  done
  echo "$out"
}
scenario() { # nom issues runs-json résultat-json|"" → code
  local dir="$FIX/$1"; mkdir -p "$dir"
  echo "$2" > "$dir/issues.json"; echo "$3" > "$dir/runs.json"; : > "$dir/writes"
  local res=""; if [[ -n "$4" ]]; then res="$dir/result.json"; echo "$4" > "$res"; fi
  FAKE_DIR="$dir" FAKE_WRITES="$dir/writes" bash "$SCRIPT" alert "$res" 2> "$dir/stderr"
  echo $? > "$dir/code"
}

echo "alert"
scenario a1 "$NO_ISSUE" "$(runs 999:failure)" "$(ok_result)"
check "succès sans incident : aucune écriture" "0" "$(wc -l < "$FIX/a1/writes")"
check "succès sans incident : code" "0" "$(cat "$FIX/a1/code")"

scenario a2 "$NO_ISSUE" "$(runs 999:success 998:failure)" "$(ko_result ajout_panier)"
check "1er échec (précédent réussi) : aucune alerte" "0" "$(wc -l < "$FIX/a2/writes")"
contient "1er échec : journalisé" "alerte au 2e" "$FIX/a2/stderr"

scenario a3 "$NO_ISSUE" "$(runs 999:failure 998:success)" "$(ko_result ajout_panier)"
check "2e échec consécutif : une issue créée" "1" "$(grep -c '^issue create' "$FIX/a3/writes")"
contient "titre : préfixe + étape" "--title 🔴 Parcours d'achat PROD en échec — étape « Ajout au panier »" "$FIX/a3/writes"
contient "assignée à l'owner (e-mail)" "--assignee ak125" "$FIX/a3/writes"
contient "corps : lien du passage courant" "/exemple/depot/actions/runs/1000" "$FIX/a3/body.md"
contient "corps : lien du passage précédent" "/exemple/depot/actions/runs/999" "$FIX/a3/body.md"
absent "corps : arobase neutralisée (aucune mention)" "@" "$FIX/a3/body.md"
absent "corps : pas d'accent grave de l'erreur brute" '`500`' "$FIX/a3/body.md"
contient "corps : tableau des étapes" "| ajout_panier | ⛔ | 15000 |" "$FIX/a3/body.md"

scenario a4 "$NO_ISSUE" "$(runs 999:cancelled 998:skipped 997:timed_out)" "$(ko_result panier)"
check "annulés/sautés ignorés, précédent décisif timed_out : alerte" "1" "$(grep -c '^issue create' "$FIX/a4/writes")"

scenario a5 "$OPEN_ISSUE" "$(runs 999:failure)" "$(ko_result panier)"
check "incident déjà ouvert : une seule alerte par incident" "0" "$(wc -l < "$FIX/a5/writes")"

scenario a6 "$OPEN_ISSUE" "$(runs 999:failure)" "$(ok_result)"
contient "rétabli : commentaire sur l'incident du bot" "issue comment 42" "$FIX/a6/writes"
contient "rétabli : incident fermé" "issue close 42" "$FIX/a6/writes"
absent "issue humaine homonyme jamais touchée" " 43 " "$FIX/a6/writes"

scenario a7 "$NO_ISSUE" "$(runs 999:failure)" ""
contient "résultat absent après un échec : alerte « sonde »" "étape « Exécution de la sonde (aucun résultat) »" "$FIX/a7/writes"

scenario a8 "$NO_ISSUE" "[]" "$(ko_result gamme)"
check "tout premier passage en échec : pas d'alerte" "0" "$(wc -l < "$FIX/a8/writes")"

for d in a1 a2 a3 a4 a5 a6 a7 a8; do absent "$d : aucune commande gh interdite" "INTERDIT" "$FIX/$d/writes"; done

echo "summary"
summary() { # nom issues runs-json → stdout dans out.md, code
  local dir="$FIX/$1"; mkdir -p "$dir/artifacts"
  echo "$2" > "$dir/issues.json"; echo "$3" > "$dir/runs.json"; : > "$dir/writes"
  shift 3
  local pair; for pair in "$@"; do echo "${pair#*=}" > "$dir/artifacts/${pair%%=*}.json"; done
  FAKE_DIR="$dir" FAKE_WRITES="$dir/writes" bash "$SCRIPT" summary > "$dir/out.md" 2> "$dir/stderr"
  echo $? > "$dir/code"
}
summary s1 "$NO_ISSUE" "$(runs 1:success 2:success 3:failure 4:success 5:cancelled)" \
  "1=$(ok_result)" "2=$(ok_result)" "3=$(ko_result ajout_panier)"
check "75 % : niveau ⛔ (code 2)" "2" "$(cat "$FIX/s1/code")"
contient "disponibilité sur les passages décisifs" "Disponibilité **75 %** — 3/4 passages réussis" "$FIX/s1/out.md"
contient "échec compté sur son étape" "| ajout_panier | 1 |" "$FIX/s1/out.md"
contient "médiane des étapes réussies" "| accueil | 0 | 900 | 1000 | 1000 |" "$FIX/s1/out.md"
contient "résultat manquant signalé" "1 passage(s) sans résultat détaillé" "$FIX/s1/out.md"
absent "summary : aucune écriture" "issue" "$FIX/s1/writes"

all_ok=(); arts=()
for i in $(seq 1 96); do all_ok+=("$i:success"); arts+=("$i=$(ok_result)"); done
summary s2 "$NO_ISSUE" "$(runs "${all_ok[@]}")" "${arts[@]}"
check "96/96 réussis : niveau ✅ (code 0)" "0" "$(cat "$FIX/s2/code")"
contient "100 %" "Disponibilité **100 %** — 96/96" "$FIX/s2/out.md"

summary s3 "$OPEN_ISSUE" "$(runs "${all_ok[@]}")" "${arts[@]}"
check "incident ouvert : niveau ⛔ même à 100 %" "2" "$(cat "$FIX/s3/code")"
contient "lien de l'incident" "/exemple/depot/issues/42" "$FIX/s3/out.md"

summary s4 "$NO_ISSUE" "$(runs 1:success 2:success)" "1=$(ok_result)" "2=$(ok_result)"
check "2 passages sur 96 attendus : niveau ⚠️ (code 1)" "1" "$(cat "$FIX/s4/code")"

summary s5 "$NO_ISSUE" "[]"
check "aucun passage : niveau ⛔" "2" "$(cat "$FIX/s5/code")"
contient "aucun passage : dit que la sonde ne tourne pas" "la sonde ne tourne pas" "$FIX/s5/out.md"

[[ $FAIL -eq 0 ]] && echo "OK — tous les cas passent" || echo "ÉCHEC"
exit "$FAIL"
