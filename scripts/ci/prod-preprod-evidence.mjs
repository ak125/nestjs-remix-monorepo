import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

// PREPROD evidence gate — runs in deploy-prod.yml BEFORE any PROD mutation.
//
// The SHA gate proves PROVENANCE: the :preprod image was built from the tagged
// commit (INC-2026-006). It does not prove VALIDATION: build.yml publishes
// :preprod before ci.yml deploys the PREPROD container and runs E2E Smoke and
// Lighthouse. On 2026-09-28, f54aa333f failed "🧪 Deploy PREPROD" (E2E Smoke and
// Lighthouse never ran), yet its :preprod carried the right label, so a tag on
// that commit would have passed the SHA gate and reached PROD.
//
// This gate requires, for the exact tagged commit, the ci.yml push run on main
// with each job below `success` in its latest execution. Read-only; fail-closed
// on anything else (pending, failed, skipped, cancelled, missing, API error).
//
// The run is found from the commit's own check runs, never from the workflow-run
// listing. On 2026-09-30 that listing, filtered on head_sha/event/branch, returned
// nothing for 8bd2c6fce whose ci.yml run 36607311640 had existed for 20 h (created
// 2026-09-29T17:46Z, all three jobs green): deploy-prod run 36726344534 refused a
// validated commit. For an Actions job the check-run id is the job id; the job
// object confirms it (check_run_url) and names its run, which is read by id.

export const CI_WORKFLOW = "ci.yml";
const CI_WORKFLOW_PATH = `.github/workflows/${CI_WORKFLOW}`;
const ACTIONS_APP = "github-actions";

// `key` is the job id in ci.yml, `name` its display name (what the API returns).
// ci.yml chains them: deploy → e2e-smoke → lighthouse.
export const REQUIRED_JOBS = [
  { key: "deploy", name: "🧪 Deploy PREPROD" },
  { key: "e2e-smoke", name: "🎭 E2E Smoke Tests" },
  { key: "lighthouse", name: "🔦 Lighthouse Performance Audit" },
];

// Picks the most recent ci.yml push run on main of `sha`. `runs` are the runs
// the commit's check runs point to, read by id: any workflow, event or branch
// can appear, so the whole scope is checked here.
export function selectRun(sha, runs) {
  return (
    runs
      .filter(
        (run) =>
          run.head_sha === sha &&
          run.path === CI_WORKFLOW_PATH &&
          run.event === "push" &&
          run.head_branch === "main",
      )
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0] ??
    null
  );
}

// Verdict over the latest-execution jobs of the selected run.
// Returns { ok, rows } where each row is { name, state }.
export function assessJobs(jobs) {
  const rows = REQUIRED_JOBS.map(({ name }) => {
    const matches = jobs.filter((job) => job.name === name);
    if (matches.length !== 1) {
      return { name, state: matches.length === 0 ? "absent" : "ambigu" };
    }
    const [job] = matches;
    return {
      name,
      state:
        job.status === "completed" ? (job.conclusion ?? "inconnu") : job.status,
    };
  });
  return { ok: rows.every((row) => row.state === "success"), rows };
}

async function getJson(url, token, fetchRequest) {
  const response = await fetchRequest(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status} sur ${url}`);
  }
  return response.json();
}

export async function checkPreprodEvidence(
  { apiUrl, repository, sha, token },
  fetchRequest = fetch,
) {
  for (const [name, value] of Object.entries({
    apiUrl,
    repository,
    sha,
    token,
  })) {
    if (!value) throw new Error(`variable requise absente : ${name}`);
  }
  const repoApi = `${apiUrl}/repos/${repository}`;
  const runs = await findRuns(repoApi, sha, token, fetchRequest);
  const run = selectRun(sha, runs);
  if (!run) return { ok: false, run: null, rows: [] };
  const { jobs = [] } = await getJson(
    `${repoApi}/actions/runs/${run.id}/jobs?filter=latest&per_page=100`,
    token,
    fetchRequest,
  );
  return { run, ...assessJobs(jobs) };
}

// Runs that recorded a required job on `sha`, read by id (all attempts, all
// workflows: selectRun keeps the scope).
async function findRuns(repoApi, sha, token, fetchRequest) {
  const runIds = new Set();
  for (const { name } of REQUIRED_JOBS) {
    const params = new URLSearchParams({
      check_name: name,
      filter: "all",
      per_page: "100",
    });
    const { total_count: total = 0, check_runs: checkRuns = [] } =
      await getJson(
        `${repoApi}/commits/${sha}/check-runs?${params}`,
        token,
        fetchRequest,
      );
    if (total > checkRuns.length) {
      throw new Error(
        `${total} check runs « ${name} » sur ce commit, au-delà d'une page`,
      );
    }
    for (const checkRun of checkRuns) {
      if (checkRun.app?.slug !== ACTIONS_APP) continue;
      const job = await getJson(
        `${repoApi}/actions/jobs/${checkRun.id}`,
        token,
        fetchRequest,
      );
      if (!job.check_run_url?.endsWith(`/check-runs/${checkRun.id}`)) {
        throw new Error(
          `le job ${checkRun.id} ne correspond pas au check run « ${name} »`,
        );
      }
      runIds.add(job.run_id);
    }
  }
  const runs = [];
  for (const id of runIds) {
    runs.push(await getJson(`${repoApi}/actions/runs/${id}`, token, fetchRequest));
  }
  return runs;
}

async function main() {
  const sha = process.env.GITHUB_SHA;
  const result = await checkPreprodEvidence({
    apiUrl: process.env.GITHUB_API_URL,
    repository: process.env.GITHUB_REPOSITORY,
    sha,
    token: process.env.GITHUB_TOKEN,
  });

  console.log(`🏷️ Commit du tag : ${sha}`);
  if (!result.run) {
    console.log("");
    console.log(
      `❌ FATAL: aucun run ${CI_WORKFLOW} (push sur main) pour ce commit.`,
    );
    console.log("");
    console.log(
      "  Aucun job Deploy PREPROD, E2E Smoke ou Lighthouse de ci.yml n'est enregistré",
    );
    console.log("  sur ce commit pour un push sur main.");
    console.log(
      "  Seul un commit poussé sur main passe par Deploy PREPROD, E2E Smoke et Lighthouse.",
    );
    console.log("");
    console.log("Remède :");
    console.log(
      "  1. Taguer un commit de main dont ces trois jobs sont verts.",
    );
    console.log(
      "  2. OU, si le run ci.yml de ce commit n'a pas encore atteint Deploy PREPROD : attendre, puis relancer ce workflow.",
    );
    process.exitCode = 1;
    return;
  }

  console.log(`🧪 Run ${CI_WORKFLOW} : ${result.run.html_url}`);
  for (const { name, state } of result.rows) {
    console.log(`  ${state === "success" ? "✅" : "❌"} ${name} : ${state}`);
  }
  if (result.ok) {
    console.log("✅ Validation PREPROD prouvée pour ce commit");
    return;
  }

  const pending = result.rows.some((row) =>
    ["queued", "in_progress", "waiting", "requested", "pending"].includes(
      row.state,
    ),
  );
  console.log("");
  console.log("❌ FATAL: ce commit n'a pas passé la validation PREPROD.");
  console.log("");
  console.log(
    "  Aucune mutation n'a eu lieu : PROD et :production sont intacts.",
  );
  console.log("");
  console.log("Remède :");
  if (pending) {
    console.log(
      "  Attendre la fin du run ci.yml ci-dessus, puis relancer ce workflow (Re-run jobs).",
    );
  } else {
    console.log(
      "  1. Corriger sur main, puis taguer le nouveau commit une fois ses trois jobs verts.",
    );
    console.log(
      "  2. OU, si l'échec est transitoire et que ce commit est toujours la tête de main :",
    );
    console.log(
      "     « Re-run failed jobs » sur le run ci.yml ci-dessus, puis relancer ce workflow.",
    );
  }
  process.exitCode = 1;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(
      `❌ FATAL: preuve PREPROD impossible à établir — ${error.message}`,
    );
    process.exitCode = 1;
  });
