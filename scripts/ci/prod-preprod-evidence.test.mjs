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
 *   2. the latest ci.yml push run on main of the exact commit is the one
 *      judged: another workflow, event, branch or commit never stands in;
 *   3. end-to-end against a REAL local HTTP server: the run is found from the
 *      commit's check runs, never from the workflow-run listing (which returned
 *      nothing for a validated commit on 2026-09-30), and every API, config or
 *      consistency failure exits non-zero;
 *   4. the job names the gate requires are the ones ci.yml defines, and
 *      deploy-prod.yml runs the gate before any Docker step with `actions: read`
 *      and `checks: read`.
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

// A ci.yml push run on main; `over` changes one field of its scope.
function ciRun(id, created_at, over = {}) {
  return {
    id,
    head_sha: SHA,
    path: ".github/workflows/ci.yml",
    event: "push",
    head_branch: "main",
    created_at,
    html_url: `https://example.test/runs/${id}`,
    ...over,
  };
}

describe("run selection", () => {
  test("the most recent run of the exact commit is judged", () => {
    const runs = [
      ciRun(1, "2026-09-28T22:49:11Z"),
      ciRun(2, "2026-09-29T08:00:00Z"),
      ciRun(3, "2026-09-30T00:00:00Z", { head_sha: OTHER_SHA }),
    ];
    assert.equal(selectRun(SHA, runs).id, 2);
  });

  for (const [what, over] of [
    ["another commit", { head_sha: OTHER_SHA }],
    ["another workflow", { path: ".github/workflows/build.yml" }],
    ["a pull_request run", { event: "pull_request" }],
    ["another branch", { head_branch: "feat/x" }],
  ]) {
    test(`a run of ${what} never stands in for the tagged one`, () => {
      assert.equal(selectRun(SHA, [ciRun(3, "2026-09-30T00:00:00Z", over)]), null);
    });
  }

  test("no run, no verdict", () => {
    assert.equal(selectRun(SHA, []), null);
  });
});

describe("end-to-end against a local GitHub API", () => {
  let server;
  let apiUrl;
  let requests;
  // Per-test answers: the commit's check runs (each naming the run of its job),
  // the runs by id, the judged run's jobs, and an optional forced status.
  // `jobCheckRunUrl` overrides what the job endpoint says about its check run.
  let scenario;

  const send = (res, body) =>
    res
      .writeHead(200, { "Content-Type": "application/json" })
      .end(JSON.stringify(body));

  before(async () => {
    server = createServer((req, res) => {
      const url = new URL(req.url, "http://localhost");
      requests.push({
        path: url.pathname,
        query: url.searchParams,
        auth: req.headers.authorization,
      });
      if (scenario.status) return res.writeHead(scenario.status).end("{}");
      let match;
      if (url.pathname.endsWith("/actions/workflows/ci.yml/runs")) {
        // The listing as it answered on 2026-09-30 for a validated commit.
        return send(res, { total_count: 0, workflow_runs: [] });
      }
      if (url.pathname === `/repos/owner/repo/commits/${SHA}/check-runs`) {
        const named = scenario.checkRuns.filter(
          (run) => run.name === url.searchParams.get("check_name"),
        );
        return send(res, {
          total_count: scenario.totalCount ?? named.length,
          check_runs: named,
        });
      }
      if ((match = url.pathname.match(/\/actions\/jobs\/(\d+)$/))) {
        const checkRun = scenario.checkRuns.find(
          (run) => String(run.id) === match[1],
        );
        if (!checkRun) return res.writeHead(404).end("{}");
        return send(res, {
          id: checkRun.id,
          run_id: checkRun.run_id,
          check_run_url:
            scenario.jobCheckRunUrl ??
            `https://api.github.com/repos/owner/repo/check-runs/${checkRun.id}`,
        });
      }
      if ((match = url.pathname.match(/\/actions\/runs\/(\d+)\/jobs$/))) {
        return send(res, { jobs: scenario.jobs });
      }
      if ((match = url.pathname.match(/\/actions\/runs\/(\d+)$/))) {
        const run = scenario.runs.find((r) => String(r.id) === match[1]);
        return run ? send(res, run) : res.writeHead(404).end("{}");
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

  const RUN = ciRun(36494601192, "2026-09-28T22:49:11Z");

  // One check run per required job, recorded by `run` (ids as the API gives them:
  // an Actions check-run id is its job id).
  function checkRunsOf(run, app = "github-actions") {
    return REQUIRED_JOBS.map(({ name }, i) => ({
      id: run.id * 10 + i,
      name,
      app: { slug: app },
      run_id: run.id,
    }));
  }

  const proven = (jobs) => ({
    checkRuns: checkRunsOf(RUN),
    runs: [RUN],
    jobs,
  });

  test("a proven commit passes from its check runs, without the run listing", async () => {
    scenario = proven(GREEN_JOBS);
    const { code, output } = await runGate();
    assert.equal(code, 0, output);
    assert.match(output, /Validation PREPROD prouvée/);

    assert.ok(
      requests.every((call) => !call.path.includes("/actions/workflows/")),
      "the workflow-run listing must not be consulted",
    );
    const checkCalls = requests.filter((call) =>
      call.path.endsWith(`/commits/${SHA}/check-runs`),
    );
    assert.deepEqual(
      checkCalls.map((call) => call.query.get("check_name")),
      REQUIRED_JOBS.map(({ name }) => name),
    );
    for (const call of checkCalls) assert.equal(call.query.get("filter"), "all");
    assert.ok(
      requests.some((call) => call.path === `/repos/owner/repo/actions/runs/${RUN.id}`),
      "the run must be read by id",
    );
    const jobsCall = requests.at(-1);
    assert.equal(
      jobsCall.path,
      `/repos/owner/repo/actions/runs/${RUN.id}/jobs`,
    );
    assert.equal(jobsCall.query.get("filter"), "latest");
    for (const call of requests) assert.equal(call.auth, "Bearer test-token");
  });

  test("the latest re-run of the commit is judged", async () => {
    const rerun = ciRun(36600000000, "2026-09-29T08:00:00Z");
    scenario = {
      checkRuns: [...checkRunsOf(RUN), ...checkRunsOf(rerun)],
      runs: [RUN, rerun],
      jobs: GREEN_JOBS,
    };
    const { code, output } = await runGate();
    assert.equal(code, 0, output);
    assert.equal(
      requests.at(-1).path,
      `/repos/owner/repo/actions/runs/${rerun.id}/jobs`,
    );
  });

  test("f54aa333f is refused, with the failing job named", async () => {
    scenario = proven(F54_JOBS);
    const { code, output } = await runGate();
    assert.equal(code, 1);
    assert.match(output, /❌ 🧪 Deploy PREPROD : failure/);
    assert.match(output, /Aucune mutation n'a eu lieu/);
    assert.match(output, /Re-run failed jobs/);
  });

  test("an unfinished validation is refused and says to wait", async () => {
    scenario = proven([
      GREEN_JOBS[0],
      job(REQUIRED_JOBS[1].name, "in_progress", null),
      job(REQUIRED_JOBS[2].name, "queued", null),
    ]);
    const { code, output } = await runGate();
    assert.equal(code, 1);
    assert.match(output, /Attendre la fin du run ci\.yml/);
  });

  test("a commit with no ci.yml push run on main is refused", async () => {
    scenario = { checkRuns: [], runs: [], jobs: [] };
    const { code, output } = await runGate();
    assert.equal(code, 1);
    assert.match(output, /aucun run ci\.yml/);
    assert.equal(
      requests.length,
      REQUIRED_JOBS.length,
      "only the check runs are read without a run",
    );
  });

  for (const [what, over] of [
    ["another workflow", { path: ".github/workflows/build.yml" }],
    ["a pull_request run", { event: "pull_request" }],
    ["another branch", { head_branch: "feat/x" }],
  ]) {
    test(`green jobs of ${what} are refused`, async () => {
      const run = ciRun(RUN.id, RUN.created_at, over);
      scenario = { checkRuns: checkRunsOf(run), runs: [run], jobs: GREEN_JOBS };
      const { code, output } = await runGate();
      assert.equal(code, 1);
      assert.match(output, /aucun run ci\.yml/);
    });
  }

  test("check runs of another app are not evidence", async () => {
    scenario = {
      checkRuns: checkRunsOf(RUN, "some-other-app"),
      runs: [RUN],
      jobs: GREEN_JOBS,
    };
    const { code, output } = await runGate();
    assert.equal(code, 1);
    assert.match(output, /aucun run ci\.yml/);
    assert.ok(requests.every((call) => !call.path.includes("/actions/")));
  });

  test("a job that does not match its check run is refused (fail-closed)", async () => {
    scenario = {
      ...proven(GREEN_JOBS),
      jobCheckRunUrl: "https://api.github.com/repos/owner/repo/check-runs/1",
    };
    const { code, output } = await runGate();
    assert.equal(code, 1);
    assert.match(output, /preuve PREPROD impossible à établir/);
  });

  test("check runs beyond one page are refused (fail-closed)", async () => {
    scenario = { ...proven(GREEN_JOBS), totalCount: 101 };
    const { code, output } = await runGate();
    assert.equal(code, 1);
    assert.match(output, /preuve PREPROD impossible à établir/);
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
      scenario = proven(GREEN_JOBS);
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

  test("the gate step can read Actions and checks and cannot be skipped", () => {
    assert.match(deploy, /\npermissions:\n(?: {2}\S.*\n)*? {2}actions: read\n/);
    assert.match(deploy, /\npermissions:\n(?: {2}\S.*\n)*? {2}checks: read\n/);
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
