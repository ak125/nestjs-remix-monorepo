"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertCanonicalRoleStrict = assertCanonicalRoleStrict;
exports.isCanonicalRoleId = isCanonicalRoleId;
const legacy_1 = require("./legacy");
function assertCanonicalRoleStrict(role) {
    if (!legacy_1.CANONICAL_ROLE_SET.has(role)) {
        throw new Error(`Non-canonical role in output: "${role}". Use normalizeRoleId() first.`);
    }
    if (legacy_1.DEPRECATED_OUTPUT_ROLES.has(role)) {
        throw new Error(`Deprecated role in output: "${role}". R9 / R3_GUIDE no longer canonical.`);
    }
    return role;
}
function isCanonicalRoleId(role) {
    if (typeof role !== "string")
        return false;
    if (!legacy_1.CANONICAL_ROLE_SET.has(role))
        return false;
    return !legacy_1.DEPRECATED_OUTPUT_ROLES.has(role);
}
//# sourceMappingURL=branded.js.map