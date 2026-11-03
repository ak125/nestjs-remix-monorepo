#!/usr/bin/env bash
# =============================================================================
# Point d'entrée versionné, opt-in, de la garde de sortie editorial-review (lot R27).
#
# Branche editorial-review-stop-gate.mjs en hook Stop pour une seule session, par une couche de
# session, sans fichier de réglages global, utilisateur ou projet :
#   claude : --settings '<JSON>'                  (--output-format stream-json exigé, non ajouté)
#   codex  : exec --json -c 'hooks.Stop=<TOML>'   (rien sous ~/.codex, aucun profil, aucun .codex/)
# Une session claude ou codex lancée sans ce lanceur ne charge pas la garde.
#
# La commande du hook ne dépend que du worktree (« '<node>' '<garde>' --env ») : la garde lit ses
# paramètres dans l'environnement exporté ici. Codex accorde sa confiance commande par commande
# (interface native Review hooks) ; ce lanceur ne la contourne pas.
#
# Le flux natif reste la sortie standard, inchangé ; il est copié au fil de l'eau dans
# <traces>/codex-exec.jsonl ou <traces>/claude-stream.jsonl. Pour Codex, la garde y relève
# l'étape 6 du contrat (acceptation par --emit, puis deux passages sans --emit l'un après l'autre).
# Après la fin de la CLI, hors de l'agent :
#   1. la réponse finale native est extraite du flux copié, à l'octet (garde --extraire), dans
#      <traces>/reponse-finale.txt ; pour Codex, elle est comparée au fichier -o s'il est donné ;
#   2. la garde --verifier la confronte à la dernière trace et la recontrôle en mode strict
#      (Codex : étape 6 recomptée sur le flux complet) ; rapport dans <traces>/verification.json.
# Une trace ne remplace jamais la réponse : seule la réponse extraite du flux natif est vérifiée.
#
# Code : 0 relecture appliquée, 3 relecture partielle, toutes deux vérifiées. 1 sinon : CLI ou
# copie du flux en échec, réponse finale non extraite, -o différent du dernier agent_message, ou
# vérification en échec (hook absent ou sans trace, borne de reprises atteinte, réponse finale
# différente de la dernière livraison contrôlée, étape 6 non prouvée…). 2 : usage refusé, CLI non
# lancée (option manquante, chemin à guillemet, barre oblique inverse ou caractère de contrôle,
# racine à deux-points, dossier de traces existant, claude sans --output-format stream-json).
#
# Usage :
#   editorial-review-native.sh claude --traces <dossier neuf> --root <dossier>... [--bin <claude>] -- <arguments, dont --output-format stream-json>
#   editorial-review-native.sh codex  --traces <dossier neuf> --root <dossier>... [--bin <codex>]  -- <arguments de codex exec, sans --json>
# Pour codex, donner -o en chemin absolu.
# =============================================================================
set -u

usage() {
  printf 'editorial-review-native.sh : %s\n' "$1" >&2
  printf 'usage : editorial-review-native.sh <claude|codex> --traces <dossier neuf> --root <dossier>... [--bin <cli>] -- <arguments>\n' >&2
  exit 2
}

# Chemins insérés tels quels dans une chaîne JSON, une chaîne TOML et une commande shell.
safe() {
  case "$1" in
    *[\"\'\\]* | *[[:cntrl:]]*) usage "chemin refusé : $1" ;;
  esac
}

cli=${1-}
case "$cli" in
  claude | codex) shift ;;
  *) usage "CLI attendue : claude ou codex" ;;
esac

traces=""
bin=$cli
roots=()
while [ $# -gt 0 ]; do
  case "$1" in
    --traces) [ $# -ge 2 ] || usage "--traces sans dossier"; traces=$2; shift 2 ;;
    --root) [ $# -ge 2 ] || usage "--root sans dossier"; roots+=("$2"); shift 2 ;;
    --bin) [ $# -ge 2 ] || usage "--bin sans exécutable"; bin=$2; shift 2 ;;
    --) shift; break ;;
    *) usage "argument inattendu avant -- : $1" ;;
  esac
done
[ -n "$traces" ] || usage "--traces manquant"
[ ${#roots[@]} -gt 0 ] || usage "--root manquant"
[ -e "$traces" ] && usage "dossier de traces existant : $traces (un dossier neuf par session)"

# Seuls le format du flux (claude) et le fichier -o (codex) sont relevés ; rien n'est réécrit.
format=""
out_file=""
args=("$@")
for ((i = 0; i < ${#args[@]}; i++)); do
  case "${args[i]}" in
    --output-format) format=${args[i + 1]-} ;;
    --output-format=*) format=${args[i]#*=} ;;
    -o | --output-last-message) out_file=${args[i + 1]-} ;;
    --output-last-message=*) out_file=${args[i]#*=} ;;
  esac
done
[ "$cli" = codex ] || [ "$format" = stream-json ] || usage "claude sans --output-format stream-json : réponse finale non extractible du flux"

here=$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd -P)
gate=$here/editorial-review-stop-gate.mjs
node_bin=$(command -v node) || usage "node introuvable"
safe "$here"
safe "$node_bin"
safe "$traces"
joined=""
root_args=()
for r in "${roots[@]}"; do
  safe "$r"
  case "$r" in *:*) usage "racine refusée (deux-points) : $r" ;; esac
  # Chemin absolu : le hook ne s'exécute pas forcément dans le dossier courant du lanceur.
  abs=$(realpath -ms -- "$r")
  joined=${joined:+$joined:}$abs
  root_args+=(--root "$abs")
done

mkdir -p -- "$traces" || usage "dossier de traces non créé : $traces"
traces=$(realpath -ms -- "$traces")
hook="'$node_bin' '$gate' --env"
export EDITORIAL_REVIEW_TRACES=$traces
export EDITORIAL_REVIEW_ROOTS=$joined
final=$traces/reponse-finale.txt
report=$traces/verification.json

if [ "$cli" = claude ]; then
  unset EDITORIAL_REVIEW_JOURNAL
  flux=$traces/claude-stream.jsonl
  "$bin" --settings "{\"hooks\":{\"Stop\":[{\"hooks\":[{\"type\":\"command\",\"command\":\"$hook\"}]}]}}" "$@" | tee -- "$flux"
  status=("${PIPESTATUS[@]}")
  verify_args=()
else
  flux=$traces/codex-exec.jsonl
  export EDITORIAL_REVIEW_JOURNAL=$flux
  "$bin" exec --json -c "hooks.Stop=[{ hooks = [{ type = \"command\", command = \"$hook\" }] }]" "$@" | tee -- "$flux"
  status=("${PIPESTATUS[@]}")
  verify_args=(--journal "$flux")
fi

fail=()
[ "${status[0]}" -eq 0 ] || fail+=("$cli : code ${status[0]}")
[ "${status[1]}" -eq 0 ] || fail+=("copie du flux : code ${status[1]}")
v=1
if "$node_bin" "$gate" --extraire "$cli" "$flux" > "$final"; then
  if [ -n "$out_file" ] && [ "$cli" = codex ] && ! cmp -s -- "$out_file" "$final"; then
    fail+=("réponse finale altérée : $out_file ≠ dernier agent_message du flux ($final)")
  fi
  "$node_bin" "$gate" --traces "$traces" "${root_args[@]}" "${verify_args[@]}" --verifier "$final" > "$report"
  v=$?
  case $v in 0 | 3) ;; *) fail+=("vérification : code $v ($report)") ;; esac
else
  rm -f -- "$final"
  fail+=("réponse finale non extraite du flux $flux")
fi

if [ ${#fail[@]} -gt 0 ]; then
  printf 'editorial-review-native.sh : réponse non livrée (code 1) : %s\n' "${fail[@]}" >&2
  exit 1
fi
printf 'editorial-review-native.sh : réponse finale vérifiée, code %s ; réponse %s ; rapport %s\n' "$v" "$final" "$report" >&2
exit "$v"
