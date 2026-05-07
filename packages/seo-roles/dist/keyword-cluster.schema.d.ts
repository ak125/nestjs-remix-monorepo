import { z } from "zod";
export declare const KeywordClusterSchema: z.ZodEffects<z.ZodObject<{
    role: z.ZodType<import("./branded").CanonicalRoleId, z.ZodTypeDef, unknown>;
    primary: z.ZodString;
    primary_volume: z.ZodOptional<z.ZodNumber>;
    secondary: z.ZodArray<z.ZodString, "many">;
    intent: z.ZodEnum<["transactionnelle", "informationnelle", "navigationnelle", "diagnostique", "investigation_commerciale"]>;
    forbidden_overlap: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    role: import("./branded").CanonicalRoleId;
    primary: string;
    secondary: string[];
    intent: "transactionnelle" | "informationnelle" | "navigationnelle" | "diagnostique" | "investigation_commerciale";
    primary_volume?: number | undefined;
    forbidden_overlap?: string[] | undefined;
}, {
    primary: string;
    secondary: string[];
    intent: "transactionnelle" | "informationnelle" | "navigationnelle" | "diagnostique" | "investigation_commerciale";
    role?: unknown;
    primary_volume?: number | undefined;
    forbidden_overlap?: string[] | undefined;
}>, {
    role: import("./branded").CanonicalRoleId;
    primary: string;
    secondary: string[];
    intent: "transactionnelle" | "informationnelle" | "navigationnelle" | "diagnostique" | "investigation_commerciale";
    primary_volume?: number | undefined;
    forbidden_overlap?: string[] | undefined;
}, {
    primary: string;
    secondary: string[];
    intent: "transactionnelle" | "informationnelle" | "navigationnelle" | "diagnostique" | "investigation_commerciale";
    role?: unknown;
    primary_volume?: number | undefined;
    forbidden_overlap?: string[] | undefined;
}>;
export type KeywordCluster = z.infer<typeof KeywordClusterSchema>;
//# sourceMappingURL=keyword-cluster.schema.d.ts.map