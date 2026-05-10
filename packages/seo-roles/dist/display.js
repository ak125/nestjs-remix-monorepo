"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRoleDisplayLabel = getRoleDisplayLabel;
exports.getRoleShortLabel = getRoleShortLabel;
const canonical_1 = require("./canonical");
const normalize_1 = require("./normalize");
const CANONICAL_DISPLAY_LABELS = {
    [canonical_1.RoleId.R0_HOME]: "R0 · Accueil",
    [canonical_1.RoleId.R1_ROUTER]: "R1 · Router gamme",
    [canonical_1.RoleId.R2_PRODUCT]: "R2 · Produit",
    [canonical_1.RoleId.R3_CONSEILS]: "R3 · Conseils",
    [canonical_1.RoleId.R3_GUIDE]: "R3 · Guide (déprécié)",
    [canonical_1.RoleId.R4_REFERENCE]: "R4 · Référence",
    [canonical_1.RoleId.R5_DIAGNOSTIC]: "R5 · Diagnostic",
    [canonical_1.RoleId.R6_GUIDE_ACHAT]: "R6 · Guide d'achat",
    [canonical_1.RoleId.R6_SUPPORT]: "R6 · Support",
    [canonical_1.RoleId.R7_BRAND]: "R7 · Marque",
    [canonical_1.RoleId.R8_VEHICLE]: "R8 · Véhicule",
    [canonical_1.RoleId.R9_GOVERNANCE]: "R9 · Gouvernance (déprécié)",
    [canonical_1.RoleId.AGENTIC_ENGINE]: "Moteur agentique",
    [canonical_1.RoleId.FOUNDATION]: "Fondation transverse",
};
const CANONICAL_SHORT_LABELS = {
    [canonical_1.RoleId.R0_HOME]: "R0",
    [canonical_1.RoleId.R1_ROUTER]: "R1",
    [canonical_1.RoleId.R2_PRODUCT]: "R2",
    [canonical_1.RoleId.R3_CONSEILS]: "R3",
    [canonical_1.RoleId.R3_GUIDE]: "R3",
    [canonical_1.RoleId.R4_REFERENCE]: "R4",
    [canonical_1.RoleId.R5_DIAGNOSTIC]: "R5",
    [canonical_1.RoleId.R6_GUIDE_ACHAT]: "R6",
    [canonical_1.RoleId.R6_SUPPORT]: "R6",
    [canonical_1.RoleId.R7_BRAND]: "R7",
    [canonical_1.RoleId.R8_VEHICLE]: "R8",
    [canonical_1.RoleId.R9_GOVERNANCE]: "R9",
    [canonical_1.RoleId.AGENTIC_ENGINE]: "AE",
    [canonical_1.RoleId.FOUNDATION]: "FN",
};
function getRoleDisplayLabel(role) {
    if (!role)
        return "—";
    if (role === "R6")
        return "R6 · Legacy à qualifier";
    const canonical = (0, normalize_1.normalizeRoleId)(role);
    if (!canonical)
        return role;
    return CANONICAL_DISPLAY_LABELS[canonical] ?? role;
}
function getRoleShortLabel(role) {
    if (!role)
        return "—";
    if (role === "R6")
        return "R6";
    const canonical = (0, normalize_1.normalizeRoleId)(role);
    if (!canonical)
        return role;
    return CANONICAL_SHORT_LABELS[canonical] ?? role;
}
//# sourceMappingURL=display.js.map