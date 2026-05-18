#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { load as parseYaml } from "js-yaml";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  RpcContractSchema,
  type RpcContract,
} from "../canonical/rpc-contract";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const YAML_PATH = path.join(
  REPO_ROOT,
  ".spec/00-canon/repository-registry/rpc.yaml",
);
const SCHEMA_OUT = path.join(
  REPO_ROOT,
  ".spec/00-canon/_schema/rpc.schema.json",
);

class RpcContractBuildError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "RpcContractBuildError";
  }
}

function fail(msg: string): never {
  throw new RpcContractBuildError(msg);
}

const SUPPORTED_NODE_MAJORS = ["20", "22"];

{
  const currentMajor = process.versions.node.split(".")[0];
  if (!SUPPORTED_NODE_MAJORS.includes(currentMajor)) {
    console.error(
      `[rpc-contract:build] ABORT — Node ${process.version} unsupported. ` +
        `Supported majors: v${SUPPORTED_NODE_MAJORS.join(", v")}.x.`,
    );
    process.exit(2);
  }
}

{
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const zodPkg = require("zod/package.json") as { version: string };
  if (!zodPkg.version.startsWith("3.")) {
    console.error(
      `[rpc-contract:build] ABORT — zod v${zodPkg.version} unsupported (expected 3.x).`,
    );
    process.exit(2);
  }
}

function loadContract(): { contract: RpcContract; yamlSha256: string } {
  const raw = readFileSync(YAML_PATH, "utf8");
  const yamlSha256 = createHash("sha256").update(raw).digest("hex");
  const parsed = parseYaml(raw);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail(
      `rpc.yaml root must be a single object map, got ${
        parsed === null ? "null" : Array.isArray(parsed) ? "array" : typeof parsed
      }.`,
    );
  }
  const result = RpcContractSchema.safeParse(parsed);
  if (!result.success) {
    const lines = ["rpc contract does not match schema:"];
    for (const issue of result.error.issues) {
      const where = issue.path.length > 0 ? issue.path.join(".") : "<root>";
      lines.push(`  • ${where}: ${issue.message}`);
    }
    fail(lines.join("\n"));
  }
  return { contract: result.data, yamlSha256 };
}

function emitJsonSchema(yamlSha256: string, rpcCount: number): string {
  const schema = zodToJsonSchema(RpcContractSchema, {
    name: "RpcContract",
    target: "jsonSchema7",
  });
  const enriched = {
    $comment: [
      "AUTO-GENERATED — DO NOT EDIT. Source: .spec/00-canon/repository-registry/rpc.yaml",
      `sourceSha256: ${yamlSha256}`,
      'generator: @repo/registry bin "build-rpc-contract-artifacts"',
      `nodeMajor: ${SUPPORTED_NODE_MAJORS.join("|")}`,
      `rpcCount: ${rpcCount}`,
      "regenerate: npm run rpc-contract:build",
    ].join(" | "),
    ...schema,
  };
  return JSON.stringify(enriched, null, 2) + "\n";
}

function main(): void {
  const { contract, yamlSha256 } = loadContract();
  const schemaJson = emitJsonSchema(yamlSha256, contract.rpcs.length);
  mkdirSync(path.dirname(SCHEMA_OUT), { recursive: true });
  writeFileSync(SCHEMA_OUT, schemaJson, "utf8");
  console.log(
    `[rpc-contract:build] OK — emitted ${path.relative(REPO_ROOT, SCHEMA_OUT)} (${contract.rpcs.length} rpcs, source SHA-256: ${yamlSha256.slice(0, 12)}…)`,
  );
}

try {
  main();
} catch (e) {
  if (e instanceof RpcContractBuildError) {
    console.error(`[rpc-contract:build] ERROR — ${e.message}`);
  } else {
    console.error("[rpc-contract:build] UNEXPECTED ERROR —", e);
  }
  process.exit(1);
}
