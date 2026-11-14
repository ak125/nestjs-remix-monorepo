#!/usr/bin/env bash
# Test du hook UserPromptSubmit userpromptsubmit-context-push.sh sur fixtures jetables :
# dépôt git et mémoire factices, HOME et TMPDIR de fixture. Les attendus sont ceux du
# correctif ; lancé contre une version antérieure (HOOK=<copie>), les lignes en ÉCHEC
# montrent le tampon de sortie partagé (U12). U13 couvre le seul chemin d'échec ajouté
# par le correctif (mktemp) : une version sans ce chemin y échoue aussi.
#
# Harnais : le hook est copié dans scripts/claude-hooks/ du dépôt factice. Les chemins
# d'état en service (/tmp/upsc-dedup, /tmp/userpromptsubmit-context.*) et, pour une
# version ancienne, la mémoire et le checkout codés en dur sont redirigés vers la fixture
# (sed, seule modification). La copie est relue avant toute exécution : s'il y reste un
# de ces chemins, le test s'arrête sans rien lancer.
#
# Concurrence (U12) : un faux `wc` ralentit la seule mesure du tampon de sortie (fichier
# dont le nom contient userpromptsubmit-context), entre son écriture et sa lecture. B démarre
# pendant que A attend ; le témoin exige que les deux attentes se chevauchent. Avec un
# tampon partagé, A émet alors le contexte de B.
#
# Usage : [HOOK=<script>] bash scripts/claude-hooks/userpromptsubmit-context-push.test.sh
set -uo pipefail
HOOK_SRC="${HOOK:-$(cd "$(dirname "$0")" && pwd)/userpromptsubmit-context-push.sh}"
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
# Fixture obligatoire : sans elle, les chemins "$FIX/..." deviendraient des chemins racine.
# Arrêt avant tout mkdir, copie ou trap si mktemp échoue ou ne rend pas un répertoire.
FIX="$(mktemp -d "${TMPDIR:-/tmp}/upsc-hook-test.XXXXXX")" || { echo "ARRÊT — mktemp -d de la fixture impossible"; exit 1; }
if [ -z "$FIX" ] || [ ! -d "$FIX" ]; then echo "ARRÊT — fixture absente ou invalide (« $FIX »)"; exit 1; fi
export GIT_CEILING_DIRECTORIES="$FIX"
trap 'rm -rf "$FIX"' EXIT
FAIL=0
check() { if [[ "$2" == "$3" ]]; then echo "  ok    — $1 ($3)"; else echo "  ÉCHEC — $1 : attendu « $2 », obtenu « $3 »"; FAIL=1; fi; }

R="$FIX/repo"; MEMD="$FIX/home/.claude/projects/-opt-automecanik-app/memory"; KNOWD="$R/.claude/knowledge/modules"
mkdir -p "$R/scripts/claude-hooks" "$KNOWD" "$MEMD" "$FIX/tmp" "$FIX/bin" "$FIX/nogit"
git init -q "$R"
HOOK="$R/scripts/claude-hooks/userpromptsubmit-context-push.sh"
sed -e "s|/home/deploy/.claude/projects/-opt-automecanik-app/memory|$MEMD|g" \
    -e "s|/opt/automecanik/app|$R|g" \
    -e "s|/tmp/upsc-dedup|$FIX/dedup|g" \
    -e "s|/tmp/userpromptsubmit-context.log|$FIX/audit.log|g" \
    -e "s|/tmp/userpromptsubmit-context.out|$FIX/userpromptsubmit-context.out|g" "$HOOK_SRC" > "$HOOK"
echo "== hook : $(sha256sum "$HOOK_SRC" | cut -c1-12) $(basename "$HOOK_SRC")"
if command grep -nE '/tmp/(upsc-dedup|userpromptsubmit-context)|/home/deploy|/opt/automecanik' "$HOOK"; then
  echo "ARRÊT — la copie du hook vise encore une ressource en service (lignes ci-dessus)"; exit 2
fi
if cmp -s "$HOOK_SRC" "$HOOK"; then echo "   harnais : copie identique"; else echo "   harnais : chemins en service redirigés vers la fixture"; fi

# Faux wc : ralentit la mesure du tampon de sortie quand SLOW_WC est posé, sinon transparent.
REAL_WC="$(command -v wc)"
cat > "$FIX/bin/wc" <<EOF
#!/usr/bin/env bash
case "\$(readlink /proc/\$\$/fd/0 2>/dev/null)" in
  *userpromptsubmit-context*) [ -n "\${SLOW_WC:-}" ] && { echo début >> "$FIX/wc-lent"; sleep "\$SLOW_WC"; echo fin >> "$FIX/wc-lent"; } ;;
esac
exec "$REAL_WC" "\$@"
EOF
chmod +x "$FIX/bin/wc"

# Fichiers de l'allowlist : marqueur en tête ; pricing > 4000 o chacun (plafonds).
big() { printf '%s\n' "$1"; for i in $(seq 1 120); do printf 'ligne de remplissage %03d pour dépasser le plafond par fichier\n' "$i"; done; }
big MARQUE-PRICING-1 > "$MEMD/feedback_pricing_is_economic_governance_not_engine.md"
big MARQUE-PRICING-2 > "$MEMD/reference_supplier_remise_per_brand_per_subfamily.md"
big MARQUE-PRICING-3 > "$MEMD/feedback_never_sell_at_loss_pricing_invariant.md"
printf 'MARQUE-SEO-1\npassword = fuite-de-test\n' > "$KNOWD/seo-control-plane.md"
printf 'MARQUE-SEO-2\n' > "$MEMD/feedback_seo_keywords_table_contaminated.md"
printf 'MARQUE-SEO-3\n' > "$MEMD/feedback_no_url_changes_ever.md"
PRICING="quelle marge sur ce prix ?"; SEO="audit seo de la page"

inv() {  # inv <session_id> <prompt> <sortie> [dossier] : une invocation, stdin JSON comme Claude Code
  # Here-string, pas de pipe : un hook qui sort sans lire stdin ne doit pas donner SIGPIPE (141) au code.
  local json; json=$(jq -nc --arg p "$2" --arg s "$1" '{prompt:$p, session_id:$s}')
  (cd "${4:-$R}" && env HOME="$FIX/home" TMPDIR="${UPSC_TMPDIR:-$FIX/tmp}" PATH="$FIX/bin:$PATH" \
     SLOW_WC="${SLOW_WC:-}" CLAUDE_HOOKS_DISABLE="${DISABLE:-0}" bash "$HOOK" <<<"$json" >"$3" 2>/dev/null)
}
n=0
run() { n=$((n + 1)); O="$FIX/out.$n"; inv "$1" "$2" "$O" "${3:-$R}"; rc=$?; }  # run <sid> <prompt> [dossier] → $O, $rc
heads() { command grep -c '^### ' "$O"; }
has() { command grep -c -- "$1" "$O"; }
tmp_left() { ls -A "$FIX/tmp" | wc -l | tr -d ' '; }

echo "== U1 domaine seo : 3 fichiers, redaction, aucun fichier temporaire laissé"
run s1 "$SEO"
check "U1 code de sortie" 0 "$rc"
check "U1 trois fichiers injectés" 3 "$(heads)"
check "U1 marqueurs présents" "1 1 1" "$(has MARQUE-SEO-1) $(has MARQUE-SEO-2) $(has MARQUE-SEO-3)"
check "U1 ligne en forme de secret retirée" 0 "$(has fuite-de-test)"
check "U1 aucun fichier temporaire restant" 0 "$(tmp_left)"

echo "== U2 même session, même contenu : dédup, rien de réinjecté, trace dans le log"
run s1 "$SEO"
check "U2 sortie vide" "" "$(cat "$O")"
check "U2 DEDUP-SUPPRESS tracé" 1 "$(command grep -c 'DEDUP-SUPPRESS' "$FIX/audit.log")"

echo "== U3 autre session : réinjection"
run s2 "$SEO"
check "U3 trois fichiers injectés" 3 "$(heads)"

echo "== U4 fichier modifié en cours de session : seul ce fichier est réinjecté"
printf 'MARQUE-SEO-1\nrévision\n' > "$KNOWD/seo-control-plane.md"
run s1 "$SEO"
check "U4 un fichier réinjecté" 1 "$(heads)"
check "U4 c'est le fichier modifié" 1 "$(has révision)"

echo "== U5 plafonds : 4000 o par fichier, 9000 o au total"
run s3 "$PRICING"
check "U5 note de troncature par fichier" 1 "$([ "$(has 'tronqué à 4000 o')" -ge 1 ] && echo 1 || echo 0)"
check "U5 note de troncature totale" 1 "$(has 'contexte tronqué à 9000 o total')"
check "U5 taille bornée (≤ 9000 o + note)" 1 "$([ "$(wc -c < "$O")" -le 9100 ] && echo 1 || echo 0)"

echo "== U6 deux domaines, six candidats : cap à 3 fichiers, note"
run s4 "marge et seo"
check "U6 trois fichiers injectés" 3 "$(heads)"
check "U6 note au-delà du cap" 1 "$(has 'au-delà du cap')"
check "U6 note : trois candidats en attente" 1 "$(has '3 fichier(s) candidat(s) au-delà du cap')"
run s4 "marge et seo"
check "U6 même prompt, second tour : les trois candidats restés au-delà du cap" "3 1 0" "$(heads) $(has MARQUE-SEO-3) $(has MARQUE-PRICING)"
check "U6 second tour : plus de note de cap" 0 "$(has 'au-delà du cap')"

echo "== U7 prompt trop large (≥ 4 domaines) : rien, raison tracée"
run s5 "prix fournisseur seo wiki"
check "U7 sortie vide" "" "$(cat "$O")"
check "U7 SUPPRESS too-broad tracé" 1 "$(command grep -c 'SUPPRESS too-broad' "$FIX/audit.log")"

echo "== U8 CLAUDE_HOOKS_DISABLE=1 : rien"
DISABLE=1 run s6 "$SEO"
check "U8 code de sortie" 0 "$rc"
check "U8 sortie vide" "" "$(cat "$O")"

echo "== U9 entrée invalide : fail-open"
rc=$(cd "$R" && env HOME="$FIX/home" TMPDIR="$FIX/tmp" bash "$HOOK" <<<'pas du json' >"$FIX/out.u9" 2>/dev/null; echo $?)
check "U9 code de sortie" 0 "$rc"
check "U9 sortie vide" "" "$(cat "$FIX/out.u9")"

echo "== U10 prompt réduit au contexte IDE : aucun domaine"
run s7 $'<ide_opened_file>\ndynamic-seo-v4.test.ts\n</ide_opened_file>'
check "U10 sortie vide" "" "$(cat "$O")"

echo "== U11 session hors dépôt git : repli vers le dépôt qui porte le hook"
run s8 "$SEO" "$FIX/nogit"
check "U11 knowledge du dépôt du hook injecté" 1 "$(has MARQUE-SEO-1)"
check "U11 rien écrit dans le dossier courant" "" "$(ls -A "$FIX/nogit")"

echo "== U12 deux invocations simultanées (sessions distinctes) : aucun mélange"
rm -f "$FIX/wc-lent"
SLOW_WC=1.5 inv cA "$PRICING" "$FIX/out.A" & pa=$!
sleep 0.3
SLOW_WC=1.5 inv cB "$SEO" "$FIX/out.B" & pb=$!
wait "$pa" "$pb"
check "U12 témoin : attentes de A et B chevauchées" "début début fin fin" "$(cat "$FIX/wc-lent" 2>/dev/null | xargs)"
O="$FIX/out.A"
check "U12 A reçoit son contexte (pricing)" 1 "$(has MARQUE-PRICING-1)"
check "U12 A ne reçoit rien de B (seo)" 0 "$(has MARQUE-SEO)"
O="$FIX/out.B"
check "U12 B reçoit son contexte (seo)" 1 "$(has MARQUE-SEO-1)"
check "U12 B ne reçoit rien de A (pricing)" 0 "$(has MARQUE-PRICING)"
check "U12 aucun tampon partagé" absent "$([ -e "$FIX/userpromptsubmit-context.out" ] && echo présent || echo absent)"
check "U12 aucun fichier temporaire restant" 0 "$(tmp_left)"

echo "== U13 fichier temporaire impossible : fail-open sans injection, raison tracée"
UPSC_TMPDIR="$FIX/absent" run s9 "$SEO"
check "U13 code de sortie" 0 "$rc"
check "U13 sortie vide" "" "$(cat "$O")"
check "U13 SKIP mktemp-fail tracé" 1 "$(command grep -c 'SKIP mktemp-fail' "$FIX/audit.log")"
check "U13 rien enregistré comme injecté pour s9" absent "$([ -s "$FIX/dedup/s9.seen" ] && echo présent || echo absent)"

echo "== U14 dossier d'état remplacé par un lien : pas de dédup, rien écrit à travers le lien"
rm -rf "$FIX/dedup"; mkdir -p "$FIX/cible-lien"; ln -s "$FIX/cible-lien" "$FIX/dedup"
run s10 "$SEO"
check "U14 code de sortie" 0 "$rc"
check "U14 trois fichiers injectés (fail-open)" 3 "$(heads)"
check "U14 DEDUP-SKIP unsafe-state-dir tracé" 1 "$(command grep -c 'DEDUP-SKIP unsafe-state-dir' "$FIX/audit.log")"
check "U14 rien écrit dans la cible du lien" "" "$(ls -A "$FIX/cible-lien")"

echo "== U15 dédup avant plafond : les candidats déjà injectés ne masquent pas les suivants"
rm -f "$FIX/dedup"; mkdir -m 700 "$FIX/dedup"
run s11 "$PRICING"
check "U15 premier tour : les trois fichiers pricing" "3 1" "$(heads) $(has MARQUE-PRICING-3)"
run s11 "marge et seo"
check "U15 second tour : les trois fichiers seo, encore jamais injectés" "3 1 0" "$(heads) $(has MARQUE-SEO-3) $(has MARQUE-PRICING)"
check "U15 second tour : aucune note de cap (rien d'autre en attente)" 0 "$(has 'au-delà du cap')"
run s11 "marge et seo"
check "U15 troisième tour : tout est déjà injecté, sortie vide" "" "$(cat "$O")"

echo
if [[ $FAIL -ne 0 ]]; then echo "TESTS EN ÉCHEC"; exit 1; else echo "TOUS LES TESTS PASSENT"; fi
