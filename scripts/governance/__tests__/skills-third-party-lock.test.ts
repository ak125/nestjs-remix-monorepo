/**
 * Unit tests — third-party skills pinned in skills-lock.json (P40, journal des principes).
 *
 * Covers scripts/governance/validate-skills-frontmatter.js and the registry
 * marking of scripts/governance/build-skills-registry.js :
 *   - an upstream skill listed in the lock is checked against the lock
 *     (source, ref, skillPath, computedHash recomputed) instead of the local
 *     schema ;
 *   - a skill absent from the lock keeps the full local schema, unchanged ;
 *   - a folder whose hash differs from the lock is refused.
 *
 * Fixtures are written to a temporary directory : the tests do not depend on
 * which skills the repository currently ships.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const yaml = require("js-yaml");
const Ajv2020 = require("ajv/dist/2020");
const addFormats = require("ajv-formats");
const {
  validateSkill,
  loadSkillsLock,
  computeSkillFolderHash,
  validateLock,
} = require("../validate-skills-frontmatter.js");
const { markThirdParty } = require("../build-skills-registry.js");

const ROOT = path.resolve(__dirname, "..", "..", "..");
const REF = "c9be0e931b7930f7d02126d04774d904c381e7d7";

// Digest produced by the `skills` CLI 1.8.1 itself (computeSkillFolderHash)
// on the demo fixture below : CRLF text, nested folder, metadata.json skipped.
const CLI_DEMO_HASH =
  "f646b2799fe33e16ab317a56dc4216b7dce4bcebec3a97ea1c38d5af274713dc";

const UPSTREAM_SKILL_MD =
  "---\nname: demo-skill\ndescription: Upstream demo skill.\n---\n\n# Demo\n";

const WRAPPER_SKILL_MD = [
  "---",
  "name: amk-demo-skill",
  "description: Use when the third-party skill demo-skill is loaded. AutoMecanik wrapper.",
  "type: discipline",
  "status: experimental",
  "owners: ['@ak125']",
  "domain: D15",
  "runtime_class: read-only",
  "llm_safe: true",
  "last_verified: '2026-11-16'",
  "---",
  "",
  "# Wrapper",
  "",
].join("\n");

let tmp: string;
let skillsDir: string;
let ctxBase: Record<string, unknown>;

function write(rel: string, content: string) {
  const file = path.join(skillsDir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function lockEntry(overrides: Record<string, unknown> = {}) {
  return {
    source: "example-org/agent-skills",
    ref: REF,
    sourceType: "github",
    skillPath: "skills/demo-skill/SKILL.md",
    computedHash: CLI_DEMO_HASH,
    ...overrides,
  };
}

function ctx(lockSkills: Record<string, unknown>) {
  return { ...ctxBase, skillsDir, lockSkills };
}

before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "skills-lock-test-"));
  skillsDir = path.join(tmp, "skills");
  write("demo-skill/SKILL.md", UPSTREAM_SKILL_MD);
  write("demo-skill/references/crlf.md", "line one\r\nline two\r\n");
  write("demo-skill/references/deep/b.md", "nested\n");
  write("demo-skill/metadata.json", '{"ignored":true}\n');
  write("amk-demo-skill/SKILL.md", WRAPPER_SKILL_MD);

  const schema = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, ".spec/00-canon/ai-registry/skill.schema.json"),
      "utf8",
    ),
  );
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const domains = yaml.load(
    fs.readFileSync(
      path.join(ROOT, ".spec/00-canon/repository-registry/domains.yaml"),
      "utf8",
    ),
  );
  const list = Array.isArray(domains)
    ? domains
    : domains.entries || domains.domains || [];
  ctxBase = {
    validate: ajv.compile(schema),
    knownOwners: new Set(["@ak125"]),
    knownDomains: new Set(list.map((d: { id: string }) => d.id)),
  };
});

after(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("computeSkillFolderHash", () => {
  test("matches the digest written by the skills CLI", () => {
    assert.equal(
      computeSkillFolderHash(path.join(skillsDir, "demo-skill")),
      CLI_DEMO_HASH,
    );
  });
});

describe("third-party skill listed in skills-lock.json", () => {
  test("upstream frontmatter is accepted through the lock, with its wrapper", () => {
    const r = validateSkill("demo-skill", ctx({ "demo-skill": lockEntry() }));
    assert.equal(r.verdict, "ok", JSON.stringify(r.errors));
    assert.equal(r.origin, "third_party");
  });

  test("the same upstream frontmatter is refused when the skill is not in the lock", () => {
    const r = validateSkill("demo-skill", ctx({}));
    assert.equal(r.verdict, "schema_invalid");
    assert.equal(r.origin, undefined);
  });

  test("a folder whose hash differs from computedHash is refused", () => {
    const r = validateSkill(
      "demo-skill",
      ctx({ "demo-skill": lockEntry({ computedHash: "0".repeat(64) }) }),
    );
    assert.equal(r.verdict, "third_party_hash_mismatch");
  });

  test("an edited upstream file is refused (folder no longer matches the lock)", () => {
    const file = path.join(skillsDir, "demo-skill/references/deep/b.md");
    fs.writeFileSync(file, "nested, edited locally\n");
    try {
      const r = validateSkill("demo-skill", ctx({ "demo-skill": lockEntry() }));
      assert.equal(r.verdict, "third_party_hash_mismatch");
    } finally {
      fs.writeFileSync(file, "nested\n");
    }
  });

  test("a ref that is not a 40-char commit SHA is refused", () => {
    const r = validateSkill(
      "demo-skill",
      ctx({ "demo-skill": lockEntry({ ref: "main" }) }),
    );
    assert.equal(r.verdict, "third_party_lock_invalid");
  });

  test("a skillPath leaving the upstream repository is refused", () => {
    const r = validateSkill(
      "demo-skill",
      ctx({ "demo-skill": lockEntry({ skillPath: "../x/SKILL.md" }) }),
    );
    assert.equal(r.verdict, "third_party_lock_invalid");
  });

  test("an upstream skill without its amk- wrapper is refused", () => {
    const wrapper = path.join(skillsDir, "amk-demo-skill");
    const parked = path.join(tmp, "parked-wrapper");
    fs.renameSync(wrapper, parked);
    try {
      const r = validateSkill("demo-skill", ctx({ "demo-skill": lockEntry() }));
      assert.equal(r.verdict, "third_party_unwrapped");
    } finally {
      fs.renameSync(parked, wrapper);
    }
  });

  test("a lock entry without its committed folder is reported", () => {
    const lock = { skills: { "absent-skill": lockEntry() }, errors: [] };
    const results = validateLock(lock, ["demo-skill"], null, skillsDir);
    assert.equal(results.length, 1);
    assert.equal(results[0].verdict, "third_party_missing_folder");
  });
});

describe("local skills keep the local schema", () => {
  test("the wrapper itself is validated as a local skill", () => {
    const r = validateSkill(
      "amk-demo-skill",
      ctx({ "demo-skill": lockEntry() }),
    );
    assert.equal(r.verdict, "ok", JSON.stringify(r.errors));
    assert.equal(r.origin, undefined);
  });

  test("a non-compliant local skill still fails when a lock exists", () => {
    write(
      "local-bad/SKILL.md",
      "---\nname: local-bad\ndescription: no trigger\n---\n",
    );
    const r = validateSkill("local-bad", ctx({ "demo-skill": lockEntry() }));
    assert.equal(r.verdict, "schema_invalid");
  });
});

describe("loadSkillsLock", () => {
  test("a missing lock means no third-party skill", () => {
    const r = loadSkillsLock(path.join(tmp, "absent-lock.json"));
    assert.deepEqual(r, { skills: {}, errors: [] });
  });

  test("an unexpected lock version is reported", () => {
    const file = path.join(tmp, "lock-v1.json");
    fs.writeFileSync(file, JSON.stringify({ version: 1, skills: {} }));
    assert.equal(loadSkillsLock(file).errors.length, 1);
  });

  test("the committed repository lock is readable", () => {
    const r = loadSkillsLock(path.join(ROOT, "skills-lock.json"));
    assert.deepEqual(r.errors, []);
  });
});

describe("registry marking (build-skills-registry)", () => {
  test("a locked skill is marked third_party with its pin", () => {
    const entry = markThirdParty(
      { name: "demo-skill", spec_compliant: false },
      { "demo-skill": lockEntry() },
    );
    assert.equal(entry.origin, "third_party");
    assert.deepEqual(entry.lock, {
      ref: REF,
      source: "example-org/agent-skills",
    });
  });

  test("a local skill entry is left untouched", () => {
    const entry = { name: "db-migration", spec_compliant: true };
    assert.deepEqual(
      markThirdParty({ ...entry }, { "demo-skill": lockEntry() }),
      entry,
    );
  });
});
