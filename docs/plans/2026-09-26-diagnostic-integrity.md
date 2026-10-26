# Diagnostic integrity implementation plan

Goal: verify the supplied audit against main 4a2871dc and correct the confirmed safety, calculation, and input-conservation defects in one isolated DEV candidate.
Architecture: extend the existing deterministic pipeline and its contracts; preserve the KG shadow role. No new diagnosis engine, public route, database mutation, deployment, or dependency change.
Spec: supplied audit of 26 September 2026; findings A03/A04/A07/A08/B06/C01/D01/D02/D03/D04. Broader preventive and adaptive journeys remain separate work requiring validated operation/applicability and differential rules.

- [x] Reproduce catalogue blocks, missing safety data, unknown signals, arithmetic aggregation, invalid maintenance history, severity order and catalogue mapping with real service tests and mocked I/O.
- [x] Make explicit safety blocks suppress catalogue families and commerce actions. Fail explicitly when safety reads fail or diagnostic coverage is insufficient; preserve already determined safety alerts if optional enrichment fails.
- [x] Average unique symptom contributions once; deterministic evidence/ties and conservative verification merging. Score elapsed mileage rather than the last odometer value.
- [x] Validate maintenance date/mileage consistency. Calculate only against the matching operation record, keeping global service history insufficient for an individual operation. Compare calendar deadlines with month-end clamping; distinguish an unknown axis from a known overdue axis. Remove fictitious next odometer values.
- [x] Preserve entered usage and zero values in actual wizard submission/restoration, with focused frontend tests.
- [x] Use existing canonical URL builder for the action destination and correct brake-fluid mapping using a fresh read-only pieces_gamme lookup.
- [x] Reject invalid KG identity contracts before RPC, keeping existing shadow observability; do not invent slug-to-UUID mappings.
- [x] Run targeted backend/frontend suites, formatting/type/lint checks as applicable. Write revised audit and coverage manifest separating verified code, read-only SQL, tests, and unverified deployed behavior; prepare checkpoint and recoverable patch.

Review focus: critical alerts survive optional dependency failure; operation histories do not reset each other; zero is known data; invalid/future history cannot yield OK; symptom permutations/duplicates do not alter confidence or verification requirements.

Completion evidence: docs/audits/diagnostic-integrity-20260927/AUDIT.md. SQL elapsed-month candidate is separate and not applied. Full preventive/adaptive journeys remain open as explicitly listed.
