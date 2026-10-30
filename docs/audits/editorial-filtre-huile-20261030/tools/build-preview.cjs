#!/usr/bin/env node
/**
 * Aperçu du lot filtre à huile (révision 3, 30/10/2026) : SIMULATION NON INTÉGRÉE.
 *
 * Construit preview/apercu-r1.html et preview/apercu-r3.html à partir de integration/*.json et assets/, dans l'ordre
 * des sections des routes pieces.$slug.tsx et blog-pieces-auto.conseils.$pg_alias.tsx. Les fonctions de découpage du
 * dépôt sont exécutées telles quelles (esbuild) : extractEditorialBlocks (R1, sanitisation comprise),
 * extractSummaryPoints, normalizeStepHtml (R3) et deriveDifficulty (backend, métadonnées des badges R3, présentées comme
 * buildHeroBadges de la route conseils). Composants, styles, catalogue et base ne le sont pas : ce n'est pas le rendu DEV.
 *
 * Usage : NODE_PATH=<node_modules avec esbuild, isomorphic-dompurify, lucide-react[, playwright, sharp]>
 *         [FH_REPO=<checkout du dépôt>] node tools/build-preview.cjs [--shots]
 *   FH_REPO : fonctions lues dans un autre checkout (par défaut celui du dossier), p. ex. la branche de correction.
 *   --shots : captures pleine page en 375 et 1280 px (playwright, chromium) ; --channel=chrome pour le Chrome installé.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const DOSSIER = path.join(__dirname, '..');
const REPO = path.resolve(process.env.FH_REPO || path.join(DOSSIER, '../../..'));
const OUT = path.join(DOSSIER, 'preview');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(DOSSIER, rel), 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// --- Fonctions du dépôt -------------------------------------------------------------------------------------------
function loadRepoFunctions() {
  const nodePaths = (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean);
  const esbuild = require('esbuild');
  const outfile = path.join(os.tmpdir(), `fh-preview-${process.pid}.cjs`);
  const parser = path.join(REPO, 'frontend/app/utils/editorial-parser.ts').replace(/\\/g, '/');
  const config = path.join(REPO, 'frontend/app/components/blog/conseil/section-config.tsx').replace(/\\/g, '/');
  const normalize = path.join(REPO, 'backend/src/modules/blog/utils/html-normalize.utils.ts').replace(/\\/g, '/');
  esbuild.buildSync({
    stdin: {
      contents: `export { extractEditorialBlocks } from "${parser}";
export { extractSummaryPoints, normalizeStepHtml, SECTION_STYLES } from "${config}";
export { deriveDifficulty } from "${normalize}";`,
      resolveDir: path.join(REPO, 'frontend'),
      loader: 'ts',
    },
    bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', outfile, nodePaths, logLevel: 'error',
    // jsdom lit ses fichiers à l'exécution : les paquets restent chargés depuis NODE_PATH.
    external: ['isomorphic-dompurify', 'dompurify', 'jsdom', 'lucide-react', 'react', 'react/jsx-runtime'],
  });
  const fns = require(outfile);
  fs.unlinkSync(outfile);
  return fns;
}

// --- Gabarit commun -----------------------------------------------------------------------------------------------
const CSS = `
:root{--ink:#0f172a;--muted:#475569;--line:#e2e8f0;--soft:#f8fafc;--blue:#2563eb;--amber:#b45309;--green:#047857;--red:#b91c1c}
*{box-sizing:border-box}body{margin:0;background:#fff;color:var(--ink);font:15px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.sim{position:sticky;top:0;z-index:9;background:#7c2d12;color:#fff;padding:8px 16px;font-size:13px}
.sim b{font-weight:700}
main{max-width:1280px;margin:0 auto;padding:0 16px 48px}
section{padding:28px 0;border-bottom:1px solid var(--line)}
h1{font-size:28px;line-height:1.25;margin:8px 0}h2{font-size:22px;margin:0 0 14px}h3{font-size:17px;margin:16px 0 8px}
p{margin:0 0 10px}ul,ol{padding-left:22px;margin:0 0 10px}a{color:var(--blue)}
img{max-width:100%;height:auto;display:block;border-radius:14px;border:1px solid var(--line)}
figure{margin:0}figcaption{font-size:13px;color:var(--muted);margin-top:6px}
.grid{display:grid;gap:28px}@media(min-width:1024px){.grid.two{grid-template-columns:1fr 1fr}.hero{grid-template-columns:1.2fr 360px}}
.map{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 8px;font:12px/1.4 ui-monospace,Consolas,monospace;color:var(--muted)}
.tag{display:inline-block;padding:1px 7px;border-radius:999px;font:600 11px/1.6 system-ui,sans-serif;border:1px solid}
.t-conserve{color:#334155;border-color:#94a3b8;background:#f1f5f9}.t-ameliore{color:#1d4ed8;border-color:#93c5fd;background:#eff6ff}
.t-ajoute{color:var(--green);border-color:#6ee7b7;background:#ecfdf5}.t-code{color:var(--amber);border-color:#fcd34d;background:#fffbeb}
.t-manque{color:var(--red);border-color:#fca5a5;background:#fef2f2}
.block{border-left:3px solid var(--line);padding-left:12px;margin:0 0 16px}
.badges{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));margin:14px 0}
.badge{border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:var(--soft)}.badge b{display:block}
table{border-collapse:collapse;width:100%;font-size:14px;margin:0 0 10px}th,td{border:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}th{background:var(--soft)}
details{border:1px solid var(--line);border-radius:10px;padding:8px 12px;margin:0 0 8px}summary{cursor:pointer;font-weight:600}
.card{border:1px solid var(--line);border-radius:14px;padding:16px;background:var(--soft);margin:0 0 16px}
.hole{border:2px dashed #fca5a5;border-radius:14px;padding:14px;color:var(--red);font-size:14px;background:#fff7f7}
.note{font-size:13px;color:var(--muted)}.small{font-size:13px}
`;
const ACTION = { 'conservé': 't-conserve', 'amélioré': 't-ameliore', 'ajouté': 't-ajoute' };
const tag = (label, cls) => `<span class="tag ${cls}">${esc(label)}</span>`;
const mapLine = (champ, action, statut, extra = '') =>
  `<div class="map"><code>${esc(champ)}</code>${action ? tag(action, ACTION[action] || 't-conserve') : ''}${statut ? `<span>${esc(statut)}</span>` : ''}${extra}</div>`;
const codeTag = (why) => tag(`codé${why ? ' · ' + why : ''}`, 't-code');
const figure = (v, rel) => `<figure>${mapLine(`${v.page} ${v.slot} · rip ${v.rip_id}`, null, v.action)}<img src="${rel}${esc(v.fichier)}" alt="${esc(v.alt)}">${v.caption ? `<figcaption>${esc(v.caption)}</figcaption>` : ''}</figure>`;
const page = (title, role, body) => `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><style>${CSS}</style></head><body>
<div class="sim"><b>Simulation non intégrée</b> · ${esc(role)} · textes <code>integration/</code>, images <code>assets/</code> ·
ce n'est pas le rendu DEV · chaque bloc porte son champ, son action et son statut</div>
<main>${body}</main></body></html>`;

// --- R1 ------------------------------------------------------------------------------------------------------------
function buildR1(fns, assets) {
  const r1 = readJson('integration/r1.json');
  const s = r1.r1s;
  const V = (slot) => assets.visuels.find((v) => v.page === 'R1' && v.slot === slot);
  const blocks = fns.extractEditorialBlocks(r1.sg_content.html);
  const routed = Object.fromEntries(Object.entries(blocks).map(([k, v]) => [k, v.length]));
  const sg = (list, section) => list.map((html) => `<div class="block">${mapLine(`sg_content → ${section}`, r1.sg_content.action, null)}${html}</div>`).join('');
  const field = (key, inner) => `<div class="block">${mapLine(key, s[key].action, s[key].statut)}${inner}</div>`;
  const n = 'filtre à huile';

  const badges = [1, 2, 3, 4].map((i) => `<div class="badge">${mapLine(`r1s_arg${i}_title / _content`, s[`r1s_arg${i}_title`].action, s[`r1s_arg${i}_title`].statut)}<b>${esc(s[`r1s_arg${i}_title`].texte)}</b>${esc(s[`r1s_arg${i}_content`].texte)}</div>`).join('');
  const table = `<table><thead><tr><th>Élément</th><th>Comment vérifier</th></tr></thead><tbody>${s.r1s_safe_table_rows.texte.map((r) => `<tr><td>${esc(r.element)}</td><td>${esc(r.howToCheck)}</td></tr>`).join('')}</tbody></table>`;
  const faq = s.r1s_faq.texte.map((f) => `<details open><summary>${esc(f.question)}</summary><p>${esc(f.answer)}</p></details>`).join('');
  const micro = s.r1s_micro_seo_block;
  const microLen = micro.texte.replace(/<[^>]+>/g, '').length;

  const body = `
<section class="grid hero">
  <div>
    ${mapLine('H1 (champ protégé)', 'conservé', 'non modifié')}
    <h1>Filtre à huile compatible avec votre véhicule</h1>
    ${field('r1s_hero_subtitle', `<p>${esc(s.r1s_hero_subtitle.texte)}</p>`)}
    ${field('r1s_selector_microcopy', `<div class="card"><b>${esc(s.r1s_selector_microcopy.texte[0])}</b><p class="small">${esc(s.r1s_selector_microcopy.texte[1])}</p><p class="note">Sélecteur de véhicule (composant, non simulé)</p></div>`)}
    <div class="badges">${badges}</div>
  </div>
  ${figure(V('HERO'), '../')}
</section>
<section><p class="note">${codeTag('non modifié')} Navigation rapide et encart diagnostic (composants ; compteur servi en FH-5).</p></section>
<section id="bien-choisir">
  ${mapLine('H2', null, null, codeTag())}<h2>Bien choisir votre ${n}</h2>
  <div class="grid two">
    <div>${mapLine('h3', null, null, codeTag())}<h3>Types de ${n}</h3>${figure(V('TYPES'), '../')}</div>
    <div>${sg(blocks.chooseSection, 'chooseSection')}</div>
  </div>
  <p class="note">Liste de contrôle et erreurs fréquentes du composant : non simulées.</p>
</section>
<section id="qualite-prix" style="background:var(--soft)">
  ${mapLine('H2', null, null, codeTag('FH-15'))}<h2>Qualité, prix et marques</h2>
  <div class="grid two">
    <div>${mapLine('h3', null, null, codeTag('FH-15 : la page n\'a pas de niveaux de prix'))}<h3>Niveaux de qualité</h3>${figure(V('PRICE'), '../')}</div>
    <div>${sg(blocks.priceSection, 'priceSection')}</div>
  </div>
  ${field('r1s_equipementiers_line', `<p>${esc(s.r1s_equipementiers_line.texte)}</p><p class="note">Logos et fiches équipementiers : composant et catalogue, non simulés.</p>`)}
</section>
<section id="emplacement">
  ${mapLine('H2', null, null, codeTag())}<h2>Où se trouve le ${n} et quand le remplacer</h2>
  <div class="grid two">
    <div>${mapLine('R1 LOCATION · rip 34', null, 'désélectionnée')}<div class="hole">Image d'emplacement retirée : l'emplacement dépend du moteur. Une photo par motorisation seulement (PROMPTS.md, P-06).</div></div>
    <div>${sg(blocks.locationSection, 'locationSection')}${sg(blocks.unmatched, 'unmatched')}</div>
  </div>
</section>
<section id="reference" style="background:var(--soft)">
  ${mapLine('H2', null, null, codeTag())}<h2>Trouver la bonne référence pour votre véhicule</h2>
  ${sg(blocks.referenceSection, 'referenceSection')}
  ${field('r1s_compatibilities_intro', `<p>${esc(s.r1s_compatibilities_intro.texte)}</p><p class="note">Liste des motorisations : catalogue, non simulée.</p>`)}
  ${field('r1s_safe_table_rows', table)}
</section>
<section id="faq">
  <h2>Questions fréquentes</h2>
  ${field('r1s_faq', faq)}
</section>
<section id="aller-plus-loin" style="background:var(--soft)">
  ${mapLine('H2', null, null, codeTag())}<h2>Aller plus loin</h2>
  ${field('r1s_family_cross_sell_intro', `<p>${esc(s.r1s_family_cross_sell_intro.texte)}</p><p class="note">Vignettes de la famille : catalogue ; deux vignettes servies en 400 (FH-14).</p>`)}
</section>
<section>
  ${mapLine('r1s_micro_seo_block', micro.action, `${micro.statut} · ${microLen} caractères de texte`)}
  <p class="note">${esc(micro.affichage)}.</p>
  <div class="card">${micro.texte}</div>
</section>`;
  return { html: page('Aperçu R1 filtre à huile', 'R1 /pieces/filtre-a-huile-7.html', body), routed };
}

// --- R3 ------------------------------------------------------------------------------------------------------------
// Libellés de buildHeroBadges (route blog-pieces-auto.conseils.$pg_alias.tsx, non exportée) appliqués aux métadonnées
// que le backend calcule (R3GuideService → deriveDifficulty).
function heroBadges({ difficulty, durationMin, safetyLevel }) {
  const badges = [];
  const d = { facile: 'Facile', moyen: 'Intermédiaire', difficile: 'Avancé' }[difficulty];
  if (d) badges.push({ label: 'Difficulté', value: d });
  if (durationMin) badges.push({ label: 'Temps estimé', value: durationMin < 60 ? `~${durationMin} min` : `~${Math.round(durationMin / 60)}h` });
  const sec = { faible: 'Standard', moyen: 'Précautions requises', élevé: 'Précautions requises' }[safetyLevel];
  if (sec) badges.push({ label: 'Sécurité', value: sec });
  return badges;
}

function buildR3(fns, assets) {
  const r3 = readJson('integration/r3.json');
  const V = (slot) => assets.visuels.find((v) => v.page === 'R3' && v.slot === slot);
  const secs = r3.sections.filter((x) => x.html);
  const conseil = secs.map((x) => ({ sectionType: x.sgc_section_type, content: x.html, title: x.titre_propose }));
  const points = fns.extractSummaryPoints(conseil);
  const badges = heroBadges(fns.deriveDifficulty(conseil.map((c) => ({ sectionType: c.sectionType, html: c.content }))));
  const calcules = badges.some((b) => b.label !== 'Sécurité');
  const provenance = 'Base de connaissances AutoMecanik';
  const IMG = { S2: V('S2'), S3: V('S3') };
  const card = (x) => {
    const content = x.sgc_section_type.startsWith('S4') ? fns.normalizeStepHtml(x.html) : x.html;
    const img = IMG[x.sgc_section_type] ? figure(IMG[x.sgc_section_type], '../') : '';
    return `<section>${mapLine(`__seo_gamme_conseil ${x.sgc_id} · ${x.sgc_section_type}`, x.action, x.statut)}
<h2>${esc(x.titre_propose)}</h2>${img}<div style="margin-top:12px">${content}</div>
<p class="note">Sources : ${provenance} (provenance proposée, type wiki)</p></section>`;
  };
  const s1 = secs.find((x) => x.sgc_section_type === 'S1');
  const body = `
<section class="grid hero">
  <div>
    ${mapLine('H1 (champ protégé)', 'conservé', 'non modifié')}
    <h1>Comment changer un filtre à huile</h1>
    ${mapLine('badges', null, null, codeTag(calcules ? 'FH-16 : calculés, non sourcés' : 'FH-16 : sécurité seule, déduite des sections présentes'))}
    <div class="badges">${badges.map((b) => `<div class="badge"><b>${esc(b.label)}</b>${esc(b.value)}</div>`).join('')}</div>
  </div>
  ${figure(V('HERO'), '../')}
</section>
<section>
  ${mapLine(`__seo_gamme_conseil ${s1.sgc_id} · S1 (carte « avant »)`, s1.action, s1.statut)}
  <div class="card"><h2>${esc(s1.titre_propose)}</h2>${s1.html}<p class="note">Sources : ${provenance}</p></div>
</section>
<section>
  ${mapLine('L\'essentiel (extractSummaryPoints)', null, `${points.length} points, calculés par le code à partir des sections`, codeTag('libellés FH-16'))}
  <div class="card"><h2>L'essentiel en ${points.length} points</h2><ol>${points.map((p) => `<li><b>${esc(p.label)}</b> : ${esc(p.text)}</li>`).join('')}</ol></div>
</section>
<section>
  ${mapLine('encart', null, null, codeTag('FH-16'))}
  <div class="card"><b>Besoin de cette piece ?</b><p class="small">Comparez les prix et trouvez la piece compatible avec votre vehicule.</p></div>
</section>
${secs.filter((x) => x.sgc_section_type !== 'S1').map(card).join('\n')}
<section>
  ${mapLine('encart bas de page', null, null, codeTag('FH-16'))}
  <div class="card small">Trouvez votre filtre à huile au meilleur prix parmi nos fournisseurs.</div>
</section>`;
  return { html: page('Aperçu R3 filtre à huile', 'R3 /blog-pieces-auto/conseils/filtre-a-huile', body), points, badges };
}

// --- Captures ------------------------------------------------------------------------------------------------------
async function shots(files) {
  const { chromium } = require('playwright');
  const sharp = require('sharp');
  // --channel=chrome utilise le Chrome installé quand les navigateurs de playwright ne sont pas à sa version.
  const channel = (process.argv.find((a) => a.startsWith('--channel=')) || '').split('=')[1];
  const browser = await chromium.launch(channel ? { channel } : {});
  const out = [];
  for (const f of files) {
    for (const width of [375, 1280]) {
      const p = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      p.on('pageerror', (e) => errors.push(String(e)));
      p.on('requestfailed', (r) => errors.push(`échec ${r.url()}`));
      await p.goto('file:///' + path.join(OUT, f).replace(/\\/g, '/'), { waitUntil: 'load' });
      const broken = await p.$$eval('img', (imgs) => imgs.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.getAttribute('src')));
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const file = f.replace('.html', `-${width}.webp`);
      await sharp(await p.screenshot({ fullPage: true })).webp({ quality: 70 }).toFile(path.join(OUT, file));
      out.push({ capture: file, images_cassees: broken, erreurs: errors, debordement_horizontal_px: overflow });
      await p.close();
    }
  }
  await browser.close();
  return out;
}

(async () => {
  const fns = loadRepoFunctions();
  const assets = readJson('integration/assets.json');
  fs.mkdirSync(OUT, { recursive: true });
  const r1 = buildR1(fns, assets);
  const r3 = buildR3(fns, assets);
  fs.writeFileSync(path.join(OUT, 'apercu-r1.html'), r1.html);
  fs.writeFileSync(path.join(OUT, 'apercu-r3.html'), r3.html);
  const report = {
    nature: 'simulation non intégrée',
    r1_routage_sg_content: r1.routed,
    r3_essentiel: r3.points.map((p) => p.label),
    r3_badges: r3.badges.map((b) => `${b.label} : ${b.value}`),
  };
  if (process.argv.includes('--shots')) report.captures = await shots(['apercu-r1.html', 'apercu-r3.html']);
  console.log(JSON.stringify(report, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
