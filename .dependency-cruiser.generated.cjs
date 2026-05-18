/**
 * AUTO-GENERATED — DO NOT EDIT.
 *
 * Source:                      .spec/00-canon/repository-registry/architecture.yaml
 * Source SHA-256:              096d0bdd137e677d8a5cbefa7db1c8b1e9bb68724a59c067368911cd08a30588
 * Generated format version:    1
 * Generated module format:     cjs
 * Generated with Node:         v22.x
 * Targets depcruise:           16.x
 * Ownership:                   @repo/registry (PR review required for any change to the generator)
 * Generator:                   @repo/registry bin "build-architecture-artifacts"
 * Re-generate:                 npm run architecture:build
 *
 * Edits to this file will fail the CI freshness gate in audit.yml.
 * If a reviewer asks to "just patch the generated file", REFUSE and edit the YAML instead.
 */

module.exports = [
  {
    comment: 'Generated from architecture.yaml#boundaries[frontend-backend-symmetry]. Backend MUST NOT import frontend code — shared types go in packages/.',
    from: {
      path: '^backend/src/'
    },
    name: 'backend-not-to-frontend',
    severity: 'error',
    to: {
      path: '^frontend/app/'
    }
  },
  {
    comment: 'Generated from architecture.yaml#boundaries[frontend-backend-symmetry]. Frontend MUST NOT import backend internals — use the public HTTP API.',
    from: {
      path: '^frontend/app/'
    },
    name: 'frontend-not-to-backend-src',
    severity: 'error',
    to: {
      path: '^backend/src/'
    }
  }
];
