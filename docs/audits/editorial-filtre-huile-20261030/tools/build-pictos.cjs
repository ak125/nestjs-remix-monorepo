#!/usr/bin/env node
/**
 * Pictogrammes vidéo du dossier filtre à huile (révision 3, 30/10/2026).
 * Usage : NODE_PATH=<node_modules avec sharp> node tools/build-pictos.cjs
 * Sortie : assets/picto-temoin-pression-huile.{svg,webp} (1080×1080, fond transparent).
 * Dessin de principe du témoin de pression d'huile (burette et goutte), sans marque ni texte ;
 * la couleur et la forme exactes du témoin dépendent du véhicule.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const OUT = path.join(__dirname, '..', 'assets');
const RED = '#E5322D';

const temoinSvg = () => `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 512 512">
  <g fill="${RED}">
    <path d="M178 268 L72 222 L64 236 L178 302 Z"/>
    <rect x="170" y="262" width="210" height="80" rx="8"/>
    <rect x="252" y="236" width="44" height="30" rx="4"/>
    <path d="M64 252 C52 276 48 290 64 300 C80 290 76 276 64 252 Z"/>
  </g>
  <path d="M372 282 L432 252 L452 304 L384 330" fill="none" stroke="${RED}" stroke-width="16" stroke-linejoin="round"/>
</svg>`;

(async () => {
  const svg = temoinSvg();
  fs.writeFileSync(path.join(OUT, 'picto-temoin-pression-huile.svg'), svg);
  await sharp(Buffer.from(svg)).webp({ quality: 90 }).toFile(path.join(OUT, 'picto-temoin-pression-huile.webp'));
  console.log('picto-temoin-pression-huile.webp');
})();
