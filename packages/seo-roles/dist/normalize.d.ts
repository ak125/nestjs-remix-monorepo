import { RoleId, WorkerPageType } from "./canonical";
export declare function normalizeRoleId(input: string): RoleId | null;
export declare function assertCanonicalRole(role: string): RoleId;
export declare function roleIdToPageType(roleId: RoleId): WorkerPageType | null;
export declare function pageTypeToRoleId(pageType: string): RoleId | null;
//# sourceMappingURL=normalize.d.ts.map