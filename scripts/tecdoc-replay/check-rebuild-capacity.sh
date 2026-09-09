#!/usr/bin/env bash
# Porte de capacite du rebuild TecDoc. Rend GO ou NO_GO, jamais « probablement ».
#
# DEUX MODES, DEUX PERIMETRES PHYSIQUES DISTINCTS
# ------------------------------------------------
# Le mode n'est pas un reglage de confort : les deux strategies de rebuild ont des
# besoins disque de nature differente, et une seule porte ne peut pas juger les deux
# honnetement. Assouplir le seuil du mode materialise pour faire passer un rejeu par
# vagues masquerait le vrai besoin du premier.
#
#   materialise (defaut) — les 110 DLNR coexistent dans une seule instance.
#     Besoin = la SOMME. Volume dedie obligatoire : un rebuild de ~139 Go qui remplit
#     la racine arrete le runtime DEV et la session operateur.
#
#   vagues — un DLNR est charge, controle, scelle, puis SA MATIERE EST PURGEE avant
#     le suivant. Besoin = le plus gros DLNR SEUL, pas la somme. Le volume dedie perd
#     sa raison d'etre : ce n'est pas la taille qui le justifiait mais le risque de
#     saturer la racine, et un pic de ~5 Go ne la sature pas. Le seuil reste une vraie
#     porte — il refuse simplement au bon niveau.
#
# CHIFFRAGE materialise (mesures PROD du 2026-09-08, artefact scelle 2026-03-reconstructed)
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
#
# CHIFFRAGE vagues (rejeu HIDRIA mesure : 203 octets/ligne, index compris)
#   FEBI, DLNR dimensionnant .... 17 421 432 lignes -> 3,3 Go en base
#   + CSV de parsing transitoire ................... ~1,5 Go
#   -> pic reel ..................................... ~5 Go
#   seuil retenu 20 Go = 4x le pic mesure. L'archive 7z (5,8 Go) est deja sur disque
#   et n'est pas dupliquee.
set -uo pipefail

MODE="${TECDOC_REBUILD_MODE:-materialise}"
MIN_GO="${TECDOC_REBUILD_MIN_GO:-210}"           # materialise — en dessous : NO_GO
CIBLE_GO="${TECDOC_REBUILD_CIBLE_GO:-250}"       # materialise — provisionnement vise
VAGUE_MIN_GO="${TECDOC_REBUILD_VAGUE_MIN_GO:-20}" # vagues — 4x le pic mesure

case "$MODE" in
  materialise) DEFAUT_MOUNT="/mnt/tecdoc-rebuild" ;;
  vagues)      DEFAUT_MOUNT="/" ;;  # le PostgreSQL jetable ecrit dans le stockage Docker
  *) echo "Mode inconnu : $MODE (attendu : materialise | vagues)" >&2; exit 2 ;;
esac
MOUNT="${1:-$DEFAUT_MOUNT}"

printf '=== Capacite du rebuild TecDoc — mode %s — cible %s ===\n' "$MODE" "$MOUNT"

if [ ! -d "$MOUNT" ]; then
  echo "  ✗ $MOUNT n'existe pas."
  echo
  if [ "$MODE" = "materialise" ]; then
    echo "NO_GO — aucun volume dedie. Voir la section « Provisionnement » de"
    echo "audit/massdoc-tecdoc-rebuild-environment-spec-2026-09-08.md."
  else
    echo "NO_GO — chemin cible introuvable."
  fi
  exit 1
fi

read -r dev fstype taille utilise libre pcent cible < <(
  df -PT --block-size=1 "$MOUNT" | tail -1 | awk '{print $1,$2,$3,$4,$5,$6,$7}')
libre_go=$(awk -v v="$libre" 'BEGIN{printf "%.1f", v/1024/1024/1024}')
taille_go=$(awk -v v="$taille" 'BEGIN{printf "%.1f", v/1024/1024/1024}')
inodes_libres=$(df -iP "$MOUNT" | tail -1 | awk '{print $4}')
opts=$(findmnt -no OPTIONS --target "$MOUNT" 2>/dev/null || echo "?")
proprio=$(stat -c '%U:%G %a' "$MOUNT" 2>/dev/null || echo "?")
seuil=$([ "$MODE" = "vagues" ] && echo "$VAGUE_MIN_GO" || echo "$MIN_GO")

printf '  device .............. %s\n'    "$dev"
printf '  filesystem .......... %s\n'    "$fstype"
printf '  mountpoint .......... %s\n'    "$cible"
printf '  mount options ....... %s\n'    "$opts"
printf '  owner / mode ........ %s\n'    "$proprio"
printf '  taille .............. %s Go\n' "$taille_go"
printf '  libre ............... %s Go\n' "$libre_go"
printf '  inodes libres ....... %s\n'    "$inodes_libres"
printf '  seuil minimal ....... %s Go\n' "$seuil"
[ "$MODE" = "materialise" ] && printf '  cible provisionnement %s Go\n' "$CIBLE_GO"
echo

# Volume DEDIE — exigence du mode materialise UNIQUEMENT. Elle ne protege pas de la
# taille mais du blast radius : un rebuild de ~139 Go qui remplit / arrete le runtime
# DEV. En mode vagues le pic est de ~5 Go, la racine n'est pas menacee, et imposer un
# volume separe reviendrait a refuser precisement les configurations bien dimensionnees.
if [ "$MODE" = "materialise" ]; then
  dev_racine=$(df -PT / | tail -1 | awk '{print $1}')
  if [ "$dev" = "$dev_racine" ]; then
    echo "  ✗ $MOUNT est sur le MEME systeme de fichiers que / ($dev)."
    echo "    Un rebuild qui remplit / arrete le runtime DEV et la session operateur."
    echo
    echo "NO_GO — volume non dedie."
    exit 1
  fi
fi

if awk -v l="$libre_go" -v m="$seuil" 'BEGIN{exit !(l < m)}'; then
  manque=$(awk -v l="$libre_go" -v m="$seuil" 'BEGIN{printf "%.1f", m-l}')
  echo "  ✗ $libre_go Go libres < $seuil Go requis — il manque $manque Go."
  echo
  echo "NO_GO"
  exit 1
fi

if [ "$MODE" = "materialise" ] && awk -v t="$taille_go" -v c="$CIBLE_GO" 'BEGIN{exit !(t < c)}'; then
  echo "  ⚠ volume de $taille_go Go : au-dessus du minimum, en dessous de la cible de"
  echo "    $CIBLE_GO Go. Le rejeu tient, la marge d'imprevu est mince."
fi
echo "GO"
