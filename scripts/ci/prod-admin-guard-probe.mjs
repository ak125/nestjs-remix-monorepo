import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// The same read-only probe runs inside the application container using its
// existing Node runtime, without installing tools or writing container files.
export async function probeAdminGuard(url) {
  let response;
  try {
    response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    await response.body?.cancel();
  } catch (error) {
    throw new Error(
      "Admin guard request failed (" + error.name + "): " + error.message,
    );
  }
  if (response.status !== 401 && response.status !== 403) {
    throw new Error(
      "Admin guard HTTP " + response.status + " (expected 401/403)",
    );
  }
  return response.status;
}

function main() {
  // content-refresh was removed; page-briefs still has both authentication and
  // admin guards. A 404 or redirect is not evidence of anonymous access denial.
  const source =
    "(" +
    probeAdminGuard.toString() +
    ")('http://127.0.0.1:3000/api/admin/page-briefs')" +
    ".then(status => console.log('✅ admin guard /page-briefs -> ' + status))" +
    ".catch(error => { console.error(error.message); process.exitCode = 1; });";
  try {
    execFileSync(
      "docker",
      [
        "exec",
        "-i",
        "nestjs-remix-monorepo-prod",
        "node",
        "--input-type=module",
      ],
      { input: source, timeout: 20000, stdio: ["pipe", "inherit", "inherit"] },
    );
  } catch (error) {
    console.error(
      "Admin guard probe did not complete successfully: " +
        (error.code ?? error.status ?? error.signal ?? "unknown"),
    );
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main();
