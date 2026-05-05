import { RoleId } from "./canonical";
declare const __canonicalRoleBrand: unique symbol;
export type CanonicalRoleId = RoleId & {
    readonly [__canonicalRoleBrand]: "CanonicalRoleId";
};
export declare function assertCanonicalRoleStrict(role: string): CanonicalRoleId;
export declare function isCanonicalRoleId(role: unknown): role is CanonicalRoleId;
export {};
//# sourceMappingURL=branded.d.ts.map