#!/bin/bash
# Complément n° 10 : cinq liens témoins, deux largeurs.
PW=<worktree>/node_modules/playwright
B=http://127.0.0.1:3029
run(){ # nom R1 SEL CIBLE
  for w in 390 1440; do h=$([ $w = 390 ] && echo 844 || echo 900)
    rm -rf c10-profil-$1-$w
    CHROME=/usr/bin/google-chrome PW=$PW R1="$2" SEL="$3" CIBLE="$4" timeout 400 node lien-du10.cjs $B $w $h c10-profil-$1-$w c10-$1-$w.json > c10-$1-$w.log 2>&1; echo "$1 $w exit $?"
  done; }
run fah-qualite /pieces/filtre-a-huile-7.html '#qualite-prix .gamme-editorial a[href="/blog-pieces-auto/guide-achat/filtre-a-huile"]' 'guide-achat/filtre-a-huile'
run fah-emplacement /pieces/filtre-a-huile-7.html '#emplacement .gamme-editorial a[href="/reference-auto/filtre-a-huile"]' 'reference-auto/filtre-a-huile'
run res-choisir /pieces/ressort-de-suspension-188.html '#bien-choisir .gamme-editorial a[href="/pieces/amortisseur-854.html"]' 'amortisseur-854'
run res-qualite /pieces/ressort-de-suspension-188.html '#qualite-prix .gamme-editorial a[href="/reference-auto/ressort-de-suspension"]' 'reference-auto/ressort-de-suspension'
run res-emplacement /pieces/ressort-de-suspension-188.html '#emplacement .gamme-editorial a[href="/pieces/amortisseur-854.html"]' 'amortisseur-854'
