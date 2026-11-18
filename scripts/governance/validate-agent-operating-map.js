#!/usr/bin/env node
/**
 * scripts/governance/validate-agent-operating-map.js
 *
 * Validates .spec/00-canon/ai-registry/agent-operating-map.yaml.
 *
 * Reference projection — non-authoritative. Hard-fail enforcement requires a
 * vault ADR. PR#1 only validates the schema shape (the live map has nodes:[]);
 * cross-ref checks fire only when nodes.length > 0 (activated in PR#2).
 *
 * Flags:
 *   --strict     exit 1 if any error finding (default: warn-only, exit 0)
 *   --self-test  run the schema fixture and assert SCHEMA error is detected
 *   --json       print the JSON report to stdout (in addition to file)
 *   --contracts  department contracts only (owner decision 72): exit 1 on a
 *                schema error or an incomplete contract, whatever --strict says;
 *                lists the fields left pending_owner_decision. The CI gate.
 *                Also refuses an incoherent department function (mandate BX
 *                and complement BX-2: empty, capability, operability,
 *                missing, covers, path, kpi, id, reference; see
 *                checkDepartmentFunctions) and prints the function coverage
 *                report (functionCoverage), which never fails.
 *
 * Exit codes (aligned with sibling validate-skills-frontmatter.js):
 *   0  OK, or warn-only run (no --strict)
 *   1  validation errors found AND --strict
 *   2  operational failure (map absent, YAML/JSON unparseable, schema not
 *      compilable) — surfaced as a readable [FATAL] line, never a raw stack
 *      trace. Set DEBUG=1 to also print the stack.
 *
 * CommonJS to stay consistent with sibling validators
 * (scripts/governance/validate-skills-frontmatter.js).
 */

const fs = require("node:fs");
const path = require("node:path");

const yaml = require("js-yaml");
const Ajv2020 = require("ajv/dist/2020");
const addFormats = require("ajv-formats");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const MAP_PATH = path.join(
  REPO_ROOT,
  ".spec/00-canon/ai-registry/agent-operating-map.yaml",
);
const SCHEMA_PATH = path.join(
  REPO_ROOT,
  ".spec/00-canon/ai-registry/agent-operating-map.schema.json",
);
const OWNER_PATH = path.join(
  REPO_ROOT,
  ".spec/00-canon/repository-registry/ownership.yaml",
);
const DOMAINS_PATH = path.join(
  REPO_ROOT,
  ".spec/00-canon/repository-registry/domains.yaml",
);
const SKILLS_REGISTRY_PATH = path.join(
  REPO_ROOT,
  ".spec/00-canon/ai-registry/skills.registry.json",
);
const REPORT_DIR = path.join(REPO_ROOT, "audit-reports");
const REPORT_PATH = path.join(REPORT_DIR, "agent-operating-map-report.json");

const argv = new Set(process.argv.slice(2));
const strict = argv.has("--strict");
const selfTest = argv.has("--self-test");
const jsonOut = argv.has("--json");
const contractsOnly = argv.has("--contracts");

// Exit codes (aligned with sibling validate-skills-frontmatter.js).
const EXIT_OK = 0;
const EXIT_VALIDATION = 1;
const EXIT_OP_ERROR = 2;

function loadYaml(p) {
  return yaml.load(fs.readFileSync(p, "utf8"));
}

function knownOwnersFromOwnership() {
  if (!fs.existsSync(OWNER_PATH)) return new Set();
  const o = loadYaml(OWNER_PATH);
  return new Set(
    (o.entries ?? [])
      .map((e) => (e && e.owner) || null)
      .filter(Boolean)
      .filter((owner) => owner !== "__unassigned__"),
  );
}

function knownDomainsFromDomainsYaml() {
  if (!fs.existsSync(DOMAINS_PATH)) return new Set();
  const d = loadYaml(DOMAINS_PATH);
  return new Set((d.entries ?? []).map((e) => e && e.id).filter(Boolean));
}

function skillNamesFromRegistry() {
  if (!fs.existsSync(SKILLS_REGISTRY_PATH)) return new Set();
  try {
    const r = JSON.parse(fs.readFileSync(SKILLS_REGISTRY_PATH, "utf8"));
    return new Set((r.skills ?? []).map((s) => s && s.name).filter(Boolean));
  } catch {
    return new Set();
  }
}

/** Pure reference checks, also used by the projection writer. No runtime authority. */
function checkDepartmentProfiles(departments, profileText) {
  const errors = [];
  const ids = new Set();
  const numbers = new Set();
  for (const d of departments) {
    if (ids.has(d.id)) errors.push(`duplicate department id: ${d.id}`);
    if (!Number.isInteger(d.business_number) || d.business_number < 1 || d.business_number > 24 || numbers.has(d.business_number)) errors.push(`invalid or duplicate business number: ${d.id}`);
    ids.add(d.id); numbers.add(d.business_number);
    const expected = `audit/automecanik-departments-map.md#department-${d.id}`;
    if (d.profile_ref !== expected || !profileText.includes(`<a id="department-${d.id}"></a>`)) errors.push(`unresolved department profile: ${d.id}`);
  }
  return errors;
}

const CONTRACT_FIELDS = ["surveillance", "kpi", "source", "seuil_action", "ligne_rapport", "decisions"];

/** True when a contract field holds an explicit, reasoned gap instead of a value. */
function isPending(value) {
  return Boolean(value && typeof value === "object" && "pending_owner_decision" in value);
}

/**
 * Department contracts (owner decision 72). Pure: returns
 * { errors: [{ id, message }], pending: [{ id, field, reason }],
 *   unproduced: [{ id, definition, missing }] }.
 * An error is an incomplete contract (missing or empty field, KPI producer that
 * does not exist, KPI producer without kpi_primary, fewer than 24 contracts).
 * A pending field is complete but surfaced: the owner has not decided it yet.
 * An unproduced KPI is decided (definition) but has no producer yet: listed,
 * never counted as pending, never read as a measure (decisions 8 and 24).
 * `fileExists(rel)` is injected so the projection writer and tests stay pure.
 */
function checkDepartmentContracts(departments, fileExists) {
  const errors = [];
  const pending = [];
  const unproduced = [];
  const err = (id, message) => errors.push({ id, message });
  if (departments.length !== 24) {
    err("departments", `expected 24 department contracts, found ${departments.length} departments`);
  }
  for (const d of departments) {
    const c = d.contract;
    if (!c || typeof c !== "object") {
      err(d.id, `department ${d.id} has no contract`);
      continue;
    }
    for (const field of CONTRACT_FIELDS) {
      const v = c[field];
      const empty =
        v == null ||
        (typeof v === "string" && v.trim().length < 3) ||
        (Array.isArray(v) && v.length === 0) ||
        (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0);
      if (empty) {
        err(d.id, `department ${d.id} contract field "${field}" is missing or empty`);
        continue;
      }
      if (isPending(v)) {
        const reason = String(v.pending_owner_decision || "").trim();
        if (reason.length < 10) err(d.id, `department ${d.id} contract field "${field}" is pending without a reason`);
        else pending.push({ id: d.id, field, reason });
      }
    }
    const kpi = c.kpi;
    if (kpi && typeof kpi === "object" && typeof kpi.producer === "string") {
      if (!d.kpi_primary) err(d.id, `department ${d.id} contract names a KPI producer but has no kpi_primary`);
      if (!fileExists(kpi.producer)) err(d.id, `department ${d.id} KPI producer not on disk: ${kpi.producer}`);
    }
    if (kpi && typeof kpi === "object" && typeof kpi.producer_pending === "string") {
      unproduced.push({ id: d.id, definition: kpi.definition, missing: kpi.producer_pending });
    }
    for (const n of Array.isArray(c.decisions) ? c.decisions : []) {
      if (!Number.isInteger(n) || n < 1 || n > 90) err(d.id, `department ${d.id} cites decision ${n}, outside 1-90`);
    }
  }
  return { errors, pending, unproduced };
}

/**
 * Department functions (mandate BX, complement BX-2; model in
 * .spec/00-canon/ai-registry/department-functions.md). Pure: returns
 * { errors: [{ id, rule, message }], summary: [{ department, id, status, level }] }.
 * The schema checks the shape; this checks what the schema cannot say:
 *   empty       — every department declares at least one function;
 *   capability  — a capability is listed by one department only, and that
 *                 department is its owner in declared_capabilities;
 *   operability — without owner + wired trigger + check, a function is not
 *                 operational and stays at level L0 or L1;
 *   missing     — a missing function cites no existing element and only
 *                 `absent` evidence; an existing one cites at least one proof;
 *   covers      — every covered module, route, workflow and @Cron file exists;
 *   path        — every path cited by trigger, check or evidence exists, and a
 *                 cited line range stays inside the file;
 *   kpi         — a kpi_input "present" names a producer on disk, which contains
 *                 the cited rule when one is given;
 *   id          — function ids are unique across departments and prefixed by
 *                 their department id;
 *   reference   — owner, subagents, skills and consumed capabilities resolve
 *                 (owner = a department lead or a subagent in the repository).
 * `deps` is injected so tests stay pure: fileText(rel) → string ("" for a
 * directory) or null when absent; agentExists(name); skillExists(name);
 * capabilityOwners = Map(capability id → owner in declared_capabilities);
 * routeKeys (optional) = array of route keys, see routeKeysOnDisk.
 */
function checkDepartmentFunctions(departments, deps) {
  const { fileText, agentExists, skillExists, capabilityOwners, routeKeys } = deps;
  const errors = [];
  const summary = [];
  const err = (id, rule, message) => errors.push({ id, rule, message });
  const leads = new Set(departments.map((d) => d.lead).filter(Boolean));
  const seen = new Map();
  const checkPath = (fid, where, rel, lines) => {
    const text = fileText(rel);
    if (text == null) return err(fid, "path", `function ${fid} ${where} cites a path absent from the repository: ${rel}`);
    if (lines) {
      const last = Number(String(lines).split("-").pop());
      const count = text.length === 0 ? 0 : text.split("\n").length;
      if (last > count) err(fid, "path", `function ${fid} ${where} cites ${rel}:${lines}, beyond its ${count} lines`);
    }
  };
  // capability — one listing department per capability, equal to the declared owner.
  const listedBy = new Map();
  for (const d of departments) {
    for (const cap of Array.isArray(d.capabilities) ? d.capabilities : []) {
      if (!listedBy.has(cap)) listedBy.set(cap, []);
      listedBy.get(cap).push(d.id);
    }
  }
  for (const [cap, ds] of listedBy) {
    if (ds.length > 1) err(cap, "capability", `capability "${cap}" is owned by ${ds.length} departments (${ds.join(", ")}); one owner, the others consume it in uses`);
    const declared = capabilityOwners.get(cap);
    if (declared !== undefined && !ds.includes(declared)) {
      err(cap, "capability", `capability "${cap}" is listed by ${ds.join(", ")} but declared_capabilities gives it to ${declared}`);
    }
  }
  const ownerOf = (cap) => (capabilityOwners.has(cap) ? capabilityOwners.get(cap) : (listedBy.get(cap) || [])[0]);
  const routeMatches = (prefix, exact) =>
    routeKeys.some((k) => k === prefix || (!exact && (k.startsWith(`${prefix}.`) || k.startsWith(`${prefix}/`))));

  for (const d of departments) {
    const fns = Array.isArray(d.functions) ? d.functions : [];
    // empty
    if (fns.length === 0) err(d.id, "empty", `department ${d.id} declares no function`);
    for (const f of fns) {
      const fid = f.id;
      summary.push({ department: d.id, id: fid, status: f.status, level: f.level });
      // id
      if (seen.has(fid)) err(fid, "id", `function id ${fid} is declared twice (${seen.get(fid)} and ${d.id})`);
      else seen.set(fid, d.id);
      if (!String(fid).startsWith(`${d.id}.`)) err(fid, "id", `function id ${fid} is not prefixed by its department id "${d.id}."`);
      // operability
      const complete = Boolean(f.owner) && Boolean(f.trigger && f.trigger.wired === true) && Boolean(f.check);
      if (!complete) {
        const missing = [!f.owner && "owner", !(f.trigger && f.trigger.wired === true) && "wired trigger", !f.check && "check"]
          .filter(Boolean)
          .join(", ");
        if (f.status === "operational") {
          err(fid, "operability", `function ${fid} is "${f.status}" without ${missing}: it cannot be operational`);
        }
        if (f.level !== "L0" && f.level !== "L1") {
          err(fid, "operability", `function ${fid} is at ${f.level} without ${missing}: the level must be L0 or L1`);
        }
      }
      // missing
      const evidence = Array.isArray(f.evidence) ? f.evidence : [];
      const proofs = evidence.filter((e) => !e.absent);
      if (f.status === "missing") {
        if (proofs.length > 0) err(fid, "missing", `function ${fid} is missing but cites a proof in the repository; it exists, so it is operational or non_operational`);
        if (Array.isArray(f.covers) && f.covers.length > 0) err(fid, "missing", `function ${fid} is missing but covers existing elements`);
        if (f.trigger && f.trigger.wired === true) err(fid, "missing", `function ${fid} is missing but has a wired trigger`);
      } else if (proofs.length === 0) {
        err(fid, "missing", `function ${fid} is ${f.status} without any proof (path, PR or run); without one it is missing`);
      }
      // covers
      for (const c of Array.isArray(f.covers) ? f.covers : []) {
        if (c.module && fileText(`backend/src/modules/${c.module}`) !== "") {
          err(fid, "covers", `function ${fid} covers module "${c.module}", absent from backend/src/modules`);
        }
        if (c.workflow && fileText(c.workflow) == null) err(fid, "covers", `function ${fid} covers workflow ${c.workflow}, absent from the repository`);
        if (c.cron) {
          const text = fileText(c.cron);
          if (text == null || !text.includes("@Cron(")) err(fid, "covers", `function ${fid} covers cron file ${c.cron}, absent or without @Cron`);
        }
        if (Array.isArray(routeKeys) && (c.routes || c.route) && !routeMatches(c.routes || c.route, Boolean(c.route))) {
          err(fid, "covers", `function ${fid} covers route ${c.routes ? "prefix " : ""}"${c.routes || c.route}", which matches no file of frontend/app/routes`);
        }
      }
      // path
      if (f.trigger) checkPath(fid, "trigger", f.trigger.ref);
      if (f.check) checkPath(fid, "check", f.check.ref);
      for (const e of evidence) {
        if (e.path) checkPath(fid, "evidence", e.path, e.lines);
        if (e.workflow) checkPath(fid, "evidence", e.workflow);
      }
      // kpi
      for (const k of Array.isArray(f.kpi_input) ? f.kpi_input : []) {
        if (k.state !== "present") continue;
        const text = k.producer ? fileText(k.producer) : null;
        if (text == null) {
          err(fid, "kpi", `function ${fid} kpi_input ${k.id} is present but its producer is not on disk: ${k.producer || "none"}`);
        } else if (k.rule && !text.includes(k.rule)) {
          err(fid, "kpi", `function ${fid} kpi_input ${k.id}: rule "${k.rule}" not found in ${k.producer}`);
        }
      }
      // reference
      if (f.owner && !leads.has(f.owner) && !agentExists(f.owner)) {
        err(fid, "reference", `function ${fid} owner "${f.owner}" is neither a department lead nor a subagent of the repository`);
      }
      for (const a of Array.isArray(f.agents) ? f.agents : []) {
        if (!agentExists(a)) err(fid, "reference", `function ${fid} cites subagent "${a}", absent from the repository`);
      }
      for (const s of Array.isArray(f.skills) ? f.skills : []) {
        if (!skillExists(s)) err(fid, "reference", `function ${fid} cites skill "${s}", absent from the repository`);
      }
      for (const u of Array.isArray(f.uses) ? f.uses : []) {
        const owner = ownerOf(u.capability);
        if (owner === undefined) err(fid, "reference", `function ${fid} uses capability "${u.capability}", owned by no department`);
        else if (owner !== u.from) err(fid, "reference", `function ${fid} uses "${u.capability}" from ${u.from}, but ${owner} owns it`);
      }
    }
  }
  return { errors, summary };
}

/** Route key of a file under frontend/app/routes: path without extension, `_` suffix of each dot segment dropped. */
function routeKey(rel) {
  return rel.replace(/\.(tsx|ts|jsx|js)$/, "").replace(/([^./])_(?=\.|$)/g, "$1");
}

/**
 * Coverage report (complement BX-2). Pure: `inventory` = { modules, routes,
 * workflows, cronFiles, agents, skills } (arrays of element ids, routes as
 * route keys). Returns, per kind, the elements no function covers and that
 * function_coverage_unassigned does not list (`unattached`), the listed ones
 * (`unassigned`), the listed ones a function covers anyway or that no longer
 * exist (`stale`), and the subagents and skills no function cites. Never fails:
 * the caller prints it.
 */
function functionCoverage(map, inventory) {
  const fns = (map.departments || []).flatMap((d) => (Array.isArray(d.functions) ? d.functions : []));
  const covers = fns.flatMap((f) => (Array.isArray(f.covers) ? f.covers : []));
  const routeHit = (key, c) =>
    (c.route && key === c.route) ||
    (c.routes && (key === c.routes || key.startsWith(`${c.routes}.`) || key.startsWith(`${c.routes}/`)));
  const kinds = {
    module: { all: inventory.modules, hit: (x, c) => c.module === x },
    routes: { all: inventory.routes, hit: (x, c) => routeHit(x, c) },
    workflow: { all: inventory.workflows, hit: (x, c) => c.workflow === x },
    cron: { all: inventory.cronFiles, hit: (x, c) => c.cron === x },
  };
  const unassignedList = Array.isArray(map.function_coverage_unassigned) ? map.function_coverage_unassigned : [];
  const kindOf = (u) => (u.module ? "module" : u.route || u.routes ? "routes" : u.workflow ? "workflow" : u.cron ? "cron" : null);
  const unassignedHit = (kind, x) =>
    unassignedList.find((u) => kindOf(u) === kind && kinds[kind].hit(x, u));
  const unattached = {};
  const unassigned = [];
  const stale = [];
  for (const [kind, k] of Object.entries(kinds)) {
    unattached[kind] = [];
    for (const x of k.all) {
      if (covers.some((c) => k.hit(x, c))) continue;
      const u = unassignedHit(kind, x);
      if (u) unassigned.push({ kind, element: x, reason: u.reason });
      else unattached[kind].push(x);
    }
  }
  for (const u of unassignedList) {
    const kind = kindOf(u);
    if (!kind) continue;
    const label = u.module || u.route || u.routes || u.workflow || u.cron;
    const present = kinds[kind].all.filter((x) => kinds[kind].hit(x, u));
    if (present.length === 0) stale.push({ kind, element: label, why: "absent from the repository" });
    else if (present.every((x) => covers.some((c) => kinds[kind].hit(x, c)))) stale.push({ kind, element: label, why: "covered by a function" });
  }
  const citedAgents = new Set(fns.flatMap((f) => [...(f.agents || []), f.owner].filter(Boolean)));
  const citedSkills = new Set(fns.flatMap((f) => f.skills || []));
  return {
    unattached,
    unassigned,
    stale,
    agents_uncited: inventory.agents.filter((a) => !citedAgents.has(a)),
    skills_uncited: inventory.skills.filter((s) => !citedSkills.has(s)),
    crontab_lines_cited: [...new Set(covers.filter((c) => c.crontab).map((c) => c.crontab))].sort((a, b) => a - b),
  };
}

/** Route keys of frontend/app/routes: its files, and the files of its sub-directories (a directory without route file counts as one element). */
function routeKeysOnDisk() {
  const base = path.join(REPO_ROOT, "frontend/app/routes");
  const keys = [];
  for (const e of fs.readdirSync(base, { withFileTypes: true })) {
    if (e.isFile() && /\.(tsx|ts|jsx|js)$/.test(e.name)) keys.push(routeKey(e.name));
    else if (e.isDirectory()) {
      const inner = fs.readdirSync(path.join(base, e.name)).filter((n) => /\.(tsx|ts|jsx|js)$/.test(n));
      if (inner.length === 0) keys.push(e.name);
      for (const n of inner) keys.push(routeKey(`${e.name}/${n}`));
    }
  }
  return keys.sort();
}

/** Inventory for functionCoverage, read from the repository. */
function coverageInventoryOnDisk() {
  const modules = fs
    .readdirSync(path.join(REPO_ROOT, "backend/src/modules"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  const workflows = fs
    .readdirSync(path.join(REPO_ROOT, ".github/workflows"))
    .filter((n) => /\.ya?ml$/.test(n))
    .map((n) => `.github/workflows/${n}`)
    .sort();
  const cronFiles = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== "node_modules" && e.name !== "dist" && e.name !== "__tests__") walk(p);
      } else if (/\.ts$/.test(e.name) && !/\.(test|spec)\.ts$/.test(e.name)) {
        if (/@Cron\(/.test(fs.readFileSync(p, "utf8"))) cronFiles.push(path.relative(REPO_ROOT, p));
      }
    }
  };
  walk(path.join(REPO_ROOT, "backend/src"));
  const agents = [];
  const agentRoots = [path.join(REPO_ROOT, ".claude/agents")];
  const ws = path.join(REPO_ROOT, "workspaces");
  if (fs.existsSync(ws)) for (const w of fs.readdirSync(ws)) agentRoots.push(path.join(ws, w, ".claude/agents"));
  const walkAgents = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory() && !e.name.startsWith("_")) walkAgents(path.join(dir, e.name));
      else if (e.isFile() && e.name.endsWith(".md")) agents.push(e.name.slice(0, -3));
    }
  };
  agentRoots.forEach(walkAgents);
  return {
    modules,
    routes: routeKeysOnDisk(),
    workflows,
    cronFiles: cronFiles.sort(),
    agents: [...new Set(agents)].sort(),
    skills: [...skillNamesFromRegistry()].sort(),
  };
}

/** Subagent `<name>.md` under .claude/agents/ or workspaces/*\/.claude/agents/, at any depth. */
function agentExistsOnDisk(name) {
  const roots = [path.join(REPO_ROOT, ".claude/agents")];
  const ws = path.join(REPO_ROOT, "workspaces");
  if (fs.existsSync(ws)) {
    for (const w of fs.readdirSync(ws)) roots.push(path.join(ws, w, ".claude/agents"));
  }
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return false;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isFile() && e.name === `${name}.md`) return true;
      if (e.isDirectory() && walk(path.join(dir, e.name))) return true;
    }
    return false;
  };
  return roots.some(walk);
}

/** Skill `<name>/SKILL.md` under .claude/skills/ or workspaces/*\/.claude/skills/. */
function skillExistsOnDisk(name) {
  if (fs.existsSync(path.join(REPO_ROOT, ".claude/skills", name, "SKILL.md"))) return true;
  const ws = path.join(REPO_ROOT, "workspaces");
  return (
    fs.existsSync(ws) &&
    fs.readdirSync(ws).some((w) => fs.existsSync(path.join(ws, w, ".claude/skills", name, "SKILL.md")))
  );
}

/** File text, "" for a directory, null when the path is absent from the repository. */
function repoFileText(rel) {
  // One read, no exists-then-read check (CodeQL js/file-system-race).
  try {
    return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
  } catch (e) {
    if (e.code === "EISDIR") return "";
    if (e.code === "ENOENT" || e.code === "ENOTDIR") return null;
    throw e;
  }
}

function functionDeps(map) {
  return {
    fileText: repoFileText,
    agentExists: agentExistsOnDisk,
    skillExists: skillExistsOnDisk,
    capabilityOwners: new Map((map.declared_capabilities || []).map((c) => [c.id, c.owner])),
    routeKeys: routeKeysOnDisk(),
  };
}

/**
 * Run all validation checks against a map document.
 * Returns array of { severity: 'error'|'warn', code, message, where }.
 */
function checkMap(map, ajvValidate) {
  const findings = [];
  const add = (severity, code, message, where) =>
    findings.push({ severity, code, message, where });

  // 1) Schema
  if (!ajvValidate(map)) {
    for (const err of ajvValidate.errors || []) {
      add(
        "error",
        "SCHEMA",
        `${err.instancePath || "<root>"} ${err.message}`,
        err.instancePath,
      );
    }
    // Bail on schema errors — downstream checks assume valid shape.
    return findings;
  }

  const nodes = map.nodes || [];
  const nodeIds = new Set(nodes.map((n) => n.id));
  const surfaces = map.surfaces || [];
  const handoffs = map.handoffs || [];

  // Cross-ref checks only fire once inventory exists (PR#2 onwards).
  const hasInventory = nodes.length > 0;

  // 2) Node path existence
  if (hasInventory) {
    for (const n of nodes) {
      if (!fs.existsSync(path.join(REPO_ROOT, n.path))) {
        add(
          "error",
          "NODE_PATH_MISSING",
          `node ${n.id} path not on disk: ${n.path}`,
          n.id,
        );
      }
    }
  }

  // 3) Surface loads cross-ref
  if (hasInventory) {
    for (const s of surfaces) {
      for (const kind of ["skills", "agents"]) {
        const arr = (s.loads && s.loads[kind]) || [];
        for (const id of arr) {
          if (!nodeIds.has(id)) {
            add(
              "error",
              "SURFACE_LOAD_ORPHAN",
              `surface ${s.id} loads.${kind} unknown node: ${id}`,
              s.id,
            );
          }
        }
      }
    }
  }

  // 4) Handoff ref cross-check
  if (hasInventory) {
    const refOk = (ref) => ref.startsWith("external:") || nodeIds.has(ref);
    for (const h of handoffs) {
      for (const role of ["produced_by", "consumed_by"]) {
        const v = h[role];
        const arr = Array.isArray(v) ? v : [v];
        for (const ref of arr) {
          if (!refOk(ref)) {
            add(
              "error",
              "HANDOFF_REF_ORPHAN",
              `handoff ${h.id} ${role} unknown ref: ${ref}`,
              h.id,
            );
          }
        }
      }
    }
  }

  // 5) Owner cross-check (TBD permitted during transition).
  if (hasInventory) {
    const known = knownOwnersFromOwnership();
    for (const n of nodes) {
      if (n.owner === "TBD") {
        add("warn", "NODE_OWNER_TBD", `node ${n.id} owner is TBD`, n.id);
      } else if (known.size > 0 && !known.has(n.owner)) {
        add(
          "error",
          "NODE_OWNER_UNKNOWN",
          `node ${n.id} owner not in ownership.yaml entries: ${n.owner}`,
          n.id,
        );
      }
    }
  }

  // 6) Orphan nodes
  if (hasInventory) {
    const refFromSurface = new Set(
      surfaces.flatMap((s) => [
        ...((s.loads && s.loads.skills) || []),
        ...((s.loads && s.loads.agents) || []),
      ]),
    );
    const refFromHandoff = new Set(
      handoffs.flatMap((h) => {
        const out = [];
        for (const role of ["produced_by", "consumed_by"]) {
          const v = h[role];
          if (Array.isArray(v)) out.push(...v);
          else out.push(v);
        }
        return out.filter(
          (r) => typeof r === "string" && !r.startsWith("external:"),
        );
      }),
    );
    for (const n of nodes) {
      if (!refFromSurface.has(n.id) && !refFromHandoff.has(n.id)) {
        add(
          "warn",
          "NODE_ORPHAN",
          `node ${n.id} not referenced by any surface or handoff`,
          n.id,
        );
      }
    }
  }

  // 7) Department checks — fire when departments are declared (independent of the
  //    node inventory, unlike checks 2-6). All warn-only in V1: never blocking,
  //    hard-fail enforcement requires a vault ADR (same stance as the rest of the map).
  const departments = map.departments || [];
  if (departments.length > 0) {
    const profilePath = path.join(REPO_ROOT, "audit/automecanik-departments-map.md");
    const profileText = fs.existsSync(profilePath) ? fs.readFileSync(profilePath, "utf8") : "";
    for (const message of checkDepartmentProfiles(departments, profileText)) {
      add("warn", "DEPT_PROFILE_CONTRACT", message, "departments");
    }
    // 7-bis) Department contracts (decision 72) — severity error: an incomplete
    //        contract is refused; blocking in CI through --contracts.
    const contracts = checkDepartmentContracts(departments, (rel) =>
      fs.existsSync(path.join(REPO_ROOT, rel)),
    );
    for (const e of contracts.errors) {
      add("error", "DEPT_CONTRACT_INCOMPLETE", e.message, e.id);
    }
    // 7-ter) Department functions (mandate BX) — severity error, blocking in CI
    //        through --contracts.
    for (const e of checkDepartmentFunctions(departments, functionDeps(map)).errors) {
      add("error", "DEPT_FUNCTION_INVALID", `[${e.rule}] ${e.message}`, e.id);
    }
    const declaredCaps = new Set(
      (map.declared_capabilities || []).map((c) => c.id),
    );
    const skillNames = skillNamesFromRegistry();
    const knownDomains = knownDomainsFromDomainsYaml();
    // Resolution set for a capability slug: declared allowlist ∪ registry skills ∪ nodes.
    const capResolves = (cap) =>
      declaredCaps.has(cap) || skillNames.has(cap) || nodeIds.has(cap);

    for (const d of departments) {
      // 7a) lead resolves to an agent/skill node, a declared capability, or the
      //     `<id>-lead` convention (a structured-manual lead without a backing node).
      const leadOk =
        nodeIds.has(d.lead) ||
        declaredCaps.has(d.lead) ||
        d.lead === `${d.id}-lead`;
      if (!leadOk) {
        add(
          "warn",
          "DEPT_LEAD_UNRESOLVED",
          `department ${d.id} lead "${d.lead}" is neither a node, a declared capability, nor the ${d.id}-lead convention`,
          d.id,
        );
      }

      // 7b) capabilities resolve to the explicit target set (no ghost slugs).
      for (const cap of d.capabilities || []) {
        if (!capResolves(cap)) {
          add(
            "warn",
            "DEPT_CAPABILITY_UNRESOLVED",
            `department ${d.id} capability "${cap}" resolves to no skill, node, or declared_capabilities entry`,
            d.id,
          );
        }
      }

      // 7c) repo_domains exist in domains.yaml.
      for (const dom of d.repo_domains || []) {
        if (knownDomains.size > 0 && !knownDomains.has(dom)) {
          add(
            "warn",
            "DEPT_REPO_DOMAIN_UNKNOWN",
            `department ${d.id} repo_domain "${dom}" not in domains.yaml`,
            d.id,
          );
        }
      }
    }

    // 7d) department_handoffs: unique ids, from/to name a declared department.
    //     The schema expresses neither; consumers key handoffs by id, so a
    //     duplicate collides silently instead of failing.
    const deptIds = new Set(departments.map((d) => d.id));
    const seenHandoffIds = new Set();
    for (const h of map.department_handoffs || []) {
      if (seenHandoffIds.has(h.id)) {
        add(
          "warn",
          "DEPT_HANDOFF_DUPLICATE_ID",
          `department handoff id "${h.id}" is declared more than once`,
          h.id,
        );
      }
      seenHandoffIds.add(h.id);
      for (const end of ["from", "to"]) {
        if (!deptIds.has(h[end])) {
          add(
            "warn",
            "DEPT_HANDOFF_DEPT_UNRESOLVED",
            `department handoff ${h.id} ${end} "${h[end]}" is not a declared department`,
            h.id,
          );
        }
      }
    }
  }

  return findings;
}

function loadSchema() {
  return JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
}

function makeAjv() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(loadSchema());
}

function runSchemaSelfTest() {
  // PR#1: structural/schema-shape verification only. Cross-ref self-test will
  // be added in PR#2 once nodes:[] is populated (separate fixtures triggering
  // NODE_PATH_MISSING, HANDOFF_REF_ORPHAN, etc.).
  const fixturePath = path.join(
    REPO_ROOT,
    "scripts/governance/__fixtures__/agent-operating-map.invalid.yaml",
  );
  let fixture;
  let ajvValidate;
  try {
    fixture = loadYaml(fixturePath);
    ajvValidate = makeAjv();
  } catch (e) {
    console.error(`[FATAL] schema self-test setup failed: ${e.message}`);
    process.exit(EXIT_OP_ERROR);
  }
  const findings = checkMap(fixture, ajvValidate);
  const passedSchema = findings.some((f) => f.code === "SCHEMA");
  if (!passedSchema) {
    console.error(
      "schema self-test: FAIL — invalid fixture did not trigger SCHEMA error",
    );
    process.exit(EXIT_VALIDATION);
  }
  console.log("schema self-test: PASS (schema validation error detected)");

  // department_handoffs cross-checks: a schema-valid fixture whose defects the
  // schema cannot express (duplicate id, from/to naming no declared department).
  const handoffFixturePath = path.join(
    REPO_ROOT,
    "scripts/governance/__fixtures__/agent-operating-map.dept-handoffs.invalid.yaml",
  );
  let handoffFixture;
  try {
    handoffFixture = loadYaml(handoffFixturePath);
  } catch (e) {
    console.error(`[FATAL] handoff self-test setup failed: ${e.message}`);
    process.exit(EXIT_OP_ERROR);
  }
  const handoffFindings = checkMap(handoffFixture, ajvValidate);
  const expected = ["DEPT_HANDOFF_DUPLICATE_ID", "DEPT_HANDOFF_DEPT_UNRESOLVED"];
  const missing = expected.filter(
    (code) =>
      !handoffFindings.some((f) => f.code === code && f.severity === "warn"),
  );
  if (handoffFindings.some((f) => f.code === "SCHEMA") || missing.length > 0) {
    console.error(
      `handoff self-test: FAIL — expected warn findings ${expected.join(", ")}; missing: ${missing.join(", ") || "none"}; got: ${handoffFindings.map((f) => f.code).join(", ") || "none"}`,
    );
    process.exit(EXIT_VALIDATION);
  }
  console.log(
    "handoff self-test: PASS (duplicate id + unresolved department detected)",
  );

  // Department contracts (decision 72): an incomplete contract must be refused,
  // by the schema (contract absent) and by checkDepartmentContracts (producer
  // missing on disk, producer without kpi_primary, fewer than 24 contracts).
  const contractFixturePath = path.join(
    REPO_ROOT,
    "scripts/governance/__fixtures__/agent-operating-map.contract.invalid.yaml",
  );
  let contractFixture;
  try {
    contractFixture = loadYaml(contractFixturePath);
  } catch (e) {
    console.error(`[FATAL] contract self-test setup failed: ${e.message}`);
    process.exit(EXIT_OP_ERROR);
  }
  const exists = (rel) => fs.existsSync(path.join(REPO_ROOT, rel));
  const contractCheck = checkDepartmentContracts(contractFixture.departments, exists);
  const wanted = [/producer not on disk/, /has no kpi_primary/, /expected 24/];
  const notRaised = wanted.filter((re) => !contractCheck.errors.some((e) => re.test(e.message)));
  const withoutContract = structuredClone(contractFixture);
  delete withoutContract.departments[0].contract;
  const schemaRefuses =
    !ajvValidate(withoutContract) &&
    (ajvValidate.errors || []).some((e) => e.params && e.params.missingProperty === "contract");
  const withoutCommon = structuredClone(contractFixture);
  delete withoutCommon.department_contract_common;
  const commonRequired =
    !ajvValidate(withoutCommon) &&
    (ajvValidate.errors || []).some((e) => e.params && e.params.missingProperty === "department_contract_common");
  const inMap = checkMap(contractFixture, ajvValidate).some(
    (f) => f.code === "DEPT_CONTRACT_INCOMPLETE" && f.severity === "error",
  );
  if (notRaised.length > 0 || !schemaRefuses || !commonRequired || !inMap) {
    console.error(
      `contract self-test: FAIL — not raised: ${notRaised.map(String).join(", ") || "none"}; ` +
        `schema refuses missing contract: ${schemaRefuses}; common rules required: ${commonRequired}; checkMap error: ${inMap}`,
    );
    process.exit(EXIT_VALIDATION);
  }
  console.log(
    "contract self-test: PASS (missing contract, missing common rules, absent producer, producer without KPI and count detected)",
  );
  runFunctionsSelfTest(ajvValidate);
  process.exit(EXIT_OK);
}

/**
 * Department functions (mandate BX): the valid fixture must pass the schema and
 * checkDepartmentFunctions; each in-memory break must be refused by the rule it
 * breaks (or by the schema for a shape defect). Exits 1 on the first miss.
 */
function runFunctionsSelfTest(ajvValidate) {
  const fixturePath = path.join(
    REPO_ROOT,
    "scripts/governance/__fixtures__/agent-operating-map.functions.valid.yaml",
  );
  let valid;
  try {
    valid = loadYaml(fixturePath);
  } catch (e) {
    console.error(`[FATAL] functions self-test setup failed: ${e.message}`);
    process.exit(EXIT_OP_ERROR);
  }
  const run = (m) => checkDepartmentFunctions(m.departments, functionDeps(m)).errors;
  const failures = [];
  if (!ajvValidate(valid)) failures.push(`valid fixture refused by the schema: ${ajvValidate.errors.map((e) => `${e.instancePath} ${e.message}`).join("; ")}`);
  const validErrors = run(valid);
  if (validErrors.length > 0) failures.push(`valid fixture refused: ${validErrors.map((e) => e.message).join("; ")}`);
  if (checkMap(valid, ajvValidate).some((f) => f.code === "DEPT_FUNCTION_INVALID")) failures.push("valid fixture raises DEPT_FUNCTION_INVALID in checkMap");

  // One refused case per coherence rule; `f` = the operational function, `g` =
  // the decided-only one, `h` = the missing one.
  const cases = [
    ["empty", "department without function", (m) => { delete m.departments[0].functions; }],
    ["capability", "capability owned by two departments", (m) => { m.departments.push({ id: "b", lead: "b-lead", capabilities: ["fixture-cap"], functions: [] }); }],
    ["capability", "listing department is not the declared owner", (m) => { m.declared_capabilities[0].owner = "b"; }],
    ["missing", "missing function citing a proof", (m, f, g, h) => { h.evidence = [{ path: "scripts/governance/__fixtures__" }]; }],
    ["missing", "missing function covering an element", (m, f, g, h) => { h.covers = [{ module: "health" }]; }],
    ["missing", "existing function without any proof", (m, f, g) => { g.evidence = [{ absent: "aucune preuve, fixture" }]; }],
    ["covers", "covered module absent", (m, f) => { f.covers[0].module = "no-such-module"; }],
    ["covers", "covered route prefix matching no file", (m, f) => { f.covers[1].routes = "no-such-route"; }],
    ["covers", "covered workflow absent", (m, f) => { f.covers[2].workflow = ".github/workflows/absent.yml"; }],
    ["covers", "covered cron file without @Cron", (m, f) => { f.covers[3].cron = ".github/workflows/ci.yml"; }],
    ["operability", "operational without a wired trigger", (m, f) => { f.trigger.wired = false; }],
    ["operability", "operational without a check", (m, f) => { delete f.check; }],
    ["operability", "operational without an owner", (m, f) => { delete f.owner; }],
    ["operability", "non_operational above L1 without a trigger", (m, f, g) => { g.level = "L2"; }],
    ["path", "trigger path absent", (m, f) => { f.trigger.ref = "scripts/governance/__fixtures__/absent.yml"; }],
    ["path", "check path absent", (m, f) => { f.check.ref = "scripts/governance/__fixtures__/absent.test.ts"; }],
    ["path", "evidence path absent", (m, f) => { f.evidence[0].path = "scripts/governance/__fixtures__/absent.ts"; }],
    ["path", "evidence line range beyond the file", (m, f) => { f.evidence[0].lines = "1-999999"; }],
    ["path", "evidence workflow absent", (m, f) => { f.evidence[2].workflow = ".github/workflows/absent.yml"; }],
    ["kpi", "present kpi_input whose producer is absent", (m, f) => { f.kpi_input[0].producer = "scripts/governance/__fixtures__/absent.ts"; }],
    ["kpi", "present kpi_input whose rule is not in the producer", (m, f) => { f.kpi_input[0].producer = ".github/workflows/ci.yml"; }],
    ["id", "duplicate function id", (m, f, g) => { g.id = f.id; }],
    ["id", "function id not prefixed by its department", (m, f) => { f.id = "b.operational"; }],
    ["reference", "subagent absent", (m, f) => { f.agents = ["no-such-subagent"]; }],
    ["reference", "skill absent", (m, f) => { f.skills = ["no-such-skill"]; }],
    ["reference", "owner neither lead nor subagent", (m, f) => { f.owner = "no-such-owner"; }],
    ["reference", "capability not declared", (m, f) => { f.uses = [{ capability: "no-such-cap", from: "a" }]; }],
    ["reference", "capability consumed from a department that does not own it", (m, f) => { f.uses = [{ capability: "fixture-cap", from: "b" }]; }],
  ];
  for (const [rule, label, mutate] of cases) {
    const m = structuredClone(valid);
    const [f, g, h] = m.departments[0].functions;
    mutate(m, f, g, h);
    const errs = run(m);
    if (!errs.some((e) => e.rule === rule)) failures.push(`${rule} / ${label}: not refused (got ${errs.map((e) => e.rule).join(", ") || "nothing"})`);
  }

  // Shape defects the schema refuses before the coherence rules run.
  const schemaCases = [
    ["missing function above L0", (f, g, h) => { h.level = "L1"; }],
    ["missing function without justification", (f, g, h) => { delete h.justification; }],
    ["missing function with covers", (f, g, h) => { h.covers = [{ module: "health" }]; }],
    ["cover naming two kinds of element", (f) => { f.covers[0].workflow = ".github/workflows/ci.yml"; }],
    ["unknown status", (f) => { f.status = "planned"; }],
    ["function without owner field", (f, g) => { delete g.owner; }],
    ["department with an empty functions list", (f, g, h, m) => { m.departments[0].functions = []; }],
    ["à attribuer entry without reason", (f, g, h, m) => { delete m.function_coverage_unassigned[0].reason; }],
    ["present kpi_input without producer", (f) => { delete f.kpi_input[0].producer; }],
    ["absent kpi_input without note", (f, g) => { delete g.kpi_input[0].note; }],
    ["unknown level", (f) => { f.level = "L5"; }],
    ["threshold label outside dept:NN-<id>", (f) => { f.threshold.issue_label = "sales"; }],
    ["absolute path", (f) => { f.trigger.ref = "/etc/passwd"; }],
    ["parent path", (f) => { f.check.ref = "../outside.js"; }],
    ["unknown field", (f) => { f.extra = true; }],
  ];
  for (const [label, mutate] of schemaCases) {
    const m = structuredClone(valid);
    const [f, g, h] = m.departments[0].functions;
    mutate(f, g, h, m);
    if (ajvValidate(m)) failures.push(`schema / ${label}: not refused`);
  }

  // Coverage report (complement BX-2): elements no function covers are reported,
  // listed à attribuer entries are kept apart, stale entries are flagged.
  const inventory = {
    modules: ["health", "maintenance", "orphan-module"],
    routes: ["admin.system", "admin.system-config._index", "orphan-route"],
    workflows: [".github/workflows/ci.yml", ".github/workflows/orphan.yml"],
    cronFiles: ["backend/src/modules/orders/services/order-cleanup.service.ts", "backend/src/orphan.service.ts"],
    agents: ["marketing-lead-agent", "orphan-agent"],
    skills: ["code-review", "orphan-skill"],
  };
  const withStale = structuredClone(valid);
  withStale.function_coverage_unassigned.push({ module: "health", reason: "déjà couvert, fixture" });
  const cov = functionCoverage(withStale, inventory);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const coverageChecks = [
    ["unattached module", same(cov.unattached.module, ["orphan-module"])],
    ["unattached routes (prefix stops at the segment)", same(cov.unattached.routes, ["admin.system-config._index", "orphan-route"])],
    ["unattached workflow", same(cov.unattached.workflow, [".github/workflows/orphan.yml"])],
    ["unattached cron file", same(cov.unattached.cron, ["backend/src/orphan.service.ts"])],
    ["à attribuer kept apart", cov.unassigned.length === 1 && cov.unassigned[0].element === "maintenance"],
    ["stale à attribuer entry", cov.stale.some((u) => u.element === "health" && u.why === "covered by a function")],
    ["uncited subagent", same(cov.agents_uncited, ["orphan-agent"])],
    ["uncited skill", same(cov.skills_uncited, ["orphan-skill"])],
    ["crontab lines cited", same(cov.crontab_lines_cited, [39])],
    ["route key drops `_` suffixes", routeKey("account_.orders.$orderId.tsx") === "account.orders.$orderId" && routeKey("_public+/_layout.tsx") === "_public+/_layout"],
  ];
  for (const [label, ok] of coverageChecks) if (!ok) failures.push(`coverage / ${label}: wrong report ${JSON.stringify(cov)}`);

  if (failures.length > 0) {
    console.error(`functions self-test: FAIL\n  - ${failures.join("\n  - ")}`);
    process.exit(EXIT_VALIDATION);
  }
  console.log(
    `functions self-test: PASS (valid fixture accepted; ${cases.length} coherence breaks and ${schemaCases.length} schema breaks refused; ${coverageChecks.length} coverage report checks)`,
  );
}

/** Build + persist the JSON report, returning the partitioned findings. */
function writeReport(findings) {
  const errors = findings.filter((f) => f.severity === "error");
  const warns = findings.filter((f) => f.severity === "warn");
  const report = {
    generated_at: new Date().toISOString(),
    map_path: path.relative(REPO_ROOT, MAP_PATH),
    counts: {
      errors: errors.length,
      warns: warns.length,
      total: findings.length,
    },
    findings,
  };
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  return { report, errors, warns };
}

/**
 * Operational failure (missing/unparseable map or schema). Surfaced as a
 * structured `error` finding in the report — never a raw stack trace — then
 * exit 2. Independent of --strict: an infra failure is not a validation verdict.
 */
function failOperational(code, message) {
  const { report } = writeReport([
    { severity: "error", code, message, where: null },
  ]);
  if (jsonOut) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.error(`[FATAL] ${code}: ${message}`);
    console.error(`Report: ${path.relative(REPO_ROOT, REPORT_PATH)}`);
  }
  process.exit(EXIT_OP_ERROR);
}

/**
 * --contracts: the blocking gate of decision 72. Schema errors and incomplete
 * contracts fail (exit 1); pending fields are listed, never hidden, never a failure.
 */
function runContractsGate(map, ajvValidate) {
  const schemaErrors = ajvValidate(map) ? [] : ajvValidate.errors || [];
  const { errors, pending, unproduced } =
    schemaErrors.length === 0
      ? checkDepartmentContracts(map.departments || [], (rel) =>
          fs.existsSync(path.join(REPO_ROOT, rel)),
        )
      : { errors: [], pending: [], unproduced: [] };
  const functions =
    schemaErrors.length === 0
      ? checkDepartmentFunctions(map.departments || [], functionDeps(map))
      : { errors: [], summary: [] };
  const coverage = schemaErrors.length === 0 ? functionCoverage(map, coverageInventoryOnDisk()) : null;
  const byDepartment = {};
  for (const f of functions.summary) {
    const c = (byDepartment[f.department] = byDepartment[f.department] || { operational: 0, non_operational: 0, missing: 0 });
    c[f.status] += 1;
  }
  const result = {
    ok: schemaErrors.length === 0 && errors.length === 0 && functions.errors.length === 0,
    schema_errors: schemaErrors.map((e) => `${e.instancePath || "<root>"} ${e.message}`),
    contract_errors: errors,
    function_errors: functions.errors,
    functions: functions.summary,
    functions_by_department: byDepartment,
    coverage,
    pending_owner_decision: pending,
    departments_with_pending: [...new Set(pending.map((p) => p.id))].length,
    kpi_without_producer: unproduced,
  };
  if (jsonOut) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(
      `department contracts: ${result.schema_errors.length} schema errors, ${errors.length} contract errors, ` +
        `${pending.length} fields pending owner decision in ${result.departments_with_pending} departments, ` +
        `${unproduced.length} decided KPIs without producer`,
    );
    for (const m of result.schema_errors) console.log(`  [ERROR] SCHEMA: ${m}`);
    console.log(
      `department functions: ${functions.summary.length} declared, ` +
        `${functions.summary.filter((f) => f.status === "operational").length} operational, ` +
        `${functions.errors.length} function errors`,
    );
    for (const e of errors) console.log(`  [ERROR] DEPT_CONTRACT_INCOMPLETE: ${e.message}`);
    for (const e of functions.errors) console.log(`  [ERROR] DEPT_FUNCTION_INVALID [${e.rule}]: ${e.message}`);
    for (const f of functions.summary) console.log(`  [FUNCTION] ${f.id}: ${f.status}, ${f.level}`);
    for (const [d, c] of Object.entries(byDepartment)) {
      console.log(`  [DEPARTMENT] ${d}: ${c.operational} operational, ${c.non_operational} non_operational, ${c.missing} missing`);
    }
    if (coverage) {
      const total = Object.values(coverage.unattached).reduce((n, xs) => n + xs.length, 0);
      console.log(
        `function coverage (report, not blocking): ${total} elements attached to no function, ` +
          `${coverage.unassigned.length} listed à attribuer, ${coverage.stale.length} stale à attribuer entries, ` +
          `${coverage.agents_uncited.length} subagents and ${coverage.skills_uncited.length} skills cited by no function, ` +
          `crontab lines cited: ${coverage.crontab_lines_cited.join(", ") || "none"}`,
      );
      for (const [kind, xs] of Object.entries(coverage.unattached)) for (const x of xs) console.log(`  [UNATTACHED] ${kind}: ${x}`);
      for (const u of coverage.unassigned) console.log(`  [À ATTRIBUER] ${u.kind}: ${u.element} — ${u.reason}`);
      for (const u of coverage.stale) console.log(`  [STALE] ${u.kind}: ${u.element} — ${u.why}`);
      for (const a of coverage.agents_uncited) console.log(`  [UNCITED] subagent: ${a}`);
      for (const k of coverage.skills_uncited) console.log(`  [UNCITED] skill: ${k}`);
    }
    for (const p of pending) console.log(`  [PENDING] ${p.id}.${p.field}: ${p.reason}`);
    for (const u of unproduced) console.log(`  [NO PRODUCER] ${u.id}.kpi: ${u.missing}`);
  }
  process.exit(result.ok ? EXIT_OK : EXIT_VALIDATION);
}

function main() {
  if (selfTest) return runSchemaSelfTest();

  let ajvValidate;
  try {
    ajvValidate = makeAjv();
  } catch (e) {
    return failOperational(
      "SCHEMA_LOAD",
      `cannot load/compile schema at ${path.relative(REPO_ROOT, SCHEMA_PATH)}: ${e.message}`,
    );
  }

  if (!fs.existsSync(MAP_PATH)) {
    return failOperational(
      "MAP_MISSING",
      `map not found on disk: ${path.relative(REPO_ROOT, MAP_PATH)}`,
    );
  }

  let map;
  try {
    map = loadYaml(MAP_PATH);
  } catch (e) {
    return failOperational(
      "MAP_PARSE",
      `cannot parse YAML at ${path.relative(REPO_ROOT, MAP_PATH)}: ${e.message}`,
    );
  }

  if (contractsOnly) return runContractsGate(map, ajvValidate);

  const findings = checkMap(map, ajvValidate);
  const { report, errors, warns } = writeReport(findings);

  if (jsonOut) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(
      `agent-operating-map: ${errors.length} errors, ${warns.length} warnings`,
    );
    for (const f of findings) {
      console.log(`  [${f.severity.toUpperCase()}] ${f.code}: ${f.message}`);
    }
    console.log(`Report: ${path.relative(REPO_ROOT, REPORT_PATH)}`);
  }

  process.exit(strict && errors.length > 0 ? EXIT_VALIDATION : EXIT_OK);
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    process.stderr.write(`[FATAL] ${e.message}\n`);
    if (process.env.DEBUG) process.stderr.write(`${e.stack}\n`);
    process.exit(EXIT_OP_ERROR);
  }
}

module.exports = {
  checkMap,
  checkDepartmentProfiles,
  checkDepartmentContracts,
  checkDepartmentFunctions,
  functionCoverage,
  routeKey,
  makeAjv,
  loadYaml,
};
