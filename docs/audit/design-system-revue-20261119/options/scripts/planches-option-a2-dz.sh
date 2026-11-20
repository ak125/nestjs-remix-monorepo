#!/bin/bash
# Complément n° 4 DZ — option A2 (logo orange, action principale de chaque page en orange) : captures A2 en WebP,
# planche du premier écran AVANT / A / A2 / B pour chaque page et taille, planche des actions principales A2 par taille.
# Usage : bash scripts/planches-option-a2-dz.sh <dossier-brut> <dossier-options>
# Réutilise les captures brutes AVANT / A / B du complément n° 2 (mêmes passages). ImageMagick, DejaVu Sans. Aucun accès réseau.
set -euo pipefail
BRUT="$1"; OPT="$2"; cd "$OPT"
F=DejaVu-Sans; FB=DejaVu-Sans-Bold
LAB_avant="AVANT (main, DEV 7f4dded3)"; LAB_a="OPTION A : achat seul en orange"; LAB_a2="OPTION A2 : logo + action principale orange"; LAB_b="OPTION B : achat #C2410C, texte blanc"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
etiquette() { convert "$1" -resize "$2x" -bordercolor '#9CA3AF' -border 1 -gravity North -background white -splice 0x40 \
    -font "$FB" -pointsize 16 -fill '#0F1E38' -annotate +0+10 "$3" "$4"; }

while IFS=$'\t' read -r id route; do for W in 390 1440; do
  # 1. Captures A2 (mêmes réglages que le n° 2).
  convert "$BRUT/$id-$W-a2-ecran.png" -quality 60 "captures/$id-$W-a2-ecran.webp"
  if [ "$W" = 1440 ]; then convert "$BRUT/$id-$W-a2-page.png" -resize 50% -quality 50 "captures/$id-$W-a2-page.webp"
  else convert "$BRUT/$id-$W-a2-page.png" -quality 50 "captures/$id-$W-a2-page.webp"; fi
  # 2. Planche du premier écran AVANT / A / A2 / B (1440 réduit à 600 de large par vignette).
  [ "$W" = 1440 ] && L=600 || L=390; [ "$W" = 1440 ] && H=900 || H=844
  for v in avant a a2 b; do lab="LAB_$v"; etiquette "$BRUT/$id-$W-$v-ecran.png" $L "${!lab}" "$TMP/$v.png"; done
  convert "$TMP/avant.png" "$TMP/a.png" "$TMP/a2.png" "$TMP/b.png" -background white -splice 16x0 +append -chop 16x0 +repage \
    -gravity North -splice 0x56 -font "$FB" -pointsize 20 -fill '#0F1E38' -annotate +0+8 "$id, ${W}×${H}, premier écran, AVANT / A / A2 / B" \
    -font "$F" -pointsize 14 -fill '#1F2937' -annotate +0+34 "Maquette par feuille injectée, pas une implémentation. Rien n'est en vigueur." \
    -bordercolor white -border 16 -quality 72 "planches/$id-$W-a2.webp"
done; done < scripts/pages-options-dz.tsv

# 3. Recadrages des actions principales A2 (un fichier par action et état ; le désactivé réel de « Rechercher » est distinct du simulé).
for f in "$BRUT"/bouton-*-a2-*.png; do b=$(basename "$f" .png)
  case "$b" in *désactivé\ \(état\ réel*) b="${b%%-désactivé*}-desactive-reel";; *désactivé*) b="${b%%-désactivé*}-desactive";; esac
  convert "$f" -quality 90 "captures/boutons/$b.webp"; done

# 4. Planche des actions principales A2 par taille : une ligne par page et action, colonnes repos / survol / focus / désactivé, agrandi 3×.
for W in 390 1440; do args=(); n=0
  while IFS=$'\t' read -r id route; do for cle in rechercher ajouter panier trouver connexion; do
    ls "$BRUT"/bouton-$id-$W-$cle-a2-repos.png >/dev/null 2>&1 || continue; n=$((n+1))
    for e in repos survol focus desactive; do
      if [ "$e" = desactive ]; then src=$(ls "$BRUT"/bouton-$id-$W-$cle-a2-désactivé*réel*.png 2>/dev/null | head -1 || true); lab="désactivé (réel)"
        [ -z "$src" ] && { src=$(ls "$BRUT"/bouton-$id-$W-$cle-a2-désactivé*.png | head -1); lab="désactivé (simulé)"; }
      else src="$BRUT/bouton-$id-$W-$cle-a2-$e.png"; lab="$e"; fi
      [ "$cle" = rechercher ] && [ "$e" != desactive ] && lab="$lab (actif simulé)"
      [ "$cle" = trouver ] && [ "$e" = desactive ] && lab="désactivé : sans objet (lien)"
      convert "$src" -filter point -resize 300% "$TMP/$n-$e.png"; args+=(-label "$id · $cle · $lab" "$TMP/$n-$e.png")
    done; done; done < scripts/pages-options-dz.tsv
  montage -font "$F" -pointsize 14 "${args[@]}" -tile 4x$n -geometry +16+12 -background '#F5F7FA' "$TMP/grille.png"
  convert "$TMP/grille.png" -gravity North -background white -splice 0x56 -font "$FB" -pointsize 20 -fill '#0F1E38' \
    -annotate +0+8 "Actions principales, option A2, ${W} px, agrandies 3×" -font "$F" -pointsize 14 -fill '#1F2937' \
    -annotate +0+34 "Maquette par feuille injectée. « Rechercher » : désactivé réel servi ; états actifs simulés (attribut disabled retiré)." \
    -bordercolor white -border 12 -quality 82 "planches/actions-principales-a2-$W.webp"
done
du -cb captures/*-a2-*.webp captures/boutons/*-a2-*.webp planches/*-a2*.webp | tail -1
