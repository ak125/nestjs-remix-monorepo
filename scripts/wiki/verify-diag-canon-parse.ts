/**
 * verify-diag-canon-parse.ts — drift fail-fast for the diag-canon nightly export.
 *
 * Parses the Python-exported flat-map `diag-canon.json` against the Zod canon
 * (single source of truth `backend/src/config/diag-canon.schema.ts`). If the
 * exported data does not match the Zod shape (e.g. a schema bump landed without
 * bumping the `version` literal), this exits non-zero BEFORE anything is
 * committed to the wiki repo.
 *
 * Usage :
 *   npx tsx scripts/wiki/verify-diag-canon-parse.ts [data.json]
 *   (default data path: /tmp/canon/diag-canon.json)
 *
 * Exit codes :
 *   0          — data parses against the Zod canon
 *   non-zero   — shape drift, or read/import failure
 *
 * Why a committed .ts file (not `tsx -e`) : the previous inline
 * `npx tsx -e "... await import('./backend/src/config/diag-canon.schema.ts') ..."`
 * regressed on 2026-05-20 — under the CI fresh-install layout the dynamic
 * import resolved `DiagCanon` to `undefined` (TypeError: reading 'safeParse').
 * The adjacent file-based tsx step (`print-diag-canon-jsonschema.ts`) importing
 * the same module never had this issue, so we mirror that invocation style.
 */
import { readFileSync } from 'node:fs';
import { DiagCanon } from '../../backend/src/config/diag-canon.schema';

const dataPath = process.argv[2] ?? '/tmp/canon/diag-canon.json';

const data: unknown = JSON.parse(readFileSync(dataPath, 'utf8'));
const result = DiagCanon.safeParse(data);

if (!result.success) {
  console.error('ZOD PARSE FAIL — shape drift detected:');
  console.error(JSON.stringify(result.error.format(), null, 2));
  process.exit(1);
}

console.log(`OK — ${dataPath} parses against Zod canon`);
