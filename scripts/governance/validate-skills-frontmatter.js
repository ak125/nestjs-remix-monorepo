#!/usr/bin/env node
/**
 * scripts/governance/validate-skills-frontmatter.js
 *
 * Skills canon validator (PR-V2-SKILLS-CANON, Phase 0 warn-only).
 *
 * For every `SKILL.md` under `.claude/skills/<name>/`, validates :
 *   1. Frontmatter present (YAML block at top, fenced by `---`)
 *   2. Conformance to `.spec/00-canon/ai-registry/skill.schema.json`
 *   3. `name` matches the directory name
 *   4. Every entry in `owners[]` is mentioned in
 *      `.spec/00-canon/repository-registry/ownership.yaml`
 *   5. `domain` is a real domain in
 *      `.spec/00-canon/repository-registry/domains.yaml`
 *   6. `description` contains the trigger phrase "Use when" (CSO)
 *   7. (Soft) `last_verified` is not in the future and not older than
 *      365 days for stable skills.
 *
 * Usage :
 *   node scripts/governance/validate-skills-frontmatter.js
 *   node scripts/governance/validate-skills-frontmatter.js --skill <name>
 *   node scripts/governance/validate-skills-frontmatter.js --json > report.json
 *
 * Exit codes :
 *   0 — all skills pass
 *   1 — at least one skill failed validation
 *   2 — internal error (schema missing, parse error)
 */
"use strict";

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const Ajv2020 = require("ajv/dist/2020");
const addFormats = require("ajv-formats");

const MONOREPO_ROOT = path.resolve(__dirname, "..", "..");
const SKILLS_DIR = path.join(MONOREPO_ROOT, ".claude", "skills");
const SCHEMA_PATH = path.join(
  MONOREPO_ROOT,
  ".spec",
  "00-canon",
  "ai-registry",
  "skill.schema.json"
);
const OWNERSHIP_PATH = path.join(
  MONOREPO_ROOT,
  ".spec",
  "00-canon",
  "repository-registry",
  "ownership.yaml"
);
const DOMAINS_PATH = path.join(
  MONOREPO_ROOT,
  ".spec",
  "00-canon",
  "repository-registry",
  "domains.yaml"
);

const STALE_DAYS = 365;

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { skill: null, json: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--skill") out.skill = args[++i];
    else if (args[i] === "--json") out.json = true;
  }
  return out;
}

function loadSchema() {
  return JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
}

function loadKnownOwners() {
  const raw = yaml.load(fs.readFileSync(OWNERSHIP_PATH, "utf8"));
  const owners = new Set();
  for (const entry of raw.entries || []) {
    if (typeof entry.owner === "string") owners.add(entry.owner);
  }
  return owners;
}

function loadKnownDomains() {
  const raw = yaml.load(fs.readFileSync(DOMAINS_PATH, "utf8"));
  const domains = new Set();
  const list = Array.isArray(raw) ? raw : raw.entries || raw.domains || [];
  for (const entry of list) {
    if (typeof entry.id === "string") domains.add(entry.id);
  }
  return domains;
}

function listSkills(filterName) {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  return fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => !filterName || name === filterName)
    .sort();
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]+?)\r?\n---/;

function extractFrontmatter(content) {
  const match = content.match(FRONTMATTER_RE);
  if (!match) return null;
  try {
    return yaml.load(match[1]);
  } catch (e) {
    throw new Error(`YAML parse error: ${e.message}`);
  }
}

function validateSkill(name, ctx) {
  const skillDir = path.join(SKILLS_DIR, name);
  const skillFile = path.join(skillDir, "SKILL.md");
  const result = {
    skill: name,
    path: path.relative(MONOREPO_ROOT, skillFile),
    verdict: "ok",
    errors: [],
    warnings: [],
  };

  if (!fs.existsSync(skillFile)) {
    result.verdict = "missing_file";
    result.errors.push(`SKILL.md not found at ${skillFile}`);
    return result;
  }

  const content = fs.readFileSync(skillFile, "utf8");
  let fm;
  try {
    fm = extractFrontmatter(content);
  } catch (e) {
    result.verdict = "yaml_parse_error";
    result.errors.push(e.message);
    return result;
  }

  if (!fm) {
    result.verdict = "no_frontmatter";
    result.errors.push(
      "No YAML frontmatter block found (expected `---\\n…\\n---` at top of file)"
    );
    return result;
  }

  const valid = ctx.validate(fm);
  if (!valid) {
    result.verdict = "schema_invalid";
    for (const err of ctx.validate.errors || []) {
      const where = err.instancePath || "(root)";
      result.errors.push(`${where}: ${err.message}`);
    }
  }

  if (fm.name && fm.name !== name) {
    result.verdict = "name_mismatch";
    result.errors.push(
      `frontmatter name "${fm.name}" does not match directory "${name}"`
    );
  }

  if (Array.isArray(fm.owners)) {
    for (const owner of fm.owners) {
      if (!ctx.knownOwners.has(owner)) {
        result.warnings.push(
          `owner "${owner}" not found in ownership.yaml — consider adding`
        );
      }
    }
  }

  if (typeof fm.domain === "string" && !ctx.knownDomains.has(fm.domain)) {
    if (result.verdict === "ok") result.verdict = "schema_invalid";
    result.errors.push(
      `domain "${fm.domain}" not in domains.yaml`
    );
  }

  if (typeof fm.last_verified === "string") {
    const verified = new Date(fm.last_verified);
    const now = new Date();
    if (verified > now) {
      result.warnings.push(
        `last_verified ${fm.last_verified} is in the future`
      );
    } else if (fm.status === "stable") {
      const ageMs = now - verified;
      const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
      if (ageDays > STALE_DAYS) {
        result.warnings.push(
          `last_verified ${fm.last_verified} is ${ageDays} days old (status=stable, threshold=${STALE_DAYS}d) — manual review recommended`
        );
      }
    }
  }

  return result;
}

function main() {
  const args = parseArgs();
  let schema;
  try {
    schema = loadSchema();
  } catch (e) {
    process.stderr.write(`[FATAL] Cannot load schema at ${SCHEMA_PATH}: ${e.message}\n`);
    process.exit(2);
  }

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  const knownOwners = loadKnownOwners();
  const knownDomains = loadKnownDomains();

  const ctx = { validate, knownOwners, knownDomains };

  const skills = listSkills(args.skill);
  if (skills.length === 0) {
    process.stderr.write(
      args.skill
        ? `[FATAL] Skill "${args.skill}" not found under ${SKILLS_DIR}\n`
        : `[INFO] No skills found under ${SKILLS_DIR}\n`
    );
    process.exit(args.skill ? 2 : 0);
  }

  const results = skills.map((name) => validateSkill(name, ctx));
  const failures = results.filter((r) => r.verdict !== "ok");
  const ok = failures.length === 0;

  if (args.json) {
    process.stdout.write(
      JSON.stringify(
        {
          ok,
          schemaVersion: "1.0.0",
          generatedAt: new Date().toISOString(),
          totalSkills: results.length,
          failureCount: failures.length,
          results,
        },
        null,
        2
      ) + "\n"
    );
  } else {
    process.stdout.write(
      `[validate-skills-frontmatter] evaluating ${results.length} skill(s)\n`
    );
    for (const r of results) {
      const tag = r.verdict === "ok" ? "✓" : "✗";
      process.stdout.write(`  ${tag} ${r.skill} — ${r.verdict}\n`);
      for (const err of r.errors) process.stdout.write(`     ERROR: ${err}\n`);
      for (const warn of r.warnings)
        process.stdout.write(`     WARN : ${warn}\n`);
    }
    process.stdout.write(
      `\n[validate-skills-frontmatter] ${results.length - failures.length} ok, ${failures.length} failure(s)\n`
    );
  }

  process.exit(ok ? 0 : 1);
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

module.exports = { extractFrontmatter, validateSkill };
