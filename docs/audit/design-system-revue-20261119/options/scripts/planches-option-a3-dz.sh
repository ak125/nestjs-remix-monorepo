#!/bin/bash
# Complément n° 5 DZ — option A3 (A2 + « Ajouter » des cartes en contour navy, « Inscription » en contour blanc, marges de
# défilement, bords et badges sous seuil) : captures A3 en WebP, planche du premier écran AVANT / A2 / A3 pour chaque page
# et taille, planche des actions principales (orange) et secondaires (contour) A3 par taille.
# Usage : bash scripts/planches-option-a3-dz.sh <dossier-brut> <dossier-options>
# Réutilise les captures brutes AVANT (n° 2) et A2 (n° 4) des mêmes passages. ImageMagick, DejaVu Sans. Aucun accès réseau.
set -euo pipefail
BRUT="$1"; OPT="$2"; cd "$OPT"
F=DejaVu-Sans; FB=DejaVu-Sans-Bold
LAB_avant="AVANT (main, DEV 7f4dded3)"; LAB_a2="OPTION A2 (retenue)"; LAB_a3="OPTION A3 : A2 + améliorations"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
etiquette() { convert "$1" -resize "$2x" -bordercolor '#9CA3AF' -border 1 -gravity North -background white -splice 0x40 \
    -font "$FB" -pointsize 16 -fill '#0F1E38' -annotate +0+10 "$3" "$4"; }

while IFS=$'\t' read -r id route; do for W in 390 1440; do
  # 1. Captures A3 (mêmes réglages que les n° 2 et 4).
  convert "$BRUT/$id-$W-a3-ecran.png" -quality 60 "captures/$id-$W-a3-ecran.webp"
  if [ "$W" = 1440 ]; then convert "$BRUT/$id-$W-a3-page.png" -resize 50% -quality 50 "captures/$id-$W-a3-page.webp"
  else convert "$BRUT/$id-$W-a3-page.png" -quality 50 "captures/$id-$W-a3-page.webp"; fi
  # 2. Planche du premier écran AVANT / A2 / A3 (1440 réduit à 600 de large par vignette).
  [ "$W" = 1440 ] && L=600 || L=390; [ "$W" = 1440 ] && H=900 || H=844
  for v in avant a2 a3; do lab="LAB_$v"; etiquette "$BRUT/$id-$W-$v-ecran.png" $L "${!lab}" "$TMP/$v.png"; done
  convert "$TMP/avant.png" "$TMP/a2.png" "$TMP/a3.png" -background white -splice 16x0 +append -chop 16x0 +repage \
    -gravity North -splice 0x56 -font "$FB" -pointsize 20 -fill '#0F1E38' -annotate +0+8 "$id, ${W}×${H}, premier écran, AVANT / A2 / A3" \
    -font "$F" -pointsize 14 -fill '#1F2937' -annotate +0+34 "Maquette par feuille injectée, pas une implémentation. Rien n'est en vigueur." \
    -bordercolor white -border 16 -quality 72 "planches/$id-$W-a3.webp"
done; done < scripts/pages-options-dz.tsv

# 3. Recadrages des actions A3 (un fichier par action et état ; le désactivé réel de « Rechercher » est distinct du simulé).
for f in "$BRUT"/bouton-*-a3-*.png; do b=$(basename "$f" .png)
  case "$b" in *désactivé\ \(état\ réel*) b="${b%%-désactivé*}-desactive-reel";; *désactivé*) b="${b%%-désactivé*}-desactive";; esac
  convert "$f" -quality 90 "captures/boutons/$b.webp"; done

# 4. Planche des actions A3 par taille : une ligne par page et action, colonnes repos / survol / focus / désactivé, agrandi 3×.
for W in 390 1440; do args=(); n=0
  while IFS=$'\t' read -r id route; do for cle in rechercher panier trouver connexion ajouter inscription; do
    ls "$BRUT"/bouton-$id-$W-$cle-a3-repos.png >/dev/null 2>&1 || continue; n=$((n+1))
    case "$cle" in ajouter|inscription) role="secondaire, contour";; *) role="principale, orange";; esac
    for e in repos survol focus desactive; do
      if [ "$e" = desactive ]; then src=$(ls "$BRUT"/bouton-$id-$W-$cle-a3-désactivé*réel*.png 2>/dev/null | head -1 || true); lab="désactivé (réel)"
        [ -z "$src" ] && { src=$(ls "$BRUT"/bouton-$id-$W-$cle-a3-désactivé*.png | head -1); lab="désactivé (simulé)"; }
      else src="$BRUT/bouton-$id-$W-$cle-a3-$e.png"; lab="$e"; fi
      [ "$cle" = rechercher ] && [ "$e" != desactive ] && lab="$lab (actif simulé)"
      case "$cle" in trouver|inscription) [ "$e" = desactive ] && lab="désactivé : sans objet (lien)";; esac
      convert "$src" -filter point -resize 300% "$TMP/$n-$e.png"
      # Vignette élargie à 900 px au moins (fond de planche) : les étiquettes des petits boutons ne se chevauchent plus.
      w=$(identify -format %w "$TMP/$n-$e.png"); h=$(identify -format %h "$TMP/$n-$e.png")
      [ "$w" -lt 900 ] && convert "$TMP/$n-$e.png" -background '#F5F7FA' -gravity center -extent 900x$h "$TMP/$n-$e.png"
      # Étiquette écrite dans la vignette (une étiquette de montage peut être recouverte par la rangée suivante).
      convert "$TMP/$n-$e.png" -background '#F5F7FA' -gravity South -splice 0x34 -font "$F" -pointsize 20 -fill '#1F2937' \
        -annotate +0+6 "$id · $cle ($role) · $lab" "$TMP/$n-$e.png"
      args+=("$TMP/$n-$e.png")
    done; done; done < scripts/pages-options-dz.tsv
  montage "${args[@]}" -tile 4x$n -geometry +16+12 -background '#F5F7FA' "$TMP/grille.png"
  convert "$TMP/grille.png" -gravity North -background white -splice 0x56 -font "$FB" -pointsize 20 -fill '#0F1E38' \
    -annotate +0+8 "Actions principales (orange) et secondaires (contour), option A3, ${W} px, agrandies 3×" -font "$F" -pointsize 14 -fill '#1F2937' \
    -annotate +0+34 "Maquette par feuille injectée. « Rechercher » : désactivé réel servi ; états actifs simulés (attribut disabled retiré)." \
    -bordercolor white -border 12 -quality 82 "planches/actions-principales-secondaires-a3-$W.webp"
done
du -cb captures/*-a3-*.webp captures/boutons/*-a3-*.webp planches/*-a3*.webp | tail -1
