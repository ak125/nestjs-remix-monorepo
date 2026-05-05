import { z } from "zod";
import { type CanonicalRoleId } from "./branded";
export declare const SearchIntentSchema: z.ZodEnum<["transactionnelle", "informationnelle", "navigationnelle", "diagnostique", "investigation_commerciale"]>;
export type SearchIntent = z.infer<typeof SearchIntentSchema>;
export type KeywordRoleClassification = {
    role: CanonicalRoleId;
    matched: "regex" | "default-router";
};
export declare function classifyKeywordToRole(rawKeyword: string): KeywordRoleClassification;
//# sourceMappingURL=keyword-intent.d.ts.map