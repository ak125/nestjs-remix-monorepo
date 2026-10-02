import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const workflow = readFileSync(
  join(root, ".github/workflows/deploy-prod.yml"),
  "utf8",
);
const adminBlock = workflow
  .split("          # Admin guard verification")[1]
  .split('          if [ "$FAILED" = "1" ]')[0]
  .split("\n")
  .slice(1)
  .map((line) => line.replace(/^ {10}/, ""))
  .join("\n");

// Docker is the external boundary. Run the actual workflow fragment and the
// exact Node source it sends to the container; never touch a running container.
function dockerFixture() {
  const { readFileSync, appendFileSync } = require("node:fs");
  const { spawnSync } = require("node:child_process");
  const args = process.argv.slice(2);
  if (args.includes("wget")) {
    const url = args.at(-1);
    appendFileSync(process.env.PROBE_REQUESTS, JSON.stringify({ url }) + "\n");
    const status = url.includes("content-refresh")
      ? "404"
      : process.env.PROBE_STATUS;
    console.error("  HTTP/1.1 " + status + " Forbidden");
    console.error(
      "wget: server returned error: HTTP/1.1 " + status + " Forbidden",
    );
    process.exit(8);
  }
  if (
    JSON.stringify(args) !==
    JSON.stringify([
      "exec",
      "-i",
      "nestjs-remix-monorepo-prod",
      "node",
      "--input-type=module",
    ])
  ) {
    console.error("Unexpected Docker invocation");
    process.exit(2);
  }
  async function fetchFixture(url, options) {
    const { appendFileSync } = await import("node:fs");
    appendFileSync(
      process.env.PROBE_REQUESTS,
      JSON.stringify({
        url,
        redirect: options.redirect,
        method: options.method ?? "GET",
        headers: Object.fromEntries(new Headers(options.headers)),
        bounded: options.signal instanceof AbortSignal,
      }) + "\n",
    );
    if (process.env.PROBE_STATUS === "network")
      throw new TypeError("fetch failed");
    if (process.env.PROBE_STATUS === "timeout")
      throw new DOMException(
        "The operation was aborted due to timeout",
        "TimeoutError",
      );
    return new Response("ignored response body", {
      status: Number(process.env.PROBE_STATUS),
    });
  }
  const result = spawnSync(process.execPath, ["--input-type=module"], {
    input:
      "globalThis.fetch = " +
      fetchFixture.toString() +
      ";\n" +
      readFileSync(0, "utf8"),
    encoding: "utf8",
    timeout: 5000,
  });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  process.exit(result.status ?? 1);
}
const dockerStub =
  "#!" + process.execPath + "\n(" + dockerFixture.toString() + ")();\n";

function runAdminCheck(t, status) {
  const dir = mkdtempSync(join(tmpdir(), "admin-guard-probe-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "docker"), dockerStub, { mode: 0o755 });
  const requestsFile = join(dir, "requests.jsonl");
  writeFileSync(requestsFile, "");
  const result = spawnSync(
    "bash",
    [
      "-e",
      "-c",
      'EXEC="docker exec nestjs-remix-monorepo-prod"\n' + adminBlock,
    ],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 10000,
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH}`,
        GITHUB_WORKSPACE: root,
        PROBE_STATUS: String(status),
        PROBE_REQUESTS: requestsFile,
      },
    },
  );
  assert.ifError(result.error);
  const output = `${result.stdout}${result.stderr}`;
  const requests = readFileSync(requestsFile, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return { code: result.status, output, requests };
}

for (const status of [401, 403]) {
  test(`anonymous HTTP ${status} succeeds without a false admin warning`, (t) => {
    const result = runAdminCheck(t, status);
    assert.equal(result.code, 0, result.output);
    assert.match(
      result.output,
      new RegExp(`admin guard.*page-briefs.*${status}`),
    );
    assert.doesNotMatch(result.output, /warning|⚠️|unknown|server/i);
  });
}

test("the deployment checks only the active route with an anonymous bounded GET", (t) => {
  const { code, output, requests } = runAdminCheck(t, 403);
  assert.equal(code, 0, output);
  assert.equal(requests.length, 1, JSON.stringify(requests));
  assert.equal(new URL(requests[0].url).pathname, "/api/admin/page-briefs");
  assert.equal(requests[0].method, "GET");
  assert.equal(requests[0].redirect, "manual");
  assert.equal(requests[0].bounded, true);
  assert.equal(requests[0].headers.authorization, undefined);
  assert.equal(requests[0].headers.cookie, undefined);
});

for (const status of [200, 302, 404, 500]) {
  test(`unexpected HTTP ${status} emits an actionable warning without triggering rollback`, (t) => {
    const result = runAdminCheck(t, status);
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /::warning::.*admin guard/i);
    assert.match(
      result.output,
      new RegExp(`HTTP ${status}.*expected 401\/403`),
    );
    assert.doesNotMatch(result.output, /✅ admin guard/);
  });
}

for (const failure of ["network", "timeout"]) {
  test(`${failure} failure is reported explicitly and remains non-blocking`, (t) => {
    const result = runAdminCheck(t, failure);
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /::warning::.*admin guard/i);
    assert.match(
      result.output,
      failure === "timeout" ? /timeout/i : /fetch failed/i,
    );
    assert.doesNotMatch(result.output, /✅ admin guard/);
  });
}
