/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Generate JSON Schema (draft-2020-12) from all PageContract Zod schemas.
 * Run: cd backend && npx ts-node src/config/generate-json-schemas.ts
 *
 * Replaces the former generate-r6-json-schema.ts (R6 only).
 */
import { zodToJsonSchema } from 'zod-to-json-schema';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

import { PageContractR1Schema } from './page-contract-r1.schema';
import { R3PageContractSchema } from './page-contract-r3.schema';
import { PageContractR4Schema } from './page-contract-r4.schema';
import { R6PageContractSchema } from './page-contract-r6.schema';
import { SITE_ORIGIN } from './app.config';

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
  const raw = zodToJsonSchema(schema as any, {
    name: title,
    $refStrategy: 'none',
  });

  // Unwrap definitions wrapper: zodToJsonSchema with `name` wraps in $ref+definitions
  const jsonSchema =
    '$ref' in raw && 'definitions' in raw
      ? {
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          $id: `${SITE_ORIGIN}/schemas/${title}.json`,
          title,
          ...(raw as any).definitions?.[title],
        }
      : raw;

  const outPath = join(__dirname, filename);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(jsonSchema, null, 2));
  // eslint-disable-next-line no-console
  console.log(`[OK] ${title} → ${outPath}`);
}
