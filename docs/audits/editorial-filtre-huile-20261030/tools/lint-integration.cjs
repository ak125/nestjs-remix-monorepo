#!/usr/bin/env node
/**
 * Contrôle du texte public du lot filtre à huile (révision 5, 31/10/2026) : integration/r1.json, r3.json, assets.json,
 * blocs de candidats.json, déclinaisons sociales (social.json) et voix et écrans des courts (MEDIA.md § 7).
 *
 * Gardes du dépôt exécutées telles quelles (esbuild) :
 *   - SeoFieldGate.hasForbidden et R1_FORBIDDEN_TERMS (backend/src/modules/seo/utils/seo-field-gate.ts) ;
 *   - isR3R5Content (frontend/app/utils/r1-copy-gate.ts) ;
 *   - R1_ROUTER_CONTRACT, bornes R1_S4_MICRO_SEO (packages/seo-role-contracts/src/contracts/r1.ts) ;
 *   - parseFAQFromS8 (frontend/app/components/blog/conseil/section-config.tsx) : JSON-LD FAQPage produit ou non ;
 *   - FORBIDDEN_PATTERNS_SOCLE et _SHORT (backend/src/config/video-quality.constants.ts) : motifs de la gate G3,
 *     SHORT sur les courts, SOCLE sur les autres textes sociaux (contrôle de marque, hors gate).
 * Règles de canal recopiées de backend/src/modules/marketing/templates/brand-rules-seed.ts (seed de données, sans
 * fonction de contrôle exportée) : longueurs, hashtags, #automecanik, appel à l'action, mention de marque, UTM, tags.
 * Motifs anti_source recopiés de HardGatesService.checkAntiSource (backend/src/modules/admin/services/hard-gates.service.ts,
 * l. 877-883) : le service dépend de Nest et de Supabase et ne se charge pas hors application.
 * Ajouts du dossier : noms de sources, promesses commerciales, statut candidat servi.
 *
 * Usage : NODE_PATH=<node_modules avec esbuild, isomorphic-dompurify, lucide-react> node tools/lint-integration.cjs
 * Sortie 0 si tout passe, 1 sinon.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const DOSSIER = path.join(__dirname, '..');
const REPO = path.resolve(DOSSIER, '../../..');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(DOSSIER, rel), 'utf8'));
const plain = (html) => String(html).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

function loadRepo() {
  const esbuild = require('esbuild');
  const outfile = path.join(os.tmpdir(), `fh-lint-${process.pid}.cjs`);
  const p = (rel) => path.join(REPO, rel).replace(/\\/g, '/');
  esbuild.buildSync({
    stdin: {
      contents: `export { SeoFieldGate, R1_FORBIDDEN_TERMS } from "${p('backend/src/modules/seo/utils/seo-field-gate.ts')}";
export { isR3R5Content } from "${p('frontend/app/utils/r1-copy-gate.ts')}";
export { R1_ROUTER_CONTRACT } from "${p('packages/seo-role-contracts/src/contracts/r1.ts')}";
export { parseFAQFromS8 } from "${p('frontend/app/components/blog/conseil/section-config.tsx')}";
export { FORBIDDEN_PATTERNS_SOCLE, FORBIDDEN_PATTERNS_SHORT } from "${p('backend/src/config/video-quality.constants.ts')}";`,
      resolveDir: path.join(REPO, 'frontend'),
      loader: 'ts',
    },
    bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', outfile, logLevel: 'error',
    nodePaths: (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean),
    alias: { '@repo/seo-roles': p('packages/seo-roles/src/index.ts') },
    external: ['isomorphic-dompurify', 'dompurify', 'jsdom', 'lucide-react', 'react', 'react/jsx-runtime'],
  });
  const m = require(outfile);
  fs.unlinkSync(outfile);
  return m;
}

const ANTI_SOURCE = [/\(Source\s*:\s*[^)]+\)/gi, /\(BT-\d+[^)]*\)/gi, /\(SR\d+[^)]*\)/gi, /\bBT-\d+\b/gi, /\bSR\d{4,}\b/gi];
const SOURCE_NAMES = /\b(MAHLE|Filtron|WIX|MANN(?:[- ]FILTER)?|Bosch|Purflux|Hengst|Knecht|ADEME|minist[eè]re|éco-organisme|wiki|RAG|selon (?:le même|ce) fabricant)\b/gi;
const PROMISES = /(meilleur prix|garanti|livraison|en stock|dès \d|\d\s*€|homologation|plus de \d+ marques|n°\s?1|leader)/gi;

const units = [];
const add = (page, champ, text, mode) => units.push({ page, champ, text: plain(text), mode });
const values = (t) => (Array.isArray(t) ? t.flatMap((x) => (typeof x === 'object' ? Object.values(x) : [x])) : [t]);

(function collect() {
  const r1 = readJson('integration/r1.json');
  for (const [key, f] of Object.entries(r1.r1s)) {
    values(f.texte).forEach((t) => add('R1', key, t));
  }
  add('R1', 'sg_content', r1.sg_content.html);
  const r3 = readJson('integration/r3.json');
  for (const s of r3.sections.filter((x) => x.html)) {
    add('R3', `${s.sgc_section_type} titre`, s.titre_propose);
    add('R3', s.sgc_section_type, s.html);
  }
  for (const v of readJson('integration/assets.json').visuels) {
    ['alt', 'caption', 'texte_image'].filter((k) => v[k]).forEach((k) => add(v.page, `${v.slot}.${k}`, v[k]));
  }
  // Blocs candidats : non servis, contrôlés pour pouvoir l'être tels quels après admission
  for (const b of readJson('integration/candidats.json').blocs) add('R3 candidat', b.section, b.html || b.ajout_html);
  const so = readJson('integration/social.json');
  for (const c of so.carrousels) {
    c.slides.forEach((sl) => ['titre', 'texte', 'pied'].filter((k) => sl[k]).forEach((k) => add('SOCIAL', `${c.id} ${sl.n}.${k}`, sl[k], 'socle')));
    add('SOCIAL', `${c.id} légende`, c.legende, 'socle');
  }
  so.facebook.forEach((f) => add('SOCIAL', `${f.id} texte`, f.texte, 'socle'));
  so.courts_legendes.forEach((l) => add('SOCIAL', `${l.video} légende`, l.texte, 'short'));
  so.youtube.forEach((y) => add('SOCIAL', `${y.video} titre YouTube`, y.titre, 'short'));
  so.couvertures.forEach((c) => add('SOCIAL', `${c.video} couverture`, c.texte, 'short'));
  // Courts : colonnes Voix et À l'écran des tableaux de MEDIA.md § 7
  const media = fs.readFileSync(path.join(DOSSIER, 'MEDIA.md'), 'utf8');
  for (const n of [1, 2, 3, 4]) {
    const from = media.indexOf(`### 7.${n} C${n}`);
    const part = media.slice(from, media.indexOf('\n#', from + 5));
    for (const m of part.matchAll(/^\| (\d+-\d+ s) \| (.+?) \| (.+?) \|/gm)) {
      add('COURT', `C${n} ${m[1]} voix`, m[2].replace(/[«»]/g, ''), 'short');
      if (m[3] !== '—') add('COURT', `C${n} ${m[1]} écran`, m[3].replace(/[«»]/g, ''), 'short');
    }
  }
})();

const repo = loadRepo();
const hits = (re, t) => [...t.matchAll(new RegExp(re.source, re.flags))].map((m) => m[0]);
const findings = [];
for (const u of units) {
  for (const re of ANTI_SOURCE) hits(re, u.text).forEach((h) => findings.push({ ...u, regle: 'anti_source (code)', extrait: h }));
  hits(SOURCE_NAMES, u.text).forEach((h) => findings.push({ ...u, regle: 'nom de source', extrait: h }));
  hits(PROMISES, u.text).forEach((h) => findings.push({ ...u, regle: 'promesse commerciale', extrait: h }));
  if (u.mode) {
    const pats = u.mode === 'short' ? repo.FORBIDDEN_PATTERNS_SHORT : repo.FORBIDDEN_PATTERNS_SOCLE;
    pats.filter((re) => re.test(u.text)).forEach((re) => findings.push({ ...u, regle: `FORBIDDEN_PATTERNS_${u.mode.toUpperCase()} (code)`, extrait: String(re) }));
    if (/\b(cliquez|inscrivez|abonnez|téléchargez)\b/i.test(u.text)) findings.push({ ...u, regle: 'appel à l’action G3 (code)', extrait: u.text.slice(0, 60) });
  }
  if (u.page === 'R1') {
    if (repo.SeoFieldGate.hasForbidden(u.text)) {
      const lower = u.text.toLowerCase();
      repo.R1_FORBIDDEN_TERMS.filter((t) => lower.includes(t)).forEach((t) => findings.push({ ...u, regle: 'R1_FORBIDDEN_TERMS (code)', extrait: t }));
    }
    if (repo.isR3R5Content(u.text)) findings.push({ ...u, regle: 'isR3R5Content (code)', extrait: u.text.slice(0, 90) });
  }
}

const r1 = readJson('integration/r1.json');
const r3 = readJson('integration/r3.json');
const candidats = [
  ...Object.entries(r1.r1s).filter(([, f]) => /candidat/i.test(f.statut || '')).map(([k]) => `R1 ${k}`),
  ...r3.sections.filter((s) => s.html && /candidat/i.test(s.statut || '')).map((s) => `R3 ${s.sgc_section_type}`),
];
candidats.forEach((c) => findings.push({ page: c.slice(0, 2), champ: c, regle: 'statut candidat servi', extrait: '' }));

const bounds = repo.R1_ROUTER_CONTRACT.allowed_sections.find((s) => s.id === 'R1_S4_MICRO_SEO');
const microHtml = r1.r1s.r1s_micro_seo_block.texte;
const micro = { caracteres: plain(microHtml).length, bornes: [bounds.min_chars, bounds.max_chars] };
micro.ok = micro.caracteres >= bounds.min_chars && micro.caracteres <= bounds.max_chars;

const faq = repo.parseFAQFromS8(r3.sections.filter((s) => s.sgc_section_type === 'S8').map((s) => ({ sectionType: 'S8', content: s.html })));
const faqPairs = faq && Array.isArray(faq.mainEntity) ? faq.mainEntity.length : 0;

// Règles de canal (brand-rules-seed.ts). Appels à l'action : liste du seed, impératifs au vouvoiement du canon.
const CTAS = /(lien en bio|sauvegardez ce post|partagez avec un ami|dites-nous en commentaire|retrouvez-nous sur automecanik\.com)/i;
const so = readJson('integration/social.json');
const lien = (dest, src, camp) => so.liens[dest].replace('{plateforme}', src).replace('{campagne}', camp);
const canal = [];
const check = (id, regle, mesure, ok) => canal.push({ id, regle, mesure, ok });
for (const c of so.carrousels) {
  const tags = c.hashtags_commentaire;
  const url = lien(c.destination, 'instagram', c.campagne);
  check(c.id, 'légende Instagram ≤ 2 200 car.', c.legende.length, c.legende.length <= 2200);
  check(c.id, 'hashtags Instagram 20 à 25, en commentaire séparé', tags.length, tags.length >= 20 && tags.length <= 25 && !/#/.test(c.legende));
  check(c.id, '#automecanik en premier', tags[0], tags[0] === '#automecanik');
  check(c.id, 'hashtags sans doublon', new Set(tags).size, new Set(tags).size === tags.length);
  check(c.id, 'appel à l’action', (c.legende.match(CTAS) || [''])[0], CTAS.test(c.legende));
  check(c.id, 'mention AutoMecanik', /automecanik/i.test(c.legende), /automecanik/i.test(c.legende));
  check(c.id, 'UTM source, medium, campagne', url, /utm_source=instagram&utm_medium=social&utm_campaign=[a-z0-9-]+$/.test(url));
}
for (const f of so.facebook) {
  const t = f.texte.replace('{lien}', lien(f.destination, 'facebook', f.campagne));
  const tags = t.match(/#[\p{L}\d_]+/gu) || [];
  check(f.id, 'texte Facebook ≤ 500 car., lien compris', t.length, t.length <= 500);
  check(f.id, 'hashtags Facebook 3 à 5, #automecanik inclus', tags.length, tags.length >= 3 && tags.length <= 5 && tags.includes('#automecanik'));
  check(f.id, 'appel à l’action', (t.match(CTAS) || [''])[0], CTAS.test(t));
  check(f.id, 'UTM source, medium, campagne', f.campagne, /utm_source=facebook&utm_medium=social&utm_campaign=[a-z0-9-]+ /.test(t));
}
for (const l of so.courts_legendes) {
  const ia = /automecanik/i.test(l.texte) && /mécano IA/.test(l.texte);
  check(l.video, 'appel à l’action', (l.texte.match(CTAS) || [''])[0], CTAS.test(l.texte));
  check(l.video, 'mention AutoMecanik et IA assumée', ia, ia);
}
for (const y of so.youtube) {
  check(y.video, 'titre YouTube ≤ 100 car.', y.titre.length, y.titre.length <= 100);
  check(y.video, 'tags YouTube 5 à 15, « automecanik » et « pieces auto » inclus', y.tags.length, y.tags.length >= 5 && y.tags.length <= 15 && y.tags.includes('automecanik') && y.tags.includes('pieces auto'));
}
const canalKo = canal.filter((c) => !c.ok);

const ok = findings.length === 0 && micro.ok && faqPairs >= 3 && canalKo.length === 0;
const parPage = units.reduce((m, u) => ({ ...m, [u.page]: (m[u.page] || 0) + 1 }), {});
console.log(JSON.stringify({ unites_controlees: units.length, par_page: parPage, constats: findings, r1_micro_seo: micro, r3_faqpage_paires: faqPairs, regles_de_canal: { controles: canal.length, echecs: canalKo }, verdict: ok ? 'PASS' : 'FAIL' }, null, 1));
process.exit(ok ? 0 : 1);
