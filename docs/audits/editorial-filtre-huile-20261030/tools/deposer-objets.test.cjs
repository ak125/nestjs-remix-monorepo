/**
 * Banc de tools/deposer-objets.cjs contre un faux serveur Storage local (aucun appel extérieur).
 *
 * Usage : NODE_PATH=<node_modules contenant @supabase/supabase-js> node --test tools/deposer-objets.test.cjs
 */
'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const { test } = require('node:test');
const { main, plan } = require('./deposer-objets.cjs');

const PREFIX = '/storage/v1/object/uploads/';
const md5 = (buf) => crypto.createHash('md5').update(buf).digest('hex');
const json = (res, status, body) => res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));

/** Faux bucket : GET relit, POST dépose ; `mode` simule les pannes. */
async function fauxStorage(mode = {}) {
  const objets = new Map();
  const depots = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      if (!req.url.startsWith(PREFIX)) return json(res, 404, { message: 'route inconnue' });
      const p = decodeURIComponent(req.url.slice(PREFIX.length));
      if (req.method === 'GET') {
        if (mode.accesRefuse) return json(res, 400, { statusCode: '403', error: 'Unauthorized', message: 'invalid signature' });
        const o = objets.get(p);
        if (!o) return json(res, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
        return res.writeHead(200, { 'content-type': 'image/webp' }).end(o);
      }
      if (req.method === 'POST') {
        if (mode.depotEnPanne) return json(res, 500, { statusCode: '500', message: 'panne' });
        if (objets.has(p) && req.headers['x-upsert'] !== 'true') return json(res, 400, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' });
        const body = Buffer.concat(chunks);
        depots.push({ path: p, headers: req.headers, md5: md5(body) });
        objets.set(p, mode.corrompre ? Buffer.concat([body, Buffer.from('x')]) : body);
        return json(res, 200, { Key: `uploads/${p}`, Id: crypto.randomUUID() });
      }
      return json(res, 405, { message: 'méthode' });
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const env = { SUPABASE_URL: `http://127.0.0.1:${server.address().port}`, SUPABASE_SERVICE_ROLE_KEY: 'cle-de-banc' };
  return { objets, depots, env, close: () => new Promise((r) => server.close(r)) };
}

const silencieux = () => {};

test('plan : 5 objets C, 2 objets C-og, chemins versionnés distincts', () => {
  const c = plan(false);
  const og = plan(true);
  assert.equal(c.length, 5);
  assert.equal(og.length, 2);
  const chemins = [...c, ...og].map((o) => o.path);
  assert.equal(new Set(chemins).size, 7);
  for (const p of chemins) assert.match(p, /^articles\/gammes-produits\/r[13]\/filtre-a-huile-.*v20261031\.webp$/);
});

test('simulation : sortie 0 sans variable ni réseau', async () => {
  const lignes = [];
  assert.equal(await main([], {}, (l) => lignes.push(l)), 0);
  assert.equal(lignes.filter((l) => l.startsWith('plan|')).length, 5);
});

test('--execute sans variables : échec avant tout appel', async () => {
  const s = await fauxStorage();
  try {
    await assert.rejects(main(['--execute'], {}, silencieux), /exige SUPABASE_URL/);
    assert.equal(s.depots.length, 0);
  } finally {
    await s.close();
  }
});

test('dépôt : upsert false, image/webp, max-age=31536000, octets du plan ; rejeu sans dépôt', async () => {
  const s = await fauxStorage();
  try {
    assert.equal(await main(['--execute'], s.env, silencieux), 0);
    const attendu = new Map(plan(false).map((o) => [o.path, o.md5]));
    assert.equal(s.depots.length, 5);
    for (const d of s.depots) {
      assert.equal(d.headers['x-upsert'], 'false');
      assert.equal(d.headers['content-type'], 'image/webp');
      assert.equal(d.headers['cache-control'], 'max-age=31536000');
      assert.equal(d.md5, attendu.get(d.path));
    }
    assert.equal(await main(['--execute'], s.env, silencieux), 0);
    assert.equal(s.depots.length, 5);
  } finally {
    await s.close();
  }
});

test('chemin occupé par d’autres octets : sortie 1, aucun dépôt', async () => {
  const s = await fauxStorage();
  try {
    s.objets.set(plan(false)[2].path, Buffer.from('autre'));
    const lignes = [];
    assert.equal(await main(['--execute'], s.env, (l) => lignes.push(l)), 1);
    assert.equal(s.depots.length, 0);
    assert.ok(lignes.some((l) => l.startsWith('DIFFÉRENT ')));
  } finally {
    await s.close();
  }
});

test('erreur d’accès à la relecture : échec, jamais lue comme une absence', async () => {
  const s = await fauxStorage({ accesRefuse: true });
  try {
    await assert.rejects(main(['--execute'], s.env, silencieux), /relecture .*invalid signature/);
    assert.equal(s.depots.length, 0);
  } finally {
    await s.close();
  }
});

test('dépôt refusé par le serveur : échec', async () => {
  const s = await fauxStorage({ depotEnPanne: true });
  try {
    await assert.rejects(main(['--execute'], s.env, silencieux), /dépôt .*panne/);
  } finally {
    await s.close();
  }
});

test('relecture différente après dépôt : sortie 1', async () => {
  const s = await fauxStorage({ corrompre: true });
  try {
    const lignes = [];
    assert.equal(await main(['--execute'], s.env, (l) => lignes.push(l)), 1);
    assert.equal(lignes.filter((l) => l.startsWith('RELECTURE FAUSSE ')).length, 5);
  } finally {
    await s.close();
  }
});

test('--og : seuls les 2 objets C-og partent', async () => {
  const s = await fauxStorage();
  try {
    assert.equal(await main(['--execute', '--og'], s.env, silencieux), 0);
    assert.deepEqual(s.depots.map((d) => d.path).sort(), plan(true).map((o) => o.path).sort());
  } finally {
    await s.close();
  }
});
