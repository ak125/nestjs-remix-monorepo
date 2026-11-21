#!/usr/bin/env tsx
/**
 * RPC declared-function ratchet — garde CI (incident #2144, décision 142).
 *
 * POURQUOI : `seo-monitor` appelait `callRpc('get_random_vehicle_gamme_combinations')`,
 * fonction qu'aucune migration du dépôt n'a jamais créée et absente de la base.
 * L'appel échouait, l'erreur était convertie en liste vide, et le job se
 * terminait en succès sans tester une seule page. Aucun contrôle ne voyait le
 * nom : `check-rpc-allowlist-coverage.sh` ne lit que les appels `source: 'api'`,
 * `build-db-usage-map.js` et `rpc-registry-drift.ts` ne lisent que `.rpc(`.
 *
 * CE QUE FAIT LA GARDE : dans `backend/src` (hors tests), elle relève par AST
 * TypeScript chaque nom de fonction passé à :
 *   1. `callRpc(...)` (SupabaseBaseService, RPC Safety Gate) ;
 *   2. `.rpc(...)` (client Supabase direct) ;
 *   3. tout wrapper détecté automatiquement : une fonction ou méthode qui passe
 *      l'un de ses paramètres en premier argument à 1, 2 ou à un autre wrapper
 *      (ex. `invokeRpc(name, params)` de seo-control.service.ts).
 * Le premier argument est résolu s'il est un littéral, une constante locale
 * (`const X = 'nom'`, propriété de classe `readonly X = 'nom'`) ou une entrée
 * d'objet constant (`RPC_MAP.m1`, ou toutes ses valeurs pour `RPC_MAP[k]`).
 * Chaque nom résolu est confronté aux fonctions DÉCLARÉES par
 * `backend/supabase/migrations` — même règle que `build-db-usage-map.js`
 * (`scanMigrations`, réutilisé : dernier CREATE postérieur au dernier DROP,
 * SQL dépouillé de ses commentaires).
 *
 * GEL (modèle des ratchets existants, ex. check-rag-authority-read-ratchet.ts) :
 * les appels déjà dans ce cas, et les appels dont le nom n'est pas résolvable
 * statiquement, sont écrits dans `audit/baselines/rpc-declared-baseline.json`
 * avec leur nombre d'occurrences par fichier. La garde est COUNT-EXACT :
 *   - une clé nouvelle ou un compte en hausse → échec (nom non déclaré ajouté) ;
 *   - un compte en baisse → échec aussi, sauf baseline rafraîchie dans la MÊME
 *     PR (une vraie résorption le fait) : une perte de couverture du détecteur
 *     ne doit jamais passer pour une résorption.
 *
 * LIMITES (écrites, pas cachées) :
 *   - « déclarée par une migration » ≠ « présente en base » : une fonction créée
 *     hors migration (tableau de bord, SQL manuel) apparaît ici comme non
 *     déclarée et figure dans le gel ; l'inverse (migration non appliquée) n'est
 *     pas vu. Le contrôle en base reste `rpc-registry-drift.ts` (rapport seul).
 *   - Un nom calculé à l'exécution est gelé comme site dynamique, jamais
 *     déclaré conforme.
 *   - Les wrappers sont reconnus par leur nom de méthode : deux méthodes
 *     homonymes dans des classes différentes sont confondues.
 *
 * Codes de sortie : 0 = aucune dérive · 1 = dérive (bloquant) · 2 = invariant
 * (baseline absente, analyse en échec). `--refresh` est RÉSERVÉ AU MAINTENEUR,
 * jamais appelé par la CI. `--json` affiche l'état courant.
 */
import { createRequire } from "node:module";
import {
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join, relative, sep } from "node:path";
import * as ts from "typescript";

const require = createRequire(import.meta.url);
const { scanMigrations } = require("./build-db-usage-map.js") as {
  scanMigrations: (dir?: string) => { rpcInMig: Map<string, string[]> };
};

const REPO_ROOT = process.cwd();
const BACKEND_SRC = join(REPO_ROOT, "backend/src");
const MIGRATIONS_DIR = join(REPO_ROOT, "backend/supabase/migrations");
const BASELINE_PATH = join(
  REPO_ROOT,
  "audit/baselines/rpc-declared-baseline.json",
);

/** Appels RPC de base : nom de méthode → index de l'argument portant le nom. */
export const BASE_RPC_CALLEES: Readonly<Record<string, number>> = {
  callRpc: 0,
  rpc: 0,
};

/** Clé de gel d'un site dont le nom n'est pas résolvable statiquement. */
export const DYNAMIC = "<dynamic>";

export interface SourceFile {
  /** Chemin relatif au dépôt, séparateur `/`. */
  path: string;
  text: string;
}

export interface RpcSite {
  file: string;
  line: number;
  callee: string;
  /** Noms résolus ; vide si le premier argument n'est pas résolvable. */
  names: string[];
  expr: string;
}

// ── Résolution des constantes d'un fichier ──────────────────────────────────

interface FileConsts {
  strings: Map<string, string>;
  objects: Map<string, Map<string, string>>;
  /** `const x = RPC_MAP[k]` : alias résolu à travers son initialiseur. */
  aliases: Map<string, ts.Expression>;
}

function stringValue(node: ts.Expression | undefined): string | null {
  if (!node) return null;
  let n: ts.Expression = node;
  while (
    ts.isAsExpression(n) ||
    ts.isParenthesizedExpression(n) ||
    ts.isSatisfiesExpression(n)
  ) {
    n = n.expression;
  }
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n))
    return n.text;
  return null;
}

function objectValues(
  node: ts.Expression | undefined,
): Map<string, string> | null {
  if (!node) return null;
  let n: ts.Expression = node;
  while (
    ts.isAsExpression(n) ||
    ts.isParenthesizedExpression(n) ||
    ts.isSatisfiesExpression(n)
  ) {
    n = n.expression;
  }
  if (!ts.isObjectLiteralExpression(n)) return null;
  const out = new Map<string, string>();
  for (const p of n.properties) {
    if (!ts.isPropertyAssignment(p)) return null;
    const key =
      ts.isIdentifier(p.name) ||
      ts.isStringLiteral(p.name) ||
      ts.isNumericLiteral(p.name)
        ? p.name.text
        : null;
    const value = stringValue(p.initializer);
    if (key === null || value === null) return null;
    out.set(key, value);
  }
  return out.size > 0 ? out : null;
}

/**
 * Constantes d'un fichier, indexées par nom sans tenir compte de la portée.
 * Un nom déclaré plusieurs fois dans le fichier est ambigu : il est retiré,
 * et ses sites restent non résolus (gelés), jamais devinés.
 */
function collectConsts(sf: ts.SourceFile): FileConsts {
  const strings = new Map<string, string>();
  const objects = new Map<string, Map<string, string>>();
  const aliases = new Map<string, ts.Expression>();
  const seen = new Map<string, number>();
  const record = (key: string, init: ts.Expression | undefined): void => {
    seen.set(key, (seen.get(key) ?? 0) + 1);
    const s = stringValue(init);
    const o = objectValues(init);
    if (s !== null) strings.set(key, s);
    else if (o) objects.set(key, o);
    else if (init) aliases.set(key, init);
  };
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      ts.isVariableDeclarationList(node.parent) &&
      (node.parent.flags & ts.NodeFlags.Const) !== 0
    ) {
      record(node.name.text, node.initializer);
    }
    if (
      ts.isPropertyDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ReadonlyKeyword)
    ) {
      record(`this.${node.name.text}`, node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  for (const [key, count] of seen) {
    if (count > 1) {
      strings.delete(key);
      objects.delete(key);
      aliases.delete(key);
    }
  }
  return { strings, objects, aliases };
}

function refKey(node: ts.Expression): string | null {
  if (ts.isIdentifier(node)) return node.text;
  if (
    ts.isPropertyAccessExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ThisKeyword
  ) {
    return `this.${node.name.text}`;
  }
  return null;
}

/** Résout un premier argument en noms de fonction ; [] si impossible. */
function resolveNames(
  arg: ts.Expression,
  consts: FileConsts,
  depth = 0,
): string[] {
  const lit = stringValue(arg);
  if (lit !== null) return [lit];
  let n: ts.Expression = arg;
  while (
    ts.isAsExpression(n) ||
    ts.isParenthesizedExpression(n) ||
    ts.isNonNullExpression(n)
  ) {
    n = n.expression;
  }
  const key = refKey(n);
  if (key !== null && consts.strings.has(key))
    return [consts.strings.get(key)!];
  if (key !== null && consts.aliases.has(key) && depth < 3) {
    return resolveNames(consts.aliases.get(key)!, consts, depth + 1);
  }
  if (ts.isPropertyAccessExpression(n)) {
    const obj = refKey(n.expression);
    const map = obj !== null ? consts.objects.get(obj) : undefined;
    const v = map?.get(n.name.text);
    if (v !== undefined) return [v];
  }
  if (ts.isElementAccessExpression(n)) {
    const obj = refKey(n.expression);
    const map = obj !== null ? consts.objects.get(obj) : undefined;
    if (map) {
      const k = stringValue(n.argumentExpression);
      if (k !== null) return map.has(k) ? [map.get(k)!] : [];
      return [...new Set(map.values())].sort();
    }
  }
  return [];
}

// ── Détection des appels et des wrappers ────────────────────────────────────

function calleeName(call: ts.CallExpression): string | null {
  const e = call.expression;
  if (ts.isPropertyAccessExpression(e)) return e.name.text;
  if (ts.isIdentifier(e)) return e.text;
  return null;
}

type FnLike =
  | ts.FunctionDeclaration
  | ts.MethodDeclaration
  | ts.ArrowFunction
  | ts.FunctionExpression;

function enclosingFunction(node: ts.Node): FnLike | null {
  let p: ts.Node | undefined = node.parent;
  while (p) {
    if (
      ts.isFunctionDeclaration(p) ||
      ts.isMethodDeclaration(p) ||
      ts.isArrowFunction(p) ||
      ts.isFunctionExpression(p)
    ) {
      return p;
    }
    p = p.parent;
  }
  return null;
}

function functionName(fn: FnLike): string | null {
  if ((ts.isFunctionDeclaration(fn) || ts.isMethodDeclaration(fn)) && fn.name) {
    return ts.isIdentifier(fn.name) ? fn.name.text : null;
  }
  const parent = fn.parent;
  if (
    parent &&
    ts.isVariableDeclaration(parent) &&
    ts.isIdentifier(parent.name)
  ) {
    return parent.name.text;
  }
  if (
    parent &&
    ts.isPropertyDeclaration(parent) &&
    ts.isIdentifier(parent.name)
  ) {
    return parent.name.text;
  }
  if (
    parent &&
    ts.isPropertyAssignment(parent) &&
    ts.isIdentifier(parent.name)
  ) {
    return parent.name.text;
  }
  return null;
}

/** Index du paramètre de `fn` nommé par `arg`, ou -1. */
function forwardedParamIndex(arg: ts.Expression, fn: FnLike | null): number {
  if (!fn || !ts.isIdentifier(arg)) return -1;
  return fn.parameters.findIndex(
    (p) => ts.isIdentifier(p.name) && p.name.text === arg.text,
  );
}

interface Parsed {
  path: string;
  sf: ts.SourceFile;
  consts: FileConsts;
}

function parse(files: SourceFile[]): Parsed[] {
  return files.map((f) => {
    const sf = ts.createSourceFile(
      f.path,
      f.text,
      ts.ScriptTarget.Latest,
      true,
    );
    return { path: f.path, sf, consts: collectConsts(sf) };
  });
}

function forEachCall(
  sf: ts.SourceFile,
  cb: (call: ts.CallExpression) => void,
): void {
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) cb(node);
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

/**
 * Wrappers : fonctions qui transmettent un de leurs paramètres comme nom de
 * RPC à un appel RPC connu. Calculé jusqu'au point fixe (wrapper de wrapper).
 */
export function detectWrappers(files: SourceFile[]): Record<string, number> {
  return detectWrappersParsed(parse(files));
}

function detectWrappersParsed(parsed: Parsed[]): Record<string, number> {
  const callees: Record<string, number> = { ...BASE_RPC_CALLEES };
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of parsed) {
      forEachCall(p.sf, (call) => {
        const name = calleeName(call);
        if (name === null || !(name in callees)) return;
        const arg = call.arguments[callees[name]];
        if (!arg) return;
        const fn = enclosingFunction(call);
        const idx = forwardedParamIndex(arg, fn);
        if (idx < 0 || !fn) return;
        const wrapper = functionName(fn);
        if (wrapper === null || wrapper in callees) return;
        callees[wrapper] = idx;
        changed = true;
      });
    }
  }
  return callees;
}

/** Relève tous les sites d'appel RPC (hors transmissions internes des wrappers). */
export function scanRpcSites(files: SourceFile[]): RpcSite[] {
  const parsed = parse(files);
  const callees = detectWrappersParsed(parsed);
  const sites: RpcSite[] = [];
  for (const p of parsed) {
    forEachCall(p.sf, (call) => {
      const name = calleeName(call);
      if (name === null || !(name in callees)) return;
      const arg = call.arguments[callees[name]];
      if (!arg) return;
      // Transmission d'un paramètre par un wrapper : le nom réel est relevé
      // au site d'appel du wrapper, pas ici.
      if (forwardedParamIndex(arg, enclosingFunction(call)) >= 0) return;
      const line =
        p.sf.getLineAndCharacterOfPosition(call.getStart(p.sf)).line + 1;
      sites.push({
        file: p.path,
        line,
        callee: name,
        names: resolveNames(arg, p.consts),
        expr: arg.getText(p.sf).replace(/\s+/g, " ").slice(0, 120),
      });
    });
  }
  return sites;
}

/**
 * Clés de gel : `fichier::nom` pour un nom non déclaré par une migration,
 * `fichier::<dynamic>` pour un nom non résolvable. Valeur = occurrences.
 */
export function offendersByKey(
  sites: RpcSite[],
  declared: ReadonlySet<string>,
): Record<string, number> {
  const out: Record<string, number> = {};
  const bump = (k: string): void => {
    out[k] = (out[k] ?? 0) + 1;
  };
  for (const s of sites) {
    if (s.names.length === 0) {
      bump(`${s.file}::${DYNAMIC}`);
      continue;
    }
    for (const n of s.names) if (!declared.has(n)) bump(`${s.file}::${n}`);
  }
  return sortKeys(out);
}

function sortKeys(o: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of Object.keys(o).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)))
    out[k] = o[k];
  return out;
}

// ── Gel et dérive ──────────────────────────────────────────────────────────

export interface Baseline {
  check: string;
  total: number;
  entries: Record<string, number>;
  note?: string;
}

export interface Drift {
  newKeys: string[];
  increased: Array<{ key: string; from: number; to: number }>;
  reducedWithoutRefresh: Array<{ key: string; from: number; to: number }>;
  totalFrom: number;
  totalTo: number;
}

export function diffBaseline(
  current: Record<string, number>,
  baseline: Baseline,
): { ok: boolean; drift: Drift } {
  const newKeys = Object.keys(current)
    .filter((k) => !(k in baseline.entries))
    .sort();
  const increased = Object.keys(current)
    .filter((k) => k in baseline.entries && current[k] > baseline.entries[k])
    .map((k) => ({ key: k, from: baseline.entries[k], to: current[k] }));
  const reducedWithoutRefresh = Object.keys(baseline.entries)
    .filter((k) => (current[k] ?? 0) < baseline.entries[k])
    .map((k) => ({ key: k, from: baseline.entries[k], to: current[k] ?? 0 }));
  const total = (o: Record<string, number>): number =>
    Object.values(o).reduce((a, b) => a + b, 0);
  return {
    ok:
      newKeys.length === 0 &&
      increased.length === 0 &&
      reducedWithoutRefresh.length === 0,
    drift: {
      newKeys,
      increased,
      reducedWithoutRefresh,
      totalFrom: baseline.total,
      totalTo: total(current),
    },
  };
}

// ── Lecture du dépôt ───────────────────────────────────────────────────────

function isProductionSource(name: string): boolean {
  return (
    name.endsWith(".ts") &&
    !name.endsWith(".d.ts") &&
    !name.endsWith(".test.ts") &&
    !name.endsWith(".spec.ts")
  );
}

export function readBackendSources(root: string = BACKEND_SRC): SourceFile[] {
  const out: SourceFile[] = [];
  const walk = (dir: string): void => {
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    );
    for (const e of entries) {
      if (
        e.name === "node_modules" ||
        e.name === "dist" ||
        e.name === "__tests__"
      )
        continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && isProductionSource(e.name)) {
        out.push({
          path: relative(REPO_ROOT, p).split(sep).join("/"),
          text: readFileSync(p, "utf8"),
        });
      }
    }
  };
  walk(root);
  return out;
}

export function declaredFunctions(dir: string = MIGRATIONS_DIR): Set<string> {
  return new Set(scanMigrations(dir).rpcInMig.keys());
}

function loadBaseline(): Baseline {
  if (!existsSync(BASELINE_PATH)) {
    console.error(`[rpc-declared-ratchet] baseline missing: ${BASELINE_PATH}`);
    console.error(
      "Run `npm run audit:rpc-declared-ratchet:refresh` (maintainer-only) to seed it.",
    );
    process.exit(2);
  }
  return JSON.parse(readFileSync(BASELINE_PATH, "utf-8")) as Baseline;
}

function writeBaseline(entries: Record<string, number>): void {
  const baseline: Baseline = {
    check: "rpc-declared",
    total: Object.values(entries).reduce((a, b) => a + b, 0),
    entries,
    note:
      "Appels RPC du backend dont le nom ne correspond à aucune fonction déclarée par " +
      "backend/supabase/migrations, ou n'est pas résolvable statiquement (<dynamic>). GELÉ : " +
      "toute entrée nouvelle échoue ; une résorption rafraîchit ce fichier dans la même PR. " +
      "--refresh est réservé au mainteneur.",
  };
  const tmp = `${BASELINE_PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify(baseline, null, 2) + "\n");
  renameSync(tmp, BASELINE_PATH);
}

function main(): void {
  const args = process.argv.slice(2);
  let sites: RpcSite[];
  let declared: Set<string>;
  try {
    sites = scanRpcSites(readBackendSources());
    declared = declaredFunctions();
  } catch (e) {
    console.error(
      `[rpc-declared-ratchet] scan failed: ${(e as Error).message}`,
    );
    process.exit(2);
  }
  if (sites.length === 0 || declared.size === 0) {
    // Un détecteur aveugle ne doit jamais rendre un vert.
    console.error(
      `[rpc-declared-ratchet] scan vide (sites=${sites.length}, fonctions déclarées=${declared.size}) — détecteur aveugle.`,
    );
    process.exit(2);
  }
  const current = offendersByKey(sites, declared);

  if (args.includes("--json")) {
    const undeclared = [
      ...new Set(sites.flatMap((s) => s.names.filter((n) => !declared.has(n)))),
    ].sort();
    console.log(
      JSON.stringify(
        {
          check: "rpc-declared",
          sites: sites.length,
          declared_functions: declared.size,
          undeclared_names: undeclared,
          dynamic_sites: sites
            .filter((s) => s.names.length === 0)
            .map((s) => `${s.file}:${s.line} ${s.callee}(${s.expr})`),
          entries: current,
        },
        null,
        2,
      ),
    );
    return;
  }
  if (args.includes("--refresh")) {
    writeBaseline(current);
    console.log(
      `[rpc-declared-ratchet] baseline refreshed → ${Object.values(current).reduce((a, b) => a + b, 0)} occurrences / ${Object.keys(current).length} entries.`,
    );
    return;
  }

  const baseline = loadBaseline();
  const { ok, drift } = diffBaseline(current, baseline);
  if (ok) {
    console.log(
      `✓ rpc-declared ratchet: ${sites.length} appels RPC, ${declared.size} fonctions déclarées ; gel à ${drift.totalTo} occurrences / ${Object.keys(current).length} entrées (aucune dérive).`,
    );
    return;
  }
  console.error("✖ rpc-declared ratchet: DÉRIVE par rapport au gel.");
  for (const k of drift.newKeys) {
    const [file, name] = k.split("::");
    console.error(
      name === DYNAMIC
        ? `  NOUVEL appel RPC à nom non résolvable dans ${file} — utiliser un littéral ou une constante.`
        : `  NOUVEL appel à '${name}' dans ${file} : aucune migration de backend/supabase/migrations ne déclare cette fonction.`,
    );
  }
  for (const i of drift.increased)
    console.error(`  PLUS d'occurrences pour ${i.key} : ${i.from} → ${i.to}.`);
  for (const r of drift.reducedWithoutRefresh)
    console.error(
      `  MOINS d'occurrences pour ${r.key} : ${r.from} → ${r.to} — une résorption rafraîchit le gel dans la MÊME PR (npm run audit:rpc-declared-ratchet:refresh).`,
    );
  console.error(
    `  total ${drift.totalFrom} → ${drift.totalTo}. La CI n'appelle JAMAIS --refresh.`,
  );
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
