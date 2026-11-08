// Behavioural tests for scripts/ci/audit-gates-verdict.mjs and its wiring in
// .github/workflows/audit.yml. Run: node --test scripts/ci/audit-gates-verdict.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

import {
  GITHUB_PR_FILES_LISTING_CAP,
  decideScope,
  decideVerdict,
  main,
} from "./audit-gates-verdict.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKFLOW = resolve(HERE, "../../.github/workflows/audit.yml");

// The historical workflow-level `on.pull_request.paths` list, now carried by
// the `in_scope` filter. Any change here must be a deliberate scope decision.
const IN_SCOPE_PATTERNS = [
  "backend/src/**",
  "frontend/app/**",
  "packages/**",
  "scripts/**",
  ".ast-grep/**",
  "knip.json",
  ".dependency-cruiser.cjs",
  "sgconfig.yml",
  "**/package.json",
  "package-lock.json",
  "audit-reports/phase0-baseline.json",
  ".github/workflows/**",
  ".spec/00-canon/repository-registry/**",
  "audit/registry/**",
  ".dependency-cruiser.generated.cjs",
];

const scope = (o) =>
  decideScope({
    filterOutcome: "success",
    filterInScope: "true",
    filterAllCount: "3",
    prChangedFiles: "3",
    ...o,
  });

// ─── decideScope ────────────────────────────────────────────────────────────

test("scope: in-scope path → in scope", () => {
  const d = scope({});
  assert.equal(d.ok, true);
  assert.equal(d.inScope, true);
});

test("scope: docs-only PR → out of scope (explicit, ok)", () => {
  const d = scope({ filterInScope: "false", filterAllCount: "2", prChangedFiles: "2" });
  assert.equal(d.ok, true);
  assert.equal(d.inScope, false);
  assert.match(d.reason, /no in-scope path among 2/);
});

test("scope: deleted in-scope path counts like any change", () => {
  // dorny reports a removed file under the filter; the PR counts it in changed_files.
  const d = scope({ filterInScope: "true", filterAllCount: "1", prChangedFiles: "1" });
  assert.equal(d.ok, true);
  assert.equal(d.inScope, true);
});

test("scope: rename reported as old+new path (seen > changed) → in_scope is used", () => {
  const inS = scope({ filterInScope: "true", filterAllCount: "2", prChangedFiles: "1" });
  assert.equal(inS.ok, true);
  assert.equal(inS.inScope, true);
  const outS = scope({ filterInScope: "false", filterAllCount: "2", prChangedFiles: "1" });
  assert.equal(outS.ok, true);
  assert.equal(outS.inScope, false);
});

test("scope: incomplete/truncated listing (seen < changed) → forced in scope", () => {
  const d = scope({ filterInScope: "false", filterAllCount: "3000", prChangedFiles: "3500" });
  assert.equal(d.ok, true);
  assert.equal(d.inScope, true);
  assert.match(d.reason, /incomplete/);
});

test("scope: incomplete listing BELOW the cap (seen 1 < changed 2) + in_scope=false → forced in scope", () => {
  // Below 3000 only the seen < changed rule can force the audit: the cap rule must not be needed.
  const d = scope({ filterInScope: "false", filterAllCount: "1", prChangedFiles: "2" });
  assert.equal(d.ok, true);
  assert.equal(d.inScope, true);
  assert.match(d.reason, /incomplete \(seen 1 < changed 2\)/);
  assert.doesNotMatch(d.reason, /listing cap/);
});

test("scope: rename in-scope → out-of-scope path (old path deleted + new added) → in scope", () => {
  // dorny v4 reports the old in-scope path as `deleted`, so in_scope=true.
  const d = scope({ filterInScope: "true", filterAllCount: "2", prChangedFiles: "1" });
  assert.equal(d.ok, true);
  assert.equal(d.inScope, true);
});

test("scope: listing cap constant is GitHub's 3000-file limit", () => {
  assert.equal(GITHUB_PR_FILES_LISTING_CAP, 3000);
});

for (const [seen, changed] of [
  ["3000", "3000"],
  ["3001", "3001"],
  ["4000", "4000"],
  ["4500", "4000"], // rename double-counting pushes seen above changed
  ["3000", "3001"],
]) {
  test(`scope: changed_files at/above cap (seen ${seen}, changed ${changed}) + in_scope=false → forced in scope`, () => {
    const d = scope({ filterInScope: "false", filterAllCount: seen, prChangedFiles: changed });
    assert.equal(d.ok, true);
    assert.equal(d.inScope, true);
    assert.match(d.reason, /incomplete|listing cap/);
  });
}

test("scope: boundary 2999/2999 + in_scope=false → out of scope (listing complete)", () => {
  const d = scope({ filterInScope: "false", filterAllCount: "2999", prChangedFiles: "2999" });
  assert.equal(d.ok, true);
  assert.equal(d.inScope, false);
});

test("scope: boundary 2999 changed with rename double-count (seen 3000) + in_scope=false → out of scope", () => {
  const d = scope({ filterInScope: "false", filterAllCount: "3000", prChangedFiles: "2999" });
  assert.equal(d.ok, true);
  assert.equal(d.inScope, false);
});

for (const filterOutcome of ["failure", "cancelled", "skipped", "", undefined]) {
  test(`scope: detection outcome ${JSON.stringify(filterOutcome)} → fail`, () => {
    const d = scope({ filterOutcome });
    assert.equal(d.ok, false);
    assert.match(d.reason, /detection did not succeed/);
  });
}

for (const filterInScope of ["", "yes", "True", "1", undefined]) {
  test(`scope: malformed in_scope ${JSON.stringify(filterInScope)} → fail`, () => {
    const d = scope({ filterInScope });
    assert.equal(d.ok, false);
    assert.match(d.reason, /malformed in_scope/);
  });
}

const UNSAFE = "9007199254740992"; // Number.MAX_SAFE_INTEGER + 1
const TO_INFINITY = "9".repeat(400); // Number() → Infinity
for (const bad of [
  "-1",
  "1.5",
  "",
  "01",
  " 3",
  "3e2",
  "abc",
  "Infinity",
  "0x10",
  "3\n",
  UNSAFE,
  TO_INFINITY,
  undefined,
]) {
  test(`scope: malformed all_count ${JSON.stringify(bad)} → fail`, () => {
    const d = scope({ filterAllCount: bad });
    assert.equal(d.ok, false);
    assert.match(d.reason, /malformed all_count/);
  });
  test(`scope: malformed changed_files ${JSON.stringify(bad)} → fail`, () => {
    const d = scope({ prChangedFiles: bad });
    assert.equal(d.ok, false);
    assert.match(d.reason, /malformed pull_request\.changed_files/);
  });
}

// ─── decideVerdict ──────────────────────────────────────────────────────────

const verdict = (o) =>
  decideVerdict({ changesResult: "success", inScope: "true", auditResult: "success", ...o });

test("verdict: in scope + audit success → green, executed", () => {
  const d = verdict({});
  assert.equal(d.ok, true);
  assert.equal(d.ran, true);
});

for (const auditResult of ["failure", "cancelled", "skipped"]) {
  test(`verdict: in scope + audit ${auditResult} → red`, () => {
    const d = verdict({ auditResult });
    assert.equal(d.ok, false);
    assert.match(d.reason, new RegExp(`result=${auditResult}`));
  });
}

for (const auditResult of ["", "neutral", "SUCCESS", undefined]) {
  test(`verdict: unknown/missing audit result ${JSON.stringify(auditResult)} → red`, () => {
    for (const inScope of ["true", "false"]) {
      const d = verdict({ inScope, auditResult });
      assert.equal(d.ok, false);
      assert.match(d.reason, /unknown audit job result/);
    }
  });
}

test("verdict: out of scope + audit skipped → green, NOT executed", () => {
  const d = verdict({ inScope: "false", auditResult: "skipped" });
  assert.equal(d.ok, true);
  assert.equal(d.ran, false);
  assert.match(d.reason, /OUT OF SCOPE — Deterministic gates NOT executed/);
});

for (const auditResult of ["success", "failure", "cancelled"]) {
  test(`verdict: out of scope + audit ${auditResult} → red (inconsistent)`, () => {
    const d = verdict({ inScope: "false", auditResult });
    assert.equal(d.ok, false);
    assert.match(d.reason, /inconsistent/);
  });
}

for (const changesResult of ["failure", "cancelled", "skipped", "", undefined]) {
  test(`verdict: scope job ${JSON.stringify(changesResult)} → red`, () => {
    const d = verdict({ changesResult, inScope: "false", auditResult: "skipped" });
    assert.equal(d.ok, false);
    assert.match(d.reason, /scope job did not succeed/);
  });
}

for (const inScope of ["", "yes", undefined]) {
  test(`verdict: malformed in_scope ${JSON.stringify(inScope)} → red`, () => {
    const d = verdict({ inScope, auditResult: "skipped" });
    assert.equal(d.ok, false);
    assert.match(d.reason, /malformed in_scope/);
  });
}

// ─── main() — CI I/O contract ───────────────────────────────────────────────

function withTmp(fn) {
  const dir = mkdtempSync(join(tmpdir(), "audit-gates-verdict-"));
  const origLog = console.log;
  const logs = [];
  console.log = (...a) => logs.push(a.join(" "));
  try {
    return fn(dir, logs);
  } finally {
    console.log = origLog;
    rmSync(dir, { recursive: true, force: true });
  }
}

test("main scope: writes in_scope=false for docs-only PR", () =>
  withTmp((dir) => {
    const out = join(dir, "out");
    writeFileSync(out, "");
    const rc = main("scope", {
      GITHUB_OUTPUT: out,
      FILTER_OUTCOME: "success",
      FILTER_IN_SCOPE: "false",
      FILTER_ALL_COUNT: "1",
      PR_CHANGED_FILES: "1",
    });
    assert.equal(rc, 0);
    assert.equal(readFileSync(out, "utf8"), "in_scope=false\n");
  }));

test("main scope: changed_files 3000 + in_scope=false → writes in_scope=true", () =>
  withTmp((dir) => {
    const out = join(dir, "out");
    writeFileSync(out, "");
    const rc = main("scope", {
      GITHUB_OUTPUT: out,
      FILTER_OUTCOME: "success",
      FILTER_IN_SCOPE: "false",
      FILTER_ALL_COUNT: "3000",
      PR_CHANGED_FILES: "3000",
    });
    assert.equal(rc, 0);
    assert.equal(readFileSync(out, "utf8"), "in_scope=true\n");
  }));

test("main scope: unsafe/Infinity count → rc 1, no output written", () =>
  withTmp((dir) => {
    for (const [allCount, changed] of [
      [UNSAFE, "1"],
      ["1", TO_INFINITY],
    ]) {
      const out = join(dir, "out");
      writeFileSync(out, "");
      const rc = main("scope", {
        GITHUB_OUTPUT: out,
        FILTER_OUTCOME: "success",
        FILTER_IN_SCOPE: "false",
        FILTER_ALL_COUNT: allCount,
        PR_CHANGED_FILES: changed,
      });
      assert.equal(rc, 1);
      assert.equal(readFileSync(out, "utf8"), "");
    }
  }));

test("main scope: detection error → rc 1, no output written", () =>
  withTmp((dir, logs) => {
    const out = join(dir, "out");
    writeFileSync(out, "");
    const rc = main("scope", {
      GITHUB_OUTPUT: out,
      FILTER_OUTCOME: "failure",
      FILTER_IN_SCOPE: "",
      FILTER_ALL_COUNT: "",
      PR_CHANGED_FILES: "4",
    });
    assert.equal(rc, 1);
    assert.equal(readFileSync(out, "utf8"), "");
    assert.ok(logs.some((l) => l.startsWith("::error::")));
  }));

test("main scope: incomplete listing below cap + in_scope=false → rc 0, writes in_scope=true", () =>
  withTmp((dir, logs) => {
    const out = join(dir, "out");
    writeFileSync(out, "");
    const rc = main("scope", {
      GITHUB_OUTPUT: out,
      FILTER_OUTCOME: "success",
      FILTER_IN_SCOPE: "false",
      FILTER_ALL_COUNT: "1",
      PR_CHANGED_FILES: "2",
    });
    assert.equal(rc, 0);
    assert.equal(readFileSync(out, "utf8"), "in_scope=true\n");
    assert.ok(logs.some((l) => l.startsWith("::notice::") && /incomplete/.test(l)));
  }));

test("main verdict: detection error chain (changes failure, in_scope unset, audit skipped) → rc 1", () =>
  withTmp((dir, logs) => {
    // What GitHub passes once the scope step exits 1: the job fails and never sets in_scope.
    const sum = join(dir, "summary");
    writeFileSync(sum, "");
    const rc = main("verdict", {
      GITHUB_STEP_SUMMARY: sum,
      CHANGES_RESULT: "failure",
      IN_SCOPE: "",
      AUDIT_RESULT: "skipped",
    });
    assert.equal(rc, 1);
    const s = readFileSync(sum, "utf8");
    assert.match(s, /❌ Deterministic gates — échec/);
    assert.match(s, /scope job did not succeed/);
    assert.doesNotMatch(s, /HORS PÉRIMÈTRE/);
    assert.ok(logs.some((l) => l.startsWith("::error::")));
  }));

test("main scope: missing GITHUB_OUTPUT → rc 1", () =>
  withTmp(() => {
    const rc = main("scope", {
      FILTER_OUTCOME: "success",
      FILTER_IN_SCOPE: "true",
      FILTER_ALL_COUNT: "1",
      PR_CHANGED_FILES: "1",
    });
    assert.equal(rc, 1);
  }));

test("main verdict: out of scope summary says HORS PÉRIMÈTRE / AUDIT NON EXÉCUTÉ", () =>
  withTmp((dir) => {
    const sum = join(dir, "summary");
    writeFileSync(sum, "");
    const rc = main("verdict", {
      GITHUB_STEP_SUMMARY: sum,
      CHANGES_RESULT: "success",
      IN_SCOPE: "false",
      AUDIT_RESULT: "skipped",
    });
    assert.equal(rc, 0);
    const s = readFileSync(sum, "utf8");
    assert.match(s, /HORS PÉRIMÈTRE/);
    assert.match(s, /AUDIT NON EXÉCUTÉ/);
    assert.doesNotMatch(s, /exécutées et vertes/);
  }));

test("main verdict: in scope green summary is not labelled out of scope", () =>
  withTmp((dir) => {
    const sum = join(dir, "summary");
    writeFileSync(sum, "");
    const rc = main("verdict", {
      GITHUB_STEP_SUMMARY: sum,
      CHANGES_RESULT: "success",
      IN_SCOPE: "true",
      AUDIT_RESULT: "success",
    });
    assert.equal(rc, 0);
    const s = readFileSync(sum, "utf8");
    assert.match(s, /exécutées et vertes/);
    assert.doesNotMatch(s, /NON EXÉCUTÉ/);
  }));

test("main verdict: in scope red / cancelled → rc 1", () =>
  withTmp(() => {
    for (const AUDIT_RESULT of ["failure", "cancelled"]) {
      const rc = main("verdict", { CHANGES_RESULT: "success", IN_SCOPE: "true", AUDIT_RESULT });
      assert.equal(rc, 1);
    }
  }));

test("main: unknown or missing mode → rc 2", () =>
  withTmp(() => {
    assert.equal(main("bogus", {}), 2);
    assert.equal(main(undefined, {}), 2);
  }));

// ─── Workflow contract (.github/workflows/audit.yml) ────────────────────────

const wf = yaml.load(readFileSync(WORKFLOW, "utf8"));
const jobs = wf.jobs ?? {};

function runsOf(job) {
  return (job?.steps ?? []).map((s) => s.run).filter((r) => typeof r === "string");
}

test("workflow: pull_request runs on every PR (no paths / paths-ignore)", () => {
  const pr = wf.on?.pull_request;
  assert.ok(pr === null || typeof pr === "object", "on.pull_request must be declared");
  assert.equal(pr?.paths, undefined);
  assert.equal(pr?.["paths-ignore"], undefined);
});

test("workflow: changes job keeps the historical scope list + catch-all", () => {
  const steps = jobs.changes?.steps ?? [];
  const filter = steps.find((s) => s.id === "filter");
  assert.ok(filter, "changes job must have a step id=filter");
  assert.equal(filter.uses, "dorny/paths-filter@v4");
  const filters = yaml.load(filter.with.filters);
  assert.deepEqual(filters.in_scope, IN_SCOPE_PATTERNS);
  assert.deepEqual(filters.all, ["**"]);
  assert.equal(jobs.changes.outputs?.in_scope, "${{ steps.scope.outputs.in_scope }}");
  const sc = steps.find((s) => s.id === "scope");
  assert.ok(sc, "changes job must have a step id=scope");
  assert.equal(sc.if, "always()");
  assert.equal(sc.run.trim(), "node scripts/ci/audit-gates-verdict.mjs scope");
  assert.deepEqual(sc.env, {
    FILTER_OUTCOME: "${{ steps.filter.outcome }}",
    FILTER_IN_SCOPE: "${{ steps.filter.outputs.in_scope }}",
    FILTER_ALL_COUNT: "${{ steps.filter.outputs.all_count }}",
    PR_CHANGED_FILES: "${{ github.event.pull_request.changed_files }}",
  });
});

test("workflow: audit job is gated on changes.in_scope and keeps its name", () => {
  assert.equal(jobs.audit?.name, "🛡️ Deterministic gates");
  assert.equal(jobs.audit.needs, "changes");
  assert.equal(jobs.audit.if, "needs.changes.outputs.in_scope == 'true'");
});

test("workflow: these tests run in the audit job AFTER its existing npm ci", () => {
  const steps = jobs.audit?.steps ?? [];
  const ci = steps.findIndex((s) => typeof s.run === "string" && s.run.trim() === "npm ci");
  assert.ok(ci >= 0, "audit job must keep its npm ci step");
  const t = steps.findIndex(
    (s) =>
      typeof s.run === "string" &&
      s.run.trim() === "node --test scripts/ci/audit-gates-verdict.test.mjs",
  );
  assert.ok(t >= 0, "audit job must run node --test scripts/ci/audit-gates-verdict.test.mjs");
  assert.ok(t > ci, "the test step must come after npm ci (js-yaml)");
  assert.equal(steps[t].if, undefined, "the test step must not be conditional");
  assert.equal(steps[t]["continue-on-error"], undefined);
});

test("workflow: verdict job always runs after changes + audit", () => {
  const v = jobs.verdict;
  assert.ok(v, "verdict job must exist");
  assert.equal(v.name, "🛡️ Deterministic gates — verdict");
  assert.deepEqual(v.needs, ["changes", "audit"]);
  assert.equal(v.if, "always()");
  const step = (v.steps ?? []).find(
    (s) => typeof s.run === "string" && s.run.includes("audit-gates-verdict.mjs verdict"),
  );
  assert.ok(step, "verdict job must run the verdict mode");
  assert.deepEqual(step.env, {
    CHANGES_RESULT: "${{ needs.changes.result }}",
    IN_SCOPE: "${{ needs.changes.outputs.in_scope }}",
    AUDIT_RESULT: "${{ needs.audit.result }}",
  });
  assert.equal(step.run.trim(), "node scripts/ci/audit-gates-verdict.mjs verdict");
});

test("workflow: verdict job is light — builtins only, no setup-node / npm ci", () => {
  const v = jobs.verdict;
  assert.ok(v, "verdict job must exist");
  for (const s of v.steps ?? []) {
    assert.ok(
      !(typeof s.uses === "string" && s.uses.startsWith("actions/setup-node")),
      "verdict job must not add setup-node",
    );
    assert.equal(s.if, undefined, `verdict step "${s.name ?? s.uses}" must not be conditional`);
  }
  for (const r of runsOf(v)) {
    assert.ok(!/\bnpm\b/.test(r), `verdict job must not run npm: ${r}`);
    assert.ok(!r.includes("node --test"), `verdict job must not run tests: ${r}`);
  }
});

test("workflow: no continue-on-error and no ${{ }} inside run: of changes/verdict", () => {
  for (const name of ["changes", "verdict"]) {
    const job = jobs[name];
    assert.equal(job?.["continue-on-error"], undefined, `${name} job continue-on-error`);
    for (const s of job.steps ?? []) {
      assert.equal(s["continue-on-error"], undefined, `${name} step continue-on-error`);
    }
    for (const r of runsOf(job)) {
      assert.ok(!r.includes("${{"), `${name}: expression interpolated in run: ${r}`);
    }
  }
});
