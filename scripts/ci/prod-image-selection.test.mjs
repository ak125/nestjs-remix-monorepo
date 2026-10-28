import { test } from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  chmodSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// Execute the workflow's real promotion blocks. Only Docker (an external,
// mutating boundary) is replaced; these tests never contact a registry/daemon.
const workflow = readFileSync(
  new URL("../../.github/workflows/deploy-prod.yml", import.meta.url),
  "utf8",
);

function stepRun(name) {
  const start = workflow.indexOf(`      - name: ${name}`);
  assert.ok(start >= 0, `${name} step must exist`);
  const end = workflow.indexOf("\n      - name:", start + 1);
  const step = workflow.slice(start, end);
  return step
    .slice(step.indexOf("        run: |\n") + "        run: |\n".length)
    .split("\n")
    .map((line) => line.replace(/^          /, ""))
    .join("\n")
    .replaceAll("${{ github.ref_name }}", "${GITHUB_REF_NAME}");
}

const gate = stepRun("🔒 Safety gate");
const PONR = 'echo "DEPLOY_STARTED=1" >> "$GITHUB_ENV"';

// The Deploy step from its last check before the point of no return up to the
// stop of the running container: the only place :production may move.
function promotionBlock() {
  const deploy = stepRun("🚀 Deploy to PROD");
  const start = deploy.indexOf('if [[ ! "${PROMOTED_IMAGE_ID:-}"');
  const end = deploy.indexOf("docker stop nestjs-remix-caddy");
  assert.ok(
    start >= 0 && start < deploy.indexOf(PONR),
    "the promoted ID must be checked before the point of no return",
  );
  assert.ok(
    end > deploy.indexOf(PONR),
    "stop must follow the point of no return",
  );
  return deploy.slice(start, end);
}

const SHA = "a".repeat(40);
const OTHER_SHA = "b".repeat(40);
const ID = `sha256:${"1".repeat(64)}`;
const OTHER_ID = `sha256:${"2".repeat(64)}`;
const REPO = "massdoc/nestjs-remix-monorepo";
const SOURCE = `${REPO}:sha-${SHA}`;
const RELEASE = `${REPO}:v-test-release`;
const PRODUCTION = `${REPO}:production`;
// PROD runs OTHER_ID: :production names it locally and in the registry.
const LIVE = {
  registry: {
    [SOURCE]: ID,
    [`${REPO}:preprod`]: OTHER_ID,
    [PRODUCTION]: OTHER_ID,
  },
  local: { [SOURCE]: ID, [PRODUCTION]: OTHER_ID },
};

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

function execute(script, { state = {}, env = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "prod-image-selection-"));
  try {
    const statePath = join(dir, "state.json");
    const githubEnv = join(dir, "github-env");
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
    const result = spawnSync("bash", ["-e", "-c", script], {
      encoding: "utf8",
      timeout: 10000,
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH}`,
        DOCKER_STATE: statePath,
        GITHUB_SHA: SHA,
        GITHUB_REF_NAME: "v-test-release",
        GITHUB_ENV: githubEnv,
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
      githubEnv: existsSync(githubEnv) ? readFileSync(githubEnv, "utf8") : "",
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const promote = (options) => execute(gate, options);
const startDeploy = (options) => execute(promotionBlock(), options);

test("promotes the requested commit when the shared preprod alias has advanced", () => {
  const result = promote({ state: LIVE });
  assert.equal(result.code, 0, result.output);
  assert.equal(result.state.registry[RELEASE], ID);
  assert.match(result.githubEnv, new RegExp(`^PROMOTED_IMAGE_ID=${ID}$`, "m"));
  assert.equal(result.state.registry[`${REPO}:preprod`], OTHER_ID);
  assert.ok(
    !result.state.calls.some((a) => a.includes(`${REPO}:preprod`)),
    "never consult the shared alias",
  );
});

test("the safety gate leaves :production on the running build", () => {
  const result = promote({ state: LIVE });
  assert.equal(result.code, 0, result.output);
  assert.equal(result.state.registry[PRODUCTION], OTHER_ID);
  assert.equal(result.state.local[PRODUCTION], OTHER_ID);
  assert.ok(
    !result.state.calls.some((a) => a.includes(PRODUCTION)),
    result.output,
  );
});

test("promotes the inspected immutable ID even if the commit alias moves afterwards", () => {
  const result = promote({ state: { moveAfterInspect: true } });
  assert.equal(result.code, 0, result.output);
  assert.equal(result.state.registry[RELEASE], ID);
  assert.match(result.githubEnv, new RegExp(`^PROMOTED_IMAGE_ID=${ID}$`, "m"));
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

test("a failed release push fails the step before the deploy can use the ID", () => {
  const result = promote({ state: { failPush: RELEASE } });
  assert.notEqual(result.code, 0, result.output);
  assert.doesNotMatch(result.githubEnv, /PROMOTED_IMAGE_ID=/);
});

// The Deploy step refuses a bad .env or flag before its point of no return, and
// the rollback step only runs past it: :production must not move earlier.
test("nothing moves :production before the deploy's point of no return", () => {
  const ponr = workflow.indexOf(PONR);
  assert.ok(ponr >= 0, "point of no return must exist");
  const early = workflow
    .slice(0, ponr)
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .filter((line) =>
      /docker\s+(tag|push|pull)\b.*:production(?![-\w])/.test(line),
    );
  assert.deepEqual(early, []);
});

test("the rollback step runs on any failure past the point of no return", () => {
  const start = workflow.indexOf("      - name: ⏪ Rollback PROD");
  assert.ok(start >= 0, "rollback step must exist");
  assert.match(
    workflow.slice(start).split("\n      - name:")[0],
    /if: \$\{\{ failure\(\) && env\.DEPLOY_STARTED == '1' \}\}/,
  );
});

test("moves :production to the verified ID only past the point of no return", () => {
  const result = startDeploy({ state: LIVE, env: { PROMOTED_IMAGE_ID: ID } });
  assert.equal(result.code, 0, result.output);
  assert.match(result.githubEnv, /^DEPLOY_STARTED=1$/m);
  assert.equal(result.state.local[PRODUCTION], ID);
  assert.equal(result.state.registry[PRODUCTION], ID);
});

for (const value of ["", "bad-id", OTHER_SHA]) {
  test(`refuses a missing or invalid promoted ID before the point of no return: ${JSON.stringify(value)}`, () => {
    const result = startDeploy({
      state: LIVE,
      env: { PROMOTED_IMAGE_ID: value },
    });
    assert.notEqual(result.code, 0, result.output);
    assert.equal(result.state.calls.length, 0);
    assert.doesNotMatch(result.githubEnv, /DEPLOY_STARTED=/);
  });
}

test("a failed production push fails past the point of no return, so the rollback runs", () => {
  const result = startDeploy({
    state: { ...LIVE, failPush: PRODUCTION },
    env: { PROMOTED_IMAGE_ID: ID },
  });
  assert.notEqual(result.code, 0, result.output);
  assert.match(result.githubEnv, /^DEPLOY_STARTED=1$/m);
  assert.equal(result.state.registry[PRODUCTION], OTHER_ID);
});
