# ADR-002 — Dev-only DB Write Enforcement

**Status:** Accepted — Hardening ticket opened (see §Consequences)  
**Date:** 2026-04-13  
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

Supabase Cloud projects support an **IP allowlist** feature (Settings → Database → Network Restrictions). Investigation of the codebase, docker-compose files, and `.spec/` reveals **no evidence** of IP allowlist configuration in scripts or documentation.

**Verdict: No verified network-level enforcement.**

### RLS enforcement

`SUPABASE_SERVICE_ROLE_KEY` is the service role key. By design in Supabase, the service role **bypasses all Row Level Security policies**. RLS is not a barrier when using this key.

**Verdict: RLS does not protect against writes using the service_role key.**

### IAM scoping

Supabase does not currently support fine-grained IAM scoping of the service_role key (e.g., read-only service roles). The anon key exists separately but is not used for backend writes.

**Verdict: No IAM enforcement available with current Supabase tier.**

### Conclusion

**Enforcement mode: Convention only (Mode 3).**

The current model relies entirely on the convention that developers do not run code that writes to prod using the service role key outside of the deployed backend application. There is no technical barrier preventing anyone who possesses the key from executing arbitrary writes against the production Supabase database.

---

## Decision

We **accept the current convention-based model as a documented baseline** while simultaneously opening a hardening workstream. The architecture plan (AUT-271) may proceed under this baseline, but the following hardening tasks are opened as P0 follow-up:

### Hardening recommendations (see §Consequences for ticket)

**H1 — Enable Supabase IP Allowlist (P0 Critical)**  
Configure the Supabase production project to only accept connections from the production server IP (`49.12.233.2`) and the dev server IP (`46.224.118.55`). This is the single highest-leverage control.

**H2 — GitHub Secret rotation policy**  
`SUPABASE_SERVICE_ROLE_KEY` in GitHub Secrets should be rotated every 90 days. Rotation procedure: generate new key in Supabase dashboard → update GitHub Secret → trigger prod re-deploy. No downtime required.

**H3 — Audit log alert**  
Enable Supabase Audit Logs. Set an alert for writes originating from unexpected source IPs (future: once H1 is in place, any non-allowlisted write is already blocked).

**H4 — CI: verify mock key is used in tests**  
The CI pipeline already uses `mock-key-for-ci` — document and gate this (assert that `SUPABASE_URL` in CI points to `mock.supabase.co` and never to `*.supabase.co` with a real project ID).

---

## Consequences

### Positive

- Convention documented: all agents and developers now have explicit awareness that write access is not technically enforced.
- Hardening path is clear and prioritized (H1 first).
- CI/CD proof: tests demonstrably use a mock key — no prod data at risk from automated test runs.

### Negative

- **Risk exposure**: until H1 is implemented, any leaked `SUPABASE_SERVICE_ROLE_KEY` allows arbitrary writes to production. This risk pre-existed this ADR; it is now explicit.
- **Hardening debt**: H1 requires Supabase dashboard access by a human operator (not automatable by agents).

### Hardening ticket opened

> **[AUT-282-H1] Activer l'IP allowlist Supabase prod** — Priority: Critical  
> Scope: Supabase dashboard → Settings → Network Restrictions → add `49.12.233.2` (prod) + `46.224.118.55` (dev)  
> Owner: CTO or human operator  
> Unblocks: Full enforcement of "dev-only DB write" assumption in AUT-271

This ADR is considered `Accepted` with the hardening ticket open. If H1 is never implemented, this ADR must be revisited before Phase 2 of AUT-271 (P2 firewall enforcement) is declared complete.

---

## Artefacts

- This document: `docs/adr/0002-dev-only-db-write-enforcement.md`
- Related: [AUT-271](/AUT/issues/AUT-271), [AUT-273](/AUT/issues/AUT-273) (DB firewall design)
- Key locations: see §Investigation table above
