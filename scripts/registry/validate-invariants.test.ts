#!/usr/bin/env tsx
/**
 * Tests for the I5 (domain consistency) and I6 (canonical freshness) invariants
 * added to validate-invariants.ts. Both check functions are pure (inputs
 * injected), so these run without filesystem/git access.
 *
 * Run: npm run registry:test:invariants
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  checkDomainConsistency,
  checkCanonicalFresh,
} from "./validate-invariants";

// Minimal shapes — cast to satisfy the imported registry types in tests.
/* eslint-disable @typescript-eslint/no-explicit-any */
const own = (domain: string, glob = "x/**") =>
  ({ glob, domain, owner: "@t", sourceConfidence: "high", risk: "low" } as any);

// ── I5a — domain defined but unmapped → ERROR ───────────────────────────────
test("I5a: domain defined in domains.yaml but no ownership mapping → error", () => {
  const domains = { entries: [{ id: "D1" }, { id: "D9" }] } as any;
  const ownership = { entries: [own("D1")] } as any;
  const findings = checkDomainConsistency(domains, ownership, ["x/a.ts"]);
  const errors = findings.filter((f) => f.severity === "error");
  assert.ok(
    errors.some((f) => f.invariant === "I5a-domain-mapped" && f.message.includes("D9")),
    "expected I5a error naming the unmapped D9"
  );
});

test("I5a: unmapped domain marked expectedEmpty → no error", () => {
  const domains = { entries: [{ id: "D9", expectedEmpty: true }] } as any;
  const ownership = { entries: [] } as any;
  const findings = checkDomainConsistency(domains, ownership, []);
  assert.equal(findings.filter((f) => f.severity === "error").length, 0);
});

// ── I5c — ownership references undefined domain → ERROR ──────────────────────
test("I5c: ownership.yaml references a domain absent from domains.yaml → error", () => {
  const domains = { entries: [{ id: "D1" }] } as any;
  const ownership = { entries: [own("D99")] } as any;
  const findings = checkDomainConsistency(domains, ownership, ["x/a.ts"]);
  assert.ok(
    findings.some((f) => f.invariant === "I5c-domain-defined" && f.severity === "error")
  );
});

// ── I5b — ghost glob in domains.yaml → ERROR (reconciled backlog) ────────────
test("I5b: domains.yaml glob matching 0 files → error", () => {
  const domains = { entries: [{ id: "D1", globs: ["does/not/exist/**"] }] } as any;
  const ownership = { entries: [own("D1")] } as any;
  const findings = checkDomainConsistency(domains, ownership, ["x/a.ts"]);
  assert.ok(
    findings.some(
      (f) => f.invariant === "I5b-domain-glob-resolves" && f.severity === "error"
    )
  );
});

test("I5b: domains.yaml glob that resolves → no I5b finding", () => {
  const domains = { entries: [{ id: "D1", globs: ["x/**"] }] } as any;
  const ownership = { entries: [own("D1")] } as any;
  const findings = checkDomainConsistency(domains, ownership, ["x/a.ts"]);
  assert.equal(
    findings.filter((f) => f.invariant === "I5b-domain-glob-resolves").length,
    0
  );
});

// ── I6 — freshness by fingerprint actually CATCHES drift ─────────────────────
test("I6: a stale input hash → error (proves it is not a no-op)", () => {
  const inputHashes = { "overlay.yaml": "aaaa", "files.json": "bbbb" };
  const resolveHash = (rel: string) => (rel === "overlay.yaml" ? "aaaa" : "DIFFERENT");
  const errors = checkCanonicalFresh(inputHashes, resolveHash).filter(
    (f) => f.severity === "error"
  );
  assert.equal(errors.length, 1);
  assert.ok(errors[0].message.includes("files.json") && errors[0].message.includes("STALE"));
});

test("I6: a declared input that no longer exists → error", () => {
  const findings = checkCanonicalFresh({ "gone.yaml": "x" }, () => null);
  assert.ok(findings.some((f) => f.severity === "error" && f.message.includes("missing")));
});

test("I6: all inputs match → zero findings", () => {
  const findings = checkCanonicalFresh({ a: "h1", b: "h2" }, (rel) => (rel === "a" ? "h1" : "h2"));
  assert.equal(findings.length, 0);
});

test("I6: absent inputHashes → warn (cannot verify)", () => {
  const findings = checkCanonicalFresh(undefined, () => null);
  assert.ok(findings.some((f) => f.invariant === "I6-canonical-fresh" && f.severity === "warn"));
});
