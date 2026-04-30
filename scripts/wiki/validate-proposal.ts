/**
 * validate-proposal.ts — CLI canonique TS pour valider un fichier
 * `automecanik-wiki/proposals/**\/*.md` ou `wiki/<entity_type>/**\/*.md` contre
 * le schema Zod canon (ADR-039, miroir du JSON Schema `_meta/schema/frontmatter.schema.json`).
 *
 * Usage :
 *   npx tsx scripts/wiki/validate-proposal.ts <file>...
 *   npx tsx scripts/wiki/validate-proposal.ts --all <wiki-repo-root>
 *
 * Exit codes :
 *   0 — all files valid
 *   1 — at least one file invalid (frontmatter Zod errors)
 *   2 — script error (file not found, YAML parse fail)
 *
 * Pattern : extension d'ADR-037 (`agent-frontmatter.schema.ts`) + ADR-038
 * (`marketing-agent-frontmatter.schema.ts`) au scope wiki.
 *
 * Co-existe avec :
 *   - `automecanik-wiki/_scripts/validate-frontmatter.py` (Python, JSON Schema canon)
 *   - `automecanik-wiki/_scripts/validate-frontmatter.mjs` (JS, JSON Schema canon)
 *   - `automecanik-wiki/_scripts/quality-gates.py` (Python, 9 quality gates)
 *
 * Différence de scope : ce TS validator est consommable par le backend NestJS
 * (Phase 3 ADR-033 différée — quand `WikiProposalSyncService` arrive). Les
 * 3 validators wiki repo restent autoritaires côté wiki repo CI.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import matter from 'gray-matter';

import {
  safeParseWikiProposalFrontmatter,
  type WikiProposalFrontmatter,
} from '../../backend/src/config/wiki-proposal-frontmatter.schema';

interface ValidationResult {
  file: string;
  ok: boolean;
  data?: WikiProposalFrontmatter;
  errors?: Array<{ path: string; message: string }>;
}

function listMarkdownFiles(rootDir: string): string[] {
  const out: string[] = [];
  const stack: string[] = [rootDir];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        // skip _meta, _scripts, exports, .git, node_modules, recycled-imports
        if (
          e.name.startsWith('.') ||
          e.name === 'node_modules' ||
          e.name === '_meta' ||
          e.name === '_scripts' ||
          e.name === 'exports'
        ) {
          continue;
        }
        stack.push(full);
      } else if (e.isFile() && e.name.endsWith('.md')) {
        // Skip canon meta files (`_index.md`, `_README.md`, `_changelog.md`, …) —
        // they are not wiki proposals.
        if (e.name.startsWith('_')) continue;
        out.push(full);
      }
    }
  }
  return out;
}

function validateFile(filePath: string): ValidationResult {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    return {
      file: filePath,
      ok: false,
      errors: [{ path: '<file>', message: `cannot read: ${(e as Error).message}` }],
    };
  }

  let frontmatterData: unknown;
  try {
    frontmatterData = matter(raw).data;
  } catch (e) {
    return {
      file: filePath,
      ok: false,
      errors: [
        {
          path: '<frontmatter>',
          message: `YAML parse error: ${(e as Error).message}`,
        },
      ],
    };
  }

  // Empty frontmatter (no `---`) → file is not a wiki proposal, skip with success.
  if (
    !frontmatterData ||
    typeof frontmatterData !== 'object' ||
    Object.keys(frontmatterData as object).length === 0
  ) {
    return {
      file: filePath,
      ok: false,
      errors: [
        {
          path: '<frontmatter>',
          message:
            'no frontmatter found — wiki proposals require a `---`-delimited YAML block (ADR-031)',
        },
      ],
    };
  }

  const result = safeParseWikiProposalFrontmatter(frontmatterData);
  if (result.success) {
    return { file: filePath, ok: true, data: result.data };
  }
  return {
    file: filePath,
    ok: false,
    errors: result.error.issues.map((i) => ({
      path: i.path.join('.') || '<root>',
      message: i.message,
    })),
  };
}

function printResult(r: ValidationResult): void {
  const rel = path.relative(process.cwd(), r.file);
  if (r.ok) {
    process.stdout.write(`✓ ${rel}\n`);
    return;
  }
  process.stdout.write(`✗ ${rel}\n`);
  for (const err of r.errors ?? []) {
    process.stdout.write(`  ${err.path}: ${err.message}\n`);
  }
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    process.stderr.write(
      'Usage: validate-proposal.ts <file>... | --all <wiki-repo-root>\n',
    );
    process.exit(2);
  }

  let files: string[];
  if (args[0] === '--all') {
    if (!args[1]) {
      process.stderr.write('--all requires a path argument (wiki repo root)\n');
      process.exit(2);
    }
    const root = path.resolve(args[1]);
    if (!fs.existsSync(root)) {
      process.stderr.write(`path not found: ${root}\n`);
      process.exit(2);
    }
    files = listMarkdownFiles(root);
  } else {
    files = args.map((f) => path.resolve(f));
  }

  if (files.length === 0) {
    process.stdout.write('No .md files found.\n');
    process.exit(0);
  }

  let nFail = 0;
  for (const file of files) {
    const r = validateFile(file);
    printResult(r);
    if (!r.ok) nFail++;
  }

  process.stdout.write(`\n${files.length - nFail}/${files.length} valid.\n`);
  process.exit(nFail === 0 ? 0 : 1);
}

main();
