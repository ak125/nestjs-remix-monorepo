#!/usr/bin/env bash
# Banc de la porte de capacite.
#
# L'enjeu central de ce banc : prouver que l'ajout du mode `vagues` n'a PAS affaibli
# le mode `materialise`. Une porte a deux modes est une porte qu'on peut desserrer par
# inadvertance ; les assertions 3 a 6 existent pour que cela se voie.
set -uo pipefail

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORTE="$ICI/check-rebuild-capacity.sh"
OK=0
KO=0

verifier() { # libelle, attendu, obtenu
  if [ "$2" = "$3" ]; then
    printf '  \033[32mOK\033[0m   %s\n' "$1"; OK=$((OK + 1))
  else
    printf '  \033[31mKO\033[0m   %s — attendu «%s», obtenu «%s»\n' "$1" "$2" "$3"; KO=$((KO + 1))
  fi
}

verdict() { # sortie complete -> dernier verdict rendu (un refus porte son motif :
            # « NO_GO — volume non dedie »), donc on ancre le debut de ligne seulement
  echo "$1" | grep -oE '^(GO|NO_GO)' | tail -1
}

INEXISTANT="/tmp/volume-qui-nexiste-pas-$$"

# --- mode vagues ---------------------------------------------------------
echo "=== 1. mode vagues — la racine suffit quand la matiere est purgee ==="
S="$(TECDOC_REBUILD_MODE=vagues bash "$PORTE" / 2>&1)"; C=$?
verifier "verdict GO" "GO" "$(verdict "$S")"
verifier "code de sortie 0" 0 "$C"
verifier "le seuil affiche est celui des vagues" 1 "$(echo "$S" | grep -c 'seuil minimal ....... 20 Go')"
verifier "aucune exigence de volume dedie" 0 "$(echo "$S" | grep -c 'volume non dedie')"
verifier "la cible de provisionnement n'est pas mentionnee" 0 \
  "$(echo "$S" | grep -c 'cible provisionnement')"

echo
echo "=== 2. mode vagues — reste une VRAIE porte ==="
S="$(TECDOC_REBUILD_MODE=vagues TECDOC_REBUILD_VAGUE_MIN_GO=999999 bash "$PORTE" / 2>&1)"; C=$?
verifier "verdict NO_GO sous le seuil" "NO_GO" "$(verdict "$S")"
verifier "code de sortie 1" 1 "$C"
verifier "le manque est chiffre" 1 "$(echo "$S" | grep -c 'il manque')"

S="$(TECDOC_REBUILD_MODE=vagues bash "$PORTE" "$INEXISTANT" 2>&1)"; C=$?
verifier "chemin inexistant -> NO_GO" "NO_GO" "$(verdict "$S")"
verifier "chemin inexistant -> sortie 1" 1 "$C"

# --- anti-regression du mode materialise ---------------------------------
echo
echo "=== 3. mode materialise — refus INCHANGE sur volume non dedie ==="
S="$(bash "$PORTE" / 2>&1)"; C=$?
verifier "verdict NO_GO (defaut = materialise)" "NO_GO" "$(verdict "$S")"
verifier "motif : volume non dedie" 1 "$(echo "$S" | grep -c 'NO_GO — volume non dedie')"
verifier "code de sortie 1" 1 "$C"

echo
echo "=== 4. mode materialise — refus INCHANGE sur point de montage absent ==="
S="$(bash "$PORTE" "$INEXISTANT" 2>&1)"; C=$?
verifier "verdict NO_GO" "NO_GO" "$(verdict "$S")"
verifier "motif : aucun volume dedie" 1 "$(echo "$S" | grep -c 'NO_GO — aucun volume dedie')"
verifier "renvoie vers la section Provisionnement" 1 "$(echo "$S" | grep -c 'Provisionnement')"

echo
echo "=== 5. mode materialise — seuils NON desserres ==="
verifier "seuil minimal reste 210 Go" 1 "$(grep -c 'TECDOC_REBUILD_MIN_GO:-210' "$PORTE")"
verifier "cible reste 250 Go" 1 "$(grep -c 'TECDOC_REBUILD_CIBLE_GO:-250' "$PORTE")"
# Meme cible, deux modes, deux verdicts : c'est la preuve que l'exigence de volume
# dedie appartient au mode materialise et n'a pas ete supprimee globalement.
M="$(bash "$PORTE" / 2>&1)"
V="$(TECDOC_REBUILD_MODE=vagues bash "$PORTE" / 2>&1)"
verifier "meme cible : materialise refuse" "NO_GO" "$(verdict "$M")"
verifier "meme cible : vagues accepte"     "GO"    "$(verdict "$V")"
verifier "le refus « volume non dedie » n'existe QUE en materialise" "1 0" \
  "$(echo "$M" | grep -c 'volume non dedie') $(echo "$V" | grep -c 'volume non dedie')"
verifier "materialise reste le mode par defaut" 1 \
  "$(grep -c 'TECDOC_REBUILD_MODE:-materialise' "$PORTE")"

# --- garde-fou de saisie -------------------------------------------------
echo
echo "=== 6. un mode inconnu est refuse, pas interprete ==="
S="$(TECDOC_REBUILD_MODE=nimporte bash "$PORTE" / 2>&1)"; C=$?
verifier "code de sortie 2" 2 "$C"
verifier "aucun verdict rendu" "" "$(verdict "$S")"
verifier "les modes valides sont nommes" 1 "$(echo "$S" | grep -c 'materialise | vagues')"

echo
printf '=== %s assertions · %s OK · %s KO ===\n' "$((OK + KO))" "$OK" "$KO"
[ "$KO" -eq 0 ] || exit 1
