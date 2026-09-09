#!/usr/bin/env tsx
/**
 * Revoked-secrets ratchet — blocking CI gate (incidents SEC-01 / SEC-02).
 *
 * PURPOSE: `.gitleaksignore` already DOCUMENTS a contract ("toute entrée ici DOIT avoir
 * une entrée correspondante avec `revoked_at` et une preuve de rotation dans
 * `audit/baselines/revoked-secrets-baseline.json`, `check-revoked-secrets-ratchet.ts`
 * échoue sinon"). That script did not exist — the contract was prose enforced by nobody
 * for the whole life of the file. This is that script.
 *
 * It carries three duties. The first is the documented contract; the other two close the
 * hole that let a `service_role` JWT sit in cleartext at HEAD of a PUBLIC repo from
 * 2025-11-01 to 2026-09-09 with no gate firing — the per-PR gitleaks job scans
 * INCREMENTALLY, so a secret already on main is invisible to it forever.
 *
 *   R1 — .gitleaksignore ↔ baseline, both directions. Every fingerprint exempted from
 *        gitleaks must have a baseline entry with a non-null `revoked_at` AND a non-empty
 *        `rotation_evidence`; every `revoked[]` entry must still be exempted. An exemption
 *        without proof of revocation is precisely the failure mode this catches.
 *
 *   R2 — ZERO Supabase role JWT in cleartext in any tracked file. Detection decodes the
 *        JWT payload and matches the `role` claim (`service_role` / `anon`) — never a
 *        hardcoded value, so a re-issued key is caught too. Zero-tolerance: no count
 *        baseline, because the debt IS zero as of this PR. Nothing to ratchet down.
 *
 *   R3 — ZERO Supabase management PAT (`sbp_…`) in cleartext in any tracked file.
 *
 * WHY NOT just a gitleaks rule: gitleaks runs incrementally per-PR and is allowlisted by
 * PATH (`.spec/`, `__tests__/`, …) — an allowlist that has already masked a real
 * production secret once (see `_known_detection_gap` in the baseline). This ratchet scans
 * the FULL tracked tree at HEAD on every run and has no path allowlist.
 *
 * NOT a duplicate detector: gitleaks answers "did this PR introduce a secret-shaped
 * string"; this answers "does a Supabase credential exist in the tree right now". The
 * second question is the one nobody was asking.
 *
 * The comparators below are pure — exemptions, baseline and file contents are injected —
 * so `check-revoked-secrets-ratchet.test.ts` is deterministic and does no I/O.
 *
 * Exit codes: 0 = clean · 1 = drift (blocking) · 2 = invariant error (unreadable baseline).
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const BASELINE_PATH = 'audit/baselines/revoked-secrets-baseline.json';
export const IGNORE_PATH = '.gitleaksignore';

/** HS256 header shared by every Supabase legacy key — the cheap `git grep` anchor. */
export const JWT_ANCHOR = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
export const JWT_RE = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
export const PAT_ANCHOR = 'sbp_';
export const PAT_RE = /sbp_[A-Za-z0-9]{20,}/;
export const BANNED_ROLES: ReadonlySet<string> = new Set(['service_role', 'anon']);

export interface RevokedEntry {
  fingerprint?: string;
  revoked_at?: string | null;
  rotation_evidence?: string;
}
export interface PendingEntry {
  value_fingerprint?: string;
  revoked_at?: string | null;
  status?: string;
  evidence?: string;
}
export interface SecretsBaseline {
  revoked?: RevokedEntry[];
  exposed_pending_revocation?: PendingEntry[];
}

/** Decode a JWT's `role` claim. Returns null for anything unparseable. */
export function decodeJwtRole(token: string): string | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const role = (claims as { role?: unknown })?.role;
    return typeof role === 'string' ? role : null;
  } catch {
    return null;
  }
}

/** R1 — the contract documented in `.gitleaksignore`, enforced in both directions. */
export function checkContract(exempted: ReadonlySet<string>, baseline: SecretsBaseline): string[] {
  const out: string[] = [];
  const revoked = baseline.revoked ?? [];
  const byFingerprint = new Map(revoked.map((e) => [e.fingerprint ?? '', e]));

  for (const fingerprint of exempted) {
    const entry = byFingerprint.get(fingerprint);
    if (!entry) {
      out.push(`R1 exemption gitleaks sans entrée de baseline: ${fingerprint}`);
      continue;
    }
    if (!entry.revoked_at) {
      out.push(`R1 exemption d'un secret non révoqué (revoked_at null): ${fingerprint}`);
    }
    if (!entry.rotation_evidence?.trim()) {
      out.push(`R1 entrée de baseline sans rotation_evidence: ${fingerprint}`);
    }
  }
  for (const entry of revoked) {
    const fingerprint = entry.fingerprint ?? '';
    if (!exempted.has(fingerprint)) {
      out.push(`R1 entrée de baseline orpheline (absente de .gitleaksignore): ${fingerprint}`);
    }
  }
  // A pending entry must never claim a revocation it cannot prove.
  for (const entry of baseline.exposed_pending_revocation ?? []) {
    const id = entry.value_fingerprint ?? '<sans fingerprint>';
    if (!entry.evidence?.trim()) {
      out.push(`R1 entrée pending sans evidence: ${id}`);
    }
    if (entry.revoked_at && entry.status === 'ACTIVE') {
      out.push(`R1 entrée pending contradictoire (revoked_at posé mais status ACTIVE): ${id}`);
    }
  }
  return out;
}

/** R2 + R3 — scan already-read file contents for live Supabase credentials. */
export function scanContents(files: ReadonlyMap<string, string>): string[] {
  const out: string[] = [];
  for (const [file, content] of files) {
    for (const match of content.match(JWT_RE) ?? []) {
      const role = decodeJwtRole(match);
      if (role && BANNED_ROLES.has(role)) {
        out.push(`R2 JWT Supabase en clair (role=${role}) dans un fichier suivi: ${file}`);
      }
    }
    if (PAT_RE.test(content)) {
      out.push(`R3 jeton de management Supabase (sbp_) en clair dans un fichier suivi: ${file}`);
    }
  }
  return out;
}

// --------------------------------------------------------------------------- runner

function git(args: string[]): string {
  try {
    return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (err) {
    // `git grep` exits 1 when nothing matches — a clean result, not a failure.
    const e = err as { status?: number; stdout?: string };
    if (e.status === 1) return e.stdout ?? '';
    throw err;
  }
}

/** Tracked, non-binary files (-I) whose content contains `needle`. */
function trackedFilesContaining(needle: string): string[] {
  return git(['grep', '-I', '-l', '--fixed-strings', needle, '--']).split('\n').filter(Boolean);
}

function main(): void {
  const jsonMode = process.argv.includes('--json');

  let baseline: SecretsBaseline;
  try {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as SecretsBaseline;
  } catch (err) {
    console.error(`[invariant] ${BASELINE_PATH} illisible ou JSON invalide: ${String(err)}`);
    process.exit(2);
  }

  const exempted = new Set(
    readFileSync(IGNORE_PATH, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#')),
  );

  const candidates = new Map<string, string>();
  for (const file of [...trackedFilesContaining(JWT_ANCHOR), ...trackedFilesContaining(PAT_ANCHOR)]) {
    if (!candidates.has(file)) candidates.set(file, readFileSync(file, 'utf8'));
  }

  const violations = [...new Set([...checkContract(exempted, baseline), ...scanContents(candidates)])];

  if (jsonMode) {
    console.log(JSON.stringify({ ok: violations.length === 0, violations }, null, 2));
  } else if (violations.length === 0) {
    console.log('✅ revoked-secrets ratchet — aucune dérive');
    console.log(`   R1 ${exempted.size} exemption(s) gitleaks adossée(s) à une preuve de révocation`);
    console.log('   R2 0 JWT Supabase (service_role/anon) en clair dans l’arbre suivi');
    console.log('   R3 0 jeton de management Supabase (sbp_) en clair dans l’arbre suivi');
  } else {
    console.error('❌ revoked-secrets ratchet — dérive détectée\n');
    for (const v of violations) console.error(`   ${v}`);
    console.error(
      '\nAucune valeur de secret ne doit être committée. Retirer le littéral, lire la valeur ' +
        `depuis l’environnement, et consigner l’exposition dans ${BASELINE_PATH}.`,
    );
  }
  process.exit(violations.length === 0 ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
