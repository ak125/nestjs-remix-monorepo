#!/usr/bin/env node
/**
 * Contrôle du texte public du lot filtre à huile (révision 3, 30/10/2026) : integration/r1.json, r3.json, assets.json.
 *
 * Gardes du dépôt exécutées telles quelles (esbuild) :
 *   - SeoFieldGate.hasForbidden et R1_FORBIDDEN_TERMS (backend/src/modules/seo/utils/seo-field-gate.ts) ;
 *   - isR3R5Content (frontend/app/utils/r1-copy-gate.ts) ;
 *   - R1_ROUTER_CONTRACT, bornes R1_S4_MICRO_SEO (packages/seo-role-contracts/src/contracts/r1.ts) ;
 *   - parseFAQFromS8 (frontend/app/components/blog/conseil/section-config.tsx) : JSON-LD FAQPage produit ou non.
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
export { parseFAQFromS8 } from "${p('frontend/app/components/blog/conseil/section-config.tsx')}";`,
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
const add = (page, champ, text) => units.push({ page, champ, text: plain(text) });
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
})();

const repo = loadRepo();
const hits = (re, t) => [...t.matchAll(new RegExp(re.source, re.flags))].map((m) => m[0]);
const findings = [];
for (const u of units) {
  for (const re of ANTI_SOURCE) hits(re, u.text).forEach((h) => findings.push({ ...u, regle: 'anti_source (code)', extrait: h }));
  hits(SOURCE_NAMES, u.text).forEach((h) => findings.push({ ...u, regle: 'nom de source', extrait: h }));
  hits(PROMISES, u.text).forEach((h) => findings.push({ ...u, regle: 'promesse commerciale', extrait: h }));
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

const ok = findings.length === 0 && micro.ok && faqPairs >= 3;
console.log(JSON.stringify({ unites_controlees: units.length, constats: findings, r1_micro_seo: micro, r3_faqpage_paires: faqPairs, verdict: ok ? 'PASS' : 'FAIL' }, null, 1));
process.exit(ok ? 0 : 1);
