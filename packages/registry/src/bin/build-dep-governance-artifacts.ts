#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { load as parseYaml } from "js-yaml";
import { z } from "zod";
import {
  DepGovernanceContractSchema,
  type DepGovernanceContract,
} from "../canonical/dep-governance-contract";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const YAML_PATH = path.join(
  REPO_ROOT,
  ".spec/00-canon/repository-registry/dep-governance.yaml",
);
const SCHEMA_OUT = path.join(
  REPO_ROOT,
  ".spec/00-canon/_schema/dep-governance.schema.json",
);

class DepGovernanceBuildError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "DepGovernanceBuildError";
  }
}

function fail(msg: string): never {
  throw new DepGovernanceBuildError(msg);
}

const SUPPORTED_NODE_MAJORS = ["20", "22", "24"];

{
  const currentMajor = process.versions.node.split(".")[0];
  if (!SUPPORTED_NODE_MAJORS.includes(currentMajor)) {
    console.error(
      `[dep-governance:build] ABORT — Node ${process.version} unsupported. ` +
        `Supported majors: v${SUPPORTED_NODE_MAJORS.join(", v")}.x.`,
    );
    process.exit(2);
  }
}

{
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const zodPkg = require("zod/package.json") as { version: string };
  if (!zodPkg.version.startsWith("4.")) {
    console.error(
      `[dep-governance:build] ABORT — zod v${zodPkg.version} unsupported (expected 4.x).`,
    );
    process.exit(2);
  }
}

function loadContract(): {
  contract: DepGovernanceContract;
  yamlSha256: string;
} {
  const raw = readFileSync(YAML_PATH, "utf8");
  const yamlSha256 = createHash("sha256").update(raw).digest("hex");
  const parsed = parseYaml(raw);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail(
      `dep-governance.yaml root must be a single object map, got ${
        parsed === null
          ? "null"
          : Array.isArray(parsed)
            ? "array"
            : typeof parsed
      }.`,
    );
  }
  const result = DepGovernanceContractSchema.safeParse(parsed);
  if (!result.success) {
    const lines = ["dep-governance contract does not match schema:"];
    for (const issue of result.error.issues) {
      const where = issue.path.length > 0 ? issue.path.join(".") : "<root>";
      lines.push(`  • ${where}: ${issue.message}`);
    }
    fail(lines.join("\n"));
  }
  return { contract: result.data, yamlSha256 };
}

function emitJsonSchema(yamlSha256: string, depCount: number): string {
  const schema = z.toJSONSchema(DepGovernanceContractSchema, {
    target: "draft-7",
    unrepresentable: "throw",
  });
  const enriched = {
    $comment: [
      "AUTO-GENERATED — DO NOT EDIT. Source: .spec/00-canon/repository-registry/dep-governance.yaml",
      `sourceSha256: ${yamlSha256}`,
      'generator: @repo/registry bin "build-dep-governance-artifacts"',
      `nodeMajor: ${SUPPORTED_NODE_MAJORS.join("|")}`,
      `dependencyCount: ${depCount}`,
      "regenerate: npm run dep-governance:build",
    ].join(" | "),
    ...schema,
  };
  return JSON.stringify(enriched, null, 2) + "\n";
}

function main(): void {
  const { contract, yamlSha256 } = loadContract();
  const schemaJson = emitJsonSchema(yamlSha256, contract.dependencies.length);
  mkdirSync(path.dirname(SCHEMA_OUT), { recursive: true });
  writeFileSync(SCHEMA_OUT, schemaJson, "utf8");
  console.log(
    `[dep-governance:build] OK — emitted ${path.relative(REPO_ROOT, SCHEMA_OUT)} (${contract.dependencies.length} deps, source SHA-256: ${yamlSha256.slice(0, 12)}…)`,
  );
}

try {
  main();
} catch (e) {
  if (e instanceof DepGovernanceBuildError) {
    console.error(`[dep-governance:build] ERROR — ${e.message}`);
  } else {
    console.error("[dep-governance:build] UNEXPECTED ERROR —", e);
  }
  process.exit(1);
}
