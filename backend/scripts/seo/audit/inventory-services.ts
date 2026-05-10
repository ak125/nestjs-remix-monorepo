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
  // Essaie 3 chemins selon cwd ; throw explicite si aucun ne résout.
  // Un audit qui retourne "0 services" silencieusement est un audit qui ment — on préfère échouer fort.
  const candidates = [root];
  if (root.startsWith('backend/')) candidates.push(root.slice('backend/'.length));
  candidates.push(path.resolve(process.cwd(), '..', root));

  for (const c of candidates) {
    try {
      await readdir(c);
      return c;
    } catch {
      // try next
    }
  }
  throw new Error(
    `[volet 1] modules root introuvable. Essayé : ${candidates.join(', ')}. ` +
      `cwd=${process.cwd()}. Vérifier --modules-root ou démarrer le script depuis backend/ ou la racine du monorepo.`,
  );
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

/**
 * Méthodes publiques d'un service NestJS/TS.
 *
 * Limitation assumée : extraction par regex (pas AST). Évite les faux positifs sur
 * appels (`this.x.y(`, `console.log(`, `await fetch(`) en exigeant :
 * - soit le mot-clé `public ` explicite,
 * - soit une indentation à exactement 2 espaces (méthode de classe NestJS) ET
 *   une signature complète terminée par `:` (return type) ou `{` (corps).
 *
 * Pour une analyse exhaustive, basculer vers ts-morph en PR-2.
 */
function extractPublicMethods(src: string): string[] {
  const out: string[] = [];
  const reExplicit = /^\s*public\s+(?:async\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm;
  const reImplicit = /^  (?:async\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*(?::|{)/gm;
  const reserved = new Set([
    'constructor', 'if', 'for', 'while', 'switch', 'catch', 'return',
    'private', 'protected', 'static', 'readonly', 'get', 'set', 'async', 'await',
  ]);
  for (const re of [reExplicit, reImplicit]) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(src)) !== null) {
      if (!reserved.has(match[1])) out.push(match[1]);
    }
  }
  return Array.from(new Set(out));
}

/**
 * Tables Supabase lues / RPCs invoquées. Restreint aux clients Supabase pour éviter
 * `Array.from`, `Buffer.from`, RxJS `from` qui matcheraient un `.from(` générique.
 */
function extractTablesRead(src: string): string[] {
  const tables = new Set<string>();
  const reFrom = /(?:supabase|client|sb)\.from\(['"`]([^'"`]+)['"`]\)/g;
  const reRpc = /(?:supabase|client|sb)\.rpc\(['"`]([^'"`]+)['"`]/g;
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
