#!/usr/bin/env node
/**
 * scripts/governance/build-skills-registry.js
 *
 * Builds `.spec/00-canon/ai-registry/skills.registry.json` from the
 * frontmatters of every `.claude/skills/<name>/SKILL.md`.
 *
 * AI Governance Control Plane — projection layer (PR-V2 Layer 4). Mirrors
 * the pattern used by `scripts/registry/build-canonical-registry.js` for the
 * Repository Control Plane (ADR-058 canonical.json).
 *
 * The output is machine-readable, deterministic (skills sorted by name,
 * tags sorted, fields ordered), and includes a sha256 content checksum
 * per skill for change detection.
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

const { extractFrontmatter } = require("./validate-skills-frontmatter");

const MONOREPO_ROOT = path.resolve(__dirname, "..", "..");
const SKILLS_DIR = path.join(MONOREPO_ROOT, ".claude", "skills");
const OUTPUT_PATH = path.join(
  MONOREPO_ROOT,
  ".spec",
  "00-canon",
  "ai-registry",
  "skills.registry.json"
);

function parseArgs() {
  const args = process.argv.slice(2);
  return { check: args.includes("--check") };
}

function sha256(content) {
  return "sha256:" + crypto.createHash("sha256").update(content).digest("hex");
}

function buildEntry(name) {
  const skillFile = path.join(SKILLS_DIR, name, "SKILL.md");
  const content = fs.readFileSync(skillFile, "utf8");
  let fm;
  try {
    fm = extractFrontmatter(content);
  } catch {
    fm = null;
  }

  const entry = {
    name,
    path: path.relative(MONOREPO_ROOT, skillFile).replace(/\\/g, "/"),
    checksum: sha256(content),
    spec_compliant: false,
  };

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

function listSkills() {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  return fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function buildRegistry() {
  const names = listSkills();
  const skills = names.map(buildEntry);
  const issues = skills
    .filter((s) => !s.spec_compliant)
    .map((s) => ({ skill: s.name, reason: "frontmatter not spec-compliant" }));

  return {
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    schemaPath:
      ".spec/00-canon/ai-registry/skill.schema.json",
    totalSkills: skills.length,
    compliantCount: skills.filter((s) => s.spec_compliant).length,
    skills,
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
        `[build-skills-registry] ✓ registry is up-to-date (${registry.totalSkills} skills, ${registry.compliantCount} compliant)\n`
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
      `  ${registry.totalSkills} skills, ${registry.compliantCount} compliant, ${registry.issues.length} issue(s)\n`
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

module.exports = { buildRegistry };
