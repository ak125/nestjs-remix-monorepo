#!/usr/bin/env node
/**
 * Sous-titres SRT des courts C1 à C4, lus dans les tableaux de ../MEDIA.md § 7 (colonne Voix, plages « a-b s »).
 * Règle de MEDIA.md : mêmes segments que la voix, 42 caractères par ligne au plus, deux lignes par sous-titre.
 * Durée d'un sous-titre : part de la plage proportionnelle à son nombre de caractères. Calage à refaire sur la voix
 * enregistrée. Sortie : ../subtitles/c<n>.srt. Aucune dépendance.
 *
 * Usage : node tools/build-srt.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MEDIA = fs.readFileSync(path.join(ROOT, 'MEDIA.md'), 'utf8');
const OUT = path.join(ROOT, 'subtitles');
const MAX = 42;

function rowsOf(n) {
  const start = MEDIA.indexOf(`### 7.${n} C${n}`);
  if (start < 0) throw new Error(`C${n} introuvable dans MEDIA.md`);
  const end = MEDIA.indexOf('\n#', start + 5);
  const rows = [];
  for (const line of MEDIA.slice(start, end < 0 ? undefined : end).split('\n')) {
    const m = line.match(/^\| (\d+)-(\d+) s \| « (.+?) » \|/);
    if (m) rows.push({ a: Number(m[1]), b: Number(m[2]), voix: m[3] });
  }
  if (!rows.length) throw new Error(`C${n} : aucune ligne de voix`);
  return rows;
}

/** Lignes de 42 caractères au plus, groupées par deux. */
function cues(text) {
  const lines = [];
  let cur = '';
  for (const w of text.split(' ')) {
    const t = cur ? `${cur} ${w}` : w;
    if (cur && t.length > MAX) { lines.push(cur); cur = w; } else cur = t;
  }
  lines.push(cur);
  const out = [];
  for (let i = 0; i < lines.length; i += 2) out.push(lines.slice(i, i + 2));
  return out;
}

const ts = (s) => {
  const ms = Math.round(s * 1000);
  const p = (v, l = 2) => String(v).padStart(l, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};

fs.mkdirSync(OUT, { recursive: true });
for (const n of [1, 2, 3, 4]) {
  const blocks = [];
  for (const r of rowsOf(n)) {
    const cs = cues(r.voix);
    const total = cs.reduce((k, c) => k + c.join(' ').length, 0);
    let t = r.a;
    for (const c of cs) {
      const d = ((r.b - r.a) * c.join(' ').length) / total;
      blocks.push({ a: t, b: t + d, lines: c });
      t += d;
    }
  }
  const srt = blocks.map((b, i) => `${i + 1}\n${ts(b.a)} --> ${ts(b.b)}\n${b.lines.join('\n')}\n`).join('\n');
  fs.writeFileSync(path.join(OUT, `c${n}.srt`), srt);
  const longest = Math.max(...blocks.flatMap((b) => b.lines.map((l) => l.length)));
  console.log(`subtitles/c${n}.srt : ${blocks.length} sous-titres, ligne la plus longue ${longest} car., fin ${ts(blocks.at(-1).b)}`);
}
