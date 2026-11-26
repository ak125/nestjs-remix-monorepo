#!/usr/bin/env bash
# Test de purchase-path-probe.sh sur FIXTURES : faux `gh` sur le PATH, aucun accès
# réseau, aucun dépôt réel. Le faux gh sert les listes d'issues et de runs du
# scénario, copie les artefacts de résultat, et journalise toute écriture
# (issue create / comment / close) ; toute autre commande échoue.
# Apostrophes typographiques voulues dans les textes français.
# shellcheck disable=SC1112
set -uo pipefail

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# PURCHASE_PROBE_SCRIPT : rejouer ce test sur une autre version du script (avant/après).
SCRIPT="${PURCHASE_PROBE_SCRIPT:-$ICI/purchase-path-probe.sh}"
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

echo "report (parcours-achat.v1, lu par le rapport unique)"
# Contrôle d'entrée du rapport unique, lu dans le script du digest (mandat AM) pour que
# ce test échoue si l'un des deux côtés change de format.
DIGEST="$ICI/../../.github/scripts/morning-health-digest.sh"
PA_VALID=$(sed -n "/^PA_VALID='/,/'\$/p" "$DIGEST" 2>/dev/null | sed "1s/^PA_VALID='//; \$s/'\$//")
check "contrôle PA_VALID lu dans le digest" "1" "$([[ -n "$PA_VALID" ]] && echo 1 || echo 0)"
report() { # nom runs-json résultat-courant|"" [id=artefact]... → out.json, code
  local dir="$FIX/$1"; mkdir -p "$dir/artifacts"
  echo '[]' > "$dir/issues.json"; echo "$2" > "$dir/runs.json"; : > "$dir/writes"
  local res=""; if [[ -n "$3" ]]; then res="$dir/result.json"; echo "$3" > "$res"; fi
  shift 3
  local pair; for pair in "$@"; do echo "${pair#*=}" > "$dir/artifacts/${pair%%=*}.json"; done
  FAKE_DIR="$dir" FAKE_WRITES="$dir/writes" bash "$SCRIPT" report "$res" "$dir/out.json" 2> "$dir/stderr"
  echo $? > "$dir/code"
}
val() { jq -r "$2" "$FIX/$1/out.json" 2>/dev/null; }
valide() { jq -e "$PA_VALID" "$FIX/$1/out.json" >/dev/null 2>&1 && echo oui || echo non; }

# r1 : passage courant réussi ; 4 décisifs avant (dont 1 échec), 1 annulé ignoré, 1 artefact absent.
report r1 "$(runs 1:success 2:success 3:failure 4:success 5:cancelled)" "$(ok_result)" \
  "1=$(ok_result)" "2=$(ok_result)" "3=$(ko_result ajout_panier)"
check "r1 : code 0" "0" "$(cat "$FIX/r1/code")"
check "r1 : accepté par le contrôle du digest" "oui" "$(valide r1)"
check "r1 : 4/5 passages, annulé ignoré" "4/5" "$(val r1 '"\(.runs_ok)/\(.runs_total)"')"
check "r1 : disponibilité" "80" "$(val r1 .availability_pct)"
check "r1 : artefact manquant compté" "1" "$(val r1 .runs_without_detail)"
check "r1 : dernier passage réussi, 0 échec consécutif" "true 0" "$(val r1 '"\(.last_run.ok) \(.last_run.consecutive_failures)"')"
check "r1 : p50 accueil sur les étapes réussies (900,900,1000,900)" "900" "$(val r1 '.steps[] | select(.name=="accueil") | .p50_ms')"
check "r1 : max accueil" "1000" "$(val r1 '.steps[] | select(.name=="accueil") | .max_ms')"
check "r1 : 9 étapes, dans l'ordre du parcours" "accueil,vehicule,gamme,produit,ajout_panier,panier,commande,paiement,nettoyage" "$(val r1 '[.steps[].name] | join(",")')"
check "r1 : lien du passage courant" "https://github.com/exemple/depot/actions/runs/1000" "$(val r1 .last_run.url)"
absent "r1 : aucune écriture" "issue" "$FIX/r1/writes"
absent "r1 : aucun texte d'erreur publié" "contact" "$FIX/r1/out.json"

# r2 : 3e échec de suite (le dernier succès est le 3e passage précédent).
report r2 "$(runs 1:failure 2:timed_out 3:success)" "$(ko_result ajout_panier)"
check "r2 : accepté par le contrôle du digest" "oui" "$(valide r2)"
check "r2 : 3 échecs consécutifs, étape nommée" "false 3 ajout_panier" "$(val r2 '"\(.last_run.ok) \(.last_run.consecutive_failures) \(.last_run.failed_step)"')"
check "r2 : étape en échec ok=false" "false" "$(val r2 '.steps[] | select(.name=="ajout_panier") | .ok')"
check "r2 : étape non atteinte absente sans historique" "0" "$(val r2 '[.steps[] | select(.name=="paiement")] | length')"

# r3 : 1er échec après un succès → 1 (le digest n'alerte qu'à 2, décision 67).
report r3 "$(runs 1:success 2:failure)" "$(ko_result panier)"
check "r3 : 1 échec consécutif" "1" "$(val r3 .last_run.consecutive_failures)"

# r4 : résultat absent → échec de la sonde ; tout premier passage.
report r4 "[]" ""
check "r4 : accepté par le contrôle du digest" "oui" "$(valide r4)"
check "r4 : sonde en échec, 0/1" "false sonde 0/1 0" "$(val r4 '"\(.last_run.ok) \(.last_run.failed_step) \(.runs_ok)/\(.runs_total) \(.availability_pct)"')"

for d in r1 r2 r3 r4; do absent "$d : aucune commande gh interdite" "INTERDIT" "$FIX/$d/writes"; done

echo "report — volume (mandat EY : aucune donnée de taille variable en argument de jq)"
# Résultat au format d'un artefact réel (indenté, libellés, requêtes bloquées) : ~2,9 Ko
# par défaut, comme les ~2,4 Ko observés le 26 nov. 2026. $1 graine, $2 étape en échec
# ("" = réussi), $3 longueur du jeton de chaque requête bloquée (défaut 43).
realiste() {
  jq -n --argjson g "$1" --arg ko "${2:-}" --argjson pad "${3:-43}" '
    [["accueil","Page d accueil"],["vehicule","Choix du véhicule"],["gamme","Page gamme × véhicule"],
     ["produit","Fiche produit"],["ajout_panier","Ajout au panier"],["panier","Page panier"],
     ["commande","Page commande (livraison)"],["paiement","Section paiement (sans payer)"]] as $parcours
    | ([$parcours[][0]] | index($ko)) as $i
    | (if $i == null then $parcours else $parcours[0:($i + 1)] end) + [["nettoyage","Nettoyage panier et session"]]
    | to_entries
    | map({step: .value[0], label: .value[1], ok: (.value[0] != $ko), ms: (300 + ((.key * 37 + $g * 13) % 4000))}) as $steps
    | {schema: "purchase-path-probe/v1", started_at: "2026-11-25T06:25:56.444Z", finished_at: "2026-11-25T06:26:09.278Z",
       origin: "https://www.exemple.test", user_agent_token: "AutoMecanik-PurchaseProbe-bot/1.0",
       ok: ($ko == ""), failed_step: (if $ko == "" then null else $ko end),
       failed_label: (if $ko == "" then null else "étape" end), failure: (if $ko == "" then null else "délai dépassé" end),
       steps: $steps, total_ms: ([$steps[].ms] | add),
       blocked_writes: [range(8) as $k | {request: ("POST /cdn-cgi/challenge-platform/h/g/precursor/0:" + ("x" * $pad) + "/\($g)-\($k)"), count: 1}],
       bypass_header_leaks: []}'
}
volume() { # nom N échecs-récents octets-par-requête-bloquée → N passages précédents, tous détaillés
  local dir="$FIX/$1" n="$2" ko="$3" pad="$4" i; mkdir -p "$dir/artifacts"
  jq -n --argjson n "$n" --argjson ko "$ko" '[{databaseId: 100000, status: "in_progress", conclusion: "", createdAt: "2026-11-26T06:25:00Z"}]
    + [range(1; $n + 1) | {databaseId: ., status: "completed", conclusion: (if . <= $ko then "failure" else "success" end),
       createdAt: (1795674300 - . * 900 | todate)}]' > "$dir/runs.json"
  for ((i = 1; i <= n; i++)); do
    if ((i <= ko)); then realiste "$i" panier "$pad"; else realiste "$i" "" "$pad"; fi > "$dir/artifacts/$i.json"
  done
  echo '[]' > "$dir/issues.json"; : > "$dir/writes"
  if ((ko > 0)); then realiste 0 panier "$pad"; else realiste 0 "" "$pad"; fi > "$dir/result.json"
  FAKE_DIR="$dir" FAKE_WRITES="$dir/writes" GITHUB_RUN_ID=100000 bash "$SCRIPT" report "$dir/result.json" "$dir/out.json" 2> "$dir/stderr"
  echo $? > "$dir/code"
  # Volume des passages précédents tel que le script les agrège (tableau indenté).
  cat "$dir"/artifacts/*.json | jq -s . | wc -c > "$dir/octets"
}
# MAX_ARG_STRLEN (noyau Linux) : 131 072 octets par argument ; ARG_MAX courant : 2 Mio.
volume v96 96 0 43
check "v96 : passages précédents au-delà d'un argument (128 Kio)" "1" "$(($(cat "$FIX/v96/octets") > 131072))"
check "v96 : code 0" "0" "$(cat "$FIX/v96/code")"
absent "v96 : pas de « Argument list too long »" "Argument list too long" "$FIX/v96/stderr"
check "v96 : accepté par le contrôle du digest" "oui" "$(valide v96)"
check "v96 : 97/97, 100 %, tous détaillés" "97/97 100 0" "$(val v96 '"\(.runs_ok)/\(.runs_total) \(.availability_pct) \(.runs_without_detail)"')"
check "v96 : max accueil sur les 97 passages" "$(cat "$FIX/v96/artifacts/"*.json "$FIX/v96/result.json" | jq -s '[.[].steps[] | select(.step == "accueil") | .ms] | max')" \
  "$(val v96 '.steps[] | select(.name=="accueil") | .max_ms')"
check "v96 : dernier passage réussi" "true 0" "$(val v96 '"\(.last_run.ok) \(.last_run.consecutive_failures)"')"

volume v200 200 2 2000
check "v200 : passages précédents au-delà de 2 Mio (ARG_MAX)" "1" "$(($(cat "$FIX/v200/octets") > 2097152))"
check "v200 : code 0" "0" "$(cat "$FIX/v200/code")"
absent "v200 : pas de « Argument list too long »" "Argument list too long" "$FIX/v200/stderr"
check "v200 : accepté par le contrôle du digest" "oui" "$(valide v200)"
check "v200 : 198/201, 98.5 %, tous détaillés" "198/201 98.5 0" "$(val v200 '"\(.runs_ok)/\(.runs_total) \(.availability_pct) \(.runs_without_detail)"')"
check "v200 : 3 échecs consécutifs, étape nommée" "false 3 panier" "$(val v200 '"\(.last_run.ok) \(.last_run.consecutive_failures) \(.last_run.failed_step)"')"

# g1 : sortie identique, champ pour champ, à celle du script d'origine (origin/main
# 1d15ecf1ba51, avant le passage par fichier) sur un même petit jeu d'entrées ;
# generated_at (heure du passage) seul exclu.
report g1 "$(runs 1:success 2:failure 3:timed_out 4:cancelled 5:success)" "$(realiste 0 panier)" \
  "1=$(realiste 1)" "2=$(realiste 2 ajout_panier)" "5=$(realiste 5)"
G1_ATTENDU=$(cat <<'JSON'
{
  "availability_pct": 40,
  "last_run": {
    "at": "2026-11-25T06:26:09.278Z",
    "consecutive_failures": 1,
    "failed_step": "panier",
    "ok": false,
    "url": "https://github.com/exemple/depot/actions/runs/1000"
  },
  "runs_expected": 96,
  "runs_ok": 2,
  "runs_total": 5,
  "runs_without_detail": 1,
  "schema": "parcours-achat.v1",
  "steps": [
    {
      "last_ms": 300,
      "max_ms": 365,
      "name": "accueil",
      "ok": true,
      "p50_ms": 313,
      "p95_ms": 365
    },
    {
      "last_ms": 337,
      "max_ms": 402,
      "name": "vehicule",
      "ok": true,
      "p50_ms": 350,
      "p95_ms": 402
    },
    {
      "last_ms": 374,
      "max_ms": 439,
      "name": "gamme",
      "ok": true,
      "p50_ms": 387,
      "p95_ms": 439
    },
    {
      "last_ms": 411,
      "max_ms": 476,
      "name": "produit",
      "ok": true,
      "p50_ms": 424,
      "p95_ms": 476
    },
    {
      "last_ms": 448,
      "max_ms": 513,
      "name": "ajout_panier",
      "ok": true,
      "p50_ms": 461,
      "p95_ms": 513
    },
    {
      "last_ms": 485,
      "max_ms": 550,
      "name": "panier",
      "ok": false,
      "p50_ms": 498,
      "p95_ms": 550
    },
    {
      "last_ms": null,
      "max_ms": 587,
      "name": "commande",
      "ok": false,
      "p50_ms": 535,
      "p95_ms": 587
    },
    {
      "last_ms": null,
      "max_ms": 624,
      "name": "paiement",
      "ok": false,
      "p50_ms": 572,
      "p95_ms": 624
    },
    {
      "last_ms": 522,
      "max_ms": 661,
      "name": "nettoyage",
      "ok": true,
      "p50_ms": 522,
      "p95_ms": 661
    }
  ],
  "window_hours": 24
}
JSON
)
check "g1 : code 0" "0" "$(cat "$FIX/g1/code")"
check "g1 : parcours-achat.v1 identique à celui du script d'origine" "$(jq -cS . <<<"$G1_ATTENDU")" \
  "$(jq -cS 'del(.generated_at)' "$FIX/g1/out.json" 2>/dev/null)"

for d in v96 v200 g1; do absent "$d : aucune commande gh interdite" "INTERDIT" "$FIX/$d/writes"; done

[[ $FAIL -eq 0 ]] && echo "OK — tous les cas passent" || echo "ÉCHEC"
exit "$FAIL"
