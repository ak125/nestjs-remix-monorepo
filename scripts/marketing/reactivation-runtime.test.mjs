import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");

test("CLI accepts canonical checkout origins and rejects other repositories", () => {
  const configured = spawnSync(
    "git",
    ["config", "--get", "remote.origin.url"],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 5000,
      windowsHide: true,
    },
  );
  assert.equal(configured.status, 0, configured.stderr);
  const configuredOrigin = configured.stdout.trim();
  assert.ok(configuredOrigin);
  for (const origin of [
    "https://github.com/ak125/nestjs-remix-monorepo.git",
    "https://github.com/ak125/nestjs-remix-monorepo",
    "git@github.com:ak125/nestjs-remix-monorepo.git",
    "https://github.com/other/nestjs-remix-monorepo.git",
    "https://github.com/ak125/nestjs-remix-monorepo-other.git",
    "https://github.com/ak125/nestjs-remix-monorepo?private=value",
    "https://github.com.example.invalid/ak125/nestjs-remix-monorepo",
    "git@github.com.example.invalid:ak125/nestjs-remix-monorepo.git",
    "http://github.com/ak125/nestjs-remix-monorepo",
  ]) {
    const accepted = [
      "https://github.com/ak125/nestjs-remix-monorepo.git",
      "https://github.com/ak125/nestjs-remix-monorepo",
      "git@github.com:ak125/nestjs-remix-monorepo.git",
    ].includes(origin);
    const p = spawnSync(
      process.execPath,
      [
        "--require",
        path.join(root, "scripts/marketing/simulation-no-network.cjs"),
        "--import",
        "tsx",
        path.join(root, "scripts/marketing/run-reactivation-pilot.ts"),
        "--capabilities",
      ],
      {
        cwd: root,
        env: {
          PATH: process.env.PATH,
          SystemRoot: process.env.SystemRoot,
          TSX_TSCONFIG_PATH: path.join(root, "scripts/marketing/tsconfig.json"),
          // Native Git per-process config: no repository configuration is changed.
          GIT_CONFIG_COUNT: "1",
          GIT_CONFIG_KEY_0: `url.${origin}.insteadOf`,
          GIT_CONFIG_VALUE_0: configuredOrigin,
        },
        encoding: "utf8",
        timeout: 30000,
        windowsHide: true,
      },
    );
    assert.equal(p.status, accepted ? 0 : 1, `${origin}: ${p.stderr}`);
    if (accepted) {
      assert.equal(p.stderr, "");
      assert.equal(JSON.parse(p.stdout).real_execution, false);
    } else {
      assert.equal(p.stdout, "");
      assert.deepEqual(JSON.parse(p.stderr), {
        schema_version: "2.0.0",
        error: { code: "REPOSITORY_MISMATCH" },
        real_execution: false,
      });
    }
  }
});

// Alter a fixed synthetic fixture only in the child process's memory. The CLI,
// validators, error boundary and network sentinel all run unchanged.
function runWithFixtureFault(command, fixtureName, mutate) {
  const cli = path.join(root, "scripts/marketing/run-reactivation-pilot.ts");
  const fixturePath = path.join(
    root,
    "scripts/marketing/fixtures",
    fixtureName,
  );
  const script = `
    const fs = require('node:fs');
    const read = fs.readFileSync;
    fs.readFileSync = function(file, ...options) {
      const contents = read.call(this, file, ...options);
      if (typeof file !== 'string' || require('node:path').resolve(file) !== ${JSON.stringify(fixturePath)}) return contents;
      const data = JSON.parse(contents.toString());
      (${mutate.toString()})(data);
      return JSON.stringify(data);
    };
    require('node:module').syncBuiltinESMExports();
    process.argv = [process.execPath, ${JSON.stringify(cli)}, ...${JSON.stringify(command)}];
    require(${JSON.stringify(cli)});
  `;
  return spawnSync(
    process.execPath,
    [
      "--require",
      path.join(root, "scripts/marketing/simulation-no-network.cjs"),
      "--import",
      "tsx",
      "-e",
      script,
    ],
    {
      cwd: root,
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        TSX_TSCONFIG_PATH: path.join(root, "scripts/marketing/tsconfig.json"),
      },
      encoding: "utf8",
      timeout: 30000,
      windowsHide: true,
    },
  );
}

for (const [code, command, fixtureName, mutate] of [
  [
    "DUPLICATE_OBJECT",
    "--segment",
    "workbench.synthetic.json",
    (w) => {
      w.contacts.push(structuredClone(w.contacts[0]));
    },
  ],
  [
    "AMBIGUOUS_CONTACT_IDENTITY",
    "--segment",
    "workbench.synthetic.json",
    (w) => {
      w.contacts.push({ ...w.contacts[0], id: "synthetic-ambiguous-cli" });
    },
  ],
  [
    "CONFLICTING_ECONOMIC_EVENT",
    "--report",
    "economics.synthetic.json",
    (d) => {
      d.orders[1].revenue_ex_tax_minor = "9999";
    },
  ],
  [
    "REFUND_UNRECONCILED",
    "--report",
    "economics.synthetic.json",
    (d) => {
      d.refunds[0].order_id = "synthetic-missing-order";
    },
  ],
  [
    "REFUND_CURRENCY",
    "--report",
    "economics.synthetic.json",
    (d) => {
      d.refunds[0].currency = "USD";
    },
  ],
  [
    "REFUND_BEFORE_ORDER",
    "--report",
    "economics.synthetic.json",
    (d) => {
      d.refunds[0].at = "2026-09-01T00:00:00Z";
    },
  ],
  [
    "REFUND_EXCEEDS_ORDER",
    "--report",
    "economics.synthetic.json",
    (d) => {
      d.refunds[0].revenue_ex_tax_minor = "10001";
    },
  ],
]) {
  test(`V2 CLI preserves the explicit refusal ${code}`, () => {
    const p = runWithFixtureFault([command], fixtureName, mutate);
    assert.equal(p.status, 1, p.stderr);
    assert.equal(p.stdout, "");
    assert.deepEqual(JSON.parse(p.stderr), {
      schema_version: "2.0.0",
      error: { code },
      real_execution: false,
    });
  });
}

test("CLI keeps unexpected errors opaque in both V1 and V2", () => {
  for (const mutate of [
    () => {
      throw new Error("synthetic-private-error-content");
    },
    () => {
      throw new Error("REFUND_EXCEEDS_ORDER\nsynthetic-private-error-content");
    },
    () => {
      throw "REFUND_EXCEEDS_ORDER";
    },
  ]) {
    for (const v2 of [false, true]) {
      const p = runWithFixtureFault(
        v2 ? ["--report"] : [],
        v2 ? "economics.synthetic.json" : "reactivation.synthetic.json",
        mutate,
      );
      assert.equal(p.status, 1, p.stderr);
      assert.equal(p.stdout, "");
      assert.equal(
        p.stderr.trim(),
        v2
          ? JSON.stringify({
              schema_version: "2.0.0",
              error: { code: "PILOT_FAILED" },
              real_execution: false,
            })
          : "PILOT_FAILED",
      );
    }
  }
});

test("CLI succeeds with fake sender credentials and network traps, rejects live switches", () => {
  const env = {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    TSX_TSCONFIG_PATH: path.join(root, "scripts/marketing/tsconfig.json"),
    GMAIL_APP_PASSWORD: "synthetic-not-a-secret",
    GMAIL_USER_EMAIL: "fiction@example.invalid",
    SUPABASE_URL: "https://example.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-not-a-secret",
  };
  const args = [
    "--require",
    "./scripts/marketing/simulation-no-network.cjs",
    "--import",
    "tsx",
    "scripts/marketing/run-reactivation-pilot.ts",
  ];
  const p = spawnSync(process.execPath, args, {
    cwd: root,
    env,
    encoding: "utf8",
    timeout: 30000,
  });
  assert.equal(p.status, 0, p.stderr);
  const r = JSON.parse(p.stdout);
  assert.equal(r.simulation.real_sends, 0);
  assert.equal(r.simulation.transport, "none");
  assert.ok(!p.stdout.includes("synthetic-not-a-secret"));
  assert.ok(!p.stdout.includes("@"));
  for (const option of ["--send", "--approved", "--input", "--sql"]) {
    const bad = spawnSync(process.execPath, [...args, option], {
      cwd: root,
      env,
      encoding: "utf8",
      timeout: 30000,
    });
    assert.equal(bad.status, 1);
    assert.equal(bad.stderr.trim(), "INVALID_ARGUMENT");
    assert.equal(bad.stdout, "");
  }
  // Prove the sentinel catches an actual attempted connection, not just an unused mock.
  const control = spawnSync(
    process.execPath,
    [
      "--require",
      "./scripts/marketing/simulation-no-network.cjs",
      "-e",
      "require('node:net').connect(443,'example.invalid')",
    ],
    { cwd: root, env, encoding: "utf8", timeout: 5000 },
  );
  assert.notEqual(control.status, 0);
  assert.match(control.stderr, /SIMULATION_NETWORK_ATTEMPT/);
});
test("workspace skill frontmatter uses the repository schema, names are unique and references resolve", () => {
  const yaml = require("js-yaml");
  const Ajv = require("ajv/dist/2020");
  const formats = require("ajv-formats");
  const ajv = new Ajv({ allowUnionTypes: true });
  formats(ajv);
  const validate = ajv.compile(
    JSON.parse(
      fs.readFileSync(
        path.join(root, ".spec/00-canon/ai-registry/skill.schema.json"),
        "utf8",
      ),
    ),
  );
  const dirs = [".claude/skills", "workspaces/marketing/.claude/skills"];
  const names = new Set();
  for (const dir of dirs)
    for (const entry of fs.readdirSync(path.join(root, dir), {
      withFileTypes: true,
    })) {
      const file = path.join(root, dir, entry.name, "SKILL.md");
      if (!entry.isDirectory() || !fs.existsSync(file)) continue;
      const contents = fs.readFileSync(file, "utf8");
      const fm = yaml.load(contents.match(/^---\r?\n([\s\S]+?)\r?\n---/)[1]);
      assert.ok(!names.has(fm.name), "duplicate skill " + fm.name);
      names.add(fm.name);
      if (!entry.name.startsWith("amk-")) continue;
      assert.equal(validate(fm), true, JSON.stringify(validate.errors));
      assert.equal(fm.name, entry.name);
      assert.equal(
        fm.metadata.version,
        entry.name === "amk-reactivation"
          ? "1.0.0"
          : entry.name === "amk-marketing-validation"
            ? "2.0.0"
            : entry.name === "amk-marketing-preparation"
              ? "2.1.8"
              : "2.1.4",
      );
      for (const match of contents.matchAll(/\]\(([^)]+)\)/g))
        assert.ok(
          fs.existsSync(path.resolve(path.dirname(file), match[1])),
          "broken " + match[1],
        );
    }
  assert.ok(names.has("amk-reactivation"));
  assert.ok(names.has("amk-marketing-validation"));
  assert.ok(names.has("amk-marketing-preparation"));
  assert.ok(names.has("amk-marketing-operations"));
});

test("V2 CLI runs all 18 scenarios and useful commands without network or secrets; wrong workdir refuses", () => {
  const env = {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    TSX_TSCONFIG_PATH: path.join(root, "scripts/marketing/tsconfig.json"),
    GMAIL_APP_PASSWORD: "synthetic-not-a-secret",
    OPENAI_API_KEY: "synthetic-not-a-secret",
  };
  const args = [
    "--require",
    path.join(root, "scripts/marketing/simulation-no-network.cjs"),
    "--import",
    "tsx",
    path.join(root, "scripts/marketing/run-reactivation-pilot.ts"),
  ];
  for (const command of [
    "--all-scenarios",
    "--segment",
    "--report",
    "--opportunities",
    "--operations",
    "--import-preview",
    "--capabilities",
    "--help",
  ]) {
    const p = spawnSync(process.execPath, [...args, command], {
      cwd: root,
      env,
      encoding: "utf8",
      timeout: 30000,
      maxBuffer: 2 * 1024 * 1024,
    });
    assert.equal(p.status, 0, p.stderr);
    const r = JSON.parse(p.stdout);
    assert.equal(r.real_execution, false);
    assert.ok(!p.stdout.includes("synthetic-not-a-secret"));
    assert.ok(!p.stdout.includes("@"));
    if (command === "--report") {
      const score = r.result.scores.find((s) => s.id === "synthetic-contact-1");
      assert.equal(score.recency_days, 31);
      assert.equal(score.recency_scope, "purchase_history_and_verified_events");
      assert.equal(
        score.purchase_metrics_scope,
        "supplied_purchase_history_only",
      );
      assert.equal(r.result.economics.snapshot_at, "2026-10-02T11:55:00Z");
      assert.equal(
        r.result.economics.marketing_cost_scope,
        "dated_costs_in_report_period",
      );
      assert.deepEqual(r.result.economics.source_ids.costs, ["synthetic-cost"]);
      assert.equal(
        r.result.economics.currencies[0].marketing_cost_ex_tax_minor,
        "1000",
      );
    }
    if (command === "--segment") {
      assert.deepEqual(
        r.result.filter((s) => s.included).map((s) => s.id),
        ["synthetic-contact-inactive"],
      );
    }
    if (command === "--all-scenarios") {
      assert.equal(r.result.length, 18);
      for (const scenario of r.result) {
        assert.ok(["prepare", "ask", "human"].includes(scenario.decision));
        if (scenario.brief) {
          assert.equal(scenario.brief.payload.skill_version, null);
          assert.deepEqual(scenario.brief.payload.source_refs, [
            "synthetic-wiki",
          ]);
        }
      }
      assert.equal(
        r.result.find((s) => s.scenario_id === "J07").brief.payload
          .trigger_event_id,
        "synthetic-event-7",
      );
    }
  }
  const bad = spawnSync(process.execPath, [...args, "--scenario", "J06"], {
    cwd: path.join(root, "workspaces/marketing"),
    env,
    encoding: "utf8",
    timeout: 30000,
  });
  assert.equal(bad.status, 1);
  assert.equal(JSON.parse(bad.stderr).error.code, "WORKDIR_MISMATCH");
});
