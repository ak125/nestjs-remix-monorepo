/**
 * Behavioural proof of the scripts/ci test-wiring guard (ci-test-wiring.mjs).
 *
 * Three scripts/ci tests once ran on no pull request at all: one cited only in
 * a YAML comment, one run only by deploy-prod.yml, one only behind an npm
 * script no workflow called. These tests assert:
 *
 *   1. a test is wired when a step of a pull_request workflow names it, either
 *      directly or through ONE root npm script that names it;
 *   2. a push-only workflow, a step or job that cannot fail, a YAML or shell
 *      comment, or a name that only shares a prefix never stands in;
 *   3. on the real repository, every scripts/ci/*.test.mjs is wired.
 *
 * Run: node --test scripts/ci/ci-test-wiring.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { findUnwiredTests, loadRepoWiringInputs } from "./ci-test-wiring.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function workflow(source) {
  return { name: "fixture.yml", doc: yaml.load(source) };
}

function unwired(testFiles, workflows, npmScripts = {}) {
  return findUnwiredTests({ testFiles, workflows, npmScripts });
}

const PR_STEP = (run, extra = "") => `
on:
  pull_request:
    paths: ["scripts/**"]
jobs:
  gates:
    runs-on: ubuntu-latest${extra}
    steps:
      - uses: actions/checkout@v4
      - name: gate
        run: ${run}
`;

describe("findUnwiredTests — what counts as wired", () => {
  test("a pull_request step that runs the file directly", () => {
    assert.deepEqual(unwired(["a.test.mjs"], [workflow(PR_STEP("node --test scripts/ci/a.test.mjs"))]), []);
  });

  test("a pull_request step that runs ONE npm script naming the file", () => {
    const scripts = { "test:a": "node --test scripts/ci/a.test.mjs" };
    assert.deepEqual(unwired(["a.test.mjs"], [workflow(PR_STEP("npm run test:a"))], scripts), []);
  });

  test("npm run -s / --silent are recognised", () => {
    const scripts = { "test:a": "node --test scripts/ci/a.test.mjs" };
    assert.deepEqual(unwired(["a.test.mjs"], [workflow(PR_STEP("npm run -s test:a"))], scripts), []);
    assert.deepEqual(unwired(["a.test.mjs"], [workflow(PR_STEP("npm run --silent test:a"))], scripts), []);
  });

  test("every trigger shape that includes pull_request (string, list, map)", () => {
    const step = "jobs:\n  g:\n    steps:\n      - run: node --test scripts/ci/a.test.mjs\n";
    for (const on of ["on: pull_request\n", "on: [push, pull_request]\n", "on:\n  pull_request:\n"]) {
      assert.deepEqual(unwired(["a.test.mjs"], [workflow(on + step)]), [], on);
    }
  });

  test("continue-on-error: false still counts", () => {
    assert.deepEqual(
      unwired(["a.test.mjs"], [workflow(PR_STEP("node --test scripts/ci/a.test.mjs", "\n    continue-on-error: false"))]),
      [],
    );
  });
});

describe("findUnwiredTests — what never stands in", () => {
  test("a workflow without a pull_request trigger (deploy-time only)", () => {
    const source = "on:\n  push:\n    tags: ['v*']\njobs:\n  g:\n    steps:\n      - run: node --test scripts/ci/a.test.mjs\n";
    assert.deepEqual(unwired(["a.test.mjs"], [workflow(source)]), ["a.test.mjs"]);
  });

  test("a step whose continue-on-error is set", () => {
    const source = `
on: pull_request
jobs:
  g:
    steps:
      - run: node --test scripts/ci/a.test.mjs
        continue-on-error: true
`;
    assert.deepEqual(unwired(["a.test.mjs"], [workflow(source)]), ["a.test.mjs"]);
  });

  test("a job whose continue-on-error is set, even through an expression", () => {
    const source = PR_STEP("node --test scripts/ci/a.test.mjs", "\n    continue-on-error: ${{ matrix.experimental }}");
    assert.deepEqual(unwired(["a.test.mjs"], [workflow(source)]), ["a.test.mjs"]);
  });

  test("a YAML comment naming the file", () => {
    const source = `
on: pull_request
jobs:
  g:
    steps:
      # see scripts/ci/a.test.mjs
      - run: echo nothing
`;
    assert.deepEqual(unwired(["a.test.mjs"], [workflow(source)]), ["a.test.mjs"]);
  });

  test("a full-line shell comment inside the run", () => {
    const source = `
on: pull_request
jobs:
  g:
    steps:
      - run: |
          # node --test scripts/ci/a.test.mjs
          echo nothing
`;
    assert.deepEqual(unwired(["a.test.mjs"], [workflow(source)]), ["a.test.mjs"]);
  });

  test("an npm script that names the file but no workflow calls", () => {
    const scripts = { "test:a": "node --test scripts/ci/a.test.mjs" };
    assert.deepEqual(unwired(["a.test.mjs"], [workflow(PR_STEP("npm run test:other"))], scripts), ["a.test.mjs"]);
  });

  test("a file name that only shares a prefix with the one run", () => {
    const runs = "node --test scripts/ci/a.test.mjs.bak scripts/ci/xa.test.mjs scripts/ci/a.test.mjs-old";
    assert.deepEqual(unwired(["a.test.mjs"], [workflow(PR_STEP(runs))]), ["a.test.mjs"]);
  });

  test("an npm script name that only shares a prefix with the one called", () => {
    const scripts = { "test:a": "node --test scripts/ci/a.test.mjs", "test:a-extra": "node --test scripts/ci/b.test.mjs" };
    assert.deepEqual(unwired(["a.test.mjs"], [workflow(PR_STEP("npm run test:a-extra"))], scripts), ["a.test.mjs"]);
    assert.deepEqual(unwired(["a.test.mjs"], [workflow(PR_STEP("npm run test:a:sub"))], scripts), ["a.test.mjs"]);
  });

  test("a glob is not followed (fails closed: call the test by name)", () => {
    assert.deepEqual(unwired(["a.test.mjs"], [workflow(PR_STEP("node --test scripts/ci/*.test.mjs"))]), ["a.test.mjs"]);
  });
});

describe("repository", () => {
  test("every scripts/ci/*.test.mjs runs in a pull_request step that can fail", () => {
    const inputs = loadRepoWiringInputs(REPO_ROOT);
    assert.ok(inputs.testFiles.includes("ci-test-wiring.test.mjs"), "the guard must see its own test");
    assert.deepEqual(findUnwiredTests(inputs), []);
  });
});
