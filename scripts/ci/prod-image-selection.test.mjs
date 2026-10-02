import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  chmodSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// Execute the workflow's real promotion block. Only Docker (an external,
// mutating boundary) is replaced; these tests never contact a registry/daemon.
const workflow = readFileSync(
  new URL("../../.github/workflows/deploy-prod.yml", import.meta.url),
  "utf8",
);
const start = workflow.indexOf("      - name: 🔒 Safety gate");
assert.ok(start >= 0, "promotion step must exist");
const end = workflow.indexOf("\n      - name:", start + 1);
const step = workflow.slice(start, end);
const run = step
  .slice(step.indexOf("        run: |\n") + "        run: |\n".length)
  .split("\n")
  .map((line) => line.replace(/^          /, ""))
  .join("\n")
  .replaceAll("${{ github.ref_name }}", "${GITHUB_REF_NAME}");

const SHA = "a".repeat(40);
const OTHER_SHA = "b".repeat(40);
const ID = `sha256:${"1".repeat(64)}`;
const OTHER_ID = `sha256:${"2".repeat(64)}`;
const REPO = "massdoc/nestjs-remix-monorepo";
const SOURCE = `${REPO}:sha-${SHA}`;
const RELEASE = `${REPO}:v-test-release`;

// A stateful Docker boundary: registry aliases, local aliases and immutable IDs
// are distinct. Moving an alias after inspection must not change the promoted ID.
const docker = `#!/usr/bin/env node
const fs = require('node:fs');
const path = process.env.DOCKER_STATE;
const s = JSON.parse(fs.readFileSync(path, 'utf8'));
const a = process.argv.slice(2);
s.calls.push(a);
const save = () => fs.writeFileSync(path, JSON.stringify(s));
const fail = () => { save(); process.exit(1); };
if (a[0] === 'pull') {
  if (s.failPull || !s.registry[a[1]]) fail();
  s.local[a[1]] = s.registry[a[1]];
} else if (a[0] === 'inspect') {
  if (s.failInspect) fail();
  const ref = a.find(x => x.startsWith(s.repo + ':') || x.startsWith('sha256:'));
  const id = s.local[ref] || (s.images[ref] && ref);
  const img = s.images[id];
  if (!img) fail();
  const format = a[a.indexOf('--format') + 1];
  console.log(format.includes('.Id') ? id + ' ' + (img.revision || '<no value>') : (img.revision || '<no value>'));
  if (s.moveAfterInspect) s.local[s.source] = s.otherId;
} else if (a[0] === 'tag') {
  const id = s.local[a[1]] || (s.images[a[1]] && a[1]);
  if (!id) fail();
  s.local[a[2]] = id;
} else if (a[0] === 'push') {
  if (s.failPush === a[1] || !s.local[a[1]]) fail();
  s.registry[a[1]] = s.local[a[1]];
} else fail();
save();
`;

function promote({ state = {}, env = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "prod-image-selection-"));
  try {
    const statePath = join(dir, "state.json");
    writeFileSync(
      statePath,
      JSON.stringify({
        repo: REPO,
        source: SOURCE,
        otherId: OTHER_ID,
        images: {
          [ID]: { revision: SHA },
          [OTHER_ID]: { revision: OTHER_SHA },
        },
        registry: { [SOURCE]: ID, [`${REPO}:preprod`]: OTHER_ID },
        local: { [SOURCE]: ID },
        calls: [],
        ...state,
      }),
    );
    writeFileSync(join(dir, "docker"), docker);
    chmodSync(join(dir, "docker"), 0o755);
    const result = spawnSync("bash", ["-e", "-c", run], {
      encoding: "utf8",
      timeout: 10000,
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH}`,
        DOCKER_STATE: statePath,
        GITHUB_SHA: SHA,
        GITHUB_REF_NAME: "v-test-release",
        GITHUB_ENV: join(dir, "github-env"),
        ...env,
      },
    });
    assert.ifError(result.error);
    assert.ok(
      Number.isInteger(result.status),
      "promotion shell must exit normally",
    );
    return {
      code: result.status,
      output: result.stdout + result.stderr,
      state: JSON.parse(readFileSync(statePath, "utf8")),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("promotes the requested commit when the shared preprod alias has advanced", () => {
  const result = promote();
  assert.equal(result.code, 0, result.output);
  assert.equal(result.state.registry[`${REPO}:production`], ID);
  assert.equal(result.state.registry[RELEASE], ID);
  assert.equal(result.state.registry[`${REPO}:preprod`], OTHER_ID);
  assert.ok(
    !result.state.calls.some((a) => a.includes(`${REPO}:preprod`)),
    "never consult the shared alias",
  );
});

test("promotes the inspected immutable ID even if the commit alias moves afterwards", () => {
  const result = promote({ state: { moveAfterInspect: true } });
  assert.equal(result.code, 0, result.output);
  assert.equal(result.state.registry[`${REPO}:production`], ID);
  assert.equal(result.state.registry[RELEASE], ID);
});

for (const [name, state] of [
  ["missing commit image", { registry: { [`${REPO}:preprod`]: OTHER_ID } }],
  ["failed pull despite a cached local image", { failPull: true }],
  ["failed image inspection", { failInspect: true }],
  [
    "wrong revision label",
    {
      images: {
        [ID]: { revision: OTHER_SHA },
        [OTHER_ID]: { revision: OTHER_SHA },
      },
    },
  ],
  ["missing revision label", { images: { [ID]: {}, [OTHER_ID]: {} } }],
  [
    "invalid immutable ID",
    {
      registry: { [SOURCE]: "bad-id" },
      images: { "bad-id": { revision: SHA } },
    },
  ],
]) {
  test(`refuses ${name} before changing any registry tag`, () => {
    const result = promote({ state });
    assert.notEqual(result.code, 0, result.output);
    assert.ok(
      !result.state.calls.some((a) => ["tag", "push"].includes(a[0])),
      result.output,
    );
  });
}

for (const env of [
  { GITHUB_SHA: "" },
  { GITHUB_SHA: "not-a-commit" },
  { GITHUB_REF_NAME: "" },
  { GITHUB_REF_NAME: "v-invalid/tag" },
]) {
  test(`refuses invalid release input before Docker: ${JSON.stringify(env)}`, () => {
    const result = promote({ env });
    assert.notEqual(result.code, 0, result.output);
    assert.equal(result.state.calls.length, 0);
  });
}

test("a failed production push fails the step and does not publish the release tag", () => {
  const result = promote({ state: { failPush: `${REPO}:production` } });
  assert.notEqual(result.code, 0, result.output);
  assert.equal(result.state.registry[RELEASE], undefined);
});
