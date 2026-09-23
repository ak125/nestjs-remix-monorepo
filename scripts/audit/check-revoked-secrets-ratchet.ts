#!/usr/bin/env tsx
/**
 * Revoked-secrets ratchet — HEAD-state gate for secret literals in tracked files.
 *
 * WHY THIS EXISTS (and why it is NOT a second gitleaks).
 * ------------------------------------------------------
 * `.gitleaksignore` has documented this script as its enforcement arm since
 * 2026-08-13 ("toute entrée ici DOIT avoir une entrée correspondante avec
 * `revoked_at` … `check-revoked-secrets-ratchet.ts` échoue sinon") — but the
 * script was never written. The contract was prose only.
 *
 * The second gap is structural. The blocking CI job `🔐 Secrets Detection`
 * (ci.yml) runs `gitleaks-action` in INCREMENTAL mode: it scans the commits a
 * PR adds, not the state of HEAD. A secret committed before the gate existed
 * therefore stays at HEAD forever without a single red run. Measured on
 * 2026-09-09: `gitleaks dir .` reported the Supabase legacy `service_role` JWT
 * in 8 tracked files (rule `jwt`) that no PR had ever been blocked on.
 *
 * So the responsibilities split cleanly, with no duplicated source of truth:
 *   • gitleaks (incremental, ci.yml) → a NEW secret entering through a PR diff.
 *   • this ratchet (HEAD state)      → a KNOWN-REVOKED secret, or a Supabase
 *                                      legacy/management token of any value,
 *                                      still present in (or returning to) the
 *                                      tracked tree.
 *
 * DETECTION IS BY SHAPE AND BY FINGERPRINT — never by value. No secret value is
 * stored in this repo: `audit/baselines/revoked-secrets-baseline.json` records
 * only SHA-256(value) truncated to 12 hex chars. A value allowlist is the exact
 * anti-pattern `.gitleaksignore` was created to kill (it matched everywhere and
 * forever, and hid a real production key for six months).
 *
 * Exit codes: 0 = clean · 1 = violation (blocking) · 2 = invariant error.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  readFileSync,
  existsSync,
  openSync,
  fstatSync,
  readSync,
  closeSync,
} from "node:fs";
import { join } from "node:path";

const REPO_ROOT = process.cwd();
const BASELINE_PATH = join(
  REPO_ROOT,
  "audit/baselines/revoked-secrets-baseline.json",
);
const GITLEAKSIGNORE_PATH = join(REPO_ROOT, ".gitleaksignore");

/** Files whose job is to describe the guard, or to hold synthetic fixtures. */
const EXEMPT_PATH_PATTERNS = [
  /(^|\/)__fixtures__\//,
  /(^|\/)__tests__\//,
  /^\.gitleaksignore$/,
  /^audit\/baselines\/revoked-secrets-baseline\.json$/,
  /^scripts\/audit\/check-revoked-secrets-ratchet(\.test)?\.ts$/,
];

const MAX_FILE_BYTES = 2 * 1024 * 1024;

// ── types ─────────────────────────────────────────────────────────────────────

export interface RevokedEntry {
  fingerprint: string;
  revoked_at: string | null;
  rotation_evidence?: string;
}

export interface RevokedValueFingerprint {
  sha256_12: string;
  secret_type: string;
  revoked_at: string | null;
}

/**
 * A secret whose literal must never appear at HEAD, whether or not its
 * revocation is established. `revoked_at: null` is a legitimate state here —
 * purging the repository and rotating the credential are different acts, and
 * conflating them is how a "cleaned" repo comes to be read as a safe one.
 */
export interface KnownSecretFingerprint {
  sha256_12: string;
  secret_type: string;
  /** Exact character count of the value — the index that makes the scan cheap. */
  length: number;
  revoked_at: string | null;
}

export interface Baseline {
  schemaVersion: string;
  revoked: RevokedEntry[];
  revoked_value_fingerprints?: RevokedValueFingerprint[];
  known_secret_fingerprints?: KnownSecretFingerprint[];
}

/**
 * Shape rules know no value. They match a FORM, so they catch a credential that
 * does not exist yet — which is the whole point: after a rotation, the new key
 * pasted into a tracked file is caught on the first commit, with no baseline
 * update. They are evaluated on ADDED LINES only — never on HEAD state — so they
 * need no inventory of what the tree already carries, and therefore publish
 * nothing about it.
 */
export type ShapeRule =
  | "payment-hmac-hex128-literal"
  | "payment-certificate-literal";

export type Rule =
  | "supabase-legacy-jwt"
  | "supabase-management-token"
  | "revoked-secret-reintroduced"
  | "known-secret-literal"
  | ShapeRule;

export interface Finding {
  file: string;
  line: number;
  rule: Rule;
  /** SHA-256(value)[0..12) — safe to print, never reversible. */
  fp: string;
  detail: string;
}

// ── pure helpers (unit-tested) ────────────────────────────────────────────────

export function fingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 12);
}

const JWT_RE = /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;
const SBP_RE = /sbp_[A-Za-z0-9]{20,}/g;

/**
 * Candidate literals for the fingerprint pass. The 12-character floor is a
 * measured decision, not a guess: `PAYBOX_RANG` is 3 digits and matching it
 * across the tree returned 826 hits, `PAYBOX_SITE` (7) returned 40 — all noise.
 * Merchant identifiers are also transmitted in the client-side payment form, so
 * they are not secrets to begin with. Below 12 characters a value carries too
 * little entropy to be a credential AND too much ambiguity to be matched.
 */
const CANDIDATE_RE = /[A-Za-z0-9_-]{12,}/g;

/** fingerprints indexed by value length — only same-length tokens get hashed. */
export type LengthIndex = ReadonlyMap<
  number,
  ReadonlyMap<string, KnownSecretFingerprint>
>;

export function buildLengthIndex(
  entries: readonly KnownSecretFingerprint[],
): LengthIndex {
  const idx = new Map<number, Map<string, KnownSecretFingerprint>>();
  for (const e of entries) {
    if (!e.length || !e.sha256_12) continue;
    let bucket = idx.get(e.length);
    if (!bucket) idx.set(e.length, (bucket = new Map()));
    bucket.set(e.sha256_12, e);
  }
  return idx;
}

/**
 * Decode a JWT payload. Returns null when the middle segment is not JSON —
 * a base64-looking string that does not decode is not a Supabase key.
 */
export function jwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

/** A Supabase-issued anon/service_role key: `iss: supabase` + a privileged role. */
export function isSupabaseLegacyKey(token: string): boolean {
  const p = jwtPayload(token);
  if (!p) return false;
  return (
    p.iss === "supabase" &&
    (p.role === "service_role" || p.role === "anon")
  );
}

export function scanContent(
  file: string,
  content: string,
  revokedFps: ReadonlySet<string> = new Set(),
  lengthIndex: LengthIndex = new Map(),
): Finding[] {
  const out: Finding[] = [];
  content.split("\n").forEach((line, i) => {
    const lineNo = i + 1;
    for (const m of line.matchAll(JWT_RE)) {
      const tok = m[0];
      const fp = fingerprint(tok);
      if (isSupabaseLegacyKey(tok)) {
        const role = String(jwtPayload(tok)?.role);
        out.push({
          file,
          line: lineNo,
          rule: "supabase-legacy-jwt",
          fp,
          detail: `JWT Supabase legacy (role=${role}) en clair`,
        });
      } else if (revokedFps.has(fp)) {
        out.push({
          file,
          line: lineNo,
          rule: "revoked-secret-reintroduced",
          fp,
          detail: "secret révoqué réintroduit (empreinte connue)",
        });
      }
    }
    for (const m of line.matchAll(SBP_RE)) {
      const fp = fingerprint(m[0]);
      out.push({
        file,
        line: lineNo,
        rule: "supabase-management-token",
        fp,
        detail: "personal access token Supabase (sbp_) en clair",
      });
    }
    // Fingerprint pass — catches credentials that have no recognisable shape
    // (a 128-hex HMAC key, a 16-digit certificate). Hashing is gated on an
    // exact length match, so a clean tree costs one length lookup per token.
    if (lengthIndex.size) {
      for (const m of line.matchAll(CANDIDATE_RE)) {
        const tok = m[0];
        const bucket = lengthIndex.get(tok.length);
        if (!bucket) continue;
        const fp = fingerprint(tok);
        const hit = bucket.get(fp);
        if (!hit) continue;
        out.push({
          file,
          line: lineNo,
          rule: hit.revoked_at
            ? "revoked-secret-reintroduced"
            : "known-secret-literal",
          fp,
          detail: `${hit.secret_type} en clair`,
        });
      }
    }
  });
  return out;
}

/**
 * A Paybox HMAC key is 128 hex characters — a form specific enough to match on
 * its own: measured over the tracked tree, this rule produces no false positive.
 * The lookarounds reject a 128-hex run that is part of a longer hex string (a
 * SHA-512 digest pair, a lock-file integrity field).
 */
const HMAC_HEX128_RE = /(?<![0-9A-Fa-f])[0-9A-Fa-f]{128}(?![0-9A-Fa-f])/g;

/**
 * A SystemPay/Lyra certificate is 16 decimal digits — a form far too common to
 * match on its own. Measured: the bare 16-digit form hits 143 lines in 23 files
 * (`PageContractR6.json` alone accounts for 86). So the rule is ANCHORED on the
 * variable name, within 40 non-digit characters.
 *
 * The anchor is the PREFIX `SYSTEMPAY_CERT[A-Z_]*`, not the full
 * `SYSTEMPAY_CERTIFICATE`: both the full and the abbreviated spellings of the
 * variable are in use, and the narrow form silently misses the abbreviated one.
 * Broadening the prefix adds no false positive, measured over the same tree.
 */
const PAYMENT_CERT_RE =
  /(?:SYSTEMPAY_CERT[A-Z_]*|CYBERPLUS_CERTIFICAT[A-Z_]*)[^0-9]{0,40}([0-9]{16})(?![0-9])/g;

/**
 * Shape pass — deliberately NOT part of `scanContent`.
 *
 * Keeping it separate from `scanContent` is a safety property, not a style
 * choice. The two passes answer different questions and run at different times:
 * `scanContent` audits the STATE of HEAD, `scanShapes` audits what a commit ADDS.
 * Fusing them would make the shape rules fire on the 26 literals the tree already
 * carries, and the only way back to green would be an inventory of those literals
 * in a tracked baseline — on a public repository, before rotation, that inventory
 * is a map to the secrets. Separation is what makes it unnecessary.
 */
export function scanShapes(file: string, content: string): Finding[] {
  const out: Finding[] = [];
  content.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(HMAC_HEX128_RE)) {
      out.push({
        file,
        line: i + 1,
        rule: "payment-hmac-hex128-literal",
        fp: fingerprint(m[0]),
        detail: "clé HMAC de paiement (128 hex) en clair",
      });
    }
    for (const m of line.matchAll(PAYMENT_CERT_RE)) {
      out.push({
        file,
        line: i + 1,
        rule: "payment-certificate-literal",
        fp: fingerprint(m[1]),
        detail: "certificat de paiement (16 chiffres) en clair",
      });
    }
  });
  return out;
}

/**
 * Parse a unified diff and return only the lines it ADDS, with their line number
 * in the new file. `-U0` keeps the hunks minimal.
 *
 * Auditing what a commit ADDS, rather than what the tree HOLDS, is what lets the
 * shape rules ship before the purge: pre-existing literals are simply not in the
 * input, so there is nothing to tolerate and no inventory to publish.
 */
export function addedLines(
  diff: string,
): { file: string; line: number; text: string }[] {
  const out: { file: string; line: number; text: string }[] = [];
  let file = "";
  let next = 0;
  for (const raw of diff.split("\n")) {
    if (raw.startsWith("+++ ")) {
      const p = raw.slice(4).trim();
      file = p === "/dev/null" ? "" : p.replace(/^b\//, "");
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) {
      next = Number(hunk[1]);
      continue;
    }
    if (!file) continue;
    if (raw.startsWith("+")) out.push({ file, line: next++, text: raw.slice(1) });
    else if (!raw.startsWith("-") && !raw.startsWith("\\")) next++;
  }
  return out;
}

/** Shape findings over the added lines of a diff. */
export function scanAddedLines(
  added: readonly { file: string; line: number; text: string }[],
): Finding[] {
  const out: Finding[] = [];
  for (const a of added) {
    if (isExempt(a.file)) continue;
    for (const f of scanShapes(a.file, a.text)) out.push({ ...f, line: a.line });
  }
  return out;
}

export function isExempt(file: string): boolean {
  return EXEMPT_PATH_PATTERNS.some((re) => re.test(file));
}

/**
 * The contract `.gitleaksignore` states in prose: every fingerprint excepted
 * there must be justified by a baseline entry carrying `revoked_at` and a
 * `rotation_evidence`. Returns the fingerprints that break it.
 */
export function checkIgnoreContract(
  ignoreLines: readonly string[],
  baseline: Baseline,
): string[] {
  const known = new Map(baseline.revoked.map((r) => [r.fingerprint, r]));
  const violations: string[] = [];
  for (const raw of ignoreLines) {
    const fpLine = raw.trim();
    if (!fpLine || fpLine.startsWith("#")) continue;
    const entry = known.get(fpLine);
    if (!entry) {
      violations.push(`${fpLine} — absent de la baseline`);
      continue;
    }
    if (!entry.revoked_at) {
      violations.push(`${fpLine} — revoked_at nul`);
    }
    if (!entry.rotation_evidence) {
      violations.push(`${fpLine} — rotation_evidence absente`);
    }
  }
  return violations;
}

// ── runner ────────────────────────────────────────────────────────────────────

function trackedFiles(): string[] {
  return execFileSync("git", ["ls-files", "-z"], {
    cwd: REPO_ROOT,
    maxBuffer: 64 * 1024 * 1024,
  })
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
}

/**
 * Added-lines mode. `--staged` guards the commit that is about to be written;
 * `--diff <base> <head>` guards a PR range in CI.
 *
 * On a PUBLIC repository this is the mode that actually protects: CI blocks the
 * MERGE, but the PUSH has already published the value, and nothing un-publishes
 * it. A pre-commit hook is the last point where a secret can still be stopped.
 */
function diffMode(argv: readonly string[]): never {
  const staged = argv.includes("--staged");
  const i = argv.indexOf("--diff");
  const args = staged
    ? ["diff", "--cached", "-U0", "--no-color"]
    : ["diff", "-U0", "--no-color", `${argv[i + 1]}...${argv[i + 2]}`];
  const diff = execFileSync("git", args, {
    cwd: REPO_ROOT,
    maxBuffer: 64 * 1024 * 1024,
  }).toString("utf8");
  const findings = scanAddedLines(addedLines(diff));
  if (!findings.length) {
    console.log(
      `\u2713 secrets (lignes ajout\u00e9es) : 0 litt\u00e9ral de forme connue`,
    );
    process.exit(0);
  }
  console.error(
    `\u2716 ${findings.length} litt\u00e9ral(aux) de secret dans les lignes AJOUT\u00c9ES :`,
  );
  for (const f of findings) {
    console.error(`  - ${f.file}:${f.line}  [${f.rule}] fp=${f.fp} — ${f.detail}`);
  }
  console.error(
    "\n  Sur un d\u00e9p\u00f4t public, un push est d\u00e9finitif : la CI bloque le merge,\n" +
      "  elle ne d\u00e9-publie rien. Remplacer par une lecture d'environnement\n" +
      "  (process.env.…), sans valeur par d\u00e9faut, AVANT de commiter.",
  );
  process.exit(1);
}

function main(): void {
  if (
    process.argv.includes("--staged") ||
    process.argv.includes("--diff")
  ) {
    diffMode(process.argv);
  }
  if (!existsSync(BASELINE_PATH)) {
    console.error(`✖ baseline introuvable : ${BASELINE_PATH}`);
    process.exit(2);
  }
  const baseline: Baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  const revokedFps = new Set(
    (baseline.revoked_value_fingerprints ?? []).map((r) => r.sha256_12),
  );
  // Both arrays feed the fingerprint pass: a revoked secret must not come back,
  // and a secret whose rotation is still unknown must not come back either.
  const lengthIndex = buildLengthIndex([
    ...(baseline.known_secret_fingerprints ?? []),
    ...(baseline.revoked_value_fingerprints ?? []).filter(
      (r): r is RevokedValueFingerprint & { length: number } =>
        typeof (r as { length?: number }).length === "number",
    ),
  ]);

  const contractViolations = existsSync(GITLEAKSIGNORE_PATH)
    ? checkIgnoreContract(
        readFileSync(GITLEAKSIGNORE_PATH, "utf8").split("\n"),
        baseline,
      )
    : [];

  const findings: Finding[] = [];
  for (const file of trackedFiles()) {
    if (isExempt(file)) continue;
    const abs = join(REPO_ROOT, file);
    // Ouvrir PUIS interroger le descripteur : un statSync suivi d'un readFileSync
    // sur le chemin est un check-then-use (CodeQL js/file-system-race) — le chemin
    // peut changer entre les deux. Ici les deux opérations portent sur le MÊME fd.
    let fd: number;
    try {
      fd = openSync(abs, "r");
    } catch {
      continue; // sous-module, lien symbolique cassé, fichier disparu
    }
    try {
      const st = fstatSync(fd);
      if (!st.isFile() || st.size > MAX_FILE_BYTES) continue;
      const buf = Buffer.allocUnsafe(st.size);
      readSync(fd, buf, 0, st.size, 0);
      if (buf.includes(0)) continue; // binaire
      findings.push(
        ...scanContent(file, buf.toString("utf8"), revokedFps, lengthIndex),
      );
    } finally {
      closeSync(fd);
    }
  }

  if (process.argv.includes("--json")) {
    console.log(
      JSON.stringify({ findings, contractViolations }, null, 2),
    );
  }

  if (contractViolations.length) {
    console.error("✖ contrat .gitleaksignore ↔ baseline rompu :");
    for (const v of contractViolations) console.error(`  - ${v}`);
  }
  if (findings.length) {
    console.error(
      `✖ ${findings.length} littéral(aux) de secret dans les fichiers suivis :`,
    );
    for (const f of findings) {
      console.error(`  - ${f.file}:${f.line}  [${f.rule}] fp=${f.fp} — ${f.detail}`);
    }
    console.error(
      "\n  Remplacer par une lecture d'environnement (process.env.…), sans valeur\n" +
        "  par défaut. Si le secret est révoqué, ajouter son empreinte à\n" +
        "  audit/baselines/revoked-secrets-baseline.json — jamais sa valeur.",
    );
  }
  if (contractViolations.length || findings.length) process.exit(1);

  console.log(
    `✓ revoked-secrets ratchet : 0 littéral sur ${trackedFiles().length} fichiers suivis, ` +
      `contrat .gitleaksignore respecté`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) main();
