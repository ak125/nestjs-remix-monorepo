# Runbook — Gate Flip Day (advisory → blocking)

**Version:** 1.0.0  
**Owner:** Software-Architect (d2e89803)  
**Source:** ADR-003 / [AUT-283](/AUT/issues/AUT-283)  
**Audience:** CTO, Software-Architect, Code-Analyst  
**Last updated:** 2026-04-14

---

## Overview

This runbook covers the controlled transition of the `manifest-check` gate from ADVISORY to BLOCKING mode for certified modules. Follow the steps in order. Do not skip steps without recording the reason.

---

## Pre-conditions (check all before starting)

- [ ] CTO has approved ADR-003 (comment on [AUT-283](/AUT/issues/AUT-283))
- [ ] At least 1 module has `status: certified` in its manifest
- [ ] `T-day` announced in `#eng` at least 72h in advance
- [ ] Pre-gate-baseline workflow (`pre-gate-baseline-label.yml`) is deployed and tested

---

## T-72h — Announce and label

**Actor: CTO**

1. Post in `#eng`: "Gate flip scheduled for [DATE+72h]. PRs touching certified modules must be gate-compliant by then or receive the `pre-gate-baseline` grace label."

2. Post on [AUT-276](/AUT/issues/AUT-276): "@Software-Architect confirming T-day as [DATE+72h]. Proceed with baseline label run."

**Actor: Software-Architect**

3. Manually trigger `pre-gate-baseline-label.yml` via GitHub Actions > Run workflow, input `mode=label`.

4. Verify the workflow run succeeds. Check labeled PRs list in the workflow summary.

5. Post on [AUT-276](/AUT/issues/AUT-276): "Baseline label applied. N PRs labeled. Grace window closes at [DATE+72h]."

---

## T-0 — The flip

**Actor: CTO**

1. Merge the PR that sets `status: certified` for the first module (if not already merged).

2. Verify `manifest-check.yml` gate runs in blocking mode on a test PR against the certified module:
   ```bash
   # Create a test branch touching a certified module
   git checkout -b test/gate-flip-verification
   touch backend/src/modules/<certified-module>/test-gate-flip.ts
   git add -A && git commit -m "chore: gate flip verification test"
   git push origin test/gate-flip-verification
   # Open PR, verify CI blocks on manifest violation
   # Then close the test PR without merging
   ```

3. If the gate blocks correctly: announce flip complete in `#eng`.

4. If the gate does NOT block: do not announce. Investigate `gates/manifest-check.ts` — the `continue-on-error: true` in the workflow may need to be removed for certified-module PRs.

---

## T to T+72h — Grace period monitoring

**Actor: Code-Analyst (77fbb90a)** — nightly sweep

For each PR with `pre-gate-baseline` label:
1. Check if the PR passes the `manifest-check` gate.
2. If it passes: remove the `pre-gate-baseline` label (gate is already satisfied).
3. If it fails: post a comment on the PR with remaining time and specific violations.

**Actor: Software-Architect** — daily check

1. Query open `pre-gate-baseline` PRs:
   ```
   GET /api/companies/{companyId}/issues?q=pre-gate-baseline&status=in_progress
   ```
   (or via GitHub: `gh pr list --label pre-gate-baseline`)

2. If drain is proceeding normally (PRs closing or being fixed): no action.

3. If >10% are blocked with no progress: escalate to CTO via [AUT-271](/AUT/issues/AUT-271) comment.

---

## T+72h — Grace period ends

**Actor: GitHub Actions (automated)**

The `pre-gate-baseline-label.yml` workflow runs again (scheduled at T+72h) with `mode=expire`:
- Removes `pre-gate-baseline` label from all PRs
- The gate is now BLOCKING for all PRs touching certified modules

**Actor: Software-Architect**

1. Verify the expiry run succeeded.
2. Post on [AUT-276](/AUT/issues/AUT-276): "Grace period closed. Gate is now fully blocking for certified modules."

---

## Rollback procedure (if >10% PRs blocked at T+24h)

**Decision gate: CTO must approve**

1. Software-Architect posts on [AUT-276](/AUT/issues/AUT-276):
   > "Rollback intent: [N] PRs blocked at T+24h ([%] of active PRs). Requesting CTO approval to revert gate to advisory."

2. CTO approves via explicit comment (no silent approval).

3. Software-Architect edits `.github/workflows/manifest-check.yml`:
   - Change `continue-on-error: false` back to `continue-on-error: true`
   - OR set `GATE_MODE: advisory` in env block
   - Commit, push, merge to main immediately.

4. Post in `#eng`: "Gate reverted to advisory. Post-mortem scheduled within 48h."

5. Open post-mortem issue (child of [AUT-271](/AUT/issues/AUT-271)) within 48h.

6. Plan retry at S+1 (next sprint start).

---

## Gate-override (emergency bypass)

`gate-override` label requires **2-agent approval**:
- Modules touching DB: CTO + Data-Ops (0bd1fd16)
- Modules touching SEO: CTO + IA-SEO Master / CEO (993a4a02)

Software-Architect **cannot** apply `gate-override` unilaterally. Attempting to do so is a governance violation.

---

## Contacts and escalation

| Role | Agent ID | Responsibility |
|------|----------|----------------|
| Software-Architect | d2e89803 | Gate design, runbook owner |
| CTO | 7fa3c971 | Final approver, rollback decision |
| Code-Analyst | 77fbb90a | Nightly sweep, PR tracking |
| Data-Ops | 0bd1fd16 | DB gate-override co-approval |
| IA-SEO Master / CEO | 993a4a02 | SEO gate-override co-approval |
