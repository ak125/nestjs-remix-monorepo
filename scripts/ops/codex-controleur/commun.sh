# Fonctions communes au contrôleur Codex (codex-controleur.sh) et à son tri (codex-tri.sh).
# Fichier sourcé, jamais exécuté. Attend, définis avant le source : OUTIL (préfixe des messages),
# JOB (nom du job cron_report), DEPOT (clone dédié), ETAT (dossier d'état), BRANCHE.
# Apostrophes typographiques voulues dans les textes français.
# shellcheck shell=bash disable=SC1112,SC2034

# Formes de clé (jeton JWT, clé secrète Supabase), courriel et téléphone français : un constat qui
# en contient une est retenu hors du résumé (donnée personnelle ou secret possible, dépôt public).
SENSIBLE_RE='eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|sb_secret_[A-Za-z0-9_-]{8,}|[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}|(\+33|\b0)[1-9]([ .-]?[0-9]{2}){4}\b'

die() { echo "$OUTIL : $*" >&2; exit "${2:-1}"; }
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
  [[ -f "$lib" ]] || { echo "$OUTIL : rapport non enregistré ($lib absent)" >&2; return 0; }
  # shellcheck source=/dev/null
  source "$lib"
  CRON_REPORT_MAX_AGE_S="${CRON_REPORT_MAX_AGE_S:-129600}" cron_report "$JOB" "$1" "$2" "$4" "$3" || true
}

# Clone dédié (décision de Marwane du 2026-11-19) : la routine fait fetch et worktree jetable dans
# son propre clone (~/codex-controleur/app), jamais dans le checkout DEV partagé. Gardes posées
# avant toute écriture. CODEX_CONTROLEUR_PROTEGE ajoute un checkout protégé (tests) ; il ne retire
# jamais /opt/automecanik/app.
garder_depot() {
  local commun etat_canon p pc
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
}

# Un seul passage à la fois sur ce dossier d'état : contrôleur et tri prennent le même verrou.
verrou() {
  exec 9> "$ETAT/.verrou"
  flock -n 9 || die "un passage est déjà en cours (verrou $ETAT/.verrou)" 7
}

# Worktree jetable détaché sur origin/$BRANCHE dans le clone dédié, retiré à toute sortie.
preparer_worktree() { # $1 = préfixe du nom (wt par défaut)
  git -C "$DEPOT" fetch -q origin "$BRANCHE" || die "fetch de origin/$BRANCHE impossible"
  WT="$ETAT/${1:-wt}-$(date -u +%Y%m%dT%H%M%S)-$$"
  git -C "$DEPOT" worktree add -q --detach "$WT" "origin/$BRANCHE" 2> /dev/null \
    || die "worktree jetable impossible sous $WT"
  trap 'git -C "$DEPOT" worktree remove --force "$WT" 2> /dev/null || rm -rf "$WT"' EXIT
  BASE="$(git -C "$WT" rev-parse HEAD)"
}
