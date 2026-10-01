#!/usr/bin/env bash
#
# worktree-claim.sh — attribution d'écriture d'un worktree git à UNE mission.
#
# Ce que c'est : une réservation ATOMIQUE et COOPÉRATIVE, locale à la machine.
#   - Atomique : toute mutation (claim/release/handoff/takeover) lit puis remplace
#     l'attribution sous un même verrou flock interne ; le fichier naît par link(2)
#     et se remplace par rename(2). Des appels simultanés produisent un seul détenteur.
#   - Coopérative : elle empêche un second LANCEMENT par un appelant qui la consulte
#     (`claim` / `check`). Elle n'empêche PAS techniquement l'écriture : un processus
#     qui ne l'appelle pas écrit librement. La restriction technique d'écriture relève
#     du bac à sable de l'exécutant (profil de permissions Codex), pas de ce script.
#   - Locale : aucune garantie entre machines.
#
# `git worktree lock` est posé en plus, uniquement comme marqueur natif « ne pas
# retirer » (prune/remove l'honorent) — ce n'est PAS un verrou d'écriture.
#
# Fichiers (dossier d'administration PRIVÉ du worktree, `git rev-parse --absolute-git-dir`) :
#   agent-claim.json   attribution en cours (absente = libre)
#   agent-claim.log    journal JSONL des événements (claim/release/handoff/takeover)
#   agent-claim.lock   verrou flock INTERNE à l'outil : sérialise les mutations de
#                      l'attribution entre deux appels ; n'empêche aucune écriture du worktree
#
# Détenteur = un PROCESSUS (pid, heure de démarrage, machine, boot), pas une chaîne :
#   --pid N    N doit être l'appelant ou l'un de ses ancêtres (on ne parle que pour soi) ;
#   --pid auto (défaut) premier ancêtre claude/codex.
# check, release et handoff exigent que ce processus soit le détenteur enregistré ;
# connaître agent/session/mission ne suffit pas.
#
# Usage :
#   worktree-claim.sh claim    --worktree P --repo R --agent A --session S --mission M
#                              [--ref refs/heads/B] [--start-sha SHA] [--pid N|auto]
#                              [--allow-outbound-symlinks]
#   worktree-claim.sh check    --worktree P --agent A --session S --mission M [--pid N|auto]
#   worktree-claim.sh release  --worktree P --agent A --session S --mission M [--pid N|auto]
#                              (détenteur mort : libérable par la même identité si aucun
#                              processus n'a son cwd dans le worktree)
#   worktree-claim.sh handoff  --worktree P --agent A --session S --mission M --to-agent B
#                              [--to-session S2] [--tests TXT] [--risks TXT] [--resources TXT]
#                              [--pid N|auto]
#   worktree-claim.sh takeover --worktree P --repo R --agent B --session S2 --mission M
#                              [--pid N|auto] [--holder-suspended-confirmed-by QUI]
#                              (la confirmation n'est reçue que si le détenteur et les
#                              processus du worktree sont arrêtés ou suspendus — état T)
#   worktree-claim.sh status   --worktree P
#
# Codes de sortie : 0 ok · 2 usage · 3 détenu par une autre attribution ou un autre
# processus · 4 validation refusée (dépôt, chemin, lien, référence, attribution périmée,
# processus appelant ≠ détenteur) · 5 reprise refusée (l'ancien rédacteur peut encore agir,
# ou état non vérifiable).
set -euo pipefail

die() { local rc="$1"; shift; echo "worktree-claim: $*" >&2; exit "$rc"; }
need() { [[ -n "${!1:-}" ]] || die 2 "option requise : --${2}"; }
ID_RE='^[A-Za-z0-9._:@-]{1,128}$'

SUB="${1:-}"; [[ $# -gt 0 ]] && shift
WT="" REPO="" AGENT="" SESSION="" MISSION="" REF="" START_SHA="" PIDARG="" TO_AGENT="" TO_SESSION=""
TESTS="" RISKS="" RESOURCES="" CONFIRMED_BY="" ALLOW_OUT=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --worktree) WT="$2"; shift 2;;       --repo) REPO="$2"; shift 2;;
    --agent) AGENT="$2"; shift 2;;       --session) SESSION="$2"; shift 2;;
    --mission) MISSION="$2"; shift 2;;   --ref) REF="$2"; shift 2;;
    --start-sha) START_SHA="$2"; shift 2;; --pid) PIDARG="$2"; shift 2;;
    --to-agent) TO_AGENT="$2"; shift 2;; --to-session) TO_SESSION="$2"; shift 2;;
    --tests) TESTS="$2"; shift 2;;       --risks) RISKS="$2"; shift 2;;
    --resources) RESOURCES="$2"; shift 2;;
    --holder-suspended-confirmed-by) CONFIRMED_BY="$2"; shift 2;;
    --allow-outbound-symlinks) ALLOW_OUT=1; shift;;
    *) die 2 "option inconnue : $1";;
  esac
done
for v in AGENT SESSION MISSION TO_AGENT TO_SESSION; do
  [[ -z "${!v}" || "${!v}" =~ $ID_RE ]] || die 2 "valeur invalide pour $v"
done
[[ -z "$REPO" ]] || REPO="$(realpath -e -- "$REPO" 2>/dev/null)" || die 4 "--repo introuvable"
# Le répertoire courant de l'outil (et de ses sous-shells) ne doit jamais compter comme
# « processus actif dans le worktree » : tous les appels git passent par -C.
cd /

now() { date -u +%Y-%m-%dT%H:%M:%SZ; }
# Nom du noyau, pas $HOSTNAME : une variable d'environnement se falsifie.
HOST=""; read -r HOST < /proc/sys/kernel/hostname 2>/dev/null || HOST="$(hostname)"
BOOT=unknown; read -r BOOT < /proc/sys/kernel/random/boot_id 2>/dev/null || true
command -v flock >/dev/null || die 2 "flock (util-linux) requis"

proc_start() { # $1=pid -> starttime (champ 22 de /proc/pid/stat)
  local s; read -r s < "/proc/$1/stat" 2>/dev/null || return 1
  s="${s##*) }"; set -- $s; echo "${20}"
}
alive() { # $1=pid $2=starttime $3=boot_id — même processus toujours vivant ?
  [[ "$3" == "$BOOT" && -n "$1" && "$1" != "0" ]] || return 1
  [[ "$(proc_start "$1" 2>/dev/null || true)" == "$2" ]]
}
ancestors() { # PIDs de ce processus et de ses ancêtres (sans processus auxiliaire)
  local p=$$ s
  while [[ -n "$p" && "$p" != "0" ]]; do
    echo "$p"; read -r s < "/proc/$p/stat" 2>/dev/null || break
    s="${s##*) }"; set -- $s; p="$2"   # champ 4 : ppid
  done
}
cwd_users() { # $1=racine -> PIDs visibles dont le cwd est dans la racine (hors appelant)
  local mine pid cwd; mine=" $(ancestors | tr '\n' ' ') "
  for pid in /proc/[0-9]*; do
    pid="${pid#/proc/}"; [[ "$mine" == *" $pid "* ]] && continue
    cwd="$(readlink "/proc/$pid/cwd" 2>/dev/null)" || continue
    [[ "$cwd" == "$1" || "$cwd" == "$1"/* ]] && echo "$pid"
  done
  return 0
}
resolve_pid() { # --pid N|auto -> "pid starttime" ; auto = premier ancêtre claude/codex
  local p name
  if [[ -z "$PIDARG" || "$PIDARG" == "auto" ]]; then
    for p in $(ancestors); do
      [[ "$p" == "$$" ]] && continue
      name="$(readlink "/proc/$p/exe" 2>/dev/null || true)"; name="${name##*/}"
      if [[ ! "$name" =~ ^(claude|codex) ]]; then
        name="$(tr '\0' '\n' < "/proc/$p/cmdline" 2>/dev/null | head -1)"; name="${name##*/}"
      fi
      [[ "$name" =~ ^(claude|codex) ]] && { echo "$p $(proc_start "$p")"; return 0; }
    done
    die 2 "--pid auto : aucun processus claude/codex parmi les ancêtres ; passer --pid explicitement"
  fi
  [[ "$PIDARG" =~ ^[0-9]+$ ]] || die 2 "--pid invalide"
  [[ " $(ancestors | tr '\n' ' ') " == *" $PIDARG "* ]] \
    || die 4 "--pid $PIDARG n'est ni l'appelant ni l'un de ses ancêtres : un appelant ne parle que pour son propre processus"
  p="$(proc_start "$PIDARG")" || die 4 "--pid $PIDARG : processus introuvable"
  echo "$PIDARG $p"
}
stopped() { # $1=pid -> 0 si le processus ne peut plus agir sans intervention : suspendu (T/t), zombie, disparu
  local s; read -r s < "/proc/$1/stat" 2>/dev/null || return 0
  s="${s##*) }"; [[ "${s%% *}" == [TtZ] ]]
}

# --- Validation du worktree : AVANT toute écriture ---
resolve_wt() {
  need WT worktree
  [[ "$WT" == /* ]] || die 4 "chemin absolu requis : $WT"
  [[ -d "$WT" ]] || die 4 "worktree introuvable : $WT"
  local real norm top gd
  real="$(realpath -e -- "$WT")"; norm="$(realpath -s -m -- "$WT")"
  [[ "$real" == "$norm" ]] || die 4 "chemin via lien symbolique ou alias ($norm -> $real) : refusé"
  top="$(git -C "$real" rev-parse --show-toplevel 2>/dev/null)" || die 4 "pas un dépôt git : $real"
  [[ "$top" == "$real" ]] || die 4 "pas la racine d'un worktree ($top)"
  gd="$(git -C "$real" rev-parse --absolute-git-dir)"
  GITDIR="$(realpath -e -- "$gd")"
  COMMON="$(realpath -e -- "$(git -C "$real" rev-parse --path-format=absolute --git-common-dir)")"
  [[ "$GITDIR" != "$COMMON" ]] || die 4 "checkout principal : aucune mission n'y écrit, utiliser un worktree lié"
  WTR="$real"; CLAIM="$GITDIR/agent-claim.json"; EVLOG="$GITDIR/agent-claim.log"
  HEADREF="$(git -C "$real" symbolic-ref -q HEAD || true)"
}
check_repo() {
  need REPO repo
  local exp; exp="$(git -C "$REPO" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)" || die 4 "--repo n'est pas un dépôt git"
  [[ "$(realpath -e -- "$exp")" == "$COMMON" ]] || die 4 "mauvais dépôt : le worktree appartient à $COMMON"
}
check_ref() {
  [[ -n "$HEADREF" ]] || die 4 "HEAD détachée : une mission d'écriture exige une branche"
  case "$HEADREF" in refs/heads/main|refs/heads/master) die 4 "branche $HEADREF : aucune mission n'écrit sur la branche principale";; esac
  if [[ -n "$REF" ]]; then
    [[ "$REF" == refs/* ]] || REF="refs/heads/$REF"
    [[ "$REF" == "$HEADREF" ]] || die 4 "mauvaise référence : attendu $REF, HEAD=$HEADREF"
  fi
  if [[ -n "$START_SHA" ]]; then
    git -C "$WTR" merge-base --is-ancestor "$START_SHA" HEAD 2>/dev/null || die 4 "HEAD ne descend pas du commit de départ $START_SHA"
  fi
}
outbound_symlinks() { # liens dont la cible sort du worktree (node_modules et .git exclus)
  local l t
  while IFS= read -r -d '' l; do
    t="$(realpath -m -- "$l")"
    [[ "$t" == "$WTR" || "$t" == "$WTR"/* ]] || echo "${l#"$WTR"/}"
  done < <(find "$WTR" -xdev \( -name node_modules -o -name .git \) -prune -o -type l -print0 2>/dev/null)
}
check_symlinks() {
  local out; out="$(outbound_symlinks)"
  [[ -z "$out" ]] && { OUTBOUND='[]'; return 0; }
  OUTBOUND="$(printf '%s\n' "$out" | jq -R . | jq -sc .)"
  [[ "$ALLOW_OUT" == "1" ]] || die 4 "liens sortant du worktree (une écriture y modifierait un fichier externe) : $(printf '%s ' $out)— refusé sans --allow-outbound-symlinks"
}

git_state() { # empreinte de l'état git, sans réécrire l'index
  local head st df un
  head="$(git -C "$WTR" rev-parse HEAD)"
  st="$(git --no-optional-locks -C "$WTR" status --porcelain=v1 -z --untracked-files=all | sha256sum | cut -c1-64)"
  df="$(git --no-optional-locks -C "$WTR" diff --binary HEAD | sha256sum | cut -c1-64)"
  un="$(cd "$WTR" && git --no-optional-locks ls-files -o --exclude-standard -z | sort -z | xargs -0 -r sha256sum | sha256sum | cut -c1-64)"
  jq -nc --arg h "$head" --arg b "$HEADREF" --arg s "$st" --arg d "$df" --arg u "$un" \
    '{head:$h,branch:$b,status_sha256:$s,diff_sha256:$d,untracked_sha256:$u}'
}

event() { jq -c --arg e "$1" --arg at "$(now)" '. + {event:$e, event_at:$at}' <<<"$2" >> "$EVLOG"; }
read_claim() { cat "$CLAIM" 2>/dev/null || true; }
field() { jq -r "$1 // empty" <<<"$2"; }
is_mine() { [[ "$(field .agent "$1")/$(field .session "$1")/$(field .mission "$1")" == "$AGENT/$SESSION/$MISSION" ]]; }
is_holder() { # $1=attribution -> 0 si le processus appelant résolu (HPID/HSTART) est le détenteur enregistré
  [[ "$HPID/$HSTART/$HOST/$BOOT" == "$(jq -r '.holder | "\(.pid)/\(.pid_start)/\(.host)/\(.boot_id)"' <<<"$1")" ]]
}
holder_alive() { alive "$(field .holder.pid "$1")" "$(field .holder.pid_start "$1")" "$(field .holder.boot_id "$1")"; }
take_lock() { # verrou interne, tenu jusqu'à la sortie : lecture + remplacement de l'attribution sans course
  exec 9>>"$GITDIR/agent-claim.lock"
  flock -w 10 9 || die 3 "attribution en cours de modification par un autre appel (verrou interne occupé)"
}
replace_claim() { # $1=json -> remplace l'attribution atomiquement (appelant sous take_lock)
  local tmp; tmp="$(mktemp "$GITDIR/.agent-claim.XXXXXX")"
  printf '%s\n' "$1" > "$tmp" && mv -f -- "$tmp" "$CLAIM"
}

lock_marker() { # pose le marqueur natif « ne pas retirer » ; imprime true si posé par nous
  if git -C "$COMMON" worktree list --porcelain -z | tr '\0' '\n' | awk -v p="$WTR" '$0=="worktree "p{f=1;next} /^worktree /{f=0} f&&/^locked/{found=1} END{exit !found}'; then
    echo false
  else
    if git -C "$WTR" worktree lock --reason "agent-claim $AGENT/$MISSION session=$SESSION (marqueur anti-retrait, pas un verrou d'écriture)" "$WTR"; then
      echo true
    else
      echo false
    fi
  fi
}

create_claim() { # $1=json complet -> 0 si créé atomiquement, 1 si une attribution existe
  local tmp; tmp="$(mktemp "$GITDIR/.agent-claim.XXXXXX")"
  printf '%s\n' "$1" > "$tmp"
  if ln -- "$tmp" "$CLAIM" 2>/dev/null; then rm -f -- "$tmp"; return 0; fi
  rm -f -- "$tmp"; return 1
}

new_claim_json() { # $1=pid $2=starttime $3=état git $4=json previous|null
  jq -nc --arg agent "$AGENT" --arg session "$SESSION" --arg mission "$MISSION" \
    --arg wt "$WTR" --arg common "$COMMON" --arg ref "$HEADREF" --arg start "${START_SHA:-}" \
    --argjson pid "$1" --arg ps "$2" --arg host "$HOST" --arg boot "$BOOT" --arg at "$(now)" \
    --argjson git "$3" --argjson out "$OUTBOUND" --argjson prev "$4" \
    '{version:1,state:"active",agent:$agent,session:$session,mission:$mission,
      worktree:$wt,repo_common_dir:$common,ref:$ref,start_sha:(if $start=="" then $git.head else $start end),
      holder:{pid:$pid,pid_start:$ps,host:$host,boot_id:$boot},claimed_at:$at,
      git_at_claim:$git,accepted_outbound_symlinks:$out,lock_owned:false,previous:$prev}'
}

set_lock_owned() { # réécrit l'attribution (détenue par nous, sous take_lock) avec lock_owned
  replace_claim "$(jq -c --argjson v "$1" '.lock_owned=$v' "$CLAIM")"
}

case "$SUB" in
claim)
  need AGENT agent; need SESSION session; need MISSION mission
  resolve_wt; check_repo; check_ref; OUTBOUND='[]'; check_symlinks
  hpl="$(resolve_pid)"; read -r HPID HSTART <<<"$hpl"
  j="$(new_claim_json "$HPID" "$HSTART" "$(git_state)" null)"
  take_lock
  cur="$(read_claim)"
  if [[ -n "$cur" ]]; then
    if is_mine "$cur" && [[ "$(field .state "$cur")" == "active" ]]; then
      # Idempotent pour le seul processus détenteur : une session reprise en double
      # (même identité, autre processus) n'obtient pas le droit d'écrire.
      is_holder "$cur" && { echo "déjà détenu par cette attribution"; exit 0; }
      die 3 "même attribution tenue par un autre processus (pid $(field .holder.pid "$cur")) : un seul processus écrit ; takeover une fois ce processus arrêté"
    fi
    die 3 "déjà attribué à $(field .agent "$cur")/$(field .mission "$cur") session=$(field .session "$cur") état=$(field .state "$cur")"
  fi
  # Sous le verrou, link(2) reste la garantie finale (appelant d'une version sans verrou).
  create_claim "$j" || die 3 "perdu la course : attribué à $(field .agent "$(read_claim)")/$(field .mission "$(read_claim)")"
  set_lock_owned "$(lock_marker)"
  event claim "$(cat "$CLAIM")"
  echo "attribué : $AGENT/$MISSION session=$SESSION ref=$HEADREF worktree=$WTR"
  ;;

check)
  need AGENT agent; need SESSION session; need MISSION mission
  resolve_wt
  cur="$(read_claim)"; [[ -n "$cur" ]] || die 4 "aucune attribution : écriture non autorisée"
  # Appelé avant chaque écriture (hook PreToolUse) : un seul passage jq pour tous les champs.
  IFS=$'\x1f' read -r c_agent c_session c_mission c_state c_wt c_common c_ref c_start \
      c_pid c_pstart c_host c_boot c_out < <(jq -r '[.agent, .session, .mission, .state, .worktree,
        .repo_common_dir, .ref, .start_sha, .holder.pid, .holder.pid_start, .holder.host,
        .holder.boot_id, (.accepted_outbound_symlinks | tojson)]
        | map(if . == null then "" else tostring end) | join("\u001f")' <<<"$cur") \
    || die 4 "attribution illisible"
  [[ "$c_agent/$c_session/$c_mission" == "$AGENT/$SESSION/$MISSION" ]] \
    || die 4 "attribution détenue par $c_agent/$c_mission session=$c_session : la vôtre est périmée"
  [[ "$c_state" == "active" ]] || die 4 "attribution en état $c_state : écriture suspendue"
  [[ "$c_wt" == "$WTR" ]] || die 4 "chemin changé depuis l'attribution"
  [[ "$c_common" == "$COMMON" ]] || die 4 "dépôt changé depuis l'attribution"
  [[ "$c_ref" == "$HEADREF" ]] || die 4 "référence changée depuis l'attribution ($c_ref -> ${HEADREF:-détachée})"
  git -C "$WTR" merge-base --is-ancestor "$c_start" HEAD 2>/dev/null || die 4 "HEAD ne descend plus du commit de départ"
  # Toujours comparé (--pid auto par défaut) : connaître agent/session/mission ne suffit pas.
  hpl="$(resolve_pid)"; read -r HPID HSTART <<<"$hpl"
  [[ "$HPID/$HSTART/$HOST/$BOOT" == "$c_pid/$c_pstart/$c_host/$c_boot" ]] \
    || die 4 "processus appelant (pid $HPID) ≠ détenteur enregistré (pid $c_pid) : autre session"
  OUTBOUND='[]'; [[ "$c_out" != "[]" ]] && ALLOW_OUT=1; check_symlinks
  [[ "$OUTBOUND" == "$c_out" ]] || die 4 "liens sortants modifiés depuis l'attribution"
  echo "ok : $AGENT/$MISSION peut écrire dans $WTR"
  ;;

release)
  need AGENT agent; need SESSION session; need MISSION mission
  resolve_wt
  hpl="$(resolve_pid)"; read -r HPID HSTART <<<"$hpl"
  take_lock
  cur="$(read_claim)"; [[ -n "$cur" ]] || { echo "aucune attribution"; exit 0; }
  is_mine "$cur" || die 3 "seul le détenteur peut libérer (détenteur : $(field .agent "$cur")/$(field .session "$cur"))"
  by=holder
  if ! is_holder "$cur"; then
    # Même identité, autre processus : admis seulement si le détenteur ne peut plus agir.
    [[ "$(field .holder.host "$cur")" == "$HOST" ]] || die 3 "détenteur sur une autre machine : lui seul peut libérer"
    holder_alive "$cur" && die 3 "seul le processus détenteur (pid $(field .holder.pid "$cur")) peut libérer tant qu'il est vivant"
    users="$(cwd_users "$WTR" | tr '\n' ' ')"
    [[ -z "$users" ]] || die 3 "processus encore actifs dans le worktree (pid $users) : libération refusée"
    by=same-identity-after-holder-exit
  fi
  mv -f -- "$CLAIM" "$GITDIR/.agent-claim.released.$$"
  if [[ "$(field .lock_owned "$cur")" == "true" ]]; then git -C "$WTR" worktree unlock "$WTR" 2>/dev/null || true; fi
  event release "$(jq -c --argjson p "$HPID" --arg by "$by" '. + {released_by_pid:$p, released_by:$by}' <<<"$cur")"
  rm -f -- "$GITDIR/.agent-claim.released.$$"
  echo "libéré : $AGENT/$MISSION"
  ;;

handoff)
  need AGENT agent; need SESSION session; need MISSION mission; need TO_AGENT to-agent
  resolve_wt
  hpl="$(resolve_pid)"; read -r HPID HSTART <<<"$hpl"
  take_lock
  cur="$(read_claim)"; [[ -n "$cur" ]] || die 4 "aucune attribution à transférer"
  is_mine "$cur" || die 3 "seul le détenteur peut transférer"
  is_holder "$cur" || die 3 "seul le processus détenteur (pid $(field .holder.pid "$cur")) peut transférer : l'identité ne suffit pas"
  [[ "$(field .state "$cur")" == "active" ]] || die 4 "attribution en état $(field .state "$cur")"
  st="$(git_state)"
  replace_claim "$(jq -c --arg to "$TO_AGENT" --arg ts "$TO_SESSION" --arg at "$(now)" --argjson git "$st" \
    --arg tests "$TESTS" --arg risks "$RISKS" --arg res "$RESOURCES" \
    '.state="handoff" | .handoff={to_agent:$to,to_session:(if $ts=="" then null else $ts end),at:$at,
       git:$git,tests:$tests,open_risks:$risks,resources:$res}' <<<"$cur")"
  event handoff "$(cat "$CLAIM")"
  echo "transfert enregistré vers $TO_AGENT ; cette attribution ne doit plus écrire (check refusera)."
  jq -r '"HEAD \(.handoff.git.head) sur \(.handoff.git.branch)\nstatus_sha256 \(.handoff.git.status_sha256)\ndiff_sha256 \(.handoff.git.diff_sha256)\nuntracked_sha256 \(.handoff.git.untracked_sha256)"' "$CLAIM"
  ;;

takeover)
  need AGENT agent; need SESSION session; need MISSION mission
  resolve_wt; check_repo
  hpl="$(resolve_pid)"; read -r HPID HSTART <<<"$hpl"
  take_lock
  cur="$(read_claim)"; [[ -n "$cur" ]] || die 4 "aucune attribution : utiliser claim"
  [[ "$(field .mission "$cur")" == "$MISSION" ]] || die 4 "mission différente : $(field .mission "$cur")"
  # Même identité depuis un autre processus = session reprise : admise aux mêmes conditions.
  is_mine "$cur" && is_holder "$cur" && die 4 "déjà détenteur"
  hp="$(field .holder.pid "$cur")"; hh="$(field .holder.host "$cur")"
  [[ "$hh" == "$HOST" ]] || die 5 "détenteur sur une autre machine ($hh) : impossible de vérifier qu'il ne peut plus agir"
  holder_alive=false; holder_alive "$cur" && holder_alive=true
  users="$(cwd_users "$WTR" | tr '\n' ' ')"
  running=""; for u in $users; do stopped "$u" || running+="$u "; done
  case "$(field .state "$cur")" in
    handoff)
      [[ "$(field .handoff.to_agent "$cur")" == "$AGENT" ]] || die 4 "transfert destiné à $(field .handoff.to_agent "$cur")"
      ts="$(field .handoff.to_session "$cur")"; [[ -z "$ts" || "$ts" == "$SESSION" ]] || die 4 "transfert destiné à la session $ts"
      [[ "$(git_state)" == "$(jq -c .handoff.git <<<"$cur")" ]] || die 5 "état git modifié depuis le transfert : l'ancien rédacteur a écrit, reprise refusée"
      # Une confirmation ne remplace pas l'état observé : elle n'est reçue que pour des
      # processus qui ne peuvent plus agir d'eux-mêmes (suspendus, état T).
      if [[ "$holder_alive" == "true" ]] && ! stopped "$hp"; then
        die 5 "le détenteur (pid $hp) s'exécute encore : l'arrêter ou le suspendre (état T) avant toute reprise ; une confirmation ne suffit pas"
      fi
      [[ -z "$running" ]] || die 5 "processus en cours d'exécution dans le worktree (pid $running) : les arrêter ou les suspendre avant toute reprise"
      if [[ "$holder_alive" == "true" || -n "$users" ]] && [[ -z "$CONFIRMED_BY" ]]; then
        die 5 "l'ancien détenteur (pid $hp) ou des processus (${users:-aucun}) sont suspendus mais présents : confirmation nominative requise (--holder-suspended-confirmed-by)"
      fi
      mode=handoff;;
    active)
      [[ "$holder_alive" == "false" ]] || die 5 "le détenteur (pid $hp) est vivant : aucune reprise tant qu'il peut agir"
      [[ -z "$users" ]] || die 5 "processus encore actifs dans le worktree (pid $users) : l'ancien rédacteur peut agir"
      mode=crash;;
    *) die 4 "état inconnu $(field .state "$cur")";;
  esac
  # Tout est validé AVANT le remplacement : un refus ne touche jamais l'attribution inspectée.
  [[ "$HEADREF" == "$(field .ref "$cur")" ]] || die 4 "référence changée depuis l'attribution ($(field .ref "$cur") -> ${HEADREF:-détachée})"
  check_ref
  START_SHA="$(field .start_sha "$cur")"
  git -C "$WTR" merge-base --is-ancestor "$START_SHA" HEAD 2>/dev/null || die 4 "HEAD ne descend plus du commit de départ"
  OUTBOUND="$(jq -c .accepted_outbound_symlinks <<<"$cur")"
  lock_owned="$(jq -c '.lock_owned == true' <<<"$cur")"
  prev="$(jq -c --arg m "$mode" --argjson a "$holder_alive" --arg c "$CONFIRMED_BY" --arg u "$users" \
    '{agent,session,mission,holder,state,claimed_at,handoff,takeover_mode:$m,holder_alive_at_takeover:$a,
      cwd_processes_at_takeover:$u,suspension_confirmed_by:(if $c=="" then null else $c end)}' <<<"$cur")"
  j="$(new_claim_json "$HPID" "$HSTART" "$(git_state)" "$prev" | jq -c --argjson lo "$lock_owned" '.lock_owned=$lo')"
  # Lecture et remplacement sous le même verrou interne : l'attribution remplacée est celle inspectée.
  replace_claim "$j"
  if [[ "$lock_owned" == "true" ]]; then
    git -C "$WTR" worktree unlock "$WTR" 2>/dev/null || true
    git -C "$WTR" worktree lock --reason "agent-claim $AGENT/$MISSION session=$SESSION (marqueur anti-retrait, pas un verrou d'écriture)" "$WTR" || true
  fi
  event takeover "$(cat "$CLAIM")"
  echo "reprise ($mode) : $AGENT/$MISSION session=$SESSION ; précédent $(field .agent "$cur")/$(field .session "$cur")"
  ;;

status)
  resolve_wt
  cur="$(read_claim)"
  if [[ -z "$cur" ]]; then echo "libre : $WTR"; exit 0; fi
  a=false; alive "$(field .holder.pid "$cur")" "$(field .holder.pid_start "$cur")" "$(field .holder.boot_id "$cur")" && a=true
  jq --argjson alive "$a" --arg users "$(cwd_users "$WTR" | tr '\n' ' ')" \
    '{state,agent,session,mission,ref,start_sha,claimed_at,holder,holder_alive:$alive,cwd_processes:$users,handoff,previous}' <<<"$cur"
  ;;

*) die 2 "sous-commande : claim|check|release|handoff|takeover|status";;
esac
