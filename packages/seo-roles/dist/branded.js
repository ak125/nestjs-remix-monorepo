"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertCanonicalRoleStrict = assertCanonicalRoleStrict;
exports.isCanonicalRoleId = isCanonicalRoleId;
const canonical_1 = require("./canonical");
const legacy_1 = require("./legacy");
function assertCanonicalRoleStrict(role) {
    const canonical = canonical_1.ROLE_ID_LIST.find((v) => v === role);
    if (!canonical) {
        throw new Error(`Non-canonical role in output: "${role}". Use normalizeRoleId() first.`);
    }
    if (legacy_1.DEPRECATED_OUTPUT_ROLES.has(canonical)) {
        throw new Error(`Deprecated role in output: "${role}". R9 / R3_GUIDE no longer canonical.`);
    }
    return canonical;
}
function isCanonicalRoleId(role) {
    if (typeof role !== "string")
        return false;
    const canonical = canonical_1.ROLE_ID_LIST.find((v) => v === role);
    if (!canonical)
        return false;
    return !legacy_1.DEPRECATED_OUTPUT_ROLES.has(canonical);
}
//# sourceMappingURL=branded.js.map