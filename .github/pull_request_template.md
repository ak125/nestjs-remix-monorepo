## Summary

<!-- What does this PR do? One or two sentences max. -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor (no behavior change)
- [ ] Performance improvement
- [ ] Database migration
- [ ] Spec / manifest update
- [ ] CI / tooling

---

## Spec & Manifest (required by gate)

<!-- Fill both fields. The manifest-check gate validates these. -->
<!-- "N/A" is only valid for docs, CI, and root config changes. -->

**Spec:** `.spec/modules/<module>/manifest.yaml` — _status: [stub|draft|certified]_  
**Manifest covered tables:** `<!-- list tables touched, or N/A -->`

---

## Definition of Done (DoD checklist)

Check all that apply. The Code-Analyst nightly sweep will re-open `done` tasks missing required checks.

### For all PRs

- [ ] Lint passes (`npm run lint`)
- [ ] TypeCheck passes (`npm run typecheck`)
- [ ] Build succeeds (`npm run build`)
- [ ] `manifest-check` gate passes (or violations documented below)
- [ ] No new `owned_tables` conflict (table owned by exactly one module)
- [ ] CODEOWNERS updated if a new module directory was created

### For PRs touching backend modules

- [ ] Module manifest exists at `.spec/modules/<module>/manifest.yaml`
- [ ] All new HTTP routes are listed in the manifest's `http_routes`
- [ ] All new tables written are listed in `owned_tables` (or `read_tables` for reads)
- [ ] New RPC calls are listed in `owned_rpcs`
- [ ] `depends_on` is up to date (new module imports reflected)
- [ ] `change_surface.review_checklist` is up to date

### For PRs touching database (migrations)

- [ ] Data-Ops (0bd1fd16) approval added as reviewer
- [ ] Migration is additive (no DROP without retirement + backup plan)
- [ ] `sql-migration-checklist.md` followed
- [ ] Relevant invariants in `.spec/00-canon/invariants/sql/INV-*.sql` still return 0 rows
- [ ] `invariants_ref` in manifest updated if new invariants apply

### For PRs touching SEO / sitemap

- [ ] IA-SEO Master / CEO (993a4a02) notified via Paperclip comment
- [ ] No unintended `noindex` added to indexed pages
- [ ] Sitemap output verified if routes change
- [ ] `seo_contracts` in manifest updated

### For PRs touching payments

- [ ] `timingSafeEqual` used for all HMAC comparisons (never `===`)
- [ ] `normalizeOrderId()` called before DB lookup in callbacks
- [ ] Test endpoints confirmed not reachable in PROD
- [ ] Error code verified before marking order paid

### For PRs certified module scope (blocking gate)

- [ ] `manifest-check` gate is GREEN (no violations)
- [ ] All invariants in `invariants_ref` pass locally
- [ ] Gate battery listed in `change_surface.gate_battery` is green

---

## Manifest violations (if any)

<!-- If the manifest-check gate reports violations, explain them here. -->
<!-- In ADVISORY mode this is informational. In BLOCKING mode, violations must be fixed. -->

```
# Paste gate output here if violations exist, or write "None"
None
```

---

## Testing

<!-- How was this tested? -->

- [ ] Manual test on DEV (`46.224.118.55`)
- [ ] Unit tests added/updated
- [ ] Integration test verified
- [ ] No test (explain why):

---

## Rollback plan

<!-- How to revert if this breaks PROD? -->

```bash
git revert HEAD && git push origin main
# or: describe specific steps
```

---

## Related

<!-- Link Paperclip tasks and related issues -->

- Paperclip: `AUT-NNN`
- Blocks: 
- Required by:
