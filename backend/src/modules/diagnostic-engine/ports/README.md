# Diagnostic Domain — Outbound Ports (D7/D4 ↔ peers)

Cross-domain handoffs leaving DiagnosticEngine go through **ports** (interfaces), never
direct imports of peer modules. Enforced by `dependency-cruiser` rule
`no-direct-cross-module-import` and ast-grep rule `domain-port-method-cap`.

## Ports (V1)

| Port | Target Domain | Methods (max 5) |
|---|---|---|
| `CommercePort` | D11 Commerce & Users | `suggestParts(causes, vehicleCtx)` |
| `MaintenancePort` | D16 Maintenance | `getRelatedSchedule(vehicleCtx, causes)` |
| `EditorialPort` | D6 RAG & AI Engine | `enrich(causes)` |
| `VehicleContextPort` | D4 Vehicle / Compatibility | `get()`, `persist(ctx, response)` |

## Rules (AST-enforced bloquant CI)

1. **Cardinality** : max 5 méthodes / port
2. **Naming** : intent-based, interdit `^(get|fetch|load)(All|Everything|Stuff|Bulk|Combined)`
3. **Cyclomatic** : eslint `complexity ≤ 8` sur impls de port
4. **DTO shape** : max 8 champs top-level + 3 niveaux nesting + jamais de domain entity
   étranger
5. **Stable contract** : changement signature = bump version registry

Canon : `ddd-bounded-contexts-anti-god-engine` memory, ADR-058 Repository Control Plane.
