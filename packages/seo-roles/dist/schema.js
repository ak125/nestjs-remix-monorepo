"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roleIdNativeEnum = exports.canonicalRoleSchema = exports.tolerantRoleSchema = void 0;
const zod_1 = require("zod");
const canonical_1 = require("./canonical");
const branded_1 = require("./branded");
const normalize_1 = require("./normalize");
exports.tolerantRoleSchema = zod_1.z
    .string({ required_error: "Role is required" })
    .transform((val, ctx) => {
    const normalized = (0, normalize_1.normalizeRoleId)(val);
    if (!normalized) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: `Unknown or forbidden role: "${val}". Bare R3/R6/R9 are ambiguous; use canonical RoleId or a known legacy alias.`,
        });
        return zod_1.z.NEVER;
    }
    return (0, branded_1.assertCanonicalRoleStrict)(normalized);
});
exports.canonicalRoleSchema = zod_1.z
    .string({ required_error: "Role is required" })
    .transform((val, ctx) => {
    try {
        return (0, branded_1.assertCanonicalRoleStrict)(val);
    }
    catch (e) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: e instanceof Error
                ? e.message
                : `Non-canonical role in output: "${val}".`,
        });
        return zod_1.z.NEVER;
    }
});
exports.roleIdNativeEnum = zod_1.z.nativeEnum(canonical_1.RoleId);
//# sourceMappingURL=schema.js.map