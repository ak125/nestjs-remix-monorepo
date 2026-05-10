import { RoleId } from "./canonical";
import { normalizeRoleId } from "./normalize";

/** Canonical FR display labels for admin UI. */
const CANONICAL_DISPLAY_LABELS: Record<RoleId, string> = {
  [RoleId.R0_HOME]: "R0 · Accueil",
  [RoleId.R1_ROUTER]: "R1 · Router gamme",
  [RoleId.R2_PRODUCT]: "R2 · Produit",
  [RoleId.R3_CONSEILS]: "R3 · Conseils",
  [RoleId.R3_GUIDE]: "R3 · Guide (déprécié)",
  [RoleId.R4_REFERENCE]: "R4 · Référence",
  [RoleId.R5_DIAGNOSTIC]: "R5 · Diagnostic",
  [RoleId.R6_GUIDE_ACHAT]: "R6 · Guide d'achat",
  [RoleId.R6_SUPPORT]: "R6 · Support",
  [RoleId.R7_BRAND]: "R7 · Marque",
  [RoleId.R8_VEHICLE]: "R8 · Véhicule",
  [RoleId.R9_GOVERNANCE]: "R9 · Gouvernance (déprécié)",
  [RoleId.AGENTIC_ENGINE]: "Moteur agentique",
  [RoleId.FOUNDATION]: "Fondation transverse",
};

/** Short prefix label (R1, R3, R6, ...) for compact badges. */
const CANONICAL_SHORT_LABELS: Record<RoleId, string> = {
  [RoleId.R0_HOME]: "R0",
  [RoleId.R1_ROUTER]: "R1",
  [RoleId.R2_PRODUCT]: "R2",
  [RoleId.R3_CONSEILS]: "R3",
  [RoleId.R3_GUIDE]: "R3",
  [RoleId.R4_REFERENCE]: "R4",
  [RoleId.R5_DIAGNOSTIC]: "R5",
  [RoleId.R6_GUIDE_ACHAT]: "R6",
  [RoleId.R6_SUPPORT]: "R6",
  [RoleId.R7_BRAND]: "R7",
  [RoleId.R8_VEHICLE]: "R8",
  [RoleId.R9_GOVERNANCE]: "R9",
  [RoleId.AGENTIC_ENGINE]: "AE",
  [RoleId.FOUNDATION]: "FN",
};

/**
 * Display label FR pour UI admin.
 *
 * Cas particuliers :
 * - `null` / `undefined` / vide → `"—"`
 * - `'R6'` bare → `"R6 · Legacy à qualifier"` (pas de normalisation silencieuse,
 *   ambigu entre R6_GUIDE_ACHAT et R6_SUPPORT — résolution via URL côté backend)
 * - input inconnu → retourne brut (pas de crash)
 */
export function getRoleDisplayLabel(role: string | null | undefined): string {
  if (!role) return "—";
  // R6 bare = ambigu, ne PAS normaliser sans contexte URL
  if (role === "R6") return "R6 · Legacy à qualifier";
  const canonical = normalizeRoleId(role);
  if (!canonical) return role; // input inconnu → retour brut, pas crash
  return CANONICAL_DISPLAY_LABELS[canonical] ?? role;
}

/** Short prefix label (R1, R3, R6, ...). Bare R6 returns "R6". */
export function getRoleShortLabel(role: string | null | undefined): string {
  if (!role) return "—";
  if (role === "R6") return "R6";
  const canonical = normalizeRoleId(role);
  if (!canonical) return role;
  return CANONICAL_SHORT_LABELS[canonical] ?? role;
}
