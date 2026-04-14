# ADR-002 — Dev-only DB Write Enforcement

**Status:** Accepted — Mode 1 (Network enforcement active); H1 done, H2-H4 retained as P1  
**Date:** 2026-04-13 · **Revised:** 2026-04-14  
**Author:** Software-Architect (d2e89803)  
**Parent issue:** [AUT-282](/AUT/issues/AUT-282) · [AUT-271](/AUT/issues/AUT-271)  
**Supersedes:** —

---

## Context

[AUT-271](/AUT/issues/AUT-271) assumes that write access to the Supabase production DB is restricted to the backend application server. This ADR investigates and documents the enforcement mechanism.

Three enforcement modes were evaluated:

1. **Network-level** (VPC/SG/firewall): Supabase project configured to only accept connections from the prod server IP.
2. **IAM/RLS**: service_role key scoped; Row Level Security policies block writes from certain roles/contexts.
3. **Convention only**: any holder of `SUPABASE_SERVICE_ROLE_KEY` can write to prod with no technical barrier.

---

## Investigation

### Credential surface — where the key exists

| Location | Key type | Purpose |
|---|---|---|
| `backend/.env.example` | placeholder `your-service-role-key` | Developer bootstrap template |
| `backend/.env` (prod server, not in git) | real key | Runtime — injected via docker-compose env |
| `docker-compose.prod.yml` | env passthrough (`${SUPABASE_SERVICE_ROLE_KEY}`) | Passes host `.env` into container |
| `docker-compose.preprod.yml` | same pattern | Preprod environment |
| `docker-compose.ci-deploy.yml` | same pattern | CI deploy step |
| GitHub Secret: `SUPABASE_SERVICE_ROLE_KEY` | real key | Injected during CI deploy job via `sed -i` into `.env` on prod host |
| CI test matrix | `mock-key-for-ci` (fake) | Unit/integration tests use a mock — ✅ never touches prod DB |

The real key exists in **two places**: the prod host `.env` and the GitHub repository secret.

### Network-level enforcement

Supabase Cloud projects support an **IP allowlist** feature (Settings → Database → Network Restrictions). Initial investigation of the codebase, docker-compose files, and `.spec/` found no evidence of IP allowlist configuration in scripts or documentation.

**Board correction (2026-04-14):** The IP allowlist is already active in the Supabase production project. The initial investigation was a false negative caused by the Architect container lacking dashboard access. ✅ **Confirmed by board.**

**Verdict: ✅ IP allowlist active — Network-level enforcement confirmed.**

### RLS enforcement

`SUPABASE_SERVICE_ROLE_KEY` is the service role key. By design in Supabase, the service role **bypasses all Row Level Security policies**. RLS is not a barrier when using this key.

**Verdict: RLS does not protect against writes using the service_role key.**

### IAM scoping

Supabase does not currently support fine-grained IAM scoping of the service_role key (e.g., read-only service roles). The anon key exists separately but is not used for backend writes.

**Verdict: No IAM enforcement available with current Supabase tier.**

### Conclusion

**Enforcement mode: Network enforcement active (Mode 1).** *(Revised 2026-04-14 after board correction — see Network-level enforcement above.)*

The IP allowlist restricts Supabase production connections to known server IPs, providing a technical barrier beyond convention. Anyone holding the `SUPABASE_SERVICE_ROLE_KEY` who is not originating from an allowlisted IP cannot write to the production database. The credential surface concern documented above (key in GitHub Secrets + prod host `.env`) remains valid and is addressed by H2-H4.

---

## Decision

We **accept the network-enforced model (Mode 1) as the confirmed baseline**. The architecture plan ([AUT-271](/AUT/issues/AUT-271)) may proceed under this enforcement. Remaining hardening tasks are retained as P1 follow-up:

### Hardening recommendations (see §Consequences for ticket)

**H1 — Enable Supabase IP Allowlist** ✅ **DONE** *(confirmed by board 2026-04-14)*  
IP allowlist already active: production server (`49.12.233.2`) and dev server (`46.224.118.55`) are the allowlisted sources. See [AUT-302](/AUT/issues/AUT-302) — H1 closed.

**H2 — GitHub Secret rotation policy (P1)**  
`SUPABASE_SERVICE_ROLE_KEY` in GitHub Secrets should be rotated every 90 days. Rotation procedure: generate new key in Supabase dashboard → update GitHub Secret → trigger prod re-deploy. No downtime required.

**H3 — Audit log alert (P1)**  
Enable Supabase Audit Logs. Set an alert for writes originating from unexpected source IPs (with H1 active, any non-allowlisted write is already blocked at network level).

**H4 — CI: verify mock key is used in tests (P1)**  
The CI pipeline already uses `mock-key-for-ci` — document and gate this (assert that `SUPABASE_URL` in CI points to `mock.supabase.co` and never to `*.supabase.co` with a real project ID).

---

## Consequences

### Positive

- Network enforcement (Mode 1) confirmed active: IP allowlist blocks connections from non-allowlisted sources.
- H1 complete: the single highest-leverage control is already in production.
- CI/CD proof: tests demonstrably use a mock key — no prod data at risk from automated test runs.
- Credential surface is fully documented; remaining H2-H4 controls address the residual risk.

### Negative

- **Residual risk**: a leaked `SUPABASE_SERVICE_ROLE_KEY` used from an allowlisted IP would still reach prod — mitigated by H2 (rotation) and H3 (audit alerts).
- **Hardening debt**: H2-H4 remain open as P1; H3 requires Supabase dashboard access by a human operator.

### Hardening ticket status

> **[AUT-302](/AUT/issues/AUT-302) — Supabase hardening**  
> H1: ✅ **DONE** — IP allowlist confirmed active by board (2026-04-14)  
> H2-H4: Open — Priority **P1** (downgraded from P0 now that H1 is confirmed active)

This ADR is considered `Accepted` with Mode 1 enforcement in place. H2-H4 are P1 and must be completed before Phase 2 of [AUT-271](/AUT/issues/AUT-271) (P2 firewall enforcement) is declared complete.

---

## Artefacts

- This document: `docs/adr/0002-dev-only-db-write-enforcement.md`
- Related: [AUT-271](/AUT/issues/AUT-271), [AUT-273](/AUT/issues/AUT-273) (DB firewall design), [AUT-302](/AUT/issues/AUT-302) (hardening H1-H4)
- Key locations: see §Investigation table above

---

*Revised 2026-04-14 after board correction — initial Mode 3 verdict was a false negative (Architect container lacked Supabase dashboard access). Board confirmed IP allowlist already active. Verdict updated to Mode 1 (Network enforcement active). Task: [AUT-303](/AUT/issues/AUT-303).*
