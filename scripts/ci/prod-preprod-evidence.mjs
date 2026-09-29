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

export const CI_WORKFLOW = "ci.yml";

// `key` is the job id in ci.yml, `name` its display name (what the API returns).
// ci.yml chains them: deploy → e2e-smoke → lighthouse.
export const REQUIRED_JOBS = [
  { key: "deploy", name: "🧪 Deploy PREPROD" },
  { key: "e2e-smoke", name: "🎭 E2E Smoke Tests" },
  { key: "lighthouse", name: "🔦 Lighthouse Performance Audit" },
];

// Picks the most recent ci.yml run of `sha`. `runs` is the API list, already
// filtered on head_sha/event/branch; the head_sha check keeps a filter the API
// ignored from ever validating another commit.
export function selectRun(sha, runs) {
  return (
    runs
      .filter((run) => run.head_sha === sha)
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
  const base = `${apiUrl}/repos/${repository}/actions`;
  const params = new URLSearchParams({
    head_sha: sha,
    event: "push",
    branch: "main",
    per_page: "100",
  });
  const { workflow_runs: runs = [] } = await getJson(
    `${base}/workflows/${CI_WORKFLOW}/runs?${params}`,
    token,
    fetchRequest,
  );
  const run = selectRun(sha, runs);
  if (!run) return { ok: false, run: null, rows: [] };
  const { jobs = [] } = await getJson(
    `${base}/runs/${run.id}/jobs?filter=latest&per_page=100`,
    token,
    fetchRequest,
  );
  return { run, ...assessJobs(jobs) };
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
    console.log("  Ce commit n'a jamais été validé sur le container PREPROD.");
    console.log(
      "  Seul un commit poussé sur main passe par Deploy PREPROD, E2E Smoke et Lighthouse.",
    );
    console.log("");
    console.log(
      "Remède : taguer un commit de main dont ces trois jobs sont verts.",
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
