/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Generate JSON Schema (draft-2020-12 compatible) from the R6PageContract Zod schema.
 * Run: cd backend && npm run generate:r6-schema
 */
import { zodToJsonSchema } from 'zod-to-json-schema';
import { R6PageContractSchema } from './page-contract-r6.schema';
import { writeFileSync } from 'fs';
import { join } from 'path';

// Cast needed: R6PageContractSchema uses superRefine which causes
// TS2589 "excessively deep" with zodToJsonSchema generics.
// Runtime conversion works correctly regardless.
const raw = zodToJsonSchema(R6PageContractSchema as any, {
  name: 'PageContractR6',
  $refStrategy: 'none',
});

// Unwrap definitions wrapper: zodToJsonSchema with `name` wraps in $ref+definitions
const jsonSchema =
  '$ref' in raw && 'definitions' in raw
    ? {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        $id: 'https://automecanik.com/schemas/PageContractR6.json',
        title: 'PageContractR6',
        ...(raw as any).definitions?.PageContractR6,
      }
    : raw;

const outPath = join(__dirname, 'schemas', 'PageContractR6.json');
writeFileSync(outPath, JSON.stringify(jsonSchema, null, 2));
// eslint-disable-next-line no-console
console.log(`JSON Schema written to ${outPath}`);
