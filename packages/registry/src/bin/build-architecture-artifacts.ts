#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { inspect } from 'node:util';
import { createHash } from 'node:crypto';
import { load as parseYaml } from 'js-yaml';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  ArchitectureContractSchema,
  type ArchitectureContract,
} from '../canonical/architecture-contract';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const YAML_PATH = path.join(
  REPO_ROOT,
  '.spec/00-canon/repository-registry/architecture.yaml',
);
const SCHEMA_OUT = path.join(
  REPO_ROOT,
  '.spec/00-canon/_schema/architecture.schema.json',
);
const DEPCRUISE_OUT = path.join(REPO_ROOT, '.dependency-cruiser.generated.cjs');

// Modern CLI pattern: pure logic throws, shell boundary catches in the main() try/catch.
class ArchitectureBuildError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'ArchitectureBuildError';
  }
}

function fail(msg: string): never {
  throw new ArchitectureBuildError(msg);
}

// Compatibility marker — the depcruise rule shape we emit targets this major.
// Bump when depcruise migrates to a new rule schema (same PR adapts emitDepcruise).
const DEPCRUISE_SCHEMA_VERSION = '16.x';

// Generator output format version. Bump when header()/emitDepcruise() change in
// a way that breaks downstream tooling parsing the artifact.
const GENERATED_FORMAT_VERSION = 1;

// Module format of the emitted depcruise artifact. CJS today; PR-5 may emit dual.
const GENERATED_MODULE_FORMAT: 'cjs' | 'mjs' = 'cjs';

// Supported Node majors. util.inspect()'s output is NOT stable across untested majors.
// Extend after re-running determinism tests.
const SUPPORTED_NODE_MAJORS = ['22'];

{
  const currentMajor = process.versions.node.split('.')[0];
  if (!SUPPORTED_NODE_MAJORS.includes(currentMajor)) {
    console.error(
      `[architecture:build] ABORT — Node ${process.version} unsupported. ` +
        `Supported majors: v${SUPPORTED_NODE_MAJORS.join(', v')}.x. ` +
        `util.inspect() output is not guaranteed stable on untested Node majors. ` +
        `Use nvm/volta to switch, or extend SUPPORTED_NODE_MAJORS after re-running determinism tests.`,
    );
    process.exit(2);
  }
}

// Runtime version guard for zod compatibility with zod-to-json-schema.
{
  const zodPkg = require('zod/package.json') as { version: string };
  if (!zodPkg.version.startsWith('3.')) {
    console.error(
      `[architecture:build] ABORT — zod v${zodPkg.version} unsupported (expected 3.x). ` +
        'See packages/registry/package.json runtime deps.',
    );
    process.exit(2);
  }
}

function header(yamlSha256: string): string {
  return `/**
 * AUTO-GENERATED — DO NOT EDIT.
 *
 * Source:                      .spec/00-canon/repository-registry/architecture.yaml
 * Source SHA-256:              ${yamlSha256}
 * Generated format version:    ${GENERATED_FORMAT_VERSION}
 * Generated module format:     ${GENERATED_MODULE_FORMAT}
 * Generated with Node:         v${SUPPORTED_NODE_MAJORS.join('|v')}.x
 * Targets depcruise:           ${DEPCRUISE_SCHEMA_VERSION}
 * Ownership:                   @repo/registry (PR review required for any change to the generator)
 * Generator:                   @repo/registry bin "build-architecture-artifacts"
 * Re-generate:                 npm run architecture:build
 *
 * Edits to this file will fail the CI freshness gate in audit.yml.
 * If a reviewer asks to "just patch the generated file", REFUSE and edit the YAML instead.
 */
`;
}

function loadContract(): { contract: ArchitectureContract; yamlSha256: string; rawYaml: string } {
  const raw = readFileSync(YAML_PATH, 'utf8');
  const yamlSha256 = createHash('sha256').update(raw).digest('hex');
  const parsed = parseYaml(raw);
  // Hardening: js-yaml will happily return a string, an array, or null for malformed
  // / multi-document / scalar-rooted YAMLs.
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail(
      `architecture.yaml root must be a single object map, got ${
        parsed === null ? 'null' : Array.isArray(parsed) ? 'array' : typeof parsed
      }. Check for accidental document separators ("---") or stray top-level lists.`,
    );
  }
  const result = ArchitectureContractSchema.safeParse(parsed);
  if (!result.success) {
    const lines = ['contract does not match schema:'];
    for (const issue of result.error.issues) {
      const where = issue.path.length > 0 ? issue.path.join('.') : '<root>';
      lines.push(`  • ${where}: ${issue.message}`);
    }
    fail(lines.join('\n'));
  }
  return { contract: result.data, yamlSha256, rawYaml: raw };
}

// Serialise depcruise rules with util.inspect — handles apostrophes, escaped chars,
// and arbitrary nesting safely. ASCII-pure sort + sorted-keys = total determinism.
function emitDepcruise(contract: ArchitectureContract, yamlSha256: string): string {
  const rules = contract.boundaries
    .flatMap((b) =>
      b.emitDepcruise.map((r) => ({
        name: r.name,
        severity: r.severity,
        comment: r.comment,
        from: { path: r.fromPath },
        to: { path: r.toPath },
      })),
    )
    // ASCII-pure deterministic sort: zero dependency on ICU / glibc / OS locale data.
    // Rule names are kebab-case ASCII (regex-enforced by Zod), so natural < / > produces
    // a stable total order across every Node/ICU/OS combination.
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const body = inspect(rules, {
    depth: null,
    compact: false,
    breakLength: 80,
    maxArrayLength: Infinity,
    maxStringLength: Infinity,
    sorted: true,
  });
  return `${header(yamlSha256)}\nmodule.exports = ${body};\n`;
}

function emitJsonSchema(): string {
  const schema = zodToJsonSchema(ArchitectureContractSchema, {
    name: 'ArchitectureContract',
    target: 'jsonSchema7',
  });
  return JSON.stringify(schema, null, 2) + '\n';
}

function main(): void {
  // 1. Load + schema validation (throws ArchitectureBuildError on malformed YAML).
  const { contract, yamlSha256 } = loadContract();

  // 2. Pure compute of artifacts (no IO).
  const depcruiseCjs = emitDepcruise(contract, yamlSha256);
  const schemaJson = emitJsonSchema();

  // 3. IO writes (the ONLY place in the bin that touches the filesystem).
  mkdirSync(path.dirname(SCHEMA_OUT), { recursive: true });
  writeFileSync(SCHEMA_OUT, schemaJson, 'utf8');
  writeFileSync(DEPCRUISE_OUT, depcruiseCjs, 'utf8');

  console.log(
    `[architecture:build] OK — emitted ${path.relative(REPO_ROOT, SCHEMA_OUT)} + ${path.relative(REPO_ROOT, DEPCRUISE_OUT)} (source SHA-256: ${yamlSha256.slice(0, 12)}…)`,
  );
}

// Shell boundary: catch the typed error here and only here.
try {
  main();
} catch (e) {
  if (e instanceof ArchitectureBuildError) {
    console.error(`[architecture:build] ERROR — ${e.message}`);
  } else {
    console.error('[architecture:build] UNEXPECTED ERROR —', e);
  }
  process.exit(1);
}
