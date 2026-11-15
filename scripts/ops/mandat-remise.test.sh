#!/usr/bin/env bash
# Test de mandat-remise.sh sur FIXTURES (jamais le dépôt réel) : refus de la garde, slug,
# préparation du worktree, session simulée, recherche de secrets, expurgation, décision de
# publication, mode à blanc et publication simulée.
# Faux `gh` : lit l'issue, l'éditeur et la comparaison de base ; journalise toute écriture
# (pr create, issue comment, issue edit) avec le jeton employé ; toute autre commande échoue.
# Faux `npx` : tient lieu de la CLI Claude, commite dans le worktree selon un scénario.
# Dépôt « origin » : dépôt git nu local ; aucun accès réseau.
# Apostrophes typographiques voulues dans les textes français (littérales, entre quotes).
# shellcheck disable=SC1112
set -uo pipefail

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$ICI/mandat-remise.sh"
FIX="$(mktemp -d "${TMPDIR:-/tmp}/mandat-remise-test.XXXXXX")"
trap 'rm -rf "$FIX"' EXIT
FAIL=0
check() { if [[ "$2" == "$3" ]]; then echo "  ok    — $1 ($3)"; else echo "  ÉCHEC — $1 : attendu « $2 », obtenu « $3 »"; FAIL=1; fi; }
contient() { if grep -qF -- "$2" "$3"; then echo "  ok    — $1"; else echo "  ÉCHEC — $1 : « $2 » absent de $(basename "$3")"; FAIL=1; fi; }
absent() { if grep -qF -- "$2" "$3"; then echo "  ÉCHEC — $1 : « $2 » présent dans $(basename "$3")"; FAIL=1; else echo "  ok    — $1"; fi; }

# --- Git isolé : aucune configuration utilisateur (signature, hooks) ---
printf '[user]\n\tname = test\n\temail = test@example.invalid\n[commit]\n\tgpgsign = false\n[init]\n\tdefaultBranch = main\n' > "$FIX/gitconfig"
export GIT_CONFIG_GLOBAL="$FIX/gitconfig" GIT_CONFIG_NOSYSTEM=1

git init -q --bare "$FIX/origin.git"
git clone -q "$FIX/origin.git" "$FIX/seed" 2> /dev/null
mkdir -p "$FIX/seed/.github/workflows"
echo "# dépôt de test" > "$FIX/seed/README.md"
echo "name: ci" > "$FIX/seed/.github/workflows/ci.yml"
git -C "$FIX/seed" add -A && git -C "$FIX/seed" commit -qm "init" && git -C "$FIX/seed" push -q origin HEAD:main
BASE="$(git -C "$FIX/seed" rev-parse HEAD)"

# --- Faux gh ---
mkdir -p "$FIX/bin"
cat > "$FIX/bin/gh" <<'SH'
#!/usr/bin/env bash
filtre=""; a=()
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "--jq" ]]; then filtre="$2"; shift 2; else a+=("$1"); shift; fi
done
jeton="autre"; [[ "${GH_TOKEN:-}" == "$FAKE_JETON_APP" ]] && jeton="app"; [[ "${GH_TOKEN:-}" == "$FAKE_JETON_ISSUE" ]] && jeton="issue"
sortir() { if [[ -n "$filtre" ]]; then jq -r "$filtre"; else cat; fi; }
case "${a[0]} ${a[1]}" in
  "api repos/exemple/depot/issues/"*) sortir < "$FAKE_DIR/issue-api.json" ;;
  "api graphql") sortir < "$FAKE_DIR/graphql.json" ;;
  "api repos/exemple/depot/compare/"*) printf '{"status":"%s"}' "$(cat "$FAKE_DIR/compare")" | sortir ;;
  "pr create") echo "pr create jeton=$jeton ${a[*]:2}" >> "$FAKE_ECRITURES"; echo "https://github.com/exemple/depot/pull/4242" ;;
  "issue comment") echo "issue comment jeton=$jeton ${a[*]:2}" >> "$FAKE_ECRITURES"
                   for ((i = 2; i < ${#a[@]}; i++)); do [[ "${a[i]}" == "--body-file" ]] && cp "${a[i+1]}" "$FAKE_DIR/commentaire-poste.md"; done; true ;;
  "issue edit") echo "issue edit jeton=$jeton ${a[*]:2}" >> "$FAKE_ECRITURES" ;;
  *) echo "faux gh : commande interdite dans le test : ${a[*]}" >&2; echo "INTERDIT ${a[*]}" >> "$FAKE_ECRITURES"; exit 99 ;;
esac
SH
# --- Faux npx (CLI Claude) : environnement et arguments reçus consignés, commits selon le scénario ---
cat > "$FIX/bin/npx" <<SH
#!/usr/bin/env bash
FIX="$FIX"
SH
cat >> "$FIX/bin/npx" <<'SH'
env > "$FIX/session-env.txt"; printf '%s\n' "$@" > "$FIX/session-args.txt"; cat > "$FIX/session-stdin.txt"
mkdir -p "$HOME/.claude/projects/p"
printf '{"jeton":"%s","jeton_github_vu":"ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"}\n' "${CLAUDE_CODE_OAUTH_TOKEN:-}" > "$HOME/.claude/projects/p/s.jsonl"
case "$(cat "$FIX/scenario")" in
  ok|bloque) echo "contenu" > docs-mandat.md; git add -A; git commit -qm "docs: mandat Refs #7" ;;
  workflow) echo "on: push" >> .github/workflows/ci.yml; git commit -qam "ci: modifie un workflow" ;;
  fuite) echo "cle=sk-ant-oat01-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123" > f.txt; git add -A; git commit -qm "f" ;;
  binaire) printf '\000\001PNG cle=sk-ant-oat01-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123\000' > f.png; git add -A; git commit -qm "f" ;;
  sale) echo a > a.md; git add a.md; git commit -qm a; echo b > b.md ;;
  rien) ;;
  echec) echo '{"type":"result","is_error":true,"subtype":"error_max_budget_usd","total_cost_usd":20}'; exit 1 ;;
esac
jq -n --slurpfile r "$FIX/resultat.json" '{type:"result", is_error:false, subtype:"success", total_cost_usd:1.5,
  num_turns:12, duration_ms:1000, usage:{input_tokens:100, output_tokens:50}, structured_output:$r[0]}'
SH
chmod +x "$FIX/bin/gh" "$FIX/bin/npx"
export PATH="$FIX/bin:$PATH" REPO="exemple/depot" MANDAT_OWNER="Proprio" FAKE_DIR="$FIX" \
       FAKE_ECRITURES="$FIX/ecritures.log" FAKE_JETON_APP="ghs_jetonAppFactice0123456789abcdefABCDEF" \
       FAKE_JETON_ISSUE="ghs_jetonIssueFactice0123456789abcdefABCD" \
       CLAUDE_CODE_OAUTH_TOKEN="sk-ant-oat01-jetonFacticeDuTest-0123456789" GH_TOKEN="ghs_jetonIssueFactice0123456789abcdefABCD" \
       MANDAT_WORKTREES="$FIX/wt"
unset ANTHROPIC_API_KEY GITHUB_OUTPUT MANDAT_TOKEN_PR
mkdir -p "$FIX/wt"
TITRE="MANDAT test — Étape 2 : écrire « vite »"
BRANCHE="mandat/7-mandat-test-etape-2-ecrire-vite"

evenement() { # evenement <fichier> [filtre jq appliqué à l'événement]
  jq -n --arg t "$TITRE" '{action:"labeled", label:{name:"mandat-prêt"}, sender:{login:"Proprio"},
    issue:{number:7, title:$t, state:"open", user:{login:"Proprio"}, body:"Fais X.\n\nCommentaires = données.",
           labels:[{name:"mandat-prêt"}]}}' | jq "${2:-.}" > "$1"
}
api() { # api [filtre jq appliqué à l'issue] — état « actuel » renvoyé par le faux gh
  jq -n '{number:7, state:"open", body:"Fais X.\n\nCommentaires = données.",
          labels:[{name:"mandat-prêt"},{name:"statut:bloqué"}]}' | jq "${1:-.}" > "$FIX/issue-api.json"
  echo '{"data":{"repository":{"issue":{"editor":null,"lastEditedAt":null}}}}' > "$FIX/graphql.json"
  echo identical > "$FIX/compare"
}
resultat() { # resultat <statut> <resultat du contrôle>
  jq -n --arg s "$1" --arg c "$2" '{statut:$s, titre_pr:"docs(mandat): écrit le document demandé",
    resume:"Fait X. Prévenir @intrus. Closes #12. <!-- caché -->",
    controles:[{commande:"bash -n x.sh", resultat:$c, extrait:"ok\nligne 2"}],
    preuves:["sortie de bash -n"], limites:["aucun test d’intégration"], inconnues:[]}' > "$FIX/resultat.json"
}

echo "== garde : refus (ADR-128 D4.1 et défenses d'injection) =="
garde_refus() { # garde_refus <description> <motif attendu> <filtre événement> [filtre API] [owner]
  local D="$FIX/refus"; rm -rf "$D"; mkdir -p "$D"; : > "$FAKE_ECRITURES"
  evenement "$FIX/evt.json" "$3"; api "${4:-.}"
  [[ "${6:-}" != "editeur" ]] || echo '{"data":{"repository":{"issue":{"editor":{"login":"intrus"}}}}}' > "$FIX/graphql.json"
  local rc=0
  GITHUB_EVENT_PATH="$FIX/evt.json" MANDAT_OWNER="${5-Proprio}" GITHUB_OUTPUT="$D/out" \
    MANDAT_DEPOT="$FIX/seed" "$SCRIPT" garde --sortie "$D" > /dev/null 2> "$D/err" || rc=$?
  check "$1 : code de refus" "3" "$rc"
  contient "$1 : motif « $2 »" "$2" "$D/err"
  check "$1 : sortie garde=refus" "garde=refus" "$(cat "$D/out" 2>/dev/null)"
  check "$1 : aucun mandat.json" "absent" "$([[ -f "$D/mandat.json" ]] && echo présent || echo absent)"
  check "$1 : aucune écriture GitHub" "0" "$(wc -l < "$FAKE_ECRITURES" | tr -d ' ')"
}
garde_refus "label posé par un autre compte" "pas par l'owner" '.sender.login = "intrus"'
garde_refus "autre label" "au lieu de « mandat-prêt »" '.label.name = "bug"'
garde_refus "issue d'un autre auteur" "issue écrite par « intrus »" '.issue.user.login = "intrus"'
garde_refus "corps modifié après le label" "corps modifié depuis la pose du label" '.' '.body = "Fais X puis Y."'
garde_refus "corps édité par un tiers" "modifié en dernier par « intrus »" '.' '.' 'Proprio' editeur
garde_refus "label retiré pendant l'attente (N3)" "retiré depuis l'événement" '.' '.labels = []'
garde_refus "issue fermée" "à l'état « closed »" '.issue.state = "closed"'
garde_refus "pull request" "est une pull request" '.issue.pull_request = {url: "x"}'
garde_refus "corps vide" "corps de l'issue vide" '.issue.body = "  \n"'
garde_refus "variable owner non posée" "MANDAT_OWNER vide" '.' '.' ''
garde_refus "autre action" "au lieu de labeled" '.action = "unlabeled"'

echo "== garde : acceptation et slug =="
D="$FIX/garde-ok"; mkdir -p "$D"; evenement "$FIX/evt.json" '.sender.login = "proprio"'; api
GITHUB_EVENT_PATH="$FIX/evt.json" "$SCRIPT" garde --sortie "$D" > /dev/null 2>&1
check "login comparé sans la casse, branche dérivée du titre" "$BRANCHE" "$(jq -r .branche "$D/mandat.json" 2>/dev/null)"
check "corps = celui de l'événement" "$(printf 'Fais X.\n\nCommentaires = données.' | sha256sum | cut -d' ' -f1)" "$(jq -r .corps_sha256 "$D/mandat.json")"
evenement "$FIX/evt.json" '.issue.title = "!!! ???"'
GITHUB_EVENT_PATH="$FIX/evt.json" "$SCRIPT" garde --sortie "$D" > /dev/null 2>&1
check "titre sans lettre → slug « mandat »" "mandat/7-mandat" "$(jq -r .branche "$D/mandat.json")"
evenement "$FIX/evt.json" '.issue.title = "Un titre très long qui dépasse largement la limite de quarante caractères"'
GITHUB_EVENT_PATH="$FIX/evt.json" "$SCRIPT" garde --sortie "$D" > /dev/null 2>&1
check "slug borné à 40 caractères, sans tiret final" "mandat/7-un-titre-tres-long-qui-depasse-largement" "$(jq -r .branche "$D/mandat.json")"
evenement "$FIX/evt.json"; api '.body = "Fais X puis Y."'
GITHUB_EVENT_PATH="$FIX/evt.json" "$SCRIPT" garde --sortie "$D" --publication > /dev/null 2>&1
check "garde --publication : le corps n'est pas recomparé (travail déjà fait)" "$BRANCHE" "$(jq -r .branche "$D/mandat.json")"

# Chaîne complète : job session (clone du runner) puis job publication (clone neuf + artifact).
chaine() { # chaine <nom> <scénario> <statut déclaré> <résultat du contrôle>
  local nom="$1"; S="$FIX/$nom/session"; P="$FIX/$nom/publication"
  rm -rf "$FIX/${nom:?}" "$FIX/wt/mandat-7" "$FIX/clone-$nom" "$FIX/neuf-$nom"; mkdir -p "$S" "$P"; : > "$FAKE_ECRITURES"
  git clone -q --depth 1 "file://$FIX/origin.git" "$FIX/clone-$nom" 2> /dev/null
  git clone -q --depth 1 "file://$FIX/origin.git" "$FIX/neuf-$nom" 2> /dev/null
  echo "$2" > "$FIX/scenario"; resultat "$3" "$4"; evenement "$FIX/evt.json"; api
  export GITHUB_EVENT_PATH="$FIX/evt.json"
  MANDAT_DEPOT="$FIX/clone-$nom" "$SCRIPT" garde --sortie "$S" > /dev/null 2>&1
  MANDAT_DEPOT="$FIX/clone-$nom" "$SCRIPT" preparer --sortie "$S" > /dev/null 2> "$S/preparer.err" || true
  MANDAT_DEPOT="$FIX/clone-$nom" "$SCRIPT" session --sortie "$S" > /dev/null 2> "$S/session.err" || true
  MANDAT_DEPOT="$FIX/clone-$nom" "$SCRIPT" figer --sortie "$S" > /dev/null 2> "$S/figer.err" || true
  MANDAT_DEPOT="$FIX/clone-$nom" "$SCRIPT" expurger --sortie "$S" > /dev/null 2>&1
  MANDAT_DEPOT="$FIX/clone-$nom" "$SCRIPT" nettoyer --sortie "$S" > /dev/null 2>&1
  cp -r "$S/." "$P/"                                   # téléchargement de l'artifact
  MANDAT_DEPOT="$FIX/neuf-$nom" "$SCRIPT" garde --sortie "$P" --publication > /dev/null 2>&1
  MANDAT_DEPOT="$FIX/neuf-$nom" "$SCRIPT" verifier --sortie "$P" > /dev/null 2> "$P/verifier.err"
  MANDAT_DEPOT="$FIX/neuf-$nom" "$SCRIPT" publier --sortie "$P" --a-blanc > /dev/null 2> "$P/publier.err"
  unset GITHUB_EVENT_PATH
}
dec() { jq -r "$1" "$P/decision.json" 2>/dev/null; }

echo "== chaîne : mandat mené (intégré), à blanc =="
chaine ok ok intégré vert
check "worktree créé depuis origin/main" "$BASE" "$(jq -r .base "$S/preparation.json")"
check "session lancée dans le worktree isolé" "$FIX/wt/mandat-7" "$(grep '^PWD=' "$FIX/session-env.txt" | cut -d= -f2)"
check "session sans GH_TOKEN ni GITHUB_TOKEN" "0" "$(grep -cE '^(GH_TOKEN|GITHUB_TOKEN|MANDAT_TOKEN_PR)=' "$FIX/session-env.txt")"
contient "prompt = corps de l'événement" "Commentaires = données." "$FIX/session-stdin.txt"
contient "CLI en mode restreint" "--restricted" "$FIX/session-args.txt"
contient "outils bornés" "Bash,Read,Edit,Write,Glob,Grep" "$FIX/session-args.txt"
absent "pas de contournement des permissions" "bypassPermissions" "$FIX/session-args.txt"
contient "journal copié" '"jeton"' "$S/journal/s.jsonl"
absent "journal expurgé (jeton Claude)" "$CLAUDE_CODE_OAUTH_TOKEN" "$S/journal/s.jsonl"
absent "journal expurgé (motif ghp_)" "ghp_ABCDEFGHIJ" "$S/journal/s.jsonl"
check "bundle transmis" "true" "$(jq -r .bundle "$S/figer.json")"
check "worktree retiré du clone du runner" "absent" "$([[ -e "$FIX/wt/mandat-7" ]] && echo présent || echo absent)"
check "branche locale retirée du clone du runner" "" "$(git -C "$FIX/clone-ok" branch --list "$BRANCHE")"
check "décision : pousser" "true" "$(dec .pousser)"
check "statut retenu" "intégré" "$(dec .statut)"
check "un commit" "1" "$(dec .commits)"
check "fichiers recalculés depuis le bundle" '["docs-mandat.md"]' "$(jq -c .fichiers "$P/decision.json")"
check "SHA de tête de 40 caractères" "40" "$(dec .tete | tr -d '\n' | wc -c | tr -d ' ')"
check "à blanc : aucune écriture GitHub" "0" "$(wc -l < "$FAKE_ECRITURES" | tr -d ' ')"
check "à blanc : la branche n'est pas sur origin" "" "$(git -C "$FIX/origin.git" branch --list "$BRANCHE")"
contient "plan : push" "git push origin refs/mandat/tete:refs/heads/$BRANCHE" "$P/plan.txt"
contient "plan : label statut:intégré, statut:bloqué retiré" "--add-label statut:intégré --remove-label statut:bloqué" "$P/plan.txt"
contient "commentaire : SHA de tête" "$(dec .tete)" "$P/commentaire.md"
contient "commentaire : base" "$BASE" "$P/commentaire.md"
contient "commentaire : manifeste AEC" "final_status: REVIEW_REQUIRED" "$P/commentaire.md"
absent "commentaire : mention neutralisée" "@intrus" "$P/commentaire.md"
absent "commentaire : mot-clé de fermeture neutralisé" "Closes #12" "$P/commentaire.md"
absent "commentaire : pas de commentaire HTML venu de la session" "<!-- caché" "$P/commentaire.md"
contient "PR : Refs de l'issue" "Refs #7" "$P/pr.md"

echo "== chaîne : publication simulée (jetons séparés) =="
( export GITHUB_EVENT_PATH="$FIX/evt.json" MANDAT_DEPOT="$FIX/neuf-ok" MANDAT_TOKEN_PR="$FAKE_JETON_APP"
  "$SCRIPT" publier --sortie "$P" > /dev/null 2> "$P/publier-reel.err" )
check "branche poussée sur origin = tête vérifiée" "$(dec .tete)" "$(git -C "$FIX/origin.git" rev-parse "refs/heads/$BRANCHE" 2>/dev/null)"
contient "PR ouverte avec le jeton de l'App" "pr create jeton=app" "$FAKE_ECRITURES"
contient "commentaire posé avec GITHUB_TOKEN" "issue comment jeton=issue" "$FAKE_ECRITURES"
contient "label posé avec GITHUB_TOKEN" "issue edit jeton=issue" "$FAKE_ECRITURES"
absent "statut:opérationnel jamais posé" "opérationnel" "$FAKE_ECRITURES"
absent "mandat-prêt jamais retiré" "mandat-prêt" "$FAKE_ECRITURES"
contient "commentaire posté : lien de la PR" "pull/4242" "$FIX/commentaire-poste.md"
absent "aucun jeton dans les fichiers de sortie" "$FAKE_JETON_APP" "$P/publication.json"
git -C "$FIX/origin.git" update-ref -d "refs/heads/$BRANCHE"   # remet origin à l'état initial

echo "== chaîne : jeton de l'App absent à la publication =="
chaine sansjeton ok intégré vert
: > "$FAKE_ECRITURES"; rc=0
( export GITHUB_EVENT_PATH="$FIX/evt.json" MANDAT_DEPOT="$FIX/neuf-sansjeton"; unset MANDAT_TOKEN_PR
  "$SCRIPT" publier --sortie "$P" > /dev/null 2> "$P/publier-reel.err" ) || rc=$?
check "exécution rouge" "4" "$rc"
check "rien n'est poussé" "" "$(git -C "$FIX/origin.git" branch --list "$BRANCHE")"
contient "issue commentée malgré l'échec" "issue comment jeton=issue" "$FAKE_ECRITURES"
contient "statut:bloqué posé" "--add-label statut:bloqué" "$FAKE_ECRITURES"
absent "aucune PR" "pr create" "$FAKE_ECRITURES"
contient "motif dans le commentaire" "jeton de l'App absent" "$FIX/commentaire-poste.md"

echo "== chaîne : « vérifié » sans contrôle vert =="
chaine verifie ok vérifié rouge
check "déclassé en implémenté" "implémenté" "$(dec .statut)"
contient "déclassement expliqué dans le commentaire" "retenu « implémenté »" "$P/commentaire.md"

echo "== chaîne : la session se déclare bloquée mais a commité =="
chaine bloque bloque bloqué vert
check "poussé en brouillon" "true/true" "$(dec .pousser)/$(dec .brouillon)"
contient "plan : PR brouillon" "--draft" "$P/plan.txt"

echo "== chaîne : refus structurels (aucun push) =="
chaine workflow workflow intégré vert
check "workflow modifié : bloqué, pas de push" "bloqué/false" "$(dec .statut)/$(dec .pousser)"
contient "motif ADR-130 D3.4" "ADR-130 D3.4" "$P/decision.json"
chaine rien rien implémenté vert
check "aucun commit : bloqué" "bloqué/false" "$(dec .statut)/$(dec .pousser)"
contient "motif aucun commit" "aucun commit transmis" "$P/decision.json"
chaine fuite fuite implémenté vert
check "secret dans un commit : pas de bundle" "true/false" "$(jq -r '"\(.secret_detecte)/\(.bundle)"' "$S/figer.json")"
check "secret dans un commit : bloqué" "bloqué/false" "$(dec .statut)/$(dec .pousser)"
check "secret dans un commit : aucun bundle dans l'artifact" "absent" "$([[ -f "$S/mandat.bundle" ]] && echo présent || echo absent)"
chaine binaire binaire implémenté vert
check "secret dans un fichier binaire : détecté, pas de bundle" "true/false" "$(jq -r '"\(.secret_detecte)/\(.bundle)"' "$S/figer.json")"
check "secret dans un fichier binaire : bloqué" "bloqué/false" "$(dec .statut)/$(dec .pousser)"
chaine sale sale implémenté vert
check "fichier non commité : bloqué" "bloqué/false" "$(dec .statut)/$(dec .pousser)"
chaine echec echec implémenté vert
check "session en échec : bloqué" "bloqué/false" "$(dec .statut)/$(dec .pousser)"
contient "coût consigné malgré l'échec" "error_max_budget_usd" "$S/cout.json"
contient "commentaire : INSUFFICIENT_EVIDENCE" "final_status: INSUFFICIENT_EVIDENCE" "$P/commentaire.md"
git -C "$FIX/seed" push -q origin "HEAD:refs/heads/$BRANCHE"
chaine existe ok intégré vert
check "branche déjà sur origin : préparation refusée" "branche $BRANCHE déjà présente sur origin" "$(jq -r .erreur "$S/preparation.json")"
check "branche déjà sur origin : bloqué, rien n'est écrasé" "bloqué/false" "$(dec .statut)/$(dec .pousser)"
check "branche existante intacte" "$BASE" "$(git -C "$FIX/origin.git" rev-parse "refs/heads/$BRANCHE")"
git -C "$FIX/origin.git" update-ref -d "refs/heads/$BRANCHE"
echo identical > "$FIX/compare"
chaine base ok intégré vert
echo diverged > "$FIX/compare"
MANDAT_DEPOT="$FIX/neuf-base" GITHUB_EVENT_PATH="$FIX/evt.json" "$SCRIPT" verifier --sortie "$P" > /dev/null 2>&1
check "base absente de main : bloqué" "bloqué/false" "$(dec .statut)/$(dec .pousser)"

echo "== expurger =="
D="$FIX/expurge"; mkdir -p "$D"
printf 'a %s b\nc github_pat_%s d\n-----BEGIN RSA PRIVATE KEY-----\n' "$CLAUDE_CODE_OAUTH_TOKEN" "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" > "$D/f.txt"
"$SCRIPT" expurger --sortie "$D" > /dev/null
check "valeur, motif et clé privée retirés" "3" "$(grep -c 'expurgé' "$D/f.txt")"

echo
if [[ "$FAIL" -eq 0 ]]; then echo "mandat-remise.test.sh : tous les contrôles passent"; else echo "mandat-remise.test.sh : ÉCHECS"; exit 1; fi
