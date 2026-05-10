"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRoleIntents = getRoleIntents;
exports.isIntentAllowedForRole = isIntentAllowedForRole;
const canonical_1 = require("./canonical");
function getRoleIntents(role) {
    switch (role) {
        case canonical_1.RoleId.R2_PRODUCT:
            return { primary: "transactionnelle", secondary: [], allowedLeakage: [] };
        case canonical_1.RoleId.R5_DIAGNOSTIC:
            return { primary: "diagnostique", secondary: [], allowedLeakage: [] };
        case canonical_1.RoleId.R4_REFERENCE:
            return {
                primary: "informationnelle",
                secondary: ["navigationnelle"],
                allowedLeakage: [],
            };
        case canonical_1.RoleId.R1_ROUTER:
            return {
                primary: "navigationnelle",
                secondary: [],
                allowedLeakage: ["transactionnelle"],
            };
        case canonical_1.RoleId.R7_BRAND:
            return {
                primary: "navigationnelle",
                secondary: ["informationnelle"],
                allowedLeakage: [],
            };
        case canonical_1.RoleId.R8_VEHICLE:
            return {
                primary: "navigationnelle",
                secondary: [],
                allowedLeakage: ["transactionnelle"],
            };
        case canonical_1.RoleId.R3_CONSEILS:
            return { primary: "informationnelle", secondary: [], allowedLeakage: [] };
        case canonical_1.RoleId.R6_GUIDE_ACHAT:
            return {
                primary: "investigation_commerciale",
                secondary: ["informationnelle"],
                allowedLeakage: [],
            };
        case canonical_1.RoleId.R6_SUPPORT:
            return { primary: "informationnelle", secondary: [], allowedLeakage: [] };
        case canonical_1.RoleId.R0_HOME:
            return {
                primary: "navigationnelle",
                secondary: ["informationnelle"],
                allowedLeakage: [],
            };
        default:
            return { primary: "informationnelle", secondary: [], allowedLeakage: [] };
    }
}
function isIntentAllowedForRole(role, intent) {
    const slots = getRoleIntents(role);
    return (slots.primary === intent ||
        slots.secondary.includes(intent) ||
        slots.allowedLeakage.includes(intent));
}
//# sourceMappingURL=intents.js.map