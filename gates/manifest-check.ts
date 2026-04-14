/**
 * gates/manifest-check.ts
 *
 * Module Manifest Gate — AutoMecanik
 * Version: 1.0.0 | Mode: ADVISORY (report-only)
 * Source: AUT-272 / AUT-271 | ADR: docs/adr/0001-module-manifest-schema.md
 *
 * This gate:
 *   1. Discovers changed files in the PR diff
 *   2. Resolves which module each file belongs to
 *   3. Verifies a manifest exists and is valid for that module
 *   4. In ADVISORY mode: reports violations but exits 0
 *   5. In BLOCKING mode (status=certified modules): exits non-zero
 *
 * Phase 0-1 (current): ADVISORY globally
 * Phase 2+: BLOCKING for modules with status=certified
 *
 * Usage:
 *   npx ts-node gates/manifest-check.ts [--changed-files <file>] [--mode advisory|blocking]
 *   CHANGED_FILES=file1,file2 npx ts-node gates/manifest-check.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

// ── Types ────────────────────────────────────────────────────────────────────

interface ManifestHttpRoute {
  method: string;
  path: string;
  auth?: string;
  notes?: string;
}

interface ManifestPublicExport {
  symbol: string;
  kind: string;
  notes?: string;
}

interface ManifestChangeSurface {
  risk_level?: string;
  review_checklist: string[];
  requires_data_ops_approval?: boolean;
  requires_seo_approval?: boolean;
  gate_battery?: string[];
}

interface ModuleManifest {
  module: string;
  title?: string;
  description?: string;
  domain?: string;
  status: 'stub' | 'draft' | 'certified' | 'retired';
  certification_date?: string;
  owned_tables: string[];
  read_tables?: string[];
  owned_rpcs?: string[];
  http_routes: ManifestHttpRoute[];
  public_exports?: ManifestPublicExport[];
  depends_on: string[];
  invariants_ref?: string[];
  seo_contracts?: Record<string, unknown>;
  change_surface: ManifestChangeSurface;
}

interface GateResult {
  file: string;
  module: string | null;
  manifestFound: boolean;
  manifestValid: boolean;
  manifestStatus: string;
  violations: string[];
  warnings: string[];
}

// ── Config ───────────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(__dirname, '..');
const SPEC_MODULES_DIR = path.join(REPO_ROOT, '.spec', 'modules');
const BACKEND_MODULES_DIR = path.join(REPO_ROOT, 'backend', 'src', 'modules');

// File → module mapping rules (ordered, first match wins)
const MODULE_PATH_PATTERNS: Array<{pattern: RegExp; module: string | null}> = [
  // Backend modules
  { pattern: /^backend\/src\/modules\/([^/]+)\//, module: null }, // capture group 1
  // Frontend route clusters (future)
  { pattern: /^frontend\/app\/routes\/vehicles/, module: 'vehicles' },
  { pattern: /^frontend\/app\/routes\/panier/, module: 'cart' },
  { pattern: /^frontend\/app\/routes\/pieces/, module: 'catalog' },
  { pattern: /^frontend\/app\/routes\/admin/, module: 'admin' },
  // Spec files are always allowed
  { pattern: /^\.spec\//, module: '__spec__' },
  // Gate files themselves
  { pattern: /^gates\//, module: '__gates__' },
  // Workflows
  { pattern: /^\.github\/workflows\//, module: '__ci__' },
  // Root config files — not module-specific
  { pattern: /^(package\.json|turbo\.json|\.env|docker-compose|CLAUDE\.md|AGENTS\.md)/, module: '__root__' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function resolveModuleFromPath(filePath: string): string | null {
  // Normalize to repo-relative path
  const rel = filePath.replace(/^\//, '');

  for (const rule of MODULE_PATH_PATTERNS) {
    const match = rel.match(rule.pattern);
    if (match) {
      if (rule.module === null) {
        // Use capture group 1 (backend module name)
        return match[1] ?? null;
      }
      return rule.module;
    }
  }
  return null;
}

function loadManifest(moduleName: string): ModuleManifest | null {
  const manifestPath = path.join(SPEC_MODULES_DIR, moduleName, 'manifest.yaml');
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  try {
    const content = fs.readFileSync(manifestPath, 'utf-8');
    return yaml.load(content) as ModuleManifest;
  } catch (e) {
    return null;
  }
}

function validateManifest(manifest: ModuleManifest, moduleName: string): string[] {
  const violations: string[] = [];

  // Required fields
  if (!manifest.module) {
    violations.push('manifest.module is required');
  } else if (manifest.module !== moduleName) {
    violations.push(
      `manifest.module="${manifest.module}" does not match directory name "${moduleName}"`,
    );
  }

  if (!manifest.status) {
    violations.push('manifest.status is required');
  } else if (!['stub', 'draft', 'certified', 'retired'].includes(manifest.status)) {
    violations.push(`manifest.status="${manifest.status}" is not a valid status`);
  }

  if (!Array.isArray(manifest.owned_tables)) {
    violations.push('manifest.owned_tables must be an array');
  }

  if (!Array.isArray(manifest.http_routes)) {
    violations.push('manifest.http_routes must be an array');
  }

  if (!Array.isArray(manifest.depends_on)) {
    violations.push('manifest.depends_on must be an array');
  }

  if (!manifest.change_surface || !Array.isArray(manifest.change_surface.review_checklist)) {
    violations.push('manifest.change_surface.review_checklist is required and must be an array');
  }

  return violations;
}

function checkTableOwnership(
  manifest: ModuleManifest,
  moduleName: string,
  allManifests: Map<string, ModuleManifest>,
): string[] {
  const violations: string[] = [];

  // Check that each owned_table is not also claimed by another module
  for (const table of manifest.owned_tables || []) {
    for (const [otherModule, otherManifest] of allManifests) {
      if (otherModule === moduleName) continue;
      if ((otherManifest.owned_tables || []).includes(table)) {
        violations.push(
          `Table "${table}" is claimed by both "${moduleName}" and "${otherModule}" — a table must have exactly one owner`,
        );
      }
    }
  }

  return violations;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const modeArg = args.find((a) => a === '--mode');
  const modeIdx = args.indexOf('--mode');
  const forceMode = modeIdx !== -1 ? args[modeIdx + 1] : null;

  // Collect changed files from env or --changed-files arg
  let changedFiles: string[] = [];
  const changedFilesEnv = process.env.CHANGED_FILES;
  const changedFilesArgIdx = args.indexOf('--changed-files');

  if (changedFilesArgIdx !== -1 && args[changedFilesArgIdx + 1]) {
    const filePath = args[changedFilesArgIdx + 1];
    if (fs.existsSync(filePath)) {
      changedFiles = fs
        .readFileSync(filePath, 'utf-8')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
    }
  } else if (changedFilesEnv) {
    changedFiles = changedFilesEnv.split(',').map((f) => f.trim()).filter(Boolean);
  } else {
    // Fall back to git diff against main
    const { execSync } = require('child_process');
    try {
      const out = execSync('git diff --name-only origin/main...HEAD 2>/dev/null || git diff --name-only HEAD~1 HEAD', {
        encoding: 'utf-8',
        cwd: REPO_ROOT,
      });
      changedFiles = out.split('\n').map((l: string) => l.trim()).filter(Boolean);
    } catch {
      changedFiles = [];
    }
  }

  if (changedFiles.length === 0) {
    console.log('manifest-check: no changed files detected, skipping.');
    process.exit(0);
  }

  // Load all manifests for cross-ownership checks
  const allManifests = new Map<string, ModuleManifest>();
  if (fs.existsSync(SPEC_MODULES_DIR)) {
    for (const entry of fs.readdirSync(SPEC_MODULES_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const m = loadManifest(entry.name);
      if (m) allManifests.set(entry.name, m);
    }
  }

  const results: GateResult[] = [];
  const processedModules = new Set<string>();

  for (const file of changedFiles) {
    const moduleName = resolveModuleFromPath(file);

    // Skip spec/gate/root files — they don't need module manifests
    if (
      moduleName === '__spec__' ||
      moduleName === '__gates__' ||
      moduleName === '__ci__' ||
      moduleName === '__root__'
    ) {
      continue;
    }

    if (!moduleName) {
      results.push({
        file,
        module: null,
        manifestFound: false,
        manifestValid: false,
        manifestStatus: 'unknown',
        violations: [`File "${file}" could not be mapped to any module`],
        warnings: [],
      });
      continue;
    }

    // Only process each module once (multiple files in same module)
    if (processedModules.has(moduleName)) continue;
    processedModules.add(moduleName);

    const manifest = loadManifest(moduleName);

    if (!manifest) {
      results.push({
        file,
        module: moduleName,
        manifestFound: false,
        manifestValid: false,
        manifestStatus: 'missing',
        violations: [`No manifest found at .spec/modules/${moduleName}/manifest.yaml`],
        warnings: [],
      });
      continue;
    }

    const schemaViolations = validateManifest(manifest, moduleName);
    const ownershipViolations = checkTableOwnership(manifest, moduleName, allManifests);
    const allViolations = [...schemaViolations, ...ownershipViolations];

    const warnings: string[] = [];
    if (manifest.status === 'stub') {
      warnings.push(`Module "${moduleName}" has status=stub — manifest not yet reviewed`);
    }
    if (manifest.status === 'draft') {
      warnings.push(`Module "${moduleName}" has status=draft — not yet gate-enforced`);
    }

    results.push({
      file,
      module: moduleName,
      manifestFound: true,
      manifestValid: allViolations.length === 0,
      manifestStatus: manifest.status,
      violations: allViolations,
      warnings,
    });
  }

  // ── Report ──────────────────────────────────────────────────────────────────

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║         manifest-check gate — AutoMecanik                ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\nMode: ADVISORY (Phase 0-1 — report only)\n`);
  console.log(`Changed files analyzed: ${changedFiles.length}`);
  console.log(`Modules touched: ${processedModules.size}\n`);

  let blockingViolations = 0;
  let advisoryViolations = 0;

  for (const result of results) {
    const icon = result.manifestFound && result.manifestValid ? '✓' : '✗';
    const statusLabel = result.manifestStatus;

    console.log(`${icon} [${statusLabel.toUpperCase()}] ${result.module ?? result.file}`);

    for (const v of result.violations) {
      console.log(`    VIOLATION: ${v}`);
      // In BLOCKING mode, only certified modules fail the gate
      if (result.manifestStatus === 'certified' || forceMode === 'blocking') {
        blockingViolations++;
      } else {
        advisoryViolations++;
      }
    }

    for (const w of result.warnings) {
      console.log(`    WARNING:   ${w}`);
    }
  }

  console.log('\n──────────────────────────────────────────────────────────');
  console.log(`Blocking violations: ${blockingViolations}`);
  console.log(`Advisory violations: ${advisoryViolations} (report only — not failing gate)`);

  if (blockingViolations > 0) {
    console.log('\n✗ GATE FAILED — certified module(s) have manifest violations.');
    console.log('  Fix: update the manifest at .spec/modules/<module>/manifest.yaml');
    process.exit(1);
  } else {
    console.log('\n✓ GATE PASSED (advisory mode — no certified modules blocked)');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('manifest-check: unexpected error', err);
  process.exit(1);
});
