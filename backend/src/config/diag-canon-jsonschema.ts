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
 * Limitation: `z.toJSONSchema()` does not translate `.superRefine()` to
 * JSON Schema. The composite FK invariant
 * (`symptoms[*].value` ∈ `systems[]`) is therefore NOT captured in the
 * derived schema — it is enforced exclusively at Zod parse time, in 4
 * layers documented in the plan `tat-adr-033-wave-abundant-crown.md` §A1bis.
 *
 * The builder uses no `name`/registry — emitting an inline schema with
 * `type: 'object'` at the root rather than a `$ref` wrapper around
 * `definitions/DiagCanon`. The inline form is what consumer tooling
 * (linters, IDE autocomplete) expects.
 *
 * Dialect: native `z.toJSONSchema` supports draft-7 / draft-2020-12 /
 * draft-4 / openapi-3.0. The former `jsonSchema2019-09` target (legacy
 * `zod-to-json-schema`) is aligned forward to `draft-2020-12`.
 *
 * `unrepresentable: 'throw'` is the conversion gate: any node Zod cannot
 * faithfully represent aborts the build instead of emitting a silent `{}`
 * (no-silent-fallback). The native signature is not deeply generic, so the
 * former TS2589 type-erasing cast is no longer needed.
 */
import { z } from 'zod';

import { DiagCanon } from './diag-canon.schema';

export function buildDiagCanonJsonSchema(): object {
  return z.toJSONSchema(DiagCanon, {
    target: 'draft-2020-12',
    unrepresentable: 'throw',
  });
}
