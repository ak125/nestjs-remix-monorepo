#!/usr/bin/env node
// Codemod: rewrite all `from 'lucide-react'` (and `"lucide-react"`) to
// `from '~/lib/icons'` in every `.ts` / `.tsx` under `frontend/app`,
// except the registry itself.
//
// Usage: node scripts/perf/migrate-lucide-imports.mjs [--dry-run]

import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const APP_DIR = join(REPO_ROOT, 'frontend', 'app');
const REGISTRY_PATH = join(APP_DIR, 'lib', 'icons.ts');
const DRY_RUN = process.argv.includes('--dry-run');

function listSourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listSourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

// Match `from 'lucide-react'` or `from "lucide-react"` only — preserves
// the import body (single-line or multi-line) intact.
const LUCIDE_FROM_RE = /from\s*(['"])lucide-react\1/g;

const files = listSourceFiles(APP_DIR).filter((p) => p !== REGISTRY_PATH);
let changed = 0;
let occurrences = 0;

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  if (!LUCIDE_FROM_RE.test(src)) continue;
  LUCIDE_FROM_RE.lastIndex = 0;
  const matches = src.match(LUCIDE_FROM_RE);
  const next = src.replace(LUCIDE_FROM_RE, "from '~/lib/icons'");
  if (next !== src) {
    occurrences += matches?.length ?? 0;
    changed += 1;
    if (!DRY_RUN) writeFileSync(file, next);
  }
}

console.error(`${DRY_RUN ? '[dry-run] Would migrate' : 'Migrated'} ${occurrences} import statement(s) across ${changed} file(s).`);
console.error(`Registry preserved: ${relative(REPO_ROOT, REGISTRY_PATH)}`);
