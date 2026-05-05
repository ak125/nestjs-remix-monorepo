"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeRoleId = normalizeRoleId;
exports.assertCanonicalRole = assertCanonicalRole;
exports.roleIdToPageType = roleIdToPageType;
exports.pageTypeToRoleId = pageTypeToRoleId;
const canonical_1 = require("./canonical");
const legacy_1 = require("./legacy");
function normalizeRoleId(input) {
    if (legacy_1.FORBIDDEN_ROLE_IDS.includes(input))
        return null;
    const asRole = Object.values(canonical_1.RoleId).find((v) => v === input);
    if (asRole)
        return asRole;
    if (input in legacy_1.LEGACY_ROLE_ALIASES)
        return legacy_1.LEGACY_ROLE_ALIASES[input];
    return legacy_1.PAGE_TYPE_TO_ROLE[input] ?? null;
}
function assertCanonicalRole(role) {
    const canonical = Object.values(canonical_1.RoleId).find((v) => v === role);
    if (!canonical) {
        throw new Error(`Non-canonical role in output: "${role}". Use normalizeRoleId() first.`);
    }
    if (legacy_1.DEPRECATED_OUTPUT_ROLES.has(canonical)) {
        throw new Error(`Deprecated role in output: "${role}". R9 / R3_GUIDE no longer canonical.`);
    }
    return canonical;
}
function roleIdToPageType(roleId) {
    return legacy_1.ROLE_TO_PAGE_TYPE[roleId] ?? null;
}
function pageTypeToRoleId(pageType) {
    return legacy_1.PAGE_TYPE_TO_ROLE[pageType] ?? null;
}
//# sourceMappingURL=normalize.js.map