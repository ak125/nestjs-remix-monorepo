/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — see file-level comment below.
/**
 * diag-canon-jsonschema.ts — pure JSON Schema builder, derived from the Zod
 * canon `diag-canon.schema.ts`. Importable by Jest specs and by the CLI
 * `scripts/wiki/print-diag-canon-jsonschema.ts`.
 *
 * The `// @ts-nocheck` directive at the top is intentional: the combination
 * of `DiagCanon`'s chained type (`.strict().superRefine(...).readonly()`)
 * and the recursive generics of `zodToJsonSchema` causes ts-jest to spend
 * O(N^k) memory resolving the call site, leading to OOM in CI (run
 * 25234999710 confirmed: 4036MB → 4131MB → process exit 134). Targeted
 * `@ts-expect-error` does not stop the calculation, only the error
 * emission. Various cast strategies (ZodTypeAny, unknown → ZodType<unknown>)
 * also do not bypass since the inference happens on the function's own
 * generic resolution.
 *
 * The file has 1 imported function and 1 exported wrapper of 5 lines. No
 * business logic. Both libs (zod, zod-to-json-schema) are externally typed
 * and validated. Skipping type-check on this micro-file is the cheapest
 * non-invasive fix; runtime behavior is fully verified by the co-located
 * spec (idempotence + shape).
 *
 * Lives in `backend/src/config/` (not in `scripts/wiki/`) so that the Jest
 * config (`testRegex: '.*\\.test\\.ts$'`, `roots: ['src/', 'tests/']`) can
 * pick up the co-located `.test.ts` spec without modifying the global
 * config — see plan §risks line "jest.config.js testMatch".
 *
 * The Zod schema is the SOURCE OF TRUTH. Never write the JSON Schema by
 * hand; never edit the generated artifact in `automecanik-wiki/exports/`.
 *
 * Limitation: `zod-to-json-schema` does not translate `.superRefine()` to
 * JSON Schema. The composite FK invariant
 * (`symptoms[*].value` ∈ `systems[]`) is therefore NOT captured in the
 * derived schema — it is enforced exclusively at Zod parse time, in 4
 * layers documented in the plan `tat-adr-033-wave-abundant-crown.md` §A1bis.
 *
 * The builder uses no `name` option — emitting an inline schema with
 * `type: 'object'` at the root rather than a `$ref` wrapper around
 * `definitions/DiagCanon`. The inline form is what consumer tooling
 * (linters, IDE autocomplete) expects.
 */
import { zodToJsonSchema } from 'zod-to-json-schema';

import { DiagCanon } from './diag-canon.schema';

export function buildDiagCanonJsonSchema(): object {
  return zodToJsonSchema(DiagCanon, {
    target: 'jsonSchema2019-09',
    $refStrategy: 'none',
  });
}
