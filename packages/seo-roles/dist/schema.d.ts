import { z } from "zod";
import { RoleId } from "./canonical";
import { CanonicalRoleId } from "./branded";
export declare const tolerantRoleSchema: z.ZodType<CanonicalRoleId, z.ZodTypeDef, unknown>;
export declare const canonicalRoleSchema: z.ZodType<CanonicalRoleId, z.ZodTypeDef, unknown>;
export declare const roleIdNativeEnum: z.ZodNativeEnum<typeof RoleId>;
//# sourceMappingURL=schema.d.ts.map