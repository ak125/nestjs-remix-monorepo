#!/usr/bin/env bash
# Codex contrôleur — relecture après coup, en lecture seule, de ce qui est fusionné sur main.
#
# routine:
#   id: codex-controleur
#   owner: Marwane
#   departement: 23-ia-agents
#   kpi: absent (useful_capabilities_not_complexity, producteur absent)
#   trigger: minuteur systemd utilisateur de la machine DEV, une fois par jour
#            (automecanik-codex-controleur.timer, livré non installé)
#   approach: liste les PR fusionnées sur main depuis le dernier passage réussi (curseur gardé
#             hors dépôt), les fait relire une par une par `codex exec` en lecture seule dans un
#             worktree jetable à jour de main, avec la consigne permanente (consigne.md) et la
#             sortie sous schéma (constats.schema.json) ; range les constats bruts hors dépôt et
#             écrit un résumé du jour. Ne bloque, n'écrit, ne corrige et ne publie rien.
#   evidence: $ETAT/bruts/<jour>/<objet>/ (événements, last.json, méta) + $ETAT/resume-<jour>.md ;
#             dernier état dans ~/.local/state/automecanik/cron/codex-controleur.json (cron_report),
#             affiché par le hook SessionStart
#   escalation: quota épuisé, version de Codex inattendue ou échec = arrêt propre, curseur
#               inchangé, état « error »/« warn » visible au début de chaque session Claude ;
#               reprise au passage suivant sans rien sauter ; arrêt = systemctl --user disable --now
#               automecanik-codex-controleur.timer
#   secret: aucun dans le dépôt ; compte Codex de la machine DEV (auth.json jamais lu par la routine)
#
# Usage :
#   codex-controleur.sh init --depuis 2026-11-19T00:00:00Z   crée le curseur (refus s'il existe)
#   codex-controleur.sh quotidien [--max N]                   relit les PR fusionnées depuis le curseur
#   codex-controleur.sh lot --nom NOM --liste FICHIER [--departement NN]
#                                                             audit d'un lot de fichiers (curseur intact)
#   codex-controleur.sh ignorer --pr N --motif TEXTE          marque une PR comme non relue, avec motif
#   codex-controleur.sh commande                              affiche la commande Codex effective
# Codes de sortie : 0 fait ; 1 échec ; 2 usage ; 4 version de Codex inattendue ; 5 quota épuisé ;
#   6 curseur absent ; 7 passage déjà en cours.
# Apostrophes typographiques voulues dans les textes français.
# shellcheck disable=SC1112
set -euo pipefail
umask 077   # constats bruts privés : ils peuvent citer le contenu des fichiers lus

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONSIGNE="$ICI/consigne.md"
SCHEMA="$ICI/constats.schema.json"
DEPOT="${CODEX_CONTROLEUR_DEPOT:-$(cd "$ICI/../../.." && pwd)}"
ETAT="${CODEX_CONTROLEUR_ETAT:-${XDG_STATE_HOME:-$HOME/.local/state}/automecanik/codex-controleur}"
BIN="${CODEX_CONTROLEUR_BIN:-codex}"
VERSION="${CODEX_CONTROLEUR_VERSION:-0.170.0}"
MODELE="${CODEX_CONTROLEUR_MODELE:-gpt-6.2-astra}"
EFFORT="${CODEX_CONTROLEUR_EFFORT:-high}"
MAX_PR="${CODEX_CONTROLEUR_MAX_PR:-40}"
DIFF_MAX="${CODEX_CONTROLEUR_DIFF_MAX:-400000}"   # octets ; au-delà, le diff est remplacé par sa liste
BRANCHE="${CODEX_CONTROLEUR_BRANCHE:-main}"
JOB="codex-controleur"
# Fichiers générés retirés du diff joint (Codex peut toujours les lire dans le worktree).
EXCLUS=(':(exclude)package-lock.json' ':(exclude)**/package-lock.json' ':(exclude)audit/registry/**'
        ':(exclude).claude/knowledge/REPO_MAP.md' ':(exclude)audit/dependencies/**'
        ':(exclude)audit/cleanup/pr-8-controlled-cleanup-candidates.json'
        ':(exclude)audit/cleanup/pr-8-deletion-proof.md' ':(exclude)audit/module-boundaries.json')
# Codes d'erreur de Codex qui signalent la fin du quota ou une limite de débit (relevés dans le
# binaire 0.170.0) : arrêt propre, reprise au passage suivant.
QUOTA_RE='usage_limit_(reached|exceeded)|usage limit|quota_exceeded|quota exceeded|credits_depleted|rate_limit_exceeded|spend_limit_exceeded'
# Formes de clé (jeton JWT, clé secrète Supabase), courriel et téléphone français : un constat qui
# en contient une est retenu hors du résumé (donnée personnelle ou secret possible, dépôt public).
SENSIBLE_RE='eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|sb_secret_[A-Za-z0-9_-]{8,}|[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}|(\+33|\b0)[1-9]([ .-]?[0-9]{2}){4}\b'

die() { echo "codex-controleur : $*" >&2; exit "${2:-1}"; }
usage() { sed -n '/^# Usage :/,/^# Codes de sortie/p' "${BASH_SOURCE[0]}" >&2; exit 2; }
horodate() { date -u +%Y-%m-%dT%H:%M:%SZ; }
# Tout appel gh nomme son dépôt GitHub : l'URL du remote origin de $DEPOT (une seule source,
# CODEX_CONTROLEUR_DEPOT). Sans -R, gh le déduit du répertoire courant, qui n'est pas un dépôt
# sous systemd (mandat EF : échec du 2026-11-20 05:30 UTC, lancement depuis $HOME).
gh_depot() {
  local url; url="$(git -C "$DEPOT" remote get-url origin)" || die "remote origin illisible dans $DEPOT"
  gh -R "$url" "$@"
}

# Rapport d'état local (lu par le hook SessionStart) ; ne fait jamais échouer la routine.
rapport() { # statut durée résumé métriques-json
  local lib="$DEPOT/scripts/cron/lib-supabase-report.sh"
  [[ -f "$lib" ]] || { echo "codex-controleur : rapport non enregistré ($lib absent)" >&2; return 0; }
  # shellcheck source=/dev/null
  source "$lib"
  CRON_REPORT_MAX_AGE_S="${CRON_REPORT_MAX_AGE_S:-129600}" cron_report "$JOB" "$1" "$2" "$4" "$3" || true
}

CMD="${1:-}"; shift || true
DEPUIS=""; NOM=""; LISTE=""; DEPT=""; PR=""; MOTIF=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --depuis) DEPUIS="${2:-}"; shift 2 ;;
    --max) MAX_PR="${2:-}"; shift 2 ;;
    --nom) NOM="${2:-}"; shift 2 ;;
    --liste) LISTE="${2:-}"; shift 2 ;;
    --departement) DEPT="${2:-}"; shift 2 ;;
    --pr) PR="${2:-}"; shift 2 ;;
    --motif) MOTIF="${2:-}"; shift 2 ;;
    *) usage ;;
  esac
done
[[ "$MAX_PR" =~ ^[1-9][0-9]*$ ]] || die "--max doit être un entier positif" 2

# Clone dédié (décision de Marwane du 2026-11-19) : la routine fait fetch et worktree jetable dans
# son propre clone (~/codex-controleur/app), jamais dans le checkout DEV partagé. Gardes posées
# avant toute écriture. CODEX_CONTROLEUR_PROTEGE ajoute un checkout protégé (tests) ; il ne retire
# jamais /opt/automecanik/app.
PROTEGES=(/opt/automecanik/app)
[[ -z "${CODEX_CONTROLEUR_PROTEGE:-}" ]] || PROTEGES+=("$CODEX_CONTROLEUR_PROTEGE")
[[ "$(realpath -m "$DEPOT")" != "/opt/automecanik/app" ]] \
  || die "dépôt refusé : /opt/automecanik/app est le checkout partagé ; utiliser le clone dédié ~/codex-controleur/app" 2
# Dépôt Git commun : un worktree lié du checkout partagé écrirait fetch et worktrees dans son .git.
commun="$(git -C "$DEPOT" rev-parse --path-format=absolute --git-common-dir 2> /dev/null)" \
  || die "dépôt refusé : $DEPOT n'est pas un dépôt Git lisible" 2
commun="$(realpath -e "$commun")" || die "dépôt refusé : dépôt Git commun de $DEPOT introuvable" 2
etat_canon="$(realpath -m "$ETAT")"
for p in "${PROTEGES[@]}"; do
  p="$(realpath -m "$p")"
  pc="$(git -C "$p" rev-parse --path-format=absolute --git-common-dir 2> /dev/null || echo "$p/.git")"
  [[ "$commun" != "$(realpath -m "$pc")" ]] \
    || die "dépôt refusé : $DEPOT partage le dépôt Git de $p (worktree lié) ; utiliser le clone dédié ~/codex-controleur/app" 2
  # Dossier d'état : mkdir et chmod 700 ne visent jamais le checkout partagé ni un de ses dossiers.
  [[ "$etat_canon" != "$p" && "$etat_canon" != "$p/"* ]] \
    || die "dossier d'état refusé : $ETAT est dans le checkout partagé $p" 2
done

CURSEUR="$ETAT/curseur.json"   # {"depuis": ISO, "faites": [{"pr": N, "fusion": ISO, "statut": ...}]}
mkdir -p "$ETAT/bruts"
# umask ne resserre pas un dossier déjà là (créé avant, ou par un autre outil) : droits posés ici.
chmod 700 "$ETAT" "$ETAT/bruts"

# --- Commande Codex : cadre éprouvé par l'essai CP (lecture seule, sans configuration utilisateur) ---
WT=""
paquet_codex() { # dossier packages/standalone de l'installation de Codex, s'il existe
  local b; b="$(readlink -f "$(command -v "$BIN")" 2>/dev/null)" || return 0
  while [[ "$b" != "/" && -n "$b" ]]; do
    [[ "$(basename "$b")" == "standalone" ]] && { echo "$b"; return 0; }
    b="$(dirname "$b")"
  done
}
commande_codex() { # remplit le tableau CODEX_CMD ; $1 = fichier last.json
  local git_commun pkg perms
  git_commun="${GIT_COMMUN:-$(git -C "$WT" rev-parse --path-format=absolute --git-common-dir)}"
  pkg="$(paquet_codex)"
  perms="{\":minimal\"=\"read\",\"$WT\"=\"read\",\"$git_commun\"=\"read\""
  [[ -z "$pkg" ]] || perms+=",\"$pkg\"=\"read\""
  perms+="}"
  CODEX_CMD=("$BIN" exec --ignore-user-config --ignore-rules --ephemeral -s read-only
    -c 'shell_environment_policy.inherit="core"'
    --disable apps --disable plugins --disable remote_plugin --disable hooks
    --disable browser_use --disable browser_use_external --disable computer_use
    --disable in_app_browser --disable image_generation --disable multi_agent
    --disable tool_suggest --disable skill_mcp_dependency_install --disable goals
    --json
    -c 'default_permissions="controleur"'
    -c "permissions.controleur.filesystem=$perms"
    -m "$MODELE" -c "model_reasoning_effort=\"$EFFORT\""
    -C "$WT" --output-schema "$SCHEMA" -o "$1")
}

verifier_codex() {
  command -v "$BIN" > /dev/null || die "Codex introuvable ($BIN)" 4
  local v; v="$("$BIN" --version 2>&1 | head -n1)" || true
  [[ "$v" == "codex-cli $VERSION" ]] || {
    rapport error 0 "version de Codex inattendue : « $v », attendue codex-cli $VERSION ; rien relu" '{}'
    die "version de Codex inattendue : « $v », attendue codex-cli $VERSION" 4
  }
}

preparer_worktree() {
  git -C "$DEPOT" fetch -q origin "$BRANCHE" || die "fetch de origin/$BRANCHE impossible"
  WT="$ETAT/wt-$(date -u +%Y%m%dT%H%M%S)-$$"
  git -C "$DEPOT" worktree add -q --detach "$WT" "origin/$BRANCHE" 2> /dev/null \
    || die "worktree jetable impossible sous $WT"
  trap 'git -C "$DEPOT" worktree remove --force "$WT" 2> /dev/null || rm -rf "$WT"' EXIT
  BASE="$(git -C "$WT" rev-parse HEAD)"
}

# Un passage Codex : $1 = dossier de sortie, $2 = texte de l'objet, $3 = entrée standard (ou vide).
# Retour : 0 constats valides ; 5 quota ; 1 autre échec.
passage() {
  local d="$1" objet="$2" entree="${3:-/dev/null}" debut fin code=0 empreinte
  mkdir -p "$d"
  # Empreinte prise sur le texte réellement joint au prompt, pas sur le fichier en fin de passage.
  { cat "$CONSIGNE"; printf '\nOBJET DU PASSAGE\n%s\n' "$objet"; } > "$d/prompt.txt"
  empreinte="$(sed '/^OBJET DU PASSAGE$/,$d' "$d/prompt.txt" | head -c -1 | sha256sum | cut -d' ' -f1)"
  commande_codex "$d/last.json"
  debut=$(date +%s)
  env -u GH_TOKEN -u GITHUB_TOKEN -u GH_ENTERPRISE_TOKEN "${CODEX_CMD[@]}" "$(cat "$d/prompt.txt")" \
    < "$entree" > "$d/evenements.jsonl" 2> "$d/stderr.txt" || code=$?
  fin=$(date +%s)
  jq -n --arg base "$BASE" --arg modele "$MODELE" --arg effort "$EFFORT" --arg version "$VERSION" \
    --arg consigne "$empreinte" --argjson code "$code" \
    --argjson duree $((fin - debut)) --slurpfile u <(jq -c 'select(.type=="turn.completed")|.usage' \
      "$d/evenements.jsonl" 2> /dev/null || true) \
    '{base:$base, modele:$modele, effort:$effort, codex:$version, consigne_sha256:$consigne,
      code:$code, duree_s:$duree,
      entree:([$u[].input_tokens//0]|add//0), cache:([$u[].cached_input_tokens//0]|add//0),
      sortie:([$u[].output_tokens//0]|add//0), raisonnement:([$u[].reasoning_output_tokens//0]|add//0)}' \
    > "$d/meta.json"
  # Quota : cherché dans les seules erreurs (stderr, événements error/turn.failed), jamais dans le
  # texte des fichiers que Codex a lus (ce script contient lui-même ces mots).
  # Erreurs lues d'abord dans une variable : `grep -q` en bout de tube, avec pipefail, ferait
  # échouer le tube (SIGPIPE de l'écrivain) précisément quand le motif est trouvé.
  local erreurs
  erreurs="$(cat "$d/stderr.txt"; jq -c 'select(.type=="error" or .type=="turn.failed")' \
    "$d/evenements.jsonl" 2> /dev/null || true)"
  if [[ "$code" -ne 0 || ! -s "$d/last.json" ]] && grep -qiE "$QUOTA_RE" <<< "$erreurs"; then
    return 5
  fi
  [[ "$code" -eq 0 && -s "$d/last.json" ]] || return 1
  jq -e '(.findings|type=="array") and (.files_read|type=="array") and (.notes|type=="string")' \
    "$d/last.json" > /dev/null 2>&1 || return 1
  local texte
  texte="$(jq -r '.notes, (.findings[] | tostring)' "$d/last.json")"
  if grep -qE "$SENSIBLE_RE" <<< "$texte"; then
    jq '.alerte = "donnee_sensible_possible"' "$d/meta.json" > "$d/meta.tmp" && mv -f "$d/meta.tmp" "$d/meta.json"
  fi
  return 0
}

# Résumé du jour (hors dépôt) : un bloc par objet relu, constats triés par gravité.
resumer() { # $1 = dossier du jour, $2 = fichier résumé
  local jour="$1" out="$2" o
  {
    echo "# Codex contrôleur — résumé du $(basename "$jour")"
    echo
    echo "Base main : \`$BASE\` · Codex $VERSION · modèle $MODELE, effort $EFFORT · écrit le $(horodate)"
    echo
    echo "| Objet | Constats | critical | high | medium | low | info | Durée | Entrée (tokens) | Sortie |"
    echo "|---|---|---|---|---|---|---|---|---|---|"
    for o in "$jour"/*/; do
      [[ -s "$o/last.json" ]] || continue
      jq -r --arg o "$(basename "$o")" --slurpfile m "$o/meta.json" \
        '[.findings[].severity] as $s | "| \($o) | \($s|length) | \([$s[]|select(.=="critical")]|length) | \([$s[]|select(.=="high")]|length) | \([$s[]|select(.=="medium")]|length) | \([$s[]|select(.=="low")]|length) | \([$s[]|select(.=="info")]|length) | \($m[0].duree_s) s | \($m[0].entree) | \($m[0].sortie) |"' \
        "$o/last.json"
    done
    echo
    for o in "$jour"/*/; do
      [[ -s "$o/last.json" ]] || continue
      echo "## $(basename "$o")"
      echo
      if [[ "$(jq -r '.alerte // ""' "$o/meta.json")" != "" ]]; then
        echo "Constats retenus hors du résumé : un secret ou une donnée personnelle y figure peut-être."
        echo "Lire \`$o/last.json\` et trier avant tout partage."
        echo
        continue
      fi
      jq -r '.findings | sort_by({"critical":0,"high":1,"medium":2,"low":3,"info":4}[.severity])
        | if length == 0 then "Aucun constat." else
          (["| Gravité | Catégorie | Fichier:ligne | Constat |", "|---|---|---|---|"]
           + map("| \(.severity) | \(.category) | `\(.file):\(.line)` | \(.title | gsub("\\|"; "/")) |"))
          | join("\n") end' "$o/last.json"
      echo
    done
  } > "$out"
}

lire_curseur() { [[ -f "$CURSEUR" ]] || die "curseur absent ($CURSEUR) : lancer « init --depuis <ISO> »" 6; }
# Seule une PR relue avance .depuis : quotidien les relit dans l'ordre de fusion, aucune PR plus
# ancienne n'est donc en attente. Une PR ignorée peut être plus récente qu'une PR en attente :
# elle entre dans .faites sans déplacer .depuis, que filtre la recherche « merged:>= ».
marquer() { # pr fusion statut [motif]
  local tmp; tmp="$(mktemp "$ETAT/.curseur.XXXXXX")"
  jq --argjson pr "$1" --arg f "$2" --arg s "$3" --arg m "${4:-}" --arg t "$(horodate)" \
    '.faites += [{pr:$pr, fusion:$f, statut:$s, motif:$m, le:$t}]
     | if $s == "relue" then .depuis = ([.depuis, $f]|max) else . end' \
    "$CURSEUR" > "$tmp" && mv -f "$tmp" "$CURSEUR"
}

verrou() {
  exec 9> "$ETAT/.verrou"
  flock -n 9 || die "un passage est déjà en cours (verrou $ETAT/.verrou)" 7
}

case "$CMD" in
  init)
    [[ "$DEPUIS" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]] \
      || die "--depuis attendu au format 2026-11-19T00:00:00Z" 2
    [[ ! -f "$CURSEUR" ]] || die "curseur déjà présent ($CURSEUR) : rien changé"
    jq -n --arg d "$DEPUIS" '{depuis:$d, faites:[]}' > "$CURSEUR"
    echo "curseur créé : PR fusionnées à partir du $DEPUIS"
    ;;

  ignorer)
    [[ "$PR" =~ ^[0-9]+$ && -n "$MOTIF" ]] || die "ignorer exige --pr N et --motif TEXTE" 2
    lire_curseur; verrou
    f="$(gh_depot pr view "$PR" --json mergedAt --jq '.mergedAt')" || die "PR #$PR illisible"
    [[ -n "$f" && "$f" != "null" ]] || die "PR #$PR non fusionnée"
    marquer "$PR" "$f" ignoree "$MOTIF"
    echo "PR #$PR marquée non relue : $MOTIF"
    ;;

  commande)
    WT="<WORKTREE>"; GIT_COMMUN="<DEPOT>/.git"
    commande_codex "<SORTIE>/last.json"
    printf '%q ' "${CODEX_CMD[@]}" "<CONSIGNE + OBJET>"; echo " < <DIFF ou /dev/null>"
    ;;

  quotidien)
    lire_curseur; verrou; verifier_codex
    t0=$(date +%s); jour="$ETAT/bruts/$(date -u +%Y-%m-%d)"; mkdir -p "$jour"
    depuis="$(jq -r '.depuis' "$CURSEUR")"
    liste="$jour/prs.json"
    gh_depot pr list --state merged --base "$BRANCHE" --search "merged:>=$depuis" --limit 500 \
      --json number,title,mergedAt,mergeCommit > "$liste.brut" || die "liste des PR fusionnées illisible"
    [[ "$(jq length "$liste.brut")" -lt 500 ]] || die "liste tronquée à 500 PR : relancer avec un curseur plus récent"
    jq --slurpfile c "$CURSEUR" '[$c[0].faites[].pr] as $f
      | map(select((.number as $n | $f | index($n)) | not)) | sort_by(.mergedAt, .number)' \
      "$liste.brut" > "$liste"
    total="$(jq length "$liste")"
    if [[ "$total" -eq 0 ]]; then
      rapport ok $(( $(date +%s) - t0 )) "aucune PR fusionnée depuis $depuis" '{"relues":0,"restantes":0}'
      echo "aucune PR fusionnée depuis $depuis"; exit 0
    fi
    preparer_worktree
    relues=0; constats=0; arret=""
    while read -r ligne; do
      [[ "$relues" -lt "$MAX_PR" ]] || { arret="plafond de $MAX_PR PR atteint"; break; }
      n="$(jq -r '.number' <<< "$ligne")"; f="$(jq -r '.mergedAt' <<< "$ligne")"
      sha="$(jq -r '.mergeCommit.oid // empty' <<< "$ligne")"; titre="$(jq -r '.title' <<< "$ligne")"
      d="$jour/pr$n"
      git -C "$WT" merge-base --is-ancestor "$sha" HEAD 2> /dev/null \
        || { arret="commit de fusion de #$n absent de origin/$BRANCHE"; break; }
      # Diff contre le premier parent : sur une fusion à deux parents, git show rend un diff
      # combiné, vide pour une fusion propre ; le premier parent est l'état de main avant la PR.
      parent="$(git -C "$WT" rev-parse -q --verify "$sha^1")" \
        || { arret="commit de fusion de #$n sans premier parent"; break; }
      mkdir -p "$d"
      git -C "$WT" diff --stat --patch "$parent" "$sha" -- . "${EXCLUS[@]}" > "$d/diff.tmp"
      if [[ ! -s "$d/diff.tmp" ]]; then
        arret="diff vide pour #$n contre le premier parent (fichiers générés retirés) ; PR laissée en attente, la retirer par « ignorer --pr $n --motif … » si voulu"
        break
      fi
      note="Diff du commit de fusion contre son premier parent joint en entrée standard (fichiers générés retirés : package-lock.json, audit/registry, audit/dependencies, REPO_MAP.md, audit/cleanup/pr-8-controlled-cleanup-candidates.json, audit/cleanup/pr-8-deletion-proof.md, audit/module-boundaries.json)."
      if [[ "$(stat -c %s "$d/diff.tmp")" -gt "$DIFF_MAX" ]]; then
        git -C "$WT" diff --stat "$parent" "$sha" -- . "${EXCLUS[@]}" > "$d/diff.tmp"
        note="Diff trop long : seule la liste des fichiers est jointe ; lis les fichiers modifiés et \`git diff $parent $sha\` dans le worktree."
      fi
      { git -C "$WT" log -1 --format='commit %H%n%s%n' "$sha"; cat "$d/diff.tmp"; } > "$d/entree.diff"
      rm -f "$d/diff.tmp"
      objet="PR #$n fusionnée sur $BRANCHE le $f : « $titre ». Commit de fusion $sha. $note"
      rc=0; passage "$d" "$objet" "$d/entree.diff" || rc=$?
      if [[ "$rc" -eq 5 ]]; then arret="quota Codex épuisé à la PR #$n"; break; fi
      if [[ "$rc" -ne 0 ]]; then arret="échec du passage de la PR #$n (voir $d/stderr.txt)"; break; fi
      marquer "$n" "$f" relue
      relues=$((relues + 1)); constats=$((constats + $(jq '.findings|length' "$d/last.json")))
    done < <(jq -c '.[]' "$liste")
    resumer "$jour" "$ETAT/resume-$(basename "$jour").md"
    restantes=$((total - relues))
    metr="$(jq -nc --argjson r "$relues" --argjson s "$restantes" --argjson c "$constats" \
      '{relues:$r, restantes:$s, constats:$c}')"
    duree=$(( $(date +%s) - t0 ))
    case "$arret" in
      "") rapport ok "$duree" "$relues PR relues, $constats constats ; résumé $ETAT/resume-$(basename "$jour").md" "$metr"
          echo "$relues PR relues, $constats constats" ;;
      "plafond"*) rapport warn "$duree" "$relues PR relues, $restantes reportées ($arret)" "$metr"
          echo "$relues PR relues, $restantes reportées : $arret"; exit 0 ;;
      "quota"*) rapport warn "$duree" "$arret ; $relues relues, $restantes reprises au prochain passage" "$metr"
          die "$arret ; $relues relues, $restantes reprises au prochain passage" 5 ;;
      *) rapport error "$duree" "$arret ; $relues relues, $restantes en attente" "$metr"
          die "$arret ; $relues relues, $restantes en attente" 1 ;;
    esac
    ;;

  lot)
    [[ "$NOM" =~ ^[A-Za-z0-9._-]+$ && -f "$LISTE" ]] || die "lot exige --nom [A-Za-z0-9._-]+ et --liste FICHIER" 2
    verrou; verifier_codex
    preparer_worktree
    jour="$ETAT/bruts/$(date -u +%Y-%m-%d)"; d="$jour/lot-$NOM"
    manquants="$(while read -r p; do [[ -z "$p" || -e "$WT/$p" ]] || echo "$p"; done < "$LISTE")"
    [[ -z "$manquants" ]] || die "fichiers du lot absents de origin/$BRANCHE : $(echo "$manquants" | head -n3 | tr '\n' ' ')"
    objet="Audit d'un lot de fichiers${DEPT:+ du département $DEPT}, lot « $NOM », sur main $BASE. Aucun diff : relis ces fichiers en entier, puis leur contexte dans le dépôt.
$(grep -v '^$' "$LISTE")"
    rc=0; passage "$d" "$objet" || rc=$?
    [[ "$rc" -ne 5 ]] || die "quota Codex épuisé pendant le lot $NOM" 5
    [[ "$rc" -eq 0 ]] || die "échec du lot $NOM (voir $d/stderr.txt)"
    resumer "$jour" "$ETAT/resume-$(basename "$jour").md"
    echo "lot $NOM : $(jq '.findings|length' "$d/last.json") constats ($d/last.json)"
    ;;

  *) usage ;;
esac
