import { RoleId } from "./canonical";
export interface HandoffEdge {
    readonly target: RoleId;
    readonly condition: string;
}
export declare const ROLE_HANDOFF_GRAPH: Readonly<Record<RoleId, readonly HandoffEdge[]>>;
export declare const ROLE_HANDOFF_GRAPH_VERSION: "1.0.0";
export declare function getHandoffTargets(role: RoleId): readonly RoleId[];
export declare function isHandoffAllowed(source: RoleId, target: RoleId): boolean;
//# sourceMappingURL=handoff-graph.d.ts.map