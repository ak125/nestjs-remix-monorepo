#!/usr/bin/env node
/**
 * Déclinaisons sociales du dossier filtre à huile (pg_id 7) : diapositives des carrousels Instagram (1080 × 1350) et
 * couvertures des vidéos verticales (1080 × 1920). Textes lus dans ../integration/social.json, seule source.
 * Sortie : ../assets/social/*.webp. Aucune écriture hors du dossier.
 *
 * Usage : NODE_PATH=<node_modules contenant sharp> node tools/build-social.cjs
 *
 * Visuels : photo Unsplash uhuTo7u8VXk (assets/sources), schémas du dossier (SVG de build-assets.cjs et
 * build-pictos.cjs) et schémas de principe dessinés ici. Aucun véhicule, aucune référence, aucun prix, aucune
 * marque de pièce. Logotype : texte « AutoMecanik » en Arial ; le logo servi (frontend/public/logo-navbar*) porte un
 * slogan de prix, exclu des réseaux par les motifs interdits.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'social');
const SOCIAL = JSON.parse(fs.readFileSync(path.join(ROOT, 'integration', 'social.json'), 'utf8'));
const PHOTO = path.join(ROOT, 'assets', 'sources', 'photo-uhuTo7u8VXk-large.jpg');
const FONT = 'Arial, Helvetica, sans-serif';
// Couleurs de marque (brand-rules-seed.ts) et teintes des schémas du dossier
const B = { navy: '#0F1E38', orange: '#F97316', green: '#1FDC93', white: '#FFFFFF', ink: '#1A1A1A' };
const C = {
  muted: '#475569', light: '#94a3b8', metal: '#cbd5e1', metalDark: '#94a3b8', rubber: '#1f2937',
  oil: '#fde68a', oilLine: '#ca8a04', media: '#f5ecd7', mediaLine: '#b59a6a', panel: '#F1F5F9',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Largeur approchée d'un texte Arial, en em : sert au retour à la ligne, vérifié à l'œil sur la planche. */
function textWidth(s, size, bold) {
  let w = 0;
  for (const ch of s) {
    if (' iljtfrI.,:;!\'’|'.includes(ch)) w += 0.3;
    else if ('mwMW'.includes(ch)) w += 0.85;
    else if (/[A-ZÀ-ÖØ-Þ]/.test(ch)) w += 0.68;
    else w += 0.56;
  }
  return w * size * (bold ? 1.07 : 1);
}

function wrap(s, maxW, size, bold) {
  const out = [];
  for (const para of String(s).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const t = line ? `${line} ${word}` : word;
      if (line && textWidth(t, size, bold) > maxW) { out.push(line); line = word; } else line = t;
    }
    out.push(line);
  }
  return out;
}

/** Espaces insécables de la typographie française avant : ? ! ; et à l'intérieur des guillemets. */
const nbsp = (s) => String(s).replace(/ ([:?!;»])/g, '\u00a0$1').replace(/« /g, '«\u00a0');

function textBlock(x, y, s, { size, weight = 400, fill = B.ink, anchor = 'start', maxW, lh = 1.25 }) {
  const rows = wrap(nbsp(s), maxW, size, weight >= 600);
  const step = Math.round(size * lh);
  const svg = rows.map((r, i) => `<text x="${x}" y="${y + i * step}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(r)}</text>`).join('');
  return { svg, bottom: y + (rows.length - 1) * step + Math.round(size * 0.3), rows: rows.length };
}

function wordmark(x, y, size, dark) {
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="700"><tspan fill="${dark ? B.white : B.navy}">Auto</tspan><tspan fill="${B.orange}">Mecanik</tspan></text>`;
}

/* ---------- Schémas de principe (repère 960 × 640) ---------- */

/** Filtre vissé vu de côté, plaque de base en haut. */
function canister(cx, top, w, h, body = C.metalDark) {
  const x = cx - w / 2;
  let ridges = '';
  for (let i = 1; i < 8; i++) ridges += `<line x1="${x + (i * w) / 8}" y1="${top + h - 46}" x2="${x + (i * w) / 8}" y2="${top + h - 8}" stroke="${C.muted}" stroke-width="3"/>`;
  return `<rect x="${x + 10}" y="${top}" width="${w - 20}" height="18" rx="6" fill="${C.rubber}"/>`
    + `<path d="M${x},${top + 18} L${x + w},${top + 18} L${x + w},${top + h - 24} Q${x + w},${top + h} ${x + w - 24},${top + h} L${x + 24},${top + h} Q${x},${top + h} ${x},${top + h - 24} Z" fill="${body}" stroke="${C.muted}" stroke-width="4"/>`
    + `<rect x="${x + 16}" y="${top + 60}" width="${w - 32}" height="${Math.max(40, h * 0.32)}" rx="6" fill="${B.white}" opacity="0.55"/>`
    + ridges;
}

function label(x, y, s, size = 30, weight = 700, fill = B.navy, anchor = 'middle') {
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(s)}</text>`;
}

function arrowDefs() {
  return `<defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${B.orange}"/></marker></defs>`;
}

function hatch(x, y, w, h) {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${C.metalDark}"/>`;
  for (let i = x; i < x + w; i += 18) s += `<line x1="${i}" y1="${y + h}" x2="${Math.min(i + 18, x + w)}" y2="${y}" stroke="${C.muted}" stroke-width="1.5"/>`;
  return s;
}

const SCHEMAS = {
  /** Le moteur impose la forme : vissé ou cartouche. */
  vs() {
    const b = [arrowDefs()];
    b.push(`<rect x="330" y="30" width="300" height="100" rx="16" fill="${B.navy}"/>`, label(480, 94, 'Moteur', 38, 700, B.white));
    b.push(`<path d="M400,134 L265,230" stroke="${B.orange}" stroke-width="7" fill="none" marker-end="url(#ah)"/>`);
    b.push(`<path d="M560,134 L695,230" stroke="${B.orange}" stroke-width="7" fill="none" marker-end="url(#ah)"/>`);
    b.push(canister(240, 260, 180, 250));
    b.push(label(240, 580, 'Filtre vissé', 34));
    // Cartouche : boîtier fixe, couvercle, élément plissé
    const x = 640;
    b.push(`<rect x="${x - 10}" y="250" width="180" height="34" rx="8" fill="${C.metalDark}" stroke="${C.muted}" stroke-width="3"/>`);
    b.push(`<path d="M${x},284 L${x},500 L${x + 160},500 L${x + 160},284" fill="none" stroke="${C.muted}" stroke-width="8"/>`);
    b.push(`<rect x="${x + 30}" y="300" width="100" height="180" fill="${C.media}"/>`);
    let p = `M${x + 30},300`;
    for (let y = 312, l = true; y <= 480; y += 12, l = !l) p += ` L${l ? x + 130 : x + 30},${y}`;
    b.push(`<path d="${p}" fill="none" stroke="${C.mediaLine}" stroke-width="2"/>`);
    b.push(hatch(x - 30, 500, 220, 30));
    b.push(label(720, 580, 'Cartouche', 34));
    b.push(label(480, 400, 'ou', 44, 700, C.muted));
    return b.join('');
  },

  /** Recherche à partir du véhicule. */
  selecteur() {
    const b = [`<rect x="190" y="20" width="580" height="600" rx="22" fill="${B.white}" stroke="${C.metal}" stroke-width="3"/>`];
    b.push(label(480, 80, 'Votre véhicule', 34));
    const field = (y, s, hl) => `<rect x="230" y="${y}" width="500" height="66" rx="12" fill="${B.white}" stroke="${hl ? B.orange : C.light}" stroke-width="${hl ? 5 : 3}"/>`
      + label(256, y + 43, s, 28, 400, B.ink, 'start') + `<path d="M690,${y + 26} L702,${y + 40} L714,${y + 26}" fill="none" stroke="${C.muted}" stroke-width="4"/>`;
    ['Marque', 'Modèle', 'Année', 'Motorisation'].forEach((s, i) => b.push(field(110 + i * 84, s, i === 3)));
    b.push(label(480, 486, 'ou', 28, 700, C.muted));
    b.push(field(510, 'Type mine (carte grise)', false));
    return b.join('');
  },

  /** Portée du filtre sur le moteur, vue de face, filtre déposé. */
  'ancien-joint'() {
    const face = (cx, cy, stuck) => {
      let s = `<circle cx="${cx}" cy="${cy}" r="180" fill="${C.metal}" stroke="${C.muted}" stroke-width="4"/>`;
      s += `<circle cx="${cx}" cy="${cy}" r="138" fill="none" stroke="${B.white}" stroke-width="22" opacity="0.8"/>`;
      for (let a = 0; a < 6; a++) s += `<circle cx="${cx + 82 * Math.cos((a * Math.PI) / 3)}" cy="${cy + 82 * Math.sin((a * Math.PI) / 3)}" r="12" fill="${C.muted}"/>`;
      s += `<circle cx="${cx}" cy="${cy}" r="42" fill="${C.metalDark}" stroke="${C.muted}" stroke-width="4"/>`;
      for (let r = 14; r < 40; r += 9) s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.muted}" stroke-width="2"/>`;
      if (stuck) {
        s += `<circle cx="${cx}" cy="${cy}" r="138" fill="none" stroke="${C.rubber}" stroke-width="20"/>`;
        s += `<circle cx="${cx}" cy="${cy}" r="164" fill="none" stroke="${B.orange}" stroke-width="5" stroke-dasharray="16 10"/>`;
      }
      return s;
    };
    const b = [face(240, 290, true), face(720, 290, false)];
    b.push(label(240, 530, 'Ancien joint resté', 30), label(240, 568, 'sur la portée', 30));
    b.push(label(720, 530, 'Portée propre,', 30), label(720, 568, 'sans ancien joint', 30));
    b.push(`<circle cx="240" cy="66" r="34" fill="${B.orange}"/><path d="M226,52 L254,80 M254,52 L226,80" stroke="${B.white}" stroke-width="7" stroke-linecap="round"/>`);
    b.push(`<circle cx="720" cy="66" r="34" fill="${B.green}"/><path d="M704,66 L716,80 L738,54" fill="none" stroke="${B.navy}" stroke-width="7" stroke-linecap="round"/>`);
    b.push(label(480, 624, 'Schéma de principe', 22, 400, C.muted));
    return b.join('');
  },

  /** Joint neuf huilé (vissé) et joints neufs de cartouche. */
  'joint-huile'() {
    const drop = (x, y) => `<path d="M${x},${y} C${x - 26},${y + 40} ${x - 30},${y + 60} ${x},${y + 74} C${x + 30},${y + 60} ${x + 26},${y + 40} ${x},${y} Z" fill="${C.oil}" stroke="${C.oilLine}" stroke-width="4"/>`;
    const b = [arrowDefs()];
    // Filtre vissé vu de dessus
    const cx = 240, cy = 330;
    b.push(`<circle cx="${cx}" cy="${cy}" r="170" fill="${C.metalDark}" stroke="${C.muted}" stroke-width="4"/>`);
    b.push(`<circle cx="${cx}" cy="${cy}" r="140" fill="none" stroke="${C.rubber}" stroke-width="22"/>`);
    b.push(`<circle cx="${cx}" cy="${cy}" r="140" fill="none" stroke="${C.oil}" stroke-width="6" opacity="0.9"/>`);
    for (let a = 0; a < 6; a++) b.push(`<circle cx="${cx + 80 * Math.cos((a * Math.PI) / 3 + 0.5)}" cy="${cy + 80 * Math.sin((a * Math.PI) / 3 + 0.5)}" r="13" fill="${C.muted}"/>`);
    b.push(`<circle cx="${cx}" cy="${cy}" r="40" fill="${C.metal}" stroke="${C.muted}" stroke-width="4"/>`);
    b.push(drop(390, 70), `<path d="M380,156 L350,208" stroke="${B.orange}" stroke-width="6" fill="none" marker-end="url(#ah)"/>`);
    b.push(label(240, 560, 'Filtre vissé :', 30), label(240, 598, 'joint neuf huilé', 30, 400, B.ink));
    // Cartouche : élément et joints toriques neufs
    const x = 640;
    b.push(`<rect x="${x}" y="190" width="160" height="34" rx="8" fill="${C.metalDark}" stroke="${C.muted}" stroke-width="3"/>`);
    b.push(`<ellipse cx="${x + 80}" cy="238" rx="96" ry="14" fill="none" stroke="${C.rubber}" stroke-width="12"/>`);
    b.push(`<rect x="${x + 25}" y="270" width="110" height="200" fill="${C.media}" stroke="${C.mediaLine}" stroke-width="2"/>`);
    let p = `M${x + 25},270`;
    for (let y = 282, l = true; y <= 470; y += 12, l = !l) p += ` L${l ? x + 135 : x + 25},${y}`;
    b.push(`<path d="${p}" fill="none" stroke="${C.mediaLine}" stroke-width="2"/>`);
    b.push(`<ellipse cx="${x + 80}" cy="492" rx="40" ry="9" fill="none" stroke="${C.rubber}" stroke-width="10"/>`);
    b.push(drop(870, 120), `<path d="M858,206 L826,232" stroke="${B.orange}" stroke-width="6" fill="none" marker-end="url(#ah)"/>`);
    b.push(label(720, 560, 'Cartouche :', 30), label(720, 598, 'joints neufs, huilés', 30, 400, B.ink));
    return b.join('');
  },

  /** Vissage jusqu'au contact, puis serrage selon l'instruction du filtre. Aucune valeur. */
  serrage() {
    const b = [arrowDefs()];
    const step = (cx, contact) => {
      let s = hatch(cx - 170, 40, 340, 40);
      s += canister(cx, contact ? 80 : 120, 200, 260);
      if (!contact) s += `<path d="M${cx},112 L${cx},90" stroke="${B.orange}" stroke-width="6" fill="none" marker-end="url(#ah)"/>`;
      return s;
    };
    b.push(step(240, true));
    b.push(`<circle cx="240" cy="89" r="30" fill="none" stroke="${B.orange}" stroke-width="5" stroke-dasharray="10 7"/>`);
    b.push(step(720, true));
    b.push(`<path d="M590,300 C590,380 850,380 850,300" fill="none" stroke="${B.orange}" stroke-width="8" marker-end="url(#ah)"/>`);
    // Étiquette imprimée sur le filtre : lignes neutres, aucune valeur
    b.push(`<rect x="660" y="160" width="120" height="70" rx="6" fill="${B.white}" stroke="${C.muted}" stroke-width="3"/>`);
    for (let i = 0; i < 3; i++) b.push(`<line x1="676" y1="${180 + i * 16}" x2="${764 - i * 18}" y2="${180 + i * 16}" stroke="${C.muted}" stroke-width="4"/>`);
    b.push(label(240, 440, '1. Vissez jusqu’au', 30), label(240, 478, 'contact du joint', 30));
    b.push(label(720, 440, '2. Serrez selon', 30), label(720, 478, 'l’instruction du filtre', 30));
    b.push(label(480, 600, 'Schéma de principe, sans valeur de serrage', 22, 400, C.muted));
    return b.join('');
  },

  /** Deux filtres d'aspect proche, marques masquées. */
  'deux-filtres'() {
    const b = [canister(260, 90, 220, 380), canister(700, 90, 220, 380)];
    b.push(label(480, 330, '?', 150, 700, B.orange));
    b.push(label(480, 580, 'Même aspect, intérieur à vérifier', 30, 700, B.navy));
    return b.join('');
  },
};

function schemaSvg(name, w, h, bg) {
  const body = SCHEMAS[name]();
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 960 640"><rect x="-2000" y="-2000" width="5000" height="5000" fill="${bg}"/>${body}</svg>`);
}

/* ---------- Rendu des visuels ---------- */

async function assetBuffer(rel, extract) {
  const abs = path.join(ROOT, rel);
  const svg = abs.replace(/\.webp$/, '.svg');
  // SVG du dossier rendu à 2x quand il existe (net à 1080 px) ; sinon le WebP
  let img = fs.existsSync(svg) ? sharp(svg, { density: 144 }) : sharp(abs);
  if (extract) {
    const k = fs.existsSync(svg) ? 2 : 1;
    const [left, top, width, height] = extract.map((v) => v * k);
    img = sharp(await img.png().toBuffer()).extract({ left, top, width, height });
  }
  return img.png().toBuffer();
}

/** Les pictogrammes du dossier sont dessinés pour le fond #0F1E38 de `SequencesCourtes`. */
const panelFor = (v, bg) => (v.asset && /picto-/.test(v.asset) ? B.navy : bg);

async function visualBuffer(v, w, h, bg) {
  bg = panelFor(v, bg);
  if (v.schema) return sharp(schemaSvg(v.schema, w, h, bg)).png().toBuffer();
  const pad = 24;
  const inner = await sharp(await assetBuffer(v.asset, v.extract))
    .resize(w - 2 * pad, h - 2 * pad, { fit: 'contain', background: bg })
    .png().toBuffer();
  return sharp({ create: { width: w, height: h, channels: 4, background: bg } })
    .composite([{ input: inner, left: pad, top: pad }]).png().toBuffer();
}

async function rounded(buf, w, h, r) {
  const mask = Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" fill="#fff"/></svg>`);
  return sharp(buf).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

/* ---------- Diapositives 1080 × 1350 ---------- */

async function slide(car, s) {
  const W = 1080, H = 1350, M = 64, N = car.slides.length;
  const first = s.n === 1;
  const bg = first ? B.navy : B.white;
  const fg = first ? B.white : B.navy;
  const parts = [`<rect width="${W}" height="${H}" fill="${bg}"/>`];
  const comps = [];
  let y;
  if (first) {
    const photo = await sharp(PHOTO).resize(W, 800, { fit: 'cover', position: 'attention' }).png().toBuffer();
    comps.push({ input: photo, left: 0, top: 0 });
    parts.push(`<rect y="800" width="${W}" height="10" fill="${B.orange}"/>`);
    y = 905;
  } else {
    parts.push(wordmark(M, 84, 34, false), `<rect x="${M}" y="104" width="92" height="6" fill="${B.orange}"/>`);
    y = 200;
  }
  parts.push(`<text x="${W - M}" y="${first ? 870 : 84}" font-family="${FONT}" font-size="28" fill="${first ? B.white : C.muted}" text-anchor="end">${s.n}/${N}</text>`);
  const t = textBlock(M, y, s.titre, { size: first ? 70 : 60, weight: 700, fill: fg, maxW: W - 2 * M, lh: 1.12 });
  parts.push(t.svg);
  const d = textBlock(M, t.bottom + 62, s.texte, { size: 38, fill: first ? '#E2E8F0' : B.ink, maxW: W - 2 * M, lh: 1.3 });
  parts.push(d.svg);
  const footY = 1268;
  parts.push(`<rect x="${M}" y="${footY}" width="${W - 2 * M}" height="2" fill="${first ? '#334155' : C.metal}"/>`);
  parts.push(first ? wordmark(M, footY + 52, 32, true) : `<text x="${M}" y="${footY + 50}" font-family="${FONT}" font-size="28" font-weight="700" fill="${B.navy}">automecanik.com</text>`);
  parts.push(`<text x="${W - M}" y="${footY + 50}" font-family="${FONT}" font-size="24" fill="${first ? '#CBD5E1' : C.muted}" text-anchor="end">Conseil informatif</text>`);
  if (!first) {
    const top = d.bottom + 44;
    const bottom = s.pied ? 1150 : 1228;
    const vh = bottom - top, vw = W - 2 * M;
    if (vh < 300) throw new Error(`${car.id} ${s.n} : zone visuelle trop basse (${vh} px)`);
    const vis = await rounded(await visualBuffer(s.visuel, vw, vh, C.panel), vw, vh, 22);
    comps.push({ input: vis, left: M, top });
    if (s.pied) parts.push(`<text x="${W / 2}" y="1214" font-family="${FONT}" font-size="36" font-weight="700" fill="${B.orange}" text-anchor="middle">${esc(s.pied)}</text>`);
  } else if (d.bottom > footY - 20) {
    throw new Error(`${car.id} 1 : texte trop long`);
  }
  const base = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`);
  // Fond, puis visuels, puis textes au-dessus de la photo
  const textLayer = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.slice(1).join('')}</svg>`);
  const out = path.join(OUT, `${car.id.toLowerCase()}-${s.n}.webp`);
  await sharp(base).composite([...comps, { input: textLayer, left: 0, top: 0 }]).webp({ quality: 88 }).toFile(out);
  return out;
}

/* ---------- Couvertures 1080 × 1920 ---------- */

async function cover(c) {
  const W = 1080, H = 1920, M = 80;
  const parts = [`<rect width="${W}" height="${H}" fill="${B.navy}"/>`, wordmark(M, 170, 46, true), `<rect x="${M}" y="196" width="120" height="7" fill="${B.orange}"/>`];
  const t = textBlock(W / 2, 360, c.texte, { size: 104, weight: 700, fill: B.white, anchor: 'middle', maxW: W - 2 * M, lh: 1.08 });
  parts.push(t.svg);
  const top = t.bottom + 70, vw = W - 2 * M, vh = Math.min(900, 1480 - top);
  const vis = await rounded(await visualBuffer(c.visuel, vw, vh, B.white), vw, vh, 28);
  const badgeY = top + vh + 60;
  parts.push(`<rect x="${W / 2 - 230}" y="${badgeY}" width="460" height="84" rx="42" fill="${B.orange}"/>`);
  parts.push(`<text x="${W / 2}" y="${badgeY + 56}" font-family="${FONT}" font-size="40" font-weight="700" fill="${B.navy}" text-anchor="middle">Fafa · mécano IA</text>`);
  const base = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`);
  const out = path.join(OUT, `cover-${c.video.toLowerCase()}.webp`);
  await sharp(base).composite([{ input: vis, left: M, top }]).webp({ quality: 88 }).toFile(out);
  return out;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const done = [];
  for (const car of SOCIAL.carrousels) for (const s of car.slides) done.push(await slide(car, s));
  for (const c of SOCIAL.couvertures) done.push(await cover(c));
  for (const f of done) {
    const m = await sharp(f).metadata();
    console.log(`${path.relative(ROOT, f).replace(/\\/g, '/')} ${m.width}x${m.height} ${fs.statSync(f).size} o`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
