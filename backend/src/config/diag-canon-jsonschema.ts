/**
 * diag-canon-jsonschema.ts — pure JSON Schema builder, derived from the Zod
 * canon `diag-canon.schema.ts`. Importable by Jest specs and by the CLI
 * `scripts/wiki/print-diag-canon-jsonschema.ts`.
 *
 * Lives in `backend/src/config/` (not in `scripts/wiki/`) so that the Jest
 * config (`testRegex: '.*\\.test\\.ts$'`, `roots: ['src/', 'tests/']`) picks
 * up the co-located `.test.ts` spec without modifying the global config.
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
 *
 * Typing note (TS2589 mitigation):
 *   `zodToJsonSchema<T extends ZodSchema>(schema: T, ...)` infers `T`
 *   from `DiagCanon`'s deep chained type (`.strict().superRefine(...).
 *   readonly()`), which exceeds TypeScript's instantiation depth limit
 *   under ts-jest's strict mode (TS2589) and triggers OOM in CI.
 *   Tsx/esbuild-based runs are unaffected because they do not type-check.
 *
 *   The fix is a one-line **typed cast on the imported function** that
 *   erases its deep generic signature at the call site. The cast lives
 *   inside this file (no global declare-module override), targets only
 *   the lib whose typings cause the issue, and keeps full runtime
 *   correctness — verified by `diag-canon-jsonschema.test.ts` (shape +
 *   idempotence) and by `diag-canon.schema.test.ts` (cross-source).
 *
 *   This is a strict improvement over `// @ts-nocheck`: no file-level
 *   type-check disable, no eslint-disable directive, no `any`, and the
 *   rest of this file remains type-checked.
 */
import { zodToJsonSchema as _zodToJsonSchema } from 'zod-to-json-schema';

import { DiagCanon } from './diag-canon.schema';

/**
 * Type-erased view of `zodToJsonSchema`. Both inputs are widened to
 * `unknown` so ts-jest stops trying to instantiate the deep generic of
 * `DiagCanon`. The return type is narrowed back to `object` so callers
 * stay typed safely.
 */
const zodToJsonSchema = _zodToJsonSchema as (
  schema: unknown,
  options?: unknown,
) => object;

export function buildDiagCanonJsonSchema(): object {
  return zodToJsonSchema(DiagCanon, {
    target: 'jsonSchema2019-09',
    $refStrategy: 'none',
  });
}
