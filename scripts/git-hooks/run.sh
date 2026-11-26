#!/usr/bin/env sh
# scripts/git-hooks/run.sh — lanceur des hooks git de ce dépôt, valable dans tout worktree.
#
# Pourquoi : husky (`prepare: husky`) pose core.hooksPath=.husky/_, chemin RELATIF que git
# résout à la racine de chaque worktree. .husky/_ est généré et ignoré par git : un worktree
# créé par `git worktree add` ne l'a pas, et git n'y lance alors aucun hook, sans rien dire
# (seuls les worktrees natifs de Claude Code le reçoivent, par .worktreeinclude).
#
# Ce lanceur est suivi par git ; une fois activé (scripts/git-hooks/activate.sh, geste du
# propriétaire), core.hooksPath désigne CE dossier dans le checkout principal, par un chemin
# absolu, pour tous les worktrees. Pour chaque hook, il lance le script .husky/<hook> DU
# WORKTREE où git tourne (le contenu des hooks suit la branche ; ce fichier n'en change rien),
# comme le fait .husky/_/h de husky : sh -e, PATH préfixé par node_modules/.bin, HUSKY=0 et
# ~/.config/husky/init.sh respectés à l'identique.
#
# Outils sans installation : si le worktree n'a pas de node_modules, le lanceur lit ceux du
# checkout principal, sans rien écrire ni dans le worktree ni dans le checkout principal :
#   - PATH préfixé par <principal>/node_modules/.bin (appels directs, npm run) ;
#   - NODE_PATH=<principal>/node_modules (modules importés par les scripts .ts/.js en CommonJS) ;
#   - npx ne cherche que dans node_modules/.bin des dossiers parents et dans le préfixe global
#     de npm : npm_config_prefix désigne un dossier temporaire dont bin/ est un lien vers
#     <principal>/node_modules/.bin. Ce dossier est hors du worktree et supprimé à la sortie.
# Une étape qui lit node_modules/ à la racine du worktree par un chemin relatif (par exemple
# eslint dans lint-staged) ne peut pas tourner ainsi : elle échoue, et le lanceur l'explique.
# Les paquets du workspace (@repo/*) sont alors ceux du checkout principal, pas de la branche :
# la CI de la PR reste l'autorité.
#
# Appelé par les scripts de ce dossier qui portent le nom d'un hook : run.sh <hook> [args...]

n=${1:?usage: run.sh <hook> [args...]}
shift
[ "${HUSKY-}" = "2" ] && set -x

top=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "git-hooks - $n : racine du worktree introuvable, opération refusée." >&2
  exit 1
}
s="$top/.husky/$n"
[ -f "$s" ] || exit 0

i="${XDG_CONFIG_HOME:-$HOME/.config}/husky/init.sh"
# shellcheck disable=SC1090
[ -f "$i" ] && . "$i"
[ "${HUSKY-}" = "0" ] && exit 0

emprunt=""
if [ -d "$top/node_modules/.bin" ]; then
  PATH="$top/node_modules/.bin:$PATH"
else
  common=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || common=""
  main=""
  case "$common" in */.git) main=${common%/.git} ;; esac
  if [ -n "$main" ] && [ "$main" != "$top" ] && [ -d "$main/node_modules/.bin" ]; then
    emprunt=$(mktemp -d "${TMPDIR:-/tmp}/git-hooks.XXXXXX") || exit 1
    trap 'rm -rf "$emprunt"' EXIT
    trap 'exit 130' HUP INT TERM
    ln -s "$main/node_modules/.bin" "$emprunt/bin" || exit 1
    npm_config_prefix="$emprunt"
    NODE_PATH="$main/node_modules${NODE_PATH:+:$NODE_PATH}"
    export npm_config_prefix NODE_PATH
    PATH="$main/node_modules/.bin:$PATH"
    echo "git-hooks - $n : ce worktree n'a pas de node_modules ; outils lus dans $main/node_modules (lecture seule)." >&2
    cmp -s "$top/package-lock.json" "$main/package-lock.json" \
      || echo "git-hooks - $n : package-lock.json diffère du checkout principal ; les versions des outils peuvent différer de celles de la branche." >&2
  else
    echo "git-hooks - $n : aucun node_modules, ni dans ce worktree ni dans le checkout principal ; les étapes qui en dépendent échoueront." >&2
  fi
fi
export PATH

sh -e "$s" "$@"
c=$?
if [ "$c" != 0 ]; then
  echo "git-hooks - $n a échoué (code $c) : opération refusée." >&2
  [ "$c" = 127 ] && echo "git-hooks - commande introuvable dans PATH=$PATH" >&2
  if [ -n "$emprunt" ]; then
    echo "git-hooks - $n : ce worktree n'a pas de node_modules. Une étape qui lit node_modules/ à la racine du worktree (par exemple eslint dans lint-staged, sur backend/src/**/*.ts) ne peut pas tourner ici ; elle tourne dans un worktree qui a son propre node_modules." >&2
  fi
fi
exit "$c"
