#!/usr/bin/env node
/**
 * scripts/governance/validate-agent-operating-map.js
 *
 * Validates .spec/00-canon/ai-registry/agent-operating-map.yaml.
 *
 * Reference projection — non-authoritative. Hard-fail enforcement requires a
 * vault ADR. PR#1 only validates the schema shape (the live map has nodes:[]);
 * cross-ref checks fire only when nodes.length > 0 (activated in PR#2).
 *
 * Flags:
 *   --strict     exit 1 if any error finding (default: warn-only, exit 0)
 *   --self-test  run the schema fixture and assert SCHEMA error is detected
 *   --json       print the JSON report to stdout (in addition to file)
 *
 * Exit codes (aligned with sibling validate-skills-frontmatter.js):
 *   0  OK, or warn-only run (no --strict)
 *   1  validation errors found AND --strict
 *   2  operational failure (map absent, YAML/JSON unparseable, schema not
 *      compilable) — surfaced as a readable [FATAL] line, never a raw stack
 *      trace. Set DEBUG=1 to also print the stack.
 *
 * CommonJS to stay consistent with sibling validators
 * (scripts/governance/validate-skills-frontmatter.js).
 */

const fs = require("node:fs");
const path = require("node:path");

const yaml = require("js-yaml");
const Ajv2020 = require("ajv/dist/2020");
const addFormats = require("ajv-formats");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const MAP_PATH = path.join(
  REPO_ROOT,
  ".spec/00-canon/ai-registry/agent-operating-map.yaml",
);
const SCHEMA_PATH = path.join(
  REPO_ROOT,
  ".spec/00-canon/ai-registry/agent-operating-map.schema.json",
);
const OWNER_PATH = path.join(
  REPO_ROOT,
  ".spec/00-canon/repository-registry/ownership.yaml",
);
const DOMAINS_PATH = path.join(
  REPO_ROOT,
  ".spec/00-canon/repository-registry/domains.yaml",
);
const SKILLS_REGISTRY_PATH = path.join(
  REPO_ROOT,
  ".spec/00-canon/ai-registry/skills.registry.json",
);
const REPORT_DIR = path.join(REPO_ROOT, "audit-reports");
const REPORT_PATH = path.join(REPORT_DIR, "agent-operating-map-report.json");

const argv = new Set(process.argv.slice(2));
const strict = argv.has("--strict");
const selfTest = argv.has("--self-test");
const jsonOut = argv.has("--json");

// Exit codes (aligned with sibling validate-skills-frontmatter.js).
const EXIT_OK = 0;
const EXIT_VALIDATION = 1;
const EXIT_OP_ERROR = 2;

function loadYaml(p) {
  return yaml.load(fs.readFileSync(p, "utf8"));
}

function knownOwnersFromOwnership() {
  if (!fs.existsSync(OWNER_PATH)) return new Set();
  const o = loadYaml(OWNER_PATH);
  return new Set(
    (o.entries ?? [])
      .map((e) => (e && e.owner) || null)
      .filter(Boolean)
      .filter((owner) => owner !== "__unassigned__"),
  );
}

function knownDomainsFromDomainsYaml() {
  if (!fs.existsSync(DOMAINS_PATH)) return new Set();
  const d = loadYaml(DOMAINS_PATH);
  return new Set((d.entries ?? []).map((e) => e && e.id).filter(Boolean));
}

function skillNamesFromRegistry() {
  if (!fs.existsSync(SKILLS_REGISTRY_PATH)) return new Set();
  try {
    const r = JSON.parse(fs.readFileSync(SKILLS_REGISTRY_PATH, "utf8"));
    return new Set((r.skills ?? []).map((s) => s && s.name).filter(Boolean));
  } catch {
    return new Set();
  }
}

/**
 * Run all validation checks against a map document.
 * Returns array of { severity: 'error'|'warn', code, message, where }.
 */
function checkMap(map, ajvValidate) {
  const findings = [];
  const add = (severity, code, message, where) =>
    findings.push({ severity, code, message, where });

  // 1) Schema
  if (!ajvValidate(map)) {
    for (const err of ajvValidate.errors || []) {
      add(
        "error",
        "SCHEMA",
        `${err.instancePath || "<root>"} ${err.message}`,
        err.instancePath,
      );
    }
    // Bail on schema errors — downstream checks assume valid shape.
    return findings;
  }

  const nodes = map.nodes || [];
  const nodeIds = new Set(nodes.map((n) => n.id));
  const surfaces = map.surfaces || [];
  const handoffs = map.handoffs || [];

  // Cross-ref checks only fire once inventory exists (PR#2 onwards).
  const hasInventory = nodes.length > 0;

  // 2) Node path existence
  if (hasInventory) {
    for (const n of nodes) {
      if (!fs.existsSync(path.join(REPO_ROOT, n.path))) {
        add(
          "error",
          "NODE_PATH_MISSING",
          `node ${n.id} path not on disk: ${n.path}`,
          n.id,
        );
      }
    }
  }

  // 3) Surface loads cross-ref
  if (hasInventory) {
    for (const s of surfaces) {
      for (const kind of ["skills", "agents"]) {
        const arr = (s.loads && s.loads[kind]) || [];
        for (const id of arr) {
          if (!nodeIds.has(id)) {
            add(
              "error",
              "SURFACE_LOAD_ORPHAN",
              `surface ${s.id} loads.${kind} unknown node: ${id}`,
              s.id,
            );
          }
        }
      }
    }
  }

  // 4) Handoff ref cross-check
  if (hasInventory) {
    const refOk = (ref) => ref.startsWith("external:") || nodeIds.has(ref);
    for (const h of handoffs) {
      for (const role of ["produced_by", "consumed_by"]) {
        const v = h[role];
        const arr = Array.isArray(v) ? v : [v];
        for (const ref of arr) {
          if (!refOk(ref)) {
            add(
              "error",
              "HANDOFF_REF_ORPHAN",
              `handoff ${h.id} ${role} unknown ref: ${ref}`,
              h.id,
            );
          }
        }
      }
    }
  }

  // 5) Owner cross-check (TBD permitted during transition).
  if (hasInventory) {
    const known = knownOwnersFromOwnership();
    for (const n of nodes) {
      if (n.owner === "TBD") {
        add("warn", "NODE_OWNER_TBD", `node ${n.id} owner is TBD`, n.id);
      } else if (known.size > 0 && !known.has(n.owner)) {
        add(
          "error",
          "NODE_OWNER_UNKNOWN",
          `node ${n.id} owner not in ownership.yaml entries: ${n.owner}`,
          n.id,
        );
      }
    }
  }

  // 6) Orphan nodes
  if (hasInventory) {
    const refFromSurface = new Set(
      surfaces.flatMap((s) => [
        ...((s.loads && s.loads.skills) || []),
        ...((s.loads && s.loads.agents) || []),
      ]),
    );
    const refFromHandoff = new Set(
      handoffs.flatMap((h) => {
        const out = [];
        for (const role of ["produced_by", "consumed_by"]) {
          const v = h[role];
          if (Array.isArray(v)) out.push(...v);
          else out.push(v);
        }
        return out.filter(
          (r) => typeof r === "string" && !r.startsWith("external:"),
        );
      }),
    );
    for (const n of nodes) {
      if (!refFromSurface.has(n.id) && !refFromHandoff.has(n.id)) {
        add(
          "warn",
          "NODE_ORPHAN",
          `node ${n.id} not referenced by any surface or handoff`,
          n.id,
        );
      }
    }
  }

  // 7) Department checks — fire when departments are declared (independent of the
  //    node inventory, unlike checks 2-6). All warn-only in V1: never blocking,
  //    hard-fail enforcement requires a vault ADR (same stance as the rest of the map).
  const departments = map.departments || [];
  if (departments.length > 0) {
    const declaredCaps = new Set(
      (map.declared_capabilities || []).map((c) => c.id),
    );
    const skillNames = skillNamesFromRegistry();
    const knownDomains = knownDomainsFromDomainsYaml();
    // Resolution set for a capability slug: declared allowlist ∪ registry skills ∪ nodes.
    const capResolves = (cap) =>
      declaredCaps.has(cap) || skillNames.has(cap) || nodeIds.has(cap);

    for (const d of departments) {
      // 7a) lead resolves to an agent/skill node, a declared capability, or the
      //     `<id>-lead` convention (a structured-manual lead without a backing node).
      const leadOk =
        nodeIds.has(d.lead) ||
        declaredCaps.has(d.lead) ||
        d.lead === `${d.id}-lead`;
      if (!leadOk) {
        add(
          "warn",
          "DEPT_LEAD_UNRESOLVED",
          `department ${d.id} lead "${d.lead}" is neither a node, a declared capability, nor the ${d.id}-lead convention`,
          d.id,
        );
      }

      // 7b) capabilities resolve to the explicit target set (no ghost slugs).
      for (const cap of d.capabilities || []) {
        if (!capResolves(cap)) {
          add(
            "warn",
            "DEPT_CAPABILITY_UNRESOLVED",
            `department ${d.id} capability "${cap}" resolves to no skill, node, or declared_capabilities entry`,
            d.id,
          );
        }
      }

      // 7c) repo_domains exist in domains.yaml.
      for (const dom of d.repo_domains || []) {
        if (knownDomains.size > 0 && !knownDomains.has(dom)) {
          add(
            "warn",
            "DEPT_REPO_DOMAIN_UNKNOWN",
            `department ${d.id} repo_domain "${dom}" not in domains.yaml`,
            d.id,
          );
        }
      }
    }
  }

  return findings;
}

function loadSchema() {
  return JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
}

function makeAjv() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(loadSchema());
}

function runSchemaSelfTest() {
  // PR#1: structural/schema-shape verification only. Cross-ref self-test will
  // be added in PR#2 once nodes:[] is populated (separate fixtures triggering
  // NODE_PATH_MISSING, HANDOFF_REF_ORPHAN, etc.).
  const fixturePath = path.join(
    REPO_ROOT,
    "scripts/governance/__fixtures__/agent-operating-map.invalid.yaml",
  );
  let fixture;
  let ajvValidate;
  try {
    fixture = loadYaml(fixturePath);
    ajvValidate = makeAjv();
  } catch (e) {
    console.error(`[FATAL] schema self-test setup failed: ${e.message}`);
    process.exit(EXIT_OP_ERROR);
  }
  const findings = checkMap(fixture, ajvValidate);
  const passedSchema = findings.some((f) => f.code === "SCHEMA");
  if (!passedSchema) {
    console.error(
      "schema self-test: FAIL — invalid fixture did not trigger SCHEMA error",
    );
    process.exit(EXIT_VALIDATION);
  }
  console.log("schema self-test: PASS (schema validation error detected)");
  process.exit(EXIT_OK);
}

/** Build + persist the JSON report, returning the partitioned findings. */
function writeReport(findings) {
  const errors = findings.filter((f) => f.severity === "error");
  const warns = findings.filter((f) => f.severity === "warn");
  const report = {
    generated_at: new Date().toISOString(),
    map_path: path.relative(REPO_ROOT, MAP_PATH),
    counts: {
      errors: errors.length,
      warns: warns.length,
      total: findings.length,
    },
    findings,
  };
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  return { report, errors, warns };
}

/**
 * Operational failure (missing/unparseable map or schema). Surfaced as a
 * structured `error` finding in the report — never a raw stack trace — then
 * exit 2. Independent of --strict: an infra failure is not a validation verdict.
 */
function failOperational(code, message) {
  const { report } = writeReport([
    { severity: "error", code, message, where: null },
  ]);
  if (jsonOut) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.error(`[FATAL] ${code}: ${message}`);
    console.error(`Report: ${path.relative(REPO_ROOT, REPORT_PATH)}`);
  }
  process.exit(EXIT_OP_ERROR);
}

function main() {
  if (selfTest) return runSchemaSelfTest();

  let ajvValidate;
  try {
    ajvValidate = makeAjv();
  } catch (e) {
    return failOperational(
      "SCHEMA_LOAD",
      `cannot load/compile schema at ${path.relative(REPO_ROOT, SCHEMA_PATH)}: ${e.message}`,
    );
  }

  if (!fs.existsSync(MAP_PATH)) {
    return failOperational(
      "MAP_MISSING",
      `map not found on disk: ${path.relative(REPO_ROOT, MAP_PATH)}`,
    );
  }

  let map;
  try {
    map = loadYaml(MAP_PATH);
  } catch (e) {
    return failOperational(
      "MAP_PARSE",
      `cannot parse YAML at ${path.relative(REPO_ROOT, MAP_PATH)}: ${e.message}`,
    );
  }

  const findings = checkMap(map, ajvValidate);
  const { report, errors, warns } = writeReport(findings);

  if (jsonOut) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(
      `agent-operating-map: ${errors.length} errors, ${warns.length} warnings`,
    );
    for (const f of findings) {
      console.log(`  [${f.severity.toUpperCase()}] ${f.code}: ${f.message}`);
    }
    console.log(`Report: ${path.relative(REPO_ROOT, REPORT_PATH)}`);
  }

  process.exit(strict && errors.length > 0 ? EXIT_VALIDATION : EXIT_OK);
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    process.stderr.write(`[FATAL] ${e.message}\n`);
    if (process.env.DEBUG) process.stderr.write(`${e.stack}\n`);
    process.exit(EXIT_OP_ERROR);
  }
}

module.exports = { checkMap, makeAjv, loadYaml };
