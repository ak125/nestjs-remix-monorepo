#!/usr/bin/env bash
# Tests de registry-thresholds.sh / registry-thresholds.py (mandat BZ), sans réseau ni base :
# un faux `gh` sur le PATH journalise les appels et les écritures ; les lectures du producteur
# sont fournies par THRESHOLD_READINGS. Usage : bash scripts/governance/registry-thresholds.test.sh
set -uo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
SUT="$HERE/registry-thresholds.sh"
MAP="$ROOT/.spec/00-canon/ai-registry/agent-operating-map.yaml"
PRODUCER="backend/src/modules/admin/services/command-center-kpi.service.ts"
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
FAIL=0; N=0

check() { N=$((N + 1)); if eval "$2"; then echo "ok  - $1"; else echo "KO  - $1"; FAIL=$((FAIL + 1)); fi; }
contient() { grep -qF -- "$2" "$1"; }
absent() { ! grep -qF -- "$2" "$1"; }

mkdir -p "$T/bin"
cat > "$T/bin/gh" <<'SH'
#!/usr/bin/env bash
echo "$*" >> "$FAKE_DIR/calls"
case "$1 $2" in
  "issue list") cat "$FAKE_DIR/issues.json" 2>/dev/null || echo "[]" ;;
  "issue view") cat "$FAKE_DIR/body.md" 2>/dev/null ;;
  "issue create") echo "W create $*" >> "$FAKE_DIR/writes"; echo "https://github.com/o/r/issues/4242" ;;
  "issue edit"|"issue comment"|"issue close"|"label create")
    echo "W $1 $2 $*" >> "$FAKE_DIR/writes"
    [ "$2" = comment ] && { for a in "$@"; do [ -n "${prev:-}" ] && cat "$a" >> "$FAKE_DIR/comments"; prev=; [ "$a" = --body-file ] && prev=1; done; } ;;
  "api "*) l="${2##*/labels/}"; grep -qxF "$(printf '%b' "${l//%/\\x}")" "$FAKE_DIR/labels" 2>/dev/null || exit 1 ;;
  *) echo "[]" ;;
esac
exit 0
SH
chmod +x "$T/bin/gh"

# Carte d'essai : le registre réel avec sales.payments-kept branché (wired: true).
python3 - "$MAP" "$T/map-wired.yaml" "$T/map-window.yaml" <<'PY'
import sys, yaml
carte = yaml.safe_load(open(sys.argv[1], encoding="utf-8"))
for d in carte["departments"]:
    for f in d.get("functions") or []:
        if f["id"] == "sales.payments-kept":
            f["threshold"]["wired"] = True
yaml.safe_dump(carte, open(sys.argv[2], "w", encoding="utf-8"), allow_unicode=True, sort_keys=False)
for d in carte["departments"]:
    for f in d.get("functions") or []:
        if f["id"] == "sales.payments-kept":
            f["threshold"]["eval"]["window_days"] = 7
yaml.safe_dump(carte, open(sys.argv[3], "w", encoding="utf-8"), allow_unicode=True, sort_keys=False)
PY
reading() { # <fichier> <json de la lecture cancelled_after_payment>
  printf '{"read_at":"2026-11-18T07:00:00.000Z","indicators":{"cancelled_after_payment":%s}}' "$2" > "$1"
}
reading "$T/critical.json" "{\"producer\":\"$PRODUCER\",\"status\":\"CRITICAL\",\"value\":0.42,\"certified\":true,\"window_days\":30}"
reading "$T/warning.json"  "{\"producer\":\"$PRODUCER\",\"status\":\"WARNING\",\"value\":0.12,\"certified\":true,\"window_days\":30}"
reading "$T/ok.json"       "{\"producer\":\"$PRODUCER\",\"status\":\"OK\",\"value\":0.01,\"certified\":true,\"window_days\":30}"
reading "$T/unmeasured.json" "{\"producer\":\"$PRODUCER\",\"unmeasured\":\"lecture du producteur en échec (ConfigurationException)\"}"
reading "$T/other-source.json" "{\"producer\":\"backend/src/autre.ts\",\"status\":\"CRITICAL\",\"value\":1,\"certified\":true,\"window_days\":30}"

run() { # <nom> [VAR=valeur ...] — exécute le script avec un faux gh neuf ; sortie dans $T/<nom>.md
  local name="$1"; shift
  export FAKE_DIR="$T/$name.d"; mkdir -p "$FAKE_DIR"; : > "$FAKE_DIR/calls"; : > "$FAKE_DIR/writes"
  [ -f "$T/issues.json" ] && cp "$T/issues.json" "$FAKE_DIR/issues.json"
  [ -f "$T/body.md" ] && cp "$T/body.md" "$FAKE_DIR/body.md"
  printf 'dept:13-sales\n' > "$FAKE_DIR/labels"
  [ -n "${NO_LABEL:-}" ] && : > "$FAKE_DIR/labels"
  env -u THRESHOLD_ISSUES_MODE -u THRESHOLD_READINGS -u THRESHOLD_MAP -u PUBLISH PATH="$T/bin:$PATH" REPO=o/r "$@" \
    bash "$SUT" "$T/$name.md" > "$T/$name.out" 2>&1
  echo $? > "$T/$name.rc"
}
W() { echo "$T/$1.d/writes"; }

# 1. Registre réel, défaut (dry-run), aucune lecture : 24 lignes, rien d'écrit.
run reel
check "registre réel : code retour 0" '[ "$(cat $T/reel.rc)" = 0 ]'
check "registre réel : 24 lignes de département" '[ "$(grep -c "^- [0-2][0-9] " $T/reel.md)" = 24 ]'
check "registre réel : compte par statut du département 13" 'contient $T/reel.md "13 Commercial & Ventes — fonctions : 5 opérationnelle(s) · 8 non opérationnelle(s) · 0 absente(s)"'
check "registre réel : « pas de mesure » sans indicateur mesurable" 'contient $T/reel.md "01 Direction générale — fonctions : 0 opérationnelle(s) · 1 non opérationnelle(s) · 0 absente(s) — pas de mesure"'
check "registre réel : mode par défaut = dry-run" 'contient $T/reel.md "Mode \`dry-run\` : rien n'"'"'est écrit"'
# Évaluable (ligne du tableau, qui exclut le texte seul) et branché (wired: true, correctif 01) :
# état d'un seuil branché, selon ce que le lecteur obtient dans le passage, jamais « non branché ».
check "registre réel : payments-kept évaluable et branché (wired: true)" 'grep -qE "^\| \`sales\.payments-kept\` \| \`dept:13-sales\` \| (non mesuré|franchi|sous le seuil) " $T/reel.md && absent $T/reel.md "non branché"'
check "seuil en texte seul = non évaluable, compté, n'ouvre rien" 'contient $T/reel.md "Seuils en texte seul, non évaluables (n'"'"'ouvrent rien) : 6."'
check "registre réel : aucune écriture" '[ ! -s "$(W reel)" ]'

# 2. Seuil franchi (CRITICAL), dry-run : liste l'ouverture, n'écrit rien.
run dry THRESHOLD_MAP="$T/map-wired.yaml" THRESHOLD_READINGS="$T/critical.json" PUBLISH=1
check "franchi : ligne du département avec 🔴" 'contient $T/dry.md "— seuils : sales.payments-kept 🔴 franchi"'
check "franchi dry-run : ouverture listée avec le label" 'contient $T/dry.md "ferait — ouvrir « Seuil de fonction — sales.payments-kept » (label \`dept:13-sales\`)"'
check "franchi dry-run : aucune écriture, même avec PUBLISH=1" '[ ! -s "$(W dry)" ]'
check "valeur du KPI jamais publiée" 'absent $T/dry.md "0.42"'

# 3. Mode inconnu : traité à blanc.
run unknown THRESHOLD_ISSUES_MODE=ecrire THRESHOLD_MAP="$T/map-wired.yaml" THRESHOLD_READINGS="$T/critical.json" PUBLISH=1
check "mode inconnu = dry-run déclaré" 'contient $T/unknown.md "valeur « ecrire » inconnue, à blanc par défaut"'
check "mode inconnu : aucune écriture" '[ ! -s "$(W unknown)" ]'

# 4. write sans --publish : rien d'écrit.
run nopub THRESHOLD_ISSUES_MODE=write THRESHOLD_MAP="$T/map-wired.yaml" THRESHOLD_READINGS="$T/critical.json"
check "write sans PUBLISH : rien d'écrit" '[ ! -s "$(W nopub)" ] && contient $T/nopub.md "rapport non publié"'

# 5. write + PUBLISH : ouvre l'issue, puis pose le label existant ; corps complet.
run write THRESHOLD_ISSUES_MODE=write THRESHOLD_MAP="$T/map-wired.yaml" THRESHOLD_READINGS="$T/critical.json" PUBLISH=1
check "write : issue créée au titre fixe" 'grep -q "W create issue create --repo o/r --title Seuil de fonction — sales.payments-kept" "$(W write)"'
check "write : label dept:13-sales posé sur la nouvelle issue" 'grep -q "issue edit 4242 --repo o/r --add-label dept:13-sales" "$(W write)"'
check "write : aucun label créé" 'absent "$(W write)" "label create"'
check "write : action rapportée" 'contient $T/write.md "fait — ouvrir « Seuil de fonction — sales.payments-kept » (label \`dept:13-sales\`) → #4242."'
BODY=$(python3 "$HERE/registry-thresholds.py" "$T/map-wired.yaml" "$T/critical.json" write https://x/blob/main/m.yaml \
  | jq -r '.thresholds[] | select(.id == "sales.payments-kept") | .body')
check "corps : constat, chiffres, source et heure, lien, mandat proposé" \
  '[[ "$BODY" == *"seuil **franchi** à la lecture du 2026-11-18 07:00 UTC"* && "$BODY" == *"statut du producteur \`CRITICAL\`"* \
     && "$BODY" == *"indicateur \`cancelled_after_payment\` du producteur \`$PRODUCER\`"* && "$BODY" == *"(https://x/blob/main/m.yaml#L"* \
     && "$BODY" == *"Mandat proposé (texte seul, rien n'"'"'est lancé)"* ]]'
check "corps : valeur non publiée" '[[ "$BODY" != *"0.42"* && "$BODY" == *"valeur : non publiée"* ]]'

# 6. Label absent : aucune issue ouverte, aucun label créé.
NO_LABEL=1 run nolabel THRESHOLD_ISSUES_MODE=write THRESHOLD_MAP="$T/map-wired.yaml" THRESHOLD_READINGS="$T/critical.json" PUBLISH=1
check "label absent : aucune écriture" '[ ! -s "$(W nolabel)" ] && contient $T/nolabel.md "label \`dept:13-sales\` absent : aucune issue"'

# Une issue de seuil déjà ouverte, dernier état rouge.
echo '[{"number":77,"title":"Seuil de fonction — sales.payments-kept","author":{"login":"app/github-actions"}}]' > "$T/issues.json"
printf 'corps\n\n<!-- report-state:v1 {"seuil:sales.payments-kept":{"c":"rouge","l":"Seuil de sales.payments-kept (vert = sous le seuil)"}} -->\n' > "$T/body.md"

# 7. Passage à WARNING : corps remplacé, commentaire de changement de couleur.
run orange THRESHOLD_ISSUES_MODE=write THRESHOLD_MAP="$T/map-wired.yaml" THRESHOLD_READINGS="$T/warning.json" PUBLISH=1
check "WARNING : corps de #77 remplacé" 'grep -q "W issue edit issue edit 77 --repo o/r --body-file" "$(W orange)"'
check "WARNING : commentaire rouge → orange" 'grep -q "rouge → \*\*orange\*\*" "$T/orange.d/comments"'
check "WARNING : pas de nouvelle issue" 'absent "$(W orange)" "W create"'

# 8. Retour sous le seuil : commentaire de retour à la normale, jamais de fermeture.
run back-dry THRESHOLD_MAP="$T/map-wired.yaml" THRESHOLD_READINGS="$T/ok.json"
check "retour dry-run : commentaire annoncé, pas de fermeture" 'contient $T/back-dry.md "ferait — mettre à jour #77 et commenter le retour à la normale (rouge → vert), sans la fermer" && [ ! -s "$(W back-dry)" ]'
run back THRESHOLD_ISSUES_MODE=write THRESHOLD_MAP="$T/map-wired.yaml" THRESHOLD_READINGS="$T/ok.json" PUBLISH=1
check "retour write : corps remplacé" 'grep -q "W issue edit issue edit 77 --repo o/r --body-file" "$(W back)"'
check "retour write : commentaire rouge → vert" 'grep -q "rouge → \*\*vert\*\*" "$T/back.d/comments"'
check "retour write : issue jamais fermée" 'absent "$(W back)" "close" && absent "$T/back.d/calls" "issue close"'
check "retour : ligne du département 🟢 sous le seuil" 'contient $T/back.md "sales.payments-kept 🟢 sous le seuil"'
rm -f "$T/issues.json" "$T/body.md"

# 9. Sous le seuil sans issue ouverte : rien.
run ok THRESHOLD_ISSUES_MODE=write THRESHOLD_MAP="$T/map-wired.yaml" THRESHOLD_READINGS="$T/ok.json" PUBLISH=1
check "sous le seuil sans issue : aucune écriture" '[ ! -s "$(W ok)" ] && contient $T/ok.md "sous le seuil, aucune issue ouverte : rien à faire."'

# 10. Valeur illisible = non mesuré, jamais zéro, aucune écriture.
run unm THRESHOLD_ISSUES_MODE=write THRESHOLD_MAP="$T/map-wired.yaml" THRESHOLD_READINGS="$T/unmeasured.json" PUBLISH=1
check "illisible : non mesuré avec la raison" 'contient $T/unm.md "| non mesuré  | lecture du producteur en échec (ConfigurationException) |"'
check "illisible : ligne du département « pas de mesure »" 'contient $T/unm.md "— pas de mesure (seuils : 1 non mesuré (sales.payments-kept)"'
check "illisible : jamais zéro ni « sous le seuil »" 'absent $T/unm.md "sous le seuil" && absent $T/unm.md "🟢" && ! grep -q "payments-kept.*= 0" $T/unm.md'
check "illisible : aucune écriture" '[ ! -s "$(W unm)" ]'

# 11. Lecture d'une autre source que le producteur déclaré : non mesuré.
run src THRESHOLD_MAP="$T/map-wired.yaml" THRESHOLD_READINGS="$T/other-source.json"
check "autre source : non mesuré" 'contient $T/src.md "lecture d'"'"'une autre source que le producteur déclaré"'

# 12. Fenêtre du producteur ≠ fenêtre du registre : non mesuré.
run win THRESHOLD_MAP="$T/map-window.yaml" THRESHOLD_READINGS="$T/critical.json"
check "fenêtre différente : non mesuré" 'contient $T/win.md "fenêtre du producteur (30 j) ≠ fenêtre du registre (7 j)"'

# 13. Mode off : aucune lecture, aucun appel d'issue.
run off THRESHOLD_ISSUES_MODE=off THRESHOLD_MAP="$T/map-wired.yaml" THRESHOLD_READINGS="$T/critical.json" PUBLISH=1
check "off : non évalué, aucun appel gh" 'contient $T/off.md "non évalué" && [ ! -s "$T/off.d/calls" ]'

# 14. Registre illisible : section « indisponible », code retour 0.
echo "departments: []" > "$T/empty.yaml"
run broken THRESHOLD_MAP="$T/empty.yaml"
check "registre illisible : indisponible, sans échec pour l'appelant" '[ "$(cat $T/broken.rc)" = 0 ] && contient $T/broken.md "Registre **indisponible**"'

echo ""
echo "$((N - FAIL))/$N vérifications passées"
[ "$FAIL" = 0 ]
