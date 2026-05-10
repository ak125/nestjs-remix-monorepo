#!/usr/bin/env node
// Audit `frontend/app/**/*.{ts,tsx}` for `import { ... } from 'lucide-react'`
// statements (single-line + multi-line), extract every named icon, and
// regenerate `frontend/app/lib/icons.ts` with the deduplicated set.
//
// Usage: node scripts/perf/refresh-icon-registry.mjs [--dry-run]
//
// Exit 0 always; prints diff summary on stderr.

import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const APP_DIR = join(REPO_ROOT, 'frontend', 'app');
const REGISTRY_PATH = join(APP_DIR, 'lib', 'icons.ts');
const REGISTRY_REL = relative(REPO_ROOT, REGISTRY_PATH);

const DRY_RUN = process.argv.includes('--dry-run');

// Recursively list .ts/.tsx files under appDir, skipping node_modules.
function listSourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

// Match all `import { ... } from 'lucide-react'` blocks (single + multi-line).
// Captures the body inside the braces.
const LUCIDE_IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*['"]lucide-react['"]/gs;

// Within a captured body, parse identifiers, ignoring `type X` and `X as Y`.
function parseImportSpecifiers(body) {
  return body
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      // Strip leading `type ` (TS type-only import)
      const noType = s.replace(/^type\s+/, '');
      // Handle `Foo as Bar` — keep `Foo` (the named export from lucide-react)
      const [original] = noType.split(/\s+as\s+/);
      return original.trim();
    })
    .filter((name) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name));
}

const files = listSourceFiles(APP_DIR).filter((p) => !p.endsWith(REGISTRY_PATH));
const allIcons = new Set();
const filesUsingLucide = new Set();

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  let match;
  while ((match = LUCIDE_IMPORT_RE.exec(src)) !== null) {
    filesUsingLucide.add(file);
    for (const id of parseImportSpecifiers(match[1])) {
      allIcons.add(id);
    }
  }
}

// Common type re-exports (always keep, regardless of usage)
const TYPE_REEXPORTS = ['LucideIcon', 'LucideProps', 'IconNode'];

// Separate icons (PascalCase value) from type identifiers
const valueIcons = [...allIcons]
  .filter((n) => !TYPE_REEXPORTS.includes(n))
  .sort();
const typeIcons = TYPE_REEXPORTS.filter((n) => allIcons.has(n));

const generated = `// AUTO-GENERATED — do not edit by hand.
// Source: \`scripts/perf/refresh-icon-registry.mjs\` audits all
// \`import { ... } from 'lucide-react'\` statements in \`frontend/app/**\`
// and re-exports only the icons actually used. Replaces direct lucide-react
// imports for tree-shake stability + DX (single point of control).
//
// To add an icon: import it from '~/lib/icons' in your component, then run
// \`node scripts/perf/refresh-icon-registry.mjs\`. The script will detect
// the new usage and append it to this file. The ast-grep rule
// \`frontend-no-direct-lucide-import\` blocks any \`from 'lucide-react'\`
// outside this file.

export {
${valueIcons.map((n) => `  ${n},`).join('\n')}
} from 'lucide-react';

export type {
${typeIcons.map((n) => `  ${n},`).join('\n')}
} from 'lucide-react';
`;

if (DRY_RUN) {
  console.error(`[dry-run] Would write ${REGISTRY_REL} with ${valueIcons.length} value exports + ${typeIcons.length} type exports.`);
  console.error(`[dry-run] ${filesUsingLucide.size} files currently import from 'lucide-react'.`);
  process.exit(0);
}

writeFileSync(REGISTRY_PATH, generated);
console.error(`Wrote ${REGISTRY_REL}`);
console.error(`  ${valueIcons.length} value exports`);
console.error(`  ${typeIcons.length} type exports`);
console.error(`  ${filesUsingLucide.size} consumer files (to be migrated by codemod)`);
