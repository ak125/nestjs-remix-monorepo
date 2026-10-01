#!/usr/bin/env bash
#
# pretool-worktree-claim.sh — PreToolUse : refuse l'écriture dans un worktree attribué
# à une autre mission (attribution de scripts/agents/worktree-claim.sh).
#
# Enveloppe documentée (code.claude.com/docs/en/hooks, consultée 2026-09-30) :
# session_id, cwd, tool_name, tool_input. Sortie 2 = refusé (motif sur stderr).
#
# Cible : Write/Edit/MultiEdit → tool_input.file_path ; NotebookEdit → notebook_path ;
# Bash → cwd de la session. La cible est résolue physiquement (liens symboliques suivis).
# Décision :
#   - caractère de contrôle dans cwd, chemin ou session_id → sortie 2 (champs mal découpés) ;
#   - cible dans le dossier d'administration git d'un worktree attribué (attribution,
#     index, config, gitdir de sous-module) ou dans le dossier commun d'un dépôt qui a un
#     worktree attribué → sortie 2, pour tous : ces fichiers ne s'écrivent pas par un outil ;
#   - chaque dépôt englobant la cible est examiné, du plus proche au plus lointain (dépôt
#     imbriqué, sous-module) : worktree lié attribué → `worktree-claim.sh check --pid auto`
#     avec l'identité de l'attribution ; tout refus → sortie 2. Pour une attribution
#     `claude`, le session_id de l'enveloppe doit aussi être la session attribuée (une
#     session reprise ou effacée dans le même processus n'hérite pas du droit d'écrire) ;
#   - hors dépôt git, checkout principal, worktree sans attribution → autorisé (sans avis) ;
#   - enveloppe ou attribution illisible, erreur git autre que « pas un dépôt » → sortie 2
#     (échec fermé).
#
# Limites (coopératif, local) : une commande Bash qui écrit hors de son cwd (cd, git -C,
# chemin absolu) n'est pas vue ; un outil non listé (MCP, sous-agent d'un autre type) n'est
# pas concerné ; un processus qui ne passe pas par ce hook non plus. Ce n'est pas une
# restriction d'écriture du système.
set -uo pipefail

# L'environnement hérité ne choisit pas le dépôt examiné : seule la cible le fait.
unset GIT_DIR GIT_WORK_TREE GIT_COMMON_DIR GIT_INDEX_FILE GIT_OBJECT_DIRECTORY \
  GIT_ALTERNATE_OBJECT_DIRECTORIES GIT_CEILING_DIRECTORIES GIT_NAMESPACE
CLAIM_TOOL="$(cd "$(dirname "$0")/../agents" && pwd)/worktree-claim.sh"
deny() { echo "worktree-claim (hook): $*" >&2; exit 2; }

# Hook appelé avant chaque outil : un seul passage jq pour l'enveloppe. Un caractère de
# contrôle décalerait les champs du découpage : il est signalé, jamais transmis.
IFS=$'\x1f' read -r flag tool cwd target sid < <(jq -r 'select(type == "object")
  | [.tool_name, .cwd, (.tool_input.file_path // .tool_input.notebook_path), .session_id]
  | map(if . == null then "" else tostring end)
  | (.[0] | explode | map(if . < 32 or . == 127 then 63 else . end) | implode) as $t
  | if any(.[1:][]; explode | any(. < 32 or . == 127)) then ["ctrl", $t] else ["ok", $t] + .[1:] end
  | join("\u001f")' 2>/dev/null) \
  || deny "enveloppe illisible — refusé"
case "$tool" in
  Write|Edit|MultiEdit|NotebookEdit) ;;
  Bash) target="$cwd" ;;
  *) exit 0 ;;
esac
[[ "$flag" == "ok" ]] || deny "$tool : caractère de contrôle dans cwd, chemin ou session_id — refusé"
[[ -n "$target" ]] || deny "$tool sans cible dans l'enveloppe — refusé"
[[ "$target" == /* ]] || { [[ -n "$cwd" ]] || deny "chemin relatif sans cwd — refusé"; target="$cwd/$target"; }
# Chemin physique : un lien symbolique hors dépôt vers un worktree attribué y écrit.
target="$(realpath -m -- "$target" 2>/dev/null)" || deny "$tool : chemin non résolu — refusé"

# Dossiers d'administration git (aucun worktree ne les contient) : examen par le chemin.
d="$target"
while :; do
  [[ -f "$d/agent-claim.json" && -f "$d/commondir" && -f "$d/gitdir" ]] \
    && deny "$tool refusé : $d est le dossier d'administration d'un worktree attribué"
  if [[ -f "$d/HEAD" && -d "$d/objects" ]] && compgen -G "$d/worktrees/*/agent-claim.json" >/dev/null; then
    deny "$tool refusé : $d est le dossier git commun d'un dépôt dont un worktree est attribué"
  fi
  [[ "$d" == / ]] && break
  d="${d%/*}"; [[ -n "$d" ]] || d=/
done

# Fichier à créer : le plus proche dossier existant décide du premier dépôt examiné.
dir="$target"
while [[ ! -d "$dir" ]]; do dir="${dir%/*}"; [[ -n "$dir" ]] || dir=/; done
while :; do
  if ! paths="$(git -C "$dir" rev-parse --show-toplevel --absolute-git-dir --path-format=absolute --git-common-dir 2>/dev/null)"; then
    err="$(LC_ALL=C git -C "$dir" rev-parse --is-inside-git-dir 2>&1)"
    # Hors dépôt, ou dans un dossier git déjà examiné ci-dessus : rien d'autre à vérifier.
    [[ "$err" == *"not a git repository"* || "$err" == "true" ]] && break
    deny "$tool : état git illisible pour $dir (${err%%$'\n'*}) — refusé"
  fi
  { read -r top; read -r gd; read -r common; } <<<"$paths"
  gd="$(realpath -e -- "$gd")" || deny "dossier git introuvable pour $top"
  common="$(realpath -e -- "$common")" || deny "dossier git commun introuvable pour $top"
  if [[ "$gd" != "$common" && -e "$gd/agent-claim.json" ]]; then
    IFS=$'\x1f' read -r c_agent c_session c_mission < <(jq -r 'select(type == "object")
      | [.agent, .session, .mission] | map(if . == null then "" else tostring end) | join("\u001f")' \
      "$gd/agent-claim.json" 2>/dev/null) || deny "attribution illisible dans $gd — refusé"
    if [[ "$c_agent" == "claude" && "$sid" != "$c_session" ]]; then
      deny "$tool refusé dans $top — session_id de l'enveloppe (${sid:-absent}) ≠ session attribuée ($c_session)"
    fi
    args=(check --worktree "$top" --agent "$c_agent" --session "$c_session" --mission "$c_mission" --pid auto)
    out="$(bash "$CLAIM_TOOL" "${args[@]}" 2>&1)" || deny "$tool refusé dans $top — ${out#worktree-claim: }"
  fi
  [[ "$top" == / ]] && break
  dir="${top%/*}"; [[ -n "$dir" ]] || dir=/
done
exit 0
