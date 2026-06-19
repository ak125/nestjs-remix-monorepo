#!/usr/bin/env node
/**
 * scripts/governance/build-command-center-snapshot.js
 *
 * Deterministic projection of the AI Operating Map canon
 * (.spec/00-canon/ai-registry/agent-operating-map.yaml) into
 * audit/registry/command-center-snapshot.json — the read-only data contract
 * behind the admin Command Center hub (/admin/command-center).
 *
 * Design (see plan §Certification & health score — LOCKED rules):
 *   - STRUCTURAL truth only. NO wall-clock / git fields are baked: two builds on
 *     the same checkout are byte-identical (determinism invariant V1-2). The
 *     backend reader adds generated_at / git_sha / stale_status / global_status /
 *     health_score_current at request time.
 *   - Certification ladder evaluated in ORDER (first match wins):
 *       1. BROKEN    — a declared evidence.scripts[] path is absent on disk
 *       2. CERTIFIED — status=live AND ≥1 evidence path (verified) AND module known
 *       3. PARTIAL   — status=partial | tables/endpoints-only (liveness deferred) | live w/o evidence
 *       4. UNKNOWN   — no evidence / dormant / duplicate / unproven
 *     BROKEN is checked BEFORE CERTIFIED. V1 scope: BROKEN only for scripts[]/path
 *     evidence (existsSync); tables/endpoints liveness is a Phase-2 runtime check.
 *   - Health score (V1 simple base-by-tier + STRUCTURAL caps only here):
 *       base: CERTIFIED=90 PARTIAL=55 UNKNOWN=30 BROKEN=10
 *       caps: P0+BROKEN→max 39 · no-evidence→max 49   (deterministic, build-time)
 *     The LIVE caps (source stale→79, Data UNKNOWN→Sales 69) are applied by the
 *     backend reader, never baked.
 *
 * Reference projection, non-authoritative (warn-only). Never edited by hand.
 *
 * Flags: --quiet  --json (print to stdout)  --check (fail if committed file stale)
 */
"use strict";

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const {
  MONOREPO_ROOT,
  REGISTRY_DIR,
  writeDeterministicJson,
  sortKeysDeep,
  readJsonSafe,
  makeLogger,
} = require("../registry/lib/utils");

const log = makeLogger("command-center");

const SCHEMA_VERSION = "command-center.v1";
const CANON_REL = ".spec/00-canon/ai-registry/agent-operating-map.yaml";
const REPORT_REL = "audit-reports/agent-operating-map-report.json";
// Skills registry (canon, built by build-skills-registry.js) — resolves the
// departments[].capabilities slugs annotated « via skills.registry » that are
// NOT in declared_capabilities (e.g. vehicle-ops, governance-vault-ops).
const SKILLS_REGISTRY_REL = ".spec/00-canon/ai-registry/skills.registry.json";
const OUT_PATH = path.join(REGISTRY_DIR, "command-center-snapshot.json");

const BASE_SCORE = { CERTIFIED: 90, PARTIAL: 55, UNKNOWN: 30, BROKEN: 10 };
// Worst-first ordering used to pick a department/module's representative tier.
const CERT_RANK = { BROKEN: 0, UNKNOWN: 1, PARTIAL: 2, CERTIFIED: 3 };

// Presentation-only grouping of departments into the 4 hub families. NOT used in
// any certification/score logic. V1 lives here; can migrate to a canon `family`
// field later without changing the contract.
const DEPARTMENT_FAMILY = {
  sales: "Business", support: "Business", finance: "Business", logistics: "Business", people: "Business",
  seo: "Growth", marketing: "Growth", brand: "Growth", content: "Growth", media: "Growth", wiki: "Growth",
  supplier: "Operations", pricing: "Operations", catalog: "Operations", diagnostic: "Operations", runtime: "Operations", data: "Operations",
  "ia-agents": "AI-Governance", governance: "AI-Governance", strategy: "AI-Governance",
};
const DEFAULT_FAMILY = "Operations";

// ── pure helpers (exported for tests) ─────────────────────────────────────────

/** Extract a backend module slug from evidence script paths, else null. */
function extractModuleSlug(scripts) {
  for (const p of scripts || []) {
    const m = /(?:backend\/src\/modules|packages)\/([a-z0-9-]+)/.exec(p);
    if (m) return m[1];
  }
  return null;
}

/**
 * Certification ladder (LOCKED order). `pathExists` is injected so tests can run
 * without touching disk. Returns { certification, reason? }.
 */
function computeCertification(cap, pathExists) {
  const ev = cap.evidence || {};
  const scripts = Array.isArray(ev.scripts) ? ev.scripts : [];
  const tables = Array.isArray(ev.tables) ? ev.tables : [];

  // 1. BROKEN — any declared script/path absent on disk (V1 scope: scripts only).
  const missing = scripts.filter((p) => !pathExists(p));
  if (scripts.length > 0 && missing.length > 0) {
    return { certification: "BROKEN", reason: "missing_path:" + missing.join(",") };
  }

  const hasVerifiedPath = scripts.length > 0; // not BROKEN ⇒ all present
  const hasTableEvidence = tables.length > 0;

  // 2. CERTIFIED — live + ≥1 verified path + module source known.
  if (cap.status === "live" && hasVerifiedPath) {
    return { certification: "CERTIFIED" };
  }
  // tables/endpoints-only liveness is deferred to Phase-2 runtime → PARTIAL.
  if (cap.status === "live" && hasTableEvidence && !hasVerifiedPath) {
    return { certification: "PARTIAL", reason: "evidence_liveness_deferred_phase2" };
  }
  // 3. PARTIAL — declared partial, or live without usable evidence (pessimism).
  if (cap.status === "partial") {
    return { certification: "PARTIAL" };
  }
  if (cap.status === "live") {
    return { certification: "PARTIAL", reason: "no_structured_evidence" };
  }
  // 4. UNKNOWN — dormant / duplicate / unproven.
  return { certification: "UNKNOWN", reason: "status_" + cap.status };
}

function hasAnyEvidence(cap) {
  const ev = cap.evidence || {};
  return Boolean(
    (Array.isArray(ev.scripts) && ev.scripts.length) ||
      (Array.isArray(ev.tables) && ev.tables.length) ||
      ev.runtime ||
      ev.adr,
  );
}

/**
 * Department health score base (deterministic, V1 simple model).
 *   base = mean of the capabilities' tier scores (so the structural caps below can
 *          actually bite — a worst-case base would make P0+BROKEN a no-op since
 *          BROKEN=10 ≤ 39). certification (tile colour) stays WORST-case = honest.
 * STRUCTURAL caps (deterministic, build-time):
 *   - P0 department with ANY broken capability → max 39
 *   - any capability lacking evidence          → max 49 (no green without proof)
 * The LIVE caps (source stale → 79, Data UNKNOWN → Sales 69) are NOT applied here —
 * the backend reader applies them at request time (health_score_current).
 * Returns { base, worst_certification, caps_applied[] }.
 */
function computeHealthScoreBase(department, caps) {
  if (!caps.length) {
    return { base: BASE_SCORE.UNKNOWN, worst_certification: "UNKNOWN", caps_applied: ["no_capabilities"] };
  }
  let worst = caps[0].certification;
  let sum = 0;
  for (const c of caps) {
    if (CERT_RANK[c.certification] < CERT_RANK[worst]) worst = c.certification;
    sum += BASE_SCORE[c.certification];
  }
  let score = Math.round(sum / caps.length);
  const capsApplied = [];
  if (department.priority === "P0" && caps.some((c) => c.certification === "BROKEN")) {
    score = Math.min(score, 39);
    capsApplied.push("p0_broken_max_39");
  }
  if (caps.some((c) => !c.has_evidence)) {
    score = Math.min(score, 49);
    capsApplied.push("no_evidence_max_49");
  }
  return { base: score, worst_certification: worst, caps_applied: capsApplied };
}

/**
 * Build the full snapshot object from the parsed canon. `pathExists` injected.
 * Pure — no disk writes, no wall-clock.
 */
function buildSnapshot(canon, pathExists, skillsRegistry) {
  const departments = Array.isArray(canon.departments) ? canon.departments : [];
  const declared = Array.isArray(canon.declared_capabilities) ? canon.declared_capabilities : [];
  const deptHandoffs = Array.isArray(canon.department_handoffs) ? canon.department_handoffs : [];
  const skillsByName = new Map();
  for (const s of (skillsRegistry && Array.isArray(skillsRegistry.skills)) ? skillsRegistry.skills : []) {
    if (s && s.name) skillsByName.set(s.name, s);
  }

  // capabilities — certification + module resolution
  const toCapabilityEntry = (cap) => {
    const verdict = computeCertification(cap, pathExists);
    const slug = extractModuleSlug(cap.evidence && cap.evidence.scripts) || cap.owner;
    return {
      id: cap.id,
      type: cap.type,
      owner: cap.owner,
      status: cap.status,
      certification: verdict.certification,
      reason: verdict.reason || null,
      module: slug,
      has_evidence: hasAnyEvidence(cap),
      evidence: cap.evidence || null,
    };
  };
  const capabilities = declared.map(toCapabilityEntry);
  const capsByOwner = {};
  for (const c of capabilities) (capsByOwner[c.owner] = capsByOwner[c.owner] || []).push(c);

  // Resolution pass — departments[].capabilities slugs not in declared_capabilities.
  // The canon annotates these « via skills.registry » : resolve them through the
  // skills registry into the SAME declared shape as the existing convention
  // (cf. continuous-improvement-global, agent-operating-map.yaml — type: skill,
  // status: live, evidence: { scripts: [<skill path>] }). The path is then
  // verified by the LOCKED ladder like any other evidence (BROKEN if absent).
  // A slug resolving NOWHERE is a canon inconsistency → DROPPED_CAPABILITY alert
  // (error) — never a silent drop (the pre-fix behaviour: governance rendered
  // UNKNOWN/30 while its real capability existed).
  const droppedAlerts = [];
  for (const d of departments) {
    const annotated = Array.isArray(d.capabilities) ? d.capabilities : [];
    const ownedIds = new Set((capsByOwner[d.id] || []).map((c) => c.id));
    for (const slug of annotated) {
      if (ownedIds.has(slug)) continue;
      const skill = skillsByName.get(slug);
      if (skill && skill.path) {
        const synth = toCapabilityEntry({
          id: slug,
          type: "skill",
          owner: d.id,
          status: "live",
          evidence: { scripts: [skill.path] },
        });
        capabilities.push(synth);
        (capsByOwner[d.id] = capsByOwner[d.id] || []).push(synth);
        ownedIds.add(slug);
      } else {
        droppedAlerts.push({
          code: "DROPPED_CAPABILITY",
          severity: "error",
          target_kind: "capability",
          target_id: `${d.id}:${slug}`,
          message: `Department capability '${slug}' resolves neither in declared_capabilities nor in skills.registry — it would be silently dropped from the snapshot.`,
        });
      }
    }
  }

  // departments — health score base + family + worst certification
  const deptOut = departments.map((d) => {
    const caps = capsByOwner[d.id] || [];
    const hs = computeHealthScoreBase(d, caps);
    return {
      id: d.id,
      label: d.label,
      lead: d.lead,
      priority: d.priority || null,
      kpi_primary: d.kpi_primary || null,
      state: d.state,
      family: DEPARTMENT_FAMILY[d.id] || DEFAULT_FAMILY,
      capabilities: caps.map((c) => c.id),
      certification: hs.worst_certification,
      health_score_base: hs.base,
      structural_caps_applied: hs.caps_applied,
    };
  });

  // chains — department handoffs (the cross-module dependency graph).
  const chains = deptHandoffs.map((h) => ({
    id: h.id,
    from: h.from,
    to: h.to,
    contract_ref: h.contract_ref || null,
    contract_status: h.contract_status || null,
    gate: h.gate || null,
    state: h.state,
    incomplete: h.state === "PARTIAL" || h.state === "ASPIRATIONAL",
  }));

  // alerts — structural only (live alerts like STALE_MAP added by the reader).
  const alerts = [...droppedAlerts];
  for (const c of capabilities) {
    if (c.certification === "BROKEN") {
      alerts.push({ code: "BROKEN_EVIDENCE", severity: "error", target_kind: "capability", target_id: c.id, message: `Evidence path absent: ${c.reason}` });
    } else if (c.status === "live" && c.certification === "PARTIAL" && c.reason === "no_structured_evidence") {
      alerts.push({ code: "OVERCLAIM_RISK", severity: "warn", target_kind: "capability", target_id: c.id, message: `Declared live but no structured evidence — cannot certify.` });
    }
  }
  for (const d of deptOut) {
    if (d.priority === "P0" && !d.kpi_primary) {
      alerts.push({ code: "P0_NO_KPI", severity: "warn", target_kind: "department", target_id: d.id, message: `P0 department without kpi_primary.` });
    }
  }
  for (const h of chains) {
    if (h.incomplete) {
      alerts.push({ code: "HANDOFF_INCOMPLETE", severity: "info", target_kind: "handoff", target_id: h.id, message: `Handoff ${h.from}→${h.to} is ${h.state} (contract ${h.contract_status || "n/a"}).` });
    }
  }

  // owner_actions — 1:1 with alerts, concrete.
  const CANON = CANON_REL;
  const owner_actions = alerts.map((a) => {
    if (a.code === "BROKEN_EVIDENCE") return { from_alert: a.code, target_id: a.target_id, action: "Fix or remove the missing evidence path", owner: "ia-agents", file: CANON, decision: `Is ${a.target_id} still backed by that path?` };
    if (a.code === "OVERCLAIM_RISK") return { from_alert: a.code, target_id: a.target_id, action: "Add evidence (scripts/tables) or downgrade status from live", owner: capById(capabilities, a.target_id, "owner"), file: CANON, decision: `Is ${a.target_id} truly live? cite an artifact or set status=partial.` };
    if (a.code === "P0_NO_KPI") return { from_alert: a.code, target_id: a.target_id, action: "Define kpi_primary for the P0 department", owner: a.target_id, file: CANON, decision: `What single KPI governs ${a.target_id}?` };
    if (a.code === "DROPPED_CAPABILITY") return { from_alert: a.code, target_id: a.target_id, action: "Declare the capability in declared_capabilities, or register the skill in skills.registry, or remove the slug", owner: a.target_id.split(":")[0], file: CANON, decision: `Where does ${a.target_id} really resolve?` };
    return { from_alert: a.code, target_id: a.target_id, action: "Wire the contract or document why it stays PARTIAL/ASPIRATIONAL", owner: chainFrom(chains, a.target_id), file: CANON, decision: `Promote ${a.target_id} to EXISTS or keep with evidence.` };
  });

  // executive_kpis — canon-derived counts (live-source KPIs stay UNKNOWN until certified downstream).
  const certifiedCount = capabilities.filter((c) => c.certification === "CERTIFIED").length;
  const withoutEvidence = capabilities.filter((c) => !c.has_evidence).length;
  const executive_kpis = [
    { id: "departments_total", label: "Départements", value: deptOut.length, status: "OK", source: "canon", certified: true },
    { id: "capabilities_certified", label: "Capacités certifiées", value: certifiedCount, unit: `/${capabilities.length}`, status: certifiedCount > 0 ? "OK" : "WARNING", source: "canon", certified: true },
    { id: "capabilities_without_evidence", label: "Sans preuve", value: withoutEvidence, status: withoutEvidence > 0 ? "WARNING" : "OK", source: "canon", certified: true },
    { id: "handoffs_incomplete", label: "Handoffs incomplets", value: chains.filter((h) => h.incomplete).length, unit: `/${chains.length}`, status: chains.some((h) => h.incomplete) ? "WARNING" : "OK", source: "canon", certified: true },
  ];

  const by_priority = { P0: 0, P1: 0, P2: 0, P3: 0 };
  const by_state = { live: 0, partial: 0, dormant: 0, broken: 0, duplicate: 0 };
  for (const d of deptOut) {
    if (d.priority && by_priority[d.priority] !== undefined) by_priority[d.priority] += 1;
    if (by_state[d.state] !== undefined) by_state[d.state] += 1;
  }

  return {
    schema_version: SCHEMA_VERSION,
    source_truth: { canon_path: CANON_REL, last_verified: canon.last_verified || null },
    summary: {
      departments_total: deptOut.length,
      by_priority,
      by_state,
      capabilities_total: capabilities.length,
      capabilities_certified: certifiedCount,
      capabilities_without_evidence: withoutEvidence,
      handoffs_total: chains.length,
      handoffs_incomplete: chains.filter((h) => h.incomplete).length,
    },
    executive_kpis,
    departments: sortByKey(deptOut, "id"),
    capabilities: sortByKey(capabilities, "id"),
    chains: sortByKey(chains, "id"),
    alerts: sortAlerts(alerts),
    owner_actions: sortByKey(owner_actions, "target_id"),
  };
}

function capById(caps, id, field) {
  const c = caps.find((x) => x.id === id);
  return c ? c[field] : "ia-agents";
}
function chainFrom(chains, id) {
  const c = chains.find((x) => x.id === id);
  return c ? c.from : "governance";
}
function sortByKey(arr, key) {
  return [...arr].sort((a, b) => (String(a[key]) < String(b[key]) ? -1 : String(a[key]) > String(b[key]) ? 1 : 0));
}
function sortAlerts(arr) {
  return [...arr].sort((a, b) => {
    const k1 = a.code + ":" + a.target_id;
    const k2 = b.code + ":" + b.target_id;
    return k1 < k2 ? -1 : k1 > k2 ? 1 : 0;
  });
}

// ── main (I/O) ────────────────────────────────────────────────────────────────

function loadCanon() {
  const canonPath = path.join(MONOREPO_ROOT, CANON_REL);
  const raw = fs.readFileSync(canonPath, "utf8"); // throws if SoT missing — intentional
  return yaml.load(raw);
}

function makePathExists() {
  return (rel) => fs.existsSync(path.join(MONOREPO_ROOT, rel));
}

function build() {
  const canon = loadCanon();
  const skillsRegistry = readJsonSafe(path.join(MONOREPO_ROOT, SKILLS_REGISTRY_REL)) || { skills: [] };
  const snapshot = buildSnapshot(canon, makePathExists(), skillsRegistry);
  // Note: validation report is consumed by the READER (live validation_status),
  // not baked here — keeps the file deterministic.
  return snapshot;
}

function main() {
  const argv = process.argv.slice(2);
  const snapshot = build();
  const sorted = sortKeysDeep(snapshot);
  const json = JSON.stringify(sorted, null, 2) + "\n";

  if (argv.includes("--json")) {
    process.stdout.write(json);
    return 0;
  }
  if (argv.includes("--check")) {
    const current = (() => { try { return fs.readFileSync(OUT_PATH, "utf8"); } catch { return null; } })();
    if (current !== json) {
      process.stderr.write(
        "[registry/command-center] ✗ command-center-snapshot.json is STALE.\n" +
          "  Run `node scripts/governance/build-command-center-snapshot.js` and stage the result.\n",
      );
      return 1;
    }
    log("✓ snapshot up to date");
    return 0;
  }
  const sha = writeDeterministicJson(OUT_PATH, snapshot);
  log(
    `wrote ${path.relative(MONOREPO_ROOT, OUT_PATH)} ` +
      `(depts=${snapshot.departments.length}, caps=${snapshot.capabilities.length}, ` +
      `chains=${snapshot.chains.length}, alerts=${snapshot.alerts.length}, sha256:${sha.slice(0, 12)})`,
  );
  return 0;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = {
  SCHEMA_VERSION,
  BASE_SCORE,
  extractModuleSlug,
  computeCertification,
  hasAnyEvidence,
  computeHealthScoreBase,
  buildSnapshot,
};
