import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { detectTsSinks } from "./check-served-content-write-sinks-ratchet.ts";

/**
 * Tranche-B R1 — RAG→R1 write-closure guard (structural, not "secured").
 *
 * Doctrine: RAG has ZERO content-write authority (ADR-031/046, memory
 * feedback_rag_zero_content_write_authority_remove_not_secure). A RAG→R1 writer is an
 * architectural VIOLATION to REMOVE — never to gate/add-provenance. This guard pins the
 * removal of the two RAG→R1 write authorities so neither can silently reappear:
 *   - C6: R1EnricherService  (reads RAG .md → writes __seo_r1_gamme_slots)
 *   - C5: generate-from-rag / batch-generate-from-rag  (RAG → __seo_gamme.sg_content)
 *
 * R1-scoped on purpose: __seo_r1_gamme_slots is a pure-R1 table, and the *-from-rag routes
 * are the R1 corpus writers — so this never false-trips on the remaining R2/R3/R8 RAG debt
 * (that stays warning-frozen in seo-no-rag-as-content-source.yml until its own tranche).
 * Reuses the canonical detector detectTsSinks (extend, don't invent a parallel scanner).
 */

const REPO_ROOT = process.cwd();
const BACKEND_SRC = join(REPO_ROOT, "backend/src");

// RAG-read signal = the same token the primary ratchet keys on (seo-no-rag-as-content-source.yml).
const RAG_READ_SIGNAL = "RAG_KNOWLEDGE_PATH";

function walkTs(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "node_modules" || name === "dist") continue;
      walkTs(p, acc);
    } else if (p.endsWith(".ts") && !p.endsWith(".test.ts") && !p.endsWith(".spec.ts")) {
      acc.push(p);
    }
  }
  return acc;
}

test("no RAG-sourced writer targets __seo_r1_gamme_slots (R1 slots authority)", () => {
  const offenders: string[] = [];
  for (const f of walkTs(BACKEND_SRC)) {
    const text = readFileSync(f, "utf8");
    if (!text.includes(RAG_READ_SIGNAL)) continue;
    const rel = relative(REPO_ROOT, f);
    if (detectTsSinks(rel, text).some((s) => s.id.endsWith("::__seo_r1_gamme_slots"))) {
      offenders.push(rel);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `RAG-reading file(s) still write __seo_r1_gamme_slots — RAG has no R1 write authority: ${offenders.join(", ")}`,
  );
});

test("no generate-from-rag / batch-generate-from-rag route writes R1 content (__seo_gamme.sg_content)", () => {
  const routeRe = /@Post\(\s*['"`](?:batch-)?generate-from-rag['"`]\s*\)/;
  const offenders: string[] = [];
  for (const f of walkTs(BACKEND_SRC)) {
    if (routeRe.test(readFileSync(f, "utf8"))) offenders.push(relative(REPO_ROOT, f));
  }
  assert.deepEqual(
    offenders,
    [],
    `RAG→content endpoint(s) still present — must be removed, not gated: ${offenders.join(", ")}`,
  );
});
