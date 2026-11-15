#!/usr/bin/env bash
# Test du jeton GitHub App des agents de DEV, sans réseau, sans sudo, rien d'installé.
#   bash scripts/ops/gh-app-token/gh-app-token.test.sh      → code 0 si tout passe
#
# 1. PERMS (ADR-130 D3.4) : exactement les six droits attendus, sans « workflows » ni droit plus
#    large ; la garde est rejouée sur des copies mutées pour prouver qu'elle échoue.
# 2. Délivreur : clé RSA jetable, faux curl qui vérifie le JWT (signature, iss, durée, absence
#    d'argv) et la demande, puis rejoue des réponses GitHub ; tout écart de droits reçus, de
#    dépôts ou de forme du jeton doit être refusé (égalité stricte).
# 3. Wrapper : faux sudo ; un échec du délivreur doit sortir en erreur, porter sa cause sur stderr
#    et dans le rapport cron_report, et laisser hosts.yml intact.
# 4. Unités : ExecStart vise le wrapper installé, le minuteur renouvelle avant l'expiration (1 h).
set -uo pipefail

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB="$(cd "$ICI/../../cron" && pwd)/lib-supabase-report.sh"
W="$(mktemp -d "${TMPDIR:-/tmp}/gh-app-token-test.XXXXXX")"
trap 'rm -rf "$W"' EXIT
pass=0 fail=0
ok() { pass=$((pass + 1)); echo "ok    $1"; }
ko() { fail=$((fail + 1)); echo "ÉCHEC $1"; }

# --- 1. PERMS ----------------------------------------------------------------------------------
ATTENDU='{"actions":"read","checks":"read","contents":"write","metadata":"read","pull_requests":"write","statuses":"read"}'
perms_de() { sed -n "s/^readonly PERMS='\(.*\)'\$/\1/p" "$1"; }
garde_perms() { # fichier → 0 si PERMS est exactement l'attendu, sans workflows
  local p
  p=$(perms_de "$1")
  [ "$(grep -c '^readonly PERMS=' "$1")" = 1 ] || return 1
  jq -e --argjson a "$ATTENDU" '. == $a and (has("workflows") | not)' <<<"$p" >/dev/null 2>&1
}
SRC="$ICI/automecanik-gh-app-token"
if garde_perms "$SRC"; then ok "PERMS de la source = six droits attendus, sans workflows"; else ko "PERMS de la source : $(perms_de "$SRC")"; fi
mut() { sed "s/^readonly PERMS='{\"actions\":\"read\",/readonly PERMS='{$1,/" "$SRC" >"$W/mut"; }
for m in '"actions":"read","workflows":"write"' '"actions":"read","workflows":"read"' \
  '"actions":"read","administration":"write"' '"actions":"write"'; do
  mut "$m"
  if [ "$(perms_de "$W/mut")" != "$(perms_de "$SRC")" ] && ! garde_perms "$W/mut"; then
    ok "garde mordante : PERMS muté ($m) refusé"
  else ko "garde muette sur PERMS muté ($m)"; fi
done
if grep -q "readonly PERMS='.*\"workflows\"" "$SRC"; then ko "workflows présent dans la source"; else ok "aucun « workflows » dans PERMS"; fi

# --- 2. Délivreur ------------------------------------------------------------------------------
mkdir -p "$W/bin" "$W/etc"
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$W/etc/key.pem" 2>/dev/null
openssl pkey -in "$W/etc/key.pem" -pubout -out "$W/pub.pem"
printf 'APP_ID=123456\nINSTALLATION_ID=7890\n' >"$W/etc/app.conf"
sed -e "s#^readonly CONF=.*#readonly CONF=$W/etc/app.conf#" \
  -e "s#^readonly KEY=.*#readonly KEY=$W/etc/key.pem#" "$SRC" >"$W/helper"
REPOS=$(sed -n "s/^readonly REPOS='\(.*\)'\$/\1/p" "$SRC")
printf '#!/bin/bash\nexit 0\n' >"$W/bin/logger"
cat >"$W/bin/curl" <<'EOF'
#!/bin/bash
# Faux curl : refuse tout JWT dans argv, vérifie celui de l'en-tête et la demande, rejoue FAKE_SCENARIO.
set -uo pipefail
for a in "$@"; do case "$a" in *eyJ*) echo "JWT dans argv" >&2; exit 97 ;; esac; done
auth='' body='' method='' url=''
while [ $# -gt 0 ]; do
  case "$1" in
    -H) [[ "$2" == @* ]] && auth=$(grep -m1 '^Authorization: Bearer ' "${2#@}" | sed 's/^Authorization: Bearer //'); shift 2 ;;
    --data) body=$2; shift 2 ;;
    -X) method=$2; shift 2 ;;
    --max-time | --proto | -w) shift 2 ;;
    -sS) shift ;;
    *) url=$1; shift ;;
  esac
done
IFS=. read -r h p s <<<"$auth"
d() { local x=$1; x=${x//-/+}; x=${x//_//}; while [ $((${#x} % 4)) -ne 0 ]; do x+='='; done; printf '%s' "$x" | openssl base64 -d -A; }
printf '%s.%s' "$h" "$p" >"$FAKE_W/signed"; d "$s" >"$FAKE_W/sig"
openssl dgst -sha256 -verify "$FAKE_W/pub.pem" -signature "$FAKE_W/sig" "$FAKE_W/signed" >/dev/null 2>&1 || { printf '{"message":"bad sig"}\n401'; exit 0; }
pl=$(d "$p"); now=$(date +%s)
jq -e --argjson n "$now" '.iss == "123456" and .iat <= $n and .exp > $n and (.exp - .iat) <= 600' <<<"$pl" >/dev/null || { printf '{"message":"bad claims"}\n401'; exit 0; }
case "$method $url" in
  "GET https://api.github.com/app/installations/7890")
    printf '{"app_slug":"automecanik-agents","account":{"login":"ak125"},"repository_selection":"selected","permissions":%s}\n200' "$FAKE_PERMS"; exit 0 ;;
  "POST https://api.github.com/app/installations/7890/access_tokens") ;;
  *) printf '{"message":"Not Found"}\n404'; exit 0 ;;
esac
# La demande doit porter exactement les droits et les dépôts attendus.
jq -e --argjson p "$FAKE_PERMS" --argjson r "$FAKE_REPOS" '.permissions == $p and .repositories == $r' <<<"$body" >/dev/null ||
  { printf '{"message":"bad body"}\n422'; exit 0; }
# GitHub (ADR-130 D3.4) refuse un droit que l'App n'a plus : c'est l'échec du 15 nov.
jq -e '.permissions | has("workflows")' <<<"$body" >/dev/null &&
  { printf '{"message":"The permissions requested are not granted to this installation."}\n422'; exit 0; }
T=ghs_$(printf 'A%.0s' {1..36})
R=$(jq -c 'reverse | map({name: .})' <<<"$FAKE_REPOS")   # ordre de GitHub, pas forcément trié
G=$FAKE_PERMS
case "$FAKE_SCENARIO" in
  ok) ;;
  plus_workflows) G=$(jq -c '.workflows = "write"' <<<"$G") ;;
  plus_admin) G=$(jq -c '.administration = "write"' <<<"$G") ;;
  actions_write) G=$(jq -c '.actions = "write"' <<<"$G") ;;
  moins_un) G=$(jq -c 'del(.statuses)' <<<"$G") ;;
  tous_depots) printf '{"token":"%s","permissions":%s,"repository_selection":"all","repositories":%s}\n201' "$T" "$G" "$R"; exit 0 ;;
  depot_manquant) R=$(jq -c '.[1:]' <<<"$R") ;;
  mauvais_jeton) T=ghp_${T#ghs_} ;;
  forbidden) printf '{"message":"Resource not accessible by integration"}\n403'; exit 0 ;;
esac
printf '{"token":"%s","expires_at":"x","permissions":%s,"repository_selection":"selected","repositories":%s}\n201' "$T" "$G" "$R"
EOF
chmod +x "$W/bin/curl" "$W/bin/logger"

run() { # nom scénario code_attendu motif_stdout motif_stderr [args…]
  local name=$1 sc=$2 want=$3 pat=$4 epat=$5 out rc
  shift 5
  out=$(FAKE_W=$W FAKE_SCENARIO=$sc FAKE_PERMS=${PERMS_DEMANDE:-$ATTENDU} FAKE_REPOS=$REPOS \
    PATH="$W/bin:$PATH" bash "$W/helper" "$@" 2>"$W/err")
  rc=$?
  if [ "$rc" = "$want" ] && [[ "$out" =~ $pat ]] && [[ "$(cat "$W/err")" =~ $epat ]]; then ok "$name"
  else ko "$name (rc=$rc, sortie=${out:0:60}, err=$(head -c 160 "$W/err"))"; fi
}
run "jeton délivré, seul sur stdout" ok 0 '^ghs_A{36}$' '^$'
run "describe : droits sans jeton" ok 0 '"repository_selection":"selected"' '^$' describe
run "droits reçus + workflows → refus" plus_workflows 1 '^$' 'hors périmètre'
run "droits reçus + administration → refus" plus_admin 1 '^$' 'hors périmètre'
run "actions passé en écriture → refus" actions_write 1 '^$' 'hors périmètre'
run "un droit reçu en moins → refus" moins_un 1 '^$' 'hors périmètre'
run "installation sur tous les dépôts → refus" tous_depots 1 '^$' 'hors périmètre'
run "un dépôt manquant → refus" depot_manquant 1 '^$' 'hors périmètre'
run "jeton de forme inattendue → refus" mauvais_jeton 1 '^$' 'hors périmètre'
run "403 GitHub → refus, cause sur stderr" forbidden 1 '^$' 'HTTP 403'
# Garde de non-régression de l'incident : un délivreur qui redemande workflows échoue.
mut '"actions":"read","workflows":"write"'
sed -e "s#^readonly CONF=.*#readonly CONF=$W/etc/app.conf#" -e "s#^readonly KEY=.*#readonly KEY=$W/etc/key.pem#" "$W/mut" >"$W/helper"
PERMS_DEMANDE=$(perms_de "$W/mut") run "délivreur muté (workflows redemandé) → HTTP 422" ok 1 '^$' 'HTTP 422'

# --- 3. Wrapper --------------------------------------------------------------------------------
mkdir -p "$W/home/.config/gh" "$W/wbin" "$W/state"
sed "s#^readonly LIB_RAPPORT=.*#readonly LIB_RAPPORT=$LIB#" "$ICI/automecanik-gh-app-token-refresh" >"$W/wrapper"
cat >"$W/wbin/sudo" <<'EOF'
#!/bin/bash
[ "$*" = "-n -u automecanik-ghapp /usr/local/libexec/automecanik-gh-app-token" ] || { echo "faux sudo : appel inattendu : $*" >&2; exit 2; }
case "$FAKE_SUDO" in
  ok) echo "ghs_$(printf 'B%.0s' {1..40})" ;;
  refus) echo "automecanik-gh-app-token: HTTP 422 The permissions requested are not granted to this installation." >&2; exit 1 ;;
  muet) exit 1 ;;
  forme) echo "pas-un-jeton" ;;
esac
EOF
chmod +x "$W/wbin/sudo"
wrap() { # scénario
  HOME=$W/home CRON_STATE_DIR=$W/state FAKE_SUDO=$1 PATH="$W/wbin:$PATH" bash "$W/wrapper" 2>"$W/werr"
}
etat() { jq -r "$1" "$W/state/gh-app-token-refresh.json" 2>/dev/null; }
H=$W/home/.config/gh/hosts.yml

if wrap ok && [ "$(grep -c "oauth_token: ghs_B\{40\}$" "$H")" = 2 ] && [ "$(stat -c %a "$H")" = 600 ] &&
  [ "$(etat .status)" = ok ] && [ "$(etat .max_age_s)" = 3600 ] && ! grep -q ghs_ "$W/state/gh-app-token-refresh.json"; then
  ok "wrapper : hosts.yml réécrit (0600), rapport ok sans jeton, max_age 1 h"
else ko "wrapper ok (rc=$?, err=$(head -c 160 "$W/werr"), état=$(etat -c .))"; fi
avant=$(sha256sum "$H")

wrap refus; rc=$?
if [ "$rc" = 1 ] && grep -q 'ÉCHEC : délivreur en échec (code 1) : automecanik-gh-app-token: HTTP 422' "$W/werr" &&
  [ "$(etat .status)" = error ] && [[ "$(etat .summary)" == *"HTTP 422 The permissions requested"* ]] &&
  [ "$(sha256sum "$H")" = "$avant" ]; then
  ok "wrapper : refus du délivreur → code 1, cause sur stderr et dans le rapport, hosts.yml intact"
else ko "wrapper refus (rc=$rc, err=$(head -c 200 "$W/werr"), état=$(etat -c .))"; fi

wrap muet; rc=$?
if [ "$rc" = 1 ] && grep -q "sortie d'erreur vide" "$W/werr" && [ "$(etat .streak)" = 2 ] && [ "$(sha256sum "$H")" = "$avant" ]; then
  ok "wrapper : échec muet → message explicite, série d'échecs comptée (2)"
else ko "wrapper muet (rc=$rc, err=$(head -c 200 "$W/werr"), état=$(etat -c .))"; fi

wrap forme; rc=$?
if [ "$rc" = 1 ] && grep -q 'sans jeton de forme attendue' "$W/werr" && [ "$(sha256sum "$H")" = "$avant" ] &&
  ! grep -q 'pas-un-jeton' "$W/werr" "$W/state/gh-app-token-refresh.json"; then
  ok "wrapper : sortie hors forme → refus, rien recopié, hosts.yml intact"
else ko "wrapper forme (rc=$rc, err=$(head -c 200 "$W/werr"))"; fi

# --- 4. Unités ---------------------------------------------------------------------------------
if [ "$(sed -n 's/^ExecStart=//p' "$ICI/automecanik-gh-app-token-refresh.service")" = /home/deploy/.local/libexec/automecanik-gh-app-token-refresh ]; then
  ok "service : ExecStart = wrapper installé"
else ko "service : ExecStart inattendu"; fi
iv=$(sed -n 's/^OnUnitActiveSec=\([0-9]*\)min$/\1/p' "$ICI/automecanik-gh-app-token-refresh.timer")
if [ -n "$iv" ] && [ "$iv" -lt 60 ]; then ok "minuteur : toutes les ${iv} min, avant l'expiration du jeton (60 min)"
else ko "minuteur : intervalle « $iv »"; fi

echo "$pass/$((pass + fail)) attendus"
[ "$fail" = 0 ]
