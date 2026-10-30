#!/usr/bin/env node
/**
 * Visuels du dossier filtre à huile (pg_id 7) : schémas de principe SVG, recadrages photo, image OG neutre.
 * Sortie : ../assets/ (SVG source + WebP servable). Aucune écriture hors du dossier.
 *
 * Usage : NODE_PATH=<node_modules contenant sharp> node tools/build-assets.cjs <photo-carree.jpg> <photo-large.jpg>
 *   photo-carree : recadrage carré de la photo Unsplash uhuTo7u8VXk (filtre vissé usagé tenu au-dessus du bac)
 *   photo-large  : recadrage large de la même photo
 *
 * Les schémas représentent un principe général : présence, nombre et position des clapets, orientation du filtre
 * et emplacement varient selon le moteur et le filtre. Ils n'illustrent aucun véhicule ni aucune référence.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const OUT = path.join(__dirname, '..', 'assets');
const FONT = 'Arial, Helvetica, sans-serif';
const C = {
  ink: '#1e293b',
  muted: '#475569',
  metal: '#cbd5e1',
  metalDark: '#94a3b8',
  rubber: '#1f2937',
  dirty: '#a16207',
  dirtyFill: '#e7c9a0',
  clean: '#ca8a04',
  cleanFill: '#fde68a',
  media: '#f5ecd7',
  mediaLine: '#b59a6a',
  clogged: '#6b5a45',
  accent: '#ea580c',
  bg: '#ffffff',
  panel: '#f8fafc',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function text(x, y, s, { size = 22, weight = 400, fill = C.ink, anchor = 'start' } = {}) {
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(s)}</text>`;
}

function lines(x, y, rows, opts = {}) {
  const lh = opts.lh || Math.round((opts.size || 22) * 1.3);
  return rows.map((r, i) => text(x, y + i * lh, r, opts)).join('');
}

function arrowDefs() {
  return `<defs>
  <marker id="aDirty" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.dirty}"/></marker>
  <marker id="aClean" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.clean}"/></marker>
  <marker id="aInk" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.muted}"/></marker>
</defs>`;
}

/** Plis du média filtrant : zigzag vertical dans une bande. */
function pleats(x0, x1, y0, y1, color = C.mediaLine) {
  const step = 14;
  let d = `M${x0},${y0}`;
  let left = true;
  for (let y = y0 + step; y <= y1; y += step) {
    d += ` L${left ? x1 : x0},${y}`;
    left = !left;
  }
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2"/>`;
}

/**
 * Filtre vissé en coupe, plaque de base en haut. Repère local : largeur 300, hauteur 430.
 * opts.clogged : média colmaté et clapet de dérivation ouvert (l'huile contourne le média).
 * opts.flow : flèches de circulation.
 */
function spinOnCutaway(tx, ty, s, opts = {}) {
  const clogged = !!opts.clogged;
  const flow = opts.flow !== false;
  const g = [];
  // Huile non filtrée entre la paroi et le média
  g.push(`<rect x="8" y="50" width="284" height="362" rx="30" fill="${C.dirtyFill}" opacity="0.55"/>`);
  // Corps (paroi coupée) avec dôme
  g.push(`<path d="M0,44 L0,382 Q0,426 44,426 L256,426 Q300,426 300,382 L300,44" fill="none" stroke="${C.muted}" stroke-width="8"/>`);
  // Plaque de base (orifices d'entrée de chaque côté, sortie centrale filetée)
  g.push(`<rect x="-14" y="22" width="84" height="26" fill="${C.metalDark}" stroke="${C.muted}" stroke-width="2"/>`);
  g.push(`<rect x="96" y="22" width="20" height="26" fill="${C.metalDark}" stroke="${C.muted}" stroke-width="2"/>`);
  g.push(`<rect x="184" y="22" width="20" height="26" fill="${C.metalDark}" stroke="${C.muted}" stroke-width="2"/>`);
  g.push(`<rect x="230" y="22" width="84" height="26" fill="${C.metalDark}" stroke="${C.muted}" stroke-width="2"/>`);
  // Orifices d'entrée (vides dans la plaque)
  g.push(`<rect x="70" y="22" width="26" height="26" fill="${C.dirtyFill}"/>`);
  g.push(`<rect x="204" y="22" width="26" height="26" fill="${C.dirtyFill}"/>`);
  // Sortie centrale filetée
  g.push(`<rect x="116" y="-6" width="68" height="54" fill="${C.cleanFill}" stroke="${C.muted}" stroke-width="2"/>`);
  let thr = '';
  for (let y = -2; y < 46; y += 8) thr += `<line x1="116" y1="${y}" x2="124" y2="${y + 4}" stroke="${C.muted}" stroke-width="2"/><line x1="184" y1="${y}" x2="176" y2="${y + 4}" stroke="${C.muted}" stroke-width="2"/>`;
  g.push(thr);
  // Joint d'étanchéité (section du joint annulaire)
  g.push(`<rect x="8" y="8" width="40" height="14" rx="7" fill="${C.rubber}"/>`);
  g.push(`<rect x="252" y="8" width="40" height="14" rx="7" fill="${C.rubber}"/>`);
  // Clapet anti-retour : membrane sous les orifices d'entrée
  g.push(`<path d="M58,52 Q83,${clogged ? 64 : 70} 110,54" fill="none" stroke="${C.rubber}" stroke-width="6" stroke-linecap="round"/>`);
  g.push(`<path d="M190,54 Q217,${clogged ? 64 : 70} 242,52" fill="none" stroke="${C.rubber}" stroke-width="6" stroke-linecap="round"/>`);
  // Coupelles du média
  g.push(`<rect x="62" y="80" width="54" height="10" fill="${C.metalDark}"/><rect x="184" y="80" width="54" height="10" fill="${C.metalDark}"/>`);
  g.push(`<rect x="62" y="364" width="176" height="10" fill="${C.metalDark}"/>`);
  // Média filtrant plissé (deux sections)
  const mFill = clogged ? '#cdbfa6' : C.media;
  g.push(`<rect x="66" y="90" width="48" height="274" fill="${mFill}"/><rect x="186" y="90" width="48" height="274" fill="${mFill}"/>`);
  g.push(pleats(66, 114, 90, 364, clogged ? C.clogged : C.mediaLine));
  g.push(pleats(186, 234, 90, 364, clogged ? C.clogged : C.mediaLine));
  if (clogged) {
    let dots = '';
    for (let i = 0; i < 40; i++) {
      const x = (i % 2 ? 60 : 236) + ((i * 7) % 6);
      const y = 100 + ((i * 37) % 250);
      dots += `<circle cx="${x}" cy="${y}" r="3" fill="${C.clogged}"/>`;
    }
    g.push(dots);
  }
  // Tube central perforé et huile filtrée
  g.push(`<rect x="118" y="48" width="64" height="316" fill="${C.cleanFill}" opacity="0.8"/>`);
  g.push(`<line x1="118" y1="90" x2="118" y2="364" stroke="${C.muted}" stroke-width="3" stroke-dasharray="12 7"/>`);
  g.push(`<line x1="182" y1="90" x2="182" y2="364" stroke="${C.muted}" stroke-width="3" stroke-dasharray="12 7"/>`);
  // Clapet anti-siphon (côté huile propre), à l'entrée de la sortie centrale
  g.push(`<path d="M122,64 L140,74 L122,84 Z" fill="${C.rubber}"/><path d="M178,64 L160,74 L178,84 Z" fill="${C.rubber}"/>`);
  // Clapet de dérivation (by-pass) dans la coupelle inférieure
  const bpY = clogged ? 392 : 376;
  g.push(`<rect x="128" y="${bpY}" width="44" height="8" rx="3" fill="${C.rubber}"/>`);
  let spring = `M150,${bpY + 8}`;
  for (let i = 1; i <= 5; i++) spring += ` L${i % 2 ? 140 : 160},${bpY + 8 + i * 5}`;
  g.push(`<path d="${spring}" fill="none" stroke="${C.muted}" stroke-width="2"/>`);
  if (flow) {
    // Entrées, descente, traversée du média ou contournement, remontée
    g.push(`<path d="M83,-24 L83,40" stroke="${C.dirty}" stroke-width="5" fill="none" marker-end="url(#aDirty)"/>`);
    g.push(`<path d="M217,-24 L217,40" stroke="${C.dirty}" stroke-width="5" fill="none" marker-end="url(#aDirty)"/>`);
    g.push(`<path d="M34,96 L34,300" stroke="${C.dirty}" stroke-width="5" fill="none" marker-end="url(#aDirty)"/>`);
    g.push(`<path d="M266,96 L266,300" stroke="${C.dirty}" stroke-width="5" fill="none" marker-end="url(#aDirty)"/>`);
    if (!clogged) {
      g.push(`<path d="M40,214 L126,214" stroke="${C.dirty}" stroke-width="5" fill="none" marker-end="url(#aClean)"/>`);
      g.push(`<path d="M260,250 L174,250" stroke="${C.dirty}" stroke-width="5" fill="none" marker-end="url(#aClean)"/>`);
    } else {
      g.push(`<path d="M34,320 Q34,404 120,402" stroke="${C.dirty}" stroke-width="5" fill="none" marker-end="url(#aDirty)"/>`);
      g.push(`<path d="M266,320 Q266,404 180,402" stroke="${C.dirty}" stroke-width="5" fill="none" marker-end="url(#aDirty)"/>`);
      g.push(`<path d="M150,384 L150,120" stroke="${C.dirty}" stroke-width="6" fill="none" stroke-dasharray="14 8" marker-end="url(#aDirty)"/>`);
    }
    g.push(`<path d="M150,${clogged ? 100 : 330} L150,-30" stroke="${clogged ? C.dirty : C.clean}" stroke-width="7" fill="none" marker-end="url(#${clogged ? 'aDirty' : 'aClean'})"/>`);
  }
  return `<g transform="translate(${tx},${ty}) scale(${s})">${g.join('')}</g>`;
}

/** Repère : ligne d'appel du point (px,py) vers un libellé. */
function callout(px, py, lx, ly, rows, anchor = 'start', opts = {}) {
  const line = `<path d="M${px},${py} L${lx + (anchor === 'start' ? -10 : 10)},${ly - 7}" stroke="${C.muted}" stroke-width="2" fill="none"/><circle cx="${px}" cy="${py}" r="5" fill="${opts.dot || C.accent}"/>`;
  return line + lines(lx, ly, rows, { size: opts.size || 21, anchor, weight: opts.weight || 400 });
}

function svgDoc(w, h, body, title) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
${arrowDefs()}
<rect width="${w}" height="${h}" fill="${C.bg}"/>
${body}
</svg>
`;
}

/** R1 TYPES (4:3) : filtre vissé et cartouche. */
function typesSvg() {
  const W = 1200, H = 900;
  const b = [];
  b.push(`<rect x="24" y="24" width="564" height="852" rx="18" fill="${C.panel}"/><rect x="612" y="24" width="564" height="852" rx="18" fill="${C.panel}"/>`);
  b.push(text(306, 84, 'Filtre vissé', { size: 36, weight: 700, anchor: 'middle' }));
  b.push(text(894, 84, 'Cartouche', { size: 36, weight: 700, anchor: 'middle' }));
  // Filtre vissé entier, entouré : tout le bloc se remplace
  b.push(spinOnCutaway(250, 190, 0.8, { flow: false }));
  b.push(`<rect x="224" y="158" width="292" height="378" rx="16" fill="none" stroke="${C.accent}" stroke-width="4" stroke-dasharray="14 9"/>`);
  b.push(callout(272, 202, 200, 215, ['Joint'], 'end'));
  b.push(callout(246, 218, 200, 290, ['Plaque de base'], 'end'));
  b.push(callout(322, 374, 200, 390, ['Élément', 'filtrant'], 'end'));
  b.push(lines(306, 660, ['Boîtier et élément filtrant', 'forment un seul bloc :', 'il se change en entier.'], { size: 24, anchor: 'middle', weight: 600 }));
  // Cartouche : boîtier démontable fixé au moteur, couvercle, joint torique, élément seul remplacé
  const ox = 744, oy = 170;
  b.push(`<g transform="translate(${ox},${oy})">`);
  // Support moteur hachuré
  b.push(`<rect x="-30" y="400" width="360" height="40" fill="${C.metalDark}"/>`);
  let hatch = '';
  for (let x = -30; x < 330; x += 18) hatch += `<line x1="${x}" y1="440" x2="${x + 18}" y2="400" stroke="${C.muted}" stroke-width="1.5"/>`;
  b.push(hatch);
  // Boîtier (cuve) fixé, coupé
  b.push(`<path d="M20,400 L20,90 M280,90 L280,400" stroke="${C.muted}" stroke-width="10" fill="none"/>`);
  b.push(`<rect x="25" y="90" width="250" height="310" fill="${C.dirtyFill}" opacity="0.45"/>`);
  // Couvercle vissé et joint torique
  b.push(`<rect x="0" y="40" width="300" height="40" rx="8" fill="${C.metalDark}" stroke="${C.muted}" stroke-width="3"/>`);
  b.push(`<rect x="110" y="10" width="80" height="34" rx="4" fill="${C.metalDark}" stroke="${C.muted}" stroke-width="3"/>`);
  b.push(`<circle cx="22" cy="86" r="9" fill="${C.rubber}"/><circle cx="278" cy="86" r="9" fill="${C.rubber}"/>`);
  // Élément filtrant (cartouche) entouré : seule pièce remplacée
  b.push(`<rect x="66" y="110" width="48" height="260" fill="${C.media}"/><rect x="186" y="110" width="48" height="260" fill="${C.media}"/>`);
  b.push(pleats(66, 114, 110, 370));
  b.push(pleats(186, 234, 110, 370));
  b.push(`<rect x="62" y="102" width="176" height="8" fill="${C.metalDark}"/><rect x="62" y="370" width="176" height="8" fill="${C.metalDark}"/>`);
  b.push(`<rect x="118" y="110" width="64" height="260" fill="${C.cleanFill}" opacity="0.7"/>`);
  b.push(`<rect x="50" y="94" width="200" height="294" rx="12" fill="none" stroke="${C.accent}" stroke-width="4" stroke-dasharray="14 9"/>`);
  b.push(`</g>`);
  b.push(callout(ox + 150, oy + 24, 1000, 150, ['Couvercle'], 'start'));
  b.push(callout(ox + 278, oy + 86, 1056, 300, ['Joint', 'torique'], 'start', { size: 20 }));
  b.push(callout(ox + 90, oy + 240, 650, 520, ['Élément', 'filtrant'], 'start'));
  b.push(callout(ox + 275, oy + 300, 1056, 470, ['Boîtier', 'démontable'], 'start', { size: 20 }));
  b.push(lines(894, 660, ['Le boîtier est conservé :', 'seul l’élément filtrant', 'est renouvelé.'], { size: 24, anchor: 'middle', weight: 600 }));
  b.push(text(600, 858, 'Schéma de principe ─ partie remplacée en pointillés', { size: 18, anchor: 'middle', fill: C.muted }));
  return svgDoc(W, H, b.join('\n'), 'Filtre à huile vissé et cartouche : ce qui se remplace');
}

/** R3 S3 (4:3) : coupe d'un filtre vissé, composants et clapets. */
function cutawaySvg() {
  const W = 1200, H = 900;
  const ox = 450, oy = 200, s = 1.0;
  const P = (x, y) => [ox + x * s, oy + y * s];
  const b = [];
  b.push(text(600, 70, 'Filtre à huile vissé, vu en coupe', { size: 36, weight: 700, anchor: 'middle' }));
  b.push(text(600, 108, 'Huile à filtrer en brun, huile filtrée en jaune', { size: 22, anchor: 'middle', fill: C.muted }));
  b.push(spinOnCutaway(ox, oy, s, { flow: true }));
  const L = (pt, lx, ly, rows, a) => callout(pt[0], pt[1], lx, ly, rows, a);
  b.push(L(P(28, 15), 300, 170, ['Joint d’étanchéité'], 'end'));
  b.push(L(P(83, 35), 300, 250, ['Orifices d’entrée'], 'end'));
  b.push(L(P(150, 10), 900, 170, ['Sortie centrale filetée'], 'start'));
  b.push(L(P(84, 66), 300, 330, ['Clapet anti-retour', '(membrane)'], 'end'));
  b.push(L(P(90, 250), 300, 470, ['Papier filtrant plissé'], 'end'));
  b.push(L(P(182, 300), 900, 520, ['Tube central perforé'], 'start'));
  b.push(L(P(170, 74), 900, 290, ['Clapet anti-siphon', '(côté huile propre)'], 'start'));
  b.push(L(P(150, 380), 900, 660, ['Clapet de dérivation', '(by-pass)'], 'start'));
  b.push(lines(600, 800, ['Schéma de principe. Selon sa conception, un filtre vissé comporte tout ou partie de ces clapets ;', 'leur position, la forme du filtre et son orientation varient selon le moteur.'], { size: 19, anchor: 'middle', fill: C.muted }));
  return svgDoc(W, H, b.join('\n'), 'Coupe de principe d’un filtre à huile vissé');
}

/** R3 S2 (16:9) : média en bon état contre média colmaté (clapet de dérivation ouvert). */
function bypassSvg() {
  const W = 1280, H = 720;
  const b = [];
  b.push(`<rect x="20" y="20" width="610" height="680" rx="18" fill="${C.panel}"/><rect x="650" y="20" width="610" height="680" rx="18" fill="${C.panel}"/>`);
  b.push(text(325, 74, 'Papier filtrant en bon état', { size: 30, weight: 700, anchor: 'middle' }));
  b.push(text(955, 74, 'Papier filtrant colmaté', { size: 30, weight: 700, anchor: 'middle' }));
  b.push(spinOnCutaway(205, 150, 0.82, { flow: true }));
  b.push(spinOnCutaway(835, 150, 0.82, { flow: true, clogged: true }));
  b.push(lines(325, 590, ['L’huile traverse le papier filtrant', 'avant de repartir vers le moteur.'], { size: 23, anchor: 'middle' }));
  b.push(lines(955, 590, ['Le clapet de dérivation s’ouvre : l’huile', 'continue d’alimenter le moteur,', 'mais elle n’est plus filtrée.'], { size: 23, anchor: 'middle' }));
  b.push(callout(835 + 150 * 0.82, 150 + 396 * 0.82, 1150, 470, ['Clapet', 'ouvert'], 'start'));
  b.push(text(640, 690, 'Schéma de principe ─ position du clapet de dérivation variable selon le filtre', { size: 17, anchor: 'middle', fill: C.muted }));
  return svgDoc(W, H, b.join('\n'), 'Filtre à huile : circulation normale et filtre colmaté');
}

/** R1 PRICE (4:3), remplacement neutre sans prix : caractéristiques de qualité. */
function qualitySvg() {
  const W = 1200, H = 900;
  const ox = 470, oy = 230, s = 0.9;
  const P = (x, y) => [ox + x * s, oy + y * s];
  const b = [];
  b.push(text(600, 80, 'Caractéristiques de qualité', { size: 38, weight: 700, anchor: 'middle' }));
  b.push(text(600, 122, 'd’un filtre à huile', { size: 30, anchor: 'middle', fill: C.muted }));
  b.push(spinOnCutaway(ox, oy, s, { flow: false }));
  b.push(callout(...P(90, 230), 380, 430, ['Papier filtrant'], 'end', { size: 26, weight: 600 }));
  b.push(callout(...P(150, 382), 860, 640, ['Clapet de dérivation', '(by-pass)'], 'start', { size: 26, weight: 600 }));
  b.push(callout(...P(84, 66), 380, 270, ['Clapet anti-retour'], 'end', { size: 26, weight: 600 }));
  b.push(lines(600, 790, ['Un filtre n’assure son rôle que s’il est bien monté,', 'selon les instructions du constructeur et du fabricant.'], { size: 22, anchor: 'middle', fill: C.muted }));
  return svgDoc(W, H, b.join('\n'), 'Caractéristiques de qualité d’un filtre à huile');
}

async function writeSvgWebp(name, svg, width) {
  fs.writeFileSync(path.join(OUT, `${name}.svg`), svg);
  await sharp(Buffer.from(svg), { density: 144 }).resize({ width }).webp({ quality: 88 }).toFile(path.join(OUT, `${name}.webp`));
}

async function main() {
  const [square, wide] = process.argv.slice(2);
  if (!square || !wide) {
    console.error('usage: build-assets.cjs <photo-carree.jpg> <photo-large.jpg>');
    process.exit(2);
  }
  fs.mkdirSync(OUT, { recursive: true });
  await writeSvgWebp('r1-types-visse-cartouche', typesSvg(), 1200);
  await writeSvgWebp('r3-s3-coupe-filtre-visse', cutawaySvg(), 1200);
  await writeSvgWebp('r3-s2-filtre-colmate-by-pass', bypassSvg(), 1280);
  await writeSvgWebp('r1-price-caracteristiques-qualite', qualitySvg(), 1200);

  // Photos : HERO R1 carré, HERO R3 16:9
  await sharp(square).resize(720, 720, { fit: 'cover' }).webp({ quality: 82 }).toFile(path.join(OUT, 'r1-hero-filtre-visse-usage.webp'));
  const wm = await sharp(wide).metadata();
  const cropW = Math.min(wm.width, Math.round((wm.height * 16) / 9));
  const left = Math.max(0, Math.round((wm.width - cropW) / 2));
  await sharp(wide)
    .extract({ left, top: 0, width: cropW, height: wm.height })
    .resize(1280, 720, { fit: 'cover' })
    .webp({ quality: 82 })
    .toFile(path.join(OUT, 'r3-hero-filtre-visse-usage.webp'));

  // OG 1200×630 neutre : photo à gauche, texte sans prix ni promesse de livraison
  const photo = await sharp(square).resize(630, 630, { fit: 'cover' }).toBuffer();
  const ogText = svgDoc(1200, 630, [
    `<rect x="630" y="0" width="570" height="630" fill="${C.panel}"/>`,
    text(680, 230, 'Filtre à huile', { size: 64, weight: 700 }),
    lines(680, 310, ['Vissé ou cartouche :', 'la référence se choisit', 'selon la motorisation.'], { size: 34, fill: C.muted, lh: 46 }),
    `<rect x="680" y="500" width="120" height="6" fill="${C.accent}"/>`,
    text(680, 556, 'automecanik.com', { size: 28, weight: 600 }),
  ].join(''), 'Filtre à huile : choisir la référence de sa motorisation');
  const ogBg = await sharp(Buffer.from(ogText)).png().toBuffer();
  await sharp(ogBg).composite([{ input: photo, left: 0, top: 0 }]).webp({ quality: 85 }).toFile(path.join(OUT, 'r1-og-filtre-a-huile.webp'));
  fs.writeFileSync(path.join(OUT, 'r1-og-filtre-a-huile.svg'), ogText);

  for (const f of fs.readdirSync(OUT).filter((f) => f.endsWith('.webp')).sort()) {
    const m = await sharp(path.join(OUT, f)).metadata();
    console.log(`${f}\t${m.width}x${m.height}\t${fs.statSync(path.join(OUT, f)).size} o`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
