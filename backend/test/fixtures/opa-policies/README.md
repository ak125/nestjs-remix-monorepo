# OPA Policy Fixtures

Bundle WASM + Rego sources mirrored from the governance vault for local
development and CI test runs.

## Provenance

- Source repo : `ak125/governance-vault`
- Source path : `dist/policies/h1-write.wasm`
- Source PR   : #279 (PR-V — SEO Governance Control Plane)
- SHA-256     : `ce9ba9f2466f1cce404532dd11fb9cca2fddbaee0087e489e77e4285c8cc91c6`

The WASM here MUST be byte-identical to the vault artefact. CI verifies the
vault artefact via the OPA SHA drift gate (PR-V workflow).

## Modes (`OPA_BUNDLE_MODE` env var)

| Mode | Source | Use case |
|------|--------|----------|
| `prod_vault` | `OPA_BUNDLE_PATH` (vault mirror sync) | DEV preprod + PROD |
| `dev_fixture` | `backend/test/fixtures/opa-policies/seo-content/h1-write.wasm` | Local `pnpm dev` |
| `test_fixture` | idem `dev_fixture` | CI `pnpm test` |
| `missing_fail_closed` | (none) | Explicit deny — every write returns deny |

**Absence of mode = fail-closed deny** (never permit-all).

## Updating

When the vault Rego changes :

1. PR-V (vault) rebuilds WASM, CI passes drift check
2. `cp /opt/automecanik/governance-vault/dist/policies/h1-write.wasm backend/test/fixtures/opa-policies/seo-content/`
3. Verify SHA matches : `sha256sum backend/test/fixtures/opa-policies/seo-content/h1-write.wasm`
