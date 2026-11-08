import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

const READY = { assignees: [{ login: "ak125" }] };

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
  const body = `DoD-Head: ${OLD_HEAD}\n${TICKED}`;
  const github = fakeGitHub({ pr: openPr(body, READY), verified: true });
  const { outputs, written } = run({ github });
  assert.equal(outputs.skip, "true");
  assert.equal(outputs.previous_head, OLD_HEAD);
  assert.equal(outputs.body_path, undefined);
  assert.deepEqual(written, []);
  assert.ok(github.calls.some((path) => path.includes(`/contents/`) && path.includes(`ref=${OLD_HEAD}`)));
});

test("main moving on unrelated files alone does not touch the PR", () => {
  const github = fakeGitHub({ pr: openPr("evidence", READY), verified: true });
  const { outputs } = run({ github, local: { [MIRROR]: "blob-new", "backend/other.ts": "changed-on-main" } });
  assert.equal(outputs.skip, "true");
});

function assertSkipRefused(prBody, extra, verified, pattern) {
  const written = [];
  const github = fakeGitHub({ pr: openPr(prBody, extra), verified });
  assert.throws(
    () =>
      prepare({
        ghApi: github.ghApi,
        listChanged: () => [MIRROR],
        localBlob: () => "blob-new",
        env: ENV,
        now: () => "2026-11-09T03:00:00Z",
        dodLines: DOD_LINES,
        writeBody: (path, body) => written.push(body),
      }),
    pattern,
  );
  assert.deepEqual(written, []);
}

test("skip fails closed on an unsigned head and writes nothing", () => {
  assertSkipRefused("evidence", READY, false, new RegExp(`${OLD_HEAD} is not verified`));
});

test("skip fails closed without an assignee and writes nothing", () => {
  assertSkipRefused("evidence", {}, true, /no assignee/);
});

test("skip reports every refusal at once", () => {
  assertSkipRefused("evidence", {}, false, /no assignee.*not verified/);
});

const OTHER_HEAD = "b".repeat(40);
const bind = (sha) => `DoD-Head: ${sha}`;
const NOT_BOUND = new RegExp(`without exactly one "DoD-Head: <sha>" line naming its head ${OLD_HEAD}`);
const markedBody = (review, trigger = "schedule") =>
  renderBody({ ...RENDER, previousBody: "", previousHead: undefined })
    .replace(reviewPlaceholder(DOD_LINES), review)
    .replace("Trigger: schedule", trigger);

for (const [name, body] of [
  ["no binding line", `Evidence for ${OTHER_HEAD}\n${TICKED}`],
  ["the head cited in prose only", `Evidence for ${OLD_HEAD}\n${TICKED}`],
  ["a binding to another head and the head cited in a note", `${bind(OTHER_HEAD)}\n${TICKED}\n\nNew head ${OLD_HEAD} to review`],
  ["a binding to another head and the head in a comment", `${bind(OTHER_HEAD)}\n${TICKED}\n<!-- ${OLD_HEAD} -->`],
  ["the binding in a one-line comment", `<!-- ${bind(OLD_HEAD)} -->\n${TICKED}`],
  ["the binding inside a multi-line comment", `<!--\n${bind(OLD_HEAD)}\n-->\n${TICKED}`],
  ["the binding after an unterminated comment", `${TICKED}\n<!--\n${bind(OLD_HEAD)}`],
  ["the binding in a backtick fence", `\`\`\`\n${bind(OLD_HEAD)}\n\`\`\`\n${TICKED}`],
  ["the binding in a tilde fence", `~~~\n${bind(OLD_HEAD)}\n~~~\n${TICKED}`],
  ["the binding in an unterminated fence", `${TICKED}\n\`\`\`\n${bind(OLD_HEAD)}`],
  ["a fence that another kind of fence does not close", `\`\`\`\n~~~\n${bind(OLD_HEAD)}\n\`\`\`\n${TICKED}`],
  ["a fence that a shorter fence does not close", `\`\`\`\`\n\`\`\`\n${bind(OLD_HEAD)}\n\`\`\`\`\n${TICKED}`],
  ["a fence that an info string does not close", `\`\`\`\n\`\`\`js\n${bind(OLD_HEAD)}\n\`\`\`\n${TICKED}`],
  ["a quoted binding", `> ${bind(OLD_HEAD)}\n${TICKED}`],
  ["an indented binding", `    ${bind(OLD_HEAD)}\n${TICKED}`],
  ["an indented binding opening the review zone", markedBody(`    ${bind(OLD_HEAD)}\n${TICKED}`)],
  [
    "a binding quoted by hand in the archive zone",
    markedBody(TICKED).replace("<!-- canon-sync:archive:start -->", `<!-- canon-sync:archive:start -->\n> ${bind(OLD_HEAD)}`),
  ],
  ["text after the binding", `${bind(OLD_HEAD)} reviewed\n${TICKED}`],
  ["an uppercase SHA", `${bind(OLD_HEAD.toUpperCase())}\n${TICKED}`],
  ["a shortened SHA", `${bind(OLD_HEAD.slice(0, 12))}\n${TICKED}`],
  ["two different bindings", `${bind(OTHER_HEAD)}\n${bind(OLD_HEAD)}\n${TICKED}`],
  ["the same binding twice", `${bind(OLD_HEAD)}\n${bind(OLD_HEAD)}\n${TICKED}`],
  ["an N/A line without a binding", "- [ ] DoD4 — N/A : nothing observable"],
  ["a binding only in the generated zone", markedBody(TICKED, `Trigger: schedule\n${bind(OLD_HEAD)}`)],
  ["ticks in the generated zone without a binding", markedBody("Notes", `Trigger: schedule\n${TICKED}`)],
  [
    "a binding only in the archive",
    renderBody({ ...RENDER, previousBody: bind(OLD_HEAD), previousHead: OLD_HEAD }).replace(reviewPlaceholder(DOD_LINES), TICKED),
  ],
]) {
  test(`skip fails closed on certifying lines with ${name}`, () => {
    assertSkipRefused(body, READY, true, NOT_BOUND);
  });
}

for (const [name, body] of [
  ["in the review zone", markedBody(`${bind(OLD_HEAD)}\n${TICKED}`)],
  ["with CRLF line ends", `${bind(OLD_HEAD)}\r\n${TICKED.replace(/\n/g, "\r\n")}`],
  ["after a closed comment", `<!-- note -->\n${bind(OLD_HEAD)}\n${TICKED}`],
  ["after a closed fence", `\`\`\`\nlog\n\`\`\`\n${bind(OLD_HEAD)}\n${TICKED}`],
]) {
  test(`skip accepts one binding to the current head ${name}`, () => {
    assert.equal(run({ github: fakeGitHub({ pr: openPr(body, READY), verified: true }) }).outputs.skip, "true");
  });
}

test("a legacy unsigned head with unbound ticks is refused, a signed child with a binding is accepted", () => {
  const legacy = `Review of ${OLD_HEAD}\n${TICKED}`;
  const written = [];
  const github = fakeGitHub({ pr: openPr(legacy, READY), verified: false });
  assert.throws(
    () => prepare({ ghApi: github.ghApi, listChanged: () => [MIRROR], localBlob: () => "blob-new", env: ENV, now: () => "t", dodLines: DOD_LINES, writeBody: (p, b) => written.push(b) }),
    (error) => /is not verified/.test(error.message) && NOT_BOUND.test(error.message),
  );
  assert.deepEqual(written, []);

  const signedChild = "d".repeat(40);
  const regularised = `DoD-Head: ${signedChild}\n${TICKED}\n\nPrevious head, kept as parent: ${OLD_HEAD}`;
  const pr = openPr(regularised, { ...READY, head: { sha: signedChild } });
  assert.equal(run({ github: fakeGitHub({ pr, verified: true }) }).outputs.skip, "true");
});

test("the placeholder says how to bind a certification to the head", () => {
  assert.match(reviewPlaceholder(DOD_LINES), /`DoD-Head: <40-character head SHA>`/);
});

test("skip accepts the untouched placeholder, whose N/A sits in a template hint", () => {
  const body = renderBody({ ...RENDER, previousBody: "", previousHead: undefined });
  assert.match(body, /<log\/metric\/event log added or N\/A>/);
  assert.equal(run({ github: fakeGitHub({ pr: openPr(body, READY), verified: true }) }).outputs.skip, "true");
});

test("skip ignores ticks that are only in the quoted archive", () => {
  const body = renderBody({ ...RENDER, previousBody: `Old\n${TICKED}`, previousHead: "b".repeat(40) });
  assert.equal(run({ github: fakeGitHub({ pr: openPr(body, READY), verified: true }) }).outputs.skip, "true");
});

test("fails closed before any read on a dispatch from another branch", () => {
  const github = fakeGitHub({ pr: openPr("evidence", READY), verified: true });
  assert.throws(() => run({ github, env: { ...ENV, GITHUB_REF_NAME: "feature/x" } }), /only runs on main, not feature\/x/);
  assert.deepEqual(github.calls, []);
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
  assert.match(body, new RegExp(`written while the PR head was \`${OLD_HEAD}\`.*does not apply to the current head`));
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

for (const [name, separator] of [["U+2028", "\u2028"], ["U+2029", "\u2029"], ["a lone CR", "\r"]]) {
  test(`${name} in archived text stays quoted for the DoD gate`, () => {
    const body = renderBody({ ...RENDER, previousBody: `note${separator}- [ ] DoD1 — not done on the old head`, previousHead: OLD_HEAD });
    assert.equal(certified(body.replace(reviewPlaceholder(DOD_LINES), TICKED)).pass, true);
  });
}

test("fails closed on an unquoted line in the archive zone", () => {
  const rendered = renderBody({ ...RENDER, previousBody: "note", previousHead: OLD_HEAD });
  const edited = rendered.replace("<!-- canon-sync:archive:end -->", `${TICKED}\n<!-- canon-sync:archive:end -->`);
  assert.throws(() => parseBody(edited), /unquoted/);
});

test("a note added on the trigger line is preserved", () => {
  const rendered = renderBody({ ...RENDER, previousBody: "", previousHead: undefined });
  const edited = rendered.replace("Trigger: schedule", "Trigger: schedule, reviewed by hand");
  const { archive } = parseBody(renderBody({ ...RENDER, previousBody: edited, previousHead: OLD_HEAD }));
  assert.match(archive, /reviewed by hand/);
});

test("a dispatch trigger line is generated text, not evidence", () => {
  const first = renderBody({ ...RENDER, trigger: "repository_dispatch (canon-updated)", previousBody: "", previousHead: undefined });
  assert.equal(parseBody(renderBody({ ...RENDER, previousBody: first, previousHead: OLD_HEAD })).archive, "");
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
  RUNNER_TEMP: "/runner/tmp",
};
const RENDERED = "rendered body\n";
const servedPr = (over = {}) => () =>
  JSON.stringify({ head: { sha: NEW_HEAD }, assignees: [{ login: "ak125" }], body: RENDERED, ...over });
const readRendered = (path) => {
  assert.equal(path, "/runner/tmp/canon-sync-pr-body.md");
  return RENDERED;
};

test("verify accepts a signed, assigned, moved head carrying the rendered body", () => {
  assert.deepEqual(verify({ ghApi: servedPr(), env: VERIFY_ENV, readBody: readRendered }), { checked: true });
});

test("verify tolerates only line-end and edge whitespace differences in the body", () => {
  const ghApi = servedPr({ body: "rendered\r\nbody" });
  assert.deepEqual(verify({ ghApi, env: VERIFY_ENV, readBody: () => "rendered\nbody\n" }), { checked: true });
});

test("verify accepts a close without inspecting a head or a body", () => {
  const env = { ...VERIFY_ENV, EXPECTED_OPERATIONS: "closed", CPR_OPERATION: "closed", CPR_HEAD_SHA: "", CPR_VERIFIED: "false" };
  const readBody = () => assert.fail("a close renders nothing to compare");
  assert.deepEqual(verify({ ghApi: servedPr(), env, readBody }), { checked: false });
});

for (const [name, served] of [
  ["the previous body still in place", `old evidence\n${TICKED}`],
  ["an emptied body", null],
  ["a body that differs inside a line", "rendered  body\n"],
]) {
  test(`verify fails on ${name}`, () => {
    assert.throws(() => verify({ ghApi: servedPr({ body: served }), env: VERIFY_ENV, readBody: readRendered }), /not the rendered body/);
  });
}

for (const [name, change, pattern, served] of [
  ["an unverified head", { CPR_VERIFIED: "false" }, /not verified/],
  ["an unexpected operation", { CPR_OPERATION: "none" }, /expected updated/],
  ["an unchanged head", { CPR_HEAD_SHA: OLD_HEAD }, /did not change/],
  ["a head GitHub does not serve", {}, /action reported/, servedPr({ head: { sha: "d".repeat(40) } })],
  ["a missing assignee", {}, /not assigned/, servedPr({ assignees: [] })],
]) {
  test(`verify fails on ${name}`, () => {
    assert.throws(() => verify({ ghApi: served ?? servedPr(), env: { ...VERIFY_ENV, ...change }, readBody: readRendered }), pattern);
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

function cli(t, ghBody, { command = "prepare", env = {}, setup = () => {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "canon-sync-cli-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const bin = join(dir, "bin");
  const repo = join(dir, "repo");
  mkdirSync(bin);
  mkdirSync(join(repo, ".github"), { recursive: true });
  writeFileSync(join(bin, "gh"), `#!/bin/sh\n${ghBody}\n`, { mode: 0o755 });
  copyFileSync(join(ROOT, ".github/PULL_REQUEST_TEMPLATE.md"), join(repo, ".github/PULL_REQUEST_TEMPLATE.md"));
  execFileSync("git", ["init", "-q"], { cwd: repo });
  const output = join(dir, "github-output");
  setup(dir);
  const result = spawnSync(process.execPath, [join(ROOT, "scripts/ci/canon-sync-pr.mjs"), command], {
    cwd: repo,
    encoding: "utf8",
    env: {
      PATH: `${bin}:${process.env.PATH}`,
      GH_TOKEN: "test-token",
      GITHUB_REPOSITORY: REPO,
      GITHUB_REF_NAME: "main",
      RUNNER_TEMP: dir,
      GITHUB_OUTPUT: output,
      EVENT_NAME: "schedule",
      RUN_URL: "https://run/1",
      ...env,
    },
  });
  return { result, output, dir };
}

test("command line: writes the outputs and the body the workflow reads", (t) => {
  const { result, output, dir } = cli(t, "echo '[]'");
  assert.equal(result.status, 0, result.stderr);
  const bodyPath = join(dir, "canon-sync-pr-body.md");
  assert.deepEqual(readFileSync(output, "utf8").trim().split("\n"), ["skip=false", "previous_head=", "expected=created", `body_path=${bodyPath}`]);
  assert.doesNotMatch(readFileSync(bodyPath, "utf8"), /\[[xX]\]/);
});

test("command line: a GitHub failure is a job failure with no output", (t) => {
  const { result, output, dir } = cli(t, "echo 'HTTP 502' >&2\nexit 1");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /::error::canon-sync: gh api .*HTTP 502/);
  assert.equal(existsSync(output), false);
  assert.equal(existsSync(join(dir, "canon-sync-pr-body.md")), false);
});

function cliVerify(t, served, rendered) {
  const { RUNNER_TEMP: _unused, ...env } = VERIFY_ENV;
  return cli(t, 'cat "$RUNNER_TEMP/served-pr.json"', {
    command: "verify",
    env,
    setup: (dir) => {
      writeFileSync(join(dir, "served-pr.json"), JSON.stringify({ head: { sha: NEW_HEAD }, assignees: [{ login: "ak125" }], body: served }));
      if (rendered !== null) writeFileSync(join(dir, "canon-sync-pr-body.md"), rendered);
    },
  }).result;
}

test("command line: verify compares GitHub's body with the file prepare rendered", (t) => {
  const result = cliVerify(t, "same body", "same body\n");
  assert.equal(result.status, 0, result.stderr);
});

test("command line: verify fails on another body", (t) => {
  const result = cliVerify(t, "another body", "same body\n");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /::error::canon-sync: PR #1954 body is not the rendered body/);
});

test("command line: verify fails when the rendered body is missing", (t) => {
  const result = cliVerify(t, "same body", null);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /::error::canon-sync: .*canon-sync-pr-body\.md/);
});

test("workflow contract: signed, guarded, assigned, schedule unchanged", () => {
  const workflow = yaml.load(readFileSync(join(ROOT, ".github/workflows/canon-sync.yml"), "utf8"));
  assert.deepEqual(workflow.on.schedule, [{ cron: "0 3 * * *" }]);
  assert.deepEqual(workflow.permissions, { contents: "write", "pull-requests": "write" });
  assert.deepEqual(workflow.concurrency, { group: "canon-sync", "cancel-in-progress": false });

  const { steps } = workflow.jobs.sync;
  const names = steps.map((step) => step.id ?? step.uses ?? step.name);
  const prepareIndex = steps.findIndex((step) => step.id === "prepare");
  const actionIndex = steps.findIndex((step) => step.id === "cpr");
  assert.ok(prepareIndex > 0 && prepareIndex < actionIndex, names.join());

  const action = steps[actionIndex];
  assert.match(action.uses, /^peter-evans\/create-pull-request@v8$/);
  assert.equal(action.if, "steps.prepare.outputs.skip == 'false'");
  assert.equal(action.with["sign-commits"], true);
  assert.equal(action.with.branch, "canon-sync/auto");
  assert.equal(action.with["delete-branch"], true);
  assert.equal(action.with["body-path"], "${{ steps.prepare.outputs.body_path }}");
  assert.equal(action.with.assignees, "${{ env.CANON_SYNC_ASSIGNEE }}");
  for (const removed of ["body", "author", "committer"]) assert.equal(action.with[removed], undefined, removed);

  const check = steps[actionIndex + 1];
  assert.equal(check.if, "steps.prepare.outputs.skip == 'false'");
  assert.match(check.run, /canon-sync-pr\.mjs verify/);
  assert.equal(check["continue-on-error"], undefined);
});
