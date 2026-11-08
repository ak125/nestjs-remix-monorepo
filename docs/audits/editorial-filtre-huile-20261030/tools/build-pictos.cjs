#!/usr/bin/env node
/**
 * Pictogrammes vidéo du dossier filtre à huile (révision 3 du 30/10/2026, complétés le 31/10).
 * Usage : NODE_PATH=<node_modules avec sharp> node tools/build-pictos.cjs
 * Sortie : assets/picto-*.{svg,webp} (1080×1080, fond transparent), pour le fond #0F1E38 de `SequencesCourtes`.
 * Dessins de principe, sans marque ni texte : la forme et la couleur exactes des témoins, de la clé et de la jauge
 * dépendent du véhicule.
 *   - témoin de pression d'huile : burette et goutte ;
 *   - arrêt impératif : octogone et point d'exclamation ;
 *   - contact coupé : clé barrée ;
 *   - niveau d'huile : jauge avec repères mini et maxi, sans niveau représenté.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const OUT = path.join(__dirname, '..', 'assets');
const RED = '#E5322D';
const WHITE = '#FFFFFF';

const svgDoc = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 512 512">
${body}
</svg>`;

const temoinSvg = () => svgDoc(`  <g fill="${RED}">
    <path d="M178 268 L72 222 L64 236 L178 302 Z"/>
    <rect x="170" y="262" width="210" height="80" rx="8"/>
    <rect x="252" y="236" width="44" height="30" rx="4"/>
    <path d="M64 252 C52 276 48 290 64 300 C80 290 76 276 64 252 Z"/>
  </g>
  <path d="M372 282 L432 252 L452 304 L384 330" fill="none" stroke="${RED}" stroke-width="16" stroke-linejoin="round"/>`);

const arretSvg = () => svgDoc(`  <path d="M176 62 L336 62 L450 176 L450 336 L336 450 L176 450 L62 336 L62 176 Z" fill="${RED}"/>
  <path d="M185 84 L327 84 L428 185 L428 327 L327 428 L185 428 L84 327 L84 185 Z" fill="none" stroke="${WHITE}" stroke-width="10"/>
  <rect x="232" y="138" width="48" height="166" rx="22" fill="${WHITE}"/>
  <circle cx="256" cy="362" r="28" fill="${WHITE}"/>`);

const contactSvg = () => svgDoc(`  <g fill="${WHITE}">
    <path fill-rule="evenodd" d="M160 168 A88 88 0 1 1 160 344 A88 88 0 1 1 160 168 Z M160 222 A34 34 0 1 0 160 290 A34 34 0 1 0 160 222 Z"/>
    <rect x="238" y="236" width="214" height="40" rx="8"/>
    <rect x="362" y="272" width="26" height="46" rx="4"/>
    <rect x="408" y="272" width="26" height="34" rx="4"/>
  </g>
  <line x1="96" y1="432" x2="432" y2="96" stroke="${RED}" stroke-width="30" stroke-linecap="round"/>`);

const niveauSvg = () => svgDoc(`  <defs><clipPath id="zone"><rect x="202" y="352" width="28" height="72"/></clipPath></defs>
  <g fill="none" stroke="${WHITE}" stroke-linecap="round" stroke-linejoin="round">
    <rect x="160" y="48" width="112" height="60" rx="30" stroke-width="18"/>
    <line x1="216" y1="108" x2="216" y2="322" stroke-width="16"/>
    <rect x="198" y="322" width="36" height="140" rx="8" stroke-width="8"/>
    <line x1="172" y1="352" x2="260" y2="352" stroke-width="8"/>
    <line x1="172" y1="424" x2="260" y2="424" stroke-width="8"/>
    <g clip-path="url(#zone)" stroke-width="5">
      <line x1="180" y1="372" x2="252" y2="300"/><line x1="180" y1="396" x2="252" y2="324"/>
      <line x1="180" y1="420" x2="252" y2="348"/><line x1="180" y1="444" x2="252" y2="372"/>
      <line x1="180" y1="468" x2="252" y2="396"/><line x1="180" y1="492" x2="252" y2="420"/>
    </g>
  </g>
  <path d="M352 196 C316 262 300 302 352 330 C404 302 388 262 352 196 Z" fill="${WHITE}"/>`);

const PICTOS = [
  ['picto-temoin-pression-huile', temoinSvg],
  ['picto-arret-imperatif', arretSvg],
  ['picto-contact-coupe', contactSvg],
  ['picto-niveau-huile', niveauSvg],
];

(async () => {
  for (const [name, draw] of PICTOS) {
    const svg = draw();
    fs.writeFileSync(path.join(OUT, `${name}.svg`), svg);
    await sharp(Buffer.from(svg)).webp({ quality: 90 }).toFile(path.join(OUT, `${name}.webp`));
    console.log(`${name}.webp`);
  }
})();
