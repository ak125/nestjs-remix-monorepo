import { RoleId, WorkerPageType } from "./canonical";
export declare const LEGACY_ROLE_ALIASES: Record<string, RoleId>;
export declare const PAGE_TYPE_TO_ROLE: Record<WorkerPageType, RoleId>;
export declare const ROLE_TO_PAGE_TYPE: Partial<Record<RoleId, WorkerPageType>>;
export declare const FORBIDDEN_ROLE_IDS: readonly ["R3", "R6", "R9", "R3_GUIDE"];
export declare const CANONICAL_ROLE_SET: ReadonlySet<string>;
export declare const DEPRECATED_OUTPUT_ROLES: ReadonlySet<RoleId>;
//# sourceMappingURL=legacy.d.ts.map