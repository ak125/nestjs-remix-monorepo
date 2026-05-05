"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeRoleId = normalizeRoleId;
exports.assertCanonicalRole = assertCanonicalRole;
exports.roleIdToPageType = roleIdToPageType;
exports.pageTypeToRoleId = pageTypeToRoleId;
const legacy_1 = require("./legacy");
function normalizeRoleId(input) {
    if (legacy_1.FORBIDDEN_ROLE_IDS.includes(input))
        return null;
    if (legacy_1.CANONICAL_ROLE_SET.has(input))
        return input;
    if (input in legacy_1.LEGACY_ROLE_ALIASES)
        return legacy_1.LEGACY_ROLE_ALIASES[input];
    return legacy_1.PAGE_TYPE_TO_ROLE[input] ?? null;
}
function assertCanonicalRole(role) {
    if (!legacy_1.CANONICAL_ROLE_SET.has(role)) {
        throw new Error(`Non-canonical role in output: "${role}". Use normalizeRoleId() first.`);
    }
    if (legacy_1.DEPRECATED_OUTPUT_ROLES.has(role)) {
        throw new Error(`Deprecated role in output: "${role}". R9 / R3_GUIDE no longer canonical.`);
    }
    return role;
}
function roleIdToPageType(roleId) {
    return legacy_1.ROLE_TO_PAGE_TYPE[roleId] ?? null;
}
function pageTypeToRoleId(pageType) {
    return legacy_1.PAGE_TYPE_TO_ROLE[pageType] ?? null;
}
//# sourceMappingURL=normalize.js.map