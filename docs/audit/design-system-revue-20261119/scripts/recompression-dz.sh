#!/usr/bin/env bash
# Mandat DZ — 6.6 : ramène le dossier sous 20 Mo en recompressant les seules captures pleine page (*-page.jpg)
# en JPEG qualité 28, sans changer leur résolution, avec ImageMagick déjà présent sur le VPS (/usr/bin/convert).
# Les captures « premier écran » (*-ecran.jpg) et de vérification restent telles que produites.
# Usage (depuis docs/audit/design-system-revue-20261119) : bash scripts/recompression-dz.sh
set -eu
cd "$(dirname "$0")/.."
for f in captures/*-page.jpg; do timeout 60 convert "$f" -strip -quality 28 "$f.tmp.jpg" && mv "$f.tmp.jpg" "$f"; done
du -sb . | cut -f1
