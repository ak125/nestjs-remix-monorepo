/**
 * Behavioural proof of the PREPROD evidence gate (prod-preprod-evidence.mjs).
 *
 * The SHA gate in deploy-prod.yml proves only that :preprod was BUILT from the
 * tagged commit; build.yml publishes it before ci.yml validates it. f54aa333f
 * (2026-09-28) failed "🧪 Deploy PREPROD" with a correctly labelled :preprod.
 * These tests assert:
 *
 *   1. the verdict is `success` ×3 or nothing: failure, skipped, cancelled,
 *      in-progress, absent (renamed) or duplicated jobs all block;
 *   2. the latest ci.yml run of the exact commit is the one judged;
 *   3. end-to-end against a REAL local HTTP server: the query is scoped to the
 *      commit / push / main / latest execution, and every API or config
 *      failure exits non-zero;
 *   4. the job names the gate requires are the ones ci.yml defines, and
 *      deploy-prod.yml runs the gate before any Docker step with `actions: read`.
 *
 * Run: node --test scripts/ci/prod-preprod-evidence.test.mjs
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import {
  REQUIRED_JOBS,
  assessJobs,
  selectRun,
} from "./prod-preprod-evidence.mjs";

// MUST be async: the stub API server lives in THIS process; a synchronous
// child would block the event loop and the server could never answer.
const execFileAsync = promisify(execFile);

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(SCRIPT_DIR, "prod-preprod-evidence.mjs");
const WORKFLOWS = join(SCRIPT_DIR, "..", "..", ".github", "workflows");

const SHA = "f54aa333f90608117be52d6ed6e6805787b063bd";
const OTHER_SHA = "d5c44ffc85737a22477408a5426fc543236a69d6";

function job(name, status, conclusion) {
  return { name, status, conclusion };
}

// Shape of the real API answer for run 36494601192 (f54aa333f, 2026-09-28).
const F54_JOBS = [
  job("🐳 build / 🐳 Build", "completed", "success"),
  job("🧪 Deploy PREPROD", "completed", "failure"),
  job("🎭 E2E Smoke Tests", "completed", "skipped"),
  job("🔦 Lighthouse Performance Audit", "completed", "skipped"),
  job("🔔 Notify on Failure", "completed", "success"),
];
const GREEN_JOBS = REQUIRED_JOBS.map(({ name }) =>
  job(name, "completed", "success"),
);

describe("verdict", () => {
  test("three successful jobs prove the commit", () => {
    const verdict = assessJobs([
      job("⬣ ESLint", "completed", "success"),
      ...GREEN_JOBS,
    ]);
    assert.equal(verdict.ok, true);
    assert.deepEqual(
      verdict.rows.map((row) => row.state),
      ["success", "success", "success"],
    );
  });

  test("f54aa333f: a failed Deploy PREPROD blocks, skipped smokes are not a pass", () => {
    const verdict = assessJobs(F54_JOBS);
    assert.equal(verdict.ok, false);
    assert.deepEqual(
      verdict.rows.map((row) => row.state),
      ["failure", "skipped", "skipped"],
    );
  });

  for (const [label, jobs, expected] of [
    [
      "a run still in progress",
      [
        GREEN_JOBS[0],
        GREEN_JOBS[1],
        job(REQUIRED_JOBS[2].name, "in_progress", null),
      ],
      "in_progress",
    ],
    [
      "a cancelled job",
      [
        GREEN_JOBS[0],
        GREEN_JOBS[1],
        job(REQUIRED_JOBS[2].name, "completed", "cancelled"),
      ],
      "cancelled",
    ],
    ["a renamed (absent) job", GREEN_JOBS.slice(0, 2), "absent"],
    ["a duplicated job name", [...GREEN_JOBS, GREEN_JOBS[2]], "ambigu"],
  ]) {
    test(`${label} blocks`, () => {
      const verdict = assessJobs(jobs);
      assert.equal(verdict.ok, false);
      assert.equal(verdict.rows[2].state, expected);
    });
  }

  test("no job at all blocks", () => {
    assert.equal(assessJobs([]).ok, false);
  });
});

describe("run selection", () => {
  test("the most recent run of the exact commit is judged", () => {
    const runs = [
      { id: 1, head_sha: SHA, created_at: "2026-09-28T22:49:11Z" },
      { id: 2, head_sha: SHA, created_at: "2026-09-29T08:00:00Z" },
      { id: 3, head_sha: OTHER_SHA, created_at: "2026-09-30T00:00:00Z" },
    ];
    assert.equal(selectRun(SHA, runs).id, 2);
  });

  test("a run of another commit never stands in for the tagged one", () => {
    assert.equal(
      selectRun(SHA, [
        { id: 3, head_sha: OTHER_SHA, created_at: "2026-09-30T00:00:00Z" },
      ]),
      null,
    );
    assert.equal(selectRun(SHA, []), null);
  });
});

describe("end-to-end against a local GitHub API", () => {
  let server;
  let apiUrl;
  let requests;
  // Per-test answers: runs list, jobs list, and an optional forced status.
  let scenario;

  before(async () => {
    server = createServer((req, res) => {
      const url = new URL(req.url, "http://localhost");
      requests.push({
        path: url.pathname,
        query: url.searchParams,
        auth: req.headers.authorization,
      });
      if (scenario.status) return res.writeHead(scenario.status).end("{}");
      res.writeHead(200, { "Content-Type": "application/json" });
      if (url.pathname.endsWith("/actions/workflows/ci.yml/runs")) {
        return res.end(JSON.stringify({ workflow_runs: scenario.runs }));
      }
      if (/\/actions\/runs\/\d+\/jobs$/.test(url.pathname)) {
        return res.end(JSON.stringify({ jobs: scenario.jobs }));
      }
      return res.writeHead(404).end("{}");
    });
    await new Promise((done) => server.listen(0, "127.0.0.1", done));
    apiUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => server.close());

  async function runGate(env = {}) {
    requests = [];
    try {
      const { stdout } = await execFileAsync(process.execPath, [SCRIPT], {
        env: {
          PATH: process.env.PATH,
          GITHUB_API_URL: apiUrl,
          GITHUB_REPOSITORY: "owner/repo",
          GITHUB_SHA: SHA,
          GITHUB_TOKEN: "test-token",
          ...env,
        },
      });
      return { code: 0, output: stdout };
    } catch (error) {
      return { code: error.code, output: `${error.stdout}${error.stderr}` };
    }
  }

  const RUN = {
    id: 36494601192,
    head_sha: SHA,
    created_at: "2026-09-28T22:49:11Z",
    html_url: "https://example.test/runs/36494601192",
  };

  test("a proven commit passes, with a query scoped to it", async () => {
    scenario = { runs: [RUN], jobs: GREEN_JOBS };
    const { code, output } = await runGate();
    assert.equal(code, 0, output);
    assert.match(output, /Validation PREPROD prouvée/);

    const [runsCall, jobsCall] = requests;
    assert.equal(
      runsCall.path,
      "/repos/owner/repo/actions/workflows/ci.yml/runs",
    );
    assert.equal(runsCall.query.get("head_sha"), SHA);
    assert.equal(runsCall.query.get("event"), "push");
    assert.equal(runsCall.query.get("branch"), "main");
    assert.equal(
      jobsCall.path,
      `/repos/owner/repo/actions/runs/${RUN.id}/jobs`,
    );
    assert.equal(jobsCall.query.get("filter"), "latest");
    for (const call of requests) assert.equal(call.auth, "Bearer test-token");
  });

  test("f54aa333f is refused, with the failing job named", async () => {
    scenario = { runs: [RUN], jobs: F54_JOBS };
    const { code, output } = await runGate();
    assert.equal(code, 1);
    assert.match(output, /❌ 🧪 Deploy PREPROD : failure/);
    assert.match(output, /Aucune mutation n'a eu lieu/);
    assert.match(output, /Re-run failed jobs/);
  });

  test("an unfinished validation is refused and says to wait", async () => {
    scenario = {
      runs: [RUN],
      jobs: [
        GREEN_JOBS[0],
        job(REQUIRED_JOBS[1].name, "in_progress", null),
        job(REQUIRED_JOBS[2].name, "queued", null),
      ],
    };
    const { code, output } = await runGate();
    assert.equal(code, 1);
    assert.match(output, /Attendre la fin du run ci\.yml/);
  });

  test("a commit with no ci.yml push run on main is refused", async () => {
    scenario = { runs: [], jobs: [] };
    const { code, output } = await runGate();
    assert.equal(code, 1);
    assert.match(output, /aucun run ci\.yml/);
    assert.equal(requests.length, 1, "jobs must not be fetched without a run");
  });

  for (const status of [401, 403, 404, 500]) {
    test(`an API answer ${status} is refused (fail-closed)`, async () => {
      scenario = { status };
      const { code, output } = await runGate();
      assert.equal(code, 1);
      assert.match(output, /preuve PREPROD impossible à établir/);
    });
  }

  for (const name of [
    "GITHUB_TOKEN",
    "GITHUB_SHA",
    "GITHUB_REPOSITORY",
    "GITHUB_API_URL",
  ]) {
    test(`a missing ${name} is refused before any request`, async () => {
      scenario = { runs: [RUN], jobs: GREEN_JOBS };
      const { code, output } = await runGate({ [name]: "" });
      assert.equal(code, 1);
      assert.match(output, /variable requise absente/);
      assert.equal(requests.length, 0);
    });
  }
});

describe("workflow wiring", () => {
  const ci = readFileSync(join(WORKFLOWS, "ci.yml"), "utf8");
  const deploy = readFileSync(join(WORKFLOWS, "deploy-prod.yml"), "utf8");

  test("every required job is defined in ci.yml under that exact display name", () => {
    // A rename would make the gate refuse every tag ("absent"): fail here, at PR
    // time, instead of at the next PROD deploy.
    for (const { key, name } of REQUIRED_JOBS) {
      assert.ok(
        ci.includes(`\n  ${key}:\n    name: ${name}\n`),
        `ci.yml must define job "${key}" named "${name}"`,
      );
    }
  });

  test("deploy-prod.yml runs the gate before any Docker step", () => {
    const gate = deploy.indexOf("node scripts/ci/prod-preprod-evidence.mjs");
    const firstDocker = deploy.indexOf("uses: docker/login-action");
    assert.ok(gate > 0, "deploy-prod.yml must run prod-preprod-evidence.mjs");
    assert.ok(firstDocker > 0, "docker/login-action step not found");
    assert.ok(gate < firstDocker, "the gate must run before any Docker step");
  });

  test("the gate step can read Actions and cannot be skipped", () => {
    assert.match(deploy, /\npermissions:\n(?: {2}\S.*\n)*? {2}actions: read\n/);
    const start = deploy.lastIndexOf(
      "\n      - name:",
      deploy.indexOf("node scripts/ci/prod-preprod-evidence.mjs"),
    );
    const end = deploy.indexOf("\n      - name:", start + 1);
    const step = deploy.slice(start, end);
    assert.match(step, /GITHUB_TOKEN: \$\{\{ github\.token \}\}/);
    assert.doesNotMatch(step, /continue-on-error|\n {8}if:/);
  });
});
