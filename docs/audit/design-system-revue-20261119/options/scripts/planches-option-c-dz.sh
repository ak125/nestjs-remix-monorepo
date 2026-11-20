#!/bin/bash
# Complément n° 3 DZ — option C (achat vert), r2-produit seulement : captures C en WebP et trois planches.
# Usage : bash scripts/planches-option-c-dz.sh <dossier-brut> <dossier-options>
# Réutilise les captures brutes AVANT / A / B du complément n° 2 (mêmes passages) et ajoute C.
set -euo pipefail
BRUT="$1"; OPT="$2"; cd "$OPT"
F=DejaVu-Sans; FB=DejaVu-Sans-Bold; id=r2-produit
LAB_avant="AVANT (main, DEV 7f4dded3)"; LAB_a="OPTION A : achat #F97316, texte navy"; LAB_b="OPTION B : achat #C2410C, texte blanc"; LAB_c="OPTION C : achat #1E8449, texte blanc"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
etiquette() { convert "$1" -resize "$2x" -bordercolor '#9CA3AF' -border 1 -gravity North -background white -splice 0x40 \
    -font "$FB" -pointsize 17 -fill '#0F1E38' -annotate +0+10 "$3" "$4"; }

for W in 390 1440; do
  # 1. Captures C (mêmes réglages que le n° 2).
  convert "$BRUT/$id-$W-c-ecran.png" -quality 60 "captures/$id-$W-c-ecran.webp"
  if [ "$W" = 1440 ]; then convert "$BRUT/$id-$W-c-page.png" -resize 50% -quality 50 "captures/$id-$W-c-page.webp"
  else convert "$BRUT/$id-$W-c-page.png" -quality 50 "captures/$id-$W-c-page.webp"; fi
  # 2. Planche du premier écran AVANT / A / B / C (1440 réduit à 600 de large par vignette).
  [ "$W" = 1440 ] && L=600 || L=390; [ "$W" = 1440 ] && H=900 || H=844
  for v in avant a b c; do lab="LAB_$v"; etiquette "$BRUT/$id-$W-$v-ecran.png" $L "${!lab}" "$TMP/$v.png"; done
  convert "$TMP/avant.png" "$TMP/a.png" "$TMP/b.png" "$TMP/c.png" -background white -splice 16x0 +append -chop 16x0 +repage \
    -gravity North -splice 0x56 -font "$FB" -pointsize 20 -fill '#0F1E38' -annotate +0+8 "$id, ${W}×${H}, premier écran, AVANT / A / B / C" \
    -font "$F" -pointsize 14 -fill '#1F2937' -annotate +0+34 "Maquette par feuille injectée, pas une implémentation. Rien n'est en vigueur." \
    -bordercolor white -border 16 -quality 72 "planches/$id-$W-abc.webp"
  # 3. Éléments verts du même écran que le bouton d'achat, AVANT et option C (captures annotées, cadres numérotés).
  for f in "$BRUT"/verts-$id-$W-{avant,c}-*-annote.png; do b=$(basename "$f" .png)
    convert "$f" -quality 72 "captures/$b.webp"; done
done

# 4. Recadrages du bouton C, puis planche du bouton d'achat seul, agrandi 4×, colonnes A / B / C.
for f in "$BRUT"/bouton-$id-*-ajouter-c-*.png; do b=$(basename "$f" .png); b=${b%%-désactivé*}; [ "$b" != "$(basename "$f" .png)" ] && b="$b-desactive"
  convert "$f" -quality 90 "captures/boutons/$b.webp"; done
for cible in "$id-1440-ajouter" "$id-390-ajouter"; do args=()
  for e in repos survol focus desactive; do for v in a b c; do
    src=$(ls "$BRUT"/bouton-$cible-$v-*.png | grep -- "-$v-${e/desactive/désactivé}" | head -1)
    convert "$src" -filter point -resize 400% "$TMP/$v-$e.png"
    args+=(-label "OPTION ${v^^}, ${e/desactive/désactivé (simulé)}" "$TMP/$v-$e.png")
  done; done
  montage -font "$F" -pointsize 15 "${args[@]}" -tile 3x4 -geometry +18+14 -background '#F5F7FA' "$TMP/grille.png"
  convert "$TMP/grille.png" -gravity North -background white -splice 0x56 -font "$FB" -pointsize 20 -fill '#0F1E38' \
    -annotate +0+8 "Bouton d'achat seul, ${cible}, agrandi 4×, A / B / C" -font "$F" -pointsize 14 -fill '#1F2937' \
    -annotate +0+34 "Maquette par feuille injectée, pas une implémentation. Désactivé simulé par l'attribut disabled." \
    -bordercolor white -border 12 -quality 85 "planches/bouton-$cible-abc.webp"
done
du -cb captures/$id-*-c-*.webp captures/verts-*.webp captures/boutons/*-ajouter-c-*.webp planches/*-abc.webp | tail -1
