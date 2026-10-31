#!/usr/bin/env node
/**
 * Dépôt des objets d'image du lot filtre à huile (pg_id 7) dans le bucket uploads, avant la migration C.
 *
 * Le plan vient de build-publication-migration.cjs (chemins versionnés, taille et md5) : rien n'est
 * recalculé ici. Chaque objet part à un chemin neuf, sans écrasement (upsert false), en image/webp avec
 * cache-control max-age=31536000 ; un chemin déjà occupé n'est accepté que si ses octets ont le md5 du
 * plan. La migration C refuse de s'appliquer tant qu'un objet manque ou diffère (contrôle préalable).
 * Retour arrière : la descente de C remet les anciens chemins en base ; les objets versionnés restent
 * dans le bucket, sans effet sur les pages servies, et leur suppression est une étape distincte.
 *
 * Usage :
 *   node tools/deposer-objets.cjs                 plan, sans réseau ni variable d'environnement
 *   node tools/deposer-objets.cjs --og            plan du jeu C-og (accord distinct)
 *   node --env-file=<backend/.env> tools/deposer-objets.cjs --execute [--og]
 *                                                 dépôt (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
 *
 * --execute relit d'abord chaque chemin : un objet aux octets différents arrête tout avant le premier
 * dépôt. Sorties : 0 conforme, 1 écart (objet différent ou relecture fausse), 2 échec.
 */
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { IMAGES, ID } = require('./build-publication-migration.cjs');

const DOSSIER = path.join(__dirname, '..');
const ROOT = path.join(__dirname, '..', '..', '..', '..');
const BUCKET = 'uploads';
const CONTENT_TYPE = 'image/webp';
const CACHE_SECONDS = '31536000'; // supabase-js envoie cache-control: max-age=<valeur>

const fail = (msg) => {
  throw new Error(msg);
};
const md5 = (buf) => crypto.createHash('md5').update(buf).digest('hex');

/** Objets du jeu demandé, avec le fichier du dossier qui les porte (assets.json). */
function plan(og) {
  const assets = JSON.parse(fs.readFileSync(path.join(DOSSIER, 'integration', 'assets.json'), 'utf8'));
  const migration = og ? null : fs.readFileSync(path.join(ROOT, 'backend', 'supabase', 'migrations', `${ID.images}.sql`), 'utf8');
  return IMAGES.filter((i) => i.objet && i.og === og).map((i) => {
    const page = i.tbl.toUpperCase();
    const v = assets.visuels.find((x) => x.page === page && x.rip_id === i.rip_id) || fail(`${page} ${i.rip_id} absent de assets.json`);
    const buf = fs.readFileSync(path.join(DOSSIER, v.fichier));
    if (buf.length !== i.objet.size || md5(buf) !== i.objet.md5) fail(`${v.fichier} : taille ou md5 différent du plan`);
    const attendu = `"objet":${JSON.stringify(i.objet)}`;
    if (migration && !migration.includes(attendu)) fail(`${i.objet.path} absent de ${ID.images}.sql : régénérer la migration`);
    return { ...i.objet, fichier: v.fichier, buf };
  });
}

/** Absent seulement sur « not found » : une erreur d'accès n'est jamais lue comme une absence. */
const notFound = (e) =>
  e && (e.status === 404 || (e.status === 400 && (String(e.statusCode) === '404' || /not.?found/i.test(e.message || ''))));

async function relire(bucket, p) {
  const { data, error } = await bucket.download(p);
  if (error) {
    if (notFound(error)) return null;
    fail(`relecture ${p} : ${error.message}`);
  }
  return md5(Buffer.from(await data.arrayBuffer()));
}

async function deposer(bucket, objets, log) {
  const etats = [];
  for (const o of objets) etats.push({ o, lu: await relire(bucket, o.path) });
  const autres = etats.filter((e) => e.lu !== null && e.lu !== e.o.md5);
  for (const e of autres) log(`DIFFÉRENT ${e.o.path} : md5 ${e.lu}, attendu ${e.o.md5}`);
  if (autres.length) return 1;
  let ecarts = 0;
  for (const { o, lu } of etats) {
    if (lu === o.md5) {
      log(`présent ${o.path} (md5 conforme)`);
      continue;
    }
    const { error } = await bucket.upload(o.path, o.buf, { contentType: CONTENT_TYPE, cacheControl: CACHE_SECONDS, upsert: false });
    if (error) fail(`dépôt ${o.path} : ${error.message}`);
    const relu = await relire(bucket, o.path);
    if (relu === o.md5) log(`déposé ${o.path} (md5 relu conforme)`);
    else {
      ecarts++;
      log(`RELECTURE FAUSSE ${o.path} : md5 ${relu}, attendu ${o.md5}`);
    }
  }
  return ecarts ? 1 : 0;
}

async function main(argv, env = process.env, log = console.log) {
  const og = argv.includes('--og');
  const objets = plan(og);
  for (const o of objets) log(`plan|${o.path}|${o.size}|${o.md5}|${CONTENT_TYPE}|max-age=${CACHE_SECONDS}|${o.fichier}`);
  log(`${objets.length} objets (${og ? 'C-og' : 'C'}), bucket ${BUCKET}`);
  if (!argv.includes('--execute')) {
    log('simulation : aucun appel réseau ; --execute dépose');
    return 0;
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) fail('--execute exige SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY');
  const { createClient } = require('@supabase/supabase-js');
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return deposer(client.storage.from(BUCKET), objets, log);
}

module.exports = { main, plan, deposer };

if (require.main === module) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (e) => {
      console.error(`ÉCHEC : ${e.message}`);
      process.exitCode = 2;
    },
  );
}
