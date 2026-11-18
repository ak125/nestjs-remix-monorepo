#!/usr/bin/env node
/**
 * scripts/governance/build-skills-registry.js
 *
 * Builds `.spec/00-canon/ai-registry/skills.registry.json`, the single
 * registry of the agents' tools (décision 13 : outils des agents au 23 dans un
 * registre unique), from :
 *   - `skills[]` : every root skill `.claude/skills/<name>/SKILL.md`, then every
 *     workspace skill `workspaces/<ws>/.claude/skills/<name>/SKILL.md` (field
 *     `workspace`). Root entries keep their shape ; the department map
 *     annotates workspace skills « via skills.registry » and
 *     build-command-center-snapshot.js resolves them here. Workspace reading
 *     taken from mandat BR's patch 1 (#2157, patch-1-registre.patch, sha256
 *     16a5137468e8ebc5e915942f7884fd0d65f54f9348290b76df6d17c82924f04c).
 *   - `subagents[]` : every subagent `.md` under `.claude/agents/` and
 *     `workspaces/<ws>/.claude/agents/` (subfolders included) whose frontmatter has a `name`
 *     (a file without one is not loaded by Claude Code as a subagent : listed in
 *     `ignoredFiles`). Each entry carries `kind: "subagent"`, its declared
 *     department (frontmatter `department`, checked against the departments of
 *     agent-operating-map.yaml) and the tools read from `tools` /
 *     `disallowedTools`. A separate array, so that the Command Center keeps
 *     resolving department capabilities against skills only.
 * A name defined twice within skills, or twice within subagents, is an error.
 * A skill and a subagent may share a name : Claude Code keeps them apart
 * (e.g. workspaces/seo-batch has a skill folder and a subagent keyword-planner).
 *
 * AI Governance Control Plane — projection layer (PR-V2 Layer 4). Mirrors
 * the pattern used by `scripts/registry/build-canonical-registry.js` for the
 * Repository Control Plane (ADR-058 canonical.json).
 *
 * The output is machine-readable, deterministic (skills sorted by name,
 * tags sorted, fields ordered), and includes a sha256 content checksum
 * per skill for change detection.
 *
 * Third-party skills, P40 (journal des principes) : an entry whose name is a key of
 * `skills-lock.json` is marked `origin: "third_party"` with its lock pin
 * (`source`, `ref`). Its upstream frontmatter is not expected to follow the
 * local schema, so it stays `spec_compliant: false` but is not reported in
 * `issues` ; `validate-skills-frontmatter.js` checks it against the lock.
 *
 * Usage :
 *   node scripts/governance/build-skills-registry.js
 *   node scripts/governance/build-skills-registry.js --check  # diff vs current
 */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const yaml = require("js-yaml");
const stableStringify = require("fast-json-stable-stringify");

const {
  extractFrontmatter,
  loadSkillsLock,
} = require("./validate-skills-frontmatter");

const MONOREPO_ROOT = path.resolve(__dirname, "..", "..");
const OUTPUT_PATH = path.join(
  MONOREPO_ROOT,
  ".spec",
  "00-canon",
  "ai-registry",
  "skills.registry.json"
);
const OPERATING_MAP_REL = ".spec/00-canon/ai-registry/agent-operating-map.yaml";

function parseArgs() {
  const args = process.argv.slice(2);
  return { check: args.includes("--check") };
}

function sha256(content) {
  return "sha256:" + crypto.createHash("sha256").update(content).digest("hex");
}

function relPath(root, file) {
  return path.relative(root, file).replace(/\\/g, "/");
}

function buildEntry({ name, skillFile, workspace }, root = MONOREPO_ROOT) {
  const content = fs.readFileSync(skillFile, "utf8");
  let fm;
  try {
    fm = extractFrontmatter(content);
  } catch {
    fm = null;
  }

  const entry = {
    name,
    path: relPath(root, skillFile),
    checksum: sha256(content),
    spec_compliant: false,
  };
  if (workspace) entry.workspace = workspace;

  if (fm) {
    entry.spec_compliant =
      typeof fm.name === "string" &&
      typeof fm.description === "string" &&
      typeof fm.type === "string" &&
      typeof fm.status === "string" &&
      Array.isArray(fm.owners) &&
      typeof fm.domain === "string" &&
      typeof fm.runtime_class === "string" &&
      typeof fm.llm_safe === "boolean";

    if (fm.type) entry.type = fm.type;
    if (fm.status) entry.status = fm.status;
    if (Array.isArray(fm.owners)) entry.owners = [...fm.owners].sort();
    if (fm.domain) entry.domain = fm.domain;
    if (fm.runtime_class) entry.runtime_class = fm.runtime_class;
    if (typeof fm.llm_safe === "boolean") entry.llm_safe = fm.llm_safe;
    if (fm.last_verified) entry.last_verified = fm.last_verified;
    if (Array.isArray(fm.tags)) entry.tags = [...fm.tags].sort();
    if (fm.metadata && typeof fm.metadata === "object") {
      entry.metadata = fm.metadata;
    }
  }

  return entry;
}

function listWorkspaces(root) {
  const dir = path.join(root, "workspaces");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function listSkillDirs(dir, workspace) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .map((name) => ({ name, skillFile: path.join(dir, name, "SKILL.md"), workspace }))
    .filter((s) => fs.existsSync(s.skillFile));
}

function assertUnique(items, kind, root) {
  const seen = new Map();
  for (const it of items) {
    if (seen.has(it.name)) {
      throw new Error(
        `${kind} name '${it.name}' defined twice : ${relPath(root, seen.get(it.name))} and ${relPath(root, it.file)}`
      );
    }
    seen.set(it.name, it.file);
  }
}

// Root first (order unchanged), then each workspace in alphabetical order.
function listSkills(root = MONOREPO_ROOT) {
  const all = [
    ...listSkillDirs(path.join(root, ".claude", "skills"), null),
    ...listWorkspaces(root).flatMap((ws) =>
      listSkillDirs(path.join(root, "workspaces", ws, ".claude", "skills"), ws)
    ),
  ];
  assertUnique(all.map((s) => ({ name: s.name, file: s.skillFile })), "skill", root);
  return all;
}

function listMarkdown(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) out.push(...listMarkdown(p));
    else if (d.isFile() && d.name.endsWith(".md")) out.push(p);
  }
  return out.sort();
}

// `tools: Read, Grep` (string) or `tools: [Read, Grep]` (list) → sorted array.
function toolList(value) {
  if (value === undefined || value === null) return undefined;
  const items = Array.isArray(value) ? value : String(value).split(",");
  return [...new Set(items.map((t) => String(t).trim()).filter(Boolean))].sort();
}

function loadDepartmentIds(root) {
  const file = path.join(root, OPERATING_MAP_REL);
  if (!fs.existsSync(file)) return null;
  const map = yaml.load(fs.readFileSync(file, "utf8")) || {};
  return new Set((map.departments || []).map((d) => d && d.id).filter(Boolean));
}

function buildSubagentEntry({ file, workspace }, root) {
  const content = fs.readFileSync(file, "utf8");
  let fm = null;
  try {
    fm = extractFrontmatter(content);
  } catch {
    fm = null;
  }
  if (!fm || typeof fm.name !== "string" || !fm.name.trim()) return null;
  const entry = {
    kind: "subagent",
    name: fm.name,
    path: relPath(root, file),
    checksum: sha256(content),
  };
  if (workspace) entry.workspace = workspace;
  if (typeof fm.department === "string") entry.department = fm.department;
  const tools = toolList(fm.tools);
  if (tools) entry.tools = tools;
  const disallowed = toolList(fm.disallowedTools);
  if (disallowed) entry.disallowed_tools = disallowed;
  if (typeof fm.model === "string") entry.model = fm.model;
  if (typeof fm.role === "string") entry.role = fm.role;
  if (fm["disable-model-invocation"] === true) entry.disable_model_invocation = true;
  return entry;
}

// Root `.claude/agents` first, then each workspace in alphabetical order.
function listSubagents(root = MONOREPO_ROOT) {
  const files = [
    ...listMarkdown(path.join(root, ".claude", "agents")).map((file) => ({ file, workspace: null })),
    ...listWorkspaces(root).flatMap((ws) =>
      listMarkdown(path.join(root, "workspaces", ws, ".claude", "agents")).map((file) => ({ file, workspace: ws }))
    ),
  ];
  const subagents = [];
  const ignoredFiles = [];
  for (const f of files) {
    const entry = buildSubagentEntry(f, root);
    if (entry) subagents.push(entry);
    else ignoredFiles.push({ path: relPath(root, f.file), reason: "no frontmatter name : not loaded as a subagent" });
  }
  assertUnique(subagents.map((s) => ({ name: s.name, file: path.join(root, s.path) })), "subagent", root);
  return { subagents, ignoredFiles };
}

function markThirdParty(entry, lockSkills) {
  if (!Object.prototype.hasOwnProperty.call(lockSkills, entry.name)) return entry;
  const pin = lockSkills[entry.name] || {};
  entry.origin = "third_party";
  entry.lock = { ref: pin.ref, source: pin.source };
  return entry;
}

function buildRegistry({ root = MONOREPO_ROOT, lockSkills } = {}) {
  const lock = lockSkills || loadSkillsLock().skills;
  const skills = listSkills(root)
    .map((s) => buildEntry(s, root))
    .map((entry) => markThirdParty(entry, lock));
  const issues = skills
    .filter((s) => !s.spec_compliant && s.origin !== "third_party")
    .map((s) => ({ skill: s.name, reason: "frontmatter not spec-compliant" }));

  const { subagents, ignoredFiles } = listSubagents(root);
  const departmentIds = loadDepartmentIds(root);
  if (departmentIds) {
    for (const a of subagents) {
      if (a.department && !departmentIds.has(a.department)) {
        issues.push({ subagent: a.name, reason: `department '${a.department}' is not a department id of ${OPERATING_MAP_REL}` });
      }
    }
  }

  return {
    schemaVersion: "1.1.0",
    generatedAt: new Date().toISOString(),
    schemaPath:
      ".spec/00-canon/ai-registry/skill.schema.json",
    subagentSchemaPath:
      ".spec/00-canon/ai-registry/skill.schema.json#/$defs/subagent",
    totalSkills: skills.length,
    compliantCount: skills.filter((s) => s.spec_compliant).length,
    totalSubagents: subagents.length,
    skills,
    subagents,
    ignoredFiles,
    issues,
  };
}

function serialize(obj) {
  // Stable-stringify gives canonical key order (alphabetical), but we want
  // a more readable layout — apply stable on the deep values only.
  return JSON.stringify(JSON.parse(stableStringify(obj)), null, 2) + "\n";
}

function main() {
  const args = parseArgs();
  const registry = buildRegistry();
  const serialized = serialize(registry);

  if (args.check) {
    if (!fs.existsSync(OUTPUT_PATH)) {
      process.stderr.write(
        `[FATAL] registry file missing : ${OUTPUT_PATH}\n` +
          "Run without --check to generate it.\n"
      );
      process.exit(1);
    }
    const current = fs.readFileSync(OUTPUT_PATH, "utf8");
    // Allow generatedAt drift (timestamp). Strip it before diff.
    const normalize = (s) =>
      s.replace(/"generatedAt":\s*"[^"]*"/, '"generatedAt":"<ts>"');
    if (normalize(current) === normalize(serialized)) {
      process.stdout.write(
        `[build-skills-registry] ✓ registry is up-to-date (${registry.totalSkills} skills, ${registry.compliantCount} compliant, ${registry.totalSubagents} subagents)\n`
      );
      process.exit(0);
    }
    process.stderr.write(
      `[build-skills-registry] ✗ registry DRIFT detected — run without --check to update\n`
    );
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, serialized);
  process.stdout.write(
    `[build-skills-registry] wrote ${OUTPUT_PATH}\n` +
      `  ${registry.totalSkills} skills, ${registry.compliantCount} compliant, ${registry.totalSubagents} subagents, ${registry.issues.length} issue(s)\n`
  );
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    process.stderr.write(`[FATAL] ${e.message}\n`);
    if (process.env.DEBUG) process.stderr.write(e.stack + "\n");
    process.exit(2);
  }
}

module.exports = { buildRegistry, markThirdParty, toolList };
