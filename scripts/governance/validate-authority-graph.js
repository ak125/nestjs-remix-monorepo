#!/usr/bin/env node
/**
 * scripts/governance/validate-authority-graph.js
 *
 * Commerce Runtime Authority Graph validator (PR-A, Vault #301 résidus).
 *
 * Validates `.spec/00-canon/commerce-runtime/authority-graph.yaml` against:
 *   1. JSON Schema (`authority-graph.schema.json`)
 *   2. Anti-inflation hard caps (max_lines, max_domains, prose_max_lines_per_field)
 *   3. RPC owner files exist on disk
 *   4. RPC test files exist on disk (V1 may be future, warn-only)
 *   5. `allowed_in` / `*_allowed_in` paths refer to existing files (globs OK)
 *
 * Usage:
 *   node scripts/governance/validate-authority-graph.js
 *   node scripts/governance/validate-authority-graph.js --json > report.json
 *
 * Exit codes:
 *   0 — graph passes all checks (errors==0)
 *   1 — at least one error
 *   2 — internal error (schema or graph missing/unparseable)
 */
"use strict";

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const Ajv2020 = require("ajv/dist/2020");
const addFormats = require("ajv-formats");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const CANON_DIR = path.join(
  REPO_ROOT,
  ".spec",
  "00-canon",
  "commerce-runtime",
);
const GRAPH_PATH = path.join(CANON_DIR, "authority-graph.yaml");
const SCHEMA_PATH = path.join(CANON_DIR, "authority-graph.schema.json");

function loadGraph() {
  if (!fs.existsSync(GRAPH_PATH)) {
    console.error(`FATAL: authority-graph.yaml not found at ${GRAPH_PATH}`);
    process.exit(2);
  }
  const raw = fs.readFileSync(GRAPH_PATH, "utf8");
  const lineCount = raw.split("\n").length;
  let parsed;
  try {
    parsed = yaml.load(raw);
  } catch (e) {
    console.error(`FATAL: YAML parse error: ${e.message}`);
    process.exit(2);
  }
  return { parsed, lineCount, raw };
}

function loadSchema() {
  if (!fs.existsSync(SCHEMA_PATH)) {
    console.error(`FATAL: schema not found at ${SCHEMA_PATH}`);
    process.exit(2);
  }
  return JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
}

function validateSchema(graph, schema) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const ok = validate(graph);
  return {
    ok,
    errors: (validate.errors || []).map((e) => ({
      path: e.instancePath || "(root)",
      message: `${e.keyword} ${e.message}`,
    })),
  };
}

function checkAntiInflation(graph, lineCount) {
  const errors = [];
  const gov = graph.governance || {};
  if (lineCount > gov.max_lines) {
    errors.push({
      path: "governance.max_lines",
      message: `authority-graph.yaml has ${lineCount} lines, exceeds hard cap ${gov.max_lines}. Split required.`,
    });
  }
  const authoritiesCount = Object.keys(graph.authorities || {}).length;
  if (authoritiesCount > gov.max_domains) {
    errors.push({
      path: "authorities",
      message: `${authoritiesCount} domains, exceeds hard cap max_domains=${gov.max_domains}.`,
    });
  }
  return errors;
}

function checkProseFields(graph) {
  const errors = [];
  const max = graph.governance?.prose_max_lines_per_field ?? 3;
  const visit = (node, prefix) => {
    if (typeof node === "string") {
      const lines = node.split("\n").filter((l) => l.trim().length > 0).length;
      if (lines > max) {
        errors.push({
          path: prefix,
          message: `prose field has ${lines} non-empty lines, exceeds prose_max_lines_per_field=${max}.`,
        });
      }
    } else if (Array.isArray(node)) {
      node.forEach((item, i) => visit(item, `${prefix}[${i}]`));
    } else if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        visit(v, `${prefix}.${k}`);
      }
    }
  };
  visit(graph, "(root)");
  return errors;
}

function ownerToFilePath(owner) {
  const [serviceName] = owner.split(".");
  if (!serviceName) return null;
  // Convert PascalCase service name → both common NestJS conventions:
  //   OrdersService         → orders.service.ts
  //   OrderStatusService    → order-status.service.ts
  //   OrderActionsService   → order-actions.service.ts
  const withoutSuffix = serviceName.replace(/Service$/, "");
  const kebabBase = withoutSuffix
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();
  const fileName = `${kebabBase}.service.ts`;
  return [
    `backend/src/modules/orders/services/${fileName}`,
    `backend/src/modules/payments/services/${fileName}`,
    `backend/src/modules/suppliers/${fileName}`,
    `backend/src/database/services/${fileName}`,
  ];
}

function checkRpcAuthority(graph) {
  const errors = [];
  const warnings = [];
  const rpcs = graph.rpc_authority?.rpcs ?? {};

  for (const [rpcName, rpc] of Object.entries(rpcs)) {
    const owner = rpc.owner;
    const candidates = ownerToFilePath(owner);
    if (!candidates) {
      errors.push({
        path: `rpc_authority.rpcs.${rpcName}.owner`,
        message: `cannot derive file path from owner '${owner}'`,
      });
      continue;
    }
    const exists = candidates.some((c) =>
      fs.existsSync(path.join(REPO_ROOT, c)),
    );
    if (!exists) {
      warnings.push({
        path: `rpc_authority.rpcs.${rpcName}.owner`,
        message: `owner '${owner}' does not match any existing file: ${candidates.join(", ")}`,
      });
    }

    for (const testPath of rpc.tests || []) {
      const abs = path.join(REPO_ROOT, testPath);
      if (!fs.existsSync(abs)) {
        warnings.push({
          path: `rpc_authority.rpcs.${rpcName}.tests`,
          message: `test file '${testPath}' does not exist yet (OK if planned for upcoming PR)`,
        });
      }
    }
  }

  return { errors, warnings };
}

function checkAllowedInPaths(graph) {
  const errors = [];
  const warnings = [];
  const visit = (node, prefix) => {
    if (Array.isArray(node)) {
      node.forEach((item, i) => visit(item, `${prefix}[${i}]`));
      return;
    }
    if (!node || typeof node !== "object") return;
    for (const [k, v] of Object.entries(node)) {
      if (
        (k === "allowed_in" || k.endsWith("_allowed_in")) &&
        Array.isArray(v)
      ) {
        for (const p of v) {
          if (typeof p !== "string") continue;
          if (p.includes("*")) continue;
          const abs = path.join(REPO_ROOT, p);
          if (!fs.existsSync(abs)) {
            warnings.push({
              path: `${prefix}.${k}`,
              message: `referenced file '${p}' does not exist (OK if planned for upcoming PR)`,
            });
          }
        }
      } else {
        visit(v, `${prefix}.${k}`);
      }
    }
  };
  visit(graph, "(root)");
  return { errors, warnings };
}

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");

  const { parsed: graph, lineCount } = loadGraph();
  const schema = loadSchema();

  const schemaResult = validateSchema(graph, schema);
  const inflationErrors = checkAntiInflation(graph, lineCount);
  const proseErrors = checkProseFields(graph);
  const rpcResult = checkRpcAuthority(graph);
  const pathsResult = checkAllowedInPaths(graph);

  const errors = [
    ...schemaResult.errors,
    ...inflationErrors,
    ...proseErrors,
    ...rpcResult.errors,
    ...pathsResult.errors,
  ];
  const warnings = [...rpcResult.warnings, ...pathsResult.warnings];

  const report = {
    file: path.relative(REPO_ROOT, GRAPH_PATH),
    lineCount,
    schemaOk: schemaResult.ok,
    errors,
    warnings,
    summary: {
      errors: errors.length,
      warnings: warnings.length,
    },
  };

  if (asJson) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    console.log(
      `commerce-runtime/authority-graph.yaml: ${lineCount} lines, schemaOk=${schemaResult.ok}`,
    );
    if (errors.length === 0 && warnings.length === 0) {
      console.log("✓ all checks passed");
    }
    for (const e of errors) console.error(`ERROR ${e.path}: ${e.message}`);
    for (const w of warnings) console.warn(`WARN  ${w.path}: ${w.message}`);
    console.log(
      `Summary: ${errors.length} error(s), ${warnings.length} warning(s)`,
    );
  }

  process.exit(errors.length > 0 ? 1 : 0);
}

if (require.main === module) {
  main();
}

module.exports = {
  loadGraph,
  loadSchema,
  validateSchema,
  checkAntiInflation,
  checkProseFields,
  checkRpcAuthority,
  checkAllowedInPaths,
};
