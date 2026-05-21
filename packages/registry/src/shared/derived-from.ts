import { z } from "zod";

/**
 * Source of an entry's information — traçabilité du « pourquoi cette
 * classification ».
 *
 * Multiple sources allowed (e.g. a file may be derived from both depcruise
 * AND codeowners). Order is informational, not significant.
 */
export const DerivedFromSchema = z.enum([
  "depcruise",   // dependency-cruiser graph
  "madge",       // madge circular check
  "knip",        // knip dead-code detector
  "codeowners",  // .github/CODEOWNERS pattern match
  "heuristic",   // path-based naming convention
  "manual",      // explicit human entry in ownership.yaml or similar
  "reachability",// transitive import-graph reachability (status=LIVE derivation)
]);

export type DerivedFrom = z.infer<typeof DerivedFromSchema>;
