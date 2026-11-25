#!/bin/bash
# Complément n° 2 DZ — conversion des captures brutes (PNG, hors dépôt) en WebP et construction des planches.
# Usage : bash scripts/planches-options-dz.sh <dossier-brut> <dossier-options>
# ImageMagick (convert, montage), police DejaVu Sans. Aucune donnée réseau.
set -euo pipefail
BRUT="$1"; OPT="$2"; cd "$OPT"
mkdir -p captures captures/boutons planches
F=DejaVu-Sans; FB=DejaVu-Sans-Bold
LAB_avant="AVANT (main, DEV 7f4dded3)"; LAB_a="OPTION A : achat #F97316, texte navy"; LAB_b="OPTION B : achat #C2410C, texte blanc"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

# 1. Captures : premier écran en qualité 60 ; page entière en qualité 50, 1440 réduite à 50 %.
while IFS=$'\t' read -r id route; do for W in 390 1440; do for v in avant a b; do
  convert "$BRUT/$id-$W-$v-ecran.png" -quality 60 "captures/$id-$W-$v-ecran.webp"
  if [ "$W" = 1440 ]; then convert "$BRUT/$id-$W-$v-page.png" -resize 50% -quality 50 "captures/$id-$W-$v-page.webp"
  else convert "$BRUT/$id-$W-$v-page.png" -quality 50 "captures/$id-$W-$v-page.webp"; fi
done; done; done < scripts/pages-options-dz.tsv

# 2. Recadrages du bouton d'achat (un fichier par bouton, variante et état).
for f in "$BRUT"/bouton-*.png; do b=$(basename "$f" .png); b=${b%%-désactivé*}; [ "$b" != "$(basename "$f" .png)" ] && b="$b-desactive"
  convert "$f" -quality 90 "captures/boutons/$b.webp"; done

# 3. Planches : trois premiers écrans côte à côte, étiquetés (1440 réduit à 720 de large par vignette).
etiquette() { # $1 image, $2 largeur, $3 texte, $4 sortie
  convert "$1" -resize "$2x" -bordercolor '#9CA3AF' -border 1 -gravity North -background white -splice 0x40 \
    -font "$FB" -pointsize 17 -fill '#0F1E38' -annotate +0+10 "$3" "$4"; }
while IFS=$'\t' read -r id route; do for W in 390 1440; do
  [ "$W" = 1440 ] && L=720 || L=390; [ "$W" = 1440 ] && H=900 || H=844
  for v in avant a b; do lab="LAB_$v"; etiquette "$BRUT/$id-$W-$v-ecran.png" $L "${!lab}" "$TMP/$v.png"; done
  convert "$TMP/avant.png" "$TMP/a.png" "$TMP/b.png" -background white -splice 16x0 +append -chop 16x0 +repage \
    -gravity North -splice 0x56 -font "$FB" -pointsize 20 -fill '#0F1E38' -annotate +0+8 "$id, ${W}×${H}, premier écran" \
    -font "$F" -pointsize 14 -fill '#1F2937' -annotate +0+34 "Maquette par feuille injectée, pas une implémentation. Rien n'est en vigueur." \
    -bordercolor white -border 16 -quality 72 "planches/$id-$W.webp"
done; done < scripts/pages-options-dz.tsv

# 4. Planche du bouton d'achat r2-produit : agrandi 4×, colonnes AVANT / A / B, lignes repos / survol / focus / désactivé.
for cible in "r2-produit-1440-ajouter" "r2-produit-390-ajouter"; do args=()
  for e in repos survol focus desactive; do for v in avant a b; do
    src=$(ls "$BRUT"/bouton-$cible-$v-*.png | grep -- "-$v-${e/desactive/désactivé}" | head -1)
    convert "$src" -filter point -resize 400% "$TMP/$v-$e.png"
    case $v in avant) n="AVANT";; a) n="OPTION A";; b) n="OPTION B";; esac
    args+=(-label "$n, ${e/desactive/désactivé (simulé)}" "$TMP/$v-$e.png")
  done; done
  montage -font "$F" -pointsize 15 "${args[@]}" -tile 3x4 -geometry +18+14 -background '#F5F7FA' "$TMP/grille.png"
  convert "$TMP/grille.png" -gravity North -background white -splice 0x56 -font "$FB" -pointsize 20 -fill '#0F1E38' \
    -annotate +0+8 "Bouton d'achat seul, ${cible}, agrandi 4×" -font "$F" -pointsize 14 -fill '#1F2937' \
    -annotate +0+34 "Maquette par feuille injectée, pas une implémentation. Désactivé simulé par l'attribut disabled." \
    -bordercolor white -border 12 -quality 85 "planches/bouton-$cible.webp"
done
du -sh captures planches; du -cb captures/*.webp captures/boutons/*.webp planches/*.webp | tail -1
