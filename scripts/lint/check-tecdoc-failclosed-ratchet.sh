#!/usr/bin/env bash
# Ratchets du rejeu TecDoc fail-closed.
#
# CE QUE CES GARDES AFFIRMENT, ET RIEN DE PLUS
# --------------------------------------------
# R1  Aucun script vivant du pipeline TecDoc ne derive son perimetre d'une requete
#     de merchandising vivante. Le perimetre vient de l'artefact scelle, via
#     `tecdoc_scope.resoudre_dlnr(mode, scope_file)`. En mars 2026, `pm_display='1'`
#     etait la seule definition du perimetre ; elle a change depuis, et un rejeu
#     ainsi pilote perdrait DIEDERICHS (253) et RIDEX (6358) tout en cherchant
#     VDO (4836), qui n'a aucun shard source.
#
# R2  Aucun script vivant n'ecrit dans `tecdoc_raw` sans la garde de comptabilite
#     `tecdoc_load_guard.verifier_lot`. C'est le defaut de mars 2026 : 9 357 752
#     lignes emises par le parseur, 69 000 arrivees en base, statut « OK ».
#
# R3  La zone de quarantaine reste une quarantaine : rien, hors d'elle, n'IMPORTE ni
#     n'EXECUTE les scripts historiques. Ils sont conserves a titre FORENSIQUE. R3
#     porte sur les references executables (import, sys.path, invocation d'un .py),
#     jamais sur la prose : citer la quarantaine pour l'expliquer est legitime.
#
# PERIMETRE : `scripts/**.py`, hors `scripts/tecdoc-pipeline/**` (quarantaine
# assumee, cf. `scripts/tecdoc-pipeline/README.md`). Ce garde ne lint PAS les
# scripts historiques et ne doit jamais etre etendu pour le faire : ils sont
# conserves tels quels comme piece a conviction.
#
# EXCEPTIONS : scripts/lint/tecdoc-failclosed-allowlist.txt, motif obligatoire.
# Le ratchet est SYMETRIQUE — une entree qui ne viole plus rien echoue aussi.
set -uo pipefail
cd "$(dirname "$0")/../.."

QUARANTAINE="scripts/tecdoc-pipeline"
ALLOW="scripts/lint/tecdoc-failclosed-allowlist.txt"
echecs=0
declare -A VU=()

autorise() { grep -qxF "$1 $2" "$ALLOW" 2>/dev/null; }
marquer()  { VU["$1 $2"]=1; }

fichiers_tecdoc() {
  grep -rl --include='*.py' -e 'tecdoc_raw' -e 'tecdoc_map' scripts/ 2>/dev/null \
    | grep -v "^${QUARANTAINE}/" | sort
}

signaler() { # signaler <regle> <fichier> <message> <remede>
  if autorise "$1" "$2"; then marquer "$1" "$2"; echo "  · exempte ($1) $2"; return; fi
  echo "  ✗ $2 : $3"
  echo "      $4"
  echecs=$((echecs+1))
}

echo "== R1 — perimetre scelle, jamais derive du merchandising vivant =="
avant=$echecs
for f in $(fichiers_tecdoc); do
  grep -qE "pm_display|__tecdoc_supplier_mapping" "$f" || continue
  signaler R1 "$f" \
    "perimetre derive d'une requete vivante (pm_display / __tecdoc_supplier_mapping)" \
    "Utiliser tecdoc_scope.resoudre_dlnr(mode, scope_file) avec un mode explicite."
done
[ "$echecs" -eq "$avant" ] && echo "  ✓ aucun perimetre derive du vivant"

echo "== R2 — aucun chargement sans garde de comptabilite =="
avant=$echecs
for f in $(fichiers_tecdoc); do
  grep -qE "copy_from|copy_expert|INSERT INTO tecdoc_raw|INSERT INTO t[0-9]" "$f" || continue
  grep -qE "verifier_lot|tecdoc_load_guard" "$f" && continue
  signaler R2 "$f" \
    "ecrit dans tecdoc_raw sans verifier_lot (tecdoc_load_guard)" \
    "Un lot qui ne se solde pas ne doit jamais etre committe."
done
[ "$echecs" -eq "$avant" ] && echo "  ✓ tout chemin d'ecriture passe par la garde de comptabilite"

echo "== R3 — la quarantaine reste une quarantaine =="
avant=$echecs
fuites=$(grep -rnE --include='*.py' --include='*.sh' --include='*.ts' --include='*.yml' \
           -e "${QUARANTAINE}/[A-Za-z0-9_.-]+\.py" \
           -e "sys\.path.*tecdoc-pipeline" \
           scripts/ backend/ .github/ 2>/dev/null \
         | grep -v "^${QUARANTAINE}/" \
         | grep -v 'check-tecdoc-failclosed-ratchet.sh' || true)
if [ -n "$fuites" ]; then
  echo "  ✗ la quarantaine est importee ou executee depuis l'exterieur :"
  printf '%s\n' "$fuites" | sed 's/^/      /'
  echecs=$((echecs+1))
else
  echo "  ✓ aucun appelant exterieur des scripts historiques"
fi

echo "== Symetrie — aucune exemption morte =="
avant=$echecs
while read -r regle chemin; do
  [ -z "${regle:-}" ] && continue
  case "$regle" in \#*) continue;; esac
  if [ -z "${VU[$regle $chemin]:-}" ]; then
    echo "  ✗ exemption morte : « $regle $chemin » ne correspond a aucune violation."
    echo "      La retirer de $ALLOW — une exemption morte etouffera la regle plus tard."
    echecs=$((echecs+1))
  fi
done < <(grep -E '^R[0-9] ' "$ALLOW" 2>/dev/null)
[ "$echecs" -eq "$avant" ] && echo "  ✓ les $(grep -cE '^R[0-9] ' "$ALLOW") exemptions sont toutes vivantes"

echo
if [ "$echecs" -ne 0 ]; then
  echo "RATCHET ROUGE — $echecs violation(s). Une perte de ligne, une derive d'identite"
  echo "ou une difference de scope ne doit plus pouvoir produire un run vert."
  exit 1
fi
echo "RATCHET VERT — R1, R2, R3 tenus ; exemptions vivantes et motivees."
