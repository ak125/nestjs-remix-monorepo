import { RoleId } from "./canonical";
import { type SearchIntent } from "./keyword-intent";
export interface RoleIntents {
    readonly primary: SearchIntent;
    readonly secondary: readonly SearchIntent[];
    readonly allowedLeakage: readonly SearchIntent[];
}
export declare function getRoleIntents(role: RoleId): RoleIntents;
export declare function isIntentAllowedForRole(role: RoleId, intent: SearchIntent): boolean;
//# sourceMappingURL=intents.d.ts.map