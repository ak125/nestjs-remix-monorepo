/**
 * print-diag-canon-jsonschema.ts — CLI : prints the derived JSON Schema to stdout.
 *
 * Usage :
 *   npx tsx scripts/wiki/print-diag-canon-jsonschema.ts > /tmp/canon/diag-canon.schema.json
 *
 * Exit codes :
 *   0          — schema printed
 *   non-zero   — runtime error (TS / import failure)
 *
 * This CLI imports the builder from `backend/src/config/diag-canon-jsonschema.ts`.
 * The builder lives in backend so that Jest (testRegex `.*\\.test\\.ts$`,
 * roots `src/` + `tests/`) can pick up its co-located `.test.ts` spec.
 *
 * Refs : plan `tat-adr-033-wave-abundant-crown.md` §B2 (revised: builder co-located in backend).
 */
import { buildDiagCanonJsonSchema } from '../../backend/src/config/diag-canon-jsonschema';

process.stdout.write(JSON.stringify(buildDiagCanonJsonSchema(), null, 2) + '\n');
