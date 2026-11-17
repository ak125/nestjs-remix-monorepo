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
 * Third-party skills, P40 (journal des principes) : a directory whose name is a key of
 * `skills-lock.json` (repo root) is an upstream skill. Its SKILL.md follows
 * the upstream Agent Skills format, so it is checked against the lock instead
 * of the local schema : `source`, 40-char `ref`, `skillPath`, `computedHash`
 * recomputed on the committed folder, upstream `name` and `description`, and
 * an `amk-<name>` wrapper. Every directory absent from the lock keeps the full
 * local validation above, unchanged.
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
const crypto = require("crypto");
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
// P40 (journal des principes) — lock of the third-party skills, written by the `skills` CLI.
const LOCK_PATH = path.join(MONOREPO_ROOT, "skills-lock.json");
const LOCK_VERSION = 2;
const WRAPPER_PREFIX = "amk-";
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

/**
 * Reads skills-lock.json. A missing lock means "no third-party skill".
 * Returns { skills, errors } ; errors describe a lock that cannot be trusted.
 */
function loadSkillsLock(lockPath = LOCK_PATH) {
  if (!fs.existsSync(lockPath)) return { skills: {}, errors: [] };
  let lock;
  try {
    lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  } catch (e) {
    return { skills: {}, errors: [`invalid JSON: ${e.message}`] };
  }
  const errors = [];
  if (!lock || typeof lock !== "object" || Array.isArray(lock)) {
    return { skills: {}, errors: ["lock must be a JSON object"] };
  }
  if (lock.version !== LOCK_VERSION) {
    errors.push(`lock version must be ${LOCK_VERSION}, got ${JSON.stringify(lock.version)}`);
  }
  const skills = lock.skills;
  if (!skills || typeof skills !== "object" || Array.isArray(skills)) {
    errors.push("lock `skills` must be an object");
    return { skills: {}, errors };
  }
  return { skills, errors };
}

const HASH_EXCLUDED_FILES = new Set(["metadata.json"]);
const HASH_EXCLUDED_DIRS = new Set([".git", "__pycache__", "__pypackages__"]);

function isHashExcluded(name, isDirectory) {
  return (
    HASH_EXCLUDED_FILES.has(name) ||
    (isDirectory && HASH_EXCLUDED_DIRS.has(name))
  );
}

/**
 * Folder hash written by the `skills` CLI as `computedHash` in
 * skills-lock.json (skills 1.8.1, `computeSkillFolderHash`) : files sorted by
 * their relative path, sha256 over `path \0 length \0 content`, CRLF folded
 * to LF for text files, `metadata.json` files and `.git`, `__pycache__`,
 * `__pypackages__` directories skipped, symlinks followed inside the folder.
 */
function computeSkillFolderHash(skillDir) {
  const root = fs.realpathSync(skillDir);
  const files = [];
  const walk = (dir, prefix, ancestors) => {
    const realDir = fs.realpathSync(dir);
    if (ancestors.has(realDir)) return;
    const branch = new Set(ancestors).add(realDir);
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (isHashExcluded(entry.name, entry.isDirectory())) continue;
      const fullPath = path.join(dir, entry.name);
      const rel = prefix + entry.name;
      let isDirectory = entry.isDirectory();
      if (entry.isSymbolicLink()) {
        let target;
        try {
          target = fs.realpathSync(fullPath);
        } catch {
          continue;
        }
        if (target !== root && !target.startsWith(root + path.sep)) continue;
        isDirectory = fs.statSync(target).isDirectory();
        if (isDirectory && isHashExcluded(entry.name, true)) continue;
      } else if (!isDirectory && !entry.isFile()) {
        continue;
      }
      if (isDirectory) walk(fullPath, `${rel}/`, branch);
      else files.push({ path: rel, content: fs.readFileSync(fullPath) });
    }
  };
  walk(skillDir, "", new Set());
  const entries = files.map((f) => {
    let content = f.content;
    if (!content.includes(0) && content.includes("\r\n")) {
      content = Buffer.from(
        content.toString("latin1").replaceAll("\r\n", "\n"),
        "latin1"
      );
    }
    return { path: Buffer.from(f.path.split("\\").join("/"), "utf-8"), content };
  });
  entries.sort((a, b) => Buffer.compare(a.path, b.path));
  const hash = crypto.createHash("sha256");
  for (const { path: p, content } of entries) {
    hash.update(p);
    hash.update("\0");
    hash.update(String(content.length));
    hash.update("\0");
    hash.update(content);
  }
  return hash.digest("hex");
}

function validateThirdPartySkill(name, entry, result, ctx) {
  const skillsDir = ctx.skillsDir || SKILLS_DIR;
  const skillDir = path.join(skillsDir, name);
  result.origin = "third_party";
  const fail = (verdict, msg) => {
    if (result.verdict === "ok") result.verdict = verdict;
    result.errors.push(msg);
  };
  const e = entry && typeof entry === "object" ? entry : {};
  if (typeof e.source !== "string" || !/^[\w.-]+\/[\w.-]+$/.test(e.source)) {
    fail("third_party_lock_invalid", "lock entry `source` must be <owner>/<repo>");
  }
  if (e.sourceType !== "github") {
    fail("third_party_lock_invalid", "lock entry `sourceType` must be \"github\"");
  }
  if (typeof e.ref !== "string" || !/^[0-9a-f]{40}$/.test(e.ref)) {
    fail(
      "third_party_lock_invalid",
      "lock entry `ref` must pin a full 40-char commit SHA (P40, journal des principes)"
    );
  }
  if (
    typeof e.skillPath !== "string" ||
    path.posix.basename(e.skillPath) !== "SKILL.md" ||
    path.posix.isAbsolute(e.skillPath) ||
    e.skillPath.split("/").includes("..")
  ) {
    fail(
      "third_party_lock_invalid",
      "lock entry `skillPath` must be a relative path to the upstream SKILL.md"
    );
  }
  if (typeof e.computedHash !== "string" || !/^[0-9a-f]{64}$/.test(e.computedHash)) {
    fail("third_party_lock_invalid", "lock entry `computedHash` must be a sha256 hex digest");
  } else {
    const actual = computeSkillFolderHash(skillDir);
    if (actual !== e.computedHash) {
      fail(
        "third_party_hash_mismatch",
        `folder hash ${actual} differs from lock computedHash ${e.computedHash} — the upstream folder must not be modified (P40, journal des principes)`
      );
    }
  }

  let fm = null;
  try {
    fm = extractFrontmatter(fs.readFileSync(path.join(skillDir, "SKILL.md"), "utf8"));
  } catch (err) {
    fail("yaml_parse_error", err.message);
  }
  if (
    !fm ||
    fm.name !== name ||
    typeof fm.description !== "string" ||
    !fm.description.trim()
  ) {
    fail(
      "third_party_frontmatter_invalid",
      `upstream frontmatter must carry name "${name}" and a non-empty description`
    );
  }

  const wrapper = path.join(skillsDir, WRAPPER_PREFIX + name, "SKILL.md");
  if (!fs.existsSync(wrapper)) {
    fail(
      "third_party_unwrapped",
      `third-party skill has no local wrapper ${WRAPPER_PREFIX}${name}/SKILL.md (P40, journal des principes)`
    );
  }
  return result;
}

function validateSkill(name, ctx) {
  const skillDir = path.join(ctx.skillsDir || SKILLS_DIR, name);
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

  if (ctx.lockSkills && Object.prototype.hasOwnProperty.call(ctx.lockSkills, name)) {
    return validateThirdPartySkill(name, ctx.lockSkills[name], result, ctx);
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

/**
 * Lock-level findings : an unreadable lock, or a lock entry without its
 * committed folder. Reported as extra results so the gate fails visibly.
 */
function validateLock(lock, skillNames, filterName, skillsDir = SKILLS_DIR) {
  const results = [];
  const rel = path.relative(MONOREPO_ROOT, LOCK_PATH);
  if (lock.errors.length && !filterName) {
    results.push({
      skill: rel,
      path: rel,
      verdict: "third_party_lock_invalid",
      errors: lock.errors.slice(),
      warnings: [],
    });
  }
  for (const name of Object.keys(lock.skills).sort()) {
    if (filterName && name !== filterName) continue;
    if (skillNames.includes(name)) continue;
    results.push({
      skill: name,
      path: path.relative(MONOREPO_ROOT, path.join(skillsDir, name, "SKILL.md")),
      origin: "third_party",
      verdict: "third_party_missing_folder",
      errors: [`${rel} lists "${name}" but .claude/skills/${name}/ is absent`],
      warnings: [],
    });
  }
  return results;
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

  const lock = loadSkillsLock();
  const ctx = { validate, knownOwners, knownDomains, lockSkills: lock.skills };

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
  results.push(...validateLock(lock, skills, args.skill));
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

module.exports = {
  extractFrontmatter,
  validateSkill,
  loadSkillsLock,
  computeSkillFolderHash,
  validateLock,
};
