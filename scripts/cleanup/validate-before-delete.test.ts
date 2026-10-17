// Behaviour tests for scripts/cleanup/validate-before-delete.sh — the act-time gate
// of the PR-8b deletion protocol (audit/cleanup/README.md, step 3).
//
// Each test builds a throwaway git repository, copies the REAL script into it
// (REPO_ROOT is derived from the script's own location) and runs it on a target.
//
// Exit-code contract (unchanged for consumers, who only accept 0):
//   0 — SAFE TO DELETE: every check ran and none found a use.
//   1 — BLOCKED: a reference or a protection was found.
//   2 — the target cannot be judged: invalid/out-of-repo/untracked target, or a
//       check that could not run (missing or invalid evidence, absent tool, search
//       error). "No result" must never be read as "no use".
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import {
  chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const GUARD_SRC = join(HERE, "validate-before-delete.sh");

const GIT_ENV = { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" };
function git(cwd: string, ...args: string[]): void {
  execFileSync(
    "git",
    ["-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false",
      "-c", "core.hooksPath=/dev/null", "-c", "protocol.file.allow=always", ...args],
    { cwd, stdio: "pipe", env: GIT_ENV },
  );
}

function resolveBin(name: string): string | null {
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    const p = join(dir, name);
    if (dir && existsSync(p)) return p;
  }
  return null;
}
const BASH = resolveBin("bash") ?? "/bin/bash";

const DEFAULT_FILES: Record<string, string> = {
  "frontend/app/utils/isolated-helper.ts": "export const isolatedHelper = 1;\n",
  "frontend/app/utils/used-helper.ts": "export const usedHelper = 2;\n",
  "frontend/app/components/consumer.tsx": "import { usedHelper } from '../utils/used-helper';\nexport const C = () => usedHelper;\n",
  "frontend/app/routes/_index.tsx": "export default function Index() { return null; }\n",
  "backend/src/main.ts": "export {};\n",
  "backend/src/workers/queue-worker.ts": "export class QueueWorker {}\n",
  "backend/src/services/runtime-svc.ts": "export class RuntimeSvc {}\n",
  "backend/supabase/migrations/0001_init.sql": "select 1;\n",
  ".github/workflows/ci.yml": "name: ci\non: push\n",
  ".claude/knowledge/README.md": "# knowledge\n",
  ".claude/rules/README.md": "# rules\n",
  ".husky/pre-commit": "#!/bin/sh\n",
  "packages/README.md": "packages\n",
  "scripts/README.md": "scripts\n",
};
const DEFAULT_RUNTIME = {
  _generated_by: "fixture",
  runtime_files: ["backend/src/main.ts", "backend/src/services/runtime-svc.ts"],
  entrypoints: { nestjs_unreachable_modules: [] },
};
const DEFAULT_DYNAMIC = { _generated_by: "fixture", count: 0, edges: [] as Array<{ from: string; to: string }> };

type Manifest = object | string | null; // object → JSON, string → raw bytes, null → absent
interface FixtureOpts {
  files?: Record<string, string | null>;
  runtime?: Manifest;
  dynamic?: Manifest;
}
interface Fixture { base: string; root: string; guard: string }

const CREATED: string[] = [];
after(() => { for (const d of CREATED) rmSync(d, { recursive: true, force: true }); });

function makeRepo(opts: FixtureOpts = {}): Fixture {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "vbd-")));
  CREATED.push(base);
  const root = join(base, "repo");
  mkdirSync(root);
  const files: Record<string, string | null> = { ...DEFAULT_FILES, ...(opts.files ?? {}) };
  const write = (rel: string, content: Manifest | undefined, dflt: object) => {
    const v = content === undefined ? dflt : content;
    if (v === null) return;
    files[rel] = typeof v === "string" ? v : JSON.stringify(v, null, 2) + "\n";
  };
  write("audit/runtime-entrypoints.json", opts.runtime, DEFAULT_RUNTIME);
  write("audit/dynamic-import-edges.json", opts.dynamic, DEFAULT_DYNAMIC);
  for (const [rel, content] of Object.entries(files)) {
    if (content === null) continue;
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  const guard = join(root, "scripts/cleanup/validate-before-delete.sh");
  mkdirSync(dirname(guard), { recursive: true });
  copyFileSync(GUARD_SRC, guard);
  chmodSync(guard, 0o755);
  git(root, "init", "-q", "-b", "main");
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "fixture");
  return { base, root, guard };
}

function commitAll(fx: Fixture): void {
  git(fx.root, "add", "-A");
  git(fx.root, "commit", "-q", "-m", "fixture change");
}

interface RunResult { code: number | null; out: string }
function runGuard(fx: Fixture, target: string, env: NodeJS.ProcessEnv = process.env): RunResult {
  const r = spawnSync(BASH, [fx.guard, target], { cwd: fx.root, env, encoding: "utf8", timeout: 60_000 });
  return { code: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

function expectCode(r: RunResult, code: 0 | 1 | 2, mustMatch?: RegExp): void {
  assert.equal(r.code, code, `expected exit ${code}, got ${r.code}\n--- output ---\n${r.out}`);
  if (code !== 0) assert.doesNotMatch(r.out, /SAFE TO DELETE/, `non-zero exit must never print SAFE\n${r.out}`);
  if (mustMatch) assert.match(r.out, mustMatch, `output does not explain the verdict\n${r.out}`);
}

/** A directory holding executable shims; prepend it to PATH. */
function shimDir(fx: Fixture, shims: Record<string, string>): string {
  const dir = join(fx.base, `shims-${Object.keys(shims).join("-")}`);
  mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(shims)) {
    const p = join(dir, name);
    writeFileSync(p, `#!/bin/sh\n${body}\n`);
    chmodSync(p, 0o755);
  }
  return dir;
}

/** A PATH that offers the usual tools but not `node`. */
function pathWithoutNode(fx: Fixture): string {
  const dir = join(fx.base, "bin-no-node");
  mkdirSync(dir);
  const tools = ["bash", "sh", "git", "grep", "sed", "awk", "sort", "uniq", "basename", "dirname", "realpath",
    "readlink", "cat", "head", "tail", "tr", "cut", "wc", "env", "mktemp", "rm", "ls", "printf", "xargs", "find"];
  for (const t of tools) {
    const p = resolveBin(t);
    if (p) symlinkSync(p, join(dir, t));
  }
  return dir;
}

const ISOLATED = "frontend/app/utils/isolated-helper.ts";
const WORKER = "backend/src/workers/queue-worker.ts";

// ---------------------------------------------------------------------------
// Valid outcomes — the guard must still let a truly isolated file through,
// and still block the uses it was built to see.
// ---------------------------------------------------------------------------
test("isolated, tracked, clean file → SAFE (exit 0)", () => {
  const fx = makeRepo();
  expectCode(runGuard(fx, ISOLATED), 0, /VERDICT: SAFE TO DELETE/);
});

test("same isolated file given as ./path or absolute internal path → SAFE", () => {
  const fx = makeRepo();
  expectCode(runGuard(fx, `./${ISOLATED}`), 0, /VERDICT: SAFE TO DELETE/);
  expectCode(runGuard(fx, join(fx.root, ISOLATED)), 0, /VERDICT: SAFE TO DELETE/);
});

test("static import of the target → BLOCKED [IMPORT]", () => {
  const fx = makeRepo();
  expectCode(runGuard(fx, "frontend/app/utils/used-helper.ts"), 1, /\[IMPORT\]/);
});

test("target of a dynamic-import edge → BLOCKED [DYNAMIC-IMPORT]", () => {
  const fx = makeRepo({ dynamic: { count: 1, edges: [{ from: "frontend/app/root.tsx", to: ISOLATED }] } });
  expectCode(runGuard(fx, ISOLATED), 1, /\[DYNAMIC-IMPORT\]/);
});

test("target listed in runtime_files → BLOCKED [RUNTIME-ENTRYPOINT]", () => {
  const fx = makeRepo();
  expectCode(runGuard(fx, "backend/src/services/runtime-svc.ts"), 1, /\[RUNTIME-ENTRYPOINT\]/);
});

test("framework: Remix route file → BLOCKED", () => {
  const fx = makeRepo();
  expectCode(runGuard(fx, "frontend/app/routes/_index.tsx"), 1, /\[REMIX-ROUTE\]/);
});

test("framework: NestJS module file whose subtree controller is fetched over HTTP → BLOCKED [HTTP-ROUTE-CALLER]", () => {
  const fx = makeRepo({
    files: {
      "backend/src/modules/legacy/legacy.controller.ts": "@Controller('api/legacy-thing')\nexport class LegacyController {}\n",
      "backend/src/modules/legacy/legacy.helper.ts": "export const h = 1;\n",
      "frontend/app/services/legacy.client.ts": "export const get = () => fetch('/api/legacy-thing/check');\n",
    },
  });
  expectCode(runGuard(fx, "backend/src/modules/legacy/legacy.helper.ts"), 1, /\[HTTP-ROUTE-CALLER\]/);
});

test("path run by a package.json script → BLOCKED [CI/SCRIPT]", () => {
  const fx = makeRepo({
    files: {
      "scripts/tools/gen-report.ts": "export {};\n",
      "package.json": '{\n  "name": "fixture",\n  "scripts": { "report": "tsx scripts/tools/gen-report.ts" }\n}\n',
    },
  });
  expectCode(runGuard(fx, "scripts/tools/gen-report.ts"), 1, /\[CI\/SCRIPT\] path\/basename referenced in: package\.json/);
  // a package.json that has scripts but never names the target is not a use of it
  expectCode(runGuard(fx, ISOLATED), 0, /VERDICT: SAFE TO DELETE/);
});

test("script run by a workflow step → BLOCKED [CI/SCRIPT]", () => {
  const fx = makeRepo({
    files: {
      "scripts/tools/sync.sh": "#!/bin/sh\n",
      ".github/workflows/sync.yml": "name: sync\non: push\njobs:\n  s:\n    steps:\n      - run: bash scripts/tools/sync.sh\n",
    },
  });
  expectCode(runGuard(fx, "scripts/tools/sync.sh"), 1, /\[CI\/SCRIPT\] path\/basename referenced in: \.github\/workflows\/sync\.yml/);
});

test("framework: provider registered in a multi-line @Module array → BLOCKED [NESTJS-DI]", () => {
  const fx = makeRepo({
    files: {
      "backend/src/things/thing.service.ts": "export class ThingService {}\n",
      "backend/src/things/index.ts": "export * from './thing.service';\n",
      "backend/src/things/thing.module.ts":
        "import { Module } from '@nestjs/common';\nimport { ThingService } from './index';\n\n" +
        "@Module({\n  providers: [\n    ThingService,\n  ],\n  exports: [\n    ThingService,\n  ],\n})\n" +
        "export class ThingModule {}\n",
    },
  });
  expectCode(runGuard(fx, "backend/src/things/thing.service.ts"), 1,
    /\[NESTJS-DI\] ThingService .*backend\/src\/things\/thing\.module\.ts/);
});

test("framework: a longer identifier sharing the class name (ThingServiceFactory) is not a DI use → SAFE", () => {
  const fx = makeRepo({
    files: {
      "backend/src/solo/thing.service.ts": "export class ThingService {}\n",
      "backend/src/other/factory.ts": "export class ThingServiceFactory {}\n",
      "backend/src/other/other.module.ts":
        "import { Module } from '@nestjs/common';\nimport { ThingServiceFactory } from './factory';\n\n" +
        "@Module({\n  providers: [\n    ThingServiceFactory,\n  ],\n})\nexport class OtherModule {}\n",
    },
  });
  expectCode(runGuard(fx, "backend/src/solo/thing.service.ts"), 0, /VERDICT: SAFE TO DELETE/);
});

// ---------------------------------------------------------------------------
// Path normalisation — every spelling of a protected path gets the protection.
// ---------------------------------------------------------------------------
test("protected worker path, canonical spelling → BLOCKED [NEVER-AUTO-DELETE]", () => {
  const fx = makeRepo();
  expectCode(runGuard(fx, WORKER), 1, /\[NEVER-AUTO-DELETE\]/);
});

test("protected worker path prefixed with ./ → BLOCKED [NEVER-AUTO-DELETE]", () => {
  const fx = makeRepo();
  expectCode(runGuard(fx, `./${WORKER}`), 1, /\[NEVER-AUTO-DELETE\]/);
});

test("protected worker path with redundant segments (a//b, a/./b) → BLOCKED [NEVER-AUTO-DELETE]", () => {
  const fx = makeRepo();
  expectCode(runGuard(fx, "backend//src/./workers/queue-worker.ts"), 1, /\[NEVER-AUTO-DELETE\]/);
});

test("protected worker path, absolute internal spelling → BLOCKED [NEVER-AUTO-DELETE]", () => {
  const fx = makeRepo();
  expectCode(runGuard(fx, join(fx.root, WORKER)), 1, /\[NEVER-AUTO-DELETE\]/);
});

// ---------------------------------------------------------------------------
// Target scope — out-of-repo, untracked, nested repos, symlinks, dirty files.
// ---------------------------------------------------------------------------
test("relative target escaping the repository (../) → refused (exit 2)", () => {
  const fx = makeRepo();
  mkdirSync(join(fx.base, "outside"));
  writeFileSync(join(fx.base, "outside/foreign.ts"), "export const foreign = 1;\n");
  expectCode(runGuard(fx, "../outside/foreign.ts"), 2, /outside the repository/i);
});

test("absolute target escaping the repository through /repo/../ → refused (exit 2)", () => {
  const fx = makeRepo();
  mkdirSync(join(fx.base, "outside"));
  writeFileSync(join(fx.base, "outside/foreign.ts"), "export const foreign = 1;\n");
  expectCode(runGuard(fx, `${fx.root}/../outside/foreign.ts`), 2, /outside the repository/i);
});

test("absolute target in another directory → refused (exit 2)", () => {
  const fx = makeRepo();
  mkdirSync(join(fx.base, "outside"));
  writeFileSync(join(fx.base, "outside/foreign.ts"), "export const foreign = 1;\n");
  expectCode(runGuard(fx, join(fx.base, "outside/foreign.ts")), 2);
});

test("untracked file → refused (exit 2): git rm cannot remove it, its references were never committed", () => {
  const fx = makeRepo();
  writeFileSync(join(fx.root, "frontend/app/utils/untracked.ts"), "export const u = 1;\n");
  expectCode(runGuard(fx, "frontend/app/utils/untracked.ts"), 2, /not tracked/i);
});

test("tracked file with uncommitted changes → refused (exit 2)", () => {
  const fx = makeRepo();
  writeFileSync(join(fx.root, ISOLATED), "export const isolatedHelper = 42;\n");
  expectCode(runGuard(fx, ISOLATED), 2, /uncommitted/i);
});

test("tracked symlink pointing outside the repository → refused (exit 2), never followed", () => {
  const fx = makeRepo();
  mkdirSync(join(fx.base, "outside"));
  writeFileSync(join(fx.base, "outside/foreign.ts"), "export const foreign = 1;\n");
  symlinkSync("../../../../outside/foreign.ts", join(fx.root, "frontend/app/utils/link.ts"));
  commitAll(fx);
  expectCode(runGuard(fx, "frontend/app/utils/link.ts"), 2, /symlink/i);
});

test("path traversing a tracked directory symlink to another tree → refused (exit 2)", () => {
  const fx = makeRepo();
  mkdirSync(join(fx.base, "outside"));
  writeFileSync(join(fx.base, "outside/foreign.ts"), "export const foreign = 1;\n");
  symlinkSync("../../../outside", join(fx.root, "frontend/app/ext"));
  commitAll(fx);
  expectCode(runGuard(fx, "frontend/app/ext/foreign.ts"), 2);
});

test("file inside a git submodule → refused (exit 2): a submodule is a boundary, not cleanup scope", () => {
  const fx = makeRepo();
  const sub = join(fx.base, "subsrc");
  mkdirSync(sub);
  writeFileSync(join(sub, "inner.ts"), "export const inner = 1;\n");
  git(sub, "init", "-q", "-b", "main");
  git(sub, "add", "-A");
  git(sub, "commit", "-q", "-m", "sub");
  git(fx.root, "submodule", "add", "-q", sub, "vendor/sub");
  git(fx.root, "commit", "-q", "-m", "add submodule");
  expectCode(runGuard(fx, "vendor/sub/inner.ts"), 2);
});

test("directory target → refused (exit 2)", () => {
  const fx = makeRepo();
  expectCode(runGuard(fx, "frontend/app/utils"), 2);
});

// ---------------------------------------------------------------------------
// Evidence manifests — absent, corrupt, mistyped or locally altered evidence
// must block the verdict, never shrink to "no use found".
// ---------------------------------------------------------------------------
test("runtime manifest absent → exit 2, not SAFE", () => {
  const fx = makeRepo({ runtime: null });
  expectCode(runGuard(fx, ISOLATED), 2, /runtime-entrypoints\.json/);
});

test("runtime manifest not valid JSON → exit 2, not SAFE", () => {
  const fx = makeRepo({ runtime: "{ this is not json" });
  expectCode(runGuard(fx, ISOLATED), 2, /runtime-entrypoints\.json/);
});

test("runtime_files mistyped (object instead of array) → exit 2, not SAFE", () => {
  const fx = makeRepo({ runtime: { runtime_files: { [ISOLATED]: true }, entrypoints: {} } });
  expectCode(runGuard(fx, ISOLATED), 2, /runtime_files/);
});

test("runtime_files empty → exit 2: an empty runtime surface is a broken inventory, not evidence", () => {
  const fx = makeRepo({ runtime: { runtime_files: [], entrypoints: {} } });
  expectCode(runGuard(fx, ISOLATED), 2, /runtime_files/);
});

test("dynamic-import manifest absent → exit 2, not SAFE", () => {
  const fx = makeRepo({ dynamic: null });
  expectCode(runGuard(fx, ISOLATED), 2, /dynamic-import-edges\.json/);
});

test("dynamic-import edges mistyped (string instead of array) → exit 2, not SAFE", () => {
  const fx = makeRepo({ dynamic: { count: 1, edges: ISOLATED } });
  expectCode(runGuard(fx, ISOLATED), 2, /edges/);
});

test("runtime manifest edited locally after commit (relevant drift) → exit 2", () => {
  const fx = makeRepo();
  // Drop the target from the runtime surface without committing: the evidence no longer
  // matches any reviewed, CI-checked state.
  writeFileSync(
    join(fx.root, "audit/runtime-entrypoints.json"),
    JSON.stringify({ ...DEFAULT_RUNTIME, runtime_files: ["backend/src/main.ts"] }, null, 2) + "\n",
  );
  expectCode(runGuard(fx, "backend/src/services/runtime-svc.ts"), 2, /runtime-entrypoints\.json/);
});

// ---------------------------------------------------------------------------
// Tool and sub-process failures.
// ---------------------------------------------------------------------------
test("node absent → exit 2, not SAFE", () => {
  const fx = makeRepo();
  const env = { ...process.env, PATH: pathWithoutNode(fx) };
  expectCode(runGuard(fx, ISOLATED, env), 2, /node/);
});

test("node probe crashes → exit 2, not SAFE", () => {
  const fx = makeRepo();
  const dir = shimDir(fx, { node: 'echo "node: simulated crash" >&2\nexit 3' });
  expectCode(runGuard(fx, ISOLATED, { ...process.env, PATH: `${dir}${delimiter}${process.env.PATH}` }), 2);
});

// Every search goes through `git grep` (see "Search surface" below); the guard runs
// no standalone grep, so a failing search is simulated on git itself.
test("git grep fails (exit 128) → exit 2, not SAFE", () => {
  const fx = makeRepo();
  const realGit = resolveBin("git");
  assert.ok(realGit, "git not found on PATH");
  const dir = shimDir(fx, {
    git: 'for a in "$@"; do\n  if [ "$a" = grep ]; then echo "fatal: simulated git grep failure" >&2; exit 128; fi\ndone\n' +
      `exec '${realGit}' "$@"`,
  });
  expectCode(runGuard(fx, ISOLATED, { ...process.env, PATH: `${dir}${delimiter}${process.env.PATH}` }), 2, /search failed/);
});

test("listing untracked work fails (git ls-files --others, exit 128) → exit 2, not SAFE", () => {
  const fx = makeRepo();
  const realGit = resolveBin("git");
  assert.ok(realGit, "git not found on PATH");
  const dir = shimDir(fx, {
    git: 'for a in "$@"; do\n  if [ "$a" = --others ]; then echo "fatal: simulated ls-files failure" >&2; exit 128; fi\ndone\n' +
      `exec '${realGit}' "$@"`,
  });
  expectCode(runGuard(fx, ISOLATED, { ...process.env, PATH: `${dir}${delimiter}${process.env.PATH}` }), 2, /search failed/);
});

test("searching untracked work fails (git grep --untracked, exit 128) while the index pass succeeds → exit 2, not SAFE", () => {
  const fx = makeRepo();
  writeFileSync(join(fx.root, "frontend/app/components/draft.tsx"), "export const D = 1;\n");
  const realGit = resolveBin("git");
  assert.ok(realGit, "git not found on PATH");
  const dir = shimDir(fx, {
    git: 'for a in "$@"; do\n  if [ "$a" = --untracked ]; then echo "fatal: simulated git grep failure" >&2; exit 128; fi\ndone\n' +
      `exec '${realGit}' "$@"`,
  });
  expectCode(runGuard(fx, ISOLATED, { ...process.env, PATH: `${dir}${delimiter}${process.env.PATH}` }), 2, /search failed/);
});

test("a protection still wins when another check fails: protected worker + node absent → BLOCKED", () => {
  const fx = makeRepo();
  expectCode(runGuard(fx, WORKER, { ...process.env, PATH: pathWithoutNode(fx) }), 1, /\[NEVER-AUTO-DELETE\]/);
});

// ---------------------------------------------------------------------------
// Import specifiers that name the file without spelling `<dir>/<stem>` — each one
// is a real use the resolver follows, and each one was answered SAFE until
// 2026-10-11 (frontend/app/styles/animations.css, imported by root.tsx as
// `./styles/animations.css?url`, came out SAFE TO DELETE).
// ---------------------------------------------------------------------------
test("asset imported with a Vite query suffix (?url) → BLOCKED [IMPORT]", () => {
  const fx = makeRepo({
    files: {
      "frontend/app/styles/theme.css": ".a { color: red; }\n",
      "frontend/app/components/theme-consumer.tsx": "import themeHref from '../styles/theme.css?url';\nexport const T = () => themeHref;\n",
    },
  });
  expectCode(runGuard(fx, "frontend/app/styles/theme.css"), 1, /\[IMPORT\] imported by: frontend\/app\/components\/theme-consumer\.tsx/);
});

test("index file imported through its directory (~/lib/widgets) → BLOCKED [IMPORT]", () => {
  const fx = makeRepo({
    files: {
      "frontend/app/lib/widgets/index.ts": "export const w = 1;\n",
      "frontend/app/components/widgets-consumer.tsx": "import { w } from '~/lib/widgets';\nexport const W = () => w;\n",
    },
  });
  expectCode(runGuard(fx, "frontend/app/lib/widgets/index.ts"), 1, /\[IMPORT\] imported by: frontend\/app\/components\/widgets-consumer\.tsx/);
});

test("index file imported as '.' by a sibling → BLOCKED [IMPORT]", () => {
  const fx = makeRepo({
    files: {
      "frontend/app/lib/widgets/index.ts": "export const w = 1;\n",
      "frontend/app/lib/widgets/panel.tsx": "import { w } from '.';\nexport const P = () => w;\n",
    },
  });
  expectCode(runGuard(fx, "frontend/app/lib/widgets/index.ts"), 1, /\[IMPORT\] imported by: frontend\/app\/lib\/widgets\/panel\.tsx/);
});

test("index file imported as '../' from a child directory → BLOCKED [IMPORT]", () => {
  const fx = makeRepo({
    files: {
      "frontend/app/lib/widgets/index.ts": "export const w = 1;\n",
      "frontend/app/lib/widgets/parts/knob.tsx": "import { w } from '../';\nexport const K = () => w;\n",
    },
  });
  expectCode(runGuard(fx, "frontend/app/lib/widgets/index.ts"), 1, /\[IMPORT\] imported by: frontend\/app\/lib\/widgets\/parts\/knob\.tsx/);
});

test("index file whose directory nobody imports → SAFE despite look-alike specifiers", () => {
  const fx = makeRepo({
    files: {
      "frontend/app/lib/widgets/index.ts": "export const w = 1;\n",
      "frontend/app/lib/widgets-extra/index.ts": "export const x = 1;\n",
      "frontend/app/components/extra-consumer.tsx": "import { x } from '~/lib/widgets-extra';\nexport const E = () => x;\n",
      "frontend/app/other/index.ts": "export const o = 1;\n",
      "frontend/app/other/sibling.ts": "import { o } from '.';\nexport const s = o;\n",
    },
  });
  expectCode(runGuard(fx, "frontend/app/lib/widgets/index.ts"), 0, /VERDICT: SAFE TO DELETE/);
});

test("TypeScript declaration file (.d.ts) → refused (exit 2): tsc loads it without any import", () => {
  const fx = makeRepo({
    files: {
      "backend/src/types/express.d.ts":
        "import 'express-session';\ndeclare module 'express-session' {\n  interface SessionData { nonce?: string }\n}\n",
    },
  });
  expectCode(runGuard(fx, "backend/src/types/express.d.ts"), 2, /declaration file/);
});

// ---------------------------------------------------------------------------
// Search surface — the repository's sources as git sees them: tracked files and
// untracked work in progress, never what .gitignore excludes. Until 2026-10-11 the
// searches also read build outputs and dependencies (12 of the 108 PR-8 candidates
// had a hit from the git-ignored packages/database-types/dist/), so a verdict
// depended on what happened to be built in the checkout.
// ---------------------------------------------------------------------------
test("references only in git-ignored outputs (build/, dist/, node_modules/) → SAFE", () => {
  const fx = makeRepo({
    files: {
      ".gitignore": "build/\ndist/\nnode_modules/\n",
      "frontend/build/server/index.js": "import { isolatedHelper } from '../../app/utils/isolated-helper.js';\n",
      "packages/kit/dist/index.js": "module.exports = require('../../../frontend/app/utils/isolated-helper');\n",
      "frontend/node_modules/some-lib/index.js": "module.exports = 'isolated-helper.ts';\n",
    },
  });
  const tracked = execFileSync("git", ["ls-files", "--", "frontend/build", "packages/kit", "frontend/node_modules"],
    { cwd: fx.root, encoding: "utf8", env: GIT_ENV });
  assert.equal(tracked, "", "fixture premise: the outputs are git-ignored");
  expectCode(runGuard(fx, ISOLATED), 0, /VERDICT: SAFE TO DELETE/);
});

test("user git config that reshapes git grep output (color.grep, submodule.recurse) changes no verdict", () => {
  const fx = makeRepo();
  const env = {
    ...process.env, GIT_CONFIG_COUNT: "3",
    GIT_CONFIG_KEY_0: "color.grep", GIT_CONFIG_VALUE_0: "always",
    GIT_CONFIG_KEY_1: "submodule.recurse", GIT_CONFIG_VALUE_1: "true",
    GIT_CONFIG_KEY_2: "grep.lineNumber", GIT_CONFIG_VALUE_2: "true",
  };
  expectCode(runGuard(fx, "frontend/app/utils/used-helper.ts", env), 1,
    /\[IMPORT\] imported by: frontend\/app\/components\/consumer\.tsx\n/);
  expectCode(runGuard(fx, ISOLATED, env), 0, /VERDICT: SAFE TO DELETE/);
});

test("reference in an untracked, not-ignored source (work in progress) → BLOCKED [IMPORT]", () => {
  const fx = makeRepo();
  writeFileSync(join(fx.root, "frontend/app/components/draft.tsx"),
    "import { isolatedHelper } from '../utils/isolated-helper';\nexport const D = () => isolatedHelper;\n");
  expectCode(runGuard(fx, ISOLATED), 1, /\[IMPORT\] imported by: frontend\/app\/components\/draft\.tsx/);
});

/** Track `rel` although a .gitignore pattern matches it (`git add -f`), as the repo does for archives/ and data/. */
function trackIgnored(fx: Fixture, rel: string, content: string): void {
  mkdirSync(dirname(join(fx.root, rel)), { recursive: true });
  writeFileSync(join(fx.root, rel), content);
  git(fx.root, "add", "-f", "--", rel);
  git(fx.root, "commit", "-q", "-m", "track an ignored path");
  assert.equal(execFileSync("git", ["ls-files", "--", rel], { cwd: fx.root, encoding: "utf8", env: GIT_ENV }), `${rel}\n`,
    "fixture premise: the file is tracked");
  assert.match(execFileSync("git", ["check-ignore", "--no-index", "--", rel], { cwd: fx.root, encoding: "utf8", env: GIT_ENV }),
    new RegExp(rel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "fixture premise: a .gitignore pattern matches it");
}

// `git grep --untracked` walks the working tree and applies .gitignore to every file,
// tracked ones included: backend/src/modules/commercial/archives/ (pattern `archives/`) and
// backend/src/modules/vehicles/services/data/ (pattern `data/`) are tracked sources it skips.
test("tracked importer under a .gitignore'd pattern (archives/) → BLOCKED [IMPORT]", () => {
  const fx = makeRepo({ files: { ".gitignore": "archives/\n" } });
  trackIgnored(fx, "frontend/app/archives/viewer.tsx",
    "import { isolatedHelper } from '../utils/isolated-helper';\nexport const V = () => isolatedHelper;\n");
  expectCode(runGuard(fx, ISOLATED), 1, /\[IMPORT\] imported by: frontend\/app\/archives\/viewer\.tsx/);
});

test("controller in a tracked directory under a .gitignore'd pattern, fetched over HTTP → BLOCKED [HTTP-ROUTE-CALLER]", () => {
  const fx = makeRepo({
    files: {
      ".gitignore": "archives/\n",
      "frontend/app/services/archives.client.ts": "export const list = () => fetch('/api/archives-x/list');\n",
    },
  });
  trackIgnored(fx, "backend/src/modules/archives/archives.controller.ts",
    "@Controller('api/archives-x')\nexport class ArchivesController {}\n");
  trackIgnored(fx, "backend/src/modules/archives/archives.helper.ts", "export const h = 1;\n");
  expectCode(runGuard(fx, "backend/src/modules/archives/archives.helper.ts"), 1, /\[HTTP-ROUTE-CALLER\]/);
});

test("importer deleted from the working tree (bottom-up removal in progress) → SAFE: files are read, not index blobs", () => {
  const fx = makeRepo();
  rmSync(join(fx.root, "frontend/app/components/consumer.tsx"));
  expectCode(runGuard(fx, "frontend/app/utils/used-helper.ts"), 0, /VERDICT: SAFE TO DELETE/);
});

test("index file in a directory named with glob metacharacters (w[id]gets), imported as '.' → BLOCKED [IMPORT]", () => {
  const fx = makeRepo({
    files: {
      "frontend/app/lib/w[id]gets/index.ts": "export const w = 1;\n",
      "frontend/app/lib/w[id]gets/panel.tsx": "import { w } from '.';\nexport const P = () => w;\n",
    },
  });
  expectCode(runGuard(fx, "frontend/app/lib/w[id]gets/index.ts"), 1,
    /\[IMPORT\] imported by: frontend\/app\/lib\/w\[id\]gets\/panel\.tsx/);
});

// ---------------------------------------------------------------------------
// Special characters — names are data, never regex or options.
// ---------------------------------------------------------------------------
test("regex metacharacter in the name ([) with an importer → BLOCKED, not a masked grep error", () => {
  const fx = makeRepo({
    files: {
      "frontend/app/utils/odd[name.ts": "export const odd = 1;\n",
      "frontend/app/components/odd-consumer.tsx": "import { odd } from '../utils/odd[name';\nexport const O = () => odd;\n",
    },
  });
  expectCode(runGuard(fx, "frontend/app/utils/odd[name.ts"), 1, /\[IMPORT\]/);
});

test("ERE quantifier in the name (+) with an importer → BLOCKED", () => {
  const fx = makeRepo({
    files: {
      "frontend/app/utils/a+b.ts": "export const ab = 1;\n",
      "frontend/app/components/ab-consumer.tsx": "import { ab } from '../utils/a+b';\nexport const A = () => ab;\n",
    },
  });
  expectCode(runGuard(fx, "frontend/app/utils/a+b.ts"), 1, /\[IMPORT\]/);
});

test("space in the name with an importer → BLOCKED", () => {
  const fx = makeRepo({
    files: {
      "frontend/app/utils/with space.ts": "export const ws = 1;\n",
      "frontend/app/components/ws-consumer.tsx": "import { ws } from '../utils/with space';\nexport const W = () => ws;\n",
    },
  });
  expectCode(runGuard(fx, "frontend/app/utils/with space.ts"), 1, /\[IMPORT\]/);
});

test("leading dash in the name: the knowledge check runs instead of failing as an option → BLOCKED [KNOWLEDGE]", () => {
  const fx = makeRepo({
    files: {
      "frontend/app/utils/-dash.ts": "export const d = 1;\n",
      ".claude/knowledge/modules/dash.md": "Retention: `-dash` is consumed by the ops runbook.\n",
    },
  });
  expectCode(runGuard(fx, "frontend/app/utils/-dash.ts"), 1, /\[KNOWLEDGE\]/);
});

test("leading dash in an isolated name → SAFE (every check actually ran)", () => {
  const fx = makeRepo({ files: { "frontend/app/utils/-lonely.ts": "export const l = 1;\n" } });
  expectCode(runGuard(fx, "frontend/app/utils/-lonely.ts"), 0, /VERDICT: SAFE TO DELETE/);
});

test("usage: zero or two arguments → exit 2", () => {
  const fx = makeRepo();
  const r0 = spawnSync(BASH, [fx.guard], { cwd: fx.root, encoding: "utf8" });
  assert.equal(r0.status, 2);
  const r2 = spawnSync(BASH, [fx.guard, ISOLATED, WORKER], { cwd: fx.root, encoding: "utf8" });
  assert.equal(r2.status, 2);
});
