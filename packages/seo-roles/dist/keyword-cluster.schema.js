"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeywordClusterSchema = void 0;
const zod_1 = require("zod");
const schema_1 = require("./schema");
const keyword_intent_1 = require("./keyword-intent");
const intents_1 = require("./intents");
const RawCluster = zod_1.z.object({
    role: schema_1.canonicalRoleSchema,
    primary: zod_1.z.string().min(2, "primary keyword must be ≥ 2 chars"),
    primary_volume: zod_1.z
        .number()
        .int()
        .nonnegative()
        .optional()
        .describe("0 marks a synthetic keyword (no real KP volume)"),
    secondary: zod_1.z.array(zod_1.z.string().min(2)).max(5),
    intent: keyword_intent_1.SearchIntentSchema,
    forbidden_overlap: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.KeywordClusterSchema = RawCluster.refine((c) => (0, intents_1.isIntentAllowedForRole)(c.role, c.intent), {
    message: "Intent not in canonical primary/secondary/allowedLeakage set for role",
    path: ["intent"],
});
//# sourceMappingURL=keyword-cluster.schema.js.map