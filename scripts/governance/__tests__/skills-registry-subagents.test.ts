/**
 * Unit tests — skills.registry.json : workspace skills and subagents
 * (mandat AB-2, décision 13).
 *
 * Covers buildRegistry() of scripts/governance/build-skills-registry.js :
 *   - a root skill keeps the historical entry shape (no `workspace` key) ;
 *   - a workspace skill carries `workspace` ;
 *   - a subagent lands in subagents[] with kind, department, tools ;
 *   - a duplicate skill name, or a duplicate subagent name, is an error ;
 *   - a skill and a subagent may share a name ;
 *   - a file without frontmatter name is listed in ignoredFiles ;
 *   - an unknown department is reported in issues[].
 *
 * Fixtures live in a temporary directory.
 * Run: tsx --test scripts/governance/__tests__/skills-registry-subagents.test.ts
 */
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildRegistry } = require("../build-skills-registry.js");

let root: string;

function write(rel: string, content: string) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function skill(rel: string, name: string) {
  write(
    rel,
    `---\nname: ${name}\ndescription: Use when testing the registry fixture.\ntype: technique\nstatus: stable\nowners: ["@ak125"]\ndomain: D15\nruntime_class: read-only\nllm_safe: true\n---\nbody\n`
  );
}

function agent(rel: string, fm: string) {
  write(rel, `---\n${fm}\n---\nprompt\n`);
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "skills-registry-"));
  write(
    ".spec/00-canon/ai-registry/agent-operating-map.yaml",
    "departments:\n  - id: ia-agents\n  - id: seo\n"
  );
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("buildRegistry — skills", () => {
  test("root skill keeps the historical shape, workspace skill carries workspace", () => {
    skill(".claude/skills/alpha/SKILL.md", "alpha");
    skill("workspaces/seo-batch/.claude/skills/beta/SKILL.md", "beta");
    const r = buildRegistry({ root, lockSkills: {} });
    assert.equal(r.totalSkills, 2);
    assert.deepEqual(
      r.skills.map((s: any) => [s.name, s.workspace, s.path]),
      [
        ["alpha", undefined, ".claude/skills/alpha/SKILL.md"],
        ["beta", "seo-batch", "workspaces/seo-batch/.claude/skills/beta/SKILL.md"],
      ]
    );
    assert.equal("workspace" in r.skills[0], false);
    assert.equal(r.skills[0].spec_compliant, true);
  });

  test("duplicate skill name across root and workspace is an error", () => {
    skill(".claude/skills/alpha/SKILL.md", "alpha");
    skill("workspaces/wiki/.claude/skills/alpha/SKILL.md", "alpha");
    assert.throws(() => buildRegistry({ root, lockSkills: {} }), /skill name 'alpha' defined twice/);
  });
});

describe("buildRegistry — subagents", () => {
  test("subagent entry : kind, workspace, department, tools sorted", () => {
    agent(
      ".claude/agents/mandat/mandat-x.md",
      "name: mandat-x\ndescription: d\ntools: Read, Bash, Grep\ndisallowedTools: Write, Edit\ndepartment: ia-agents\nmodel: haiku"
    );
    agent("workspaces/seo-batch/.claude/agents/kw.md", "name: kw\ndescription: d\ntools: [WebSearch, Read]");
    const r = buildRegistry({ root, lockSkills: {} });
    assert.equal(r.totalSubagents, 2);
    const [x, kw] = r.subagents;
    assert.equal(x.kind, "subagent");
    assert.equal(x.path, ".claude/agents/mandat/mandat-x.md");
    assert.equal(x.department, "ia-agents");
    assert.deepEqual(x.tools, ["Bash", "Grep", "Read"]);
    assert.deepEqual(x.disallowed_tools, ["Edit", "Write"]);
    assert.equal(x.model, "haiku");
    assert.equal("workspace" in x, false);
    assert.equal(kw.workspace, "seo-batch");
    assert.deepEqual(kw.tools, ["Read", "WebSearch"]);
    assert.equal("department" in kw, false);
    assert.deepEqual(r.issues, []);
  });

  test("duplicate subagent name is an error", () => {
    agent(".claude/agents/a.md", "name: same\ndescription: d");
    agent("workspaces/marketing/.claude/agents/b.md", "name: same\ndescription: d");
    assert.throws(() => buildRegistry({ root, lockSkills: {} }), /subagent name 'same' defined twice/);
  });

  test("a skill and a subagent may share a name", () => {
    skill("workspaces/seo-batch/.claude/skills/keyword-planner/SKILL.md", "keyword-planner");
    agent("workspaces/seo-batch/.claude/agents/keyword-planner.md", "name: keyword-planner\ndescription: d");
    const r = buildRegistry({ root, lockSkills: {} });
    assert.equal(r.totalSkills, 1);
    assert.equal(r.totalSubagents, 1);
  });

  test("file without frontmatter name is ignored, unknown department is an issue", () => {
    write("workspaces/seo-batch/.claude/agents/_shared/tpl.md", "# gabarit partagé\n");
    agent(".claude/agents/z.md", "name: z\ndescription: d\ndepartment: inconnu");
    const r = buildRegistry({ root, lockSkills: {} });
    assert.deepEqual(r.ignoredFiles.map((f: any) => f.path), ["workspaces/seo-batch/.claude/agents/_shared/tpl.md"]);
    assert.equal(r.totalSubagents, 1);
    assert.equal(r.issues.length, 1);
    assert.equal(r.issues[0].subagent, "z");
    assert.match(r.issues[0].reason, /department 'inconnu'/);
  });
});
