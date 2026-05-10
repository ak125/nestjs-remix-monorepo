import { RoleId } from "./canonical";

/**
 * Canonical Tailwind badge color classes per role.
 * Keys are canonical `RoleId` enum values.
 */
export const ROLE_BADGE_COLORS: Record<RoleId, string> = {
  [RoleId.R0_HOME]: "bg-slate-100 text-slate-800",
  [RoleId.R1_ROUTER]: "bg-blue-100 text-blue-800",
  [RoleId.R2_PRODUCT]: "bg-green-100 text-green-800",
  [RoleId.R3_CONSEILS]: "bg-purple-100 text-purple-800",
  [RoleId.R3_GUIDE]: "bg-purple-50 text-purple-600",
  [RoleId.R4_REFERENCE]: "bg-amber-100 text-amber-800",
  [RoleId.R5_DIAGNOSTIC]: "bg-red-100 text-red-800",
  [RoleId.R6_SUPPORT]: "bg-gray-100 text-gray-800",
  [RoleId.R6_GUIDE_ACHAT]: "bg-teal-100 text-teal-800",
  [RoleId.R7_BRAND]: "bg-indigo-100 text-indigo-800",
  [RoleId.R8_VEHICLE]: "bg-orange-100 text-orange-800",
  [RoleId.R9_GOVERNANCE]: "bg-stone-100 text-stone-700",
  [RoleId.AGENTIC_ENGINE]: "bg-violet-100 text-violet-800",
  [RoleId.FOUNDATION]: "bg-zinc-100 text-zinc-800",
};
