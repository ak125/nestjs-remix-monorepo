#!/usr/bin/env bash
# scripts/git-hooks/activate.sh — branche (ou débranche) le lanceur scripts/git-hooks/ pour le
# checkout principal et tous ses worktrees liés. Geste réservé au propriétaire sur une machine
# partagée : il modifie la configuration git commune du dépôt.
#
# Pourquoi un fichier inclus : `prepare: husky` réécrit core.hooksPath=.husky/_ dans la
# configuration commune (.git/config) à chaque npm install ou npm ci, depuis le checkout
# principal comme depuis n'importe quel worktree. Une valeur posée par `git config
# core.hooksPath` serait défaite au premier npm ci. Un include ajouté en fin de .git/config est
# lu après la clé de husky et l'emporte, sans rien changer à husky.
#
# Le lanceur désigné est celui du checkout principal (chemin absolu) : il doit être sur une
# révision qui contient scripts/git-hooks/. Chaque hook lance ensuite le .husky/<hook> du
# worktree où git tourne (voir run.sh).
#
# Non couvert : un worktree dont config.worktree pose core.hooksPath (lu après la
# configuration commune) garde sa valeur ; --status les compte et les liste. Une commande
# lancée avec `git -c core.hooksPath=...` garde aussi la sienne (cas voulu de
# scripts/ops/mandat-remise.sh et du pont de publication Hermes, qui ne lancent aucun hook).
#
# Usage : activate.sh [--status | --undo]   (depuis le checkout principal ou l'un de ses worktrees)
set -euo pipefail
unset GIT_DIR GIT_WORK_TREE GIT_COMMON_DIR GIT_INDEX_FILE

mode=${1:---install}
die() { echo "activate.sh: $*" >&2; exit 2; }

common=$(git rev-parse --path-format=absolute --git-common-dir) || die "pas dans un dépôt git"
[[ $common == */.git ]] || die "dossier git commun inattendu ($common) : dépôt sans checkout principal"
main=${common%/.git}
runner="$main/scripts/git-hooks"
inc_name=git-hooks-runner.gitconfig
inc="$common/$inc_name"
cfg="$common/config"

has_include() { git config --file "$cfg" --get-all include.path 2>/dev/null | grep -qxF "$inc_name"; }
effective() { git -C "$main" config core.hooksPath || true; }

status() {
  echo "lanceur : $runner"
  echo "core.hooksPath effectif : $(effective)"
  if has_include; then echo "include : présent ($inc)"; else echo "include : absent"; fi
  local n=0 f v
  for f in "$common"/config.worktree "$common"/worktrees/*/config.worktree; do
    [[ -f $f ]] || continue
    v=$(git config --file "$f" core.hooksPath || true)
    [[ -n $v ]] || continue
    n=$((n + 1))
    echo "  non couvert : $f (core.hooksPath=$v)"
  done
  echo "worktrees non couverts (config.worktree) : $n"
}

case "$mode" in
  --status) status ;;
  --install)
    git -C "$main" ls-files --error-unmatch scripts/git-hooks/run.sh > /dev/null 2>&1 \
      || die "scripts/git-hooks/run.sh n'est pas suivi dans le checkout principal ($main) : rien n'est changé"
    for h in pre-commit commit-msg pre-push; do
      [[ -x $runner/$h ]] || die "$runner/$h absent ou non exécutable : rien n'est changé"
    done
    git config --file "$inc" core.hooksPath "$runner"
    has_include || git config --file "$cfg" --add include.path "$inc_name"
    if [[ $(effective) != "$runner" ]]; then
      echo "activate.sh: core.hooksPath effectif = $(effective), attendu $runner : include annulé" >&2
      git config --file "$cfg" --fixed-value --unset-all include.path "$inc_name" || true
      rm -f "$inc"
      exit 1
    fi
    status
    ;;
  --undo)
    if has_include; then git config --file "$cfg" --fixed-value --unset-all include.path "$inc_name"; fi
    rm -f "$inc"
    status
    ;;
  *) die "usage: activate.sh [--status | --undo]" ;;
esac
