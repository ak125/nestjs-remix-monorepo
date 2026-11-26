#!/usr/bin/env bash
# Test du hook SessionStart sessionstart-workspace-context.sh sur fixtures jetables :
# dépôts git factices avec un top-priorities.md synthétique, HOME, TMPDIR et état cron
# de fixture. Les attendus sont ceux du correctif (tampon de sortie propre à chaque
# invocation) ; lancé contre une version antérieure (HOOK=<copie>), les lignes en ÉCHEC
# montrent le tampon partagé (S3) et l'absence du chemin d'échec mktemp (S4).
#
# Harnais : le hook est copié dans scripts/claude-hooks/ de chaque dépôt factice, avec
# check-memory-size.sh. Le checkout canon codé en dur et, pour une version ancienne, le
# tampon partagé /tmp/sessionstart-output.txt sont redirigés vers la fixture (sed, seule
# modification). La copie est relue avant toute exécution : s'il y reste un chemin en
# service, le test s'arrête sans rien lancer.
#
# Concurrence (S3) : un faux `wc` ralentit la seule mesure du tampon de sortie, entre son
# écriture et sa lecture. B démarre pendant que A attend ; le témoin exige que les deux
# attentes se chevauchent. Avec un tampon partagé, A émet alors le manifeste de B.
#
# Usage : [HOOK=<script>] bash scripts/claude-hooks/sessionstart-workspace-context.test.sh
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
HOOK_SRC="${HOOK:-$HERE/sessionstart-workspace-context.sh}"
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
# Fixture obligatoire : sans elle, les chemins "$FIX/..." deviendraient des chemins racine.
# Arrêt avant tout mkdir, copie ou trap si mktemp échoue ou ne rend pas un répertoire.
FIX="$(mktemp -d "${TMPDIR:-/tmp}/sessionstart-hook-test.XXXXXX")" || { echo "ARRÊT — mktemp -d de la fixture impossible"; exit 1; }
if [ -z "$FIX" ] || [ ! -d "$FIX" ]; then echo "ARRÊT — fixture absente ou invalide (« $FIX »)"; exit 1; fi
export GIT_CEILING_DIRECTORIES="$FIX"
trap 'rm -rf "$FIX"' EXIT
FAIL=0
check() { if [[ "$2" == "$3" ]]; then echo "  ok    — $1 ($3)"; else echo "  ÉCHEC — $1 : attendu « $2 », obtenu « $3 »"; FAIL=1; fi; }
H=scripts/claude-hooks
LIVE_BEFORE="$(stat -c '%Y %s' /tmp/sessionstart-output.txt 2>/dev/null || echo absent)"
mkdir -p "$FIX/home" "$FIX/tmp" "$FIX/bin" "$FIX/cron"
echo "== hook : $(sha256sum "$HOOK_SRC" | cut -c1-12) $(basename "$HOOK_SRC")"

topfile() {  # topfile <marqueur> [lignes TOP supplémentaires]
  printf '# fixture\n\n## TOP\n- %s\n- item-top-2\n%b\n## DO_NOT_START\n- item-dns-1\n\n' "$1" "${2:-}"
  printf '## ACTIVE_INCIDENTS\n- item-inc-1\n\n## STRUCTURAL_CONSTRAINTS\n- item-sc-1\n'
}
mkrepo() {  # mkrepo <nom> <marqueur> [lignes TOP supplémentaires]
  local r="$FIX/$1"; mkdir -p "$r/$H" "$r/.claude"; git init -q "$r"
  topfile "$2" "${3:-}" > "$r/.claude/top-priorities.md"
  cp "$HERE/check-memory-size.sh" "$r/$H/"
  sed -e "s|/tmp/sessionstart-output.txt|$FIX/shared-out.txt|g" -e "s|/opt/automecanik/app|$r|g" \
    "$HOOK_SRC" > "$r/$H/hook.sh"
  if command grep -nE '/opt/automecanik|/tmp/sessionstart-output|/home/deploy' "$r/$H/hook.sh" "$r/$H/check-memory-size.sh"; then
    echo "ARRÊT — une copie vise encore une ressource en service (lignes ci-dessus)"; exit 2
  fi
}
run() {  # run <dépôt> <stdout> <stderr> [TMPDIR] → code de sortie
  ( cd "$FIX/$1" && env HOME="$FIX/home" TMPDIR="${4:-$FIX/tmp}" CRON_STATE_DIR="$FIX/cron" \
      CLAUDE_HOOKS_DISABLE="${DISABLE:-0}" PATH="${XPATH:-$PATH}" SLOW_WC="${SLOW_WC:-}" \
      bash "$FIX/$1/$H/hook.sh" ) > "$2" 2> "$3"; echo $?
}
left() { find "$FIX/tmp" -type f | wc -l; }

# Faux wc : ralentit la mesure du tampon de sortie quand SLOW_WC est posé, sinon transparent.
REAL_WC="$(command -v wc)"
cat > "$FIX/bin/wc" <<EOF
#!/usr/bin/env bash
case "\$(readlink /proc/\$\$/fd/0 2>/dev/null)" in
  *sessionstart-output*|*shared-out*) [ -n "\${SLOW_WC:-}" ] && { echo début >> "$FIX/wc-lent"; sleep "\$SLOW_WC"; echo fin >> "$FIX/wc-lent"; } ;;
esac
exec "$REAL_WC" "\$@"
EOF
chmod +x "$FIX/bin/wc"

PAD=''; for i in $(seq 1 40); do PAD+="- remplissage-pour-depasser-la-borne-de-deux-mille-octets-$i\\n"; done
mkrepo a zzz-session-a
mkrepo b zzz-session-b
mkrepo big zzz-session-big "$PAD"

echo "== S1 nominal"
check "S1 exit" 0 "$(run a "$FIX/s1" "$FIX/s1e")"
check "S1 sections du manifeste" 4 "$(command grep -cE '^## (Workspace en cours|TOP priorities|DO NOT start|Structural constraints)' "$FIX/s1")"
check "S1 marqueur du dépôt" 1 "$(command grep -c zzz-session-a "$FIX/s1")"
check "S1 manifeste non vide et ≤ 2000 o" 1 "$(s=$("$REAL_WC" -c < "$FIX/s1"); [ "$s" -gt 0 ] && [ "$s" -le 2000 ] && echo 1 || echo "0 ($s o)")"
check "S1 stderr vide" 0 "$("$REAL_WC" -c < "$FIX/s1e")"
check "S1 aucun fichier temporaire restant" 0 "$(left)"

echo "== S2 manifeste > 2000 o : troncature et avertissement"
check "S2 exit" 0 "$(run big "$FIX/s2" "$FIX/s2e")"
check "S2 stdout tronqué à 2000 o" 2000 "$("$REAL_WC" -c < "$FIX/s2")"
check "S2 avertissement" 1 "$(command grep -c '> 2000 bytes' "$FIX/s2e")"
check "S2 aucun fichier temporaire restant" 0 "$(left)"

echo "== S3 deux sessions simultanées"
run b "$FIX/expB" /dev/null >/dev/null
check "S3 témoin : manifestes A et B différents" 1 "$(cmp -s "$FIX/s1" "$FIX/expB" || echo 1)"
: > "$FIX/wc-lent"
SLOW_WC=1 XPATH="$FIX/bin:$PATH" run a "$FIX/ca" /dev/null >/dev/null &
sleep 0.3
SLOW_WC=1 XPATH="$FIX/bin:$PATH" run b "$FIX/cb" /dev/null >/dev/null &
wait
check "S3 témoin : les deux attentes se chevauchent" "début début fin fin" "$(tr '\n' ' ' < "$FIX/wc-lent" | sed 's/ $//')"
check "S3 A reçoit son manifeste (cmp)" 0 "$(cmp -s "$FIX/s1" "$FIX/ca"; echo $?)"
check "S3 B reçoit son manifeste (cmp)" 0 "$(cmp -s "$FIX/expB" "$FIX/cb"; echo $?)"
check "S3 aucun fichier temporaire restant" 0 "$(left)"

echo "== S4 mktemp impossible : fail-open, rien sur stdout, avertissement"
check "S4 exit" 0 "$(run a "$FIX/s4" "$FIX/s4e" "$FIX/absent")"
check "S4 stdout vide" 0 "$("$REAL_WC" -c < "$FIX/s4")"
check "S4 avertissement" 1 "$(command grep -c 'mktemp impossible' "$FIX/s4e")"

echo "== S5 CLAUDE_HOOKS_DISABLE=1"
check "S5 stdout vide" 0 "$(DISABLE=1 run a "$FIX/s5" /dev/null >/dev/null; "$REAL_WC" -c < "$FIX/s5")"

echo "== S6 ressources en service"
check "S6 hook sans tampon partagé" 0 "$(command grep -c '/tmp/sessionstart-output' "$HOOK_SRC")"
check "S6 /tmp/sessionstart-output.txt en service jamais touché" "$LIVE_BEFORE" "$(stat -c '%Y %s' /tmp/sessionstart-output.txt 2>/dev/null || echo absent)"

[ "$FAIL" = 0 ] && echo "TOUS LES TESTS PASSENT" || { echo "DES TESTS ÉCHOUENT"; exit 1; }
