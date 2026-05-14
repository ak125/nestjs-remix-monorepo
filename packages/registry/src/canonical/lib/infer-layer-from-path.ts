import micromatch from "micromatch";

/**
 * Architecture layer descriptor as declared in
 * `.spec/00-canon/repository-registry/architecture.yaml#layers[]`.
 * Mirrors the runtime shape of `LayerSchema` from
 * `packages/registry/src/canonical/architecture-contract.ts:49`.
 */
export interface ArchitectureLayer {
  readonly id: string;
  readonly rootGlobs: readonly string[];
}

/**
 * Returns the canonical layer id for a given monorepo-relative `path`,
 * computed by matching `path` against each layer's `rootGlobs` and selecting
 * the layer whose matching glob is the LONGEST (most specific).
 *
 * Algorithm: longest-glob-wins.
 *   - Deterministic: result independent of layer ordering in input array.
 *   - Resolves overlapping globs cleanly: `backend/src/workers/main.ts`
 *     matches both `backend/src/**` (backend) and `backend/src/workers/**`
 *     (workers); the longer glob — workers — wins.
 *
 * Returns `undefined` if no layer's rootGlob matches. The caller (e.g.
 * runtime-contract test §4.5) decides how to react (test failure, log
 * warning, etc.).
 *
 * Glob matching uses `micromatch` for full glob syntax support
 * (`*`, `**`, `?`, `[abc]`, `{a,b}`). The architecture.yaml rootGlobs are
 * intentionally simple `<prefix>/**` patterns today, but the helper is
 * forward-compatible with richer patterns if architecture.yaml ever
 * adopts them.
 *
 * @see [[runtime-contract]] §4.5 layer-path consistency tests
 * @see [[architecture-contract]] §LayerSchema source-of-truth
 * @see [[feedback_verify_shared_schemas_before_inventing_zod]]
 */
export function inferLayerFromPath(
  path: string,
  layers: readonly ArchitectureLayer[],
): string | undefined {
  let bestLayerId: string | undefined;
  let bestSpecificity = -1;

  for (const layer of layers) {
    for (const glob of layer.rootGlobs) {
      if (!micromatch.isMatch(path, glob)) continue;
      if (glob.length > bestSpecificity) {
        bestSpecificity = glob.length;
        bestLayerId = layer.id;
      }
    }
  }

  return bestLayerId;
}
