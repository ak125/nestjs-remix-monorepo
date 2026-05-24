#!/usr/bin/env tsx
/**
 * scripts/registry/validate-automation-overlay.ts
 *
 * Dedicated CLI validator for the Layer 2 automation reality overlay
 * `.spec/00-canon/repository-registry/automation-reality.yaml`.
 *
 * Intentionally SEPARATE from `validate-overlay.ts` (which has a
 * `coverage ≥80% glob` invariant specific to ownership/domain overlays
 * — does not apply semantically to automation-reality).
 *
 * Validation steps :
 *   1. YAML parses cleanly
 *   2. Validates against AutomationRealitySchema (Zod)
 *   3. Each `evidence[].path` exists in git tree (anti-stale-reference)
 *   4. Each `evidence[]` with `line:` has `excerpt:` substring at that line
 *      (anti-silent-drift after file edits)
 *   5. last_verified_by = "seed:*" only allowed when last_verified_method
 *      = "seed-from-plan-review" AND only during V1 initial seed (warn after merge)
 *
 * Exit codes :
 *   0  : all validations PASS
 *   1  : Zod / YAML / evidence-path / excerpt-drift / seed-method failure
 *   2  : internal error (file missing, etc.)
 *
 * Usage:
 *   tsx scripts/registry/validate-automation-overlay.ts [--quiet]
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import yaml from "js-yaml";
import { AutomationRealitySchema } from "../../packages/registry/src/index";

const MONOREPO_ROOT = path.resolve(__dirname, "..", "..");
const OVERLAY_PATH = path.join(
  MONOREPO_ROOT,
  ".spec",
  "00-canon",
  "repository-registry",
  "automation-reality.yaml",
);
const QUIET = process.argv.includes("--quiet");

type Finding = {
  level: "error" | "warn";
  entry: string;
  message: string;
};

function log(msg: string): void {
  if (!QUIET) process.stderr.write(`[validate-automation-overlay] ${msg}\n`);
}

function loadGitFiles(): Set<string> {
  try {
    const out = execSync("git ls-files", { encoding: "utf8", cwd: MONOREPO_ROOT });
    return new Set(out.split("\n").filter(Boolean));
  } catch {
    return new Set();
  }
}

function checkLineExcerpt(
  filePath: string,
  line: number,
  excerpt: string,
): { ok: boolean; reason?: string } {
  const abs = path.join(MONOREPO_ROOT, filePath);
  if (!fs.existsSync(abs)) {
    return { ok: false, reason: `file missing: ${filePath}` };
  }
  let content: string;
  try {
    content = fs.readFileSync(abs, "utf8");
  } catch (err) {
    return {
      ok: false,
      reason: `read failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  const lines = content.split("\n");
  if (line < 1 || line > lines.length) {
    return {
      ok: false,
      reason: `line ${line} out of range (file has ${lines.length} lines)`,
    };
  }
  // ±2 lines tolerance — small edits don't break the reference, but big drift does
  const window = lines.slice(Math.max(0, line - 3), Math.min(lines.length, line + 2));
  if (window.some((l) => l.includes(excerpt))) {
    return { ok: true };
  }
  return {
    ok: false,
    reason: `excerpt "${excerpt}" not found at ${filePath}:${line} (±2 lines window) — silent drift`,
  };
}

export function validate(): 0 | 1 {
  const findings: Finding[] = [];

  if (!fs.existsSync(OVERLAY_PATH)) {
    process.stderr.write(
      `[validate-automation-overlay] FAIL: overlay missing at ${OVERLAY_PATH}\n`,
    );
    return 1;
  }

  // 1. Parse YAML
  let raw: unknown;
  try {
    raw = yaml.load(fs.readFileSync(OVERLAY_PATH, "utf8"));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `[validate-automation-overlay] FAIL: YAML parse error — ${message}\n`,
    );
    return 1;
  }

  // 2. Zod validate
  const parsed = AutomationRealitySchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.errors) {
      findings.push({
        level: "error",
        entry: issue.path.join("."),
        message: `Zod: ${issue.message}`,
      });
    }
    // Without successful parse, skip path/excerpt checks
    emitFindings(findings);
    return 1;
  }

  const { entries } = parsed.data;
  log(`parsed ${entries.length} entries`);

  // 3. Evidence path existence
  const gitFiles = loadGitFiles();
  if (gitFiles.size === 0) {
    findings.push({
      level: "warn",
      entry: "*",
      message: "git ls-files returned empty — skipping path existence check",
    });
  }

  for (const entry of entries) {
    for (const [idx, ev] of entry.evidence.entries()) {
      if (gitFiles.size > 0 && !gitFiles.has(ev.path)) {
        findings.push({
          level: "error",
          entry: entry.automation_id,
          message: `evidence[${idx}].path "${ev.path}" not in git tree`,
        });
      }
      // 4. line/excerpt drift check
      if (ev.line !== undefined && ev.excerpt !== undefined) {
        const r = checkLineExcerpt(ev.path, ev.line, ev.excerpt);
        if (!r.ok) {
          findings.push({
            level: "error",
            entry: entry.automation_id,
            message: `evidence[${idx}] ${r.reason}`,
          });
        }
      }
    }

    // 5. seed-from-plan-review consistency
    const isSeedBy = entry.last_verified_by.startsWith("seed:");
    const isSeedMethod = entry.last_verified_method === "seed-from-plan-review";
    if (isSeedBy !== isSeedMethod) {
      findings.push({
        level: "error",
        entry: entry.automation_id,
        message: `inconsistent seed marker : last_verified_by="${entry.last_verified_by}" but last_verified_method="${entry.last_verified_method}"`,
      });
    }
  }

  // 6. Cap check — defense against governance gravity (≤30 entries soft cap V1)
  if (entries.length > 30) {
    findings.push({
      level: "warn",
      entry: "*",
      message: `${entries.length} entries > 30 soft cap — review pattern before adding more (see governance gravity defense in plan)`,
    });
  }

  emitFindings(findings);
  const errors = findings.filter((f) => f.level === "error");
  if (errors.length > 0) return 1;
  log(`✓ all ${entries.length} entries valid (evidence paths exist, excerpts match, seed markers consistent)`);
  return 0;
}

function emitFindings(findings: Finding[]): void {
  const errors = findings.filter((f) => f.level === "error");
  const warnings = findings.filter((f) => f.level === "warn");
  if (errors.length > 0) {
    process.stderr.write(`\n[validate-automation-overlay] ${errors.length} error(s):\n`);
    for (const f of errors) {
      process.stderr.write(`  [ERROR] ${f.entry}: ${f.message}\n`);
    }
  }
  if (warnings.length > 0) {
    process.stderr.write(`\n[validate-automation-overlay] ${warnings.length} warning(s):\n`);
    for (const f of warnings) {
      process.stderr.write(`  [WARN] ${f.entry}: ${f.message}\n`);
    }
  }
}

const isMain = process.argv[1]?.endsWith("validate-automation-overlay.ts");
if (isMain) {
  try {
    process.exit(validate());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[validate-automation-overlay] FAILED: ${message}\n`);
    process.exit(2);
  }
}
