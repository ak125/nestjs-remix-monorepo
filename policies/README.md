# Rego Policies (OPA / conftest)

Bounded-context invariants for the Diagnostic Control Plane V1.

Canon : `feedback_opa_rego_invariants_only.md` — Rego expresses **invariants only**,
never scoring or thresholds. If a rule needs a number that might change, it does
not belong here.

## Layout

| Path | Domain | Severity | Run |
|------|--------|----------|-----|
| `policies/maintenance/no-programmatic-seo-pages.rego` | D16 Maintenance | L3 (protected-branch) | CI gate on the Remix route manifest |

Severity tier mapping lives in `.claude/governance/guard-hierarchy.yaml`.

## Local check

Install [conftest](https://www.conftest.dev/) (Go binary, not an npm package — invoked
via CI runner setup, not `package.json`, to avoid post-install side-effects on devs
who never run policy gates locally).

```bash
brew install conftest      # macOS
# or
wget https://github.com/open-policy-agent/conftest/releases/...   # linux
```

Then :

```bash
# Verify unit tests embedded in *_test.rego files
conftest verify --policy policies/maintenance

# Test a real input manifest (namespace flag is required to pick up the
# packaged deny rules — pinned in policies/conftest.toml for CI)
conftest test --policy policies/maintenance --all-namespaces \
  docs/routes/manifest.json
```

## CI wiring

The CI workflow `policy-gates.yml` (added in a later PR) :

1. Builds the Remix route manifest (`docs/routes/manifest.json`, generated).
2. Loads `input.adr_overrides` from `governance-vault/adrs/route-overrides.yaml`
   via HTTPS (read-only vault mirror).
3. Runs `conftest test --policy policies/maintenance manifest.json`.
4. Fails the PR if any `deny` rule fires — L3 hard block.

Override path : an ADR vault PR adding the route to `route-overrides.yaml`,
labelled `architecture-review`, reviewed by `@architects`.

## Why no `policies/diagnostic/`, `policies/commerce/`, … yet ?

V1 scope discipline (canon `feedback_v1_first_dont_build_ultimate_engine_too_early.md`).
The Maintenance invariant is the **only** Rego rule that protects against a known
SEO-farm risk specific to D16. Other domains rely on dep-cruiser + ast-grep (L2)
which is sufficient for V1. We add a new policy directory only when an empirical
incident or evidence pack requires one.
