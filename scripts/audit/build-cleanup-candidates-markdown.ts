// Human-readable projection of the PR-8 cleanup inventory JSON.
// JSON remains the SoT; this markdown is regenerated alongside it.
import type { CleanupInventory, CandidateRecord } from "./cleanup-candidates.schema.ts";

export function renderMarkdown(inv: CleanupInventory): string {
  const lines: string[] = [];
  lines.push("# PR-8 Controlled Cleanup — Deletion Proof");
  lines.push("");
  lines.push("> **Source of truth**: `audit/cleanup/pr-8-controlled-cleanup-candidates.json` (this file is a human-readable projection).");
  lines.push("> **Generator**: `scripts/audit/build-cleanup-candidates.ts` (deterministic, snapshot-only).");
  lines.push("> **Re-generate**: `npm run audit:cleanup-candidates` — **DO NOT EDIT BY HAND.**");
  lines.push("");
  lines.push(`- Inventory format: \`${inv.meta.inventoryFormat}\``);
  lines.push(`- Schema version: \`${inv.meta.schemaVersion}\``);
  lines.push(`- Cleanup policy version: \`${inv.meta.cleanupPolicyVersion}\``);
  lines.push(`- Validation mode: \`${inv.meta.validationMode}\` (active runtime check deferred to PR-8b)`);
  lines.push(`- Generated at: \`${inv.meta.generatedAt}\``);
  lines.push(`- Toolchain: \`${inv.meta.toolchain.node}\` on \`${inv.meta.toolchain.platform}/${inv.meta.toolchain.arch}\``);
  lines.push("");
  lines.push("## Input Fingerprint (sha256)");
  lines.push("");
  for (const [k, v] of Object.entries(inv.meta.inputFingerprint)) {
    lines.push(`- \`${k}\`: \`${v ?? "<none>"}\``);
  }
  lines.push("");
  lines.push("## Counts");
  lines.push("");
  lines.push(`- Total: **${inv.meta.counts.total}**`);
  lines.push(`- By confidence: high=${inv.meta.counts.byConfidence.high} · medium=${inv.meta.counts.byConfidence.medium} · low=${inv.meta.counts.byConfidence.low}`);
  lines.push(`- By decision: candidate=${inv.meta.counts.byDecision.candidate} · blocked=${inv.meta.counts.byDecision.blocked} · excluded=${inv.meta.counts.byDecision.excluded}`);
  lines.push("");

  const groups: Record<"candidate" | "blocked" | "excluded", CandidateRecord[]> = { candidate: [], blocked: [], excluded: [] };
  for (const c of inv.candidates) groups[c.decision].push(c);

  const renderTable = (rows: CandidateRecord[]) => {
    if (rows.length === 0) { lines.push("_(empty)_"); lines.push(""); return; }
    lines.push("| Path | Domain | Kind | Confidence | Status | importedBy | Rationale |");
    lines.push("|---|---|---|---|---|---:|---|");
    for (const r of rows) {
      const ib = r.proof.canonical?.importedByCount ?? "n/a";
      const status = r.proof.canonical?.status ?? "n/a";
      const rat = r.proof.decisionRationale.replace(/\|/g, "\\|");
      lines.push(`| \`${r.path}\` | ${r.domain} | ${r.kind} | ${r.confidence} | ${status} | ${ib} | ${rat} |`);
    }
    lines.push("");
  };

  for (const decision of ["candidate", "blocked", "excluded"] as const) {
    lines.push(`## ${decision} (${groups[decision].length})`);
    lines.push("");
    const byConf: Record<string, CandidateRecord[]> = { high: [], medium: [], low: [] };
    for (const r of groups[decision]) byConf[r.confidence].push(r);
    for (const conf of ["high", "medium", "low"]) {
      lines.push(`### ${decision} · ${conf} (${byConf[conf].length})`);
      lines.push("");
      renderTable(byConf[conf]);
    }
  }

  return lines.join("\n");
}
