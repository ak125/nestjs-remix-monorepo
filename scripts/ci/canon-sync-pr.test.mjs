import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

import {
  GENERATED_TEXT,
  MAX_BODY_CHARS,
  createGitReader,
  decide,
  extractDodLines,
  parseBody,
  prepare,
  renderBody,
  reviewPlaceholder,
  verify,
} from "./canon-sync-pr.mjs";
import { DOD_IDS, evaluateDoD } from "./pr-dod-gate.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const REPO = "ak125/nestjs-remix-monorepo";
const MIRROR = ".claude/canon-mirrors/agent-exit-contract.md";
const OLD_HEAD = "a".repeat(40);
const DOD_LINES = extractDodLines(readFileSync(join(ROOT, ".github/PULL_REQUEST_TEMPLATE.md"), "utf8"));
const TICKED = DOD_IDS.map((id) => `- [x] ${id} — done`).join("\n");
const RENDER = { trigger: "schedule", dodLines: DOD_LINES, replacedAt: "2026-11-09T03:00:00Z", runUrl: "https://run/1" };
const certified = (body) => evaluateDoD(body, [], 1, { assignees: ["ak125"], author: "github-actions[bot]" });

const ENV = {
  GITHUB_REPOSITORY: REPO,
  GITHUB_REF_NAME: "main",
  RUNNER_TEMP: "/runner/tmp",
  EVENT_NAME: "schedule",
  RUN_URL: "https://run/1",
};

function fakeGitHub({ pr = null, files = [MIRROR], blobs = { [MIRROR]: "blob-new" }, verified = false } = {}) {
  const calls = [];
  const ghApi = (path, { allowNotFound = false } = {}) => {
    calls.push(path);
    if (path.includes("/pulls?state=open")) return JSON.stringify(pr ? [{ number: pr.number }] : []);
    if (path.includes("/files?")) return JSON.stringify(files.map((filename) => ({ filename })));
    if (path.includes("/contents/")) {
      const key = decodeURIComponent(path.split("/contents/")[1].split("?")[0]);
      if (!(key in blobs)) {
        assert.equal(allowNotFound, true);
        return null;
      }
      return JSON.stringify({ type: "file", sha: blobs[key] });
    }
    if (path.includes("/commits/")) return JSON.stringify({ commit: { verification: { verified } } });
    if (path.includes("/pulls/")) return JSON.stringify(pr);
    throw new Error(`unexpected path ${path}`);
  };
  return { ghApi, calls };
}

const openPr = (body, extra = {}) => ({
  number: 1954,
  body,
  head: { sha: OLD_HEAD },
  changed_files: 1,
  assignees: [],
  ...extra,
});

function run({ github, syncChanged = [MIRROR], local = { [MIRROR]: "blob-new" }, env = ENV }) {
  const written = [];
  const result = prepare({
    ghApi: github.ghApi,
    listChanged: () => syncChanged,
    localBlob: (path) => local[path] ?? null,
    env,
    now: () => "2026-11-09T03:00:00Z",
    dodLines: DOD_LINES,
    writeBody: (path, body) => written.push({ path, body }),
  });
  return { ...result, written };
}

test("first pass: opens a PR whose body certifies nothing", () => {
  const { outputs, written } = run({ github: fakeGitHub() });
  assert.equal(outputs.skip, "false");
  assert.equal(outputs.expected, "created");
  assert.equal(outputs.body_path, "/runner/tmp/canon-sync-pr-body.md");
  assert.equal(written.length, 1);
  assert.doesNotMatch(written[0].body, /\[[xX]\]/);
  assert.equal(certified(written[0].body).pass, false);
});

test("identical repeat: skips, writes nothing, leaves head and body alone", () => {
  const body = `Evidence for this head\n${TICKED}`;
  const github = fakeGitHub({ pr: openPr(body, { assignees: [{ login: "ak125" }] }), verified: true });
  const { outputs, written, warnings } = run({ github });
  assert.equal(outputs.skip, "true");
  assert.equal(outputs.previous_head, OLD_HEAD);
  assert.deepEqual(written, []);
  assert.deepEqual(warnings, []);
  assert.ok(github.calls.every((path) => !path.includes("/git/refs")));
});

test("main moving on unrelated files alone does not touch the PR", () => {
  const github = fakeGitHub({ pr: openPr("evidence") });
  const { outputs } = run({ github, local: { [MIRROR]: "blob-new", "backend/other.ts": "changed-on-main" } });
  assert.equal(outputs.skip, "true");
});

test("skip surfaces an unsigned head and a missing assignee without rewriting", () => {
  const { outputs, warnings } = run({ github: fakeGitHub({ pr: openPr("evidence"), verified: false }) });
  assert.equal(outputs.skip, "true");
  assert.equal(warnings.length, 2);
  assert.match(warnings.join(" "), /no assignee/);
  assert.match(warnings.join(" "), new RegExp(`${OLD_HEAD} is not verified`));
});

test("head change: legacy evidence is archived whole and stops certifying", () => {
  const legacy = `Review record for ${OLD_HEAD}\n\n${TICKED}\n\nDecision: keep.`;
  assert.equal(certified(legacy).pass, true);
  const github = fakeGitHub({ pr: openPr(legacy), blobs: { [MIRROR]: "blob-old" } });
  const { outputs, written } = run({ github });
  assert.equal(outputs.skip, "false");
  assert.equal(outputs.expected, "updated");
  assert.equal(outputs.previous_head, OLD_HEAD);

  const { body } = written[0];
  for (const line of legacy.split("\n").filter(Boolean)) assert.ok(body.includes(`> ${line}`), line);
  assert.match(body, new RegExp(`head \`${OLD_HEAD}\`.*does not apply to the current head`));
  const result = certified(body);
  assert.equal(result.pass, false);
  assert.equal(result.reasons.length, DOD_IDS.length - 1);
});

test("a path removed by the sync but still on the PR head counts as a change", () => {
  const stale = "workspaces/old/mirror.md";
  const github = fakeGitHub({
    pr: openPr("evidence", { changed_files: 2 }),
    files: [MIRROR, stale],
    blobs: { [MIRROR]: "blob-new", [stale]: "blob-stale" },
  });
  assert.equal(run({ github }).outputs.expected, "updated");
});

test("a mirror the sync adds but the PR head lacks counts as a change", () => {
  const added = "workspaces/new/mirror.md";
  const github = fakeGitHub({ pr: openPr("evidence") });
  const { outputs } = run({ github, syncChanged: [MIRROR, added], local: { [MIRROR]: "blob-new", [added]: "blob-added" } });
  assert.equal(outputs.expected, "updated");
});

test("no synced change with an open PR lets the action close it, even on a malformed body", () => {
  const github = fakeGitHub({ pr: openPr(`<!-- canon-sync:review:start -->\nbroken`), blobs: { [MIRROR]: "blob-old" } });
  const { outputs } = run({ github, syncChanged: [], local: {} });
  assert.deepEqual([outputs.skip, outputs.expected], ["false", "closed"]);
});

test("nothing to do and no PR expects no operation", () => {
  assert.equal(run({ github: fakeGitHub(), syncChanged: [] }).outputs.expected, "none,closed");
});

test("second cycle: review moves to the archive, older entries stay, zone resets", () => {
  const first = renderBody({ ...RENDER, previousBody: "first evidence", previousHead: OLD_HEAD });
  const reviewed = first.replace(reviewPlaceholder(DOD_LINES), `second evidence\n${TICKED}`);
  const second = renderBody({ ...RENDER, previousBody: reviewed, previousHead: "b".repeat(40) });
  const parsed = parseBody(second);
  assert.equal(parsed.review, reviewPlaceholder(DOD_LINES));
  assert.match(parsed.archive, /> first evidence/);
  assert.match(parsed.archive, /> second evidence/);
  assert.ok(parsed.archive.indexOf("b".repeat(40)) < parsed.archive.indexOf(OLD_HEAD));
  assert.equal(certified(second).pass, false);
});

test("a re-render with an untouched review adds no archive entry and is stable", () => {
  const first = renderBody({ ...RENDER, previousBody: "", previousHead: undefined });
  const second = renderBody({ ...RENDER, previousBody: first, previousHead: OLD_HEAD });
  assert.equal(second, first);
  assert.equal(parseBody(first).archive, "");
  assert.ok(!first.includes("Stale evidence"));
});

test("notes written outside the zones or inside the generated block are preserved", () => {
  const rendered = renderBody({ ...RENDER, previousBody: "", previousHead: undefined });
  const edited = `Owner decision on top\n${rendered.replace(GENERATED_TEXT, `${GENERATED_TEXT}\nHuman note in generated`)}`;
  const { archive } = parseBody(renderBody({ ...RENDER, previousBody: edited, previousHead: OLD_HEAD }));
  assert.match(archive, /> Owner decision on top/);
  assert.match(archive, /> Human note in generated/);
});

test("CRLF bodies from the web editor parse like LF bodies", () => {
  const rendered = renderBody({ ...RENDER, previousBody: "", previousHead: undefined });
  assert.equal(parseBody(rendered.replace(/\n/g, "\r\n")).review, reviewPlaceholder(DOD_LINES));
});

test("the fence outgrows any backtick run in the archived text", () => {
  const body = renderBody({ ...RENDER, previousBody: "```\ncode\n```\n````\nmore\n````", previousHead: OLD_HEAD });
  assert.match(body, /> `````text/);
});

test("a quoted marker in archived text is not read as a marker", () => {
  const body = renderBody({ ...RENDER, previousBody: "<!-- canon-sync:review:starting -->\n> <!-- canon-sync:review:start -->", previousHead: OLD_HEAD });
  assert.doesNotThrow(() => parseBody(body));
});

for (const [name, mutate] of [
  ["missing", (m) => m.replace("<!-- canon-sync:review:end -->\n", "")],
  ["duplicated", (m) => `<!-- canon-sync:review:start -->\n${m}`],
  ["reordered", (m) => m.replace("<!-- canon-sync:generated:start -->", "X").replace("<!-- canon-sync:review:start -->", "<!-- canon-sync:generated:start -->").replace("X", "<!-- canon-sync:review:start -->")],
]) {
  test(`fails closed on ${name} markers`, () => {
    const body = mutate(renderBody({ ...RENDER, previousBody: "", previousHead: undefined }));
    assert.throws(() => renderBody({ ...RENDER, previousBody: body, previousHead: OLD_HEAD }), /markers/);
  });
}

test("fails closed when the rendered body exceeds the GitHub limit", () => {
  assert.throws(
    () => renderBody({ ...RENDER, previousBody: "x".repeat(MAX_BODY_CHARS), previousHead: OLD_HEAD }),
    /trim the stale archive/,
  );
});

test("fails closed on evidence without a head SHA", () => {
  assert.throws(() => renderBody({ ...RENDER, previousBody: "evidence", previousHead: undefined }), /head SHA/);
});

test("fails closed before any write when GitHub cannot be read", () => {
  const github = {
    ghApi: () => {
      throw new Error("gh api failed: HTTP 502");
    },
  };
  assert.throws(() => run({ github }), /HTTP 502/);
});

test("fails closed on several open PRs for the branch", () => {
  const github = fakeGitHub();
  const ghApi = (path, options) =>
    path.includes("/pulls?state=open") ? JSON.stringify([{ number: 1 }, { number: 2 }]) : github.ghApi(path, options);
  assert.throws(() => run({ github: { ghApi } }), /2 open PRs/);
});

test("fails closed when the file listing is incomplete", () => {
  const github = fakeGitHub({ pr: openPr("evidence", { changed_files: 3 }) });
  assert.throws(() => run({ github }), /listed 1 files, GitHub reports 3/);
});

test("fails closed on a non-file path at the PR head", () => {
  const github = fakeGitHub({ pr: openPr("evidence") });
  const ghApi = (path, options) => (path.includes("/contents/") ? "[]" : github.ghApi(path, options));
  assert.throws(() => run({ github: { ghApi } }), /not a regular file/);
});

test("fails closed on a missing environment variable", () => {
  const { RUN_URL: _omitted, ...env } = ENV;
  assert.throws(() => run({ github: fakeGitHub(), env }), /RUN_URL/);
});

test("decide never skips without both an open PR and synced changes", () => {
  assert.equal(decide({ hasOpenPr: false, syncChanged: ["a"], differing: [] }).skip, false);
  assert.equal(decide({ hasOpenPr: true, syncChanged: [], differing: [] }).skip, false);
  assert.equal(decide({ hasOpenPr: true, syncChanged: ["a"], differing: ["a"] }).skip, false);
  assert.equal(decide({ hasOpenPr: true, syncChanged: ["a"], differing: [] }).skip, true);
});

const NEW_HEAD = "c".repeat(40);
const VERIFY_ENV = {
  GITHUB_REPOSITORY: REPO,
  CANON_SYNC_ASSIGNEE: "ak125",
  EXPECTED_OPERATIONS: "updated",
  PREVIOUS_HEAD: OLD_HEAD,
  CPR_OPERATION: "updated",
  CPR_HEAD_SHA: NEW_HEAD,
  CPR_VERIFIED: "true",
  CPR_NUMBER: "1954",
};
const servedPr = (over = {}) => () => JSON.stringify({ head: { sha: NEW_HEAD }, assignees: [{ login: "ak125" }], ...over });

test("verify accepts a signed, assigned, moved head", () => {
  assert.deepEqual(verify({ ghApi: servedPr(), env: VERIFY_ENV }), { checked: true });
});

test("verify accepts a close without inspecting a head", () => {
  const env = { ...VERIFY_ENV, EXPECTED_OPERATIONS: "closed", CPR_OPERATION: "closed", CPR_HEAD_SHA: "", CPR_VERIFIED: "false" };
  assert.deepEqual(verify({ ghApi: servedPr(), env }), { checked: false });
});

for (const [name, change, pattern, served] of [
  ["an unverified head", { CPR_VERIFIED: "false" }, /not verified/],
  ["an unexpected operation", { CPR_OPERATION: "none" }, /expected updated/],
  ["an unchanged head", { CPR_HEAD_SHA: OLD_HEAD }, /did not change/],
  ["a head GitHub does not serve", {}, /action reported/, servedPr({ head: { sha: "d".repeat(40) } })],
  ["a missing assignee", {}, /not assigned/, servedPr({ assignees: [] })],
]) {
  test(`verify fails on ${name}`, () => {
    assert.throws(() => verify({ ghApi: served ?? servedPr(), env: { ...VERIFY_ENV, ...change } }), pattern);
  });
}

test("git reader lists nested untracked files and hashes like git", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "canon-sync-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
  git("init", "-q");
  git("config", "user.email", "test@example.invalid");
  git("config", "user.name", "test");
  git("config", "commit.gpgsign", "false");
  writeFileSync(join(dir, "tracked.md"), "one\n");
  git("add", ".");
  git("commit", "-q", "-m", "init");
  writeFileSync(join(dir, "tracked.md"), "two\n");
  mkdirSync(join(dir, "deep/er"), { recursive: true });
  writeFileSync(join(dir, "deep/er/new file.md"), "new\n");

  const reader = createGitReader(dir);
  assert.deepEqual(reader.listChanged(), ["deep/er/new file.md", "tracked.md"]);
  git("add", "tracked.md");
  assert.equal(reader.localBlob("tracked.md"), git("rev-parse", ":tracked.md"));
  assert.equal(reader.localBlob("absent.md"), null);
});

test("template extraction fails closed on a changed checklist", () => {
  assert.equal(DOD_LINES.length, 9);
  assert.throws(() => extractDodLines("- [ ] DoD1 — only one"), /expected 9/);
});

test("workflow contract: signed, guarded, assigned, schedule unchanged", () => {
  const workflow = yaml.load(readFileSync(join(ROOT, ".github/workflows/canon-sync.yml"), "utf8"));
  assert.deepEqual(workflow.on.schedule, [{ cron: "0 3 * * *" }]);
  assert.deepEqual(workflow.permissions, { contents: "write", "pull-requests": "write" });

  const { steps } = workflow.jobs.sync;
  const names = steps.map((step) => step.id ?? step.uses ?? step.name);
  const prepareIndex = steps.findIndex((step) => step.id === "prepare");
  const actionIndex = steps.findIndex((step) => step.id === "cpr");
  assert.ok(prepareIndex > 0 && prepareIndex < actionIndex, names.join());

  const action = steps[actionIndex];
  assert.match(action.uses, /^peter-evans\/create-pull-request@v8$/);
  assert.equal(action.if, "steps.prepare.outputs.skip == 'false'");
  assert.equal(action.with["sign-commits"], true);
  assert.equal(action.with["body-path"], "${{ steps.prepare.outputs.body_path }}");
  assert.equal(action.with.assignees, "${{ env.CANON_SYNC_ASSIGNEE }}");
  for (const removed of ["body", "author", "committer"]) assert.equal(action.with[removed], undefined, removed);

  const check = steps[actionIndex + 1];
  assert.equal(check.if, "steps.prepare.outputs.skip == 'false'");
  assert.match(check.run, /canon-sync-pr\.mjs verify/);
  assert.equal(check["continue-on-error"], undefined);
});
