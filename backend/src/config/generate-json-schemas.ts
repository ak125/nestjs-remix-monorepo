/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Generate JSON Schema (draft-2020-12) from all PageContract Zod schemas.
 * Run: cd backend && npx ts-node src/config/generate-json-schemas.ts
 *
 * Replaces the former generate-r6-json-schema.ts (R6 only).
 */
import { z } from 'zod';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

import { PageContractR1Schema } from './page-contract-r1.schema';
import { R3PageContractSchema } from './page-contract-r3.schema';
import { PageContractR4Schema } from './page-contract-r4.schema';
import { R6PageContractSchema } from './page-contract-r6.schema';
// SITE_ORIGIN imported from its source-of-truth (site.constants), not via the
// app.config re-export — keeps this build script free of the @common/* alias
// chain so it runs under bare ts-node (npm run generate:schemas).
import { SITE_ORIGIN } from './site.constants';

// ── Schema registry ─────────────────────────────────────

const SCHEMAS: Record<string, { schema: any; title: string }> = {
  'page-contract-r1.json': {
    schema: PageContractR1Schema,
    title: 'PageContractR1',
  },
  'page-contract-r3.json': {
    schema: R3PageContractSchema,
    title: 'PageContractR3',
  },
  'page-contract-r4.json': {
    schema: PageContractR4Schema,
    title: 'PageContractR4',
  },
  'schemas/PageContractR6.json': {
    schema: R6PageContractSchema,
    title: 'PageContractR6',
  },
};

// ── Generate all ─────────────────────────────────────────

for (const [filename, { schema, title }] of Object.entries(SCHEMAS)) {
  // Native z.toJSONSchema (draft-2020-12). Reused-by-reference subschemas are
  // inlined by default (no $defs unless recursion / .meta({id})), matching the
  // former `$refStrategy: 'none'`. unrepresentable: 'throw' is the Commit-C gate.
  const raw = z.toJSONSchema(schema as any, {
    target: 'draft-2020-12',
    unrepresentable: 'throw',
  }) as Record<string, any>;
  // Native sets its own $schema; drop it so we control the exact URI + key order.
  delete raw.$schema;

  const jsonSchema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `${SITE_ORIGIN}/schemas/${title}.json`,
    title,
    ...raw,
  };

  const outPath = join(__dirname, filename);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(jsonSchema, null, 2));
  // eslint-disable-next-line no-console
  console.log(`[OK] ${title} → ${outPath}`);
}
