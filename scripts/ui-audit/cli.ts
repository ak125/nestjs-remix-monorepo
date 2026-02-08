#!/usr/bin/env npx ts-node
/**
 * UI Audit CLI
 *
 * Usage:
 *   npx ts-node scripts/ui-audit/cli.ts frontend/app/routes/cart.tsx
 *   npx ts-node scripts/ui-audit/cli.ts --ci frontend/app/routes/cart.tsx
 *   npx ts-node scripts/ui-audit/cli.ts --out .audit/ "frontend/app/routes/*.tsx"
 */

import * as path from 'path';
import * as fs from 'fs';
import { glob } from 'glob';
import { auditPage, auditPages, printAuditSummary, type AuditOptions } from './index';
import { generateTreeOutput, generateComparisonTree } from './generators/tree-output';

interface CliArgs {
  files: string[];
  outDir?: string;
  format: 'all' | 'json' | 'md';
  verbose: boolean;
  ci: boolean;
  help: boolean;
  tree: boolean;
  compare?: string[];
}

function parseArgs(args: string[]): CliArgs {
  const result: CliArgs = {
    files: [],
    format: 'all',
    verbose: false,
    ci: false,
    help: false,
    tree: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--verbose' || arg === '-v') {
      result.verbose = true;
    } else if (arg === '--ci') {
      result.ci = true;
    } else if (arg === '--tree' || arg === '-t') {
      result.tree = true;
    } else if (arg === '--compare') {
      result.compare = [args[++i], args[++i]];
    } else if (arg === '--out' || arg === '-o') {
      result.outDir = args[++i];
    } else if (arg === '--format' || arg === '-f') {
      result.format = args[++i] as 'all' | 'json' | 'md';
    } else if (!arg.startsWith('-')) {
      result.files.push(arg);
    }
  }

  return result;
}

function printHelp(): void {
  console.log(`
UI Audit CLI - Audit TSX files for UI quality

USAGE:
  npx tsx scripts/ui-audit/cli.ts [options] <files...>

ARGUMENTS:
  <files...>    TSX files to audit (supports glob patterns)

OPTIONS:
  -o, --out <dir>     Output directory for audit files (default: scripts/ui-audit/audits/)
  -f, --format <fmt>  Output format: all, json, md (default: all)
  -t, --tree          Display visual tree output
  --compare <a> <b>   Compare two score.json files (before/after)
  -v, --verbose       Verbose output
  --ci                CI mode - exit with code 1 if hard violations found
  -h, --help          Show this help message

EXAMPLES:
  # Audit a single file
  npx tsx scripts/ui-audit/cli.ts frontend/app/routes/cart.tsx

  # Visual tree output
  npx tsx scripts/ui-audit/cli.ts --tree frontend/app/routes/cart.tsx

  # Compare before/after
  npx tsx scripts/ui-audit/cli.ts --compare before.score.json after.score.json

  # CI mode (fail on hard violations)
  npx tsx scripts/ui-audit/cli.ts --ci frontend/app/routes/cart.tsx

OUTPUT FILES:
  For each input file, generates:
  - <name>.score.json   - Scores and violations in JSON
  - <name>.audit.md     - Human-readable audit report
`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // Handle --compare mode
  if (args.compare && args.compare.length === 2) {
    const [beforeFile, afterFile] = args.compare;
    try {
      const before = JSON.parse(fs.readFileSync(beforeFile, 'utf-8'));
      const after = JSON.parse(fs.readFileSync(afterFile, 'utf-8'));
      console.log('');
      console.log(generateComparisonTree(before, after, path.basename(afterFile)));
      console.log('');
      process.exit(0);
    } catch (error) {
      console.error('Error comparing files:', error);
      process.exit(1);
    }
  }

  if (args.files.length === 0) {
    console.error('Error: No files specified');
    printHelp();
    process.exit(1);
  }

  // Expand glob patterns
  let files: string[] = [];
  for (const pattern of args.files) {
    if (pattern.includes('*')) {
      const matches = await glob(pattern);
      files.push(...matches);
    } else {
      files.push(pattern);
    }
  }

  // Filter to only .tsx files
  files = files.filter((f) => f.endsWith('.tsx'));

  if (files.length === 0) {
    console.error('Error: No TSX files found');
    process.exit(1);
  }

  console.log(`\n🔍 UI Audit - Scanning ${files.length} file(s)...\n`);

  const options: AuditOptions = {
    outDir: args.outDir,
    format: args.format,
    verbose: args.verbose,
    ci: args.ci,
  };

  let hasAnyHardViolations = false;

  for (const file of files) {
    try {
      const result = await auditPage(file, options);

      if (args.tree) {
        // Visual tree output
        console.log('');
        console.log(generateTreeOutput(
          result.scores,
          result.evaluation.softViolations,
          result.file.fileName
        ));
        console.log('');
      } else {
        // Default summary output
        printAuditSummary(result);
      }

      if (result.hasHardViolations) {
        hasAnyHardViolations = true;
      }

      console.log(`📄 Output: ${result.outputFiles.join(', ')}`);
      console.log('');
    } catch (error) {
      console.error(`❌ Error auditing ${file}:`, error);
    }
  }

  // Summary
  console.log('═'.repeat(60));
  console.log(`Audited ${files.length} file(s)`);

  if (hasAnyHardViolations) {
    console.log('⚠️  Some files have hard rule violations');
    if (args.ci) {
      console.log('❌ CI mode: Exiting with error code 1');
      process.exit(1);
    }
  } else {
    console.log('✅ No hard rule violations found');
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
