#!/usr/bin/env bash
# Routine mandat-remise (ADR-128 D4, étape 2 de D8) — remise d'un mandat par issue GitHub.
#
# Job « session » (runner auto-hébergé `agents`, GITHUB_TOKEN en lecture seule, aucune clé d'App) :
#   mandat-remise.sh garde    --sortie DIR      événement + API : label, expéditeur, auteur, corps figé
#   mandat-remise.sh preparer --sortie DIR      worktree isolé, branche mandat/<N>-<slug> sur origin/main
#   mandat-remise.sh session  --sortie DIR      claude -p dans le worktree, sans jeton GitHub
#   mandat-remise.sh figer    --sortie DIR      état du worktree, recherche de secrets, bundle git
#   mandat-remise.sh expurger --sortie DIR      retire les secrets des fichiers avant l'artifact
#   mandat-remise.sh nettoyer --sortie DIR      retire le worktree et la branche locale du clone
# Job « publication » (runner hébergé par GitHub, jeton de l'App créé dans ce job seulement) :
#   mandat-remise.sh garde    --sortie DIR --publication   événement + label encore présent (N3)
#   mandat-remise.sh verifier --sortie DIR      recalcule tout depuis le bundle : base, commits,
#                                               fichiers, workflows, secrets, branche distante
#   mandat-remise.sh publier  --sortie DIR [--a-blanc]
#                                               push + PR (jeton de l'App), commentaire AEC et label
#                                               statut:* (GITHUB_TOKEN) ; --a-blanc : aucune écriture
#
# La routine ne pose jamais `statut:opérationnel`, ne retire jamais `mandat-prêt` et ne fusionne rien.
# Environnement : REPO (owner/nom) ; MANDAT_OWNER (compte de l'owner, variable fixée à l'activation) ;
# GITHUB_EVENT_PATH ; gh authentifié par GH_TOKEN ; pour `session`, CLAUDE_CODE_OAUTH_TOKEN ou, à
# défaut, ANTHROPIC_API_KEY ; pour `publier`, MANDAT_TOKEN_PR (jeton d'installation de l'App).
# Apostrophes typographiques voulues dans les textes français (littérales, entre quotes).
# shellcheck disable=SC1112
set -euo pipefail

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Clone git sur lequel la routine travaille : le checkout du job (MANDAT_DEPOT ne sert qu'aux tests).
RACINE="${MANDAT_DEPOT:-$(cd "$ICI/../.." && pwd)}"

: "${REPO:?REPO (owner/nom) manquant}"
LABEL="${MANDAT_LABEL:-mandat-prêt}"
OWNER="${MANDAT_OWNER:-}"
MODELE="${MANDAT_MODELE:-claude-opus-5-5}"
BUDGET="${MANDAT_BUDGET_USD:-20}"
CLI_VERSION="${MANDAT_CLI_VERSION:-2.1.316}"
BASE_BRANCHE="${MANDAT_BASE:-main}"
RACINE_WT="${MANDAT_WORKTREES:-${RUNNER_TEMP:-/tmp}}"
GIT_NOM="${MANDAT_GIT_NOM:-mandat-remise}"
GIT_EMAIL="${MANDAT_GIT_EMAIL:-mandat-remise@users.noreply.github.com}"
OUTILS="Bash,Read,Edit,Write,Glob,Grep"
STATUTS="implémenté intégré vérifié bloqué"     # statut:opérationnel reste à l'owner (D4.3)
MOTIFS_SECRETS='sk-ant-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|-----BEGIN ([A-Z]+ )?PRIVATE KEY-----'
# Motifs qui retiennent tout le journal de session au lieu d'être expurgés : clé PEM (le corps
# survivrait au remplacement de l'en-tête), JWT, identifiants dans une URL, clé AWS, en-tête Bearer,
# paramètres RSA du fichier d'identité d'un runner (guillemets échappés ou non dans le JSONL).
MOTIFS_RETENUE='-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}|[A-Za-z][A-Za-z0-9+.-]*://[^/[:space:]:@"]+:[^/[:space:]@"]+@|AKIA[0-9A-Z]{16}|[Bb]earer [A-Za-z0-9._~+/=-]{20,}|\\?"(modulus|inverseQ|privateExponent)\\?"'
VARS_SECRETES="CLAUDE_CODE_OAUTH_TOKEN ANTHROPIC_API_KEY GH_TOKEN GITHUB_TOKEN MANDAT_TOKEN_PR"

die() { echo "mandat-remise : $*" >&2; exit 1; }
refus() { # refus de la garde : aucune écriture GitHub, exécution rouge visible dans Actions
  echo "mandat-remise : refus — $*" >&2
  [[ -z "${GITHUB_OUTPUT:-}" ]] || echo "garde=refus" >> "$GITHUB_OUTPUT"
  exit 3
}
sortie_gh() { [[ -z "${GITHUB_OUTPUT:-}" ]] || echo "$1" >> "$GITHUB_OUTPUT"; }

CMD="${1:-}"; shift || true
SORTIE=""; A_BLANC=0; PUBLICATION=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --sortie) SORTIE="$2"; shift 2 ;;
    --a-blanc) A_BLANC=1; shift ;;
    --publication) PUBLICATION=1; shift ;;
    *) die "argument inconnu : $1" ;;
  esac
done
[[ -n "$SORTIE" ]] || die "--sortie DIR obligatoire"
mkdir -p "$SORTIE/brut"

# git sur un dépôt que la session a pu toucher (config partagée par le worktree) : sans jeton dans
# l'environnement, sans config système ni globale, sans fsmonitor ni hook.
git_sur() { local d="$1"; shift
  env -i PATH="$PATH" HOME="$(mktemp -d)" GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null \
    git -c core.fsmonitor=false -c core.hooksPath=/dev/null -C "$d" "$@"; }

meme_compte() { [[ -n "$1" && "${1,,}" == "${2,,}" ]]; }   # logins GitHub insensibles à la casse

slug() { # titre → [a-z0-9-], 40 caractères au plus (substitutions littérales, sans dépendance de locale)
  local s
  s="$(printf '%s' "$1" | sed -e 's/à/a/g;s/â/a/g;s/ä/a/g;s/á/a/g;s/À/a/g;s/Â/a/g;s/Ä/a/g' \
      -e 's/é/e/g;s/è/e/g;s/ê/e/g;s/ë/e/g;s/É/e/g;s/È/e/g;s/Ê/e/g;s/Ë/e/g' \
      -e 's/î/i/g;s/ï/i/g;s/Î/i/g;s/Ï/i/g;s/ô/o/g;s/ö/o/g;s/Ô/o/g;s/Ö/o/g' \
      -e 's/ù/u/g;s/û/u/g;s/ü/u/g;s/Ù/u/g;s/Û/u/g;s/Ü/u/g;s/ç/c/g;s/Ç/c/g' \
      -e 's/œ/oe/g;s/Œ/oe/g;s/æ/ae/g;s/Æ/ae/g' \
    | LC_ALL=C tr 'A-Z' 'a-z' | LC_ALL=C tr -c 'a-z0-9' '-' | tr -s '-' \
    | sed -e 's/^-//' | cut -c1-40 | sed -e 's/-$//')"
  printf '%s' "${s:-mandat}"
}

valeurs_secretes() { # écrit dans $1 les valeurs secrètes présentes dans l'environnement (≥ 8 car.)
  local v x; : > "$1"
  for v in $VARS_SECRETES; do
    x="${!v:-}"
    if [[ "${#x}" -ge 8 ]]; then printf '%s\n' "$x" >> "$1"; fi
  done
  return 0
}

garde() {
  local evt="${GITHUB_EVENT_PATH:-}"
  [[ -n "$OWNER" ]] || refus "MANDAT_OWNER vide (variable d'activation non posée)"
  [[ -f "$evt" ]] || die "GITHUB_EVENT_PATH absent"
  local action label sender auteur etat est_pr num titre
  action="$(jq -r '.action // ""' "$evt")"
  label="$(jq -r '.label.name // ""' "$evt")"
  sender="$(jq -r '.sender.login // ""' "$evt")"
  auteur="$(jq -r '.issue.user.login // ""' "$evt")"
  etat="$(jq -r '.issue.state // ""' "$evt")"
  est_pr="$(jq -r 'if .issue.pull_request then "oui" else "non" end' "$evt")"
  num="$(jq -r '.issue.number // ""' "$evt")"
  titre="$(jq -r '.issue.title // ""' "$evt")"
  [[ "$action" == "labeled" ]] || refus "action « $action » au lieu de labeled"
  [[ "$label" == "$LABEL" ]] || refus "label « $label » au lieu de « $LABEL »"
  meme_compte "$sender" "$OWNER" || refus "label posé par « $sender », pas par l'owner"
  meme_compte "$auteur" "$OWNER" || refus "issue écrite par « $auteur », pas par l'owner"
  [[ "$etat" == "open" ]] || refus "issue à l'état « $etat »"
  [[ "$est_pr" == "non" ]] || refus "#$num est une pull request"
  [[ "$num" =~ ^[0-9]+$ ]] || refus "numéro d'issue invalide : « $num »"

  # Le prompt est le corps tel qu'il figurait dans l'événement, jamais relu ensuite (D4.2).
  jq -j '.issue.body // ""' "$evt" > "$SORTIE/corps.md"
  [[ -n "$(tr -d '[:space:]' < "$SORTIE/corps.md")" ]] || refus "corps de l'issue vide"
  local h; h="$(sha256sum < "$SORTIE/corps.md" | cut -d' ' -f1)"

  # État actuel de l'issue : le job peut attendre (file du runner, D3) ; un label retiré entre-temps
  # gèle le mandat (arrêt N3, D6).
  gh api "repos/$REPO/issues/$num" > "$SORTIE/brut/issue.json" || die "lecture de l'issue #$num impossible"
  jq -e --arg l "$LABEL" 'any(.labels[]?; .name == $l)' "$SORTIE/brut/issue.json" > /dev/null \
    || refus "label « $LABEL » retiré depuis l'événement (arrêt N3)"
  [[ "$(jq -r '.state // ""' "$SORTIE/brut/issue.json")" == "open" ]] || refus "issue fermée depuis l'événement"

  if [[ "$PUBLICATION" -eq 0 ]]; then
    # Corps figé : toute modification après la pose du label refuse le mandat (le relancer = retirer
    # puis reposer le label sur le corps voulu).
    local ha; ha="$(jq -j '.body // ""' "$SORTIE/brut/issue.json" | sha256sum | cut -d' ' -f1)"
    [[ "$ha" == "$h" ]] || refus "corps modifié depuis la pose du label (sha256 événement $h, actuel $ha)"
    gh api graphql -F i="$num" -f o="${REPO%%/*}" -f n="${REPO#*/}" -f query='
      query($o: String!, $n: String!, $i: Int!) {
        repository(owner: $o, name: $n) { issue(number: $i) { editor { login } lastEditedAt } } }' \
      > "$SORTIE/brut/editeur.json" || die "lecture du dernier éditeur impossible"
    local editeur; editeur="$(jq -r '.data.repository.issue.editor.login // ""' "$SORTIE/brut/editeur.json")"
    [[ -z "$editeur" ]] || meme_compte "$editeur" "$OWNER" \
      || refus "corps modifié en dernier par « $editeur », pas par l'owner"
  fi

  local s br; s="$(slug "$titre")"; br="mandat/$num-$s"
  jq -n --argjson n "$num" --arg t "$titre" --arg a "$auteur" --arg e "$sender" --arg l "$LABEL" \
    --arg s "$s" --arg b "$br" --arg h "$h" --arg run "${GITHUB_RUN_ID:-local}" \
    '{issue: $n, titre: $t, auteur: $a, expediteur: $e, label: $l, slug: $s, branche: $b,
      corps_sha256: $h, run_id: $run}' > "$SORTIE/mandat.json"
  sortie_gh "garde=ok"; sortie_gh "issue=$num"; sortie_gh "branche=$br"
  jq -c . "$SORTIE/mandat.json"
}

preparer() {
  [[ -f "$SORTIE/mandat.json" ]] || die "mandat.json absent : lancer garde d'abord"
  local n br wt base rc=0
  n="$(jq -r .issue "$SORTIE/mandat.json")"; br="$(jq -r .branche "$SORTIE/mandat.json")"
  wt="$RACINE_WT/mandat-$n"
  echo_prep() { jq -n --arg w "$wt" --arg b "$br" --arg base "${base:-}" --arg err "$1" \
    '{worktree: $w, branche: $b, base: (if $base == "" then null else $base end),
      erreur: (if $err == "" then null else $err end)}' > "$SORTIE/preparation.json"; }
  git -C "$RACINE" fetch --no-tags --depth=1 origin \
    "+refs/heads/$BASE_BRANCHE:refs/remotes/origin/$BASE_BRANCHE" \
    || { echo_prep "fetch de origin/$BASE_BRANCHE impossible"; die "fetch de origin/$BASE_BRANCHE impossible"; }
  base="$(git -C "$RACINE" rev-parse "refs/remotes/origin/$BASE_BRANCHE")"
  git -C "$RACINE" ls-remote --exit-code --heads origin "refs/heads/$br" > /dev/null || rc=$?
  case "$rc" in
    0) echo_prep "branche $br déjà présente sur origin"; die "branche $br déjà présente sur origin" ;;
    2) ;;
    *) echo_prep "ls-remote en échec (code $rc)"; die "ls-remote en échec (code $rc)" ;;
  esac
  # Le clone du runner est réutilisé d'un job à l'autre : on retire un reste éventuel d'un run
  # précédent (worktree et branche locale de ce même mandat, jamais d'autres).
  git -C "$RACINE" worktree prune
  [[ ! -e "$wt" ]] || { echo_prep "$wt existe déjà"; die "$wt existe déjà"; }
  git -C "$RACINE" branch -D "$br" > /dev/null 2>&1 || true
  git -C "$RACINE" worktree add --quiet -b "$br" "$wt" "$base"
  echo_prep ""
  sortie_gh "worktree=$wt"
  jq -c . "$SORTIE/preparation.json"
}

ecrire_cout() { # ecrire_cout <sessions> [fichier sortie CLI] [erreur]
  jq -n --argjson s "$1" --arg brut "${2:-}" --arg err "${3:-}" --arg modele "$MODELE" \
    --arg cli "$CLI_VERSION" --arg auth "${AUTH:-}" --arg run "${GITHUB_RUN_ID:-local}" \
    --arg jour "$(date -u +%F)" --arg issue "$(jq -r '.issue // ""' "$SORTIE/mandat.json" 2>/dev/null)" \
    --slurpfile r "${2:-/dev/null}" '
    ($r[0] // {}) as $o
    | { jour: $jour, run_id: $run, issue: (if $issue == "" then null else ($issue | tonumber) end),
        sessions_ouvertes: $s, modele: $modele, cli_version: $cli,
        authentification: (if $auth == "" then null else $auth end),
        total_cost_usd: ($o.total_cost_usd // 0),
        usage: { input_tokens: ($o.usage.input_tokens // 0),
                 output_tokens: ($o.usage.output_tokens // 0),
                 cache_creation_input_tokens: ($o.usage.cache_creation_input_tokens // 0),
                 cache_read_input_tokens: ($o.usage.cache_read_input_tokens // 0) },
        num_turns: ($o.num_turns // null), duration_ms: ($o.duration_ms // null),
        subtype: ($o.subtype // null), erreur: (if $err == "" then null else $err end) }' \
    > "$SORTIE/cout.json"
}

session() {
  [[ -f "$SORTIE/preparation.json" ]] || die "preparation.json absent : lancer preparer d'abord"
  local wt br base n titre
  wt="$(jq -r .worktree "$SORTIE/preparation.json")"; br="$(jq -r .branche "$SORTIE/preparation.json")"
  base="$(jq -r '.base // ""' "$SORTIE/preparation.json")"
  n="$(jq -r .issue "$SORTIE/mandat.json")"; titre="$(jq -r .titre "$SORTIE/mandat.json")"
  [[ -d "$wt" && -n "$base" ]] || die "worktree absent : préparation incomplète"
  local auth
  if [[ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]]; then
    AUTH=abonnement; auth=(CLAUDE_CODE_OAUTH_TOKEN="$CLAUDE_CODE_OAUTH_TOKEN")
  elif [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
    AUTH=cle-api; auth=(ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY")
  else
    local m="secret CLAUDE_CODE_OAUTH_TOKEN (ou ANTHROPIC_API_KEY) absent"
    ecrire_cout 0 "" "$m"; die "$m"
  fi
  { printf 'Mandat remis par l’issue #%s (« %s »). Branche %s, base %s (origin/%s).\n\n' \
      "$n" "$titre" "$br" "$base" "$BASE_BRANCHE"
    cat "$SORTIE/corps.md"; } > "$SORTIE/entree.md"
  local tmp rc=0; tmp="$(mktemp -d)"
  # Environnement vidé : ni GH_TOKEN, ni GITHUB_TOKEN, ni variable du runner ; HOME jetable (aucun
  # réglage utilisateur) ; outils fichiers et Bash seulement, aucun MCP, aucune commande slash.
  ( cd "$wt" && env -i PATH="$PATH" HOME="$tmp" LANG=C.UTF-8 "${auth[@]}" \
      GIT_AUTHOR_NAME="$GIT_NOM" GIT_AUTHOR_EMAIL="$GIT_EMAIL" \
      GIT_COMMITTER_NAME="$GIT_NOM" GIT_COMMITTER_EMAIL="$GIT_EMAIL" \
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 \
      npx -y "@anthropic-ai/claude-code@$CLI_VERSION" -p \
        "Exécute le mandat fourni sur l'entrée standard dans ce worktree, puis rends l'objet JSON demandé." \
        --output-format json --json-schema "$(cat "$ICI/mandat-remise.schema.json")" \
        --append-system-prompt "$(cat "$ICI/mandat-remise.prompt.md")" \
        --model "$MODELE" --max-budget-usd "$BUDGET" --permission-mode dontAsk \
        --restricted --strict-mcp-config --disable-slash-commands \
        --tools "$OUTILS" --allowedTools "$OUTILS" \
        < "$SORTIE/entree.md" > "$SORTIE/session.json" 2> "$SORTIE/session.stderr" ) || rc=$?
  # Journal complet (transcription de la session) pour l'artifact ; expurgé avant envoi.
  mkdir -p "$SORTIE/journal"
  if [[ -d "$tmp/.claude/projects" ]]; then
    find "$tmp/.claude/projects" -type f -name '*.jsonl' -exec cp {} "$SORTIE/journal/" \;
  fi
  rm -rf "$tmp"
  if ! jq -e . "$SORTIE/session.json" > /dev/null 2>&1; then
    ecrire_cout 1 "" "sortie de session illisible (code $rc)"; die "sortie de session illisible (code $rc)"
  fi
  if [[ "$rc" -ne 0 ]] || jq -e '.is_error == true or (.structured_output == null)' "$SORTIE/session.json" > /dev/null; then
    ecrire_cout 1 "$SORTIE/session.json" "session en échec (code $rc, $(jq -r '.subtype // "?"' "$SORTIE/session.json"))"
    die "session en échec (code $rc)"
  fi
  ecrire_cout 1 "$SORTIE/session.json"
  jq '.structured_output' "$SORTIE/session.json" > "$SORTIE/resultat.json"
  jq '{sessions_ouvertes, total_cost_usd, usage, num_turns}' "$SORTIE/cout.json"
}

recherche_secrets() { # recherche_secrets <git -C ...> <base> <tete> → 0 si un secret est trouvé
  local depot="$1" base="$2" tete="$3" valeurs texte; valeurs="$(mktemp)"; texte="$(mktemp)"
  valeurs_secretes "$valeurs"
  # Texte écrit d'abord dans un fichier : avec pipefail, `git … | grep -q` peut échouer par SIGPIPE
  # quand grep trouve tôt, et un secret passerait alors pour absent.
  # --text : un fichier binaire est lu comme du texte, sinon son contenu échappe à la recherche.
  { git_sur "$depot" diff --text --no-ext-diff --no-textconv "$base" "$tete"
    git_sur "$depot" log --format='%B' "$base..$tete"; } > "$texte" || { rm -f "$valeurs" "$texte"; die "lecture du diff impossible"; }
  local trouve=1
  if grep -qE -- "$MOTIFS_SECRETS|$MOTIFS_RETENUE" "$texte"; then trouve=0; fi
  if [[ -s "$valeurs" ]] && grep -qF -f "$valeurs" "$texte"; then trouve=0; fi
  rm -f "$valeurs" "$texte"
  return "$trouve"
}

figer() {
  [[ -f "$SORTIE/preparation.json" ]] || die "preparation.json absent"
  local wt br base
  wt="$(jq -r .worktree "$SORTIE/preparation.json")"; br="$(jq -r .branche "$SORTIE/preparation.json")"
  base="$(jq -r '.base // ""' "$SORTIE/preparation.json")"
  [[ -d "$wt" && -n "$base" ]] || die "worktree absent : préparation incomplète"
  local vide; vide="$(mktemp -d)"
  # Lecture du worktree sans jeton dans l'environnement ni réglage exécutable (fsmonitor, hooks).
  g() { env -i PATH="$PATH" HOME="$vide" GIT_CONFIG_NOSYSTEM=1 \
          git -c core.fsmonitor=false -c core.hooksPath=/dev/null -C "$wt" "$@"; }
  local sale tete commits=0 ancetre=false fuite=false bundle=false
  sale="$(g status --porcelain --untracked-files=all | wc -l | tr -d ' ')"
  tete="$(g rev-parse --verify --quiet "refs/heads/$br" || true)"
  if [[ -n "$tete" ]] && g merge-base --is-ancestor "$base" "$tete" 2>/dev/null; then
    ancetre=true; commits="$(g rev-list --count "$base..$tete")"
    if recherche_secrets "$wt" "$base" "$tete"; then fuite=true; fi
  fi
  # Bundle (commits seulement, base exclue) transmis au job de publication ; jamais si un secret
  # est présent : l'artifact d'un dépôt public est téléchargeable.
  if [[ "$ancetre" == true && "$commits" -gt 0 && "$fuite" == false ]]; then
    g bundle create --quiet "$SORTIE/mandat.bundle" "refs/heads/$br" "^$base" && bundle=true
  fi
  rm -rf "$vide"
  jq -n --argjson sale "$sale" --arg tete "$tete" --argjson commits "$commits" \
    --argjson ancetre "$ancetre" --argjson fuite "$fuite" --argjson bundle "$bundle" \
    '{fichiers_non_commites: $sale, tete: (if $tete == "" then null else $tete end),
      commits: $commits, base_ancetre: $ancetre, secret_detecte: $fuite, bundle: $bundle}' \
    > "$SORTIE/figer.json"
  jq -c . "$SORTIE/figer.json"
}

retenir() { # fail-closed : retient ce qu'un remplacement n'expurge pas sûrement (tout DIR, bundle exclu)
  local j="$SORTIE/journal" f trouve=false somme
  # Journal : retenu en entier si l'un de ses fichiers contient un motif.
  if [[ -d "$j" ]]; then
    while IFS= read -r -d '' f; do
      if grep -qE -- "$MOTIFS_RETENUE" "$f"; then trouve=true; fi
    done < <(find "$j" -type f -print0)
    if [[ "$trouve" == true ]]; then
      local note; note="$(mktemp)"
      { echo "Journal retenu : un motif de clé ou de jeton non expurgeable par remplacement y figure."
        echo "Il n'est pas publié dans l'artifact (dépôt public). Empreintes des fichiers retirés :"
        ( cd "$j" && find . -type f -exec sha256sum {} + ); } > "$note"
      rm -rf "$j"; mkdir -p "$j"; mv "$note" "$j/RETENU.txt"
      echo "expurger : journal retenu (motif non expurgeable)"
    fi
  fi
  # Autres fichiers (sortie et erreurs de session, résultat, entrée…) : remplacés un à un par une
  # empreinte ; un JSON reste un JSON, que verifier lit comme un résultat retenu.
  while IFS= read -r -d '' f; do
    grep -qE -- "$MOTIFS_RETENUE" "$f" || continue
    somme="$(sha256sum "$f" | cut -d' ' -f1)"
    case "$f" in
      *.json) jq -n --arg s "$somme" '{retenu: true, sha256: $s}' > "$f" ;;
      *) printf 'Fichier retenu (motif de clé ou de jeton non expurgeable), sha256 %s\n' "$somme" > "$f" ;;
    esac
    echo "expurger : ${f#"$SORTIE"/} retenu (motif non expurgeable)"
  done < <(find "$SORTIE" -type f ! -name '*.bundle' ! -path "$j/*" -print0)
}

expurger() { # remplace les valeurs secrètes et les motifs de jetons dans les fichiers texte de DIR
  # D'abord la rétention : une clé PEM ne s'expurge pas par le remplacement de son en-tête.
  retenir
  local valeurs n=0 f; valeurs="$(mktemp)"; valeurs_secretes "$valeurs"
  while IFS= read -r -d '' f; do
    if grep -qE -- "$MOTIFS_SECRETS" "$f" || { [[ -s "$valeurs" ]] && grep -qF -f "$valeurs" "$f"; }; then
      n=$((n + 1))
      MANDAT_VALEURS="$valeurs" perl -pi -e '
        BEGIN { open(my $h, "<", $ENV{MANDAT_VALEURS}); @v = grep { length } map { chomp; $_ } <$h>; }
        for my $x (@v) { s/\Q$x\E/[expurgé]/g }
        s/sk-ant-[A-Za-z0-9_-]{20,}/[expurgé]/g;
        s/gh[pousr]_[A-Za-z0-9]{30,}/[expurgé]/g;
        s/github_pat_[A-Za-z0-9_]{30,}/[expurgé]/g;
        s/-----BEGIN ([A-Z]+ )?PRIVATE KEY-----/[clé privée expurgée]/g;' "$f"
    fi
  done < <(find "$SORTIE" -type f ! -name '*.bundle' -print0)
  rm -f "$valeurs"
  echo "expurger : $n fichier(s) modifié(s)"
}

nettoyer() {
  [[ -f "$SORTIE/preparation.json" ]] || { echo "rien à nettoyer"; return 0; }
  local wt br; wt="$(jq -r .worktree "$SORTIE/preparation.json")"; br="$(jq -r .branche "$SORTIE/preparation.json")"
  git_sur "$RACINE" worktree remove --force "$wt" 2>/dev/null || rm -rf "$wt"
  git_sur "$RACINE" worktree prune
  git_sur "$RACINE" branch -D "$br" > /dev/null 2>&1 || true
  echo "nettoyé : $wt, branche locale $br"
}

verifier() {
  [[ -f "$SORTIE/mandat.json" ]] || die "mandat.json absent : lancer garde --publication d'abord"
  local n br; n="$(jq -r .issue "$SORTIE/mandat.json")"; br="$(jq -r .branche "$SORTIE/mandat.json")"
  local -a bloquants=() notes=()
  local base="" tete="" commits=0 fichiers="[]" statut_session="" statut declasse=""

  # Préparation (job session) : la base doit être un commit de la branche de base.
  base="$(jq -r '.base // ""' "$SORTIE/preparation.json" 2>/dev/null || true)"
  local err_prep; err_prep="$(jq -r '.erreur // ""' "$SORTIE/preparation.json" 2>/dev/null || true)"
  [[ -z "$err_prep" ]] || bloquants+=("préparation : $err_prep")
  if [[ ! "$base" =~ ^[0-9a-f]{40}$ ]]; then
    bloquants+=("base absente ou invalide"); base=""
  else
    local cmp; cmp="$(gh api "repos/$REPO/compare/$base...$BASE_BRANCHE" --jq .status 2>/dev/null || true)"
    [[ "$cmp" == "identical" || "$cmp" == "ahead" ]] \
      || { bloquants+=("base $base absente de $BASE_BRANCHE (compare : ${cmp:-erreur})"); base=""; }
  fi

  # Résultat de la session : rendu dans la PR et le commentaire publics, donc refusé s'il contient
  # un motif de clé ou de jeton (recontrôlé ici : le job session partage l'uid de la session).
  # Contrôle sur le texte brut ET sur les chaînes décodées par jq : un échappement JSON (-…)
  # masquerait un motif au grep brut alors que le rendu le décode.
  if [[ -f "$SORTIE/resultat.json" ]]; then
    local decode; decode="$(mktemp)"
    jq -r '.. | strings' "$SORTIE/resultat.json" > "$decode" 2> /dev/null || true
    if jq -e '.retenu? == true' "$SORTIE/resultat.json" > /dev/null 2>&1 \
       || grep -qE -- "$MOTIFS_SECRETS|$MOTIFS_RETENUE" "$SORTIE/resultat.json" \
       || grep -qE -- "$MOTIFS_SECRETS|$MOTIFS_RETENUE" "$decode"; then
      bloquants+=("résultat de session retenu : motif de clé ou de jeton, rien n'en est publié")
      jq -n '{retenu: true}' > "$SORTIE/resultat.json"
    fi
    rm -f "$decode"
  fi
  # Résultat de la session : objet du schéma, statut parmi les quatre autorisés.
  if jq -e --arg s "$STATUTS" '(.statut | type == "string") and ((.statut) as $x | ($s | split(" ") | index($x)) != null)
        and (.titre_pr | type == "string") and (.controles | type == "array")' "$SORTIE/resultat.json" > /dev/null 2>&1; then
    statut_session="$(jq -r .statut "$SORTIE/resultat.json")"
  else
    notes+=("résultat de session absent ou hors schéma : session en échec ou interrompue")
  fi

  # Worktree : fichiers non commités (constat du job session).
  local sale; sale="$(jq -r '.fichiers_non_commites // 0' "$SORTIE/figer.json" 2>/dev/null || echo 0)"
  [[ "$sale" =~ ^[0-9]+$ ]] || sale=0
  [[ "$sale" -eq 0 ]] || bloquants+=("$sale fichier(s) non commité(s) dans le worktree : travail incomplet")
  [[ "$(jq -r '.secret_detecte // false' "$SORTIE/figer.json" 2>/dev/null)" != "true" ]] \
    || bloquants+=("secret détecté dans les commits : rien n'est transmis ni poussé")

  # Commits : recalculés ici depuis le bundle, sans rien croire du job session.
  if [[ -n "$base" && -f "$SORTIE/mandat.bundle" ]]; then
    git -C "$RACINE" fetch --no-tags --depth=1 origin "$base" > /dev/null 2>&1 || true
    if git -C "$RACINE" bundle verify "$SORTIE/mandat.bundle" > /dev/null 2>&1 \
       && git -C "$RACINE" fetch --no-tags "$SORTIE/mandat.bundle" "+refs/heads/$br:refs/mandat/tete" > /dev/null 2>&1; then
      tete="$(git -C "$RACINE" rev-parse refs/mandat/tete)"
      if git -C "$RACINE" merge-base --is-ancestor "$base" "$tete"; then
        commits="$(git -C "$RACINE" rev-list --count "$base..$tete")"
        # Chemins bruts séparés par NUL : sans -z, git cite un chemin non ASCII entre guillemets
        # (".github/workflows/\303\251.yml") et le filtre ci-dessous ne le reconnaîtrait pas.
        fichiers="$(git -C "$RACINE" -c core.quotePath=false diff -z --no-renames --name-only "$base" "$tete" \
          | jq -Rsc 'split("\u0000") | map(select(length > 0))')"
        [[ "$commits" -gt 0 ]] || bloquants+=("aucun commit au-dessus de la base")
        # Tout .github/ : workflows, mais aussi actions composites et réglages que ces workflows exécutent.
        if jq -e 'any(.[]; startswith(".github/"))' <<< "$fichiers" > /dev/null; then
          bloquants+=("fichier sous .github/ modifié (workflows, actions, réglages CI) : interdit à une identité d'agent (ADR-130 D3.4)")
        fi
        if recherche_secrets "$RACINE" "$base" "$tete"; then
          bloquants+=("secret détecté dans les commits")
        fi
      else
        bloquants+=("la branche ne descend pas de la base $base"); tete=""
      fi
    else
      bloquants+=("bundle illisible ou sans la branche $br")
    fi
  elif [[ -n "$base" ]]; then
    bloquants+=("aucun commit transmis par la session")
  fi

  # Branche distante : une branche déjà poussée n'est jamais écrasée.
  local rc=0
  git -C "$RACINE" ls-remote --exit-code --heads origin "refs/heads/$br" > /dev/null 2>&1 || rc=$?
  [[ "$rc" -ne 0 ]] || bloquants+=("branche $br déjà présente sur origin")

  local pousser=false brouillon=false
  if [[ "${#bloquants[@]}" -gt 0 ]]; then
    statut="bloqué"
  else
    pousser=true
    if [[ -z "$statut_session" ]]; then
      statut="bloqué"
    elif [[ "$statut_session" == "vérifié" ]] \
         && ! jq -e 'any(.controles[]?; .resultat == "vert")' "$SORTIE/resultat.json" > /dev/null; then
      statut="implémenté"; declasse="« vérifié » déclaré sans contrôle vert cité : retenu « implémenté »"
    else
      statut="$statut_session"
    fi
    [[ "$statut" != "bloqué" ]] || brouillon=true
  fi
  local b_json n_json
  b_json="$(printf '%s\n' "${bloquants[@]}" | jq -R 'select(length > 0)' | jq -sc .)"
  n_json="$(printf '%s\n' "${notes[@]}" | jq -R 'select(length > 0)' | jq -sc .)"
  jq -n --argjson n "$n" --arg br "$br" --arg base "$base" --arg tete "$tete" --argjson c "$commits" \
    --argjson f "$fichiers" --arg ss "$statut_session" --arg s "$statut" --arg d "$declasse" \
    --argjson p "$pousser" --argjson bd "$brouillon" --argjson b "$b_json" --argjson notes "$n_json" \
    '{issue: $n, branche: $br, base: (if $base == "" then null else $base end),
      tete: (if $tete == "" then null else $tete end), commits: $c, fichiers: $f,
      statut_session: (if $ss == "" then null else $ss end), statut: $s,
      declassement: (if $d == "" then null else $d end),
      pousser: $p, brouillon: $bd, bloquants: $b, notes: $notes}' > "$SORTIE/decision.json"
  sortie_gh "pousser=$pousser"
  jq -c . "$SORTIE/decision.json"
}

# Texte venu de la session ou de l'issue : aucune mention (@), aucun mot-clé de fermeture, aucun
# commentaire HTML caché, sur une seule ligne quand il entre dans une liste.
JQ_NEUTRE='def neutre: tostring | gsub("@"; "@\u200b") | gsub("<!--"; "&lt;!--")
  | gsub("(?<k>(?i:\\b(close[sd]?|fix(e[sd])?|resolve[sd]?)))(?<s>\\s+)#"; "\(.k)\(.s)#\u200b");
  def ligne: neutre | gsub("[\\r\\n]+"; " ") | gsub("`"; "'"'"'");'

rediger() { # rediger <url PR ou vide> <raison push/PR ou vide> → corps de PR et commentaire AEC
  local pr_url="$1" echec="$2"
  local run_url="${GITHUB_SERVER_URL:-https://github.com}/$REPO/actions/runs/${GITHUB_RUN_ID:-0}"
  [[ -f "$SORTIE/resultat.json" ]] || echo 'null' > "$SORTIE/resultat.json"
  [[ -f "$SORTIE/cout.json" ]] || echo '{}' > "$SORTIE/cout.json"
  local commun
  commun=(--slurpfile d "$SORTIE/decision.json" --slurpfile m "$SORTIE/mandat.json"
          --slurpfile r "$SORTIE/resultat.json" --slurpfile c "$SORTIE/cout.json"
          --arg pr "$pr_url" --arg echec "$echec" --arg run "$run_url" --arg base_br "$BASE_BRANCHE"
          --arg modele "$MODELE" --arg cli "$CLI_VERSION"
          --argjson retenu "$([[ -f "$SORTIE/journal/RETENU.txt" ]] && echo true || echo false)")

  jq -nr "${commun[@]}" "$JQ_NEUTRE"'
    $d[0] as $d | $m[0] as $m | ($r[0] // {}) as $r
    | "Mandat : #\($m.issue) (corps sha256 `\($m.corps_sha256)`), remis par la routine `mandat-remise` "
      + "([run](\($run))). Refs #\($m.issue)\n\n"
      + "## Résumé (déclaré par la session)\n\n\(($r.resume // "aucun résumé : session en échec") | neutre)\n\n"
      + "## Contrôles déclarés\n\n"
      + (if (($r.controles // []) | length) == 0 then "aucun\n"
         else ([$r.controles[] | "- **\(.resultat | ligne)** — `\(.commande | ligne)` — \(.extrait | ligne)"] | join("\n")) + "\n" end)
      + "\n## Limites\n\n" + (if (($r.limites // []) | length) == 0 then "aucune déclarée\n"
         else ([$r.limites[] | "- \(ligne)"] | join("\n")) + "\n" end)
      + "\nStatut retenu par la routine : `statut:\($d.statut)`"
      + (if $d.declassement then " (\($d.declassement))" else "" end) + ".\n"
      + "La fusion reste à l’owner (G4) ; `statut:opérationnel` aussi.\n"' > "$SORTIE/pr.md"

  jq -nr "${commun[@]}" "$JQ_NEUTRE"'
    $d[0] as $d | $m[0] as $m | ($r[0] // {}) as $r | ($c[0] // {}) as $c
    | ($d.fichiers // []) as $f
    | "<!-- mandat-remise:run:\($run) -->\n"
      + "## Remise du mandat #\($m.issue) — `statut:\($d.statut)`\n\n"
      + "| Champ | Valeur |\n|---|---|\n"
      + "| Session | [run](\($run)) · \($modele) · CLI \($cli) · \(($c.num_turns // "?") | tostring) tours |\n"
      + "| Worktree | `mandat-\($m.issue)` sous `RUNNER_TEMP` du runner `agents` (éphémère, retiré en fin de job) |\n"
      + "| Branche | `\($d.branche)` |\n"
      + "| Base | `origin/\($base_br)` @ `\($d.base // "inconnue")` |\n"
      + "| PR | \(if $pr != "" then $pr + (if $d.brouillon then " (brouillon)" else "" end) else "aucune" + (if $echec != "" then " — " + ($echec | ligne) else "" end) end) |\n"
      + "| SHA de tête | `\($d.tete // "aucun")` |\n"
      + "| Commits | \($d.commits) |\n\n"
      + (if ($d.bloquants | length) > 0 then "### Blocages constatés par la routine\n\n" + ([$d.bloquants[] | "- \(ligne)"] | join("\n")) + "\n\n" else "" end)
      + (if ($d.notes | length) > 0 then ([$d.notes[] | "- \(ligne)"] | join("\n")) + "\n\n" else "" end)
      + "### Fichiers (\($f | length))\n\n"
      + (if ($f | length) == 0 then "aucun\n" else ([$f[:50][] | "- `\(ligne)`"] | join("\n")) + (if ($f | length) > 50 then "\n- … (\(($f | length) - 50) de plus, voir la PR)" else "" end) + "\n" end)
      + "\n### Résumé (déclaré par la session)\n\n\(($r.resume // "aucun : session en échec ou interrompue") | neutre)\n"
      + (if $r.raison_blocage then "\nRaison du blocage déclarée : \($r.raison_blocage | ligne)\n" else "" end)
      + "\n### Contrôles (déclarés par la session ; commandes dans le journal)\n\n"
      + (if (($r.controles // []) | length) == 0 then "aucun\n"
         else ([$r.controles[] | "- **\(.resultat | ligne)** — `\(.commande | ligne)` — \(.extrait | ligne)"] | join("\n")) + "\n" end)
      + "\n### Preuves\n\n" + (if (($r.preuves // []) | length) == 0 then "aucune\n" else ([$r.preuves[] | "- \(ligne)"] | join("\n")) + "\n" end)
      + "\n### Limites\n\n" + (if (($r.limites // []) | length) == 0 then "aucune déclarée\n" else ([$r.limites[] | "- \(ligne)"] | join("\n")) + "\n" end)
      + "\n### Inconnues\n\n" + (if (($r.inconnues // []) | length) == 0 then "aucune déclarée\n" else ([$r.inconnues[] | "- \(ligne)"] | join("\n")) + "\n" end)
      + "\n### Routine\n\n"
      + "- statut déclaré par la session : \($d.statut_session // "aucun") ; statut retenu : `statut:\($d.statut)`"
      + (if $d.declassement then " — \($d.declassement)" else "" end) + "\n"
      + "- coût : \(($c.total_cost_usd // 0) | tostring) USD ; jetons entrée \(($c.usage.input_tokens // 0) | tostring), sortie \(($c.usage.output_tokens // 0) | tostring)\n"
      + (if $retenu then "- journal **retenu** (motif de clé ou de jeton non expurgeable, voir `journal/RETENU.txt`) ; résultat, coût et bundle : artifact `mandat-remise-\($m.run_id)` (90 jours)\n"
         else "- journal complet, résultat, coût et bundle : artifact `mandat-remise-\($m.run_id)` (90 jours)\n" end)
      + "- `statut:opérationnel` et la fusion restent à l’owner ; `mandat-prêt` n’est pas retiré par la routine\n\n"
      + "<details><summary>Manifeste de couverture (AEC 1.2.0)</summary>\n\n```yaml\n"
      + "scope_requested: \"mandat de l’issue #\($m.issue) (corps sha256 \($m.corps_sha256))\"\n"
      + "scope_actually_scanned: \"déclaré par la session, non recalculé par la routine (voir journal)\"\n"
      + "excluded_paths: [\".github/** (ADR-130 D3.4)\"]\n"
      + "corrections_proposed: \"\($d.commits) commit(s) sur \($d.branche)\"\n"
      + "corrections_applied: \"aucune sur \($base_br) (fusion réservée à l’owner)\"\n"
      + "validation_executed: \"\(($r.controles // []) | length) contrôle(s) déclaré(s), \(([($r.controles // [])[] | select(.resultat == "vert")] | length)) vert(s)\"\n"
      + "remaining_unknowns: \((($r.inconnues // []) | length)) déclarée(s)\n"
      + "final_status: \(if $d.statut == "bloqué" then "INSUFFICIENT_EVIDENCE" else "REVIEW_REQUIRED" end)\n"
      + "```\n\n</details>\n"' > "$SORTIE/commentaire.tmp"
  # Borne de GitHub (65 536 car.) : coupe depuis un fichier, pas par un pipe (SIGPIPE sous pipefail).
  head -c 60000 "$SORTIE/commentaire.tmp" > "$SORTIE/commentaire.md"; rm -f "$SORTIE/commentaire.tmp"
}

publier() {
  [[ -f "$SORTIE/decision.json" ]] || die "decision.json absent : lancer verifier d'abord"
  local n br pousser brouillon statut titre
  n="$(jq -r .issue "$SORTIE/decision.json")"; br="$(jq -r .branche "$SORTIE/decision.json")"
  pousser="$(jq -r .pousser "$SORTIE/decision.json")"; brouillon="$(jq -r .brouillon "$SORTIE/decision.json")"
  statut="$(jq -r .statut "$SORTIE/decision.json")"
  titre="$(jq -r "$JQ_NEUTRE"' (.titre_pr // "") | ligne' "$SORTIE/resultat.json" 2>/dev/null || true)"
  [[ -n "$titre" ]] || titre="chore(mandat): remise du mandat #$n"
  local pr_url="" echec=""
  : > "$SORTIE/plan.txt"

  if [[ "$pousser" == "true" ]]; then
    rediger "" ""
    if [[ "$A_BLANC" -eq 1 ]]; then
      echo "git push origin refs/mandat/tete:refs/heads/$br" >> "$SORTIE/plan.txt"
      echo "gh pr create --base $BASE_BRANCHE --head $br$([[ "$brouillon" == true ]] && echo ' --draft')" >> "$SORTIE/plan.txt"
    else
      local entete=""
      [[ -z "${MANDAT_TOKEN_PR:-}" ]] \
        || entete="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$MANDAT_TOKEN_PR" | base64 -w0)"
      # Jeton passé par l'environnement de git (jamais sur la ligne de commande) ; pas de hook.
      if [[ -z "$entete" ]]; then
        echec="jeton de l'App absent : rien n'est poussé"; statut="bloqué"
      elif GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0="http.https://github.com/.extraheader" GIT_CONFIG_VALUE_0="$entete" \
           git -C "$RACINE" -c core.hooksPath=/dev/null push --quiet origin "refs/mandat/tete:refs/heads/$br" \
           > "$SORTIE/brut/push.log" 2>&1; then
        local args=(--repo "$REPO" --base "$BASE_BRANCHE" --head "$br" --title "$titre" --body-file "$SORTIE/pr.md")
        [[ "$brouillon" != "true" ]] || args+=(--draft)
        pr_url="$(GH_TOKEN="$MANDAT_TOKEN_PR" gh pr create "${args[@]}" 2> "$SORTIE/brut/pr.log" | tail -n1 || true)"
        [[ "$pr_url" =~ /pull/[0-9]+$ ]] || { echec="branche poussée, PR non ouverte"; pr_url=""; statut="bloqué"; }
      else
        echec="push refusé"; statut="bloqué"
      fi
    fi
  fi
  if [[ "$statut" != "$(jq -r .statut "$SORTIE/decision.json")" ]]; then
    jq --arg s "$statut" --arg e "$echec" '.statut = $s | .bloquants += [$e]' "$SORTIE/decision.json" > "$SORTIE/decision.tmp"
    mv "$SORTIE/decision.tmp" "$SORTIE/decision.json"
  fi
  rediger "$pr_url" "$echec"

  # Label statut:* : le statut retenu remplace les autres statuts gérés ; opérationnel n'est jamais
  # posé ni retiré par la routine.
  local -a retirer=()
  local s
  for s in $STATUTS; do
    [[ "$s" == "$statut" ]] && continue
    jq -e --arg l "statut:$s" 'any(.labels[]?; .name == $l)' "$SORTIE/brut/issue.json" > /dev/null 2>&1 \
      && retirer+=("statut:$s")
  done
  local edit=(--repo "$REPO" --add-label "statut:$statut")
  [[ "${#retirer[@]}" -eq 0 ]] || edit+=(--remove-label "$(IFS=,; echo "${retirer[*]}")")
  if [[ "$A_BLANC" -eq 1 ]]; then
    echo "gh issue comment $n --body-file commentaire.md" >> "$SORTIE/plan.txt"
    echo "gh issue edit $n ${edit[*]:2}" >> "$SORTIE/plan.txt"
  else
    gh issue comment "$n" --repo "$REPO" --body-file "$SORTIE/commentaire.md" > /dev/null
    gh issue edit "$n" "${edit[@]}" > /dev/null
  fi
  jq -n --slurpfile d "$SORTIE/decision.json" --arg pr "$pr_url" --arg e "$echec" --argjson ab "$A_BLANC" \
    '$d[0] + {pr: (if $pr == "" then null else $pr end), echec_publication: (if $e == "" then null else $e end),
              a_blanc: ($ab == 1)}' > "$SORTIE/publication.json"
  jq -c '{issue, statut, pousser, pr, tete, commits, bloquants, a_blanc}' "$SORTIE/publication.json"
  # Échec de publication : l'issue a reçu le commentaire et statut:bloqué, l'exécution reste rouge.
  [[ -z "$echec" ]] || { echo "mandat-remise : publication en échec — $echec" >&2; exit 4; }
}

case "$CMD" in
  garde) garde ;;
  preparer) preparer ;;
  session) session ;;
  figer) figer ;;
  expurger) expurger ;;
  nettoyer) nettoyer ;;
  verifier) verifier ;;
  publier) publier ;;
  *) die "commande inconnue : « $CMD » (garde|preparer|session|figer|expurger|nettoyer|verifier|publier)" ;;
esac
