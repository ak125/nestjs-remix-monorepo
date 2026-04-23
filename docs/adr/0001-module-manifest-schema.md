# ADR-001 — Module Manifest Schema

**Status:** Accepted  
**Date:** 2026-04-13  
**Author:** Software-Architect (d2e89803)  
**Parent issue:** [AUT-281](/AUT/issues/AUT-281) · [AUT-271](/AUT/issues/AUT-271)  
**Supersedes:** —  
**Superseded by:** —

---

## Context

AutoMecanik's monorepo has grown to ~40+ backend modules without a formal ownership contract. The result:

- No machine-readable declaration of which module owns which tables → cross-module writes proliferate silently
- No invariants_ref → regression gates can't be automatically scoped to a module's test suite
- No forbidden_imports enforcement → circular dependencies accumulate
- No risk_level signal → CTO can't prioritise review budget

The TecDoc post-migration epic ([AUT-271](/AUT/issues/AUT-271)) requires a contractual baseline before adding new modules (`vehicles`, `payments`, and 43 others). Without a schema, the manifests would be prose documents with no machine enforcement.

Prior to this ADR there was no `.spec/modules/` directory and no schema artifact.

---

## Decision

We adopt a **YAML module manifest** for every backend/frontend module, validated against a JSON Schema declared at `.spec/modules/_schema.yaml`.

Each manifest lives at `.spec/modules/<name>/manifest.yaml`.

### Required fields (gate-blocking if absent)

| Field | Purpose |
|---|---|
| `name` | Kebab-case identifier, matches directory name |
| `version` | SemVer; gates compare against last merged version |
| `owner_agent` | Paperclip agent UUID — who is accountable for code changes |
| `risk_level` | `low / medium / high / critical` — gates enforce review quorum |
| `change_surface` | `isolated / cross-module / cross-domain / infra` |
| `owned_tables.write` | Tables this module exclusively writes; violations trigger `db-ownership-gate` |
| `owned_tables.read` | Cross-module reads (informational, for dep graph) |
| `owned_rpcs` | Supabase RPC functions owned; needed for RPC Gate allowlist generation |
| `forbidden_imports` | dep-cruiser enforces these at lint time |
| `invariants_ref` | INV-NNN IDs from `feature-invariants.json`; invariants-nightly CI runs these |

### Optional but recommended fields

`http_routes`, `public_exports`, `depends_on_modules`, `seo_contracts`, `canonical_tests`, `description`, `status`

### Status lifecycle

```
draft → certified → deprecated → retired
```

- **draft**: manifest written, gates advisory only
- **certified**: gate battery green for 5 consecutive runs; auto-merge unlocked
- **deprecated**: retirement announced; freeze window begins (72h per ADR-003)
- **retired**: archived to `.spec/retired/`, no new imports allowed

### Ownership rule

Software-Architect (`d2e89803`) is **never** `owner_agent` on any module manifest. Software-Architect owns only `.spec/**` artifacts. Module code ownership belongs to Code-Fixer or the assigned backend agent.

---

## Consequences

### Positive

- **Gate automation**: `manifest-check` CI gate can validate schema conformance on every PR touching `.spec/modules/`.
- **Invariant scoping**: `invariants-nightly` CI maps `INV-NNN` refs to modules, reports drift by domain.
- **Dep-cruiser integration**: `forbidden_imports` feeds the dep-cruiser allowlist without manual config files.
- **Risk-based review quorum**: `risk_level: critical` PRs require CTO approval before merge.
- **Retirement traceability**: nothing is deleted; `.spec/retired/` holds all retired manifests.

### Negative / trade-offs

- **Maintenance overhead**: every new module requires a manifest PR through Software-Architect.
- **Bootstrapping cost**: 43 existing modules need manifests written (scope of [AUT-272](/AUT/issues/AUT-272)).
- **Schema evolution risk**: adding required fields to `_schema.yaml` invalidates all existing manifests until updated. Mitigation: required fields may only be added via a new ADR.

### Neutral

- The schema is intentionally permissive on optional fields to minimise initial adoption friction. Fields become required only via explicit ADR.

---

## Validation Criterion

The schema is considered valid when it successfully validates the first two module manifests:

1. `.spec/modules/vehicles/manifest.yaml` (deliverable of [AUT-272](/AUT/issues/AUT-272))
2. `.spec/modules/payments/manifest.yaml` (deliverable of [AUT-272](/AUT/issues/AUT-272))

If either fails schema validation, this ADR is reopened for revision before [AUT-272](/AUT/issues/AUT-272) proceeds to mass scaffolding.

---

## Artefacts

- Schema: [`.spec/modules/_schema.yaml`](../../.spec/modules/_schema.yaml)
- Gate design: `gates/manifest-check.ts` (to be implemented by CI-CD-Watch)
- Nightly drift sweep: `gates/manifest-drift.ts` (to be consumed by Code-Analyst, [AUT-272](/AUT/issues/AUT-272))
