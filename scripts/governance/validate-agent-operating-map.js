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
const REPORT_DIR = path.join(REPO_ROOT, "audit-reports");
const REPORT_PATH = path.join(REPORT_DIR, "agent-operating-map-report.json");

const argv = new Set(process.argv.slice(2));
const strict = argv.has("--strict");
const selfTest = argv.has("--self-test");
const jsonOut = argv.has("--json");

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
  const fixture = loadYaml(fixturePath);
  const ajvValidate = makeAjv();
  const findings = checkMap(fixture, ajvValidate);
  const passedSchema = findings.some((f) => f.code === "SCHEMA");
  if (!passedSchema) {
    console.error(
      "schema self-test: FAIL — invalid fixture did not trigger SCHEMA error",
    );
    process.exit(1);
  }
  console.log("schema self-test: PASS (schema validation error detected)");
  process.exit(0);
}

function main() {
  if (selfTest) return runSchemaSelfTest();

  const ajvValidate = makeAjv();
  const map = loadYaml(MAP_PATH);
  const findings = checkMap(map, ajvValidate);

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

  process.exit(strict && errors.length > 0 ? 1 : 0);
}

main();
