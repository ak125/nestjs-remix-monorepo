/**
 * Pure keyword → `__seo_keyword_results` row mapping, sourced ENTIRELY from
 * the `@repo/seo-roles` canon. No regex, no brand lists, no intent rules live
 * here — drift is impossible because every decision delegates to the SoT:
 *
 *   role   = getRoleShortLabel(classifyKeywordToRole(kw).role)   // R1..R8
 *   intent = getRoleIntents(canonicalRole).primary                // SearchIntent
 *
 * R0_HOME (short "R0") is excluded: the `__seo_keyword_results.role` CHECK
 * only allows R1..R8, and a bare-gamme keyword should never be R0 anyway.
 */
import {
  classifyKeywordToRole,
  getRoleShortLabel,
  getRoleIntents,
  normalizeRoleId,
  type SearchIntent,
} from "@repo/seo-roles";

export type ShortRole = "R1" | "R2" | "R3" | "R4" | "R5" | "R6" | "R7" | "R8";

export interface ClassifiedRow {
  readonly kw: string;
  /** null = excluded (R0 or non-R1..R8) — caller drops the row. */
  readonly role: ShortRole | null;
  readonly intent: SearchIntent | null;
}

const VALID_SHORT: ReadonlySet<string> = new Set([
  "R1",
  "R2",
  "R3",
  "R4",
  "R5",
  "R6",
  "R7",
  "R8",
]);

export function classifyRow(rawKw: string): ClassifiedRow {
  const kw = rawKw.trim();
  const { role: canonicalRole } = classifyKeywordToRole(kw);
  const short = getRoleShortLabel(canonicalRole);

  if (!VALID_SHORT.has(short)) {
    return { kw, role: null, intent: null };
  }

  const intent = getRoleIntents(normalizeRoleId(canonicalRole)!).primary;
  return { kw, role: short as ShortRole, intent };
}
