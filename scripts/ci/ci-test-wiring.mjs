// =============================================================================
// scripts/ci test wiring — every `scripts/ci/*.test.mjs` must run on pull requests.
// =============================================================================
// A test that no pull-request workflow executes guards nothing: it stays green
// while the script it covers drifts. Three such tests existed at once
// (pr-dod-gate, prod-seo-projection-env, verify-size-limit-initial-load): one
// was cited only in a YAML comment, one ran only at PROD deploy time, one only
// behind an npm script no workflow called.
//
// A test counts as wired when a step of a workflow triggered by `pull_request`
// runs it, directly (`scripts/ci/<file>` in the step's `run`) or through ONE
// root npm script whose command names `scripts/ci/<file>`
// (`npm run [-s|--silent] <script>`). Steps or jobs with `continue-on-error`
// set to anything but `false` do not count: a run that cannot fail is not a gate.
// Full-line shell comments in a `run` do not count either: they never execute.
// Nested npm scripts and globs are not followed — the check fails closed, and
// the fix is to call the test by name.
//
// Pure `findUnwiredTests()` is exported for testing; `loadRepoWiringInputs()`
// reads the repository. Consumed by scripts/ci/ci-test-wiring.test.mjs.
// =============================================================================

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";

function isPullRequestTriggered(doc) {
  // js-yaml 4 keeps `on` as a string key; a YAML 1.1 parser turns it into `true`.
  const on = doc?.on ?? doc?.[true];
  if (typeof on === "string") return on === "pull_request";
  if (Array.isArray(on)) return on.includes("pull_request");
  if (on && typeof on === "object") return Object.hasOwn(on, "pull_request");
  return false;
}

function canFail(node) {
  return node?.["continue-on-error"] === undefined || node["continue-on-error"] === false;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function runsNpmScript(run, name) {
  return new RegExp(`\\bnpm\\s+run\\s+(?:(?:-s|--silent)\\s+)?${escapeRegExp(name)}(?=$|[\\s;&|)])`, "m").test(run);
}

function namesFile(text, target) {
  return new RegExp(`${escapeRegExp(target)}(?![\\w.-])`).test(text);
}

function withoutCommentLines(run) {
  return run
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n");
}

/**
 * @param {{ testFiles: string[], workflows: { name: string, doc: unknown }[], npmScripts: Record<string, string> }} input
 *   testFiles: base names under scripts/ci (e.g. "prod-rollback.test.mjs").
 * @returns {string[]} the test files no pull-request workflow runs, sorted.
 */
export function findUnwiredTests({ testFiles, workflows, npmScripts }) {
  const runs = [];
  for (const { doc } of workflows) {
    if (!isPullRequestTriggered(doc)) continue;
    for (const job of Object.values(doc.jobs ?? {})) {
      if (!canFail(job)) continue;
      for (const step of job.steps ?? []) {
        if (canFail(step) && typeof step.run === "string") runs.push(withoutCommentLines(step.run));
      }
    }
  }
  const unwired = [];
  for (const file of testFiles) {
    const target = `scripts/ci/${file}`;
    const scripts = Object.entries(npmScripts)
      .filter(([, command]) => namesFile(command, target))
      .map(([name]) => name);
    const wired = runs.some((run) => namesFile(run, target) || scripts.some((name) => runsNpmScript(run, name)));
    if (!wired) unwired.push(file);
  }
  return unwired.sort();
}

export function loadRepoWiringInputs(repoRoot) {
  const testFiles = readdirSync(join(repoRoot, "scripts/ci")).filter((f) => f.endsWith(".test.mjs"));
  const workflowDir = join(repoRoot, ".github/workflows");
  const workflows = readdirSync(workflowDir)
    .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
    .map((name) => ({ name, doc: yaml.load(readFileSync(join(workflowDir, name), "utf8")) }));
  const npmScripts = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")).scripts ?? {};
  return { testFiles, workflows, npmScripts };
}
