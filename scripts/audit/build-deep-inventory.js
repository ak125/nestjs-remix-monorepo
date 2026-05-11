#!/usr/bin/env node
/**
 * build-deep-inventory.js — PR-0a of the monorepo deep-audit (Phase 0.9).
 *
 * Produces a *verifiable map* of the codebase: runtime entrypoints, import graph,
 * module boundaries, cycles, duplicate exports, dynamic imports, and dead-code
 * candidates. **Generates artefacts only — deletes nothing, changes no behaviour.**
 *
 * Data sources (no naive grep for structural analysis):
 *   - dependency-cruiser (--output-type json)  → AST import graph (static + dynamic),
 *                                                 orphans, no-deep-module-access violations
 *   - madge (programmatic)                      → circular dependencies
 *   - knip (--reporter json)                    → unused files / exports / types / duplicates
 *   - TypeScript compiler API (`typescript`)   → NestJS decorators (class↔file), @Module()
 *                                                 arrays (DI reachability), Remix loader/action exports
 *   - git ls-files / git log                    → file enumeration, last-modified (deterministic)
 *   - static tables                             → domain routing, never-auto-delete zone, devops paths
 *
 * Outputs (1 cache + 6 versioned):
 *   audit/cache/codebase-inventory.json   (gitignored — the big churny cache the rest derives from)
 *   audit/runtime-entrypoints.json        (versioned)
 *   audit/module-boundaries.json          (versioned)
 *   audit/dead-code-candidates.json       (versioned)
 *   audit/duplicate-map.json              (versioned)
 *   audit/cycle-map.json                  (versioned)
 *   audit/dynamic-import-edges.json       (versioned)
 *
 * Determinism: every array is sorted by a stable key; no timestamps in the output.
 * Re-running on the same checkout produces byte-identical files.
 *
 * Usage:  node scripts/audit/build-deep-inventory.js [--quiet]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const AUDIT_DIR = path.join(REPO_ROOT, 'audit');
const CACHE_DIR = path.join(AUDIT_DIR, 'cache');
const QUIET = process.argv.includes('--quiet');
const GENERATED_BY = 'scripts/audit/build-deep-inventory.js';

function log(...a) { if (!QUIET) process.stderr.write(a.join(' ') + '\n'); }
function die(msg) { process.stderr.write(`[build-deep-inventory] ERROR: ${msg}\n`); process.exit(1); }

function rel(p) { return path.relative(REPO_ROOT, path.resolve(REPO_ROOT, p)).split(path.sep).join('/'); }

// ---------------------------------------------------------------------------
// 1. Static configuration: domain routing, never-auto-delete zone, devops paths
// ---------------------------------------------------------------------------

// Ordered: first match wins. Keep specific before generic.
const DOMAIN_RULES = [
  [/^backend\/src\/modules\/rm\//, 'dev-only'],
  [/^backend\/src\/modules\/([^/]+)\//, (m) => m[1]],          // each module dir = its own domain
  [/^backend\/src\/modules\/([^/]+)\.module\.ts$/, (m) => m[1]],
  [/^backend\/src\/auth\//, 'auth'],
  [/^backend\/src\/workers\//, 'workers'],
  [/^backend\/src\/config\//, 'config'],
  [/^backend\/src\/common\//, 'common'],
  [/^backend\/src\/database\//, 'database'],
  [/^backend\/src\/cache\//, 'cache'],
  [/^backend\/src\/shared\//, 'shared'],
  [/^backend\/src\//, 'backend-core'],
  [/^backend\/scripts\//, 'scripts'],
  [/^backend\/supabase\//, 'database'],
  [/^frontend\/app\/routes\//, 'frontend-routes'],
  [/^frontend\/app\//, 'frontend-shared'],
  [/^packages\/seo-roles\//, 'seo'],
  [/^packages\/seo-role-contracts\//, 'seo'],
  [/^packages\/([^/]+)\//, (m) => 'pkg-' + m[1]],
  [/^scripts\/seo\//, 'seo'],
  [/^scripts\/wiki\//, 'wiki'],
  [/^scripts\//, 'scripts'],
  [/^\.github\/workflows\//, 'ci-cd'],
  [/^docker\//, 'ci-cd'],
  [/^\.husky\//, 'ci-cd'],
  [/^shared\//, 'shared'],
];

function routeDomain(p) {
  for (const [re, to] of DOMAIN_RULES) {
    const m = p.match(re);
    if (m) return typeof to === 'function' ? to(m) : to;
  }
  return 'uncategorized';
}

// Files/dirs that must NEVER be auto-deleted, even if the audit thinks them dead.
// Glob-ish: `**` = any path segments, `*` = any chars within a segment.
const NEVER_AUTO_DELETE = [
  'frontend/app/routes/**',
  'backend/src/workers/**',
  'backend/supabase/migrations/**',
  '.github/workflows/**',
  'docker/**',
  'packages/seo-roles/**',
  'packages/seo-role-contracts/**',
  'backend/src/main.ts',
  'backend/src/main.server.ts',
  'backend/src/app.module.ts',
  'backend/src/workers/worker.module.ts',
  'frontend/app/entry.client.tsx',
  'frontend/app/entry.server.tsx',
  'frontend/app/root.tsx',
];

function globToRegExp(g) {
  // escape regex metachars, then expand globs: ** -> .* (any chars incl. /), * -> [^/]* (within a segment).
  const re = g
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*?/g, (m) => (m === '**' ? '.*' : '[^/]*'));
  return new RegExp('^' + re + '$');
}
const NEVER_RE = NEVER_AUTO_DELETE.map(globToRegExp);
function isNeverAutoDelete(p) { return NEVER_RE.some((re) => re.test(p)); }

// Roots whose every tracked file is, by construction, a runtime entrypoint / config surface.
const RUNTIME_GLOBS = [
  'frontend/app/routes/**',
  'backend/supabase/migrations/**',
  '.github/workflows/**',
  '.husky/**',
  'docker/**',
];
const RUNTIME_RE = RUNTIME_GLOBS.map(globToRegExp);

const APP_ENTRY_FILES = [
  'backend/src/main.ts',
  'backend/src/main.server.ts',
  'backend/src/app.module.ts',
  'backend/src/workers/main.ts',
  'backend/src/workers/worker.module.ts',
  'frontend/app/entry.client.tsx',
  'frontend/app/entry.server.tsx',
  'frontend/app/root.tsx',
  'frontend/app/routes.ts',
  'frontend/server.js',
];

const ROOT_MODULE_FILES = [
  'backend/src/app.module.ts',
  'backend/src/workers/worker.module.ts',
];

// File extensions we treat as "source" for the inventory.
const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);
const TS_EXT = new Set(['.ts', '.tsx']);

// ---------------------------------------------------------------------------
// 2. Helpers: git enumeration, last-modified, exec
// ---------------------------------------------------------------------------

function gitLines(args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
    .split('\n').filter(Boolean);
}

function listTrackedSourceFiles() {
  return gitLines(['ls-files'])
    .filter((f) => SOURCE_EXT.has(path.extname(f)))
    .filter((f) => !f.includes('/node_modules/'))
    .filter((f) => !/(^|\/)dist\//.test(f))
    .filter((f) => !/(^|\/)build\//.test(f))
    .filter((f) => !/\.d\.ts$/.test(f))
    .sort();
}

/** Single `git log` walk → most-recent commit ISO date per file (deterministic). */
function lastModifiedMap() {
  const out = execFileSync(
    'git',
    ['log', '--no-renames', '--format=__C__%cI', '--name-only'],
    { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 },
  );
  const map = new Map();
  let cur = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('__C__')) { cur = line.slice(5); continue; }
    if (!line || !cur) continue;
    if (!map.has(line)) map.set(line, cur); // first occurrence = most recent commit (git log is newest-first)
  }
  return map;
}

function runJson(cmd, args, label) {
  log(`[build-deep-inventory] running ${label}…`);
  // stderr is *evidence*, not noise: capture it, tee it to audit/cache/tool-<label>.stderr.log
  // (gitignored, but published as a CI artefact), echo it to our own stderr, and fold it
  // into the failure message. An audit pipeline that silently eats a tool's stderr can't be
  // trusted to explain its own false positives / negatives.
  const slug = label.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase();
  let stdout = '';
  let stderr = '';
  let failure = null;
  try {
    stdout = execFileSync(cmd, args, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    // many of these tools exit non-zero when they find issues — keep stdout/stderr
    stdout = (e.stdout || '').toString();
    stderr = (e.stderr || '').toString();
    failure = e;
  }
  try { fs.mkdirSync(CACHE_DIR, { recursive: true }); fs.writeFileSync(path.join(CACHE_DIR, `tool-${slug}.stderr.log`), stderr); } catch { /* best effort */ }
  if (stderr.trim()) log(`[build-deep-inventory] ${label} stderr:\n${stderr.trimEnd()}`);
  const tail = stderr.trim() ? `\n--- ${label} stderr ---\n${stderr.trimEnd()}` : '';
  if (!stdout) die(`${label} produced no output${failure ? ` (exit ${failure.status ?? '?'}): ${failure.message}` : ''}${tail}`);
  try { return JSON.parse(stdout); }
  catch (e) { die(`${label} did not return valid JSON: ${e.message}${tail}`); }
}

// ---------------------------------------------------------------------------
// 3. Source: dependency-cruiser JSON (import graph, orphans, deep-access)
// ---------------------------------------------------------------------------

function loadDepcruise() {
  const j = runJson(
    'npx',
    ['--no-install', 'depcruise', '--config', '.dependency-cruiser.cjs', '--output-type', 'json', 'backend/src', 'frontend/app'],
    'dependency-cruiser',
  );
  const imports = new Map();        // path → Set<path> (static)
  const dynImports = new Map();     // path → Set<path>
  const importedBy = new Map();
  const orphans = new Set();
  for (const mod of j.modules || []) {
    const src = mod.source;
    if (mod.orphan) orphans.add(src);
    for (const dep of mod.dependencies || []) {
      const to = dep.resolved;
      if (!to || to.includes('node_modules')) continue;
      if (dep.dynamic) {
        if (!dynImports.has(src)) dynImports.set(src, new Set());
        dynImports.get(src).add(to);
      } else {
        if (!imports.has(src)) imports.set(src, new Set());
        imports.get(src).add(to);
        if (!importedBy.has(to)) importedBy.set(to, new Set());
        importedBy.get(to).add(src);
      }
    }
  }
  // Architectural violations come from the canonical summary list.
  const deepAccess = [];            // { from, to, rule }
  const orphanViolations = [];
  for (const v of (j.summary && j.summary.violations) || []) {
    const name = v.rule && v.rule.name;
    if (name === 'no-deep-module-access') deepAccess.push({ from: v.from, to: v.to, rule: name });
    if (name === 'no-orphans') { orphanViolations.push(v.from || v.to); orphans.add(v.from || v.to); }
  }
  return { imports, dynImports, importedBy, orphans, deepAccess, orphanViolations, moduleCount: (j.modules || []).length };
}

// ---------------------------------------------------------------------------
// 4. Source: madge → cycles
// ---------------------------------------------------------------------------

async function loadCycles() {
  log('[build-deep-inventory] running madge (cycles)…');
  const madge = require('madge');
  const res = await madge(['backend/src', 'frontend/app'], {
    baseDir: REPO_ROOT,
    fileExtensions: ['ts', 'tsx'],
    detectiveOptions: { ts: { skipTypeImports: false } },
  });
  return res.circular().map((cycle) => cycle.map((p) => p.split(path.sep).join('/')));
}

// ---------------------------------------------------------------------------
// 5. Source: knip → unused files / exports / types / duplicates
// ---------------------------------------------------------------------------

function loadKnip() {
  const j = runJson('npx', ['--no-install', 'knip', '--reporter', 'json', '--no-exit-code'], 'knip');
  const unusedFiles = new Set();
  const duplicates = [];
  const unusedExports = [];
  const unusedTypes = [];
  for (const issue of j.issues || []) {
    for (const f of issue.files || []) unusedFiles.add(typeof f === 'string' ? f : f.name);
    for (const d of issue.duplicates || []) {
      const names = Array.isArray(d) ? d.map((x) => (typeof x === 'string' ? x : x.name)) : [(d && d.name) || String(d)];
      duplicates.push({ path: issue.file, names: names.sort() });
    }
    for (const e of issue.exports || []) unusedExports.push({ path: issue.file, name: typeof e === 'string' ? e : e.name });
    for (const t of issue.types || []) unusedTypes.push({ path: issue.file, name: typeof t === 'string' ? t : t.name });
  }
  return { unusedFiles, duplicates, unusedExports, unusedTypes };
}

// ---------------------------------------------------------------------------
// 6. Source: TypeScript AST — NestJS decorators, @Module() arrays, Remix loaders
// ---------------------------------------------------------------------------

const NEST_CLASS_DECORATORS = new Set(['Injectable', 'Controller', 'Module', 'Global', 'Catch', 'WebSocketGateway']);
const NEST_PROCESSOR_DECORATORS = new Set(['Processor']);

function decoratorName(node, ts) {
  let expr = node.expression;
  if (ts.isCallExpression(expr)) expr = expr.expression;
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
  return null;
}

/**
 * Parse every tracked .ts/.tsx file once:
 *  - classByName: className → file (only classes carrying a NestJS class decorator)
 *  - processorClasses: Set<className> with @Processor
 *  - moduleArrays: file → { imports:[ids], providers:[ids], controllers:[ids], exports:[ids] }  (for *.module.ts)
 *  - remixLoaderActionFiles: Set<file> under frontend/app/routes/** exporting loader/action
 */
function scanTypeScript(files, ts) {
  log('[build-deep-inventory] parsing TypeScript AST…');
  const classByName = new Map();
  const processorClasses = new Set();
  const moduleArrays = new Map();
  const remixLoaderActionFiles = new Set();

  const collectIdentifiers = (arrNode) => {
    const ids = [];
    if (arrNode && ts.isArrayLiteralExpression(arrNode)) {
      for (const el of arrNode.elements) {
        if (ts.isIdentifier(el)) {
          ids.push(el.text);
        } else if (ts.isCallExpression(el) && ts.isPropertyAccessExpression(el.expression) && ts.isIdentifier(el.expression.expression)) {
          ids.push(el.expression.expression.text); // SomeModule.forRoot() / .register()
        } else if (ts.isCallExpression(el) && ts.isIdentifier(el.expression) && el.expression.text === 'forwardRef') {
          const arg = el.arguments[0];
          if (arg && ts.isArrowFunction(arg) && ts.isIdentifier(arg.body)) ids.push(arg.body.text); // forwardRef(() => X)
        } else if (ts.isObjectLiteralExpression(el)) {
          for (const prop of el.properties) {                                                        // { provide: X, useClass|useExisting: Y }
            if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && /^use(Class|Existing)$/.test(prop.name.text) && ts.isIdentifier(prop.initializer)) ids.push(prop.initializer.text);
          }
        }
      }
    }
    return ids;
  };

  for (const file of files) {
    if (!TS_EXT.has(path.extname(file))) continue;
    let src;
    try { src = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8'); } catch { continue; }
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, /*setParentNodes*/ true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const isRoute = file.startsWith('frontend/app/routes/');

    const visit = (node) => {
      // class declarations with NestJS decorators
      if (ts.isClassDeclaration(node) && node.name) {
        const decos = ts.getDecorators ? (ts.getDecorators(node) || []) : (node.decorators || []);
        for (const d of decos) {
          const name = decoratorName(d, ts);
          if (!name) continue;
          if (NEST_CLASS_DECORATORS.has(name) || NEST_PROCESSOR_DECORATORS.has(name)) {
            classByName.set(node.name.text, file);
          }
          if (NEST_PROCESSOR_DECORATORS.has(name)) processorClasses.add(node.name.text);
          if (name === 'Module') {
            const call = d.expression;
            if (ts.isCallExpression(call) && call.arguments[0] && ts.isObjectLiteralExpression(call.arguments[0])) {
              const obj = call.arguments[0];
              const entry = { imports: [], providers: [], controllers: [], exports: [] };
              for (const prop of obj.properties) {
                if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && entry[prop.name.text]) {
                  entry[prop.name.text] = collectIdentifiers(prop.initializer);
                }
              }
              moduleArrays.set(file, entry);
            }
          }
        }
      }
      // Remix loader/action exports
      if (isRoute && ts.isVariableStatement(node) && (node.modifiers || []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name) && /^(loader|action|clientLoader|clientAction)$/.test(decl.name.text)) remixLoaderActionFiles.add(file);
        }
      }
      if (isRoute && ts.isFunctionDeclaration(node) && node.name && /^(loader|action)$/.test(node.name.text) && (node.modifiers || []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
        remixLoaderActionFiles.add(file);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return { classByName, processorClasses, moduleArrays, remixLoaderActionFiles };
}

/**
 * Reachable NestJS modules = BFS from the root modules over the *resolved* import graph,
 * following edges that land on a `*.module.ts` file (handles aliased imports, `forwardRef`,
 * `.forRoot()`/`.register()` — depcruise still records the underlying import statement).
 * DI-live class names = providers/controllers/exports declared in any reachable module's
 * `@Module({...})`. DI-live files = the declaring files of those classes + every module file.
 */
function resolveDiLive(moduleArrays, classByName, depImports) {
  const isModuleFile = (f) => /\.module\.tsx?$/.test(f);
  const reachableModuleFiles = new Set();
  const queue = [];
  for (const rf of ROOT_MODULE_FILES) { if (moduleArrays.has(rf)) { reachableModuleFiles.add(rf); queue.push(rf); } }
  while (queue.length) {
    const f = queue.shift();
    for (const dep of depImports.get(f) || []) {
      if (isModuleFile(dep) && !reachableModuleFiles.has(dep)) { reachableModuleFiles.add(dep); queue.push(dep); }
    }
  }
  const diLiveClassNames = new Set();
  for (const f of reachableModuleFiles) {
    const entry = moduleArrays.get(f);
    if (!entry) continue;
    for (const k of ['providers', 'controllers', 'exports', 'imports']) for (const id of entry[k]) diLiveClassNames.add(id);
  }
  const diLiveFiles = new Set();
  for (const name of diLiveClassNames) { const f = classByName.get(name); if (f) diLiveFiles.add(f); }
  for (const f of moduleArrays.keys()) diLiveFiles.add(f); // every @Module file is an entrypoint
  return { reachableModuleFiles, diLiveClassNames, diLiveFiles };
}

// ---------------------------------------------------------------------------
// 7. DevOps surface: package.json scripts/bin, ci workflows, husky, docker
// ---------------------------------------------------------------------------

function devopsSurface(allTracked) {
  const scriptsReferenced = new Set();
  const pkgPaths = allTracked.filter((f) => f === 'package.json' || /\/package\.json$/.test(f));
  for (const pp of pkgPaths) {
    let pkg;
    try { pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, pp), 'utf8')); } catch { continue; }
    const blobs = [];
    if (pkg.scripts) blobs.push(...Object.values(pkg.scripts));
    if (pkg.bin) blobs.push(...(typeof pkg.bin === 'string' ? [pkg.bin] : Object.values(pkg.bin)));
    for (const blob of blobs) {
      for (const f of allTracked) {
        if (typeof blob === 'string' && blob.includes(f)) scriptsReferenced.add(f);
      }
    }
  }
  const ciWorkflows = allTracked.filter((f) => f.startsWith('.github/workflows/'));
  const huskyHooks = allTracked.filter((f) => f.startsWith('.husky/') && !f.includes('/_/'));
  const dockerFiles = allTracked.filter((f) => f.startsWith('docker/') || /(^|\/)Dockerfile/.test(f));
  return { scriptsReferenced: [...scriptsReferenced].sort(), ciWorkflows: ciWorkflows.sort(), huskyHooks: huskyHooks.sort(), dockerFiles: dockerFiles.sort() };
}

// ---------------------------------------------------------------------------
// 8. Assemble + write artefacts
// ---------------------------------------------------------------------------

function writeJson(absPath, obj) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, JSON.stringify(obj, null, 2) + '\n');
  log(`[build-deep-inventory] wrote ${rel(absPath)}`);
}

function sortByPath(arr, key = 'path') { return arr.slice().sort((a, b) => String(a[key]).localeCompare(String(b[key]))); }

async function main() {
  if (!fs.existsSync(path.join(REPO_ROOT, '.dependency-cruiser.cjs'))) die('must run from repo root (.dependency-cruiser.cjs not found)');
  const ts = require('typescript');

  const allTracked = gitLines(['ls-files']).filter((f) => !f.includes('/node_modules/'));
  const sourceFiles = listTrackedSourceFiles();
  const lm = lastModifiedMap();
  const dc = loadDepcruise();
  const cycles = await loadCycles();
  const knip = loadKnip();
  const astTs = scanTypeScript(sourceFiles, ts);
  const di = resolveDiLive(astTs.moduleArrays, astTs.classByName, dc.imports);
  const devops = devopsSurface(allTracked);

  // ---- file kind classification ------------------------------------------
  function classifyKind(f) {
    if (/\.spec\.ts$|\.e2e-spec\.ts$|\.test\.tsx?$|\/__tests__\//.test(f)) return 'test';
    if (f.endsWith('.module.ts')) return 'module';
    if (f.endsWith('.controller.ts')) return 'controller';
    if (f.endsWith('.service.ts')) return 'service';
    if (f.endsWith('.guard.ts')) return 'guard';
    if (f.endsWith('.pipe.ts')) return 'pipe';
    if (f.endsWith('.interceptor.ts')) return 'interceptor';
    if (f.endsWith('.dto.ts')) return 'dto';
    if (f.endsWith('.schema.ts')) return 'schema';
    if (f.endsWith('.constants.ts') || f.endsWith('.config.ts')) return 'config';
    if (f.endsWith('.types.ts') || f.endsWith('.d.ts')) return 'type';
    if (f.startsWith('frontend/app/routes/')) return 'route';
    if (f.startsWith('frontend/app/components/')) return 'component';
    if (f.startsWith('frontend/app/hooks/')) return 'hook';
    if (f.startsWith('frontend/app/services/') || /\.(api|server)\.tsx?$/.test(f)) return 'frontend-service';
    if (f.startsWith('scripts/') || f.startsWith('backend/scripts/')) return 'script';
    return 'other';
  }

  // ---- runtime entrypoints -----------------------------------------------
  const runtimeFiles = new Set();
  for (const f of sourceFiles) if (RUNTIME_RE.some((re) => re.test(f))) runtimeFiles.add(f);
  for (const f of allTracked) if (RUNTIME_RE.some((re) => re.test(f))) runtimeFiles.add(f);
  for (const f of APP_ENTRY_FILES) if (allTracked.includes(f)) runtimeFiles.add(f);
  for (const f of di.diLiveFiles) runtimeFiles.add(f);
  for (const f of astTs.remixLoaderActionFiles) runtimeFiles.add(f);
  for (const f of devops.scriptsReferenced) runtimeFiles.add(f);
  for (const f of devops.ciWorkflows) runtimeFiles.add(f);
  for (const f of devops.huskyHooks) runtimeFiles.add(f);
  for (const f of devops.dockerFiles) runtimeFiles.add(f);
  // processor classes → files
  for (const [className, file] of astTs.classByName) if (astTs.processorClasses.has(className)) runtimeFiles.add(file);

  // ---- codebase inventory (the cache) ------------------------------------
  const inventoryFiles = sourceFiles.map((f) => ({
    path: f,
    domain: routeDomain(f),
    kind: classifyKind(f),
    loc: (() => { try { return fs.readFileSync(path.join(REPO_ROOT, f), 'utf8').split('\n').length; } catch { return 0; } })(),
    last_modified: lm.get(f) || null,
    imports: [...(dc.imports.get(f) || [])].sort(),
    imported_by: [...(dc.importedBy.get(f) || [])].sort(),
    dynamic_imports: [...(dc.dynImports.get(f) || [])].sort(),
  }));
  writeJson(path.join(CACHE_DIR, 'codebase-inventory.json'), { _generated_by: GENERATED_BY, _note: 'cache — gitignored — derive the versioned audit/*.json from this', file_count: inventoryFiles.length, files: inventoryFiles });

  // ---- runtime-entrypoints.json ------------------------------------------
  const remixRoutes = sourceFiles.filter((f) => f.startsWith('frontend/app/routes/')).sort();
  const nestModules = [...astTs.moduleArrays.keys()].sort();
  const nestControllers = [...astTs.classByName.entries()].filter(([n]) => di.diLiveClassNames.has(n)).map(([, f]) => f).filter((f) => f.endsWith('.controller.ts')).sort();
  writeJson(path.join(AUDIT_DIR, 'runtime-entrypoints.json'), {
    _generated_by: GENERATED_BY,
    never_auto_delete_globs: NEVER_AUTO_DELETE.slice().sort(),
    entrypoints: {
      app_entries: APP_ENTRY_FILES.filter((f) => allTracked.includes(f)).sort(),
      remix_routes: remixRoutes,
      remix_loader_action_files: [...astTs.remixLoaderActionFiles].sort(),
      nestjs_modules: nestModules,
      nestjs_reachable_modules: [...di.reachableModuleFiles].sort(),
      // Module files NOT reachable from app.module.ts / worker.module.ts — review:
      // either genuinely unwired (dead subtree → candidates for PR-2/PR-3) or loaded
      // via a mechanism this scanner does not follow. Their declaring module file is
      // still kept (never flagged), but their providers may surface as candidates.
      nestjs_unreachable_modules: nestModules.filter((f) => !di.reachableModuleFiles.has(f)).sort(),
      nestjs_controllers: [...new Set(nestControllers)].sort(),
      di_live_classes: [...di.diLiveClassNames].sort(),
      di_live_files: [...di.diLiveFiles].sort(),
      bull_processors: [...astTs.classByName.entries()].filter(([n]) => astTs.processorClasses.has(n)).map(([, f]) => f).sort(),
      supabase_migrations: allTracked.filter((f) => f.startsWith('backend/supabase/migrations/')).sort(),
      ci_workflows: devops.ciWorkflows,
      husky_hooks: devops.huskyHooks,
      docker_files: devops.dockerFiles,
      pkg_referenced_scripts: devops.scriptsReferenced,
    },
    runtime_files_count: runtimeFiles.size,
    runtime_files: [...runtimeFiles].sort(),
  });

  // ---- module-boundaries.json --------------------------------------------
  const byDomain = new Map();
  for (const fi of inventoryFiles) {
    if (!byDomain.has(fi.domain)) byDomain.set(fi.domain, { dirs: new Set(), files_count: 0, loc_total: 0, has_barrel: false });
    const d = byDomain.get(fi.domain);
    d.files_count++; d.loc_total += fi.loc;
    d.dirs.add(fi.path.split('/').slice(0, -1).join('/'));
    if (/(^|\/)index\.tsx?$/.test(fi.path)) d.has_barrel = true;
  }
  const fileDomain = new Map(inventoryFiles.map((fi) => [fi.path, fi.domain]));
  const crossEdges = new Map();
  for (const [from, tos] of dc.imports) {
    const fd = fileDomain.get(from); if (!fd) continue;
    for (const to of tos) { const td = fileDomain.get(to); if (!td || td === fd) continue; const k = fd + ' -> ' + td; crossEdges.set(k, (crossEdges.get(k) || 0) + 1); }
  }
  writeJson(path.join(AUDIT_DIR, 'module-boundaries.json'), {
    _generated_by: GENERATED_BY,
    domains: Object.fromEntries([...byDomain.entries()].sort().map(([k, v]) => [k, { dirs: [...v.dirs].sort(), files_count: v.files_count, loc_total: v.loc_total, has_barrel: v.has_barrel }])),
    cross_domain_edges: [...crossEdges.entries()].map(([k, count]) => { const [from, to] = k.split(' -> '); return { from, to, count }; }).sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to)),
    deep_access_violations: dc.deepAccess.slice().sort((a, b) => String(a.from).localeCompare(b.from) || String(a.to).localeCompare(b.to)),
  });

  // ---- dynamic-import-edges.json -----------------------------------------
  const dynEdges = [];
  for (const [from, tos] of dc.dynImports) for (const to of tos) dynEdges.push({ from, to, kind: 'import()' });
  dynEdges.sort((a, b) => a.from.localeCompare(b.from) || String(a.to).localeCompare(String(b.to)));
  writeJson(path.join(AUDIT_DIR, 'dynamic-import-edges.json'), { _generated_by: GENERATED_BY, count: dynEdges.length, note: dynEdges.length === 0 ? '0 dynamic imports found' : undefined, edges: dynEdges });
  if (dynEdges.length === 0) log('[build-deep-inventory] 0 dynamic imports found');

  // ---- cycle-map.json ----------------------------------------------------
  const cycleEntries = cycles.map((members) => {
    const doms = [...new Set(members.map((m) => routeDomain(m)))];
    return { members: members.slice(), domain: doms.length === 1 ? doms[0] : doms.sort(), suggested_fix: doms.length === 1 ? 'invert-dep' : 'extract-shared-types', priority: members.length };
  }).sort((a, b) => a.members[0].localeCompare(b.members[0]));
  writeJson(path.join(AUDIT_DIR, 'cycle-map.json'), { _generated_by: GENERATED_BY, count: cycleEntries.length, cycles: cycleEntries });

  // ---- duplicate-map.json ------------------------------------------------
  const dupEntries = knip.duplicates.map((d) => ({ path: d.path, names: d.names, domain: routeDomain(d.path), fix: 'collapse-to-named' }));
  writeJson(path.join(AUDIT_DIR, 'duplicate-map.json'), { _generated_by: GENERATED_BY, count: dupEntries.length, duplicates: sortByPath(dupEntries) });

  // ---- dead-code-candidates.json -----------------------------------------
  const candidates = [];
  for (const f of [...knip.unusedFiles].sort()) {
    if (runtimeFiles.has(f)) continue;            // condition #3
    if (isNeverAutoDelete(f)) continue;           // condition #0
    if (di.diLiveFiles.has(f)) continue;          // DI-live
    const domain = routeDomain(f);
    if (domain === 'dev-only') continue;          // rm/ — DEV-only, excluded
    const importedBy = [...(dc.importedBy.get(f) || [])];
    const dynUsed = [...dc.dynImports].some(([, tos]) => tos.has(f));
    const derived = ['knip'];
    if (dc.orphans.has(f)) derived.push('depcruise-orphan');
    if (!importedBy.length && !dynUsed) derived.push('depcruise-no-dependents');
    // confidence: high if no static AND no dynamic importers and depcruise also says orphan; medium otherwise
    let confidence = 'medium';
    if (!importedBy.length && !dynUsed) confidence = (dc.orphans.has(f) ? 'high' : 'medium');
    if (importedBy.length || dynUsed) confidence = 'low';
    candidates.push({
      path: f,
      domain,
      kind: classifyKind(f),
      confidence,
      derived_from: derived,
      precheck_verdict: {
        c0_not_never_auto_delete: !isNeverAutoDelete(f),
        c1_zero_static_import: importedBy.length === 0,
        c2_zero_dynamic_import: !dynUsed,
        c3_zero_runtime_use: !runtimeFiles.has(f),
        // c4 (string refs), c5 (CI/scripts), c6 (DB/cron) are checked by validate-before-delete.sh at delete time
      },
      reason: dc.orphans.has(f) ? 'knip unused + depcruise orphan' : 'knip unused',
    });
  }
  writeJson(path.join(AUDIT_DIR, 'dead-code-candidates.json'), {
    _generated_by: GENERATED_BY,
    note: 'Candidates only. Deletion requires the full conditions (#0–#8) incl. validate-before-delete.sh + build/tests + human review.',
    count: candidates.length,
    by_confidence: { high: candidates.filter((c) => c.confidence === 'high').length, medium: candidates.filter((c) => c.confidence === 'medium').length, low: candidates.filter((c) => c.confidence === 'low').length },
    candidates: sortByPath(candidates),
  });

  // ---- summary -----------------------------------------------------------
  log('');
  log('=== deep-inventory summary ===');
  log(`  source files          : ${sourceFiles.length}`);
  log(`  depcruise modules      : ${dc.moduleCount}`);
  log(`  runtime entrypoints    : ${runtimeFiles.size}`);
  log(`  reachable NestJS mods  : ${di.reachableModuleFiles.size} / ${astTs.moduleArrays.size}`);
  log(`  DI-live files          : ${di.diLiveFiles.size}`);
  log(`  knip unused files      : ${knip.unusedFiles.size}`);
  log(`  dead-code candidates   : ${candidates.length}  (high ${candidates.filter((c) => c.confidence === 'high').length} / med ${candidates.filter((c) => c.confidence === 'medium').length} / low ${candidates.filter((c) => c.confidence === 'low').length})`);
  log(`  cycles                 : ${cycleEntries.length}`);
  log(`  duplicate exports      : ${dupEntries.length}`);
  log(`  dynamic import edges   : ${dynEdges.length}`);
  log(`  deep-access violations : ${dc.deepAccess.length}`);
  log('  artefacts written to audit/ (+ audit/cache/codebase-inventory.json, gitignored)');
}

main().catch((e) => die(e && e.stack ? e.stack : String(e)));
