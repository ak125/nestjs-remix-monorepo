# Rego Policies (OPA / conftest)

Bounded-context invariants for the Diagnostic Control Plane V1 (`maintenance/`,
conftest) and for SEO content writes (`seo-content/`, OPA WASM).

Canon : `feedback_opa_rego_invariants_only.md` — Rego expresses **invariants only**,
never scoring or thresholds. If a rule needs a number that might change, it does
not belong here.

## Layout

| Path | Domain | Severity | Run |
|------|--------|----------|-----|
| `policies/maintenance/no-programmatic-seo-pages.rego` | D16 Maintenance | L3 (protected-branch) | CI gate on the Remix route manifest |
| `policies/seo-content/*.rego` | SEO content writes (H1, R2) | — (non servi, voir ci-dessous) | `opa test policies/seo-content/ -v` |
| `policies/dist/*.wasm`, `*.bundle.tar.gz` | Bundles compilés des politiques `seo-content/` | — | `policies/build-opa-bundles.sh` |

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

> **État réel (constat 2026-06-10) : NON câblé.** `policy-gates.yml` n'existe pas
> dans `.github/workflows/` et le prérequis — le générateur du manifest de routes
> (`docs/routes/manifest.json`) — n'existe pas non plus. La policy est implémentée
> et testée (`conftest verify` local) mais **aucun job CI ne l'exécute** : le tier
> L3 déclaré dans `guard-hierarchy.yaml` est aujourd'hui doctrinal, pas mécanique.
> Condition de câblage : (1) générateur de manifest routes mergé, (2) workflow
> `policy-gates.yml` ajouté (airlock `.github/`, owner), (3) job ajouté aux
> required checks de branch protection.

Cible une fois câblé — le workflow `policy-gates.yml` :

1. Builds the Remix route manifest (`docs/routes/manifest.json`, generated).
2. Loads `input.adr_overrides` from an override file of this repository. Its
   path is to be decided when the gate is wired : `ak125/governance-vault` is a
   read-only archive (décisions 72 et 73) and no longer receives overrides.
3. Runs `conftest test --policy policies/maintenance manifest.json`.
4. Fails the PR if any `deny` rule fires — L3 hard block.

Override path : a pull request of this repository adding the route to that
override file, approved by the owner (circuit élevé). Not defined further while
the gate is not wired.

## Why no `policies/diagnostic/`, `policies/commerce/`, … yet ?

V1 scope discipline (canon `feedback_v1_first_dont_build_ultimate_engine_too_early.md`).
The Maintenance invariant is the **only** Rego rule that protects against a known
SEO-farm risk specific to D16. Other domains rely on dep-cruiser + ast-grep (L2)
which is sufficient for V1. We add a new policy directory only when an empirical
incident or evidence pack requires one.

## `seo-content/` — politiques d'écriture SEO (OPA WASM)

Relogées depuis l'archive `ak125/governance-vault` (commit `b2e712791bee`,
`policies/seo-content/` et `dist/policies/`) à la sortie du vault (décision 73,
étape 7). Copies à l'identique : les empreintes sont dans
`docs/audit/mandat-bc-20261116/etape-7.md`.

| Politique | Bundle | Lecteur dans ce dépôt |
|---|---|---|
| `r2-content-write.rego` | `dist/r2-content-write.wasm` | `backend/src/modules/seo/r2/services/r2-opa-evaluator.service.ts` |
| `h1-write.rego` | `dist/h1-write.wasm` | aucun |
| `r2-cluster-health.rego` | `dist/r2-cluster-health.wasm` | aucun |
| `r2-runtime-read.rego` | `dist/r2-runtime-read.wasm` | aucun |

**État réel (constat 2026-11-16) : non servi.** L'évaluateur R2 lit
`policies/dist/r2-content-write.wasm` par défaut (`R2_OPA_BUNDLE_PATH` pour un
autre répertoire), mais `@open-policy-agent/opa-wasm` n'est dans aucun
`package.json` et aucun code n'appelle `evaluateContentWrite()` : le service
reste en refus total (fail-closed). Les images de conteneur n'embarquent pas
`policies/`. Reloger ces fichiers ne met rien en service.

Reconstruire (OPA **0.69.0**, version épinglée : les octets du WASM en dépendent) :

```bash
opa test policies/seo-content/ -v
./policies/build-opa-bundles.sh                 # toutes les politiques
./policies/build-opa-bundles.sh r2-content-write
```

Le script se lance depuis n'importe où ; il compile avec le chemin relatif
`policies/seo-content/<fichier>`, qui entre dans les octets du WASM. Un bundle
reconstruit se committe avec sa source. Le workflow `opa-policy-build.yml`
rejoue les tests et compare les `.wasm` committés à une reconstruction.
