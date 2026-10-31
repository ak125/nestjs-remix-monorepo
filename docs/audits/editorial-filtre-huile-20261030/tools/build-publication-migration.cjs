#!/usr/bin/env node
/**
 * Migrations du lot de publication filtre à huile (pg_id 7), générées depuis le dossier.
 *
 *   A    20261031_editorial_filtre_huile_pg7_textes  : 50 cellules texte (r1.json, r3.json)
 *   C    20261031_editorial_filtre_huile_pg7_images  : images R1 TYPES, PRICE, HERO, LOCATION et R3 S2, S3
 *   C-og 20261031_editorial_filtre_huile_pg7_og      : image R1 OG et image R3 HERO (og:image R3),
 *        sur accord distinct : jamais écrite dans le dépôt par ce script
 *
 * Chaque valeur « avant » vient de integration/avant-textes.json (relevé en lecture seule du 31/10),
 * chaque valeur « après » du pointeur de integration/publication-batch.json. Longueur et sha256 des
 * deux côtés sont recalculés ici et doivent égaler ceux du lot, sinon le script s'arrête.
 *
 * Usage :
 *   node tools/build-publication-migration.cjs                       écrit A et C, up et down
 *   node tools/build-publication-migration.cjs --check               sort 1 si un fichier écrit diffère
 *   node tools/build-publication-migration.cjs --og --out-dir <dir>  écrit C-og (up et down) dans <dir>
 *   node tools/build-publication-migration.cjs --precheck <fichier>  contrôle préalable, SELECT seuls
 *   node tools/build-publication-migration.cjs --fixture-data <dir>  données du banc (scripts/db)
 *
 * Aucun hôte, aucune clé ni aucun identifiant d'agent n'est écrit : l'agent est retrouvé par son nom
 * (SEO-Content), le préfixe des URL d'image par la ligne R1 HERO (rip_id 31).
 */
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DOSSIER = path.join(__dirname, '..');
const ROOT = path.join(__dirname, '..', '..', '..', '..');
const MIG_DIR = path.join(ROOT, 'backend', 'supabase', 'migrations');
const GENERATOR = path.relative(ROOT, __filename);
const VERSION = 'v20261031';
const PG_ID = 7;
const ALIAS = 'filtre-a-huile';
const ALPHA_ID = '20261031_accents_protected_segments';
const ID = {
  textes: '20261031_editorial_filtre_huile_pg7_textes',
  images: '20261031_editorial_filtre_huile_pg7_images',
  og: '20261031_editorial_filtre_huile_pg7_og',
};
// Balises de citation dollar. squawk ferme une balise dès qu'il lit son nom suivi de « $ », même à
// l'intérieur d'une autre balise (« $fhlot$ » fermait « $lot$ ») : aucun nom n'en termine un autre.
const TAGS = ['$fhlot$', '$precheck$', '$ecriture$', '$trg$'];
const OG_SLOTS = { r1: ['OG'], r3: ['HERO'] }; // slot R1, section R3

const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(DOSSIER, rel), 'utf8'));
const avant = readJson('integration/avant-textes.json');
const batch = readJson('integration/publication-batch.json');
const docs = { 'r1.json': readJson('integration/r1.json'), 'r3.json': readJson('integration/r3.json') };
const assets = readJson('integration/assets.json');

const fail = (msg) => {
  throw new Error(msg);
};

// ---------------------------------------------------------------------------
// Représentation texte PostgreSQL (valeur::text), sur laquelle porte le sha256 du lot
// ---------------------------------------------------------------------------

/** array_out : guillemets si vide, NULL, accolade, virgule, guillemet, antislash ou blanc. */
function pgTextArray(arr) {
  if (!Array.isArray(arr)) fail('text[] attendu');
  return `{${arr
    .map((s) => {
      if (typeof s !== 'string') fail('élément text[] non textuel');
      const quote = s === '' || /^null$/i.test(s) || /[{},"\\ \t\n\r\v\f]/.test(s);
      return quote ? `"${s.replace(/["\\]/g, '\\$&')}"` : s;
    })
    .join(',')}}`;
}

const JSON_ESC = { '"': '\\"', '\\': '\\\\', '\b': '\\b', '\f': '\\f', '\n': '\\n', '\r': '\\r', '\t': '\\t' };
const jsonStr = (s) =>
  `"${s.replace(/["\\\u0000-\u001f]/g, (c) => JSON_ESC[c] || `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)}"`;

/** jsonb_out : clés triées par longueur en octets puis par octets, séparateurs « , » et « : ». */
function pgJsonb(v) {
  if (v === null || typeof v === 'boolean') return String(v);
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : fail('nombre non entier dans un jsonb');
  if (typeof v === 'string') return jsonStr(v);
  if (Array.isArray(v)) return `[${v.map(pgJsonb).join(', ')}]`;
  const keys = Object.keys(v).sort(
    (a, b) => Buffer.byteLength(a) - Buffer.byteLength(b) || Buffer.compare(Buffer.from(a), Buffer.from(b)),
  );
  return `{${keys.map((k) => `${jsonStr(k)}: ${pgJsonb(v[k])}`).join(', ')}}`;
}

const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
const md5File = (f) => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');
const len = (s) => [...s].length;

function asText(type, v) {
  if (type === 'text[]') return pgTextArray(v);
  if (type === 'jsonb') return pgJsonb(v);
  if (type === 'text' || type === 'varchar') return typeof v === 'string' ? v : fail(`${type} non textuel`);
  return fail(`type inconnu ${type}`);
}

const lit = (s) => (s === null || s === undefined ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const dollar = (s) => {
  for (const t of TAGS) if (s.includes(t.slice(1))) fail(`valeur contenant ${t}`);
  return `$fhlot$${s}$fhlot$`;
};

// ---------------------------------------------------------------------------
// Cellules texte
// ---------------------------------------------------------------------------

// Colonnes réécrites par les triggers d'accents (fn_auto_restore_accents_r1_slots, _r1_meta, _r3).
const TRIG_COLS = {
  __seo_r1_gamme_slots: [
    'r1s_micro_seo_block',
    'r1s_hero_subtitle',
    'r1s_h1_override',
    'r1s_compatibilities_intro',
    'r1s_equipementiers_line',
    'r1s_family_cross_sell_intro',
    'r1s_arg1_content',
    'r1s_arg2_content',
    'r1s_arg3_content',
    'r1s_arg4_content',
  ],
  __seo_gamme: ['sg_content', 'sg_title', 'sg_descrip'],
  __seo_gamme_conseil: ['sgc_content', 'sgc_title'],
};

function resolvePointer(ref) {
  const [file, ptr] = ref.replace(/\s*\(.*\)$/, '').split('#');
  let node = docs[file] || fail(`fichier de pointeur inconnu ${ref}`);
  for (const seg of ptr.split('/').slice(1)) {
    const key = seg.replace(/~1/g, '/').replace(/~0/g, '~');
    if (node === null || typeof node !== 'object' || !(key in node)) fail(`pointeur non résolu ${ref}`);
    node = node[key];
  }
  return node;
}

const sgcAvant = new Map(avant.sgc.map((r) => [r.sgc_id, r]));
const SGC_IDS = avant.sgc.filter((r) => r.sgc_section_type !== 'META').map((r) => r.sgc_id);
const SGC_ALL = avant.sgc.map((r) => `${r.sgc_id}:${r.sgc_section_type}`).sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));

function buildCells() {
  const cells = batch.cibles_texte.map((c) => {
    let key;
    let rawAvant;
    let rawApres = resolvePointer(c.apres.source);
    if (c.table === '__seo_r1_gamme_slots') {
      if (c.cle.r1s_pg_id !== String(PG_ID)) fail('clé r1s inattendue');
      key = `r1s/${c.colonne}`;
      rawAvant = avant.r1s[c.colonne];
    } else if (c.table === '__seo_gamme') {
      if (c.cle.sg_pg_id !== String(PG_ID) || c.colonne !== 'sg_content') fail('cible sg inattendue');
      key = 'sg/sg_content';
      rawAvant = avant.sg.sg_content;
    } else if (c.table === '__seo_gamme_conseil') {
      const row = sgcAvant.get(c.cle.sgc_id) || fail(`sgc_id inconnu ${c.cle.sgc_id}`);
      if (row.sgc_section_type === 'META') fail('la ligne META est hors lot');
      key = `sgc/${row.sgc_id}/${c.colonne}`;
      rawAvant = row[c.colonne];
      const m = c.apres.source.match(/^r3\.json#\/sections\/(\d+)\//);
      if (m && docs['r3.json'].sections[Number(m[1])].sgc_id !== row.sgc_id) fail(`section r3 désalignée ${key}`);
      if (c.colonne === 'sgc_sources') {
        if (!c.apres.source.endsWith('(<section> = sgc_section_type)')) fail(`pointeur sgc_sources sans substitution ${key}`);
        rawApres = rawApres.split('<section>').join(row.sgc_section_type);
      }
    } else {
      fail(`table inattendue ${c.table}`);
    }
    if (rawAvant === undefined) fail(`valeur avant absente ${key}`);
    const av = asText(c.type, rawAvant);
    const ap = asText(c.type, rawApres);
    for (const [side, s, rec] of [['avant', av, c.avant], ['après', ap, c.apres]]) {
      if (len(s) !== rec.longueur || sha256(s) !== rec.sha256) {
        fail(`${key} : ${side} ${len(s)}/${sha256(s).slice(0, 12)} ≠ lot ${rec.longueur}/${rec.sha256.slice(0, 12)}`);
      }
    }
    const trig = (TRIG_COLS[c.table] || []).includes(c.colonne);
    const declared = c.trigger_accents.startsWith('point fixe')
      ? true
      : c.trigger_accents === 'colonne hors trigger'
        ? false
        : fail(`trigger_accents illisible ${key}`);
    if (trig !== declared) fail(`${key} : trigger d'accents ${trig} ≠ lot ${declared}`);
    if (av === ap) fail(`${key} : avant = après`);
    return { key, table: c.table, col: c.colonne, type: c.type, trig, avant: av, apres: ap, hAvant: c.avant.sha256, hApres: c.apres.sha256 };
  });
  const byKey = new Map(cells.map((c) => [c.key, c]));
  if (byKey.size !== cells.length) fail('cellule en double');
  for (let n = 1; n <= 4; n++) {
    const t = byKey.get(`r1s/r1s_arg${n}_title`);
    const ct = byKey.get(`r1s/r1s_arg${n}_content`);
    if (t && ct && t.apres === ct.apres) fail(`arg${n} : contenu = titre (chk_r1s_arg${n}_content_differs)`);
  }
  for (const id of SGC_IDS) {
    for (const col of ['sgc_title', 'sgc_content', 'sgc_sources']) byKey.get(`sgc/${id}/${col}`) || fail(`cellule absente sgc/${id}/${col}`);
  }
  return cells;
}

const CELLS = buildCells();
const R1S_CELLS = CELLS.filter((c) => c.table === '__seo_r1_gamme_slots');

// Champs protégés : identiques avant et après, et points fixes du trigger d'accents quand il les réécrit.
const cp = avant.champs_proteges;
const metaRow = avant.sgc.find((r) => r.sgc_section_type === 'META');
const PROTECTED = [
  { nom: 'r1s_h1_override', expr: `(SELECT r1s_h1_override::text FROM __seo_r1_gamme_slots WHERE r1s_pg_id = '${PG_ID}')`, valeur: cp.r1s_h1_override.valeur, sha: cp.r1s_h1_override.sha256, fixe: true },
  { nom: 'sg_title', expr: `(SELECT sg_title FROM __seo_gamme WHERE sg_pg_id = '${PG_ID}' AND sg_id = '${avant.sg.sg_id}')`, valeur: cp.sg_title.valeur, sha: cp.sg_title.sha256, fixe: true },
  { nom: 'sg_descrip', expr: `(SELECT sg_descrip FROM __seo_gamme WHERE sg_pg_id = '${PG_ID}' AND sg_id = '${avant.sg.sg_id}')`, valeur: cp.sg_descrip.valeur, sha: cp.sg_descrip.sha256, fixe: true },
  { nom: 'sgc_content:META', expr: `(SELECT sgc_content FROM __seo_gamme_conseil WHERE sgc_pg_id = '${PG_ID}' AND sgc_id = '${metaRow.sgc_id}')`, valeur: metaRow.sgc_content, sha: cp[`sgc_content:${metaRow.sgc_id}`].sha256, fixe: false },
  { nom: 'sgc_title:META', expr: `(SELECT sgc_title FROM __seo_gamme_conseil WHERE sgc_pg_id = '${PG_ID}' AND sgc_id = '${metaRow.sgc_id}')`, valeur: metaRow.sgc_title, sha: sha256(metaRow.sgc_title), fixe: false },
];
for (const p of PROTECTED) {
  if (sha256(p.valeur) !== p.sha) fail(`champ protégé ${p.nom} : sha256 relevé incohérent`);
}

// ---------------------------------------------------------------------------
// Fonctions et triggers relevés le 2026-10-31 (md5 du corps|SECURITY DEFINER|volatilité|config)
// ---------------------------------------------------------------------------

const RFA_ALPHA = '300d4e4c2f502c0eb9e52b92fde60769|f|i|{search_path=public}';
const RFA_OLD_MD5 = '25eac4c38827cce38b9b4e2d6362fad0';
const PINS = {
  resolve: ['public.resolve_agent_write_scope()', '8d54b4884ba9d79d13ceb6e3efcf32ee|t|s|{search_path=public}'],
  check: ['public.check_agent_write_allowed(text,text)', '142e397a9c484acf71f7a165128f65b5|t|v|{search_path=public}'],
  enforce: ['public.enforce_agent_write_scope()', '89e28826419409a2bc47f63201946fa6|t|v|{search_path=public}'],
  r1Meta: ['public.fn_auto_restore_accents_r1_meta()', '915d378f1e261bb82cfa21aef6a9e7b6|f|v|{search_path=public}'],
  r1Slots: ['public.fn_auto_restore_accents_r1_slots()', 'cd5d47fef335dfa46477c2d71a415b48|f|v|{search_path=public}'],
  r3: ['public.fn_auto_restore_accents_r3()', 'b0e3095435d02d2c3c2cc409a9e14f8a|f|v|{search_path=public}'],
  invalidate: ['public.invalidate_r1_caches(integer,text,text)', '057683db298396024bcccbe8054627d3|t|v|{search_path=public}'],
  trgSeoGamme: ['public.trg_invalidate_r1_from_seo_gamme()', 'efaea1eeaa1c4a3a069a89f3a546c8b2|t|v|{search_path=public}'],
  trgImages: ['public.trg_invalidate_r1_from_image_prompts()', '26d4f7c0fb578db5fc376196c0d069dd|t|v|{search_path=public}'],
  updatedAt: ['public.trg_r1_gamme_slots_updated_at()', '62b1882b8f6a782028d50a26efa3b702|f|v|{search_path=public}'],
};
// fn_warn_orphan_pg_id (BEFORE INSERT, WARNING seul) ne s'exécute pas sur un UPDATE ; check_breakglass
// ne s'exécute qu'avec un en-tête x-breakglass-token, que ce lot ne pose jamais : ni l'une ni l'autre
// n'est épinglée.
const TRIGGERS = [
  'CREATE TRIGGER trg_auto_restore_accents_r1_meta BEFORE INSERT OR UPDATE ON public.__seo_gamme FOR EACH ROW EXECUTE FUNCTION fn_auto_restore_accents_r1_meta()',
  'CREATE TRIGGER trg_gpc_invalidate_seo_gamme AFTER INSERT OR DELETE OR UPDATE ON public.__seo_gamme FOR EACH ROW EXECUTE FUNCTION trg_invalidate_r1_from_seo_gamme()',
  'CREATE TRIGGER trg_warn_orphan_r1_meta BEFORE INSERT ON public.__seo_gamme FOR EACH ROW EXECUTE FUNCTION fn_warn_orphan_pg_id()',
  'CREATE TRIGGER trg_write_scope___seo_gamme BEFORE INSERT OR UPDATE ON public.__seo_gamme FOR EACH ROW EXECUTE FUNCTION enforce_agent_write_scope()',
  'CREATE TRIGGER trg_auto_restore_accents_r3 BEFORE INSERT OR UPDATE ON public.__seo_gamme_conseil FOR EACH ROW EXECUTE FUNCTION fn_auto_restore_accents_r3()',
  'CREATE TRIGGER trg_warn_orphan_r3_conseils BEFORE INSERT ON public.__seo_gamme_conseil FOR EACH ROW EXECUTE FUNCTION fn_warn_orphan_pg_id()',
  'CREATE TRIGGER trg_write_scope___seo_gamme_conseil BEFORE INSERT OR UPDATE ON public.__seo_gamme_conseil FOR EACH ROW EXECUTE FUNCTION enforce_agent_write_scope()',
  'CREATE TRIGGER trg_auto_restore_accents_r1_slots BEFORE INSERT OR UPDATE ON public.__seo_r1_gamme_slots FOR EACH ROW EXECUTE FUNCTION fn_auto_restore_accents_r1_slots()',
  'CREATE TRIGGER trg_r1_slots_updated BEFORE UPDATE ON public.__seo_r1_gamme_slots FOR EACH ROW EXECUTE FUNCTION trg_r1_gamme_slots_updated_at()',
  'CREATE TRIGGER trg_warn_orphan_r1_slots BEFORE INSERT ON public.__seo_r1_gamme_slots FOR EACH ROW EXECUTE FUNCTION fn_warn_orphan_pg_id()',
  'CREATE TRIGGER trg_write_scope___seo_r1_gamme_slots BEFORE INSERT OR UPDATE ON public.__seo_r1_gamme_slots FOR EACH ROW EXECUTE FUNCTION enforce_agent_write_scope()',
  'CREATE TRIGGER trg_gpc_invalidate_image_prompts AFTER INSERT OR DELETE OR UPDATE ON public.__seo_r1_image_prompts FOR EACH ROW EXECUTE FUNCTION trg_invalidate_r1_from_image_prompts()',
  'CREATE TRIGGER trg_write_scope___seo_r1_image_prompts BEFORE INSERT OR UPDATE ON public.__seo_r1_image_prompts FOR EACH ROW EXECUTE FUNCTION enforce_agent_write_scope()',
  'CREATE TRIGGER trg_write_scope___seo_r3_image_prompts BEFORE INSERT OR UPDATE ON public.__seo_r3_image_prompts FOR EACH ROW EXECUTE FUNCTION enforce_agent_write_scope()',
];
const byteSort = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b));

const SCOPES = {
  textes: {
    tables: ['__seo_gamme', '__seo_gamme_conseil', '__seo_r1_gamme_slots'],
    caches: ['__gamme_page_cache', '__seo_r1_related_blocks_cache'],
    pins: ['resolve', 'check', 'enforce', 'r1Meta', 'r1Slots', 'r3', 'invalidate', 'trgSeoGamme', 'updatedAt'],
    rfa: true,
  },
  images: {
    tables: ['__seo_r1_image_prompts', '__seo_r3_image_prompts'],
    caches: ['__gamme_page_cache'],
    pins: ['resolve', 'check', 'enforce', 'trgImages', 'invalidate'],
    rfa: false,
  },
};
SCOPES.og = SCOPES.images;

function expectedTriggers(scope) {
  const rels = [...scope.tables, ...scope.caches];
  return TRIGGERS.filter((t) => rels.some((r) => t.includes(` ON public.${r} `)))
    .map((t) => `O ${t}`)
    .sort(byteSort);
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

function buildImages() {
  const rows = { r1: new Map(avant.images.r1.map((r) => [r.rip_id, r])), r3: new Map(avant.images.r3.map((r) => [r.rip_id, r])) };
  return assets.visuels.map((v) => {
    const tbl = v.page === 'R1' ? 'r1' : v.page === 'R3' ? 'r3' : fail(`page inconnue ${v.page}`);
    const row = rows[tbl].get(v.rip_id) || fail(`rip_id ${v.rip_id} absent du relevé`);
    // assets.json nomme le slot R1 et la section R3 (le slot R3 en base est HERO_IMAGE, S2_SYMPTOM_IMAGE…).
    const named = tbl === 'r1' ? row.rip_slot_id : row.rip_section_id;
    if (named !== v.slot) fail(`rip_id ${v.rip_id} : ${named} ≠ ${v.slot}`);
    const before = { path: row.chemin, alt: row.rip_alt_text, caption: row.rip_caption, status: row.rip_status, selected: row.rip_selected };
    const deselect = v.fichier === null;
    let objet = null;
    let newPath = before.path;
    if (!deselect) {
      newPath =
        tbl === 'r1'
          ? (before.path || fail(`R1 ${v.rip_id} sans chemin`)).replace(/\.webp$/, `-${VERSION}.webp`)
          : `articles/gammes-produits/r3/${ALIAS}-${v.slot.toLowerCase()}-${VERSION}.webp`;
      if (newPath === before.path) fail(`rip_id ${v.rip_id} : chemin inchangé`);
      const file = path.join(DOSSIER, v.fichier);
      objet = { path: newPath, size: fs.statSync(file).size, md5: md5File(file) };
    }
    const after = deselect
      ? { ...before, status: 'pending', selected: false }
      : {
          path: newPath,
          alt: v.alt || fail(`rip_id ${v.rip_id} sans alt`),
          caption: 'caption' in v ? v.caption : before.caption,
          status: 'approved',
          selected: true,
        };
    const o = row.objet_avant;
    return {
      tbl,
      rip_id: v.rip_id,
      slot: row.rip_slot_id,
      section: tbl === 'r3' ? row.rip_section_id : null,
      og: OG_SLOTS[tbl].includes(v.slot),
      avant: before,
      apres: after,
      objet,
      objet_avant: o ? { path: before.path, size: o.taille, md5: o.etag, mimetype: o.mimetype, cache_control: o.cache_control } : null,
      maj_avant: tbl === 'r1' ? row.rip_updated_at : null,
    };
  });
}

const IMAGES = buildImages();
const PREFIX_ROW = 31; // R1 HERO : seule source du préfixe d'URL (hôte jamais écrit dans le dépôt)
if (!IMAGES.some((i) => i.tbl === 'r1' && i.rip_id === PREFIX_ROW)) fail('ligne de préfixe absente');

// ---------------------------------------------------------------------------
// Fragments SQL partagés (migrations, contrôle préalable)
// ---------------------------------------------------------------------------

const cellsValues = () =>
  CELLS.map((c) => `      (${lit(c.key)}, ${c.trig}, ${dollar(c.avant)},\n       ${dollar(c.apres)},\n       '${c.hAvant}', '${c.hApres}')`).join(',\n');

/** Cellules : jsonb clé → {trig, avant, apres, h_avant, h_apres}. */
const cellsJsonb = () => `(SELECT jsonb_object_agg(v.k, jsonb_build_object('trig', v.trig, 'avant', v.avant, 'apres', v.apres, 'h_avant', v.h_avant, 'h_apres', v.h_apres))
    FROM (VALUES
${cellsValues()}
    ) v(k, trig, avant, apres, h_avant, h_apres))`;

const cellsFrom = (j) =>
  `(SELECT e.key AS k, (e.value->>'trig')::boolean AS trig, e.value->>'avant' AS avant, e.value->>'apres' AS apres FROM jsonb_each(${j}) e)`;

const sgcIdList = () => SGC_IDS.map(lit).join(', ');

/** Valeur courante (::text) de chaque cellule. */
const curCells = () => `(SELECT 'r1s/' || x.col AS k, x.val AS v
       FROM __seo_r1_gamme_slots s
      CROSS JOIN LATERAL (VALUES
${R1S_CELLS.map((c) => `        (${lit(c.col)}, s.${c.col}::text)`).join(',\n')}
      ) x(col, val)
      WHERE s.r1s_pg_id = '${PG_ID}'
     UNION ALL
     SELECT 'sg/sg_content', g.sg_content
       FROM __seo_gamme g
      WHERE g.sg_pg_id = '${PG_ID}' AND g.sg_id = '${avant.sg.sg_id}'
     UNION ALL
     SELECT 'sgc/' || c.sgc_id || '/' || x.col, x.val
       FROM __seo_gamme_conseil c
      CROSS JOIN LATERAL (VALUES ('sgc_title', c.sgc_title), ('sgc_content', c.sgc_content), ('sgc_sources', c.sgc_sources)) x(col, val)
      WHERE c.sgc_pg_id = '${PG_ID}' AND c.sgc_id IN (${sgcIdList()}))`;

const classCells = (j) => `SELECT v.k,
           CASE WHEN cur.k IS NULL THEN 'DERIVE'
                WHEN cur.v IS NOT DISTINCT FROM v.apres THEN 'APRES'
                WHEN cur.v IS NOT DISTINCT FROM v.avant THEN 'AVANT'
                WHEN v.trig AND cur.v IS NOT DISTINCT FROM restore_french_accents(v.avant) THEN 'RETOUR'
                ELSE 'DERIVE' END AS classe
      FROM ${cellsFrom(j)} v
      LEFT JOIN ${curCells()} cur ON cur.k = v.k`;

const protectedValues = () =>
  PROTECTED.map((p) => `      (${lit(p.nom)}, ${p.expr},\n       '${p.sha}', ${p.fixe})`).join(',\n');

const protectedBad = () => `SELECT x.nom
      FROM (VALUES
${protectedValues()}
      ) x(nom, val, sha, fixe)
     WHERE x.val IS NULL
        OR encode(sha256(convert_to(x.val, 'UTF8')), 'hex') <> x.sha
        OR (x.fixe AND restore_french_accents(x.val) IS DISTINCT FROM x.val)`;

const ruleMatch = (t) => `EXISTS (SELECT 1 FROM agent_scope_table_rules r
                        WHERE r.scope = 'seo_content_tables'
                          AND 'update' = ANY (r.allowed_operations)
                          AND (${t} = r.table_pattern
                               OR (position('*' in r.table_pattern) > 0 AND ${t} LIKE replace(r.table_pattern, '*', '%'))))`;

const pinValues = (scope) => scope.pins.map((p) => `      (${lit(PINS[p][0])}, ${lit(PINS[p][1])})`).join(',\n');
const sig = (alias) => `format('%s|%s|%s|%s', md5(${alias}.prosrc), ${alias}.prosecdef, ${alias}.provolatile, ${alias}.proconfig)`;
const relList = (scope) => [...scope.tables, ...scope.caches].map((r) => `'public.${r}'::regclass`).join(', ');
const liveTriggers = (scope) => `SELECT t.tgenabled::text || ' ' || pg_get_triggerdef(t.oid) AS d
              FROM pg_trigger t
             WHERE NOT t.tgisinternal
               AND t.tgrelid IN (${relList(scope)})`;

function precheckBlock(scope, label) {
  const rfa = scope.rfa
    ? `  SELECT ${sig('p')} INTO v_txt
    FROM pg_proc p WHERE p.oid = to_regprocedure('public.restore_french_accents(text)');
  IF v_txt IS DISTINCT FROM ${lit(RFA_ALPHA)} THEN
    RAISE EXCEPTION 'ABORT: restore_french_accents n''est pas la version de ${ALPHA_ID} : appliquer d''abord ${ALPHA_ID}';
  END IF;

`
    : '';
  const trgs = expectedTriggers(scope);
  return `DO $precheck$
DECLARE
  v_n   bigint;
  v_txt text;
BEGIN
${rfa}  SELECT string_agg(p.sig, ', ' ORDER BY p.sig COLLATE "C") INTO v_txt
    FROM (VALUES
${pinValues(scope)}
    ) p(sig, attendu)
    LEFT JOIN pg_proc f ON f.oid = to_regprocedure(p.sig)
   WHERE ${sig('f')} IS DISTINCT FROM p.attendu;
  IF v_txt IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT: fonction(s) absente(s) ou différente(s) du relevé du 2026-10-31 : %', v_txt;
  END IF;

  SELECT string_agg(x.d, E'\\n' ORDER BY x.d COLLATE "C") INTO v_txt
    FROM (${liveTriggers(scope)}) x;
  IF v_txt IS DISTINCT FROM $trg$${trgs.join('\n')}$trg$ THEN
    RAISE EXCEPTION 'ABORT: triggers de ${label} différents du relevé :%', E'\\n' || coalesce(v_txt, '(aucun)');
  END IF;

  -- debut-controle-regles
  SELECT count(*), min(write_scope) INTO v_n, v_txt FROM agent_write_scopes WHERE agent_name = 'SEO-Content';
  IF v_n <> 1 OR v_txt IS DISTINCT FROM 'seo_content_tables' THEN
    RAISE EXCEPTION 'ABORT: agent SEO-Content : % ligne(s), scope %, attendu 1 ligne seo_content_tables', v_n, coalesce(v_txt, '-');
  END IF;
  SELECT string_agg(t, ', ' ORDER BY t COLLATE "C") INTO v_txt
    FROM unnest(ARRAY[${scope.tables.map(lit).join(', ')}]) t
   WHERE NOT ${ruleMatch('t')};
  IF v_txt IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT: le scope seo_content_tables n''autorise pas UPDATE sur %', v_txt;
  END IF;
  -- fin-controle-regles
${scope.rfa ? `
  SELECT string_agg(nom, ', ' ORDER BY nom COLLATE "C") INTO v_txt FROM (
    ${protectedBad()}
  ) b;
  IF v_txt IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT: champ(s) protégé(s) différent(s) du relevé ou réécrit(s) par le trigger d''accents : %', v_txt;
  END IF;
` : ''}END
$precheck$;`;
}

const SET_LOCALS = `SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_temp;`;

const NO_TX = `-- Pas de BEGIN/COMMIT explicite : le moteur applique ce fichier dans une
-- transaction (.squawk.toml \`assume_in_transaction = true\`).`;

const generated = (id) => `-- FICHIER GÉNÉRÉ par ${GENERATOR}
-- depuis le dossier (integration/avant-textes.json, publication-batch.json,
-- r1.json, r3.json, assets.json). Ne pas l'éditer à la main : \`--check\`
-- échoue sur tout écart. Identifiant : ${id}.`;

const application = (id) => `-- APPLICATION : par le moteur du dépôt uniquement (Actions → « 🗄️ Apply Supabase
-- migrations (manual) », dry_run puis confirm = APPLY, only_ids = ${id}),
-- après fusion sur main et après ${ALPHA_ID}.
-- Le contrôle préalable se joue seul en lecture seule avant la fusion
-- (\`--precheck\` du générateur).`;

const identity = `  v_prev := current_setting('request.headers', true);
  SELECT agent_id INTO STRICT v_agent FROM agent_write_scopes WHERE agent_name = 'SEO-Content';
  PERFORM set_config('request.headers', json_build_object('x-agent-id', v_agent)::text, true); -- identité-agent
  IF resolve_agent_write_scope() IS DISTINCT FROM 'seo_content_tables' THEN
    RAISE EXCEPTION 'ABORT: identité SEO-Content non résolue par resolve_agent_write_scope (scope %)', coalesce(resolve_agent_write_scope(), 'NULL');
  END IF;`;
const identityEnd = `  PERFORM set_config('request.headers', coalesce(v_prev, ''), true);`;

const lockTexts = () => `  PERFORM 1 FROM __seo_r1_gamme_slots WHERE r1s_pg_id = '${PG_ID}' FOR UPDATE;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'ABORT: % ligne(s) __seo_r1_gamme_slots pg ${PG_ID}, 1 attendue', v_n; END IF;
  PERFORM 1 FROM __seo_gamme WHERE sg_pg_id = '${PG_ID}' FOR UPDATE;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'ABORT: % ligne(s) __seo_gamme pg ${PG_ID}, 1 attendue', v_n; END IF;
  IF NOT EXISTS (SELECT 1 FROM __seo_gamme WHERE sg_pg_id = '${PG_ID}' AND sg_id = '${avant.sg.sg_id}') THEN
    RAISE EXCEPTION 'ABORT: la ligne __seo_gamme de pg ${PG_ID} n''a plus sg_id ${avant.sg.sg_id}';
  END IF;
  PERFORM 1 FROM __seo_gamme_conseil WHERE sgc_pg_id = '${PG_ID}' FOR UPDATE;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> ${avant.sgc.length} THEN RAISE EXCEPTION 'ABORT: % ligne(s) __seo_gamme_conseil pg ${PG_ID}, ${avant.sgc.length} attendues', v_n; END IF;
  SELECT string_agg(sgc_id || ':' || sgc_section_type, ',' ORDER BY sgc_id || ':' || sgc_section_type COLLATE "C") INTO v_txt
    FROM __seo_gamme_conseil WHERE sgc_pg_id = '${PG_ID}';
  IF v_txt IS DISTINCT FROM ${lit(SGC_ALL.join(','))} THEN
    RAISE EXCEPTION 'ABORT: sections __seo_gamme_conseil de pg ${PG_ID} différentes du relevé : %', v_txt;
  END IF;`;

const cellsIntegrity = `  SELECT count(*) INTO v_n FROM jsonb_each(v_cells);
  IF v_n <> ${CELLS.length} THEN RAISE EXCEPTION 'ABORT: % cellule(s), ${CELLS.length} attendues', v_n; END IF;
  SELECT string_agg(e.key, ', ' ORDER BY e.key COLLATE "C") INTO v_txt
    FROM jsonb_each(v_cells) e
   WHERE encode(sha256(convert_to(e.value->>'avant', 'UTF8')), 'hex') <> e.value->>'h_avant'
      OR encode(sha256(convert_to(e.value->>'apres', 'UTF8')), 'hex') <> e.value->>'h_apres';
  IF v_txt IS NOT NULL THEN RAISE EXCEPTION 'ABORT: cellule(s) altérée(s) dans le fichier : %', v_txt; END IF;`;

const cacheCheck = (targets, reason) => {
  const tables = targets === 'both' ? SCOPES.textes.caches : ['__gamme_page_cache'];
  return `  PERFORM invalidate_r1_caches(${PG_ID}, ${lit(reason)}, ${lit(targets)});
  IF ${tables.map((t) => `EXISTS (SELECT 1 FROM ${t} WHERE pg_id = ${PG_ID} AND NOT stale)`).join('\n     OR ')} THEN
    RAISE EXCEPTION 'ABORT: cache de pg ${PG_ID} encore frais après invalidation';
  END IF;`;
};

const castFor = (c) => (c.type === 'text[]' ? '::text[]' : c.type === 'jsonb' ? '::jsonb' : '');

// ---------------------------------------------------------------------------
// A — textes
// ---------------------------------------------------------------------------

function textesHeader(id, down) {
  return down
    ? `-- Rollback: ${ID.textes}
${generated(id)}
-- Remet la valeur relevée le 2026-10-31 dans chaque cellule encore égale à la
-- valeur écrite par ${ID.textes}.sql ; une cellule modifiée
-- depuis arrête tout (DERIVE). Mêmes pré-conditions et même identité
-- SEO-Content que l'écriture. Le trigger d'accents repasse sur les valeurs
-- remises : une valeur relevée qui n'en est pas un point fixe revient sous sa
-- forme accentuée (état RETOUR), r1s_updated_at prend la date du retour. Retour
-- à l'octet impossible sans désactiver un trigger, ce que le lot s'interdit.
-- Caches de pg ${PG_ID} invalidés dans la transaction ; caches Redis et CDN comme
-- pour l'écriture (publication-batch.json).
-- L'engine est forward-only : ce fichier se lance à la main, sur GO owner.
-- Auto-transactionnel : BEGIN / COMMIT portés par le fichier, SET LOCAL bornés à lui.`
    : `-- =============================================================================
-- Lot éditorial filtre à huile (pg_id ${PG_ID}) : textes R1 et R3
-- =============================================================================
--
${generated(id)}
--
-- OBJET : ${CELLS.length} cellules sur 13 lignes. Ligne R1 de pg ${PG_ID} : ${R1S_CELLS.length} colonnes ;
-- ligne sg_id ${avant.sg.sg_id} : sg_content ; ${SGC_IDS.length} sections R3 adressées par sgc_id :
-- sgc_title, sgc_content, sgc_sources (la section META est hors lot).
-- Valeurs avant et après portées par ce fichier, vérifiées par sha256.
--
-- §0 PRÉ-CONDITIONS, en lecture seule : restore_french_accents est la version
-- de ${ALPHA_ID} ; les fonctions des triggers, de la
-- garde d'écriture et de l'invalidation ont le corps relevé le 2026-10-31 ; les
-- triggers des trois tables et des deux caches sont exactement ceux relevés ;
-- l'agent SEO-Content existe une fois, avec le scope seo_content_tables, qui
-- autorise UPDATE sur les trois tables ; H1, title, meta description et
-- section META ont leur sha256 relevé, et le trigger d'accents ne réécrit ni
-- le H1, ni le title, ni la meta description.
--
-- §1 ÉCRITURE : verrou des 13 lignes, puis chaque cellule est classée APRES
-- (déjà écrite), AVANT (valeur relevée), RETOUR (valeur relevée passée par le
-- trigger d'accents, état laissé par le rollback) ou DERIVE. Une seule DERIVE
-- arrête tout ; toutes APRES : rejeu sans effet.
-- L'écriture se fait sous l'identité de l'agent SEO-Content (en-tête
-- x-agent-id local à la transaction) : enforce_agent_write_scope s'applique,
-- et le chemin sans en-tête, où la garde laisse tout passer, n'est pas
-- emprunté. Un scope retiré entre le contrôle et l'écriture fait échouer
-- celle-ci (42501). r1s_updated_at est avancé par son trigger ; sg_updated_at
-- n'est pas touché. Les caches __gamme_page_cache et
-- __seo_r1_related_blocks_cache de pg ${PG_ID} passent à stale (trigger de
-- __seo_gamme, puis invalidate_r1_caches), contrôlé dans la transaction, comme
-- la relecture de chaque cellule et des champs protégés.
-- Après application : caches Redis R1 et R3, HTML en CDN (publication-batch.json,
-- « invalidation »).
--
${application(id)}
--
-- ROLLBACK : ${ID.textes}.down.sql, à la main (le moteur est
-- forward-only).
-- =============================================================================

${NO_TX}`;
}

function textesUp() {
  const sets = R1S_CELLS.map((c) => `    ${c.col} = (v_cells->${lit(c.key)}->>'apres')${castFor(c)}`).join(',\n');
  return `${textesHeader(ID.textes, false)}
${SET_LOCALS}

-- §0 — PRÉ-CONDITIONS, en lecture seule.
${precheckBlock(SCOPES.textes, 'pg 7 (textes)')}

-- §1 — ÉCRITURE, RELECTURE, INVALIDATION.
DO $ecriture$
DECLARE
  v_cells jsonb;
  v_n     bigint;
  v_txt   text;
  v_prev  text;
  v_agent uuid;
BEGIN
${lockTexts()}

  v_cells := ${cellsJsonb()};
${cellsIntegrity}

  SELECT string_agg(k, ', ' ORDER BY k COLLATE "C") INTO v_txt
    FROM ${cellsFrom('v_cells')} v
   WHERE v.trig AND restore_french_accents(v.apres) IS DISTINCT FROM v.apres;
  IF v_txt IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT: valeur(s) que le trigger d''accents réécrirait : %', v_txt;
  END IF;

  SELECT string_agg(k || ' ' || classe, ', ' ORDER BY k COLLATE "C") FILTER (WHERE classe = 'DERIVE'),
         count(*) FILTER (WHERE classe = 'APRES')
    INTO v_txt, v_n
    FROM (${classCells('v_cells')}) cl;
  IF v_txt IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT: cellule(s) modifiée(s) depuis le relevé : %', v_txt;
  END IF;
  IF v_n = ${CELLS.length} THEN
    RAISE NOTICE 'lot textes pg ${PG_ID} : déjà écrit, rejeu sans effet';
    RETURN;
  END IF;

${identity}

  UPDATE __seo_r1_gamme_slots SET
${sets}
   WHERE r1s_pg_id = '${PG_ID}';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'ABORT: % ligne(s) R1 écrite(s), 1 attendue', v_n; END IF;

  UPDATE __seo_gamme SET
    sg_content = v_cells->'sg/sg_content'->>'apres'
   WHERE sg_pg_id = '${PG_ID}' AND sg_id = '${avant.sg.sg_id}';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'ABORT: % ligne(s) sg écrite(s), 1 attendue', v_n; END IF;

  UPDATE __seo_gamme_conseil AS c SET
    sgc_title = v_cells->('sgc/' || c.sgc_id || '/sgc_title')->>'apres',
    sgc_content = v_cells->('sgc/' || c.sgc_id || '/sgc_content')->>'apres',
    sgc_sources = v_cells->('sgc/' || c.sgc_id || '/sgc_sources')->>'apres'
   WHERE c.sgc_pg_id = '${PG_ID}' AND c.sgc_id IN (${sgcIdList()});
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> ${SGC_IDS.length} THEN RAISE EXCEPTION 'ABORT: % section(s) R3 écrite(s), ${SGC_IDS.length} attendues', v_n; END IF;

${identityEnd}

${cacheCheck('both', `editorial_filtre_huile_pg${PG_ID}:textes`)}

  -- Relecture : chaque cellule porte la valeur écrite, les champs protégés sont intacts.
  SELECT string_agg(k || ' ' || classe, ', ' ORDER BY k COLLATE "C") INTO v_txt
    FROM (${classCells('v_cells')}) cl
   WHERE classe <> 'APRES';
  IF v_txt IS NOT NULL THEN RAISE EXCEPTION 'ABORT: relecture : %', v_txt; END IF;
  SELECT string_agg(nom, ', ' ORDER BY nom COLLATE "C") INTO v_txt FROM (
    ${protectedBad()}
  ) b;
  IF v_txt IS NOT NULL THEN RAISE EXCEPTION 'ABORT: relecture des champs protégés : %', v_txt; END IF;
  RAISE NOTICE 'lot textes pg ${PG_ID} : ${CELLS.length} cellules écrites et relues';
END
$ecriture$;
`;
}

function textesDown() {
  const back = (c, colExpr) =>
    `CASE WHEN ${colExpr}::text IS NOT DISTINCT FROM v_cells->${c}->>'apres' THEN (v_cells->${c}->>'avant')`;
  const sets = R1S_CELLS.map((c) => `    ${c.col} = ${back(lit(c.key), c.col)}${castFor(c)} ELSE ${c.col} END`).join(',\n');
  const sgcSet = (col) => {
    const k = `('sgc/' || c.sgc_id || '/${col}')`;
    return `    ${col} = CASE WHEN c.${col} IS NOT DISTINCT FROM v_cells->${k}->>'apres' THEN v_cells->${k}->>'avant' ELSE c.${col} END`;
  };
  return `${textesHeader(ID.textes, true)}
BEGIN;
${SET_LOCALS}

${precheckBlock(SCOPES.textes, 'pg 7 (textes)')}

DO $ecriture$
DECLARE
  v_cells jsonb;
  v_n     bigint;
  v_txt   text;
  v_prev  text;
  v_agent uuid;
BEGIN
${lockTexts()}

  v_cells := ${cellsJsonb()};
${cellsIntegrity}

  SELECT string_agg(k || ' ' || classe, ', ' ORDER BY k COLLATE "C") FILTER (WHERE classe = 'DERIVE'),
         count(*) FILTER (WHERE classe = 'APRES')
    INTO v_txt, v_n
    FROM (${classCells('v_cells')}) cl;
  IF v_txt IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT: cellule(s) modifiée(s) depuis l''écriture du lot : %', v_txt;
  END IF;
  IF v_n = 0 THEN
    RAISE NOTICE 'retour textes pg ${PG_ID} : aucune cellule écrite par le lot, sans effet';
    RETURN;
  END IF;

${identity}

  UPDATE __seo_r1_gamme_slots SET
${sets}
   WHERE r1s_pg_id = '${PG_ID}';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'ABORT: % ligne(s) R1 remise(s), 1 attendue', v_n; END IF;

  UPDATE __seo_gamme SET
    sg_content = CASE WHEN sg_content IS NOT DISTINCT FROM v_cells->'sg/sg_content'->>'apres'
                      THEN v_cells->'sg/sg_content'->>'avant' ELSE sg_content END
   WHERE sg_pg_id = '${PG_ID}' AND sg_id = '${avant.sg.sg_id}';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'ABORT: % ligne(s) sg remise(s), 1 attendue', v_n; END IF;

  UPDATE __seo_gamme_conseil AS c SET
${['sgc_title', 'sgc_content', 'sgc_sources'].map(sgcSet).join(',\n')}
   WHERE c.sgc_pg_id = '${PG_ID}' AND c.sgc_id IN (${sgcIdList()});
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> ${SGC_IDS.length} THEN RAISE EXCEPTION 'ABORT: % section(s) R3 remise(s), ${SGC_IDS.length} attendues', v_n; END IF;

${identityEnd}

${cacheCheck('both', `editorial_filtre_huile_pg${PG_ID}:textes:rollback`)}

  SELECT string_agg(k || ' ' || classe, ', ' ORDER BY k COLLATE "C") INTO v_txt
    FROM (${classCells('v_cells')}) cl
   WHERE classe NOT IN ('AVANT', 'RETOUR');
  IF v_txt IS NOT NULL THEN RAISE EXCEPTION 'ABORT: relecture du retour : %', v_txt; END IF;
  SELECT string_agg(nom, ', ' ORDER BY nom COLLATE "C") INTO v_txt FROM (
    ${protectedBad()}
  ) b;
  IF v_txt IS NOT NULL THEN RAISE EXCEPTION 'ABORT: relecture des champs protégés : %', v_txt; END IF;
  RAISE NOTICE 'retour textes pg ${PG_ID} : cellules remises à la valeur relevée';
END
$ecriture$;

COMMIT;
`;
}

// ---------------------------------------------------------------------------
// C et C-og — images
// ---------------------------------------------------------------------------

const planJson = (imgs) =>
  `$fhlot$[\n${imgs
    .map((i) =>
      JSON.stringify({
        tbl: i.tbl,
        rip_id: i.rip_id,
        slot: i.slot,
        section: i.section,
        avant: i.avant,
        apres: i.apres,
        objet: i.objet,
        objet_avant: i.objet_avant,
        maj_avant: i.maj_avant,
      }),
    )
    .join(',\n')}\n]$fhlot$::jsonb`;

const PLAN_COLS = 'tbl text, rip_id integer, slot text, section text, avant jsonb, apres jsonb, objet jsonb, objet_avant jsonb, maj_avant timestamptz';

/** État courant de chaque ligne du plan ; chemin relatif au préfixe, '#hors-prefixe' sinon. */
const curImages = (prefix, imgs) => {
  const ids = (t) => imgs.filter((i) => i.tbl === t).map((i) => i.rip_id);
  const st = (sec) => `SELECT ${lit('')} AS tbl, i.rip_id, i.rip_slot_id AS slot, ${sec} AS section,
            jsonb_build_object('path', CASE WHEN i.rip_image_url IS NULL THEN NULL
                                            WHEN left(i.rip_image_url, length(${prefix})) = ${prefix}
                                            THEN substr(i.rip_image_url, length(${prefix}) + 1)
                                            ELSE '#hors-prefixe' END,
                               'alt', i.rip_alt_text, 'caption', i.rip_caption,
                               'status', i.rip_status, 'selected', i.rip_selected) AS st`;
  const parts = [];
  if (ids('r1').length) {
    parts.push(`${st('NULL::text').replace(`${lit('')} AS tbl`, `'r1' AS tbl`)}
       FROM __seo_r1_image_prompts i WHERE i.rip_pg_id = ${PG_ID} AND i.rip_id IN (${ids('r1').join(', ')})`);
  }
  if (ids('r3').length) {
    parts.push(`${st('i.rip_section_id').replace(`${lit('')} AS tbl`, `'r3' AS tbl`)}
       FROM __seo_r3_image_prompts i WHERE i.rip_pg_id = ${PG_ID} AND i.rip_id IN (${ids('r3').join(', ')})`);
  }
  return `(${parts.join('\n     UNION ALL\n     ')})`;
};

const classImages = (plan, prefix, imgs) => `SELECT p.tbl, p.rip_id,
           CASE WHEN cur.st IS NULL THEN 'DERIVE'
                WHEN cur.st = p.apres THEN 'APRES'
                WHEN cur.st = p.avant THEN 'AVANT'
                ELSE 'DERIVE' END AS classe
      FROM jsonb_to_recordset(${plan}) AS p(${PLAN_COLS})
      LEFT JOIN ${curImages(prefix, imgs)} cur
        ON cur.tbl = p.tbl AND cur.rip_id = p.rip_id AND cur.slot = p.slot AND cur.section IS NOT DISTINCT FROM p.section`;

/** Objets du bucket uploads : un seul objet vivant par chemin, aux métadonnées attendues. */
const objectsBad = (plan, which) => {
  const col = which === 'nouveaux' ? 'objet' : 'objet_avant';
  const mime = which === 'nouveaux' ? `'image/webp'` : `o.${'mimetype'}`;
  const cc = which === 'nouveaux' ? `'max-age=31536000'` : `o.cache_control`;
  return `SELECT o.path || ' ' || CASE WHEN count(s.id) = 0 THEN 'absent'
                                  WHEN count(s.id) > 1 THEN 'multiple'
                                  ELSE 'non conforme' END AS etat
      FROM jsonb_to_recordset(${plan}) AS p(${PLAN_COLS})
     CROSS JOIN LATERAL jsonb_to_record(p.${col}) AS o(path text, size bigint, md5 text, mimetype text, cache_control text)
      LEFT JOIN storage.objects s
        ON s.bucket_id = 'uploads' AND s.name = o.path AND NOT coalesce(s.is_delete_marker, false)
     WHERE p.${col} IS NOT NULL AND p.${col} <> 'null'::jsonb
     GROUP BY o.path, o.size, o.md5, o.mimetype, o.cache_control
    HAVING count(s.id) <> 1
        OR NOT bool_and(s.metadata->>'size' = o.size::text
                        AND s.metadata->>'mimetype' = ${mime}
                        AND trim(both '"' from s.metadata->>'eTag') = o.md5
                        AND s.metadata->>'cacheControl' = ${cc})`;
};

const prefixSql = `substring(rip_image_url from '^(https://[^/]+/storage/v1/object/public/uploads/)')`;

function imagesHeader(id, imgs, down) {
  const list = imgs.map((i) => `${i.tbl.toUpperCase()} ${i.slot} (rip_id ${i.rip_id})`).join(', ');
  const og = id === ID.og;
  return down
    ? `-- Rollback: ${id}
${generated(id)}
-- Remet, sur chaque ligne encore égale à l'état écrit par ${id}.sql,
-- l'état relevé le 2026-10-31 : chemin, alt, légende, statut, sélection et, en
-- R1, rip_updated_at. Une ligne modifiée depuis arrête tout (DERIVE). Exige que
-- les anciens objets R1 soient encore dans le bucket avec leurs métadonnées
-- relevées. En R3, l'état relevé est pending sans image : le retour repasse ces
-- lignes de approved à pending (déclassement B5 déclaré). Les nouveaux objets
-- restent dans le bucket ; leur suppression est une étape manuelle distincte.
-- L'engine est forward-only : ce fichier se lance à la main, sur GO owner.
-- Auto-transactionnel : BEGIN / COMMIT portés par le fichier, SET LOCAL bornés à lui.`
    : `-- =============================================================================
-- Lot éditorial filtre à huile (pg_id ${PG_ID}) : images${og ? ' de partage (og:image)' : ''}
-- =============================================================================
--
${generated(id)}
--
-- OBJET : ${list}.
-- Chaque image nouvelle est un objet déposé avant l'application, sous un chemin
-- versionné (-${VERSION}) : l'objet servi aujourd'hui n'est jamais réécrit, et
-- imgproxy, qui sert un chemin comme immuable pendant un an, ne garde pas
-- l'ancienne image. Les URL sont formées du préfixe lu sur la ligne R1 HERO
-- (rip_id ${PREFIX_ROW}) et du chemin : aucun hôte n'est écrit ici.${imgs.some((i) => i.apres.selected === false) ? `
-- R1 LOCATION (rip_id 34) passe à pending et n'est plus sélectionnée : aucun
-- emplacement universel (déclassement B5 déclaré). Sans image LOCATION, la
-- section #emplacement s'affiche sur une colonne.` : ''}${og ? `
-- Ces deux images alimentent og:image (R1 OG ; R3 HERO, image de partage du
-- guide R3) : fichier soumis à un accord distinct de celui des textes.` : ''}
--
-- §0 PRÉ-CONDITIONS, en lecture seule : fonctions de la garde d'écriture et
-- de l'invalidation au corps relevé ; triggers des deux tables et du cache
-- exactement ceux relevés ; agent SEO-Content unique, scope
-- seo_content_tables autorisant UPDATE sur les deux tables.
-- §1 ÉCRITURE : verrou des lignes, classement APRES / AVANT / DERIVE (une
-- DERIVE arrête tout) ; objets nouveaux présents une fois, en image/webp, à la
-- taille et au md5 du dossier, avec cache-control max-age=31536000 ; anciens
-- objets R1 intacts (condition du retour arrière). Écriture sous l'identité
-- SEO-Content, relecture de chaque ligne, cache __gamme_page_cache de pg ${PG_ID}
-- invalidé (trigger des images R1, puis invalidate_r1_caches) dans la
-- transaction. Caches Redis et CDN : publication-batch.json, « invalidation ».
--
${application(id)}
--
-- ROLLBACK : ${id}.down.sql, à la main (le moteur est
-- forward-only).
-- =============================================================================

${NO_TX}`;
}

function imagesBody(id, imgs, down) {
  const plan = 'v_plan';
  const ids = (t) => imgs.filter((i) => i.tbl === t).map((i) => i.rip_id);
  const lockFor = (t, table) =>
    ids(t).length
      ? `  PERFORM 1 FROM ${table} WHERE rip_pg_id = ${PG_ID} AND rip_id IN (${ids(t).join(', ')}) FOR UPDATE;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> ${ids(t).length} THEN RAISE EXCEPTION 'ABORT: % ligne(s) ${table} verrouillée(s), ${ids(t).length} attendue(s)', v_n; END IF;
`
      : '';
  const want = down ? 'avant' : 'apres';
  const from = down ? 'APRES' : 'AVANT';
  const r1Set = down
    ? `rip_image_url = CASE WHEN r.avant->>'path' IS NULL THEN NULL ELSE v_prefix || (r.avant->>'path') END,
               rip_alt_text = r.avant->>'alt', rip_caption = r.avant->>'caption',
               rip_status = r.avant->>'status', rip_selected = (r.avant->>'selected')::boolean,
               rip_updated_at = r.maj_avant`
    : `rip_image_url = v_prefix || (r.apres->>'path'),
               rip_alt_text = r.apres->>'alt', rip_caption = r.apres->>'caption',
               rip_status = r.apres->>'status', rip_selected = (r.apres->>'selected')::boolean,
               rip_updated_at = now()`;
  const r3Set = `rip_image_url = CASE WHEN r.${want}->>'path' IS NULL THEN NULL ELSE v_prefix || (r.${want}->>'path') END,
               rip_alt_text = r.${want}->>'alt', rip_caption = r.${want}->>'caption',
               rip_status = r.${want}->>'status', rip_selected = (r.${want}->>'selected')::boolean`;
  const objects = down
    ? `  SELECT string_agg(etat, ', ' ORDER BY etat COLLATE "C") INTO v_txt FROM (
    ${objectsBad(plan, 'anciens')}
  ) b;
  IF v_txt IS NOT NULL THEN RAISE EXCEPTION 'ABORT: ancien(s) objet(s) R1 absent(s) ou modifié(s) : %', v_txt; END IF;`
    : `  SELECT string_agg(etat, ', ' ORDER BY etat COLLATE "C") INTO v_txt FROM (
    ${objectsBad(plan, 'nouveaux')}
  ) b;
  IF v_txt IS NOT NULL THEN RAISE EXCEPTION 'ABORT: objet(s) à déposer avant l''application : %', v_txt; END IF;
  SELECT string_agg(etat, ', ' ORDER BY etat COLLATE "C") INTO v_txt FROM (
    ${objectsBad(plan, 'anciens')}
  ) b;
  IF v_txt IS NOT NULL THEN RAISE EXCEPTION 'ABORT: ancien(s) objet(s) R1 absent(s) ou modifié(s), retour arrière impossible : %', v_txt; END IF;`;
  return `DO $ecriture$
DECLARE
  v_plan   jsonb := ${planJson(imgs)};
  v_prefix text;
  v_n      bigint;
  v_txt    text;
  v_prev   text;
  v_agent  uuid;
  r        record;
BEGIN
${lockFor('r1', '__seo_r1_image_prompts')}${lockFor('r3', '__seo_r3_image_prompts')}
  SELECT ${prefixSql} INTO v_prefix
    FROM __seo_r1_image_prompts WHERE rip_pg_id = ${PG_ID} AND rip_id = ${PREFIX_ROW};
  IF v_prefix IS NULL THEN
    RAISE EXCEPTION 'ABORT: préfixe d''URL illisible sur la ligne R1 rip_id ${PREFIX_ROW}';
  END IF;

  SELECT string_agg(tbl || ':' || rip_id || ' ' || classe, ', ' ORDER BY tbl, rip_id) FILTER (WHERE classe = 'DERIVE'),
         count(*) FILTER (WHERE classe = 'APRES')
    INTO v_txt, v_n
    FROM (${classImages(plan, 'v_prefix', imgs)}) cl;
  IF v_txt IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT: ligne(s) image modifiée(s) depuis ${down ? "l''écriture du lot" : 'le relevé'} : %', v_txt;
  END IF;
  IF v_n = ${down ? 0 : imgs.length} THEN
    RAISE NOTICE '${down ? 'retour' : 'lot'} ${id} : ${down ? 'aucune ligne écrite par le lot' : 'déjà écrit'}, sans effet';
    RETURN;
  END IF;

${objects}

${identity}

  FOR r IN
    SELECT p.*
      FROM jsonb_to_recordset(v_plan) AS p(${PLAN_COLS})
      JOIN (${classImages(plan, 'v_prefix', imgs)}) cl ON cl.tbl = p.tbl AND cl.rip_id = p.rip_id
     WHERE cl.classe = '${from}'
  LOOP
    IF r.tbl = 'r1' THEN
      UPDATE __seo_r1_image_prompts
         SET ${r1Set}
       WHERE rip_id = r.rip_id AND rip_pg_id = ${PG_ID} AND rip_slot_id = r.slot;
    ELSE
      UPDATE __seo_r3_image_prompts
         SET ${r3Set}
       WHERE rip_id = r.rip_id AND rip_pg_id = ${PG_ID} AND rip_slot_id = r.slot AND rip_section_id = r.section;
    END IF;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 1 THEN RAISE EXCEPTION 'ABORT: % ligne(s) écrite(s) pour %:%, 1 attendue', v_n, r.tbl, r.rip_id; END IF;
  END LOOP;

${identityEnd}

${cacheCheck('gpc', `editorial_filtre_huile_pg${PG_ID}:${id === ID.og ? 'og' : 'images'}${down ? ':rollback' : ''}`)}

  SELECT string_agg(tbl || ':' || rip_id || ' ' || classe, ', ' ORDER BY tbl, rip_id) INTO v_txt
    FROM (${classImages(plan, 'v_prefix', imgs)}) cl
   WHERE classe <> '${down ? 'AVANT' : 'APRES'}';
  IF v_txt IS NOT NULL THEN RAISE EXCEPTION 'ABORT: relecture : %', v_txt; END IF;
  RAISE NOTICE '${down ? 'retour' : 'lot'} ${id} : ${imgs.length} ligne(s) ${down ? 'remises' : 'écrites'} et relues';
END
$ecriture$;`;
}

function imagesMigration(id, imgs, down) {
  const pre = precheckBlock(SCOPES.images, `pg 7 (${id === ID.og ? 'og' : 'images'})`);
  return down
    ? `${imagesHeader(id, imgs, true)}
BEGIN;
${SET_LOCALS}

${pre}

${imagesBody(id, imgs, true)}

COMMIT;
`
    : `${imagesHeader(id, imgs, false)}
${SET_LOCALS}

-- §0 — PRÉ-CONDITIONS, en lecture seule.
${pre}

-- §1 — ÉCRITURE, RELECTURE, INVALIDATION.
${imagesBody(id, imgs, false)}
`;
}

// ---------------------------------------------------------------------------
// Contrôle préalable en lecture seule (SELECT seuls : ni transaction, ni set_config, ni garde)
// ---------------------------------------------------------------------------

function precheckSql() {
  const allPins = [...new Set([...SCOPES.textes.pins, ...SCOPES.images.pins])];
  const allScope = { tables: [...SCOPES.textes.tables, ...SCOPES.images.tables], caches: SCOPES.textes.caches };
  const trgs = expectedTriggers(allScope);
  const plan = planJson(IMAGES);
  const pref = `(SELECT ${prefixSql} FROM __seo_r1_image_prompts WHERE rip_pg_id = ${PG_ID} AND rip_id = ${PREFIX_ROW})`;
  return `-- Contrôle préalable du lot filtre à huile (pg_id ${PG_ID}), en lecture seule.
-- Généré par ${GENERATOR} --precheck ; une ligne par contrôle.
-- Tri par octets sur la ligne entière : « ORDER BY 1 COLLATE » serait une expression, pas un ordinal.
SELECT 'pin|restore_french_accents(text)|' || CASE WHEN ${sig('p')} = ${lit(RFA_ALPHA)} THEN 'alpha'
            WHEN md5(p.prosrc) = ${lit(RFA_OLD_MD5)} THEN 'ancienne' ELSE 'KO ' || ${sig('p')} END
  FROM pg_proc p WHERE p.oid = to_regprocedure('public.restore_french_accents(text)');
SELECT l FROM (
SELECT 'pin|' || p.sig || '|' || CASE WHEN f.oid IS NULL THEN 'ABSENTE' WHEN ${sig('f')} = p.attendu THEN 'OK' ELSE 'KO ' || ${sig('f')} END
  FROM (VALUES
${allPins.map((p) => `      (${lit(PINS[p][0])}, ${lit(PINS[p][1])})`).join(',\n')}
  ) p(sig, attendu)
  LEFT JOIN pg_proc f ON f.oid = to_regprocedure(p.sig)
) q(l) ORDER BY l COLLATE "C";
SELECT l FROM (
WITH attendu(d) AS (VALUES
${trgs.map((t) => `  (${lit(t)})`).join(',\n')}
), reel AS (${liveTriggers(allScope)})
SELECT 'trigger|' || coalesce(a.d, r.d) || '|' || CASE WHEN a.d IS NULL THEN 'INATTENDU' WHEN r.d IS NULL THEN 'ABSENT' ELSE 'OK' END
  FROM attendu a FULL JOIN reel r ON r.d = a.d
) q(l) ORDER BY l COLLATE "C";
SELECT 'identite|SEO-Content|' || count(*) || ' ligne(s), scope ' || coalesce(string_agg(write_scope, ','), '-')
  FROM agent_write_scopes WHERE agent_name = 'SEO-Content';
SELECT l FROM (
SELECT 'regle|' || t || '|' || CASE WHEN ${ruleMatch('t')} THEN 'OK' ELSE 'KO' END
  FROM unnest(ARRAY[${allScope.tables.map(lit).join(', ')}]) t
) q(l) ORDER BY l COLLATE "C";
SELECT 'ligne|__seo_r1_gamme_slots pg ${PG_ID}|' || count(*) FROM __seo_r1_gamme_slots WHERE r1s_pg_id = '${PG_ID}';
SELECT 'ligne|__seo_gamme pg ${PG_ID}|' || count(*) || ' (sg_id ' || coalesce(string_agg(sg_id, ','), '-') || ')'
  FROM __seo_gamme WHERE sg_pg_id = '${PG_ID}';
SELECT 'ligne|__seo_gamme_conseil pg ${PG_ID}|' || CASE WHEN string_agg(sgc_id || ':' || sgc_section_type, ',' ORDER BY sgc_id || ':' || sgc_section_type COLLATE "C")
            = ${lit(SGC_ALL.join(','))} THEN 'OK' ELSE 'KO' END || ' (' || count(*) || ' sections)'
  FROM __seo_gamme_conseil WHERE sgc_pg_id = '${PG_ID}';
SELECT l FROM (
SELECT 'cellule|' || k || '|' || classe FROM (
  ${classCells(cellsJsonb())}
) cl
) q(l) ORDER BY l COLLATE "C";
SELECT l FROM (
SELECT 'protege|' || x.nom || '|' || CASE WHEN x.val IS NULL THEN 'ABSENT'
            WHEN encode(sha256(convert_to(x.val, 'UTF8')), 'hex') <> x.sha THEN 'KO sha256'
            WHEN x.fixe AND restore_french_accents(x.val) IS DISTINCT FROM x.val THEN 'KO réécrit par le trigger'
            ELSE 'OK' END
  FROM (VALUES
${protectedValues()}
  ) x(nom, val, sha, fixe)
) q(l) ORDER BY l COLLATE "C";
SELECT 'prefixe|' || CASE WHEN ${pref} IS NULL THEN 'KO' ELSE 'conforme' END;
SELECT 'image|' || tbl || ':' || rip_id || '|' || classe FROM (
  ${classImages(plan, pref, IMAGES)}
) cl ORDER BY tbl, rip_id;
SELECT l FROM (
SELECT 'objet|' || o.path || '|' || CASE WHEN count(s.id) = 0 THEN 'absent'
            WHEN count(s.id) > 1 THEN 'multiple'
            WHEN bool_and(s.metadata->>'size' = o.size::text AND s.metadata->>'mimetype' = o.mimetype
                          AND trim(both '"' from s.metadata->>'eTag') = o.md5 AND s.metadata->>'cacheControl' = o.cache_control)
            THEN 'conforme' ELSE 'present non conforme' END || ' (' || o.genre || ')'
  FROM (SELECT x.*, 'nouveau' AS genre
          FROM jsonb_to_recordset(${plan}) AS p(${PLAN_COLS})
         CROSS JOIN LATERAL jsonb_to_record(p.objet || '{"mimetype": "image/webp", "cache_control": "max-age=31536000"}'::jsonb)
               AS x(path text, size bigint, md5 text, mimetype text, cache_control text)
         WHERE p.objet IS NOT NULL AND p.objet <> 'null'::jsonb
        UNION ALL
        SELECT x.*, 'ancien'
          FROM jsonb_to_recordset(${plan}) AS p(${PLAN_COLS})
         CROSS JOIN LATERAL jsonb_to_record(p.objet_avant) AS x(path text, size bigint, md5 text, mimetype text, cache_control text)
         WHERE p.objet_avant IS NOT NULL AND p.objet_avant <> 'null'::jsonb) o
  LEFT JOIN storage.objects s ON s.bucket_id = 'uploads' AND s.name = o.path AND NOT coalesce(s.is_delete_marker, false)
 GROUP BY o.path, o.size, o.md5, o.mimetype, o.cache_control, o.genre
) q(l) ORDER BY l COLLATE "C";
${SCOPES.textes.caches.map((t) => `SELECT 'cache|${t} pg ${PG_ID}|' || count(*) || ' ligne(s), ' || count(*) FILTER (WHERE NOT stale) || ' fraîche(s)' FROM ${t} WHERE pg_id = ${PG_ID};`).join('\n')}
`;
}

// ---------------------------------------------------------------------------
// Données du banc : l'état relevé le 2026-10-31, préfixe et identité fictifs
// ---------------------------------------------------------------------------

const BENCH_PREFIX = 'https://banc.invalid/storage/v1/object/public/uploads/';

function fixtureData() {
  const r1s = avant.r1s;
  const rawCol = (col, v) => {
    const c = CELLS.find((x) => x.key === `r1s/${col}`);
    return `${dollar(c.avant)}${castFor(c)}`;
  };
  const r1sCols = Object.keys(r1s);
  const objLine = (p, size, md5, mime, cc) =>
    `  ('uploads', ${lit(p)}, jsonb_build_object('eTag', '"${md5}"', 'size', ${size}, 'mimetype', ${lit(mime)}, 'cacheControl', ${lit(cc)}))`;
  const objs = [];
  for (const i of IMAGES) {
    if (i.objet) objs.push(objLine(i.objet.path, i.objet.size, i.objet.md5, 'image/webp', 'max-age=31536000'));
    if (i.objet_avant) objs.push(objLine(i.objet_avant.path, i.objet_avant.size, i.objet_avant.md5, i.objet_avant.mimetype, i.objet_avant.cache_control));
  }
  const r1img = avant.images.r1.map(
    (r) => `  (${r.rip_id}, ${PG_ID}, ${lit(ALIAS)}, ${lit(r.rip_slot_id)}, ${lit(r.rip_status)}, ${r.rip_selected}, ${r.chemin === null ? 'NULL' : lit(BENCH_PREFIX + r.chemin)}, ${lit(r.rip_alt_text)}, ${lit(r.rip_caption)}, ${lit(r.rip_updated_at)})`,
  );
  const r3img = avant.images.r3.map(
    (r) => `  (${r.rip_id}, ${PG_ID}, ${lit(ALIAS)}, ${lit(r.rip_slot_id)}, ${lit(r.rip_section_id)}, ${lit(r.rip_status)}, ${r.rip_selected}, ${r.chemin === null ? 'NULL' : lit(BENCH_PREFIX + r.chemin)}, ${lit(r.rip_alt_text)}, ${lit(r.rip_caption)}, ${lit(r.rip_aspect_ratio)})`,
  );
  return `-- Données du banc ${GENERATOR} --fixture-data :
-- état de pg ${PG_ID} relevé le 2026-10-31 (integration/avant-textes.json), préfixe fictif.
INSERT INTO pieces_gamme (pg_id, pg_alias, pg_name) VALUES (${PG_ID}, ${lit(ALIAS)}, 'Filtre à huile'), (8, 'temoin', 'Témoin');
INSERT INTO __gamme_page_cache (pg_id, payload, source_hash) VALUES (${PG_ID}, '{}', 'banc'), (8, '{}', 'banc');
INSERT INTO __seo_r1_related_blocks_cache (pg_id, payload, source_hash) VALUES (${PG_ID}, '{}', 'banc'), (8, '{}', 'banc');
INSERT INTO __seo_r1_gamme_slots (r1s_pg_id, r1s_h1_override, ${r1sCols.join(', ')}, r1s_updated_at)
VALUES ('${PG_ID}', ${dollar(cp.r1s_h1_override.valeur)},
${r1sCols.map((c) => `  ${rawCol(c)}`).join(',\n')},
  ${lit(avant.r1s_updated_at)});
INSERT INTO __seo_gamme (sg_id, sg_pg_id, sg_title, sg_descrip, sg_content, sg_updated_at)
VALUES (${lit(avant.sg.sg_id)}, '${PG_ID}', ${dollar(cp.sg_title.valeur)}, ${dollar(cp.sg_descrip.valeur)}, ${dollar(avant.sg.sg_content)}, ${lit(avant.sg.sg_updated_at)});
INSERT INTO __seo_gamme_conseil (sgc_id, sgc_pg_id, sgc_section_type, sgc_title, sgc_content, sgc_sources) VALUES
${avant.sgc.map((r) => `  (${lit(r.sgc_id)}, '${PG_ID}', ${lit(r.sgc_section_type)}, ${dollar(r.sgc_title)}, ${dollar(r.sgc_content)}, ${r.sgc_sources === null ? 'NULL' : dollar(r.sgc_sources)})`).join(',\n')};
INSERT INTO __seo_r1_image_prompts (rip_id, rip_pg_id, rip_pg_alias, rip_slot_id, rip_status, rip_selected, rip_image_url, rip_alt_text, rip_caption, rip_updated_at,
                                    rip_gamme_name, rip_section_id, rip_topic, rip_prompt_text) VALUES
${r1img.map((l) => l.replace(/\)$/, `, 'Filtre à huile', 'banc', 'banc', 'banc')`)).join(',\n')};
INSERT INTO __seo_r3_image_prompts (rip_id, rip_pg_id, rip_pg_alias, rip_slot_id, rip_section_id, rip_status, rip_selected, rip_image_url, rip_alt_text, rip_caption, rip_aspect_ratio,
                                    rip_gamme_name, rip_topic, rip_prompt_text, rip_min_width) VALUES
${r3img.map((l) => l.replace(/\)$/, `, 'Filtre à huile', 'banc', 'banc', 800)`)).join(',\n')};
INSERT INTO storage.objects (bucket_id, name, metadata) VALUES
${objs.join(',\n')};
`;
}

// ---------------------------------------------------------------------------
// Sorties
// ---------------------------------------------------------------------------

function outputs() {
  const main = IMAGES.filter((i) => !i.og);
  return {
    [path.join(MIG_DIR, `${ID.textes}.sql`)]: textesUp(),
    [path.join(MIG_DIR, `${ID.textes}.down.sql`)]: textesDown(),
    [path.join(MIG_DIR, `${ID.images}.sql`)]: imagesMigration(ID.images, main, false),
    [path.join(MIG_DIR, `${ID.images}.down.sql`)]: imagesMigration(ID.images, main, true),
  };
}

function checkTags(text, file) {
  for (const t of TAGS) {
    const n = text.split(t).length - 1;
    if (n % 2 !== 0) fail(`${file} : balise ${t} non appariée`);
  }
}

function main(argv) {
  const arg = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] || fail(`${name} sans valeur`) : null;
  };
  if (argv.includes('--precheck')) {
    fs.writeFileSync(arg('--precheck'), precheckSql());
    return 0;
  }
  if (argv.includes('--fixture-data')) {
    fs.writeFileSync(path.join(arg('--fixture-data'), 'donnees.sql'), fixtureData());
    return 0;
  }
  if (argv.includes('--og')) {
    const dir = arg('--out-dir') || fail('--og exige --out-dir (fichier jamais écrit dans le dépôt)');
    if (path.resolve(dir).startsWith(path.resolve(ROOT) + path.sep)) fail('--out-dir doit être hors du dépôt');
    const og = IMAGES.filter((i) => i.og);
    fs.writeFileSync(path.join(dir, `${ID.og}.sql`), imagesMigration(ID.og, og, false));
    fs.writeFileSync(path.join(dir, `${ID.og}.down.sql`), imagesMigration(ID.og, og, true));
    return 0;
  }
  const out = outputs();
  let diff = 0;
  for (const [file, text] of Object.entries(out)) {
    checkTags(text, file);
    const rel = path.relative(ROOT, file);
    if (argv.includes('--check')) {
      const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
      if (cur !== text) {
        diff++;
        console.error(`DIFF ${rel}`);
      }
    } else {
      fs.writeFileSync(file, text);
      console.log(`écrit ${rel}`);
    }
  }
  console.log(`${CELLS.length} cellules (avant et après vérifiés), ${IMAGES.length} images (${IMAGES.filter((i) => i.og).length} og)`);
  return diff ? 1 : 0;
}

// tools/deposer-objets.cjs dépose les objets de ce plan, sans recalculer chemins ni empreintes.
module.exports = { IMAGES, ID, VERSION };

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    console.error(`ÉCHEC : ${e.message}`);
    process.exitCode = 2;
  }
}
