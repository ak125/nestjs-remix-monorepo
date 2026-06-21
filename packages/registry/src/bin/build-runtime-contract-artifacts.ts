#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { load as parseYaml } from "js-yaml";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  RuntimeContractSchema,
  type RuntimeContract,
} from "../canonical/runtime-contract";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const YAML_PATH = path.join(
  REPO_ROOT,
  ".spec/00-canon/repository-registry/runtime-topology.yaml",
);
const SCHEMA_OUT = path.join(
  REPO_ROOT,
  ".spec/00-canon/_schema/runtime-topology.schema.json",
);

// Modern CLI pattern: pure logic throws, shell boundary catches in main()'s try/catch.
class RuntimeContractBuildError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "RuntimeContractBuildError";
  }
}

function fail(msg: string): never {
  throw new RuntimeContractBuildError(msg);
}

// Supported Node majors. Pure JSON.stringify over zodToJsonSchema()'s
// deterministic output — byte-identical across 20.x and 22.x. Empirically
// verified by PR-W4 #513 on db-contract (same pattern); re-verify on new
// majors before extending.
const SUPPORTED_NODE_MAJORS = ["20", "22", "24"];

{
  const currentMajor = process.versions.node.split(".")[0];
  if (!SUPPORTED_NODE_MAJORS.includes(currentMajor)) {
    console.error(
      `[runtime-contract:build] ABORT — Node ${process.version} unsupported. ` +
        `Supported majors: v${SUPPORTED_NODE_MAJORS.join(", v")}.x. ` +
        "Use nvm/volta to switch, or extend SUPPORTED_NODE_MAJORS after re-running determinism tests.",
    );
    process.exit(2);
  }
}

// Runtime version guard for zod compatibility with zod-to-json-schema.
{
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const zodPkg = require("zod/package.json") as { version: string };
  if (!zodPkg.version.startsWith("3.")) {
    console.error(
      `[runtime-contract:build] ABORT — zod v${zodPkg.version} unsupported (expected 3.x). ` +
        "See packages/registry/package.json runtime deps.",
    );
    process.exit(2);
  }
}

function loadContract(): { contract: RuntimeContract; yamlSha256: string } {
  const raw = readFileSync(YAML_PATH, "utf8");
  const yamlSha256 = createHash("sha256").update(raw).digest("hex");
  const parsed = parseYaml(raw);
  // Hardening: js-yaml will happily return a string, an array, or null for
  // malformed / multi-document / scalar-rooted YAMLs.
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail(
      `runtime-topology.yaml root must be a single object map, got ${
        parsed === null
          ? "null"
          : Array.isArray(parsed)
            ? "array"
            : typeof parsed
      }. Check for accidental document separators ("---") or stray top-level lists.`,
    );
  }
  const result = RuntimeContractSchema.safeParse(parsed);
  if (!result.success) {
    const lines = ["runtime contract does not match schema:"];
    for (const issue of result.error.issues) {
      const where = issue.path.length > 0 ? issue.path.join(".") : "<root>";
      lines.push(`  • ${where}: ${issue.message}`);
    }
    fail(lines.join("\n"));
  }
  return { contract: result.data, yamlSha256 };
}

function emitJsonSchema(yamlSha256: string, entrypointCount: number): string {
  const schema = zodToJsonSchema(RuntimeContractSchema, {
    name: "RuntimeContract",
    target: "jsonSchema7",
  });
  // Forensic markers — audit/origin self-evident from the artifact alone.
  // Stored under $comment (JSON Schema 7 reserved key, ignored by validators).
  const enriched = {
    $comment: [
      "AUTO-GENERATED — DO NOT EDIT. Source: .spec/00-canon/repository-registry/runtime-topology.yaml",
      `sourceSha256: ${yamlSha256}`,
      'generator: @repo/registry bin "build-runtime-contract-artifacts"',
      `nodeMajor: ${SUPPORTED_NODE_MAJORS.join("|")}`,
      `entrypointCount: ${entrypointCount}`,
      "regenerate: npm run runtime-contract:build",
    ].join(" | "),
    ...schema,
  };
  return JSON.stringify(enriched, null, 2) + "\n";
}

function main(): void {
  // 1. Load + schema validation (throws RuntimeContractBuildError on malformed YAML).
  const { contract, yamlSha256 } = loadContract();

  // 2. Pure compute of artifacts (no IO).
  const schemaJson = emitJsonSchema(yamlSha256, contract.entrypoints.length);

  // 3. IO writes (the ONLY place in the bin that touches the filesystem).
  mkdirSync(path.dirname(SCHEMA_OUT), { recursive: true });
  writeFileSync(SCHEMA_OUT, schemaJson, "utf8");

  console.log(
    `[runtime-contract:build] OK — emitted ${path.relative(REPO_ROOT, SCHEMA_OUT)} (${contract.entrypoints.length} entrypoints, source SHA-256: ${yamlSha256.slice(0, 12)}…)`,
  );
}

// Shell boundary: catch the typed error here and only here.
try {
  main();
} catch (e) {
  if (e instanceof RuntimeContractBuildError) {
    console.error(`[runtime-contract:build] ERROR — ${e.message}`);
  } else {
    console.error("[runtime-contract:build] UNEXPECTED ERROR —", e);
  }
  process.exit(1);
}
