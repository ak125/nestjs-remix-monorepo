#!/usr/bin/env bash
# Applique le triage de la file (ADR-128 D1 et D6) décidé par l'owner, à partir du plan versionné
# docs/plans/2026-11-15-adr128-triage-file.md :
#   1. label dept: des lignes de confiance « forte » marquées « garder » ;
#   2. commentaires de la section « Décision de l'owner », tableau « Commentaires » ;
#   3. fermeture des lignes « fermer (doublon de #N) », comme doublons de #N ;
#   4. fermeture des autres lignes « fermer » (not planned) et « fermer (résolue) » (completed).
# Chaque fermeture porte un commentaire qui cite la décision, la PR #2076, la ligne du plan et sa
# preuve. Une issue exclue (tableau « Exclusions » ou --exclure) n'est jamais fermée.
#
# Avant toute écriture, le script lit l'état des issues ouvertes (lecture seule). Il ignore et
# liste une issue fermée depuis le relevé, modifiée depuis le relevé (updatedAt postérieur),
# exclue, ou, pour un label, qui porte déjà un label dept:.
# À blanc par défaut : lit l'état, affiche les commandes, n'écrit rien. --apply : geste de
# l'owner, avec son compte. Écritures possibles : gh issue edit --add-label, gh issue comment,
# gh issue close.
#
# Usage : triage-file-apply.sh [--apply] [--exclure N[,N…]] [--plan FICHIER] [--repo PROPRIETAIRE/DEPOT]
set -euo pipefail

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLAN="$ICI/../../docs/plans/2026-11-15-adr128-triage-file.md"
REPO="${REPO:-ak125/nestjs-remix-monorepo}"
APPLIQUER=0
EXCLURE=""
LIMITE=1000

while (($#)); do
  case "$1" in
    --apply) APPLIQUER=1 ;;
    --dry-run) APPLIQUER=0 ;;
    --exclure) EXCLURE="${2:?--exclure attend une liste de numéros}"; shift ;;
    --plan) PLAN="${2:?--plan attend un fichier}"; shift ;;
    --repo) REPO="${2:?--repo attend propriétaire/dépôt}"; shift ;;
    -h|--help) sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "argument inconnu : $1" >&2; exit 2 ;;
  esac
  shift
done

[[ -r "$PLAN" ]] || { echo "plan illisible : $PLAN" >&2; exit 2; }
[[ "$REPO" =~ ^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$ ]] || { echo "dépôt invalide : $REPO" >&2; exit 2; }
[[ -z "$EXCLURE" || "$EXCLURE" =~ ^[0-9]+(,[0-9]+)*$ ]] || { echo "--exclure invalide : $EXCLURE" >&2; exit 2; }
command -v jq > /dev/null || { echo "jq est requis" >&2; exit 2; }
PLAN_CITE="docs/plans/$(basename "$PLAN")"

# Lecture du plan. Enregistrements :
#   R <relevé>   L <n> <label>   C <n> <texte>   X <n> <motif>
#   F <n> <ligne> <raison> <preuve>   (raison : not planned | completed | doublon:<cible>)
# Toute ligne d'un tableau lu qui n'a pas le bon nombre de colonnes, ou une suite inconnue,
# arrête le script.
ENTREES="$(awk -F'|' '
  function trim(s) { gsub(/^[ \t]+|[ \t]+$/, "", s); return s }
  function num(s) { s = trim(s); sub(/^#/, "", s); return s }
  /^- \*\*Relevé\*\* : / {
    if (match($0, /[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z/))
      print "R\t" substr($0, RSTART, RLENGTH)
  }
  /^## / { sec = $0; sous = ""; next }
  /^### / { sous = $0; next }
  sec == "## Issues ouvertes au relevé" && /^\| #[0-9]+ \|/ {
    if (NF != 10) { printf "ligne %d mal formée (%d colonnes) : %s\n", NR, NF - 2, $0 > "/dev/stderr"; exit 3 }
    n = num($2); d = trim($5); gsub(/`/, "", d); c = trim($6); s = trim($8); p = trim($9)
    if (s == "garder") { if (c == "forte") print "L\t" n "\t" d }
    else if (s == "fermer") print "F\t" n "\t" NR "\tnot planned\t" p
    else if (s == "fermer (résolue)") print "F\t" n "\t" NR "\tcompleted\t" p
    else if (s ~ /^fermer \(doublon de #[0-9]+\)$/) { cible = s; gsub(/[^0-9]/, "", cible); print "F\t" n "\t" NR "\tdoublon:" cible "\t" p }
    else { printf "ligne %d : suite inconnue « %s »\n", NR, s > "/dev/stderr"; exit 3 }
  }
  sec ~ /^## Décision de l.owner/ && /^\| #[0-9]+ \|/ {
    if (NF != 4) { printf "ligne %d mal formée (%d colonnes) : %s\n", NR, NF - 2, $0 > "/dev/stderr"; exit 3 }
    if (sous == "### Exclusions") print "X\t" num($2) "\t" trim($3)
    else if (sous == "### Commentaires") print "C\t" num($2) "\t" trim($3)
  }' "$PLAN")"

RELEVE=""
declare -A EXCLUE=()
LABELS=(); COMMENTAIRES=(); DOUBLONS=(); FERMETURES=()
while IFS=$'\t' read -r type a b c d; do
  case "$type" in
    R) RELEVE="$a" ;;
    L) [[ "$a" =~ ^[0-9]+$ && "$b" =~ ^dept:[0-9]{2}-[a-z-]+$ ]] \
         || { echo "ligne rejetée : issue « $a », label « $b »" >&2; exit 3; }
       LABELS+=("$a"$'\t'"$b") ;;
    C) [[ "$a" =~ ^[0-9]+$ && -n "$b" ]] || { echo "commentaire rejeté : issue « $a »" >&2; exit 3; }
       COMMENTAIRES+=("$a"$'\t'"$b") ;;
    X) [[ "$a" =~ ^[0-9]+$ ]] || { echo "exclusion rejetée : « $a »" >&2; exit 3; }
       EXCLUE[$a]="$b" ;;
    F) [[ "$a" =~ ^[0-9]+$ && -n "$d" ]] || { echo "fermeture rejetée : issue « $a »" >&2; exit 3; }
       if [[ "$c" == doublon:* ]]; then DOUBLONS+=("$a"$'\t'"$b"$'\t'"${c#doublon:}"$'\t'"$d")
       else FERMETURES+=("$a"$'\t'"$b"$'\t'"$c"$'\t'"$d"); fi ;;
  esac
done <<< "$ENTREES"
[[ -n "$RELEVE" ]] || { echo "date du relevé introuvable (ligne « - **Relevé** : »)" >&2; exit 3; }
((${#LABELS[@]} + ${#FERMETURES[@]} + ${#DOUBLONS[@]})) || { echo "aucune action dans $PLAN" >&2; exit 3; }
IFS=',' read -r -a EXCL_CLI <<< "$EXCLURE"
for n in "${EXCL_CLI[@]}"; do EXCLUE[$n]="exclue au lancement (--exclure)"; done

# Fermeture comme doublon : option native de gh si elle existe, sinon commentaire « Doublon de #N ».
DOUBLON_NATIF=0
if gh issue close --help 2>/dev/null | grep -q -- '--duplicate-of'; then DOUBLON_NATIF=1; fi

# État des issues ouvertes : numéro, updatedAt, labels dept:. Absente de la liste = fermée.
JSON="$(gh issue list --repo "$REPO" --state open --limit "$LIMITE" --json number,updatedAt,labels)"
if (( $(jq length <<< "$JSON") >= LIMITE )); then
  echo "au moins $LIMITE issues ouvertes : liste peut-être tronquée, arrêt" >&2; exit 4
fi
declare -A MAJ=() DEPTS=()
while IFS=$'\t' read -r n maj depts; do
  [[ -n "$n" ]] || continue
  MAJ[$n]="$maj"; DEPTS[$n]="$depts"
done < <(jq -r '.[] | [.number, .updatedAt, ([.labels[].name | select(startswith("dept:"))] | join(","))] | @tsv' <<< "$JSON")

# Commande affichée, copiable : arguments hors [A-Za-z0-9._/:#-] entre apostrophes.
affiche() {
  local sortie="gh" a
  for a in "$@"; do
    if [[ "$a" =~ ^[A-Za-z0-9._/:#-]+$ ]]; then sortie+=" $a"; else sortie+=" '${a//\'/\'\\\'\'}'"; fi
  done
  printf '%s\n' "$sortie"
}

FAITES=0; IGNOREES=0; ECHECS=0; TOTAL=0
ignore() { echo "# ignorée : #$1 ($2) : $3"; IGNOREES=$((IGNOREES + 1)); }
# Contrôle commun : ouverte et non modifiée depuis le relevé. Renvoie 1 si l'issue est ignorée.
controle() {
  local n="$1" quoi="$2"
  if [[ -z "${MAJ[$n]+x}" ]]; then ignore "$n" "$quoi" "fermée depuis le relevé"; return 1; fi
  if [[ "${MAJ[$n]}" > "$RELEVE" ]]; then ignore "$n" "$quoi" "modifiée depuis le relevé (${MAJ[$n]})"; return 1; fi
}
lance() {
  TOTAL=$((TOTAL + 1))
  if ((APPLIQUER == 0)); then affiche "$@"; return; fi
  if gh "$@" > /dev/null; then echo "ok    $(affiche "$@")"; FAITES=$((FAITES + 1))
  else echo "ÉCHEC $(affiche "$@")" >&2; ECHECS=$((ECHECS + 1)); fi
}
commentaire_fermeture() {
  printf 'Fermeture décidée par l’owner le 2026-11-15 sur le triage ADR-128 D6 (PR #2076) : %s, ligne %s. Preuve : %s.' \
    "$PLAN_CITE" "$1" "$2"
}
ferme() { # n ligne quoi
  local n="$1"
  if [[ -n "${EXCLUE[$n]+x}" ]]; then ignore "$n" "$3" "exclue : ${EXCLUE[$n]}"; return 1; fi
  controle "$n" "$3"
}

if ((APPLIQUER)); then MODE="application"; else MODE="à blanc, aucune écriture (--apply pour appliquer)"; fi
echo "# relevé $RELEVE ; $MODE ; doublons : $( ((DOUBLON_NATIF)) && echo '--duplicate-of' || echo 'commentaire « Doublon de »')"

for e in "${LABELS[@]}"; do
  IFS=$'\t' read -r n d <<< "$e"
  controle "$n" "label" || continue
  if [[ -n "${DEPTS[$n]}" ]]; then ignore "$n" "label" "porte déjà ${DEPTS[$n]}"; continue; fi
  lance issue edit "$n" --repo "$REPO" --add-label "$d"
done
for e in "${COMMENTAIRES[@]}"; do
  IFS=$'\t' read -r n texte <<< "$e"
  controle "$n" "commentaire" || continue
  lance issue comment "$n" --repo "$REPO" --body "$texte"
done
for e in "${DOUBLONS[@]}"; do
  IFS=$'\t' read -r n ligne cible preuve <<< "$e"
  ferme "$n" "$ligne" "doublon de #$cible" || continue
  texte="$(commentaire_fermeture "$ligne" "$preuve")"
  if ((DOUBLON_NATIF)); then lance issue close "$n" --repo "$REPO" --duplicate-of "$cible" --comment "$texte"
  else lance issue close "$n" --repo "$REPO" --reason "not planned" --comment "Doublon de #$cible. $texte"; fi
done
for e in "${FERMETURES[@]}"; do
  IFS=$'\t' read -r n ligne raison preuve <<< "$e"
  ferme "$n" "$ligne" "fermeture" || continue
  lance issue close "$n" --repo "$REPO" --reason "$raison" --comment "$(commentaire_fermeture "$ligne" "$preuve")"
done

if ((APPLIQUER)); then
  echo "# bilan : $FAITES faite(s), $IGNOREES ignorée(s), $ECHECS échec(s) sur $TOTAL action(s)"
else
  echo "# à blanc : $TOTAL action(s), $IGNOREES ignorée(s)"
fi
((ECHECS == 0))
