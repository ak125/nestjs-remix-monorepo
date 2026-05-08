import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { ServiceInventoryEntry } from './types';

const TARGET_SERVICE_MAPPING: Record<string, string> = {
  'seo-switches.service.ts': 'SeoSwitchSelector',
  'gamme-unified.service.ts': 'SeoSwitchSelector',
  'gamme-response-builder.service.ts': 'SeoTemplateRenderer',
  'seo-title-engine.service.ts': 'SeoTemplateRenderer',
  'dynamic-seo-v4-ultimate.service.ts': 'DynamicSeoV4UltimateService (orchestrateur)',
  'seo-v4-switch-engine.service.ts': 'SeoSwitchSelector',
  'seo-headers.service.ts': 'SeoCanonicalService + SeoIndexabilityPolicyService',
  'catalog-data-integrity.service.ts': 'SeoUnavailablePolicy + R2IndexabilityGate',
  'brand-rpc.service.ts': 'R7_BRAND_HUB consumer',
  'vehicle-rpc.service.ts': 'R8_VEHICLE consumer',
  'rm-builder.service.ts': 'R1_GAMME_VEHICLE_ROUTER consumer',
};

export function mapToTargetService(filename: string): string | null {
  return TARGET_SERVICE_MAPPING[path.basename(filename)] ?? null;
}

export interface InventoryOptions {
  modulesRoot: string;
  patterns: string[];
}

async function resolveModulesRoot(root: string): Promise<string> {
  // Try as-is, then try stripping a leading "backend/" if cwd is already inside backend/
  try {
    await readdir(root);
    return root;
  } catch {
    if (root.startsWith('backend/')) {
      const stripped = root.slice('backend/'.length);
      try {
        await readdir(stripped);
        return stripped;
      } catch {
        // fallthrough
      }
    }
    // Try resolving from monorepo root upwards
    const fromRoot = path.resolve(process.cwd(), '..', root);
    try {
      await readdir(fromRoot);
      return fromRoot;
    } catch {
      return root; // give up — caller will get empty
    }
  }
}

async function walkServiceFiles(root: string, patterns: string[]): Promise<string[]> {
  const out: string[] = [];
  const lowerPatterns = patterns.map((p) => p.toLowerCase());
  const resolvedRoot = await resolveModulesRoot(root);

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
        await walk(full);
      } else if (e.isFile() && e.name.endsWith('.service.ts')) {
        const lname = e.name.toLowerCase();
        if (lowerPatterns.some((p) => lname.includes(p))) {
          out.push(full);
        }
      }
    }
  }

  await walk(resolvedRoot);
  return out;
}

export async function runInventoryVolet(opts: InventoryOptions): Promise<ServiceInventoryEntry[]> {
  const files = await walkServiceFiles(opts.modulesRoot, opts.patterns);
  const entries: ServiceInventoryEntry[] = [];
  for (const fullPath of files) {
    const content = await readFile(fullPath, 'utf-8');
    entries.push({
      path: fullPath,
      public_methods: extractPublicMethods(content),
      tables_read: extractTablesRead(content),
      consumers: [],
      status: detectStatus(content),
      maps_to_target_service: mapToTargetService(fullPath),
      coverage_percent: 0,
    });
  }
  return entries;
}

function extractPublicMethods(src: string): string[] {
  const out: string[] = [];
  const re = /^\s*(?:async\s+)?(?:public\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(src)) !== null) {
    if (!['constructor', 'if', 'for', 'while', 'switch', 'catch', 'return'].includes(match[1])) {
      out.push(match[1]);
    }
  }
  return Array.from(new Set(out));
}

function extractTablesRead(src: string): string[] {
  const tables = new Set<string>();
  const reFrom = /\.from\(['"`]([^'"`]+)['"`]\)/g;
  const reRpc = /\.rpc\(['"`]([^'"`]+)['"`]/g;
  let m: RegExpExecArray | null;
  while ((m = reFrom.exec(src)) !== null) tables.add(m[1]);
  while ((m = reRpc.exec(src)) !== null) tables.add(`rpc:${m[1]}`);
  return Array.from(tables);
}

function detectStatus(src: string): ServiceInventoryEntry['status'] {
  if (/@deprecated/i.test(src)) return 'deprecated';
  if (/(?:DRAFT|TODO|WIP|DO\s*NOT\s*USE)/i.test(src.slice(0, 500))) return 'draft';
  return 'production';
}
