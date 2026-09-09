import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fingerprint,
  isSupabaseLegacyKey,
  jwtPayload,
  scanContent,
  isExempt,
  checkIgnoreContract,
  type Baseline,
} from "./check-revoked-secrets-ratchet.ts";

/**
 * Synthetic tokens built at runtime. NOTHING here is a real credential: the
 * signature segment is the literal string "not-a-real-signature" and no private
 * key was ever involved. Built in code rather than committed as a fixture so
 * the repo never carries a Supabase-shaped literal at all.
 */
function synthJwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.not-a-real-signature`;
}

const SYNTH_SERVICE_ROLE = synthJwt({
  iss: "supabase",
  ref: "examplerefexampleref",
  role: "service_role",
  iat: 1,
  exp: 2,
});
const SYNTH_ANON = synthJwt({
  iss: "supabase",
  ref: "examplerefexampleref",
  role: "anon",
  iat: 1,
  exp: 2,
});
const SYNTH_FOREIGN_JWT = synthJwt({
  iss: "https://accounts.google.com",
  sub: "1234",
  role: "user",
});
const SYNTH_SBP = `sbp_${"0123456789abcdef0123456789abcdef01234567"}`;

// ── fingerprint: stable, truncated, never the value ───────────────────────────
test("fingerprint is a stable 12-hex SHA-256 prefix", () => {
  const fp = fingerprint("hello");
  assert.match(fp, /^[0-9a-f]{12}$/);
  assert.equal(fp, fingerprint("hello"));
  assert.notEqual(fp, fingerprint("hello!"));
});

// ── shape recognition ─────────────────────────────────────────────────────────
test("jwtPayload decodes a JWT body, returns null on garbage", () => {
  assert.equal(jwtPayload(SYNTH_ANON)?.role, "anon");
  assert.equal(jwtPayload("eyJnot.a.jwt"), null);
});

test("isSupabaseLegacyKey: true for supabase anon/service_role only", () => {
  assert.equal(isSupabaseLegacyKey(SYNTH_SERVICE_ROLE), true);
  assert.equal(isSupabaseLegacyKey(SYNTH_ANON), true);
  assert.equal(isSupabaseLegacyKey(SYNTH_FOREIGN_JWT), false);
});

// ── TEST NÉGATIF RÉEL : la garde doit CASSER sur une réintroduction ───────────
test("NEGATIVE: a Supabase service_role JWT literal is flagged", () => {
  const found = scanContent(
    "backend/scripts/whatever.js",
    `const KEY = '${SYNTH_SERVICE_ROLE}';\n`,
  );
  assert.equal(found.length, 1);
  assert.equal(found[0].rule, "supabase-legacy-jwt");
  assert.equal(found[0].line, 1);
  assert.match(found[0].detail, /role=service_role/);
  // the report carries the fingerprint, never the token
  assert.ok(!JSON.stringify(found).includes(SYNTH_SERVICE_ROLE));
});

test("NEGATIVE: an anon legacy JWT is flagged too", () => {
  const found = scanContent("backend/.env.test.template", `K="${SYNTH_ANON}"`);
  assert.equal(found.length, 1);
  assert.match(found[0].detail, /role=anon/);
});

test("NEGATIVE: an sbp_ management token literal is flagged", () => {
  const found = scanContent("backend/deploy.sh", `TOKEN="${SYNTH_SBP}"\n`);
  assert.equal(found.length, 1);
  assert.equal(found[0].rule, "supabase-management-token");
});

test("NEGATIVE: a revoked value returning under any shape is flagged by fingerprint", () => {
  const revoked = new Set([fingerprint(SYNTH_FOREIGN_JWT)]);
  const found = scanContent("a.ts", `const t = '${SYNTH_FOREIGN_JWT}';`, revoked);
  assert.equal(found.length, 1);
  assert.equal(found[0].rule, "revoked-secret-reintroduced");
});

test("multi-line: line numbers are reported exactly", () => {
  const found = scanContent(
    "x.js",
    `// header\n// more\nconst K = '${SYNTH_SERVICE_ROLE}';\n`,
  );
  assert.equal(found[0].line, 3);
});

// ── NE DOIT PAS bloquer : placeholders, noms de variables, JWT tiers ──────────
test("does NOT flag placeholders and variable names", () => {
  const benign = [
    'SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"',
    "const K = process.env.SUPABASE_SERVICE_ROLE_KEY;",
    "SUPABASE_ACCESS_TOKEN requis (format sbp_...)",
    "empreinte SHA-256 : b7721bff0da8",
  ].join("\n");
  assert.deepEqual(scanContent("doc.md", benign), []);
});

test("does NOT flag a third-party JWT (not a Supabase anon/service_role key)", () => {
  assert.deepEqual(scanContent("a.ts", `const g = '${SYNTH_FOREIGN_JWT}';`), []);
});

test("does NOT flag a short sbp_-looking string", () => {
  assert.deepEqual(scanContent("a.sh", 'X="sbp_short"'), []);
});

// ── exemptions : chemins, jamais valeurs ──────────────────────────────────────
test("exemptions are path-scoped (fixtures/tests/self), never value-scoped", () => {
  assert.equal(isExempt("scripts/audit/__fixtures__/leaky.json"), true);
  assert.equal(isExempt("backend/src/__tests__/a.spec.ts"), true);
  assert.equal(isExempt(".gitleaksignore"), true);
  assert.equal(
    isExempt("audit/baselines/revoked-secrets-baseline.json"),
    true,
  );
  assert.equal(isExempt("scripts/audit/check-revoked-secrets-ratchet.ts"), true);
  assert.equal(isExempt("backend/scripts/list-all-tables.js"), false);
  assert.equal(isExempt("backend/.env.test.template"), false);
});

// ── contrat .gitleaksignore ↔ baseline ────────────────────────────────────────
const BASE: Baseline = {
  schemaVersion: "1.1.0",
  revoked: [
    {
      fingerprint: "abc:file.md:generic-api-key:21",
      revoked_at: "2026-08-13",
      rotation_evidence: "ancienne clé → 401",
    },
    { fingerprint: "def:other.md:jwt:4", revoked_at: null },
  ],
};

test("ignore-contract: a justified fingerprint passes", () => {
  assert.deepEqual(
    checkIgnoreContract(["# comment", "", "abc:file.md:generic-api-key:21"], BASE),
    [],
  );
});

test("ignore-contract: FAIL when the fingerprint is absent from the baseline", () => {
  const v = checkIgnoreContract(["zzz:unknown.md:jwt:1"], BASE);
  assert.equal(v.length, 1);
  assert.match(v[0], /absent de la baseline/);
});

test("ignore-contract: FAIL when revoked_at is null or evidence missing", () => {
  const v = checkIgnoreContract(["def:other.md:jwt:4"], BASE);
  assert.equal(v.length, 2);
  assert.ok(v.some((x) => /revoked_at nul/.test(x)));
  assert.ok(v.some((x) => /rotation_evidence absente/.test(x)));
});
