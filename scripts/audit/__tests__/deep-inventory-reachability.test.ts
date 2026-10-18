// Ce que voit le graphe d'imports du deep-inventory, et ce qu'il en déduit.
//
// Deux modules NestJS reliés à `app.module.ts` par des imports sans condition figuraient
// dans `audit/runtime-entrypoints.json#nestjs_unreachable_modules` (entrée de la phase
// PR-3 Step B) :
//
// 1. `exclude: 'rm/'` (`.dependency-cruiser.cjs`) retirait du graphe tout
//    `backend/src/modules/rm/`, que `app.module.ts` importe.
// 2. La BFS DI ne suivait que les arêtes qui aboutissent à un `*.module.ts` : un
//    module importé par son dossier (`index.ts` qui le ré-exporte) restait hors
//    d'atteinte, alors que l'`@Module` qui l'importe est atteint.
//
// Les autres motifs `exclude` / `doNotFollow` étaient des regex non ancrées : `build`,
// `dist` et `coverage` touchaient aussi des fichiers source. `url-builder.utils.ts` et
// `r2-commercial-distinctiveness.service.ts` perdaient leurs imports sortants ;
// `gsc-coverage.test.ts`, sans importeur, sortait du graphe.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");
const require = createRequire(import.meta.url);
const { resolveDiLive, isTestPath, CRUISE_ROOTS } = require("../build-deep-inventory.js");

const APP = "backend/src/app.module.ts";
const mod = (imports: string[] = []) => ({ imports, providers: [], controllers: [], exports: [] });
const graph = (edges: Record<string, string[]>) =>
  new Map(Object.entries(edges).map(([from, to]) => [from, new Set(to)]));
const reachable = (moduleFiles: string[], edges: Record<string, string[]>) =>
  [...resolveDiLive(new Map(moduleFiles.map((f) => [f, mod()])), new Map(), graph(edges)).reachableModuleFiles].sort();

test("un module importé par son dossier (index.ts qui le ré-exporte) est atteint", () => {
  const pipes = "backend/src/common/pipes/params/params-pipes.module.ts";
  const barrel = "backend/src/common/pipes/params/index.ts";
  assert.deepEqual(reachable([APP, pipes], { [APP]: [barrel], [barrel]: [pipes] }), [APP, pipes].sort());
});

test("les index.ts imbriqués sont traversés", () => {
  const leaf = "backend/src/modules/a/b/leaf.module.ts";
  const outer = "backend/src/modules/a/index.ts";
  const inner = "backend/src/modules/a/b/index.ts";
  assert.deepEqual(reachable([APP, leaf], { [APP]: [outer], [outer]: [inner], [inner]: [leaf] }), [APP, leaf].sort());
});

test("un index.ts qu'aucun module atteint n'importe ne rend rien atteignable", () => {
  const island = "backend/src/modules/island/island.module.ts";
  const barrel = "backend/src/modules/island/index.ts";
  assert.deepEqual(reachable([APP, island], { [barrel]: [island] }), [APP]);
});

test("un fichier qui n'est ni un module ni un index.ts n'est pas traversé", () => {
  const service = "backend/src/modules/a/a.service.ts";
  const other = "backend/src/modules/b/b.module.ts";
  assert.deepEqual(reachable([APP, other], { [APP]: [service], [service]: [other] }), [APP]);
});

test("un fichier dont le nom finit par index.ts sans être un index.ts n'est pas traversé", () => {
  const reindex = "backend/src/modules/a/reindex.ts";
  const other = "backend/src/modules/b/b.module.ts";
  assert.deepEqual(reachable([APP, other], { [APP]: [reindex], [reindex]: [other] }), [APP]);
});

test("un cycle d'index.ts termine", () => {
  const a = "backend/src/modules/a/index.ts";
  const b = "backend/src/modules/b/index.ts";
  assert.deepEqual(reachable([APP], { [APP]: [a], [a]: [b], [b]: [a] }), [APP]);
});

test("aucun motif exclude/doNotFollow de .dependency-cruiser.cjs ne touche une source suivie hors tests", () => {
  const cfg = require(join(REPO_ROOT, ".dependency-cruiser.cjs"));
  const tracked = execFileSync("git", ["ls-files", "-z", "--", ...CRUISE_ROOTS], { cwd: REPO_ROOT, encoding: "utf8" })
    .split("\0").filter(Boolean);
  assert.ok(tracked.length > 1000, `surface suivie inattendue : ${tracked.length} fichiers`);
  const hits: string[] = [];
  for (const kind of ["exclude", "doNotFollow"] as const) {
    for (const pattern of cfg.options[kind].path as string[]) {
      const re = new RegExp(pattern);
      for (const f of tracked) if (re.test(f) && !isTestPath(f)) hits.push(`${kind} ${JSON.stringify(pattern)} → ${f}`);
    }
  }
  assert.deepEqual(hits, []);
});
