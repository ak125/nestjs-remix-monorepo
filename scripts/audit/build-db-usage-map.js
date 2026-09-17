#!/usr/bin/env node
/**
 * build-db-usage-map.js — PR-0b of the monorepo deep-audit (Phase 0.9).
 *
 * Maps Supabase usage: every `.from('<table>')` / `.rpc('<fn>')` call in
 * backend/src/** (AST — literal-arg only; dynamic args listed separately),
 * cross-referenced with `backend/supabase/migrations/**` (CREATE TABLE / CREATE
 * FUNCTION / RLS) and `.claude/knowledge/db/`.
 *
 * **Detects, does NOT conclude "table morte".** A table absent from `.from()`
 * calls can still be used by Supabase internals, ad-hoc SQL, a dashboard, an
 * external cron, or indirectly inside an RPC body. So it emits
 * `candidate_orphan_tables[]` / `candidate_orphan_rpc[]` with `confidence`
 * (low|medium — never high), `derived_from[]`, and the blind-spot `caveats`.
 *
 * Output (versioned): `audit/db-usage-map.json`. Deterministic (no timestamps,
 * sorted keys).
 *
 * Usage:  node scripts/audit/build-db-usage-map.js [--quiet]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { maskComments } = require('../registry/lib/sql-lex');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const QUIET = process.argv.includes('--quiet');
const GENERATED_BY = 'scripts/audit/build-db-usage-map.js';

function log(...a) { if (!QUIET) process.stderr.write(a.join(' ') + '\n'); }
function die(msg) { process.stderr.write(`[build-db-usage-map] ERROR: ${msg}\n`); process.exit(1); }

// Comparateur CODEPOINT — jamais `localeCompare()`, qui résout l'ICU du process
// (`fr-FR` sur un poste opérateur, `en-US`/`C` sur un runner CI) et rendrait
// l'ordre de cette projection dépendant de la machine. Même règle et même
// justification que dans build-deep-inventory.js — les deux écrivent des
// artefacts comparés octet près par le step « Deep-inventory freshness ».
const cmpStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const ORPHAN_TABLE_CAVEATS = [
  'may be read/written by Supabase internals (auth, storage, realtime)',
  'may be used by ad-hoc SQL / psql / dashboard',
  'may be referenced only inside an RPC/function body (not detected by .from() scan)',
  'may be RLS-protected and accessed only through PostgREST without an explicit .from() in backend',
  'may be written by an external cron / ETL outside this repo',
];
const ORPHAN_RPC_CAVEATS = [
  'may be called from another RPC/function body (SQL-internal)',
  'may be invoked from the Supabase dashboard or an external job',
  'may be called via raw HTTP/PostgREST without supabase.rpc() in backend',
];

// ---------------------------------------------------------------------------
function gitLines(args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).split('\n').filter(Boolean);
}

// Récepteurs sur lesquels `.from()` est un constructeur JS, pas PostgREST.
// `from` n'est pas un nom propre à Supabase : Buffer.from(<base64>) enregistrait
// le GIF de suivi du panier comme une TABLE dans audit/registry/db.json.
const JS_STATIC_FROM_OWNERS = new Set([
  'Array', 'Buffer', 'Object', 'Promise', 'Date', 'String', 'Number',
  'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array',
  'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array',
  'BigInt64Array', 'BigUint64Array',
]);

// Verbes PostgREST qui prouvent qu'un `.from(x)` cible bien une table. Jeu
// MINIMAL et délibéré : y ajouter `filter` réintroduirait Array.from(x).filter(…).
const POSTGREST_VERBS = new Set(['select', 'insert', 'update', 'upsert', 'delete']);

// Déballe (x), x as T, x satisfies T, x! pour atteindre le vrai récepteur.
// Indispensable : `(this.dataService as any).supabase.from('__diag_…')` et
// `this.paymentDataService['supabase'].from('__paybox_gate_log')` sont de VRAIS
// appels DB, et une règle qui n'accepterait que Identifier/PropertyAccess les
// perdrait — dont une table de la zone STOP paiement.
function unwrapReceiver(ts, node) {
  let n = node;
  for (;;) {
    if (ts.isParenthesizedExpression(n)) { n = n.expression; continue; }
    if (ts.isAsExpression(n)) { n = n.expression; continue; }
    if (ts.isNonNullExpression(n)) { n = n.expression; continue; }
    if (ts.isSatisfiesExpression && ts.isSatisfiesExpression(n)) { n = n.expression; continue; }
    return n;
  }
}

// Le verbe PostgREST immédiatement chaîné à cet appel, ou null.
function chainedVerb(ts, call) {
  const parent = call.parent;
  if (!parent || !ts.isPropertyAccessExpression(parent)) return null;
  if (parent.expression !== call) return null;
  if (!ts.isIdentifier(parent.name)) return null;
  const v = parent.name.text;
  return POSTGREST_VERBS.has(v) ? v : null;
}

// Classification à TROIS issues — jamais un filtre binaire (invariant 3 : aucun
// repli silencieux). DB : preuve positive. NOT_DB : rejet STRUCTUREL, par liste
// noire, jamais par liste blanche de noms de récepteurs — une liste blanche
// perdrait `sb`, `this.searchService['client']` et consorts. UNRESOLVED : ni
// l'un ni l'autre, donc publié et compté, jamais jeté en silence.
function classifyCallSite(ts, call, method) {
  const recvNode = unwrapReceiver(ts, call.expression.expression);
  const recvText = call.expression.expression.getText().replace(/\s+/g, ' ');
  const verb = chainedVerb(ts, call);

  if (ts.isIdentifier(recvNode) && JS_STATIC_FROM_OWNERS.has(recvNode.text)) {
    return { kind: 'NOT_DB', reason: 'js-builtin-static-from', recvText };
  }
  // `<client>.storage.from('bucket')` nomme un BUCKET Storage, pas une table :
  // c'est ainsi que `uploads` entrait dans db.json. Rejet STRUCTUREL (dernier
  // segment + absence de chaînage PostgREST), jamais un verdict sur le nom du
  // bucket — un bucket homonyme d'une table réelle doit rester distinguable.
  if (ts.isPropertyAccessExpression(recvNode) && ts.isIdentifier(recvNode.name)
      && recvNode.name.text === 'storage' && !verb) {
    return { kind: 'NOT_DB', reason: 'supabase-storage-bucket', recvText };
  }
  // `.rpc()` n'a aucun homonyme statique JS, et 14 des 15 appels réels ne sont
  // PAS chaînés (résultat directement await-é). Lui appliquer la règle de
  // chaînage de `.from()` détruirait 14/14 noms de RPC.
  if (method === 'rpc') return { kind: 'DB', reason: 'rpc-call', recvText };
  if (verb) return { kind: 'DB', reason: `postgrest-chain:${verb}`, recvText };
  return { kind: 'UNRESOLVED', reason: 'no-postgrest-chain', recvText };
}

// ---- 1. AST scan of backend/src for .from('x') / .rpc('x') ----------------
function scanCallSites(ts) {
  log('[build-db-usage-map] scanning backend/src for .from() / .rpc() …');
  const files = gitLines(['ls-files', 'backend/src']).filter((f) => /\.tsx?$/.test(f) && !/\.spec\.ts$|\.e2e-spec\.ts$/.test(f));
  const tableUses = new Map();      // table → Set<file>
  const rpcUses = new Map();        // fn → Set<file>
  const dynamicFrom = [];           // { file, line } where .from(<non-literal>) on a DB receiver
  const dynamicRpc = [];
  const unresolved = [];            // { file, line, method, receiver } — ni DB ni NOT_DB
  const dropped = [];               // { name, method, reason, file, line, receiver }

  for (const file of files) {
    let src;
    try { src = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8'); } catch { continue; }
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (node) => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.name)) {
        const method = node.expression.name.text;
        if (method === 'from' || method === 'rpc') {
          const arg0 = node.arguments[0];
          const lineOf = () => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
          const isLiteral = arg0 && (ts.isStringLiteral(arg0) || ts.isNoSubstitutionTemplateLiteral(arg0));
          if (arg0) {
            const { kind, reason, recvText } = classifyCallSite(ts, node, method);
            if (kind === 'NOT_DB') {
              if (isLiteral) dropped.push({ name: arg0.text, method, reason, file, line: lineOf(), receiver: recvText });
            } else if (kind === 'UNRESOLVED') {
              unresolved.push({ file, line: lineOf(), method, receiver: recvText, name: isLiteral ? arg0.text : null });
            } else if (isLiteral) {
              const name = arg0.text;
              const bag = method === 'from' ? tableUses : rpcUses;
              if (!bag.has(name)) bag.set(name, new Set());
              bag.get(name).add(file);
            } else {
              (method === 'from' ? dynamicFrom : dynamicRpc).push({ file, line: lineOf() });
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return { tableUses, rpcUses, dynamicFrom, dynamicRpc, unresolved, dropped, scanned: files.length };
}

// ---- 2. Parse migrations for CREATE/DROP TABLE / FUNCTION / RLS -----------
// Migrations are date-prefixed → sorting filenames ≈ chronological order.
// An object is "currently defined" iff its last CREATE comes after its last DROP
// (or it was never dropped). This filters away objects killed by a later migration
// (ADR-017 RPC cleanup, the -38 tables / -44 RPC cleanup, etc.).
//
// Les regex ci-dessous s'appliquent au SQL DÉPOUILLÉ DE SES COMMENTAIRES
// (`maskComments`, scripts/registry/lib/sql-lex.js), jamais au SQL brut : une
// procédure de rollback documentée en commentaire N'EST PAS du DDL exécuté.
// Sur SQL brut, 20 `DROP TABLE` commentés effaçaient 9 tables réelles (tout le
// système `__seo_r8_*`) et 5 fonctions dont deux de durcissement RLS, et un
// `CREATE TABLE` cité dans un commentaire français fabriquait la table `sont`.
// Les CINQ familles de regex sont dépouillées, pas seulement les tables :
// n'en traiter qu'une partie recréerait l'asymétrie qui a causé le défaut.
function scanMigrations() {
  log('[build-db-usage-map] scanning supabase migrations …');
  const dir = path.join(REPO_ROOT, 'backend', 'supabase', 'migrations');
  const lastCreateTable = new Map(); const lastDropTable = new Map(); const createdInTable = new Map();
  const lastCreateFn = new Map();    const lastDropFn = new Map();    const createdInFn = new Map();
  const rlsTables = new Set();
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort(); } catch { return { tablesInMig: new Map(), rpcInMig: new Map(), rlsTables, scanned: 0 }; }
  const ident = '([A-Za-z_][A-Za-z0-9_$]*|"[^"]+")';
  const SQL_STOPWORDS = new Set(['as', 'if', 'not', 'exists', 'or', 'and', 'on', 'table', 'function', 'select', 'from', 'where', 'with', 'temp', 'temporary', 'unlogged', 'global', 'local', 'cascade', 'restrict', 'returns', 'language', 'trigger', 'public', 'pg_catalog']);
  const norm = (s) => s.replace(/^"|"$/g, '');
  const ok = (s) => s && !SQL_STOPWORDS.has(s.toLowerCase()) && s.length > 1;
  const triggerFns = new Set();
  for (const f of files) {
    let sql;
    try { sql = maskComments(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
    let m;
    const reCreateTable = new RegExp(`create\\s+(?:unlogged\\s+|temp(?:orary)?\\s+)?table\\s+(?:if\\s+not\\s+exists\\s+)?(?:${ident}\\.)?${ident}`, 'gi');
    // `CREATE TEMP/TEMPORARY TABLE … ON COMMIT DROP` est une table de travail
    // interne à une transaction, jamais un objet du schéma : 4 d'entre elles
    // figuraient dans `candidate_orphan_tables`. Le test porte sur m[0] et NON
    // sur un groupe capturant ajouté à la regex — capturer `temp(?:orary)?`
    // décalerait silencieusement m[2] (le nom de table) en m[3]. `UNLOGGED`
    // reste une vraie table et n'est pas concerné.
    while ((m = reCreateTable.exec(sql))) { if (/\bcreate\s+(?:temp|temporary)\b/i.test(m[0])) continue; const t = norm(m[2]); if (!ok(t)) continue; lastCreateTable.set(t, f); if (!createdInTable.has(t)) createdInTable.set(t, new Set()); createdInTable.get(t).add(f); }
    const reDropTable = new RegExp(`drop\\s+table\\s+(?:if\\s+exists\\s+)?(?:${ident}\\.)?${ident}`, 'gi');
    while ((m = reDropTable.exec(sql))) { const t = norm(m[2]); if (ok(t)) lastDropTable.set(t, f); }
    const reCreateFn = new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+(?:${ident}\\.)?${ident}\\s*\\(([\\s\\S]*?)\\)\\s*returns\\s+(\\w+)`, 'gi');
    while ((m = reCreateFn.exec(sql))) { const fn = norm(m[2]); if (!ok(fn)) continue; lastCreateFn.set(fn, f); if (!createdInFn.has(fn)) createdInFn.set(fn, new Set()); createdInFn.get(fn).add(f); if ((m[4] || '').toLowerCase() === 'trigger') triggerFns.add(fn); }
    const reCreateFnNoRet = new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+(?:${ident}\\.)?${ident}\\s*\\(`, 'gi');
    while ((m = reCreateFnNoRet.exec(sql))) { const fn = norm(m[2]); if (!ok(fn)) continue; if (!lastCreateFn.has(fn)) { lastCreateFn.set(fn, f); createdInFn.set(fn, new Set([f])); } }
    const reDropFn = new RegExp(`drop\\s+function\\s+(?:if\\s+exists\\s+)?(?:${ident}\\.)?${ident}`, 'gi');
    while ((m = reDropFn.exec(sql))) { const fn = norm(m[2]); if (ok(fn)) lastDropFn.set(fn, f); }
    const reTrig = new RegExp(`create\\s+(?:or\\s+replace\\s+)?trigger\\s+[\\s\\S]*?execute\\s+(?:function|procedure)\\s+(?:${ident}\\.)?${ident}`, 'gi');
    while ((m = reTrig.exec(sql))) { const fn = norm(m[2]); if (ok(fn)) triggerFns.add(fn); }
    const reRls = new RegExp(`alter\\s+table\\s+(?:${ident}\\.)?${ident}\\s+enable\\s+row\\s+level\\s+security`, 'gi');
    while ((m = reRls.exec(sql))) { const t = norm(m[2]); if (ok(t)) rlsTables.add(t); }
    const rePolicy = new RegExp(`create\\s+policy\\s+[^\\n]*?\\son\\s+(?:${ident}\\.)?${ident}`, 'gi');
    while ((m = rePolicy.exec(sql))) { const t = norm(m[2]); if (ok(t)) rlsTables.add(t); }
  }
  const liveTables = new Map();
  for (const [t, lastC] of lastCreateTable) { const lastD = lastDropTable.get(t); if (!lastD || lastC > lastD) liveTables.set(t, [...createdInTable.get(t)].sort()); }
  const liveFns = new Map();
  for (const [fn, lastC] of lastCreateFn) { const lastD = lastDropFn.get(fn); if (!lastD || lastC > lastD) liveFns.set(fn, [...(createdInFn.get(fn) || [])].sort()); }
  return { tablesInMig: liveTables, rpcInMig: liveFns, rlsTables, triggerFns, scanned: files.length };
}

// ---- 3. Knowledge/db references (best-effort) -----------------------------
function scanKnowledgeDb() {
  const dir = path.join(REPO_ROOT, '.claude', 'knowledge', 'db');
  const refs = new Set();
  try {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md'))) {
      const txt = fs.readFileSync(path.join(dir, f), 'utf8');
      for (const m of txt.matchAll(/`([a-z_][a-z0-9_]{2,})`/gi)) refs.add(m[1]);
    }
  } catch { /* dir may not exist */ }
  return refs;
}

// ---------------------------------------------------------------------------
function main() {
  const ts = require('typescript');
  const cs = scanCallSites(ts);
  const mig = scanMigrations();
  const kbRefs = scanKnowledgeDb();

  // ---- tables ----
  // Un `.from()` dont le récepteur n'a pu être ni prouvé DB ni rejeté reste
  // VISIBLE (unresolved_callsites) et, s'il porte un littéral, INTERDIT le
  // verdict d'orphelinat sur ce nom : sans cela le filet serait décoratif,
  // et une table vivante pourrait être déclarée orpheline en silence.
  const unresolvedNames = new Set(cs.unresolved.filter((u) => u.name).map((u) => u.name));
  const tableNames = new Set([...cs.tableUses.keys(), ...mig.tablesInMig.keys()]);
  const tables = {};
  const candidateOrphanTables = [];
  for (const name of [...tableNames].sort()) {
    const usedBy = [...(cs.tableUses.get(name) || [])].sort();
    const inMig = [...(mig.tablesInMig.get(name) || [])].sort();
    const rls = mig.rlsTables.has(name);
    const inKb = kbRefs.has(name);
    tables[name] = { used_by: usedBy, used_by_count: usedBy.length, in_migrations: inMig, rls_present: rls, in_knowledge_db: inKb };
    if (usedBy.length === 0 && !unresolvedNames.has(name) && (inMig.length > 0 || inKb)) {
      // always "low" for tables: there are hundreds of dynamic `.from(<var>)` callsites
      // in the backend, so a literal-only scan cannot honestly claim a table is unused.
      const derived = []; if (inMig.length) derived.push('migrations'); if (inKb) derived.push('knowledge-db'); derived.push('no-literal-from-callsite');
      candidateOrphanTables.push({ name, confidence: 'low', derived_from: derived, rls_present: rls, in_migrations: inMig, in_knowledge_db: inKb, caveats: ORPHAN_TABLE_CAVEATS });
    }
  }

  // ---- rpc / functions ----
  const rpcNames = new Set([...cs.rpcUses.keys(), ...mig.rpcInMig.keys()]);
  const rpc = {};
  const candidateOrphanRpc = [];
  const triggerFunctions = [];
  for (const name of [...rpcNames].sort()) {
    const calledBy = [...(cs.rpcUses.get(name) || [])].sort();
    const inMig = [...(mig.rpcInMig.get(name) || [])].sort();
    const isTrigger = mig.triggerFns.has(name);
    rpc[name] = { called_by: calledBy, called_by_count: calledBy.length, defined_in_migrations: inMig, is_trigger_function: isTrigger };
    if (isTrigger) { if (inMig.length) triggerFunctions.push({ name, defined_in_migrations: inMig }); continue; } // triggers are invoked by CREATE TRIGGER, never via .rpc()
    if (calledBy.length === 0 && inMig.length > 0) {
      // never "high": an RPC may be called by another function/RPC or the dashboard.
      candidateOrphanRpc.push({ name, confidence: 'medium', derived_from: ['migrations', 'no-rpc-callsite'], defined_in_migrations: inMig, caveats: ORPHAN_RPC_CAVEATS });
    }
  }

  const out = {
    _generated_by: GENERATED_BY,
    note: 'Candidates only — never a "dead" verdict. A real DROP table/function goes through the RPC Gate + a vault ADR, never from this map.',
    important_caveats: [
      `${cs.dynamicFrom.length} \`.from(<non-literal>)\` callsites exist in backend/src — a literal-only scan UNDER-counts table usage; treat candidate_orphan_tables as "needs manual check", not "dead".`,
      'Migration parsing is regex-based and tracks last CREATE vs last DROP per object (date-prefixed filenames ≈ chronological); re-create-after-drop edge cases may slip through.',
      'RLS-only / dashboard / external-cron / RPC-internal usage is invisible here — see per-candidate caveats.',
      `${cs.dropped.length} call-site(s) écarté(s) : le récepteur n'est pas un client PostgREST (Buffer/Array, ou bucket Supabase Storage) — voir dropped_call_sites[].`,
      `${cs.unresolved.length} call-site(s) non résolu(s) : récepteur ni prouvé DB ni rejeté — voir unresolved_callsites[]. Un nom non résolu ne peut pas être déclaré orphelin.`,
    ],
    summary: {
      tables_seen: Object.keys(tables).length,
      tables_with_callsites: Object.values(tables).filter((t) => t.used_by_count > 0).length,
      candidate_orphan_tables: candidateOrphanTables.length,
      rpc_seen: Object.keys(rpc).length,
      rpc_with_callsites: Object.values(rpc).filter((r) => r.called_by_count > 0).length,
      trigger_functions: triggerFunctions.length,
      candidate_orphan_rpc: candidateOrphanRpc.length,
      dynamic_from_callsites: cs.dynamicFrom.length,
      dynamic_rpc_callsites: cs.dynamicRpc.length,
      unresolved_callsites: cs.unresolved.length,
      dropped_call_sites: cs.dropped.length,
      migrations_scanned: mig.scanned,
      backend_files_scanned: cs.scanned,
    },
    tables,
    rpc,
    trigger_functions: triggerFunctions.sort((a, b) => cmpStr(a.name, b.name)),
    candidate_orphan_tables: candidateOrphanTables,
    candidate_orphan_rpc: candidateOrphanRpc,
    dynamic_from_callsites: cs.dynamicFrom.slice().sort((a, b) => cmpStr(a.file, b.file) || a.line - b.line),
    dynamic_rpc_callsites: cs.dynamicRpc.slice().sort((a, b) => cmpStr(a.file, b.file) || a.line - b.line),
    // Noms écartés parce que le récepteur n'est PAS un client PostgREST.
    // Publier la liste rend l'exclusion auditable : on voit ce qui a été
    // retiré et pourquoi, au lieu d'un silence (guardrails, passe 5).
    dropped_call_sites: cs.dropped.slice().sort((a, b) => cmpStr(a.file, b.file) || a.line - b.line),
    // Ni prouvé DB, ni rejeté. Doit rester VIDE ; une entrée n'est pas un
    // seuil à assouplir mais un cas à traiter (cf. important_caveats).
    unresolved_callsites: cs.unresolved.slice().sort((a, b) => cmpStr(a.file, b.file) || a.line - b.line),
  };
  const dest = path.join(REPO_ROOT, 'audit', 'db-usage-map.json');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');
  log(`[build-db-usage-map] wrote audit/db-usage-map.json`);
  log('');
  log('=== db-usage-map summary ===');
  for (const [k, v] of Object.entries(out.summary)) log(`  ${k.padEnd(26)}: ${v}`);
}

// Seam — même patron que build-deep-inventory.js:760. Sans lui, `require()` de ce
// module EXÉCUTE main() et RÉÉCRIT audit/db-usage-map.json : c'est la raison pour
// laquelle ce générateur était le seul de scripts/audit/ sans test.
if (require.main === module) {
  if (!fs.existsSync(path.join(REPO_ROOT, 'backend', 'supabase'))) die('must run from repo root (backend/supabase not found)');
  main();
}

module.exports = { scanCallSites, scanMigrations, classifyCallSite, JS_STATIC_FROM_OWNERS, POSTGREST_VERBS };
