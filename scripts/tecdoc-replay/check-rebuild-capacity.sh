#!/usr/bin/env bash
# Porte de capacite du rebuild TecDoc complet. Rend GO ou NO_GO, jamais « probablement ».
#
# POURQUOI CETTE GARDE EXISTE
# ---------------------------
# Le rebuild source-truth est PLUS VOLUMINEUX que le staging PROD : la PROD porte des
# prefixes tronques (BOSCH 69 000 lignes sur 9 357 752 emises), le rebuild charge la
# source complete. Lancer un rejeu de 110 DLNR sur un volume trop petit produit un
# echec a mi-parcours — exactement l'etat « a moitie construit » que ce chantier
# interdit. La capacite se verifie AVANT, pas quand le disque est plein.
#
# CHIFFRAGE (mesures PROD du 2026-09-08, artefact scelle 2026-03-reconstructed)
#   staging PROD mesure ......................... 109,5 Go
#     tecdoc_map.source_linkages ..... 90,0 Go (dont 33,7 index)
#     tecdoc_raw.t400 ................ 17,4 Go
#     tecdoc_raw.t232 ................  1,7 Go
#     tecdoc_map.source_linkage_criteria 356 Mo
#   facteur source-truth ........................ x1,20 (149 DLNR) / x1,28 (110 projetes)
#   -> donnees + index en rebuild ............... ~139 Go
#   + WAL, tri de construction d'index, scratch de parsing, archive 5,8 Go
#   + marge de securite 20 %
#
# BORNE INFERIEURE ASSUMEE : seuls 66/110 DLNR projetes portent un `.meta` de parsing.
# Le facteur source-truth est donc SOUS-ESTIME, et ces seuils sont des planchers.
set -uo pipefail

MIN_GO="${TECDOC_REBUILD_MIN_GO:-210}"     # en dessous : NO_GO, sans discussion
CIBLE_GO="${TECDOC_REBUILD_CIBLE_GO:-250}" # provisionnement vise
MOUNT="${1:-/mnt/tecdoc-rebuild}"

printf '=== Capacite du rebuild TecDoc — point de montage %s ===\n' "$MOUNT"

if [ ! -d "$MOUNT" ]; then
  echo "  ✗ $MOUNT n'existe pas."
  echo
  echo "NO_GO — aucun volume dedie. Voir la section « Provisionnement » de"
  echo "audit/massdoc-tecdoc-rebuild-environment-spec-2026-09-08.md."
  exit 1
fi

read -r dev fstype taille utilise libre pcent cible < <(
  df -PT --block-size=1 "$MOUNT" | tail -1 | awk '{print $1,$2,$3,$4,$5,$6,$7}')
libre_go=$(awk -v v="$libre" 'BEGIN{printf "%.1f", v/1024/1024/1024}')
taille_go=$(awk -v v="$taille" 'BEGIN{printf "%.1f", v/1024/1024/1024}')
inodes_libres=$(df -iP "$MOUNT" | tail -1 | awk '{print $4}')
opts=$(findmnt -no OPTIONS --target "$MOUNT" 2>/dev/null || echo "?")
proprio=$(stat -c '%U:%G %a' "$MOUNT" 2>/dev/null || echo "?")

printf '  device .............. %s\n'    "$dev"
printf '  filesystem .......... %s\n'    "$fstype"
printf '  mountpoint .......... %s\n'    "$cible"
printf '  mount options ....... %s\n'    "$opts"
printf '  owner / mode ........ %s\n'    "$proprio"
printf '  taille .............. %s Go\n' "$taille_go"
printf '  libre ............... %s Go\n' "$libre_go"
printf '  inodes libres ....... %s\n'    "$inodes_libres"
printf '  seuil minimal ....... %s Go\n' "$MIN_GO"
printf '  cible provisionnement %s Go\n' "$CIBLE_GO"
echo

# Un volume DEDIE : refuser un simple repertoire pose sur la racine, qui ferait
# partager l'espace avec le systeme et le runtime DEV.
dev_racine=$(df -PT / | tail -1 | awk '{print $1}')
if [ "$dev" = "$dev_racine" ]; then
  echo "  ✗ $MOUNT est sur le MEME systeme de fichiers que / ($dev)."
  echo "    Un rebuild qui remplit / arrete le runtime DEV et la session operateur."
  echo
  echo "NO_GO — volume non dedie."
  exit 1
fi

if awk -v l="$libre_go" -v m="$MIN_GO" 'BEGIN{exit !(l < m)}'; then
  manque=$(awk -v l="$libre_go" -v m="$MIN_GO" 'BEGIN{printf "%.1f", m-l}')
  echo "  ✗ $libre_go Go libres < $MIN_GO Go requis — il manque $manque Go."
  echo
  echo "NO_GO"
  exit 1
fi

if awk -v t="$taille_go" -v c="$CIBLE_GO" 'BEGIN{exit !(t < c)}'; then
  echo "  ⚠ volume de $taille_go Go : au-dessus du minimum, en dessous de la cible de"
  echo "    $CIBLE_GO Go. Le rejeu tient, la marge d'imprevu est mince."
fi
echo "GO"
